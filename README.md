# GradeAI

LLM-powered system for evaluating subjective answers using rubrics and structured reasoning with explainable scoring.

## Features

- **AI-powered grading** with per-question rubric evaluation and explanations
- **Try/Submit flow** — preview AI grades before final submission
- **PDF export** — download grade reports via browser print
- **Auto-seeded demo exam** — works out of the box with AI fundamentals questions

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, shadcn/ui
- **Backend:** FastAPI, SQLModel, SQLite, OpenAI API
- **Deployment:** one VPS with nginx and systemd (see `deploy/`)

## Pilot

The teacher/student pilot API lives under `/api/pilot`; see [backend/PILOT_API.md](backend/PILOT_API.md). The original demo UI is served at `/demo` (student) and `/demo/admin` (admin); the old `/` and `/admin` links redirect there.

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key

### Backend

```bash
cd backend
pip install -r requirements.txt
export GRADEAI_OPENAI_API_KEY=your-key-here
uvicorn app.main:app --reload
```

Backend runs on http://localhost:8000

#### Local (no-LLM) grading model

One of the grading options runs entirely on the server's CPU: `all-MiniLM-L6-v2`,
a 22M-parameter sentence-embedding model that scores rubric coverage by
similarity. It costs nothing per paper and needs no network — but it cannot
explain a grade, and says so.

Vendor the weights (~87MB, gitignored) rather than letting the first request
download them:

```bash
cd backend
.venv/bin/python -c "from sentence_transformers import SentenceTransformer; \
  SentenceTransformer('all-MiniLM-L6-v2').save('models/all-MiniLM-L6-v2')"
```

**On a server, do this at deploy time and then set
`GRADEAI_SBERT_ALLOW_DOWNLOAD=false`**, so a missing copy fails loudly during
deploy instead of depending on the network during a live demo. The model is
loaded at application startup (~5s); with it absent the backend still starts
normally and that one model simply reports `available: false`. See
`backend/.env.example` for every related setting.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

The app auto-seeds a demo exam on first startup when the database is empty.

## Deployment

BlinkScore runs on one VPS behind nginx at https://blinkscore.in. The systemd unit, nginx site,
settings template, backup cron and `deploy.sh` are in [`deploy/`](deploy/), with step-by-step
instructions in [`deploy/README.md`](deploy/README.md). The Render/Vercel setup (`render.yaml`)
is from the earlier demo and is no longer used.

## Environment Variables

| Variable | Platform | Required | Description |
|----------|----------|----------|-------------|
| `GRADEAI_OPENAI_API_KEY` | Render | Yes | OpenAI API key for AI grading |
| `GRADEAI_CORS_ORIGINS` | Render | Yes | JSON array of allowed frontend origins |
| `GRADEAI_DATABASE_URL` | Render | No | SQLite URL (defaults to `sqlite:///./data.db`) |
| `VITE_API_URL` | Vercel | Yes | Backend API URL for frontend API calls |

## Project Structure

```
GradeAI/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── config.py       # Settings with env var support
│   │   ├── main.py         # FastAPI app, CORS, routers
│   │   ├── database.py     # SQLite + SQLModel setup
│   │   ├── seed.py         # Demo exam auto-seed
│   │   ├── models/         # SQLModel data models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── routers/        # API route handlers
│   │   └── services/       # Business logic (grading)
│   └── requirements.txt
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/     # Shared UI components (shadcn/ui)
│   │   └── features/       # Feature modules (admin, student)
│   ├── index.html
│   └── package.json
├── render.yaml        # Render service configuration
└── README.md
```
