'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers/harness');

test('shortish cache signature never serializes innerHTML', () => {
  const h = load({ href: 'https://spa.example/view', querySelector: () => null });
  let reads = 0;
  Object.defineProperty(h.doc.body, 'innerHTML', {
    configurable: true,
    get() {
      reads += 1;
      return '<p>x</p>';
    },
  });
  h.doc.body.innerText = 'Loading your link';
  h.api.looksLikeShortlink();
  h.api.looksLikeShortlink();
  h.api.looksLikeShortlink();
  assert.strictEqual(reads, 0, 'signature must not read innerHTML');
});

test('shortish cache still invalidates when the body changes', () => {
  const h = load({ href: 'https://spa.example/view', querySelector: () => null });
  h.doc.body.innerText = 'short';
  assert.strictEqual(h.api.looksLikeShortlink(), false);
  h.doc.body.innerText = 'a much longer body with new text';
  assert.strictEqual(h.api.looksLikeShortlink(), false);
  assert.strictEqual(h.api.trace.detected, false);
});

test('enableInteractions registers each capture listener once', () => {
  const h = load({ querySelector: () => null });
  const counts = {};
  h.doc.addEventListener = (type) => {
    counts[type] = (counts[type] || 0) + 1;
  };
  h.api.enableInteractions();
  h.api.enableInteractions();
  h.api.enableInteractions();
  for (const type of ['contextmenu', 'copy', 'cut', 'selectstart', 'dragstart']) {
    assert.strictEqual(counts[type], 1, `${type} listener must be registered once`);
  }
});

test('rule stats are buffered and written once', () => {
  const h = load({ querySelector: () => null });
  let writes = 0;
  const store = {};
  h.sandbox.GM_getValue = (k, d) => (k in store ? store[k] : d);
  h.sandbox.GM_setValue = (k, v) => {
    store[k] = v;
    writes += 1;
  };
  h.api.bumpStat('rule-a', 'ok');
  h.api.bumpStat('rule-a', 'ok');
  h.api.bumpStat('rule-b', 'fail');
  assert.strictEqual(writes, 0, 'no storage write per rule');
  h.api.flushStats();
  assert.strictEqual(writes, 1, 'one write per flush');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(store.sl_stats)), {
    rules: { 'rule-a': { ok: 2, fail: 0 }, 'rule-b': { ok: 0, fail: 1 } },
  });
  h.api.flushStats();
  assert.strictEqual(writes, 1, 'empty flush is a no-op');
});

test('readGlobal removes the data attribute after reading', async () => {
  const h = load({ querySelector: () => null });
  const attrs = {};
  h.doc.documentElement.getAttribute = (k) => (k in attrs ? attrs[k] : null);
  h.doc.documentElement.setAttribute = (k, v) => {
    attrs[k] = v;
  };
  h.doc.documentElement.removeAttribute = (k) => {
    delete attrs[k];
  };
  h.doc.documentElement.appendChild = () => {};
  h.doc.createElement = () => ({
    set textContent(_v) {
      attrs['data-rg-p'] = JSON.stringify({ ok: 1 });
    },
    remove() {},
  });
  const value = await h.api.readGlobal('p', () => true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(value)), { ok: 1 });
  assert.deepStrictEqual(attrs, {}, 'no data-rg attribute left on <html>');
});

test('removeAdblockBanners installs one observer and skips oversized wrappers', async () => {
  let removed = 0;
  const banner = {
    textContent: 'Please disable your adblocker to continue',
    innerText: 'Please disable your adblocker to continue',
    offsetParent: {},
    remove() {
      removed += 1;
    },
  };
  const wrapper = {
    textContent: 'x'.repeat(2500),
    innerText: 'Please disable your adblocker to continue',
    offsetParent: {},
    remove() {
      removed += 1;
    },
  };
  const h = load({ querySelector: () => null, querySelectorAllOverride: [banner, wrapper] });
  let observers = 0;
  const OrigMO = h.sandbox.MutationObserver;
  h.sandbox.MutationObserver = function (cb) {
    observers += 1;
    return new OrigMO(cb);
  };
  h.api.removeAdblockBanners();
  h.api.removeAdblockBanners();
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.strictEqual(observers, 1, 'one observer per page');
  assert.strictEqual(removed, 1, 'only the real banner is removed');
});
