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
- **Deployment:** Vercel (frontend), Render (backend)

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

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

The app auto-seeds a demo exam on first startup when the database is empty.

## Deployment

### Backend (Render)

1. Create a [Render](https://render.com) account
2. Connect your GitHub repository
3. Render auto-detects `render.yaml` and creates the service
4. Set environment variable `GRADEAI_OPENAI_API_KEY` in Render dashboard (Environment tab)
5. After the frontend deploys (see below), add `GRADEAI_CORS_ORIGINS` with value `["https://your-app.vercel.app"]`
6. Deploy completes automatically

**Notes:**
- Free tier spins down after 15 minutes of inactivity (~30-60s cold start)
- SQLite data resets on each deploy (demo data auto-seeds on startup)
- Service URL will be something like `https://gradeai-api.onrender.com`

### Frontend (Vercel)

1. Create a [Vercel](https://vercel.com) account
2. Import your GitHub repository
3. Set **Root Directory** to `frontend`
4. Framework preset should auto-detect as Vite
5. Add environment variable: `VITE_API_URL` = your Render backend URL (e.g., `https://gradeai-api.onrender.com`)
6. Deploy

### Post-Deploy: Update CORS

After both services are deployed, go back to Render and set:

```
GRADEAI_CORS_ORIGINS=["https://your-app.vercel.app"]
```

Replace with your actual Vercel URL. This triggers a redeploy on Render.

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
