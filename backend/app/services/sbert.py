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
CONTENT RECALL against the teacher's reference answers. Subject matter on both
sides of the comparison.

    reference answer -> sentences
    student answer   -> sentences

    for each REFERENCE sentence: its best-matching STUDENT sentence (cosine)
    recall(reference) = mean of those best matches
    content_recall    = max over the reference answers          # see BEST-OF
    fraction          = (content_recall - floor) / (ceiling - floor), clamped
    score             = round(fraction * max_score)             # half-up

WHY NOT RUBRIC POINTS — the flaw this replaced
----------------------------------------------
Until 2026-08-09 the primary signal was rubric coverage: each rubric point was
matched against its best student sentence and counted as covered above a
threshold. Rubric points are instructions to a marker ("Two distinct, relevant
applications provided"), not statements of subject matter, so that comparison
is a category error, and the measurements said so. On the seeded exam:

    Q1 R2 "Two distinct, relevant applications provided"
        strong answer (names two: agriculture, telecoms)   0.19
        weak answer   (names none)                         0.30

The better an answer gets, the more specific it becomes, and the further it
drifts from abstract rubric phrasing. Across the three seeded questions rubric
coverage came out 0.33/0.33/0.33 on Q1 and 0.80/0.80/0.80 on Q2 for
strong/mediocre/weak — no discrimination at all — and on Q2 the underlying
similarities were actively inverted (the mediocre answer beat the strong one on
four of five points). Only Q3, whose rubric happens to name content ("privacy
and data security", "bias and fairness"), ranked correctly. Whole-answer to
whole-reference similarity was measured too and also inverted: 0.77 mediocre vs
0.71 strong on Q1, 0.82 vs 0.70 on Q2.

So neither signal is in the score any more. Rubric coverage survives only as
the FALLBACK for a question that has no reference answers at all, where it is
the only thing left to measure, and the explanation says as much. Whole-answer
similarity is not computed.

BEST-OF, NOT ALL-OF
-------------------
Reference answers are alternative valid answers, not a set the student must
satisfy at once. Verified on the seeded data rather than assumed: each
question's two references recall each other at only 0.50-0.55, because they
deliberately use different examples (medical imaging and maps vs spam filtering
and speech recognition). Requiring both would demand content no single correct
answer contains. So the best-scoring reference wins.

LENGTH ASYMMETRY
----------------
Recall runs over the REFERENCE's sentences, and each one takes the best match
anywhere in the answer, so one dense student sentence can satisfy several
reference sentences. Brevity is therefore not punished for its own sake:
measured on the seeded exam, a single dense correct sentence of under 35 words
scores 2/2 on Q1 and 5/5 on Q2 against references three to seven times longer,
while on the 8-mark Q3 one sentence gets 2/8 because it genuinely cannot cover
the ground.

The other direction is a known limitation, stated rather than hidden: padding
cannot lower a maximum, so irrelevant extra sentences do not cost marks. A
precision term (each STUDENT sentence against its best reference sentence) was
implemented and measured as a padding penalty, and it was dropped because it
ranks backwards: vague filler matches a long reference somewhere, so on Q3 the
weak answer scored 0.63 precision against the strong answer's 0.58, and an F1
of the two put Q1's weak answer above its mediocre one. The measurement decided
it, not taste.

THE SCALE — floor 0.30, ceiling 0.55
------------------------------------
Same-topic text clusters in a narrow band under this model, so the raw recall
of every on-topic answer lands somewhere around 0.38-0.57 and a mark taken
straight from it would barely move. The band is therefore mapped linearly onto
0-100% of the marks, between two anchors chosen on stated principle and NOT
fitted to any student answer:

  floor 0.30 — "same subject, different content" scores nothing. Under
    all-MiniLM-L6-v2, sentence pairs from one subject area that say different
    things sit around 0.25-0.40; 0.30 is the top of where that band starts.
    Corroboration from teacher material only: scoring each question's
    references against the OTHER questions' references — same domain, wrong
    content — gives 0.29, 0.33 and 0.40 on the three seeded questions.

  ceiling 0.55 — full marks at the level where two independently written
    full-credit answers agree with each other. That agreement level is a
    measurable property of the teacher's own material: holding out one
    reference and scoring it against the other gives 0.523, 0.535 and 0.536 on
    the three seeded questions. 0.55 is that figure rounded to a round number,
    and it means full marks require matching the reference about as closely as
    a second correct answer would — no closer.

Both anchors come from teacher-written material or from the model's documented
behaviour. Neither was chosen by looking at what it did to the four demo
answers in TEST-ANSWERS.md. They are settings
(``GRADEAI_SBERT_RECALL_FLOOR`` / ``GRADEAI_SBERT_RECALL_CEILING``) so an
operator can move them, but moving them to flatter a demo is not calibration.

ROUNDING
--------
Half-up, clamped. At 2 marks the boundaries fall at fraction 0.25 and 0.75, so
a 2-mark question does distinguish three outcomes and not two: measured on the
seeded Q1, strong 0.91 -> 2, mediocre 0.68 -> 1, nonsense 0.00 -> 0.

WHAT THIS STILL CANNOT DO
-------------------------
Measured on the seeded exam with the four answers in TEST-ANSWERS.md, and
stated here so nobody has to discover it live:

  * Q2 does not separate. Strong 5/5 and mediocre 5/5, and pasting the question
    text in as the answer scores 4/5. The question's key terms ("supervised",
    "unsupervised", "labels", "examples") appear in every on-topic answer
    whether or not it is correct, and a bag-of-topic embedding cannot tell
    "unsupervised learning has no labels" from "unsupervised learning is when
    the computer is not supervised by a person". This is the method's ceiling,
    not a tuning problem.
  * Contradiction is invisible. A confidently wrong statement about the right
    subject matches the reference sentence about that subject.
  * Padding is free, as above.

What it does do reliably: off-topic collapses (nonsense scored 0/15, and the
Q2 answer pasted into Q3 scored 0/8), and ordering holds on Q1 and Q3.

RUBRIC FALLBACK THRESHOLD
-------------------------
Only used when a question has no reference answers. Default 0.45, chosen a
priori: under this model a short topical phrase against a sentence that
genuinely expresses it lands in 0.45-0.70, same-subject-only around 0.25-0.40,
unrelated below 0.2.

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


BASIS_REFERENCE = "reference-content"
BASIS_RUBRIC = "rubric-fallback"


@dataclass(frozen=True)
class LocalScore:
    """One question scored locally, with every intermediate number kept.

    Nothing here is estimated: each field is either measured or derived from
    measured values by the formula in this module's docstring.

    ``basis`` says which of the two paths produced ``score``:
      * ``reference-content`` — the normal path, content recall against the
        teacher's reference answers.
      * ``rubric-fallback`` — the question has no reference answers, so rubric
        coverage is all there is. Weaker, and the explanation says so.

    The fields belonging to the other path are left at their empty values
    rather than being filled with something plausible.
    """

    score: int
    max_score: int
    basis: str
    fraction: float
    # -- reference-content path ------------------------------------------
    content_recall: float | None
    reference_recalls: list[float]
    sentence_matches: list[float]
    recall_floor: float
    recall_ceiling: float
    # -- rubric fallback path ---------------------------------------------
    covered_points: int
    total_points: int
    coverage: float
    point_similarities: list[float]
    threshold: float
    explanation: str


_NO_EXPLANATION = (
    "No explanation available — this is a sentence-similarity model, not a "
    "language model, so it produces a number rather than reasoning. "
)


def _explain_reference(
    content_recall: float,
    reference_count: int,
    floor: float,
    ceiling: float,
) -> str:
    """State that there is no explanation, and why, then report the measurement.

    This is NOT feedback and must never be written to read like feedback: it is
    the provenance of the number. A similarity model has no reasoning to report,
    and inventing some would misrepresent what the room is being shown.
    """
    closest = (
        "the reference answer"
        if reference_count == 1
        else f"the closest of {reference_count} reference answers"
    )
    return (
        f"{_NO_EXPLANATION}"
        f"Measured: sentence by sentence, the answer covers {closest} at "
        f"{content_recall:.2f} mean similarity, on a scale where {floor:.2f} "
        f"(same subject, different content) earns nothing and {ceiling:.2f} "
        "(the level at which two independently written full-credit answers "
        "agree) earns full marks."
    )


def _explain_rubric(covered: int, total: int, threshold: float) -> str:
    """The degraded path's provenance, including the fact that it is degraded."""
    return (
        f"{_NO_EXPLANATION}"
        "This question has no reference answers, so the weaker fallback "
        f"measurement was used: {covered} of {total} rubric points matched a "
        f"sentence in the answer at or above {threshold:.2f} similarity. Rubric "
        "points describe what a marker should look for rather than the subject "
        "matter itself, which makes them an unreliable thing to compare an "
        "answer against."
    )


def score_answer(
    *,
    rubric: Sequence[str],
    answer: str,
    max_score: int,
    reference_answers: Sequence[str] | None = None,
    embed: Embedder | None = None,
    threshold: float | None = None,
    recall_floor: float | None = None,
    recall_ceiling: float | None = None,
) -> LocalScore:
    """Score one answer locally. See the module docstring for the formula.

    ``embed`` is injectable so the arithmetic is testable without torch. Raises
    LocalScorerError when the question cannot be scored at all (no rubric and no
    reference answers), which the caller reports as this model's error column.
    """
    embed = embed or default_embedder
    if threshold is None:
        threshold = float(settings.sbert_coverage_threshold)
    if recall_floor is None:
        recall_floor = float(settings.sbert_recall_floor)
    if recall_ceiling is None:
        recall_ceiling = float(settings.sbert_recall_ceiling)

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

    if references:
        return _score_against_references(
            answer_sentences=sentences,
            references=references,
            max_score=max_score,
            embed=embed,
            floor=recall_floor,
            ceiling=recall_ceiling,
        )
    return _score_against_rubric(
        answer_sentences=sentences,
        points=points,
        max_score=max_score,
        embed=embed,
        threshold=threshold,
    )


def _score_against_references(
    *,
    answer_sentences: list[str],
    references: list[str],
    max_score: int,
    embed: Embedder,
    floor: float,
    ceiling: float,
) -> LocalScore:
    """Content recall against the reference answers — the normal path."""
    if ceiling <= floor:
        raise LocalScorerError("Local scorer scale is misconfigured")

    reference_sentences = [split_sentences(text) for text in references]
    # split_sentences never returns [] for a non-empty string, and `references`
    # is already filtered to non-empty entries, so every group has a sentence.

    # One batch, one forward pass: the answer's sentences, then each reference's
    # sentences in order. Slicing the result back out keeps the order.
    batch = [*answer_sentences]
    for group in reference_sentences:
        batch.extend(group)
    vectors = [_unit(vector) for vector in embed(batch)]
    if len(vectors) != len(batch):
        raise LocalScorerError("Embedder returned the wrong number of vectors")

    answer_vectors = vectors[: len(answer_sentences)]
    at = len(answer_sentences)

    best_recall = -2.0
    best_matches: list[float] = []
    reference_recalls: list[float] = []
    for group in reference_sentences:
        group_vectors = vectors[at : at + len(group)]
        at += len(group)
        # Each REFERENCE sentence takes its best match anywhere in the answer.
        # One dense answer sentence may be the best match for several of them,
        # which is what keeps a short complete answer from being punished.
        matches = [
            max(_cosine(reference, sentence) for sentence in answer_vectors)
            for reference in group_vectors
        ]
        recall = sum(matches) / len(matches)
        reference_recalls.append(recall)
        if recall > best_recall:
            best_recall = recall
            best_matches = matches

    fraction = max(0.0, min(1.0, (best_recall - floor) / (ceiling - floor)))
    score = max(0, min(max_score, _round_half_up(fraction * max_score)))

    return LocalScore(
        score=score,
        max_score=max_score,
        basis=BASIS_REFERENCE,
        fraction=fraction,
        content_recall=best_recall,
        reference_recalls=reference_recalls,
        sentence_matches=best_matches,
        recall_floor=floor,
        recall_ceiling=ceiling,
        covered_points=0,
        total_points=0,
        coverage=0.0,
        point_similarities=[],
        threshold=0.0,
        explanation=_explain_reference(best_recall, len(references), floor, ceiling),
    )


def _score_against_rubric(
    *,
    answer_sentences: list[str],
    points: list[str],
    max_score: int,
    embed: Embedder,
    threshold: float,
) -> LocalScore:
    """Rubric coverage — only reached when the question has no reference answers.

    Kept because a question with no reference answers has to be scored somehow,
    not because the signal is good. See the module docstring for the
    measurements that took it out of the normal path.
    """
    batch = [*answer_sentences, *points]
    vectors = [_unit(vector) for vector in embed(batch)]
    if len(vectors) != len(batch):
        raise LocalScorerError("Embedder returned the wrong number of vectors")

    answer_vectors = vectors[: len(answer_sentences)]
    point_vectors = vectors[len(answer_sentences) :]

    point_similarities = [
        max(_cosine(point, sentence) for sentence in answer_vectors)
        for point in point_vectors
    ]
    covered = sum(1 for similarity in point_similarities if similarity >= threshold)
    coverage = covered / len(points)
    fraction = max(0.0, min(1.0, coverage))
    score = max(0, min(max_score, _round_half_up(fraction * max_score)))

    return LocalScore(
        score=score,
        max_score=max_score,
        basis=BASIS_RUBRIC,
        fraction=fraction,
        content_recall=None,
        reference_recalls=[],
        sentence_matches=[],
        recall_floor=0.0,
        recall_ceiling=0.0,
        covered_points=covered,
        total_points=len(points),
        coverage=coverage,
        point_similarities=point_similarities,
        threshold=threshold,
        explanation=_explain_rubric(covered, len(points), threshold),
    )
