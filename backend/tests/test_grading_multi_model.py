"""Multi-model grading tests.

The demo keys have no credits, so the happy path is proved with a stubbed
AsyncOpenAI client that returns canned completions. These tests pin down the
things that go on stage: the response shape, the cost arithmetic, the
comparison ratios, and — most importantly — that a failing provider degrades to
a per-model error instead of blanking the screen.

Run with:  .venv/bin/python -m pytest tests -q
"""

from __future__ import annotations

import asyncio
import time
from types import SimpleNamespace

import httpx
import openai
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

import app.models.exam  # noqa: F401 - register tables
import app.models.submission  # noqa: F401 - register tables
from app.database import get_session
from app.main import app as fastapi_app
from app.models.exam import Exam
from app.models_registry import MODEL_REGISTRY, default_model_ids
from app.schemas.submission import AnswerInput
from app.seed import DEMO_EXAM_DATA
from app.services import grading


LARGE = MODEL_REGISTRY["gpt-5.6-sol"]  # $5.00 in / $30.00 out per Mtok
SMALL = MODEL_REGISTRY["llama-3.1-8b-instant"]  # $0.05 in / $0.08 out per Mtok

QUESTIONS = DEMO_EXAM_DATA["questions"]  # credits 2, 5, 8 -> max_score 15
# Every answer here is comfortably longer than settings.min_answer_chars: the
# grader now refuses to spend an API call on anything shorter (see
# grading._skip_reason), so a stub-length answer would be scored 0 locally and
# these tests would never reach the code they are about.
ANSWERS = [
    AnswerInput(question_index=0, answer="AI is the study of intelligent machines."),
    AnswerInput(question_index=1, answer="Supervised learning uses labelled data."),
    AnswerInput(question_index=2, answer="Ethically, AI in healthcare is complicated."),
]


# ---------------------------------------------------------------------------
# Stub client
# ---------------------------------------------------------------------------


def _completion(content: str | None, prompt_tokens: int | None, completion_tokens: int | None):
    """A minimal stand-in for an OpenAI ChatCompletion response."""
    usage = None
    if prompt_tokens is not None and completion_tokens is not None:
        usage = SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        )
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        usage=usage,
    )


class StubCompletions:
    def __init__(self, handler):
        self._handler = handler
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return await self._handler(kwargs)


class StubClient:
    def __init__(self, handler):
        self.completions = StubCompletions(handler)
        self.chat = SimpleNamespace(completions=self.completions)


# Captured once at import so repeated install_stub() calls inside a single test
# re-wrap the genuine implementation instead of stacking on the previous stub.
_REAL_GRADE_ANSWER = grading._grade_answer


async def _fake_get_client(base_url, api_key):
    """Client construction succeeds; the per-model stub is swapped in below."""
    return SimpleNamespace()


def install_stub(monkeypatch, handlers: dict[str, object]) -> dict[str, StubClient]:
    """Swap a per-model stub client into the grading pipeline.

    `handlers` maps api_model_name -> async fn(kwargs) -> response (or raises).
    grading._get_client is keyed by (base_url, api_key) but the stubs need to be
    keyed by model, so the substitution happens one level up in _grade_answer.
    """
    clients = {name: StubClient(h) for name, h in handlers.items()}

    async def patched_grade_answer(*, client, spec, **kwargs):
        return await _REAL_GRADE_ANSWER(client=clients[spec.api_model_name], spec=spec, **kwargs)

    monkeypatch.setattr(grading, "_grade_answer", patched_grade_answer)
    monkeypatch.setattr(grading, "_get_client", _fake_get_client)
    return clients


@pytest.fixture(autouse=True)
def _keys_configured(monkeypatch):
    """Pretend both provider keys are configured so availability gates pass."""
    monkeypatch.setattr(grading.settings, "openai_api_key", "test-openai-key", raising=False)
    monkeypatch.setattr(grading.settings, "groq_api_key", "test-groq-key", raising=False)
    from app import models_registry

    monkeypatch.setattr(models_registry.settings, "openai_api_key", "test-openai-key", raising=False)
    monkeypatch.setattr(models_registry.settings, "groq_api_key", "test-groq-key", raising=False)


def perfect_scorer(delay: float = 0.0, prompt_tokens: int = 1000, completion_tokens: int = 100):
    """Awards full marks; reads max_score back out of the prompt."""

    async def handler(kwargs):
        if delay:
            await asyncio.sleep(delay)
        prompt = kwargs["messages"][1]["content"]
        max_score = int(prompt.rsplit("out of ", 1)[1].split(" ")[0])
        body = '{"score": %d, "explanation": "Full marks."}' % max_score
        return _completion(body, prompt_tokens, completion_tokens)

    return handler


def minus_one_scorer(delay: float = 0.0, prompt_tokens: int = 1000, completion_tokens: int = 100):
    """Awards max_score - 1."""

    async def handler(kwargs):
        if delay:
            await asyncio.sleep(delay)
        prompt = kwargs["messages"][1]["content"]
        max_score = int(prompt.rsplit("out of ", 1)[1].split(" ")[0])
        body = '{"score": %d, "explanation": "Nearly there."}' % (max_score - 1)
        return _completion(body, prompt_tokens, completion_tokens)

    return handler


def raiser(exc: Exception):
    async def handler(kwargs):
        raise exc

    return handler


def _status_error(status: int, code: str | None = None) -> openai.APIStatusError:
    body = {"error": {"message": "boom", "code": code}} if code else {"error": {"message": "boom"}}
    request = httpx.Request("POST", "https://example.test/v1/chat/completions")
    response = httpx.Response(status_code=status, json=body, request=request)
    cls = openai.RateLimitError if status == 429 else openai.APIStatusError
    return cls("boom", response=response, body=body)


# ---------------------------------------------------------------------------
# Happy path: results, metrics, cost math, comparison
# ---------------------------------------------------------------------------


def test_happy_path_assembles_results_metrics_and_comparison(monkeypatch):
    install_stub(
        monkeypatch,
        {
            LARGE.api_model_name: perfect_scorer(delay=0.06),
            SMALL.api_model_name: minus_one_scorer(delay=0.01),
        },
    )

    results, comparison = asyncio.run(
        grading.grade_submission(QUESTIONS, ANSWERS, [LARGE, SMALL])
    )

    assert [r.model_id for r in results] == [LARGE.id, SMALL.id]
    assert all(r.status == "ok" and r.error is None for r in results)

    large, small = results

    # Scores: full marks (2+5+8) vs one-off (1+4+7); grades come back ordered.
    assert large.total_score == 15
    assert small.total_score == 12
    assert [g.question_index for g in large.grades] == [0, 1, 2]
    assert [(g.score, g.max_score) for g in large.grades] == [(2, 2), (5, 5), (8, 8)]
    assert [g.score for g in small.grades] == [1, 4, 7]
    assert all(g.explanation for g in large.grades)

    # Tokens: 3 questions x (1000 in, 100 out).
    assert large.metrics.prompt_tokens == 3000
    assert large.metrics.completion_tokens == 300
    assert large.metrics.total_tokens == 3300

    # Cost: (3000/1e6)*5.00 + (300/1e6)*30.00 = 0.015 + 0.009 = 0.024
    assert large.metrics.cost_usd == pytest.approx(0.024)
    # Cost: (3000/1e6)*0.05 + (300/1e6)*0.08 = 0.00015 + 0.000024 = 0.000174
    assert small.metrics.cost_usd == pytest.approx(0.000174)

    assert large.metrics.latency_ms > 0
    assert small.metrics.latency_ms > 0

    assert comparison is not None
    assert comparison.cheapest_model_id == SMALL.id
    assert comparison.fastest_model_id == SMALL.id
    # 0.024 / 0.000174 = 137.93...
    assert comparison.cost_ratio == pytest.approx(137.93, abs=0.01)
    assert comparison.speed_ratio > 1.0
    assert comparison.max_total_score_delta == 3


def test_answers_graded_concurrently_within_and_across_models(monkeypatch):
    """3 questions x 2 models, each call sleeping 0.1s, must finish well under 0.6s."""
    install_stub(
        monkeypatch,
        {
            LARGE.api_model_name: perfect_scorer(delay=0.1),
            SMALL.api_model_name: perfect_scorer(delay=0.1),
        },
    )

    t0 = time.perf_counter()
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [LARGE, SMALL]))
    elapsed = time.perf_counter() - t0

    assert all(r.status == "ok" for r in results)
    assert elapsed < 0.5, f"grading appears serialized ({elapsed:.2f}s for 6 x 0.1s calls)"


def test_comparison_is_none_with_fewer_than_two_successes(monkeypatch):
    install_stub(
        monkeypatch,
        {
            LARGE.api_model_name: perfect_scorer(),
            SMALL.api_model_name: raiser(_status_error(503)),
        },
    )

    results, comparison = asyncio.run(
        grading.grade_submission(QUESTIONS, ANSWERS, [LARGE, SMALL])
    )

    assert [r.status for r in results] == ["ok", "error"]
    assert comparison is None


# ---------------------------------------------------------------------------
# Graceful degradation of malformed model output
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "body",
    [
        "not json at all",
        "",
        None,
        '{"explanation": "no score field"}',
        '{"score": "banana", "explanation": "non-numeric score"}',
        '["a", "list", "not", "an", "object"]',
    ],
)
def test_malformed_output_degrades_to_zero_not_500(monkeypatch, body):
    async def handler(kwargs):
        return _completion(body, 100, 10)

    install_stub(monkeypatch, {SMALL.api_model_name: handler})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    result = results[0]
    assert result.status == "ok"
    assert result.total_score == 0
    assert len(result.grades) == 3
    assert all(g.explanation for g in result.grades)


def test_missing_explanation_gets_placeholder(monkeypatch):
    async def handler(kwargs):
        return _completion('{"score": 1}', 100, 10)

    install_stub(monkeypatch, {SMALL.api_model_name: handler})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    assert results[0].status == "ok"
    assert results[0].total_score == 3  # 1 per question
    assert all(g.explanation.strip() for g in results[0].grades)


def test_scores_are_clamped_to_the_rubric_range(monkeypatch):
    async def handler(kwargs):
        return _completion('{"score": 999, "explanation": "over-generous"}', 100, 10)

    install_stub(monkeypatch, {SMALL.api_model_name: handler})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    assert [g.score for g in results[0].grades] == [2, 5, 8]
    assert results[0].total_score == 15

    async def negative(kwargs):
        return _completion('{"score": -7, "explanation": "harsh"}', 100, 10)

    install_stub(monkeypatch, {SMALL.api_model_name: negative})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))
    assert [g.score for g in results[0].grades] == [0, 0, 0]


def test_missing_usage_nulls_tokens_and_cost_never_estimates(monkeypatch):
    async def handler(kwargs):
        return _completion('{"score": 1, "explanation": "ok"}', None, None)

    install_stub(monkeypatch, {SMALL.api_model_name: handler})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    metrics = results[0].metrics
    assert results[0].status == "ok"
    assert metrics.prompt_tokens is None
    assert metrics.completion_tokens is None
    assert metrics.total_tokens is None
    assert metrics.cost_usd is None
    assert metrics.latency_ms >= 0


# ---------------------------------------------------------------------------
# Error classification, retries and messages
# ---------------------------------------------------------------------------


def test_error_messages_are_short_and_leak_nothing():
    cases = [
        (_status_error(429), "Rate limited by provider"),
        (_status_error(429, "insufficient_quota"), "No credits remaining"),
        (_status_error(503), "Provider error (HTTP 503)"),
        (openai.APITimeoutError(httpx.Request("POST", "https://example.test")), "Timed out after 60s"),
    ]
    for exc, expected in cases:
        message = grading._friendly_error(exc, "Test Model")
        assert message == expected
        assert "Traceback" not in message
        assert "sk-" not in message
        assert len(message) < 80


def test_transient_errors_are_retried_terminal_ones_are_not(monkeypatch):
    monkeypatch.setattr(grading.settings, "grading_max_attempts", 2, raising=False)

    # 503 is transient -> retried, then succeeds on attempt 2.
    attempts = {"n": 0}

    async def flaky(kwargs):
        attempts["n"] += 1
        if attempts["n"] <= 3:  # first call of each of the 3 questions fails once
            raise _status_error(503)
        return _completion('{"score": 1, "explanation": "ok"}', 100, 10)

    clients = install_stub(monkeypatch, {SMALL.api_model_name: flaky})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))
    assert results[0].status == "ok"
    assert len(clients[SMALL.api_model_name].completions.calls) == 6  # 3 questions x 2 attempts

    # 401 is terminal -> exactly one attempt per question, no retry.
    request = httpx.Request("POST", "https://example.test")
    auth_error = openai.AuthenticationError(
        "bad key",
        response=httpx.Response(401, json={"error": {"message": "bad key"}}, request=request),
        body={"error": {"message": "bad key"}},
    )
    clients = install_stub(monkeypatch, {SMALL.api_model_name: raiser(auth_error)})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))
    assert results[0].status == "error"
    assert results[0].error == "API key rejected by provider"
    assert len(clients[SMALL.api_model_name].completions.calls) == 3  # 1 attempt each

    # insufficient_quota is terminal too.
    clients = install_stub(
        monkeypatch, {SMALL.api_model_name: raiser(_status_error(429, "insufficient_quota"))}
    )
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))
    assert results[0].error == "No credits remaining"
    assert len(clients[SMALL.api_model_name].completions.calls) == 3


# ---------------------------------------------------------------------------
# json_validate_failed: retry, temperature nudge, salvage
# ---------------------------------------------------------------------------

# The exact body Groq returns (SDK-flattened, no {"error": ...} envelope) when
# llama-3.3-70b-versatile emits an unquoted "explanation" value. Captured live
# on 2026-08-08 by grading exam 1 question 2 with an off-topic answer.
FAILED_GENERATION = (
    '{\n  "score": 0,\n   "explanation": The student\'s answer does not address the question '
    "about the ethical implications of AI in healthcare, instead providing a detailed "
    "explanation of the backpropagation algorithm used in neural networks. The answer does not "
    "discuss any benefits, risks, or ethical concerns related to AI in healthcare.\n}"
)


def _json_validate_failed(failed_generation: str | None = FAILED_GENERATION):
    body = {
        "message": "Failed to generate JSON. Please adjust your prompt.",
        "type": "invalid_request_error",
        "code": "json_validate_failed",
    }
    if failed_generation is not None:
        body["failed_generation"] = failed_generation
    request = httpx.Request("POST", "https://api.groq.test/openai/v1/chat/completions")
    return openai.BadRequestError(
        "Failed to generate JSON.",
        response=httpx.Response(400, json={"error": body}, request=request),
        body=body,
    )


def _plain_bad_request():
    """A genuinely malformed request — retrying would fail identically."""
    body = {"message": "Unsupported value: 'temperature'", "type": "invalid_request_error"}
    request = httpx.Request("POST", "https://api.groq.test/openai/v1/chat/completions")
    return openai.BadRequestError(
        "Unsupported value",
        response=httpx.Response(400, json={"error": body}, request=request),
        body=body,
    )


def test_json_validate_failed_is_classified_as_retryable():
    assert grading._is_json_validate_failed(_json_validate_failed()) is True
    assert grading._is_transient(_json_validate_failed()) is True
    # ...and the friendly message names the real cause without leaking anything.
    message = grading._friendly_error(_json_validate_failed(), "Llama 3.3 70B Versatile")
    assert message == "Model could not produce valid JSON"
    assert len(message) < 80


def test_genuinely_malformed_400_stays_non_retryable(monkeypatch):
    assert grading._is_json_validate_failed(_plain_bad_request()) is False
    assert grading._is_transient(_plain_bad_request()) is False

    monkeypatch.setattr(grading.settings, "grading_max_attempts", 2, raising=False)
    monkeypatch.setattr(grading.settings, "grading_json_max_attempts", 3, raising=False)
    clients = install_stub(monkeypatch, {SMALL.api_model_name: raiser(_plain_bad_request())})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    assert results[0].status == "error"
    assert results[0].error == "Provider rejected the grading request"
    assert len(clients[SMALL.api_model_name].completions.calls) == 3  # 1 attempt per question


def test_json_validate_failed_is_retried_without_the_provider_validator(monkeypatch):
    """The whole point of Fix 1: one rejected sample must not kill the column.

    Measured live on 2026-08-08: llama-3.3-70b-versatile fails this input under
    response_format=json_object at EVERY temperature (0/42), but returns HTTP 200
    with usage intact 8/8 once response_format is dropped. So the retry drops it.
    """
    monkeypatch.setattr(grading.settings, "grading_max_attempts", 2, raising=False)
    monkeypatch.setattr(grading.settings, "grading_json_max_attempts", 3, raising=False)

    seen: dict[str, int] = {}

    async def flaky(kwargs):
        prompt = kwargs["messages"][1]["content"]
        seen[prompt] = seen.get(prompt, 0) + 1
        if seen[prompt] == 1:
            assert kwargs["response_format"] == {"type": "json_object"}
            raise _json_validate_failed()
        # The retry must not ask the provider to validate the JSON any more.
        assert "response_format" not in kwargs
        return _completion('{"score": 1, "explanation": "ok"}', 100, 10)

    clients = install_stub(monkeypatch, {SMALL.api_model_name: flaky})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    assert results[0].status == "ok"
    assert results[0].total_score == 3
    assert all(g.recovered is False for g in results[0].grades)
    # The retry succeeded normally, so tokens and cost survive intact.
    assert results[0].metrics.prompt_tokens == 300
    assert results[0].metrics.cost_usd is not None

    calls = clients[SMALL.api_model_name].completions.calls
    assert len(calls) == 6  # 3 questions x (1 rejection + 1 success)
    # First attempt at the normal temperature, the retry pinned to greedy.
    assert sorted(c["temperature"] for c in calls) == [0.0, 0.0, 0.0, 0.3, 0.3, 0.3]
    # The prompt itself never changes — only the request-level knobs.
    assert len({c["messages"][1]["content"] for c in calls}) == 3


def test_retry_content_is_repaired_when_the_model_still_will_not_quote(monkeypatch):
    """The live 70B case: the retry returns 200, but the JSON is still unquoted."""
    monkeypatch.setattr(grading.settings, "grading_json_max_attempts", 2, raising=False)

    async def stubborn(kwargs):
        if "response_format" in kwargs:
            raise _json_validate_failed()
        # Exactly what api.groq.com returns without response_format: a fenced,
        # unquoted object that json.loads rejects but the repair recovers.
        return _completion("```json\n" + FAILED_GENERATION + "\n```", 900, 95)

    install_stub(monkeypatch, {SMALL.api_model_name: stubborn})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    result = results[0]
    assert result.status == "ok"
    assert result.total_score == 0
    assert all(g.recovered is True for g in result.grades)
    assert all("backpropagation" in g.explanation for g in result.grades)
    # This path is a real, billed completion, so the cost column stays honest.
    assert result.metrics.prompt_tokens == 2700
    assert result.metrics.cost_usd == pytest.approx((2700 / 1e6) * 0.05 + (285 / 1e6) * 0.08)


def test_json_failures_get_a_bigger_budget_than_ordinary_transients(monkeypatch):
    monkeypatch.setattr(grading.settings, "grading_max_attempts", 2, raising=False)
    monkeypatch.setattr(grading.settings, "grading_json_max_attempts", 3, raising=False)

    clients = install_stub(
        monkeypatch, {SMALL.api_model_name: raiser(_json_validate_failed(None))}
    )
    asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))
    assert len(clients[SMALL.api_model_name].completions.calls) == 9  # 3 questions x 3 attempts

    clients = install_stub(monkeypatch, {SMALL.api_model_name: raiser(_status_error(503))})
    asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))
    assert len(clients[SMALL.api_model_name].completions.calls) == 6  # 3 questions x 2 attempts


def test_exhausted_retries_salvage_the_grade_from_failed_generation(monkeypatch):
    monkeypatch.setattr(grading.settings, "grading_json_max_attempts", 2, raising=False)
    install_stub(monkeypatch, {SMALL.api_model_name: raiser(_json_validate_failed())})

    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))
    result = results[0]

    assert result.status == "ok"
    assert result.total_score == 0  # the model's own score, not an invented one
    assert len(result.grades) == 3
    assert all(g.recovered is True for g in result.grades)
    assert all("backpropagation" in g.explanation for g in result.grades)
    # Nothing was billed and no usage was reported, so cost is null, never guessed.
    assert result.metrics.cost_usd is None
    assert result.metrics.prompt_tokens is None


def test_salvage_survives_a_retry_that_fails_a_different_way(monkeypatch):
    """The failed_generation from the FIRST rejection is what gets salvaged."""
    monkeypatch.setattr(grading.settings, "grading_json_max_attempts", 2, raising=False)

    async def then_dies(kwargs):
        if "response_format" in kwargs:
            raise _json_validate_failed()
        raise _status_error(503)  # the retry never even reaches the model

    install_stub(monkeypatch, {SMALL.api_model_name: then_dies})
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    assert results[0].status == "ok"
    assert all(g.recovered is True for g in results[0].grades)
    assert results[0].metrics.cost_usd is None  # nothing was billed


def test_unsalvageable_generation_falls_back_to_an_honest_error(monkeypatch):
    """No score is ever invented — a wrong number on a projector is worse."""
    monkeypatch.setattr(grading.settings, "grading_json_max_attempts", 1, raising=False)

    for junk in (None, "", "{", '{"explanation": "no score here at all, sorry"}', '{"score": 3}'):
        install_stub(monkeypatch, {SMALL.api_model_name: raiser(_json_validate_failed(junk))})
        results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))
        assert results[0].status == "error", junk
        assert results[0].error == "Model could not produce valid JSON"
        assert results[0].total_score is None


@pytest.mark.parametrize(
    "text,expected",
    [
        # The live failure: an unquoted string value.
        (FAILED_GENERATION, (0, "The student's answer does not address")),
        # Truncated mid-explanation (unterminated string).
        (
            '{"score": 4, "explanation": "A solid answer that covers most of the rubric',
            (4, "A solid answer that covers most of the rubric"),
        ),
        # Valid after all — the provider was stricter than json.loads.
        ('{"score": 7, "explanation": "Well argued throughout the response."}', (7, "Well argued")),
        # Fields in the other order, explanation unquoted.
        (
            '{\n "explanation": Off topic and unsupported by the rubric,\n "score": 2\n}',
            (2, "Off topic and unsupported by the rubric"),
        ),
        # Float score, as some models emit.
        ('{"score": 5.0, "explanation": "Complete and accurate throughout."}', (5, "Complete")),
    ],
)
def test_repair_recovers_score_and_explanation(text, expected):
    repaired = grading._repair_grade_json(text)
    assert repaired is not None
    score, explanation = repaired
    assert score == expected[0]
    assert expected[1] in explanation
    assert "\n" not in explanation


@pytest.mark.parametrize(
    "text",
    [
        "",
        "   ",
        "{",
        "the model wrote prose instead of json",
        '{"explanation": "a perfectly good explanation but no score anywhere"}',
        '{"score": 3}',  # no explanation
        '{"score": 3, "explanation": "tiny"}',  # too short to trust
        '{"score": "banana", "explanation": "a non-numeric score cannot be trusted"}',
    ],
)
def test_repair_declines_rather_than_guessing(text):
    assert grading._repair_grade_json(text) is None


def test_salvaged_scores_are_clamped_to_the_rubric_range(monkeypatch):
    monkeypatch.setattr(grading.settings, "grading_json_max_attempts", 1, raising=False)
    over = '{"score": 99, "explanation": Wildly over generous but still the model\'s words\n}'
    install_stub(monkeypatch, {SMALL.api_model_name: raiser(_json_validate_failed(over))})

    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))
    assert [g.score for g in results[0].grades] == [2, 5, 8]  # clamped per question


# ---------------------------------------------------------------------------
# Server-side logging (Fix 2)
# ---------------------------------------------------------------------------


def test_model_failure_is_logged_with_the_underlying_exception(monkeypatch, caplog):
    install_stub(monkeypatch, {SMALL.api_model_name: raiser(_status_error(503))})

    with caplog.at_level("INFO", logger="app.services.grading"):
        results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    assert results[0].status == "error"
    errors = [r for r in caplog.records if r.levelname == "ERROR"]
    assert errors, "a failing model must leave a server-side ERROR record"

    joined = "\n".join(r.getMessage() for r in errors)
    assert SMALL.id in joined
    assert "APIStatusError" in joined  # the real exception class, not the friendly text
    assert any(r.exc_info for r in errors), "the traceback must be attached"

    # Retries are logged too, but quietly.
    assert any(r.levelname == "INFO" and "retrying" in r.getMessage() for r in caplog.records)


def test_logs_never_contain_key_material(monkeypatch, caplog):
    leaky = _status_error(500)
    leaky.body["error"]["message"] = "auth failed for gsk_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"
    leaky.message = "Bearer sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345 was rejected"
    install_stub(monkeypatch, {SMALL.api_model_name: raiser(leaky)})

    with caplog.at_level("DEBUG", logger="app.services.grading"):
        asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    joined = caplog.text
    assert "gsk_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345" not in joined
    assert "sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345" not in joined
    assert "<redacted>" in joined


def test_friendly_error_is_all_the_user_ever_sees(client, monkeypatch):
    """The browser gets the short string; internals stay in the log."""
    install_stub(monkeypatch, {SMALL.api_model_name: raiser(_json_validate_failed())})
    monkeypatch.setattr(grading.settings, "grading_json_max_attempts", 1, raising=False)
    monkeypatch.setattr(grading, "_salvage_grade", lambda *a, **k: None)

    response = client.post(
        "/api/submissions/preview",
        json={"exam_id": 1, "answers": [a.model_dump() for a in ANSWERS], "model_ids": [SMALL.id]},
    )
    body = response.text
    assert "Traceback" not in body
    assert "failed_generation" not in body
    assert "Model could not produce valid JSON" in body


# ---------------------------------------------------------------------------
# Structured outputs (Fix 1a)
# ---------------------------------------------------------------------------


def test_response_format_is_driven_by_the_registry_flag(monkeypatch):
    """json_schema where the provider constrains generation, json_object elsewhere."""
    clients = install_stub(
        monkeypatch,
        {LARGE.api_model_name: perfect_scorer(), SMALL.api_model_name: perfect_scorer()},
    )
    asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [LARGE, SMALL]))

    assert LARGE.supports_json_schema is True  # OpenAI: Structured Outputs
    assert SMALL.supports_json_schema is False  # Groq Llama: verified 400 live

    for call in clients[LARGE.api_model_name].completions.calls:
        schema = call["response_format"]
        assert schema["type"] == "json_schema"
        assert schema["json_schema"]["strict"] is True
        assert schema["json_schema"]["schema"]["additionalProperties"] is False
        assert set(schema["json_schema"]["schema"]["required"]) == {"score", "explanation"}

    for call in clients[SMALL.api_model_name].completions.calls:
        assert call["response_format"] == {"type": "json_object"}


def test_unconfigured_key_reports_cleanly_without_calling_the_api(monkeypatch):
    from app import models_registry

    monkeypatch.setattr(models_registry.settings, "groq_api_key", "", raising=False)
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [SMALL]))

    assert results[0].status == "error"
    assert results[0].error == "API key not configured"
    assert results[0].total_score is None
    assert results[0].grades == []
    assert results[0].metrics is None


def test_prompt_is_identical_across_models(monkeypatch):
    """The fairness guarantee: every model sees byte-for-byte the same messages."""
    clients = install_stub(
        monkeypatch,
        {
            LARGE.api_model_name: perfect_scorer(),
            SMALL.api_model_name: perfect_scorer(),
        },
    )
    asyncio.run(grading.grade_submission(QUESTIONS, ANSWERS, [LARGE, SMALL]))

    def messages_by_question(client):
        return sorted(
            (call["messages"][0]["content"], call["messages"][1]["content"])
            for call in client.completions.calls
        )

    assert messages_by_question(clients[LARGE.api_model_name]) == messages_by_question(
        clients[SMALL.api_model_name]
    )
    # ...and only the provider-imposed sampling knob differs.
    assert all("temperature" not in c for c in clients[LARGE.api_model_name].completions.calls)
    assert all(
        c["temperature"] == 0.3 for c in clients[SMALL.api_model_name].completions.calls
    )


# ---------------------------------------------------------------------------
# HTTP layer
# ---------------------------------------------------------------------------


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Exam(**DEMO_EXAM_DATA))
        session.commit()

    def override_session():
        with Session(engine) as session:
            yield session

    fastapi_app.dependency_overrides[get_session] = override_session
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


def test_get_models_returns_registry_with_availability(client):
    response = client.get("/api/models")
    assert response.status_code == 200
    payload = response.json()

    assert {m["id"] for m in payload} >= {
        "gpt-5.6-sol",
        "gpt-4o-mini",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
    }
    for entry in payload:
        assert set(entry) == {
            "id",
            "label",
            "provider",
            "tier",
            "available",
            "default_selected",
            "price_in_per_mtok",
            "price_out_per_mtok",
        }
        assert entry["tier"] in {"large", "small"}
        assert isinstance(entry["available"], bool)
        assert isinstance(entry["default_selected"], bool)

    by_id = {m["id"]: m for m in payload}
    assert by_id["gpt-5.6-sol"]["price_in_per_mtok"] == 5.00
    assert by_id["gpt-5.6-sol"]["price_out_per_mtok"] == 30.00
    assert by_id["llama-3.1-8b-instant"]["price_in_per_mtok"] == 0.05
    assert by_id["llama-3.1-8b-instant"]["price_out_per_mtok"] == 0.08


def test_exactly_the_cheap_pair_is_preselected_by_default(client):
    """What runs on a zero-click "Try" is pinned here, on purpose.

    The student view ticks every model with default_selected=true, so a registry
    edit that flags an expensive model would silently start billing $5/$30 per
    Mtok on every casual click. gpt-5.6-sol must stay selectable but unticked.
    """
    payload = client.get("/api/models").json()
    flagged = {m["id"] for m in payload if m["default_selected"]}
    assert flagged == {"gpt-4o-mini", "llama-3.1-8b-instant"}

    by_id = {m["id"]: m for m in payload}
    assert by_id["gpt-5.6-sol"]["default_selected"] is False
    assert by_id["llama-3.3-70b-versatile"]["default_selected"] is False

    # The server-side fallback (requests that omit model_ids) must agree with
    # the UI default, or the two paths grade with different models.
    assert set(default_model_ids()) == flagged


def test_preview_returns_contract_shape_and_does_not_persist(client, monkeypatch):
    install_stub(
        monkeypatch,
        {
            LARGE.api_model_name: perfect_scorer(delay=0.02),
            SMALL.api_model_name: minus_one_scorer(),
        },
    )

    response = client.post(
        "/api/submissions/preview",
        json={
            "exam_id": 1,
            "answers": [a.model_dump() for a in ANSWERS],
            "model_ids": [LARGE.id, SMALL.id],
        },
    )
    assert response.status_code == 200
    payload = response.json()

    assert set(payload) == {"max_score", "is_final", "submission_id", "results", "comparison"}
    assert payload["max_score"] == 15
    assert payload["is_final"] is False
    assert payload["submission_id"] is None
    assert len(payload["results"]) == 2

    result = payload["results"][0]
    assert set(result) == {
        "model_id",
        "label",
        "tier",
        "status",
        "error",
        "total_score",
        "grades",
        "metrics",
    }
    assert set(result["grades"][0]) == {
        "question_index",
        "score",
        "max_score",
        "explanation",
        "recovered",
    }
    assert result["grades"][0]["recovered"] is False
    assert set(result["metrics"]) == {
        "latency_ms",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "cost_usd",
    }
    assert set(payload["comparison"]) == {
        "cheapest_model_id",
        "fastest_model_id",
        "cost_ratio",
        "speed_ratio",
        "max_total_score_delta",
    }


def test_partial_failure_is_http_200(client, monkeypatch):
    install_stub(
        monkeypatch,
        {
            LARGE.api_model_name: raiser(_status_error(429, "insufficient_quota")),
            SMALL.api_model_name: perfect_scorer(),
        },
    )

    response = client.post(
        "/api/submissions/preview",
        json={
            "exam_id": 1,
            "answers": [a.model_dump() for a in ANSWERS],
            "model_ids": [LARGE.id, SMALL.id],
        },
    )
    assert response.status_code == 200
    results = {r["model_id"]: r for r in response.json()["results"]}

    failed = results[LARGE.id]
    assert failed["status"] == "error"
    assert failed["error"] == "No credits remaining"
    assert failed["total_score"] is None
    assert failed["grades"] == []
    assert failed["metrics"] is None

    assert results[SMALL.id]["status"] == "ok"
    assert response.json()["comparison"] is None


def test_total_failure_is_non_200(client, monkeypatch):
    install_stub(
        monkeypatch,
        {
            LARGE.api_model_name: raiser(_status_error(429, "insufficient_quota")),
            SMALL.api_model_name: raiser(_status_error(503)),
        },
    )

    response = client.post(
        "/api/submissions/preview",
        json={
            "exam_id": 1,
            "answers": [a.model_dump() for a in ANSWERS],
            "model_ids": [LARGE.id, SMALL.id],
        },
    )
    assert response.status_code == 502
    assert "No credits remaining" in response.json()["detail"]


def test_unknown_exam_and_unknown_model_are_rejected(client):
    missing_exam = client.post(
        "/api/submissions/preview",
        json={"exam_id": 999, "answers": [ANSWERS[0].model_dump()]},
    )
    assert missing_exam.status_code == 404
    assert missing_exam.json()["detail"] == "Exam not found"

    bad_model = client.post(
        "/api/submissions/preview",
        json={
            "exam_id": 1,
            "answers": [ANSWERS[0].model_dump()],
            "model_ids": ["definitely-not-a-model"],
        },
    )
    assert bad_model.status_code == 400
    assert "definitely-not-a-model" in bad_model.json()["detail"]


def test_omitted_model_ids_falls_back_to_default_same_shape(client, monkeypatch):
    from app import models_registry

    monkeypatch.setattr(models_registry.settings, "default_model_ids", SMALL.id, raising=False)
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})

    response = client.post(
        "/api/submissions/preview",
        json={"exam_id": 1, "answers": [a.model_dump() for a in ANSWERS]},
    )
    assert response.status_code == 200
    payload = response.json()
    assert [r["model_id"] for r in payload["results"]] == [SMALL.id]
    assert payload["comparison"] is None  # single model
    assert payload["max_score"] == 15


def test_submit_persists_results_and_legacy_columns(client, monkeypatch):
    install_stub(
        monkeypatch,
        {
            LARGE.api_model_name: perfect_scorer(delay=0.02),
            SMALL.api_model_name: minus_one_scorer(),
        },
    )

    response = client.post(
        "/api/submissions/",
        json={
            "exam_id": 1,
            "answers": [a.model_dump() for a in ANSWERS],
            "model_ids": [LARGE.id, SMALL.id],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["is_final"] is True
    assert payload["submission_id"] is not None

    read = client.get(f"/api/submissions/{payload['submission_id']}")
    assert read.status_code == 200
    stored = read.json()

    # Legacy columns mirror the first successful model.
    assert stored["total_score"] == 15
    assert len(stored["grades"]) == 3
    # ...and the full multi-model payload round-trips.
    assert [r["model_id"] for r in stored["results"]] == [LARGE.id, SMALL.id]
    assert stored["results"][0]["metrics"]["cost_usd"] == pytest.approx(0.024)
    assert stored["comparison"]["max_total_score_delta"] == 3


def test_health_endpoint(client):
    assert client.get("/health").json() == {"status": "ok"}
