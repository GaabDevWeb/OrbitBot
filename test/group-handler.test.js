const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeQuestion,
  hasOrbitTrigger,
  shouldActivateAi,
  isGroupJid,
} = require('../src/groups/groupHandler');

describe('groupHandler helpers', () => {
  it('identifica @g.us', () => {
    assert.equal(isGroupJid('120363@g.us'), true);
    assert.equal(isGroupJid('555@s.whatsapp.net'), false);
  });

  it('detecta @orbit e @~Orbit case-insensitive', () => {
    assert.equal(hasOrbitTrigger('@orbit oi'), true);
    assert.equal(hasOrbitTrigger('fala @ORBIT agora'), true);
    assert.equal(hasOrbitTrigger('fala @~Orbit agora'), true);
    assert.equal(hasOrbitTrigger('@~orbit resume'), true);
    assert.equal(hasOrbitTrigger('orbit sem arroba'), false);
  });

  it('sanitiza @orbit / @~Orbit e menções', () => {
    assert.equal(sanitizeQuestion('@orbit oi tudo bem?'), 'oi tudo bem?');
    assert.equal(sanitizeQuestion('@~Orbit oi tudo bem?'), 'oi tudo bem?');
    assert.equal(
      sanitizeQuestion('@orbit @5511999999999 resume isso'),
      'resume isso'
    );
  });

  it('activa por @orbit / @~Orbit mesmo sem menção', () => {
    const msg = { message: { conversation: '@orbit ajuda' }, key: {} };
    assert.equal(shouldActivateAi(msg, '@orbit ajuda', {}), true);
    assert.equal(shouldActivateAi(msg, '@~Orbit ajuda', {}), true);
  });

  it('activa por mentionedJid do bot', () => {
    const sock = { user: { id: '5511999999999:1@s.whatsapp.net' } };
    const msg = {
      key: {},
      message: {
        extendedTextMessage: {
          text: 'ajuda',
          contextInfo: {
            mentionedJid: ['5511999999999@s.whatsapp.net'],
          },
        },
      },
    };
    assert.equal(shouldActivateAi(msg, 'ajuda', sock), true);
  });
});
