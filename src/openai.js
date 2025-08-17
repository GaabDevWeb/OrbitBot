require('dotenv').config();
const logger = require('./logger');
const { aiConfigManager } = require('./aiConfig');
const { pluginSystem } = require('./pluginSystem');
const openrouterProvider = require('./providers/openrouterProvider');
const cache = require('./core/cache');
const retry = require('./core/retry');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MAX_RETRIES = parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10);
const INITIAL_TIMEOUT = parseInt(process.env.OPENAI_INITIAL_TIMEOUT || '8000', 10);
const MAX_TIMEOUT = parseInt(process.env.OPENAI_MAX_TIMEOUT || '30000', 10);

function generateCacheKey(historico, userMessage, config) {
    const histLen = Array.isArray(historico) ? historico.length : (Array.isArray(historico?.messages) ? historico.messages.length : 0);
    return `${userMessage}-${histLen}-${config.personality.name}-${config.model.name}`;
}

function limparMensagem(mensagem) {
    if (typeof mensagem === 'string') return mensagem;
    if (mensagem && typeof mensagem === 'object' && mensagem.type === 'Buffer') {
        return Buffer.from(mensagem.data).toString('utf-8');
    }
    return '';
}

// Função principal para processar mensagens com sistema modular
async function handleMessage(historico, userMessage, userId = null) {
    // Gera configuração baseada no usuário
    const config = aiConfigManager.generateConfig(userId);
    
    if (!OPENROUTER_API_KEY) {
        logger.error('OPENROUTER_API_KEY não definida no ambiente (.env)');
        throw new Error('Configuração inválida: defina OPENROUTER_API_KEY no .env');
    }
    
    // Valida configuração
    const validation = aiConfigManager.validateConfig(config);
    if (!validation.isValid) {
        logger.error('Configuração inválida', { errors: validation.errors });
        throw new Error('Configuração inválida');
    }

    // Executa hooks antes do processamento
    const preProcessData = await pluginSystem.executeHook('beforeMessage', {
        message: userMessage,
        historico,
        config,
        userId
    });

    // Verifica se há resposta automática
    if (preProcessData.autoResponse) {
        logger.info('Resposta automática detectada', { response: preProcessData.autoResponse });
        return preProcessData.autoResponse;
    }

    // Gera chave de cache com configuração
    const cacheKey = generateCacheKey(historico, userMessage, config);
    const cached = cache.get(cacheKey);
    if (cached) {
        logger.api('Resposta encontrada no cache');
        return cached;
    }

    const responseContent = await retry.execute(async (attempt) => {
            // Modelo fixo vindo da configuração (sem override por env)
            const modelName = config.model.name;
            const temperature = process.env.OPENROUTER_TEMPERATURE ? parseFloat(process.env.OPENROUTER_TEMPERATURE) : config.model.temperature;
            const maxTokens = process.env.OPENROUTER_MAX_TOKENS ? parseInt(process.env.OPENROUTER_MAX_TOKENS, 10) : config.model.maxTokens;

            const attemptTimeout = Math.min(INITIAL_TIMEOUT * Math.pow(2, attempt), MAX_TIMEOUT);

            logger.api(`Tentativa ${attempt + 1} de ${MAX_RETRIES}`, {
                personality: config.personality.name,
                model: modelName,
                context: config.context.name,
                timeoutMs: attemptTimeout
            });
            
            // Limita histórico baseado no contexto e cria resumo dos anteriores
            const maxHistory = process.env.OPENAI_MAX_HISTORY ? parseInt(process.env.OPENAI_MAX_HISTORY, 10) : config.maxHistory;
            const fullMessages = (historico?.messages || []);
            const limitedHistory = fullMessages.slice(-maxHistory);
            const olderHistory = fullMessages.slice(0, Math.max(0, fullMessages.length - maxHistory));
            const summaryBlock = olderHistory.length ? summarizeHistory(olderHistory) : null;
            
            const messages = [
                { role: 'system', content: config.systemPrompt },
                ...(summaryBlock ? [{ role: 'system', content: summaryBlock }] : []),
                ...limitedHistory.map(item => ({
                    role: item.role,
                    content: limparMensagem(item.mensagem)
                })).filter(item => item.content),
                { role: 'user', content: userMessage }
            ];

            logger.api('Enviando requisição para API', {
                historico_length: limitedHistory.length,
                message_length: userMessage.length,
                personality: config.personality.name,
                model: modelName
            });

            const content = await openrouterProvider.generate(messages, {
                apiKey: OPENROUTER_API_KEY,
                model: modelName,
                temperature,
                maxTokens,
                timeoutMs: attemptTimeout,
                referer: 'https://github.com/GaabDevWeb/OrbitBot',
                title: 'OrbitBot'
            });

            logger.api('Resposta recebida da API', {
                status: 'ok',
                has_content: !!content,
                personality: config.personality.name
            });

            // Executa hooks após o processamento
            const postProcessData = await pluginSystem.executeHook('afterMessage', {
                message: userMessage,
                response: content,
                historico,
                config,
                userId,
                sentiment: preProcessData.sentiment,
                sentimentScore: preProcessData.sentimentScore
            });

            // Salva em cache
            cache.set(cacheKey, postProcessData.response);

            // Executa hook de mensagem processada
            await pluginSystem.executeHook('messageProcessed', {
                userId,
                message: userMessage,
                response: postProcessData.response,
                config,
                timestamp: new Date()
            });

            return postProcessData.response;
    }, {
        retries: MAX_RETRIES,
        baseDelayMs: 800,
        factor: 2,
        shouldRetry: (error) => {
            // Retry somente em timeout/ECONNRESET/5xx
            const status = error?.response?.status;
            const code = error?.code;
            if (status && status >= 500) return true;
            if (code === 'ECONNRESET' || code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
            // Axios timeout
            if (error?.message && /timeout/i.test(error.message)) return true;
            return false;
        },
        onError: (error, attempt) => {
            logger.error(`Erro na tentativa ${attempt + 1}`, {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                code: error.code
            });
        }
    });

    return responseContent;
}

// Gera um resumo simples local dos itens antigos do histórico sem chamar API externa
function summarizeHistory(items) {
    try {
        const parts = items.map(it => `${it.role === 'user' ? 'U' : 'A'}: ${limparMensagem(it.mensagem)}`)
            .filter(Boolean);
        // Heurística: corta em ~800 chars e remove redundâncias simples
        let joined = parts.join('\n');
        joined = joined.replace(/\s+/g, ' ').trim();
        if (joined.length > 800) joined = joined.slice(-800);
        return `Contexto resumido (anteriores): ${joined}`;
    } catch (e) {
        return null;
    }
}

// Função para processar mensagem com middleware
async function processMessageWithMiddleware(message, next) {
    return await pluginSystem.executeMiddleware(message, next);
}

// Função para obter estatísticas do sistema
function getSystemStats() {
    const aiStats = aiConfigManager.getStats();
    const pluginStats = pluginSystem.getStats();
    const cacheStats = cache.stats();

    return {
        ai: aiStats,
        plugins: pluginStats,
        cache: cacheStats
    };
}

// Função para limpar cache
function clearCache() {
    return cache.clear();
}

module.exports = { 
    handleMessage,
    processMessageWithMiddleware,
    getSystemStats,
    clearCache
};