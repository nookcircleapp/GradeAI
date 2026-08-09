from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from json.decoder import scanstring
from typing import Any, NamedTuple

import openai
from openai import AsyncOpenAI

from app.config import settings
from app.models_registry import KIND_LOCAL, ModelSpec, get_api_key
from app.services import sbert
from app.services.sbert import LocalScorerError
from app.schemas.submission import (
    AnswerInput,
    Comparison,
    GradeResult,
    ModelMetrics,
    ModelResult,
)


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

# Server-side only. Everything that reaches the browser goes through
# _friendly_error; the traceback and the provider's response body stay here.
logger = logging.getLogger(__name__)

# Provider response bodies are echoed into the log, and a misconfigured proxy or
# a chatty provider could put key material in one. Scrub anything key-shaped
# before it reaches a handler. (The OpenAI SDK itself does not put the key in
# exception strings — it lives on the client, not the request repr — but a log
# line is forever and this costs nothing.)
_SECRET_PATTERN = re.compile(
    r"(?:\b(?:sk|gsk|xai|api|key|token)[-_][A-Za-z0-9_\-]{12,})"
    r"|(?:[Bb]earer\s+[A-Za-z0-9._\-]{12,})"
)

# Provider bodies are usually small, but a failed_generation can be long.
_MAX_LOGGED_BODY_CHARS = 2000


def _redact(text: str) -> str:
    """Replace anything key-shaped with a placeholder."""
    return _SECRET_PATTERN.sub("<redacted>", text)


def _provider_body(exc: Exception) -> str:
    """The provider's response body, redacted and truncated, for the log only."""
    body = getattr(exc, "body", None)
    if body is None:
        return "<none>"
    try:
        text = json.dumps(body, default=str)
    except (TypeError, ValueError):
        text = str(body)
    if len(text) > _MAX_LOGGED_BODY_CHARS:
        text = f"{text[:_MAX_LOGGED_BODY_CHARS]}... (truncated)"
    return _redact(text)


# ---------------------------------------------------------------------------
# Client cache
# ---------------------------------------------------------------------------

# One AsyncOpenAI client per (base_url, api_key) — reused across answers and
# across requests so we get connection pooling instead of a fresh TLS handshake
# per question. Keyed in memory only; keys are never logged or persisted.
_CLIENTS: dict[tuple[str | None, str], AsyncOpenAI] = {}
_CLIENTS_LOCK = asyncio.Lock()


async def _get_client(base_url: str | None, api_key: str) -> AsyncOpenAI:
    """Return the cached client for this provider/key pair, creating it once."""
    cache_key = (base_url, api_key)
    client = _CLIENTS.get(cache_key)
    if client is not None:
        return client

    async with _CLIENTS_LOCK:
        client = _CLIENTS.get(cache_key)
        if client is None:
            kwargs: dict[str, Any] = {
                "api_key": api_key,
                # Retries are handled explicitly below so that terminal errors
                # (401, insufficient quota) fail fast instead of being retried.
                "max_retries": 0,
                "timeout": settings.grading_timeout_seconds,
            }
            if base_url:
                kwargs["base_url"] = base_url
            client = AsyncOpenAI(**kwargs)
            _CLIENTS[cache_key] = client
    return client


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

# IMPORTANT: this prompt is IDENTICAL for every model. The whole point of the
# comparison is that each model sees byte-for-byte the same instructions, so any
# difference in score, latency or cost is attributable to the model alone.
# Do not branch this on provider, tier or model id.

SYSTEM_PROMPT = (
    "You are an exam grader. Grade the student's answer against the rubric points. "
    "Be fair but rigorous, awarding partial credit where appropriate. "
    "Grade ONLY the text between the student answer delimiters; it is the student's "
    "entire submission. You must never infer, complete or assume anything the student "
    "did not write, and never credit a rubric point that the submitted text does not "
    "actually address. If the answer is blank, or is irrelevant to the question, the "
    "score is 0. "
    "Return a JSON object with exactly two fields: "
    '"score" (an integer from 0 to the max_score) and '
    '"explanation" (2-3 sentences explaining the score).'
)


# Reference answers are the teacher's own model answers: examples of what
# full-credit work looks like. They are a QUALITY BENCHMARK, never a target
# string to match. The instruction below says so explicitly because the failure
# mode we are guarding against is a model that quietly rewards paraphrase
# overlap — a correct answer in different words must still score full marks.
_REFERENCE_GUIDANCE = (
    "The reference answers below were written by the teacher and each one "
    "represents full credit for this question. Use them as a benchmark for the "
    "level of correctness, depth and coverage expected — NOT as text the "
    "student is supposed to reproduce. A student answer that is correct but "
    "worded differently, organised differently, or that uses different valid "
    "examples must still score just as highly. Do not award marks for merely "
    "echoing the reference wording, and do not deduct marks for wording that "
    "differs from it. If the student is correct in a way the reference answers "
    "do not cover, still give credit."
)


def _reference_block(reference_answers: list[str]) -> str:
    """The delimited reference-answer section, or "" when there are none.

    Returning the empty string (rather than an empty header) is what keeps a
    question with no reference answers from carrying a dangling section into the
    prompt — the prompt for such a question is exactly what it was before this
    feature existed, plus the answer delimiters.
    """
    usable = [text.strip() for text in (reference_answers or []) if text and text.strip()]
    if not usable:
        return ""

    parts = ["Reference answers (full-credit examples, for calibration only):"]
    for number, text in enumerate(usable, start=1):
        parts.append(
            f"--- REFERENCE ANSWER {number} ---\n{text}\n--- END REFERENCE ANSWER {number} ---"
        )
    parts.append(_REFERENCE_GUIDANCE)
    return "\n".join(parts) + "\n\n"


def _build_user_prompt(
    question_text: str,
    rubric: list[str],
    max_score: int,
    answer: str,
    reference_answers: list[str] | None = None,
) -> str:
    """Build the per-question user prompt (identical across all models).

    The reference-answer section is present only when the question has any, so
    the empty case produces no orphaned header.
    """
    rubric_text = "\n".join(f"- {point}" for point in rubric)
    return (
        f"Question: {question_text}\n\n"
        f"Rubric (maximum score: {max_score} points):\n{rubric_text}\n\n"
        f"{_reference_block(reference_answers or [])}"
        f"Student's answer:\n"
        f"--- STUDENT ANSWER ---\n{answer}\n--- END STUDENT ANSWER ---\n\n"
        f"Grade this answer out of {max_score} points."
    )


# ---------------------------------------------------------------------------
# Response format
# ---------------------------------------------------------------------------

# Structured Outputs: where the provider supports it, this makes the *decoder*
# refuse to emit anything but a conforming object, so malformed JSON is
# impossible rather than merely detected. Strict mode requires every property in
# "required" and additionalProperties=false.
GRADE_JSON_SCHEMA: dict[str, Any] = {
    "name": "grade",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "score": {"type": "integer"},
            "explanation": {"type": "string"},
        },
        "required": ["score", "explanation"],
        "additionalProperties": False,
    },
}


def _response_format(spec: ModelSpec) -> dict[str, Any]:
    """Constrain generation where we can; validate after the fact where we can't.

    `json_object` is validated server-side *after* sampling, so a model that
    emits an unquoted string value gets the whole request rejected with a 400 —
    a usable grade thrown away because of its punctuation. That is what
    _create_completion's retry and _salvage_grade exist to recover from.
    """
    if spec.supports_json_schema:
        return {"type": "json_schema", "json_schema": GRADE_JSON_SCHEMA}
    return {"type": "json_object"}


# ---------------------------------------------------------------------------
# Error classification
# ---------------------------------------------------------------------------

_RETRYABLE_STATUS = {408, 409, 429, 500, 502, 503, 504}

# Groq's code for "the model produced JSON I could not parse". Our request was
# perfectly well formed — the provider is rejecting its OWN output — so unlike
# every other 400 this one is worth another attempt.
_JSON_VALIDATE_FAILED = "json_validate_failed"

# Provider errors routinely carry a help link, and those links contain words
# like "billing" that would otherwise trip the out-of-credit phrase test.
# Strip URLs before matching on prose. See _is_out_of_credit.
_URL_RE = re.compile(r"https?://\S+")


def _error_code(exc: Exception) -> str:
    """Best-effort provider error code (e.g. "insufficient_quota"), lowercased."""
    code = getattr(exc, "code", None)
    if isinstance(code, str) and code:
        return code.lower()

    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            inner = error.get("code")
            if isinstance(inner, str) and inner:
                return inner.lower()
    return ""


def _failed_generation(exc: Exception) -> str | None:
    """The near-valid text the provider rejected, when it sent one back.

    The OpenAI SDK unwraps the ``{"error": {...}}`` envelope onto ``exc.body``,
    but not every provider nests it the same way, so check both shapes.
    """
    body = getattr(exc, "body", None)
    if not isinstance(body, dict):
        return None
    for candidate in (body, body.get("error")):
        if isinstance(candidate, dict):
            text = candidate.get("failed_generation")
            if isinstance(text, str) and text.strip():
                return text
    return None


def _is_json_validate_failed(exc: Exception) -> bool:
    """True for "the model produced unparseable JSON" — a sampling failure.

    Deliberately narrow: a genuinely malformed request (unknown model, bad
    parameter, unsupported response_format) is also a 400 but must NOT be
    retried, because every attempt would fail identically.
    """
    if not isinstance(exc, openai.BadRequestError):
        return False
    return _error_code(exc) == _JSON_VALIDATE_FAILED or _failed_generation(exc) is not None


def _is_out_of_credit(exc: Exception) -> bool:
    """True for billing exhaustion, which is terminal — never worth retrying.

    Deliberately narrow. An earlier version matched the bare substring
    "billing" anywhere in the message, which misfires badly: BOTH providers
    put a billing URL in messages that are not about exhausted credit.
    OpenAI's genuine out-of-credit text links to .../settings/organization/billing/,
    and Groq's ORDINARY free-tier 429 links to its upgrade page. So a plain
    rate limit — the most common transient failure, and the one most likely to
    hit during a live demo — was being classified as terminal, reported as
    "No credits remaining", and never retried.

    Match on codes and on phrases that mean exhaustion, never on a URL.
    """
    if _error_code(exc) in {
        "insufficient_quota",
        "billing_hard_limit_reached",
        "quota_exceeded",
        "credit_balance_exhausted",
    }:
        return True
    # Strip URLs before matching so a help link can never trip a phrase test.
    message = _URL_RE.sub(" ", str(getattr(exc, "message", "") or "")).lower()
    return any(
        phrase in message
        for phrase in (
            "insufficient_quota",
            "no credits remaining",
            "credit balance",
            "exceeded your current quota",
            "billing hard limit",
        )
    )


def _is_transient(exc: Exception) -> bool:
    """Should this failure be retried?"""
    if isinstance(exc, (openai.APITimeoutError, openai.APIConnectionError, asyncio.TimeoutError)):
        return True
    if isinstance(exc, openai.AuthenticationError | openai.PermissionDeniedError):
        return False
    if isinstance(exc, openai.APIStatusError):
        if _is_out_of_credit(exc):
            return False
        # A 400 is normally terminal, but this one is the provider rejecting its
        # own output, not our request. The retry below asks for the same grade in
        # a way the provider will not reject, so it is worth taking.
        if _is_json_validate_failed(exc):
            return True
        return exc.status_code in _RETRYABLE_STATUS
    return False


def _friendly_error(exc: Exception, model_label: str) -> str:
    """A short, projector-safe message. Never leaks stack traces or key material."""
    timeout_s = int(settings.grading_timeout_seconds)

    if isinstance(exc, (openai.APITimeoutError, asyncio.TimeoutError)):
        return f"Timed out after {timeout_s}s"
    if isinstance(exc, openai.APIConnectionError):
        return "Could not reach the provider"
    if isinstance(exc, openai.AuthenticationError):
        return "API key rejected by provider"
    if isinstance(exc, openai.PermissionDeniedError):
        return "Access to this model is not permitted"
    if isinstance(exc, openai.NotFoundError):
        return f"Model {model_label} is not available from the provider"
    if isinstance(exc, openai.RateLimitError):
        if _is_out_of_credit(exc):
            return "No credits remaining"
        return "Rate limited by provider"
    if isinstance(exc, openai.BadRequestError):
        if _is_json_validate_failed(exc):
            return "Model could not produce valid JSON"
        return "Provider rejected the grading request"
    if isinstance(exc, openai.APIStatusError):
        if _is_out_of_credit(exc):
            return "No credits remaining"
        return f"Provider error (HTTP {exc.status_code})"
    if isinstance(exc, LocalScorerError):
        # These messages are authored to be projector-safe at the raise site
        # (app/services/sbert.py) — short, no paths, no traceback.
        return str(exc) or "Local scorer failed"
    return "Grading failed"


# ---------------------------------------------------------------------------
# Single answer
# ---------------------------------------------------------------------------


def _parse_grade(
    content: str | None,
    max_score: int,
    question_index: int,
) -> GradeResult:
    """Parse the model's JSON reply into a GradeResult, degrading gracefully.

    Malformed JSON, a missing/non-numeric "score" or a missing "explanation"
    must never raise — the run still cost money and the other questions are
    still valid, so we surface an honest placeholder instead of a 500.

    Content that is *nearly* valid (a code fence around it, an unquoted string
    value) goes through _repair_grade_json and comes back marked `recovered`.
    """
    fallback = "The model's response could not be read, so no credit was awarded."
    recovered = False

    try:
        parsed = json.loads(content or "")
    except (TypeError, ValueError):
        parsed = None

    if isinstance(parsed, dict):
        try:
            score = int(float(parsed["score"]))
        except (KeyError, TypeError, ValueError):
            score = 0

        explanation = parsed.get("explanation")
        if not isinstance(explanation, str) or not explanation.strip():
            explanation = fallback
    else:
        repaired = _repair_grade_json(content or "")
        if repaired is None:
            return GradeResult(
                question_index=question_index,
                score=0,
                max_score=max_score,
                explanation=fallback,
            )
        score, explanation = repaired
        recovered = True

    return GradeResult(
        question_index=question_index,
        score=max(0, min(score, max_score)),
        max_score=max_score,
        explanation=explanation,
        recovered=recovered,
    )


# ---------------------------------------------------------------------------
# Salvaging a rejected generation
# ---------------------------------------------------------------------------

# The observed Groq failure is a *nearly* valid object whose "explanation" value
# lost its quotes, e.g.
#     {\n  "score": 0,\n   "explanation": The student's answer does not ...\n}
# Rather than repair arbitrary JSON, pull out only the two fields we asked for.
_SCORE_RE = re.compile(r'"score"\s*:\s*(-?\d+(?:\.\d+)?)')
_EXPLANATION_RE = re.compile(r'"explanation"\s*:\s*')
_NEXT_KEY_RE = re.compile(r',\s*"[A-Za-z_][A-Za-z0-9_]*"\s*:')

# A recovered explanation shorter than this is almost certainly a parsing
# artefact rather than the model's reasoning, so we decline to use it.
_MIN_SALVAGED_EXPLANATION = 20


def _tail_value(remainder: str) -> str:
    """Text up to the next key or the object's closing brace, whichever first."""
    next_key = _NEXT_KEY_RE.search(remainder)
    if next_key is not None:
        return remainder[: next_key.start()]
    brace = remainder.rfind("}")
    return remainder[:brace] if brace != -1 else remainder


def _read_string_value(remainder: str) -> str | None:
    """Read a JSON string value that may be unquoted or left unterminated."""
    remainder = remainder.lstrip()
    if not remainder:
        return None
    if remainder.startswith('"'):
        try:
            value, _ = scanstring(remainder, 1)
            return value
        except ValueError:
            # Unterminated string: keep the text, drop any dangling quote.
            value = _tail_value(remainder[1:]).strip()
            return value.rstrip('"').strip(" ,\n\t") or None
    value = _tail_value(remainder).strip(" ,\n\t")
    return value or None


def _repair_grade_json(text: str) -> tuple[int, str] | None:
    """Recover (score, explanation) from near-valid JSON, or None if unsure.

    Returns None unless BOTH fields come back with confidence. We never guess a
    score: a wrong number on a projector is far worse than an honest error.
    """
    if not text or not text.strip():
        return None

    try:
        parsed = json.loads(text)
    except (TypeError, ValueError):
        parsed = None

    if isinstance(parsed, dict):
        raw_score = parsed.get("score")
        explanation = parsed.get("explanation")
    else:
        score_match = _SCORE_RE.search(text)
        exp_match = _EXPLANATION_RE.search(text)
        if score_match is None or exp_match is None:
            return None
        raw_score = score_match.group(1)
        explanation = _read_string_value(text[exp_match.end() :])

    try:
        score = int(float(raw_score))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None

    if not isinstance(explanation, str):
        return None
    explanation = " ".join(explanation.split())
    if len(explanation) < _MIN_SALVAGED_EXPLANATION:
        return None

    return score, explanation


def _salvage_grade(
    exc: Exception,
    spec: ModelSpec,
    max_score: int,
    question_index: int,
    failed_generation: str | None = None,
) -> GradeResult | None:
    """Last resort: rebuild a grade from the text the provider refused to return.

    Only ever applies when a json_validate_failed rejection handed back the
    model's own output — ``failed_generation`` is that text, captured from the
    *first* such rejection even if a later attempt failed some other way.
    Returns None when nothing can be recovered with confidence, so the caller
    falls back to the ordinary error path.
    """
    text = failed_generation or _failed_generation(exc)
    if not text:
        return None

    repaired = _repair_grade_json(text)
    if repaired is None:
        logger.warning(
            "model=%s question=%d could not salvage a grade; reporting an error. "
            "rejected_text=%s | last_provider_body=%s",
            spec.id,
            question_index,
            _redact(text)[:_MAX_LOGGED_BODY_CHARS],
            _provider_body(exc),
        )
        return None

    score, explanation = repaired
    score = max(0, min(score, max_score))
    logger.warning(
        "model=%s question=%d recovered a grade from failed_generation after "
        "exhausting retries (score=%d/%d)",
        spec.id,
        question_index,
        score,
        max_score,
    )
    return GradeResult(
        question_index=question_index,
        score=score,
        max_score=max_score,
        explanation=explanation,
        recovered=True,
    )


# ---------------------------------------------------------------------------
# The API call
# ---------------------------------------------------------------------------


async def _create_completion(
    client: AsyncOpenAI,
    spec: ModelSpec,
    user_prompt: str,
    salvage: dict[str, str] | None = None,
) -> Any:
    """One chat completion with a bounded retry on transient failures.

    ``salvage`` is an out-parameter: when the provider rejects its own malformed
    JSON it hands the offending text back, and the FIRST such text is stashed
    here so _grade_answer can still recover a grade from it even if a later
    attempt fails some other way.

    A json_validate_failed rejection gets its own, larger budget and a different
    retry, justified by measurement against api.groq.com on 2026-08-08 using the
    reproducer in the docstring of test_json_validate_failed_*:

      * llama-3.3-70b-versatile fails this input DETERMINISTICALLY under
        response_format=json_object — 0/42 valid across temperature 0.0/0.3/0.7/
        1.0, fixed seeds, and an added "quote the string" instruction. So a
        plain resample is not the fix its name suggests.
      * The same request with response_format omitted returns HTTP 200 8/8, with
        `usage` intact, and its content is repairable 8/8. Dropping the format
        removes the provider's post-hoc validator — the one thing that turns a
        usable answer into a dead column — and keeps the token counts that the
        cost comparison is built on.

    So the retry drops response_format (and pins temperature to 0 for
    determinism) rather than merely resampling. The *prompt* is untouched: the
    fairness guarantee holds, and the first attempt is identical for every model.
    """
    attempts = max(1, int(settings.grading_max_attempts))
    json_attempts = max(attempts, int(settings.grading_json_max_attempts))

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    # Set once a json_validate_failed has been seen: stop asking the provider to
    # validate, and parse the reply ourselves in _parse_grade.
    drop_response_format = False

    for attempt in range(json_attempts):
        kwargs: dict[str, Any] = {"model": spec.api_model_name, "messages": messages}
        if not drop_response_format:
            kwargs["response_format"] = _response_format(spec)
        if spec.supports_temperature:
            kwargs["temperature"] = 0.0 if drop_response_format else 0.3

        try:
            return await asyncio.wait_for(
                client.chat.completions.create(**kwargs),
                timeout=settings.grading_timeout_seconds,
            )
        except Exception as exc:  # noqa: BLE001 - classified below
            json_failure = _is_json_validate_failed(exc)
            if json_failure and salvage is not None and "failed_generation" not in salvage:
                text = _failed_generation(exc)
                if text:
                    salvage["failed_generation"] = text

            budget = json_attempts if json_failure else attempts
            if attempt >= budget - 1 or not _is_transient(exc):
                # The caller logs the failure with a traceback; re-raising here
                # keeps the salvage path in _grade_answer able to see the body.
                raise
            logger.info(
                "model=%s attempt %d/%d failed (%s: %s); retrying%s",
                spec.id,
                attempt + 1,
                budget,
                type(exc).__name__,
                _redact(str(exc))[:200],
                " without response_format" if json_failure else "",
            )
            drop_response_format = drop_response_format or json_failure
            # Short backoff: 0.5s, 1.0s, ... Keeps the live demo responsive.
            await asyncio.sleep(0.5 * (2**attempt))

    raise RuntimeError("unreachable: retry loop exited without returning or raising")


async def _grade_answer(
    client: AsyncOpenAI,
    spec: ModelSpec,
    question_text: str,
    rubric: list[str],
    max_score: int,
    answer: str,
    question_index: int,
    reference_answers: list[str] | None = None,
) -> tuple[GradeResult, int | None, int | None]:
    """Grade one answer. Returns (grade, prompt_tokens, completion_tokens).

    Token counts are None when the provider omitted `usage`.
    Raises only on API-level failure; content problems degrade in _parse_grade.
    """
    user_prompt = _build_user_prompt(
        question_text, rubric, max_score, answer, reference_answers
    )
    salvage: dict[str, str] = {}
    try:
        response = await _create_completion(client, spec, user_prompt, salvage)
    except Exception as exc:  # noqa: BLE001 - re-raised unless salvageable
        salvaged = _salvage_grade(
            exc, spec, max_score, question_index, salvage.get("failed_generation")
        )
        if salvaged is None:
            raise
        # A rejected request is not billed and reports no usage, so this model's
        # token counts go null rather than being estimated.
        return salvaged, None, None

    try:
        content = response.choices[0].message.content
    except (AttributeError, IndexError, TypeError):
        content = None

    grade = _parse_grade(content, max_score, question_index)

    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    usage = getattr(response, "usage", None)
    if usage is not None:
        raw_in = getattr(usage, "prompt_tokens", None)
        raw_out = getattr(usage, "completion_tokens", None)
        if isinstance(raw_in, int) and isinstance(raw_out, int):
            prompt_tokens = raw_in
            completion_tokens = raw_out

    return grade, prompt_tokens, completion_tokens


# ---------------------------------------------------------------------------
# The local (no-LLM) path
# ---------------------------------------------------------------------------


async def _grade_answer_locally(
    spec: ModelSpec,
    question_text: str,
    rubric: list[str],
    max_score: int,
    answer: str,
    question_index: int,
    reference_answers: list[str] | None = None,
) -> tuple[GradeResult, int | None, int | None]:
    """Grade one answer with the in-process similarity scorer.

    Deliberately the same signature and the same return triple as _grade_answer,
    so everything downstream — the gather, the per-question failure isolation,
    the ordering, the totals — is shared code rather than a second pipeline.

    Token counts are None because there are no tokens to count: this model does
    not bill and reports no usage, and inventing a number for a metrics table
    shown to a funding council would be a fabrication. Cost is handled by the
    caller, where it is a measured 0.0 rather than an unknown.

    ``question_text`` is unused: the scorer compares the ANSWER against the
    teacher's reference answers (or, with none, against the rubric), never
    against the question. Kept in the signature so both graders are called
    identically.
    """
    del question_text

    # encode() is CPU-bound and would otherwise block the event loop — and with
    # it every other model's in-flight HTTP request. A worker thread keeps the
    # comparison honest: the LLM columns must not be slowed down by this one.
    result = await asyncio.to_thread(
        sbert.score_answer,
        rubric=rubric,
        answer=answer,
        max_score=max_score,
        reference_answers=reference_answers or [],
    )

    return (
        GradeResult(
            question_index=question_index,
            score=result.score,
            max_score=max_score,
            explanation=result.explanation,
            recovered=False,
        ),
        None,
        None,
    )


# ---------------------------------------------------------------------------
# Question extraction
# ---------------------------------------------------------------------------


class QuestionFields(NamedTuple):
    """The parts of a question the grader needs, however it was stored."""

    text: str
    rubric: list[str]
    credit: int
    reference_answers: list[str]


def _question_fields(question: Any) -> QuestionFields:
    """Read the gradeable fields from a dict (JSON column) or a schema object.

    ``reference_answers`` is optional everywhere: exams written before the field
    existed simply have none, and must keep grading exactly as they did.
    """
    if isinstance(question, dict):
        return QuestionFields(
            text=question["text"],
            rubric=question["rubric"],
            credit=question["credit"],
            reference_answers=list(question.get("reference_answers") or []),
        )
    return QuestionFields(
        text=question.text,
        rubric=question.rubric,
        credit=question.credit,
        reference_answers=list(getattr(question, "reference_answers", None) or []),
    )


class PreparedAnswer(NamedTuple):
    """One answer paired with the question it answers."""

    question_index: int
    text: str
    rubric: list[str]
    max_score: int
    answer: str
    reference_answers: list[str]


def _gradeable_questions(
    exam_questions: list,
    answers: list[AnswerInput],
) -> list[PreparedAnswer]:
    """Pair each answer with its question, skipping out-of-range indices."""
    prepared: list[PreparedAnswer] = []
    for answer_input in answers:
        idx = answer_input.question_index
        if idx < 0 or idx >= len(exam_questions):
            continue
        fields = _question_fields(exam_questions[idx])
        prepared.append(
            PreparedAnswer(
                question_index=idx,
                text=fields.text,
                rubric=fields.rubric,
                max_score=fields.credit,
                answer=answer_input.answer,
                reference_answers=fields.reference_answers,
            )
        )
    return prepared


def exam_max_score(exam_questions: list) -> int:
    """Total credit available across every question on the exam."""
    return sum(_question_fields(q).credit for q in exam_questions)


def answered_max_score(exam_questions: list, answers: list[AnswerInput]) -> int:
    """Total credit for the questions actually answered in THIS request.

    The per-question "Try" button submits a single answer, and scoring a perfect
    2-point answer as "2/15" reads as a fail. ``total_score`` has only ever summed
    the graded answers, so the denominator has to be derived the same way.

    A question counts once no matter how many times it appears, and an index that
    does not exist on the exam counts for nothing — the same two rules
    _gradeable_questions applies to the numerator, so the pair cannot disagree.
    Note that an answer skipped by _skip_reason still counts: the student answered
    it (badly), so an honest 0/2 is the right report, never 0/0.
    """
    seen: set[int] = set()
    total = 0
    for answer_input in answers:
        index = answer_input.question_index
        if index < 0 or index >= len(exam_questions) or index in seen:
            continue
        seen.add(index)
        total += _question_fields(exam_questions[index]).credit
    return total


# ---------------------------------------------------------------------------
# The empty-answer guard
# ---------------------------------------------------------------------------

# Observed on production: submitting "" for question 0 came back 1/2 with
# "The student provides a clear definition of AI, but only one real-world
# application is mentioned." Nothing had been written. A degenerate prompt makes
# a model fill the gap from the question and the rubric alone, and gibberish of
# the same length scored 0 correctly — so the failure is confabulation, not
# leniency. Prompt wording cannot fix a model inventing content; the only
# reliable fix is to not make the call. SYSTEM_PROMPT is hardened as a second
# layer, for answers that are long enough to send but still say nothing.

_NO_ANSWER = "No answer was provided, so no credit was awarded."


def _skip_reason(answer: str) -> str | None:
    """The explanation for refusing to grade this answer, or None to grade it.

    Blank and whitespace-only answers are ALWAYS refused. The length rule on top
    of that is ``settings.min_answer_chars`` (characters after stripping), and
    setting it to 0 disables only that rule — never the blank check.
    """
    stripped = (answer or "").strip()
    if not stripped:
        return _NO_ANSWER

    minimum = int(getattr(settings, "min_answer_chars", 0) or 0)
    if minimum > 0 and len(stripped) < minimum:
        return (
            f"The answer is too short to grade — it must be at least {minimum} "
            "characters — so no credit was awarded."
        )
    return None


def _skipped_grade(item: PreparedAnswer, reason: str) -> GradeResult:
    """A local 0 for an ungradeable answer. Its credit still counts in max_score."""
    return GradeResult(
        question_index=item.question_index,
        score=0,
        max_score=item.max_score,
        explanation=reason,
        recovered=False,
    )


# ---------------------------------------------------------------------------
# One model
# ---------------------------------------------------------------------------


def _error_result(spec: ModelSpec, message: str) -> ModelResult:
    """The contract's failure shape: no score, no grades, no metrics."""
    return ModelResult(
        model_id=spec.id,
        label=spec.label,
        tier=spec.tier,
        status="error",
        error=message,
        total_score=None,
        grades=[],
        metrics=None,
    )


async def grade_with_model(
    spec: ModelSpec,
    exam_questions: list,
    answers: list[AnswerInput],
) -> ModelResult:
    """Grade every answer with a single model. Never raises."""
    is_local = spec.kind == KIND_LOCAL

    api_key = ""
    if is_local:
        # The local scorer's equivalent of a missing key: library or weights
        # absent. Checked here so it becomes THIS model's error column and every
        # other model still renders.
        if not sbert.enabled():
            return _error_result(spec, "Local scorer is disabled")
        if not sbert.is_available():
            return _error_result(spec, "Local model files are not installed")
    else:
        api_key = get_api_key(spec)
        if not api_key:
            return _error_result(spec, "API key not configured")

    prepared = _gradeable_questions(exam_questions, answers)
    if not prepared:
        return _error_result(spec, "No answers to grade")

    # Ungradeable answers are settled here, before anything touches the network,
    # so they cost nothing and cannot be confabulated into a score.
    skipped: list[GradeResult] = []
    to_grade: list[PreparedAnswer] = []
    for item in prepared:
        reason = _skip_reason(item.answer)
        if reason is None:
            to_grade.append(item)
        else:
            skipped.append(_skipped_grade(item, reason))

    if not to_grade:
        # Every answer was refused locally. Zero here is measured, not estimated:
        # no request was issued, so no tokens were spent, nothing was billed and
        # no provider time elapsed. (Contrast the missing-`usage` case below,
        # where the true numbers exist but are unknown to us, and must stay null.)
        return ModelResult(
            model_id=spec.id,
            label=spec.label,
            tier=spec.tier,
            status="ok",
            error=None,
            total_score=0,
            grades=sorted(skipped, key=lambda g: g.question_index),
            metrics=ModelMetrics(
                latency_ms=0,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                cost_usd=0.0,
            ),
        )

    started = time.perf_counter()

    # The only fork in the pipeline: how one answer becomes one grade. Both
    # branches produce the same list of (GradeResult, tokens_in, tokens_out)
    # coroutines, so everything below is shared.
    tasks: list[Any]
    if is_local:
        tasks = [
            _grade_answer_locally(
                spec=spec,
                question_text=item.text,
                rubric=item.rubric,
                max_score=item.max_score,
                answer=item.answer,
                question_index=item.question_index,
                reference_answers=item.reference_answers,
            )
            for item in to_grade
        ]
    else:
        try:
            client = await _get_client(spec.base_url, api_key)
        except Exception:  # noqa: BLE001 - client construction should never 500
            logger.exception("model=%s could not initialise the provider client", spec.id)
            return _error_result(spec, "Could not initialise the provider client")

        tasks = [
            _grade_answer(
                client=client,
                spec=spec,
                question_text=item.text,
                rubric=item.rubric,
                max_score=item.max_score,
                answer=item.answer,
                question_index=item.question_index,
                reference_answers=item.reference_answers,
            )
            for item in to_grade
        ]

    # return_exceptions=True: one question's failure must not cancel its siblings.
    outcomes = await asyncio.gather(*tasks, return_exceptions=True)
    # Only the calls that actually happened are timed: a model that skipped an
    # empty answer must not look faster for having done less work.
    latency_ms = int(round((time.perf_counter() - started) * 1000))

    # An API-level failure on any question makes this model's total_score
    # misleading, so the whole model is reported as an error.
    failure: Exception | None = None
    for question_index, outcome in zip((p.question_index for p in to_grade), outcomes):
        if not isinstance(outcome, BaseException):
            continue
        if isinstance(outcome, Exception):
            # The user only ever sees _friendly_error(); the traceback, the
            # exception class and the provider's own response body live here so
            # a failure on stage can be diagnosed without a REPL.
            logger.error(
                "model=%s (%s) failed grading question %d: %s: %s | provider_body=%s",
                spec.id,
                spec.api_model_name,
                question_index,
                type(outcome).__name__,
                _redact(str(outcome))[:500],
                _provider_body(outcome),
                exc_info=outcome,
            )
            failure = failure or outcome
        else:
            logger.error(
                "model=%s grading question %d raised %s",
                spec.id,
                question_index,
                type(outcome).__name__,
            )
            return _error_result(spec, "Grading failed")

    if failure is not None:
        return _error_result(spec, _friendly_error(failure, spec.label))

    grades: list[GradeResult] = list(skipped)
    prompt_tokens = 0
    completion_tokens = 0
    usage_complete = True

    for grade, tokens_in, tokens_out in outcomes:  # type: ignore[misc]
        grades.append(grade)
        if tokens_in is None or tokens_out is None:
            usage_complete = False
        else:
            prompt_tokens += tokens_in
            completion_tokens += tokens_out

    grades.sort(key=lambda g: g.question_index)

    if is_local:
        # Nothing was billed because nothing left the machine, so 0.0 here is a
        # MEASURED fact, not an estimate — the distinction the null-cost branch
        # below exists to preserve. Token counts stay null: this model does not
        # consume tokens at all, and a fabricated count in a metrics table shown
        # to a funding council would be worse than a blank.
        metrics = ModelMetrics(
            latency_ms=latency_ms,
            prompt_tokens=None,
            completion_tokens=None,
            total_tokens=None,
            cost_usd=0.0,
        )
    elif usage_complete:
        # cost = (in/1e6)*price_in + (out/1e6)*price_out, summed over all calls.
        cost = (
            (prompt_tokens / 1_000_000) * spec.price_in_per_mtok
            + (completion_tokens / 1_000_000) * spec.price_out_per_mtok
        )
        metrics = ModelMetrics(
            latency_ms=latency_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            cost_usd=round(cost, 8),
        )
    else:
        # Provider omitted `usage`. Never estimate — a fabricated cost shown to a
        # government council is worse than a blank one.
        metrics = ModelMetrics(
            latency_ms=latency_ms,
            prompt_tokens=None,
            completion_tokens=None,
            total_tokens=None,
            cost_usd=None,
        )

    return ModelResult(
        model_id=spec.id,
        label=spec.label,
        tier=spec.tier,
        status="ok",
        error=None,
        total_score=sum(g.score for g in grades),
        grades=grades,
        metrics=metrics,
    )


# ---------------------------------------------------------------------------
# All models
# ---------------------------------------------------------------------------


def build_comparison(results: list[ModelResult]) -> Comparison | None:
    """Head-to-head summary, or None when fewer than 2 models succeeded."""
    ok = [r for r in results if r.status == "ok" and r.metrics is not None]
    if len(ok) < 2:
        return None

    scores = [r.total_score for r in ok if r.total_score is not None]
    max_total_score_delta = max(scores) - min(scores) if scores else None

    # COST RATIO AND THE FREE MODEL
    #
    # The local scorer reports a measured cost of exactly $0.00, so "most
    # expensive / cheapest" is a division by zero. Silently letting that produce
    # inf (or, before this, a bare None that the UI would misattribute to
    # "a provider did not report token usage") is not acceptable on a projector.
    #
    # So the two questions are separated:
    #   * cheapest_model_id  — which run cost least, free runs included. This is
    #     the honest answer and it is the local model when it is in the mix.
    #   * cost_ratio         — a finite multiple, which only exists between runs
    #     that actually charged. It is therefore measured against the cheapest
    #     PAYING run, and cost_ratio_baseline_model_id names that run so the UI
    #     can say which two models the multiple refers to instead of implying it
    #     is the cheapest overall.
    # A ratio needs two paying runs; with fewer, it would be 1.0 or undefined,
    # and is reported as null.
    cheapest_model_id: str | None = None
    cost_ratio: float | None = None
    cost_ratio_baseline_model_id: str | None = None
    priced = [r for r in ok if r.metrics is not None and r.metrics.cost_usd is not None]
    if len(priced) >= 2:
        cheapest_model_id = min(
            priced, key=lambda r: r.metrics.cost_usd  # type: ignore[union-attr]
        ).model_id

    paying = [r for r in priced if (r.metrics.cost_usd or 0.0) > 0]  # type: ignore[union-attr]
    if len(paying) >= 2:
        cheapest_paid = min(paying, key=lambda r: r.metrics.cost_usd)  # type: ignore[union-attr]
        dearest = max(paying, key=lambda r: r.metrics.cost_usd)  # type: ignore[union-attr]
        low = cheapest_paid.metrics.cost_usd  # type: ignore[union-attr]
        high = dearest.metrics.cost_usd  # type: ignore[union-attr]
        if low and low > 0:
            cost_ratio = round(high / low, 2)
            cost_ratio_baseline_model_id = cheapest_paid.model_id

    fastest = min(ok, key=lambda r: r.metrics.latency_ms)  # type: ignore[union-attr]
    slowest = max(ok, key=lambda r: r.metrics.latency_ms)  # type: ignore[union-attr]
    speed_ratio: float | None = None
    if fastest.metrics.latency_ms > 0:  # type: ignore[union-attr]
        speed_ratio = round(
            slowest.metrics.latency_ms / fastest.metrics.latency_ms,  # type: ignore[union-attr]
            2,
        )

    return Comparison(
        cheapest_model_id=cheapest_model_id,
        fastest_model_id=fastest.model_id,
        cost_ratio=cost_ratio,
        cost_ratio_baseline_model_id=cost_ratio_baseline_model_id,
        speed_ratio=speed_ratio,
        max_total_score_delta=max_total_score_delta,
    )


async def grade_submission(
    exam_questions: list,
    answers: list[AnswerInput],
    specs: list[ModelSpec],
) -> tuple[list[ModelResult], Comparison | None]:
    """Grade the submission with every requested model, all in parallel.

    Never raises: a model that fails comes back as status="error" so one dead
    provider can never blank the screen during the live demo.
    """
    outcomes = await asyncio.gather(
        *(grade_with_model(spec, exam_questions, answers) for spec in specs),
        return_exceptions=True,
    )

    results: list[ModelResult] = []
    for spec, outcome in zip(specs, outcomes):
        if isinstance(outcome, ModelResult):
            results.append(outcome)
        elif isinstance(outcome, Exception):
            # grade_with_model is supposed to never raise; if it did, that is a
            # bug in this module and the traceback matters more than usual.
            logger.error(
                "model=%s grade_with_model raised unexpectedly: %s: %s",
                spec.id,
                type(outcome).__name__,
                _redact(str(outcome))[:500],
                exc_info=outcome,
            )
            results.append(_error_result(spec, _friendly_error(outcome, spec.label)))
        else:
            logger.error("model=%s grading aborted with %s", spec.id, type(outcome).__name__)
            results.append(_error_result(spec, "Grading failed"))

    return results, build_comparison(results)
