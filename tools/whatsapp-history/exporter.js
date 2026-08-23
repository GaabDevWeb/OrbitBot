#!/usr/bin/env node
/**
 * OrbitBot — exportador de histórico de grupo (Baileys + auth/).
 *
 * Uso:
 *   node tools/whatsapp-history/exporter.js --group "ADS 2026"
 *   node tools/whatsapp-history/exporter.js --group "ADS 2026" --messages 10000
 *   node tools/whatsapp-history/exporter.js --group "ADS 2026" --days 30
 *   node tools/whatsapp-history/exporter.js --group "ADS 2026" --until 2026-01-01
 *
 * Pare o Orbit (npm start) antes de correr — mesma pasta auth/.
 */

'use strict';

const path = require('path');
const { connectExistingSession } = require('./session');
const { buildParticipantNameMap } = require('./extractor');
const { MessageCollector, scrollHistory, sleep } = require('./scroll');
const { defaultExportPath, saveExport, printMetrics } = require('./serializers');

function log(msg) {
  console.log(msg);
}

function parseArgs(argv) {
  const out = {
    group: null,
    messages: null,
    days: null,
    until: null,
    auth: null,
    out: path.join(__dirname, '..', '..', 'exports'),
    batch: 50,
    stale: 5,
    wait: 2500,
    seedTimeout: 120000,
    seedPing: true,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--group':
      case '-g':
        out.group = next();
        break;
      case '--messages':
      case '-n':
        out.messages = parseInt(next(), 10);
        break;
      case '--days':
        out.days = parseInt(next(), 10);
        break;
      case '--until':
        out.until = next();
        break;
      case '--auth':
        out.auth = next();
        break;
      case '--out':
        out.out = next();
        break;
      case '--batch':
        out.batch = parseInt(next(), 10);
        break;
      case '--stale':
        out.stale = parseInt(next(), 10);
        break;
      case '--wait':
        out.wait = parseInt(next(), 10);
        break;
      case '--seed-timeout':
        out.seedTimeout = parseInt(next(), 10);
        break;
      case '--seed-ping':
        out.seedPing = true;
        break;
      case '--no-seed-ping':
        out.seedPing = false;
        break;
      case '--help':
      case '-h':
        out.help = true;
        break;
      default:
        if (a.startsWith('-')) {
          throw new Error(`Argumento desconhecido: ${a}`);
        }
    }
  }
  return out;
}

function printHelp() {
  console.log(`
OrbitBot WhatsApp History Exporter (Baileys)

Uso:
  node tools/whatsapp-history/exporter.js --group "NOME DO GRUPO" [opções]

Opções:
  --group, -g     Nome do grupo (obrigatório; match case-insensitive parcial ou exacto)
  --messages, -n  Máximo de mensagens a exportar
  --days          Só mensagens dos últimos N dias
  --until         Data ISO (YYYY-MM-DD) — exportar a partir desta data
  --auth          Pasta auth (default: ./auth)
  --out           Pasta de saída (default: ./exports)
  --batch         Msgs pedidas por fetchMessageHistory (default: 50)
  --stale         Ciclos sem progresso para parar (default: 5)
  --wait          Ms de espera após cada fetch (default: 2500)

Importante:
  Pare o Orbit (npm start) antes de exportar — partilha a mesma auth/.
  Não envia mensagens; só lê histórico via protocolo Baileys.
`);
}

function resolveUntilMs({ days, until }) {
  if (until) {
    const d = new Date(until.includes('T') ? until : `${until}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw new Error(`--until inválido: ${until}`);
    return d.getTime();
  }
  if (days != null && Number.isFinite(days)) {
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }
  return null;
}

/**
 * Resolve grupo por nome (exacto > includes).
 */
async function findGroupByName(sock, nameQuery) {
  const q = String(nameQuery || '').trim().toLowerCase();
  if (!q) throw new Error('--group é obrigatório');

  log('[EXPORT] A listar grupos…');
  const groups = await sock.groupFetchAllParticipating();
  const list = Object.values(groups || {});

  const exact = list.filter((g) => String(g.subject || '').toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(
      `Vários grupos com nome exacto "${nameQuery}". Use um nome mais específico.`
    );
  }

  const partial = list.filter((g) =>
    String(g.subject || '').toLowerCase().includes(q)
  );
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) {
    const sample = list
      .slice(0, 15)
      .map((g) => `  - ${g.subject}`)
      .join('\n');
    throw new Error(
      `Grupo não encontrado: "${nameQuery}".\nGrupos (amostra):\n${sample || '  (nenhum)'}`
    );
  }

  const names = partial.map((g) => `  - ${g.subject}`).join('\n');
  throw new Error(
    `Vários grupos correspondem a "${nameQuery}":\n${names}\nUse o nome exacto.`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.group) {
    printHelp();
    throw new Error('--group é obrigatório');
  }

  const untilMs = resolveUntilMs(args);
  const maxMessages =
    args.messages != null && Number.isFinite(args.messages)
      ? args.messages
      : Infinity;

  const startedAt = Date.now();
  log('[EXPORT] A ligar com sessão auth/ existente…');
  log('[EXPORT] Pare o Orbit se estiver a correr na mesma auth/.');

  const { sock, close } = await connectExistingSession({
    authDir: args.auth || undefined,
  });
  log('[EXPORT] WhatsApp autenticado');

  const collector = new MessageCollector();
  /** @type {{ groupJid: string|null, participantNames: Map<string,string> }} */
  const liveCtx = { groupJid: null, participantNames: new Map() };

  const onLiveHistory = ({ messages }) => {
    if (!liveCtx.groupJid) return;
    const n = collector.ingest(messages || [], liveCtx);
    if (n) log(`[EXTRACT] sync +${n} total=${collector.size}`);
  };
  const onLiveUpsert = ({ messages }) => {
    if (!liveCtx.groupJid) return;
    const n = collector.ingest(messages || [], liveCtx);
    if (n) log(`[EXTRACT] upsert +${n} total=${collector.size}`);
  };
  sock.ev.on('messaging-history.set', onLiveHistory);
  sock.ev.on('messages.upsert', onLiveUpsert);

  try {
    const group = await findGroupByName(sock, args.group);
    const groupJid = group.id;
    const groupName = group.subject || args.group;
    log(`[EXPORT] Grupo encontrado: ${groupName} (${groupJid})`);

    let metadata = group;
    try {
      metadata = await sock.groupMetadata(groupJid);
    } catch (_) {
      /* usar dados do fetch */
    }
    liveCtx.groupJid = groupJid;
    liveCtx.participantNames = buildParticipantNameMap(metadata);

    const seedTimeoutMs = args.seedTimeout ?? 120_000;
    const seedDeadline = Date.now() + seedTimeoutMs;
    log(
      `[EXPORT] A aguardar seed (até ${Math.round(seedTimeoutMs / 1000)}s). ` +
        'Abra o grupo no telemóvel agora e role o chat para cima.'
    );

    while (collector.size === 0 && Date.now() < seedDeadline) {
      try {
        await sock.presenceSubscribe(groupJid);
      } catch (_) {
        /* opcional */
      }
      try {
        await sock.sendPresenceUpdate('available', groupJid);
      } catch (_) {
        /* opcional */
      }
      await sleep(3000);
    }

    if (collector.size === 0 && args.seedPing) {
      log(
        '[EXPORT] Sem seed via sync — a enviar 1 mensagem seed (necessário ao protocolo Baileys). ' +
          'Use --no-seed-ping para desactivar.'
      );
      const sent = await sock.sendMessage(groupJid, {
        text: '⏳ [Orbit export] seed técnico — pode ignorar/apagar.',
      });
      if (sent) {
        collector.ingest([sent], liveCtx);
      }
      await sleep(1500);
    }

    if (collector.size === 0) {
      throw new Error(
        '[EXPORT] Nenhuma mensagem seed recebida para este grupo. ' +
          'Abra o grupo no telemóvel e envie qualquer mensagem, ou rode sem --no-seed-ping.'
      );
    }
    log(`[EXPORT] Seed: ${collector.size} mensagens`);

    // scrollHistory regista os próprios listeners; evitar duplicar
    sock.ev.off('messaging-history.set', onLiveHistory);
    sock.ev.off('messages.upsert', onLiveUpsert);

    log('[SCROLL] A carregar histórico (fetchMessageHistory + progresso)…');
    const { messages, cycles } = await scrollHistory({
      sock,
      groupJid,
      collector,
      participantNames: liveCtx.participantNames,
      batchSize: args.batch,
      staleCycles: args.stale,
      maxMessages,
      untilMs,
      waitMs: args.wait,
      log,
    });

    log(`[EXTRACT] ${messages.length} mensagens após dedupe/filtros`);

    const outPath = defaultExportPath(path.resolve(args.out), groupName);
    const { metrics } = saveExport({
      group: groupName,
      groupJid,
      messages,
      outPath,
      startedAt,
      cycles,
    });
    log(`[SAVE] Arquivo salvo: ${outPath}`);
    printMetrics(metrics);
  } finally {
    try {
      sock.ev.off('messaging-history.set', onLiveHistory);
      sock.ev.off('messages.upsert', onLiveUpsert);
    } catch (_) {
      /* noop */
    }
    await close();
  }
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});
