function digitsOf(jidOrNumber) {
  return String(jidOrNumber || '').replace(/\D/g, '');
}

/**
 * Desembrulha wrappers comuns do WhatsApp e extrai texto/caption.
 */
function unwrapMessageContent(message) {
  if (!message || typeof message !== 'object') return null;
  // NÃO seguir quotedMessage aqui — isso substituiria o texto actual pelo citado.
  const nested =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.documentWithCaptionMessage?.message;
  if (nested) return unwrapMessageContent(nested) || nested;
  return message;
}

function extractText(msg) {
  const m = unwrapMessageContent(msg?.message);
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  );
}

function isPrivateChat(jid) {
  if (!jid || typeof jid !== 'string') return false;
  if (jid.endsWith('@g.us')) return false;
  if (jid === 'status@broadcast') return false;
  if (jid.endsWith('@broadcast')) return false;
  if (jid.endsWith('@newsletter')) return false;
  // @lid = Linked ID (WhatsApp actual); aceite em 1:1
  return (
    jid.endsWith('@s.whatsapp.net') ||
    jid.endsWith('@c.us') ||
    jid.endsWith('@lid')
  );
}

function loadAdminNumbers(envValue = process.env.ADMIN_NUMBERS) {
  const raw = envValue || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/\D/g, ''))
    .filter(Boolean);
}

function isAdmin(jid, adminDigits = loadAdminNumbers()) {
  const dig = digitsOf(jid);
  if (!dig) return false;
  return adminDigits.includes(dig);
}

module.exports = {
  digitsOf,
  extractText,
  unwrapMessageContent,
  isPrivateChat,
  loadAdminNumbers,
  isAdmin,
};
