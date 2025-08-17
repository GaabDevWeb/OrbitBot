// Pipeline de mensagens: orquestra histórico -> IA -> persistência
const logger = require('../logger');
const { handleMessage } = require('../openai');
const historyRepo = require('../repositories/historyRepo');
const clientsRepo = require('../repositories/clientsRepo');

/**
 * Executa o pipeline de processamento de mensagem de um usuário
 * - Garante cliente
 * - Carrega histórico recente
 * - Chama IA (com hooks/plugins internos)
 * - Persiste pergunta e resposta
 * @param {string} userNumber WhatsApp number ex: 555499...@c.us
 * @param {string|Buffer|{type:'Buffer',data:number[]}} rawText
 * @returns {Promise<string>} resposta gerada
 */
async function run(userNumber, rawText) {
  const text = typeof rawText === 'string' ? rawText : (rawText?.type === 'Buffer' ? Buffer.from(rawText.data).toString('utf-8') : String(rawText ?? ''));

  // Busca cliente e histórico em paralelo
  const [cliente, historico] = await Promise.all([
    clientsRepo.getOrCreate(userNumber),
    historyRepo.getRecent(userNumber, 50),
  ]);

  // Gera resposta usando motor de IA existente (com hooks internos)
  const resposta = await handleMessage(historico, text, cliente?.id || null);

  // Persiste pergunta e resposta (não bloquear resposta ao usuário)
  setImmediate(async () => {
    try {
      await Promise.allSettled([
        historyRepo.append(cliente.id, 'user', text),
        historyRepo.append(cliente.id, 'assistant', resposta),
      ]);
    } catch (err) {
      logger.error('Falha ao persistir histórico (assíncrono)', { error: err.message, userNumber });
    }
  });

  return resposta;
}

module.exports = { run };
