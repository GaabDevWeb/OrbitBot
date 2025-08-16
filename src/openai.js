require('dotenv').config();
const axios = require('axios');
const logger = require('./logger');
const { aiConfigManager } = require('./aiConfig');
const { pluginSystem } = require('./pluginSystem');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MAX_RETRIES = 3;
const INITIAL_TIMEOUT = 5000;
const CACHE_TTL = 1800000; // 30 minutos

// Cache para respostas frequentes com LRU
const responseCache = new Map();
const MAX_CACHE_SIZE = 1000;

// Limpa o cache periodicamente
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of responseCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            responseCache.delete(key);
        }
    }
}, 300000); // Limpa a cada 5 minutos

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateCacheKey(historico, userMessage, config) {
    return `${userMessage}-${historico.length}-${config.personality.name}-${config.model.name}`;
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
    const cachedResponse = responseCache.get(cacheKey);
    
    if (cachedResponse && (Date.now() - cachedResponse.timestamp) < CACHE_TTL) {
        logger.api('Resposta encontrada no cache');
        return cachedResponse.response;
    }

    let lastError;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            // Permite overrides via ambiente
            const modelName = process.env.OPENROUTER_MODEL || config.model.name;
            const temperature = process.env.OPENROUTER_TEMPERATURE ? parseFloat(process.env.OPENROUTER_TEMPERATURE) : config.model.temperature;
            const maxTokens = process.env.OPENROUTER_MAX_TOKENS ? parseInt(process.env.OPENROUTER_MAX_TOKENS, 10) : config.model.maxTokens;

            logger.api(`Tentativa ${attempt + 1} de ${MAX_RETRIES}`, {
                personality: config.personality.name,
                model: modelName,
                context: config.context.name
            });
            
            // Limita histórico baseado no contexto
            const limitedHistory = historico.messages.slice(-config.maxHistory);
            
            const messages = [
                { role: 'system', content: config.systemPrompt },
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

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: modelName,
                    messages,
                    temperature,
                    max_tokens: maxTokens
                },
                {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'HTTP-Referer': 'https://github.com/GaabDevWeb/OrbitBot',
                        'X-Title': 'OrbitBot',
                        'Content-Type': 'application/json'
                    },
                    timeout: INITIAL_TIMEOUT * (attempt + 1)
                }
            );

            logger.api('Resposta recebida da API', {
                status: response.status,
                has_content: !!response.data?.choices?.[0]?.message?.content,
                personality: config.personality.name
            });

            if (!response.data?.choices?.[0]?.message?.content) {
                throw new Error('Resposta da API inválida');
            }

            const responseContent = response.data.choices[0].message.content;
            
            // Executa hooks após o processamento
            const postProcessData = await pluginSystem.executeHook('afterMessage', {
                message: userMessage,
                response: responseContent,
                historico,
                config,
                userId,
                sentiment: preProcessData.sentiment,
                sentimentScore: preProcessData.sentimentScore
            });
            
            // Implementa LRU cache
            if (responseCache.size >= MAX_CACHE_SIZE) {
                const oldestKey = responseCache.keys().next().value;
                responseCache.delete(oldestKey);
            }
            
            responseCache.set(cacheKey, {
                response: postProcessData.response,
                timestamp: Date.now()
            });

            // Executa hook de mensagem processada
            await pluginSystem.executeHook('messageProcessed', {
                userId,
                message: userMessage,
                response: postProcessData.response,
                config,
                timestamp: new Date()
            });

            return postProcessData.response;
        } catch (error) {
            lastError = error;
            logger.error(`Erro na tentativa ${attempt + 1}`, {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                personality: config.personality.name,
                model: config.model.name
            });
            
            if (attempt < MAX_RETRIES - 1) {
                const backoffTime = Math.pow(2, attempt) * 1000;
                logger.api(`Tentativa ${attempt + 1} falhou. Tentando novamente em ${backoffTime}ms...`);
                await sleep(backoffTime);
            }
        }
    }

    throw lastError || new Error('Todas as tentativas falharam');
}

// Função para processar mensagem com middleware
async function processMessageWithMiddleware(message, next) {
    return await pluginSystem.executeMiddleware(message, next);
}

// Função para obter estatísticas do sistema
function getSystemStats() {
    const aiStats = aiConfigManager.getStats();
    const pluginStats = pluginSystem.getStats();
    const cacheStats = {
        size: responseCache.size,
        maxSize: MAX_CACHE_SIZE,
        ttl: CACHE_TTL
    };

    return {
        ai: aiStats,
        plugins: pluginStats,
        cache: cacheStats
    };
}

// Função para limpar cache
function clearCache() {
    const size = responseCache.size;
    responseCache.clear();
    logger.info('Cache limpo', { previousSize: size });
    return size;
}

module.exports = { 
    handleMessage,
    processMessageWithMiddleware,
    getSystemStats,
    clearCache
};