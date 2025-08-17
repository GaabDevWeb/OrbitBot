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
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Resposta da API inválida');
  return content;
}

module.exports = { generate };
