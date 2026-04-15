# Chrome Web Store Submission Checklist — R3
**Task:** R005
**Agent:** jarvis-legal
**Date:** 2026-04-14
**Status:** complete

Not legal advice. Verify all items against current Chrome Web Store Program Policies before submission. Policy details from developer.chrome.com/docs/webstore/program-policies.

---

## Pre-Submission Status at 2026-04-14

Phase 1 build is complete. Extension is MV3, TypeScript, React, Vite. This checklist covers what remains before submission.

---

## 1. Manifest V3 Compliance

- [x] `"manifest_version": 3` — confirmed in R3's manifest.json
- [x] Uses `background.service_worker`, not persistent background page
- [x] No `background.persistent: true`
- [x] Permissions declared: `["storage"]` — minimal and appropriate
- [x] Host permissions: `["https://www.reddit.com/*"]` — scoped, not `<all_urls>`
- [ ] **ACTION: Verify no `eval()` or `new Function()` calls in built output** — MV3 bans remote code execution. Run `grep -r "eval(" dist/` after build.
- [ ] **ACTION: Verify no external script tags or dynamically fetched scripts** — all JS must be bundled in the package
- [ ] **ACTION: Check that Vite build does not produce obfuscated/minified code that triggers CWS review** — minification is fine; obfuscation (variable name mangling to single chars) can trigger flags. Consider setting `build.minify: 'esbuild'` without aggressive obfuscation.

---

## 2. Permissions Justification

CWS reviewers require that every permission requested is necessary and used. Document your justification before submission:

| Permission | Justification |
|---|---|
| `storage` | Persists subreddit notes and cached rules data to localStorage/chrome.storage |
| `https://www.reddit.com/*` | Content script must inject panel into Reddit pages; rules fetched from reddit.com/r/{sub}/about/rules.json |

- [ ] **ACTION: Add a permissions justification file** (`jarvis/briefings/permissions-justification.md`) in case CWS reviewer asks — not required to submit but speeds up appeals.
- [ ] **ACTION: Confirm `content_scripts` matches directive** — current manifest uses `"run_at": "document_idle"` which is correct.

---

## 3. Privacy Policy (REQUIRED for submission)

CWS requires a publicly hosted privacy policy URL if the extension handles any user data. R3 stores data in localStorage — this counts as user data.

- [ ] **ACTION: Draft privacy policy** (R007 — in progress via jarvis-legal)
- [ ] **ACTION: Host privacy policy at a public URL before submission** — must be accessible without login
  - Options: GitHub Pages, Vercel, Netlify, or a simple static page
  - Suggested URL pattern: `https://r3extension.com/privacy` or `https://[your-github-username].github.io/r3/privacy`
- [ ] **ACTION: Privacy policy URL must be entered in the CWS Developer Dashboard** at submission time

**What the policy must cover (based on CWS requirements):**
- What data is collected (subreddit notes, cached rules — locally only)
- How data is used
- How data is stored (localStorage, chrome.storage — device only, no server)
- No server transmission in Phase 1 — state this explicitly
- Future Phase 2 data flows (advisory — disclose that backend will be added)
- User deletion instructions (clear extension data via Chrome settings)

---

## 4. Store Listing Assets Required

All assets must be prepared before submission. CWS will reject submissions with missing or low-quality assets.

### Icons

| Size | Required | Status |
|---|---|---|
| 16x16 PNG | Yes | [CHECK: does dist/ or src/ contain this?] |
| 32x32 PNG | Optional but recommended | — |
| 48x48 PNG | Yes | [CHECK] |
| 128x128 PNG | Yes (store listing) | [CHECK] |

- [ ] **ACTION: Confirm icon files exist at all required sizes in manifest.json `icons` field**
- [ ] **ACTION: Icons must be PNG, no transparency issues on white or dark backgrounds**

### Screenshots

CWS requires at least 1 screenshot; recommends 4–5.

| Screenshot | Recommended content |
|---|---|
| 1 | Extension panel open on a subreddit — rules visible, clean UI |
| 2 | Panel in post-compose context — RiskCard visible (even if mocked, label it "coming soon") |
| 3 | Notes field with a user note saved |
| 4 | Options page |
| 5 | Before/after — sidebar buried vs. R3 panel surfaced |

- Dimensions: 1280x800 or 640x400 (CWS accepts both)
- Format: PNG or JPEG
- No device frames required but recommended for context
- No misleading annotations — show what the extension actually does in Phase 1

- [ ] **ACTION: Take screenshots with the extension loaded unpacked in Chrome (confirmed working)**
- [ ] **ACTION: Store screenshots in `jarvis/assets/screenshots/` for review before upload**

### Promotional images (optional but helps visibility)

- Small tile: 440x280 PNG
- Marquee: 1400x560 PNG

These are optional but improve CWS listing presentation if R3 is ever featured.

---

## 5. Store Listing Text

### Extension name

Current: `"R3 — Reddit Rules & Requirements"`

CWS rules: name must match what the extension actually does. No keyword stuffing in the name field. This name is compliant.

### Short description (132 characters max)

Current: `"See subreddit rules and post intelligence before you submit."`
Length: 60 chars — within limit. Compliant.

- [ ] **ACTION: Consider A/B testing descriptions after launch. Short desc should include at least one keyword naturally.**
- Suggested alternative: `"See subreddit rules before you post. Know if your post was removed. Works on New Reddit."`

### Full description (no hard limit, but 4000 chars recommended)

Must cover:
- What the extension does
- Who it is for
- What data it accesses and why (reinforces privacy policy)
- Honest statement about Pro features being "coming soon"
- No false claims about features not yet live

- [ ] **ACTION: Write full description draft** (see R006 for landing page copy — same tone, adapt for CWS format)

---

## 6. Review Gotchas Specific to Reddit Extensions

Based on developer community reports and CWS policy documentation [UNVERIFIED for all items below — verify before relying on]:

**Known issues with Reddit-targeting extensions:**

1. **Host permission scrutiny:** `https://www.reddit.com/*` is a specific, scoped host permission — this is correct and should not trigger broad-permission flags. Avoid ever adding `<all_urls>`.

2. **Content script injection:** Extensions that inject UI into third-party sites receive closer review. Be prepared to explain exactly what R3 injects and why.

3. **User data handling:** If you mention anything about "detecting removals" or "monitoring posts", reviewers may ask for additional privacy policy detail. Ensure your privacy policy explicitly covers what data R3 reads from the Reddit page and what it stores.

4. **Mocked features:** Do not describe mocked Pro features as if they are live. The RiskCard and StatusCard must be described as "coming soon" or "Pro — available in Phase 2". Misrepresenting extension capabilities is grounds for rejection.

5. **No remote code:** Vite's bundled output should be clean. Verify with `grep -r "chrome.tabs.executeScript\|eval(" dist/`.

---

## 7. Developer Account Requirements

- [ ] **ACTION: Create a Google developer account for the CWS at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)**
- [ ] **ACTION: Pay the one-time $5 developer registration fee** (requires owner authorization per profile §4 — red line: spending money)
- [ ] **ACTION: Set up 2FA on the developer account** — required by Google

---

## 8. Review Timeline Expectations

| Account type | Expected review time |
|---|---|
| New developer account, first submission | 7–14 business days |
| Established account | 2–5 business days |

Plan for 14 business days worst case for the initial submission. Rejections add another full cycle.

---

## 9. Pre-Submission Build Checklist

Before packaging:

- [ ] Run `npm run build` and confirm clean output in `dist/`
- [ ] Run `npm test` — all 68 tests pass
- [ ] Run `tsc --noEmit` — 0 errors
- [ ] Load `dist/` as unpacked extension in Chrome — panel appears on reddit.com
- [ ] Verify panel appears and rules load for at least 3 different subreddits
- [ ] Verify notes persist after page reload
- [ ] Verify options page opens and functions
- [ ] Package: zip the `dist/` folder contents (not the folder itself — zip the files inside it)

---

## 10. Post-Submission

- [ ] Set up support email address and link it in the developer dashboard
- [ ] Monitor developer dashboard for reviewer questions (Google sometimes asks for clarification before deciding)
- [ ] If rejected: read the rejection reason carefully. Most first-rejection reasons are fixable within 1–2 hours of work. Do not resubmit without addressing the stated reason.

---

## Sources

- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies)
- [CWS Privacy Policies policy page](https://developer.chrome.com/docs/webstore/program-policies/privacy)
- [Updated Privacy Policy & Secure Handling Requirements](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Web Store review process](https://developer.chrome.com/docs/webstore/review-process)
- [Troubleshooting CWS violations](https://developer.chrome.com/docs/webstore/troubleshooting)
- [Why Chrome extensions get rejected — ExtensionRadar](https://www.extensionradar.com/blog/chrome-extension-rejected)
- [The Ultimate Chrome Extension Pre-Submission Checklist (2026) — AppBooster](https://appbooster.net/blog/chrome-extension-pre-submission-checklist/)
- [Pass the CWS review first try — ExtensionFast](https://www.extensionfast.com/blog/how-to-pass-the-chrome-web-store-review-on-your-first-try)
- [Privacy Policy for Chrome Extensions — LegalForge](https://www.legalforge.app/blog/privacy-policy-for-chrome-extension)
