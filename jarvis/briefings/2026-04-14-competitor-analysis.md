# R3 Competitor Analysis — Reddit Browser Extension Landscape
**Task:** R004
**Agent:** jarvis-research
**Date:** 2026-04-14
**Status:** complete

Not legal or financial advice. All ratings/stats marked [UNVERIFIED] where not directly confirmed.

---

## 1. Summary

The Reddit browser extension landscape is dominated by free tools. There is no paid, freemium extension that targets R3's specific niche: pre-post rule warnings + post removal detection for regular users. The closest competitors target moderators (Moderator Toolbox) or old Reddit (RES). R3 owns an uncontested niche if Phase 2 features deliver.

---

## 2. Direct Competitors

### Reddit Enhancement Suite (RES)

- URL: [redditenhancementsuite.com](https://redditenhancementsuite.com/)
- Chrome Web Store: [kbmfpngjjgdllneeigpgjifpgocmfgmb](https://chromewebstore.google.com/detail/reddit-enhancement-suite/kbmfpngjjgdllneeigpgjifpgocmfgmb)
- Pricing: Free (donation-supported)
- Target user: Old Reddit power users
- Rating: [UNVERIFIED — check Chrome Web Store directly for current rating]
- Last release: v5.24.8 on 2025-02-11 (added optional permissions for embed.bsky.app/oembed)

**Feature overlap with R3:**
- None on new Reddit. RES explicitly targets old Reddit. Their user base and R3's are almost non-overlapping.
- RES has no rule-surfacing, no risk scoring, no removal detection.

**Competitive posture:** Not a direct threat. RES users who migrate to New Reddit are a conversion opportunity for R3.

---

### Moderator Toolbox for Reddit

- Chrome Web Store: [jhjpjhhkcbkmgdkahnckfboefnkgghpo](https://chromewebstore.google.com/detail/moderator-toolbox-for-red/jhjpjhhkcbkmgdkahnckfboefnkgghpo)
- GitHub: [toolbox-team/reddit-moderator-toolbox](https://github.com/toolbox-team/reddit-moderator-toolbox)
- Pricing: Free
- Rating: 4.1/5 stars [UNVERIFIED — from chrome-stats.com data]
- Target user: Subreddit moderators, not regular posters

**Feature overlap with R3:**
- Toolbox has user notes, mod mail tools, and moderation queues — all moderator-facing
- No overlap with R3's user-facing rule surfacing or posting risk scoring

**Competitive posture:** Complementary, not competitive. Moderators who use Toolbox are potential beta testers for R3 — they understand subreddit rules deeply.

---

### Reddit Shadowban Checkers (web tools, not extensions)

Multiple free web tools exist:

| Tool | URL | Type |
|---|---|---|
| BanChecker | banchecker.org | Web tool |
| Bulkoid Shadowban Checker | bulkoid.com/reddit-shadowban-checker | Web tool |
| GetUpvotes Shadowban | getupvotes.com/shadowban-tool/ | Web tool |
| am-i-shadowbanned (GitHub) | github.com/skeeto/am-i-shadowbanned | Open source web tool |

**Feature overlap with R3:**
- R3's Phase 2 StatusCard is the extension-native equivalent of these web tools
- Key differentiator: R3 checks removal status *inline while you are on Reddit*, with no tab switching
- These are free web tools — no monetization model — and none are extensions

**Competitive posture:** R3 beats them on UX (in-context, no tab switch) and on integration (removal detection tied to the specific post you're viewing).

---

### Reddit Karma and Account Age Checkers

No standalone extension for this exists as of research date [UNVERIFIED — checked Chrome Web Store search for "subreddit rules", "karma requirements", "reddit rules checker"]. The only tools are:

- Forum threads where users manually explain karma/age requirements per sub
- Subreddit wikis (often outdated)
- The subreddit's sidebar (requires user to scroll and find it)

**Competitive posture:** R3's RulesBlock is the only tool that surfaces karma/age requirements automatically in the posting context. This is the clearest uncontested niche in Phase 1.

---

## 3. Indirect Competitors

### Grammarly / writing assistant extensions

Not Reddit-specific, but illustrate the freemium extension model. Relevant as proof that users will pay for pro tiers of browser extensions when the value is clear. Grammarly reportedly has millions of paying users at $12–$30/month.

### Reddit's own UI

Reddit itself surfaces some rules in the sidebar. Problems:
- Sidebar is collapsed by default on mobile web
- Rules are not shown in the post composer context
- No karma/age requirement warnings before submission
- No post removal feedback

R3's value prop is surfacing what Reddit itself buries.

---

## 4. Competitive Landscape Summary

| Dimension | RES | Mod Toolbox | Shadowban checkers | R3 |
|---|---|---|---|---|
| Target user | Old Reddit power user | Subreddit moderator | Any Reddit user | Regular poster, New Reddit |
| New Reddit support | No | Yes (partial) | N/A (web tool) | Yes (primary) |
| Rule surfacing | No | No | No | Yes |
| Pre-post risk warning | No | No | No | Phase 2 |
| Removal detection | No | No | Yes (manual check) | Phase 2 |
| Pricing | Free | Free | Free | Freemium (Phase 2) |
| Extension format | Yes | Yes | No | Yes |
| Active development | Slow | Active | Varies | Active |

---

## 5. Positioning Recommendation

R3's strongest differentiation: **the only extension that works in New Reddit's post composer context and warns users before they submit.**

Key messaging to own:
- "Know the rules before you hit submit"
- "Find out if your post was removed — without checking manually"
- "Inline, not another tab"

Do not position against RES or Mod Toolbox — they serve different audiences and segments. There is no direct paid competitor to R3 in this niche as of April 2026.

---

## 6. Chrome Web Store Search Gap Analysis

[UNVERIFIED — based on search result patterns, not direct CWS listing scrape]

Search terms with no strong extension result:
- "subreddit rules" — no dedicated extension
- "reddit rules checker" — no extension
- "reddit post removed checker" — no extension
- "karma requirement checker" — no extension
- "reddit posting assistant" — no extension

These are R3's organic discovery keywords. Owning them in the CWS listing and on the marketing site is the primary growth lever.

---

## Sources

- [Reddit Enhancement Suite](https://redditenhancementsuite.com/)
- [RES on Chrome Web Store](https://chromewebstore.google.com/detail/reddit-enhancement-suite/kbmfpngjjgdllneeigpgjifpgocmfgmb)
- [Moderator Toolbox on Chrome Web Store](https://chromewebstore.google.com/detail/moderator-toolbox-for-red/jhjpjhhkcbkmgdkahnckfboefnkgghpo)
- [chrome-stats.com — Moderator Toolbox](https://chrome-stats.com/d/jhjpjhhkcbkmgdkahnckfboefnkgghpo)
- [AlternativeTo — RES alternatives](https://alternativeto.net/software/reddit-enhancement-suite/)
- [BanChecker](https://banchecker.org/)
- [GetUpvotes Shadowban Tool](https://getupvotes.com/shadowban-tool/)
- [Best Chrome Extensions for Reddit — Medium](https://medium.com/@daniel.maro/best-chrome-extensions-for-reddit-lead-generation-in-2026-top-picks-to-supercharge-your-outreach-f420b4cd6188)
