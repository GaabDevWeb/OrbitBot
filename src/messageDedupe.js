/**
 * Deduplicação de mensagens Baileys (mesmo id não processa IA duas vezes).
 */

'use strict';

const seen = new Map();
const DEFAULT_TTL_MS = 3 * 60 * 1000;

function purge(now) {
  for (const [k, exp] of seen) {
    if (exp <= now) seen.delete(k);
  }
}

/**
 * Tenta reservar uma mensagem para processamento.
 * @param {{ id?: string, remoteJid?: string, fromMe?: boolean, participant?: string }} key
 * @param {number} [ttlMs]
 * @returns {boolean} true se é a primeira vez (pode processar); false se duplicada
 */
function claimMessageKey(key, ttlMs = DEFAULT_TTL_MS) {
  const id = key?.id;
  const jid = key?.remoteJid;
  if (!id || !jid) return true;

  const now = Date.now();
  if (seen.size > 500) purge(now);

  const token = `${jid}|${id}|${key.fromMe ? 1 : 0}|${key.participant || ''}`;
  const existing = seen.get(token);
  if (existing && existing > now) return false;

  seen.set(token, now + ttlMs);
  return true;
}

/** Só para testes */
function _resetDedupeForTests() {
  seen.clear();
}

module.exports = {
  claimMessageKey,
  _resetDedupeForTests,
};
