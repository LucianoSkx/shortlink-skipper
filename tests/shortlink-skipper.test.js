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

function makeDoc(opts = {}) {
  const cf = Boolean(opts.cf);
  const title = opts.title || '';
  return {
    readyState: 'complete',
    documentElement: { className: cf ? 'cf-challenge-running' : '' },
    body: { className: '', innerText: opts.bodyText || '' },
    title,
    getElementById: (id) => (cf && id === 'cf-challenge-running' ? { id } : null),
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

function load(opts = {}) {
  const loc = makeLocation(opts.href || 'https://example.com/');
  const logs = [];
  const menuCalls = [];
  const sandbox = {
    console: {
      log: (...a) => logs.push(a.join(' ')),
      warn: () => {},
      error: () => {},
    },
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
    GM_registerMenuCommand: (label) => menuCalls.push(label),
    GM_xmlhttpRequest: () => {},
    fetch: () =>
      Promise.resolve({
        clone: () => ({ text: () => Promise.resolve('') }),
        json: () => Promise.resolve(null),
      }),
    XMLHttpRequest: function () {
      this.open = () => {};
      this.send = () => {};
      this.addEventListener = () => {};
    },
    WebSocket: function () {},
    MouseEvent: function () {},
    PointerEvent: function () {},
    Event: function () {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  sandbox.unsafeWindow = sandbox;
  sandbox.window = sandbox;
  sandbox.location = loc;
  sandbox.document = makeDoc(opts);
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { loc, logs, menuCalls };
}

test('carrega sem erro e registra o menu', async () => {
  const { loc, menuCalls } = load({ href: 'https://example.com/' });
  await new Promise((r) => setTimeout(r, 5000));
  assert.ok(menuCalls.length >= 1, 'menu commands devem ser registrados');
  assert.strictEqual(loc.navs.length, 0, 'pagina comum nao deve redirecionar');
});

test('nao interfere no desafio Cloudflare', async () => {
  const { loc, logs } = load({
    href: 'https://short.site.example/abc',
    cf: true,
    title: 'Just a moment...',
  });
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(loc.navs.length, 0, 'nao deve navegar durante o desafio CF');
  assert.ok(
    logs.some((l) => /standing by/i.test(l)),
    'deve registrar que esta aguardando o desafio',
  );
});
