# Function-by-function audit — prioritized changes

Scope: `shortlink-skipper.user.js` (~85 functions, v1.10.5). Order = impact ÷ effort.
Branch flow: `main` is protected (PR + Validate). Prefer short PRs into `main`;
use `dev` only for long-running work and fast-forward it after each merge
(`git push origin main:dev`). Installed users poll raw `main`.

## P0 — reliability (do first, all low-risk)

### A1. Centralize destination validation inside `goto()` — the "destination validator" — CLOSED
**Functions touched:** `goto()` (L254), `isPlausibleUrl()` (L245); new `validateDestination()`.
Shipped in 1.10.7: every caller inherits the same bar; refusals land on the trace with a reason.

### A2. Debug OFF by default — CLOSED
Shipped in 1.10.7: `VERBOSE = GM_getValue('verbose', false)` + menu toggle.

### A3. Grow the regression suite (false-positive collection) — CLOSED
Shipped in 1.10.9:

| Case | Status |
|---|---|
| malformed URL to every handler | closed — `goto`, `extractDestFromParams`, `handleLinkvertiseEasy`, `handleBypassCity` |
| `javascript:` / `data:` / `blob:` candidate destinations | closed — validateDestination matrix |
| SPA late-hydration page that later renders go-link form | closed — cache invalidation test |
| task wall → must not bypass | closed — dedicated `main()` test (no nav, no boost) |
| Cloudflare interstitial → untouched | covered |
| Google/YouTube/Gmail → untouched | covered by @exclude + lean tests |
| 10+ hop budget overflow observability | covered |
| popular non-shortlink sites (GitHub, Reddit, Wikipedia, Amazon…) | closed — lean fixtures |

## P1 — observability

### B1. Structured decision trace — CLOSED
Shipped in 1.10.7: `TRACE` with detection hits/score, winning rule, navigations, refusals, durationMs.

## P2 — measured hardening

### C1. Hook cost gates — CLOSED
`lean.test.js` enforces quiet pages (zero MO, zero timer wrap, `main()` < 50ms) and
`TRACE.durationMs` is measured on every load (asserted < 50ms on a quiet page).

## API key
Hardcoded trw.lat key removed (1.10.9). Key is stored only in GM storage
(`trw_api_key`), set via the userscript menu. Without a key the external
resolver skips (zero network) and still delegates to bypass.tools.

## Explicitly deferred (per philosophy: don't refactor without need)
- Rule contract `true` → `{handled, destination, confidence}`: revisit only when a rule
  needs to hand evidence forward.
- First-rule-wins engine order: correct as documented; specific-before-generic enforced.
- New site support: pattern-first (generic technique) before per-site handlers.

## Audit notes on functions reviewed and left alone
`sameAsCurrent`, cycle/hop state machine, `cloudflareChallenging`, `captchaPresent/
captchaSolved`, `installEarlyHooks` idempotence, `readGlobal` security comment,
`xorDecode`/`decodeTokenValue` scoping, media handlers (`handleImageHost`/
`handleFileHost`) — reviewed, no changes warranted this pass.
