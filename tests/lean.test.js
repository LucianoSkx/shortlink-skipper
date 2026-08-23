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
  doc.querySelector = opts.querySelector || (() => null);
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { sandbox, loc, doc, navs: loc.navs, api: sandbox.module.exports };
}

test('página normal: main() não interfere (sem hooks pesados)', async () => {
  const h = load();
  const origSetTimeout = h.sandbox.setTimeout;
  const origFetch = h.sandbox.fetch;

  const start = Date.now();
  await h.api.main();
  const elapsed = Date.now() - start;

  assert.ok(elapsed < 1000, `main() demorou ${elapsed}ms numa página normal (não deveria esperar)`);
  assert.strictEqual(h.sandbox.setTimeout, origSetTimeout, 'prepareBoost() não deveria ter rodado em página normal');
  assert.strictEqual(h.sandbox.fetch, origFetch, 'installNetworkDestCapture() não deveria ter rodado em página normal');
  assert.strictEqual(h.navs.length, 0, 'não deveria ter navegado em página normal');
});

test('página normal: setc-form não dispara espera de 4s', async () => {
  const h = load();
  const origSetTimeout = h.sandbox.setTimeout;
  await h.api.main();
  assert.strictEqual(h.sandbox.setTimeout, origSetTimeout, 'setc-form com when:()=>true causaria espera de 4s');
});

test('classificação shortish: página com cara de shortlink é detectada', () => {
  const normal = load();
  assert.strictEqual(normal.api.looksLikeShortlink(), false, 'página normal não deveria ser shortish');

  const short = load({ querySelector: (sel) => (sel.includes('go-link') ? {} : null) });
  assert.strictEqual(short.api.looksLikeShortlink(), true, 'página com form go-link deveria ser shortish');
});
