const logger = require('../../logger');
const data = require('../../../database');

function register(commandBus) {
  commandBus.register(
    'reset',
    async (args) => {
      if (args[0] !== 'confirmar') {
        return (
          '⚠️ *ATENÇÃO: Este comando irá apagar clientes e histórico!*\n\n' +
          'A tabela config e o ficheiro prompts/SYSTEM.md não são apagados.\n\n' +
          'Para confirmar, digite: /reset confirmar\n\n' +
          '⚠️ *Esta ação não pode ser desfeita!*'
        );
      }
      try {
        await data.resetAllData();
        logger.info('Banco de dados resetado com sucesso (config preservada)');
        return '✅ Banco de dados resetado com sucesso! (config preservada)';
      } catch (error) {
        logger.error('Erro ao resetar banco de dados', { error: error.message });
        return '❌ Erro ao resetar banco de dados.';
      }
    },
    'Reseta o banco de dados. Uso: /reset confirmar'
  );
}

module.exports = { register };
