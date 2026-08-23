const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseKernelResetCommand,
  resolveChannelContext,
  isKernelContextResetCommand,
} = require('../src/kernelContext');

describe('parseKernelResetCommand', () => {
  it('mensagem normal sem reset', () => {
    assert.deepEqual(parseKernelResetCommand('oi tudo bem'), {
      text: 'oi tudo bem',
      resetContext: false,
    });
  });

  it('/reset sozinho → olá + reset', () => {
    assert.deepEqual(parseKernelResetCommand('/reset'), {
      text: 'olá',
      resetContext: true,
    });
  });

  it('/nova sozinho → olá + reset', () => {
    assert.deepEqual(parseKernelResetCommand('/nova'), {
      text: 'olá',
      resetContext: true,
    });
  });

  it('/reset com texto extra', () => {
    assert.deepEqual(parseKernelResetCommand('/reset quem és tu'), {
      text: 'quem és tu',
      resetContext: true,
    });
  });
});

describe('resolveChannelContext', () => {
  it('1:1 object', () => {
    const jid = '5511999999999@s.whatsapp.net';
    assert.deepEqual(resolveChannelContext({ userId: jid, channelId: jid }), {
      userId: jid,
      channelId: jid,
      resetHint: false,
    });
  });

  it('grupo object', () => {
    assert.deepEqual(
      resolveChannelContext({
        userId: '5511888888888@s.whatsapp.net',
        channelId: '120363@g.us',
      }),
      {
        userId: '5511888888888@s.whatsapp.net',
        channelId: '120363@g.us',
        resetHint: false,
      }
    );
  });

  it('string JID → ambos iguais', () => {
    const jid = '5511999999999@s.whatsapp.net';
    assert.deepEqual(resolveChannelContext(jid), {
      userId: jid,
      channelId: jid,
      resetHint: false,
    });
  });

  it('resetHint quando resetContext true', () => {
    const jid = 'a@s.whatsapp.net';
    assert.equal(
      resolveChannelContext({ userId: jid, channelId: jid, resetContext: true })
        .resetHint,
      true
    );
  });
});

describe('isKernelContextResetCommand', () => {
  it('detecta /reset e /nova', () => {
    assert.equal(isKernelContextResetCommand('/reset'), true);
    assert.equal(isKernelContextResetCommand('/nova'), true);
  });

  it('não captura /reset confirmar (admin DB)', () => {
    assert.equal(isKernelContextResetCommand('/reset confirmar'), false);
  });

  it('não captura outros comandos', () => {
    assert.equal(isKernelContextResetCommand('/backup'), false);
  });
});
