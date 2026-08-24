// ==UserScript==
// @name         Shortlink Skipper
// @namespace    https://github.com/luciano
// @version      1.10.5
// @description  Automatically skips link shorteners: speeds up countdowns, clicks final buttons, extracts the destination from the URL, blocks popups and anti-adblock warnings.
// @author       Luciano
// @license      MIT
// @match        *://*/*
// @exclude      *://*.google.com/*
// @exclude      *://mail.google.com/*
// @exclude      *://*.gmail.com/*
// @exclude      *://*.microsoft.com/*
// @exclude      *://*.outlook.com/*
// @exclude      *://*.live.com/*
// @exclude      *://*.hotmail.com/*
// @exclude      *://*.yahoo.com/*
// @exclude      *://*.icloud.com/*
// @exclude      *://*.paypal.com/*
// @exclude      *://*.itau.com.br/*
// @exclude      *://*.bb.com.br/*
// @exclude      *://*.bradesco.com.br/*
// @exclude      *://*.caixa.gov.br/*
// @exclude      *://*.nubank.com.br/*
// @exclude      *://*.santander.com.br/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @downloadURL  https://github.com/LucianoSkx/shortlink-skipper/raw/main/shortlink-skipper.user.js
// @updateURL    https://github.com/LucianoSkx/shortlink-skipper/raw/main/shortlink-skipper.user.js
// ==/UserScript==

(function () {
  'use strict';

  const PAGE = unsafeWindow;
  let VERBOSE = GM_getValue('verbose', true);

  const EXCLUDE_HOSTS = [
    /(^|\.)google\./,
    /(^|\.)gmail\.com$/,
    /(^|\.)googlemail\.com$/,
    /(^|\.)youtube\.com$/,
    /(^|\.)youtube-nocookie\.com$/,
    /(^|\.)recaptcha\.net$/,
    /(^|\.)hcaptcha\.com$/,
    /(^|\.)cloudflare\.com$/,
  ];

  const SHORTLINK_HINTS =
    /please wait|generating link|your link is (almost )?ready|will be redirected|shortened|skip ad|continue to (your )?(destination|link)|click here to continue/i;

  const GO_LINK_FORM = 'form#go-link, form.go-link, form[id*="go-link"], form[class*="go-link"]';

  const BUTTON_TEXTS =
    /(\b(get|show|open|unlock)\s+(the\s+)?(final\s+)?link\b|\bget\s+link\b|^continue$|^skip$|^skip ad$|^proceed$|click here to continue|verif(y|ication) complete)/i;

  const DEST_PARAMS = [
    'url', 'u', 'go', 'target', 'dest', 'destination', 'redirect',
    'redirect_uri', 'redirect_url', 'r', 'redir', 'link', 'out', 'to',
    'continue', 'next', 'forward', 'jump', 's', 'safe', 'shortid', 'id',
  ];

  const ADBLOCK_BANNER =
    /(disable|turn off|deactivate).{0,24}ad.?block|ad.?block(er)? (is |was )?(detect|enabled|activ)|we.{0,10}ve detected.{0,20}ad.?block|whitelist (us|this site)/i;

  const TASK_WALL_HINTS =
    /spend\s+\d+\s*(minutes?|seconds?)\s+on\s+(the\s+)?(website|site)|visit\s+(multiple|several)\s+pages|come\s+back\s+to\s+this\s+page|complete\s+the\s+verification\s+process\s+in\s+the\s+other\s+tab|complete\s+the\s+actions\s+and\s+unlock\s+the\s+link|steps?\s+completed\s+\d+\s*\/\s*\d+|please\s+like\s+and\s+subscri/i;

  const OUO_HOST = /(^|\.)ouo\.(io|press|today)$|(^|\.)uii\.io$/;
  const ADFOC_FAMILY =
    /(adfoc\.us|adf\.ly|clk\.sh|shrink\.pe)$/;
  const AYLINK_HOST =
    /(aylink\.co|yindex\.xyz|gitizle\.vip|uzunversiyon\.xyz|shtms\.co|findi\.pro|gitlink\.pro)$/;
  const BCVC_HOST = /(^|\.)bcvc\.(live|xyz|go)$|(bcvcgo)\.xyz$/;
  const SKIP_BUTTON_HOST = /(hurirk\.net|usfinf\.net|xervoo\.net)$/;
  const CLOSE_INTERSTITIAL_HOST = /(^|\.)?(doaipomer\.com|ppcnt\.net|lnkparts\.com|zunsoach\.com)$/;
  const REKONISE_HOST = /(^|\.)rekonise\.com$/;
  const MBOOST_HOST = /(^|\.)mboost\.me$/;
  const LOOTLABS_HOST = /(^|\.)links\.lootlabs\.gg$/;
  const LOOTLINK_HOST = /(?:loot-link\.com|loot-links\.com|lootlink\.org|lootlinks\.co|lootdest\.(?:info|org|com)|links-loot\.com|linksloot\.net|(?:bleleadersto|tonordersitye|daughablelea|mdlinkshub)\.com|links\.lootlabs\.gg)$/;
  const ACORTALINK_HOST = /(^|\.)acortalink\.me$/;
  const BSTLAR_HOST = /(^|\.)bstlar\.com$/;
  const LINKVERTISE_HOST = /(^|\.)linkvertise\.(com|net)$/;
  const ADLINKFLY_HOSTS =
    /(^|\.)(shortly\.xyz|shortmoz\.link|wadooo\.com|lnk\.news|uiz\.io|uiz\.app|tik\.lat|tlkm\.id|sfile\.mobi|skiplink\.io|link-to\.net|gplinks\.in|paster\.so|earnmm\.com|cutwin\.co|pixls\.co|socialwolvez\.com|xslinks\.com|apkpsp\.com)$/;
  const TOKEN_HOST = /(tpi\.li|oii\.la|tei\.ai|tii\.ai|iir\.ai|oko\.sh)$/;
  const ZAFREE_HOST = /(^|\.)za\.(gl|uy)$/;
  // Curated from adsbypasser's src/sites (BSD-2-Clause) -- families our generic
  // rules already handle once the gate lets them through.
  const EXTRA_SHORTENER_HOSTS =
    /(^|\.)(1ink\.cc|1link\.club|a2zapk\.io|adshnk\.com|anchoreth\.com|bcvc\.ink|binbox\.io|cpmlink\.net|cutpaid\.com|cuttty\.com|exeo\.app|fir3\.net|gplinks\.co|icutlink\.com|kingofshrink\.com|linkpoi\.me|linkshrink\.net|lnk2\.cc|network-loop\.com|stfly\.me|stly\.link|thinfi\.com|tutwuri\.id)$/;
  const IMAGE_HOSTS =
    /(^|\.)(bayimg\.com|beeimg\.com|casimages\.com|cubeupload\.com|depic\.me|directupload\.eu|fastpic\.org|fotosik\.pl|hostpic\.org|ibb\.co|im\.ge|imagebam\.com|imageban\.ru|imagenetz\.de|imageshack\.com|imagetwist\.com|imageup\.ru|imagevenue\.com|imgair\.net|imgbase\.ru|imgbb\.com|imgpv\.com|imgtraffic\.com|imx\.to|keptarolo\.hu|pic-upload\.de|picstate\.com|pimpandhost\.com|pixhost\.to|postimages\.org|turboimagehost\.com|3xplanet\.com)$/;
  const FILE_HOSTS =
    /(^|\.)(ak\.sv|apunkasoftware\.net|thefileslocker\.net|katfile\.vip|keeplinks\.org|mirrored\.to|multiup\.io|uploadhaven\.com|uploadrar\.com|usersdrive\.com)$/;
  const SETC_FORM = 'form#setc';
  const BYPASS_SERVICE_URL =
    /^https?:\/\/(?:(?:loot-link\.com|loot-links\.com|lootlink\.org|lootlinks\.co|lootdest\.(?:info|org|com)|links-loot\.com|linksloot\.net|(?:bleleadersto|tonordersitye|daughablelea|mdlinkshub)\.com)\/s[\/?].+|linkvertise\.(?:com|net)\/.+|links\.lootlabs\.gg\/.+|(?:work\.ink|r\.work\.ink|workink\.(?:net|one|me)|lockr\.so|lockr\.net|mboost\.me|sub2get\.com|ytsubme\.com|esohasl\.net|rbscripts\.net|link\.rbscripts\.net|cuty\.io|unlocknow\.net|sub2unlock\.(?:com|io|net|online|top)|sub4unlock\.(?:com|io|pro)|social-unlock\.com|key-access\.co|discordlink\.cc|link-target\.(?:net|org)|vip-linknetwork\.com|link-to\.net|paster\.so|gplinks\.in)\/.+)/;
  const INFRA_HOST =
    /googleapis|gstatic|jsdelivr|unpkg|cdnjs|cloudflare|fontawesome|jquery|bootstrapcdn|w3\.org|schema\.org|gravatar|recaptcha|hcaptcha|youtube|youtu\.be|vimeo|dailymotion|twitch|spotify|soundcloud|doubleclick|googlesyndication|googletagmanager|google-analytics|adservice|adsystem|amazon-adsystem|facebook|fbcdn|instagram|cdninstagram|twitter|x\.com|twimg|tiktok|pinterest|reddit|telegram|t\.me|discord|whatsapp|github|gitlab|codepen|stackexchange|wikipedia|trustpilot|patreon|ko-fi|buymeacoffee|opencollective|gumroad|wordpress/i;

  const SOCIAL_HOST =
    /(^|\.)(twitter\.com|x\.com|facebook\.com|fb\.me|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|discord\.gg|discord\.com|t\.me|telegram\.me|linkedin\.com|reddit\.com|pinterest\.com|bsky\.app)$/;

  function disabled() {
    const off = GM_getValue('disabled_hosts', {});
    return Boolean(off[location.host]);
  }

  function log(...args) {
    if (!VERBOSE) return;
    console.log(`%c[ShortlinkSkipper]`, 'color:#7c4dff;font-weight:bold', new Date().toLocaleTimeString(), ...args);
  }

  function excluded() {
    const host = location.host.toLowerCase();
    return EXCLUDE_HOSTS.some((re) => re.test(host));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Reads a global variable from the page context. SECURITY: `name` MUST be a
  // fixed string literal supplied by our own code (e.g. readGlobal('p', ...)).
  // Never pass external/page-derived data as `name` -- it is interpolated into an
  // injected <script>, so a tainted value would become arbitrary code execution.
  async function readGlobal(name, valid) {
    if (typeof name !== 'string' || !/^[A-Za-z0-9_$]+$/.test(name)) return null;
    for (let i = 0; i < 40; i++) {
      try {
        const s = document.createElement('script');
        s.textContent = `document.documentElement.setAttribute('data-rg-${name}', JSON.stringify(typeof ${name} !== 'undefined' ? ${name} : null));`;
        document.documentElement.appendChild(s);
        s.remove();
        const raw = document.documentElement.getAttribute(`data-rg-${name}`);
        if (raw) {
          const v = JSON.parse(raw);
          if (valid ? valid(v) : v) return v;
        }
      } catch (e) {}
      await sleep(200);
    }
    return null;
  }

  async function waitFor(test, timeout = 15000, interval = 250) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      let found = null;
      try {
        found = typeof test === 'function' ? test() : document.querySelector(test);
      } catch {}
      if (found) return found;
      await sleep(interval);
    }
    return null;
  }

  function visible(el) {
    if (!el || el.disabled || el.hidden) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function fireEvent(el, type, Ctor = MouseEvent) {
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: PAGE }));
  }

  function fireClick(el) {
    try {
      el.scrollIntoView({ block: 'center' });
    } catch {}
    const opts = { bubbles: true, cancelable: true, view: PAGE };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    fireEvent(el, 'mousedown');
    fireEvent(el, 'mouseup');
    fireEvent(el, 'click');
  }

  function clickWhen(selector, timeout = 20000) {
    return waitFor(
      () => {
        const el = typeof selector === 'function' ? selector() : document.querySelector(selector);
        return visible(el) ? el : null;
      },
      timeout,
    ).then((el) => {
      if (el) {
        log('clicking', el.tagName, el.className || '');
        fireClick(el);
      }
      return Boolean(el);
    });
  }

  function findByText(pattern) {
    const candidates = [...document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], div[onclick], span[onclick]')];
    return candidates.find((el) => {
      if (!visible(el)) return false;
      const label = (el.innerText || el.value || '').trim();
      return label && pattern.test(label);
    });
  }

  function decodeMaybe(value) {
    let current = String(value).trim();
    for (let i = 0; i < 3; i++) {
      if (/^https?:\/\//i.test(current)) break;
      let next = null;
      try {
        next = decodeURIComponent(current);
      } catch {}
      if (!next || next === current) {
        try {
          const b64 = current.replace(/-/g, '+').replace(/_/g, '/');
          const decoded = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
          if (/^[\x20-\x7e]+$/.test(decoded)) next = decoded;
        } catch {}
      }
      if (!next || next === current) break;
      current = next;
    }
    return current;
  }

  function sameAsCurrent(url) {
    try {
      const a = new URL(url);
      const b = new URL(location.href);
      return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search;
    } catch {
      return true;
    }
  }

  function isPlausibleUrl(v) {
    try {
      const u = new URL(v);
      return (u.protocol === 'http:' || u.protocol === 'https:') && u.host.includes('.');
    } catch {
      return false;
    }
  }

  function goto(url) {
    if (!isPlausibleUrl(url)) return false;
    const target = new URL(url).href;
    if (sameAsCurrent(target)) return false;
    // Redirect-chain state machine. Invariants:
    //   1. never navigate to the current destination  (sameAsCurrent above)
    //   2. never accept a cycle                       (target already visited)
    //   3. never allow an endless chain               (hop budget)
    // The entry URL is seeded once per tab so returning to it also counts as
    // a cycle (A->B->C->A).
    const KEY = 'sl_skipper_nav';
    const MAX_HOPS = 10;
    let history = [];
    try {
      history = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    } catch {}
    if (history.length === 0) {
      try {
        history.push(new URL(location.href).href);
      } catch {}
    }
    if (history.length > MAX_HOPS) {
      log('redirect chain exceeded', MAX_HOPS, 'hops, aborting:', target);
      return false;
    }
    if (history.includes(target)) {
      log('redirect loop detected, aborting:', target);
      return false;
    }
    history.push(target);
    try {
      // Keep one extra entry so the budget check can observe the overflow.
      sessionStorage.setItem(KEY, JSON.stringify(history.slice(-(MAX_HOPS + 1))));
    } catch {}
    log('going to', target);
    location.href = target;
    return true;
  }

  let _shortishCache = null;
  function looksLikeShortlink(doc = document) {
    if (doc === document && _shortishCache !== null) return _shortishCache;
    const structural = doc.querySelector(GO_LINK_FORM) ||
      doc.querySelector('input[name="ad_form_data"], #invisibleCaptchaShortlink, #wpsafegenerate, .wpsafelink-button');
    if (structural) return true;
    const text = (doc.body?.innerText || '').slice(0, 4000);
    let score = 0;
    if (SHORTLINK_HINTS.test(text)) score += 1;
    if (/wait\s+\d+\s+second|countdown|\d+\s*s(econd)?s?( left| remaining)/i.test(text)) score += 1;
    try {
      if (findByText(BUTTON_TEXTS)) score += 1;
    } catch {}
    if (/\/(go|out|link|r)\/|(^|\.)(short|safelink)[a-z0-9-]*\./i.test(`${location.pathname} ${location.host}`)) score += 1;
    if (
      doc.querySelector('meta[http-equiv="refresh"]') ||
      doc.querySelector('.loader, .spinner, .loading, .countdown, [class*="timer" i], [id*="timer" i]')
    ) {
      score += 1;
    }
    const result = score >= 2;
    if (doc === document) _shortishCache = result;
    return result;
  }

  // Hosts that own dedicated rules must clear the generic gate even when the
  // page is an SPA that has not rendered any structural indicator yet --
  // Linkvertise hydrates late and used to be dismissed as "not a shortlink".
  function knownShortener() {
    return (
      LINKVERTISE_HOST.test(location.host) ||
      LOOTLINK_HOST.test(location.host) ||
      LOOTLABS_HOST.test(location.host) ||
      BSTLAR_HOST.test(location.host) ||
      ACORTALINK_HOST.test(location.host) ||
      OUO_HOST.test(location.host) ||
      ADFOC_FAMILY.test(location.host) ||
      /(^|\.)boost\.ink$/.test(location.host) ||
      AYLINK_HOST.test(location.host) ||
      REKONISE_HOST.test(location.host) ||
      MBOOST_HOST.test(location.host) ||
      BCVC_HOST.test(location.host) ||
      TOKEN_HOST.test(location.host) ||
      ZAFREE_HOST.test(location.host) ||
      ADLINKFLY_HOSTS.test(location.host) ||
      EXTRA_SHORTENER_HOSTS.test(location.host) ||
      BYPASS_SERVICE_URL.test(location.href)
    );
  }

  function knownMediaHost() {
    return IMAGE_HOSTS.test(location.host) || FILE_HOSTS.test(location.host);
  }

  // Generic follow-up rules (manual captcha, single external link, bypass.city)
  // must also run on hosts that own dedicated rules -- e.g. ouo's Turnstile
  // phase shows no structural marker until the human check is solved.
  function genericGate() {
    return looksLikeShortlink() || knownShortener();
  }

  function looksLikeTaskWall(doc = document) {
    const text = doc.body?.innerText || '';
    if (TASK_WALL_HINTS.test(text)) return true;
    return TASK_WALL_HINTS.test(doc.documentElement.outerHTML.slice(0, 200000));
  }

  function extractDestFromParams() {
    const params = new URLSearchParams(location.search);
    for (const name of DEST_PARAMS) {
      const values = params.getAll(name);
      for (const raw of values) {
        const decoded = decodeMaybe(raw);
        if (isPlausibleUrl(decoded)) return decoded;
      }
    }
    const hash = location.hash.replace(/^#\??/, '');
    if (hash.includes('=')) {
      const hashParams = new URLSearchParams(hash);
      for (const name of DEST_PARAMS) {
        const raw = hashParams.get(name);
        if (raw) {
          const decoded = decodeMaybe(raw);
          if (isPlausibleUrl(decoded)) return decoded;
        }
      }
    }
    const segments = location.pathname.split('/').filter(Boolean);
    for (const seg of segments.reverse()) {
      if (seg.length < 8) continue;
      const decoded = decodeMaybe(seg);
      if (isPlausibleUrl(decoded)) return decoded;
    }
    return null;
  }

  function findExternalExit() {
    // A site root (bare `/`, no query) never carries the destination of a
    // shortener — its lone external link is a footer/about/contact link.
    // Live evidence: spaste.com → gmail.com, stfly.me → wordpress.org.
    const barePath = location.pathname.replace(/\/+$/, '') === '';
    if (barePath && !location.search) return null;
    const here = location.host.toLowerCase();
    const isExternal = (raw) => {
      try {
        const u = new URL(raw);
        return /^https?:$/.test(u.protocol) &&
          u.host.toLowerCase() !== here &&
          !EXCLUDE_HOSTS.some((re) => re.test(u.host.toLowerCase())) &&
          !INFRA_HOST.test(u.host.toLowerCase());
      } catch {
        return false;
      }
    };
    const candidates = [];
    for (const a of document.querySelectorAll('a[href^="http"]')) {
      candidates.push(a.getAttribute('href'));
    }
    const inlineScripts = [...document.querySelectorAll('script:not([src])')]
      .map((s) => s.textContent)
      .join('\n');
    const assignmentPatterns = [
      /(?:window\.location(?:\.href)?|location(?:\.href)?)\s*=?\s*\(?\s*['"](https?:\/\/[^'"]+)['"]/gi,
      /location\.replace\(\s*['"](https?:\/\/[^'"]+)['"]/gi,
      /(?:url|link|destination|target|final_url|goto|next_url|continue_url)\s*[:=]\s*['"](https?:\/\/[^'"]+)['"]/gi,
    ];
    for (const pattern of assignmentPatterns) {
      for (const match of inlineScripts.matchAll(pattern)) candidates.push(match[1]);
    }
    const meta = document.querySelector('meta[http-equiv="refresh"]');
    if (meta) {
      const target = meta.getAttribute('content')?.match(/url=(.+)/i)?.[1];
      if (target) candidates.push(target.trim().replace(/^['"]|['"]$/g, ''));
    }
    for (const el of document.querySelectorAll('[data-url], [data-href], [data-link], [data-destination]')) {
      candidates.push(el.dataset.url || el.dataset.href || el.dataset.link || el.dataset.destination);
    }
    for (const input of document.querySelectorAll('input[type="hidden"]')) {
      if (/^https?:\/\//i.test(input.value)) candidates.push(input.value);
    }
    const external = [...new Set(candidates.filter(Boolean))].filter(isExternal);
    if (external.length === 1) {
      try {
        const u = new URL(external[0]);
        if (SOCIAL_HOST.test(u.host.toLowerCase())) {
          log('single-external-link: ignoring lone social/footer link', external[0]);
          return null;
        }
      } catch {}
      return external[0];
    }
    return null;
  }

  async function handleGoLinkForm() {
    const form = await waitFor(GO_LINK_FORM, 4000);
    if (!form) return false;
    log('go-link form found');
    const submitBtn = await waitFor(() => {
      const btn = form.querySelector('.get-link, button[type="submit"], button.btn-primary, input[type="submit"]') ||
        (BUTTON_TEXTS.test(form.innerText || '') ? form.querySelector('button, input[type="submit"]') : null);
      return visible(btn) ? btn : null;
    }, 45000, 400);
    if (submitBtn) {
      fireClick(submitBtn);
      return true;
    }
    if (visible(form)) {
      log('submitting form directly');
      form.submit();
      return true;
    }
    return false;
  }

  function gmGetJson(url) {
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== 'function') return resolve(null);
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout: 20000,
        onload: (res) => {
          try {
            resolve(JSON.parse(res.responseText));
          } catch {
            resolve(null);
          }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      });
    });
  }

  function gmGetText(url) {
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== 'function') return resolve(null);
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout: 20000,
        onload: (res) => resolve(typeof res.responseText === 'string' ? res.responseText : ''),
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      });
    });
  }

  async function handleExternalService() {
    if (!BYPASS_SERVICE_URL.test(location.href)) return false;
    log('hard site detected, trying direct bypass APIs');
    const data = await gmGetJson(
      'https://trw.lat/api/bypass?apikey=TRW_FREE-GAY-15a92945-9b04-4c75-8337-f2a6007281e9&url=' +
        encodeURIComponent(location.href),
    );
    if (
      data?.success &&
      typeof data.result === 'string' &&
      /^https?:\/\//i.test(data.result)
    ) {
      log('direct destination from bypass API');
      return goto(data.result);
    }
    log('API unavailable, delegating to bypass.tools');
    return goto(`https://bypass.tools/bypass?url=${encodeURIComponent(location.href)}`);
  }

  // ARCH DEBT (not a bug): the external cascade spans delegated pages
  // (trw.lat -> bypass.tools -> adbypass.org), each level relying on main()
  // re-running there. If more delegation hosts appear, collapse this into a
  // single resolveExternal(url) tried inline before navigating.
  async function handleServiceLastResort() {
    if (!/^bypass\.tools$/.test(location.host) || !location.search.includes('url=')) return false;
    log('em bypass.tools, aguardando resolucao antes do ultimo recurso');
    await sleep(5000);
    // Se o bypass.tools resolveu e redirecionou, o host (ou a query) muda e nao repassamos.
    if (!/^bypass\.tools$/.test(location.host) || !location.search.includes('url=')) {
      log('bypass.tools resolveu, nada a fazer');
      return false;
    }
    log('bypass.tools nao resolveu, ultimo recurso adbypass.org');
    return goto(`https://adbypass.org/bypass?bypass=${encodeURIComponent(location.href)}`);
  }

  async function handleBypassCity() {
    const html = await gmGetText(`https://bypass.city/bypass?bypass=${encodeURIComponent(location.href)}`);
    if (!html) return false;
    const links = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
    const dest = links.find((u) => {
      try {
        const hu = new URL(u).host.toLowerCase();
        return (
          hu !== location.host.toLowerCase() &&
          !/bypass\.city$/.test(hu) &&
          !INFRA_HOST.test(hu) &&
          !SOCIAL_HOST.test(hu) &&
          !EXCLUDE_HOSTS.some((re) => re.test(hu))
        );
      } catch {
        return false;
      }
    });
    if (dest) {
      log('bypass.city returned destination');
      return goto(dest);
    }
    return false;
  }

  async function handleButtons() {
    log('watching for sequential action buttons');
    let clicks = 0;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline && clicks < 6) {
      const btn =
        findByText(BUTTON_TEXTS) ||
        findByText(/\b(continue|proceed|free\s+download|download\s+now|get\s+link)\b/i);
      if (btn && visible(btn)) {
        fireClick(btn);
        clicks += 1;
        log(`action button #${clicks}:`, (btn.innerText || '').trim().slice(0, 40));
        await sleep(2500);
      } else {
        await sleep(1500);
      }
    }
    return clicks > 0;
  }

  async function handleWpSafeLink() {
    const jsonInput = document.querySelector('input[name="newwpsafelink"], #wpsafelink-landing input');
    if (jsonInput?.value) {
      try {
        const parsed = JSON.parse(atob(jsonInput.value));
        if (parsed?.linkr) {
          log('WPSafeLink JSON variant detected');
          return goto(parsed.linkr);
        }
      } catch {}
    }
    const marker = document.querySelector('#wpsafegenerate, .wpsafelink-landing, #wpsafe-generate, .wpsafelink-button');
    if (!marker) return false;
    log('WPSafeLink template detected');
    const stepBtn = await waitFor(() => {
      const b = document.querySelector('.wpsafelink-button');
      return b && visible(b) && !/please wait/i.test(b.innerText || '') ? b : null;
    }, 60000, 500);
    if (stepBtn) fireClick(stepBtn);
    if (typeof PAGE.wpsafegenerate === 'function') {
      await waitFor(() => {
        const timer = document.querySelector('.base-timer')?.innerText?.trim() || '';
        return timer.includes('0:00') || timer === '';
      }, 90000, 500);
      try {
        PAGE.wpsafegenerate();
      } catch {}
    }
    const link = await waitFor('#wpsafegenerate > #wpsafe-link > a[href], #wpsafe-link a[href]', 20000);
    if (link?.href) {
      log('WPSafeLink destination:', link.href);
      return goto(link.href);
    }
    return Boolean(stepBtn);
  }

  function captchaSolved() {
    try {
      if (typeof PAGE.grecaptcha?.getResponse === 'function' && PAGE.grecaptcha.getResponse()) return true;
      if (typeof PAGE.hcaptcha?.getResponse === 'function' && PAGE.hcaptcha.getResponse()) return true;
      if (typeof PAGE.turnstile?.getResponse === 'function' && PAGE.turnstile.getResponse()) return true;
    } catch {}
    return false;
  }

  function captchaPresent() {
    return Boolean(
      typeof PAGE.grecaptcha !== 'undefined' ||
      typeof PAGE.hcaptcha !== 'undefined' ||
      document.querySelector("iframe[src*='recaptcha'], iframe[src^='https://newassets.hcaptcha.com'], .cf-turnstile"),
    );
  }

  function cloudflareChallenging() {
    if (document.getElementById('cf-challenge-running')) return true;
    const cls = (document.documentElement.className + ' ' + (document.body?.className || '')).toLowerCase();
    if (/(^| )cf-challenge-running( |$)/.test(cls)) return true;
    if (/just a moment/i.test(document.title)) return true;
    if (document.querySelector('iframe[src*="challenges.cloudflare.com"]')) return true;
    if (document.querySelector('script[src*="challenges.cloudflare.com"], script[src*="cf-assets"]')) return true;
    return false;
  }

  async function handleManualCaptcha() {
    if (!captchaPresent()) return false;
    log('captcha present, waiting for manual solve...');
    const findActionable = () =>
      findByText(/\b(continue|proceed|get\s+link|free\s+download)\b/i) ||
      document.querySelector('.get-link:not([disabled]), button[type="submit"]:not([disabled]), input[type="submit"]');
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const ready = findActionable();
      if (ready && visible(ready)) {
        log('button already unlocked, clicking without waiting');
        fireClick(ready);
        return true;
      }
      if (captchaSolved()) {
        log('captcha solved by user, submitting');
        await sleep(800);
        const btn =
          findByText(/^(continue|verify|confirm|proceed|submit|get link)$/i) ||
          document.querySelector('.get-link:not([disabled]), button[type="submit"]:not([disabled]), input[type="submit"]');
        if (btn && visible(btn)) {
          fireClick(btn);
          return true;
        }
        const form = document.querySelector('form');
        if (form && visible(form)) {
          form.submit();
          return true;
        }
        break;
      }
      await sleep(1000);
    }
    return false;
  }

  function hiddenFields(scope) {
    const data = {};
    for (const input of scope.querySelectorAll('input[type="hidden"]')) {
      if (input.name) data[input.name] = input.value;
    }
    return data;
  }

  async function postForm(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
    return res.json().catch(() => null);
  }

  async function handleAdLinkFly() {
    const field = await waitFor(() => {
      const el = document.querySelector('input[name="ad_form_data"]');
      return el?.value ? el : null;
    }, 2500);
    if (!field) return false;
    log('AdLinkFly template detected');
    const form = field.closest('form') || field.parentElement;

    let first = true;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (!first) await sleep(5000);
      first = false;

      const json = await postForm('/links/go', hiddenFields(form)).catch(() => null);
      if (json?.url) {
        log('AdLinkFly: destination obtained');
        return goto(json.url);
      }

      const invisible = document.querySelector('#invisibleCaptchaShortlink');
      if (invisible && !invisible.disabled) fireClick(invisible);

      const ready = document.querySelector('a.get-link:not(.disabled)[href]');
      if (ready?.href && /^https?:\/\//i.test(ready.href)) {
        log('AdLinkFly: button unlocked by countdown');
        return goto(ready.href);
      }
    }
    log('AdLinkFly: no destination after retries');
    return false;
  }

  async function handleInvisibleCaptcha() {
    const btn = await waitFor('#invisibleCaptchaShortlink', 2500);
    if (!btn) return false;
    log('AdLinkFly invisible captcha detected');
    return clickWhen(() => (!btn.disabled ? btn : null), 60000);
  }

  function submitFormLoop(form, attempts = 30) {
    return new Promise((resolve) => {
      let done = 0;
      const timer = setInterval(() => {
        done += 1;
        if (!document.contains(form) || done >= attempts) {
          clearInterval(timer);
          resolve(!document.contains(form));
          return;
        }
        try {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          try {
            form.requestSubmit();
          } catch {}
        } catch {}
      }, 1000);
    });
  }

  async function handleOuo() {
    if (!OUO_HOST.test(location.host)) return false;
    if (location.hostname.endsWith('ouo.today')) {
      return typeof PAGE.nextUrl === 'string' ? goto(PAGE.nextUrl) : false;
    }
    const formId = location.pathname.startsWith('/go') ? '#form-go' : '#form-captcha';
    let form = await waitFor(formId, 8000);
    if (!form && captchaPresent()) {
      // New ouo flow: an interactive Turnstile gate precedes the form. Tell
      // the user, then keep waiting -- captcha-manual auto-submits on solve.
      log('human check first -- solve it and the bypass continues automatically');
      form = await waitFor(formId, 60000);
    }
    if (!form) return false;
    log('ouo.io detected, submitting in a loop:', formId);
    return submitFormLoop(form);
  }

  async function handleAdFoc() {
    if (!ADFOC_FAMILY.test(location.host)) return false;
    const fromGlobal = typeof PAGE.click_url === 'string' ? PAGE.click_url : null;
    if (fromGlobal) return goto(fromGlobal);
    return waitFor(() => document.getElementById('y')?.value, 15000, 400).then((url) =>
      url ? goto(url) : false,
    );
  }

  async function handleCloseInterstitial() {
    if (!CLOSE_INTERSTITIAL_HOST.test(location.host)) return false;
    log('interstitial-only page detected, closing tab');
    PAGE.close();
    return true;
  }

  async function handleRekonise() {
    if (!REKONISE_HOST.test(location.host)) return false;
    log('rekonise detected, querying unlock API');
    try {
      const res = await fetch(`https://api.rekonise.com/social-unlocks${location.pathname}/unlock`, {
        headers: { accept: 'application/json, text/plain, */*' },
      });
      const data = JSON.stringify(await res.json());
      const urls = data.match(/https?:\/\/[^\s"\\]+/g) || [];
      const dest = urls.find(
        (u) => !INFRA_HOST.test(u) && !/\.(png|jpe?g|gif|svg|webp|ico)(\?|$)/i.test(u),
      );
      return dest ? goto(dest) : false;
    } catch (error) {
      log('rekonise error:', error.message);
      return false;
    }
  }

  async function handleMboost() {
    if (!MBOOST_HOST.test(location.host)) return false;
    log('mboost detected, extracting targeturl from page source');
    const match = document.documentElement.outerHTML.match(/"targeturl\\":\\"(https?:\/\/[^\\"]+)/);
    return match ? goto(match[1]) : false;
  }

  function xorDecode(encoded, keyLength = 5) {
    try {
      let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const raw = atob(b64);
      const key = raw.slice(0, keyLength);
      const data = raw.slice(keyLength);
      let out = '';
      for (let i = 0; i < data.length; i++) {
        out += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return out || null;
    } catch {
      return null;
    }
  }

  let lootlabsResolved = false;
  let lootlabsApiTried = false;

  function installLootlabsWsHook() {
    if (PAGE.__slLootHooked) return;
    PAGE.__slLootHooked = true;
    const OriginalWebSocket = PAGE.WebSocket;
    function HookedWebSocket(url, protocols) {
      const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
      ws.addEventListener('message', (event) => {
        if (lootlabsResolved) return;
        if (typeof event.data !== 'string' || !event.data.startsWith('r:')) return;
        const payload = event.data.slice(2).trim();
        const decoded = xorDecode(payload);
        if (decoded && isPlausibleUrl(decoded.trim())) {
          lootlabsResolved = true;
          log('lootlabs destination intercepted (local decode)');
          goto(decoded.trim());
          return;
        }
        // Safe API fallback: ask trw.lat to decrypt the payload. Only the
        // resolved destination string is used (validated by isPlausibleUrl);
        // no remote code is ever executed.
        if (!lootlabsApiTried) {
          lootlabsApiTried = true;
          resolveLootlabsViaApi(payload);
        }
      });
      return ws;
    }
    Object.assign(HookedWebSocket, OriginalWebSocket);
    HookedWebSocket.prototype = OriginalWebSocket.prototype;
    PAGE.WebSocket = HookedWebSocket;
    log('lootlabs detected, WebSocket hooked');
  }

  async function resolveLootlabsViaApi(payload) {
    try {
      const data = await gmGetJson(
        'https://trw.lat/api/clientSides/lootlabs?payl=' +
          encodeURIComponent(payload) +
          '&pal=' +
          encodeURIComponent(location.href),
      );
      if (data && typeof data.pyl === 'string' && isPlausibleUrl(data.pyl)) {
        lootlabsResolved = true;
        log('lootlabs destination resolved via API');
        goto(data.pyl);
      }
    } catch {
      /* local decode already attempted; nothing else to do */
    }
  }

  async function handleLootlabs() {
    if (!LOOTLABS_HOST.test(location.host)) return false;
    await waitFor(() => document.querySelector('.ind-idle'), 30000, 500);
    const tasks = [...document.querySelectorAll('.ind-idle')]
      .map((el) => el.parentElement)
      .filter(Boolean);
    for (const [index, task] of tasks.entries()) {
      setTimeout(() => fireClick(task), index * 2000);
    }
    await waitFor(() => (lootlabsResolved ? true : null), 180000, 500);
    return lootlabsResolved;
  }

  async function handleAylink() {
    if (!AYLINK_HOST.test(location.host)) return false;
    const csrf = PAGE.app?.csrf;
    if (!csrf || typeof PAGE._a === 'undefined') return false;
    try {
      const tk = await postForm('/get/tk', { _a: PAGE._a, _t: PAGE._t, _d: PAGE._d });
      if (!tk?.th) return false;
      const alias = decodeURIComponent(location.pathname.replace(/^\/+/, '')).split('/')[0];
      const json = await postForm('/links/go2', { alias, csrf, tkn: tk.th });
      return json?.url ? goto(json.url) : false;
    } catch (error) {
      log('aylink-family error:', error.message);
      return false;
    }
  }

  async function handleBcVc() {
    if (!BCVC_HOST.test(location.host)) return false;
    if (/^\/(panel|member|auth|admin|api|static)\//.test(location.pathname) || /^\/?$/.test(location.pathname)) {
      return false;
    }
    const g = (key) => PAGE[key];
    const hasGlobals = [g('tZ'), g('cW'), g('cH'), g('tkn'), g('sW'), g('sH'), g('xyz')].every((v) => typeof v !== 'undefined');
    if (!hasGlobals && !document.querySelector('.bcvcCountDown, input#recaptchaToken, #getLink')) return false;
    log('bc.vc detectado');
    const token = document.querySelector('#recaptchaToken')?.value || '';
    if (hasGlobals) {
      postForm(`/ln.php?wds=${encodeURIComponent(String(g('xyz')))}`, {
        xdf: JSON.stringify({
          afg: g('tZ'),
          bfg: g('cW'),
          cfg: g('cH'),
          jki: g('tkn'),
          dfg: g('sW'),
          efg: g('sH'),
          rt: token,
        }),
        ojk: 'jfhg',
      }).then((json) => {
        const url = json?.message?.url ?? json?.message;
        if (typeof url === 'string') goto(url);
      });
    }
    const clicked = await clickWhen(() => {
      const btn = document.getElementById('getLink');
      return btn && !btn.disabled ? btn : null;
    }, 90000);
    return Boolean(clicked);
  }

  function decodeTokenValue(raw) {
    const tryB64 = (value) => {
      try {
        const decoded = atob(value);
        return /^https?:\/\//i.test(decoded) ? decoded : null;
      } catch {
        return null;
      }
    };
    const full = tryB64(String(raw).trim());
    if (full) return full;
    const tail = String(raw).match(/[A-Za-z0-9+/]{16,}={0,2}$/);
    return tail ? tryB64(tail[0]) : null;
  }

  async function handleTokenLink() {
    if (!TOKEN_HOST.test(location.host)) return false;
    log('token shortener detected');
    const resolved = await waitFor(() => {
      const input = document.querySelector('input[name="token"]');
      if (input?.value) {
        const url = decodeTokenValue(input.value);
        if (url) return { kind: 'url', value: url };
      }
      const link = document.querySelector('a.get-link:not(.disabled)[href]');
      if (link?.href && link.href !== location.href && !/^javascript:/i.test(link.href)) {
        return { kind: 'url', value: link.href };
      }
      return null;
    }, 120000, 800);
    return resolved ? goto(resolved.value) : false;
  }

  async function handleSetcForm() {
    const form = await waitFor(() => {
      const f = document.querySelector(SETC_FORM);
      return f?.action ? f : null;
    }, 4000);
    if (form) {
      log('#setc form found, following action:', form.action);
      return goto(form.action);
    }
    const landing = document.querySelector('form#landing');
    const goValue = landing?.querySelector('[name="go"]')?.value;
    if (!goValue) return false;
    log('#landing form with go field detected');
    const stripped = `aH${goValue.split('aH').slice(1).join('aH')}`;
    const dest = decodeMaybe(stripped);
    if (/^https?:\/\//i.test(dest)) return goto(dest);
    return false;
  }

  async function handleBoostInk() {
    if (!/(^|\.)boost\.ink$/.test(location.host)) return false;
    log('boost.ink detected, fetching page for embedded payload');
    const html = await fetch(location.href, { credentials: 'include' })
      .then((r) => r.text())
      .catch(() => null);
    const chunk = html?.split('bufpsvdhmjybvgfncqfa="')[1]?.split('"')[0];
    if (!chunk) return false;
    try {
      const dest = atob(chunk);
      return /^https?:\/\//i.test(dest) ? goto(dest) : false;
    } catch {
      return false;
    }
  }

  async function handleZafree() {
    if (!ZAFREE_HOST.test(location.host)) return false;
    const linkView = await waitFor('form#link-view', 5000);
    if (linkView) {
      log('za.gl link-view detected, filling coordinates');
      const setVal = (sel, val) => {
        const el = linkView.querySelector(sel);
        if (el) el.value = val;
      };
      setVal('#x', '192');
      setVal('#y', '114');
      setVal('input[name="givenX"]', 'VFl0utOEF6a7BiS8YJdqTg==');
      setVal('input[name="givenY"]', 'rsW06vBB1oIFVpnFz61t5Q==');
      submitFormLoop(linkView, 10);
      return true;
    }
    return false;
  }

  async function handleSkipButtonDest() {
    if (!SKIP_BUTTON_HOST.test(location.host)) return false;
    if (location.pathname.startsWith('/ad/locked')) {
      const params = new URLSearchParams(location.search);
      if (params.has('h') && params.has('url')) {
        return goto(`/-${params.get('h')}/${params.get('url')}`);
      }
      return false;
    }
    const link = await waitFor(() => {
      const el = document.querySelector('#skip_bu2tton');
      return el?.getAttribute('href') ? el : null;
    }, 60000, 500);
    if (!link) return false;
    const href = link.getAttribute('href');
    const dest = href.split('dest=')[1];
    log('skip button with dest found');
    return dest ? goto(decodeURIComponent(dest)) : goto(href);
  }

  async function handleLinkvertiseEasy() {
    if (!LINKVERTISE_HOST.test(location.host)) return false;
    const params = new URLSearchParams(location.search);
    let r = params.get('r');
    if (!r && location.hash.includes('r=')) {
      r = new URLSearchParams(location.hash.replace(/^#\??/, '')).get('r');
    }
    if (!r) return false;
    let dest = null;
    try {
      dest = atob(r);
    } catch {}
    if (!dest || !/^https?:\/\//.test(dest)) dest = decodeMaybe(r);
    return /^https?:\/\//.test(dest) ? goto(dest) : false;
  }

  async function handleAcortalink() {
    if (!ACORTALINK_HOST.test(location.host)) return false;
    log('acortalink.me detected');
    // Funnel through goto() so the spoofed open honors validation + anti-loop.
    PAGE.open = (url) => {
      goto(url);
      return PAGE;
    };
    PAGE.addEventListener(
      'message',
      (event) => {
        if (event.origin !== location.origin) return;
        if (typeof event.data === 'string' && event.data.includes('__done__') && event.data.length < 9) {
          Object.defineProperty(event, 'source', { value: '' });
        }
      },
      true,
    );
    const observer = new MutationObserver(() => {
      if (document.querySelector('a.button#contador')) {
        observer.disconnect();
        setTimeout(() => PAGE.postMessage('__done__', PAGE.location.origin), 100);
      }
    });
    observer.observe(document, { childList: true, subtree: true });
    const btn = await waitFor('#contador', 30000, 300);
    if (btn && visible(btn)) fireClick(btn);
    return Boolean(btn);
  }

  function installBstlarXhrHook() {
    if (PAGE.__slBstlarHooked) return;
    PAGE.__slBstlarHooked = true;
    log('bstlar.com detected, intercepting tasks XHR');
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      this.addEventListener('load', async () => {
        try {
          if (!this.responseText?.includes('tasks')) return;
          const response = JSON.parse(this.responseText);
          const linkId = response?.link?.id;
          if (!linkId) return;
          const res = await fetch('https://bstlar.com/api/link-completed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ link_id: linkId }),
          });
          if (!res.ok) return;
          const text = (await res.text()).trim();
          if (/^https?:\/\//.test(text)) goto(text);
        } catch {}
      });
      return originalOpen.apply(this, args);
    };
  }

  async function handleBstlar() {
    if (!BSTLAR_HOST.test(location.host)) return false;
    installBstlarXhrHook();
    return false;
  }

  function solveMathCaptcha(root = document) {
    const source = root.body?.innerText || '';
    const match = source.match(/(\d{1,4})\s*([+\-*x])\s*(\d{1,4})/);
    if (!match) return false;
    const [, aRaw, opRaw, bRaw] = match;
    const a = Number(aRaw);
    const b = Number(bRaw);
    let result = null;
    switch (opRaw) {
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      default: result = a * b;
    }
    if (result === null) return false;
    const input = root.querySelector('input[name*="captcha" i], input[id*="captcha" i], input[placeholder*="captcha" i], input[placeholder*="answer" i]');
    if (!input || input.value.trim() !== '') return false;
    input.value = String(result);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    log(`math captcha solved: ${a} ${opRaw} ${b} = ${result}`);
    return true;
  }

  let boostEnabled = false;

  let capturedDestUrl = null;

  function installNetworkDestCapture() {
    if (PAGE.__slNetCapturing) return;
    PAGE.__slNetCapturing = true;
    const scan = (text) => {
      if (capturedDestUrl || typeof text !== 'string' || text.length > 500000) return;
      const pattern =
        /"(?:url|link|redirect(?:_url|_uri)?|final(?:_url)?|destination|target|go)"\s*:\s*"(https?:\/\/[^"\\]+)"/gi;
      let match;
      while ((match = pattern.exec(text))) {
        try {
          const u = new URL(match[1].replace(/\\u002F/gi, '/'));
          const host = u.host.toLowerCase();
          if (
            u.host &&
            host !== location.host.toLowerCase() &&
            !EXCLUDE_HOSTS.some((re) => re.test(host)) &&
            !INFRA_HOST.test(host)
          ) {
            capturedDestUrl = u.href;
            log('destination captured from network:', u.href);
            return;
          }
        } catch {}
      }
    };
    const originalFetch = PAGE.fetch?.bind(PAGE);
    if (originalFetch) {
      PAGE.fetch = (...args) =>
        originalFetch(...args).then((res) => {
          try {
            res.clone().text().then(scan).catch(() => {});
          } catch {}
          return res;
        });
    }
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (...args) {
      return originalOpen.apply(this, args);
    };
    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener('load', () => {
        try {
          scan(this.responseText);
        } catch {}
      });
      return originalSend.apply(this, args);
    };
  }

  async function handleNetworkCapture() {
    if (!capturedDestUrl) return false;
    log('using network-captured destination');
    return goto(capturedDestUrl);
  }

  function prepareBoost(factor = 15) {
    const originalTimeout = PAGE.setTimeout.bind(PAGE);
    const originalInterval = PAGE.setInterval.bind(PAGE);
    const speedUp = (delay) =>
      typeof delay === 'number' && delay > 400 && delay <= 90000 ? Math.max(30, Math.floor(delay / factor)) : delay;
    PAGE.setTimeout = (handler, delay, ...rest) => originalTimeout(handler, boostEnabled ? speedUp(delay) : delay, ...rest);
    PAGE.setInterval = (handler, delay, ...rest) => originalInterval(handler, boostEnabled ? speedUp(delay) : delay, ...rest);
  }

  function enableBoost() {
    if (!boostEnabled) {
      boostEnabled = true;
      log('timers boosted');
    }
  }

  function blockPopups() {
    PAGE.open = function blockedOpen(url) {
      log('popup blocked:', url || 'about:blank');
      return null;
    };
    document.addEventListener(
      'click',
      (event) => {
        const anchor = event.target.closest?.('a[target="_blank"]');
        if (anchor && looksLikeShortlink()) {
          event.preventDefault();
          log('click popup blocked:', anchor.href);
        }
      },
      true,
    );
  }

  function restoreFocus() {
    try {
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'webkitHidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
      PAGE.onblur = null;
      PAGE.onmouseleave = null;
      document.hasFocus = () => true;
      for (const type of ['visibilitychange', 'blur', 'mouseleave']) {
        document.addEventListener(type, (event) => event.stopImmediatePropagation(), true);
      }
    } catch (error) {
      log('failed to restore focus:', error.message);
    }
  }

  function enableInteractions() {
    for (const type of ['contextmenu', 'copy', 'cut', 'selectstart', 'dragstart']) {
      document.addEventListener(type, (event) => event.stopPropagation(), true);
    }
    PAGE.addEventListener(
      'DOMContentLoaded',
      () => {
        for (const el of document.querySelectorAll('[oncontextmenu], [onselectstart], [ondragstart]')) {
          for (const attr of ['oncontextmenu', 'onselectstart', 'ondragstart']) {
            if (el.hasAttribute(attr)) el.removeAttribute(attr);
          }
        }
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText && rule.style?.userSelect === 'none' && rule.selectorText !== '*::-moz-selection') {
                rule.style.userSelect = 'auto';
              }
            }
          } catch {}
        }
      },
      { once: true },
    );
  }

  function removeAdblockBanners() {
    let sweeping = false;
    const sweep = () => {
      if (sweeping) return;
      sweeping = true;
      setTimeout(() => {
        sweeping = false;
        const banners = [...document.querySelectorAll('div, section, aside, dialog')].filter((el) => {
          if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
          const text = (el.innerText || '').trim();
          return text.length > 0 && text.length < 600 && ADBLOCK_BANNER.test(text);
        });
        for (const banner of banners) {
          log('anti-adblock banner removed');
          banner.remove();
        }
      }, 500);
    };
    PAGE.addEventListener('DOMContentLoaded', sweep, { once: true });
    new MutationObserver(sweep).observe(document.documentElement, { childList: true, subtree: true });
  }

  let lootInspect = null;

  // Installed at document-start on loot-link hosts: snapshots every response
  // until the rule runs and decides which URLs matter (CDN_DOMAIN/syncer come
  // from the page's `p` global, unavailable before its inline scripts run).
  function installLootLinkFetchCapture() {
    if (PAGE.__slLootCapInstalled) return;
    PAGE.__slLootCapInstalled = true;
    const origFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!origFetch) return;
    const pending = [];
    PAGE.__slLootPending = pending;
    window.fetch = async function (url, ...opts) {
      const res = await origFetch(url, ...opts);
      if (typeof url === 'string') {
        const snapshot = { url, clone: () => res.clone() };
        if (lootInspect) Promise.resolve().then(() => lootInspect(snapshot)).catch(() => {});
        else if (pending.length < 24) pending.push(snapshot);
      }
      return res;
    };
  }

  async function handleLootLinkLocal() {
    if (!LOOTLINK_HOST.test(location.host)) return false;
    // Local bypass derived from d15c0rdh4ckr's "loot-link.com bypasser" (GreasyFork #483207, MIT).
    const p = await readGlobal('p', (v) => v && v.KEY && v.TID && v.CDN_DOMAIN);
    if (!p) { log('LootLink: global p unavailable, falling back'); return false; }
    log('LootLink: installing local bypass (MIT, d15c0rdh4ckr #483207)');
    let initData = null, syncer = null, sessionData = null, resolved = false;
    async function absorb(snapshot) {
      const text = await snapshot.clone().text();
      if (snapshot.url.includes(p.CDN_DOMAIN)) {
        initData = JSON.parse('[' + text.slice(1, -2) + ']');
        syncer = initData[10];
      } else if (syncer && snapshot.url.includes(syncer) && !sessionData) {
        sessionData = JSON.parse(text);
        doBypass();
      }
    }
    function doBypass() {
      try {
        const urid = sessionData[0].urid;
        let server = initData[9];
        server = (Number(String(urid).substr(-5)) % 3) + '.' + server;
        try { fetch(sessionData[0].action_pixel_url).catch(() => {}); } catch (e) {}
        const ws = new WebSocket(`wss://${server}/c?uid=${urid}&cat=54&key=${p.KEY}`);
        ws.onopen = async () => {
          try {
            await fetch(`https://${server}/st?uid=${urid}&cat=54`, { method: 'POST' }).catch(() => {});
            await fetch(`https://${syncer}/td?ac=1&urid=${urid}&&cat=54&tid=${p.TID}`).catch(() => {});
          } catch (e) {}
        };
        ws.onmessage = (ev) => {
          if (resolved) return;
          if (typeof ev.data === 'string' && ev.data.startsWith('r:')) {
            const data = xorDecode(ev.data.split(':')[1]);
            if (/^https?:\/\//i.test(data)) { resolved = true; log('LootLink: local destination obtained'); goto(data); }
          }
        };
      } catch (e) { log('LootLink bypass error: ' + e.message); }
    }
    const pending = PAGE.__slLootPending;
    if (pending) {
      const queued = pending.splice(0);
      for (const snapshot of queued) {
        try {
          await absorb(snapshot);
        } catch (e) {
          log('LootLink: buffered response parse failed:', e.message);
        }
      }
    }
    lootInspect = absorb;
    if (resolved) return true;
    return await waitFor(() => (resolved ? true : null), 45000);
  }

  // Image hosts (adsbypasser families): strip common overlays, then follow
  // the direct image link -- either an anchor pointing at the file or the main
  // <img> itself.
  async function handleImageHost() {
    if (!IMAGE_HOSTS.test(location.host)) return false;
    for (const sel of ['.overlay', '#overlay', '.modal-backdrop', '[class*="overlay" i]', '#adblock-bg']) {
      try {
        document.querySelectorAll(sel).forEach((el) => el.remove());
      } catch {}
    }
    const anchorSelectors = [
      'a.direct-link',
      'a.btn-download',
      'a.download-button',
      'a[download]',
      'a[href$=".jpg"]',
      'a[href$=".jpeg"]',
      'a[href$=".png"]',
      'a[href$=".gif"]',
      'a[href$=".webp"]',
    ];
    for (const sel of anchorSelectors) {
      const a = document.querySelector(sel);
      if (a?.href && isPlausibleUrl(a.href) && !sameAsCurrent(a.href)) {
        log('image-host: following direct link');
        return goto(a.href);
      }
    }
    for (const sel of ['#image', 'img.main-image', 'img.img-responsive', 'img[src*="/images/"]', 'meta[property="og:image"]']) {
      const el = document.querySelector(sel);
      const src = el?.content || el?.src;
      if (src && isPlausibleUrl(src) && /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(src) && !sameAsCurrent(src)) {
        log('image-host: navigating to the main image');
        return goto(src);
      }
    }
    return false;
  }

  // File hosts (adsbypasser families): wait out whatever timer the page uses,
  // then click the free-download control.
  async function handleFileHost() {
    if (!FILE_HOSTS.test(location.host)) return false;
    const findDownload = () =>
      findByText(/^(free\s+)?(download|generate\s+link)(\s+now)?$/i) ||
      document.querySelector('#downloadbtn, .btn-download, a[download], form[action*="download"] button[type="submit"]');
    let target = findDownload();
    if (!target) {
      log('file-host: waiting for the download control');
      await waitFor(() => (findDownload() ? true : null), 20000, 500);
      target = findDownload();
    }
    if (!target) return false;
    if (target.tagName === 'A' && target.href && isPlausibleUrl(target.href) && !sameAsCurrent(target.href)) {
      return goto(target.href);
    }
    fireClick(target);
    log('file-host: download control clicked');
    return true;
  }

  const GENERIC_RULES = [
    { name: 'image-host', when: () => IMAGE_HOSTS.test(location.host), run: handleImageHost },
    { name: 'file-host', when: () => FILE_HOSTS.test(location.host), run: handleFileHost },
    { name: 'ouo', when: () => OUO_HOST.test(location.host), run: handleOuo },
    { name: 'adfoc', when: () => ADFOC_FAMILY.test(location.host), run: handleAdFoc },
    { name: 'close-interstitial', when: () => CLOSE_INTERSTITIAL_HOST.test(location.host), run: handleCloseInterstitial },
    { name: 'rekonise', when: () => REKONISE_HOST.test(location.host), run: handleRekonise },
    { name: 'mboost', when: () => MBOOST_HOST.test(location.host), run: handleMboost },
    { name: 'lootlink-local', when: () => LOOTLINK_HOST.test(location.host), run: handleLootLinkLocal },
    { name: 'lootlabs', when: () => LOOTLABS_HOST.test(location.host), run: handleLootlabs },
    { name: 'aylink-family', when: () => AYLINK_HOST.test(location.host), run: handleAylink },
    { name: 'bcvc', when: () => BCVC_HOST.test(location.host), run: handleBcVc },
    { name: 'skip-button-dest', when: () => SKIP_BUTTON_HOST.test(location.host), run: handleSkipButtonDest },
    { name: 'acortalink', when: () => ACORTALINK_HOST.test(location.host), run: handleAcortalink },
    { name: 'bstlar', when: () => BSTLAR_HOST.test(location.host), run: handleBstlar },
    { name: 'token-link', when: () => TOKEN_HOST.test(location.host), run: handleTokenLink },
    { name: 'zafree-link-view', when: () => ZAFREE_HOST.test(location.host), run: handleZafree },
    { name: 'setc-form', when: () => document.querySelector('form#setc, form#landing [name="go"]') !== null, run: handleSetcForm },
    { name: 'boost-ink', when: () => /(^|\.)boost\.ink$/.test(location.host), run: handleBoostInk },
    { name: 'linkvertise-easy', when: () => LINKVERTISE_HOST.test(location.host), run: handleLinkvertiseEasy },
    {
      name: 'adlinkfly-hosts',
      when: () => ADLINKFLY_HOSTS.test(location.host),
      run: handleAdLinkFly,
    },
    {
      name: 'external-service',
      when: () => BYPASS_SERVICE_URL.test(location.href),
      run: handleExternalService,
    },
    { name: 'network-capture', when: () => looksLikeShortlink(), run: handleNetworkCapture },
    { name: 'url-destination', when: () => looksLikeShortlink(), run: async () => goto(extractDestFromParams()) },
    { name: 'adlinkfly', when: () => looksLikeShortlink(), run: handleAdLinkFly },
    { name: 'adlinkfly-captcha', when: () => looksLikeShortlink(), run: handleInvisibleCaptcha },
    { name: 'go-link-form', when: () => looksLikeShortlink(), run: handleGoLinkForm },
    { name: 'wpsafelink', when: () => looksLikeShortlink(), run: handleWpSafeLink },
    { name: 'math-captcha', when: () => looksLikeShortlink(), run: async () => {
        await waitFor(() => document.querySelector('input[name*="captcha" i], input[id*="captcha" i]'), 10000);
        return solveMathCaptcha();
      } },
    { name: 'final-button', when: () => looksLikeShortlink(), run: handleButtons },
    { name: 'service-last-resort', when: () => /^bypass\.tools$/.test(location.host), run: handleServiceLastResort },
    { name: 'bypass-city', when: genericGate, run: handleBypassCity },
    { name: 'captcha-manual', when: genericGate, run: handleManualCaptcha },
    { name: 'single-external-link', when: genericGate, run: async () => {
        await sleep(4000);
        const dest = findExternalExit();
        if (dest) return goto(dest);
        return false;
      } },
  ];

  function registerMenu() {
    GM_registerMenuCommand(
      disabled() ? 'Enable on this site' : 'Disable on this site',
      () => {
        const off = GM_getValue('disabled_hosts', {});
        if (off[location.host]) delete off[location.host];
        else off[location.host] = true;
        GM_setValue('disabled_hosts', off);
        location.reload();
      },
    );
    GM_registerMenuCommand(
      `Debug logs: ${VERBOSE ? 'ON' : 'OFF'} (click to toggle)`,
      () => {
        VERBOSE = !VERBOSE;
        GM_setValue('verbose', VERBOSE);
        location.reload();
      },
    );
    // Manual escape hatch: bypass.link requires an hCaptcha per request, so it
    // cannot join the automatic cascade -- this just hands the current URL to
    // the user for a one-off manual bypass there.
    GM_registerMenuCommand('Open in bypass.link (manual fallback)', () => {
      const url = location.href;
      try {
        if (typeof GM_setClipboard === 'function') GM_setClipboard(url);
      } catch {}
      if (typeof GM_openInTab === 'function') GM_openInTab('https://bypass.link/', { active: true });
      else PAGE.open('https://bypass.link/');
      log('current URL copied -- paste it on bypass.link and solve its captcha');
    });
  }

  function installEarlyHooks() {
    // Host-gated interception that must beat the page's first network
    // activity. Known-shortener hosts only, so the "quiet on normal pages"
    // promise stays intact; hooks are idempotent (guarded by PAGE flags).
    // Runs before the DOMContentLoaded wait because lootlabs/bstlar/lootlink
    // open their WebSocket/XHR/fetch traffic as soon as their scripts run.
    if (LOOTLABS_HOST.test(location.host)) installLootlabsWsHook();
    else if (BSTLAR_HOST.test(location.host)) installBstlarXhrHook();
    else if (LOOTLINK_HOST.test(location.host)) installLootLinkFetchCapture();
  }

  async function main() {
    registerMenu();
    if (PAGE.self !== PAGE.top || excluded() || disabled()) return;
    installEarlyHooks();

    // Cloudflare challenge interstitial: never interfere -- let it run so the
    // user can solve it and the real page loads afterward.
    if (document.readyState === 'loading') {
      await new Promise((resolve) => PAGE.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }
    if (cloudflareChallenging()) {
      log('Cloudflare challenge detected -- standing by, not interfering');
      return;
    }

    if (excluded() || disabled()) return;

    const shortish = looksLikeShortlink();
    // Delegation landing pages carry their own rules (service-last-resort on
    // bypass.tools) that must run even though the page itself is not a
    // shortener -- otherwise the cascade dies at its second level.
    const delegated = /^bypass\.tools$/.test(location.host);
    const taskWall = shortish && looksLikeTaskWall();
    const knownShort = knownShortener();
    const media = knownMediaHost();

    if (!shortish && !delegated && !knownShort && !media) {
      log('not a shortlink page -- leaving the page untouched');
      return;
    }

    if (taskWall) {
      log('engagement task-wall detected: stepping back, complete the steps manually');
      enableInteractions();
      return;
    }

    if (shortish || knownShort || media) {
      prepareBoost();
      enableBoost();
      blockPopups();
      restoreFocus();
      removeAdblockBanners();
      enableInteractions();
    }

    // Rules run in declaration order; the first rule whose run() returns truthy
    // wins and stops the loop (see GENERIC_RULES). A rule with a long timeout
    // (e.g. captcha-manual waits up to 120s) blocks every later rule until it
    // resolves -- keep fast/early rules before slow ones when ordering matters.
    for (const rule of GENERIC_RULES) {
      if (disabled()) break;
      let shouldRun = false;
      try {
        shouldRun = rule.when();
      } catch (error) {
        log(`rule ${rule.name}: when error:`, error.message);
      }
      if (!shouldRun) continue;
      if (rule.name === 'network-capture') installNetworkDestCapture();
      try {
        const acted = await rule.run();
        log(`rule ${rule.name}: ${acted ? 'acted' : 'no action'}`);
        if (acted) return;
      } catch (error) {
        log(`rule ${rule.name}: run error:`, error.message);
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      isPlausibleUrl,
      decodeMaybe,
      extractDestFromParams,
      sameAsCurrent,
      cloudflareChallenging,
      captchaPresent,
      looksLikeShortlink,
      goto,
      handleLinkvertiseEasy,
      handleAdLinkFly,
      handleBypassCity,
      BYPASS_SERVICE_URL,
      handleServiceLastResort,
      resolveLootlabsViaApi,
      installEarlyHooks,
      genericGate,
      findExternalExit,
      handleImageHost,
      handleFileHost,
      main,
    };
  }

  if (typeof module === 'undefined') {
    main();
  }
})();
