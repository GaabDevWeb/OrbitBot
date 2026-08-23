/**
 * KernelProvider — cliente HTTP do Orbit para POST /v1/chat.
 * Sem dependências novas (axios já no projecto).
 */

const axios = require('axios');
const http = require('http');
const https = require('https');
const { emitTraceEvent } = require('../traceClient');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const api = axios.create({
  httpAgent,
  httpsAgent,
  headers: { 'Content-Type': 'application/json' },
});

const DEFAULT_BASE_URL = 'http://127.0.0.1:8001';
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Resolve base URL do Kernel (sem trailing slash).
 * @param {string} [fromEnv]
 * @returns {string}
 */
function resolveKernelBaseUrl(fromEnv = process.env.KERNEL_API_URL) {
  const raw = String(fromEnv || DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, '');
}

/**
 * @param {{
 *   baseUrl?: string,
 *   token?: string|null,
 *   platform?: string,
 *   userId: string,
 *   channelId: string,
 *   message: string,
 *   resetContext?: boolean,
 *   timeoutMs?: number,
 *   traceId?: string|null,
 * }} options
 * @returns {Promise<string>} texto `answer` do Kernel
 */
async function chat(options) {
  const {
    baseUrl = resolveKernelBaseUrl(),
    token = process.env.KERNEL_API_TOKEN || process.env.ACL_API_BEARER_TOKEN || '',
    platform = 'whatsapp',
    userId,
    channelId,
    message,
    resetContext = false,
    timeoutMs = parseInt(process.env.KERNEL_API_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10),
    traceId = null,
  } = options;

  if (!userId || !channelId) {
    throw new Error('KernelProvider: userId e channelId são obrigatórios');
  }
  if (!message || !String(message).trim()) {
    throw new Error('KernelProvider: message não pode ser vazia');
  }

  const url = `${baseUrl}/v1/chat`;
  const body = {
    context: {
      platform,
      user_id: String(userId),
      channel_id: String(channelId),
    },
    message: String(message),
    stream: false,
    reset_context: Boolean(resetContext),
  };

  const headers = {};
  const bearer = String(token || '').trim();
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  const tid = String(traceId || '').trim();
  if (tid) {
    headers['X-Trace-Id'] = tid;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (tid) {
      emitTraceEvent({
        traceId: tid,
        stage: 'REQUEST_SENT_TO_KERNEL',
        baseUrl,
        data: {
          userId: String(userId),
          channelId: String(channelId),
          messageChars: String(message).length,
          resetContext: Boolean(resetContext),
        },
      });
    }

    const response = await api.post(url, body, {
      headers,
      timeout: timeoutMs,
      signal: controller.signal,
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      const detail =
        typeof response.data === 'object'
          ? response.data?.detail || JSON.stringify(response.data).slice(0, 300)
          : String(response.data || '').slice(0, 300);
      const err = new Error(`Kernel HTTP ${response.status}: ${detail || 'erro'}`);
      err.response = { status: response.status, data: response.data };
      err.code = 'KERNEL_HTTP_ERROR';
      if (tid) {
        emitTraceEvent({
          traceId: tid,
          stage: 'ERROR',
          baseUrl,
          data: { code: err.code, status: response.status, detail: String(detail).slice(0, 200) },
        });
      }
      throw err;
    }

    const answer = response.data?.answer;
    if (typeof answer !== 'string' || !answer.trim()) {
      const err = new Error('Kernel: resposta inválida (answer ausente)');
      err.code = 'KERNEL_VALIDATION';
      if (tid) {
        emitTraceEvent({
          traceId: tid,
          stage: 'ERROR',
          baseUrl,
          data: { code: err.code },
        });
      }
      throw err;
    }

    if (tid) {
      emitTraceEvent({
        traceId: tid,
        stage: 'RESPONSE_RECEIVED_FROM_KERNEL',
        baseUrl,
        data: {
          answerChars: answer.length,
          kernelTraceId: response.data?.metadata?.trace_id || null,
          status: response.status,
        },
      });
    }
    return answer;
  } catch (err) {
    if (
      err.name === 'CanceledError' ||
      err.code === 'ERR_CANCELED' ||
      err.name === 'AbortError'
    ) {
      const e = new Error(`Timeout Kernel após ${timeoutMs}ms`);
      e.code = 'ETIMEDOUT';
      if (tid) {
        emitTraceEvent({
          traceId: tid,
          stage: 'ERROR',
          baseUrl,
          data: { code: 'ETIMEDOUT', timeoutMs },
        });
      }
      throw e;
    }
    if (tid && err.code !== 'KERNEL_HTTP_ERROR' && err.code !== 'KERNEL_VALIDATION') {
      emitTraceEvent({
        traceId: tid,
        stage: 'ERROR',
        baseUrl,
        data: { code: err.code || 'KERNEL_ERROR', message: String(err.message || '').slice(0, 200) },
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  chat,
  resolveKernelBaseUrl,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
};
