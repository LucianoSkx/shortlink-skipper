<div align="center">

# Shortlink Skipper

**Skip link shorteners automatically — countdowns, captchas, popups and all.**

A lean, extensible userscript that distills the best techniques from
eight bypass projects into one clean rule engine.

[![Validate](https://github.com/LucianoSkx/shortlink-skipper/actions/workflows/validate.yml/badge.svg)](https://github.com/LucianoSkx/shortlink-skipper/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Userscript managers](https://img.shields.io/badge/Violentmonkey%20·%20Tampermonkey-compatible-blue)

[**Install**](#install) · [How it works](#how-it-works) · [Safety](#built-in-safety) · [Extending](#adding-a-site-specific-rule) · [Credits](#credits)

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
<summary><b>The 33 rules</b></summary>

| Rule | Technique |
| --- | --- |
| `ouo` | Submits `#form-captcha` / `#form-go` in a loop until each stage advances (`ouo.today` uses the `nextUrl` global) |
| `adfoc` | Follows `click_url` / hidden `#y` input (`adfoc.us`, `adf.ly`, `clk.sh`, `shrink.pe`) |
| `aylink-family` | Exchanges `_a/_t/_d` for a token at `/get/tk`, finishes at `/links/go2` |
| `bcvc` | Clicks `#getLink` after countdown, POSTs `/ln.php` with page globals |
| `skip-button-dest` | Reads `dest=` from `#skip_bu2tton`; resolves `/ad/locked` hops |
| `acortalink` | Spoofs `postMessage("__done__")` to defeat the counter, clicks through |
| `bstlar` | Intercepts the tasks XHR, marks steps complete on their API |
| `token-link` | Decodes base64 `input[name=token]` (or its tail) into the destination |
| `zafree-link-view` | Fills za.gl's coordinate challenge and submits |
| `setc-form` / landing forms | Follows `form#setc` action; decodes base64 `go` field on `form#landing` |
| `boost-ink` | Fetches own source, decodes payload behind internal marker key |
| `lootlabs` | WebSocket hook at document-start; decodes `r:` payloads (base64url + XOR) |
| `rekonise` | Calls the social-unlock API directly |
| `mboost` | Pulls escaped `"targeturl"` from page source |
| `url-destination` | Base64/hex destinations in query params *and* path segments (`/goto/<b64>`) |
| `adlinkfly` | Serializes hidden fields, POSTs `/links/go` with adaptive retries |
| `adlinkfly-captcha` | Clicks `#invisibleCaptchaShortlink` when it enables |
| `go-link-form` | Waits out the timer, then submits/clicks `form#go-link` |
| `wpsafelink` | Full WPSafeLink flow incl. JSON variant (`atob(input).linkr`) |
| `captcha-manual` | Watches hCaptcha/reCAPTCHA/Turnstile; auto-submits **after you solve** |
| `math-captcha` | Solves "12 + 7 = ?"-style questions |
| `final-button` | Clicks unlocked "Get Link" / "Continue" buttons |
| `network-capture` | Hooks fetch/XHR; follows destination-shaped JSON responses |
| `image-host` | Image hosters: strips overlays, follows the direct image link/anchor |
| `file-host` | File hosters: waits out the timer, clicks the free-download control |
| `single-external-link` | Redirects when exactly one plausible external exit exists |
| `external-service` | Hardened links (Linkvertise hard case, loot-links, admaven): queries the free trw.lat bypass API for an instant destination, falling back to the [bypass.tools](https://bypass.tools) resolver |
| `service-last-resort` | If even bypass.tools fails on a delegated link, forwards the job to adbypass.org |

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

## Menu commands

Right-click the userscript icon (or open the manager's script menu) to access:

| Command | What it does |
| --- | --- |
| **Disable on this site** / **Enable on this site** | Toggles the script for the current domain only |
| **Debug logs: ON/OFF** | Toggles verbose console logging (on by default) |
| **Open in bypass.link (manual fallback)** | Copies the current URL and opens [bypass.link](https://bypass.link) — it requires its own hCaptcha, so this is a manual escape hatch when every automatic level failed |

The `external-service` rule queries the built-in free **trw.lat** bypass API for
hardened links (Linkvertise hard case, loot-links, admaven), falling back to
[bypass.tools](https://bypass.tools).

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

CI runs the syntax check, the metadata check and `npm test` on every push to
`main` and on every pull request.

### Live integration harness

`test-live/` ships a mock server (AdLinkFly / Linkvertise) plus a CDP client
for end-to-end validation in a real browser with Violentmonkey:

```bash
node test-live/server.js     # start the mock shortlink servers
node test-live/cdp-client.js  # drive the browser via CDP and assert the redirect
```

**Releasing**: bump `@version` in the userscript and push to `main` — there is
no GitHub Releases pipeline (the old auto-release workflow was removed in
`d80a521`). Installed users still update automatically: userscript managers
poll the `@updateURL`/`@downloadURL`, which points at the raw file on `main`.

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
