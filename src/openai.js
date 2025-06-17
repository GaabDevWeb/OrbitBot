const axios = require('axios');
const { treinamento } = require('./treinamento');
const logger = require('./logger');

const OPENROUTER_API_KEY = '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';
const MODEL_NAME = 'deepseek/deepseek-chat';
const MAX_RETRIES = 3;
const INITIAL_TIMEOUT = 5000; // Reduzido para 5 segundos
const CACHE_TTL = 1800000; // 30 minutos em milissegundos

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

function generateCacheKey(historico, userMessage) {
    // Simplifica a chave do cache para melhor performance
    return `${userMessage}-${historico.length}`;
}

function limparMensagem(mensagem) {
    if (typeof mensagem === 'string') return mensagem;
    if (mensagem && typeof mensagem === 'object' && mensagem.type === 'Buffer') {
        return Buffer.from(mensagem.data).toString('utf-8');
    }
    return '';
}

async function handleMessage(historico, userMessage) {
    const cacheKey = generateCacheKey(historico, userMessage);
    const cachedResponse = responseCache.get(cacheKey);
    
    if (cachedResponse && (Date.now() - cachedResponse.timestamp) < CACHE_TTL) {
        logger.api('Resposta encontrada no cache');
        return cachedResponse.response;
    }

    let lastError;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            logger.api(`Tentativa ${attempt + 1} de ${MAX_RETRIES}`);
            
            const messages = [
                { role: 'system', content: treinamento },
                ...historico.slice(-5).map(item => ({
                    role: item.role,
                    content: limparMensagem(item.mensagem)
                })).filter(item => item.content),
                { role: 'user', content: userMessage }
            ];

            logger.api('Enviando requisição para API', {
                historico_length: historico.length,
                message_length: userMessage.length
            });

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: MODEL_NAME,
                    messages,
                    temperature: 0.7,
                    max_tokens: 800
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
                has_content: !!response.data?.choices?.[0]?.message?.content
            });

            if (!response.data?.choices?.[0]?.message?.content) {
                throw new Error('Resposta da API inválida');
            }

            const responseContent = response.data.choices[0].message.content;
            
            // Implementa LRU cache
            if (responseCache.size >= MAX_CACHE_SIZE) {
                const oldestKey = responseCache.keys().next().value;
                responseCache.delete(oldestKey);
            }
            
            responseCache.set(cacheKey, {
                response: responseContent,
                timestamp: Date.now()
            });

            return responseContent;
        } catch (error) {
            lastError = error;
            logger.error(`Erro na tentativa ${attempt + 1}`, {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
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

module.exports = { handleMessage };