'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers/harness');


test('loads without error and registers the menu', async () => {
  const { loc, menuCalls, api } = load({ href: 'https://example.com/' });
  await api.main();
  assert.ok(menuCalls.length >= 1, 'menu commands devem ser registrados');
  assert.strictEqual(loc.navs.length, 0, 'a common page should not redirect');
});

test('does not interfere with the Cloudflare challenge', async () => {
  const { loc, logs, api } = load({
    href: 'https://short.site.example/abc',
    cf: true,
    title: 'Just a moment...',
    verbose: true,
  });
  await api.main();
  assert.strictEqual(loc.navs.length, 0, 'should not navigate during the CF challenge');
  assert.ok(
    logs.some((l) => /standing by/i.test(l)),
    'deve registrar que esta aguardando o desafio',
  );
});
