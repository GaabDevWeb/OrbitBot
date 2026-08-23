/**
 * Serialização JSON + métricas do export.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function slugify(name) {
  return String(name || 'group')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'group';
}

function defaultExportPath(outDir, groupName, date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const file = `${slugify(groupName)}-${y}${m}${d}.json`;
  return path.join(outDir, file);
}

/**
 * Remove campos internos antes de gravar.
 */
function publicMessage(row) {
  const {
    timestamp_ms,
    participant,
    pushName,
    fromMe,
    _extractError,
    ...rest
  } = row;
  return rest;
}

/**
 * @param {object} opts
 * @param {string} opts.group
 * @param {string} opts.groupJid
 * @param {object[]} opts.messages
 * @param {string} opts.outPath
 * @param {number} opts.startedAt
 * @param {number} opts.cycles
 */
function saveExport(opts) {
  const { group, groupJid, messages, outPath, startedAt, cycles } = opts;
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });

  const period = computePeriod(messages);
  const payload = {
    group,
    group_jid: groupJid,
    exported_at: new Date().toISOString(),
    message_count: messages.length,
    period,
    scroll_cycles: cycles,
    messages: messages.map(publicMessage),
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);
  const metrics = {
    group,
    groupJid,
    messageCount: messages.length,
    period,
    elapsedSec,
    messagesPerSec: messages.length / elapsedSec,
    outPath,
    cycles,
  };

  return { payload, metrics };
}

function computePeriod(messages) {
  const withTs = (messages || []).filter((m) => m.timestamp);
  if (!withTs.length) return { from: null, to: null };
  const sorted = [...withTs].sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp))
  );
  return { from: sorted[0].timestamp, to: sorted[sorted.length - 1].timestamp };
}

function printMetrics(metrics) {
  const lines = [
    '',
    '========== [EXPORT] RESUMO ==========',
    `Grupo:                 ${metrics.group}`,
    `JID:                   ${metrics.groupJid}`,
    `Mensagens exportadas:  ${metrics.messageCount}`,
    `Período encontrado:    ${metrics.period.from || '—'} → ${metrics.period.to || '—'}`,
    `Tempo gasto:           ${metrics.elapsedSec.toFixed(1)}s`,
    `Mensagens/segundo:     ${metrics.messagesPerSec.toFixed(2)}`,
    `Ciclos de scroll:      ${metrics.cycles}`,
    `Arquivo:               ${metrics.outPath}`,
    '====================================',
    '',
  ];
  for (const line of lines) console.log(line);
}

module.exports = {
  slugify,
  defaultExportPath,
  saveExport,
  printMetrics,
  computePeriod,
};
