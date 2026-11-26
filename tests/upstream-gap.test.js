'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { cleanHostToken, collectOurRoots, root } = require('../test-live/upstream-gap');

test('cleanHostToken expands capturing and non-capturing groups', () => {
  const hosts = cleanHostToken('(^|\\.)(foo\\.com|bar\\.(?:net|org)|baz\\.io)');
  for (const host of ['foo.com', 'bar.net', 'bar.org', 'baz.io']) {
    assert.ok(hosts.includes(host), `${host} missing: ${hosts.join(',')}`);
  }
});

test('collectOurRoots keeps a whole gate alternation with a (?:...) inside', () => {
  // Regression: splitting the token at "?" dropped the closing paren and the
  // coverage report then flagged hosts that were already covered.
  const src = 'const GATE = /(^|\\.)(foo\\.com|lockr\\.(?:so|net|to)|baz\\.io)$/;';
  const roots = [...collectOurRoots(src)].sort();
  assert.deepStrictEqual(roots, ['baz.io', 'foo.com', 'lockr.net', 'lockr.so', 'lockr.to']);
});

test('root keeps the last two labels', () => {
  assert.strictEqual(root('download.yasir252.com'), 'yasir252.com');
  assert.strictEqual(root('nmac.to'), 'nmac.to');
});
