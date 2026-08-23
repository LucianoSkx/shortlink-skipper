'use strict';

const http = require('http');
const WebSocket = globalThis.WebSocket;

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

async function main() {
  const targetUrl = process.argv[2];
  const expect = process.argv[3] || 'example.com';
  const stage = (s) => { try { require('fs').appendFileSync('/tmp/live-stage.log', s + '\n'); } catch (_) {} };
  stage('start ' + targetUrl);
  setTimeout(() => { stage('HARD_TIMEOUT'); console.error('HARD_TIMEOUT'); process.exit(3); }, 25000);
  const ver = await getJSON('http://127.0.0.1:9222/json/version');
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
  await S('Page.navigate', { url: targetUrl });

  let final = '';
  const logs = [];
  for (let i = 0; i < 40; i++) {
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

  console.log('FINAL_URL=' + final);
  console.log('MATCH=' + (final.includes(expect) ? 'YES' : 'NO'));
  console.log('SKIPPER_LOGS=' + JSON.stringify(logs.slice(0, 6)));
  ws.close();
  process.exit(0);
}

main().catch((e) => { console.error('ERR', e && e.message); process.exit(2); });
