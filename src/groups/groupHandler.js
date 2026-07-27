const logger = require('../logger');
const { userLock } = require('../concurrency');
const { handleMessage } = require('../openai');
const { digitsOf, extractText, unwrapMessageContent } = require('../whatsappUtils');
const groupBuffer = require('./groupBuffer');

const ORBIT_TRIGGER_RE = /@orbit\b/i;

function isGroupJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function getBotJids(sock) {
  const raw = sock?.user?.id || sock?.user?.jid || '';
  if (!raw) return [];
  const base = String(raw).split(':')[0];
  const withServer = base.includes('@') ? base : `${base}@s.whatsapp.net`;
  const dig = digitsOf(withServer);
  return [raw, base, withServer, dig].filter(Boolean);
}

function getContextInfo(msg) {
  const m = unwrapMessageContent(msg?.message) || msg?.message;
  if (!m) return null;
  return (
    m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo ||
    m.buttonsResponseMessage?.contextInfo ||
    null
  );
}

function extractMentionedJids(msg) {
  const ctx = getContextInfo(msg);
  const list = ctx?.mentionedJid;
  return Array.isArray(list) ? list.map(String) : [];
}

function isBotMentioned(msg, sock) {
  const mentioned = extractMentionedJids(msg);
  if (!mentioned.length) return false;
  const botIds = getBotJids(sock);
  const botDigits = new Set(botIds.map(digitsOf).filter(Boolean));

  return mentioned.some((jid) => {
    if (botIds.includes(jid)) return true;
    const dig = digitsOf(jid);
    return dig && botDigits.has(dig);
  });
}

function hasOrbitTrigger(text) {
  return ORBIT_TRIGGER_RE.test(String(text || ''));
}

function shouldActivateAi(msg, text, sock) {
  return hasOrbitTrigger(text) || isBotMentioned(msg, sock);
}

function sanitizeQuestion(text) {
  return String(text || '')
    .replace(ORBIT_TRIGGER_RE, ' ')
    .replace(/@\d{5,}\b/g, ' ')
    .replace(/@\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractQuotedContext(msg) {
  const ctx = getContextInfo(msg);
  if (!ctx?.quotedMessage) return null;

  const quotedMsg = { message: ctx.quotedMessage };
  const quotedText = extractText(quotedMsg).trim();
  if (!quotedText) return null;

  const authorJid = ctx.participant || ctx.remoteJid || 'desconhecido';
  const author = digitsOf(authorJid) || authorJid;
  const clipped =
    quotedText.length > groupBuffer.MAX_CHARS
      ? quotedText.slice(0, groupBuffer.MAX_CHARS) + '…'
      : quotedText;

  return `[Mensagem Citada de ${author}]: ${clipped}`;
}

function resolveSenderLabel(msg) {
  if (msg.pushName) return String(msg.pushName);
  const participant = msg.key?.participant || msg.key?.remoteJid || '';
  return digitsOf(participant) || participant || 'membro';
}

function resolveBufferText(msg) {
  const text = extractText(msg).trim();
  if (text) return text;
  const m = unwrapMessageContent(msg?.message) || msg?.message;
  if (!m) return '[mensagem sem texto]';
  if (m.imageMessage) return '[imagem]';
  if (m.videoMessage) return '[vídeo]';
  if (m.audioMessage) return '[áudio]';
  if (m.stickerMessage) return '[sticker]';
  if (m.documentMessage) return `[documento: ${m.documentMessage.fileName || 'ficheiro'}]`;
  if (m.contactMessage) return '[contacto]';
  if (m.locationMessage) return '[localização]';
  return '[mensagem sem texto]';
}

/**
 * Processa mensagem de grupo.
 * - Sempre acrescenta ao buffer (todas as msgs de membros).
 * - Só chama IA com @orbit ou menção.
 * - Prompt recebe o buffer COMPLETO (não só msgs que marcam o bot).
 */
async function handleGroupMessage(sock, msg, upsertType = 'notify') {
  const groupJid = msg.key?.remoteJid;
  if (!isGroupJid(groupJid)) return false;

  const fromMe = Boolean(msg.key?.fromMe);

  // Ecos da sessão (incl. nossa resposta): não disparam IA.
  // Resposta da IA entra no buffer no push manual pós-envio (evita duplicar).
  if (fromMe) {
    return true;
  }

  if (!msg.message) {
    return true;
  }

  const rawText = extractText(msg).trim();
  const bufferText = resolveBufferText(msg);
  const sender = resolveSenderLabel(msg);

  // SEMPRE bufferiza mensagens de membros — com ou sem gatilho
  groupBuffer.pushMessage(groupJid, {
    sender,
    text: bufferText,
    isBot: false,
  });

  logger.info('Grupo: mensagem no buffer', {
    type: upsertType,
    groupJid,
    sender,
    bufferSize: groupBuffer.size(groupJid),
    activate: shouldActivateAi(msg, rawText, sock),
    preview: bufferText.slice(0, 80),
  });

  if (!shouldActivateAi(msg, rawText, sock)) {
    return true;
  }

  const question = sanitizeQuestion(rawText) || bufferText;
  if (!question || question.startsWith('[')) {
    logger.info('Grupo: gatilho sem pergunta útil', { groupJid });
    return true;
  }

  const quoted = extractQuotedContext(msg);

  await userLock.runExclusive(`group:${groupJid}`, async () => {
    // Contexto = TODAS as msgs do buffer, injectadas no prompt (ignora maxHistory 1:1)
    const userPayload = groupBuffer.buildContextPrompt(groupJid, {
      question,
      quoted,
    });

    logger.info('Grupo: a processar IA com contexto completo', {
      groupJid,
      sender,
      question,
      bufferSize: groupBuffer.size(groupJid),
      hasQuote: Boolean(quoted),
    });

    // historico vazio: o contexto já vai no userPayload
    const resposta = await handleMessage({ messages: [] }, userPayload, groupJid);
    if (!resposta) {
      await sock.sendMessage(groupJid, {
        text: 'Erro ao processar mensagem. Tente novamente.',
      });
      return;
    }

    await sock.sendMessage(groupJid, { text: String(resposta) });

    groupBuffer.pushMessage(groupJid, {
      sender: 'OrbitBot (IA)',
      text: String(resposta),
      isBot: true,
    });
  });

  return true;
}

module.exports = {
  handleGroupMessage,
  isGroupJid,
  shouldActivateAi,
  sanitizeQuestion,
  extractQuotedContext,
  hasOrbitTrigger,
  isBotMentioned,
  getBotJids,
};
