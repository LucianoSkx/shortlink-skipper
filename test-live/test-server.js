'use strict';

const http = require('http');

const PORT = parseInt(process.env.TEST_PORT || '18999', 10);

function html(body, status = 200) {
  return {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body,
  };
}

// Each handler returns {status, headers, body}
const routes = {
  // --- FETCH redirect: page does fetch(url) then location = response ---
  '/fetch-redirect': () => html(`
    <script>
      fetch('/api/get-dest?url=/fetch-redirect').then(r => r.text()).then(dest => {
        window.location.href = dest;
      });
    </script>
    <p>Redirecting via fetch...</p>
  `),

  // --- FORM redirect: hidden form with auto-submit ---
  // Includes shortlink structural markers
  '/form-redirect': () => html(`
    <form id="go-link" method="POST" action="/form-handler">
      <input type="hidden" name="url" value="https://example.com/form-target">
    </form>
    <script>
      looksLikeShortlink = () => true;
      document.getElementById('go-link').submit();
    </script>
  `),

  // --- BUTTON click pattern: timer + button with standard skipper text ---
  // Includes shortlink structural markers so looksLikeShortlink() passes
  '/button-redirect': () => html(`
    <form id="go-link" style="display:none">
      <input type="hidden" name="destination" value="">
    </form>
    <div id="timer">Wait 2s...</div>
    <button id="btn" style="display:none" onclick="window.location.href='https://example.com/button-target'">Continue</button>
    <script>
      let t = 2;
      const el = document.getElementById('timer');
      const btn = document.getElementById('btn');
      const iv = setInterval(() => {
        t--;
        el.textContent = 'Wait ' + t + 's...';
        if (t <= 0) { clearInterval(iv); btn.style.display = 'inline'; el.textContent = ''; }
      }, 1000);
    </script>
  `),

  // --- META refresh ---
  '/meta-redirect': () => ({
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Refresh': '0;url=https://example.com/meta-target',
    },
    body: '<p>Moving...</p>',
  }),

  // --- JS location.replace ---
  '/js-redirect': () => html(`
    <script>window.location.replace('https://example.com/js-target');</script>
    <p>Redirecting...</p>
  `),

  // --- LootLabs-style: fetch + token decode + form POST ---
  '/lootlabs-style': () => html(`
    <script>
      fetch('/api/get-dest?url=/lootlabs-style').then(r => r.text()).then(encoded => {
        // simulate token decode
        const dest = atob(encoded);
        // show form like lootlabs
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/loot-handler';
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'destination';
        input.value = dest;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      });
    </script>
    <p>Processing...</p>
  `),

  // --- AdLinkFly-style: hidden input with destination ---
  '/adlinkfly-style': () => html(`
    <div class="shortened">
      <input type="hidden" id="rand" value="aGVsbG8gd29ybGQ=" />
      <a class="btn-main" href="#" onclick="go();return false;">Get Link</a>
    </div>
    <script>
      function go() {
        const val = document.getElementById('rand').value;
        window.location.href = atob(val);
      }
      // auto-redirect after 1s
      setTimeout(go, 1000);
    </script>
  `),

  // --- Single external link ---
  '/single-link': () => html(`
    <a href="https://example.com/single-link-target">Download</a>
  `),

  // --- No redirect (normal page) ---
  '/normal-page': () => html(`
    <h1>Normal Page</h1>
    <p>This page has no redirect. The skipper should not navigate.</p>
    <a href="https://example.com/some-article">Read article</a>
  `),

  // --- API endpoint: returns destination ---
  '/api/get-dest': (req, url) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const reqPath = params.get('url') || '/';
    const destMap = {
      '/fetch-redirect': 'https://example.com/fetch-target',
      '/lootlabs-style': btoa('https://example.com/loot-target'),
    };
    const dest = destMap[reqPath] || 'https://example.com/default';
    return { status: 200, headers: { 'Content-Type': 'text/plain' }, body: dest };
  },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const handler = routes[url.pathname];
  if (!handler) {
    res.writeHead(404);
    res.end('Not found: ' + url.pathname);
    return;
  }
  const { status, headers, body } = handler(req, req.url);
  res.writeHead(status, headers);
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`Test server listening on http://127.0.0.1:${PORT}`);
});

module.exports = { server, PORT };
