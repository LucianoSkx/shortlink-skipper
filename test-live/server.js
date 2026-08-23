'use strict';

const http = require('http');
const { URL } = require('url');

const PORT = 80;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const host = req.headers.host ? req.headers.host.split(':')[0] : '';
  console.log(`[mock] ${req.method} ${host}${u.pathname} query=${u.search}`);

  if (host === 'skiplink.io') {
    if (req.method === 'POST' && u.pathname === '/links/go') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        console.log(`[mock] /links/go body=${raw}`);
        send(res, 200, { url: 'https://example.com/dest-adlinkfly' });
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><html><head><title>skiplink mock</title></head>
<body><form id="adform" action="/links/go" method="post">
<input type="hidden" name="csrf" value="abc">
<input name="ad_form_data" value="tgO6U9JkQ4sT">
</form></body></html>`);
    return;
  }

  if (host === 'linkvertise.com') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><html><head><title>linkvertise mock</title></head>
<body><p>carregando...</p></body></html>`);
    return;
  }

  send(res, 404, { error: 'unknown host ' + host });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock] ouvindo em 127.0.0.1:${PORT}`);
});
