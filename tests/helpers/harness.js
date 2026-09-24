'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'shortlink-skipper.user.js'),
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

function baseDoc(opts = {}) {
  const cf = Boolean(opts.cf);
  return {
    readyState: 'complete',
    documentElement: { className: cf ? 'cf-challenge-running' : '', outerHTML: '' },
    body: { className: '', innerText: opts.bodyText || '' },
    title: opts.title || '',
    getElementById: (id) => (cf && id === 'cf-challenge-running' ? { id } : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      set textContent(_v) {},
      remove() {},
      setAttribute() {},
      getAttribute: () => null,
    }),
    addEventListener() {},
    // readGlobal/submitFormLoop probe the DOM through this; failing fast here
    // keeps readGlobal from burning its 40x200ms retry budget in tests.
    contains: () => false,
    head: {},
    styleSheets: [],
  };
}

function load(opts = {}) {
  const loc = makeLocation(opts.href || 'https://example.com/');
  const doc = baseDoc(opts);
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
    sessionStorage: (() => {
      const store = {};
      return {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
      };
    })(),
    GM_getValue: (k, d) => {
      if (k === 'verbose' && opts.verbose !== undefined) return opts.verbose;
      return d;
    },
    GM_setValue: () => {},
    GM_registerMenuCommand: (label) => menuCalls.push(label),
    GM_xmlhttpRequest: () => {},
    performance: { now: () => Date.now() },
    fetch: () => Promise.resolve({ json: () => Promise.resolve(null), clone: () => ({ text: () => Promise.resolve('') }) }),
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.addEventListener = () => {}; },
    WebSocket: function () {},
    MouseEvent: function () {},
    PointerEvent: function () {},
    Event: function () {},
    getComputedStyle: () => ({ visibility: 'visible', display: 'block', opacity: '1' }),
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    addEventListener: () => {},
    removeEventListener: () => {},
    module: { exports: {} },
  };
  sandbox.unsafeWindow = sandbox;
  sandbox.window = sandbox;
  sandbox.location = loc;
  sandbox.document = doc;
  doc.querySelector = opts.querySelector || ((sel) => (sel.includes('setc') ? { action: opts.href || 'https://example.com/' } : null));
  if (opts.querySelectorAllOverride) doc.querySelectorAll = () => opts.querySelectorAllOverride;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);

  return {
    sandbox,
    loc,
    doc,
    navs: loc.navs,
    logs,
    menuCalls,
    api: sandbox.module.exports,
    setFetch(fn) { sandbox.fetch = fn; },
    setGmXhr(fn) { sandbox.GM_xmlhttpRequest = fn; },
  };
}

module.exports = { SRC, makeLocation, baseDoc, load };
