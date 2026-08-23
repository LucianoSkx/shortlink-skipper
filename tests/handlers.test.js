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

test('handleLinkvertiseEasy extracts destination from ?r= (base64)', async () => {
  const h = load({ href: `https://linkvertise.com/x?r=${b64('https://lv.example/dest')}` });
  const ok = await h.api.handleLinkvertiseEasy();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://lv.example/dest'));
});

test('handleLinkvertiseEasy extracts destination from #r= (hash, base64url)', async () => {
  const h = load({ href: `https://linkvertise.net/x#r=${b64('https://lv.example/dest2')}` });
  const ok = await h.api.handleLinkvertiseEasy();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://lv.example/dest2'));
});

test('handleAdLinkFly extracts destination from the /links/go API', async () => {
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

test('handleBypassCity extracts destination from returned HTML', async () => {
  const h = load({ href: 'https://short.site.example/abc' });
  h.setGmXhr((opts) =>
    opts.onload({ responseText: '<html><body><a href="https://real-dest.example/x">go</a></body></html>' }),
  );
  const ok = await h.api.handleBypassCity();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://real-dest.example/x'));
});

test('BYPASS_SERVICE_URL matches linkvertise.com and linkvertise.net', () => {
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://linkvertise.com/abc'));
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://linkvertise.net/x/y'));
});

test('BYPASS_SERVICE_URL matches other known services', () => {
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://loot-link.com/s/abc'));
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://work.ink/something'));
});

test('BYPASS_SERVICE_URL rejects unrelated hosts', () => {
  assert.ok(!h2.api.BYPASS_SERVICE_URL.test('https://example.com/anything'));
  assert.ok(!h2.api.BYPASS_SERVICE_URL.test('https://linkvertise.com.evil.test/x'));
});

test('handleServiceLastResort forwards to adbypass.org when bypass.tools does not resolve', async () => {
  const h = load({ href: 'https://bypass.tools/bypass?url=https://loot-link.com/x' });
  h.sandbox.setTimeout = (fn) => { fn(); return 0; };
  const ok = await h.api.handleServiceLastResort();
  assert.ok(ok);
  assert.ok(h.navs.some((u) => u.startsWith('https://adbypass.org/bypass?bypass=')));
});

test('handleServiceLastResort does not forward if bypass.tools redirected', async () => {
  const h = load({ href: 'https://bypass.tools/bypass?url=https://loot-link.com/x' });
  h.sandbox.setTimeout = (fn) => { fn(); return 0; };
  const p = h.api.handleServiceLastResort();
  h.loc.host = 'example.com';
  const ok = await p;
  assert.ok(!ok);
  assert.ok(!h.navs.some((u) => u.startsWith('https://adbypass.org')));
});

test('handleServiceLastResort does not act outside bypass.tools', async () => {
  const h = load({ href: 'https://example.com/' });
  const ok = await h.api.handleServiceLastResort();
  assert.ok(!ok);
});

test('resolveLootlabsViaApi navigates to the destination returned by the API', async () => {
  const h = load({ href: 'https://links.lootlabs.gg/s/abc' });
  h.setGmXhr((opts) => {
    assert.ok(opts.url.includes('trw.lat/api/clientSides/lootlabs'));
    opts.onload({ responseText: JSON.stringify({ pyl: 'https://dest.example/final' }) });
  });
  await h.api.resolveLootlabsViaApi('somepayload');
  assert.strictEqual(h.navs.length, 1, 'should navigate to the API destination');
  assert.strictEqual(h.navs[0], 'https://dest.example/final');
});

test('resolveLootlabsViaApi ignores a non-URL destination (no navigation)', async () => {
  const h = load({ href: 'https://links.lootlabs.gg/s/abc' });
  h.setGmXhr((opts) => opts.onload({ responseText: JSON.stringify({ pyl: 'not-a-url' }) }));
  await h.api.resolveLootlabsViaApi('somepayload');
  assert.strictEqual(h.navs.length, 0, 'should not navigate on a non-URL destination');
});

test('resolveLootlabsViaApi does not navigate when the API fails', async () => {
  const h = load({ href: 'https://links.lootlabs.gg/s/abc' });
  h.setGmXhr((opts) => opts.onerror());
  await h.api.resolveLootlabsViaApi('somepayload');
  assert.strictEqual(h.navs.length, 0, 'should not navigate when the API errors');
});
