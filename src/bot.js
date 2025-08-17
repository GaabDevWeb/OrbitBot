const venom = require('venom-bot');
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

    venom.create({
        session: 'sessionName',
        multidevice: true,
        headless: false,
        logQR: true,
        debug: true,
        browserArgs: ['--no-sandbox']
    })
    .then((client) => {
        logger.info('Bot iniciado com sucesso');
        
        // Configura o processador de mensagens da fila
        messageQueue.on('process', async (message) => {
            const startTime = Date.now();
            logger.info('Iniciando processamento de mensagem', { 
                from: message.from, 
                text: message.body 
            });

            try {
                // Verifica se é um comando de admin
                if (message.body.startsWith('/') && isAdmin(message.from)) {
                    logger.info('Processando comando de admin', { command: message.body });
                    const response = await commandBus.execute(message.body.slice(1), { from: message.from });
                    await client.sendText(message.from, response);
                    return;
                }

                // Processa pelo pipeline (garante cliente, histórico e persistência)
                logger.info('Processando mensagem via pipeline', {
                    from: message.from,
                    hasText: !!message.body
                });
                const resposta = await pipeline.run(message.from, message.body);
                if (!resposta) {
                    await client.sendText(message.from, 'Erro ao processar mensagem. Tente novamente.');
                    return;
                }

                // Envia resposta ao usuário
                await simularRespostaHumana(client, message.from, resposta);

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
                    await client.sendText(message.from, 'Estou tendo dificuldades técnicas. Por favor, tente novamente.');
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

        client.onMessage(async (message) => {
            if (!message.from.includes('@c.us') || message.isGroupMsg) return;

            logger.info('Nova mensagem recebida', {
                from: message.from,
                body: message.body,
                isGroup: message.isGroupMsg
            });
            
            // Se for um comando de admin, processa imediatamente
            if (message.body.startsWith('/') && isAdmin(message.from)) {
                const response = await commandBus.execute(message.body.slice(1), { from: message.from });
                await client.sendText(message.from, response);
                return;
            }
            
            // Adiciona mensagem à fila
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