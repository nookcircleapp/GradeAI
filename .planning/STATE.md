# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-28)

**Core value:** Students get immediate, explainable AI feedback on subjective answers — transforming exam review from waiting days for grades to instant learning moments.
**Current focus:** Phase 3: Student Experience & AI Grading

## Current Position

Phase: 3 of 4 (Student Experience & AI Grading)
Plan: 2 of TBD in current phase
Status: In progress
Last activity: 2026-02-28 — Completed 03-02-PLAN.md (Student Exam-Taking UI)

Progress: [███████░░░] 70%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 3.3 min
- Total execution time: ~0.33 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 8min | 2.7min |
| 2 | 2 | 7.5min | 3.75min |
| 3 | 2 | 9min | 4.5min |

**Recent Trend:**
- Last 5 plans: 02-01 (2.5min), 02-02 (5min), 03-01 (2min), 03-02 (7min)
- Trend: Consistent velocity, slight increase with UI complexity

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- No authentication: Simplifies demo, unnecessary for POC
- Single active exam: Reduces complexity, sufficient for demo
- SQLite storage: No setup required, persists data
- Pre-filled content: Immediate demo-ready experience
- OpenAI for grading: Reliable, well-documented API
- SQLite WAL mode: Better concurrency for database access (01-01)
- CORS for localhost:5173/5174: Support multiple Vite dev server instances (01-01)
- GRADEAI_ env prefix: Avoid environment variable conflicts (01-01)
- Tailwind CSS v4 with @tailwindcss/vite: Latest version for best Vite integration (01-02)
- shadcn/ui path aliases (@/*): Clean imports for component library (01-02)
- New York style, Neutral colors: Professional, minimal design aesthetic (01-02)
- Student view as default: More common use case, better demo experience (01-03)
- Toggle shows destination view: "Switch to X View" clearer than mode toggle (01-03)
- Feature-based structure: features/admin and features/student directories (01-03)
- JSON column for questions: Simpler than separate table, always loaded together (02-01)
- QuestionSchema for validation: Type-safe nested question structure with rubrics (02-01)
- Demo seeding on startup: Auto-populate AI fundamentals exam with existence check (02-01)
- import type for RHF types: Vite/ESM requires type-only imports for TS types (02-02)
- asyncio.gather for grading: concurrent per-question API calls, not sequential (03-01)
- response_format json_object: reliable structured output from OpenAI grading (03-01)
- temperature 0.3: low randomness for consistent, reproducible grading results (03-01)
- Services directory pattern: app/services/ for business logic separate from routers (03-01)
- Re-export ExamResponse from student API: single source of truth, no type duplication (03-02)
- z.number() not z.coerce in examSchema: credit/min_words always arrive as numbers from API (03-02)
- Collapsible rubric hints default closed: keeps student UI clean, available on demand (03-02)
- getWordCount/isAllAnswersValid exported: reusable utilities ready for Plan 03-03 (03-02)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 03-02-PLAN.md (Student Exam-Taking UI)
Resume file: None
