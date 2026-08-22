<div align="center">

# Shortlink Skipper

**Skip link shorteners automatically — countdowns, captchas, popups and all.**

A lean, extensible userscript that distills the best techniques from
eight popular bypass projects into one clean rule engine.

[![Validate](https://github.com/LucianoSkx/shortlink-skipper/actions/workflows/validate.yml/badge.svg)](https://github.com/LucianoSkx/shortlink-skipper/actions/workflows/validate.yml)
[![Release](https://img.shields.io/github/v/release/LucianoSkx/shortlink-skipper)](https://github.com/LucianoSkx/shortlink-skipper/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Userscript managers](https://img.shields.io/badge/Violentmonkey%20·%20Tampermonkey-compatible-blue)

[**Install**](#install) · [How it works](#how-it-works) · [Safety](#built-in-safety) · [Extending](#adding-a-site-specific-rule) · [Credits](#credits)

</div>

---

## Install

| Step | |
| --- | --- |
| 1 | Install [Violentmonkey](https://violentmonkey.github.io/) or Tampermonkey |
| 2 | Open the install link below — your manager picks it up automatically |

```text
https://github.com/LucianoSkx/shortlink-skipper/raw/main/shortlink-skipper.user.js
```

Updates are automatic: every push to `main` reaches installed users.

## How it works

Instead of thousands of hardcoded per-site handlers, Shortlink Skipper runs a
small engine of **generic techniques** that cover most shorteners — they all
share the same templates.

<details open>
<summary><b>The 27 rules</b></summary>

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
| `single-external-link` | Redirects when exactly one plausible external exit exists |
| `external-service` | Hardened links (Linkvertise hard case, loot-links, admaven): if a trw.lat API key is configured via the menu, queries it for an instant destination, otherwise (and on API failure) falls back to the [bypass.tools](https://bypass.tools) resolver |
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
node --check shortlink-skipper.user.js   # what CI runs
```

**Releasing**: bump `@version` in the userscript and push to `main` — the
[Auto Release workflow](.github/workflows/auto-release.yml) tags the commit
and publishes a GitHub release with the script attached automatically.

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
