const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTriggerText,
  hasOrbitTrigger,
  matchTestTrigger,
  stripOrbitTrigger,
} = require('../src/mentionTrigger');
const {
  isMetaSafetyAnswer,
  stripMetaSafetyLines,
} = require('../src/answerGuard');
const {
  shouldActivateAi,
  getBotJids,
  textMentionsBot,
  isBotMentioned,
} = require('../src/groups/groupHandler');

describe('mentionTrigger — Unicode WhatsApp', () => {
  it('remove isolates U+2068/U+2069', () => {
    const raw = '@\u2068~Orbit\u2069 me explica';
    assert.equal(normalizeTriggerText(raw), '@~Orbit me explica');
    assert.equal(hasOrbitTrigger(raw), true);
  });

  it('matchTestTrigger aceita menção nativa com isolates', () => {
    assert.equal(
      matchTestTrigger('@\u2068~Orbit\u2069 oi criança'),
      'oi criança'
    );
  });

  it('stripOrbitTrigger limpa @~Orbit', () => {
    assert.equal(stripOrbitTrigger('@~Orbit resume isso'), 'resume isso');
  });
});

describe('answerGuard', () => {
  it('detecta User/Response Safety isolados', () => {
    assert.equal(isMetaSafetyAnswer('User Safety: safe'), true);
    assert.equal(
      isMetaSafetyAnswer('User Safety: safe\nResponse Safety: safe'),
      true
    );
    assert.equal(isMetaSafetyAnswer('Olá, tudo bem?'), false);
    assert.equal(
      isMetaSafetyAnswer('User Safety: safe — e agora explico Python'),
      false
    );
  });

  it('stripMetaSafetyLines remove só linhas meta', () => {
    assert.equal(stripMetaSafetyLines('User Safety: safe'), '');
    assert.equal(
      stripMetaSafetyLines('User Safety: safe\nOlá!\nResponse Safety: safe'),
      'Olá!'
    );
  });
});

describe('groupHandler — LID mention', () => {
  const sock = {
    user: {
      id: '555599959872:1@s.whatsapp.net',
      lid: '135760493703230:1@lid',
    },
  };

  it('getBotJids inclui dígitos do LID', () => {
    const ids = getBotJids(sock);
    assert.ok(ids.some((x) => String(x).includes('135760493703230')));
    assert.ok(ids.some((x) => String(x).includes('555599959872')));
  });

  it('activa por texto @LID', () => {
    const text = '@135760493703230 me explica como criança';
    assert.equal(textMentionsBot(text, sock), true);
    assert.equal(shouldActivateAi({ key: {}, message: {} }, text, sock), true);
  });

  it('activa por mentionedJid LID', () => {
    const msg = {
      key: {},
      message: {
        extendedTextMessage: {
          text: '@135760493703230 oi',
          contextInfo: { mentionedJid: ['135760493703230@lid'] },
        },
      },
    };
    assert.equal(isBotMentioned(msg, sock), true);
    assert.equal(shouldActivateAi(msg, '@135760493703230 oi', sock), true);
  });

  it('activa por @\\u2068~Orbit\\u2069 no texto', () => {
    const text = '@\u2068~Orbit\u2069 me explica';
    assert.equal(hasOrbitTrigger(text), true);
    assert.equal(shouldActivateAi({ key: {}, message: {} }, text, sock), true);
  });
});
