"""The local, no-LLM grading path (app/services/sbert.py).

Everything here runs WITHOUT torch. The scoring arithmetic takes an injected
``embed`` callable, so these tests pin the formula — rubric coverage, the
reference blend, the threshold, the rounding — against hand-chosen vectors whose
cosine similarities are known exactly, rather than against whatever
all-MiniLM-L6-v2 happens to output today. A test that asserted "this answer
scores 6" through the real model would be measuring the model, not the code.

The pipeline tests then cover the four properties that must hold on stage:
the empty-answer guard applies identically, a scorer that throws takes down only
its own column, cost is a measured $0.00 rather than a null, and a missing model
degrades to available=false instead of a 500.

Run with:  .venv/bin/python -m pytest tests -q
"""

from __future__ import annotations

import asyncio
import math

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

import app.models.exam  # noqa: F401 - register tables
import app.models.human_score  # noqa: F401 - register tables
import app.models.submission  # noqa: F401 - register tables
from app.database import get_session
from app.main import app as fastapi_app
from app.models.exam import Exam
from app.models_registry import MODEL_REGISTRY, is_available
from app.schemas.submission import AnswerInput, ModelMetrics, ModelResult
from app.seed import DEMO_EXAM_DATA
from app.services import grading, sbert
from app.services.sbert import LocalScorerError

from tests.test_grading_multi_model import install_stub, perfect_scorer


LOCAL = MODEL_REGISTRY["minilm-l6-v2"]
SMALL = MODEL_REGISTRY["llama-3.1-8b-instant"]

QUESTIONS = DEMO_EXAM_DATA["questions"]  # credits 2, 5, 8


# ---------------------------------------------------------------------------
# A controllable embedder
# ---------------------------------------------------------------------------
#
# Each rubric point is given its own axis of a mutually orthogonal basis, so a
# sentence written for point 2 is similar to point 2 and to nothing else — which
# is the situation the coverage rule is supposed to handle, and is impossible to
# express with a shared axis. A text placed at (axis, s) has cosine similarity
# EXACTLY s with that axis's rubric point and exactly 0 with every other, the
# balance going into one spare dimension no rubric point occupies. Text the
# mapping does not name lives entirely in the spare dimension: similar to
# nothing, which is the off-topic default.

_AXES = 6  # more than any rubric used below


def make_embedder(placements: dict[str, tuple[int, float]]):
    def vector(text: str) -> list[float]:
        values = [0.0] * (_AXES + 1)
        placement = placements.get(text.strip())
        if placement is None:
            values[_AXES] = 1.0
            return values
        axis, similarity = placement
        values[axis] = similarity
        values[_AXES] = math.sqrt(max(0.0, 1.0 - similarity * similarity))
        return values

    return lambda texts: [vector(text) for text in texts]


def on(axis: int, similarity: float = 1.0) -> tuple[int, float]:
    return (axis, similarity)


# A four-point rubric, one axis each.
RUBRIC = ["point one", "point two", "point three", "point four"]
RUBRIC_AXES = {point: on(index) for index, point in enumerate(RUBRIC)}

# Sentences must clear sbert._MIN_SENTENCE_CHARS to survive the split.
SENTENCES = [f"sentence {n} is written out here." for n in range(4)]


# ---------------------------------------------------------------------------
# Rubric coverage — the primary score
# ---------------------------------------------------------------------------


def test_every_rubric_point_covered_scores_full_marks():
    """4 of 4 points covered, no reference answers -> the whole allocation."""
    placements = dict(RUBRIC_AXES)
    placements.update({SENTENCES[n]: on(n) for n in range(4)})

    result = sbert.score_answer(
        rubric=RUBRIC,
        answer=" ".join(SENTENCES),
        max_score=8,
        embed=make_embedder(placements),
        threshold=0.45,
    )

    assert result.covered_points == 4
    assert result.total_points == 4
    assert result.coverage == 1.0
    assert result.reference_similarity is None
    assert result.score == 8


def test_partial_coverage_scales_the_marks():
    """3 of 4 points covered on an 8-mark question -> 0.75 x 8 = 6."""
    placements = dict(RUBRIC_AXES)
    placements.update(
        {
            SENTENCES[0]: on(0, 0.70),
            SENTENCES[1]: on(1, 0.70),
            SENTENCES[2]: on(2, 0.70),
            SENTENCES[3]: on(3, 0.20),  # addresses point four, but too weakly
        }
    )

    result = sbert.score_answer(
        rubric=RUBRIC,
        answer=" ".join(SENTENCES),
        max_score=8,
        embed=make_embedder(placements),
        threshold=0.45,
    )

    assert result.covered_points == 3
    assert result.coverage == pytest.approx(0.75)
    assert result.point_similarities == pytest.approx([0.70, 0.70, 0.70, 0.20])
    assert result.score == 6


def test_an_off_topic_answer_scores_zero():
    """Nothing in the answer resembles any rubric point."""
    result = sbert.score_answer(
        rubric=RUBRIC,
        answer="The monsoon arrived late in Bhopal this year, again.",
        max_score=8,
        embed=make_embedder(dict(RUBRIC_AXES)),
        threshold=0.45,
    )

    assert result.covered_points == 0
    assert result.score == 0
    assert result.point_similarities == pytest.approx([0.0, 0.0, 0.0, 0.0], abs=1e-9)


def test_the_threshold_decides_coverage_and_is_inclusive():
    """A point sitting exactly on the threshold counts; just under does not."""
    placements = {RUBRIC[0]: on(0), SENTENCES[0]: on(0, 0.50)}

    covered = sbert.score_answer(
        rubric=[RUBRIC[0]],
        answer=SENTENCES[0],
        max_score=4,
        embed=make_embedder(placements),
        threshold=0.50,
    )
    missed = sbert.score_answer(
        rubric=[RUBRIC[0]],
        answer=SENTENCES[0],
        max_score=4,
        embed=make_embedder(placements),
        threshold=0.55,
    )

    assert covered.covered_points == 1 and covered.score == 4
    assert missed.covered_points == 0 and missed.score == 0


def test_a_point_is_matched_against_its_best_sentence_not_the_whole_answer():
    """One good sentence buried in filler still covers its point.

    This is the reason the answer is split at all: comparing a five-word rubric
    phrase to a whole paragraph flattens the similarity for good answers too.
    The filler sentences here are unnamed, so they sit at similarity 0, and the
    whole-answer string is unnamed too — only the split makes the point findable.
    """
    placements = {RUBRIC[0]: on(0), "The relevant sentence is written here.": on(0, 0.80)}
    answer = (
        "Some unrelated preamble goes first. "
        "The relevant sentence is written here. "
        "Then several more unrelated words follow after it."
    )

    result = sbert.score_answer(
        rubric=[RUBRIC[0]],
        answer=answer,
        max_score=2,
        embed=make_embedder(placements),
        threshold=0.45,
    )

    assert result.point_similarities[0] == pytest.approx(0.80)
    assert result.score == 2


def test_marks_are_rounded_half_up_not_to_even():
    """Coverage 0.5 of 5 marks is 2.5, which must round up to 3.

    Python's built-in round() is banker's rounding and would return 2 here.
    A mark is not a statistic; a student losing half a mark to a rounding
    convention is not something to have to explain on stage.
    """
    placements = {RUBRIC[0]: on(0), RUBRIC[1]: on(1), SENTENCES[0]: on(0)}

    result = sbert.score_answer(
        rubric=[RUBRIC[0], RUBRIC[1]],
        answer=SENTENCES[0],
        max_score=5,
        embed=make_embedder(placements),
        threshold=0.45,
    )

    assert result.coverage == 0.5
    assert result.score == 3


# ---------------------------------------------------------------------------
# Reference similarity — the secondary signal
# ---------------------------------------------------------------------------


def test_reference_similarity_is_reported_and_blended_with_the_documented_weight():
    """fraction = 0.85 * coverage + 0.15 * reference_similarity."""
    placements = {
        RUBRIC[0]: on(0),
        SENTENCES[0]: on(0),  # the answer is this single sentence, so also whole-answer
        "A teacher's model answer.": on(0, 0.60),
    }

    result = sbert.score_answer(
        rubric=[RUBRIC[0]],
        answer=SENTENCES[0],
        max_score=10,
        reference_answers=["A teacher's model answer."],
        embed=make_embedder(placements),
        threshold=0.45,
        reference_weight=0.15,
    )

    assert result.coverage == 1.0
    assert result.reference_similarity == pytest.approx(0.60)
    # 0.85 * 1.0 + 0.15 * 0.60 = 0.94 -> 9.4 -> 9
    assert result.fraction == pytest.approx(0.94)
    assert result.score == 9


def test_the_best_reference_answer_wins():
    placements = {
        RUBRIC[0]: on(0),
        SENTENCES[0]: on(0),
        "A weak reference answer.": on(0, 0.20),
        "A strong reference answer.": on(0, 0.75),
    }

    result = sbert.score_answer(
        rubric=[RUBRIC[0]],
        answer=SENTENCES[0],
        max_score=10,
        reference_answers=["A weak reference answer.", "A strong reference answer."],
        embed=make_embedder(placements),
        threshold=0.45,
    )

    assert result.reference_similarity == pytest.approx(0.75)


def test_a_zero_reference_weight_reports_the_signal_without_moving_the_mark():
    placements = {
        RUBRIC[0]: on(0),
        SENTENCES[0]: on(0),
        "A teacher's model answer.": on(0, 0.30),
    }

    result = sbert.score_answer(
        rubric=[RUBRIC[0]],
        answer=SENTENCES[0],
        max_score=10,
        reference_answers=["A teacher's model answer."],
        embed=make_embedder(placements),
        threshold=0.45,
        reference_weight=0.0,
    )

    assert result.reference_similarity == pytest.approx(0.30)
    assert result.fraction == pytest.approx(1.0)
    assert result.score == 10


def test_a_question_with_no_reference_answers_is_scored_on_coverage_alone():
    placements = {RUBRIC[0]: on(0), SENTENCES[0]: on(0)}

    result = sbert.score_answer(
        rubric=[RUBRIC[0]],
        answer=SENTENCES[0],
        max_score=10,
        reference_answers=[],
        embed=make_embedder(placements),
    )

    assert result.reference_similarity is None
    assert result.fraction == pytest.approx(1.0)
    assert result.score == 10


# ---------------------------------------------------------------------------
# The explanation — an honest refusal, not templated feedback
# ---------------------------------------------------------------------------


def test_the_explanation_says_there_is_no_explanation_and_why():
    placements = {RUBRIC[0]: on(0), RUBRIC[1]: on(1), SENTENCES[0]: on(0)}
    result = sbert.score_answer(
        rubric=[RUBRIC[0], RUBRIC[1]],
        answer=SENTENCES[0],
        max_score=4,
        embed=make_embedder(placements),
    )

    text = result.explanation
    assert text.startswith("No explanation available")
    assert "similarity model, not a language model" in text
    # It reports what was measured, and nothing that reads like feedback about
    # the student's writing.
    assert "1 of 2 rubric points" in text


# ---------------------------------------------------------------------------
# Sentence splitting
# ---------------------------------------------------------------------------


def test_sentences_split_on_terminators_and_line_breaks():
    text = "First idea here.\nSecond idea here! Third idea here?\n\nFourth idea here."
    assert sbert.split_sentences(text) == [
        "First idea here.",
        "Second idea here!",
        "Third idea here?",
        "Fourth idea here.",
    ]


def test_an_unpunctuated_answer_is_one_sentence():
    assert sbert.split_sentences("no punctuation anywhere in this answer") == [
        "no punctuation anywhere in this answer"
    ]


def test_a_short_answer_survives_the_fragment_filter():
    """Every fragment is below the minimum, so the whole text is used rather
    than the answer vanishing and scoring an undeserved zero."""
    assert sbert.split_sentences("Yes. No.") == ["Yes. No."]


# ---------------------------------------------------------------------------
# Availability
# ---------------------------------------------------------------------------


def test_the_local_model_reports_unavailable_when_it_is_disabled(monkeypatch):
    monkeypatch.setattr(sbert.settings, "sbert_enabled", False, raising=False)
    assert sbert.is_available() is False
    assert is_available(LOCAL) is False


def test_the_local_model_reports_unavailable_when_the_weights_are_missing(monkeypatch):
    """No vendored directory and downloads disabled -> nothing to load."""
    monkeypatch.setattr(sbert.settings, "sbert_enabled", True, raising=False)
    monkeypatch.setattr(sbert.settings, "sbert_model_dir", "/nonexistent/model", raising=False)
    monkeypatch.setattr(sbert.settings, "sbert_allow_download", False, raising=False)
    sbert.reset_for_tests()

    assert sbert.resolve_model_source() is None
    assert sbert.is_available() is False
    assert is_available(LOCAL) is False


def test_preload_survives_missing_weights_so_the_app_still_starts(monkeypatch, caplog):
    """The whole backend must boot with the model absent. Verified here rather
    than trusted: a crash in startup would take every other model down too."""
    monkeypatch.setattr(sbert.settings, "sbert_enabled", True, raising=False)
    monkeypatch.setattr(sbert.settings, "sbert_model_dir", "/nonexistent/model", raising=False)
    monkeypatch.setattr(sbert.settings, "sbert_allow_download", False, raising=False)
    sbert.reset_for_tests()

    assert sbert.preload() is False  # did not raise
    assert sbert.is_available() is False


def test_loading_a_missing_model_raises_a_projector_safe_message(monkeypatch):
    monkeypatch.setattr(sbert.settings, "sbert_enabled", True, raising=False)
    monkeypatch.setattr(sbert.settings, "sbert_model_dir", "/nonexistent/model", raising=False)
    monkeypatch.setattr(sbert.settings, "sbert_allow_download", False, raising=False)
    sbert.reset_for_tests()

    with pytest.raises(LocalScorerError) as caught:
        sbert.load()

    message = str(caught.value)
    assert message == "Local model files are not installed"
    assert "/nonexistent" not in message  # no filesystem paths on the projector


# ---------------------------------------------------------------------------
# The grading pipeline
# ---------------------------------------------------------------------------


@pytest.fixture()
def local_enabled(monkeypatch):
    """Turn the local scorer on with a stub embedder — still no torch."""
    monkeypatch.setattr(sbert.settings, "sbert_enabled", True, raising=False)
    monkeypatch.setattr(sbert, "is_available", lambda: True)
    # Everything is orthogonal to everything, so every real rubric point misses.
    monkeypatch.setattr(sbert, "default_embedder", make_embedder({}))


@pytest.fixture()
def local_full_marks(monkeypatch):
    """Every rubric point covered, so the local model scores the full paper."""
    monkeypatch.setattr(sbert.settings, "sbert_enabled", True, raising=False)
    monkeypatch.setattr(sbert, "is_available", lambda: True)
    monkeypatch.setattr(sbert, "default_embedder", lambda texts: [[1.0, 0.0] for _ in texts])


REAL_ANSWERS = [
    AnswerInput(question_index=0, answer="AI is the study of intelligent machines."),
    AnswerInput(question_index=1, answer="Supervised learning uses labelled data."),
    AnswerInput(question_index=2, answer="Ethically, AI in healthcare is complicated."),
]


def test_the_local_model_grades_the_paper_with_zero_cost_and_null_tokens(local_full_marks):
    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, REAL_ANSWERS, [LOCAL]))
    result = results[0]

    assert result.status == "ok"
    assert result.total_score == 15  # 2 + 5 + 8
    assert [g.question_index for g in result.grades] == [0, 1, 2]

    # $0.00 is MEASURED — nothing left the machine — so it must not be null.
    # Null means "unknown", which is what the token counts genuinely are.
    assert result.metrics.cost_usd == 0.0
    assert result.metrics.prompt_tokens is None
    assert result.metrics.completion_tokens is None
    assert result.metrics.total_tokens is None
    assert isinstance(result.metrics.latency_ms, int)


def test_the_empty_answer_guard_applies_to_the_local_path_too(local_full_marks, monkeypatch):
    """Blank and too-short answers are settled before the scorer is touched."""
    calls: list[dict] = []

    def tripwire(**kwargs):
        calls.append(kwargs)
        raise AssertionError("the scorer ran on an answer it should have refused")

    monkeypatch.setattr(sbert, "score_answer", tripwire)

    for answer in ("", "   ", "\n\t ", "too short"):
        results, _ = asyncio.run(
            grading.grade_submission(
                QUESTIONS, [AnswerInput(question_index=0, answer=answer)], [LOCAL]
            )
        )
        result = results[0]
        assert result.status == "ok"
        assert result.total_score == 0
        assert [(g.question_index, g.score, g.max_score) for g in result.grades] == [(0, 0, 2)]
        assert "no credit was awarded" in result.grades[0].explanation

    assert calls == []


def test_a_scorer_that_raises_takes_down_only_its_own_column(local_enabled, monkeypatch):
    """The single most important robustness property: one broken column must
    never blank the demo."""
    monkeypatch.setattr(
        sbert,
        "score_answer",
        lambda **kwargs: (_ for _ in ()).throw(LocalScorerError("Local model could not be loaded")),
    )
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})
    monkeypatch.setattr(grading.settings, "groq_api_key", "test-groq-key", raising=False)

    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, REAL_ANSWERS, [LOCAL, SMALL]))
    local, small = results

    assert local.status == "error"
    assert local.error == "Local model could not be loaded"
    assert local.total_score is None
    assert local.grades == []
    assert local.metrics is None

    # The LLM column is untouched.
    assert small.status == "ok"
    assert small.total_score == 15


def test_an_unexpected_scorer_crash_is_still_isolated(local_enabled, monkeypatch):
    """Not just LocalScorerError — anything at all."""
    def boom(**kwargs):
        raise ZeroDivisionError("something went very wrong inside torch")

    monkeypatch.setattr(sbert, "score_answer", boom)
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})
    monkeypatch.setattr(grading.settings, "groq_api_key", "test-groq-key", raising=False)

    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, REAL_ANSWERS, [LOCAL, SMALL]))
    local, small = results

    assert local.status == "error"
    assert local.error == "Grading failed"  # generic, no traceback leaked
    assert small.status == "ok"


def test_a_missing_local_model_is_an_error_column_not_a_500(monkeypatch):
    monkeypatch.setattr(sbert.settings, "sbert_enabled", True, raising=False)
    monkeypatch.setattr(sbert, "is_available", lambda: False)
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})
    monkeypatch.setattr(grading.settings, "groq_api_key", "test-groq-key", raising=False)

    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, REAL_ANSWERS, [LOCAL, SMALL]))
    local, small = results

    assert local.status == "error"
    assert local.error == "Local model files are not installed"
    assert small.status == "ok"


def test_a_disabled_local_model_is_an_error_column(monkeypatch):
    monkeypatch.setattr(sbert.settings, "sbert_enabled", False, raising=False)

    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, REAL_ANSWERS, [LOCAL]))
    assert results[0].status == "error"
    assert results[0].error == "Local scorer is disabled"


# ---------------------------------------------------------------------------
# Zero cost in build_comparison
# ---------------------------------------------------------------------------


def _ok(model_id: str, cost: float | None, latency_ms: int, score: int) -> ModelResult:
    return ModelResult(
        model_id=model_id,
        label=model_id,
        tier="small",
        status="ok",
        error=None,
        total_score=score,
        grades=[],
        metrics=ModelMetrics(
            latency_ms=latency_ms,
            prompt_tokens=100,
            completion_tokens=10,
            total_tokens=110,
            cost_usd=cost,
        ),
    )


def test_a_free_model_is_the_cheapest_and_never_produces_an_infinite_ratio():
    """A ratio against $0.00 is a division by zero. It must come back null, and
    the ratio that IS finite must name the paying model it was measured from."""
    comparison = grading.build_comparison(
        [
            _ok("free", 0.0, 40, 9),
            _ok("cheap", 0.00002, 900, 12),
            _ok("dear", 0.00276, 2500, 14),
        ]
    )

    assert comparison.cheapest_model_id == "free"
    # 0.00276 / 0.00002 = 138.0, measured between the two models that charged.
    assert comparison.cost_ratio == pytest.approx(138.0)
    assert comparison.cost_ratio_baseline_model_id == "cheap"
    assert math.isfinite(comparison.cost_ratio)


def test_only_one_paying_model_leaves_the_ratio_undefined():
    """Free vs one paid model: "N times cheaper" has no finite value, and 1.0
    (dearest over itself) would be a lie."""
    comparison = grading.build_comparison(
        [_ok("free", 0.0, 40, 9), _ok("paid", 0.00012, 900, 12)]
    )

    assert comparison.cheapest_model_id == "free"
    assert comparison.cost_ratio is None
    assert comparison.cost_ratio_baseline_model_id is None


def test_two_paying_models_are_unaffected_by_the_new_field():
    """The pre-existing behaviour, pinned: with no free model in the mix the
    baseline IS the cheapest model and the ratio is what it always was."""
    comparison = grading.build_comparison(
        [_ok("cheap", 0.00002, 900, 12), _ok("dear", 0.00276, 2500, 14)]
    )

    assert comparison.cheapest_model_id == "cheap"
    assert comparison.cost_ratio_baseline_model_id == "cheap"
    assert comparison.cost_ratio == pytest.approx(138.0)


def test_every_model_free_reports_no_ratio_but_still_names_the_cheapest():
    comparison = grading.build_comparison([_ok("a", 0.0, 40, 9), _ok("b", 0.0, 55, 10)])

    assert comparison.cheapest_model_id in {"a", "b"}
    assert comparison.cost_ratio is None
    assert comparison.cost_ratio_baseline_model_id is None
    assert comparison.speed_ratio == pytest.approx(1.38, abs=0.01)


# ---------------------------------------------------------------------------
# End to end through the API
# ---------------------------------------------------------------------------


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
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


def test_three_models_side_by_side_stay_http_200_when_the_local_one_fails(
    client, local_enabled, monkeypatch
):
    monkeypatch.setattr(
        sbert,
        "score_answer",
        lambda **kwargs: (_ for _ in ()).throw(LocalScorerError("Local model could not be loaded")),
    )
    install_stub(
        monkeypatch,
        {
            MODEL_REGISTRY["gpt-4o-mini"].api_model_name: perfect_scorer(),
            SMALL.api_model_name: perfect_scorer(),
        },
    )
    monkeypatch.setattr(grading.settings, "openai_api_key", "k", raising=False)
    monkeypatch.setattr(grading.settings, "groq_api_key", "k", raising=False)
    from app import models_registry

    monkeypatch.setattr(models_registry.settings, "openai_api_key", "k", raising=False)
    monkeypatch.setattr(models_registry.settings, "groq_api_key", "k", raising=False)

    response = client.post(
        "/api/submissions/preview",
        json={
            "exam_id": 1,
            "answers": [a.model_dump() for a in REAL_ANSWERS],
            "model_ids": ["gpt-4o-mini", SMALL.id, LOCAL.id],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    by_id = {r["model_id"]: r for r in payload["results"]}
    assert len(by_id) == 3
    assert by_id[LOCAL.id]["status"] == "error"
    assert by_id["gpt-4o-mini"]["status"] == "ok"
    assert by_id[SMALL.id]["status"] == "ok"
    # Two survivors still produce a comparison, so the cost panel renders.
    assert payload["comparison"] is not None
