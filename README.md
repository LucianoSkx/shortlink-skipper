<div align="center">

# Shortlink Skipper

**Skip link shorteners automatically — countdowns, captchas, popups and all.**

A lean, extensible userscript that distills the best techniques from
eight bypass projects into one clean rule engine.

[![Validate](https://github.com/LucianoSkx/shortlink-skipper/actions/workflows/validate.yml/badge.svg)](https://github.com/LucianoSkx/shortlink-skipper/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Userscript managers](https://img.shields.io/badge/Violentmonkey%20·%20Tampermonkey-compatible-blue)

[**Install**](#install) · [How it works](#how-it-works) · [Safety](#built-in-safety) · [Privacy](#privacy--what-leaves-your-device) · [Extending](#adding-a-site-specific-rule) · [Credits](#credits)

</div>

---

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. Click the install link below — your manager picks it up automatically:

➡️ **[Install Shortlink Skipper](https://github.com/LucianoSkx/shortlink-skipper/raw/main/shortlink-skipper.user.js)**

> `https://github.com/LucianoSkx/shortlink-skipper/raw/main/shortlink-skipper.user.js`

Updates are automatic: every push to `main` reaches installed users.

## How it works

Instead of thousands of hardcoded per-site handlers, Shortlink Skipper runs a
small engine of **generic techniques** that cover most shorteners — they all
share the same templates.

<details open>
<summary><b>The 66 rules</b></summary>

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
| `external-service` | Hardened links (Linkvertise hard case, loot-links, admaven): queries the free trw.lat bypass API for an instant destination, falling back to the [bypass.tools](https://bypass.tools) resolver |
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
| `captcha-manual` | Watches hCaptcha/reCAPTCHA/Turnstile; auto-submits **after you solve** |
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

</details>

### Global protections

- **Timer boost** — countdowns run up to 15× faster on shortener pages
- **Popup shield** — `window.open` is neutralized
- **Focus lock** — the tab never reports being unfocused
- **Anti-adblock banners removed**, right-click/copy/select restored
- **Anti-loop** — circular redirects abort via session history

### Detection engine

A page counts as a shortener when strong structural markers exist
(`form#go-link`, `ad_form_data`, invisible captchas...) **or** when at least
two soft indicators match: countdown text, action buttons, URL patterns,
meta refresh, loader/timer elements. Engagement task-walls ("spend N minutes",
social unlockers) are detected and deliberately left alone — they validate
server-side and cannot be skipped locally.

## Built-in safety

- Top frame only; iframes never touched
- Google, YouTube, hCaptcha/reCAPTCHA and Cloudflare are hard-excluded
- Captcha widgets are never solved or tampered with — only observed
- Per-domain on/off switch in the userscript menu
- Cloudflare challenges pass untouched (verified live)

## Privacy — what leaves your device

Local storage (never uploaded): `verbose`, `disabled_hosts`, `sl_stats`,
`sl_fp_reports`, `sl_resolver_breakers` — all in the userscript manager's GM
storage on this machine only.

Network calls that **can send the current page URL** (or a payload derived
from it) to a third party, only when the matching rule fires:

| Destination | When | What is sent |
| --- | --- | --- |
| [trw.lat](https://trw.lat) | `external-service` / lootlabs API fallback (keyless, no credentials) | Current URL (and, for lootlabs, the WebSocket `r:` payload) |
| [bypass.tools](https://bypass.tools) | Delegation after trw.lat fails or is skipped | Current URL in `?url=` (browser navigation) |
| [adbypass.org](https://adbypass.org) | `service-last-resort` after bypass.tools stalls | Current URL in `?bypass=` (browser navigation) |
| [bypass.city](https://bypass.city) | `bypass-city` fallback | Current URL in `?bypass=` (via `GM_xmlhttpRequest`) |
| [api.rekonise.com](https://api.rekonise.com) | `rekonise` rule | Pathname only (`/social-unlocks…/unlock`) |
| Loot-link action/sync endpoints | `lootlink-local` (site's own ad network) | Bypass bookkeeping expected by that site |
| [bypass.link](https://bypass.link) | Menu command only (manual) | You paste the URL yourself after the tab opens |

Ordinary pages never call any of the above: the gate exits before rules run.
Turn off a site with **Disable on this site** if you do not want outbound
requests from that domain.

## Menu commands

Right-click the userscript icon (or open the manager's script menu) to access:

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
npm test                          # run the unit tests (node --test tests/*.test.js)
node --check shortlink-skipper.user.js   # syntax check (also run by CI)
```

The unit tests load the userscript in a `vm` sandbox with mocked
`location`/`document` (no headless browser needed for most cases):

- `tests/shortlink-skipper.test.js` — loads without error, registers the menu, does not interfere with Cloudflare challenges
- `tests/handlers.test.js` — exercises `handleLinkvertiseEasy`, `handleAdLinkFly`, `handleBypassCity` and `BYPASS_SERVICE_URL`
- `tests/lean.test.js` — confirms `main()` does not install heavy hooks on normal pages and that `setc-form` no longer triggers a 4s wait

CI runs the syntax check, the metadata check, a syntax check of the live
harness files and `npm test` on every push to `main` and on every pull request.

### Live integration harness

`test-live/` ships mock shortlink pages plus a CDP client for end-to-end
validation in a real browser with Violentmonkey:

```bash
npm run test:live             # run all cases (needs CDP on :9222)
node test-live/run-all.js     # same runner; filter: node test-live/run-all.js form
node test-live/live.js        # single case under the hood (html, expect, [host])
node test-live/server.js      # optional host-based mock (skiplink.io / linkvertise)
node test-live/test-server.js # optional route-based mock on :18999
```

Live tests are **not** part of the required CI job (they need a local browser
with CDP). CI only syntax-checks the harness so it cannot rot silently.

### Branch flow

- `main` is protected: PRs only, `Validate` must pass.
- Prefer short PRs into `main` (matches how the project has been shipping).
- Long-running work may use `dev`; after each merge to `main`, fast-forward
  `dev` so it never falls behind (`git push origin main:dev`).

### Releasing (manual smoke required)

There is no GitHub Releases pipeline (the old auto-release workflow was removed
in `d80a521`). Installed users update by polling `@updateURL`/`@downloadURL`
(raw file on `main`).

Before bumping `@version` and merging to `main`:

1. `node --check shortlink-skipper.user.js`
2. `npm test`
3. With Chrome/Chromium + Violentmonkey and CDP on `:9222`:
   `npm install && npm run test:live` — all cases must pass.
4. Spot-check one real shortener chain if you changed a host list or gate.
5. Bump `@version` in the userscript header (keep `package.json` in sync) and merge.

Techniques are distilled from other projects, reimplemented in this codebase's
rule format. See [Credits](#credits).

## Credits

| Source | License | What was taken |
| --- | --- | --- |
| [ADLbypasser v1.6](https://greasyfork.org/pt-BR/scripts/439469) by fir4tozden | MIT | ouo, adfoc, aylink-family, bcvc, skip-button-dest, AdLinkFly families |
| [ugiBypass v2.1.0](https://greasyfork.org/en/scripts/584507) by ugilabs | MIT | token-link, zafree-link-view, setc-form, bcvc flow, `#y` fallback |
| [bypass-all-shortlinks-debloated](https://codeberg.org/Amm0ni4/bypass-all-shortlinks-debloated) by Amm0ni4 | mixed | acortalink, bstlar, linkvertise-easy, external-service concepts (AdGuard/FastForward lineage) |
| [nOneCode4u/bypass-shortlinks](https://github.com/nOneCode4u/bypass-shortlinks) | Unlicense | network capture technique |
| [BypassTools v5](https://bypass.tools) by BypassTools, EAS, Woozie & jiggey | MIT | bypass.tools as second-level resolver for hardened links |
| Universal Shortlink Auto-Bypasser v4.0 | none | confidence-scoring idea, extra destination sources (reimplemented) |
| Smart Auto Redirect Scroll v1.3 | none | path-segment decoding, WPSafeLink JSON variant ideas (reimplemented) |
| [adsbypasser](https://github.com/adsbypasser/adsbypasser) | BSD-2-Clause | host lists for small shorteners, image hosters and file hosters (absorbed into generic rules, no code ported) |
