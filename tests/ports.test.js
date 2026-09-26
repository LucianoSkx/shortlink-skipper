'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers/harness');

function clickable(extra = {}) {
  return {
    tagName: 'BUTTON',
    className: '',
    disabled: false,
    hidden: false,
    scrollIntoView() {},
    dispatchEvent: () => true,
    getBoundingClientRect: () => ({ width: 60, height: 20 }),
    removeAttribute() {},
    ...extra,
  };
}

function qsMap(map) {
  return (sel) => {
    for (const [k, v] of Object.entries(map)) {
      if (sel === k) return v;
    }
    return null;
  };
}

// --- P0: DEST_PARAMS v / oldurl ---

test('url-destination resolves anchoreth ?v= base64', () => {
  const dest = 'https://dest.example/x';
  const h = load({ href: `https://anchoreth.com/?v=${Buffer.from(dest).toString('base64')}` });
  assert.strictEqual(h.api.extractDestFromParams(), dest);
});

test('url-destination resolves supercheats ?oldurl=', () => {
  const h = load({ href: 'https://supercheats.com/interstitial.html?oldurl=https%3A%2F%2Fdest.example%2Fx' });
  assert.strictEqual(h.api.extractDestFromParams(), 'https://dest.example/x');
});

// --- P0: knownShortener covers ported hosts ---

for (const href of [
  'https://goo.st/abc',
  'https://f95zone.to/masked/abc',
  'https://nmac.to/ads/aHR0cHM6Ly9kZXN0LmV4YW1wbGUveA==',
  'https://exeo.app/abc',
]) {
  test(`knownShortener accepts ${href}`, () => {
    assert.strictEqual(load({ href }).api.knownShortener(), true);
  });
}

test('knownShortener still rejects unknown hosts', () => {
  assert.strictEqual(load({ href: 'https://example.com/x' }).api.knownShortener(), false);
});

test('knownMediaHost accepts the new file/image hosts', () => {
  assert.strictEqual(load({ href: 'https://gofile.download/d/abc' }).api.knownMediaHost(), true);
  assert.strictEqual(load({ href: 'https://postimg.cc/abc' }).api.knownMediaHost(), true);
  assert.strictEqual(load({ href: 'https://example.com/x' }).api.knownMediaHost(), false);
});

// --- P1: click-the-button ports ---

test('goo-st clicks .btn-primary', async () => {
  let clicked = false;
  const btn = clickable({ dispatchEvent: () => { clicked = true; return true; } });
  const h = load({ href: 'https://goo.st/abc', querySelector: qsMap({ '.btn-primary': btn }) });
  assert.strictEqual(await h.api.handleGooSt(), true);
  assert.strictEqual(clicked, true);
});

test('goo-st ignores other hosts', async () => {
  assert.strictEqual(await load({ href: 'https://example.com/' }).api.handleGooSt(), false);
});

test('tutwuri clicks the btn-1/2/3 sequence', async () => {
  const seen = [];
  const mk = (id) => clickable({ dispatchEvent: () => { seen.push(id); return true; } });
  const h = load({
    href: 'https://tutwuri.id/abc',
    querySelector: qsMap({ '#btn-1': mk(1), '#btn-2': mk(2), '#btn-3': mk(3) }),
  });
  assert.strictEqual(await h.api.handleTutwuri(), true);
  assert.deepStrictEqual([...new Set(seen)], [1, 2, 3]);
});

test('exeo-app clicks the three-stage sequence', async () => {
  const seen = [];
  const mk = (id) => clickable({ dispatchEvent: () => { seen.push(id); return true; } });
  const h = load({
    href: 'https://exeo.app/abc',
    querySelector: (sel) => {
      if (sel === '.link-button.button') return mk(1);
      if (sel === '.link-button') return mk(2);
      if (sel === '.button.link-button') return mk(3);
      return null;
    },
  });
  assert.strictEqual(await h.api.handleExeoApp(), true);
  assert.deepStrictEqual([...new Set(seen)], [1, 2, 3]);
});

test('adshnk clicks then follows #final_redirect', async () => {
  const btn = clickable();
  const h = load({
    href: 'https://adshnk.com/abc',
    querySelector: qsMap({
      'button[class="ui right labeled icon button primary huge fluid"]': btn,
      'a[id="final_redirect"]': { href: 'https://dest.example/x' },
    }),
  });
  assert.strictEqual(await h.api.handleAdshnk(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('spaste clicks the submit control', async () => {
  const h = load({
    href: 'https://www.spaste.com/site/abc',
    querySelector: qsMap({ '#template-contactform-submit': clickable() }),
  });
  assert.strictEqual(await h.api.handleSpaste(), true);
});

test('f95zone clicks .host_link on /masked/', async () => {
  const h = load({
    href: 'https://f95zone.to/masked/abc',
    querySelector: qsMap({ '.host_link': clickable() }),
  });
  assert.strictEqual(await h.api.handleF95zone(), true);
});

test('lnk2 strips overlays then clicks #getLink', async () => {
  let removed = 0;
  const h = load({
    href: 'https://lnk2.cc/go/abc',
    querySelector: qsMap({ '#getLink': clickable() }),
    querySelectorAllOverride: [{ remove: () => { removed += 1; } }],
  });
  assert.strictEqual(await h.api.handleLnk2(), true);
  assert.strictEqual(removed, 1);
});

test('icutlink follows the get-link href', async () => {
  const h = load({
    href: 'https://icutlink.com/abc',
    querySelector: qsMap({ '.btn-success.btn-lg.get-link': { href: 'https://dest.example/x' } }),
  });
  assert.strictEqual(await h.api.handleIcutlink(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('tribuntekno clicks verification buttons', async () => {
  const h = load({
    href: 'https://tribuntekno.com/abc',
    querySelector: qsMap({ '#lite-human-verif-button': clickable(), '#lite-start-sora-button': null }),
  });
  assert.strictEqual(await h.api.handleTribuntekno(), true);
});

test('get-click2 enables and clicks the goto button', async () => {
  let disabledRemoved = false;
  const btn = clickable({
    removeAttribute: () => { disabledRemoved = true; },
    disabled: true,
  });
  const h = load({
    href: 'https://get-click2.blogspot.com/abc',
    querySelector: qsMap({ 'button#gotolink': btn }),
  });
  assert.strictEqual(await h.api.handleGetClick2(), true);
  assert.strictEqual(disabledRemoved, true);
  assert.strictEqual(btn.disabled, false);
});

// --- P1: follow-the-href ports ---

for (const [fn, href, sel] of [
  ['handle1ink', 'https://1ink.cc/a', '#countingbtn'],
  ['handleCpmlink', 'https://cpmlink.net/a', '#btn-main'],
  ['handleThinfi', 'https://thinfi.com/a', 'div p a'],
  ['handleA2zapk', 'https://a2zapk.io/a', '#dlbtn li a'],
  ['handleRlu', 'https://preview.rlu.ru/a', '#content > .long_url > a'],
  ['handleHenTay', 'https://hen-tay.net/go/a', '#download_url div a'],
  ['handleYasir252', 'https://download.yasir252.com/a', 'a[id="downloadBtn"]'],
  ['handleImagetwistNetlify', 'https://imagetwist.netlify.app/a', 'center h2 p a, .btn-dark'],
  ['handleWpsafeAnchor', 'https://otomi-games.com/go/a', '#wpsafe-link a'],
  ['handleKimochi', 'https://kimochi.info/inter', 'a#next'],
]) {
  test(`${fn} follows its selector href`, async () => {
    const h = load({ href, querySelector: qsMap({ [sel]: { href: 'https://dest.example/x' } }) });
    assert.strictEqual(await h.api[fn](), true);
    assert.ok(h.navs.includes('https://dest.example/x'));
  });
}

for (const fn of [
  'handleGooSt', 'handle1ink', 'handleCpmlink', 'handleThinfi', 'handleKimochi',
  'handleA2zapk', 'handleBlogmado', 'handleMangalist', 'handleLinegee',
  'handleYasir252', 'handleImagetwistNetlify', 'handleUrlgalleries', 'handleHenTay',
  'handleWpsafeAnchor', 'handleTribuntekno', 'handleCuttty', 'handleFir3',
  'handleGplinks', 'handleIcutlink', 'handleTutwuri', 'handleExeoApp', 'handleLnk2',
  'handleSpaste', 'handleF95zone', 'handleRlu', 'handleAdshnk', 'handleSimilarsites',
  'handleLolinez', 'handleUrlcash', 'handleGoLinkify', 'handleNetworkLoop',
  'handleGetClick2',
]) {
  test(`${fn} ignores other hosts`, async () => {
    assert.strictEqual(await load({ href: 'https://example.com/' }).api[fn](), false);
  });
}

// --- P1: path/query decoders ---

test('similarsites decodes /goto/ path', async () => {
  const h = load({ href: 'https://similarsites.com/goto/https://dest.example/x' });
  assert.strictEqual(await h.api.handleSimilarsites(), true);
  assert.ok(h.navs[0].startsWith('https://dest.example/x'));
});

test('lolinez follows the bare query', async () => {
  const h = load({ href: 'https://www.lolinez.com/?https://dest.example/x' });
  assert.strictEqual(await h.api.handleLolinez(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

// --- P2: page-global, script search, shadow DOM ---

test('urlcash falls back to linkDestUrl in page HTML', async () => {
  const h = load({ href: 'https://urlcash.com/a' });
  h.doc.body.innerHTML = "var linkDestUrl = 'https://dest.example/x';";
  assert.strictEqual(await h.api.handleUrlcash(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('go-linkify extracts the /get/ URL from scripts', async () => {
  const h = load({
    href: 'https://go.linkify.ru/a',
    querySelectorAllOverride: [{ textContent: 'var u="https://go.linkify.ru/get/abc123";' }],
  });
  assert.strictEqual(await h.api.handleGoLinkify(), true);
  assert.ok(h.navs.includes('https://go.linkify.ru/get/abc123'));
});

test('network-loop follows the shadow-DOM button', async () => {
  const shadowBtn = { href: 'https://dest.example/x' };
  const h = load({
    href: 'https://network-loop.com/?u=abc',
    querySelector: () => null,
    querySelectorAllOverride: [{
      shadowRoot: {
        querySelector: (s) => (s === 'a#pb_2' ? shadowBtn : null),
        querySelectorAll: () => [],
      },
    }],
  });
  assert.strictEqual(await h.api.handleNetworkLoop(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('boost-ink body[result] fast-path', async () => {
  const h = load({ href: 'https://boost.ink/a' });
  h.doc.body.getAttribute = (k) => (k === 'result' ? Buffer.from('https://dest.example/x').toString('base64') : null);
  assert.strictEqual(await h.api.handleBoostInk(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

// --- P0: image_src + file-host selectors ---

test('image-host follows link[rel=image_src]', async () => {
  const h = load({
    href: 'https://postimg.cc/view/abc',
    querySelector: qsMap({ 'link[rel="image_src"]': { href: 'https://postimg.cc/pic.jpg' } }),
  });
  assert.strictEqual(await h.api.handleImageHost(), true);
  assert.ok(h.navs.includes('https://postimg.cc/pic.jpg'));
});

test('file-host finds #download-button controls', async () => {
  const btn = clickable({ tagName: 'A', href: 'https://gofile.download/d/abc' });
  const h = load({
    href: 'https://gofile.download/d/xyz',
    querySelector: (sel) => (sel.includes('#download-button') ? btn : null),
  });
  assert.strictEqual(await h.api.handleFileHost(), true);
  assert.ok(h.navs.includes('https://gofile.download/d/abc'));
});
