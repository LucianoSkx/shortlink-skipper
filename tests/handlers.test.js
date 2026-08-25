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
  doc.querySelector = opts.querySelector || ((sel) => (sel.includes('setc') ? { action: opts.href || 'https://example.com/' } : null));
  if (opts.querySelectorAllOverride) doc.querySelectorAll = () => opts.querySelectorAllOverride;
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

test('handleBypassCity ignores footer/review links (live bug: trustpilot on spaste.com)', async () => {
  const h = load({ href: 'https://spaste.com/' });
  h.setGmXhr((opts) =>
    opts.onload({
      responseText:
        '<html><body><a href="https://www.trustpilot.com/review/bypass.city">review us</a>' +
        '<a href="https://ko-fi.com/someone">donate</a></body></html>',
    }),
  );
  const ok = await h.api.handleBypassCity();
  assert.strictEqual(ok, false, 'no real destination -> must not navigate');
  assert.strictEqual(h.navs.length, 0);
});

test('handleBypassCity picks the real destination even when footer links come first', async () => {
  const h = load({ href: 'https://short.site.example/abc' });
  h.setGmXhr((opts) =>
    opts.onload({
      responseText:
        '<html><body>' +
        '<a href="https://www.trustpilot.com/review/bypass.city">review us</a>' +
        '<a href="https://real-dest.example/final">go</a>' +
        '</body></html>',
    }),
  );
  const ok = await h.api.handleBypassCity();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://real-dest.example/final'));
});

test('findExternalExit ignores a lone gmail link (live bug: spaste.com -> gmail.com)', () => {
  const h = load({
    href: 'https://spaste.com/',
    querySelectorAllOverride: [{ getAttribute: () => 'https://mail.google.com/mail/u/0/', dataset: {} }],
  });
  assert.strictEqual(h.api.findExternalExit(), null, 'gmail must never count as the single external exit');
});

test('EXTRA_SHORTENER_HOSTS no longer gates spaste.com (source of two live false positives)', () => {
  const h = load({ href: 'https://spaste.com/', querySelector: () => null });
  assert.strictEqual(h.api.genericGate(), false, 'pastebin home must not open the shortlink gate');
});

test('stly.link (new stfly network domain) opens the gate  -  live finding', () => {
  const h = load({ href: 'https://stly.link/69HJM', querySelector: () => null });
  assert.strictEqual(h.api.genericGate(), true, 'stfly migrated to stly.link; it must be a known shortener');
});

test('boost.ink passes knownShortener so its dedicated handler can reach embedded payloads', () => {
  const h = load({ href: 'https://boost.ink/xq4yof', querySelector: () => null });
  assert.strictEqual(h.api.genericGate(), true, 'boost.ink owns handleBoostInk; the gate must open for it');
});

// --- destination validation matrix (centralized in goto via validateDestination) ---

test('validateDestination accepts plausible external destinations', () => {
  const h = load({ href: 'https://short.site.example/abc', querySelector: () => null });
  for (const url of [
    'https://real-dest.example/final',
    'https://download.host.example/file.zip?token=x',
  ]) {
    const v = h.api.validateDestination(url);
    assert.ok(v.valid, `${url} must be valid`);
    assert.ok(v.confidence > 0, 'valid verdict carries confidence');
  }
});

test('validateDestination rejects dangerous protocols and junk', () => {
  const h = load({ href: 'https://short.site.example/abc', querySelector: () => null });
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'blob:https://x/y', 'not a url', '', undefined]) {
    const v = h.api.validateDestination(url);
    assert.strictEqual(v.valid, false, `${String(url)} must be rejected`);
    assert.ok(v.reason, 'rejection carries a reason');
  }
});

test('validateDestination rejects infrastructure/social/excluded targets (live bug class)', () => {
  const h = load({ href: 'https://short.site.example/abc', querySelector: () => null });
  const cases = {
    'https://www.trustpilot.com/review/bypass.city': 'infrastructure/tracking domain',
    'https://mail.google.com/mail/u/0/': 'excluded service as destination',
    'https://wordpress.org/': 'infrastructure/tracking domain',
    'https://cdn.jsdelivr.net/npm/x': 'infrastructure/tracking domain',
  };
  for (const [url, expected] of Object.entries(cases)) {
    const v = h.api.validateDestination(url);
    assert.strictEqual(v.valid, false, `${url} must be rejected`);
    assert.match(v.reason, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `reason for ${url}`);
  }
});

test('goto() refuses excluded destinations and records them on the trace', () => {
  const h = load({ href: 'https://short.site.example/abc', querySelector: () => null });
  const ok = h.api.goto('https://mail.google.com/mail/u/0/');
  assert.strictEqual(ok, false, 'must not navigate to an excluded destination');
  assert.strictEqual(h.navs.length, 0);
  assert.strictEqual(h.api.trace.refusals.length, 1, 'refusal recorded on trace');
  assert.match(h.api.trace.refusals[0].reason, /excluded service/);
});

test('decision trace records detection, winning rule and navigation', async () => {
  const h = load({
    href: 'https://imagetwist.com/abc/file.jpg',
    querySelector: (sel) => (sel === 'a.direct-link' ? { href: 'https://img.imagetwist.com/i/abc.jpg' } : null),
  });
  await h.api.main();
  const t = h.api.trace;
  assert.strictEqual(t.host, 'imagetwist.com');
  assert.ok(t.rule === 'image-host', `winning rule recorded, got ${t.rule}`);
  assert.strictEqual(t.navigations.length, 1, 'navigation recorded on trace');
  assert.strictEqual(t.navigations[0].url, 'https://img.imagetwist.com/i/abc.jpg');
  assert.ok(t.navigations[0].hop >= 1, 'hop counter present');
});

// --- candidate confidence (network-capture + single-external-link) ---

test('network-capture navigates on strong fields and records the candidate', async () => {
  const h = load({ href: 'https://short.site.example/abc', querySelector: () => null });
  h.sandbox.fetch = () =>
    Promise.resolve({
      clone: () => ({ text: () => Promise.resolve('{"destination":"https://dest.example/final"}') }),
      json: () => Promise.resolve(null),
    });
  h.api.installNetworkDestCapture();
  await h.sandbox.fetch("https://page.example/api");
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(await h.api.handleNetworkCapture(), 'strong field must navigate');
  assert.ok(h.navs.includes('https://dest.example/final'));
  assert.strictEqual(h.api.trace.candidates[0].confidence, 0.85);
});

test('network-capture records weak candidates but never navigates on them', async () => {
  const h = load({ href: 'https://short.site.example/abc', querySelector: () => null });
  h.sandbox.fetch = () =>
    Promise.resolve({
      clone: () => ({ text: () => Promise.resolve('{"url":"https://weak.example/avatar.png"}') }),
      json: () => Promise.resolve(null),
    });
  h.api.installNetworkDestCapture();
  await h.sandbox.fetch("https://page.example/api");
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(await h.api.handleNetworkCapture(), false, 'weak field must not navigate alone');
  assert.strictEqual(h.navs.length, 0);
  assert.strictEqual(h.api.trace.candidates[0].confidence, 0.55, 'weak candidate kept for diagnosis');
});

test('single-external-link acts with recorded low confidence', async () => {
  const h = load({
    href: 'https://short.site.example/abc',
    querySelectorAllOverride: [{ getAttribute: () => 'https://real-dest.example/final', dataset: {} }],
  });
  const ok = await h.api.runSingleExternalLink();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://real-dest.example/final'));
  const cand = h.api.trace.candidates.find((c) => c.source === 'single-external-link');
  assert.ok(cand, 'candidate recorded');
  assert.strictEqual(cand.confidence, 0.55, 'weakest evidence in the cascade');
});

// --- external resolvers (inline resolution + circuit breaker) ---

test('resolveExternal returns the trw destination inline when the API succeeds', async () => {
  const h = load({ href: 'https://work.ink/something', querySelector: () => null });
  h.setGmXhr((opts) =>
    opts.onload({ responseText: JSON.stringify({ success: true, result: 'https://final.example/file' }) }),
  );
  const r = await h.api.resolveExternal(h.loc.href);
  assert.ok(r);
  assert.strictEqual(r.url, 'https://final.example/file');
  assert.strictEqual(r.source, 'trw');
  const cand = h.api.trace.candidates.find((c) => c.source === 'trw');
  assert.ok(cand, 'resolver candidate on trace');
});

test('resolveExternal falls through to null when the API fails, and delegation still happens', async () => {
  const h = load({ href: 'https://work.ink/something', querySelector: () => null });
  const store = {};
  h.sandbox.GM_getValue = (k, d) => (k in store ? store[k] : d);
  h.sandbox.GM_setValue = (k, v) => { store[k] = v; };
  h.setGmXhr((opts) => opts.onerror());
  const r = await h.api.resolveExternal(h.loc.href);
  assert.strictEqual(r, null, 'failed resolver yields null');
  const ok = await h.api.handleExternalService();
  assert.ok(ok, 'handleExternalService delegates to bypass.tools after resolver failure');
  assert.ok(h.navs.some((u) => u.startsWith('https://bypass.tools/bypass?url=')));
});

test('circuit breaker skips a resolver after repeated failures', async () => {
  const h = load({ href: 'https://work.ink/something', querySelector: () => null });
  const store = {};
  h.sandbox.GM_getValue = (k, d) => (k in store ? store[k] : d);
  h.sandbox.GM_setValue = (k, v) => { store[k] = v; };
  let calls = 0;
  h.setGmXhr((opts) => {
    calls += 1;
    opts.onerror();
  });
  for (let i = 0; i < 10; i += 1) await h.api.resolveExternal(h.loc.href);
  assert.ok(calls >= 10, 'failures recorded via real requests first');
  const before = calls;
  const r = await h.api.resolveExternal(h.loc.href);
  assert.strictEqual(r, null);
  assert.strictEqual(calls, before, 'open circuit must not hit the API again');
});

// --- C9: local telemetry + false-positive reports ---

test('rule outcomes are counted locally when a rule acts', async () => {
  const h = load({
    href: 'https://imagetwist.com/abc/file.jpg',
    querySelector: (sel) => (sel === 'a.direct-link' ? { href: 'https://img.imagetwist.com/i/abc.jpg' } : null),
  });
  const store = {};
  h.sandbox.GM_getValue = (k, d) => (k in store ? store[k] : d);
  h.sandbox.GM_setValue = (k, v) => { store[k] = v; };
  await h.api.main();
  assert.strictEqual(store.sl_stats.rules['image-host'].ok, 1, 'successful rule counted');
});

test('reportFalsePositive stores host/rule/candidates locally', () => {
  const h = load({ href: 'https://weird.example/page', querySelector: () => null });
  const store = {};
  h.sandbox.GM_getValue = (k, d) => (k in store ? store[k] : d);
  h.sandbox.GM_setValue = (k, v) => { store[k] = v; };
  h.api.trace.rule = 'single-external-link';
  const report = h.api.reportFalsePositive();
  assert.strictEqual(report.host, 'weird.example');
  assert.strictEqual(report.rule, 'single-external-link');
  const saved = store.sl_fp_reports;
  assert.ok(Array.isArray(saved) && saved.length === 1, 'report persisted');
  assert.strictEqual(saved[0].rule, 'single-external-link');
});

test('findExternalExit still returns a genuine lone destination', () => {
  const h = load({
    href: 'https://short.site.example/abc',
    querySelectorAllOverride: [{ getAttribute: () => 'https://real-dest.example/final', dataset: {} }],
  });
  assert.strictEqual(h.api.findExternalExit(), 'https://real-dest.example/final');
});

test('findExternalExit refuses site roots (live bug: stfly.me -> wordpress.org)', () => {
  const h = load({
    href: 'https://stfly.me/',
    querySelectorAllOverride: [{ getAttribute: () => 'https://wordpress.org/', dataset: {} }],
  });
  assert.strictEqual(h.api.findExternalExit(), null, 'bare / has no trustworthy lone exit');
});

test('findExternalExit works on shortlink-shaped URLs even with the root guard', () => {
  for (const href of [
    'https://short.site.example/abc123',
    'https://example.com/?token=x9',
  ]) {
    const h = load({
      href,
      querySelectorAllOverride: [{ getAttribute: () => 'https://real-dest.example/final', dataset: {} }],
    });
    assert.strictEqual(h.api.findExternalExit(), 'https://real-dest.example/final', `must resolve on ${href}`);
  }
});

test('BYPASS_SERVICE_URL matches linkvertise.com and linkvertise.net', () => {
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://linkvertise.com/abc'));
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://linkvertise.net/x/y'));
});

test('BYPASS_SERVICE_URL matches other known services', () => {
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://loot-link.com/s/abc'));
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://loot-link.com/s?fJTD'), 'query-style /s? gateway');
  assert.ok(h2.api.BYPASS_SERVICE_URL.test('https://links.lootlabs.gg/s?2j2wXWWH'), 'canonical lootlabs host, query style');
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

test('main() reaches service-last-resort on bypass.tools even though the page is not a shortlink', async () => {
  const h = load({ href: 'https://bypass.tools/bypass?url=https://loot-link.com/x' });
  h.sandbox.setTimeout = (fn) => { fn(); return 0; };
  await h.api.main();
  assert.ok(
    h.navs.some((u) => u.startsWith('https://adbypass.org/bypass?bypass=')),
    'the delegation rule must run despite !shortish',
  );
});

test('goto rejects returning to any visited destination (A->B->A)', () => {
  const h = load({ href: 'https://a.example/' });
  assert.strictEqual(h.api.goto('https://b.example/'), true);
  assert.strictEqual(h.api.goto('https://a.example/'), false, 'the entry page counts as visited');
  assert.strictEqual(h.navs.length, 1);
});

test('goto blocks a 3-hop cycle back to the entry page (A->B->C->A)', () => {
  const h = load({ href: 'https://a.example/' });
  assert.strictEqual(h.api.goto('https://b.example/'), true);
  assert.strictEqual(h.api.goto('https://c.example/'), true);
  assert.strictEqual(h.api.goto('https://a.example/'), false, 'returning to the origin must be blocked');
  assert.strictEqual(h.navs.length, 2);
});

test('goto blocks a 5-hop cycle (A->B->C->D->E->A)', () => {
  const h = load({ href: 'https://a.example/' });
  for (const u of ['b', 'c', 'd', 'e']) {
    assert.strictEqual(h.api.goto(`https://${u}.example/`), true);
  }
  assert.strictEqual(h.api.goto('https://a.example/'), false, 'long cycles must also die');
  assert.strictEqual(h.navs.length, 4);
});

test('goto abandons the chain on a non-consecutive duplicate (A->B->C->B)', () => {
  const h = load({ href: 'https://a.example/' });
  assert.strictEqual(h.api.goto('https://b.example/'), true);
  assert.strictEqual(h.api.goto('https://c.example/'), true);
  assert.strictEqual(h.api.goto('https://b.example/'), false, 'revisiting B must abandon the chain');
  assert.strictEqual(h.navs.length, 2);
});

test('goto enforces the hop budget (MAX_HOPS=10)', () => {
  const h = load({ href: 'https://chain.example/0' });
  for (let i = 1; i <= 10; i++) {
    assert.strictEqual(h.api.goto(`https://chain.example/${i}`), true, `hop ${i} should pass`);
  }
  assert.strictEqual(h.api.goto('https://chain.example/11'), false, 'hop 11 must hit the budget');
});

test('installEarlyHooks wraps fetch exactly once across repeated calls and main()', async () => {
  const h = load({ href: 'https://loot-link.com/s/x' });
  h.setGmXhr((opts) => opts.onerror());
  const origFetch = h.sandbox.fetch;
  h.api.installEarlyHooks();
  const wrappedOnce = h.sandbox.fetch;
  assert.notStrictEqual(wrappedOnce, origFetch, 'first install should wrap fetch');
  h.api.installEarlyHooks();
  assert.strictEqual(h.sandbox.fetch, wrappedOnce, 'second install must be a no-op');
  await h.api.main();
  const afterMain = h.sandbox.fetch;
  assert.notStrictEqual(afterMain, origFetch, 'main() must keep fetch wrapped');
  await h.api.main();
  await h.api.main();
  assert.strictEqual(h.sandbox.fetch, afterMain, 'repeated main() adds no further layers');
});

test('genericGate opens for shortener families, not for media hosts', () => {
  const h1 = load({ href: 'https://1ink.cc/abc', querySelector: () => null });
  assert.strictEqual(h1.api.genericGate(), true, 'gate must open for shortener 1ink.cc');
  const h2 = load({ href: 'https://imgbb.com/abc', querySelector: () => null });
  assert.strictEqual(h2.api.genericGate(), false, 'gate must NOT open for image host imgbb.com');
  const h3 = load({ href: 'https://uploadhaven.com/download/abc', querySelector: () => null });
  assert.strictEqual(h3.api.genericGate(), false, 'gate must NOT open for file host uploadhaven.com');
});

test('main() lets media hosts reach their dedicated rules', async () => {
  const h = load({
    href: 'https://imagetwist.com/abc/file.jpg',
    querySelector: (sel) => (sel === 'a.direct-link' ? { href: 'https://img.imagetwist.com/i/abc.jpg' } : null),
  });
  await h.api.main();
  assert.ok(
    h.navs.includes('https://img.imagetwist.com/i/abc.jpg'),
    'image-host rule must run via main() on a media host',
  );
});

test('main() on failed image-host does not fall through to shortlink fallbacks', async () => {
  const h = load({ href: 'https://imgbb.com/abc', querySelector: () => null });
  h.sandbox.GM_xmlhttpRequest = () => {};
  await h.api.main();
  assert.strictEqual(h.navs.length, 0, 'no destination found -> page stays untouched, no bypass.city/captcha fallback');
});

test('handleImageHost follows the direct image anchor', async () => {
  const h = load({
    href: 'https://imagetwist.com/abc/file.jpg',
    querySelector: (sel) => (sel === 'a.direct-link' ? { href: 'https://img.imagetwist.com/i/abc.jpg' } : null),
  });
  const ok = await h.api.handleImageHost();
  assert.ok(ok);
  assert.strictEqual(h.navs[0], 'https://img.imagetwist.com/i/abc.jpg');
});

test('handleFileHost clicks the download control', async () => {
  const clicked = [];
  const target = {
    tagName: 'BUTTON',
    dispatchEvent: (ev) => {
      clicked.push(ev?.type);
      return true;
    },
  };
  const h = load({
    href: 'https://uploadhaven.com/download/abc',
    querySelector: (sel) => (sel.includes('#downloadbtn') ? target : null),
  });
  h.sandbox.MouseEvent = function (type) {
    this.type = type;
  };
  const ok = await h.api.handleFileHost();
  assert.ok(ok);
  assert.ok(clicked.length > 0, 'a click event must be dispatched');
});

test('menu registers the bypass.link manual fallback', async () => {
  const h = load({ href: 'https://example.com/' });
  const labels = [];
  h.sandbox.GM_registerMenuCommand = (label) => labels.push(label);
  await h.api.main();
  assert.ok(
    labels.some((l) => l.includes('bypass.link')),
    'the manual fallback menu entry must always be registered',
  );
});

test('genericGate opens on known hosts without structural markers', () => {
  const h = load({ href: 'https://ouo.io/4taT4', querySelector: () => null });
  assert.strictEqual(
    h.api.genericGate(),
    true,
    'ouo host must let generic follow-up rules run during the Turnstile phase',
  );
  const plain = load({ href: 'https://example.com/' });
  assert.strictEqual(plain.api.genericGate(), false, 'ordinary pages stay closed');
});

test('a known-shortener host passes the gate even before its SPA renders', async () => {
  const h = load({ href: 'https://linkvertise.com/514008/hydrogen-download', querySelector: () => null });
  const apiCalls = [];
  h.setGmXhr((opts) => {
    apiCalls.push(opts.url);
    opts.onload({ responseText: JSON.stringify({ success: false }) });
  });
  await h.api.main();
  assert.ok(
    apiCalls.some((u) => u.includes('trw.lat/api/bypass')),
    'external-service must run for a known host with no structural indicators',
  );
  assert.ok(
    h.navs.some((u) => u.startsWith('https://bypass.tools/bypass?url=')),
    'cascade must fall back to bypass.tools when the API does not resolve',
  );
});

test('a specific rule wins over external-service by declaration order', async () => {
  const dest = 'https://final.example/out';
  const h = load({
    href: `https://linkvertise.com/123?r=${btoa(dest)}`,
    querySelector: (sel) => (sel.includes('go-link') ? {} : null),
  });
  const apiCalls = [];
  h.setGmXhr((opts) => {
    apiCalls.push(opts.url);
    opts.onload({ responseText: 'null' });
  });
  await h.api.main();
  assert.strictEqual(h.navs[0], dest, 'the local easy path must win');
  assert.strictEqual(
    apiCalls.filter((u) => u.includes('trw.lat')).length,
    0,
    'external-service must not be consulted when a specific rule already acted',
  );
});

test('sameAsCurrent distinguishes query strings but ignores the hash', () => {
  const h = load({ href: 'https://site.example/download?id=1' });
  assert.strictEqual(h.api.sameAsCurrent('https://site.example/download?id=2'), false);
  assert.strictEqual(h.api.sameAsCurrent('https://site.example/download?id=1#top'), true);
  assert.strictEqual(h.api.sameAsCurrent('https://site.example/download?id=1'), true);
});

test('wp-content-lock rule matches ssdhostting.com and similar hosts', () => {
  const hosts = ['ssdhostting.com', 'rvpaste.com', 'shrinkbixby.com'];
  for (const host of hosts) {
    const h = load({ href: `https://${host}/some-article/` });
    assert.strictEqual(
      h.api.knownShortener(),
      true,
      `knownShortener must match ${host} (wp-content-lock host)`,
    );
  }
  const normal = load({ href: 'https://example.com/' });
  assert.strictEqual(
    normal.api.knownShortener(),
    false,
    'knownShortener must not match normal sites',
  );
});
