require('dotenv').config();
const logger = require('./logger');
const { aiConfigManager, resolveOpenRouterModels } = require('./aiConfig');
const openrouterProvider = require('./providers/openrouterProvider');
const cache = require('./core/cache');
const retry = require('./core/retry');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MAX_RETRIES = parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10);
const INITIAL_TIMEOUT = parseInt(process.env.OPENAI_INITIAL_TIMEOUT || '8000', 10);
const MAX_TIMEOUT = parseInt(process.env.OPENAI_MAX_TIMEOUT || '30000', 10);

function generateCacheKey(historico, userMessage, config, userId, models = []) {
  const histLen = Array.isArray(historico)
    ? historico.length
    : Array.isArray(historico?.messages)
      ? historico.messages.length
      : 0;
  const uid = userId == null ? 'anon' : String(userId);
  const modelsKey =
    Array.isArray(models) && models.length ? models.join(',') : config.model?.name || '';
  const promptSig = String(config.systemPrompt || '').slice(0, 64);
  return `${uid}|${userMessage}|${histLen}|${promptSig}|${modelsKey}`;
}

function limparMensagem(mensagem) {
  if (typeof mensagem === 'string') return mensagem;
  if (mensagem && typeof mensagem === 'object' && mensagem.type === 'Buffer') {
    return Buffer.from(mensagem.data).toString('utf-8');
  }
  return '';
}

function summarizeHistory(items) {
  try {
    const parts = items
      .map((it) => `${it.role === 'user' ? 'U' : 'A'}: ${limparMensagem(it.mensagem)}`)
      .filter(Boolean);
    let joined = parts.join('\n').replace(/\s+/g, ' ').trim();
    if (joined.length > 800) joined = joined.slice(-800);
    return `Contexto resumido (anteriores): ${joined}`;
  } catch (_) {
    return null;
  }
}

function buildMessages(historico, userMessage, config) {
  const maxHistory = config.maxHistory;
  const fullMessages = historico?.messages || [];
  const limitedHistory = fullMessages.slice(-maxHistory);
  const olderHistory = fullMessages.slice(0, Math.max(0, fullMessages.length - maxHistory));
  const summaryBlock = olderHistory.length ? summarizeHistory(olderHistory) : null;

  return [
    { role: 'system', content: config.systemPrompt },
    ...(summaryBlock ? [{ role: 'system', content: summaryBlock }] : []),
    ...limitedHistory
      .map((item) => ({
        role: item.role,
        content: limparMensagem(item.mensagem),
      }))
      .filter((item) => item.content),
    { role: 'user', content: userMessage },
  ];
}

function shouldFallbackToNextModel(error) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return false;
  return true;
}

function shouldRetrySameModel(error) {
  // Timeout → falhar este modelo e ir ao fallback (não esperar 8s+16s no mesmo)
  if (error?.code === 'ETIMEDOUT') return false;
  if (error?.message && /timeout/i.test(error.message)) return false;

  const status = error?.response?.status;
  const code = error?.code;
  if (status && status >= 500) return true;
  if (status === 429) return true;
  if (code === 'ECONNRESET' || code === 'ECONNABORTED') return true;
  return false;
}

async function generateWithModelFallback(messages, config) {
  const models = resolveOpenRouterModels();
  const temperature = config.temperature;
  const maxTokens = config.maxTokens;
  // 1 tentativa por modelo; em timeout/falha vai logo ao próximo da lista
  const retriesPerModel = 1;
  let lastError;

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    const isLast = i === models.length - 1;

    try {
      const content = await retry.execute(
        async (attempt) => {
          const attemptTimeout = Math.min(
            INITIAL_TIMEOUT * Math.pow(2, attempt),
            MAX_TIMEOUT
          );

          logger.api(`Tentativa ${attempt + 1} de ${retriesPerModel}`, {
            persona: config.personaName,
            model: modelName,
            modelIndex: i + 1,
            modelsTotal: models.length,
            timeoutMs: attemptTimeout,
          });

          const out = await openrouterProvider.generate(messages, {
            apiKey: OPENROUTER_API_KEY,
            model: modelName,
            temperature,
            maxTokens,
            timeoutMs: attemptTimeout,
            referer: 'https://github.com/GaabDevWeb/OrbitBot',
            title: 'OrbitBot',
          });

          logger.api('Resposta OpenRouter OK', {
            model: modelName,
            chars: String(out).length,
          });
          return out;
        },
        {
          retries: retriesPerModel,
          baseDelayMs: 500,
          factor: 2,
          shouldRetry: shouldRetrySameModel,
          onError: (error, attempt) => {
            logger.error(`Erro na tentativa ${attempt + 1} (modelo ${modelName})`, {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data,
              code: error.code,
            });
          },
        }
      );

      if (i > 0) {
        logger.info('Resposta obtida via modelo fallback', { model: modelName, index: i });
      }
      return content;
    } catch (error) {
      lastError = error;
      if (!isLast && shouldFallbackToNextModel(error)) {
        logger.error('Modelo falhou; a tentar fallback', {
          failedModel: modelName,
          nextModel: models[i + 1],
          status: error.response?.status,
          message: error.message,
        });
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Todos os modelos OpenRouter falharam');
}

async function handleMessage(historico, userMessage, userId = null) {
  const config = aiConfigManager.generateConfig(userId);

  if (!OPENROUTER_API_KEY) {
    logger.error('OPENROUTER_API_KEY não definida no ambiente (.env)');
    throw new Error('Configuração inválida: defina OPENROUTER_API_KEY no .env');
  }

  const validation = aiConfigManager.validateConfig(config);
  if (!validation.isValid) {
    logger.error('Configuração inválida', { errors: validation.errors });
    throw new Error('Configuração inválida');
  }

  const models = resolveOpenRouterModels();
  const cacheKey = generateCacheKey(historico, userMessage, config, userId, models);
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.api('Resposta encontrada no cache');
    return cached;
  }

  const messages = buildMessages(historico, userMessage, config);
  const responseContent = await generateWithModelFallback(messages, config);
  cache.set(cacheKey, responseContent);
  return responseContent;
}

function getSystemStats() {
  return {
    ai: aiConfigManager.getStats(),
    cache: cache.stats(),
  };
}

function clearCache() {
  return cache.clear();
}

module.exports = {
  handleMessage,
  getSystemStats,
  clearCache,
  generateCacheKey,
  generateWithModelFallback,
};
