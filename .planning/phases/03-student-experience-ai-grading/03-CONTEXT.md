# Phase 3: Student Experience & AI Grading - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Students take an exam (view 3 questions, write answers with word count validation), preview AI grades via "Try" button, finalize with "Submit" button, and view a complete grade report. The exam structure and admin management already exist from Phase 2. PDF export and final polish belong to Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation decisions for this phase are at Claude's discretion. The user trusts Claude to make reasonable choices across all areas:

**Exam-taking layout**
- How questions are presented (all-at-once vs scrollable sections)
- Answer input style and sizing
- Word count display placement and minimum enforcement UX (30/100/200 words)

**Try vs Submit flow**
- How "Try" preview grading differs from "Submit" final grading
- Confirmation steps before final submission
- Whether Try results persist or are ephemeral

**AI grading feedback**
- Rating visualization (numeric, bar, stars, etc.)
- Explanation depth and tone
- Per-question breakdown layout and overall grade presentation

**Loading & progress states**
- Progress indicators during AI grading
- Whether results stream in or appear all at once
- Loading skeleton/spinner design

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

The roadmap specifies these constraints that must be respected:
- 3 questions displayed at once, answerable in any order
- Word count displayed with minimums enforced (30/100/200 words)
- "Try" = preview without finalizing, "Submit" = final grading
- AI grades against rubric with rating (0-2, 0-5, 0-8 per question)
- Total grade out of 15 points
- Report shows per-question breakdown with scores and overall grade

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-student-experience-ai-grading*
*Context gathered: 2026-02-22*
