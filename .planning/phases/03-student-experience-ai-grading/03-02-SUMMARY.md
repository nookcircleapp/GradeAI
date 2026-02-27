---
phase: 03-student-experience-ai-grading
plan: 02
subsystem: ui
tags: [react, typescript, shadcn-ui, tailwind, react-hook-form, zod, word-count, exam-taking]

# Dependency graph
requires:
  - phase: 03-01
    provides: Submission API endpoints (preview and final submit)
  - phase: 02-02
    provides: Admin ExamForm and ExamResponse type definition
provides:
  - Student exam-taking UI with all 3 questions displayed simultaneously
  - Live word count validation (red below minimum, green when met)
  - Answer state management with per-question textarea
  - Student API client for fetchActiveExam, previewGrading, submitExam
  - Stub Try/Submit buttons (disabled until all word counts met)
affects: [03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Feature-scoped API client (student/api/student.ts) importing shared types from admin
    - Skeleton loading pattern with animated pulse for async data
    - Collapsible rubric hints in QuestionCard to avoid visual clutter
    - useCallback for stable event handlers to prevent unnecessary re-renders

key-files:
  created:
    - frontend/src/features/student/api/student.ts
    - frontend/src/features/student/components/WordCount.tsx
    - frontend/src/features/student/components/QuestionCard.tsx
    - frontend/src/features/student/components/ExamSheet.tsx
  modified:
    - frontend/src/features/student/StudentView.tsx
    - frontend/src/features/admin/schemas/examSchema.ts
    - frontend/src/features/admin/components/QuestionFields.tsx

key-decisions:
  - "Import ExamResponse from admin API via re-export rather than duplicating the type"
  - "CollapsibleRubric in QuestionCard: show by default closed to keep UI clean for students"
  - "getWordCount and isAllAnswersValid exported from StudentView for reuse in Plan 03-03"
  - "Try/Submit buttons disabled (not hidden) when word counts unmet, with informative caption"
  - "z.number() instead of z.coerce.number() in examSchema — credit/min_words always numeric from API"

patterns-established:
  - "WordCount: checkmark icon + green on met, alert icon + red on unmet"
  - "Skeleton loading: 3 card placeholders matching final layout structure"
  - "Error state: card with destructive border, retry button with RefreshCw icon"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-02-28
---

# Phase 3 Plan 02: Student Exam-Taking UI Summary

**Student exam UI with simultaneous 3-question display, live word count validation (red/green), and collapsible rubric hints using shadcn/ui Card and Textarea components**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-02-28T08:27:12Z
- **Completed:** 2026-02-28T08:34:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Student API client with fetchActiveExam (returns first exam), previewGrading, submitExam — all typed with AnswerInput, GradeResult, GradingResponse
- WordCount component with live feedback: green + checkmark at/above minimum, red + alert icon + helper text when below
- QuestionCard with question number circle, credit badge, answer textarea (min 150px), word count, collapsible rubric hints
- ExamSheet renders all questions in a vertical stack with exam title and total marks display
- StudentView rewired: loads exam on mount, manages answers array, animated skeleton loading, error + retry state, disabled Try/Submit buttons with readiness caption

## Task Commits

Each task was committed atomically:

1. **Task 1: Student API client and exam-taking components** - `54fc7d3` (feat)
2. **Task 2: Wire StudentView with exam loading and answer state** - `7f8c562` (feat)

**Plan metadata:** _(created in next commit)_

## Files Created/Modified

- `frontend/src/features/student/api/student.ts` - API client: fetchActiveExam, previewGrading, submitExam with TypeScript types
- `frontend/src/features/student/components/WordCount.tsx` - Live word count display with red/green validation feedback
- `frontend/src/features/student/components/QuestionCard.tsx` - Question card with textarea, word count, collapsible rubric
- `frontend/src/features/student/components/ExamSheet.tsx` - Exam layout rendering all questions with header and total marks
- `frontend/src/features/student/StudentView.tsx` - Rewired with exam loading, answer state management, action buttons
- `frontend/src/features/admin/schemas/examSchema.ts` - Bug fix: z.coerce removed, using z.number() for clean type inference
- `frontend/src/features/admin/components/QuestionFields.tsx` - Bug fix: nested useFieldArray cast to avoid @hookform/resolvers v5 type error

## Decisions Made

- Re-export `ExamResponse` from student API rather than duplicating — single source of truth from admin API
- Collapsible rubric hints default to closed — keeps UI focused for students, available on demand
- `getWordCount` and `isAllAnswersValid` exported from StudentView for reuse in Plan 03-03 grading integration
- Try/Submit buttons disabled (not hidden) when word counts aren't met — guides student without removing affordance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript build errors in admin ExamForm**

- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** `z.coerce.number()` in examSchema produces `unknown` input type, incompatible with `@hookform/resolvers` v5 + Zod v4 strict type signatures. Also, nested `useFieldArray` for rubric used invalid name type.
- **Fix:** Changed `z.coerce.number()` to `z.number()` (credit/min_words are always numeric from API); cast `control` to `Control<any>` in the nested rubric `useFieldArray` in QuestionFields
- **Files modified:** `frontend/src/features/admin/schemas/examSchema.ts`, `frontend/src/features/admin/components/QuestionFields.tsx`
- **Verification:** `npm run build` passes successfully (1811 modules, no errors)
- **Committed in:** `7f8c562` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - pre-existing)
**Impact on plan:** Bug fix was necessary to achieve a passing build. No scope creep — admin form behavior unchanged.

## Issues Encountered

- `@hookform/resolvers` v5 uses a 3-arg Resolver type `Resolver<TOutput, TContext, TInput>` where Zod v4's `z.coerce` fields expose `unknown` as the input type. Fixed by removing coerce (unnecessary here) and using `Control<any>` cast for the nested field array.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All student exam-taking components ready for Plan 03-03 grading integration
- `previewGrading` and `submitExam` API functions in student.ts ready to be wired to Try/Submit buttons
- `isAllAnswersValid` utility ready for gate-checking before API calls
- No blockers

---
*Phase: 03-student-experience-ai-grading*
*Completed: 2026-02-28*
