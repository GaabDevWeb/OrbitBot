/**
 * Cliente TRACE — fire-and-forget para POST /internal/traces/events no Kernel.
 * Falhas de trace nunca devem derrubar o chat.
 * (Não importar kernelProvider — evita dependência circular.)
 */

const crypto = require('crypto');
const axios = require('axios');
const http = require('http');
const https = require('https');
const logger = require('./logger');

const DEFAULT_BASE_URL = 'http://127.0.0.1:8001';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 20 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 20 });

const api = axios.create({
  httpAgent,
  httpsAgent,
  headers: { 'Content-Type': 'application/json' },
  timeout: 5000,
  validateStatus: () => true,
});

function resolveBaseUrl(fromEnv = process.env.KERNEL_API_URL) {
  const raw = String(fromEnv || DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, '');
}

function newTraceId() {
  return crypto.randomUUID();
}

function resolveInternalToken() {
  return String(process.env.ACL_INTERNAL_BEARER_TOKEN || '').trim();
}

/**
 * @param {{
 *   traceId: string,
 *   stage: string,
 *   data?: object,
 *   service?: string,
 *   baseUrl?: string,
 * }} opts
 */
function emitTraceEvent(opts) {
  const {
    traceId,
    stage,
    data = {},
    service = 'orbit',
    baseUrl = resolveBaseUrl(),
  } = opts || {};

  const tid = String(traceId || '').trim();
  const stg = String(stage || '').trim();
  if (!tid || !stg) return;

  const token = resolveInternalToken();
  if (!token) {
    return;
  }

  const url = `${String(baseUrl).replace(/\/+$/, '')}/internal/traces/events`;
  const headers = { Authorization: `Bearer ${token}` };
  const body = {
    events: [
      {
        trace_id: tid,
        timestamp: new Date().toISOString(),
        service,
        stage: stg,
        data: data && typeof data === 'object' ? data : {},
      },
    ],
  };

  void api.post(url, body, { headers }).catch((err) => {
    try {
      logger.info('trace emit failed', { stage: stg, error: err.message });
    } catch (_) {
      /* noop */
    }
  });
}

module.exports = {
  newTraceId,
  emitTraceEvent,
  resolveInternalToken,
};
