'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'shortlink-skipper.user.js'),
  'utf8',
);

function makeLocation(href) {
  const u = new URL(href);
  const navs = [];
  let current = href;
  return {
    navs,
    get href() { return current; },
    set href(v) { navs.push(v); current = v; },
    host: u.host,
    hostname: u.hostname,
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
    origin: u.origin,
  };
}

function baseDoc() {
  return {
    readyState: 'complete',
    documentElement: { className: '' },
    body: { className: '', innerText: '' },
    title: '',
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      set textContent(_v) {},
      remove() {},
      setAttribute() {},
      getAttribute() { return null; },
    }),
    addEventListener() {},
    head: {},
    styleSheets: [],
  };
}

function load(opts = {}) {
  const loc = makeLocation(opts.href || 'https://example.com/');
  const doc = baseDoc();
  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    URL,
    URLSearchParams,
    JSON,
    Math,
    Date,
    RegExp,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Set,
    Map,
    encodeURIComponent,
    decodeURIComponent,
    atob,
    btoa,
    sessionStorage: { getItem: () => null, setItem: () => {} },
    GM_getValue: (k, d) => d,
    GM_setValue: () => {},
    GM_registerMenuCommand: () => {},
    GM_xmlhttpRequest: () => {},
    fetch: () => Promise.resolve({ json: () => Promise.resolve(null), clone: () => ({ text: () => Promise.resolve('') }) }),
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.addEventListener = () => {}; },
    WebSocket: function () {},
    MouseEvent: function () {},
    PointerEvent: function () {},
    Event: function () {},
    addEventListener: () => {},
    removeEventListener: () => {},
    module: { exports: {} },
  };
  sandbox.unsafeWindow = sandbox;
  sandbox.window = sandbox;
  sandbox.location = loc;
  sandbox.document = doc;
  doc.querySelector = (sel) => (sel.includes('setc') ? { action: opts.href || 'https://example.com/' } : null);
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);

  return {
    sandbox,
    loc,
    doc,
    navs: loc.navs,
    api: sandbox.module.exports,
    setFetch(fn) { sandbox.fetch = fn; },
    setGmXhr(fn) { sandbox.GM_xmlhttpRequest = fn; },
  };
}

const b64 = (s) => btoa(s);

const h2 = load({ href: 'https://linkvertise.com/abc' });

test('handleLinkvertiseEasy extrai destino de ?r= (base64)', async () => {
  const h = load({ href: `https://linkvertise.com/x?r=${b64('https://lv.example/dest')}` });
  const ok = await h.api.handleLinkvertiseEasy();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://lv.example/dest'));
});

test('handleLinkvertiseEasy extrai destino de #r= (hash, base64url)', async () => {
  const h = load({ href: `https://linkvertise.net/x#r=${b64('https://lv.example/dest2')}` });
  const ok = await h.api.handleLinkvertiseEasy();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://lv.example/dest2'));
});

test('handleAdLinkFly extrai destino da API /links/go', async () => {
  const h = load({ href: 'https://short.site.example/abc' });
  const form = { querySelectorAll: () => [] };
  const field = { value: 'x', closest: () => form, parentElement: form };
  h.doc.querySelector = (sel) =>
    sel.includes('ad_form_data') ? field : sel.includes('setc') ? { action: 'https://short.site.example/abc' } : null;
  h.setFetch((url, opts) =>
    Promise.resolve({ json: () => Promise.resolve({ url: 'https://dest.example/final' }), clone: () => ({ text: () => Promise.resolve('') }) }),
  );
  const ok = await h.api.handleAdLinkFly();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://dest.example/final'));
});

test('handleBypassCity extrai destino do HTML retornado', async () => {
  const h = load({ href: 'https://short.site.example/abc' });
  h.setGmXhr((opts) =>
    opts.onload({ responseText: '<html><body><a href="https://real-dest.example/x">go</a></body></html>' }),
  );
  const ok = await h.api.handleBypassCity();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://real-dest.example/x'));
});

test('BYPASS_SERVICE_URL casa linkvertise.com e linkvertise.net', () => {
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://linkvertise.com/abc'));
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://linkvertise.net/x/y'));
});

test('BYPASS_SERVICE_URL casa demais servicos conhecidos', () => {
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://loot-link.com/s/abc'));
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://work.ink/something'));
});

test('BYPASS_SERVICE_URL rejeita hosts nao relacionados', () => {
  assert.ok(!h2.api.BYPASS_SERVICE_URL.test('https://example.com/anything'));
  assert.ok(!h2.api.BYPASS_SERVICE_URL.test('https://linkvertise.com.evil.test/x'));
});

test('handleServiceLastResort repassa ao adbypass.org quando bypass.tools nao resolve', async () => {
  const h = load({ href: 'https://bypass.tools/bypass?url=https://loot-link.com/x' });
  h.sandbox.setTimeout = (fn) => { fn(); return 0; };
  const ok = await h.api.handleServiceLastResort();
  assert.ok(ok);
  assert.ok(h.navs.some((u) => u.startsWith('https://adbypass.org/bypass?bypass=')));
});

test('handleServiceLastResort nao repassa se bypass.tools redirecionou', async () => {
  const h = load({ href: 'https://bypass.tools/bypass?url=https://loot-link.com/x' });
  h.sandbox.setTimeout = (fn) => { fn(); return 0; };
  const p = h.api.handleServiceLastResort();
  h.loc.host = 'example.com';
  const ok = await p;
  assert.ok(!ok);
  assert.ok(!h.navs.some((u) => u.startsWith('https://adbypass.org')));
});

test('handleServiceLastResort nao age fora de bypass.tools', async () => {
  const h = load({ href: 'https://example.com/' });
  const ok = await h.api.handleServiceLastResort();
  assert.ok(!ok);
});
