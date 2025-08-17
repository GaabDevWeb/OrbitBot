const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('../../logger');

function resetDatabase() {
  return new Promise((resolve, reject) => {
    // __dirname = src/commands/admin -> sobe 3 níveis até a raiz do projeto
    const dbPath = path.join(__dirname, '../../../database/data/orbitbot.db');
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.serialize(() => {
        db.run('DELETE FROM historico', (err1) => {
          if (err1) {
            db.close();
            reject(err1);
            return;
          }
          db.run('DELETE FROM clientes', (err2) => {
            if (err2) {
              db.close();
              reject(err2);
              return;
            }
            db.run('DELETE FROM sqlite_sequence WHERE name IN ("historico", "clientes")', (err3) => {
              db.close();
              if (err3) reject(err3);
              else resolve(true);
            });
          });
        });
      });
    });
  });
}

function register(commandBus) {
  // /reset
  commandBus.register('reset', async (args) => {
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
  }, 'Reseta o banco de dados. Uso: /reset confirmar');
}

module.exports = { register };
