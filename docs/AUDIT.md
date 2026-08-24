# Function-by-function audit — prioritized changes

Scope: `shortlink-skipper.user.js` (~85 functions, v1.10.5). Order = impact ÷ effort.
Working branch: `dev` (main becomes release-only; installed users poll raw `main`).

## P0 — reliability (do first, all low-risk)

### A1. Centralize destination validation inside `goto()` — the "destination validator"
**Functions touched:** `goto()` (L254), `isPlausibleUrl()` (L245); new `validateDestination()`.

Today each caller pre-filters destinations (`handleBypassCity`, `findExternalExit`,
`extractDestFromParams`, `handleNetworkCapture`, …). The three live bugs of 2026-08-24
(trustpilot, gmail, wordpress) were three caller-side filters with holes. Moving the
filter *into* `goto()` protects every current and future consumer at once:

```
candidate → normalize (strip tracking params) → protocol check (http/https only,
reject js/data/blob) → reject EXCLUDE_HOSTS / INFRA_HOST / SOCIAL_HOST as target
→ sameAsCurrent → cycle check (already there) → hop budget (already there) → navigate
```

`isPlausibleUrl()` upgrades into `validateDestination()` returning
`{ ok, confidence, reason }`; `goto()` consumes it and logs the reason on refusal.
Test it in isolation: dangerous protocols, excluded targets as *destinations*
(allowed as hosts today — that asymmetry is the bug class), IP literals, ports.

### A2. Debug OFF by default
**Functions touched:** L41 `VERBOSE = GM_getValue('verbose', true)` → `false`;
add a `registerMenu()` toggle ("Toggle verbose logging") so debugging stays one click away.
Console pollution on every known host disappears for regular users. Zero behavioral risk.

### A3. Grow the regression suite (false-positive collection)
Existing coverage is strong on loops/cycles and recent live bugs. Missing cases:

| Case | Status |
|---|---|
| malformed URL to every handler | partial |
| `javascript:` / `data:` / `blob:` candidate destinations | missing |
| SPA late-hydration page that later renders go-link form | partial |
| task wall → must not bypass | one indirect test |
| Cloudflare interstitial → untouched | covered |
| Google/YouTube/Gmail → untouched | covered by @exclude + lean tests |
| 10+ hop budget overflow observability | covered |
| popular non-shortlink sites (GitHub, Reddit, Wikipedia, Amazon…) | missing — add as lean fixtures |

## P1 — observability

### B1. Structured decision trace
**Functions touched:** `log()` (L115), `looksLikeShortlink()` (L294), rule loop in `main()` (L1596).

Make decisions inspectable instead of prose lines:
- `looksLikeShortlink` already computes a score internally — return/expose `{score, hits[]}`.
- Rule loop logs `{rule, acted, durationMs}`; refusals from `goto()` log
  `{candidate, reason}` (falls out of A1 for free).
- Keep human-readable output when `VERBOSE=true`; structured payload behind it.

## P2 — measured hardening

### C1. Hook cost gates
**Functions:** `prepareBoost`(1223), `enableBoost`(1232), `blockPopups`(1239),
`restoreFocus`(1257), `enableInteractions`(1274), `removeAdblockBanners`(1300),
`installNetworkDestCapture`(1167), early hooks (1537).
Already gated by `shortish || knownShort || media`; `lean.test.js` enforces quiet pages.
Next step is *measurement* (time `main()`, MutationObserver, fetch wrap) before any change.

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
