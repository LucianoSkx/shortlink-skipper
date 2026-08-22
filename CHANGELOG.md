# Changelog

## 1.9.4 — 2026-08-22

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

## Earlier releases

- **0.9.x** — LootLabs WebSocket hook; browser-tested fixes
- **0.8.0** — rekonise + mboost rules
- **0.7.x** — per-domain disable menu; coverage audit vs ADLbypasser/ugiBypass lists
- **0.6.0** — confidence-based detection
- **0.5.0** — ugiBypass families (token-link, zafree, setc-form, bcvc flow)
- **0.4.0** — debloated fork techniques (acortalink, bstlar, linkvertise-easy, external-service)
- **0.3.0** — ADLbypasser handler families (ouo, adfoc, aylink, bcvc, adlinkfly)
- **0.2.0** — captcha-manual assist + WPSafeLink template
