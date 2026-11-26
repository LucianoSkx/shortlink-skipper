'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { load, SRC } = require('./helpers/harness');

const ROOT = path.join(__dirname, '..');

test('@version matches package.json and package-lock.json', () => {
  const userversion = SRC.match(/\/\/ @version\s+(\S+)/)[1];
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  assert.strictEqual(pkg.version, userversion, 'package.json version drifted');
  assert.strictEqual(lock.version, userversion, 'package-lock.json version drifted');
  assert.strictEqual(lock.packages[''].version, userversion, 'lockfile root package version drifted');
});

test('install URLs keep pointing at main', () => {
  const download = SRC.match(/\/\/ @downloadURL\s+(\S+)/)[1];
  const update = SRC.match(/\/\/ @updateURL\s+(\S+)/)[1];
  assert.match(download, /\/raw\/main\/shortlink-skipper\.user\.js$/);
  assert.strictEqual(download, update);
});

test('every generic rule has a unique name and callable hooks', () => {
  const { api } = load();
  const names = new Set();
  for (const rule of api.GENERIC_RULES) {
    assert.strictEqual(typeof rule.name, 'string');
    assert.ok(!names.has(rule.name), `duplicate rule name: ${rule.name}`);
    names.add(rule.name);
    assert.strictEqual(typeof rule.when, 'function', `${rule.name}.when`);
    assert.strictEqual(typeof rule.run, 'function', `${rule.name}.run`);
  }
});

test('no dedicated rule is shadowed by file-host', () => {
  const h = load();
  const rules = h.api.GENERIC_RULES;
  const fileHostAt = rules.findIndex((rule) => rule.name === 'file-host');
  assert.ok(fileHostAt >= 0);

  // Hosts handled by FILE_HOSTS that also own a dedicated rule must come
  // before file-host: it waits up to 20s for a download control before
  // yielding, so a later rule would only run after that dead wait.
  const fileHostRegex = h.api.FILE_HOSTS;
  const samples = [
    'cloudfam.io', 'upfilesgo.com', 'upfiles.app', 'katfile.com', 'rapidgator.net',
    'datanodes.to', 'frdl.io', 'frdl.is', 'multiup.io', 'uploady.io', 'modsfire.com',
    'ak.sv', 'safefileku.com', 'gofile.download', 'mirrored.to', 'usersdrive.com',
  ].filter((host) => fileHostRegex.test(host));

  // Gate-driven rules (bypass-city, captcha-manual, ...) fire on every gated
  // host, so they are not "dedicated" to any of the samples either.
  const controls = ['goo.st', '1ink.cc', 'bit.ly', 'srnky.com'];
  const firesOn = (rule, host) => {
    h.loc.host = host;
    h.loc.hostname = host;
    h.loc.pathname = '/abc';
    h.loc.search = '';
    try { return Boolean(rule.when()); } catch { return false; }
  };

  for (const rule of rules.slice(fileHostAt + 1)) {
    if (firesOn(rule, 'example.com')) continue;
    if (controls.some((host) => firesOn(rule, host))) continue;

    for (const host of samples) {
      assert.strictEqual(firesOn(rule, host), false, `${rule.name} runs after file-host for ${host}`);
    }
  }
});
