# Architecture Patterns: AI-Powered Exam Grading Platform

**Project:** GradeAI
**Domain:** Educational Technology - Exam Grading System
**Stack:** React + FastAPI + SQLite + OpenAI GPT
**Researched:** 2026-01-28
**Confidence:** HIGH

## Executive Summary

GradeAI requires a three-tier architecture with clear separation between presentation (React), business logic (FastAPI), and data persistence (SQLite). The critical architectural challenge is handling asynchronous AI grading operations while maintaining a responsive user experience for both admin and student roles.

**Key Architectural Decisions:**
1. **Backend:** FastAPI with Router-Service-Repository pattern
2. **Frontend:** Feature-based component organization with role-based routing
3. **State Management:** Zustand for global state, Context API for auth
4. **AI Integration:** Background tasks with structured outputs
5. **PDF Generation:** WeasyPrint for HTML-to-PDF conversion

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Admin Portal │  │Student Portal│  │ Shared UI    │      │
│  │ - Exam Mgmt  │  │ - Take Exam  │  │ - Components │      │
│  │ - Grading    │  │ - View Grade │  │ - Auth       │      │
│  │ - Analytics  │  │ - Dashboard  │  │ - Layout     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                     Axios HTTP Client                        │
└────────────────────────────┼────────────────────────────────┘
                             │
                    REST API (JSON)
                             │
┌────────────────────────────┼────────────────────────────────┐
│                      FastAPI Backend                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 API Routers                           │   │
│  │  /auth  /exams  /questions  /submissions  /grades    │   │
│  └─────────┬────────────────────────────────────────────┘   │
│            │                                                 │
│  ┌─────────▼────────────────────────────────────────────┐   │
│  │              Service Layer                            │   │
│  │  - ExamService    - GradingService (OpenAI)          │   │
│  │  - SubmissionService  - PDFService                   │   │
│  └─────────┬────────────────────────────────────────────┘   │
│            │                                                 │
│  ┌─────────▼────────────────────────────────────────────┐   │
│  │           Repository Layer (CRUD)                     │   │
│  │  - ExamRepository  - UserRepository                  │   │
│  │  - SubmissionRepository  - GradeRepository           │   │
│  └─────────┬────────────────────────────────────────────┘   │
│            │                                                 │
└────────────┼─────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────┐
│                  SQLite Database                             │
│  Users | Exams | Questions | Submissions | Grades           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              External Services                               │
│  - OpenAI API (GPT for grading)                             │
│  - WeasyPrint (PDF generation)                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### Frontend Components (React)

#### 1. Feature-Based Organization

Following 2026 React best practices, organize by feature rather than by type:

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.jsx
│   │   │   └── RegisterForm.jsx
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── services/
│   │   │   └── authService.js
│   │   └── context/
│   │       └── AuthContext.jsx
│   │
│   ├── admin/
│   │   ├── components/
│   │   │   ├── ExamCreator/
│   │   │   │   ├── ExamCreator.jsx
│   │   │   │   ├── QuestionEditor.jsx
│   │   │   │   └── RubricBuilder.jsx
│   │   │   ├── GradingDashboard/
│   │   │   │   ├── GradingQueue.jsx
│   │   │   │   ├── SubmissionReview.jsx
│   │   │   │   └── GradeOverride.jsx
│   │   │   └── Analytics/
│   │   │       ├── ExamStatistics.jsx
│   │   │       └── StudentPerformance.jsx
│   │   └── pages/
│   │       ├── ExamsPage.jsx
│   │       ├── GradingPage.jsx
│   │       └── AnalyticsPage.jsx
│   │
│   ├── student/
│   │   ├── components/
│   │   │   ├── ExamTaker/
│   │   │   │   ├── ExamView.jsx
│   │   │   │   ├── QuestionDisplay.jsx
│   │   │   │   └── AnswerInput.jsx
│   │   │   └── Results/
│   │   │       ├── GradeReport.jsx
│   │   │       └── Feedback.jsx
│   │   └── pages/
│   │       ├── DashboardPage.jsx
│   │       ├── TakeExamPage.jsx
│   │       └── ResultsPage.jsx
│   │
│   └── shared/
│       ├── components/
│       │   ├── Layout/
│       │   │   ├── Navbar.jsx
│       │   │   ├── Sidebar.jsx
│       │   │   └── Footer.jsx
│       │   ├── UI/
│       │   │   ├── Button.jsx
│       │   │   ├── Card.jsx
│       │   │   ├── Modal.jsx
│       │   │   └── Loader.jsx
│       │   └── ProtectedRoute.jsx
│       └── hooks/
│           ├── useApi.js
│           └── useNotifications.js
│
├── store/
│   ├── authStore.js         # Zustand store for auth
│   ├── examStore.js         # Zustand store for exam state
│   └── gradingStore.js      # Zustand store for grading state
│
├── services/
│   └── api.js               # Axios configuration
│
├── utils/
│   ├── validation.js
│   └── formatters.js
│
└── App.jsx
```

**Rationale:** This structure keeps related files together, making features easier to understand, modify, and test. Each feature is self-contained with its own components, hooks, and services.

#### 2. Routing Structure with Role-Based Access

```javascript
// App.jsx routing structure
<Routes>
  {/* Public Routes */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />

  {/* Admin Routes - Protected */}
  <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
    <Route path="/admin" element={<AdminLayout />}>
      <Route path="exams" element={<ExamsPage />} />
      <Route path="exams/create" element={<ExamCreator />} />
      <Route path="exams/:id/edit" element={<ExamEditor />} />
      <Route path="grading" element={<GradingPage />} />
      <Route path="grading/:submissionId" element={<SubmissionReview />} />
      <Route path="analytics" element={<AnalyticsPage />} />
    </Route>
  </Route>

  {/* Student Routes - Protected */}
  <Route element={<ProtectedRoute allowedRoles={['student']} />}>
    <Route path="/student" element={<StudentLayout />}>
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="exams/:id" element={<TakeExamPage />} />
      <Route path="results" element={<ResultsPage />} />
      <Route path="results/:submissionId" element={<GradeReport />} />
    </Route>
  </Route>
</Routes>
```

**Implementation Pattern:** Use TanStack Router or React Router v6 with higher-order components (HOC) or layout routes to check permissions before rendering. The `ProtectedRoute` component uses the auth context to verify user roles.

#### 3. State Management Strategy

**Use Zustand (not Redux) for global state:**
- Lightweight (1KB)
- 40%+ adoption in React projects (2026)
- Minimal boilerplate
- Perfect for admin dashboards

**Use Context API for:**
- Authentication state
- Theme/UI preferences
- Infrequently updated data

**Example Zustand Store:**

```javascript
// store/examStore.js
import { create } from 'zustand';

const useExamStore = create((set) => ({
  exams: [],
  currentExam: null,
  isLoading: false,

  setExams: (exams) => set({ exams }),
  setCurrentExam: (exam) => set({ currentExam: exam }),
  setLoading: (loading) => set({ isLoading: loading }),

  addQuestion: (examId, question) => set((state) => ({
    currentExam: {
      ...state.currentExam,
      questions: [...state.currentExam.questions, question]
    }
  }))
}));
```

---

### Backend Architecture (FastAPI)

#### 1. Project Structure - Router-Service-Repository Pattern

```
backend/
├── app/
│   ├── main.py                    # FastAPI app entry point
│   ├── config.py                  # Configuration (env variables)
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py                # Dependencies (DB session, auth)
│   │   └── routers/
│   │       ├── auth.py            # POST /auth/login, /auth/register
│   │       ├── exams.py           # CRUD for exams
│   │       ├── questions.py       # CRUD for questions
│   │       ├── submissions.py     # Submit answers, get results
│   │       ├── grading.py         # Trigger grading, get grades
│   │       └── pdf.py             # Generate PDF reports
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── exam_service.py        # Business logic for exams
│   │   ├── grading_service.py     # OpenAI integration
│   │   ├── submission_service.py  # Handle submissions
│   │   └── pdf_service.py         # WeasyPrint integration
│   │
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── base.py                # Generic CRUD operations
│   │   ├── user_repo.py
│   │   ├── exam_repo.py
│   │   ├── question_repo.py
│   │   ├── submission_repo.py
│   │   └── grade_repo.py
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py                # SQLAlchemy models
│   │   ├── exam.py
│   │   ├── question.py
│   │   ├── submission.py
│   │   └── grade.py
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py                # Pydantic schemas
│   │   ├── exam.py
│   │   ├── question.py
│   │   ├── submission.py
│   │   └── grade.py
│   │
│   ├── core/
│   │   ├── security.py            # JWT, password hashing
│   │   └── database.py            # SQLAlchemy setup
│   │
│   └── utils/
│       ├── openai_prompts.py      # Prompt templates
│       └── validators.py
│
├── tests/
├── alembic/                       # Database migrations
├── requirements.txt
├── .env
└── README.md
```

**Key Benefits:**
- **Routers:** Handle HTTP requests/responses only
- **Services:** Contain business logic, orchestrate repositories
- **Repositories:** Database operations (CRUD), isolated from business logic

This separation enables easier testing, maintenance, and allows business logic changes without touching database code.

#### 2. Database Configuration

```python
# core/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./gradeai.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency for route handlers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

#### 3. Dependency Injection Pattern

```python
# api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import verify_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )
    user_id = verify_token(token)
    if not user_id:
        raise credentials_exception
    # Fetch user from database
    return user

def require_admin(current_user = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
```

---

## Database Schema Design

### Entity-Relationship Diagram (Text)

```
Users
  ├── id (PK)
  ├── email (unique)
  ├── password_hash
  ├── role (admin/student)
  ├── created_at
  └── updated_at

Exams
  ├── id (PK)
  ├── title
  ├── description
  ├── created_by (FK → Users.id)
  ├── duration_minutes
  ├── total_points
  ├── is_published
  ├── created_at
  └── updated_at

Questions
  ├── id (PK)
  ├── exam_id (FK → Exams.id)
  ├── question_text
  ├── question_type (essay/short_answer/mcq)
  ├── points
  ├── order_index
  ├── rubric (JSON - grading criteria)
  └── created_at

Submissions
  ├── id (PK)
  ├── exam_id (FK → Exams.id)
  ├── student_id (FK → Users.id)
  ├── started_at
  ├── submitted_at
  ├── status (in_progress/submitted/graded)
  └── total_score (calculated)

Answers
  ├── id (PK)
  ├── submission_id (FK → Submissions.id)
  ├── question_id (FK → Questions.id)
  ├── answer_text
  └── created_at

Grades
  ├── id (PK)
  ├── answer_id (FK → Answers.id)
  ├── score
  ├── max_score
  ├── feedback (from AI)
  ├── graded_by_ai (boolean)
  ├── reviewed_by (FK → Users.id, nullable)
  ├── created_at
  └── updated_at
```

### Relationships

- **Users → Exams:** One-to-Many (one admin creates many exams)
- **Exams → Questions:** One-to-Many (one exam has many questions)
- **Users → Submissions:** One-to-Many (one student has many submissions)
- **Exams → Submissions:** One-to-Many (one exam has many submissions)
- **Submissions → Answers:** One-to-Many (one submission has many answers)
- **Questions → Answers:** One-to-Many (one question appears in many answers)
- **Answers → Grades:** One-to-One (each answer gets one grade)

### SQLAlchemy Implementation

```python
# models/user.py
from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
from core.database import Base
import enum
from datetime import datetime

class UserRole(enum.Enum):
    ADMIN = "admin"
    STUDENT = "student"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    exams = relationship("Exam", back_populates="creator")
    submissions = relationship("Submission", back_populates="student")
```

```python
# models/exam.py
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from core.database import Base

class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    total_points = Column(Integer, default=0)
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="exams")
    questions = relationship("Question", back_populates="exam", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="exam")
```

```python
# models/question.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
import enum

class QuestionType(enum.Enum):
    ESSAY = "essay"
    SHORT_ANSWER = "short_answer"
    MCQ = "mcq"

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False)
    points = Column(Integer, nullable=False)
    order_index = Column(Integer, nullable=False)
    rubric = Column(JSON)  # Stores grading criteria as JSON
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    exam = relationship("Exam", back_populates="questions")
    answers = relationship("Answer", back_populates="question")
```

```python
# models/submission.py
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum, Float
from sqlalchemy.orm import relationship
import enum

class SubmissionStatus(enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.IN_PROGRESS)
    total_score = Column(Float, nullable=True)

    # Relationships
    exam = relationship("Exam", back_populates="submissions")
    student = relationship("User", back_populates="submissions")
    answers = relationship("Answer", back_populates="submission", cascade="all, delete-orphan")
```

```python
# models/answer.py
from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship

class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    answer_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    submission = relationship("Submission", back_populates="answers")
    question = relationship("Question", back_populates="answers")
    grade = relationship("Grade", back_populates="answer", uselist=False)
```

```python
# models/grade.py
from sqlalchemy import Column, Integer, Float, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship

class Grade(Base):
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True, index=True)
    answer_id = Column(Integer, ForeignKey("answers.id"), nullable=False)
    score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    feedback = Column(Text)  # AI-generated or manual feedback
    graded_by_ai = Column(Boolean, default=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    answer = relationship("Answer", back_populates="grade")
    reviewer = relationship("User")
```

### Database Normalization

The schema is in **3NF (Third Normal Form)**:
- **1NF:** All columns contain atomic values
- **2NF:** No partial dependencies (all non-key attributes depend on the entire primary key)
- **3NF:** No transitive dependencies (non-key attributes don't depend on other non-key attributes)

**Design Rationale:**
- Separate `Answers` from `Grades` to allow for re-grading without losing original answers
- Store rubric as JSON in `Questions` for flexibility in grading criteria
- `reviewed_by` in `Grades` allows admins to review and override AI grades

---

## API Endpoint Design

### RESTful Resource Structure

Following 2026 best practices for FastAPI endpoint design:

#### 1. Authentication Endpoints

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
```

#### 2. Exam Management (Admin)

```
GET    /api/v1/exams              # List all exams (with filters)
POST   /api/v1/exams              # Create new exam
GET    /api/v1/exams/{exam_id}    # Get exam details
PUT    /api/v1/exams/{exam_id}    # Update exam
DELETE /api/v1/exams/{exam_id}    # Delete exam
PATCH  /api/v1/exams/{exam_id}/publish  # Publish exam
```

#### 3. Question Management (Admin)

```
POST   /api/v1/exams/{exam_id}/questions           # Add question to exam
GET    /api/v1/exams/{exam_id}/questions           # List questions
PUT    /api/v1/exams/{exam_id}/questions/{q_id}    # Update question
DELETE /api/v1/exams/{exam_id}/questions/{q_id}    # Delete question
```

#### 4. Submissions (Student)

```
GET    /api/v1/exams/{exam_id}/start              # Start exam (create submission)
POST   /api/v1/submissions/{sub_id}/answers       # Submit answer
PUT    /api/v1/submissions/{sub_id}/answers/{a_id} # Update answer
POST   /api/v1/submissions/{sub_id}/submit        # Finalize submission
GET    /api/v1/submissions/{sub_id}               # Get submission details
GET    /api/v1/submissions                        # List user's submissions
```

#### 5. Grading (Admin + System)

```
POST   /api/v1/submissions/{sub_id}/grade         # Trigger AI grading (background)
GET    /api/v1/submissions/{sub_id}/grades        # Get grading results
PUT    /api/v1/grades/{grade_id}                  # Update/override grade (admin)
GET    /api/v1/grading/queue                      # Get pending submissions (admin)
```

#### 6. PDF Reports

```
GET    /api/v1/submissions/{sub_id}/pdf           # Generate PDF report
GET    /api/v1/exams/{exam_id}/analytics/pdf      # Generate analytics PDF
```

### Example Router Implementation

```python
# api/routers/exams.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from api.deps import get_db, require_admin
from schemas.exam import ExamCreate, ExamUpdate, ExamResponse
from services.exam_service import ExamService

router = APIRouter(prefix="/exams", tags=["exams"])

@router.post("/", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
async def create_exam(
    exam: ExamCreate,
    current_user = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new exam (admin only)"""
    service = ExamService(db)
    return service.create_exam(exam, created_by=current_user.id)

@router.get("/", response_model=List[ExamResponse])
async def list_exams(
    skip: int = 0,
    limit: int = 100,
    is_published: bool = None,
    current_user = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all exams with optional filters"""
    service = ExamService(db)
    return service.get_exams(skip=skip, limit=limit, is_published=is_published)

@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get exam by ID"""
    service = ExamService(db)
    exam = service.get_exam_by_id(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam
```

### Example Service Implementation

```python
# services/exam_service.py
from sqlalchemy.orm import Session
from models.exam import Exam
from schemas.exam import ExamCreate, ExamUpdate
from repositories.exam_repo import ExamRepository

class ExamService:
    def __init__(self, db: Session):
        self.repo = ExamRepository(db)

    def create_exam(self, exam_data: ExamCreate, created_by: int):
        """Create a new exam"""
        exam = Exam(
            title=exam_data.title,
            description=exam_data.description,
            created_by=created_by,
            duration_minutes=exam_data.duration_minutes,
            is_published=False
        )
        return self.repo.create(exam)

    def get_exams(self, skip: int = 0, limit: int = 100, is_published: bool = None):
        """Get list of exams with filters"""
        return self.repo.get_all(skip=skip, limit=limit, is_published=is_published)

    def get_exam_by_id(self, exam_id: int):
        """Get exam by ID"""
        return self.repo.get_by_id(exam_id)
```

---

## OpenAI Integration Architecture

### Grading Service with Structured Outputs

OpenAI's Structured Outputs feature (2026) ensures 100% reliability in matching output schemas - critical for consistent grading.

#### 1. Prompt Structure for Consistent Grading

```python
# utils/openai_prompts.py

GRADING_SYSTEM_PROMPT = """You are an expert educational assessor. Your task is to grade student answers according to a provided rubric.

Key requirements:
1. Follow the rubric criteria exactly
2. Provide scores on the specified scale
3. Give constructive, specific feedback
4. Be consistent across similar answers
5. Identify both strengths and areas for improvement"""

def build_grading_prompt(question: str, rubric: dict, answer: str, max_score: float) -> str:
    """Build a grading prompt with rubric details"""

    rubric_text = format_rubric(rubric)

    return f"""
Grade the following student answer according to the rubric.

QUESTION:
{question}

RUBRIC:
{rubric_text}

Maximum Score: {max_score} points

STUDENT ANSWER:
{answer}

Provide:
1. A score between 0 and {max_score}
2. Detailed feedback explaining the score
3. Specific strengths in the answer
4. Specific areas for improvement
"""

def format_rubric(rubric: dict) -> str:
    """Format rubric criteria as text"""
    criteria = []
    for criterion, details in rubric.items():
        criteria.append(f"- {criterion}: {details['description']} ({details['points']} points)")
    return "\n".join(criteria)
```

#### 2. Structured Output Schema

```python
# services/grading_service.py
from openai import OpenAI
from pydantic import BaseModel
from typing import List

class GradingResult(BaseModel):
    score: float
    feedback: str
    strengths: List[str]
    improvements: List[str]
    rubric_breakdown: dict  # Score per rubric criterion

class GradingService:
    def __init__(self, db: Session):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.db = db

    async def grade_answer(
        self,
        question: str,
        answer: str,
        rubric: dict,
        max_score: float
    ) -> GradingResult:
        """Grade a single answer using OpenAI with structured output"""

        prompt = build_grading_prompt(question, rubric, answer, max_score)

        # Use structured outputs for consistency (100% reliability)
        completion = self.client.beta.chat.completions.parse(
            model="gpt-4o-2024-08-06",  # Or latest model
            messages=[
                {"role": "system", "content": GRADING_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            response_format=GradingResult,
            temperature=0.3  # Lower temperature for consistency
        )

        return completion.choices[0].message.parsed

    async def grade_submission(self, submission_id: int):
        """Grade all answers in a submission"""
        submission = self.db.query(Submission).get(submission_id)

        total_score = 0

        for answer in submission.answers:
            question = answer.question

            # Grade the answer
            result = await self.grade_answer(
                question=question.question_text,
                answer=answer.answer_text,
                rubric=question.rubric,
                max_score=question.points
            )

            # Save grade
            grade = Grade(
                answer_id=answer.id,
                score=result.score,
                max_score=question.points,
                feedback=result.feedback,
                graded_by_ai=True
            )
            self.db.add(grade)
            total_score += result.score

        # Update submission
        submission.total_score = total_score
        submission.status = SubmissionStatus.GRADED
        self.db.commit()

        return submission
```

#### 3. Background Task Integration

```python
# api/routers/grading.py
from fastapi import APIRouter, BackgroundTasks, Depends
from services.grading_service import GradingService

router = APIRouter(prefix="/submissions", tags=["grading"])

@router.post("/{submission_id}/grade")
async def trigger_grading(
    submission_id: int,
    background_tasks: BackgroundTasks,
    current_user = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Trigger AI grading for a submission (runs in background)
    Returns immediately with status 202 Accepted
    """
    service = GradingService(db)

    # Add grading task to background
    background_tasks.add_task(service.grade_submission, submission_id)

    return {
        "message": "Grading started",
        "submission_id": submission_id,
        "status": "processing"
    }
```

**Why Background Tasks:**
- Grading can take 2-30 seconds per answer (OpenAI API latency)
- Don't block the HTTP response
- For small workloads (< 100 submissions), FastAPI's BackgroundTasks is sufficient
- For larger scale, use Celery or ARQ

#### 4. Consistency Best Practices

Based on 2026 research findings:

1. **Use Structured Outputs:** Achieves 100% schema reliability vs ~80% with JSON mode
2. **Lower Temperature:** Use 0.3 or lower for grading tasks
3. **Multiple Runs for Critical Exams:** Average 3 runs to mitigate variance
4. **Detailed Rubrics:** More specific rubrics = more consistent grading
5. **Chain-of-Thought:** Include "explain reasoning step-by-step" in prompt

---

## PDF Generation Architecture

### WeasyPrint vs ReportLab Decision

**Recommendation: WeasyPrint**

**Rationale:**
- Simpler development (HTML/CSS templates vs Python code)
- Better for 90% of use cases (grade reports are static content)
- Good CSS support for styling
- No JavaScript needed for this use case

**When to use ReportLab instead:**
- Complex charts/graphs needed
- Precise positioning required
- Large-scale batch generation (ReportLab is faster)

### PDF Service Implementation

```python
# services/pdf_service.py
from weasyprint import HTML, CSS
from jinja2 import Environment, FileSystemLoader
from pathlib import Path
import os

class PDFService:
    def __init__(self):
        template_dir = Path(__file__).parent.parent / "templates"
        self.env = Environment(loader=FileSystemLoader(template_dir))

    def generate_grade_report(self, submission_id: int, db: Session) -> bytes:
        """Generate PDF grade report for a submission"""

        # Fetch submission with all related data
        submission = db.query(Submission).filter(
            Submission.id == submission_id
        ).first()

        if not submission:
            raise ValueError(f"Submission {submission_id} not found")

        # Prepare data for template
        context = {
            "student_name": submission.student.email,
            "exam_title": submission.exam.title,
            "total_score": submission.total_score,
            "max_score": submission.exam.total_points,
            "percentage": (submission.total_score / submission.exam.total_points) * 100,
            "submitted_at": submission.submitted_at,
            "questions_and_grades": [
                {
                    "question": answer.question.question_text,
                    "answer": answer.answer_text,
                    "score": answer.grade.score,
                    "max_score": answer.grade.max_score,
                    "feedback": answer.grade.feedback
                }
                for answer in submission.answers
            ]
        }

        # Render HTML template
        template = self.env.get_template("grade_report.html")
        html_content = template.render(**context)

        # Convert HTML to PDF
        pdf_bytes = HTML(string=html_content).write_pdf(
            stylesheets=[CSS(string=self._get_pdf_styles())]
        )

        return pdf_bytes

    def _get_pdf_styles(self) -> str:
        """CSS styles for PDF"""
        return """
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: 'Helvetica', sans-serif;
            color: #333;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        .score-summary {
            background-color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .question-block {
            margin: 30px 0;
            padding: 20px;
            border-left: 4px solid #3498db;
        }
        .feedback {
            background-color: #fff8dc;
            padding: 10px;
            margin-top: 10px;
            border-radius: 3px;
        }
        """
```

### HTML Template

```html
<!-- templates/grade_report.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Grade Report - {{ exam_title }}</title>
</head>
<body>
    <h1>Grade Report</h1>

    <div class="score-summary">
        <p><strong>Student:</strong> {{ student_name }}</p>
        <p><strong>Exam:</strong> {{ exam_title }}</p>
        <p><strong>Score:</strong> {{ total_score }} / {{ max_score }} ({{ percentage|round(2) }}%)</p>
        <p><strong>Submitted:</strong> {{ submitted_at.strftime('%Y-%m-%d %H:%M') }}</p>
    </div>

    <h2>Detailed Results</h2>

    {% for item in questions_and_grades %}
    <div class="question-block">
        <h3>Question {{ loop.index }}</h3>
        <p><strong>{{ item.question }}</strong></p>

        <p><em>Your Answer:</em></p>
        <p>{{ item.answer }}</p>

        <p><strong>Score: {{ item.score }} / {{ item.max_score }}</strong></p>

        <div class="feedback">
            <strong>Feedback:</strong>
            <p>{{ item.feedback }}</p>
        </div>
    </div>
    {% endfor %}
</body>
</html>
```

### PDF Endpoint

```python
# api/routers/pdf.py
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from services.pdf_service import PDFService

router = APIRouter(prefix="/submissions", tags=["pdf"])

@router.get("/{submission_id}/pdf")
async def download_grade_report(
    submission_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate and download PDF grade report"""

    # Verify user has access to this submission
    submission = db.query(Submission).get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if current_user.role == "student" and submission.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Generate PDF
    pdf_service = PDFService()
    pdf_bytes = pdf_service.generate_grade_report(submission_id, db)

    # Return as downloadable file
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=grade_report_{submission_id}.pdf"
        }
    )
```

---

## Data Flow Diagrams

### 1. Exam Creation Flow (Admin)

```
Admin Frontend
     │
     │ 1. Create Exam
     ▼
POST /api/v1/exams
     │
     │ 2. Validate & Save
     ▼
ExamService.create_exam()
     │
     │ 3. Insert to DB
     ▼
ExamRepository.create()
     │
     │ 4. Return Exam Object
     ▼
Admin Frontend (displays created exam)
     │
     │ 5. Add Questions (loop)
     ▼
POST /api/v1/exams/{id}/questions
     │
     ▼
QuestionService.add_question()
     │
     ▼
QuestionRepository.create()
     │
     │ 6. Publish Exam
     ▼
PATCH /api/v1/exams/{id}/publish
```

### 2. Student Takes Exam Flow

```
Student Frontend
     │
     │ 1. View Available Exams
     ▼
GET /api/v1/exams?is_published=true
     │
     │ 2. Start Exam
     ▼
GET /api/v1/exams/{id}/start
     │
     │ Creates Submission (status: in_progress)
     ▼
SubmissionService.create_submission()
     │
     │ 3. Display Questions
     ▼
Student Frontend (exam interface)
     │
     │ 4. Submit Answers (per question)
     ▼
POST /api/v1/submissions/{id}/answers
     │ (can submit multiple times - updates answer)
     │
     │ 5. Finalize Submission
     ▼
POST /api/v1/submissions/{id}/submit
     │
     │ Updates status: submitted
     ▼
SubmissionService.finalize_submission()
     │
     │ 6. Notification to Admin
     ▼
Admin Dashboard (grading queue updated)
```

### 3. AI Grading Flow

```
Admin Dashboard
     │
     │ 1. Trigger Grading
     ▼
POST /api/v1/submissions/{id}/grade
     │
     │ 2. Background Task Created
     ▼
BackgroundTasks.add_task(grade_submission)
     │
     │ Returns 202 Accepted immediately
     ▼
Admin Frontend (shows "grading in progress")


[Background Process]
     │
     │ 3. Fetch Submission & Answers
     ▼
GradingService.grade_submission()
     │
     │ 4. For Each Answer:
     │
     ├─► Build Grading Prompt
     │       │
     │       ▼
     │   OpenAI API Call
     │   (Structured Output)
     │       │
     │       │ 5. Receive GradingResult
     │       ▼
     │   Save Grade to DB
     │       │
     └───────┘
     │
     │ 6. Calculate Total Score
     │
     │ 7. Update Submission Status: graded
     ▼
Database Updated
     │
     │ 8. Student Can View Results
     ▼
Student Frontend
GET /api/v1/submissions/{id}
```

### 4. Grade Report PDF Generation Flow

```
Student/Admin Frontend
     │
     │ 1. Request PDF Report
     ▼
GET /api/v1/submissions/{id}/pdf
     │
     │ 2. Verify Access Permissions
     ▼
PDF Router (check user role)
     │
     │ 3. Fetch Submission Data
     ▼
PDFService.generate_grade_report()
     │
     ├─► Query Submission with Joins
     │   (Submission → Answers → Grades → Questions)
     │
     │ 4. Render HTML Template
     ├─► Jinja2 Template Engine
     │   (grade_report.html)
     │
     │ 5. Convert HTML to PDF
     ├─► WeasyPrint.write_pdf()
     │
     │ 6. Return PDF Bytes
     ▼
Response (application/pdf)
     │
     │ 7. Browser Downloads File
     ▼
Student/Admin Downloads PDF
```

---

## Build Order & Dependencies

### Phase 1: Foundation (Week 1)

**Goal:** Set up project structure and basic infrastructure

1. **Backend Setup**
   - Initialize FastAPI project structure
   - Configure SQLAlchemy + SQLite
   - Create database models (all entities)
   - Set up Alembic for migrations
   - Create initial migration

2. **Frontend Setup**
   - Initialize React with Vite
   - Set up folder structure (feature-based)
   - Configure Axios for API calls
   - Set up routing (React Router)

3. **Authentication**
   - Implement JWT auth in backend
   - Create User model and auth endpoints
   - Implement login/register in frontend
   - Set up AuthContext and protected routes

**Dependencies:** None - this is the foundation

---

### Phase 2: Exam Management (Week 2)

**Goal:** Admins can create and manage exams

1. **Backend**
   - Exam CRUD endpoints
   - Question CRUD endpoints (nested under exams)
   - Repository + Service layers for exams
   - Pydantic schemas for validation

2. **Frontend**
   - Admin dashboard layout
   - Exam list page
   - Exam creator component
   - Question editor component
   - Rubric builder component

**Dependencies:** Phase 1 (requires auth and database)

---

### Phase 3: Student Exam Taking (Week 3)

**Goal:** Students can take published exams

1. **Backend**
   - Submission creation endpoint
   - Answer submission endpoints
   - Submission finalization endpoint
   - Get submission details endpoint

2. **Frontend**
   - Student dashboard
   - Available exams list
   - Exam taking interface
   - Answer input components
   - Submit confirmation

**Dependencies:**
- Phase 1 (auth)
- Phase 2 (exams must exist)

---

### Phase 4: AI Grading Integration (Week 4)

**Goal:** Automatic grading of submissions using OpenAI

1. **Backend**
   - OpenAI API integration
   - Grading service with structured outputs
   - Prompt engineering for consistency
   - Background tasks setup
   - Grading trigger endpoint
   - Grade storage

2. **Frontend**
   - Admin grading dashboard
   - Grading queue view
   - Trigger grading button
   - View grading results

**Dependencies:**
- Phase 3 (requires submissions to grade)
- OpenAI API key

---

### Phase 5: Results & Feedback (Week 5)

**Goal:** Students view grades, admins review and override

1. **Backend**
   - Get grades by submission endpoint
   - Update/override grade endpoint (admin)
   - Grade statistics endpoints

2. **Frontend**
   - Student results page
   - Grade report component
   - Feedback display
   - Admin grade review interface
   - Grade override form

**Dependencies:** Phase 4 (requires grades to exist)

---

### Phase 6: PDF Generation (Week 6)

**Goal:** Generate downloadable grade reports

1. **Backend**
   - Install WeasyPrint
   - Create Jinja2 templates
   - Implement PDF service
   - PDF download endpoint

2. **Frontend**
   - Download PDF button on results page
   - Download PDF button on admin dashboard

**Dependencies:** Phase 5 (requires complete grade data)

---

### Phase 7: Analytics & Polish (Week 7)

**Goal:** Admin analytics and UI improvements

1. **Backend**
   - Analytics endpoints (exam statistics, student performance)
   - Bulk operations support

2. **Frontend**
   - Analytics dashboard (charts/graphs)
   - Improved UI/UX
   - Loading states
   - Error handling
   - Notifications/toasts

**Dependencies:** All previous phases

---

## Anti-Patterns to Avoid

### 1. Mixing Business Logic in Routers

**Bad:**
```python
@router.post("/exams")
async def create_exam(exam: ExamCreate, db: Session = Depends(get_db)):
    # Business logic directly in router - BAD!
    if not exam.title:
        raise HTTPException(400, "Title required")
    db_exam = Exam(**exam.dict())
    db.add(db_exam)
    db.commit()
    return db_exam
```

**Good:**
```python
@router.post("/exams")
async def create_exam(exam: ExamCreate, db: Session = Depends(get_db)):
    # Router only handles HTTP concerns
    service = ExamService(db)
    return service.create_exam(exam)
```

### 2. Direct OpenAI Calls in Routers

**Bad:**
```python
@router.post("/grade")
async def grade(submission_id: int):
    # Direct OpenAI call blocks HTTP response - BAD!
    response = openai.chat.completions.create(...)
    return response
```

**Good:**
```python
@router.post("/grade")
async def grade(submission_id: int, background_tasks: BackgroundTasks):
    # Use background task - Good!
    background_tasks.add_task(grading_service.grade_submission, submission_id)
    return {"status": "processing"}
```

### 3. Storing Rubric as String Instead of JSON

**Bad:**
```python
rubric = Column(String)  # "Criterion 1: 10 points, Criterion 2: 5 points"
```

**Good:**
```python
rubric = Column(JSON)  # {"criterion1": {"description": "...", "points": 10}}
```

### 4. Not Using Structured Outputs for Grading

**Bad:**
```python
# Using JSON mode - only ~80% reliable schema matching
response = openai.chat.completions.create(
    response_format={"type": "json_object"}
)
```

**Good:**
```python
# Using Structured Outputs - 100% reliable schema matching
response = openai.beta.chat.completions.parse(
    response_format=GradingResult  # Pydantic model
)
```

### 5. Global State for User in React

**Bad:**
```javascript
// Using Zustand for auth state - overkill and causes unnecessary re-renders
const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user })
}))
```

**Good:**
```javascript
// Using Context API for auth - appropriate for infrequently updated data
const AuthContext = createContext()
```

### 6. Not Separating Answer from Grade

**Bad:**
```python
class Answer(Base):
    answer_text = Column(Text)
    score = Column(Float)  # Mixing answer and grade - BAD!
    feedback = Column(Text)
```

**Good:**
```python
class Answer(Base):
    answer_text = Column(Text)
    # Separate relationship to Grade model
    grade = relationship("Grade", uselist=False)
```

---

## Scalability Considerations

### At Launch (< 100 users)

**Current Architecture is Sufficient:**
- SQLite can handle it
- FastAPI BackgroundTasks work fine
- Single server deployment

**Optimizations:**
- Add database indexes on frequently queried columns
- Use connection pooling (default in SQLAlchemy)

### At Growth (1K-10K users)

**Recommended Changes:**
1. **Database Migration:** SQLite → PostgreSQL
   - Better concurrent write handling
   - Full-text search capabilities
   - Better JSON query support

2. **Async Grading:** BackgroundTasks → Celery + Redis
   - Better task queue management
   - Retry logic
   - Task monitoring

3. **Caching:** Add Redis for:
   - Session management
   - Frequently accessed data (published exams)

4. **File Storage:** Move to S3/cloud storage
   - Store PDFs instead of generating on-demand
   - Store exam attachments

### At Scale (100K+ users)

**Architecture Evolution:**
1. **Microservices:** Separate grading service
2. **Load Balancing:** Multiple FastAPI instances
3. **CDN:** Static assets and PDFs
4. **Database Sharding:** Partition by institution/region
5. **OpenAI Batch API:** For non-urgent grading (cheaper)

---

## Technology Recommendations Summary

| Category | Technology | Version | Rationale |
|----------|-----------|---------|-----------|
| **Backend Framework** | FastAPI | 0.115+ | Modern, async, auto-docs, 300% faster than Flask |
| **ORM** | SQLAlchemy | 2.0+ | De facto standard, great relationship handling |
| **Database** | SQLite | 3.x | Simple for demo, easy migration path to PostgreSQL |
| **Frontend Framework** | React | 18+ | Component-based, huge ecosystem, modern features |
| **Build Tool** | Vite | 6.x | Fast HMR, better than Create React App |
| **State Management** | Zustand | 5.x | Lightweight, 40% adoption, minimal boilerplate |
| **Routing** | React Router | 6.x | Standard routing solution, well-documented |
| **HTTP Client** | Axios | 1.7+ | Better API than fetch, interceptors for auth |
| **AI Provider** | OpenAI | Latest SDK | Structured outputs, best grading performance |
| **PDF Generation** | WeasyPrint | 63+ | HTML/CSS templates, simpler than ReportLab |
| **Authentication** | JWT | - | Stateless, works well with React + FastAPI |
| **API Documentation** | Swagger/OpenAPI | Auto-generated | Built into FastAPI |

---

## Sources & Confidence Assessment

### High Confidence Sources

**FastAPI Architecture:**
- [FastAPI Best Practices GitHub](https://github.com/zhanymkanov/fastapi-best-practices)
- [FastAPI Official Documentation - Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)

**React Architecture:**
- [React Architecture Patterns 2026](https://www.bacancytechnology.com/blog/react-architecture-patterns-and-best-practices)
- [Martin Fowler - Modularizing React Applications](https://martinfowler.com/articles/modularizing-react-apps.html)
- [React-Admin Documentation](https://marmelab.com/react-admin/)

**Database Design:**
- [SQLAlchemy Relationship Patterns](https://docs.sqlalchemy.org/en/20/orm/basic_relationships.html)
- [Grading System Database Model](https://www.inettutor.com/source-code/grading-system-database-model-and-design/)

**OpenAI Integration:**
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Azure OpenAI Automated Grading](https://techcommunity.microsoft.com/blog/educatordeveloperblog/empowering-educators-automated-assignment-scoring-via-azure-openai-service-chatg/3828127)
- [OpenAI Graders Documentation](https://platform.openai.com/docs/guides/graders)

**PDF Generation:**
- [WeasyPrint vs ReportLab Comparison](https://dev.to/claudeprime/generate-pdfs-in-python-weasyprint-vs-reportlab-ifi)
- [Python PDF Generation Libraries 2025](https://templated.io/blog/generate-pdfs-in-python-with-libraries/)

**State Management:**
- [React State Management 2026](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns)
- [Zustand GitHub](https://github.com/pmndrs/zustand)

### Confidence Levels

| Area | Confidence | Justification |
|------|------------|---------------|
| **Backend Architecture** | HIGH | Official FastAPI docs + established patterns |
| **Database Schema** | HIGH | Standard educational platform patterns |
| **OpenAI Integration** | MEDIUM | Structured Outputs is new (2024), less real-world examples |
| **Frontend Architecture** | HIGH | Well-established React patterns for 2026 |
| **PDF Generation** | HIGH | WeasyPrint is mature and well-documented |
| **Build Order** | HIGH | Logical dependency graph based on feature requirements |

---

## Open Questions & Future Research Needs

1. **OpenAI Rate Limits:** Need to test grading throughput with actual API quotas
2. **Database Performance:** Real-world testing needed with 1000+ exams
3. **Prompt Engineering:** May need iteration to achieve desired grading accuracy
4. **PDF Template Design:** Needs UX input for optimal report layout
5. **WebSocket for Real-time:** Consider WebSockets for live grading progress updates

---

## Summary

This architecture provides a solid foundation for GradeAI with:

1. **Clear Separation of Concerns:** Frontend (React) ↔ API (FastAPI) ↔ Database (SQLite)
2. **Scalable Patterns:** Router-Service-Repository, background tasks, structured outputs
3. **Modern Stack:** Leveraging 2026 best practices and tools
4. **Flexible Design:** Easy to extend with new features or migrate components

**Critical Success Factors:**
- Use OpenAI Structured Outputs for consistent grading
- Implement background tasks for AI calls to avoid blocking
- Follow feature-based organization in React
- Maintain clean separation between routers, services, and repositories
- Store rubrics as JSON for flexible grading criteria

**Next Steps:**
1. Set up development environment
2. Implement Phase 1 (Foundation)
3. Create sample exam data for testing
4. Test OpenAI prompts with various answer types
5. Iterate on grading consistency
