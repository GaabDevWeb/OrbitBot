const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeJid } = require('../src/outbound/send');

test('normalizeJid aceita JID completo', () => {
  assert.equal(normalizeJid('5511999999999@s.whatsapp.net'), '5511999999999@s.whatsapp.net');
});

test('normalizeJid converte número', () => {
  assert.equal(normalizeJid('5511999999999'), '5511999999999@s.whatsapp.net');
});

test('normalizeJid rejeita vazio', () => {
  assert.equal(normalizeJid(''), null);
});
