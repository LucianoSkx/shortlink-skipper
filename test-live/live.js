'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const CDP_URL     = process.env.CDP_URL || 'http://127.0.0.1:9222';
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

const GM_MOCKS = (testHost) => `
'use strict';
if (typeof unsafeWindow === 'undefined') var unsafeWindow = globalThis;
if (typeof GM_getValue === 'undefined')  var GM_getValue  = (k, d) => { if (k === 'verbose') return true; return d ?? false; };
if (typeof GM_setValue === 'undefined')  var GM_setValue  = () => {};
if (typeof GM_registerMenuCommand === 'undefined') var GM_registerMenuCommand = () => {};
if (typeof GM_openInTab === 'undefined')  var GM_openInTab  = () => {};
if (typeof GM_setClipboard === 'undefined') var GM_setClipboard = () => {};
if (typeof GM_xmlhttpRequest === 'undefined') var GM_xmlhttpRequest = (o) => { try { o.onerror?.({}); } catch(_){} };
${testHost ? `
// Test host override for host-gated rules (about:blank has empty host).
// Shadow the global 'location' with a local var inside this IIFE so the
// injected userscript reads the fake host without depending on
// window.location being redefinable (it is non-configurable in some CDP
// contexts, which made Object.defineProperty flaky).
var __sl_host = ${JSON.stringify(testHost)};
var __sl_href = 'https://' + __sl_host + '/test/';
try { Object.defineProperty(window, '__SL_FINAL_HREF', { configurable: true, writable: true, value: __sl_href }); } catch (_) {}
var location = {
  get href() { return __sl_href; },
  set href(v) { __sl_href = String(v); try { window.__SL_FINAL_HREF = __sl_href; } catch (_) {} },
  host: __sl_host,
  hostname: __sl_host,
  pathname: '/test/',
  search: '',
  hash: '',
  origin: 'https://' + __sl_host,
  toString() { return __sl_href; },
};
console.log('SKIPPER_HOST: ' + __sl_host);
` : ''}
`;

async function main() {
  const html      = process.argv[2];  // raw HTML string
  const expect    = process.argv[3] || 'example.com';
  const testHost  = process.argv[4] || '';  // optional fake host for host-gated rules
  const timeoutMs = parseInt(process.env.LIVE_TIMEOUT_MS || '25000', 10);
  const hardKill  = setTimeout(() => { console.error('HARD_TIMEOUT'); process.exit(3); }, timeoutMs);

  const ver = await getJSON(CDP_URL + '/json/version');
  const ws  = new WebSocket(ver.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();
  const events  = [];
  ws.on('message', (data) => {
    const m = JSON.parse(data.toString());
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  });
  await new Promise((r) => ws.on('open', r));

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

  // Get main frame ID
  const frameTree = await S('Page.getFrameTree');
  const frameId = frameTree.result.frameTree.frame.id;

  // Set document content directly (avoids data: URL sandbox issues)
  await S('Page.setDocumentContent', { frameId, html });
  await new Promise(r => setTimeout(r, 100));

  // Inject GM mocks + userscript via Runtime.evaluate
  const userscriptCode = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const wrappedCode = `(function(){\ntry{\n${GM_MOCKS(testHost)}\n${userscriptCode}\n}catch(e){console.log('INJECT_ERR:'+e.message);}\n})();`;
  await S('Runtime.evaluate', { expression: wrappedCode, returnByValue: true });

  // Poll final URL
  let final = '';
  const pollCount = Math.ceil(timeoutMs / 500);
  for (let i = 0; i < pollCount; i++) {
    await new Promise((r) => setTimeout(r, 500));
    // Check for navigation in collected events
    for (const e of events) {
      if (e.method === 'Page.frameNavigated' && e.params.frame?.url) {
        final = e.params.frame.url;
      }
    }
    if (!final) {
      try {
        const r = await S('Runtime.evaluate', { expression: 'window.__SL_FINAL_HREF || location.href', returnByValue: true });
        final = r.result && r.result.result ? r.result.result.value : '';
      } catch (_) {}
    }
    if (final && final.includes(expect)) break;
  }

  const logs = [];
  for (const e of events) {
    if (e.method === 'Runtime.consoleAPICalled') {
      const txt = JSON.stringify(e.params.args || []);
      if (txt.includes('ShortlinkSkipper') || txt.includes('SKIPPER')) logs.push(txt);
    }
  }

  clearTimeout(hardKill);
  console.log('FINAL_URL=' + final);
  console.log('MATCH=' + (final.includes(expect) ? 'YES' : 'NO'));
  console.log('SKIPPER_LOGS=' + JSON.stringify(logs.map(l => l.slice(0, 300)).slice(0, 15)));
  try { await send('Target.closeTarget', { targetId }); } catch (_) {}
  ws.close();
  process.exit(0);
}

main().catch((e) => { console.error('ERR', e && e.message); process.exit(2); });
