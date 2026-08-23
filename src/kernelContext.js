/**
 * Utilitários de integração Orbit → Kernel (ChannelContext + reset).
 */

/**
 * Interpreta /reset e /nova no texto já sem @orbit.
 * @param {string} raw
 * @returns {{ text: string, resetContext: boolean }}
 */
function parseKernelResetCommand(raw) {
  const trimmed = String(raw || '').trim();
  const match = trimmed.match(/^\/(reset|nova)\b([\s\S]*)$/i);
  if (!match) {
    return { text: trimmed, resetContext: false };
  }
  const rest = String(match[2] || '').trim();
  // U1: só comando → message "olá" + reset_context
  return { text: rest || 'olá', resetContext: true };
}

/**
 * Normaliza o 3.º argumento de handleMessage para ChannelContext.
 * @param {string|{ userId: string, channelId: string, resetContext?: boolean }} sessionRef
 * @returns {{ userId: string, channelId: string, resetHint: boolean }}
 */
function resolveChannelContext(sessionRef) {
  if (sessionRef && typeof sessionRef === 'object') {
    const userId = String(sessionRef.userId || '').trim();
    const channelId = String(sessionRef.channelId || '').trim();
    if (!userId || !channelId) {
      throw new Error('ChannelContext inválido: userId/channelId vazios');
    }
    return {
      userId,
      channelId,
      resetHint: sessionRef.resetContext === true,
    };
  }
  const jid = String(sessionRef || '').trim();
  if (!jid) {
    throw new Error('ChannelContext inválido: JID vazio');
  }
  // 1:1 legado: mesmo JID nos dois campos
  return { userId: jid, channelId: jid, resetHint: false };
}

/**
 * Admin `/reset confirmar` continua no commandBus.
 * `/reset` e `/nova` (contexto Kernel) devem ir ao AI path.
 * @param {string} body texto após strip @orbit
 * @returns {boolean}
 */
function isKernelContextResetCommand(body) {
  const t = String(body || '').trim();
  if (/^\/nova\b/i.test(t)) return true;
  if (/^\/reset\b/i.test(t) && !/^\/reset\s+confirmar\b/i.test(t)) return true;
  return false;
}

module.exports = {
  parseKernelResetCommand,
  resolveChannelContext,
  isKernelContextResetCommand,
};
