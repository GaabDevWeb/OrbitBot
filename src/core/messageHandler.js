const logger = require('../logger');
const { handleMessage } = require('../openai');
const { userLock } = require('../concurrency');
const data = require('../../database');

/**
 * Processa mensagem 1:1: mutex por JID → dados → IA → persistência.
 * @param {string} jid
 * @param {string|Buffer|object} rawText
 * @returns {Promise<string>}
 */
async function run(jid, rawText) {
  const text =
    typeof rawText === 'string'
      ? rawText
      : rawText?.type === 'Buffer'
        ? Buffer.from(rawText.data).toString('utf-8')
        : String(rawText ?? '');

  return userLock.runExclusive(jid, async () => {
    const cliente = await data.getOrCreateClient(jid);
    const historico = await data.getRecentHistory(cliente.numero, 50);
    const resposta = await handleMessage(historico, text, jid);

    setImmediate(async () => {
      try {
        await Promise.allSettled([
          data.appendHistory(cliente.id, 'user', text),
          data.appendHistory(cliente.id, 'assistant', resposta),
        ]);
      } catch (err) {
        logger.error('Falha ao persistir histórico (assíncrono)', {
          error: err.message,
          jid,
        });
      }
    });

    return resposta;
  });
}

module.exports = { run };
