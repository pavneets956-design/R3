# R3 JARVIS Roadmap

**Last updated:** 2026-04-15 (R011 backend implementation marked done)
**Project:** R3 Browser Extension

---

## Done

### R001 — Phase 1 Extension Build
**Status:** done
**Completed:** 2026-04-14
**Deliverable:** `dist/` — clean Vite build, 68/68 tests passing, 0 tsc errors
**Notes:** Extension loaded unpacked in Chrome. PR #1 merged to master. All Phase 1 scope shipped: floating panel, subreddit rules (live Reddit JSON), mocked RiskCard + StatusCard (Pro-locked), per-subreddit notes (localStorage), SPA navigation detection, structured logging, options page.

---

### R002 — Phase 2 Architecture Decision: Backend Data Strategy
**Status:** done
**Completed:** 2026-04-14
**Decision:** Plan A — PRAW scraper via self-hosted Python service (FastAPI + PRAW)
**Deliverable:** `jarvis/tasks/done/R002-backend-decision.md` | `jarvis/profile.md §6` updated

---

### R003 — Phase 2 Monetization & Payment Research
**Status:** done
**Completed:** 2026-04-14
**Deliverable:** `jarvis/briefings/2026-04-14-monetization-research.md`
**Key finding:** ExtensionPay (Stripe-backed) recommended for Phase 2 launch. Start with $9.99 one-time lifetime license. Migrate to subscription ($3.99/month) when backend costs justify it.

---

### R004 — Competitor Analysis
**Status:** done
**Completed:** 2026-04-14
**Deliverable:** `jarvis/briefings/2026-04-14-competitor-analysis.md`
**Key finding:** No direct paid competitor exists. RES targets old Reddit. Mod Toolbox targets moderators. Shadowban checkers are free web tools. R3 owns an uncontested niche.

---

### R005 — Chrome Web Store Submission Checklist
**Status:** done
**Completed:** 2026-04-14
**Deliverable:** `jarvis/briefings/2026-04-14-cws-submission-checklist.md`
**Key finding:** Extension is MV3-compliant. Blockers before submission: host privacy policy at public URL, prepare icons at all sizes, take screenshots, create CWS developer account ($5 fee — requires owner auth).

---

### R006 — Landing Page Copy Draft
**Status:** done
**Completed:** 2026-04-14
**Deliverable:** `jarvis/drafts/landing-page-copy.md`
**Notes:** Includes homepage copy, feature pages for 4 SEO landing pages, CWS full description, and FAQ. 69% removal stat needs source verification before publishing.

---

### R007 — Privacy Policy Draft
**Status:** done
**Completed:** 2026-04-14
**Deliverable:** `jarvis/drafts/privacy-policy.md`
**Notes:** CWS-compliant draft covering Phase 1 local-only data. Includes Phase 2 notice. Must be hosted at a public URL before CWS submission.

---

### R008 — Beta User Outreach List
**Status:** done
**Completed:** 2026-04-14
**Deliverable:** `jarvis/leads/beta-testers.md`
**Notes:** Subreddit targeting strategy + community approach. Do not contact anyone without owner authorization. Key communities: r/redditdev, r/chrome_extensions, r/enhancement.

---

### R009 — Phase 2 Backend Design Spec
**Status:** done
**Completed:** 2026-04-14
**Deliverable:** `docs/superpowers/specs/phase2-backend-design.md`
**Notes:** Full API contract (v1), tech stack (FastAPI + PRAW + Redis), hosting rec (Fly.io), rate limit strategy, security notes, implementation sequence.

---

### R010 — Stripe Integration Research
**Status:** done
**Completed:** 2026-04-14
**Deliverable:** `jarvis/briefings/stripe-extension-integration.md`
**Key finding:** ExtensionPay (no backend needed) for Phase 2 launch. Migrate to Stripe direct once PRAW backend is running. Browser-tab redirect pattern is CWS-compliant.

---

### R011 — Phase 2 Backend Implementation
**Status:** done
**Completed:** 2026-04-14
**Deliverable:** `backend/` — FastAPI + PRAW service, 38 tests passing, Fly.io deployment config ready
**Notes:** Implemented per R009 spec. Rate limiting (60 req/min), Redis cache, async endpoints, UUID validation. CORS currently `*` — locked to env var in this session. Reddit OAuth creds and Fly.io deploy still require owner action.

---

### R014 — CWS Listing Description
**Status:** done
**Completed:** 2026-04-15
**Deliverable:** `jarvis/drafts/cws-listing-description.md`
**Notes:** Short description (80 chars, 52 under limit) and full description (~1400 chars) ready for CWS submission form. Adapted from R006 landing page copy; 69% stat excluded per R006 unverified flag. Plain-text format. Support email placeholder needs owner confirmation.

---

## Now — Awaiting Owner Action

### Before Chrome Web Store Submission

The following items require owner action (blocked on owner — not JARVIS):

1. **Icons:** Verify `manifest.json` has icons at 16px, 48px, 128px. Create them if missing.
2. **Screenshots:** Load extension unpacked in Chrome, take 4–5 annotated screenshots. Save to `jarvis/assets/screenshots/`.
3. **Host privacy policy:** Deploy `jarvis/drafts/privacy-policy.md` to a public URL. Options: GitHub Pages, Vercel, Netlify.
4. **CWS developer account:** Create account at chrome.google.com/webstore/devconsole. Pay $5 registration fee (requires owner auth per profile §4).
5. **Verify 69% stat:** The "69% of Reddit post removals are silent" claim in landing page copy needs a primary source before publishing.
6. **Review all drafts:** Landing page copy and privacy policy are drafts — review before any public use.

### Next JARVIS tasks (ready to execute)

No blocked items remain in the roadmap. JARVIS can:
- Draft CWS listing description (adapt from R006 landing page copy)
- Create a permissions-justification doc for CWS reviewer questions
- Research GitHub Pages deployment steps for the privacy policy

---

## Later (30–90 days)

### R012 — Marketing Site Build
**Status:** todo
**Priority:** med
**Depends on:** R006 (landing page copy — done), R007 (privacy policy — done)
**Goal:** Build and deploy the marketing site per Phase 1.5 SEO spec (see design spec §16). Target: Next.js static export or similar. Owner must authorize publish.
**Deliverable:** Deployed site at r3extension.com (or equivalent)

### R013 — Chrome Web Store Submission
**Status:** blocked-on-owner
**Priority:** high
**Blocked on:** Icons, screenshots, hosted privacy policy, CWS developer account, owner authorization
**Goal:** Submit extension to CWS.
**Deliverable:** CWS listing live (requires owner to press submit — JARVIS cannot submit)
