const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyGroupInvocation,
  buildRecentContext,
} = require('../src/groups/groupInvocation');
const groupBuffer = require('../src/groups/groupBuffer');

describe('groupInvocation', () => {
  it('classifica @orbit vazio como contextual_invocation', () => {
    const inv = classifyGroupInvocation('');
    assert.equal(inv.type, 'contextual_invocation');
    assert.equal(inv.explicit_text, false);
  });

  it('classifica pergunta explícita', () => {
    const inv = classifyGroupInvocation('o que é C#?');
    assert.equal(inv.type, 'question');
    assert.equal(inv.explicit_text, true);
  });

  it('classifica pergunta contextual com deixis', () => {
    const inv = classifyGroupInvocation('explica isso');
    assert.equal(inv.type, 'contextual_question');
    assert.equal(inv.explicit_text, true);
  });

  it('classifica comando /reset', () => {
    const inv = classifyGroupInvocation('/reset');
    assert.equal(inv.type, 'command');
    assert.equal(inv.explicit_text, false);
  });

  it('buildRecentContext exclui mensagem activadora', () => {
    const jid = '120363@test@g.us';
    groupBuffer.clearGroup(jid);
    groupBuffer.pushMessage(jid, { sender: 'João', text: 'A prova mudou?' });
    groupBuffer.pushMessage(jid, { sender: 'Maria', text: 'Acho que sim' });
    groupBuffer.pushMessage(jid, { sender: 'João', text: '@orbit' });

    const ctx = buildRecentContext(groupBuffer, jid);
    assert.equal(ctx.length, 2);
    assert.equal(ctx[0].text, 'A prova mudou?');
    assert.equal(ctx[1].text, 'Acho que sim');
    groupBuffer.clearGroup(jid);
  });
});
