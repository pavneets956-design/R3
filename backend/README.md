# R3 Backend

FastAPI + PRAW backend for R3 Chrome extension Pro features.

## Prerequisites

- Python 3.11+
- A Reddit "script" app (see [Reddit app setup](https://www.reddit.com/prefs/apps))

## Local setup

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env — add your REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Server starts at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

## Test

```bash
pytest -v
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDDIT_CLIENT_ID` | yes | — | Reddit OAuth app client ID |
| `REDDIT_CLIENT_SECRET` | yes | — | Reddit OAuth app secret |
| `REDDIT_USER_AGENT` | no | `r3-backend/0.1` | PRAW user agent |
| `LICENSE_MODE` | no | `stub` | `stub` accepts `DEV_TOKEN`; `live` validates via ExtensionPay |
| `DEV_TOKEN` | no | `dev-token-phase2` | Token accepted in stub mode |
| `CACHE_TTL_RISK` | no | `300` | Risk score cache TTL in seconds |
| `CACHE_TTL_POST_STATUS` | no | `120` | Post status cache TTL in seconds |
| `CORS_ORIGINS` | no | `*` | Comma-separated allowed CORS origins |

## curl examples

```bash
# Health
curl http://localhost:8000/health

# License
curl -H "Authorization: Bearer dev-token-phase2" http://localhost:8000/api/v1/license

# Post status
curl -H "Authorization: Bearer dev-token-phase2" \
  "http://localhost:8000/api/v1/post-status?post_id=abc123&subreddit=learnprogramming"

# Risk
curl -X POST http://localhost:8000/api/v1/risk \
  -H "Authorization: Bearer dev-token-phase2" \
  -H "Content-Type: application/json" \
  -d '{"subreddit": "learnprogramming", "username": "your_username", "post_type": "text"}'
```

## Deploy to Fly.io

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --no-deploy  # sets up app, use existing fly.toml
fly secrets set REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=... LICENSE_MODE=stub DEV_TOKEN=dev-token-phase2
fly deploy
```

After deploy, update `VITE_BACKEND_URL` in the extension build to point to the Fly.io URL.
