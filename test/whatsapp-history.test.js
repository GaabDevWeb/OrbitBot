const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractMessage, buildMessageId } = require('../tools/whatsapp-history/extractor');
const { slugify, computePeriod } = require('../tools/whatsapp-history/serializers');
const { MessageCollector } = require('../tools/whatsapp-history/scroll');

describe('whatsapp-history extractor', () => {
  it('extrai texto de grupo com menção', () => {
    const msg = {
      key: {
        remoteJid: '120363@g.us',
        fromMe: false,
        id: 'ABC123',
        participant: '5551999999999@s.whatsapp.net',
      },
      pushName: 'Ana',
      messageTimestamp: 1700000000,
      message: {
        extendedTextMessage: {
          text: 'fala @orbit e @joao',
          contextInfo: {
            mentionedJid: ['5551888888888@s.whatsapp.net'],
          },
        },
      },
    };
    const row = extractMessage(msg, { groupJid: '120363@g.us' });
    assert.equal(row.author, 'Ana');
    assert.equal(row.type, 'text');
    assert.equal(row.isGroup, true);
    assert.equal(row.hasMention, true);
    assert.ok(row.mentions.includes('@orbit'));
    assert.ok(row.id.includes('ABC123'));
  });

  it('dedupe no collector', () => {
    const c = new MessageCollector();
    const msg = {
      key: {
        remoteJid: '120363@g.us',
        fromMe: false,
        id: 'X1',
        participant: '555@s.whatsapp.net',
      },
      messageTimestamp: 1700000000,
      message: { conversation: 'oi' },
    };
    const ctx = { groupJid: '120363@g.us' };
    assert.equal(c.ingest([msg], ctx), 1);
    assert.equal(c.ingest([msg], ctx), 0);
    assert.equal(c.size, 1);
  });
});

describe('whatsapp-history serializers', () => {
  it('slugify e period', () => {
    assert.equal(slugify('ADS 2026'), 'ads-2026');
    const p = computePeriod([
      { timestamp: '2026-01-02T00:00:00.000Z' },
      { timestamp: '2026-01-01T00:00:00.000Z' },
    ]);
    assert.equal(p.from, '2026-01-01T00:00:00.000Z');
    assert.equal(p.to, '2026-01-02T00:00:00.000Z');
  });

  it('buildMessageId estável', () => {
    const id = buildMessageId({
      key: { remoteJid: 'g@g.us', id: '1', fromMe: false, participant: 'p' },
    });
    assert.equal(id, 'g@g.us|p|1|0');
  });
});
