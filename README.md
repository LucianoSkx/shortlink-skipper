# Shortlink Skipper

A userscript that automatically skips link shorteners. Inspired by the concept of [Bypass All Shortlinks](https://greasyfork.org/pt-BR/scripts/431691) and its [Manual Captcha variant](https://openuserjs.org/scripts/Bloggerpemula/Bypass_All_Shortlinks_Manual_Captcha), but written from scratch with a lean, extensible architecture.

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/) or Tampermonkey.
2. Install the script through this link (the extension opens the install prompt automatically):

   <https://github.com/LucianoSkx/shortlink-skipper/raw/main/shortlink-skipper.user.js>

   Or create a new script manually and paste the contents of `shortlink-skipper.user.js`.

## How it works

Instead of keeping thousands of per-site rules, it relies on generic tools that cover most shorteners (they share the same templates):

| Rule | What it does |
| --- | --- |
| `ouo` | ouo.io/press/today: submits `#form-captcha`/`#form-go` in a loop until the step advances; ouo.today uses the `nextUrl` global |
| `adfoc` | adfoc.us, adf.ly, clk.sh, shrink.pe: redirects via the `click_url` global or the hidden `#y` input |
| `aylink-family` | aylink.co and friends: exchanges `_a/_t/_d` for a token at `/get/tk` and finishes at `/links/go2` |
| `bcvc` | bc.vc/bcvc.live/xyz/go: clicks `#getLink` after the countdown and POSTs `/ln.php` with the page's obfuscated globals (skips publisher panel pages) |
| `skip-button-dest` | hurirk/usfinf/xervoo: extracts the destination from `#skip_bu2tton` (the `dest=` param) and resolves `/ad/locked` |
| `token-link` | Token shorteners (tpi.li, oii.la, tei.ai, tii.ai, iir.ai, oko.sh): decodes the base64 `input[name="token"]` (or its base64 tail) into the destination, falling back to an enabled `.get-link` anchor |
| `zafree-link-view` | za.gl/za.uy: fills the link-view coordinates challenge and submits it |
| `setc-form` | Any page with a `form#setc`: follows its action directly |
| `acortalink` | acortalink.me: turns popups into same-tab redirects, spoofs the countdown through postMessage and clicks the final button |
| `bstlar` | bstlar.com: intercepts the "tasks" XHR and marks the task as completed on the API to receive the destination |
| `linkvertise-easy` | linkvertise.com with a base64 `?r=` param: decodes it and goes straight to the destination |
| `external-service` | Sites without a known local bypass (Linkvertise hard case, loot-links, admaven): delegates to the public service [adbypass.org](https://adbypass.org) |
| `url-destination` | Extracts `?url=`, `?u=`, `?go=` etc. from the address bar (with base64/hex decoding) and goes straight to the destination || `adlinkfly` | The AdLinkFly template (used by ~20 shorteners: exey.io, fc-lc.com, shrinkme, stfly.me, pnd.*, urlcik...): serializes the hidden fields and POSTs to `/links/go`, with retries |
| `adlinkfly-captcha` | Clicks the invisible captcha (`#invisibleCaptchaShortlink`) as soon as it becomes enabled |
| `go-link-form` | Finds `form#go-link`, waits for the button to unlock and submits/clicks it on its own |
| `wpsafelink` | The WordPress WPSafeLink template: clicks the landing button, waits for the timer to hit zero, calls `wpsafegenerate()` and extracts the final link |
| `captcha-manual` | If hCaptcha/reCAPTCHA/Turnstile is present, waits for you to solve it manually (up to 3 min) then auto-submits the form/button — never touches the captcha itself |
| `math-captcha` | Solves "12 + 7 = ?"-style captchas and fills in the field |
| `final-button` | Automatically clicks "Get Link", "Continue", "Skip" etc. |
| `single-external-link` | If the page has only one plausible external link, redirects to it. Scans anchors, inline JS assignments (`location.href =`, `location.replace(`, `url =`...), `meta[http-equiv=refresh]`, `data-url/href/link/destination` attributes and hidden inputs |

On top of the rules, global protections apply:

- **Confidence-based detection** — a page counts as a shortener when strong structural markers are present (known forms/captchas) or when at least 2 soft indicators match: countdown text, action buttons, URL patterns (`/go/`, `/out/`, "short"/"safelink" hosts), meta refresh or loader/spinner/timer elements

- **Boosted timers** — countdowns run up to 15x faster on pages that look like shorteners
- **Popups blocked** — `window.open` becomes a no-op
- **Focus restored** — the page never "loses focus" (defeats inactive tab detection)
- **Anti-adblock banners removed**
- **Interactions unlocked** — right-click, copy and text selection work again
- **Anti-loop** — keeps a session navigation history; if it detects a circular redirect, it aborts

## Built-in safety

- Runs only on the top frame (`window.top`)
- Exclusion list: Google, YouTube, hCaptcha/reCAPTCHA and Cloudflare are never touched
- Timer boosting and auto-click only activate when the page looks like a shortener (`form#go-link` or phrases like "please wait")
- The userscript menu lets you **disable it per domain** with one click

## Adding a site-specific rule

For a site with its own behavior, add an object to `GENERIC_RULES`:

```js
{
  name: 'my-site',
  when: () => /mysite\.example/.test(location.host),
  run: async () => {
    const dest = await waitFor(() =>
      document.querySelector('#token')?.value);
    return goto(`https://final.destination/?t=${encodeURIComponent(dest)}`);
  },
}
```

The first rule that acts ends the flow — put the most specific ones first.

## Development

Validate syntax after edits:

```
node --check shortlink-skipper.user.js
```

## Credits

The `ouo`, `adfoc`, `aylink-family`, `bcvc`, `skip-button-dest`, `adlinkfly` and `adlinkfly-captcha` families are ports of the handlers from [ADLbypasser v1.6](https://greasyfork.org/pt-BR/scripts/439469) by [fir4tozden](https://greasyfork.org/pt-BR/users/932504-fir4tozden), licensed under **MIT** — rewritten into this project's rule format.

The `acortalink`, `bstlar`, `linkvertise-easy`, `external-service` families and the infrastructure filter of the link detector are inspired by the techniques from Amm0ni4's fork [bypass-all-shortlinks-debloated](https://codeberg.org/Amm0ni4/bypass-all-shortlinks-debloated) (which itself credits AdGuard Team and FastForward), reimplemented from scratch here.

The `token-link`, `zafree-link-view`, `setc-form` families, plus the improved `bcvc` flow (#getLink click, panel-page skip) and the `#y` fallback of `adfoc`, are distilled from [ugiBypass v2.1.0](https://greasyfork.org/en/scripts/584507) by [ugilabs](https://greasyfork.org/en/users/1993234-ugilabs), licensed under **MIT** — rewritten into this project's rule format.
