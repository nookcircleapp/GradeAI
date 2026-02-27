---
phase: 03-student-experience-ai-grading
plan: 01
subsystem: api
tags: [openai, fastapi, sqlmodel, sqlite, grading, async]

# Dependency graph
requires:
  - phase: 02-exam-management
    provides: Exam model with JSON questions array containing text, credit, rubric fields
provides:
  - Submission SQLModel with JSON columns for answers and grades
  - OpenAI grading service with concurrent async grade_answer calls
  - POST /api/submissions/preview endpoint (Try button — no persistence)
  - POST /api/submissions/ endpoint (Submit button — persists to DB)
  - GET /api/submissions/{id} endpoint for retrieval
affects:
  - 03-student-experience-ai-grading (frontend integration — student UI calling these endpoints)

# Tech tracking
tech-stack:
  added: [openai]
  patterns: [async-grading-service, json-object-response-format, concurrent-asyncio-gather]

key-files:
  created:
    - backend/app/models/submission.py
    - backend/app/schemas/submission.py
    - backend/app/services/grading.py
    - backend/app/routers/submissions.py
    - backend/app/services/__init__.py
  modified:
    - backend/app/config.py
    - backend/app/main.py
    - backend/requirements.txt

key-decisions:
  - "asyncio.gather for concurrent grading: all answers graded in parallel, not sequentially"
  - "response_format json_object: reliable structured output from OpenAI without parsing errors"
  - "temperature 0.3: low randomness for consistent, reproducible grading"
  - "Preview does not persist: Try button allows students to see feedback before final commit"
  - "400 for missing API key: explicit error over silent failure"

patterns-established:
  - "Services directory: backend/app/services/ for business logic separate from routers"
  - "Async router endpoints: FastAPI async def for I/O-bound OpenAI calls"
  - "Dict/object duck-typing: handle both raw JSON dicts and typed objects from SQLModel JSON columns"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 3 Plan 01: Backend Grading Infrastructure Summary

**OpenAI async grading service with preview and final submission endpoints — grades each answer against rubric concurrently, returning per-question scores and explanations via gpt-4o-mini**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T19:46:58Z
- **Completed:** 2026-02-27T19:48:41Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Submission SQLModel table with JSON columns for answers and grades (nullable for preview use case)
- Async OpenAI grading service using asyncio.gather for concurrent per-question grading
- Preview endpoint (POST /api/submissions/preview) grades without saving — powers the "Try" button
- Final submission endpoint (POST /api/submissions/) grades and persists — powers the "Submit" button
- GET endpoint returns full submission with deserialized grades
- Graceful error handling: 400 for missing API key, 500 with detail for OpenAI failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Submission model, schemas, and grading service** - `0b4d239` (feat)
2. **Task 2: Submission API endpoints (preview and final submit)** - `453f870` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `backend/app/models/submission.py` - Submission SQLModel with JSON answers/grades columns
- `backend/app/schemas/submission.py` - AnswerInput, GradeResult, SubmissionCreate, GradingResponse, SubmissionRead
- `backend/app/services/grading.py` - grade_answer and grade_submission async functions using OpenAI
- `backend/app/services/__init__.py` - Package init for services module
- `backend/app/routers/submissions.py` - Three endpoints: preview, create, get
- `backend/app/config.py` - Added openai_api_key and openai_model settings
- `backend/app/main.py` - Registered submission model and router
- `backend/requirements.txt` - Added openai package

## Decisions Made
- Used asyncio.gather for concurrent grading: all questions graded in parallel rather than sequentially, improving response time proportional to question count
- Used response_format json_object: ensures OpenAI always returns valid JSON, no need for brittle text parsing
- Temperature 0.3: low randomness for consistent, fair grading that doesn't vary wildly between calls
- Preview does not persist: decouples exploration from commitment, allowing students to learn before submitting
- Services directory pattern established: business logic (grading) lives in app/services/, separate from route handlers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation straightforward following established exam patterns.

## User Setup Required

**External services require manual configuration.** Set the following environment variable before running the backend:

- `GRADEAI_OPENAI_API_KEY`: Your OpenAI API key from https://platform.openai.com/api-keys

Without this key, grading endpoints return `400 Bad Request: "OpenAI API key not configured"`.

Optional:
- `GRADEAI_OPENAI_MODEL`: Model to use for grading (default: `gpt-4o-mini`)

## Next Phase Readiness

- All grading endpoints ready for frontend integration
- Student UI (plan 03-02) can call POST /api/submissions/preview for "Try" and POST /api/submissions/ for "Submit"
- No blockers — API returns structured JSON matching what the frontend will need

---
*Phase: 03-student-experience-ai-grading*
*Completed: 2026-02-27*
