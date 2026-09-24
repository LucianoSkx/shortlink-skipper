'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers/harness');

function visibleBtn(extra = {}) {
  return {
    tagName: 'A',
    className: '',
    disabled: false,
    hidden: false,
    innerText: 'Get Link',
    dispatchEvent: () => true,
    getBoundingClientRect: () => ({ width: 60, height: 20 }),
    scrollIntoView() {},
    getAttribute: () => null,
    ...extra,
  };
}

// --- close-interstitial ---

test('close-interstitial closes the tab on interstitial hosts', async () => {
  const h = load({ href: 'https://doaipomer.com/x' });
  let closed = false;
  h.sandbox.close = () => { closed = true; };
  const ok = await h.api.handleCloseInterstitial();
  assert.strictEqual(ok, true);
  assert.strictEqual(closed, true);
});

test('close-interstitial ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleCloseInterstitial(), false);
});

// --- rekonise ---

test('rekonise extracts a destination from the unlock API', async () => {
  const h = load({ href: 'https://rekonise.com/some-unlock' });
  h.setFetch(() =>
    Promise.resolve({
      json: () => Promise.resolve({
        link: 'https://dest.example/file',
        banner: 'https://cdn.example/banner.png',
      }),
    }),
  );
  const ok = await h.api.handleRekonise();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://dest.example/file'), 'image candidates must be skipped');
});

test('rekonise ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleRekonise(), false);
});

// --- mboost ---

test('mboost extracts targeturl from the page source', async () => {
  const h = load({ href: 'https://mboost.me/abc' });
  h.doc.documentElement.outerHTML = '"targeturl\\":\\"https://dest.example/x"';
  const ok = await h.api.handleMboost();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://dest.example/x'));
});

test('mboost ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleMboost(), false);
});

// --- lootlink-local ---

test('lootlink-local stands down when page globals are unavailable', async () => {
  const h = load({ href: 'https://loot-link.com/s/abc' });
  assert.strictEqual(await h.api.handleLootLinkLocal(), false);
});

test('lootlink-local ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleLootLinkLocal(), false);
});

// --- aylink-family ---

test('aylink-family fetches the token and goes through /links/go2', async () => {
  const h = load({ href: 'https://aylink.co/file123' });
  h.sandbox.app = { csrf: 'csrf-token' };
  h.sandbox._a = 1;
  h.sandbox._t = 2;
  h.sandbox._d = 3;
  h.setFetch((url) => {
    if (String(url).includes('/get/tk')) {
      return Promise.resolve({ json: () => Promise.resolve({ th: 'tkn-value' }) });
    }
    if (String(url).includes('/links/go2')) {
      return Promise.resolve({ json: () => Promise.resolve({ url: 'https://dest.example/file' }) });
    }
    return Promise.resolve({ json: () => Promise.resolve(null) });
  });
  const ok = await h.api.handleAylink();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://dest.example/file'));
});

test('aylink-family requires page globals', async () => {
  const h = load({ href: 'https://aylink.co/file123' });
  assert.strictEqual(await h.api.handleAylink(), false);
});

test('aylink-family ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleAylink(), false);
});

// --- bcvc ---

const BCVC_GLOBALS = { tZ: 1, cW: 2, cH: 3, tkn: 't', sW: 4, sH: 5, xyz: 99 };

test('bcvc posts the payload and clicks getLink when globals are present', async () => {
  const h = load({ href: 'https://bcvc.live/abc' });
  Object.assign(h.sandbox, BCVC_GLOBALS);
  const btn = visibleBtn();
  h.doc.getElementById = (id) => (id === 'getLink' ? btn : null);
  h.setFetch(() => Promise.resolve({ json: () => Promise.resolve({ message: { url: 'https://dest.example/bc' } }) }));
  const ok = await h.api.handleBcVc();
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(ok, true);
  assert.ok(h.navs.includes('https://dest.example/bc'));
});

test('bcvc stands down without globals or markers', async () => {
  const h = load({ href: 'https://bcvc.live/abc' });
  assert.strictEqual(await h.api.handleBcVc(), false);
});

test('bcvc API failure does not leak an unhandled rejection', async () => {
  const h = load({ href: 'https://bcvc.live/abc' });
  Object.assign(h.sandbox, BCVC_GLOBALS);
  h.doc.getElementById = () => visibleBtn();
  h.setFetch(() => Promise.reject(new Error('network down')));
  const seen = [];
  const onRej = (reason) => seen.push(reason);
  process.on('unhandledRejection', onRej);
  try {
    const ok = await h.api.handleBcVc();
    await new Promise((r) => setTimeout(r, 30));
    assert.strictEqual(ok, true);
    assert.strictEqual(seen.length, 0, 'the catch must absorb the rejected postForm');
  } finally {
    process.removeListener('unhandledRejection', onRej);
  }
});

test('bcvc ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleBcVc(), false);
});

// --- skip-button-dest ---

function skipBtn(hrefValue) {
  return {
    getAttribute: (a) => (a === 'href' ? hrefValue : null),
  };
}

test('skip-button-dest decodes the dest param through URL parsing', async () => {
  const h = load({
    href: 'https://hurirk.net/x',
    querySelector: (sel) => (sel.includes('#skip_bu2tton') ? skipBtn('/r?dest=https%3A%2F%2Fdest.example%2Ff') : null),
  });
  const ok = await h.api.handleSkipButtonDest();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://dest.example/f'));
});

test('skip-button-dest ignores trailing params after dest', async () => {
  const h = load({
    href: 'https://hurirk.net/x',
    querySelector: (sel) => (sel.includes('#skip_bu2tton') ? skipBtn('/r?dest=https://dest.example/f&track=1') : null),
  });
  const ok = await h.api.handleSkipButtonDest();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://dest.example/f'), 'track=1 must not leak into the destination');
});

test('skip-button-dest survives a malformed percent-encoding', async () => {
  const h = load({
    href: 'https://hurirk.net/x',
    querySelector: (sel) => (sel.includes('#skip_bu2tton') ? skipBtn('/r?dest=%zz') : null),
  });
  assert.strictEqual(await h.api.handleSkipButtonDest(), false);
});

test('skip-button-dest builds an absolute /ad/locked target', async () => {
  const h = load({ href: 'https://hurirk.net/ad/locked?h=abc&url=zzz' });
  const ok = await h.api.handleSkipButtonDest();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://hurirk.net/-abc/zzz'), 'relative path must be resolved against the origin');
});

test('skip-button-dest ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleSkipButtonDest(), false);
});

// --- acortalink ---

test('acortalink fires the countdown button', async () => {
  let clicks = 0;
  const btn = visibleBtn({ dispatchEvent: () => { clicks += 1; return true; } });
  const h = load({
    href: 'https://acortalink.me/abc',
    querySelector: (sel) => (sel.includes('#contador') ? btn : null),
  });
  const ok = await h.api.handleAcortalink();
  assert.ok(ok);
  assert.ok(clicks > 0, 'the countdown button must receive the click sequence');
});

test('acortalink ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleAcortalink(), false);
});

// --- bstlar ---

test('bstlar installs the tasks XHR hook and yields', async () => {
  const h = load({ href: 'https://bstlar.com/x' });
  const ok = await h.api.handleBstlar();
  assert.strictEqual(ok, false, 'the hook resolves asynchronously; the rule itself yields');
  assert.strictEqual(h.sandbox.__slBstlarHooked, true, 'hook must be installed');
});

test('bstlar ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleBstlar(), false);
  assert.strictEqual(h.sandbox.__slBstlarHooked, undefined);
});

// --- token-link ---

test('token-link decodes the token input', async () => {
  const h = load({
    href: 'https://tpi.li/abc',
    querySelector: (sel) => (sel === 'input[name="token"]' ? { value: btoa('https://dest.example/t') } : null),
  });
  const ok = await h.api.handleTokenLink();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://dest.example/t'));
});

test('token-link ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleTokenLink(), false);
});

// --- zafree-link-view ---

test('zafree fills the link-view coordinates and submits', async () => {
  const inputs = {};
  const form = {
    querySelector: (sel) => {
      if (!(sel in inputs)) inputs[sel] = { value: '' };
      return inputs[sel];
    },
    dispatchEvent: () => true,
    requestSubmit: () => {},
  };
  const h = load({
    href: 'https://za.gl/abc',
    querySelector: (sel) => (sel === 'form#link-view' ? form : null),
  });
  const ok = await h.api.handleZafree();
  assert.ok(ok);
  assert.strictEqual(inputs['#x'].value, '192');
  assert.strictEqual(inputs['input[name="givenX"]'].value, 'VFl0utOEF6a7BiS8YJdqTg==');
});

test('zafree ignores other hosts', async () => {
  const h = load({ href: 'https://example.com/x' });
  assert.strictEqual(await h.api.handleZafree(), false);
});

// --- adlinkfly-captcha ---

test('adlinkfly-captcha clicks the invisible captcha when it unlocks', async () => {
  const h = load({
    href: 'https://short.site.example/abc',
    querySelector: (sel) => (sel === '#invisibleCaptchaShortlink' ? visibleBtn() : null),
  });
  assert.strictEqual(await h.api.handleInvisibleCaptcha(), true);
});

test('adlinkfly-captcha stays out when the button never appears', async () => {
  const h = load({ href: 'https://short.site.example/abc', querySelector: () => null });
  assert.strictEqual(await h.api.handleInvisibleCaptcha(), false);
});

// --- go-link-form ---

test('go-link-form clicks the submit control', async () => {
  const btn = visibleBtn();
  const form = { querySelector: () => btn, querySelectorAll: () => [], innerText: '' };
  const h = load({
    href: 'https://short.site.example/abc',
    querySelector: (sel) => (sel.includes('go-link') ? form : null),
  });
  assert.strictEqual(await h.api.handleGoLinkForm(), true);
});

// --- wpsafelink ---

test('wpsafelink follows the JSON linkr variant', async () => {
  const h = load({
    href: 'https://short.site.example/abc',
    querySelector: (sel) =>
      sel.includes('newwpsafelink')
        ? { value: btoa(JSON.stringify({ linkr: 'https://dest.example/w' })) }
        : null,
  });
  const ok = await h.api.handleWpSafeLink();
  assert.ok(ok);
  assert.ok(h.navs.includes('https://dest.example/w'));
});

test('wpsafelink does nothing without a marker', async () => {
  const h = load({ href: 'https://short.site.example/abc', querySelector: () => null });
  assert.strictEqual(await h.api.handleWpSafeLink(), false);
});

// --- final-button ---

test('final-button clicks a visible action button', async () => {
  const h = load({
    href: 'https://short.site.example/abc',
    querySelectorAllOverride: [visibleBtn({ innerText: 'Get Link' })],
  });
  assert.strictEqual(await h.api.handleButtons(3000, 1), true);
});

test('final-button gives up after the deadline', async () => {
  const h = load({ href: 'https://short.site.example/abc', querySelectorAllOverride: [] });
  assert.strictEqual(await h.api.handleButtons(400, 6), false);
});

// --- captcha-manual ---

test('captcha-manual stays out when no captcha is present', async () => {
  const h = load({ href: 'https://short.site.example/abc' });
  assert.strictEqual(await h.api.handleManualCaptcha(), false);
});

test('captcha-manual clicks an already-unlocked button', async () => {
  const h = load({
    href: 'https://short.site.example/abc',
    querySelector: (sel) => (sel.includes('.get-link') ? visibleBtn() : null),
  });
  h.sandbox.grecaptcha = {};
  assert.strictEqual(await h.api.handleManualCaptcha(), true);
});
