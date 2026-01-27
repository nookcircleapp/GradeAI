# GradeAI

## What This Is

An AI-powered exam grading platform where teachers create question papers with rubrics, and students answer them to receive instant AI-generated feedback and grades. Built as a lightweight demo web app with a modern, polished UI.

## Core Value

Students get immediate, explainable AI feedback on subjective answers — transforming exam review from waiting days for grades to instant learning moments.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Teacher can create/edit one active exam with 3 questions
- [ ] Each question has: text, credit weight (2/5/8), rubric/key points
- [ ] Questions and rubrics are pre-filled with AI-themed content by default
- [ ] Student can view all questions at once and answer in any order
- [ ] Minimum word limits enforced (30/100/200 words per question)
- [ ] "Try" button previews AI grade without final submission
- [ ] "Submit" button finalizes exam and generates full report
- [ ] AI grades each answer against rubric with rating + explanation
- [ ] Final grade calculated out of 15 total points
- [ ] Report includes per-question breakdown and overall grade
- [ ] Report downloadable as PDF
- [ ] Modern, polished UI theme
- [ ] Toggle button to switch between /admin and /student views
- [ ] No authentication required

### Out of Scope

- User authentication/accounts — unnecessary complexity for demo
- Multiple exams — single active exam is sufficient
- Timed exams — not needed for demo purposes
- Multiple choice questions — focus on subjective grading
- Improvement suggestions in report — keep report focused on grading

## Context

This is a proof-of-concept demo to showcase AI-powered subjective exam grading. The app should feel polished enough to demonstrate the concept but doesn't need production-level infrastructure.

**Pre-filled demo content:**
- 3 questions about AI/machine learning
- Credit distribution: 2, 5, 8 (totaling 15)
- Word limits: 30, 100, 200 minimum words
- Rubrics/guidelines pre-populated for each question

**Two user views:**
- `/admin` — Teacher dashboard for exam management
- `/student` — Student dashboard for taking exam

**AI Grading Flow:**
1. Student writes answers
2. "Try" → Quick AI preview (can refine answers)
3. "Submit" → Final grading + PDF report generation

## Constraints

- **Tech stack**: React frontend + Python backend (FastAPI) + SQLite + OpenAI API
- **Deployment**: Simple web app, minimal infrastructure
- **AI Provider**: OpenAI GPT for grading
- **Scope**: Demo-quality, not production-hardened

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No authentication | Simplifies demo, unnecessary for POC | — Pending |
| Single active exam | Reduces complexity, sufficient for demo | — Pending |
| SQLite storage | No setup required, persists data | — Pending |
| Pre-filled content | Immediate demo-ready experience | — Pending |
| Try/Submit flow | Lets students refine before committing | — Pending |
| OpenAI for grading | Reliable, well-documented API | — Pending |

---
*Last updated: 2025-01-28 after initialization*
