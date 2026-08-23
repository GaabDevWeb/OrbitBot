const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { matchTestTrigger } = require('../src/testTrigger');

describe('matchTestTrigger (@orbit / @~Orbit)', () => {
  it('aceita variantes de maiúsculas e higieniza', () => {
    assert.equal(matchTestTrigger('@orbit oi, tudo bem?'), 'oi, tudo bem?');
    assert.equal(matchTestTrigger('@Orbit  hello'), 'hello');
    assert.equal(matchTestTrigger('@ORBIT teste'), 'teste');
    assert.equal(matchTestTrigger('@oRbit /ai stats'), '/ai stats');
  });

  it('aceita menção WhatsApp @~Orbit', () => {
    assert.equal(matchTestTrigger('@~Orbit oi?'), 'oi?');
    assert.equal(matchTestTrigger('@~orbit  hello'), 'hello');
    assert.equal(matchTestTrigger('@~ORBIT /nova'), '/nova');
    assert.equal(matchTestTrigger('@\u2068~Orbit\u2069 oi?'), 'oi?');
  });

  it('ignora mensagens sem prefixo', () => {
    assert.equal(matchTestTrigger('oi'), null);
    assert.equal(matchTestTrigger('orbit oi'), null);
    assert.equal(matchTestTrigger('fala @orbit'), null);
    assert.equal(matchTestTrigger('fala @~Orbit'), null);
  });

  it('ignora só o trigger sem conteúdo útil', () => {
    assert.equal(matchTestTrigger('@orbit'), '');
    assert.equal(matchTestTrigger('@orbit   '), '');
    assert.equal(matchTestTrigger('@~Orbit'), '');
  });
});
