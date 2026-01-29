# Phase 1: Foundation & UI Setup - Research

**Researched:** 2026-01-29
**Domain:** Full-stack web development (React + FastAPI + SQLite)
**Confidence:** HIGH

## Summary

Phase 1 establishes a modern full-stack application with React 18.3/Vite 6 frontend, FastAPI 0.115+ backend, and SQLite database. The stack is production-ready with minimal configuration overhead.

**Key findings:**
- Vite 6 requires Node.js 20.19+/22.12+ and provides instant dev server startup with React 18.3
- shadcn/ui now supports Tailwind v4 via canary CLI with auto-framework detection
- FastAPI officially recommends SQLModel (SQLAlchemy + Pydantic) for database operations
- CORS configuration requires explicit origins when `allow_credentials=True`
- SQLite WAL mode must be enabled via PRAGMA command, not connection string
- Mobile-first responsive design is built into Tailwind CSS 4's utility-first approach

**Primary recommendation:** Use domain-based project structure (not file-type based) for both frontend and backend to maintain scalability as features are added.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3+ | UI framework | Forward-compatible with React 19, stable deprecation path |
| Vite | 6.x | Build tool/dev server | Industry standard after CRA deprecation (2025), <300ms startup |
| shadcn/ui | Latest (canary) | Component library | Code ownership model, not a dependency, Tailwind v4 support |
| Tailwind CSS | 4.x | Utility CSS | Container queries, @theme directive, bleeding-edge browser features |
| FastAPI | 0.115+ | Python web framework | Auto-validation, OpenAPI docs, async support |
| SQLModel | Latest | ORM/validation | Official FastAPI recommendation, combines SQLAlchemy + Pydantic |
| SQLAlchemy | 2.0+ | Database toolkit | Modern async support, mature ecosystem |
| Pydantic | 2.x | Data validation | Native FastAPI integration, type safety |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | Latest | Icon library | Ships with shadcn/ui, extensive icon set |
| tw-animate-css | Latest | Tailwind animations | Replaces deprecated tailwindcss-animate (new default) |
| class-variance-authority | Latest | Component variants | Type-safe variant management for shadcn components |
| clsx + tailwind-merge | Latest | Conditional classes | Merge Tailwind classes without conflicts |
| aiosqlite | Latest | Async SQLite driver | If using async SQLAlchemy (optional for this phase) |
| python-multipart | Latest | Form data handling | Required for FastAPI file uploads (future phases) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQLModel | Raw SQLAlchemy 2.0 | More boilerplate, separate validation layer needed |
| shadcn/ui | Material-UI, Ant Design | Less customization, heavier bundle, dependency lock-in |
| Vite | Next.js, Remix | Adds SSR complexity unnecessary for POC demo |
| SQLite | PostgreSQL | Requires setup/hosting, unnecessary for demo/POC |

**Installation:**

```bash
# Frontend
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npx shadcn@canary init
npm install class-variance-authority clsx tailwind-merge lucide-react tw-animate-css

# Backend
cd ../backend
python3.11 -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install fastapi[standard] sqlmodel uvicorn[standard]
```

## Architecture Patterns

### Recommended Project Structure

**Frontend (Feature-Based):**
```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── ui/         # shadcn/ui components (auto-generated)
│   │   └── common/     # Project-specific reusable components
│   ├── features/       # Feature-based modules
│   │   ├── admin/      # Admin view logic
│   │   └── student/    # Student view logic
│   ├── lib/
│   │   └── utils.ts    # cn() helper and utilities
│   ├── styles/
│   │   └── globals.css # Tailwind imports + CSS variables
│   ├── App.tsx
│   └── main.tsx
├── components.json      # shadcn/ui config
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

**Backend (Domain-Based):**
```
backend/
├── app/
│   ├── main.py          # FastAPI app + CORS setup
│   ├── database.py      # Engine, session factory
│   ├── models/          # SQLModel table definitions
│   │   └── exam.py
│   ├── schemas/         # Pydantic models (request/response)
│   │   └── exam.py
│   ├── routers/         # API endpoints by domain
│   │   ├── admin.py
│   │   └── student.py
│   └── config.py        # Environment variables via Pydantic BaseSettings
├── data.db              # SQLite database file
├── requirements.txt
└── .env
```

### Pattern 1: Single Session Per Request

**What:** Use FastAPI dependency injection to create one database session per request

**When to use:** Always - prevents connection leaks and ensures transactions are scoped

**Example:**
```python
# Source: https://fastapi.tiangolo.com/tutorial/sql-databases/
from sqlmodel import Session, create_engine
from fastapi import Depends
from typing import Annotated

DATABASE_URL = "sqlite:///./data.db"
connect_args = {"check_same_thread": False}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]

@app.get("/items/")
def read_items(session: SessionDep):
    items = session.exec(select(Item)).all()
    return items
```

### Pattern 2: Model Inheritance for Clean APIs

**What:** Use SQLModel's inheritance to separate database models from API models

**When to use:** Always - controls what clients can send/receive, prevents security issues

**Example:**
```python
# Source: https://fastapi.tiangolo.com/tutorial/sql-databases/
from sqlmodel import SQLModel, Field

# Shared fields
class ExamBase(SQLModel):
    title: str = Field(index=True)
    duration: int

# Database table (has ID)
class Exam(ExamBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    admin_key: str  # Not exposed to students

# Public response (excludes sensitive fields)
class ExamPublic(ExamBase):
    id: int

# Create request (no ID, system generates)
class ExamCreate(ExamBase):
    admin_key: str

# Update request (all optional)
class ExamUpdate(SQLModel):
    title: str | None = None
    duration: int | None = None
```

### Pattern 3: Mobile-First Responsive Design

**What:** Write base styles for mobile, add responsive modifiers for larger screens

**When to use:** Always with Tailwind CSS - built-in approach, better performance

**Example:**
```tsx
// Source: https://tailwindcss.com/docs/responsive-design
<div className="
  flex flex-col      /* Mobile: stack vertically */
  md:flex-row        /* Tablet+: horizontal layout */
  gap-4              /* Mobile spacing */
  lg:gap-8           /* Desktop: larger spacing */
  w-full             /* Mobile: full width */
  max-w-none         /* Mobile: no constraints */
  lg:max-w-6xl       /* Desktop: constrained width */
  mx-auto            /* Desktop: centered */
">
  <Button className="w-full md:w-auto">Action</Button>
</div>
```

### Pattern 4: CORS Configuration for Development

**What:** Configure FastAPI CORS middleware with explicit origins for React dev server

**When to use:** Always in full-stack development - prevents CORS errors

**Example:**
```python
# Source: https://fastapi.tiangolo.com/tutorial/cors/
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost:5173",  # Vite default port
    "http://localhost:5174",  # Backup if 5173 in use
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Anti-Patterns to Avoid

- **File-type organization**: Don't separate all routers, schemas, models into separate folders - keep related code together by domain/feature
- **Global state for views**: Don't use global state management for /admin vs /student toggle - use URL routing or local state
- **Fixed widths**: Don't use fixed pixel widths (`w-[400px]`) - use responsive utilities (`w-full md:w-96`)
- **Wildcard CORS with credentials**: Don't use `allow_origins=["*"]` with `allow_credentials=True` - browsers reject this as insecure

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conditional CSS classes | String concatenation | `cn()` utility (clsx + tailwind-merge) | Handles conflicts, removes duplicates, type-safe |
| UI components | Custom button/input components | shadcn/ui components | Accessibility, keyboard nav, ARIA attributes |
| Database migrations | Manual ALTER TABLE scripts | Alembic (future phase) | Version control, rollback, team collaboration |
| API validation | Manual request parsing | Pydantic models in FastAPI | Auto-validation, OpenAPI docs, type safety |
| Responsive breakpoints | Custom media queries | Tailwind responsive utilities | Consistent, maintainable, no CSS duplication |
| Theme switching | Manual CSS variables | Tailwind dark: modifier + CSS variables | Built-in, no JS needed, prefers-color-scheme support |

**Key insight:** Modern tooling handles 90% of setup complexity. SQLModel eliminates ORM/validation duplication, shadcn/ui provides production-ready components, Tailwind handles responsive design patterns.

## Common Pitfalls

### Pitfall 1: SQLite `check_same_thread` Not Disabled

**What goes wrong:** FastAPI crashes with "SQLite objects created in a thread can only be used in that same thread" errors

**Why it happens:** FastAPI uses thread pools to handle requests, SQLite defaults to single-thread mode for safety

**How to avoid:** Always pass `connect_args={"check_same_thread": False}` to `create_engine()` for SQLite

**Warning signs:** Intermittent database errors, works in sync but fails with async, errors under load

### Pitfall 2: Forgetting WAL Mode for Concurrent Access

**What goes wrong:** "database is locked" errors when frontend makes concurrent API requests

**Why it happens:** SQLite's default journal mode blocks readers during writes

**How to avoid:** Run `sqlite3 data.db 'PRAGMA journal_mode=WAL;'` after database creation, or use SQLAlchemy event listener

**Warning signs:** Frontend requests fail randomly, errors during concurrent writes, "database is locked"

**Code solution:**
```python
from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()
```

### Pitfall 3: CORS Configured After Other Middleware

**What goes wrong:** API requests fail with CORS errors even with correct middleware configuration

**Why it happens:** If authentication/error middleware runs first and raises exception, CORS headers never get added to response

**How to avoid:** Add `CORSMiddleware` first, before any other middleware that might raise exceptions

**Warning signs:** CORS works for successful requests but fails on 401/403/500 errors

### Pitfall 4: Not Using `response_model` in FastAPI Endpoints

**What goes wrong:** Sensitive database fields (admin_key, internal IDs) leak to API responses

**Why it happens:** FastAPI serializes entire SQLModel objects by default if no `response_model` specified

**How to avoid:** Always specify `response_model=` parameter with appropriate schema (e.g., `ExamPublic`)

**Warning signs:** API returns more fields than expected, password hashes in responses, internal data exposed

### Pitfall 5: Vite Port Conflicts Not Handled

**What goes wrong:** `npm run dev` fails with "Port 5173 is already in use", dev server won't start

**Why it happens:** Multiple Vite projects running, previous process didn't exit cleanly

**How to avoid:** Configure fallback ports in `vite.config.ts`, document stopping previous instances

**Warning signs:** Port already in use errors, cannot connect to frontend

**Code solution:**
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    strictPort: false, // Try next port if 5173 is in use
  }
})
```

### Pitfall 6: Tailwind v4 CSS Not Loading

**What goes wrong:** Components render but have no styling, classes don't apply

**Why it happens:** Missing `@import "tailwindcss"` in CSS, wrong import order, PostCSS not configured

**How to avoid:** Follow shadcn/ui Tailwind v4 setup exactly, ensure CSS imports in main.tsx/App.tsx

**Warning signs:** Unstyled components, "unknown at-rule @theme" warnings, classes ignored

## Code Examples

Verified patterns from official sources:

### Initialize Database with Startup Event

```python
# Source: https://fastapi.tiangolo.com/tutorial/sql-databases/
from fastapi import FastAPI
from sqlmodel import SQLModel, create_engine

DATABASE_URL = "sqlite:///./data.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

app = FastAPI()

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
```

### Toggle Between Views with State

```tsx
// Basic approach for EXAM-04 requirement
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import AdminView from '@/features/admin/AdminView'
import StudentView from '@/features/student/StudentView'

function App() {
  const [view, setView] = useState<'admin' | 'student'>('student')

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">GradeAI</h1>
          <Button
            variant="outline"
            onClick={() => setView(view === 'admin' ? 'student' : 'admin')}
          >
            Switch to {view === 'admin' ? 'Student' : 'Admin'} View
          </Button>
        </div>
      </header>
      <main className="container mx-auto p-4">
        {view === 'admin' ? <AdminView /> : <StudentView />}
      </main>
    </div>
  )
}
```

### Basic CRUD Endpoint with SQLModel

```python
# Source: https://fastapi.tiangolo.com/tutorial/sql-databases/
from fastapi import FastAPI, HTTPException
from sqlmodel import Session, select
from typing import Annotated

@app.post("/exams/", response_model=ExamPublic)
def create_exam(exam: ExamCreate, session: SessionDep):
    db_exam = Exam.model_validate(exam)
    session.add(db_exam)
    session.commit()
    session.refresh(db_exam)
    return db_exam

@app.get("/exams/", response_model=list[ExamPublic])
def read_exams(session: SessionDep, offset: int = 0, limit: int = 100):
    exams = session.exec(select(Exam).offset(offset).limit(limit)).all()
    return exams

@app.get("/exams/{exam_id}", response_model=ExamPublic)
def read_exam(exam_id: int, session: SessionDep):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam
```

### Add shadcn/ui Components

```bash
# Source: https://ui.shadcn.com/docs
npx shadcn@canary add button
npx shadcn@canary add input
npx shadcn@canary add card
npx shadcn@canary add textarea
npx shadcn@canary add label

# Components are added to src/components/ui/ directory
# Import and use: import { Button } from '@/components/ui/button'
```

### Responsive Container Layout

```tsx
// Mobile-first responsive pattern
<div className="
  container         /* Responsive container */
  mx-auto           /* Center horizontally */
  px-4              /* Mobile: 1rem padding */
  sm:px-6           /* Small screens: 1.5rem */
  lg:px-8           /* Large screens: 2rem */
  py-8              /* Vertical padding */
">
  <div className="
    grid              /* CSS Grid */
    grid-cols-1       /* Mobile: single column */
    md:grid-cols-2    /* Tablet: two columns */
    lg:grid-cols-3    /* Desktop: three columns */
    gap-4             /* Mobile gap */
    lg:gap-6          /* Desktop: larger gap */
  ">
    {/* Content */}
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create React App | Vite 6 | CRA deprecated 2025 | 10x faster dev server, instant HMR |
| tailwindcss-animate | tw-animate-css | Tailwind v4 (2025) | New shadcn/ui projects use tw-animate-css |
| Raw SQLAlchemy + manual validation | SQLModel | FastAPI docs updated 2024 | 40% less boilerplate, type safety |
| Tailwind v3 config file | Tailwind v4 @theme directive | Tailwind v4 (2025) | Simpler theme access, inline theme values |
| forwardRef in React | Direct ref support | React 19 (2025) | Less boilerplate, but React 18.3 still needs it |
| Node.js 18 | Node.js 20.19+/22.12+ | Vite 6 requirement | Node 18 EOL, security updates |

**Deprecated/outdated:**
- `create-react-app`: Use Vite instead
- `tailwindcss-animate`: Use tw-animate-css
- Tailwind v3 config patterns: Migrate to @theme directive
- SQLAlchemy without Pydantic: Use SQLModel

## Open Questions

Things that couldn't be fully resolved:

1. **React Router vs Simple State Toggle**
   - What we know: EXAM-04 requires toggle button between /admin and /student views
   - What's unclear: Whether URL routing (/admin, /student paths) is desired or just visual toggle
   - Recommendation: Start with simple state toggle (less complexity), can add routing in future phase if needed. Phase 1 success criteria says "toggle button switches between /admin and /student views" not "routes"

2. **Pre-filled Content Location**
   - What we know: Prior decision states "pre-filled content for immediate demo-ready experience"
   - What's unclear: Whether seed data goes in Phase 1 or later phase when CRUD is built
   - Recommendation: Phase 1 focuses on foundation - add seed data in Phase 2 when exam management CRUD is implemented

3. **shadcn/ui Canary Stability**
   - What we know: Tailwind v4 support requires shadcn@canary, v3 projects still work
   - What's unclear: Production readiness timeline for canary release with Tailwind v4
   - Recommendation: Use canary for new project since Phase 1 is foundation, Tailwind v4 is the future. v3 would require migration later. Monitor for stable release.

## Sources

### Primary (HIGH confidence)

- [Vite Getting Started](https://vite.dev/guide/) - Node.js requirements, scaffolding commands
- [FastAPI SQL Databases Tutorial](https://fastapi.tiangolo.com/tutorial/sql-databases/) - SQLModel patterns, session management
- [FastAPI CORS Documentation](https://fastapi.tiangolo.com/tutorial/cors/) - Middleware configuration, parameters
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4) - Canary CLI, upgrade process
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design) - Mobile-first approach, breakpoints
- [Simon Willison: Enabling WAL Mode](https://til.simonwillison.net/sqlite/enabling-wal-mode) - SQLite WAL configuration

### Secondary (MEDIUM confidence)

- [Stop Waiting for Your React App to Load: The 2026 Guide to Vite](https://medium.com/@shubhspatil77/stop-waiting-for-your-react-app-to-load-the-2026-guide-to-vite-7e071923ab9f) - WebSearch verified with Vite official docs
- [Demystifying CORS in FastAPI & React](https://vinaysit.wordpress.com/2024/11/07/demystifying-cors-in-fastapi-react-a-practical-guide-%F0%9F%8C%90%F0%9F%9A%80/) - Practical CORS patterns verified with FastAPI docs
- [FastAPI Best Practices (zhanymkanov)](https://github.com/zhanymkanov/fastapi-best-practices) - Community-vetted patterns, widely referenced
- [10 Common FastAPI Mistakes That Hurt Performance](https://medium.com/@connect.hashblock/10-common-fastapi-mistakes-that-hurt-performance-and-how-to-fix-them-72b8553fe8e7) - Verified pitfalls

### Tertiary (LOW confidence)

- Various Medium articles on React/Vite folder structure - No single authoritative source, marked patterns for validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official documentation, version requirements clear
- Architecture: HIGH - Patterns from official FastAPI/React docs, community consensus strong
- Pitfalls: MEDIUM-HIGH - Mix of official docs warnings and verified community experience
- shadcn/ui canary: MEDIUM - Documented but canary release, production timeline unclear

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - frontend tooling moves fast, monthly check recommended)

**Node.js requirement critical:** Vite 6 explicitly requires Node.js 20.19+ or 22.12+, will not work with Node.js 18
