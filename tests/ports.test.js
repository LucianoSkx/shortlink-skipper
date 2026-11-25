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

test('turkdown follows the get-link href', async () => {
  const h = load({
    href: 'https://link.turkdown.com/abc',
    querySelector: qsMap({ '.btn-success.btn-lg.get-link': { href: 'https://dest.example/x' } }),
  });
  assert.strictEqual(await h.api.handleTurkdown(), true);
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
  'handleGplinks', 'handleIcutlink', 'handleTurkdown', 'handleTutwuri', 'handleExeoApp', 'handleLnk2',
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

test('file-host follows a#dlink controls', async () => {
  const link = clickable({ tagName: 'A', href: 'https://katfile.vip/abc/file.rar' });
  const h = load({
    href: 'https://katfile.vip/xyz',
    querySelector: (sel) => (sel.includes('dlink') ? link : null),
  });
  assert.strictEqual(await h.api.handleFileHost(), true);
  assert.ok(h.navs.includes('https://katfile.vip/abc/file.rar'));
});

// --- forumdinheiro (adsbypasser port: tRPC stage chain) ---

function forumdinheiroFetch(seen) {
  return (url, opts) => {
    seen.push({ url: String(url), headers: (opts && opts.headers) || {} });
    if (String(url).includes('/api/session-info')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          hasSession: true, stageNumber: 0, totalStage: 1,
          sessionToken: 'tok', stageId: 'stage',
        }),
      });
    }
    return Promise.resolve({
      text: () => Promise.resolve('[{"result":{"data":{"json":{"destinationLink":"https://dest.example/final"}}}}]'),
    });
  };
}

test('forumdinheiro walks the stage chain to the destination', async () => {
  const seen = [];
  const h = load({ href: 'https://forumdinheiro.com/abc' });
  h.setFetch(forumdinheiroFetch(seen));
  assert.strictEqual(await h.api.handleForumdinheiro(), true);
  assert.ok(h.navs.includes('https://dest.example/final'));
  const trpc = seen.find((c) => c.url.includes('linkSession.nextStage'));
  assert.ok(trpc, 'must call the tRPC endpoint');
  assert.strictEqual(trpc.headers['trpc-accept'], 'application/jsonl');
  assert.ok(trpc.url.includes('tok'), 'must send the session token');
});

test('forumdinheiro stands down without a session', async () => {
  const h = load({ href: 'https://guis2.com/abc' });
  h.setFetch(() => Promise.resolve({ json: () => Promise.resolve({ hasSession: false }) }));
  assert.strictEqual(await h.api.handleForumdinheiro(), false);
  assert.strictEqual(h.navs.length, 0);
});

test('forumdinheiro ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/' });
  assert.strictEqual(await h.api.handleForumdinheiro(), false);
});

test('forumdinheiro family opens the shortener gate', () => {
  for (const href of [
    'https://forumdinheiro.com/abc',
    'https://guis2.com/abc',
    'https://tarviral.com/abc',
    'https://umconto.com/abc',
  ]) {
    const h = load({ href });
    assert.strictEqual(h.api.knownShortener(), true, href);
  }
});

// --- P1: pahe batch 1 ports ---

test('aii-sh solves then follows', async () => {
  const h = load({
    href: 'https://aii.sh/x',
    querySelector: (sel) => {
      if (sel === 'button#continue') return clickable();
      if (sel === '.btn-primary[href]:not(.disabled)') return { href: 'https://dest.example/x' };
      return null;
    },
  });
  assert.strictEqual(await h.api.handleAiiSh(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

for (const [fn, href, sel] of [
  ['handleApkadmin', 'https://apkadmin.com/x', '#downloadbtn'],
  ['handleAvnsgames', 'https://avnsgames.com/x', '#getnewlink'],
  ['handleBitly', 'https://bit.ly/x', '[id="action:continue"]'],
  ['handleBlogAdlinkClick', 'https://blog.adlink.click/x', '.btn.get-link'],
  ['handleFilekeeper', 'https://filekeeper.net/x', '#download-button'],
  ['handleFuckingFast', 'https://fuckingfast.co/x', '.link-button'],
  ['handleHorrorpay', 'https://horrorpay.online/x', '.get-link:not(.disabled)'],
  ['handleEnMrproblogger', 'https://en.mrproblogger.com/x', '.get-link:not(.disabled)'],
]) {
  test(`${fn} acts on its selector`, async () => {
    const h = load({ href, querySelector: qsMap({ [sel]: clickable() }) });
    assert.strictEqual(await h.api[fn](), true);
  });
}

test('datanodes walks download stages', async () => {
  const freeBtn = clickable();
  const startBtn = clickable();
  const h = load({
    href: 'https://datanodes.to/x',
    querySelector: (sel) => (sel === '#method_free:not([disabled])' ? clickable() : null),
    querySelectorAllOverride: [],
  });
  // findByText returns clickable by text via qs not mocked; ensure handled by checking non-fatal
  assert.strictEqual(await h.api.handleDatanodes(), true);
});

for (const fn of [
  'handleAiiSh', 'handleApkadmin', 'handleAvnsgames', 'handleBitly', 'handleBlogAdlinkClick',
  'handleDatanodes', 'handleEnMrproblogger', 'handleFilekeeper', 'handleFuckingFast', 'handleHorrorpay',
]) {
  test(`${fn} ignores other hosts`, async () => {
    assert.strictEqual(await load({ href: 'https://example.com/' }).api[fn](), false);
  });
}

// --- P1: pahe batch 2 ports ---

// Stage chains: the mock answers every selector the handler walks, so no step
// burns its 9s waitFor timeout (each miss used to add 9s to this file).
for (const [fn, href, sels] of [
  ['handleFilespayouts', 'https://filespayouts.com/x', ['#method_free']],
  ['handleVexfile', 'https://vexfile.com/x', ['.generate-link:not(.blocked)']],
  ['handleShrinkmeClick', 'https://shrinkme.click/x', ['.btn-primary:not([disabled])', '.get-link:not(.disabled)']],
  ['handleUiilInk', 'https://uiil.ink/x', ['#form-continue [type="submit"]', '#multiLinkBtn:not(.disabled)']],
]) {
  test(`${fn} acts on its selector`, async () => {
    const h = load({ href, querySelector: qsMap(Object.fromEntries(sels.map((sel) => [sel, clickable()]))) });
    assert.strictEqual(await h.api[fn](), true);
  });
}

test('handleCloudfam opens its anchors', async () => {
  const h = load({
    href: 'https://cloudfam.io/x',
    querySelector: (sel) => ({ href: 'https://dest.example/x' }),
  });
  assert.strictEqual(await h.api.handleCloudfam(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('handleInshorturlIn follows its anchor', async () => {
  const h = load({
    href: 'https://inshorturl.in/x',
    querySelector: (sel) => ({ href: 'https://dest.example/x' }),
  });
  assert.strictEqual(await h.api.handleInshorturlIn(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('handleToolkitInshorturl follows its anchor', async () => {
  const h = load({
    href: 'https://toolkit.inshorturl.com/x',
    querySelector: (sel) => ({ href: 'https://dest.example/x' }),
  });
  assert.strictEqual(await h.api.handleToolkitInshorturl(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('handleMahitimanch clicks then follows', async () => {
  const h = load({
    href: 'https://mahitimanch.in/x',
    querySelector: (sel) => {
      if (sel === '#link' || sel === '#linkx') return clickable();
      if (sel === '#gtelinkbtn') return { href: 'https://dest.example/x' };
      return null;
    },
  });
  assert.strictEqual(await h.api.handleMahitimanch(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('handleZdrive clicks stages', async () => {
  const h = load({
    href: 'https://zdrive.to/x',
    querySelector: qsMap({ '#freeBtn': clickable(), '#down_1Form button': clickable(), '#down_2Form button': clickable(), '.btn-download:not(.disabled)': clickable() }),
  });
  assert.strictEqual(await h.api.handleZdrive(), true);
});

for (const fn of [
  'handleCloudUnblockedGames', 'handleCloudfam', 'handleFilespayouts',
  'handleInshorturlIn', 'handleMahitimanch', 'handleShrinkmeClick',
  'handleToolkitInshorturl', 'handleUiilInk', 'handleVexfile', 'handleZdrive',
]) {
  test(`${fn} ignores other hosts`, async () => {
    assert.strictEqual(await load({ href: 'https://example.com/' }).api[fn](), false);
  });
}

// --- P1: pahe batch 3 ports ---

for (const [fn, href, sels] of [
  ['handleAknewz', 'https://aknewz.xyz/x', ['#next', '#scroll:not(.hidden)', '[id="surl"]']],
  ['handleJobzhub', 'https://jobzhub.store/x', ['#next', '#scroll', '#glink', '[id="surl"]']],
  ['handleNerventualken', 'https://nerventualken.com/x', ['[id="go"]']],
  ['handleSafelinkearn', 'https://safelinkearn.com/x', ['.open-btn']],
  ['handleSpeedyLinks', 'https://speedy-links.com/x', ['[data-task]', '.d31-unlock-btn.enabled']],
  ['handleToolskitpro', 'https://toolskitpro.net/x', ['.show #afterBtn', '#nxt', '#getl']],
  ['handleXut', 'https://xut.io/x', ['#sl-primary:not([disabled])', '.get-link:not(.disabled)']],
]) {
  test(`${fn} acts on its selector`, async () => {
    const h = load({ href, querySelector: qsMap(Object.fromEntries(sels.map((sel) => [sel, clickable()]))) });
    assert.strictEqual(await h.api[fn](), true);
  });
}

test('handleAradmag clicks stages', async () => {
  const h = load({
    href: 'https://aradmag.online/x',
    querySelector: qsMap({ '[id^="ow_step"]:last-of-type button': clickable(), '#offerContinueBtn': clickable(), '#continueBtn:not([disabled])': clickable() }),
  });
  assert.strictEqual(await h.api.handleAradmag(), true);
});

test('handleFinanceHost walks stages', async () => {
  const h = load({
    href: 'https://financeehelp.com/x',
    querySelector: qsMap({ '#startButton': clickable(), 'a[href="#getmylink"]': clickable(), '#getnewlink': clickable() }),
  });
  assert.strictEqual(await h.api.handleFinanceHost(), true);
});

test('handleLnbz then follows', async () => {
  const h = load({
    href: 'https://lnbz.la/x',
    querySelector: (sel) => {
      if (sel === '[id="continue"]') return clickable();
      if (sel === '.get-link:not(.disabled)') return { href: 'https://dest.example/x' };
      return null;
    },
  });
  assert.strictEqual(await h.api.handleLnbz(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

for (const fn of [
  'handleAknewz', 'handleAradmag', 'handleFinanceHost', 'handleJobzhub',
  'handleLnbz', 'handleNerventualken', 'handleSafelinkearn', 'handleSpeedyLinks',
  'handleToolskitpro', 'handleXut',
]) {
  test(`${fn} ignores other hosts`, async () => {
    assert.strictEqual(await load({ href: 'https://example.com/' }).api[fn](), false);
  });
}

// --- P1: pahe batch 4 ports ---
for (const [fn, href, sels] of [
  ['handleFclc', 'https://fc-lc.xyz/x', ['button#hCaptchaShortlink', 'button#submitBtn']],
  ['handleThemezon', 'https://themezon.net/x', ['button#smg-arm:not([disabled])', 'form:not([hidden]) .smg-go:not([disabled])']],
]) {
  test(`${fn} acts on its selector`, async () => {
    const h = load({ href, querySelector: qsMap(Object.fromEntries(sels.map((sel) => [sel, clickable()]))) });
    assert.strictEqual(await h.api[fn](), true);
  });
}

for (const fn of ['handleFclc', 'handleThemezon']) {
  test(`${fn} ignores other hosts`, async () => {
    assert.strictEqual(await load({ href: 'https://example.com/' }).api[fn](), false);
  });
}

// --- P1: pahe batch 5 ports ---
test('handleIntercelestial clicks then follows', async () => {
  const h = load({
    href: 'https://intercelestial.com/?ht=abc',
    querySelector: (sel) => {
      if (sel === '.myButton') return clickable();
      if (sel === '#xxc[href]') return { href: 'https://dest.example/x' };
      return null;
    },
  });
  assert.strictEqual(await h.api.handleIntercelestial(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('handlePahePlus follows final link', async () => {
  const h = load({
    href: 'https://pahe.plus/x',
    querySelector: (sel) => {
      if (sel === '[id="invisibleCaptchaShortlink"]:not([disabled])') return clickable();
      if (sel === '.get-link[href^="https://"]:not(.disabled)') return { href: 'https://dest.example/x' };
      return null;
    },
  });
  assert.strictEqual(await h.api.handlePahePlus(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

for (const fn of ['handleIntercelestial', 'handlePahePlus']) {
  test(`${fn} ignores other hosts`, async () => {
    assert.strictEqual(await load({ href: 'https://example.com/' }).api[fn](), false);
  });
}

// --- P1: pahe batch 6 ports ---
for (const [fn, href, sels] of [
  ['handleDevuploads', 'https://djxmaza.in/x', ['#gdl', '#gdlf', '#dln']],
  ['handlePndk', 'https://invest.datapendidikan.com/x', ['#continue', '#next-btn button']],
  ['handleUp4Ever', 'https://www.up-4ever.net/x', ['button[name="method_free"]', '#downloadbtn', '[type="submit"]:not([disabled])', '#dl2btn']],
]) {
  test(`${fn} acts on its selector`, async () => {
    const h = load({ href, querySelector: qsMap(Object.fromEntries(sels.map((sel) => [sel, clickable()]))) });
    assert.strictEqual(await h.api[fn](), true);
  });
}
for (const fn of ['handleDevuploads', 'handlePndk', 'handleUp4Ever']) {
  test(`${fn} ignores other hosts`, async () => {
    assert.strictEqual(await load({ href: 'https://example.com/' }).api[fn](), false);
  });
}

// --- P1: pahe batch 7 (coinclix / geekgrove) ---
for (const [fn, href] of [
  ['handleCoinclix', 'https://coinclix.co/x'],
  ['handleGeekgrove', 'https://geekgrove.net/x'],
]) {
  test(`${fn} ignores other hosts`, async () => {
    assert.strictEqual(await load({ href: 'https://example.com/' }).api[fn](), false);
  });
}
test('handleGeekgrove ignores other hosts already (placeholder)', async () => {
  assert.strictEqual(await load({ href: 'https://example.com/' }).api.handleGeekgrove(), false);
});

// --- P1: pahe batch 8 ---
for (const [fn, href, sels] of [
  ['handleFileUploadOrg', 'https://www.file-upload.org/x', ['button[name="method_free"]', '#downloadbtn:not([disabled])']],
  ['handleUpfilesgo', 'https://upfilesgo.com/x', ['#link-button-free:not([disabled])', '#file-captcha #link-button:not([disabled])']],
]) {
  test(`${fn} acts on its selector`, async () => {
    const h = load({ href, querySelector: qsMap(Object.fromEntries(sels.map((sel) => [sel, clickable()]))) });
    assert.strictEqual(await h.api[fn](), true);
  });
}
test('loot-reward decodes the ?cc= destination locally', async () => {
  const dest = 'https://dest.example/x';
  const cc = Buffer.from(JSON.stringify({ link: dest })).toString('base64url');
  const h = load({ href: `https://loot-reward.com/t?cc=${cc}` });
  assert.strictEqual(await h.api.handleLootReward(), true);
  assert.ok(h.navs.includes(dest));
  assert.strictEqual(h.api.decodeLootRewardCc(cc), dest);
});

test('loot-reward decodes a doubly wrapped cc payload', () => {
  const dest = 'https://dest.example/y';
  const inner = Buffer.from(JSON.stringify({ link: dest })).toString('base64');
  const outer = Buffer.from(inner).toString('base64url');
  const h = load({ href: 'https://loot-reward.com/t' });
  assert.strictEqual(h.api.decodeLootRewardCc(outer), dest);
});

test('loot-reward refuses a payload without a usable link', async () => {
  const h = load({ href: 'https://loot-reward.com/t?cc=not-base64-at-all!!' });
  assert.strictEqual(await h.api.handleLootReward(), false);
  assert.strictEqual(h.navs.length, 0);
  assert.strictEqual(h.api.decodeLootRewardCc(Buffer.from(JSON.stringify({ link: 'javascript:alert(1)' })).toString('base64url')), null);
  assert.strictEqual(h.api.decodeLootRewardCc(''), null);
});

test('loot-reward ignores other hosts', async () => {
  const cc = Buffer.from(JSON.stringify({ link: 'https://dest.example/x' })).toString('base64url');
  const h = load({ href: `https://example.com/t?cc=${cc}` });
  assert.strictEqual(await h.api.handleLootReward(), false);
  assert.strictEqual(h.navs.length, 0);
});

for (const fn of ['handleFileUploadOrg', 'handleUpfilesgo']) {
  test(`${fn} ignores other hosts`, async () => {
    assert.strictEqual(await load({ href: 'https://example.com/' }).api[fn](), false);
  });
}

// --- domain variants of families that already have rules (upstream gap report) ---
for (const [fn, href, sel] of [
  ['handleCuttty', 'https://cuty.io/x', '#submit-button'],
  ['handleA2zapk', 'https://a2zapk.dev/x', '#dlbtn li a'],
  ['handleGplinks', 'https://gplinks.com/x', '.get-link'],
  ['handleKatfile', 'https://katfile.com/x', '.btn.btn-default'],
]) {
  test(`${fn} acts on its new domain variant`, async () => {
    const h = load({ href, querySelector: qsMap({ [sel]: clickable({ href: 'https://dest.example/x' }) }) });
    assert.strictEqual(await h.api[fn](), true);
  });
}

// --- Pahe-family hosts observed on andradeatdev/auto-continue-shortlinks ---
for (const host of ['cutlink.net', 'cutnet.net', 'cuttlinks.com', 'cety.app']) {
  test(`cuttty family clicks #submit-button on ${host}`, async () => {
    const h = load({ href: `https://${host}/x`, querySelector: qsMap({ '#submit-button': clickable() }) });
    assert.strictEqual(await h.api.handleCuttty(), true);
  });
}

test('srnky/clksz click a primary/secondary button', async () => {
  const sel = 'button.btn-primary:not([disabled]):not(.disabled), button.btn-success:not([disabled]):not(.disabled), a.btn-primary[href]:not(.disabled), a.btn-success[href]:not(.disabled)';
  for (const host of ['srnky.com', 'clksz.com']) {
    const h = load({ href: `https://${host}/r/abc`, querySelector: qsMap({ [sel]: clickable() }) });
    assert.strictEqual(await h.api.handleSrnky(), true);
  }
});

test('exe-urls family clicks #submit-button in stages', async () => {
  const sel = '#submit-button:not([disabled])';
  for (const host of ['exe.io', 'exe-urls.com', 'exego.app', 'exnion.com']) {
    const h = load({ href: `https://${host}/x`, querySelector: qsMap({ [sel]: clickable() }) });
    assert.strictEqual(await h.api.handleExeUrls(), true);
  }
});

test('sl-primary family clicks #sl-primary or .get-link', async () => {
  const sel = '#sl-primary:not([disabled])';
  for (const host of ['textfrog.com', 'eduify.app', 'gamescrate.app']) {
    const h = load({ href: `https://${host}/x`, querySelector: qsMap({ [sel]: clickable() }) });
    assert.strictEqual(await h.api.handleSlPrimary(), true);
  }
});

test('safefileku clicks the submit control', async () => {
  const sel = 'button[type="submit"]:not([disabled])';
  const h = load({ href: 'https://safefileku.com/x', querySelector: qsMap({ [sel]: clickable() }) });
  assert.strictEqual(await h.api.handleSafefileku(), true);
});

test('new pahe-family hosts open the gate', () => {
  for (const host of ['srnky.com', 'clksz.com', 'cutlink.net', 'exe.io', 'exe-urls.com', 'textfrog.com', 'simpcity.cr', 'ashnk.com', 'shrink-service.it']) {
    const h = load({ href: `https://${host}/x`, querySelector: () => null });
    assert.strictEqual(h.api.knownShortener(), true, host + ' must open the shortener gate');
  }
  const media = load({ href: 'https://safefileku.com/x', querySelector: () => null });
  assert.strictEqual(media.api.knownMediaHost(), true, 'safefileku.com must open the media gate');
});

test('adshnk handles ashnk/shrink-service variants', async () => {
  for (const host of ['ashnk.com', 'shrink-service.it']) {
    const h = load({
      href: `https://${host}/abc`,
      querySelector: qsMap({
        'button[class="ui right labeled icon button primary huge fluid"]': clickable(),
        'a[id="final_redirect"]': { href: 'https://dest.example/file' },
      }),
    });
    assert.strictEqual(await h.api.handleAdshnk(), true);
    assert.ok(h.navs.includes('https://dest.example/file'));
  }
});

test('simpcity.cr decodes its base64 ?to= redirect', async () => {
  const dest = 'https://dest.example/post/1';
  const to = Buffer.from(dest).toString('base64url');
  const h = load({ href: `https://simpcity.cr/redirect?to=${encodeURIComponent(to)}` });
  assert.strictEqual(await h.api.handleSimpcity(), true);
  assert.ok(h.navs.includes(dest));
  const other = load({ href: 'https://simpcity.cr/thread/1' });
  assert.strictEqual(await other.api.handleSimpcity(), false);
});

test('katfile leaves a#dlink to file-host instead of clicking blindly', async () => {
  const h = load({
    href: 'https://katfile.com/x',
    querySelector: (sel) => (sel === 'a[id="dlink"][href]' ? { href: 'https://dest.example/file.rar' } : null),
  });
  assert.strictEqual(await h.api.handleKatfile(), false);
  assert.strictEqual(h.navs.length, 0);
});

test('new gate domains open knownShortener / knownMediaHost', () => {
  for (const href of ['https://cuty.io/x', 'https://a2zapk.dev/x', 'https://gplinks.com/x', 'https://sfile.co/x']) {
    const h = load({ href, querySelector: () => null });
    assert.strictEqual(h.api.knownShortener(), true, href + ' must open the gate');
  }
  for (const href of ['https://katfile.co/x', 'https://katfile.com/x', 'https://2i.cz/x', 'https://2i.sk/x', 'https://pixsera.net/x', 'https://3xpla.net/x', 'https://3xplanet.xyz/x']) {
    const h = load({ href, querySelector: () => null });
    assert.strictEqual(h.api.knownMediaHost(), true, href + ' must open the media gate');
  }
});

test('pixsera.net follows imgair inline-script technique', async () => {
  const h = load({ href: 'https://pixsera.net/x' });
  h.doc.querySelectorAll = () => [{ textContent: 'imgbg.src = "https://img.example/a.jpg";' }];
  assert.strictEqual(await h.api.handleImgair(), true);
  assert.ok(h.navs.includes('https://img.example/a.jpg'));
});

// --- handlers that were missing from module.exports (unreachable from the harness) ---
for (const fn of ['handleOuo', 'handleAdFoc', 'handleLootlabs', 'handleSetcForm']) {
  test(`${fn} is exported and ignores other hosts`, async () => {
    assert.strictEqual(typeof load({ href: 'https://example.com/' }).api[fn], 'function');
    if (fn === 'handleSetcForm') return; // when()-only rule: no host guard to assert
    assert.strictEqual(await load({ href: 'https://example.com/' }).api[fn](), false);
  });
}

test('handleOuo follows the nextUrl global on ouo.today', async () => {
  const h = load({ href: 'https://ouo.today/x' });
  h.sandbox.nextUrl = 'https://dest.example/x';
  assert.strictEqual(await h.api.handleOuo(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('handleAdFoc follows the click_url global', async () => {
  const h = load({ href: 'https://adfoc.us/123' });
  h.sandbox.click_url = 'https://dest.example/x';
  assert.strictEqual(await h.api.handleAdFoc(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('handleAdFoc falls back to the hidden #y field', async () => {
  const h = load({ href: 'https://adfoc.us/123' });
  h.doc.getElementById = (id) => (id === 'y' ? { value: 'https://dest.example/x' } : null);
  assert.strictEqual(await h.api.handleAdFoc(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('handleSetcForm follows the #setc form action', async () => {
  const h = load({
    href: 'https://example.com/x',
    querySelector: (sel) => (sel === 'form#setc' ? { action: 'https://dest.example/x' } : null),
  });
  assert.strictEqual(await h.api.handleSetcForm(), true);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('handleSetcForm decodes the #landing go field', async () => {
  const dest = 'https://dest.example/x';
  const encoded = 'zz' + Buffer.from(dest).toString('base64');
  const h = load({
    href: 'https://example.com/x',
    querySelector: (sel) =>
      sel === 'form#landing'
        ? { querySelector: () => ({ value: encoded }) }
        : null,
  });
  assert.strictEqual(await h.api.handleSetcForm(), true);
  assert.ok(h.navs.includes(dest));
});
