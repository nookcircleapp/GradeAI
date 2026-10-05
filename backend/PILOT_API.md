# Pilot API

The pilot workflow lives under `/api/pilot` beside the original demo API, in its own
`pilot_*` tables. Code: `app/pilot/`. Tests: `pytest tests/test_pilot.py` (uses a fake grader, no API key needed).

## Roles

- **Admin** creates teacher accounts and can see every paper. The first admin is created on
  startup from `GRADEAI_PILOT_BOOTSTRAP_ADMIN_EMAIL` / `_PASSWORD` if no admin exists.
- **Teacher** signs in (HTTP-only session cookie) and manages their own papers.
- **Student** has no account. They open a paper by share code, enter name and roll number,
  and get a receipt token that the browser sends as `X-Receipt` to submit and see results.

## Endpoints

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/api/pilot/auth/login` | anyone | Password sign-in, sets cookie (admins only once Google is on) |
| GET | `/api/pilot/auth/config` | anyone | `{google: bool}`: whether Google sign-in is set up |
| GET | `/api/pilot/auth/google/start?next=/t/...` | anyone | Redirects to Google |
| GET | `/api/pilot/auth/google/callback` | Google | Signs in an approved email, redirects to `next` or `/login?error=...` |
| POST | `/api/pilot/auth/logout` | signed in | Sign out |
| GET | `/api/pilot/auth/me` | signed in | Current account |
| POST | `/api/pilot/auth/password` | signed in | Change own password |
| GET/POST | `/api/pilot/admin/teachers` | admin | List / create accounts |
| PATCH | `/api/pilot/admin/teachers/{id}` | admin | Rename, reset password, disable |
| GET/POST | `/api/pilot/papers` | teacher | List own papers / create |
| GET/PATCH/DELETE | `/api/pilot/papers/{id}` | teacher | Read / edit (questions lock once a student starts) / delete (only without submissions) |
| POST | `/api/pilot/papers/{id}/status` | teacher | `draft` / `open` / `closed` |
| POST | `/api/pilot/papers/{id}/results-released` | teacher | Release results (`results_mode: on_release`) |
| POST | `/api/pilot/papers/{id}/winners-revealed` | teacher | Publish the contest winners page |
| GET | `/api/pilot/papers/{id}/submissions` | teacher | Live record table |
| GET/PATCH/DELETE | `/api/pilot/papers/{id}/submissions/{sid}` | teacher | Detail / review (per-question overrides, note, "AI was fooled") / reset an attempt |
| POST | `/api/pilot/papers/{id}/submissions/{sid}/regrade` | teacher | Re-run AI grading |
| GET | `/api/pilot/papers/{id}/leaderboard` | teacher | Contest ranking |
| GET | `/api/pilot/papers/{id}/export.csv` | teacher | Full record incl. answers, AI and teacher scores |
| GET | `/api/pilot/p/{code}` | student | Paper without rubric or reference answers |
| POST | `/api/pilot/p/{code}/start` | student | Name + roll number, returns receipt; one attempt per roll number |
| POST | `/api/pilot/p/{code}/preview` | student | Try one answer (only if `allow_preview`) |
| POST | `/api/pilot/p/{code}/submit` | student | Submit once; grading runs in the background |
| GET | `/api/pilot/p/{code}/result` | student | Poll for status and, when visible, scores |
| GET | `/api/pilot/p/{code}/winners` | public | Winners page data, once revealed |

## Rules worth knowing

- Paper accepts answers when `status` is `open` and the time is inside `opens_at`/`closes_at`.
- Submit deadline is the earlier of start + `time_limit_minutes` and `closes_at`, plus 2 minutes grace.
- Logins lock for 15 minutes after 10 failed attempts on one email.
- Answers shorter than `GRADEAI_MIN_ANSWER_CHARS` (20) score 0 without a model call; answers are capped at 20,000 characters.
- The contest ranks on the AI score, ties to the earlier submission. Students see the final score
  with any teacher overrides applied.
- Grading uses a fenced, injection-resistant prompt (`app/pilot/grader.py`, version `pilot-v1`),
  goes through the BlinkScore model registry (OpenAI or Groq keys from the main config), strict JSON
  where the provider supports it, retries only transient errors, and stores the raw model reply plus a `suspected_manipulation` flag.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `GRADEAI_PILOT_BOOTSTRAP_ADMIN_EMAIL` / `_PASSWORD` / `_NAME` | empty | First admin account |
| `GRADEAI_PILOT_GOOGLE_CLIENT_ID` / `_SECRET` | empty | Google OAuth web client; with `PUBLIC_URL`, turns on Google sign-in |
| `GRADEAI_PILOT_PUBLIC_URL` | empty | Site origin, e.g. `https://blinkscore.in`; the redirect URI is `{PUBLIC_URL}/api/pilot/auth/google/callback` |
| `GRADEAI_PILOT_APP_URL` | `PUBLIC_URL` | Where to land after sign-in (only differs in local dev) |
| `GRADEAI_PILOT_COOKIE_SECURE` | `true` | Set `false` only for plain-http local dev |
| `GRADEAI_PILOT_SESSION_DAYS` | `7` | Login lifetime |
| `GRADEAI_PILOT_GRADING_MODEL` | `gpt-4o-mini` | Default model id from the BlinkScore registry (`GET /api/models`); a paper can pick any hosted model, not the local MiniLM scorer |
| `GRADEAI_PILOT_GRADING_CONCURRENCY` | `4` | Max simultaneous model calls |
| `GRADEAI_PILOT_GRADING_ATTEMPTS` | `3` | Retries per answer |

The frontend should be served from the same origin as the API (nginx proxying `/api`) so the
session cookie works with `SameSite=Lax`.

## Google sign-in

Teachers sign in with Google once `GRADEAI_PILOT_GOOGLE_CLIENT_ID`, `_SECRET` and `PUBLIC_URL`
are set. Google only proves identity: the email must already be on the Teachers page (added by an
admin) and active, or sign-in is refused with `?error=not_allowed` / `disabled`. Teachers can then no
longer use passwords; admins keep password sign-in as a fallback.

Setup in Google Cloud Console: create a project, configure the OAuth consent screen (External,
scopes `openid email profile`), then Credentials → Create OAuth client ID → Web application, with
authorised redirect URI `https://<site>/api/pilot/auth/google/callback`.
