# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-28)

**Core value:** Students get immediate, explainable AI feedback on subjective answers — transforming exam review from waiting days for grades to instant learning moments.
**Current focus:** Phase 5: Deploy using MCP AI Service — In progress

## Current Position

Phase: 5 of 5 (Deploy using MCP AI Service)
Plan: 2 of 2 in current phase
Status: Executing — deployment checkpoint pending
Last activity: 2026-02-28 — Completed 05-02-PLAN.md (README & Deployment) — awaiting human deploy

Progress: [██████████] 100% (code complete, deployment pending)

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: 2.6 min
- Total execution time: ~0.48 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 8min | 2.7min |
| 2 | 2 | 7.5min | 3.75min |
| 3 | 3 | 12min | 4min |
| 4 | 2 | 5min | 2.5min |
| 5 | 2 | 2min | 1min |

**Recent Trend:**
- Last 5 plans: 04-01 (3min), 04-02 (2min), 05-01 (1min), 05-02 (1min)
- Trend: Consistent velocity, averaging ~1.75 min/plan

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
- gradingAction state for targeted button spinners: avoids ambiguity when prior preview exists (03-03)
- Score tiers emerald/amber/red at 70%/40% thresholds: clear visual signal without distraction (03-03)
- Grade report hidden during isGrading: prevents stale data flash between Try attempts (03-03)
- window.print() for PDF export: browser-native, zero dependencies, high-fidelity from existing CSS (04-01)
- print:hidden per-element in StudentView: surgical isolation, grade report stays in natural document flow (04-01)
- ErrorBoundary as class component: React requires class components for getDerivedStateFromError (04-01)
- toast() after window.print(): guides user to choose "Save as PDF" in browser print dialog (04-01)
- Inline fetchWithTimeout per API file: only 2 files, avoids shared utility file complexity (04-02)
- AbortController 30s timeout on all API calls: timeout errors surface through existing error handlers (04-02)
- loadExam as useCallback in AdminView: enables retry button wiring in error card (04-02)
- VITE_API_URL for all frontend API calls: consistent env-var pattern across App.tsx and feature APIs (05-01)
- render.yaml without CORS_ORIGINS: set manually after Vercel URL known (05-01)
- Root .gitignore already covers *.db: no changes needed (05-01)
- README includes project structure overview: for developer onboarding (05-02)
- Deploy Render first, then Vercel: backend URL needed as Vercel env var (05-02)

### Roadmap Evolution

- Phase 5 added: Deploy using MCP AI Service

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 05-02-PLAN.md (README & Deployment) — deployment checkpoint pending
Resume file: None
