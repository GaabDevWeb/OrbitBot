const axios = require('axios');
const logger = require('./logger');
const { aiConfigManager } = require('./aiConfig');
const { pluginSystem } = require('./pluginSystem');

const OPENROUTER_API_KEY = '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';
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
            logger.api(`Tentativa ${attempt + 1} de ${MAX_RETRIES}`, {
                personality: config.personality.name,
                model: config.model.name,
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
                model: config.model.name
            });

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: config.model.name,
                    messages,
                    temperature: config.model.temperature,
                    max_tokens: config.model.maxTokens
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

// Função para melhorar transcrições com configuração dinâmica
async function improveTranscriptionWithAI(transcription, userId = null) {
    const config = aiConfigManager.generateConfig(userId);
    
    const improvementPrompt = `
Você é um especialista em melhorar transcrições de áudio em português brasileiro.

Sua tarefa é pegar uma transcrição com problemas (palavras mal transcritas, codificação, abreviações) e transformá-la em uma frase clara, coerente e natural, mantendo EXATAMENTE o sentido original.

REGRAS IMPORTANTES:
1. Mantenha o sentido original - não invente informações
2. Use português brasileiro natural e informal
3. Corrija problemas de codificação (est → está, voc → você)
4. Expanda abreviações comuns (vc → você, tb → também)
5. Mantenha a informalidade e tom da conversa
6. Se não conseguir entender, mantenha o original

Exemplo:
Entrada: "Tudo bem, Niggoti? Que era bordo que ia saber quanto est a hora com voc hoje?"
Saída: "Tudo bem, niguinho? Que horas são que ia saber quanto está a hora com você hoje?"

Agora melhore esta transcrição: "${transcription}"

Responda APENAS com a versão melhorada, sem explicações.`;

    const improvedTranscription = await handleMessage(
        { messages: [] }, // Histórico vazio para foco na tarefa
        improvementPrompt,
        userId
    );
    
    return improvedTranscription;
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
    improveTranscriptionWithAI,
    processMessageWithMiddleware,
    getSystemStats,
    clearCache
};