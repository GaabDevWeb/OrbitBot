/**
 * HTTP interno do Orbit para envios proactivos (Kernel Communications).
 * Bind default: 127.0.0.1:8010 — nunca expor publicamente sem gateway.
 */

const http = require('http');
const { sendOutbound } = require('./send');
const { status } = require('./session');
const logger = require('../logger');

const MAX_BODY = 12 * 1024 * 1024; // 12 MiB

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Body too large'), { code: 'BODY_TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function authOk(req) {
  const expected = (process.env.ACL_INTERNAL_BEARER_TOKEN || '').trim();
  if (!expected) return false;
  const header = String(req.headers.authorization || '');
  const m = /^Bearer\s+(.+)$/i.exec(header);
  const provided = (m ? m[1] : '').trim();
  if (!provided || provided.length !== expected.length) return false;
  // timing-safe-ish
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function startInternalHttpServer() {
  const host = (process.env.ORBIT_INTERNAL_HOST || '127.0.0.1').trim();
  const port = Number(process.env.ORBIT_INTERNAL_PORT || '8010');

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${host}:${port}`);

      if (req.method === 'GET' && url.pathname === '/internal/health') {
        return json(res, 200, { ok: true, whatsapp: status() });
      }

      if (!authOk(req)) {
        return json(res, 401, { ok: false, error: 'unauthorized' });
      }

      if (req.method === 'GET' && url.pathname === '/internal/outbound/status') {
        return json(res, 200, { ok: true, ...status() });
      }

      if (req.method === 'POST' && url.pathname === '/internal/outbound/send') {
        const raw = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(raw.toString('utf8') || '{}');
        } catch {
          return json(res, 400, { ok: false, error: 'invalid_json' });
        }
        try {
          const result = await sendOutbound(payload);
          return json(res, 200, result);
        } catch (err) {
          const code = err.code || 'SEND_FAILED';
          const statusCode =
            code === 'SOCKET_NOT_READY' ? 503 : code === 'INVALID_JID' ? 400 : 502;
          logger.error('outbound send failed', { code, error: err.message });
          return json(res, statusCode, { ok: false, error: code, detail: err.message });
        }
      }

      return json(res, 404, { ok: false, error: 'not_found' });
    } catch (err) {
      logger.error('internal http error', { error: err.message });
      return json(res, err.code === 'BODY_TOO_LARGE' ? 413 : 500, {
        ok: false,
        error: err.code || 'internal_error',
      });
    }
  });

  server.listen(port, host, () => {
    logger.info('Orbit internal HTTP listening', { host, port });
  });

  server.on('error', (err) => {
    logger.error('Orbit internal HTTP failed', { error: err.message });
  });

  return server;
}

module.exports = { startInternalHttpServer };
