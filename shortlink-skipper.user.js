// ==UserScript==
// @name         Shortlink Skipper
// @namespace    https://github.com/luciano
// @version      0.4.0
// @description  Pula encurtadores de links automaticamente: acelera countdowns, clica botões finais, extrai destino da URL, bloqueia popups e avisos anti-adblock.
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
        log('clicando em', el.tagName, el.className || '');
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
      log('loop de redirecionamento detectado, abortando:', url);
      return false;
    }
    history.push(url);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(history.slice(-8)));
    } catch {}
    log('indo para', url);
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
    log('formulario go-link encontrado');
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
      log('submetendo formulario diretamente');
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
    log('template WPSafeLink detectado');
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
      log('destino WPSafeLink:', link.href);
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
    log('captcha presente, aguardando resolucao manual...');
    const solved = await waitFor(captchaSolved, 180000, 1000);
    if (!solved) return false;
    log('captcha resolvido pelo usuario, submetendo');
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
    log('template AdLinkFly detectado');
    const form = field.closest('form') || field.parentElement;
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(5000);
      const json = await postForm('/links/go', hiddenFields(form));
      if (json?.url) {
        log('AdLinkFly: destino obtido');
        return goto(json.url);
      }
    }
    return false;
  }

  async function handleInvisibleCaptcha() {
    const btn = await waitFor('#invisibleCaptchaShortlink', 2500);
    if (!btn) return false;
    log('captcha invisivel AdLinkFly detectado');
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
    log('ouo.io detectado, submetendo em loop:', formId);
    return submitFormLoop(form);
  }

  async function handleAdFoc() {
    if (!ADFOC_HOST.test(location.host)) return false;
    return typeof PAGE.click_url === 'string' ? goto(PAGE.click_url) : false;
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
      log('aylink-family: erro:', error.message);
      return false;
    }
  }

  async function handleBcVc() {
    if (!BCVC_HOST.test(location.host)) return false;
    const g = (key) => PAGE[key];
    if ([g('tZ'), g('cW'), g('cH'), g('tkn'), g('sW'), g('sH'), g('xyz')].some((v) => typeof v === 'undefined')) {
      return false;
    }
    const token = document.querySelector('#recaptchaToken')?.value || '';
    const json = await postForm(`/ln.php?wds=${encodeURIComponent(String(g('xyz')))}`, {
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
    });
    const url = json?.message?.url ?? json?.message;
    return typeof url === 'string' ? goto(url) : false;
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
    log('botao skip com dest encontrado');
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
    log('site dificil, delegando ao servico publico adbypass.org');
    return goto(`https://adbypass.org/bypass?bypass=${encodeURIComponent(location.href)}`);
  }

  async function handleAcortalink() {
    if (!ACORTALINK_HOST.test(location.host)) return false;
    log('acortalink.me detectado');
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
    log('bstlar.com detectado, interceptando XHR de tasks');
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
    log(`captcha matematico resolvido: ${a} ${opRaw} ${b} = ${result}`);
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
      log('timers acelerados');
    }
  }

  function blockPopups() {
    PAGE.open = function blockedOpen(url) {
      log('popup bloqueado:', url || 'about:blank');
      return null;
    };
    document.addEventListener(
      'click',
      (event) => {
        const anchor = event.target.closest?.('a[target="_blank"]');
        if (anchor && looksLikeShortlink()) {
          event.preventDefault();
          log('popup por clique bloqueado:', anchor.href);
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
      log('falha ao restaurar foco:', error.message);
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
          log('banner anti-adblock removido');
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
    { name: 'linkvertise-easy', when: () => LINKVERTISE_HOST.test(location.host), run: handleLinkvertiseEasy },
    {
      name: 'servico-externo',
      when: () => BYPASS_SERVICE_URL.test(location.href),
      run: async () =>
        goto(`https://adbypass.org/bypass?bypass=${encodeURIComponent(location.href)}`),
    },
    { name: 'destino-na-url', when: () => looksLikeShortlink(), run: async () => goto(extractDestFromParams()) },
    { name: 'adlinkfly', when: () => true, run: handleAdLinkFly },
    { name: 'adlinkfly-captcha', when: () => true, run: handleInvisibleCaptcha },
    { name: 'go-link-form', when: () => looksLikeShortlink(), run: handleGoLinkForm },
    { name: 'wpsafelink', when: () => looksLikeShortlink(), run: handleWpSafeLink },
    { name: 'captcha-manual', when: () => looksLikeShortlink(), run: handleManualCaptcha },
    { name: 'captcha-matematica', when: () => looksLikeShortlink(), run: async () => {
        await waitFor(() => document.querySelector('input[name*="captcha" i], input[id*="captcha" i]'), 10000);
        return solveMathCaptcha();
      } },
    { name: 'botao-final', when: () => looksLikeShortlink(), run: handleButtons },
    { name: 'unico-link-externo', when: () => looksLikeShortlink(), run: async () => {
        await sleep(4000);
        const dest = findExternalExit();
        if (dest) return goto(dest);
        return false;
      } },
  ];

  function registerMenu() {
    GM_registerMenuCommand(
      disabled() ? 'Ativar neste site' : 'Desativar neste site',
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
        log(`regra ${rule.name}: erro no when:`, error.message);
      }
      if (!shouldRun) continue;
      try {
        const acted = await rule.run();
        log(`regra ${rule.name}: ${acted ? 'agiu' : 'sem ação'}`);
        if (acted) return;
      } catch (error) {
        log(`regra ${rule.name}: erro no run:`, error.message);
      }
    }
  }

  main();
})();
