# R3 — Reddit Rules & Requirements: Privacy Policy

**Draft prepared by:** JARVIS (jarvis-legal)
**Date:** 2026-04-14
**Status:** DRAFT — review before publishing

Not legal advice. Have a licensed lawyer review this before publishing if you have any questions about compliance. This draft is written to satisfy Chrome Web Store submission requirements for Phase 1 of R3.

---

**Last updated:** [INSERT DATE BEFORE PUBLISHING]
**Extension:** R3 — Reddit Rules & Requirements
**Developer:** Pavneet Singh
**Contact:** pavneets956@gmail.com

---

## What R3 Does

R3 is a browser extension that displays subreddit rules and posting requirements directly on Reddit.com. It helps you see the rules of any subreddit before you post, and in future versions, will detect whether your post was silently removed.

---

## What Data R3 Collects

### Data stored on your device (localStorage / chrome.storage)

R3 stores the following data locally on your device only:

1. **Subreddit notes** — text notes you type about specific subreddits. These are saved in your browser's local storage and never leave your device.
2. **Cached subreddit rules** — rules fetched from Reddit's public API are cached locally to reduce network requests. This cache is stored in your browser and expires on a schedule (see below). It is never sent to any R3 server.
3. **Extension settings and preferences** — your options page settings (e.g., whether the panel is enabled) are stored locally.

### Data R3 reads from Reddit.com pages

R3's content script reads the following from Reddit pages you visit:

- The current subreddit name (from the page URL and DOM)
- Whether a post composer is open (from the DOM)
- Your Reddit username, if visible in the page DOM (used to display it in the panel header — not stored beyond the current session)

This information is used only to determine what to display in the R3 panel. It is not transmitted to any server.

---

## What Data R3 Does NOT Collect

- R3 does not collect any personally identifiable information
- R3 does not transmit any data to R3's servers or any third-party servers (Phase 1 only)
- R3 does not track your browsing history
- R3 does not use cookies
- R3 does not use analytics services
- R3 does not share any data with any third party

---

## How R3 Fetches Subreddit Rules

R3 fetches subreddit rules directly from Reddit's public JSON endpoint (`https://www.reddit.com/r/{subreddit}/about/rules.json`). This is a standard public API endpoint. This network request is made by your browser directly to Reddit — not through any R3 server. Reddit's own Privacy Policy applies to these requests.

---

## Data Retention

- Subreddit notes: stored until you delete them (via the extension panel or by clearing browser extension storage)
- Cached rules: expire automatically based on cache TTL. Cache is cleared when you use the "Clear cache" option in the settings page, or when the extension is uninstalled.
- Session data (username from DOM): not stored between sessions

---

## How to Delete Your Data

1. Open Chrome and go to Settings > Extensions
2. Click "Details" on R3 — Reddit Rules & Requirements
3. Click "Clear storage"

Or remove the extension entirely — all locally stored data is deleted on uninstall.

---

## Permissions R3 Requests

| Permission | Why it is needed |
|---|---|
| `storage` | To save your subreddit notes and cached rules locally |
| Access to `reddit.com` | To inject the R3 panel into Reddit pages you visit, and to fetch subreddit rules from Reddit's public API |

---

## Future Versions (Phase 2 Notice)

A future version of R3 will introduce:
- A backend service for real-time post visibility and removal detection
- A paid Pro tier (payment processed via a third-party payment provider, not handled by R3 directly)

When these features are introduced, this privacy policy will be updated to describe:
- What data is sent to R3's backend
- How it is stored and for how long
- The payment processor used and what data they receive

You will be notified of material changes to this policy via an extension update.

---

## Children's Privacy

R3 is not directed at children under 13 (or the age of digital consent in your jurisdiction). We do not knowingly collect any data from children.

---

## Changes to This Policy

If we make material changes to this policy, we will update the "Last updated" date above. Continued use of R3 after a policy change constitutes acceptance of the new policy.

---

## Contact

If you have questions about this privacy policy, contact:

Pavneet Singh
pavneets956@gmail.com

---

## Hosting Note

Before Chrome Web Store submission, this policy must be hosted at a publicly accessible URL. Suggested locations:
- GitHub Pages: `https://[username].github.io/r3/privacy`
- Vercel/Netlify: `https://r3extension.com/privacy`
- Any static hosting that does not require login to view

The URL must be entered in the Chrome Web Store Developer Dashboard under the extension's listing details.
