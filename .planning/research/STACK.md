# Technology Stack

**Project:** GradeAI - AI-Powered Exam Grading Platform
**Researched:** 2026-01-28
**Overall Confidence:** HIGH

## Executive Summary

This stack recommendation focuses on the 2025/2026 standard for building a modern, polished web application with AI integration. The core constraints (React, Python/FastAPI, SQLite, OpenAI) are already decided. This research identifies the optimal supporting libraries and patterns for a professional exam grading platform.

**Key Philosophy:** Use modern, well-documented libraries with strong TypeScript/type safety, prioritizing developer experience and maintainability over bleeding-edge features.

---

## Frontend Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 18.3+ | UI framework | Required constraint. Industry standard with excellent ecosystem. |
| Vite | 6.0+ | Build tool | 58% faster startup than CRA, excellent DX, HMR under 50ms. Requires Node.js 20.19+ or 22.12+. |
| TypeScript | 5.0+ | Type safety | Essential for large apps. Vite uses esbuild for 20-30x faster transpilation than tsc. |

**Confidence:** HIGH
**Installation:**
```bash
npm create vite@latest gradeai -- --template react-ts
```

### UI Component Library
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | Latest | Component library | Copy-paste components (not npm package). Built on Radix UI + Tailwind. Full customization, no lock-in, excellent accessibility (WCAG 2.1). Perfect for custom dashboards. |
| Radix UI | Latest | Unstyled primitives | Underlying primitives for shadcn/ui. Handles accessibility, keyboard nav, screen readers automatically. |
| Tailwind CSS | 4.x | Styling | New Oxide engine in v4 provides major performance improvements. Simpler setup with @tailwindcss/vite plugin. |

**Why shadcn/ui over alternatives:**
- **vs MUI:** MUI is comprehensive but opinionated (Material Design). shadcn/ui gives you control without fighting the framework.
- **vs Chakra UI:** Chakra is great for accessibility, but shadcn/ui matches it while providing more customization.
- **vs Ant Design:** Ant Design is enterprise-focused and data-heavy, but heavier bundle size. shadcn/ui is lighter and more modern.

**Confidence:** HIGH
**Installation:**
```bash
# Install Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# Update vite.config.ts
import tailwindcss from '@tailwindcss/vite'
plugins: [react(), tailwindcss()]

# Initialize shadcn/ui
npx shadcn@latest init

# Add components as needed
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add form
npx shadcn@latest add table
```

### Form Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Hook Form | 7.x | Form state management | Lightweight, minimal re-renders, excellent DX. Industry standard for complex forms. |
| Zod | 3.x | Schema validation | End-to-end type safety with TypeScript. Integrates seamlessly with React Hook Form via @hookform/resolvers. |

**Use case for GradeAI:** Teachers creating exams with rubrics = complex, multi-step forms. React Hook Form + Zod eliminates boilerplate and ensures type safety from form to API.

**Confidence:** HIGH
**Installation:**
```bash
npm install react-hook-form zod @hookform/resolvers
```

### Data Fetching
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TanStack Query (React Query) | 5.x | Server state management | Automatic caching, background refetching, optimistic updates. v5 is 20% smaller than v4, has first-class Suspense support. Requires React 18+. |

**Why React Query:** Grading platform needs real-time updates (students submitting answers, AI grading in progress). React Query handles cache invalidation, loading states, and error handling automatically.

**Confidence:** HIGH
**Installation:**
```bash
npm install @tanstack/react-query
```

### Routing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Router | 6.x | Client-side routing | Industry standard. Works seamlessly with Vite and shadcn/ui. |

**Confidence:** HIGH
**Installation:**
```bash
npm install react-router-dom
```

### Additional Frontend Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Axios | 1.x | HTTP client | For React Query. Better than fetch for interceptors, request cancellation. |
| date-fns | 3.x | Date formatting | Lightweight, tree-shakeable. For exam deadlines, submission timestamps. |
| recharts | 2.x | Charts/graphs | If you need to visualize grade distributions, student performance. |

**Confidence:** MEDIUM (depends on feature requirements)

---

## Backend Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| FastAPI | 0.115+ | Web framework | Required constraint. Modern, fast, async, excellent automatic API docs. |
| Python | 3.11+ | Language | Required. 3.11 has 10-25% performance improvement over 3.10. |
| Uvicorn | Latest | ASGI server | Standard server for FastAPI. Use with --reload for development. |

**Confidence:** HIGH
**Installation:**
```bash
pip install "fastapi[standard]" uvicorn[standard]
```

### Data Validation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Pydantic | 2.x | Data validation | FastAPI uses Pydantic. v2 has Rust-powered core for massive performance boost. New API (model_validate, model_dump) is cleaner. |

**Confidence:** HIGH
**Note:** Pydantic v2 is already integrated with FastAPI. Key improvements: faster validation, better error messages, Annotated types for cleaner schemas.

### Database & ORM
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SQLite | 3.x | Database | Required constraint. Single file, Python has integrated support, perfect for MVP. |
| SQLAlchemy | 2.x | ORM | Mature, flexible ORM. Version 2.0 has first-class async support. |
| Alembic | Latest | Database migrations | Lightweight migration tool. Industry standard with SQLAlchemy. Auto-generates migrations from model changes. |

**Why SQLAlchemy 2.0 over alternatives:**
- **vs SQLModel:** SQLModel is officially recommended by FastAPI docs (built by FastAPI author), but SQLAlchemy 2.0 is more mature and has better async support as of 2025.
- **Async consideration:** SQLite with SQLAlchemy can use async with aiosqlite, but for SQLite specifically, sync is often simpler unless you need high concurrency.

**Recommendation for GradeAI:** Use SQLAlchemy 2.0 with sync mode initially. SQLite's `check_same_thread: False` config is sufficient for FastAPI. Switch to async if you encounter performance issues with concurrent grading.

**Confidence:** HIGH
**Installation:**
```bash
pip install sqlalchemy alembic
# Optional for async:
pip install aiosqlite
```

**Configuration:**
```python
# Sync mode (recommended for SQLite + FastAPI)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./gradeai.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency pattern
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### AI Integration
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenAI Python SDK | 2.x | OpenAI API client | Required. Latest version (2.11.0+) supports GPT-5.x, Realtime API. v2 has major API improvements. |

**Key best practices for grading:**
1. **Use GPT-4 or higher for grading** - Model grading works best with latest, most powerful models like GPT-4, and if we give them the ability to reason before making a judgment.
2. **Detailed prompts with examples** - Write extremely detailed prompts for grading tasks, with step-by-step instructions and many specific examples in context (few-shot learning).
3. **Provide ground truth examples** - Include examples of great, fair, and poor answers in the prompt.
4. **Structured outputs** - Use function calling or JSON mode to get structured grading results (score, explanation, feedback).
5. **Evaluation flywheel** - Build a dataset of graded answers, use GPT-4 to grade GPT-3.5 answers, iterate on prompts.

**Confidence:** HIGH
**Installation:**
```bash
pip install openai
```

**Basic grading prompt pattern:**
```python
from openai import OpenAI
client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o",  # or gpt-4-turbo
    messages=[
        {"role": "system", "content": "You are an expert grader..."},
        {"role": "user", "content": f"Question: {question}\nRubric: {rubric}\nAnswer: {student_answer}"}
    ],
    response_format={"type": "json_object"}  # For structured output
)
```

### PDF Generation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| WeasyPrint | 68.0+ | PDF generation | Converts HTML/CSS to PDF. Simpler than ReportLab for reports with text, tables, grades. Requires Python 3.10+. |

**Why WeasyPrint over ReportLab:**
- **WeasyPrint:** Best for converting HTML templates to PDF (exam results, grade reports). Easier to maintain (designers can edit HTML/CSS).
- **ReportLab:** Best for programmatic PDFs with complex charts/graphics. Steeper learning curve.

**For GradeAI use case:** Grade reports are mostly text, tables, scores. HTML templates are easier to design and iterate. WeasyPrint is the clear winner.

**Confidence:** HIGH
**Installation:**
```bash
pip install weasyprint
```

**Alternative (if WeasyPrint dependencies are problematic):**
- **FPDF2:** Pure Python, no external dependencies, but less CSS support.

### Testing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pytest | Latest | Testing framework | Python standard. pytest-asyncio for async tests. |
| pytest-cov | Latest | Coverage reports | Essential for measuring test effectiveness. |
| httpx | Latest | HTTP client for tests | FastAPI recommends TestClient (built on httpx). Supports async. |

**Best practices:**
- Use fixtures in tests/conftest.py for shared setup
- Use TestClient for endpoint testing
- Use dependency_overrides for mocking (e.g., mock OpenAI API calls)
- Test isolation: rollback DB changes or use in-memory DB

**Confidence:** HIGH
**Installation:**
```bash
pip install pytest pytest-cov pytest-asyncio httpx
```

### Security & Middleware
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| python-jose | Latest | JWT tokens | For authentication if needed. |
| passlib | Latest | Password hashing | Bcrypt hashing for teacher/student accounts. |
| python-multipart | Latest | Form data | Required for file uploads (if students upload documents). |

**CORS Configuration:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    # NEVER use ["*"] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Confidence:** HIGH

---

## Project Structure Recommendations

### FastAPI Structure (Module-Based for Scalability)

```
gradeai/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app instance, CORS, startup
│   │   ├── core/
│   │   │   ├── config.py        # Settings (Pydantic BaseSettings)
│   │   │   ├── database.py      # SQLAlchemy engine, session
│   │   │   └── security.py      # Auth utilities
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── exam.py
│   │   │   └── submission.py
│   │   ├── schemas/             # Pydantic schemas (API contracts)
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   └── exam.py
│   │   ├── api/                 # Route handlers
│   │   │   ├── __init__.py
│   │   │   ├── deps.py          # Shared dependencies
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── exams.py
│   │   │       ├── submissions.py
│   │   │       └── grading.py
│   │   ├── services/            # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── openai_service.py
│   │   │   └── pdf_service.py
│   │   └── utils/
│   │       └── prompts.py       # OpenAI prompt templates
│   ├── alembic/                 # Database migrations
│   ├── tests/
│   │   ├── conftest.py
│   │   └── test_grading.py
│   ├── alembic.ini
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/              # shadcn/ui components
│   │   ├── lib/
│   │   │   └── api.ts           # Axios instance
│   │   ├── hooks/
│   │   │   └── useExams.ts      # React Query hooks
│   │   ├── pages/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── components.json          # shadcn/ui config
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

**Why module-based over file-type:**
- Better for larger projects (GradeAI will grow beyond microservice size)
- Groups related functionality (all exam-related code together)
- Inspired by Netflix Dispatch and FastAPI community consensus in 2025

**Confidence:** HIGH

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| UI Library | shadcn/ui + Tailwind | Material UI (MUI) | MUI is comprehensive but more opinionated. Harder to customize. Larger bundle size. |
| UI Library | shadcn/ui + Tailwind | Chakra UI | Chakra is great, but shadcn/ui is more modern and gives better customization. |
| UI Library | shadcn/ui + Tailwind | Ant Design | Better for data-heavy enterprise dashboards, but heavier. GradeAI needs custom branding. |
| Form Library | React Hook Form + Zod | Formik | React Hook Form has better performance (fewer re-renders) and smaller bundle. |
| ORM | SQLAlchemy 2.0 | SQLModel | SQLModel is newer and officially recommended by FastAPI, but SQLAlchemy 2.0 is more mature and feature-complete as of 2025. |
| PDF Library | WeasyPrint | ReportLab | ReportLab is powerful but low-level. WeasyPrint's HTML/CSS approach is easier for reports. |
| PDF Library | WeasyPrint | FPDF2 | FPDF2 lacks CSS support. Only use if WeasyPrint dependencies cause issues. |

---

## Installation Guide

### Backend Setup
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi[standard] uvicorn[standard]
pip install sqlalchemy alembic
pip install pydantic pydantic-settings
pip install openai
pip install weasyprint
pip install python-jose[cryptography] passlib[bcrypt]
pip install pytest pytest-cov pytest-asyncio httpx

# Initialize Alembic
alembic init alembic

# Run development server
uvicorn app.main:app --reload
```

### Frontend Setup
```bash
# Create project
npm create vite@latest frontend -- --template react-ts
cd frontend

# Install core dependencies
npm install react-router-dom
npm install @tanstack/react-query
npm install axios
npm install react-hook-form zod @hookform/resolvers
npm install date-fns

# Install Tailwind CSS v4 + shadcn/ui
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init

# Add shadcn/ui components as needed
npx shadcn@latest add button card form input label table

# Run development server
npm run dev
```

---

## Version Summary

**Critical versions to lock in:**
- Python: 3.11+
- Node.js: 20.19+ or 22.12+
- FastAPI: 0.115+
- Pydantic: 2.x (comes with FastAPI)
- SQLAlchemy: 2.x
- OpenAI SDK: 2.x (2.11.0+)
- WeasyPrint: 68.0+
- React: 18.3+
- Vite: 6.0+
- TanStack Query: 5.x
- Tailwind CSS: 4.x

---

## Sources

### Frontend Stack
- [Makers' Den - React UI libraries in 2025](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [Untitled UI - 14 Best React UI Component Libraries in 2026](https://www.untitledui.com/blog/react-component-libraries)
- [shadcn/ui Installation](https://ui.shadcn.com/docs/installation)
- [Vite Getting Started](https://vite.dev/guide/)
- [Complete Guide to Setting Up React with TypeScript and Vite (2026)](https://medium.com/@robinviktorsson/complete-guide-to-setting-up-react-with-typescript-and-vite-2025-468f6556aaf2)
- [How to setup Tailwind CSS v4.1.5 with Vite + React (2025 updated guide)](https://dev.to/imamifti056/how-to-setup-tailwind-css-v415-with-vite-react-2025-updated-guide-3koc)
- [Contentful - Learn Zod validation with React Hook Form](https://www.contentful.com/blog/react-hook-form-validation-zod/)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [TanStack Query Releases](https://github.com/tanstack/query/releases)

### Backend Stack
- [GitHub - FastAPI Best Practices](https://github.com/zhanymkanov/fastapi-best-practices)
- [DEV - Structuring a FastAPI Project: Best Practices](https://dev.to/mohammad222pr/structuring-a-fastapi-project-best-practices-53l6)
- [FastAPI - SQL Databases Tutorial](https://fastapi.tiangolo.com/tutorial/sql-databases/)
- [Medium - Setting up a FastAPI App with Async SQLAlchemy 2.0 & Pydantic V2](https://medium.com/@tclaitken/setting-up-a-fastapi-app-with-async-sqlalchemy-2-0-pydantic-v2-e6c540be4308)
- [Leapcell - Building High-Performance Async APIs with FastAPI, SQLAlchemy 2.0](https://leapcell.io/blog/building-high-performance-async-apis-with-fastapi-sqlalchemy-2-0-and-asyncpg)
- [No-Fail Guide: Getting Started with Database Migrations (FastAPI × SQLAlchemy × Alembic)](https://blog.greeden.me/en/2025/08/12/no-fail-guide-getting-started-with-database-migrations-fastapi-x-sqlalchemy-x-alembic/)

### PDF Generation
- [Templated.io - How to Generate PDFs in Python: 8 Tools Compared (Updated for 2025)](https://templated.io/blog/generate-pdfs-in-python-with-libraries/)
- [Nutrient - Top 10 Python PDF generator libraries: Complete guide for developers (2025)](https://www.nutrient.io/blog/top-10-ways-to-generate-pdfs-in-python/)
- [WeasyPrint PyPI](https://pypi.org/project/weasyprint/)
- [WeasyPrint 68.0 Documentation](https://doc.courtbouillon.org/weasyprint/stable/)

### OpenAI API & Grading
- [OpenAI API - Evaluation best practices](https://platform.openai.com/docs/guides/evaluation-best-practices)
- [OpenAI API - Graders](https://platform.openai.com/docs/guides/graders)
- [Helicone - Top Prompt Evaluation Frameworks in 2025](https://www.helicone.ai/blog/prompt-evaluation-frameworks)
- [OpenAI Python SDK Releases](https://github.com/openai/openai-python/releases)

### Testing & Security
- [Frugal Testing - What Is FastAPI Testing? Tools, Frameworks, and Best Practices](https://www.frugaltesting.com/blog/what-is-fastapi-testing-tools-frameworks-and-best-practices)
- [Pytest with Eric - Building And Testing FastAPI CRUD APIs With Pytest](https://pytest-with-eric.com/pytest-advanced/pytest-fastapi-testing/)
- [FastAPI - CORS Documentation](https://fastapi.tiangolo.com/tutorial/cors/)
- [Medium - Understanding and Enabling CORS in FastAPI: A Quick Guide](https://mahdijafaridev.medium.com/understanding-and-enabling-cors-in-fastapi-a-quick-guide-5dd1003300d9)

---

## Confidence Summary

| Area | Confidence | Rationale |
|------|------------|-----------|
| Frontend Core (React + Vite) | HIGH | Industry standard, well-documented, verified with official sources. |
| UI Library (shadcn/ui) | HIGH | Modern approach verified by multiple 2025 sources, strong community adoption. |
| Form Management (RHF + Zod) | HIGH | Clear consensus in 2025 ecosystem, recent tutorials confirm best practice. |
| Backend Core (FastAPI) | HIGH | Mature framework, official documentation, community consensus on patterns. |
| ORM (SQLAlchemy 2.0) | HIGH | Version 2.0 is mature, async support verified, widely used with FastAPI. |
| PDF (WeasyPrint) | HIGH | Clear use case match (HTML reports), recent releases, good documentation. |
| OpenAI Integration | HIGH | Official documentation, recent SDK updates, clear grading best practices. |
| Project Structure | MEDIUM | Based on community patterns, but may need adjustment for specific needs. |

---

## Next Steps

1. **Set up project skeleton** using the recommended structure
2. **Initialize Alembic** for database migrations
3. **Create base models** (User, Exam, Submission, Grade)
4. **Set up authentication** (JWT tokens, teacher/student roles)
5. **Build OpenAI grading service** with prompt templates
6. **Test grading pipeline** with sample questions/answers
7. **Create PDF report templates** using WeasyPrint

This stack provides a solid foundation for building a professional, maintainable exam grading platform with modern tooling and best practices.
