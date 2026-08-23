const logger = require('../logger');
const { handleMessage } = require('../openai');
const { userLock } = require('../concurrency');
const data = require('../../database');
const { emitTraceEvent } = require('../traceClient');

/**
 * Processa mensagem 1:1: mutex por JID → dados → IA → persistência.
 * @param {string} jid
 * @param {string|Buffer|object} rawText
 * @param {{ traceId?: string }} [opts]
 * @returns {Promise<string>}
 */
async function run(jid, rawText, opts = {}) {
  const text =
    typeof rawText === 'string'
      ? rawText
      : rawText?.type === 'Buffer'
        ? Buffer.from(rawText.data).toString('utf-8')
        : String(rawText ?? '');

  const traceId = opts.traceId || null;

  return userLock.runExclusive(jid, async () => {
    const cliente = await data.getOrCreateClient(jid);
    // Histórico SQLite local: mantido para admin/backup; Kernel é SSOT do contexto.
    const historico = await data.getRecentHistory(cliente.numero, 50);

    if (traceId) {
      emitTraceEvent({
        traceId,
        stage: 'MESSAGE_PARSED',
        data: { jid, chars: text.length, channel: '1:1' },
      });
    }

    // 1:1 — JIDs completos Baileys (grill-me Orbit Q1)
    const resposta = await handleMessage(historico, text, {
      userId: jid,
      channelId: jid,
      traceId,
    });

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
