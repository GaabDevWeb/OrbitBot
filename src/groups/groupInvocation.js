/**
 * Classificação de invocações @orbit em grupos.
 *
 * Tipos: command | question | contextual_question | contextual_invocation
 */

const DEIXIS_RE =
  /\b(isso|isto|aquilo|aquele|aquela|aqueles|aquelas|desse|dessa|nele|nela|explica\s+isso|resume\s+isso|consegue\s+explicar)\b/i;

const COMMAND_RE = /^\/(reset|nova)\b/i;

/**
 * @param {string} sanitized texto após strip @orbit / menções
 * @returns {{ type: string, explicit_text: boolean }}
 */
function classifyGroupInvocation(sanitized) {
  const trimmed = String(sanitized || '').trim();

  if (COMMAND_RE.test(trimmed)) {
    const rest = trimmed.replace(COMMAND_RE, '').trim();
    return { type: 'command', explicit_text: Boolean(rest) };
  }

  if (!trimmed) {
    return { type: 'contextual_invocation', explicit_text: false };
  }

  if (DEIXIS_RE.test(trimmed)) {
    return { type: 'contextual_question', explicit_text: true };
  }

  return { type: 'question', explicit_text: true };
}

/**
 * Entradas recentes do buffer (sem a mensagem activadora).
 * @param {import('./groupBuffer')} groupBuffer
 * @param {string} groupJid
 * @returns {Array<{sender: string, text: string, is_bot: boolean}>}
 */
function buildRecentContext(groupBuffer, groupJid) {
  const list = groupBuffer.getMessages(groupJid);
  const slice = list.length > 1 ? list.slice(0, -1) : [];
  return slice.map((e) => ({
    sender: e.sender,
    text: e.text,
    is_bot: Boolean(e.isBot),
  }));
}

module.exports = {
  classifyGroupInvocation,
  buildRecentContext,
  DEIXIS_RE,
  COMMAND_RE,
};
