/**
 * KernelProvider — cliente HTTP do Orbit para POST /v1/chat.
 * Sem dependências novas (axios já no projecto).
 */

const axios = require('axios');
const http = require('http');
const https = require('https');
const { emitTraceEvent } = require('../traceClient');
const retry = require('../core/retry');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const api = axios.create({
  httpAgent,
  httpsAgent,
  headers: { 'Content-Type': 'application/json' },
});

const DEFAULT_BASE_URL = 'http://127.0.0.1:8001';
const DEFAULT_TIMEOUT_MS = 60000;

function resolveKernelBaseUrl(fromEnv = process.env.KERNEL_API_URL) {
  const raw = String(fromEnv || DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, '');
}

function isRetryableKernelError(err) {
  const status = err?.response?.status;
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNREFUSED' || err?.code === 'ECONNRESET') {
    return true;
  }
  return false;
}

async function postChatOnce({
  url,
  body,
  headers,
  timeoutMs,
  signal,
  baseUrl,
  traceId,
}) {
  const response = await api.post(url, body, {
    headers,
    timeout: timeoutMs,
    signal,
    validateStatus: () => true,
  });

  if (response.status === 409) {
    const err = new Error('Kernel: mensagem já em processamento (idempotência)');
    err.code = 'KERNEL_IDEMPOTENCY_PROCESSING';
    err.response = { status: 409, data: response.data };
    throw err;
  }

  if (response.status === 429) {
    const err = new Error('Kernel: rate limit — tenta novamente em instantes');
    err.code = 'KERNEL_RATE_LIMITED';
    err.response = { status: 429, data: response.data };
    throw err;
  }

  if (response.status < 200 || response.status >= 300) {
    const detail =
      typeof response.data === 'object'
        ? response.data?.detail || JSON.stringify(response.data).slice(0, 300)
        : String(response.data || '').slice(0, 300);
    const err = new Error(`Kernel HTTP ${response.status}: ${detail || 'erro'}`);
    err.response = { status: response.status, data: response.data };
    err.code = 'KERNEL_HTTP_ERROR';
    if (traceId) {
      emitTraceEvent({
        traceId,
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
    if (traceId) {
      emitTraceEvent({
        traceId,
        stage: 'ERROR',
        baseUrl,
        data: { code: err.code },
      });
    }
    throw err;
  }

  return answer;
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
 *   messageId?: string|null,
 *   metadata?: object,
 * }} options
 * @returns {Promise<string>}
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
    messageId = null,
    metadata = null,
  } = options;

  if (!userId || !channelId) {
    throw new Error('KernelProvider: userId e channelId são obrigatórios');
  }

  const msgStr = String(message ?? '');
  const invocationType = metadata?.invocation?.type;
  const allowEmpty =
    invocationType === 'contextual_invocation' || invocationType === 'contextual';

  if (!allowEmpty && !msgStr.trim()) {
    throw new Error('KernelProvider: message não pode ser vazia');
  }

  const url = `${baseUrl}/v1/chat`;
  const body = {
    context: {
      platform,
      user_id: String(userId),
      channel_id: String(channelId),
    },
    message: msgStr,
    stream: false,
    reset_context: Boolean(resetContext),
  };
  if (metadata && typeof metadata === 'object') {
    body.metadata = metadata;
  }

  const headers = {};
  const bearer = String(token || '').trim();
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  const tid = String(traceId || '').trim();
  if (tid) {
    headers['X-Trace-Id'] = tid;
  }
  const mid = String(messageId || '').trim();
  if (mid) {
    headers['X-Message-Id'] = mid;
  }

  const maxRetries = parseInt(process.env.KERNEL_API_MAX_RETRIES || '2', 10);

  return retry.execute(
    async () => {
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
              messageChars: msgStr.length,
              resetContext: Boolean(resetContext),
              messageId: mid || undefined,
            },
          });
        }

        const answer = await postChatOnce({
          url,
          body,
          headers,
          timeoutMs,
          signal: controller.signal,
          baseUrl,
          traceId: tid || null,
        });

        if (tid) {
          emitTraceEvent({
            traceId: tid,
            stage: 'RESPONSE_RECEIVED_FROM_KERNEL',
            baseUrl,
            data: { answerChars: answer.length, status: 200 },
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
          throw e;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },
    {
      retries: Math.max(1, maxRetries + 1),
      baseDelayMs: 800,
      factor: 2,
      shouldRetry: (err) => isRetryableKernelError(err),
    }
  );
}

module.exports = {
  chat,
  resolveKernelBaseUrl,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  isRetryableKernelError,
};
