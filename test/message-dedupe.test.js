const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  claimMessageKey,
  _resetDedupeForTests,
} = require('../src/messageDedupe');

describe('claimMessageKey', () => {
  it('aceita a primeira vez e rejeita duplicada', () => {
    _resetDedupeForTests();
    const key = {
      id: 'ABCD',
      remoteJid: '120363@g.us',
      fromMe: false,
      participant: '555@s.whatsapp.net',
    };
    assert.equal(claimMessageKey(key), true);
    assert.equal(claimMessageKey(key), false);
  });

  it('sem id não bloqueia', () => {
    _resetDedupeForTests();
    assert.equal(claimMessageKey({ remoteJid: 'x@g.us' }), true);
    assert.equal(claimMessageKey({ remoteJid: 'x@g.us' }), true);
  });
});
