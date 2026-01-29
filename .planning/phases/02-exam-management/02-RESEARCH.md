# Phase 2: Exam Management - Research

**Researched:** 2026-01-29
**Domain:** FastAPI + SQLModel CRUD operations, React form management
**Confidence:** HIGH

## Summary

Phase 2 focuses on implementing exam creation and editing functionality with a teacher interface. The standard approach combines FastAPI's dependency injection with SQLModel's unified model architecture for the backend, and React Hook Form with TypeScript for type-safe frontend forms.

The key technical challenge is managing nested structured data (exam with array of questions, each with rubric points). SQLModel handles this using SQLAlchemy's JSON column type for storing question arrays, while React Hook Form's useFieldArray manages dynamic question lists with type safety.

Database seeding for demo content should occur during the startup event, with existence checks to prevent duplicate data on server restarts.

**Primary recommendation:** Use SQLModel's multiple models pattern (Create/Read/Update schemas), React Hook Form with Zod validation for type-safe forms, and JSON columns for nested question/rubric data.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLModel | latest | Database ORM | Unifies SQLAlchemy + Pydantic, designed for FastAPI |
| FastAPI | latest | API framework | Already in project, dependency injection built-in |
| React Hook Form | ^7.x | Form management | Minimal re-renders, TypeScript-first, 12KB bundle |
| Zod | ^3.x | Schema validation | Type inference, reusable client/server validation |
| @hookform/resolvers | latest | Validation bridge | Official React Hook Form + Zod integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SQLAlchemy Column/JSON | via SQLModel | Nested data storage | When storing arrays/objects in SQLite |
| Pydantic validators | via SQLModel | Custom validation | When built-in validators insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Hook Form | Formik | Formik is unmaintained (no commits in 1+ year), 44KB vs 12KB |
| React Hook Form | TanStack Form | Better for cross-framework, but React-only project |
| Zod | Yup | Yup lacks native TypeScript inference |
| JSON columns | Separate tables | JSON simpler for POC, relational better at scale |

**Installation:**
```bash
# Backend (already installed)
pip install fastapi uvicorn sqlmodel pydantic-settings

# Frontend
npm install react-hook-form zod @hookform/resolvers
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── models/          # SQLModel table definitions
│   └── exam.py      # Exam model with JSON questions field
├── schemas/         # Pydantic I/O models
│   └── exam.py      # ExamCreate, ExamRead, ExamUpdate
├── routers/         # FastAPI route handlers
│   └── exams.py     # CRUD endpoints
└── seed.py          # Database seeding logic

frontend/src/features/admin/
├── components/
│   ├── ExamForm.tsx       # Main form component
│   ├── QuestionFields.tsx # useFieldArray for questions
│   └── RubricInput.tsx    # Individual rubric points
├── schemas/
│   └── examSchema.ts      # Zod validation schema
└── api/
    └── exams.ts           # API client functions
```

### Pattern 1: SQLModel Multiple Models
**What:** Separate model classes for Create, Read, and Update operations
**When to use:** Always - prevents security issues and validation problems
**Example:**
```python
# Source: https://sqlmodel.tiangolo.com/tutorial/fastapi/multiple-models/

# Base model with shared fields
class ExamBase(SQLModel):
    title: str
    # Don't include questions here if they need different validation

# Table model (database)
class Exam(ExamBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    questions: dict = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

# API input (create)
class ExamCreate(ExamBase):
    questions: list[dict]  # Validated structure

# API output (read)
class ExamRead(ExamBase):
    id: int
    questions: list[dict]
    created_at: datetime

# API input (update) - all fields optional
class ExamUpdate(SQLModel):
    title: str | None = None
    questions: list[dict] | None = None
```

### Pattern 2: JSON Column with Nested Data
**What:** Store structured arrays/objects in SQLite using JSON columns
**When to use:** For nested data like questions with rubrics (POC/demo scale)
**Example:**
```python
# Source: https://github.com/fastapi/sqlmodel/issues/63

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel

class Exam(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    # Store array of question objects as JSON
    questions: dict = Field(sa_column=Column(JSON))

# Questions structure in JSON:
# [
#   {
#     "text": "Question 1",
#     "credit": 2,
#     "rubric": ["Point 1", "Point 2"]
#   }
# ]
```

### Pattern 3: FastAPI Dependency Injection for Sessions
**What:** Use dependency injection to provide database sessions per request
**When to use:** Always - ensures proper resource cleanup and transaction boundaries
**Example:**
```python
# Source: https://sqlmodel.tiangolo.com/tutorial/fastapi/session-with-dependency/

from fastapi import Depends
from sqlmodel import Session

# Already implemented in database.py
def get_session():
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]

# Use in routes
@router.post("/exams")
def create_exam(exam: ExamCreate, session: SessionDep):
    db_exam = Exam.model_validate(exam)
    session.add(db_exam)
    session.commit()
    session.refresh(db_exam)
    return db_exam
```

### Pattern 4: React Hook Form with useFieldArray
**What:** Manage dynamic lists of form fields with type safety
**When to use:** For arrays of questions, rubric points, or any repeating fields
**Example:**
```typescript
// Source: https://react-hook-form.com/docs/usefieldarray

import { useForm, useFieldArray } from 'react-hook-form';

type ExamFormData = {
  title: string;
  questions: {
    text: string;
    credit: number;
    rubric: string[];
  }[];
};

function ExamForm() {
  const { control, register } = useForm<ExamFormData>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions"
  });

  return (
    <form>
      {fields.map((field, index) => (
        <div key={field.id}> {/* Use field.id, not index! */}
          <input {...register(`questions.${index}.text` as const)} />
          <input {...register(`questions.${index}.credit` as const)} />
        </div>
      ))}
    </form>
  );
}
```

### Pattern 5: Zod Schema with Type Inference
**What:** Define validation schemas that generate TypeScript types
**When to use:** Always with React Hook Form - provides type safety and runtime validation
**Example:**
```typescript
// Source: https://zod.dev/

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const examSchema = z.object({
  title: z.string().min(1, "Title required"),
  questions: z.array(
    z.object({
      text: z.string().min(1, "Question text required"),
      credit: z.enum(["2", "5", "8"]).transform(Number),
      rubric: z.array(z.string().min(1))
    })
  ).length(3, "Must have exactly 3 questions")
});

// Automatic type inference
type ExamFormData = z.infer<typeof examSchema>;

// Use with React Hook Form
const { control } = useForm<ExamFormData>({
  resolver: zodResolver(examSchema)
});
```

### Pattern 6: Database Seeding on Startup
**What:** Pre-fill database with demo data during application startup
**When to use:** For demo/POC applications that need immediate usability
**Example:**
```python
# Source: https://fastapi.tiangolo.com/advanced/events/

from fastapi import FastAPI
from sqlmodel import Session, select

@app.on_event("startup")
def seed_database():
    with Session(engine) as session:
        # Check if data already exists
        existing = session.exec(select(Exam)).first()
        if existing:
            return  # Skip seeding

        # Create demo exam
        demo_exam = Exam(
            title="AI Fundamentals Exam",
            questions=[
                {
                    "text": "Define artificial intelligence...",
                    "credit": 2,
                    "rubric": ["Clear definition", "Examples provided"]
                },
                # ... more questions
            ]
        )
        session.add(demo_exam)
        session.commit()
```

### Anti-Patterns to Avoid
- **Using table models for validation:** Never use `Exam(table=True)` directly in API endpoints - creates security vulnerabilities where clients can set IDs
- **Manual dict serialization:** Don't manually call `.dict()` everywhere - use Pydantic's `model_validate()` for automatic conversion
- **Index as key in useFieldArray:** Using array index as React key breaks field identity on reorder - always use `field.id`
- **Empty objects in append:** `append({})` fails validation - always provide complete default values for all required fields
- **Multiple useFieldArray for same name:** Creates state conflicts - one `useFieldArray` instance per field path
- **Re-seeding on every startup:** Check for existing data before inserting seed data to prevent duplicates

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state management | Custom useState per field | React Hook Form | Handles validation, errors, touched state, dirty tracking, submission |
| Form validation | Custom validation functions | Zod + zodResolver | Type safety, reusable schemas, built-in error messages |
| Dynamic field arrays | Manual array state + map | useFieldArray | Manages field identity, handles add/remove, tracks changes |
| Type-safe API calls | Separate types for request/response | Zod schemas with z.infer | Single source of truth, runtime + compile-time safety |
| Database migrations | Manual SQL scripts | Alembic (production) | Schema versioning, rollbacks, team collaboration |
| Session management | Manual connection pooling | FastAPI Depends + yield | Automatic cleanup, exception safety, request scoping |

**Key insight:** Form management and validation have numerous edge cases (async validation, nested errors, field arrays, touched state, submission state). Libraries handle these consistently.

## Common Pitfalls

### Pitfall 1: Using Table Models in API Endpoints
**What goes wrong:** Using `Exam(table=True)` as request body allows clients to set `id`, `created_at`, or inject SQL
**Why it happens:** Convenient to reuse single model for everything
**How to avoid:** Always create separate ExamCreate, ExamRead, ExamUpdate models
**Warning signs:** API accepts fields that shouldn't be client-settable; security scanner flags injection risks

### Pitfall 2: JSON Column Serialization Errors
**What goes wrong:** `TypeError: Object of type 'Column' is not JSON serializable` when returning models
**Why it happens:** SQLModel can't automatically serialize SQLAlchemy Column objects in responses
**How to avoid:** Use response_model parameter with Pydantic model (ExamRead) in route decorator
**Warning signs:** API returns 500 errors on success; logs show serialization TypeErrors

### Pitfall 3: useFieldArray Key Prop Using Index
**What goes wrong:** Field values swap positions when reordering; validation errors appear on wrong fields
**Why it happens:** React can't track field identity when keys change
**How to avoid:** Always use `field.id` as key: `<div key={field.id}>`
**Warning signs:** Form state corrupts during add/remove operations; fields lose focus unexpectedly

### Pitfall 4: Forgetting Model Imports
**What goes wrong:** Tables don't get created in database despite calling `create_all()`
**Why it happens:** SQLModel.metadata only knows about imported models
**How to avoid:** Import all models in `main.py` or `database.py` before calling `create_all()`
**Warning signs:** No errors but tables missing; SQLAlchemy metadata.tables is empty

### Pitfall 5: Re-seeding Database on Every Restart
**What goes wrong:** Duplicate demo data accumulates; unique constraints fail
**Why it happens:** Seed function doesn't check for existing data
**How to avoid:** Query for existing records before inserting: `if not session.exec(select(Exam)).first()`
**Warning signs:** Multiple identical exam records; integrity constraint violations

### Pitfall 6: Validation-only Formik Fields
**What goes wrong:** Formik appears unmaintained (no commits in 1+ year); larger bundle size (44KB vs 12KB)
**Why it happens:** Older tutorials still recommend Formik
**How to avoid:** Use React Hook Form for new projects in 2026
**Warning signs:** Dependency security warnings; performance issues with large forms

### Pitfall 7: Not Casting useFieldArray Paths
**What goes wrong:** TypeScript errors: `Type 'string' is not assignable to type 'Path<ExamFormData>'`
**Why it happens:** Template literals create `string` type, not specific path type
**How to avoid:** Cast field paths: `register(`questions.${index}.text` as const)`
**Warning signs:** TypeScript errors on valid field paths; register calls have type mismatches

### Pitfall 8: Async Validation Without Await
**What goes wrong:** Form submits before validation completes; invalid data reaches server
**Why it happens:** Async validators don't block form submission by default
**How to avoid:** Use `mode: 'onBlur'` or `mode: 'onChange'` to validate before submit; ensure `handleSubmit` waits
**Warning signs:** Server-side validation catches errors that should be caught client-side

## Code Examples

Verified patterns from official sources:

### Complete CRUD Router with SQLModel
```python
# Source: https://sqlmodel.tiangolo.com/tutorial/fastapi/simple-hero-api/

from fastapi import APIRouter, HTTPException
from sqlmodel import select
from app.database import SessionDep
from app.models.exam import Exam
from app.schemas.exam import ExamCreate, ExamRead, ExamUpdate

router = APIRouter(prefix="/api/exams", tags=["exams"])

@router.post("/", response_model=ExamRead)
def create_exam(exam: ExamCreate, session: SessionDep):
    """Create a new exam with questions."""
    db_exam = Exam.model_validate(exam)
    session.add(db_exam)
    session.commit()
    session.refresh(db_exam)
    return db_exam

@router.get("/", response_model=list[ExamRead])
def list_exams(session: SessionDep):
    """Get all exams (for POC, single active exam)."""
    exams = session.exec(select(Exam)).all()
    return exams

@router.get("/{exam_id}", response_model=ExamRead)
def get_exam(exam_id: int, session: SessionDep):
    """Get exam by ID."""
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam

@router.patch("/{exam_id}", response_model=ExamRead)
def update_exam(exam_id: int, exam: ExamUpdate, session: SessionDep):
    """Update exam fields."""
    db_exam = session.get(Exam, exam_id)
    if not db_exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Update only provided fields
    exam_data = exam.model_dump(exclude_unset=True)
    db_exam.sqlmodel_update(exam_data)
    session.add(db_exam)
    session.commit()
    session.refresh(db_exam)
    return db_exam
```

### React Hook Form with Zod and useFieldArray
```typescript
// Source: https://react-hook-form.com/docs/usefieldarray + https://zod.dev/

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define validation schema
const examSchema = z.object({
  title: z.string().min(1, "Title is required"),
  questions: z.array(
    z.object({
      text: z.string().min(1, "Question text is required"),
      credit: z.coerce.number().refine(
        (val) => [2, 5, 8].includes(val),
        "Credit must be 2, 5, or 8"
      ),
      rubric: z.array(z.string().min(1, "Rubric point cannot be empty"))
        .min(1, "At least one rubric point required")
    })
  ).length(3, "Exam must have exactly 3 questions")
});

type ExamFormData = z.infer<typeof examSchema>;

function ExamForm({ defaultValues }: { defaultValues?: ExamFormData }) {
  const { control, register, handleSubmit, formState: { errors } } = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: defaultValues || {
      title: "",
      questions: [
        { text: "", credit: 2, rubric: [""] },
        { text: "", credit: 5, rubric: [""] },
        { text: "", credit: 8, rubric: [""] }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions"
  });

  const onSubmit = async (data: ExamFormData) => {
    // Data is already validated by Zod
    const response = await fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    // Handle response
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("title")} />
      {errors.title && <span>{errors.title.message}</span>}

      {fields.map((field, index) => (
        <div key={field.id}> {/* Critical: use field.id, not index */}
          <input {...register(`questions.${index}.text` as const)} />
          <select {...register(`questions.${index}.credit` as const)}>
            <option value="2">2 points</option>
            <option value="5">5 points</option>
            <option value="8">8 points</option>
          </select>
          {/* Nested useFieldArray for rubric points would go here */}
        </div>
      ))}

      <button type="submit">Save Exam</button>
    </form>
  );
}
```

### Database Seeding with Existence Check
```python
# Source: https://gist.github.com/jsmsalt/26bf25844870d59eee17997727e3a631
# Modified with existence check pattern

from fastapi import FastAPI
from sqlmodel import Session, select
from app.models.exam import Exam
from app.database import engine, create_db_and_tables

app = FastAPI()

DEMO_EXAM_DATA = {
    "title": "AI Fundamentals Final Exam",
    "questions": [
        {
            "text": "Define artificial intelligence and provide two real-world applications.",
            "credit": 2,
            "rubric": [
                "Clear and accurate definition of AI",
                "Two distinct, relevant applications provided",
                "Explanations demonstrate understanding"
            ]
        },
        {
            "text": "Explain the difference between supervised and unsupervised learning with examples.",
            "credit": 5,
            "rubric": [
                "Accurate definition of supervised learning",
                "Accurate definition of unsupervised learning",
                "Clear distinction between the two approaches",
                "Relevant example for supervised learning",
                "Relevant example for unsupervised learning"
            ]
        },
        {
            "text": "Discuss the ethical implications of AI in healthcare, considering both benefits and risks.",
            "credit": 8,
            "rubric": [
                "Identifies multiple benefits of AI in healthcare",
                "Identifies multiple risks/ethical concerns",
                "Discusses privacy and data security issues",
                "Considers bias and fairness in AI systems",
                "Addresses patient autonomy and consent",
                "Proposes balanced approach or solutions",
                "Demonstrates critical thinking",
                "Well-organized and coherent argument"
            ]
        }
    ]
}

@app.on_event("startup")
def on_startup():
    """Initialize database and seed demo data."""
    create_db_and_tables()

    # Seed demo exam if none exists
    with Session(engine) as session:
        existing_exam = session.exec(select(Exam)).first()
        if not existing_exam:
            demo_exam = Exam(**DEMO_EXAM_DATA)
            session.add(demo_exam)
            session.commit()
            print("✓ Demo exam seeded")
        else:
            print("✓ Exam already exists, skipping seed")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Formik | React Hook Form | 2024 | Formik unmaintained; RHF is 3.6x smaller, faster |
| Manual SQLAlchemy + Pydantic | SQLModel | 2021 | Single model definition, less duplication |
| Yup validation | Zod validation | 2023 | Native TypeScript inference, better DX |
| Class-based validators | Pydantic v2 validators | 2023 | Better performance, cleaner syntax |
| @app.on_event() | lifespan context manager | FastAPI 0.93 (2023) | More explicit resource management |

**Deprecated/outdated:**
- **Formik:** No commits in 1+ year, considered unmaintained as of 2026
- **FastAPI startup/shutdown events:** Deprecated in favor of `lifespan` parameter (but still works)
- **SQLAlchemy Core for CRUD:** SQLModel provides simpler API for common operations

## Open Questions

Things that couldn't be fully resolved:

1. **Should we use Alembic migrations for POC?**
   - What we know: `create_all()` works for POC but production needs Alembic
   - What's unclear: At what point in development should we add migrations?
   - Recommendation: Skip for Phase 2 POC; add in Phase 5-6 when stability matters

2. **Nested useFieldArray for rubric points?**
   - What we know: React Hook Form supports nested field arrays
   - What's unclear: Performance implications with 3 questions × N rubric points
   - Recommendation: Start with simple text input for rubric points, optimize if performance issues arise

3. **Client-side vs server-side credit validation?**
   - What we know: Zod validates on client, Pydantic on server
   - What's unclear: Should we use Enum on backend for [2,5,8] constraint?
   - Recommendation: Use both - Zod .refine() on client, Literal[2,5,8] on server for defense in depth

## Sources

### Primary (HIGH confidence)
- [SQLModel Official Documentation](https://sqlmodel.tiangolo.com/) - Model patterns, FastAPI integration
- [React Hook Form Documentation](https://react-hook-form.com/) - API reference, useFieldArray
- [Zod Documentation](https://zod.dev/) - Schema validation, TypeScript inference
- [FastAPI SQLModel Tutorial](https://sqlmodel.tiangolo.com/tutorial/fastapi/) - CRUD patterns, dependency injection
- [FastAPI Lifespan Events](https://fastapi.tiangolo.com/advanced/events/) - Startup/shutdown patterns

### Secondary (MEDIUM confidence)
- [SQLModel JSON Fields Discussion](https://github.com/fastapi/sqlmodel/issues/63) - Community patterns for nested data
- [React Hook Form TypeScript Guide](https://react-hook-form.com/ts) - Type safety patterns
- [FastAPI Database Integration](https://deepwiki.com/fastapi/fastapi/4.2-database-integration) - Best practices compilation
- [Contentful: Zod + React Hook Form](https://www.contentful.com/blog/react-hook-form-validation-zod/) - Integration patterns
- [Database Seeding Gist](https://gist.github.com/jsmsalt/26bf25844870d59eee17997727e3a631) - Practical seeding example

### Tertiary (LOW confidence)
- [FastAPI Performance Mistakes](https://dev.to/igorbenav/fastapi-mistakes-that-kill-your-performance-2b8k) - General pitfalls
- [React Hook Form Common Mistakes](https://daily.dev/blog/react-hook-form-errors-not-working-best-practices) - Troubleshooting guide
- Various Medium articles on SQLModel + FastAPI patterns - Supplementary examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation and current usage verified
- Architecture: HIGH - Patterns from official tutorials and well-established practices
- Pitfalls: MEDIUM - Mix of official docs and community experience
- JSON column approach: MEDIUM - Community solutions, not official SQLModel pattern
- Seeding patterns: MEDIUM - Common practice but limited official guidance

**Research date:** 2026-01-29
**Valid until:** ~30 days (stable ecosystem, no breaking changes expected)
