const http = require('http');
const url = require('url');
const logger = require('./logger');

function startDashboardServer(port = 3000) {
  const clients = new Set();

  const server = http.createServer((req, res) => {
    const { pathname } = url.parse(req.url, true);

    if (pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write('\n');

      const client = { res };
      clients.add(client);

      req.on('close', () => {
        clients.delete(client);
      });

      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getHtml());
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  // Broadcasting helpers
  function sendEvent(event, data) {
    const payload = `event: ${event}\n` +
      `data: ${JSON.stringify(data)}\n\n`;
    for (const { res } of clients) {
      res.write(payload);
    }
  }

  // Wire logger events
  logger.on('log', (entry) => sendEvent('log', entry));
  logger.on('metrics', (entry) => sendEvent('metrics', entry));

  server.listen(port, () => {
    logger.info('Dashboard disponível', { url: `http://localhost:${port}` });
  });

  return server;
}

function getHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OrbitBot - Painel</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; background: #0b0b0b; color: #f3f3f3; }
  header { padding: 12px 16px; background: #141414; border-bottom: 1px solid #222; display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 16px; margin: 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; }
  .card { background: #121212; border: 1px solid #222; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
  .card h2 { margin: 0; padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #222; background: #151515; }
  .content { padding: 8px 12px; max-height: 40vh; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 10px; margin-right: 6px; }
  .b-info { background: #0c4a6e; }
  .b-error { background: #7f1d1d; }
  .b-debug { background: #3f3f46; }
  .b-api { background: #374151; }
  .b-queue { background: #1f2937; }
  .row { border-bottom: 1px dashed #222; padding: 6px 0; }
  .muted { color: #9ca3af; }
  .kv { display: inline-block; margin-left: 6px; color: #9ca3af; }
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 8px 12px; }
  .metric { background: #0f0f0f; border: 1px solid #222; border-radius: 6px; padding: 8px; }
  .metric .label { font-size: 11px; color: #9ca3af; }
  .metric .value { font-size: 18px; font-weight: 600; }
</style>
</head>
<body>
<header>
  <h1>OrbitBot • Painel em tempo real</h1>
  <span class="muted" id="uptime">Uptime: --</span>
</header>

<div class="grid">
  <section class="card" style="grid-column: 1 / -1">
    <h2>Métricas</h2>
    <div class="metrics" id="metrics">
      <div class="metric"><div class="label">Mensagens</div><div class="value" id="m-msg">0</div></div>
      <div class="metric"><div class="label">Erros</div><div class="value" id="m-err">0</div></div>
      <div class="metric"><div class="label">Resp. Média (ms)</div><div class="value" id="m-rt">0</div></div>
      <div class="metric"><div class="label">Clientes</div><div class="value" id="m-clients">0</div></div>
      <div class="metric"><div class="label">Histórico</div><div class="value" id="m-hist">0</div></div>
      <div class="metric"><div class="label">CPU (1min)</div><div class="value" id="m-cpu">0</div></div>
    </div>
  </section>

  <section class="card">
    <h2>API</h2>
    <div class="content" id="api"></div>
  </section>

  <section class="card">
    <h2>Fila</h2>
    <div class="content" id="queue"></div>
  </section>

  <section class="card">
    <h2>Geral</h2>
    <div class="content" id="general"></div>
  </section>

  <section class="card">
    <h2>Erros</h2>
    <div class="content" id="errors"></div>
  </section>
</div>

<script>
  const es = new EventSource('/events');
  const fmt = (ts) => new Date(ts).toLocaleTimeString();

  function addRow(container, entry, extraClass='') {
    const wrap = document.createElement('div');
    wrap.className = 'row ' + extraClass;
    const badge = document.createElement('span');
    const level = (entry.level||'').toLowerCase();
    badge.className = 'badge ' + (level === 'error' ? 'b-error' : level === 'debug' ? 'b-debug' : 'b-info');
    badge.textContent = (entry.category||'log').toUpperCase();

    const time = document.createElement('span');
    time.className = 'muted';
    time.textContent = ' ' + fmt(entry.ts) + ' ';

    const msg = document.createElement('span');
    msg.textContent = entry.message || '';

    const kv = document.createElement('span');
    kv.className = 'kv';
    kv.textContent = entry.data ? JSON.stringify(entry.data) : '';

    wrap.appendChild(badge);
    wrap.appendChild(time);
    wrap.appendChild(msg);
    wrap.appendChild(kv);

    container.prepend(wrap);
    while (container.children.length > 200) container.removeChild(container.lastChild);
  }

  es.addEventListener('log', (ev) => {
    const entry = JSON.parse(ev.data);
    const cat = entry.category;
    if (cat === 'api') addRow(document.getElementById('api'), entry);
    else if (cat === 'queue') addRow(document.getElementById('queue'), entry);
    else if (entry.level === 'error') addRow(document.getElementById('errors'), entry, 'err');
    else addRow(document.getElementById('general'), entry);
  });

  es.addEventListener('metrics', (ev) => {
    const m = JSON.parse(ev.data);
    document.getElementById('uptime').textContent = 'Uptime: ' + m.uptime + 's';
    document.getElementById('m-msg').textContent = m.messageCount;
    document.getElementById('m-err').textContent = m.errorCount;
    document.getElementById('m-rt').textContent = (m.avgResponseTime||0).toFixed ? (m.avgResponseTime).toFixed(0) : m.avgResponseTime;
    document.getElementById('m-clients').textContent = m.totalClientes || 0;
    document.getElementById('m-hist').textContent = m.totalMensagens || 0;
    document.getElementById('m-cpu').textContent = (m.cpu && m.cpu['1min'] != null) ? m.cpu['1min'] : 0;
  });
</script>
</body>
</html>`;
}

module.exports = { startDashboardServer };
