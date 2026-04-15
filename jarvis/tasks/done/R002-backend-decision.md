---
id: R002
title: Phase 2 Architecture Decision: Backend Data Strategy
agent: jarvis-ops
priority: high
status: done
created: 2026-04-14
completed: 2026-04-14
---

## Goal
Decide how R3 will get real risk and visibility data in Phase 2.

## Decision

**Option selected: Plan A — PRAW scraper via self-hosted Python service**

Decision confirmed by owner on 2026-04-14.

## Architecture implications

- Phase 1.5 (current focus): local-first, no backend. All data from Reddit public JSON endpoints.
- Phase 2: self-hosted Python service using PRAW (Python Reddit API Wrapper) for subreddit data scraping.
  - PRAW uses Reddit OAuth at the server level (not per-user).
  - Service exposes a private REST API consumed by the extension.
  - Hosting: TBD (VPS, fly.io, or similar). See R009 for full backend spec.
- Phase 3+: Stripe payment integration, user accounts, cross-device sync.

## Notes
- Not legal advice — verify Reddit ToS compliance with PRAW usage before launch.
- R009 (Phase 2 Backend Design Spec) depends on this decision and can now proceed.
- R010 (Stripe Integration Research) can proceed independently.

## Deliverable
Decision recorded in profile.md and this architecture doc.
