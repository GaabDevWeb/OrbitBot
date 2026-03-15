const wppconnect = require('@wppconnect-team/wppconnect');
const { simularRespostaHumana } = require('./humanizer');
const performanceMonitor = require('./performance');
const messageQueue = require('./queue');
const logger = require('./logger');
const backupManager = require('./backup');
const { aiConfigManager } = require('./aiConfig');
const { pluginSystem } = require('./pluginSystem');
const commandBus = require('./commands/commandBus');
const aiAdmin = require('./commands/admin/ai');
const dbAdmin = require('./commands/admin/db');
const backupAdmin = require('./commands/admin/backup');
const historyAdmin = require('./commands/admin/history');
const pipeline = require('./core/pipeline');

// Lista de administradores autorizados
const ADMIN_NUMBERS = ['5554996121107@c.us'];

function isAdmin(number) {
    return ADMIN_NUMBERS.includes(number);
}

/**
 * Normaliza o objeto de mensagem do WPPConnect para o contrato esperado pela fila e pipeline.
 * Garante: from, body, isGroupMsg (compatível com formato Venom).
 * @param {object} msg - Objeto mensagem do WPPConnect (pode ter from, body, isGroup, chat, etc.)
 * @returns {{ from: string, body: string, isGroupMsg: boolean }}
 */
function normalizeMessage(msg) {
    const from = msg.from || msg.sender?.id || msg.chat?.id || '';
    const body = typeof msg.body === 'string' ? msg.body : (msg.content || msg.text || '');
    const isGroupMsg = Boolean(msg.isGroup ?? msg.chat?.isGroup ?? false);
    return { from, body, isGroupMsg };
}

/**
 * Garante que o ID do chat está no formato aceito pelo sendText (ex.: numero@c.us).
 * WPPConnect pode usar @c.us ou @s.whatsapp.net.
 */
function normalizeChatId(chatId) {
    if (!chatId || typeof chatId !== 'string') return chatId;
    const n = chatId.replace(/\D/g, '');
    if (!n) return chatId;
    if (chatId.includes('@')) return chatId;
    return `${n}@c.us`;
}

// Registra comandos de administrador no Command Bus
aiAdmin.register(commandBus, {
    aiConfigManager,
    pluginSystem,
    getSystemStats: require('./openai').getSystemStats,
    clearCache: require('./openai').clearCache
});
dbAdmin.register(commandBus);
backupAdmin.register(commandBus, { backupManager });
historyAdmin.register(commandBus);



function startBot() {
    performanceMonitor.start();
    logger.info('Iniciando bot com sistema modular');

    wppconnect.create({
        session: 'sessionName',
        headless: false,
        logQR: true,
        debug: true,
        browserArgs: ['--no-sandbox'],
        catchQR: (base64Image, asciiQR) => {
            if (asciiQR) logger.info('QR Code (escaneie no WhatsApp):\n' + asciiQR);
        }
    })
    .then((client) => {
        logger.info('Bot iniciado com sucesso');

        // Configura o processador de mensagens da fila
        messageQueue.on('process', async (message) => {
            const startTime = Date.now();
            const chatId = normalizeChatId(message.from);
            logger.info('Iniciando processamento de mensagem', {
                from: message.from,
                text: message.body
            });

            try {
                // Verifica se é um comando de admin
                if (message.body.startsWith('/') && isAdmin(message.from)) {
                    logger.info('Processando comando de admin', { command: message.body });
                    const response = await commandBus.execute(message.body.slice(1), { from: message.from });
                    await client.sendText(chatId, response);
                    return;
                }

                // Processa pelo pipeline (garante cliente, histórico e persistência)
                logger.info('Processando mensagem via pipeline', {
                    from: message.from,
                    hasText: !!message.body
                });
                const resposta = await pipeline.run(message.from, message.body);
                if (!resposta) {
                    await client.sendText(chatId, 'Erro ao processar mensagem. Tente novamente.');
                    return;
                }

                // Envia resposta ao usuário
                await simularRespostaHumana(client, chatId, resposta);

                // Registra métricas
                const responseTime = Date.now() - startTime;
                performanceMonitor.addMessageResponseTime(responseTime);

            } catch (err) {
                logger.error('Erro no processamento', {
                    error: err.message,
                    stack: err.stack,
                    from: message.from,
                    message: message.body
                });
                performanceMonitor.addError();

                try {
                    await client.sendText(chatId, 'Estou tendo dificuldades técnicas. Por favor, tente novamente.');
                } catch (sendError) {
                    logger.error('Erro ao enviar mensagem de erro', {
                        error: sendError.message,
                        stack: sendError.stack
                    });
                }
            }
        });

        // Configura o handler de erros da fila
        messageQueue.on('error', (error) => {
            logger.error('Erro na fila de mensagens', {
                message: error.message,
                retries: error.retries,
                error: error.error.message
            });
        });

        client.onMessage(async (msg) => {
            const raw = normalizeMessage(msg);
            const from = normalizeChatId(raw.from);
            if (!from.includes('@c.us') && !from.includes('@s.whatsapp.net')) return;
            if (raw.isGroupMsg) return;

            const message = { from, body: raw.body, isGroupMsg: raw.isGroupMsg };

            logger.info('Nova mensagem recebida', {
                from: message.from,
                body: message.body,
                isGroup: message.isGroupMsg
            });

            // Se for um comando de admin, processa imediatamente
            if (message.body.startsWith('/') && isAdmin(message.from)) {
                const response = await commandBus.execute(message.body.slice(1), { from: message.from });
                await client.sendText(from, response);
                return;
            }

            // Adiciona mensagem à fila (objeto normalizado com from, body, isGroupMsg)
            messageQueue.addMessage(message);

            // Log do tamanho da fila
            const queueSize = messageQueue.getQueueSize();
            logger.debug('Mensagem adicionada à fila', {
                queueSize,
                from: message.from
            });
        });

        logger.info('Bot pronto para receber mensagens');
    })
    .catch((err) => {
        logger.error('Erro ao criar o bot', {
            error: err.message,
            stack: err.stack
        });
        performanceMonitor.addError();
    });
}

module.exports = { startBot };
