---
id: R002
title: Phase 2 Architecture Decision — Backend Data Strategy
agent: jarvis-ops
priority: high
status: blocked
created: 2026-04-14
---

## BLOCKED — Decision needed from owner

**Question:** How will R3 get real risk and visibility data in Phase 2?

Three options:

**Option A — Self-hosted PRAW scraper**
- Python service running PRAW to read post/mod log data
- Full control, no third-party dependency
- Requires hosting (VPS or serverless), Reddit API credentials, maintenance burden
- Risk: Reddit rate limits, ToS exposure

**Option B — Third-party Reddit data API**
- Pushshift (currently restricted), Arctic Shift, or similar aggregators
- Faster to integrate, no Reddit account needed
- Risk: service availability, data freshness, cost at scale
- Note: Pushshift access is not publicly open as of early 2026 — verify current status

**Option C — Client-side heuristics only (no backend)**
- Infer removal likelihood from publicly visible signals in the DOM
- Zero infrastructure cost, no ToS exposure
- Accuracy ceiling is lower — no access to mod log data
- Fastest to ship; weakest Pro value proposition

**Recommendation (JARVIS):** Start with Option C to validate the Pro upgrade flow, then layer Option A on top once paying users exist. This avoids infrastructure cost before revenue. But this is your call.

## Goal
Decision recorded in `jarvis/profile.md §6` + brief architecture note appended here.

## To unblock
Reply with your choice (A, B, C, or a hybrid). JARVIS will update the profile, create R009, and proceed with Phase 2 planning.
