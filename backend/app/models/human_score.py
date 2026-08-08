"""Teacher-assigned scores, stored alongside — never inside — a submission.

WHY A SEPARATE TABLE

The fine-tuning dataset is built from the gap between what the models scored
and what a real teacher scored. The teacher's number arrives days or weeks
after the submission, from a different person, possibly more than once. Three
properties follow, and all three argue against mutating ``Submission``:

* **The submission is an immutable record of what happened.** Its ``answers``,
  ``results`` and ``comparison`` JSON columns are the evidence half of the
  dataset. Editing that blob in place to bolt on a human score risks corrupting
  the thing being measured, and there is no migration tooling here to repair it.
* **A JSON column cannot be queried or partially updated.** Recording one
  teacher score would mean read-modify-write of the whole document, which races
  against any concurrent write and cannot be indexed for "which questions are
  still unscored?".
* **The app runs ``SQLModel.metadata.create_all`` with no migrations.**
  Production has a live database with real submissions in it. ``create_all``
  will happily CREATE a table that does not exist yet; it will never ALTER one
  that does. So a *new* table is the only schema change that can actually take
  effect on the server without hand-written SQL.

The natural key is (submission_id, question_index) — one teacher score per
question per submission — enforced by a unique constraint so a repeated import
updates the existing row instead of silently creating a duplicate.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class HumanScore(SQLModel, table=True):
    """A real teacher's score for one question of one submission."""

    __tablename__ = "human_score"
    __table_args__ = (
        UniqueConstraint(
            "submission_id", "question_index", name="uq_human_score_submission_question"
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    # Indexed, not a hard FK: the export joins on it constantly, and a foreign
    # key would need the submission row to exist at import time even when a CSV
    # is loaded out of order.
    submission_id: int = Field(index=True)
    question_index: int

    # Nullable on purpose: a row may exist purely to carry a grader_note, or be
    # created empty as a to-do marker. Float rather than int because human
    # markers award half marks; the model scores stay integers.
    human_score: float | None = Field(default=None)
    grader_note: str | None = Field(default=None)
    # Free text — who marked it, if anyone bothers to say. Student names are out
    # of scope; this identifies the *grader*, not the student.
    grader_name: str | None = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
