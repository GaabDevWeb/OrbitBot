/**
 * Loop de “scroll” = fetchMessageHistory on-demand com detecção de progresso.
 */

'use strict';

const { extractMessage, normalizeTimestamp } = require('./extractor');

/**
 * Colecção incremental com dedupe por id.
 */
class MessageCollector {
  constructor() {
    /** @type {Map<string, object>} */
    this.byId = new Map();
    /** @type {Map<string, object>} raw WAMessage por id — para seed do fetch */
    this.rawById = new Map();
  }

  get size() {
    return this.byId.size;
  }

  /**
   * @param {object[]} waMessages
   * @param {object} ctx
   * @returns {number} quantas novas
   */
  ingest(waMessages, ctx) {
    let added = 0;
    for (const raw of waMessages || []) {
      if (!raw?.key) continue;
      const jid = raw.key.remoteJid;
      if (ctx.groupJid && jid && jid !== ctx.groupJid) continue;

      const row = extractMessage(raw, ctx);
      if (!row?.id) continue;
      if (this.byId.has(row.id)) continue;

      this.byId.set(row.id, row);
      this.rawById.set(row.id, raw);
      added += 1;
    }
    return added;
  }

  /** Mensagens ordenadas por timestamp ascendente */
  sorted() {
    return [...this.byId.values()].sort((a, b) => {
      const ta = a.timestamp_ms || 0;
      const tb = b.timestamp_ms || 0;
      return ta - tb;
    });
  }

  oldestRaw() {
    let oldest = null;
    let oldestTs = Infinity;
    for (const [id, raw] of this.rawById) {
      const ts = normalizeTimestamp(raw.messageTimestamp) || 0;
      if (ts > 0 && ts < oldestTs) {
        oldestTs = ts;
        oldest = raw;
      }
      // fallback sem ts
      if (!oldest) oldest = raw;
    }
    return oldest;
  }

  period() {
    const list = this.sorted().filter((m) => m.timestamp_ms);
    if (!list.length) return { from: null, to: null };
    return {
      from: list[0].timestamp,
      to: list[list.length - 1].timestamp,
      from_ms: list[0].timestamp_ms,
      to_ms: list[list.length - 1].timestamp_ms,
    };
  }
}

/**
 * @param {object} opts
 * @param {import('@whiskeysockets/baileys').WASocket} opts.sock
 * @param {string} opts.groupJid
 * @param {MessageCollector} opts.collector
 * @param {Map} opts.participantNames
 * @param {number} [opts.batchSize]
 * @param {number} [opts.staleCycles] — ciclos sem progresso → parar
 * @param {number} [opts.maxMessages]
 * @param {number|null} [opts.untilMs] — parar quando oldest <= until
 * @param {number} [opts.waitMs] — espera após cada fetch
 * @param {(msg: string, data?: object) => void} [opts.log]
 */
async function scrollHistory(opts) {
  const {
    sock,
    groupJid,
    collector,
    participantNames,
    batchSize = 50,
    staleCycles = 5,
    maxMessages = Infinity,
    untilMs = null,
    waitMs = 2500,
    log = () => {},
  } = opts;

  const ctx = { groupJid, participantNames };
  let stale = 0;
  let cycles = 0;

  const onHistory = ({ messages }) => {
    const added = collector.ingest(messages || [], ctx);
    if (added > 0) {
      log(`[SCROLL] +${added} mensagens (history.set) total=${collector.size}`);
    }
  };

  const onUpsert = ({ messages }) => {
    const added = collector.ingest(messages || [], ctx);
    if (added > 0) {
      log(`[SCROLL] +${added} mensagens (upsert) total=${collector.size}`);
    }
  };

  sock.ev.on('messaging-history.set', onHistory);
  sock.ev.on('messages.upsert', onUpsert);

  try {
    // Seed: aguardar um pouco por sync inicial / upserts do chat
    await sleep(2000);

    while (true) {
      cycles += 1;

      if (collector.size >= maxMessages) {
        log(`[SCROLL] Limite --messages atingido (${collector.size})`);
        break;
      }

      const period = collector.period();
      if (untilMs != null && period.from_ms != null && period.from_ms <= untilMs) {
        log(`[SCROLL] Limite --until/--days atingido (oldest=${period.from})`);
        break;
      }

      const oldest = collector.oldestRaw();
      if (!oldest?.key?.id) {
        stale += 1;
        log(`[SCROLL] Sem mensagem seed (ciclo ${cycles}, stale ${stale}/${staleCycles})`);
        if (stale >= staleCycles) break;
        await sleep(waitMs);
        continue;
      }

      const before = collector.size;
      const oldestTs = normalizeTimestamp(oldest.messageTimestamp) || Date.now();

      try {
        await sock.fetchMessageHistory(batchSize, oldest.key, oldestTs);
      } catch (err) {
        log(`[SCROLL] fetchMessageHistory erro: ${err.message}`);
        stale += 1;
        if (stale >= staleCycles) break;
        await sleep(waitMs);
        continue;
      }

      await sleep(waitMs);

      const after = collector.size;
      const gained = after - before;

      if (gained > 0) {
        stale = 0;
        log(`[SCROLL] ciclo=${cycles} +${gained} total=${after}`);
      } else {
        stale += 1;
        log(`[SCROLL] ciclo=${cycles} sem progresso (stale ${stale}/${staleCycles})`);
      }

      if (stale >= staleCycles) {
        log('[SCROLL] Encerrar — nenhuma mensagem nova em N ciclos');
        break;
      }
    }
  } finally {
    sock.ev.off('messaging-history.set', onHistory);
    sock.ev.off('messages.upsert', onUpsert);
  }

  // Trim por until / maxMessages após coleta
  let messages = collector.sorted();
  if (untilMs != null) {
    messages = messages.filter((m) => !m.timestamp_ms || m.timestamp_ms >= untilMs);
  }
  if (Number.isFinite(maxMessages) && messages.length > maxMessages) {
    // manter as mais recentes N
    messages = messages.slice(-maxMessages);
  }

  return { messages, cycles };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  MessageCollector,
  scrollHistory,
  sleep,
};
