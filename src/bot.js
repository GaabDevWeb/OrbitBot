const venom = require('venom-bot');
const { handleMessage, getSystemStats, clearCache } = require('./openai');
const { simularRespostaHumana } = require('./humanizer');
const { cadastrarCliente, buscarCliente, atualizarHistorico, buscarHistorico, buscarUltimasMensagens } = require('../database');
const performanceMonitor = require('./performance');
const messageQueue = require('./queue');
const logger = require('./logger');
const backupManager = require('./backup');
const audioProcessor = require('./audioProcessor');
const { aiConfigManager } = require('./aiConfig');
const { pluginSystem } = require('./pluginSystem');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// Lista de administradores autorizados
const ADMIN_NUMBERS = ['5554996121107@c.us'];

function isAdmin(number) {
    return ADMIN_NUMBERS.includes(number);
}

// Função para resetar o banco SQLite
function resetDatabase() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, '../database/data/orbitbot.db');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
                return;
            }

            db.serialize(() => {
                // Limpa as tabelas
                db.run('DELETE FROM historico', (err) => {
                    if (err) {
                        db.close();
                        reject(err);
                        return;
                    }
                    
                    db.run('DELETE FROM clientes', (err) => {
                        if (err) {
                            db.close();
                            reject(err);
                            return;
                        }
                        
                        // Reseta os contadores de auto-incremento
                        db.run('DELETE FROM sqlite_sequence WHERE name IN ("historico", "clientes")', (err) => {
                            db.close();
                            if (err) {
                                reject(err);
                            } else {
                                resolve(true);
                            }
                        });
                    });
                });
            });
        });
    });
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
            
            try {
                await resetDatabase();
                logger.info('Banco de dados resetado com sucesso');
                return '✅ Banco de dados resetado com sucesso!';
            } catch (error) {
                logger.error('Erro ao resetar banco de dados', { error: error.message });
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

        case 'audio':
            const audioCommand = args[0];
            
            if (!audioCommand) {
                return `🎵 *Sistema de Áudio*\n\n` +
                       `*Comandos Disponíveis:*\n\n` +
                       `📊 *Estatísticas*\n` +
                       `• /audio stats - Mostra estatísticas de processamento\n` +
                       `• /audio status - Mostra status atual do sistema\n\n` +
                       `🤖 *IA e Melhorias*\n` +
                       `• /audio correcoes exemplo - Mostra exemplos de melhorias\n` +
                       `• /audio correcoes testar [texto] - Testa melhoria com IA\n\n` +
                       `⚙️ *Configurações*\n` +
                       `• /audio modelo [tiny/base/small/medium/large] - Altera modelo do Whisper\n` +
                       `• /audio modelo info - Mostra modelo atual\n\n` +
                       `*Exemplos:*\n` +
                       `• /audio stats\n` +
                       `• /audio correcoes exemplo\n` +
                       `• /audio correcoes testar "Tudo bem, Niggoti?"\n` +
                       `• /audio modelo medium`;
            }
            
            switch (audioCommand) {
                case 'stats':
                    const stats = audioProcessor.getStats();
                    return `🎵 *Estatísticas de Áudio*\n\n` +
                           `📊 *Processamento*\n` +
                           `• Total processado: ${stats.totalProcessed}\n` +
                           `• Sucessos: ${stats.successfulTranscriptions}\n` +
                           `• Falhas: ${stats.failedTranscriptions}\n` +
                           `• Taxa de sucesso: ${stats.totalProcessed > 0 ? ((stats.successfulTranscriptions / stats.totalProcessed) * 100).toFixed(1) : 0}%\n\n` +
                           `⏱️ *Performance*\n` +
                           `• Tempo médio: ${stats.averageProcessingTime.toFixed(0)}ms\n` +
                           `• Processando agora: ${stats.currentlyProcessing}\n\n` +
                           `💾 *Cache*\n` +
                           `• Itens em cache: ${stats.cacheSize}`;

                case 'status':
                    const status = audioProcessor.getStats();
                    const isHealthy = status.failedTranscriptions === 0 || 
                                    (status.totalProcessed > 0 && 
                                     (status.failedTranscriptions / status.totalProcessed) < 0.1);
                    
                    return `🎵 *Status do Sistema de Áudio*\n\n` +
                           `🟢 Status: ${isHealthy ? 'Saudável' : '⚠️ Problemas detectados'}\n` +
                           `🔄 Processando: ${status.currentlyProcessing} áudios\n` +
                           `💾 Cache: ${status.cacheSize} transcrições\n` +
                           `📈 Taxa de sucesso: ${status.totalProcessed > 0 ? ((status.successfulTranscriptions / status.totalProcessed) * 100).toFixed(1) : 0}%`;

                case 'correcoes':
                    const correcoesSubCommand = args[1];
                    
                    if (!correcoesSubCommand) {
                        return `🔧 *Sistema de Melhoria de Transcrição com IA*\n\n` +
                               `*Comandos Disponíveis:*\n\n` +
                               `📋 *Visualização*\n` +
                               `• /audio correcoes exemplo - Mostra exemplos de melhorias\n` +
                               `• /audio correcoes testar [texto] - Testa melhoria com IA\n\n` +
                               `*Exemplos:*\n` +
                               `• /audio correcoes exemplo\n` +
                               `• /audio correcoes testar "Tudo bem, Niggoti? Que era bordo?"`;
                    }
                    
                    switch (correcoesSubCommand) {
                        case 'exemplo':
                            return `🎯 *Exemplos de Melhoria com IA*\n\n` +
                                   `*Transcrição original:* "Tudo bem, Niggoti? Que era bordo que ia saber quanto est a hora com voc hoje?"\n\n` +
                                   `*Após IA:* "Tudo bem, niguinho? Que horas são que ia saber quanto está a hora com você hoje?"\n\n` +
                                   `*O que a IA faz:*\n` +
                                   `• Analisa o contexto da conversa\n` +
                                   `• Corrige problemas de codificação\n` +
                                   `• Expande abreviações\n` +
                                   `• Mantém a informalidade\n` +
                                   `• Preserva o sentido original`;
                                   
                        case 'testar':
                            const testText = args.slice(2).join(' ');
                            if (!testText) {
                                return 'Por favor, forneça um texto para testar. Exemplo: /audio correcoes testar "Tudo bem, Niggoti?"';
                            }
                            
                            try {
                                const improvedText = await audioProcessor.improveTranscriptionWithAI(testText);
                                return `🧪 *Teste de Melhoria com IA*\n\n` +
                                       `*Texto original:*\n"${testText}"\n\n` +
                                       `*Texto melhorado pela IA:*\n"${improvedText}"\n\n` +
                                       `*A IA analisou o contexto e aplicou melhorias automaticamente*`;
                            } catch (err) {
                                return `❌ Erro ao testar melhoria: ${err.message}`;
                            }
                                   
                        default:
                            return 'Comando inválido. Use: exemplo, testar';
                    }

                case 'modelo':
                    const modeloSubCommand = args[1];
                    
                    if (!modeloSubCommand) {
                        return `⚙️ *Configurações*\n\n` +
                               `• /audio modelo [tiny/base/small/medium/large] - Altera modelo do Whisper\n` +
                               `• /audio modelo info - Mostra modelo atual\n\n` +
                               `*Exemplos:*\n` +
                               `• /audio modelo medium`;
                    }
                    
                    switch (modeloSubCommand) {
                        case 'tiny':
                        case 'base':
                        case 'small':
                        case 'medium':
                        case 'large':
                            const modeloAlterado = audioProcessor.changeModel(modeloSubCommand);
                            return `⚙️ *Configurações*\n\n` +
                                   `• Modelo alterado com sucesso para: ${modeloAlterado}\n\n` +
                                   `🎵 *Sistema de Áudio*\n\n` +
                                   `*Comandos Disponíveis:*\n\n` +
                                   `📊 *Estatísticas*\n` +
                                   `• /audio stats - Mostra estatísticas de processamento\n` +
                                   `• /audio status - Mostra status atual do sistema\n\n` +
                                   `🤖 *IA e Melhorias*\n` +
                                   `• /audio correcoes exemplo - Mostra exemplos de melhorias\n` +
                                   `• /audio correcoes testar [texto] - Testa melhoria com IA\n\n` +
                                   `*Exemplos:*\n` +
                                   `• /audio stats\n` +
                                   `• /audio correcoes exemplo\n` +
                                   `• /audio correcoes testar "Tudo bem, Niggoti?"\n` +
                                   `• /audio modelo medium`;

                        case 'info':
                            const modeloAtual = audioProcessor.getModel();
                            return `⚙️ *Configurações*\n\n` +
                                   `• Modelo atual: ${modeloAtual}\n\n` +
                                   `🎵 *Sistema de Áudio*\n\n` +
                                   `*Comandos Disponíveis:*\n\n` +
                                   `📊 *Estatísticas*\n` +
                                   `• /audio stats - Mostra estatísticas de processamento\n` +
                                   `• /audio status - Mostra status atual do sistema\n\n` +
                                   `🤖 *IA e Melhorias*\n` +
                                   `• /audio correcoes exemplo - Mostra exemplos de melhorias\n` +
                                   `• /audio correcoes testar [texto] - Testa melhoria com IA\n\n` +
                                   `*Exemplos:*\n` +
                                   `• /audio stats\n` +
                                   `• /audio correcoes exemplo\n` +
                                   `• /audio correcoes testar "Tudo bem, Niggoti?"\n` +
                                   `• /audio modelo medium`;

                        default:
                            return 'Comando inválido. Use: tiny, base, small, medium, large, info';
                    }

                default:
                    return 'Comando inválido. Digite /audio para ver todos os comandos disponíveis.';
            }

        case 'ai':
            const aiCommand = args[0];
            
            if (!aiCommand) {
                return `🤖 *Sistema de IA Modular*\n\n` +
                       `*Comandos Disponíveis:*\n\n` +
                       `👤 *Personalidades*\n` +
                       `• /ai personalidade listar - Lista todas as personalidades\n` +
                       `• /ai personalidade [nome] - Altera personalidade atual\n` +
                       `• /ai personalidade info - Mostra personalidade atual\n\n` +
                       `🧠 *Modelos*\n` +
                       `• /ai modelo listar - Lista todos os modelos\n` +
                       `• /ai modelo [nome] - Altera modelo atual\n` +
                       `• /ai modelo info - Mostra modelo atual\n\n` +
                       `🔌 *Plugins*\n` +
                       `• /ai plugin listar - Lista todos os plugins\n` +
                       `• /ai plugin [nome] on/off - Habilita/desabilita plugin\n` +
                       `• /ai plugin info [nome] - Mostra informações do plugin\n\n` +
                       `📊 *Estatísticas*\n` +
                       `• /ai stats - Mostra estatísticas completas\n` +
                       `• /ai cache limpar - Limpa cache de respostas\n\n` +
                       `*Exemplos:*\n` +
                       `• /ai personalidade professional\n` +
                       `• /ai modelo deepseek-coder\n` +
                       `• /ai plugin sentimentAnalysis off`;
            }
            
            switch (aiCommand) {
                case 'personalidade':
                    const personalitySubCommand = args[1];
                    
                    if (!personalitySubCommand) {
                        return 'Por favor, especifique um comando. Use: listar, [nome], info';
                    }
                    
                    switch (personalitySubCommand) {
                        case 'listar':
                            const personalities = aiConfigManager.listPersonalities();
                            return `👤 *Personalidades Disponíveis:*\n\n` +
                                   personalities.map(p => 
                                       `• *${p.name}* (${p.id})\n` +
                                       `  ${p.description}\n`
                                   ).join('\n') +
                                   `\n*Use:* /ai personalidade [nome] para alterar`;
                                   
                        case 'info':
                            const currentPersonality = aiConfigManager.getPersonality();
                            return `👤 *Personalidade Atual:*\n\n` +
                                   `• **Nome:** ${currentPersonality.name}\n` +
                                   `• **Descrição:** ${currentPersonality.description}\n` +
                                   `• **Modelo:** ${currentPersonality.model}\n` +
                                   `• **Contexto:** ${currentPersonality.contextWindow} mensagens`;
                                   
                        default:
                            try {
                                const newPersonality = aiConfigManager.setPersonality(personalitySubCommand);
                                return `✅ *Personalidade alterada com sucesso!*\n\n` +
                                       `• **Nova personalidade:** ${newPersonality.name}\n` +
                                       `• **Descrição:** ${newPersonality.description}\n` +
                                       `• **Modelo:** ${newPersonality.model}\n` +
                                       `• **Contexto:** ${newPersonality.contextWindow} mensagens`;
                            } catch (error) {
                                return `❌ Erro: ${error.message}\n\nUse /ai personalidade listar para ver opções disponíveis.`;
                            }
                    }

                case 'modelo':
                    const modelSubCommand = args[1];
                    
                    if (!modelSubCommand) {
                        return 'Por favor, especifique um comando. Use: listar, [nome], info';
                    }
                    
                    switch (modelSubCommand) {
                        case 'listar':
                            const models = aiConfigManager.listModels();
                            return `🧠 *Modelos Disponíveis:*\n\n` +
                                   models.map(m => 
                                       `• *${m.name}* (${m.id})\n` +
                                       `  ${m.description}\n` +
                                       `  Tokens: ${m.maxTokens}, Temp: ${m.temperature}\n`
                                   ).join('\n') +
                                   `\n*Use:* /ai modelo [nome] para alterar`;
                                   
                        case 'info':
                            const currentModel = aiConfigManager.getModel();
                            return `🧠 *Modelo Atual:*\n\n` +
                                   `• **Nome:** ${currentModel.name}\n` +
                                   `• **Descrição:** ${currentModel.description}\n` +
                                   `• **Max Tokens:** ${currentModel.maxTokens}\n` +
                                   `• **Temperature:** ${currentModel.temperature}`;
                                   
                        default:
                            try {
                                const newModel = aiConfigManager.setModel(modelSubCommand);
                                return `✅ *Modelo alterado com sucesso!*\n\n` +
                                       `• **Novo modelo:** ${newModel.name}\n` +
                                       `• **Descrição:** ${newModel.description}\n` +
                                       `• **Max Tokens:** ${newModel.maxTokens}\n` +
                                       `• **Temperature:** ${newModel.temperature}`;
                            } catch (error) {
                                return `❌ Erro: ${error.message}\n\nUse /ai modelo listar para ver opções disponíveis.`;
                            }
                    }

                case 'plugin':
                    const pluginSubCommand = args[1];
                    
                    if (!pluginSubCommand) {
                        return 'Por favor, especifique um comando. Use: listar, [nome] on/off, info [nome]';
                    }
                    
                    switch (pluginSubCommand) {
                        case 'listar':
                            const plugins = pluginSystem.listPlugins();
                            return `🔌 *Plugins Disponíveis:*\n\n` +
                                   plugins.map(p => 
                                       `• *${p.name}* ${p.enabled ? '🟢' : '🔴'}\n` +
                                       `  ${p.description}\n` +
                                       `  Versão: ${p.version}\n`
                                   ).join('\n') +
                                   `\n*Use:* /ai plugin [nome] on/off para controlar`;
                                   
                        case 'info':
                            const pluginName = args[2];
                            if (!pluginName) return 'Por favor, especifique o nome do plugin.';
                            
                            const plugin = pluginSystem.getPlugin(pluginName);
                            if (!plugin) return `❌ Plugin não encontrado: ${pluginName}`;
                            
                            return `🔌 *Informações do Plugin:*\n\n` +
                                   `• **Nome:** ${plugin.name}\n` +
                                   `• **Descrição:** ${plugin.description}\n` +
                                   `• **Versão:** ${plugin.version}\n` +
                                   `• **Status:** ${plugin.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n` +
                                   `• **Registrado em:** ${plugin.registeredAt.toLocaleString()}`;
                                   
                        default:
                            const action = args[2];
                            if (!action) return 'Por favor, especifique a ação. Use: on ou off';
                            
                            try {
                                const enabled = action === 'on';
                                const updatedPlugin = pluginSystem.togglePlugin(pluginSubCommand, enabled);
                                return `✅ *Plugin ${enabled ? 'habilitado' : 'desabilitado'} com sucesso!*\n\n` +
                                       `• **Plugin:** ${updatedPlugin.name}\n` +
                                       `• **Status:** ${updatedPlugin.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n` +
                                       `• **Descrição:** ${updatedPlugin.description}`;
                            } catch (error) {
                                return `❌ Erro: ${error.message}\n\nUse /ai plugin listar para ver plugins disponíveis.`;
                            }
                    }

                case 'stats':
                    const systemStats = getSystemStats();
                    return `📊 *Estatísticas do Sistema de IA:*\n\n` +
                           `🤖 *IA:*\n` +
                           `• Personalidades: ${systemStats.ai.totalPersonalities}\n` +
                           `• Modelos: ${systemStats.ai.totalModels}\n` +
                           `• Contextos: ${systemStats.ai.totalContextTypes}\n` +
                           `• Personalidade atual: ${systemStats.ai.currentPersonality}\n` +
                           `• Modelo atual: ${systemStats.ai.currentModel}\n\n` +
                           `🔌 *Plugins:*\n` +
                           `• Total: ${systemStats.plugins.total}\n` +
                           `• Ativos: ${systemStats.plugins.enabled}\n` +
                           `• Inativos: ${systemStats.plugins.disabled}\n` +
                           `• Hooks: ${systemStats.plugins.hooks}\n` +
                           `• Middleware: ${systemStats.plugins.middleware}\n\n` +
                           `💾 *Cache:*\n` +
                           `• Itens: ${systemStats.cache.size}/${systemStats.cache.maxSize}\n` +
                           `• TTL: ${systemStats.cache.ttl / 60000} minutos`;

                case 'cache':
                    const cacheAction = args[1];
                    
                    if (cacheAction === 'limpar') {
                        const clearedSize = clearCache();
                        return `✅ *Cache limpo com sucesso!*\n\n` +
                               `• **Itens removidos:** ${clearedSize}\n` +
                               `• **Cache vazio:** 0/${systemStats.cache.maxSize}`;
                    }
                    
                    return 'Comando inválido. Use: limpar';

                default:
                    return 'Comando inválido. Digite /ai para ver todos os comandos disponíveis.';
            }
            
        default:
            return 'Comando inválido';
    }
}

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
                const historico = await buscarHistorico(cliente.id);
                if (!historico) {
                    logger.error('Falha ao buscar histórico', { cliente_id: cliente.id });
                    await client.sendText(message.from, 'Erro ao processar mensagem. Tente novamente.');
                    return;
                }

                // Processa a mensagem com sistema modular
                logger.info('Enviando mensagem para API modular', { 
                    cliente_id: cliente.id,
                    historico_length: historico.length
                });
                const respostaGPT = await handleMessage(historico, message.body, cliente.id);
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

            // Processa mensagens de áudio com o novo sistema
            if (message.type === 'audio' || (message.mimetype && message.mimetype.startsWith('audio'))) {
                logger.info('Mensagem de áudio recebida', {
                    from: message.from,
                    mimetype: message.mimetype,
                    size: message.data?.length || 0
                });

                try {
                    // Decripta o arquivo de áudio
                    const buffer = await client.decryptFile(message);
                    message.data = buffer;
                    
                    // Processa com o novo sistema
                    await audioProcessor.processAudioMessage(client, message);
                } catch (err) {
                    logger.error('Erro ao processar áudio', { 
                        error: err.message,
                        from: message.from
                    });
                    await client.sendText(message.from, '❌ Erro ao processar seu áudio. Tente novamente.');
                }
                return;
            }

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

// Rotina para remover áudios temporários (mais antigos que 1 hora)
const AUDIO_EXPIRATION_MS = 60 * 60 * 1000; // 1 hora
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutos

setInterval(() => {
    const audioDir = path.join(__dirname, '../audios');
    const now = Date.now();
    
    // Limpa áudios temporários
    if (fs.existsSync(audioDir)) {
        fs.readdirSync(audioDir).forEach(file => {
            const filePath = path.join(audioDir, file);
            try {
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > AUDIO_EXPIRATION_MS) {
                    fs.unlinkSync(filePath);
                    logger.info('Áudio removido (expirado)', { file });
                }
            } catch (err) {
                logger.error('Erro ao tentar remover áudio expirado', { 
                    file, 
                    error: err.message 
                });
            }
        });
    }
}, CLEANUP_INTERVAL);

module.exports = { startBot };