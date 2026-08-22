// ==UserScript==
// @name         Shortlink Skipper
// @namespace    https://github.com/luciano
// @version      0.5.0
// @description  Automatically skips link shorteners: speeds up countdowns, clicks final buttons, extracts the destination from the URL, blocks popups and anti-adblock warnings.
// @author       Luciano
// @match        *://*/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  const PAGE = unsafeWindow;

  const EXCLUDE_HOSTS = [
    /(^|\.)google\./,
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
    'continue', 'next', 'forward', 'jump', 's', 'safe',
  ];

  const ADBLOCK_BANNER =
    /(disable|turn off|deactivate).{0,24}ad.?block|ad.?block(er)? (is |was )?(detect|enabled|activ)|we.{0,10}ve detected.{0,20}ad.?block|whitelist (us|this site)/i;

  const OUO_HOST = /(^|\.)ouo\.(io|press|today)$/;
  const ADFOC_HOST = /(^|\.)adfoc\.us$/;
  const AYLINK_HOST =
    /(aylink\.co|yindex\.xyz|gitizle\.vip|uzunversiyon\.xyz|shtms\.co|findi\.pro|gitlink\.pro)$/;
  const BCVC_HOST = /(^|\.)bcvc\.(live|xyz)$/;
  const SKIP_BUTTON_HOST = /(hurirk\.net|usfinf\.net|xervoo\.net)$/;
  const ACORTALINK_HOST = /(^|\.)acortalink\.me$/;
  const BSTLAR_HOST = /(^|\.)bstlar\.com$/;
  const LINKVERTISE_HOST = /(^|\.)linkvertise\.com$/;
  const TOKEN_HOST = /(tpi\.li|oii\.la|tei\.ai|tii\.ai|iir\.ai|oko\.sh)$/;
  const ZAFREE_HOST = /(^|\.)za\.(gl|uy)$/;
  const SETC_FORM = 'form#setc';
  const BYPASS_SERVICE_URL =
    /^https?:\/\/(?:(?:loot-link\.com|loot-links\.com|lootlink\.org|lootlinks\.co|lootdest\.(?:info|org|com)|links-loot\.com|linksloot\.net|(?:bleleadersto|tonordersitye|daughablelea|mdlinkshub)\.com)\/s\?.+|linkvertise\.com\/.+)/;
  const INFRA_HOST =
    /googleapis|gstatic|jsdelivr|unpkg|cdnjs|cloudflare|fontawesome|jquery|bootstrapcdn|w3\.org|schema\.org|gravatar|recaptcha|hcaptcha|youtube|youtu\.be|vimeo|dailymotion|twitch|spotify|soundcloud|doubleclick|googlesyndication|googletagmanager|google-analytics|adservice|adsystem|amazon-adsystem|facebook|fbcdn|instagram|cdninstagram|twitter|x\.com|twimg|tiktok|pinterest|reddit|telegram|t\.me|discord|whatsapp|github|gitlab|codepen|stackexchange|wikipedia/i;

  function disabled() {
    const off = GM_getValue('disabled_hosts', {});
    return Boolean(off[location.host]);
  }

  function log(...args) {
    console.log(`%c[ShortlinkSkipper]`, 'color:#7c4dff;font-weight:bold', new Date().toLocaleTimeString(), ...args);
  }

  function excluded() {
    const host = location.host.toLowerCase();
    return EXCLUDE_HOSTS.some((re) => re.test(host));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      return a.host === b.host && a.pathname === b.pathname;
    } catch {
      return true;
    }
  }

  function goto(url) {
    if (!url || !/^https?:\/\//i.test(url)) return false;
    if (sameAsCurrent(url)) return false;
    const KEY = 'sl_skipper_nav';
    let history = [];
    try {
      history = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    } catch {}
    if (history.slice(-3).filter((u) => u === url).length >= 2) {
      log('redirect loop detected, aborting:', url);
      return false;
    }
    history.push(url);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(history.slice(-8)));
    } catch {}
    log('going to', url);
    location.href = url;
    return true;
  }

  function looksLikeShortlink(doc = document) {
    if (doc.querySelector(GO_LINK_FORM)) return true;
    const text = (doc.body?.innerText || '').slice(0, 4000);
    return SHORTLINK_HINTS.test(text);
  }

  function extractDestFromParams() {
    const params = new URLSearchParams(location.search);
    for (const name of DEST_PARAMS) {
      const values = params.getAll(name);
      for (const raw of values) {
        const decoded = decodeMaybe(raw);
        if (/^https?:\/\//i.test(decoded)) return decoded;
      }
    }
    const hash = location.hash.replace(/^#\??/, '');
    if (hash.includes('=')) {
      const hashParams = new URLSearchParams(hash);
      for (const name of DEST_PARAMS) {
        const raw = hashParams.get(name);
        if (raw) {
          const decoded = decodeMaybe(raw);
          if (/^https?:\/\//i.test(decoded)) return decoded;
        }
      }
    }
    return null;
  }

  function findExternalExit() {
    const here = location.host.toLowerCase();
    const isExternal = (raw) => {
      try {
        const u = new URL(raw);
        return /^https?:$/.test(u.protocol) &&
          u.host.toLowerCase() !== here &&
          !EXCLUDE_HOSTS.some((re) => re.test(u.host.toLowerCase()));
      } catch {
        return false;
      }
    };
    const anchors = [...document.querySelectorAll('a[href^="http"]')]
      .map((a) => a.getAttribute('href'))
      .filter((href) => {
        try {
          return isExternal(href) && !INFRA_HOST.test(new URL(href).host);
        } catch {
          return false;
        }
      });
    if (anchors.length === 1) return anchors[0];
    const inlineScripts = [...document.querySelectorAll('script:not([src])')]
      .map((s) => s.textContent)
      .join('\n');
    const assigned = [...inlineScripts.matchAll(/(?:location(?:\.href)?|window\.open)\s*=?\s*\(?\s*['"](https?:\/\/[^'"]+)['"]/gi)]
      .map((m) => m[1])
      .filter(isExternal);
    return assigned.length === 1 ? assigned[0] : null;
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

  async function handleButtons() {
    const clicked = await clickWhen(() => findByText(BUTTON_TEXTS), 30000);
    if (clicked) await sleep(1500);
    return clicked;
  }

  async function handleWpSafeLink() {
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

  async function handleManualCaptcha() {
    if (!captchaPresent()) return false;
    log('captcha present, waiting for manual solve...');
    const solved = await waitFor(captchaSolved, 180000, 1000);
    if (!solved) return false;
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
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(5000);
      const json = await postForm('/links/go', hiddenFields(form));
      if (json?.url) {
        log('AdLinkFly: destination obtained');
        return goto(json.url);
      }
    }
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
    const form = await waitFor(formId, 8000);
    if (!form) return false;
    log('ouo.io detected, submitting in a loop:', formId);
    return submitFormLoop(form);
  }

  async function handleAdFoc() {
    if (!ADFOC_HOST.test(location.host)) return false;
    const fromGlobal = typeof PAGE.click_url === 'string' ? PAGE.click_url : null;
    if (fromGlobal) return goto(fromGlobal);
    return waitFor(() => document.getElementById('y')?.value, 15000, 400).then((url) =>
      url ? goto(url) : false,
    );
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
    if (!form) return false;
    log('#setc form found, following action:', form.action);
    return goto(form.action);
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
    const r = new URLSearchParams(location.search).get('r');
    if (!r) return false;
    try {
      const dest = atob(r);
      return /^https?:\/\//.test(dest) ? goto(dest) : false;
    } catch {
      return false;
    }
  }

  async function handleBypassService() {
    if (!BYPASS_SERVICE_URL.test(location.href)) return false;
    log('hard site detected, delegating to public service adbypass.org');
    return goto(`https://adbypass.org/bypass?bypass=${encodeURIComponent(location.href)}`);
  }

  async function handleAcortalink() {
    if (!ACORTALINK_HOST.test(location.host)) return false;
    log('acortalink.me detected');
    PAGE.open = (url) => (location.assign(url), PAGE);
    PAGE.addEventListener(
      'message',
      (event) => {
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

  async function handleBstlar() {
    if (!BSTLAR_HOST.test(location.host)) return false;
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

  const GENERIC_RULES = [
    { name: 'ouo', when: () => OUO_HOST.test(location.host), run: handleOuo },
    { name: 'adfoc', when: () => ADFOC_HOST.test(location.host), run: handleAdFoc },
    { name: 'aylink-family', when: () => AYLINK_HOST.test(location.host), run: handleAylink },
    { name: 'bcvc', when: () => BCVC_HOST.test(location.host), run: handleBcVc },
    { name: 'skip-button-dest', when: () => SKIP_BUTTON_HOST.test(location.host), run: handleSkipButtonDest },
    { name: 'acortalink', when: () => ACORTALINK_HOST.test(location.host), run: handleAcortalink },
    { name: 'bstlar', when: () => BSTLAR_HOST.test(location.host), run: handleBstlar },
    { name: 'token-link', when: () => TOKEN_HOST.test(location.host), run: handleTokenLink },
    { name: 'zafree-link-view', when: () => ZAFREE_HOST.test(location.host), run: handleZafree },
    { name: 'setc-form', when: () => true, run: handleSetcForm },
    { name: 'linkvertise-easy', when: () => LINKVERTISE_HOST.test(location.host), run: handleLinkvertiseEasy },
    {
      name: 'external-service',
      when: () => BYPASS_SERVICE_URL.test(location.href),
      run: async () =>
        goto(`https://adbypass.org/bypass?bypass=${encodeURIComponent(location.href)}`),
    },
    { name: 'url-destination', when: () => looksLikeShortlink(), run: async () => goto(extractDestFromParams()) },
    { name: 'adlinkfly', when: () => true, run: handleAdLinkFly },
    { name: 'adlinkfly-captcha', when: () => true, run: handleInvisibleCaptcha },
    { name: 'go-link-form', when: () => looksLikeShortlink(), run: handleGoLinkForm },
    { name: 'wpsafelink', when: () => looksLikeShortlink(), run: handleWpSafeLink },
    { name: 'captcha-manual', when: () => looksLikeShortlink(), run: handleManualCaptcha },
    { name: 'math-captcha', when: () => looksLikeShortlink(), run: async () => {
        await waitFor(() => document.querySelector('input[name*="captcha" i], input[id*="captcha" i]'), 10000);
        return solveMathCaptcha();
      } },
    { name: 'final-button', when: () => looksLikeShortlink(), run: handleButtons },
    { name: 'single-external-link', when: () => looksLikeShortlink(), run: async () => {
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
  }

  async function main() {
    registerMenu();
    if (PAGE.self !== PAGE.top || excluded() || disabled()) return;
    prepareBoost();

    if (document.readyState === 'loading') {
      await new Promise((resolve) => PAGE.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }

    if (excluded() || disabled()) return;

    const shortish = looksLikeShortlink();

    if (shortish) {
      enableBoost();
      blockPopups();
      restoreFocus();
      removeAdblockBanners();
    }
    enableInteractions();

    for (const rule of GENERIC_RULES) {
      if (disabled()) break;
      let shouldRun = false;
      try {
        shouldRun = rule.when();
      } catch (error) {
        log(`rule ${rule.name}: when error:`, error.message);
      }
      if (!shouldRun) continue;
      try {
        const acted = await rule.run();
        log(`rule ${rule.name}: ${acted ? 'acted' : 'no action'}`);
        if (acted) return;
      } catch (error) {
        log(`rule ${rule.name}: run error:`, error.message);
      }
    }
  }

  main();
})();
