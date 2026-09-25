'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers/harness');

function armHooks(h) {
  h.sandbox.open = function originalOpen() {};
  const orig = {
    open: h.sandbox.open,
    setTimeout: h.sandbox.setTimeout,
    setInterval: h.sandbox.setInterval,
    fetch: h.sandbox.fetch,
    xhrOpen: h.sandbox.XMLHttpRequest.prototype.open,
    xhrSend: h.sandbox.XMLHttpRequest.prototype.send,
  };
  h.api.prepareBoost();
  h.api.enableBoost();
  h.api.blockPopups();
  h.api.restoreFocus();
  h.api.installNetworkDestCapture();
  return orig;
}

test('interstitial tardio: stand-by completo desinstala todos os hooks', () => {
  const h = load({ href: 'https://example.com/' });
  const orig = armHooks(h);

  assert.notStrictEqual(h.sandbox.setTimeout, orig.setTimeout, 'boost deve instalar o wrapper');
  assert.notStrictEqual(h.sandbox.fetch, orig.fetch, 'net capture deve instalar o wrapper');
  assert.notStrictEqual(h.sandbox.open, orig.open, 'blockPopups deve instalar o wrapper');
  assert.strictEqual(h.doc.hidden, false, 'focus lock aplicado');

  h.doc.getElementById = (id) => (id === 'cf-challenge-running' ? { id } : null);
  const stop = h.api.syncChallengeState();

  assert.strictEqual(stop, true, 'interstitial deve parar o script');
  assert.strictEqual(h.api.standbyState().standby, true);
  assert.strictEqual(h.api.standbyState().quiet, true);
  assert.strictEqual(h.sandbox.setTimeout, orig.setTimeout, 'boost deve ser removido');
  assert.strictEqual(h.sandbox.setInterval, orig.setInterval, 'boost de interval deve ser removido');
  assert.strictEqual(h.sandbox.fetch, orig.fetch, 'net capture deve ser removido');
  assert.strictEqual(h.sandbox.XMLHttpRequest.prototype.open, orig.xhrOpen);
  assert.strictEqual(h.sandbox.XMLHttpRequest.prototype.send, orig.xhrSend);
  assert.strictEqual(h.sandbox.open, orig.open, 'window.open deve ser restaurado');
  assert.strictEqual(
    Object.getOwnPropertyDescriptor(h.doc, 'hidden'),
    undefined,
    'focus lock em hidden deve ser removido',
  );
  assert.strictEqual(
    Object.getOwnPropertyDescriptor(h.doc, 'hasFocus'),
    undefined,
    'hasFocus deve ser restaurado',
  );
});

test('interstitial tardio: goto() recusa navegação', () => {
  const h = load({ href: 'https://example.com/' });
  h.doc.getElementById = (id) => (id === 'cf-challenge-running' ? { id } : null);
  h.api.syncChallengeState();

  assert.strictEqual(h.api.goto('https://destination.example/x'), false);
  assert.strictEqual(h.loc.navs.length, 0, 'não deve navegar durante o desafio');
  assert.strictEqual(h.api.trace.refusals.at(-1).reason, 'cloudflare challenge stand-by');
});

test('turnstile tardio: silencia os hooks mas mantém as regras ativas', () => {
  const h = load({ href: 'https://example.com/' });
  const orig = armHooks(h);

  h.doc.querySelector = (sel) => (sel.includes('.cf-turnstile') ? { className: 'cf-turnstile' } : null);
  const stop = h.api.syncChallengeState();

  assert.strictEqual(stop, false, 'widget não deve parar as regras');
  assert.strictEqual(h.api.standbyState().standby, false);
  assert.strictEqual(h.api.standbyState().quiet, true);
  assert.strictEqual(h.sandbox.setTimeout, orig.setTimeout, 'boost deve ser removido sob o widget');
  assert.strictEqual(h.sandbox.setInterval, orig.setInterval);
  assert.strictEqual(h.sandbox.fetch, orig.fetch, 'net capture deve ser removido sob o widget');
  assert.strictEqual(h.sandbox.open, orig.open, 'window.open deve ser restaurado sob o widget');
  assert.strictEqual(
    Object.getOwnPropertyDescriptor(h.doc, 'hidden'),
    undefined,
    'focus lock deve ser removido sob o widget',
  );
  assert.strictEqual(
    h.api.goto('https://destination.example/x'),
    true,
    'regras ainda podem navegar sob o widget (captcha-manual etc.)',
  );
  assert.strictEqual(h.loc.navs.length, 1);
});

test('hooks já em stand-by não são reinstalados', () => {
  const h = load({ href: 'https://example.com/' });
  const origFetch = h.sandbox.fetch;
  h.doc.getElementById = (id) => (id === 'cf-challenge-running' ? { id } : null);
  h.api.syncChallengeState();

  const before = h.sandbox.setTimeout;
  h.api.prepareBoost();
  h.api.blockPopups();
  h.api.restoreFocus();
  h.api.installNetworkDestCapture();

  assert.strictEqual(h.sandbox.setTimeout, before, 'prepareBoost deve ser no-op em stand-by');
  assert.strictEqual(h.sandbox.open, undefined, 'blockPopups deve ser no-op em stand-by');
  assert.strictEqual(
    Object.getOwnPropertyDescriptor(h.doc, 'hidden'),
    undefined,
    'restoreFocus deve ser no-op em stand-by',
  );
  assert.strictEqual(h.sandbox.fetch, origFetch, 'net capture deve ser no-op em stand-by');
});

test('watchForChallenge é idempotente e não observa páginas comuns', async () => {
  const normal = load({ href: 'https://example.com/' });
  let observers = 0;
  const OrigMO = normal.sandbox.MutationObserver;
  normal.sandbox.MutationObserver = function (...args) {
    observers += 1;
    return new OrigMO(...args);
  };
  await normal.api.main();
  assert.strictEqual(observers, 0, 'página comum não pode criar MutationObserver');

  const shortish = load({
    href: 'https://example.com/go',
    querySelector: (sel) => (sel.includes('go-link') ? { id: 'go-link' } : null),
  });
  let shortObservers = 0;
  const OrigMO2 = shortish.sandbox.MutationObserver;
  shortish.sandbox.MutationObserver = function (...args) {
    shortObservers += 1;
    return new OrigMO2(...args);
  };
  shortish.api.watchForChallenge();
  shortish.api.watchForChallenge();
  assert.strictEqual(shortObservers, 1, 'watchdog deve ser instalado uma única vez');
});
