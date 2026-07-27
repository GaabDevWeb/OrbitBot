const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const groupBuffer = require('../src/groups/groupBuffer');

describe('groupBuffer', () => {
  const gid = '120363test@g.us';

  beforeEach(() => {
    groupBuffer.clearGroup(gid);
  });

  it('mantém no máximo MAX_MESSAGES (FIFO)', () => {
    const n = groupBuffer.MAX_MESSAGES + 5;
    for (let i = 0; i < n; i++) {
      groupBuffer.pushMessage(gid, { sender: 'A', text: `m${i}` });
    }
    const msgs = groupBuffer.getMessages(gid);
    assert.equal(msgs.length, groupBuffer.MAX_MESSAGES);
    assert.equal(msgs[0].text, `m${n - groupBuffer.MAX_MESSAGES}`);
    assert.equal(msgs[msgs.length - 1].text, `m${n - 1}`);
  });

  it('buildContextPrompt inclui todas as msgs, não só as com @orbit', () => {
    groupBuffer.pushMessage(gid, { sender: 'Ana', text: 'vamos sair?' });
    groupBuffer.pushMessage(gid, { sender: 'Bob', text: 'pode ser' });
    groupBuffer.pushMessage(gid, { sender: 'Ana', text: '@orbit resume' });
    const prompt = groupBuffer.buildContextPrompt(gid, { question: 'resume' });
    assert.match(prompt, /vamos sair/);
    assert.match(prompt, /pode ser/);
    assert.match(prompt, /TODAS as mensagens/);
    assert.match(prompt, /Pergunta actual/);
  });

  it('trunca textos longos', () => {
    const long = 'x'.repeat(500);
    groupBuffer.pushMessage(gid, { sender: 'A', text: long });
    const [m] = groupBuffer.getMessages(gid);
    assert.ok(m.text.length <= groupBuffer.MAX_CHARS + 1);
  });

  it('toHistorico mapeia bot → assistant', () => {
    groupBuffer.pushMessage(gid, { sender: 'Gaab', text: 'oi', isBot: false });
    groupBuffer.pushMessage(gid, {
      sender: 'OrbitBot (IA)',
      text: 'olá',
      isBot: true,
    });
    const { messages } = groupBuffer.toHistorico(gid);
    assert.equal(messages[0].role, 'user');
    assert.match(messages[0].mensagem, /Gaab/);
    assert.equal(messages[1].role, 'assistant');
    assert.equal(messages[1].mensagem, 'olá');
  });
});
