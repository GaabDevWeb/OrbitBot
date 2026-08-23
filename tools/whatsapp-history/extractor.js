/**
 * Extrai WAMessage Baileys → schema JSON do exportador.
 */

'use strict';

const crypto = require('crypto');
const {
  extractText,
  unwrapMessageContent,
  digitsOf,
} = require('../../src/whatsappUtils');

/**
 * @param {object} msg — WebMessageInfo-like
 * @param {{ groupJid?: string, participantNames?: Map<string, string> }} ctx
 */
function extractMessage(msg, ctx = {}) {
  try {
    if (!msg?.key) return null;

    const id = buildMessageId(msg);
    const ts = normalizeTimestamp(msg.messageTimestamp);
    const jid = msg.key.remoteJid || ctx.groupJid || '';
    const isGroup = jid.endsWith('@g.us');
    const author = resolveAuthor(msg, ctx.participantNames);
    const content = unwrapMessageContent(msg.message) || msg.message || {};
    const type = detectType(content, msg);
    const text = safeText(msg, type);
    const mentions = extractMentions(content, text);
    const quoted = extractQuoted(content);

    return {
      id,
      timestamp: ts ? new Date(ts).toISOString() : '',
      timestamp_ms: ts || null,
      author,
      text,
      type,
      isGroup,
      fromMe: Boolean(msg.key.fromMe),
      hasMention: mentions.length > 0,
      mentions,
      quoted,
      participant: msg.key.participant || null,
      pushName: msg.pushName || null,
    };
  } catch (err) {
    return {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: '',
      timestamp_ms: null,
      author: 'unknown',
      text: '',
      type: 'unknown',
      isGroup: true,
      fromMe: false,
      hasMention: false,
      mentions: [],
      quoted: null,
      participant: null,
      pushName: null,
      _extractError: String(err?.message || err),
    };
  }
}

function buildMessageId(msg) {
  const key = msg.key || {};
  if (key.id) {
    const part = key.participant || (key.fromMe ? 'me' : 'peer');
    return `${key.remoteJid || ''}|${part}|${key.id}|${key.fromMe ? 1 : 0}`;
  }
  const raw = JSON.stringify({
    t: msg.messageTimestamp,
    p: key.participant,
    m: msg.message,
  });
  return `hash-${crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16)}`;
}

function normalizeTimestamp(ts) {
  if (ts == null) return null;
  const n = typeof ts === 'object' && ts.toNumber ? ts.toNumber() : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  // segundos vs ms
  return n < 1e12 ? n * 1000 : n;
}

function resolveAuthor(msg, participantNames) {
  if (msg.key?.fromMe) return 'me';
  if (msg.pushName) return String(msg.pushName);
  const p = msg.key?.participant || msg.participant || '';
  if (p && participantNames?.has(p)) return participantNames.get(p);
  if (p && participantNames) {
    const dig = digitsOf(p);
    for (const [jid, name] of participantNames) {
      if (digitsOf(jid) === dig && name) return name;
    }
  }
  if (p) return digitsOf(p) || p;
  return 'unknown';
}

function detectType(content, msg) {
  if (!content || typeof content !== 'object') {
    if (msg.messageStubType) return 'system';
    return 'unknown';
  }
  if (msg.messageStubType) return 'system';
  if (content.conversation || content.extendedTextMessage) return 'text';
  if (content.imageMessage) return 'image';
  if (content.videoMessage) return 'video';
  if (content.audioMessage) return 'audio';
  if (content.documentMessage || content.documentWithCaptionMessage) return 'document';
  if (content.stickerMessage) return 'sticker';
  if (content.contactMessage || content.contactsArrayMessage) return 'contact';
  if (content.locationMessage || content.liveLocationMessage) return 'location';
  if (content.protocolMessage) return 'system';
  if (content.reactionMessage) return 'reaction';
  return 'unknown';
}

function safeText(msg, type) {
  try {
    const t = extractText(msg).trim();
    if (t) return t;
    if (type === 'system' && msg.messageStubParameters) {
      return `[system:${msg.messageStubType}] ${msg.messageStubParameters.join(' ')}`.trim();
    }
    if (type === 'image') return '[image]';
    if (type === 'video') return '[video]';
    if (type === 'audio') return '[audio]';
    if (type === 'document') {
      const name =
        unwrapMessageContent(msg.message)?.documentMessage?.fileName || 'document';
      return `[document: ${name}]`;
    }
    if (type === 'sticker') return '[sticker]';
    return '';
  } catch (_) {
    return '';
  }
}

function extractMentions(content, text) {
  const fromCtx =
    content?.extendedTextMessage?.contextInfo?.mentionedJid ||
    content?.imageMessage?.contextInfo?.mentionedJid ||
    content?.videoMessage?.contextInfo?.mentionedJid ||
    [];
  const jids = Array.isArray(fromCtx) ? fromCtx.map(String) : [];

  const atNames = [];
  const re = /@([^\s@]+)/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    atNames.push(m[0]);
  }

  const out = [];
  const seen = new Set();
  for (const x of [...jids, ...atNames]) {
    if (!x || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function extractQuoted(content) {
  try {
    const ctx =
      content?.extendedTextMessage?.contextInfo ||
      content?.imageMessage?.contextInfo ||
      content?.videoMessage?.contextInfo ||
      null;
    if (!ctx?.quotedMessage) return null;
    const qm = { message: ctx.quotedMessage, key: {} };
    const text = extractText(qm).trim();
    const author =
      ctx.participant ||
      ctx.remoteJid ||
      ctx.quotedMessage?.participant ||
      'unknown';
    return {
      author: digitsOf(author) || String(author),
      text: text || '[media/sem texto]',
    };
  } catch (_) {
    return null;
  }
}

/**
 * Constrói mapa participantJid → nome a partir de groupMetadata.
 */
function buildParticipantNameMap(metadata) {
  const map = new Map();
  const parts = metadata?.participants || [];
  for (const p of parts) {
    const id = p.id || p.jid;
    if (!id) continue;
    const name = p.name || p.notify || p.verifiedName || '';
    if (name) map.set(String(id), String(name));
  }
  return map;
}

module.exports = {
  extractMessage,
  buildMessageId,
  buildParticipantNameMap,
  normalizeTimestamp,
};
