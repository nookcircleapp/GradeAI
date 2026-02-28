# Phase 5: Deploy using MCP AI Service - Research

**Researched:** 2026-03-01
**Domain:** Deployment (Vercel + Render)
**Confidence:** HIGH

## Summary

Phase 5 deploys the GradeAI full-stack application to production. The frontend (Vite + React) deploys to Vercel via their zero-config framework detection. The backend (FastAPI + SQLite) deploys to Render as a free-tier web service. Both platforms support auto-deploy from the main branch.

The main code changes required are: (1) fix a hardcoded `localhost:8000` health check URL in App.tsx to use the `VITE_API_URL` env var, (2) make CORS configurable for the production frontend URL, (3) update the HTML title from "frontend" to "GradeAI", and (4) add deployment documentation to the README.

**Primary recommendation:** Minimal code changes (env var fixes, CORS), platform configuration via render.yaml and vercel.json, comprehensive README deployment section.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Frontend hosted on **Vercel** (free tier, auto-deploy from main branch)
- Backend hosted on **Render** (free tier web service, auto-deploy from main branch)
- Default platform URLs are fine (no custom domain needed)
- Cold starts on Render free tier are acceptable for this demo/hobby project
- Keep **SQLite** -- no migration to Postgres
- Data resets on every deploy (ephemeral filesystem on Render) -- acceptable for demo
- App **auto-seeds demo exam data** on startup when database is empty
- No need to commit SQLite file to git
- OpenAI API key set via **Render environment variables** (GRADEAI_OPENAI_API_KEY)
- Frontend backend URL set via **Vercel build-time env var** (VITE_API_URL)
- Add **Deployment section to README** with env vars and setup steps for both platforms

### Claude's Discretion
- CORS configuration approach (env var vs wildcard -- practical choice for demo)
- Render service configuration (start command, build command, Python version)
- Vercel build configuration (framework preset, output directory)
- Any Dockerfile or render.yaml setup if needed

### Deferred Ideas (OUT OF SCOPE)
- Custom domain setup -- can be added later without code changes
- Persistent database (Postgres) -- only needed if data persistence becomes important
- CI/CD pipeline with test gates -- overkill for current project size
- User-provided API key (frontend input) -- alternative if server-side key isn't desired
</user_constraints>

## Standard Stack

### Core
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| Vercel | Frontend hosting | Zero-config Vite/React deployment, free tier, auto-deploy |
| Render | Backend hosting | Free Python web service, auto-deploy, env var support |
| render.yaml | Render service config | Declarative service definition, committed to repo |
| vercel.json | Vercel project config | Override settings (root directory, framework), committed to repo |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| VITE_API_URL env var | Frontend -> backend URL | Already implemented in API files, needs Vercel env config |
| GRADEAI_CORS_ORIGINS env var | CORS whitelist | Allow Vercel frontend domain in production |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| render.yaml | Render dashboard manual config | render.yaml is reproducible and version-controlled |
| CORS env var | Wildcard `*` CORS | Wildcard is simpler but less secure; env var is minimal effort |

## Architecture Patterns

### Monorepo with Subdirectory Deploys
```
GradeAI/
├── frontend/          # Deployed to Vercel (root directory override)
├── backend/           # Deployed to Render (root directory in render.yaml)
├── render.yaml        # Render service definition (repo root)
├── vercel.json        # Vercel project config (repo root)
└── README.md          # Deployment instructions
```

Both Vercel and Render support monorepo deploys where you specify which subdirectory contains the app. Vercel uses `vercel.json` or project settings to set the root directory. Render uses the `rootDir` field in `render.yaml`.

### Pattern 1: Environment-Based CORS
**What:** Parse CORS origins from environment variable, fall back to localhost defaults
**When to use:** When the same backend serves different frontend URLs across environments
**Example:**
```python
# config.py
cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]
# GRADEAI_CORS_ORIGINS env var overrides in production
# Set to: '["https://your-app.vercel.app"]'
```

pydantic-settings supports JSON-encoded list values via environment variables. Set `GRADEAI_CORS_ORIGINS='["https://gradeai.vercel.app"]'` and it parses automatically.

### Pattern 2: Render Free Tier with SQLite
**What:** Ephemeral filesystem means SQLite data resets on each deploy/restart
**When to use:** Demo apps where data persistence isn't required
**Key detail:** The auto-seed on startup (`seed_demo_exam`) already handles this -- fresh database gets populated automatically. This is already implemented.

### Anti-Patterns to Avoid
- **Hardcoded URLs in frontend code:** App.tsx health check uses `localhost:8000` directly instead of `VITE_API_URL`. Must fix.
- **Committing SQLite to git:** The `.gitignore` should exclude `*.db`, `*.db-shm`, `*.db-wal` files.
- **Forgetting build command for Render:** Python doesn't have an obvious "build" step, but `pip install -r requirements.txt` must be the build command.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS config parsing | Custom env var parser | pydantic-settings JSON list support | Already handles list[str] from env |
| Render service config | Manual dashboard setup | render.yaml | Reproducible, version-controlled |
| Frontend env vars | Runtime API config | Vite build-time env vars (VITE_*) | Already implemented, just needs Vercel config |

## Common Pitfalls

### Pitfall 1: Hardcoded localhost URLs
**What goes wrong:** Frontend works locally but fails in production because URLs point to localhost
**Why it happens:** Health check in App.tsx uses hardcoded `http://localhost:8000/health`
**How to avoid:** Use the same `VITE_API_URL` pattern already used in admin/student API files
**Warning signs:** Network errors in browser console on deployed site

### Pitfall 2: CORS blocking in production
**What goes wrong:** Frontend gets CORS errors when calling the backend API
**Why it happens:** Backend only allows localhost origins, not the Vercel deployment URL
**How to avoid:** Make CORS origins configurable via `GRADEAI_CORS_ORIGINS` env var on Render
**Warning signs:** "Access-Control-Allow-Origin" errors in browser console

### Pitfall 3: Render start command
**What goes wrong:** Render doesn't know how to start the FastAPI app
**Why it happens:** No Procfile or render.yaml specifying the start command
**How to avoid:** Specify `uvicorn app.main:app --host 0.0.0.0 --port $PORT` in render.yaml
**Warning signs:** Deployment succeeds but service shows as "No open ports detected"

### Pitfall 4: Vercel root directory
**What goes wrong:** Vercel tries to build from repo root instead of frontend/ subdirectory
**Why it happens:** Monorepo structure requires explicit root directory configuration
**How to avoid:** Set root directory to `frontend` in vercel.json or project settings
**Warning signs:** Build fails with "vite: command not found" or missing package.json

### Pitfall 5: SQLite path on Render
**What goes wrong:** Database file created in wrong location or permission errors
**Why it happens:** Relative path `sqlite:///./data.db` resolves relative to CWD
**How to avoid:** Ensure the start command runs from the backend/ directory, or use `/tmp/data.db` for clarity
**Warning signs:** Database creation errors in Render logs

## Code Examples

### render.yaml (Render service definition)
```yaml
services:
  - type: web
    name: gradeai-api
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: GRADEAI_OPENAI_API_KEY
        sync: false  # Must be set manually in dashboard
      - key: GRADEAI_CORS_ORIGINS
        value: '["https://gradeai.vercel.app"]'  # Update after Vercel deploy
      - key: GRADEAI_DATABASE_URL
        value: sqlite:///./data.db
```

### vercel.json (Vercel project config)
```json
{
  "framework": "vite",
  "outputDirectory": "dist"
}
```
Note: Root directory (`frontend`) is set in Vercel project settings, not vercel.json.

### Fix: App.tsx health check
```typescript
// Before (hardcoded):
fetch('http://localhost:8000/health')

// After (env-aware):
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
fetch(`${API_BASE_URL}/health`)
```

### Fix: HTML title
```html
<!-- Before -->
<title>frontend</title>
<!-- After -->
<title>GradeAI</title>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Heroku free tier | Render free tier | 2022 (Heroku removed free tier) | Render is the standard free Python hosting |
| Manual deploys | Git push auto-deploy | Standard since ~2020 | Both Vercel and Render auto-deploy from main |
| Runtime env vars in frontend | Build-time VITE_* vars | Vite standard | Env vars baked into static JS at build time |

## Open Questions

1. **Exact Vercel deployment URL**
   - What we know: Vercel generates a URL like `project-name.vercel.app`
   - What's unclear: Exact URL depends on project name chosen during deploy
   - Recommendation: Deploy frontend first, then set CORS on Render with the actual URL

2. **Render free tier cold start time**
   - What we know: Free tier spins down after 15 minutes of inactivity
   - What's unclear: Exact cold start time (typically 30-60 seconds)
   - Recommendation: Acceptable per user decision; no action needed

## Sources

### Primary (HIGH confidence)
- Project codebase analysis (config.py, main.py, App.tsx, API files)
- Render documentation (render.yaml specification)
- Vercel documentation (monorepo deployment, vite framework support)

### Secondary (MEDIUM confidence)
- pydantic-settings JSON list parsing from env vars (verified in codebase usage)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vercel and Render are well-established, straightforward deployment
- Architecture: HIGH - Monorepo subdirectory deploys are standard on both platforms
- Pitfalls: HIGH - Common issues identified from codebase analysis

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable deployment platforms, unlikely to change)
