'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load: loadHarness } = require('./helpers/harness');

// Lean pages must look inert: no setc form is probed unless the test asks.
const load = (opts = {}) => loadHarness({ querySelector: () => null, ...opts });


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

// --- A3: popular non-shortlink fixtures ---

test('A3: popular non-shortlink sites stay untouched', async () => {
  const cases = [
    ['github', 'https://github.com/LucianoSkx/shortlink-skipper'],
    ['reddit', 'https://www.reddit.com/r/programming/'],
    ['wikipedia', 'https://en.wikipedia.org/wiki/Link_shortener'],
    ['amazon', 'https://www.amazon.com/dp/B0TEST123'],
  ];
  for (const [name, href] of cases) {
    const h = load({ href, querySelector: () => null });
    await h.api.main();
    assert.strictEqual(h.navs.length, 0, `${name} must not navigate`);
    assert.strictEqual(h.api.trace.detected, false, `${name} must not be detected`);
    assert.strictEqual(h.api.trace.rule, null, `${name} must not run a rule`);
  }
});

// --- C1: main() duration measurement ---

test('C1: main() records durationMs on the decision trace', async () => {
  const h = load();
  await h.api.main();
  const d = h.api.trace.durationMs;
  assert.strictEqual(typeof d, 'number', 'durationMs must be a number');
  assert.ok(d >= 0 && d < 50, `durationMs=${d} must be a quiet-page measurement under 50ms`);
});
