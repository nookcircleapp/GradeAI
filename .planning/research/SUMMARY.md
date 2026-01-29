# Project Research Summary

**Project:** GradeAI - AI-Powered Exam Grading Platform
**Domain:** Educational Technology / AI Grading System
**Researched:** 2026-01-28
**Confidence:** HIGH

## Executive Summary

GradeAI is an AI-powered exam grading platform for subjective questions. Research reveals that successful exam platforms in 2026 balance automation with human oversight - the AI accelerates workflows but teachers retain control. The core technical challenge is ensuring consistent AI grading across similar answers while maintaining a responsive user experience during long-running grading operations.

The recommended approach uses a modern, well-documented stack: React + Vite + shadcn/ui for frontend, FastAPI + SQLAlchemy for backend, SQLite for MVP database, and OpenAI GPT with structured outputs for grading. This stack prioritizes developer experience and type safety while allowing easy scaling to PostgreSQL when needed. The architecture follows Router-Service-Repository pattern with background tasks for AI operations.

Key risks center on AI consistency (temperature=0.0, structured outputs mandatory), API rate limits (exponential backoff required), and database concurrency (SQLite locks, WAL mode essential). Mitigate by implementing proper retry logic, background task queuing, and comprehensive accessibility testing from day one (April 2026 ADA deadline).

## Key Findings

### Recommended Stack

Modern 2025/2026 tooling emphasizes type safety, developer experience, and minimal boilerplate. The stack balances cutting-edge libraries (Vite 6.x, shadcn/ui, TanStack Query v5) with mature foundations (FastAPI, SQLAlchemy 2.0, OpenAI SDK).

**Core technologies:**
- **Frontend:** React 18.3+ with Vite 6.x - 58% faster than CRA, excellent HMR under 50ms
- **UI Layer:** shadcn/ui + Tailwind 4.x - copy-paste components, full customization, no vendor lock-in
- **Backend:** FastAPI 0.115+ with Python 3.11+ - modern async, auto-docs, 300% faster than Flask
- **Database:** SQLite with SQLAlchemy 2.0 - perfect for MVP, easy migration path to PostgreSQL
- **AI:** OpenAI SDK 2.x with structured outputs - 100% schema reliability vs ~80% with JSON mode
- **PDF:** WeasyPrint 68.0+ - HTML/CSS templates, simpler than ReportLab for text-heavy reports

**Critical version locks:**
- Node.js 20.19+ or 22.12+ (required for Vite 6.x)
- Python 3.11+ (10-25% performance boost over 3.10)
- Pydantic 2.x (Rust-powered validation)
- TanStack Query 5.x (20% smaller, first-class Suspense)

### Expected Features

Research identified three distinct categories: table stakes (user expectations), differentiators (competitive advantage), and anti-features (deliberate scope exclusions).

**Must have (table stakes):**
- Exam creation with subjective questions and rubrics - without this, no platform exists
- Student answer submission with word count tracking - standard expectation
- AI grading with scores and explanations - core value proposition, transparency essential
- Results report with per-question breakdown - students/teachers need outcomes
- PDF export - standard for academic reports
- Basic authentication with role separation - teachers vs students
- Intuitive UI and mobile responsiveness - users abandon confusing interfaces

**Should have (competitive advantage):**
- Confidence scores - AI shows certainty level, flags edge cases for review
- Example answer highlighting - visual feedback showing what earned/lost points
- Auto-save with visual confirmation - prevents student work loss, reduces anxiety

**Defer (v2+ / anti-features):**
- Answer grouping - complex clustering, not needed for demo
- Advanced proctoring - facial recognition adds complexity, not core to grading demo
- LMS integration - Canvas/Blackboard sync avoided to reduce API integration complexity
- Multiple question types - focus on subjective/essay only, skip MCQ/diagrams

**Key insight:** Production platforms often fail demos due to overbuilding. Demo should showcase ONE innovation (AI grading subjective answers) without enterprise bloat.

### Architecture Approach

Three-tier architecture with clear separation: presentation (React), business logic (FastAPI), and data (SQLite). Critical architectural challenge is handling asynchronous AI grading while maintaining responsive UX.

**Major components:**
1. **Frontend (Feature-based)** - React with Zustand for global state, Context API for auth, feature-based folder structure (admin/, student/, shared/)
2. **Backend (Router-Service-Repository)** - FastAPI routers handle HTTP, services contain business logic, repositories manage database CRUD
3. **Database Schema** - Normalized 3NF design: Users → Exams → Questions → Submissions → Answers → Grades
4. **AI Integration Layer** - Background tasks with structured outputs, exponential backoff retry, streaming for progress feedback
5. **PDF Service** - WeasyPrint with Jinja2 templates for HTML→PDF conversion

**Key patterns:**
- Background tasks for AI calls (2-30 seconds latency) to avoid blocking HTTP responses
- Structured outputs (Pydantic models) ensure 100% reliable grading schema
- Temperature=0.0 for deterministic AI responses
- WAL mode for SQLite to handle concurrent writes
- Feature-based React organization keeps related code together

### Critical Pitfalls

**1. Inconsistent AI Grading** - LLM produces different scores for identical answers, destroying user trust
- **Prevent:** Temperature=0.0 (research shows 100% identical responses), structured outputs with low-precision scales (0-3 not 0-100), detailed question-specific rubrics, chain-of-thought reasoning
- **Phase impact:** Core grading engine (Phase 2) - must address early, retrofitting is difficult

**2. OpenAI API Rate Limits** - Batch grading 30 exams hits 429 errors, some answers fail silently
- **Prevent:** Exponential backoff with jitter (1s→2s→4s→8s waits), Tenacity library for retries, queue system for batches (3-5 at a time), monitor rate limit headers, show progress UI
- **Phase impact:** API integration (Phase 2) - critical before batch grading

**3. SQLite Database Locks** - Concurrent grading causes "database is locked" errors, requests timeout
- **Prevent:** `check_same_thread: False` config, enable WAL mode (`PRAGMA journal_mode=WAL`), async SQLAlchemy with create_async_engine, connection pooling, plan PostgreSQL migration for >10 users
- **Phase impact:** Database layer (Phase 1) - address early, disruptive to retrofit

**4. CORS Misconfiguration** - React frontend gets CORS errors, blocking API communication
- **Prevent:** Add CORSMiddleware FIRST in middleware stack, exact origin matching (no wildcards with credentials), verify http vs https, restart server after changes
- **Phase impact:** API setup (Phase 1) - must work day one

**5. ADA Accessibility Compliance** - Platform fails WCAG 2.1 Level AA, risking legal action
- **Prevent:** Alt text for all images, 4.5:1 contrast ratio, keyboard navigation, ARIA labels, semantic HTML, automated testing (axe-core, Lighthouse), screen reader testing
- **Phase impact:** ALL phases - April 24, 2026 deadline for public institutions
- **Deadline:** April 2026 for entities serving 50,000+ population

## Implications for Roadmap

Based on research, the build should follow dependency chains with early risk mitigation. Each phase delivers working functionality while avoiding identified pitfalls.

### Phase 1: Foundation & Infrastructure
**Rationale:** Database, auth, and API setup are prerequisites for all features. Addressing SQLite configuration and CORS early prevents compounding issues.
**Delivers:** Working FastAPI backend with SQLite (WAL mode), React frontend with routing, JWT authentication with teacher/student roles, CORS properly configured
**Addresses:** Authentication (table stakes), project structure (STACK.md)
**Avoids:** Pitfall 3 (database locks), Pitfall 4 (CORS misconfiguration)
**Duration:** Week 1

### Phase 2: Exam Management (Admin)
**Rationale:** Exams must exist before students can take them. Rubric design directly impacts grading quality - guidance UI prevents pitfall 8.
**Delivers:** Admin dashboard, exam CRUD operations, question editor with 3 questions per exam, rubric builder with templates and validation
**Addresses:** Exam creation (table stakes), rubric definition (table stakes)
**Avoids:** Pitfall 8 (poor rubric design), architectural foundation for AI integration
**Dependencies:** Phase 1 (requires auth and database)
**Duration:** Week 2

### Phase 3: Student Exam Interface
**Rationale:** Student workflow must work before grading is useful. Autosave is non-negotiable for user trust.
**Delivers:** Student dashboard, exam taking interface with single question per page, answer submission with word count tracking, debounced autosave (2-3s) with localStorage backup
**Addresses:** Answer submission (table stakes), word count display (table stakes), autosave (differentiator)
**Avoids:** Pitfall 9 (work loss), foundation for grading input
**Dependencies:** Phase 1 (auth), Phase 2 (exams must exist)
**Duration:** Week 3

### Phase 4: AI Grading Engine
**Rationale:** Core value proposition. OpenAI integration requires careful handling of rate limits and consistency from day one.
**Delivers:** OpenAI integration with structured outputs, grading service with temperature=0.0, exponential backoff retry logic, background tasks for async grading, confidence scores
**Addresses:** AI grading (table stakes), confidence scores (differentiator)
**Avoids:** Pitfall 1 (inconsistent grading), Pitfall 2 (rate limits)
**Uses:** OpenAI SDK 2.x with structured outputs (STACK.md)
**Implements:** AI integration layer from architecture
**Dependencies:** Phase 3 (requires submissions to grade)
**Duration:** Week 4
**Research flag:** May need deeper prompt engineering iteration based on grading accuracy

### Phase 5: Results & Feedback Display
**Rationale:** Students/teachers need to see grading outcomes. Admin review allows quality control.
**Delivers:** Student results page with per-question breakdown, grading explanations with rubric mapping, admin grade review interface with override capability
**Addresses:** Results report (table stakes), grading explanation (table stakes)
**Dependencies:** Phase 4 (requires grades to exist)
**Duration:** Week 5

### Phase 6: PDF Generation
**Rationale:** Standard expectation for academic reports. WeasyPrint simplifies HTML→PDF conversion.
**Delivers:** PDF service with Jinja2 templates, grade report download endpoint, async generation to prevent memory issues
**Addresses:** PDF export (table stakes)
**Avoids:** Pitfall 4 (PDF memory exhaustion)
**Uses:** WeasyPrint 68.0+ (STACK.md)
**Dependencies:** Phase 5 (requires complete grade data)
**Duration:** Week 6

### Phase 7: Polish & Accessibility
**Rationale:** Final pass ensures production readiness and ADA compliance before April 2026 deadline.
**Delivers:** Mobile responsive design, loading states and error handling, WCAG 2.1 Level AA compliance (alt text, contrast, keyboard nav, ARIA labels), Lighthouse score >90
**Addresses:** Mobile responsiveness (table stakes), intuitive UI (table stakes)
**Avoids:** Pitfall 7 (ADA compliance violations)
**Dependencies:** All previous phases
**Duration:** Week 7

### Phase Ordering Rationale

- **Dependency-driven:** Phase 1 must precede all (auth/database), Phase 2 must precede Phase 3 (exams before submissions), Phase 4 depends on Phase 3 (submissions before grading)
- **Risk-first:** Early phases address critical pitfalls (SQLite config, CORS, AI consistency) when they're cheap to fix
- **Incremental delivery:** Each phase produces working, testable functionality
- **Complexity curve:** Starts simple (CRUD operations) and builds to complex (AI integration, background tasks)

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 4 (AI Grading):** Prompt engineering may require iteration based on accuracy testing. Research indicates 85%+ agreement with human graders is achievable but needs validation.
- **Phase 6 (PDF):** Template design needs UX input for optimal report layout. Unicode font configuration may require testing with international characters.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Well-documented FastAPI + SQLAlchemy + React patterns, extensive official documentation
- **Phase 2 (Exam Management):** Standard CRUD operations with nested resources, established patterns
- **Phase 3 (Student Interface):** Common form handling with React Hook Form, autosave is established pattern
- **Phase 5 (Results Display):** Data visualization patterns are well-documented
- **Phase 7 (Accessibility):** WCAG 2.1 has clear requirements and automated testing tools

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official docs verified for all technologies. Vite 6.x, shadcn/ui, FastAPI 0.115+, SQLAlchemy 2.0 all confirmed as 2025/2026 standards. |
| Features | MEDIUM-HIGH | Cross-referenced multiple exam platforms (Gradescope, Canvas) and AI grading tools. Clear consensus on table stakes. Anti-features validated against production failures. |
| Architecture | HIGH | FastAPI Router-Service-Repository is established pattern. OpenAI structured outputs confirmed in official docs. SQLite→PostgreSQL migration path well-documented. |
| Pitfalls | HIGH | Critical pitfalls verified with official sources (OpenAI rate limits, SQLite concurrency, WCAG 2.1, FERPA). Temperature=0.0 consistency confirmed by research. April 2026 ADA deadline is federal regulation. |

**Overall confidence:** HIGH

### Gaps to Address

Research was comprehensive, but these areas need validation during implementation:

- **AI grading accuracy:** Benchmark dataset of 50-100 teacher-graded answers needed to validate 85%+ agreement threshold. Prompt engineering may require iteration.
- **SQLite performance ceiling:** Research indicates ~150k rows/sec regardless of concurrent writers. Monitor for "database is locked" errors during testing. Migration to PostgreSQL planned if >10 concurrent teachers.
- **OpenAI quota limits:** Actual rate limits depend on account tier. Monitor x-ratelimit-remaining-requests headers and test batch grading with production quotas.
- **PDF template design:** WeasyPrint HTML/CSS approach is sound, but specific layout needs UX review for optimal student readability.
- **Accessibility edge cases:** Automated testing (Lighthouse, axe-core) catches 80-90% of issues. Manual screen reader testing required before launch.

## Sources

### Primary (HIGH confidence)
- **STACK.md:** Verified with official Vite 6.x docs, FastAPI docs, OpenAI SDK releases, shadcn/ui installation guides
- **FEATURES.md:** Cross-referenced Gradescope features, Canvas grading, top AI grading tools (9-10 platforms analyzed)
- **ARCHITECTURE.md:** FastAPI best practices GitHub (zhanymkanov), SQLAlchemy relationship patterns, OpenAI structured outputs guide
- **PITFALLS.md:** OpenAI rate limits documentation, SQLite concurrency research, DOJ ADA Title II rule, FERPA requirements, temperature impact research

### Secondary (MEDIUM confidence)
- UX patterns from 2026 design trend articles (DesignRush, UX Design Institute)
- PDF generation library comparisons (Nutrient, Templated.io)
- React state management trends (Zustand 40% adoption claim)

### Tertiary (LOW confidence)
- None - all critical areas have HIGH or MEDIUM confidence sources

---
*Research completed: 2026-01-28*
*Ready for roadmap: yes*
