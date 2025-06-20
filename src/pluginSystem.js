const logger = require('./logger');
const fs = require('fs');
const path = require('path');

// Sistema de plugins para extensões dinâmicas
class PluginSystem {
    constructor() {
        this.plugins = new Map();
        this.hooks = new Map();
        this.middleware = [];
        this.pluginDir = path.join(__dirname, '../plugins');
        this.ensurePluginDir();
    }

    ensurePluginDir() {
        if (!fs.existsSync(this.pluginDir)) {
            fs.mkdirSync(this.pluginDir, { recursive: true });
        }
    }

    // Registra um plugin
    registerPlugin(name, plugin) {
        if (this.plugins.has(name)) {
            logger.warn('Plugin já registrado', { name });
            return false;
        }

        // Valida estrutura do plugin
        if (!this.validatePlugin(plugin)) {
            logger.error('Plugin inválido', { name });
            return false;
        }

        this.plugins.set(name, {
            ...plugin,
            name,
            enabled: true,
            registeredAt: new Date()
        });

        // Registra hooks do plugin
        if (plugin.hooks) {
            Object.keys(plugin.hooks).forEach(hookName => {
                if (!this.hooks.has(hookName)) {
                    this.hooks.set(hookName, []);
                }
                this.hooks.get(hookName).push({
                    plugin: name,
                    handler: plugin.hooks[hookName]
                });
            });
        }

        // Registra middleware do plugin
        if (plugin.middleware) {
            this.middleware.push({
                plugin: name,
                handler: plugin.middleware
            });
        }

        logger.info('Plugin registrado com sucesso', { name });
        return true;
    }

    // Valida estrutura do plugin
    validatePlugin(plugin) {
        const required = ['name', 'version', 'description'];
        const optional = ['hooks', 'middleware', 'commands', 'config'];

        for (const field of required) {
            if (!plugin[field]) {
                logger.error('Campo obrigatório ausente no plugin', { field });
                return false;
            }
        }

        return true;
    }

    // Executa hooks
    async executeHook(hookName, data) {
        if (!this.hooks.has(hookName)) {
            return data;
        }

        const hooks = this.hooks.get(hookName);
        let result = data;

        for (const hook of hooks) {
            const plugin = this.plugins.get(hook.plugin);
            if (plugin && plugin.enabled) {
                try {
                    result = await hook.handler(result);
                    logger.debug('Hook executado', { 
                        hook: hookName, 
                        plugin: hook.plugin 
                    });
                } catch (error) {
                    logger.error('Erro ao executar hook', {
                        hook: hookName,
                        plugin: hook.plugin,
                        error: error.message
                    });
                }
            }
        }

        return result;
    }

    // Executa middleware
    async executeMiddleware(message, next) {
        let currentIndex = 0;

        const runMiddleware = async () => {
            if (currentIndex >= this.middleware.length) {
                return await next();
            }

            const middleware = this.middleware[currentIndex];
            const plugin = this.plugins.get(middleware.plugin);

            if (plugin && plugin.enabled) {
                currentIndex++;
                try {
                    return await middleware.handler(message, runMiddleware);
                } catch (error) {
                    logger.error('Erro no middleware', {
                        plugin: middleware.plugin,
                        error: error.message
                    });
                    return await runMiddleware();
                }
            } else {
                currentIndex++;
                return await runMiddleware();
            }
        };

        return await runMiddleware();
    }

    // Habilita/desabilita plugin
    togglePlugin(name, enabled) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin não encontrado: ${name}`);
        }

        plugin.enabled = enabled;
        logger.info('Status do plugin alterado', { name, enabled });
        return plugin;
    }

    // Remove plugin
    unregisterPlugin(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            return false;
        }

        // Remove hooks
        this.hooks.forEach((hooks, hookName) => {
            this.hooks.set(hookName, hooks.filter(h => h.plugin !== name));
        });

        // Remove middleware
        this.middleware = this.middleware.filter(m => m.plugin !== name);

        // Remove plugin
        this.plugins.delete(name);

        logger.info('Plugin removido', { name });
        return true;
    }

    // Lista plugins
    listPlugins() {
        return Array.from(this.plugins.values()).map(plugin => ({
            name: plugin.name,
            version: plugin.version,
            description: plugin.description,
            enabled: plugin.enabled,
            registeredAt: plugin.registeredAt
        }));
    }

    // Obtém plugin específico
    getPlugin(name) {
        return this.plugins.get(name);
    }

    // Estatísticas dos plugins
    getStats() {
        const total = this.plugins.size;
        const enabled = Array.from(this.plugins.values()).filter(p => p.enabled).length;
        const hooks = Array.from(this.hooks.values()).flat().length;
        const middleware = this.middleware.length;

        return {
            total,
            enabled,
            disabled: total - enabled,
            hooks,
            middleware
        };
    }
}

// Plugins padrão do sistema
const defaultPlugins = {
    // Plugin de análise de sentimento
    sentimentAnalysis: {
        name: 'Sentiment Analysis',
        version: '1.0.0',
        description: 'Analisa o sentimento das mensagens',
        hooks: {
            'beforeMessage': async (data) => {
                // Análise básica de sentimento
                const text = data.message.toLowerCase();
                let sentiment = 'neutral';
                
                const positiveWords = ['bom', 'ótimo', 'excelente', 'legal', 'gosto', 'adoro', 'feliz'];
                const negativeWords = ['ruim', 'péssimo', 'horrível', 'odeio', 'triste', 'chato', 'problema'];
                
                const positiveCount = positiveWords.filter(word => text.includes(word)).length;
                const negativeCount = negativeWords.filter(word => text.includes(word)).length;
                
                if (positiveCount > negativeCount) sentiment = 'positive';
                else if (negativeCount > positiveCount) sentiment = 'negative';
                
                return {
                    ...data,
                    sentiment,
                    sentimentScore: positiveCount - negativeCount
                };
            }
        }
    },

    // Plugin de detecção de comandos
    commandDetector: {
        name: 'Command Detector',
        version: '1.0.0',
        description: 'Detecta comandos especiais nas mensagens',
        hooks: {
            'beforeMessage': async (data) => {
                const text = data.message.toLowerCase();
                const commands = {
                    'ajuda': 'help',
                    'status': 'status',
                    'info': 'info',
                    'limpar': 'clear',
                    'config': 'config'
                };

                for (const [pt, en] of Object.entries(commands)) {
                    if (text.includes(pt)) {
                        return {
                            ...data,
                            detectedCommand: en,
                            isCommand: true
                        };
                    }
                }

                return data;
            }
        }
    },

    // Plugin de resposta automática
    autoResponse: {
        name: 'Auto Response',
        version: '1.0.0',
        description: 'Respostas automáticas para situações específicas',
        hooks: {
            'afterMessage': async (data) => {
                const text = data.message.toLowerCase();
                const responses = {
                    'oi': 'Oi! Como posso ajudar?',
                    'olá': 'Olá! Tudo bem?',
                    'tchau': 'Até logo! Foi um prazer conversar com você!',
                    'obrigado': 'Por nada! Estou aqui para ajudar!',
                    'valeu': 'Valeu! Se precisar de mais alguma coisa é só chamar!'
                };

                for (const [trigger, response] of Object.entries(responses)) {
                    if (text.includes(trigger)) {
                        return {
                            ...data,
                            autoResponse: response
                        };
                    }
                }

                return data;
            }
        }
    },

    // Plugin de estatísticas
    statistics: {
        name: 'Statistics',
        version: '1.0.0',
        description: 'Coleta estatísticas de uso',
        hooks: {
            'messageProcessed': async (data) => {
                // Aqui você pode implementar coleta de estatísticas
                // Por exemplo, salvar no banco de dados
                logger.info('Estatísticas coletadas', {
                    userId: data.userId,
                    messageLength: data.message.length,
                    timestamp: new Date()
                });
                return data;
            }
        }
    }
};

// Instância global do sistema de plugins
const pluginSystem = new PluginSystem();

// Registra plugins padrão
Object.entries(defaultPlugins).forEach(([name, plugin]) => {
    pluginSystem.registerPlugin(name, plugin);
});

module.exports = {
    pluginSystem,
    defaultPlugins
}; 