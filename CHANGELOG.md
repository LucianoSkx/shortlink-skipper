# Changelog

## 1.10.1 — 2026-08-23

### Fixed
- **Media hosts were inert**: after isolating `IMAGE_HOSTS`/`FILE_HOSTS` out of `knownShortener()`, the early return in `main()` fired before the media gate was ever reached — dedicated `image-host`/`file-host` rules could no longer run on their own hosts. The gate now evaluates `knownMediaHost()` up front (evaluated once, reused by both checks).
- Added end-to-end tests: `main()` must drive a media host to its dedicated rule (imagetwist → direct image), and a failed image-host lookup must leave the page untouched instead of falling through to shortlink fallbacks.

## 1.10.0 — 2026-08-23

### Added — adsbypasser coverage absorption (BSD-2-Clause, credited)
- **Small shorteners** (~21 hosts): `1ink.cc`, `1link.club`, `a2zapk.io`, `adshnk.com`, `anchoreth.com`, `bcvc.ink`, `binbox.io`, `cpmlink.net`, `cutpaid.com`, `cuttty.com`, `exeo.app`, `fir3.net`, `gplinks.co`, `icutlink.com`, `kingofshrink.com`, `linkpoi.me`, `linkshrink.net`, `lnk2.cc`, `network-loop.com`, `thinfi.com`, `tutwuri.id` — absorbed via `EXTRA_SHORTENER_HOSTS`: the gate opens and the existing generic rules (network-capture, final-button, single-external-link) act. No per-site code.
- **Image hosters** (30 hosts: imgbb, imagetwist, pixhost.to, postimages.org, imagebam…) + new `image-host` rule — strips common overlays, then follows the direct image anchor or the main `<img>`/og:image.
- **File hosters** (10 hosts: uploadhaven, uploadrar, mirrored.to, multiup.io, katfile.vip, keeplinks.org…) + new `file-host` rule — waits up to 20s for the free-download control, clicks it or follows its href.
- Known-host pages now also receive the protection suite (timer boost, popup shield, focus lock) even when they show no structural markers.

### Design note
Instead of porting adsbypasser's ~97 handlers, their host lists were curated (platform giants like giphy/tenor/imgflip and out-of-scope blogs excluded) and absorbed into three lists plus two generic rules — keeping the engine small. Hard links and the API cascade remain untouched.

### Tests
33 total: gate opens for all three new families; `image-host` follows a mocked direct anchor; `file-host` dispatches the click on a mocked control. 28 rules total (was 26 pre-1.10.0).

## 1.9.20 — 2026-08-23

### Added
- Menu command **"Open in bypass.link (manual fallback)"**: copies the current URL to the clipboard and opens [bypass.link](https://bypass.link). Evaluated for the automatic cascade and rejected — it requires an interactive hCaptcha per request (no programmatic API, no deep-link), so it ships as a manual escape hatch only. New grants: `GM_setClipboard`, `GM_openInTab` (with `window.open` fallback).

### Tests
- Menu registration regression: the fallback entry is always present.

## 1.9.19 — 2026-08-23

### Fixed
- **ouo.io's new Turnstile phase stalled the bypass**: the site now shows an interactive "I'm a human" gate *before* `#form-captcha`/`#form-go` exist, and the generic follow-up rules (`captcha-manual`, `single-external-link`, `bypass-city`) were gated behind `looksLikeShortlink()` — which scores 0 while no form has rendered, so nothing observed the captcha after a manual solve. New `genericGate()` (shortish **or** known host) opens those rules on dedicated hosts; `handleOuo` now detects the human check, tells the user, and waits up to 60s for the form instead of giving up in 8s.

### Tests
- `genericGate` regression: open on `ouo.io` with zero structural markers; closed on ordinary pages.

## 1.9.18 — 2026-08-23

### Fixed
- **LootLabs query-style gateways (`/s?XXXX`) never reached the API fallback**: `BYPASS_SERVICE_URL` only matched the path form `/s/...`, so links like `loot-link.com/s?fJTD` (Arceus X / Delta key gateways) ran the local decoders and, when they found nothing, ended silently — no trw.lat attempt, while the site cycled domain variants and reloaded. The regex now accepts both `/s/...` and `/s?...`.

### Tests
- Regex regression for query-style loot gateways on both `loot-link.com` and canonical `links.lootlabs.gg`.

## 1.9.17 — 2026-08-23

### Fixed
- **Linkvertise (and other SPAs) were dismissed as "not a shortlink"**: the generic gate ran before any dedicated rule and scored 0 on pages that had not hydrated yet (no `form#go-link`, no countdown text), so `main()` exited early and the `external-service` cascade never fired — caught live against a real link. New `knownShortener()` check lets hosts that own dedicated rules (`linkvertise`, loot family, `bstlar`, `ouo`, adfoc family, `aylink`, rekonise, mboost, bcvc, token/zafree/adlinkfly families and everything in `BYPASS_SERVICE_URL`) clear the gate regardless of rendering state.

### Tests
- Regression: a known host with zero structural indicators must still reach the trw.lat API and fall back to bypass.tools.
- The early-hook idempotency test now answers the GM mock — with the gate open, `main()` actually reaches `external-service`, which exposed the never-resolving default mock.

## 1.9.16 — 2026-08-23

Stability release — no new bypasses.

### Changed
- **`goto()` is now a redirect state machine** with three invariants: never navigate to the current destination (`sameAsCurrent`), never accept a cycle (any already-visited destination is rejected, including the entry URL — `A→B→C→A` dies), and never allow an endless chain (`MAX_HOPS = 10` hop budget). The entry page is seeded into the per-tab history so cycles back to it are caught; this subsumes and replaces the previous recent-window heuristics.
- acortalink's spoofed `window.open` now funnels through `goto()` instead of a raw `location.assign` — popup-sourced URLs get destination validation and loop protection too. `goto()` is now the single navigation door in the codebase.

### Tests
- Redirect-chain matrix: `A→B→A`, `A→B→C→A`, `A→B→C→D→E→A`, non-consecutive duplicate (`A→B→C→B`), and a 12-hop chain hitting the budget.
- `installEarlyHooks()` idempotency: calling it twice (and then `main()`) wraps `fetch` exactly once on loot-link hosts.

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
