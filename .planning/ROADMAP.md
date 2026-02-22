# Roadmap: GradeAI

## Overview

GradeAI delivers AI-powered exam grading in 4 phases: foundation setup with modern React/FastAPI stack, teacher exam management with rubrics, student exam-taking with AI grading engine, and final polish with PDF reports. Each phase builds on the previous to enable instant feedback for subjective answers.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & UI Setup** - Project scaffolding, React frontend, FastAPI backend, database
- [x] **Phase 2: Exam Management** - Teacher creates/edits exams with questions and rubrics
- [ ] **Phase 3: Student Experience & AI Grading** - Student takes exam, AI grades answers, generates report
- [ ] **Phase 4: Polish & PDF Export** - PDF generation, loading states, final UI polish

## Phase Details

### Phase 1: Foundation & UI Setup
**Goal**: Working full-stack application with modern UI framework and database ready for features
**Depends on**: Nothing (first phase)
**Requirements**: EXAM-04, UIUX-01, UIUX-02
**Success Criteria** (what must be TRUE):
  1. React frontend runs with Vite and displays shadcn/ui components
  2. FastAPI backend responds to API requests with proper CORS configuration
  3. SQLite database with WAL mode stores and retrieves data
  4. Toggle button switches between /admin and /student views
  5. UI is responsive on mobile and desktop devices
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Backend foundation: FastAPI + SQLite WAL + CORS + health endpoint
- [x] 01-02-PLAN.md — Frontend foundation: Vite + React + Tailwind v4 + shadcn/ui
- [x] 01-03-PLAN.md — UI shell: admin/student toggle, responsive layout, full-stack verify

### Phase 2: Exam Management
**Goal**: Teachers can create and edit one active exam with 3 questions, each with rubrics
**Depends on**: Phase 1
**Requirements**: EXAM-01, EXAM-02, EXAM-03
**Success Criteria** (what must be TRUE):
  1. Teacher can create an exam with 3 questions from /admin view
  2. Each question has text, credit weight (2/5/8), and rubric/key points
  3. Questions and rubrics are pre-filled with AI-themed demo content by default
  4. Teacher can edit existing exam questions and rubrics
  5. Exam data persists in database and survives server restart
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Backend exam CRUD API: model, schemas, router, demo seed
- [x] 02-02-PLAN.md — Frontend admin exam form: React Hook Form + Zod, API integration

### Phase 3: Student Experience & AI Grading
**Goal**: Students can take exam, preview AI grades, submit for final grading, and view complete report
**Depends on**: Phase 2
**Requirements**: STUD-01, STUD-02, STUD-03, STUD-04, GRAD-01, GRAD-02, GRAD-03, UIUX-03
**Success Criteria** (what must be TRUE):
  1. Student can view all 3 questions at once from /student view
  2. Student can answer questions in any order with word count displayed
  3. Word count validation enforces minimum requirements (30/100/200 words)
  4. "Try" button shows AI grade preview without finalizing submission
  5. "Submit" button finalizes exam and generates complete grade report
  6. AI grades each answer against rubric with rating (0-2, 0-5, 0-8) and explanation
  7. Final grade calculated correctly out of 15 total points
  8. Report displays per-question breakdown with scores and overall grade
  9. Loading states and progress feedback appear during AI grading operations
**Plans**: TBD

Plans:
- [ ] 03-01: TBD during planning
- [ ] 03-02: TBD during planning
- [ ] 03-03: TBD during planning

### Phase 4: Polish & PDF Export
**Goal**: Report is downloadable as PDF with polished, production-ready user experience
**Depends on**: Phase 3
**Requirements**: REPT-01
**Success Criteria** (what must be TRUE):
  1. Student can download grade report as PDF from results page
  2. PDF includes complete report with per-question breakdown and overall grade
  3. All UI elements are polished with consistent spacing and typography
  4. Error states handle edge cases gracefully (API failures, network issues)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & UI Setup | 3/3 | ✓ Complete | 2026-01-29 |
| 2. Exam Management | 2/2 | ✓ Complete | 2026-02-22 |
| 3. Student Experience & AI Grading | 0/TBD | Not started | - |
| 4. Polish & PDF Export | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-29*
*Last updated: 2026-02-22 — Phase 2 complete*
