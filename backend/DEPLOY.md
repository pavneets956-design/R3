# Fly.io Deployment

## Prerequisites
- flyctl installed: `curl -L https://fly.io/install.sh | sh`
- Logged in: `fly auth login`

## First deploy
```bash
cd backend
fly launch --name r3-backend --region lax --no-deploy
fly secrets set \
  REDDIT_CLIENT_ID=xxx \
  REDDIT_CLIENT_SECRET=xxx \
  REDDIT_USER_AGENT="R3Extension/1.0" \
  CORS_ORIGINS="chrome-extension://YOUR_EXTENSION_ID"
fly deploy
```

## Subsequent deploys
```bash
fly deploy
```

## Verify
```bash
fly status
fly logs
curl https://r3-backend.fly.dev/health
```

## Environment variables

### Secrets (set via `fly secrets set`)
| Variable | Description |
|---|---|
| `REDDIT_CLIENT_ID` | Reddit OAuth app client ID |
| `REDDIT_CLIENT_SECRET` | Reddit OAuth app secret |
| `REDDIT_USER_AGENT` | e.g. `R3Extension/1.0` |
| `CORS_ORIGINS` | Comma-separated allowed origins — set to `chrome-extension://YOUR_EXTENSION_ID` in production |

### Non-secrets (set in `fly.toml` `[env]` section)
| Variable | Default in fly.toml | Description |
|---|---|---|
| `LICENSE_MODE` | `live` | Set to `live` to call ExtensionPay; `stub` accepts any key (dev only) |
| `PORT` | `8000` | Internal port — must match `[http_service] internal_port` |

### Optional tuning (non-secrets, set in `[env]` if you want to override)
| Variable | Default | Description |
|---|---|---|
| `CACHE_TTL_RISK` | `300` | Seconds to cache risk responses |
| `CACHE_TTL_POST_STATUS` | `120` | Seconds to cache post-status responses |
| `CACHE_TTL_SUBREDDIT_META` | `3600` | Seconds to cache subreddit metadata |

## Notes
- Cache is in-process (TTLCache in `app/cache.py`) — no Redis required.
- Health check is at `GET /health` — returns `{"status": "ok"}`.
- The app auto-stops when idle (`auto_stop_machines = true`) and wakes on request
  (`auto_start_machines = true`) — cold starts add ~1–2 s latency on the first request.
  Set `min_machines_running = 1` in `fly.toml` if you need zero cold starts.
