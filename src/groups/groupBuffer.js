/**
 * Buffer rotativo em memória para contexto de grupos.
 * Guarda TODAS as mensagens do grupo (com ou sem menção/@orbit).
 * NÃO persiste em SQLite.
 */

const MAX_MESSAGES = 40;
const MAX_CHARS = 300;

/** @type {Map<string, Array<{sender: string, text: string, isBot: boolean}>>} */
const buffers = new Map();

function truncate(text) {
  const s = String(text || '');
  if (s.length <= MAX_CHARS) return s;
  return s.slice(0, MAX_CHARS) + '…';
}

/**
 * @param {string} groupJid
 * @param {{sender: string, text: string, isBot?: boolean}} entry
 */
function pushMessage(groupJid, { sender, text, isBot = false }) {
  if (!groupJid) return;
  const list = buffers.get(groupJid) || [];
  list.push({
    sender: String(sender || 'desconhecido'),
    text: truncate(text),
    isBot: Boolean(isBot),
  });
  while (list.length > MAX_MESSAGES) {
    list.shift();
  }
  buffers.set(groupJid, list);
}

function getMessages(groupJid) {
  return [...(buffers.get(groupJid) || [])];
}

/** Formata buffer para histórico estilo OpenAI (sem SQLite). */
function toHistorico(groupJid) {
  const messages = getMessages(groupJid).map((e) => ({
    role: e.isBot ? 'assistant' : 'user',
    mensagem: e.isBot ? e.text : `${e.sender}: ${e.text}`,
  }));
  return { messages };
}

/**
 * Texto linear de TODAS as entradas do buffer — usar no prompt da IA
 * para não depender do maxHistory do fluxo 1:1.
 */
function formatPlain(groupJid) {
  const list = getMessages(groupJid);
  if (!list.length) return '(nenhuma mensagem no buffer ainda)';
  return list
    .map((e) =>
      e.isBot ? `[OrbitBot (IA)]: ${e.text}` : `[${e.sender}]: ${e.text}`
    )
    .join('\n');
}

/**
 * Monta o payload do utilizador com contexto completo do grupo.
 * A pergunta activadora pode ser omitida do bloco se já estiver no buffer.
 */
function buildContextPrompt(groupJid, { question, quoted = null } = {}) {
  const parts = [
    'Contexto recente do grupo — TODAS as mensagens capturadas (marcando o bot ou não), da mais antiga para a mais recente:',
    formatPlain(groupJid),
  ];
  if (quoted) {
    parts.push(`Mensagem citada na activação:\n${quoted}`);
  }
  parts.push(`Pergunta actual (responde com base no contexto acima):\n${question}`);
  return parts.join('\n\n');
}

function clearGroup(groupJid) {
  buffers.delete(groupJid);
}

function size(groupJid) {
  return (buffers.get(groupJid) || []).length;
}

module.exports = {
  MAX_MESSAGES,
  MAX_CHARS,
  pushMessage,
  getMessages,
  toHistorico,
  formatPlain,
  buildContextPrompt,
  clearGroup,
  size,
};
