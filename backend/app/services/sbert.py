"""Local sentence-embedding scorer — grading with no LLM at all.

WHY THIS EXISTS
---------------
The comparison this project is built around is "a frontier LLM grades well but
is not cost-effective; a small model closes the gap far more cheaply". This
module is the end of that line: grading with **no language model at all**, on
the CPU of the box the app already runs on. Zero API cost, no network, no
provider. 22M parameters (all-MiniLM-L6-v2) against a frontier model.

It also demonstrates the honest price of dropping the LLM: a sentence-similarity
model returns a NUMBER, not reasoning, so this scorer **cannot explain a grade**.
That limitation is reported plainly (see ``LocalScore.explanation``) rather than
papered over with templated feedback.

HOW THE SCORE IS PRODUCED
-------------------------
Two signals, doing two different jobs.

1. RUBRIC COVERAGE — the primary score.
   Rubric points are short phrases ("Accurate definition of unsupervised
   learning"). Embedding a whole 200-word answer and comparing it to a five-word
   phrase is a length mismatch that flattens the similarity for everything, good
   answers included. So the answer is split into sentences and each rubric point
   is matched against its BEST sentence. A point counts as covered when that best
   similarity reaches ``settings.sbert_coverage_threshold``.

       coverage = covered_points / total_points

2. REFERENCE SIMILARITY — a secondary signal.
   The whole answer is compared against each of the teacher's reference answers
   (whole to whole, so both sides are long — length-matched) and the best of
   those similarities is taken. It is always reported. It also nudges the score,
   with a small, deliberately boring weight:

       fraction = (1 - w) * coverage + w * reference_similarity      (w = 0.15)
       score    = round(fraction * max_score)      # half-up, clamped to [0, max]

   When the question has no reference answers, ``fraction = coverage`` and
   nothing is blended in. The weight is ``settings.sbert_reference_weight`` and
   setting it to 0 turns the second signal into a reported-only number.

   Two correct answers rarely score 1.0 against each other, so the blend
   slightly damps a full-coverage answer; rounding to whole marks absorbs that
   in practice. Measured on the seeded exam (2026-08-09): a strong answer sat
   at 0.92 against the closest reference, a thin one at 0.56-0.81, and an
   off-topic one at -0.02 to 0.07. The weight is kept small precisely so this
   signal can never override coverage, and so the arithmetic can be reproduced
   on a slide.

THRESHOLD
---------
Default 0.45, and chosen A PRIORI rather than fitted to this repo's demo
answers. Rationale: under all-MiniLM-L6-v2, cosine similarity between a short
topical phrase and a sentence that genuinely expresses it typically lands in the
0.45-0.70 band; sentences merely in the same subject area land around 0.25-0.40;
unrelated text sits below 0.2. 0.45 is the conventional "clearly about this
point, not merely same-domain" line for this model family. It is a setting
(``GRADEAI_SBERT_COVERAGE_THRESHOLD``) so it can be moved without a redeploy —
but note that tuning it against three demo answers is not validation, and this
default has deliberately not been tuned that way.

MODEL FILES
-----------
Resolved by ``resolve_model_source()``, which prefers a vendored directory
(``backend/models/all-MiniLM-L6-v2`` by default) over the Hugging Face hub name.
A pre-downloaded directory cannot fail at the venue; a first-request download
can. See backend/.env.example for the deploy settings.
"""

from __future__ import annotations

import logging
import math
import re
import threading
from dataclasses import dataclass
from importlib.util import find_spec
from pathlib import Path
from typing import Callable, Sequence

from app.config import settings


logger = logging.getLogger(__name__)


# The one model this scorer uses. 22M parameters, 384-dimensional embeddings,
# ~90MB on disk — small enough to sit in RAM on a 4GB VPS beside everything else.
MODEL_NAME = "all-MiniLM-L6-v2"

# Where a vendored copy is looked for when GRADEAI_SBERT_MODEL_DIR is unset.
# app/services/sbert.py -> app/services -> app -> backend
DEFAULT_MODEL_DIR = Path(__file__).resolve().parents[2] / "models" / MODEL_NAME

# A function that turns texts into vectors. Injected in tests so the scoring
# arithmetic can be exercised without loading torch.
Embedder = Callable[[Sequence[str]], list[list[float]]]


class LocalScorerError(RuntimeError):
    """A local-scorer failure whose message is safe to show on a projector.

    Deliberately short and free of paths and tracebacks: grading.py surfaces the
    message verbatim in the model's error column.
    """


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

_LOAD_LOCK = threading.Lock()
# encode() is called from a worker thread per question. PyTorch inference on a
# shared module is fine in principle, but a 1-2 core VPS gains nothing from
# racing several encodes, and serialising removes the question entirely.
_ENCODE_LOCK = threading.Lock()

_MODEL: object | None = None
_LOAD_FAILED = False
_LOAD_MS: int | None = None


def enabled() -> bool:
    """False when the operator has switched the local scorer off entirely."""
    return bool(settings.sbert_enabled)


def resolve_model_source() -> str | None:
    """Where to load the model from, or None if it cannot be reached offline.

    A directory wins over the hub name, because a vendored copy needs no network
    and therefore cannot fail at the venue. ``config.json`` is the marker for "a
    real model lives here" — an empty directory must not count.
    """
    configured = (settings.sbert_model_dir or "").strip()
    directory = Path(configured).expanduser() if configured else DEFAULT_MODEL_DIR
    if (directory / "config.json").is_file():
        return str(directory)
    if settings.sbert_allow_download:
        # sentence-transformers resolves a bare name through the HF cache first
        # and only reaches the network on a cache miss.
        return MODEL_NAME
    return None


def is_available() -> bool:
    """True when this scorer can plausibly run, without loading anything heavy.

    Called by ``GET /api/models`` on every page load, so it must stay cheap.
    Once a load has been attempted the answer is simply whether it worked;
    before that it is a prerequisites check (library importable, weights
    reachable). A wrong "yes" here still degrades safely — the model's column
    reports status="error" and every other column renders.
    """
    if not enabled():
        return False
    if _MODEL is not None:
        return True
    if _LOAD_FAILED:
        return False
    if find_spec("sentence_transformers") is None:
        return False
    return resolve_model_source() is not None


def load() -> object:
    """Return the loaded SentenceTransformer, loading it once.

    Raises LocalScorerError with a short message on any failure; the caller
    turns that into this model's error column and leaves the others alone.
    """
    global _MODEL, _LOAD_FAILED, _LOAD_MS

    if _MODEL is not None:
        return _MODEL
    if not enabled():
        raise LocalScorerError("Local scorer is disabled")

    with _LOAD_LOCK:
        if _MODEL is not None:
            return _MODEL

        source = resolve_model_source()
        if source is None:
            _LOAD_FAILED = True
            raise LocalScorerError("Local model files are not installed")

        started = _now_ms()
        try:
            from sentence_transformers import SentenceTransformer
        except Exception as exc:  # noqa: BLE001 - reported, never raised onward
            _LOAD_FAILED = True
            logger.exception("sentence-transformers could not be imported")
            raise LocalScorerError("Local scorer library is not installed") from exc

        try:
            model = SentenceTransformer(source, device="cpu")
        except Exception as exc:  # noqa: BLE001 - reported, never raised onward
            _LOAD_FAILED = True
            logger.exception("could not load the local model from %s", source)
            raise LocalScorerError("Local model could not be loaded") from exc

        _LOAD_MS = _now_ms() - started
        _MODEL = model
        _LOAD_FAILED = False
        logger.info(
            "local scorer ready: %s from %s in %d ms", MODEL_NAME, source, _LOAD_MS
        )
        return model


def load_ms() -> int | None:
    """How long the one-time load took, in ms, or None if it has not happened."""
    return _LOAD_MS


def preload() -> bool:
    """Load the model at startup so the first grading of the day is not the load.

    Never raises: a missing model file must degrade this one model to
    ``available: false``, not stop the whole backend from starting.
    """
    if not enabled():
        logger.info("local scorer disabled (GRADEAI_SBERT_ENABLED=false)")
        return False
    if not settings.sbert_preload:
        logger.info("local scorer preload skipped (GRADEAI_SBERT_PRELOAD=false)")
        return False
    try:
        load()
    except LocalScorerError as exc:
        logger.warning(
            "local scorer unavailable (%s); it will report available=false and "
            "every other model is unaffected",
            exc,
        )
        return False
    except Exception:  # noqa: BLE001 - startup must survive anything here
        logger.exception("local scorer preload failed unexpectedly")
        return False
    return True


def reset_for_tests() -> None:
    """Drop the cached model and the failure latch. Test-support only."""
    global _MODEL, _LOAD_FAILED, _LOAD_MS
    with _LOAD_LOCK:
        _MODEL = None
        _LOAD_FAILED = False
        _LOAD_MS = None


def _now_ms() -> int:
    import time

    return int(round(time.perf_counter() * 1000))


def default_embedder(texts: Sequence[str]) -> list[list[float]]:
    """Embed every text in one batch with the loaded model."""
    model = load()
    with _ENCODE_LOCK:
        vectors = model.encode(  # type: ignore[attr-defined]
            list(texts),
            batch_size=16,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
    return [[float(value) for value in vector] for vector in vectors]


# ---------------------------------------------------------------------------
# Text preparation
# ---------------------------------------------------------------------------

# Split on sentence terminators and on hard line breaks (students write in
# bullet points as often as in prose). Abbreviations will occasionally split a
# sentence in two; that costs a little context but never invents any, and a
# rubric point matching either half still counts as covered.
_SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+|\n+")

# A fragment shorter than this carries no meaning of its own ("Yes.", "e.g.")
# and only adds noise to the max, so it is dropped — unless dropping everything
# would leave nothing, in which case the whole answer is the single sentence.
_MIN_SENTENCE_CHARS = 12


def split_sentences(text: str) -> list[str]:
    """The answer as sentence-sized chunks, for length-matched comparison."""
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    pieces = [piece.strip() for piece in _SENTENCE_BREAK.split(cleaned)]
    sentences = [piece for piece in pieces if len(piece) >= _MIN_SENTENCE_CHARS]
    return sentences or [cleaned]


# ---------------------------------------------------------------------------
# The arithmetic
# ---------------------------------------------------------------------------


def _unit(vector: Sequence[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0.0:
        return [0.0] * len(vector)
    return [value / norm for value in vector]


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    """Cosine similarity, clamped to [-1, 1] against float drift."""
    if len(a) != len(b):
        raise LocalScorerError("Embedding dimensions did not match")
    return max(-1.0, min(1.0, sum(x * y for x, y in zip(a, b))))


def _round_half_up(value: float) -> int:
    """Marks are whole numbers. round() is banker's rounding; this is not."""
    return int(math.floor(value + 0.5))


@dataclass(frozen=True)
class LocalScore:
    """One question scored locally, with every intermediate number kept.

    Nothing here is estimated: each field is either measured or derived from
    measured values by the formula in this module's docstring.
    """

    score: int
    max_score: int
    covered_points: int
    total_points: int
    coverage: float
    fraction: float
    reference_similarity: float | None
    point_similarities: list[float]
    threshold: float
    reference_weight: float
    explanation: str


def _explain(
    covered: int,
    total: int,
    threshold: float,
    reference_similarity: float | None,
) -> str:
    """State that there is no explanation, and why, then report the measurements.

    This is NOT feedback and must never be written to read like feedback: it is
    the provenance of the number. A similarity model has no reasoning to report,
    and inventing some would misrepresent what the room is being shown.
    """
    reference = (
        f" Closest reference answer: {reference_similarity:.2f} similarity."
        if reference_similarity is not None
        else ""
    )
    return (
        "No explanation available — this is a sentence-similarity model, not a "
        "language model, so it produces a number rather than reasoning. "
        f"Measured: {covered} of {total} rubric points matched a sentence in "
        f"the answer at or above {threshold:.2f} similarity.{reference}"
    )


def score_answer(
    *,
    rubric: Sequence[str],
    answer: str,
    max_score: int,
    reference_answers: Sequence[str] | None = None,
    embed: Embedder | None = None,
    threshold: float | None = None,
    reference_weight: float | None = None,
) -> LocalScore:
    """Score one answer locally. See the module docstring for the formula.

    ``embed`` is injectable so the arithmetic is testable without torch. Raises
    LocalScorerError when the question cannot be scored at all (no rubric and no
    reference answers), which the caller reports as this model's error column.
    """
    embed = embed or default_embedder
    if threshold is None:
        threshold = float(settings.sbert_coverage_threshold)
    if reference_weight is None:
        reference_weight = float(settings.sbert_reference_weight)
    reference_weight = max(0.0, min(1.0, reference_weight))

    points = [point.strip() for point in (rubric or []) if point and point.strip()]
    references = [
        text.strip() for text in (reference_answers or []) if text and text.strip()
    ]
    sentences = split_sentences(answer)

    if not sentences:
        # grading.py's empty-answer guard settles blank answers before we get
        # here; this is belt-and-braces for a direct caller.
        raise LocalScorerError("Nothing to score")
    if not points and not references:
        raise LocalScorerError("Question has no rubric to score against")

    # One batch, one forward pass: sentences, then rubric points, then the whole
    # answer, then the references. Slicing the result back out keeps the order.
    batch = [*sentences, *points, answer.strip(), *references]
    vectors = [_unit(vector) for vector in embed(batch)]
    if len(vectors) != len(batch):
        raise LocalScorerError("Embedder returned the wrong number of vectors")

    at = 0
    sentence_vectors = vectors[at : at + len(sentences)]
    at += len(sentences)
    point_vectors = vectors[at : at + len(points)]
    at += len(points)
    answer_vector = vectors[at]
    at += 1
    reference_vectors = vectors[at:]

    # 1. Rubric coverage: best sentence per point.
    point_similarities = [
        max(_cosine(point_vector, sentence) for sentence in sentence_vectors)
        for point_vector in point_vectors
    ]
    covered = sum(1 for similarity in point_similarities if similarity >= threshold)
    coverage = covered / len(points) if points else 0.0

    # 2. Reference similarity: whole answer vs whole reference, best of them.
    reference_similarity: float | None = None
    if reference_vectors:
        reference_similarity = max(
            _cosine(answer_vector, reference) for reference in reference_vectors
        )

    if not points:
        # No rubric at all: the reference similarity is the only signal there is,
        # so it becomes the score outright rather than being blended into nothing.
        fraction = max(0.0, reference_similarity or 0.0)
    elif reference_similarity is None or reference_weight == 0.0:
        fraction = coverage
    else:
        fraction = (1.0 - reference_weight) * coverage + reference_weight * max(
            0.0, reference_similarity
        )

    fraction = max(0.0, min(1.0, fraction))
    score = max(0, min(max_score, _round_half_up(fraction * max_score)))

    return LocalScore(
        score=score,
        max_score=max_score,
        covered_points=covered,
        total_points=len(points),
        coverage=coverage,
        fraction=fraction,
        reference_similarity=reference_similarity,
        point_similarities=point_similarities,
        threshold=threshold,
        reference_weight=reference_weight,
        explanation=_explain(covered, len(points), threshold, reference_similarity),
    )
