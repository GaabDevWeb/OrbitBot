function register(commandBus, { aiConfigManager, getSystemStats, clearCache }) {
  commandBus.register(
    'ai',
    async (args) => {
      const aiCommand = args[0];

      if (!aiCommand) {
        return (
          '🤖 *Sistema de IA*\n\n' +
          '*Comandos Disponíveis:*\n\n' +
          '📄 *Persona / prompt*\n' +
          '• /ai prompt - Mostra caminho e prévia do system prompt\n' +
          '• /ai prompt reload - Recarrega `prompts/SYSTEM.md`\n\n' +
          '📊 *Utilitários*\n' +
          '• /ai stats - Estatísticas e cadeia de modelos\n' +
          '• /ai cache limpar - Limpa cache de respostas\n\n' +
          '*Nota:* modelos OpenRouter vêm de `OPENROUTER_MODELS` no `.env`.\n' +
          'A persona é o ficheiro Markdown `prompts/SYSTEM.md`.'
        );
      }

      switch (aiCommand) {
        case 'personalidade':
        case 'modelo':
          return (
            '❌ Personalidades e aliases de modelo internos foram removidos.\n\n' +
            '• Persona: edite `prompts/SYSTEM.md` (ou `/ai prompt reload`)\n' +
            '• Modelos: configure `OPENROUTER_MODELS` no `.env`'
          );
        case 'prompt': {
          const sub = args[1];
          if (sub === 'reload') {
            try {
              aiConfigManager.loadPrompt();
              const stats = aiConfigManager.getStats();
              return (
                `✅ *System prompt recarregado*\n\n` +
                `• Ficheiro: ${stats.promptPath}\n` +
                `• Tamanho: ${stats.promptChars} caracteres`
              );
            } catch (error) {
              return `❌ Erro ao recarregar prompt: ${error.message}`;
            }
          }
          const stats = aiConfigManager.getStats();
          const preview = String(aiConfigManager.systemPrompt || '')
            .slice(0, 400)
            .replace(/\n+/g, '\n');
          return (
            `📄 *Persona (system prompt)*\n\n` +
            `• Ficheiro: ${stats.promptPath}\n` +
            `• Tamanho: ${stats.promptChars} caracteres\n\n` +
            `*Prévia:*\n${preview}${stats.promptChars > 400 ? '…' : ''}\n\n` +
            `Use /ai prompt reload após editar o .md`
          );
        }
        case 'plugin':
          return '❌ Plugins foram removidos nesta versão do OrbitBot.';
        case 'stats': {
          const systemStats = getSystemStats();
          const chain = Array.isArray(systemStats.ai.openRouterModels)
            ? systemStats.ai.openRouterModels.map((m, i) => `${i + 1}. ${m}`).join('\n')
            : '—';
          return (
            `📊 *Estatísticas do Sistema de IA:*\n\n` +
            `🤖 *Persona:*\n` +
            `• Nome: ${systemStats.ai.persona}\n` +
            `• Prompt: ${systemStats.ai.promptPath}\n` +
            `• Chars: ${systemStats.ai.promptChars}\n` +
            `• maxHistory: ${systemStats.ai.maxHistory}\n` +
            `• temperature: ${systemStats.ai.temperature}\n` +
            `• maxTokens: ${systemStats.ai.maxTokens}\n\n` +
            `🔗 *Cadeia OpenRouter (fallback):*\n${chain}\n\n` +
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
    },
    'Comandos de IA. Use /ai para ajuda.'
  );
}

module.exports = { register };
