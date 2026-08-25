#!/usr/bin/env node
'use strict';

const { execFile, fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const CASES_FILE  = path.join(__dirname, 'cases.json');
const LIVE_JS     = path.join(__dirname, 'live.js');
const SERVER_JS   = path.join(__dirname, 'test-server.js');
const TIMEOUT_S   = parseInt(process.env.LIVE_TIMEOUT || '25', 10);
const PORT        = parseInt(process.env.TEST_PORT || '18999', 10);

const cases = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));

function startServer() {
  return new Promise((resolve, reject) => {
    const child = fork(SERVER_JS, { env: { ...process.env, TEST_PORT: String(PORT) }, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    let started = false;
    child.stdout.on('data', (d) => {
      const msg = d.toString();
      if (!started && msg.includes('listening')) { started = true; resolve(child); }
    });
    child.stderr.on('data', (d) => console.error('[server]', d.toString().trim()));
    child.on('error', reject);
    child.on('exit', (code) => { if (!started) reject(new Error(`server exited ${code}`)); });
    setTimeout(() => { if (!started) { child.kill(); reject(new Error('server timeout')); } }, 5000);
  });
}

function runCase(c) {
  const targetUrl = `http://127.0.0.1:${PORT}${c.path}`;
  return new Promise((resolve) => {
    const start = Date.now();
    execFile(process.execPath, [LIVE_JS, targetUrl, c.expect], {
      timeout: (TIMEOUT_S + 5) * 1000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, CDP_URL: process.env.CDP_URL || 'http://127.0.0.1:9222' },
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
        path:    c.path,
        expect:  c.expect,
        finalUrl,
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

  // Check CDP is reachable
  const http = require('http');
  const cdpUp = await new Promise((resolve) => {
    http.get(process.env.CDP_URL || 'http://127.0.0.1:9222/json/version', (r) => {
      let d = ''; r.on('data', (c) => d += c); r.on('end', () => resolve(true));
    }).on('error', () => resolve(false));
  });
  if (!cdpUp) { console.error('CDP not reachable at', process.env.CDP_URL || 'http://127.0.0.1:9222'); process.exit(1); }

  // Start test server
  console.log('Starting test server...');
  const server = await startServer();
  console.log(`Test server on http://127.0.0.1:${PORT}\n`);

  console.log(`Running ${queue.length} local test(s)...\n`);
  const results = [];

  for (const c of queue) {
    process.stdout.write(`  ${c.family.padEnd(22)} ${c.id.padEnd(14)} `);
    const r = await runCase(c);
    results.push(r);
    const icon = r.ok ? '✅' : (r.hardTimeout ? '⏰' : '❌');
    console.log(`${icon}  ${r.elapsed}s  →  ${r.finalUrl || '(no redirect)'}`);
  }

  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;

  console.log(`\n${pass}/${results.length} passed`);
  if (fail) {
    console.log('\nFailed:');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  ${r.id} (${r.family}): expected=${r.expect} got=${r.finalUrl || '(none)'}`);
    });
  }

  server.kill();
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
