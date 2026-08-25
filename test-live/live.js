'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const CDP_URL    = process.env.CDP_URL || 'http://127.0.0.1:9222';
const SCRIPT_PATH = path.join(__dirname, '..', 'shortlink-skipper.user.js');

function getJSON(url) {
  return new Promise((res, rej) => {
    const req = http.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    });
    req.on('error', rej);
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
  });
}

const GM_MOCKS = `
'use strict';
if (typeof unsafeWindow === 'undefined') var unsafeWindow = globalThis;
if (typeof GM_getValue === 'undefined')  var GM_getValue  = (k, d) => d ?? false;
if (typeof GM_setValue === 'undefined')  var GM_setValue  = () => {};
if (typeof GM_registerMenuCommand === 'undefined') var GM_registerMenuCommand = () => {};
if (typeof GM_openInTab === 'undefined')  var GM_openInTab  = () => {};
if (typeof GM_setClipboard === 'undefined') var GM_setClipboard = () => {};
if (typeof GM_xmlhttpRequest === 'undefined') var GM_xmlhttpRequest = (o) => { try { o.onerror?.({}); } catch(_){} };
`;

async function main() {
  const targetUrl = process.argv[2];
  const expect    = process.argv[3] || 'example.com';
  const timeoutMs = parseInt(process.env.LIVE_TIMEOUT_MS || '25000', 10);
  const stage = (s) => { try { fs.appendFileSync('/tmp/live-stage.log', s + '\n'); } catch (_) {} };
  stage('start ' + targetUrl);

  const hardKill = setTimeout(() => { stage('HARD_TIMEOUT'); console.error('HARD_TIMEOUT'); process.exit(3); }, timeoutMs);

  const ver = await getJSON(CDP_URL + '/json/version');
  stage('cdp-version-ok');
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();
  const events = [];
  ws.on('message', (data) => {
    const m = JSON.parse(data.toString());
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  });
  await new Promise((r) => ws.on('open', r));
  stage('ws-open');

  const send = (method, params = {}, sid) =>
    new Promise((resolve) => {
      const id = ++msgId;
      pending.set(id, resolve);
      ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params }));
    });

  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (method, params = {}) => send(method, params, sessionId);

  await S('Page.enable');
  await S('Runtime.enable');

  const userscriptCode = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const wrappedScript  = GM_MOCKS + '\n' + userscriptCode;
  await S('Page.addScriptToEvaluateOnNewDocument', {
    source: wrappedScript,
  });
  stage('script-injected');

  await S('Page.navigate', { url: targetUrl });
  stage('navigating');

  let final = '';
  const logs = [];
  const pollCount = Math.ceil(timeoutMs / 500);
  for (let i = 0; i < pollCount; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const r = await S('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
      final = r.result && r.result.result ? r.result.result.value : final;
    } catch (_) {}
    if (final && final.includes(expect)) break;
  }

  for (const e of events) {
    if (e.method === 'Runtime.consoleAPICalled') {
      const txt = JSON.stringify(e.params.args || []);
      if (txt.includes('ShortlinkSkipper')) logs.push(txt);
    }
  }

  clearTimeout(hardKill);
  console.log('FINAL_URL=' + final);
  console.log('MATCH=' + (final.includes(expect) ? 'YES' : 'NO'));
  console.log('SKIPPER_LOGS=' + JSON.stringify(logs.slice(0, 8)));
  ws.close();
  process.exit(0);
}

main().catch((e) => { console.error('ERR', e && e.message); process.exit(2); });
