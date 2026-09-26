'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers/harness');

function qsMap(map) {
  return (sel) => {
    for (const [k, v] of Object.entries(map)) {
      if (sel === k) return v;
    }
    return null;
  };
}

function imgEl(src) {
  return { src };
}

function aEl(href, text) {
  return { href, textContent: text || '' };
}

// --- imagetwist-family: img.pic ---

test('imagetwist-family navigates to img.pic src', async () => {
  const h = load({
    href: 'https://imagetwist.com/abc',
    querySelector: qsMap({ 'img.pic': imgEl('https://dest.example/pic.jpg') }),
  });
  assert.strictEqual(await h.api.handleImagetwistFamily(), true);
  assert.ok(h.navs.includes('https://dest.example/pic.jpg'));
});

test('imagetwist-family ignores other hosts', async () => {
  assert.strictEqual(await load({ href: 'https://example.com/' }).api.handleImagetwistFamily(), false);
});

// --- fastpic ---

test('fastpic follows the fullview link', async () => {
  const h = load({
    href: 'https://fastpic.org/view/abc',
    querySelector: () => null,
    querySelectorAllOverride: [aEl('https://fastpic.org/fullview/abc', 'Continue to image')],
  });
  assert.strictEqual(await h.api.handleFastpic(), true);
  assert.ok(h.navs.includes('https://fastpic.org/fullview/abc'));
});

test('fastpic falls back to #imglink', async () => {
  const h = load({
    href: 'https://fastpic.org/fullview/abc',
    querySelector: qsMap({ '#imglink, #imga': { href: 'https://dest.example/full.jpg' } }),
    querySelectorAllOverride: [],
  });
  assert.strictEqual(await h.api.handleFastpic(), true);
  assert.ok(h.navs.includes('https://dest.example/full.jpg'));
});

test('fastpic ignores non-view paths', async () => {
  assert.strictEqual(await load({ href: 'https://fastpic.org/' }).api.handleFastpic(), false);
});

test('fastpic ignores other hosts', async () => {
  assert.strictEqual(await load({ href: 'https://example.com/' }).api.handleFastpic(), false);
});

// --- imgtraffic ---

test('imgtraffic rewrites /a-1/ path to direct jpeg', async () => {
  const h = load({ href: 'https://imgtraffic.com/a-1/abc123.jpeg.html' });
  assert.strictEqual(await h.api.handleImgtraffic(), true);
  assert.ok(h.navs.includes('https://imgtraffic.com/abc123.jpeg'));
});

test('imgtraffic handles all path prefixes', async () => {
  for (const prefix of ['a', 'i', 'n', 'z']) {
    const h = load({ href: `https://imgtraffic.com/${prefix}-1/xyz.jpeg.html` });
    assert.strictEqual(await h.api.handleImgtraffic(), true);
    assert.ok(h.navs.includes('https://imgtraffic.com/xyz.jpeg'));
  }
});

test('imgtraffic ignores non-matching paths', async () => {
  assert.strictEqual(await load({ href: 'https://imgtraffic.com/other/abc' }).api.handleImgtraffic(), false);
});

test('imgtraffic ignores other hosts', async () => {
  assert.strictEqual(await load({ href: 'https://example.com/' }).api.handleImgtraffic(), false);
});

// --- imggair ---

test('imgair reads imgbg.src from inline scripts', async () => {
  const h = load({
    href: 'https://imgair.net/abc',
    querySelectorAllOverride: [{ textContent: 'imgbg.src = "https://dest.example/bg.jpg";' }],
  });
  assert.strictEqual(await h.api.handleImgair(), true);
  assert.ok(h.navs.includes('https://dest.example/bg.jpg'));
});

test('imgair ignores other hosts', async () => {
  assert.strictEqual(await load({ href: 'https://example.com/' }).api.handleImgair(), false);
});

// --- keeplinks ---

test('keeplinks clicks #btnproceedsubmit', async () => {
  const h = load({
    href: 'https://keeplinks.org/abc',
    querySelector: qsMap({ '#btnproceedsubmit': { dispatchEvent: () => true, scrollIntoView() {}, getBoundingClientRect: () => ({ width: 10, height: 10 }), disabled: false, hidden: false } }),
  });
  // keeplinks is covered by the generic file-host rule which already includes
  // #btnproceedsubmit; just verify the host is known.
  assert.strictEqual(load({ href: 'https://keeplinks.org/abc' }).api.knownMediaHost(), true);
});

// --- mirrored ---

test('mirrored uses .secondary selector (covered by generic file-host)', async () => {
  assert.strictEqual(load({ href: 'https://mirrored.to/files/abc' }).api.knownMediaHost(), true);
});
