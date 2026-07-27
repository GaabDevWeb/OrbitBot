const data = require('../../../database');

function register(commandBus) {
  commandBus.register(
    'historico',
    async (args) => {
      const identifier = args[0];
      const page = parseInt(args[1] || '1', 10);
      if (!identifier) return 'Uso: /historico <id|numero> [pagina]';

      try {
        const historico = await data.getPagedHistory(identifier, page);
        if (!historico || historico.messages.length === 0) return 'Nenhuma mensagem encontrada';

        let response = `Histórico (Página ${historico.pagination.currentPage}/${historico.pagination.totalPages}):\n\n`;
        historico.messages.forEach((msg) => {
          response += `${msg.role === 'user' ? '👤' : '🤖'} ${msg.mensagem}\n`;
        });
        response += `\nTotal: ${historico.pagination.totalMessages} mensagens`;
        return response;
      } catch (err) {
        return `❌ ${err.message}`;
      }
    },
    'Mostra o histórico: /historico <id|numero> [pagina]'
  );
}

module.exports = { register };
