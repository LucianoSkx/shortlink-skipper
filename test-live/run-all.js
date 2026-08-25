#!/usr/bin/env node
'use strict';

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const CASES_FILE = path.join(__dirname, 'cases.json');
const LIVE_JS    = path.join(__dirname, 'live.js');
const TIMEOUT_S  = parseInt(process.env.LIVE_TIMEOUT || '25', 10);

const cases = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));

function runCase(c) {
  return new Promise((resolve) => {
    const start = Date.now();
    const hostArg = c.host || '';
    const caseTimeout = c.timeout || TIMEOUT_S;
    execFile(process.execPath, [LIVE_JS, c.html, c.expect, hostArg], {
      timeout: (caseTimeout + 10) * 1000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, LIVE_TIMEOUT_MS: String(caseTimeout * 1000), CDP_URL: process.env.CDP_URL || 'http://127.0.0.1:9222' },
    }, (err, stdout, stderr) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const lines = (stdout || '').split('\n').filter(Boolean);
      const finalLine = lines.find(l => l.startsWith('FINAL_URL=')) || '';
      const matchLine = lines.find(l => l.startsWith('MATCH='))    || '';
      const logLine   = lines.find(l => l.startsWith('SKIPPER_LOGS=')) || '';
      const finalUrl  = finalLine.replace('FINAL_URL=', '');
      const match     = matchLine.replace('MATCH=', '') === 'YES';
      const exitCode  = err && err.code != null ? err.code : 0;
      const hardTimeout = (stderr || '').includes('HARD_TIMEOUT') || exitCode === 3;

      resolve({
        id:      c.id,
        family:  c.family,
        expect:  c.expect,
        finalUrl,
        logs:    logLine,
        rawOut:  stdout || '',
        match,
        hardTimeout,
        exitCode,
        elapsed: parseFloat(elapsed),
        ok:      match && !hardTimeout,
      });
    });
  });
}

async function main() {
  const filter = process.argv[2];
  const queue  = filter ? cases.filter(c => c.family.includes(filter)) : cases;
  if (!queue.length) { console.log(`No cases matched: ${filter}`); process.exit(1); }

  const http = require('http');
  const cdpUp = await new Promise((resolve) => {
    http.get(process.env.CDP_URL || 'http://127.0.0.1:9222/json/version', (r) => {
      let d = ''; r.on('data', (c) => d += c); r.on('end', () => resolve(true));
    }).on('error', () => resolve(false));
  });
  if (!cdpUp) { console.error('CDP not reachable at', process.env.CDP_URL || 'http://127.0.0.1:9222'); process.exit(1); }

  console.log(`Running ${queue.length} live test(s)...\n`);
  const results = [];

  for (const c of queue) {
    process.stdout.write(`  ${c.family.padEnd(22)} ${c.id.padEnd(14)} `);
    const r = await runCase(c);
    results.push(r);
    const icon = r.ok ? '[PASS]' : (r.hardTimeout ? '[TIME]' : '[FAIL]');
    console.log(`${icon}  ${r.elapsed}s  ->  ${r.finalUrl || '(no redirect)'}`);
  }

  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;

  console.log(`\n${pass}/${results.length} passed`);
  results.forEach(r => {
    console.log(`  ${r.id} raw: ${(r.rawOut || '').split('\n').filter(Boolean).join(' | ')}`);
    console.log(`  ${r.id} logs: ${r.logs.slice(0, 600)}`);
  });
  if (fail) {
    console.log('\nFailed:');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  ${r.id} (${r.family}): expected=${r.expect} got=${r.finalUrl || '(none)'}`);
      console.log(`    raw: ${(r.rawOut || '').split('\n').filter(Boolean).join(' | ')}`);
    });
  }

  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
