# Phase 5: Deploy using MCP AI Service - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the GradeAI full-stack application to production. Frontend on Vercel, backend on Render (free tier). Configure environment variables, CORS, and auto-seed for zero-maintenance demo deployment. Add deployment documentation to README.

</domain>

<decisions>
## Implementation Decisions

### Deployment platform
- Frontend hosted on **Vercel** (free tier, auto-deploy from main branch)
- Backend hosted on **Render** (free tier web service, auto-deploy from main branch)
- Default platform URLs are fine (no custom domain needed)
- Cold starts on Render free tier are acceptable for this demo/hobby project

### Database strategy
- Keep **SQLite** — no migration to Postgres
- Data resets on every deploy (ephemeral filesystem on Render) — acceptable for demo
- App **auto-seeds demo exam data** on startup when database is empty
- No need to commit SQLite file to git

### Environment & secrets
- OpenAI API key set via **Render environment variables** (GRADEAI_OPENAI_API_KEY)
- Frontend backend URL set via **Vercel build-time env var** (VITE_API_URL)
- Add **Deployment section to README** with env vars and setup steps for both platforms

### Claude's Discretion
- CORS configuration approach (env var vs wildcard — practical choice for demo)
- Render service configuration (start command, build command, Python version)
- Vercel build configuration (framework preset, output directory)
- Any Dockerfile or render.yaml setup if needed

</decisions>

<specifics>
## Specific Ideas

- This is a hobby/portfolio project — zero cost is the priority
- Auto-deploy from main branch on both platforms (push to deploy)
- Auto-seed ensures the app works immediately after deploy without manual DB setup

</specifics>

<deferred>
## Deferred Ideas

- Custom domain setup — can be added later without code changes
- Persistent database (Postgres) — only needed if data persistence becomes important
- CI/CD pipeline with test gates — overkill for current project size
- User-provided API key (frontend input) — alternative if server-side key isn't desired

</deferred>

---

*Phase: 05-deploy-using-mcp-ai-service*
*Context gathered: 2026-02-28*
