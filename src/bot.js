const venom = require('venom-bot');
const { handleMessage } = require('./openai');
const { simularRespostaHumana } = require('./humanizer');
const { cadastrarCliente, buscarCliente, atualizarHistorico, buscarHistorico, buscarUltimasMensagens } = require('../database');
const { resetDatabase } = require('../database/dbOperations');
const performanceMonitor = require('./performance');
const messageQueue = require('./queue');
const logger = require('./logger');
const backupManager = require('./backup');

// Lista de administradores autorizados
const ADMIN_NUMBERS = [''];

function isAdmin(number) {
    return ADMIN_NUMBERS.includes(number);
}

async function handleAdminCommand(message) {
    const [command, ...args] = message.body.slice(1).split(' ');
    
    // Função auxiliar para encontrar backup
    function findBackup(backupName) {
        const availableBackups = backupManager.listBackups();
        if (availableBackups.length === 0) {
            return null;
        }
        return availableBackups.find(b => 
            b.toLowerCase().includes(backupName.toLowerCase())
        );
    }
    
    switch (command.toLowerCase()) {
        case 'reset':
            if (args[0] !== 'confirmar') {
                return '⚠️ *ATENÇÃO: Este comando irá apagar TODOS os dados do banco de dados!*\n\n' +
                       'Para confirmar, digite: /reset confirmar\n\n' +
                       '⚠️ *Esta ação não pode ser desfeita!*';
            }
            
            const success = resetDatabase();
            if (success) {
                logger.info('Banco de dados resetado com sucesso');
                return '✅ Banco de dados resetado com sucesso!';
            } else {
                logger.error('Erro ao resetar banco de dados');
                return '❌ Erro ao resetar banco de dados.';
            }

        case 'historico':
            if (args.length === 0) return 'Número inválido';
            const page = parseInt(args[1]) || 1;
            const historico = await buscarHistorico(args[0], page);
            if (historico.messages.length === 0) return 'Nenhuma mensagem encontrada';
            
            let response = `Histórico (Página ${historico.pagination.currentPage}/${historico.pagination.totalPages}):\n\n`;
            historico.messages.forEach(msg => {
                response += `${msg.role === 'user' ? '👤' : '🤖'} ${msg.mensagem}\n`;
            });
            response += `\nTotal: ${historico.pagination.totalMessages} mensagens`;
            return response;

        case 'backup':
            const backupCommand = args[0];
            
            // Se não houver comando específico, mostra todos os comandos disponíveis
            if (!backupCommand) {
                return `📦 *Sistema de Backup*\n\n` +
                       `*Comandos Disponíveis:*\n\n` +
                       `📝 *Criação e Gerenciamento*\n` +
                       `• /backup criar [nome] - Cria um novo backup (nome opcional)\n` +
                       `• /backup listar - Lista todos os backups\n` +
                       `• /backup excluir [nome] - Exclui um backup específico\n\n` +
                       `📊 *Informações*\n` +
                       `• /backup atual - Mostra informações do backup atual\n` +
                       `• /backup info [nome] - Mostra informações de um backup específico\n\n` +
                       `🔄 *Restauração e Logs*\n` +
                       `• /backup restaurar [nome] - Restaura um backup específico\n` +
                       `• /backup logs - Mostra as últimas operações de backup\n\n` +
                       `*Exemplos:*\n` +
                       `• /backup criar backup_importante\n` +
                       `• /backup info "nome do backup"\n\n` +
                       `*Importante:* Use /backup listar para ver os nomes exatos dos backups disponíveis.\n` +
                       `*Nota:* Backups automáticos são criados a cada 6 horas e começam com "auto_".`;
            }
            
            switch (backupCommand) {
                case 'criar':
                    const customName = args.slice(1).join(' ');
                    const success = backupManager.createBackup(customName || null);
                    return success ? 'Backup criado com sucesso!' : 'Erro ao criar backup.';

                case 'listar':
                    const backups = backupManager.listBackups();
                    if (backups.length === 0) return 'Nenhum backup encontrado.';
                    return `Backups disponíveis:\n${backups.map(b => {
                        const isAuto = b.includes('auto_');
                        return `- ${b} ${isAuto ? '(Automático)' : '(Manual)'}`;
                    }).join('\n')}`;

                case 'restaurar':
                    const restoreName = args.slice(1).join(' ');
                    if (!restoreName) return 'Por favor, especifique o nome do backup para restaurar.';
                    
                    const matchingRestoreBackup = findBackup(restoreName);
                    if (!matchingRestoreBackup) {
                        const availableBackups = backupManager.listBackups();
                        return `Backup não encontrado. Backups disponíveis:\n${availableBackups.join('\n')}`;
                    }
                    
                    const restored = backupManager.restoreBackup(matchingRestoreBackup);
                    return restored ? `Backup ${matchingRestoreBackup} restaurado com sucesso!` : 'Erro ao restaurar backup.';

                case 'info':
                    const infoBackupName = args.slice(1).join(' ');
                    if (!infoBackupName) return 'Por favor, especifique o nome do backup para ver as informações.';
                    
                    const matchingInfoBackup = findBackup(infoBackupName);
                    if (!matchingInfoBackup) {
                        const availableBackups = backupManager.listBackups();
                        return `Backup não encontrado. Backups disponíveis:\n${availableBackups.join('\n')}`;
                    }
                    
                    const info = await backupManager.getBackupInfo(matchingInfoBackup);
                    if (!info) return 'Erro ao obter informações do backup.';
                    
                    return `📊 Informações do Backup: ${matchingInfoBackup}\n\n` +
                           `👥 Total de Usuários: ${info.totalClientes}\n` +
                           `💬 Total de Mensagens: ${info.totalMensagens}\n` +
                           `📦 Tamanho: ${(info.size / 1024).toFixed(2)}KB\n` +
                           `📅 Criado em: ${new Date(info.created_at).toLocaleString()}\n` +
                           `🔄 Tipo: ${info.isAutomatic ? 'Automático' : 'Manual'}`;

                case 'atual':
                    const currentInfo = await backupManager.getCurrentBackupInfo();
                    if (!currentInfo) return 'Erro ao obter informações do backup atual.';
                    
                    return `📊 Informações do Backup Atual\n\n` +
                           `👥 Total de Usuários: ${currentInfo.totalClientes}\n` +
                           `💬 Total de Mensagens: ${currentInfo.totalMensagens}\n` +
                           `📦 Tamanho: ${(currentInfo.size / 1024).toFixed(2)}KB\n` +
                           `📅 Última modificação: ${new Date(currentInfo.lastModified).toLocaleString()}`;

                case 'excluir':
                    const deleteName = args.slice(1).join(' ');
                    if (!deleteName) return 'Por favor, especifique o nome do backup para excluir.';
                    
                    const matchingDeleteBackup = findBackup(deleteName);
                    if (!matchingDeleteBackup) {
                        const availableBackups = backupManager.listBackups();
                        return `Backup não encontrado. Backups disponíveis:\n${availableBackups.join('\n')}`;
                    }
                    
                    const deleted = backupManager.deleteBackup(matchingDeleteBackup);
                    return deleted ? `Backup ${matchingDeleteBackup} excluído com sucesso!` : 'Erro ao excluir backup.';

                case 'logs':
                    const logs = backupManager.getLogs();
                    if (logs.length === 0) return 'Nenhum log encontrado.';
                    
                    return `📝 Últimas Operações de Backup:\n\n` +
                           logs.map(log => {
                               const date = new Date(log.timestamp).toLocaleString();
                               const operation = {
                                   'create': '📦 Criado',
                                   'restore': '🔄 Restaurado',
                                   'delete': '🗑️ Excluído',
                                   'auto_delete': '🧹 Limpeza Automática'
                               }[log.operation] || log.operation;
                               
                               const type = log.details.type ? ` (${log.details.type})` : '';
                               return `${operation}${type}: ${log.details.backupName}\n` +
                                      `📅 ${date}`;
                           }).join('\n\n');

                default:
                    return 'Comando inválido. Digite /backup para ver todos os comandos disponíveis.';
            }
            
        default:
            return 'Comando inválido';
    }
}

function startBot() {
    performanceMonitor.start();
    logger.info('Iniciando bot');

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
                    const response = await handleAdminCommand(message);
                    await client.sendText(message.from, response);
                    return;
                }

                // Busca ou cadastra cliente de forma assíncrona
                let cliente = await buscarCliente(message.from);
                logger.info('Cliente encontrado/cadastrado', { 
                    cliente_id: cliente?.id,
                    numero: message.from
                });

                if (!cliente) {
                    logger.info('Cadastrando novo cliente', { numero: message.from });
                    cliente = await cadastrarCliente(message.from);
                }

                // Atualiza histórico antes de processar a mensagem
                logger.info('Atualizando histórico', { cliente_id: cliente.id });
                const historicoAtualizado = await atualizarHistorico(cliente.id, message.body, 'user');
                if (!historicoAtualizado) {
                    logger.error('Falha ao atualizar histórico', { 
                        cliente_id: cliente.id,
                        mensagem: message.body
                    });
                    await client.sendText(message.from, 'Erro ao processar mensagem. Tente novamente.');
                    return;
                }

                // Busca histórico limitado
                logger.info('Buscando histórico recente', { cliente_id: cliente.id });
                const historico = await buscarUltimasMensagens(cliente.id, 5);
                if (!historico) {
                    logger.error('Falha ao buscar histórico', { cliente_id: cliente.id });
                    await client.sendText(message.from, 'Erro ao processar mensagem. Tente novamente.');
                    return;
                }

                // Processa a mensagem
                logger.info('Enviando mensagem para API', { 
                    cliente_id: cliente.id,
                    historico_length: historico.length
                });
                const respostaGPT = await handleMessage(historico, message.body);
                if (!respostaGPT) {
                    logger.error('Falha ao gerar resposta', { 
                        cliente_id: cliente.id,
                        mensagem: message.body
                    });
                    await client.sendText(message.from, 'Erro ao processar mensagem. Tente novamente.');
                    return;
                }

                // Envia resposta
                logger.info('Enviando resposta ao cliente', { 
                    cliente_id: cliente.id,
                    resposta_length: respostaGPT.length
                });
                await simularRespostaHumana(client, message.from, respostaGPT);
                
                // Atualiza histórico com a resposta
                logger.info('Atualizando histórico com resposta', { cliente_id: cliente.id });
                const respostaAtualizada = await atualizarHistorico(cliente.id, respostaGPT, 'assistant');
                if (!respostaAtualizada) {
                    logger.error('Falha ao atualizar resposta no histórico', { cliente_id: cliente.id });
                }

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
                const response = await handleAdminCommand(message);
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