---
phase: 05-deploy-using-mcp-ai-service
plan: 01
subsystem: infra
tags: [vercel, render, deployment, cors, vite]

requires:
  - phase: 04-polish-pdf-export
    provides: Production-ready frontend and backend code
provides:
  - Deployment-ready codebase with configurable CORS and env-aware URLs
  - render.yaml for Render backend service definition
  - Fixed HTML title (GradeAI)
affects: [05-02]

tech-stack:
  added: []
  patterns:
    - "VITE_API_URL env var for all frontend API calls (App.tsx now consistent with feature API files)"
    - "render.yaml at repo root for declarative Render service config"

key-files:
  created:
    - render.yaml
  modified:
    - frontend/src/App.tsx
    - frontend/index.html

key-decisions:
  - "Root .gitignore already had *.db patterns — no changes needed"
  - "CORS config unchanged — pydantic-settings already supports GRADEAI_CORS_ORIGINS override"
  - "render.yaml excludes CORS_ORIGINS — set manually after Vercel URL is known"

patterns-established:
  - "render.yaml declarative service definition for Render deployments"

requirements-completed: []

duration: 1min
completed: 2026-02-28
---

# Phase 5 Plan 01: Deployment Prep Summary

**Fixed hardcoded localhost URLs to use VITE_API_URL, added render.yaml for Render backend, updated HTML title to GradeAI**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-28T18:44:17Z
- **Completed:** 2026-02-28T18:45:37Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- App.tsx health check now uses VITE_API_URL env var (consistent with feature API files)
- HTML title changed from "frontend" to "GradeAI"
- render.yaml created with Python web service config, free plan, uvicorn start command
- Verified frontend build still passes with changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix frontend hardcoded URLs and HTML title** - `98d2919` (feat)
2. **Task 2: Add render.yaml for Render backend deployment** - `e95ea88` (feat)

## Files Created/Modified
- `render.yaml` - Render service definition (Python web, free tier, uvicorn)
- `frontend/src/App.tsx` - Health check uses VITE_API_URL instead of hardcoded localhost
- `frontend/index.html` - Title changed to GradeAI

## Decisions Made
- Root .gitignore already has `*.db` patterns — no additional entries needed
- backend/app/config.py unchanged — pydantic-settings already handles GRADEAI_CORS_ORIGINS env var override for the `cors_origins: list[str]` field
- render.yaml does not include GRADEAI_CORS_ORIGINS since the Vercel URL isn't known until frontend deploys

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Skipped .gitignore update — already covered**
- **Found during:** Task 2 (gitignore update)
- **Issue:** Plan said to add SQLite patterns to .gitignore, but root .gitignore already has `*.db`, `*.db-shm`, `*.db-wal`
- **Fix:** No changes needed — existing patterns sufficient
- **Verification:** `grep "\.db" .gitignore` confirms patterns present

---

**Total deviations:** 1 auto-fixed (1 blocking — unnecessary work avoided)
**Impact on plan:** No scope change. Existing gitignore was already correct.

## Issues Encountered
None

## User Setup Required
**External services require manual configuration.** See Plan 05-02 for Render and Vercel deployment steps:
- GRADEAI_OPENAI_API_KEY on Render
- VITE_API_URL on Vercel
- GRADEAI_CORS_ORIGINS on Render (after Vercel URL known)

## Next Phase Readiness
- Codebase is deployment-ready
- Ready for Plan 05-02: README documentation and human deployment

---
*Phase: 05-deploy-using-mcp-ai-service*
*Completed: 2026-02-28*
