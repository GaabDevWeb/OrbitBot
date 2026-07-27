const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { matchTestTrigger } = require('../src/testTrigger');

describe('matchTestTrigger (@orbit)', () => {
  it('aceita variantes de maiúsculas e higieniza', () => {
    assert.equal(matchTestTrigger('@orbit oi, tudo bem?'), 'oi, tudo bem?');
    assert.equal(matchTestTrigger('@Orbit  hello'), 'hello');
    assert.equal(matchTestTrigger('@ORBIT teste'), 'teste');
    assert.equal(matchTestTrigger('@oRbit /ai stats'), '/ai stats');
  });

  it('ignora mensagens sem prefixo', () => {
    assert.equal(matchTestTrigger('oi'), null);
    assert.equal(matchTestTrigger('orbit oi'), null);
    assert.equal(matchTestTrigger('fala @orbit'), null);
  });

  it('ignora só o trigger sem conteúdo útil', () => {
    assert.equal(matchTestTrigger('@orbit'), '');
    assert.equal(matchTestTrigger('@orbit   '), '');
  });
});
