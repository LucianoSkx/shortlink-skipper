# Changelog

## 1.9.11 — 2026-08-22

### Added
- `handleLinkvertiseEasy`: agora aceita `r` em hash (`#r=`) e base64url, além de `?r=` (Linkvertise .com/.net)
- `ADLINKFLY_HOSTS`: lista curada de shorteners AdLinkFly (shortly.xyz, wadooo.com, lnk.news, uiz.io, tik.lat, skiplink.io, link-to.net, gplinks.in, paster.so, earnmm.com, cutwin.co, xslinks.com etc.) com regra `adlinkfly-hosts` que dispara o bypass mesmo sem os "hints" de shortlink
- `handleBypassCity`: fallback que consulta `bypass.city` e extrai o destino do HTML retornado (última opção antes do CAPTCHA manual)

## 1.9.10 — 2026-08-22

### Added
- Cobertura ampliada de serviços atuais (pesquisa vs FastForward/Universal Bypass 2026): `linkvertise.net` adicionado à família Linkvertise; `link-to.net`, `paster.so` e `gplinks.in` roteados para as APIs externas de bypass

## 1.9.9 — 2026-08-22

### Added
- `cloudflareChallenging()`: detecta o interstitial de desafio do Cloudflare (`#cf-challenge-running`, classe `cf-challenge-running`, título "Just a moment...", iframe/script de `challenges.cloudflare.com`)
- `main()` agora pausa antes de instalar hooks (fetch/XHR/WebSocket/boost de timers) quando um desafio Cloudflare está ativo, evitando atrapalhar o CAPTCHA e o redirecionamento do CF

## 1.9.8 — 2026-08-22

### Fixed
- `extractDestFromParams`: o trecho de path segments (`/goto/<b64>`) agora usa `isPlausibleUrl()` em vez do cheque antigo `/^https?:\/\//`, igualando query params e hash (reduz falso positivo de destino)

## 1.9.7 — 2026-08-22

### Added
- `// @license MIT` no cabeçalho (obrigatório pelo Greasy Fork)

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

## Earlier releases

- **0.9.x** — LootLabs WebSocket hook; browser-tested fixes
- **0.8.0** — rekonise + mboost rules
- **0.7.x** — per-domain disable menu; coverage audit vs ADLbypasser/ugiBypass lists
- **0.6.0** — confidence-based detection
- **0.5.0** — ugiBypass families (token-link, zafree, setc-form, bcvc flow)
- **0.4.0** — debloated fork techniques (acortalink, bstlar, linkvertise-easy, external-service)
- **0.3.0** — ADLbypasser handler families (ouo, adfoc, aylink, bcvc, adlinkfly)
- **0.2.0** — captcha-manual assist + WPSafeLink template
