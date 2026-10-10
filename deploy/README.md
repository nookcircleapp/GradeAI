# Deploying BlinkScore to the VPS

This puts the whole app (old demo at `/demo`, the pilot at `/`, `/t`, `/w/CODE`) on one Ubuntu
VPS behind nginx, at https://blinkscore.in. Everything lives under `/srv/blinkscore`:

```
/srv/blinkscore/
  app/              git checkout of this repo (owned by the blinkscore user)
  venv/             Python virtualenv
  www/              built frontend that nginx serves
  data/             data.db, backups/, S-BERT weights   <- the only thing worth backing up
  blinkscore.env    settings and secrets (not in git)
```

The files in this folder:

| File | Goes to |
|---|---|
| `blinkscore.service` | `/etc/systemd/system/blinkscore.service` |
| `nginx-blinkscore.conf` | `/etc/nginx/sites-available/blinkscore` |
| `blinkscore.env.example` | template for `/srv/blinkscore/blinkscore.env` |
| `backup-cron` | `/etc/cron.d/blinkscore-backup` |
| `deploy.sh` | run in place for every deploy |

## 0. Look at what runs today

blinkscore.in is already live, but how it was set up is not written down. Before changing
anything, note the current setup so it can be stopped cleanly and restored if needed:

```bash
ps aux | grep -E 'uvicorn|gunicorn|fastapi' | grep -v grep   # the API process and its folder
systemctl list-units --type=service | grep -iE 'grade|blink|uvicorn'
pm2 ls 2>/dev/null; screen -ls 2>/dev/null; tmux ls 2>/dev/null
ls -l /etc/nginx/sites-enabled/ && sudo nginx -T | grep -nE 'server_name|root|proxy_pass'
```

Find the live `data.db` (usually `backend/data.db` next to where uvicorn runs) and the live
`backend/.env`. You will copy both in step 3.

## 1. One-time server setup

```bash
sudo apt update
sudo apt install -y git python3 python3-venv sqlite3 nginx certbot python3-certbot-nginx curl
# Node 22 for the frontend build (skip if `node -v` already shows 20+)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

sudo useradd --system --home /srv/blinkscore --shell /usr/sbin/nologin blinkscore
sudo mkdir -p /srv/blinkscore/data/backups
sudo chown -R blinkscore:blinkscore /srv/blinkscore
sudo -u blinkscore -H git clone https://github.com/nookcircleapp/GradeAI.git /srv/blinkscore/app
```

If the repo is private, add a read-only deploy key first: `sudo -u blinkscore -H ssh-keygen -t ed25519`,
paste `/srv/blinkscore/.ssh/id_ed25519.pub` into GitHub → repo Settings → Deploy keys,
and clone `git@github.com:nookcircleapp/GradeAI.git` instead.

## 2. Settings

```bash
sudo cp /srv/blinkscore/app/deploy/blinkscore.env.example /srv/blinkscore/blinkscore.env
sudo nano /srv/blinkscore/blinkscore.env
sudo chown root:blinkscore /srv/blinkscore/blinkscore.env && sudo chmod 640 /srv/blinkscore/blinkscore.env
```

Copy the OpenAI key, Groq key and admin token from the live `backend/.env`. Set a **new, long**
`GRADEAI_ADMIN_TOKEN` (the current one is weak) and a pilot admin email and password.
Leave the Google lines empty until step 5; until then teachers sign in with passwords.

## 3. Bring the live data over

```bash
# stop the old API (however step 0 showed it runs), then:
sudo cp /path/to/live/backend/data.db /srv/blinkscore/data/data.db
sudo cp -r /path/to/live/backend/models /srv/blinkscore/data/models   # S-BERT weights, if present
sudo chown -R blinkscore:blinkscore /srv/blinkscore/data
```

The pilot only adds new `pilot_*` tables on first start; existing BlinkScore exams and submissions
are untouched. If there are no S-BERT weights to copy, download them once:

```bash
sudo -u blinkscore -H /srv/blinkscore/venv/bin/python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2').save('/srv/blinkscore/data/models/all-MiniLM-L6-v2')"
```

(Run it after step 4 has created the venv, or set `GRADEAI_SBERT_ENABLED=false` to skip the local scorer.)

## 4. Install the service and site, then deploy

```bash
cd /srv/blinkscore/app
sudo cp deploy/blinkscore.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable blinkscore
sudo cp deploy/nginx-blinkscore.conf /etc/nginx/sites-available/blinkscore
sudo rm -f /etc/nginx/sites-enabled/<old-site-from-step-0>
sudo ln -sf /etc/nginx/sites-available/blinkscore /etc/nginx/sites-enabled/blinkscore
sudo cp deploy/backup-cron /etc/cron.d/blinkscore-backup

sudo deploy/deploy.sh origin/main          # or a branch/commit, e.g. origin/claude/project-thread-iyzkrg
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d blinkscore.in -d www.blinkscore.in   # HTTPS; skip if the old site's certificate already covers it and certbot offers to reinstall
```

Check: https://blinkscore.in shows the code entry page, `/t` shows the teacher sign-in,
`/demo` shows the old BlinkScore. Sign in at `/t` with the bootstrap admin, then add
teachers on the Teachers page.

## 5. Google sign-in for teachers

1. https://console.cloud.google.com → create a project "BlinkScore" (keep it separate from other projects).
2. APIs & Services → OAuth consent screen → External; app name BlinkScore, support email; publish ("In production").
3. Credentials → Create credentials → OAuth client ID → Web application.
   Authorised redirect URI: `https://blinkscore.in/api/pilot/auth/google/callback`
4. Put the client ID and secret into `/srv/blinkscore/blinkscore.env`
   (`GRADEAI_PILOT_GOOGLE_CLIENT_ID`, `GRADEAI_PILOT_GOOGLE_CLIENT_SECRET`, with
   `GRADEAI_PILOT_PUBLIC_URL=https://blinkscore.in`), then `sudo systemctl restart blinkscore`.

From then on only emails on the Teachers page can sign in, with Google. Admins can still use their password.

## Every later deploy

```bash
sudo /srv/blinkscore/app/deploy/deploy.sh            # deploys origin/main
```

It backs up the database first, builds, restarts and checks `/health`. Logs: `journalctl -u blinkscore -f`.

## Automatic deploys from GitHub

Every merge to `main` runs the tests and, if they pass, deploys over SSH (the `deploy` job in
`.github/workflows/ci.yml`). It stays switched off until the secrets below exist.

**On the server, once:**

```bash
sudo useradd --create-home --shell /bin/bash deployer
echo 'deployer ALL=(root) NOPASSWD: /srv/blinkscore/app/deploy/deploy.sh origin/main' | sudo tee /etc/sudoers.d/blinkscore-deploy
sudo chmod 440 /etc/sudoers.d/blinkscore-deploy && sudo visudo -c

# A key that can do nothing except run the deploy
ssh-keygen -t ed25519 -N '' -C github-deploy -f ./github-deploy
sudo install -d -m 700 -o deployer -g deployer /home/deployer/.ssh
echo "command=\"sudo /srv/blinkscore/app/deploy/deploy.sh origin/main\",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty $(cat github-deploy.pub)" \
  | sudo tee /home/deployer/.ssh/authorized_keys
sudo chown deployer:deployer /home/deployer/.ssh/authorized_keys && sudo chmod 600 /home/deployer/.ssh/authorized_keys
ssh-keyscan -t ed25519 localhost 2>/dev/null | sed "s/^localhost/blinkscore.in/"   # copy this line for DEPLOY_KNOWN_HOSTS
```

**In GitHub** (repo → Settings → Secrets and variables → Actions → New repository secret):

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | `blinkscore.in` (or the server's IP) |
| `DEPLOY_USER` | `deployer` |
| `DEPLOY_SSH_KEY` | the whole contents of `github-deploy` (the private key) |
| `DEPLOY_KNOWN_HOSTS` | the line printed by `ssh-keyscan` above |

Then delete the key files from the server: `shred -u github-deploy github-deploy.pub`.
If `DEPLOY_HOST` is an IP, use that IP in place of `blinkscore.in` in the `sed` above.

## Rolling back

`deploy.sh` prints the previous commit. To go back to it:

```bash
sudo /srv/blinkscore/app/deploy/deploy.sh <previous-commit>
```

To restore the database too (only if a deploy damaged data):

```bash
sudo systemctl stop blinkscore
sudo -u blinkscore cp /srv/blinkscore/data/backups/data-<stamp>.db /srv/blinkscore/data/data.db
sudo rm -f /srv/blinkscore/data/data.db-wal /srv/blinkscore/data/data.db-shm
sudo systemctl start blinkscore
```

## Notes

- Keep **one** uvicorn worker. Grading jobs run inside the process and SQLite wants a single writer.
- Unfinished grading jobs resume automatically when the service restarts.
- Back up off the server now and then: `scp vps:/srv/blinkscore/data/backups/* ./`.
