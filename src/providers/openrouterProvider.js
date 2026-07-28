const axios = require('axios');
const http = require('http');
const https = require('https');
let CacheableLookup = null;
try {
  // dependência opcional
  CacheableLookup = require('cacheable-lookup');
} catch (_) { /* opcional */ }

// Reutiliza conexões (Keep-Alive) para reduzir latência de handshake
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

// Instala DNS cache se disponível
if (CacheableLookup) {
  try {
    const cacheable = new CacheableLookup();
    cacheable.install(httpAgent);
    cacheable.install(httpsAgent);
  } catch (_) { /* ignora falha */ }
}

const api = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Provider responsável por chamar a API do OpenRouter
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {{
 *   apiKey: string,
 *   model: string,
 *   temperature: number,
 *   maxTokens: number,
 *   timeoutMs?: number,
 *   referer?: string,
 *   title?: string,
 * }} options
 * @returns {Promise<string>} Conteúdo da resposta do assistente
 */
async function generate(messages, options) {
  const {
    apiKey,
    model,
    temperature,
    maxTokens,
    timeoutMs = 15000,
    referer = 'https://github.com/GaabDevWeb/OrbitBot',
    title = 'OrbitBot',
  } = options;

  if (!apiKey) throw new Error('OPENROUTER_API_KEY ausente');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await api.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': referer,
          'X-Title': title,
        },
        timeout: timeoutMs,
        signal: controller.signal,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      const errDetail = response.data?.error?.message || 'Resposta da API inválida';
      throw new Error(errDetail);
    }
    return content;
  } catch (err) {
    if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || err.name === 'AbortError') {
      const e = new Error(`Timeout OpenRouter após ${timeoutMs}ms (modelo ${model})`);
      e.code = 'ETIMEDOUT';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generate };
