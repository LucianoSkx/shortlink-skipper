<div align="center">

# Shortlink Skipper

**Skip link shorteners automatically — countdowns, popups, anti-adblock banners and all.**

A single-file userscript built on one small rule engine, distilled from eight
bypass projects.

[![Validate](https://github.com/LucianoSkx/shortlink-skipper/actions/workflows/validate.yml/badge.svg)](https://github.com/LucianoSkx/shortlink-skipper/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Userscript managers](https://img.shields.io/badge/Violentmonkey%20·%20Tampermonkey-compatible-blue)

[**Install**](#install) · [How it works](#how-it-works) · [Safety](#safety-and-security) · [Privacy](#privacy--what-leaves-your-device) · [Development](#development) · [Credits](#credits)

</div>

---

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. Open the install link and confirm in your manager:

➡️ **[Install Shortlink Skipper](https://github.com/LucianoSkx/shortlink-skipper/raw/main/shortlink-skipper.user.js)**

Raw file: `https://github.com/LucianoSkx/shortlink-skipper/raw/main/shortlink-skipper.user.js`

Updates are automatic: managers poll the raw file on `main`.

## How it works

The engine applies generic techniques shared by most shorteners instead of one
hardcoded handler per site. Rules run in order; the first one that acts wins.

A page counts as a shortener when a strong structural marker exists
(`form#go-link`, `ad_form_data`, invisible captchas) or when at least two soft
indicators match: countdown text, action buttons, URL shape, meta refresh,
loader/timer elements. Engagement task-walls ("spend N minutes", social
unlockers) are detected and left alone — they validate server-side.

**Global protections**

- Countdowns run up to 60× faster on pages without a captcha widget; 15× while one is present, and back to real time if one appears late.
- Popups are blocked and the tab never reports being unfocused.
- Anti-adblock banners are removed; right-click, copy and selection are restored.
- Circular redirects abort via session history.

<details>
<summary><b>Rule reference (74)</b></summary>

| Rule | Technique |
| --- | --- |
| `image-host` | Image hosters: strips overlays, follows the direct image link/anchor |
| `file-host` | File hosters: waits out the timer, clicks the free-download control |
| `ouo` | Submits `#form-captcha` / `#form-go` in a loop until each stage advances (`ouo.today` uses the `nextUrl` global) |
| `adfoc` | Follows `click_url` / hidden `#y` input (`adfoc.us`, `adf.ly`, `clk.sh`, `shrink.pe`) |
| `close-interstitial` | Closes interstitial-only tabs (doaipomer, ppcnt, lnkparts, zunsoach) |
| `rekonise` | Calls the social-unlock API directly |
| `mboost` | Pulls escaped `"targeturl"` from page source |
| `lootlink-local` | Local loot-link WebSocket/XHR decode (base64url + XOR), no remote code |
| `lootlabs` | WebSocket hook at document-start; decodes `r:` payloads (base64url + XOR) |
| `aylink-family` | Exchanges `_a/_t/_d` for a token at `/get/tk`, finishes at `/links/go2` |
| `bcvc` | Clicks `#getLink` after countdown, POSTs `/ln.php` with page globals |
| `skip-button-dest` | Reads `dest=` from `#skip_bu2tton`; resolves `/ad/locked` hops |
| `acortalink` | Spoofs `postMessage("__done__")` to defeat the counter, clicks through |
| `bstlar` | Intercepts the tasks XHR, marks steps complete on their API |
| `token-link` | Decodes base64 `input[name=token]` (or its tail) into the destination |
| `wp-content-lock` | WordPress content-lock: waits out the timer, follows the external get-link |
| `zafree-link-view` | Fills za.gl's coordinate challenge and submits |
| `setc-form` / landing forms | Follows `form#setc` action; decodes base64 `go` field on `form#landing` |
| `boost-ink` | Fetches own source, decodes payload behind internal marker key |
| `linkvertise-easy` | Extracts destination from Linkvertise `?r=` / `#r=` (base64) |
| `adlinkfly-hosts` | Host-gated AdLinkFly family: serializes hidden fields, POSTs `/links/go` |
| `external-service` | Hardened links (Linkvertise hard case, loot-links, admaven): queries the free trw.lat bypass API for an instant destination, falling back to [bypass.tools](https://bypass.tools) resolver |
| `network-capture` | Hooks fetch/XHR; follows destination-shaped JSON responses |
| `url-destination` | Base64/hex destinations in query params *and* path segments (`/goto/<b64>`) |
| `adlinkfly` | Serializes hidden fields, POSTs `/links/go` with adaptive retries |
| `adlinkfly-captcha` | Clicks `#invisibleCaptchaShortlink` when it enables |
| `go-link-form` | Waits out the timer, then submits/clicks `form#go-link` |
| `wpsafelink` | Full WPSafeLink flow incl. JSON variant (`atob(input).linkr`) |
| `math-captcha` | Solves "12 + 7 = ?"-style questions |
| `final-button` | Clicks unlocked "Get Link" / "Continue" buttons |
| `service-last-resort` | If even bypass.tools fails on a delegated link, forwards the job to adbypass.org |
| `bypass-city` | Queries bypass.city and follows a real destination (footer/social links filtered) |
| `imagetwist-family` | Follows `img.pic` (`imagetwist.com`, `imagehaha.com`, `imagenpic.com`, `imageshimage.com`, `imagexport.com`, `croea.com`) |
| `fastpic` | Fullview link → `#imglink`/`#imga` → inline script (`fastpic.org`) |
| `imgtraffic` | Rewrites `/a-1/`, `/i-1/`, `/n-1/`, `/z-1/` to the direct jpeg (`imgtraffic.com`) |
| `imgair` | Reads `imgbg.src` from inline scripts (`cloudgallery.net`, `imgair.net`, `imgblaze.net`, `imgfira.cc`, `imgfrost.net`) |
| `captcha-manual` | Watches hCaptcha/reCAPTCHA/Turnstile; auto-submits **after you solve** |
| `paste-extract` | Follows the first valid external URL found in paste content (`pastebin.com`, `rentry.co`, `pastelink.com`, `justpaste.it`, `paste.ee`, `hastebin.com`, `ghostbin.co`, `controlc.com`, `paste.org`, `spacebin.in`) |
| `single-external-link` | Redirects when exactly one plausible external exit exists |
| `goo-st` | Clicks `.btn-primary` (`goo.st`, `swzz.xyz`) |
| `1ink` | Follows `#countingbtn` (`1ink.cc`) |
| `cpmlink` | Follows `#btn-main` (`cpmlink.net`) |
| `thinfi` | Follows the content link (`thinfi.com`) |
| `kimochi` | Follows `a#next` on `/inter` (`kimochi.info`) |
| `a2zapk` | Follows `#dlbtn li a` (`a2zapk.io`) |
| `blogmado` | Clicks `.btn` (`blogmado.com`) |
| `mangalist` | Clicks the URL button (`mangalist.org`) |
| `linegee` | Clicks `.btn-xs` (`linegee.net`) |
| `yasir252` | Follows `#downloadBtn` (`download.yasir252.com`) |
| `imagetwist-netlify` | Follows the download button (`imagetwist.netlify.app`) |
| `urlgalleries` | Clicks the overlay button (`urlgalleries.net`) |
| `hen-tay` | Follows the download link on `/go/` (`hen-tay.net`) |
| `wpsafe-anchor` | Follows `#wpsafe-link a` (`otomi-games.com`, `ryuugames.com`) |
| `tribuntekno` | Clicks the verification buttons (`tribuntekno.com`) |
| `cuttty` | Clicks `#submit-button` (`cuttty.com`) |
| `fir3` | Clicks the get-link button (`fir3.net`) |
| `gplinks` | Clicks `.get-link` (`gplinks.co`) |
| `icutlink` | Follows the get-link href / clicks `.bsub` (`icutlink.com`, `zegtrends.com`) |
| `turkdown` | Follows the get-link href (`link.turkdown.com`) |
| `tutwuri` | Clicks the btn-1/2/3 sequence (`tutwuri.id`) |
| `exeo-app` | Clicks the three-stage buttons (`exe-links.com`, `exeo.app`, `exeygo.com`) |
| `lnk2` | Strips overlays, clicks `#getLink` on `/go/` (`lnk2.cc`) |
| `spaste` | Submits the contact form on `/site/` (`www.spaste.com`) |
| `f95zone` | Clicks `.host_link` on `/masked/` (`f95zone.to`) |
| `rlu-preview` | Follows the long URL (`preview.rlu.ru`) |
| `adshnk` | Clicks through to `#final_redirect` (`adshnk.com`) |
| `similarsites` | Decodes the `/goto/` path (`similarsites.com`) |
| `lolinez` | Follows the bare query URL (`www.lolinez.com`) |
| `urlcash` | Reads the `linkDestUrl` page global (`urlcash.com`) |
| `go-linkify` | Extracts the `/get/` URL from page scripts (`go.linkify.ru`) |
| `network-loop` | Follows the shadow-DOM button (`network-loop.com`) |
| `get-click2` | Enables and clicks `#gotolink` (`get-click2.blogspot.com`) |
| `encurta` | Submits `form#form-continue` (`encurta.app`, `seulink.digital`, `monetiza.link`; ad decoys ignored, captcha stage left to manual). Pages that already exit through their own `meta refresh` are left alone, and a self-posting form is submitted once per path so the tab cannot reload in a loop |
| `forumdinheiro` | Walks the tRPC stage chain server-side (port of adsbypasser `link/forumdinheiro.com.js`; `forumdinheiro.com`, `guis2.com`, `tarviral.com`, `umconto.com`) |

</details>

## Safety and security

- Top frame only; iframes are never touched.
- Google, YouTube, hCaptcha/reCAPTCHA and Cloudflare are hard-excluded.
- Captcha widgets (reCAPTCHA, hCaptcha, Turnstile) are never solved or tampered with — only observed. Template challenges whose answer is computed locally (arithmetic questions, za.gl's coordinate form) are filled by their dedicated rules.
- Cloudflare challenges pass untouched. If one clears without navigating away, the page reloads once so the script resumes on the real page.
- Per-domain on/off switch in the userscript menu.

Implementation details worth knowing:

- **Page globals** — read through `unsafeWindow` (e.g. `linkDestUrl`, `click_url`, `p`). This grants full page-context access, so a compromised page could interfere with the script.
- **Injected reads** — `readGlobal()` injects a `<script>` tag. The variable name is validated against `/^[A-Za-z0-9_$]+$/`; the mechanism can still break under strict CSP.
- **Same-origin fetch** — `handleBoostInk` fetches the current page with `credentials: 'include'`, sending the site's own cookies back to that origin.
- **Temporary hooks** — `handleAcortalink`, `installBstlarXhrHook` and `installLootLinkFetchCapture` override `PAGE.open`, `XMLHttpRequest.prototype.open` and `fetch`; each is restored after at most 5 minutes.

## Privacy — what leaves your device

Local only, in the manager's storage: `verbose`, `disabled_hosts`, `sl_stats`,
`sl_fp_reports`, `sl_resolver_breakers`; plus `sessionStorage` flags for
once-per-path form submissions.

Third-party calls, only when the matching rule fires:

| Destination | When | What is sent |
| --- | --- | --- |
| [trw.lat](https://trw.lat) | `external-service` / lootlabs API fallback (keyless, no credentials) | Current URL (and, for lootlabs, the WebSocket `r:` payload) |
| [bypass.tools](https://bypass.tools) | Delegation after trw.lat fails or is skipped | Current URL in `?url=` (browser navigation) |
| [adbypass.org](https://adbypass.org) | `service-last-resort` after bypass.tools stalls | Current URL in `?bypass=` (browser navigation) |
| [bypass.city](https://bypass.city) | `bypass-city` fallback | Current URL in `?bypass=` (via `GM_xmlhttpRequest`) |
| [api.rekonise.com](https://api.rekonise.com) | `rekonise` rule | Pathname only (`/social-unlocks…/unlock`) |
| Loot-link action/sync endpoints | `lootlink-local` (site's own ad network) | Bypass bookkeeping expected by that site |
| [bypass.link](https://bypass.link) | Menu command only (manual) | You paste the URL yourself after the tab opens |

Ordinary pages never call any of them: the gate exits before rules run. Use
**Disable on this site** to stop outbound requests from a domain.

## Menu commands

Right-click the userscript icon (or open the manager's script menu):

| Command | What it does |
| --- | --- |
| **Disable on this site** / **Enable on this site** | Toggles the script for the current domain only |
| **Debug logs: ON/OFF** | Toggles verbose console logging (**off by default**) |
| **Report false positive on this page** | Saves host/URL/rule/candidates locally (capped at 200); nothing is uploaded |
| **Show local statistics** | Prints per-rule ok/fail counts from GM storage to the console |
| **Open in bypass.link (manual fallback)** | Copies the current URL and opens [bypass.link](https://bypass.link) — it requires its own hCaptcha, so this is a manual escape hatch when every automatic level failed |

## Adding a site-specific rule

```js
{
  name: 'my-site',
  when: () => /mysite\.example/.test(location.host),
  run: async () => {
    const token = await waitFor(() => document.querySelector('#token')?.value);
    return goto(`https://final.destination/?t=${encodeURIComponent(token)}`);
  },
}
```

The first rule that acts wins — order specific rules first.

## Development

```bash
npm test                          # node --test tests/*.test.js
node --check shortlink-skipper.user.js
```

The unit tests load the userscript in a `vm` sandbox with mocked
`location`/`document` — no browser needed:

- `tests/shortlink-skipper.test.js` — boot, menu registration, Cloudflare pass-through
- `tests/handlers.test.js` — rule handlers and destination validation
- `tests/lean.test.js` — ordinary pages stay untouched (no heavy hooks)
- `tests/robustness.test.js` — cache signature, interaction listeners, adblock sweeper, stats buffer, `readGlobal` cleanup

CI runs `node --check`, the metadata check, `npm test` and a syntax check of
the live harness on every push and pull request.

### Live integration harness

`test-live/` runs mock shortlink pages in a real browser over CDP. It injects
the userscript itself, so no userscript manager is required.

```bash
npm run test:live                # all cases (needs CDP on :9222)
node test-live/run-all.js ports  # one family
node test-live/live.js <html> <expect> [host] [path] [query]
```

Click-only rules report through `document.title`; navigating rules through the
final URL. Cases can pin a fake host, path and query string. The suite is not
part of CI (it needs a browser); CI only syntax-checks the harness files.
`node test-live/upstream-gap.js` diffs adsbypasser's `@domain` coverage and the
`Upstream sync` workflow refreshes a tracking issue with the result.

### Branch flow

- `main` is protected: PRs only, `Validate` must pass.
- Prefer short PRs; long-running work may use `dev` (`git push origin main:dev` after each merge).

### Releasing

There is no GitHub Releases pipeline. Installed users poll
`@updateURL`/`@downloadURL`, so `main` is the release.

Before bumping `@version` and merging:

1. `node --check shortlink-skipper.user.js`
2. `npm test`
3. `npm install && npm run test:live` with Chromium/Chrome listening on `:9222` — all cases must pass.
4. Spot-check one real shortener chain if a host list or gate changed.
5. Bump `@version` (keep `package.json` in sync) and merge.

## Credits

Techniques are reimplemented in this codebase's rule format.

| Source | License | What was taken |
| --- | --- | --- |
| [ADLbypasser v1.6](https://greasyfork.org/pt-BR/scripts/439469) by fir4tozden | MIT | ouo, adfoc, aylink-family, bcvc, skip-button-dest, AdLinkFly families |
| [ugiBypass v2.1.0](https://greasyfork.org/en/scripts/584507) by ugilabs | MIT | token-link, zafree-link-view, setc-form, bcvc flow, `#y` fallback |
| [bypass-all-shortlinks-debloated](https://codeberg.org/Amm0ni4/bypass-all-shortlinks-debloated) by Amm0ni4 | mixed | acortalink, bstlar, linkvertise-easy, external-service concepts (AdGuard/FastForward lineage) |
| [nOneCode4u/bypass-shortlinks](https://github.com/nOneCode4u/bypass-shortlinks) | Unlicense | network capture technique |
| [BypassTools v5](https://bypass.tools) by BypassTools, EAS, Woozie & jiggey | MIT | bypass.tools as second-level resolver and `service-last-resort` cascade; `cur_url` observation technique (reimplemented) |
| Universal Shortlink Auto-Bypasser v4.0 | none | confidence-scoring idea, extra destination sources (reimplemented) |
| Smart Auto Redirect Scroll v1.3 | none | path-segment decoding, WPSafeLink JSON variant ideas (reimplemented) |
| [adsbypasser](https://github.com/adsbypasser/adsbypasser) | BSD-2-Clause | host lists for small shorteners, image hosters and file hosters (absorbed into generic rules, no code ported); `forumdinheiro` port (tRPC stage chain, `cur_url` body observation) |
