/**
 * MODO TESTE LOCAL — branch `refactor/test-trigger-mode`
 *
 * Isolado na entrada de mensagens. Para reverter: apagar este ficheiro
 * e restaurar o filtro `fromMe` + remover o require em `bot.js`.
 */

const TRIGGER_RE = /^@orbit\b/i;

/**
 * Se a mensagem começa com @orbit (case-insensitive), devolve o texto higienizado
 * (prefixo removido + trim). Caso contrário, devolve null (ignorar).
 * @param {string} text
 * @returns {string|null}
 */
function matchTestTrigger(text) {
  const raw = String(text || '').trim();
  if (!TRIGGER_RE.test(raw)) return null;
  return raw.replace(TRIGGER_RE, '').trim();
}

module.exports = { matchTestTrigger, TRIGGER_RE };
