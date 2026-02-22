# Requirements: GradeAI

**Defined:** 2026-01-29
**Core Value:** Students get immediate, explainable AI feedback on subjective answers

## v1 Requirements

### Exam Management

- [x] **EXAM-01**: Teacher can create and edit one active exam with 3 questions
- [x] **EXAM-02**: Each question has text, credit weight (2/5/8), and rubric/key points
- [x] **EXAM-03**: Questions and rubrics pre-filled with AI-themed demo content by default
- [x] **EXAM-04**: Toggle button to switch between /admin and /student views

### Student Experience

- [ ] **STUD-01**: Student can view all questions at once and answer in any order
- [ ] **STUD-02**: Minimum word limits enforced per question (30/100/200 words)
- [ ] **STUD-03**: "Try" button previews AI grade without final submission
- [ ] **STUD-04**: "Submit" button finalizes exam and generates full report

### AI Grading

- [ ] **GRAD-01**: AI grades each answer against rubric with rating and explanation
- [ ] **GRAD-02**: Final grade calculated out of 15 total points
- [ ] **GRAD-03**: Report includes per-question breakdown and overall grade

### Report

- [ ] **REPT-01**: Report downloadable as PDF

### UI/UX

- [x] **UIUX-01**: Modern, polished UI theme (shadcn/ui)
- [x] **UIUX-02**: Responsive/mobile-friendly design
- [ ] **UIUX-03**: Loading states and progress feedback during AI grading

## v2 Requirements

### Enhanced Grading

- **GRAD-04**: Confidence scores showing AI certainty level
- **GRAD-05**: Example answer highlighting showing what earned/lost points

### Student Experience

- **STUD-05**: Auto-save with visual confirmation

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication/accounts | Unnecessary complexity for demo |
| Multiple exams | Single active exam sufficient for POC |
| Timed exams | Not needed for demo purposes |
| Multiple choice questions | Focus on subjective grading |
| Improvement suggestions in report | Keep report focused on grading |
| LMS integration (Canvas/Blackboard) | Reduces API integration complexity |
| Answer grouping/clustering | Complex, not needed for demo |
| Advanced proctoring | Not core to grading demo |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXAM-01 | Phase 2 | Complete |
| EXAM-02 | Phase 2 | Complete |
| EXAM-03 | Phase 2 | Complete |
| EXAM-04 | Phase 1 | Complete |
| STUD-01 | Phase 3 | Pending |
| STUD-02 | Phase 3 | Pending |
| STUD-03 | Phase 3 | Pending |
| STUD-04 | Phase 3 | Pending |
| GRAD-01 | Phase 3 | Pending |
| GRAD-02 | Phase 3 | Pending |
| GRAD-03 | Phase 3 | Pending |
| REPT-01 | Phase 4 | Pending |
| UIUX-01 | Phase 1 | Complete |
| UIUX-02 | Phase 1 | Complete |
| UIUX-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-02-22 — Phase 2 requirements complete*
