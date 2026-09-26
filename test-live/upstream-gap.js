#!/usr/bin/env node
'use strict';

// Compares adsbypasser's @domain coverage against our userscript host lists
// and prints a markdown gap report. Used by .github/workflows/upstream-sync.yaml
// and locally:
//
//   ADSBYPASSER_DIR=/path/to/adsbypasser node test-live/upstream-gap.js
//
// Without ADSBYPASSER_DIR it clones a shallow copy to a temp dir.

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = process.env.ADSBYPASSER_REPO || 'https://github.com/adsbypasser/adsbypasser.git';

function ensureCheckout() {
  const dir = process.env.ADSBYPASSER_DIR;
  if (dir && fs.existsSync(path.join(dir, 'src', 'sites'))) return dir;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-upstream-'));
  execSync(`git clone --depth 1 ${REPO} ${tmp}`, { stdio: 'inherit' });
  return tmp;
}

function expandGroups(s) {
  const m = s.match(/\(([^()]+)\)/);
  if (!m) return [s];
  const out = [];
  for (const alt of m[1].split('|')) {
    if (!/^[a-z0-9.\-]+$/i.test(alt)) continue;
    out.push(...expandGroups(s.slice(0, m.index) + alt + s.slice(m.index + m[0].length)));
  }
  return out.length ? out : [s];
}

function cleanHostToken(tok) {
  let s = tok
    .replace(/\(\^\|\\\.\)/g, '')
    .replace(/\(\^\|\\\.\)\?/g, '')
    .replace(/\^/g, '')
    .replace(/\$/g, '')
    .replace(/\\\./g, '.');
  const out = [];
  for (const expanded of expandGroups(s)) {
    const e = expanded.replace(/[^a-z0-9.\-]/gi, '').toLowerCase().replace(/^\.+|\.+$/g, '');
    if (/^[a-z0-9][a-z0-9.\-]*\.[a-z]{2,}$/.test(e) && !e.includes('..')) out.push(e);
  }
  return out;
}

function root(d) {
  const p = d.split('.');
  return p.length >= 2 ? p.slice(-2).join('.') : d;
}

const ADULT_HINT = /(hentai|jav|porn|xxx|fap|covid|pig69|av\.|cosplay|ecchi|eroge|javstore|javtenshi)/i;

function main() {
  const abDir = ensureCheckout();
  const sitesDir = path.join(abDir, 'src', 'sites');

  // Upstream: @domain -> {root: {category, files}}
  const upstream = new Map();
  for (const cat of fs.readdirSync(sitesDir)) {
    const catDir = path.join(sitesDir, cat);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const f of fs.readdirSync(catDir)) {
      if (!f.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(catDir, f), 'utf8');
      for (const m of src.matchAll(/@domain\s+(\S+)/g)) {
        const domain = m[1].replace(/^\*\./, '').toLowerCase();
        const r = root(domain);
        if (!upstream.has(r)) upstream.set(r, { category: cat, files: new Set(), domains: new Set() });
        const e = upstream.get(r);
        e.files.add(`${cat}/${f}`);
        e.domains.add(domain);
      }
    }
  }

  // Ours: every host-like token in the userscript, reduced to roots.
  const oursSrc = fs.readFileSync(path.join(__dirname, '..', 'shortlink-skipper.user.js'), 'utf8');
  const ours = new Set();
  const candidates = oursSrc.match(/[a-z0-9_\\.\-()|]*\\[\.][a-z0-9_\\.\-()|]*/gi) || [];
  for (const tok of candidates) {
    for (const h of cleanHostToken(tok)) ours.add(root(h));
  }

  const gap = [...upstream.entries()]
    .filter(([r]) => !ours.has(r))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const rev = [...ours].filter((r) => ![...upstream.keys()].includes(r)).length;

  console.log(`# Upstream gap report — ${new Date().toISOString().slice(0, 10)}`);
  console.log('');
  console.log(`adsbypasser covers **${upstream.size}** root domains, ours covers **${ours.size}** (${rev} not upstream).`);
  console.log(`**${gap.length}** upstream roots have no rule or gate entry here.`);
  console.log('');
  console.log('Ports land as native rules (bounded `waitFor`, navigation only via `goto()`).');
  console.log('Adult hosts are flagged — P3 stays out by maintainer decision.');
  console.log('');
  for (const cat of ['link', 'file', 'image']) {
    const items = gap.filter(([, v]) => v.category === cat);
    if (!items.length) continue;
    console.log(`## ${cat} (${items.length})`);
    console.log('');
    for (const [r, v] of items) {
      const adult = ADULT_HINT.test(r) || [...v.domains].some((d) => ADULT_HINT.test(d)) ? ' · adult?' : '';
      console.log(`- \`${r}\` (${[...v.files].join(', ')})${adult}`);
    }
    console.log('');
  }
}

main();
