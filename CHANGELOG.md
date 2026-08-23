# Changelog

## 1.9.15 — 2026-08-23

### Fixed
- **`service-last-resort` was unreachable**: `main()` early-returned on `!shortish` before the rules loop, so when the cascade landed on `bypass.tools` (not a shortener page) the rule never ran and the adbypass.org fallback died at its second level. `main()` now treats delegation hosts as a gate exception; the protection suite (boost/popups/focus) still runs only on shortener pages.
- **Lootlabs WebSocket hook was installed too late**: it waited for DOMContentLoaded + the shortish gate, missing any `r:` payload sent by the page's own scripts before that. New `installEarlyHooks()` runs right after the exclusion checks at document-start and installs host-gated interception immediately.
- Same late-hook problem in `bstlar` (tasks XHR) and `lootlink-local` (`window.fetch`): both hooks are now installed early via `installEarlyHooks()`; lootlink snapshots pre-rule responses and replays them once the rule knows which URLs matter (CDN_DOMAIN/syncer from the `p` global).
- **Anti-loop missed A→B→A cycles**: with `sameAsCurrent` now comparing the query string, a 2-URL ping-pong was possible. `goto()` now blocks an immediate bounce or any target seen twice in the last 4 hops.

### Changed
- `sameAsCurrent()` compares origin + pathname + search (hash ignored): destinations differing only in query params are no longer treated as the same page.

## 1.9.14 — 2026-08-23

### Added
- Lootlabs API fallback: when the local XOR decode of the `r:` WebSocket payload yields no plausible URL, the raw payload is sent to `https://trw.lat/api/clientSides/lootlabs` and the returned `pyl` destination is used (validated by `isPlausibleUrl`). This mirrors F.E.A.R's lootlabs resolution **without** its `USC:eval(...)` server-command model — only a destination string is ever consumed, never remote code.
- `links.lootlabs.gg` added to `BYPASS_SERVICE_URL` so the page-level `external-service` rule provides an API fallback when the WebSocket interception does not fire.
- `resolveLootlabsViaApi` exported for unit testing.

## 1.9.13 — 2026-08-23

### Performance / Security (less intrusion on normal pages)
- `main()`: `prepareBoost()`, `installNetworkDestCapture()` and `enableInteractions()` now only run when the page is detected as a shortlink (`if (!shortish) return` early); previously they ran on EVERY page, overriding `setTimeout`/`setInterval`, `fetch` and `XMLHttpRequest` globally on ordinary sites
- `installNetworkDestCapture()`: installed lazily, right before the `network-capture` rule, instead of at load — reduces network interception on normal pages
- `setc-form`: `when: () => true` replaced by `document.querySelector('form#setc, form#landing [name="go"]') !== null`, eliminating the 4s wait on pages without that form
- `looksLikeShortlink()`: memoized for the current `document`, computed once and reused by the rules (previously repeated the heavy scan on every `when`)
- `goto()`: now validates with `isPlausibleUrl()` (http/https protocol + host containing a dot) as a universal guard — rules no longer need to validate manually; also normalizes the URL (`new URL(url).href`) before the loop history

## 1.9.12 — 2026-08-23

### Fixed
- `BYPASS_SERVICE_URL`: removed literal spaces before `linkvertise\.(?:com|net)` — the alternative was dead (normal Linkvertise URLs didn't match the `external-service` rule); covered by a test
- `readGlobal`: validates `name` against `^[A-Za-z0-9_$]+$` to prevent a page value from becoming a code-injection sink in the future
- `handleServiceLastResort`: waits 5s before forwarding to adbypass.org, and only forwards if `bypass.tools` didn't redirect (previously jumped immediately at `@run-at document-start`, nullifying the 2nd-level delegation)

## 1.9.11 — 2026-08-22

### Added
- `handleLinkvertiseEasy`: now accepts `r` in hash (`#r=`) and base64url, in addition to `?r=` (Linkvertise .com/.net)
- `ADLINKFLY_HOSTS`: curated list of AdLinkFly shorteners (shortly.xyz, wadooo.com, lnk.news, uiz.io, tik.lat, skiplink.io, link-to.net, gplinks.in, paster.so, earnmm.com, cutwin.co, xslinks.com etc.) with an `adlinkfly-hosts` rule that triggers the bypass even without the shortlink "hints"
- `handleBypassCity`: fallback that queries `bypass.city` and extracts the destination from the returned HTML (last option before the manual CAPTCHA)

## 1.9.10 — 2026-08-22

### Added
- Broader coverage of current services (research vs FastForward/Universal Bypass 2026): `linkvertise.net` added to the Linkvertise family; `link-to.net`, `paster.so` and `gplinks.in` routed to the external bypass APIs

## 1.9.9 — 2026-08-22

### Added
- `cloudflareChallenging()`: detects the Cloudflare challenge interstitial (`#cf-challenge-running`, `cf-challenge-running` class, "Just a moment..." title, `challenges.cloudflare.com` iframe/script)
- `main()` now pauses before installing hooks (fetch/XHR/WebSocket/timer boost) when a Cloudflare challenge is active, avoiding interference with the CF CAPTCHA and redirect

## 1.9.8 — 2026-08-22

### Fixed
- `extractDestFromParams`: the path-segment chunk (`/goto/<b64>`) now uses `isPlausibleUrl()` instead of the old `/^https?:\/\//` check, matching query params and hash (reduces false-positive destinations)

## 1.9.7 — 2026-08-22

### Added
- `// @license MIT` in the header (required by Greasy Fork)

## 1.9.6 — 2026-08-22

### Added
- Configurable debug logging: `Debug logs` menu command toggles console output (on by default)

### Changed
- `extractDestFromParams` now requires a plausible domain (host contains a dot) before accepting a decoded destination, reducing false positives
- `single-external-link` no longer auto-redirects when the only external link is a known social/footer domain
- Documented rule ordering in `main()`: rules run sequentially and the first that acts wins; a slow rule (e.g. `captcha-manual`, up to 120s) delays later rules

### Fixed
- `handleLootLinkLocal` now logs fetch/response parse failures instead of failing silently
- `readGlobal` documented as requiring an internal string-literal `name` (never external data) to avoid script injection

## 1.9.5 — 2026-08-22

### Added
- `@exclude` header rules for sensitive sites (email, banks, payment) as an extra execution-surface guard on top of `EXCLUDE_HOSTS`

### Changed
- `adlinkfly` and `adlinkfly-captcha` rules now gated by `looksLikeShortlink()` instead of `() => true` (avoids firing waitFor on every page)
- `handleAcortalink` message listener now ignores events whose `origin` is not the page's own origin
- Unified loot-link / lootlabs XOR decoding into a single `xorDecode(encoded, keyLength = 5)` helper (replaces duplicated `decodeLootlabsPayload` and `decryptData`)

## 1.9.3 — 2026-08-22

### Changed
- `extractDestFromParams` path-segment filter no longer discards base64url segments (segments with `-`/`_` are now kept)
- `boost-ink` rule gated by host instead of `() => true`

## 1.9.2 — 2026-08-22

### Added
- `lootlink-local` rule: in-page loot-link bypass (reimplemented from GreasyFork #483207, MIT) for links exposing the `window.p` global

## 1.2.0 — 2026-08-22

### Added
- `network-capture` rule: hooks fetch/XHR at document-start and follows destination-shaped JSON responses from any shortener API call
- `boost-ink` rule: decodes the payload hidden behind boost.ink's internal marker key
- WPSafeLink JSON variant support (`atob(input).linkr` from `newwpsafelink` / `wpsafelink-landing` inputs)
- `url-destination`: base64 destinations hidden in path segments (`/goto/<b64>`, `/away/<b64>`) plus `shortid`/`id` params
- Task-wall detection: engagement gates (revlink, sub2go social unlockers) are left untouched — server-side validation cannot be bypassed locally

### Changed
- AdLinkFly retry loop is now adaptive: immediate first POST, then retries every 5s for 60s while clicking the invisible captcha and following the unlocked button
- Shortlink detection uses a multi-indicator confidence score instead of two binary checks
- Single-external-link detector scans more sources (meta refresh, data attributes, hidden inputs, JS assignments)

### Fixed
- Task-wall hints now scanned in page source too (they only exist inside inline scripts on revlink gates)

### Tests
- `tests/shortlink-skipper.test.js` (node:test): loads without error / registers the menu and doesn't interfere with the Cloudflare challenge
- `tests/handlers.test.js` (node:test): exercises the real code of `handleLinkvertiseEasy`, `handleAdLinkFly` and `handleBypassCity` with representative inputs (vm sandbox, no dependencies)
- Export guard (`module.exports`) + `main()` only auto-runs outside `module`: allows testing handlers in Node without affecting the browser
- Live test validated end-to-end in Helium + Violentmonkey: AdLinkFly (`skiplink.io`) redirected to the real destination; Linkvertise and bypass.city covered by unit tests. Harness in `test-live/` (mock server + CDP client)

## Earlier releases

- **0.9.x** — LootLabs WebSocket hook; browser-tested fixes
- **0.8.0** — rekonise + mboost rules
- **0.7.x** — per-domain disable menu; coverage audit vs ADLbypasser/ugiBypass lists
- **0.6.0** — confidence-based detection
- **0.5.0** — ugiBypass families (token-link, zafree, setc-form, bcvc flow)
- **0.4.0** — debloated fork techniques (acortalink, bstlar, linkvertise-easy, external-service)
- **0.3.0** — ADLbypasser handler families (ouo, adfoc, aylink, bcvc, adlinkfly)
- **0.2.0** — captcha-manual assist + WPSafeLink template
