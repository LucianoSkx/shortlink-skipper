# Changelog

## 1.9.13 — 2026-08-23

### Performance / Segurança (menos intrusão em páginas normais)
- `main()`: `prepareBoost()`, `installNetworkDestCapture()` e `enableInteractions()` só rodam quando a página é detectada como shortlink (`if (!shortish) return` cedo); antes rodavam em TODA página, sobrescrevendo `setTimeout`/`setInterval`, `fetch` e `XMLHttpRequest` globalmente em sites comuns
- `installNetworkDestCapture()`: instalado de forma preguiçosa, logo antes da regra `network-capture`, em vez de no carregamento — reduz interceptação de rede em páginas normais
- `setc-form`: `when: () => true` trocado por `document.querySelector('form#setc, form#landing [name="go"]') !== null`, eliminando espera de 4s em páginas sem esse formulário
- `looksLikeShortlink()`: memoizado para o `document` corrente, calculado uma vez e reutilizado pelas regras (antes repetia a varredura pesada a cada `when`)
- `goto()`: passa a validar com `isPlausibleUrl()` (protocolo http/https + host com `.`) como barreira universal — regras não precisam validar manualmente; também normaliza a URL (`new URL(url).href`) antes do histórico de loop

## 1.9.12 — 2026-08-23

### Fixed
- `BYPASS_SERVICE_URL`: removidos espaços literais antes de `linkvertise\.(?:com|net)` — o alternativa estava morta (URLs normais do Linkvertise não casavam na regra `external-service`); coberto por teste
- `readGlobal`: valida `name` contra `^[A-Za-z0-9_$]+$` para evitar que um valor da página vire sink de code injection no futuro
- `handleServiceLastResort`: aguarda 5s antes de repassar ao adbypass.org, e só repassa se o `bypass.tools` não redirecionou (antes pulava na hora em `@run-at document-start`, anulando a delegação de 2º nível)

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

### Tests
- `tests/shortlink-skipper.test.js` (node:test): carrega sem erro/registra menu e não interfere no desafio Cloudflare
- `tests/handlers.test.js` (node:test): exercita o código real de `handleLinkvertiseEasy`, `handleAdLinkFly` e `handleBypassCity` com entradas representativas (sandbox vm, sem dependências)
- Export guardado (`module.exports`) + `main()` só auto-roda fora de `module`: permite testar handlers no Node sem afetar o browser
- Teste ao vivo validado ponta a ponta no Helium + Violentmonkey: AdLinkFly (`skiplink.io`) redirecionou para o destino real; Linkvertise e bypass.city cobertos por testes unitários. Harness em `test-live/` (mock server + cliente CDP)

## Earlier releases

- **0.9.x** — LootLabs WebSocket hook; browser-tested fixes
- **0.8.0** — rekonise + mboost rules
- **0.7.x** — per-domain disable menu; coverage audit vs ADLbypasser/ugiBypass lists
- **0.6.0** — confidence-based detection
- **0.5.0** — ugiBypass families (token-link, zafree, setc-form, bcvc flow)
- **0.4.0** — debloated fork techniques (acortalink, bstlar, linkvertise-easy, external-service)
- **0.3.0** — ADLbypasser handler families (ouo, adfoc, aylink, bcvc, adlinkfly)
- **0.2.0** — captcha-manual assist + WPSafeLink template
