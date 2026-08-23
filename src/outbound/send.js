/** Envio outbound via Baileys — usado pelo Kernel Communications. */

const fs = require('fs');
const path = require('path');
const { getSock, isReady } = require('./session');
const { markdownToWhatsapp } = require('../utils/whatsappFormatter');
const logger = require('../logger');

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm']);
const AUDIO_MIME = new Set(['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/aac']);

function normalizeJid(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s.includes('@')) return s;
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 8) return `${digits}@s.whatsapp.net`;
  return null;
}

/**
 * @param {{ to: string, text?: string, caption?: string, attachments?: Array<{filename:string,mime:string,data_base64?:string,path?:string}> }} payload
 */
async function sendOutbound(payload) {
  const started = Date.now();
  if (!isReady()) {
    const err = new Error('WhatsApp socket not ready');
    err.code = 'SOCKET_NOT_READY';
    throw err;
  }
  const sock = getSock();
  const jid = normalizeJid(payload?.to);
  if (!jid) {
    const err = new Error('Invalid destination JID');
    err.code = 'INVALID_JID';
    throw err;
  }

  const text = payload?.text != null ? String(payload.text) : '';
  const caption = payload?.caption != null ? String(payload.caption) : text;
  const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];
  const results = [];

  if (!attachments.length) {
    const waText = markdownToWhatsapp(text || '(sem conteúdo)');
    await sock.sendMessage(jid, { text: waText });
    results.push({ type: 'text', ok: true });
  } else {
    let first = true;
    for (const att of attachments) {
      const buffer = await resolveBuffer(att);
      const mime = String(att.mime || att.content_type || 'application/octet-stream').toLowerCase();
      const filename = String(att.filename || 'file').slice(0, 180);
      const cap = first ? markdownToWhatsapp(caption || text || '') : undefined;
      first = false;

      if (IMAGE_MIME.has(mime)) {
        await sock.sendMessage(jid, { image: buffer, caption: cap || undefined, mimetype: mime });
        results.push({ type: 'image', ok: true, filename });
      } else if (VIDEO_MIME.has(mime)) {
        await sock.sendMessage(jid, { video: buffer, caption: cap || undefined, mimetype: mime });
        results.push({ type: 'video', ok: true, filename });
      } else if (AUDIO_MIME.has(mime)) {
        await sock.sendMessage(jid, { audio: buffer, mimetype: mime, ptt: false });
        if (cap) await sock.sendMessage(jid, { text: cap });
        results.push({ type: 'audio', ok: true, filename });
      } else {
        await sock.sendMessage(jid, {
          document: buffer,
          mimetype: mime,
          fileName: filename,
        });
        if (cap) await sock.sendMessage(jid, { text: cap });
        results.push({ type: 'document', ok: true, filename });
      }
    }
  }

  const latencyMs = Date.now() - started;
  logger.info('outbound send ok', { jid, parts: results.length, latencyMs });
  return { ok: true, jid, results, latency_ms: latencyMs };
}

async function resolveBuffer(att) {
  if (att?.data_base64) {
    return Buffer.from(String(att.data_base64), 'base64');
  }
  if (att?.path) {
    const p = path.resolve(String(att.path));
    return fs.promises.readFile(p);
  }
  const err = new Error('Attachment missing data_base64 or path');
  err.code = 'BAD_ATTACHMENT';
  throw err;
}

module.exports = { sendOutbound, normalizeJid };
