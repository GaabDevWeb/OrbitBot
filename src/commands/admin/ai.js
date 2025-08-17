const logger = require('../../logger');

function register(commandBus, { aiConfigManager, pluginSystem, getSystemStats, clearCache }) {
  commandBus.register('ai', async (args) => {
    const aiCommand = args[0];

    if (!aiCommand) {
      return (
        '🤖 *Sistema de IA Modular*\n\n' +
        '*Comandos Disponíveis:*\n\n' +
        '👤 *Personalidades*\n' +
        '• /ai personalidade listar - Lista todas as personalidades\n' +
        '• /ai personalidade [nome] - Altera personalidade atual\n' +
        '• /ai personalidade info - Mostra personalidade atual\n\n' +
        '🧠 *Modelos*\n' +
        '• /ai modelo listar - Lista todos os modelos\n' +
        '• /ai modelo [nome] - Altera modelo atual\n' +
        '• /ai modelo info - Mostra modelo atual\n\n' +
        '🔌 *Plugins*\n' +
        '• /ai plugin listar - Lista todos os plugins\n' +
        '• /ai plugin [nome] on/off - Habilita/desabilita plugin\n' +
        '• /ai plugin info [nome] - Mostra informações do plugin\n\n' +
        '📊 *Estatísticas*\n' +
        '• /ai stats - Mostra estatísticas completas\n' +
        '• /ai cache limpar - Limpa cache de respostas\n\n' +
        '*Exemplos:*\n' +
        '• /ai personalidade professional\n' +
        '• /ai modelo deepseek-coder\n' +
        '• /ai plugin sentimentAnalysis off'
      );
    }

    switch (aiCommand) {
      case 'personalidade': {
        const sub = args[1];
        if (!sub) return 'Por favor, especifique um comando. Use: listar, [nome], info';
        switch (sub) {
          case 'listar': {
            const personalities = aiConfigManager.listPersonalities();
            return (
              `👤 *Personalidades Disponíveis:*\n\n` +
              personalities
                .map((p) => `• *${p.name}* (${p.id})\n  ${p.description}\n`)
                .join('\n') +
              `\n*Use:* /ai personalidade [nome] para alterar`
            );
          }
          case 'info': {
            const current = aiConfigManager.getPersonality();
            return (
              `👤 *Personalidade Atual:*\n\n` +
              `• **Nome:** ${current.name}\n` +
              `• **Descrição:** ${current.description}\n` +
              `• **Modelo:** ${current.model}\n` +
              `• **Contexto:** ${current.contextWindow} mensagens`
            );
          }
          default: {
            try {
              const updated = aiConfigManager.setPersonality(sub);
              return (
                `✅ *Personalidade alterada com sucesso!*\n\n` +
                `• **Nova personalidade:** ${updated.name}\n` +
                `• **Descrição:** ${updated.description}\n` +
                `• **Modelo:** ${updated.model}\n` +
                `• **Contexto:** ${updated.contextWindow} mensagens`
              );
            } catch (error) {
              return `❌ Erro: ${error.message}\n\nUse /ai personalidade listar para ver opções disponíveis.`;
            }
          }
        }
      }
      case 'modelo': {
        const sub = args[1];
        if (!sub) return 'Por favor, especifique um comando. Use: listar, [nome], info';
        switch (sub) {
          case 'listar': {
            const models = aiConfigManager.listModels();
            return (
              `🧠 *Modelos Disponíveis:*\n\n` +
              models
                .map((m) => `• *${m.name}* (${m.id})\n  ${m.description}\n  Tokens: ${m.maxTokens}, Temp: ${m.temperature}\n`)
                .join('\n') +
              `\n*Use:* /ai modelo [nome] para alterar`
            );
          }
          case 'info': {
            const current = aiConfigManager.getModel();
            return (
              `🧠 *Modelo Atual:*\n\n` +
              `• **Nome:** ${current.name}\n` +
              `• **Descrição:** ${current.description}\n` +
              `• **Max Tokens:** ${current.maxTokens}\n` +
              `• **Temperature:** ${current.temperature}`
            );
          }
          default: {
            try {
              const updated = aiConfigManager.setModel(sub);
              return (
                `✅ *Modelo alterado com sucesso!*\n\n` +
                `• **Novo modelo:** ${updated.name}\n` +
                `• **Descrição:** ${updated.description}\n` +
                `• **Max Tokens:** ${updated.maxTokens}\n` +
                `• **Temperature:** ${updated.temperature}`
              );
            } catch (error) {
              return `❌ Erro: ${error.message}\n\nUse /ai modelo listar para ver opções disponíveis.`;
            }
          }
        }
      }
      case 'plugin': {
        const sub = args[1];
        if (!sub) return 'Por favor, especifique um comando. Use: listar, [nome] on/off, info [nome]';
        switch (sub) {
          case 'listar': {
            const plugins = pluginSystem.listPlugins();
            return (
              `🔌 *Plugins Disponíveis:*\n\n` +
              plugins
                .map((p) => `• *${p.name}* ${p.enabled ? '🟢' : '🔴'}\n  ${p.description}\n  Versão: ${p.version}\n`)
                .join('\n') +
              `\n*Use:* /ai plugin [nome] on/off para controlar`
            );
          }
          case 'info': {
            const pluginName = args[2];
            if (!pluginName) return 'Por favor, especifique o nome do plugin.';
            const plugin = pluginSystem.getPlugin(pluginName);
            if (!plugin) return `❌ Plugin não encontrado: ${pluginName}`;
            return (
              `🔌 *Informações do Plugin:*\n\n` +
              `• **Nome:** ${plugin.name}\n` +
              `• **Descrição:** ${plugin.description}\n` +
              `• **Versão:** ${plugin.version}\n` +
              `• **Status:** ${plugin.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n` +
              `• **Registrado em:** ${plugin.registeredAt.toLocaleString()}`
            );
          }
          default: {
            const name = sub;
            const action = args[2];
            if (!action) return 'Por favor, especifique a ação. Use: on ou off';
            try {
              const enabled = action === 'on';
              const updated = pluginSystem.togglePlugin(name, enabled);
              return (
                `✅ *Plugin ${enabled ? 'habilitado' : 'desabilitado'} com sucesso!*\n\n` +
                `• **Plugin:** ${updated.name}\n` +
                `• **Status:** ${updated.enabled ? '🟢 Ativo' : '🔴 Inativo'}\n` +
                `• **Descrição:** ${updated.description}`
              );
            } catch (error) {
              return `❌ Erro: ${error.message}\n\nUse /ai plugin listar para ver plugins disponíveis.`;
            }
          }
        }
      }
      case 'stats': {
        const systemStats = getSystemStats();
        return (
          `📊 *Estatísticas do Sistema de IA:*\n\n` +
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
          `• TTL: ${systemStats.cache.ttl / 60000} minutos`
        );
      }
      case 'cache': {
        const cacheAction = args[1];
        if (cacheAction === 'limpar') {
          const clearedSize = clearCache();
          const { cache } = getSystemStats();
          return (
            `✅ *Cache limpo com sucesso!*\n\n` +
            `• **Itens removidos:** ${clearedSize}\n` +
            `• **Cache vazio:** 0/${cache.maxSize}`
          );
        }
        return 'Comando inválido. Use: limpar';
      }
      default:
        return 'Comando inválido. Digite /ai para ver todos os comandos disponíveis.';
    }
  }, 'Comandos de IA. Use /ai para ajuda.');
}

module.exports = { register };
