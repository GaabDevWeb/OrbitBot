const logger = require('../logger');
const { userLock } = require('../concurrency');
const { handleMessage } = require('../openai');
const { digitsOf, extractText, unwrapMessageContent } = require('../whatsappUtils');
const { markdownToWhatsapp } = require('../utils/whatsappFormatter');
const { claimMessageKey } = require('../messageDedupe');
const groupBuffer = require('./groupBuffer');
const { parseKernelResetCommand } = require('../kernelContext');
const { newTraceId, emitTraceEvent } = require('../traceClient');
const {
  hasOrbitTrigger,
  normalizeTriggerText,
  stripOrbitTrigger,
  ORBIT_TRIGGER_RE,
} = require('../mentionTrigger');

function isGroupJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

/**
 * Identidades do bot: PN (`@s.whatsapp.net`) e LID (`@lid`).
 * Menções nativas em grupos costumam trazer o LID, não o número.
 */
function getBotJids(sock) {
  const out = [];
  const push = (raw) => {
    if (!raw) return;
    const s = String(raw);
    out.push(s);
    const base = s.split(':')[0];
    out.push(base);
    if (!base.includes('@')) {
      // heurística: LID WhatsApp é tipicamente > 14 dígitos
      const dig = digitsOf(base);
      if (dig.length >= 14) out.push(`${dig}@lid`);
      else if (dig) out.push(`${dig}@s.whatsapp.net`);
    }
    const dig = digitsOf(base);
    if (dig) out.push(dig);
  };
  push(sock?.user?.id);
  push(sock?.user?.jid);
  push(sock?.user?.lid);
  return [...new Set(out.filter(Boolean))];
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
  const botIdSet = new Set(botIds);
  const botDigits = new Set(botIds.map(digitsOf).filter(Boolean));

  return mentioned.some((jid) => {
    const s = String(jid);
    if (botIdSet.has(s)) return true;
    const base = s.split(':')[0];
    if (botIdSet.has(base)) return true;
    const dig = digitsOf(s);
    return dig && botDigits.has(dig);
  });
}

/** Texto `@1357…` (LID) ou `@5555…` (PN) a apontar para o bot. */
function textMentionsBot(text, sock) {
  const normalized = normalizeTriggerText(text);
  const botDigits = new Set(
    getBotJids(sock)
      .map(digitsOf)
      .filter((d) => d.length >= 5)
  );
  if (!botDigits.size) return false;
  for (const m of normalized.matchAll(/@(\d{5,})\b/g)) {
    if (botDigits.has(m[1])) return true;
  }
  return false;
}

function shouldActivateAi(msg, text, sock) {
  return (
    hasOrbitTrigger(text) ||
    isBotMentioned(msg, sock) ||
    textMentionsBot(text, sock)
  );
}

function sanitizeQuestion(text) {
  return stripOrbitTrigger(text)
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
  const rawPeek = extractText(msg).trim();

  // Ecos da sessão (respostas do bot): não disparam IA.
  // MODO TESTE: fromMe + @orbit é permitido (dono a testar no próprio telemóvel).
  if (fromMe && !hasOrbitTrigger(rawPeek)) {
    return true;
  }

  if (!msg.message) {
    logger.info('Grupo: mensagem sem conteúdo (possível falha de decrypt)', {
      type: upsertType,
      groupJid,
      fromMe,
      msgId: msg.key?.id,
    });
    return true;
  }

  const rawText = rawPeek || extractText(msg).trim();
  const bufferText = resolveBufferText(msg);
  const sender = fromMe ? 'eu (teste)' : resolveSenderLabel(msg);

  // SEMPRE bufferiza mensagens de membros — com ou sem gatilho
  groupBuffer.pushMessage(groupJid, {
    sender,
    text: bufferText,
    isBot: false,
  });

  const activate = shouldActivateAi(msg, rawText, sock);
  logger.info('Grupo: mensagem no buffer', {
    type: upsertType,
    groupJid,
    sender,
    fromMe,
    bufferSize: groupBuffer.size(groupJid),
    activate,
    mentionedJid: extractMentionedJids(msg),
    hasOrbitText: hasOrbitTrigger(rawText),
    preview: bufferText.slice(0, 80),
  });

  if (!activate) {
    return true;
  }

  const question = sanitizeQuestion(rawText) || bufferText;
  if (!question || question.startsWith('[')) {
    logger.info('Grupo: gatilho sem pergunta útil', { groupJid });
    return true;
  }

  // Dedup: o mesmo id não deve disparar várias chamadas OpenRouter
  if (!claimMessageKey(msg.key)) {
    logger.info('Grupo: mensagem duplicada ignorada (IA)', {
      groupJid,
      msgId: msg.key?.id,
    });
    return true;
  }

  const quoted = extractQuotedContext(msg);
  // Grupo — user_id = autor (JID completo Baileys), channel_id = grupo
  let authorFull = msg.key?.participant || '';
  if (!authorFull && fromMe) {
    authorFull = String(sock?.user?.id || sock?.user?.jid || '').trim();
  }
  if (!authorFull) {
    authorFull = groupJid;
  }

  const parsedReset = parseKernelResetCommand(question);
  // Kernel SSOT: enviar SÓ a pergunta limpa (nunca o buffer de grupo em `message`).
  // Buffer local permanece para observabilidade; quote/reply curto = etapa futura.
  const kernelMessage = parsedReset.text;

  const traceId = newTraceId();
  emitTraceEvent({
    traceId,
    stage: 'MESSAGE_RECEIVED',
    data: {
      groupJid,
      authorJid: authorFull,
      chars: String(kernelMessage).length,
      channel: 'group',
    },
  });
  emitTraceEvent({
    traceId,
    stage: 'MESSAGE_PARSED',
    data: {
      resetContext: parsedReset.resetContext,
      messageChars: String(kernelMessage).length,
      channel: 'group',
    },
  });

  await userLock.runExclusive(`group:${groupJid}`, async () => {
    logger.info('Grupo: a processar IA (Kernel) — pergunta limpa', {
      groupJid,
      authorJid: authorFull,
      sender,
      question: kernelMessage,
      resetContext: parsedReset.resetContext,
      bufferSize: groupBuffer.size(groupJid),
      hasQuote: Boolean(quoted),
      messageChars: String(kernelMessage).length,
      traceId,
    });

    let resposta;
    try {
      resposta = await handleMessage({ messages: [] }, kernelMessage, {
        userId: authorFull,
        channelId: groupJid,
        resetContext: parsedReset.resetContext,
        traceId,
      });
    } catch (err) {
      emitTraceEvent({
        traceId,
        stage: 'ERROR',
        data: {
          channel: 'group',
          message: String(err.message || '').slice(0, 200),
          code: err.code || null,
        },
      });
      throw err;
    }
    if (!resposta) {
      emitTraceEvent({
        traceId,
        stage: 'ERROR',
        data: { reason: 'empty_response', channel: 'group' },
      });
      await sock.sendMessage(groupJid, {
        text: 'Erro ao processar mensagem. Tente novamente.',
      });
      return;
    }

    const waText = markdownToWhatsapp(String(resposta));
    logger.info('Grupo: a enviar resposta', { groupJid, chars: waText.length, traceId });
    await sock.sendMessage(groupJid, { text: waText });
    emitTraceEvent({
      traceId,
      stage: 'MESSAGE_SENT_TO_WHATSAPP',
      data: { groupJid, chars: waText.length, channel: 'group' },
    });
    logger.info('Grupo: resposta enviada', { groupJid, traceId });

    groupBuffer.pushMessage(groupJid, {
      sender: 'OrbitBot (IA)',
      text: waText,
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
  textMentionsBot,
  getBotJids,
  ORBIT_TRIGGER_RE,
};
