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
    documentElement: { className: '', outerHTML: '' },
    body: { className: '', innerText: '' },
    title: '',
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ set textContent(_v) {}, remove() {}, setAttribute() {}, getAttribute: () => null }),
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
    sessionStorage: (() => {
      const store = {};
      return {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
      };
    })(),
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
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    addEventListener: () => {},
    removeEventListener: () => {},
    module: { exports: {} },
  };
  sandbox.unsafeWindow = sandbox;
  sandbox.window = sandbox;
  sandbox.location = loc;
  sandbox.document = doc;
  doc.querySelector = opts.querySelector || (() => null);
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { sandbox, loc, doc, navs: loc.navs, api: sandbox.module.exports };
}

test('normal page: main() does not interfere (no heavy hooks)', async () => {
  const h = load();
  const origSetTimeout = h.sandbox.setTimeout;
  const origSetInterval = h.sandbox.setInterval;
  const origFetch = h.sandbox.fetch;
  const origXHR = h.sandbox.XMLHttpRequest;
  const origOpen = h.sandbox.window.open = function open() {};

  const start = Date.now();
  await h.api.main();
  const elapsed = Date.now() - start;

  assert.ok(elapsed < 1000, `main() took ${elapsed}ms on a normal page (should not wait)`);
  assert.strictEqual(h.sandbox.setTimeout, origSetTimeout, 'prepareBoost() should not run on a normal page');
  assert.strictEqual(h.sandbox.setInterval, origSetInterval, 'timers must not be wrapped on a normal page');
  assert.strictEqual(h.sandbox.fetch, origFetch, 'installNetworkDestCapture() should not run on a normal page');
  assert.strictEqual(h.sandbox.XMLHttpRequest, origXHR, 'XHR must not be wrapped on a normal page');
  assert.strictEqual(h.sandbox.window.open, origOpen, 'window.open must not be patched on a normal page');
  assert.strictEqual(h.navs.length, 0, 'should not navigate on a normal page');
});

test('normal page: setc-form does not trigger a 4s wait', async () => {
  const h = load();
  const origSetTimeout = h.sandbox.setTimeout;
  await h.api.main();
  assert.strictEqual(h.sandbox.setTimeout, origSetTimeout, 'setc-form with when:()=>true would cause a 4s wait');
});

test('shortish classification: a shortlink-looking page is detected', () => {
  const normal = load();
  assert.strictEqual(normal.api.looksLikeShortlink(), false, 'a normal page should not be shortish');

  const short = load({ querySelector: (sel) => (sel.includes('go-link') ? {} : null) });
  assert.strictEqual(short.api.looksLikeShortlink(), true, 'a page with a go-link form should be shortish');
});

// --- C8: explicit guarantees for ordinary pages ---

test('normal page: zero heavy observers and sub-50ms main()', async () => {
  const h = load();
  let observersCreated = 0;
  const OrigMO = h.sandbox.MutationObserver;
  h.sandbox.MutationObserver = function (...args) {
    observersCreated += 1;
    return new OrigMO(...args);
  };
  let timersWrapped = 0;
  const origSetTimeout = h.sandbox.setTimeout;
  h.sandbox.setTimeout = (...args) => { timersWrapped += 1; return origSetTimeout(...args); };

  const start = Date.now();
  await h.api.main();
  const elapsed = Date.now() - start;

  assert.ok(elapsed < 50, `main() took ${elapsed}ms on a normal page  -  must be near-zero`);
  assert.strictEqual(observersCreated, 0, 'no MutationObserver may be created on a normal page');
  assert.strictEqual(timersWrapped, 0, 'setTimeout must never be called or wrapped on a normal page');
});

test('normal page: local telemetry stays untouched', async () => {
  const store = {};
  const h = load();
  h.sandbox.GM_getValue = (k, d) => (k in store ? store[k] : d);
  h.sandbox.GM_setValue = (k, v) => { store[k] = v; };
  await h.api.main();
  assert.deepStrictEqual(store.sl_stats, undefined, 'no rule stats on a normal page');
  assert.deepStrictEqual(store.sl_fp_reports, undefined, 'no reports without user action');
});
