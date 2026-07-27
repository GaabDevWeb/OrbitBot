const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateCacheKey } = require('../src/openai');

describe('generateCacheKey', () => {
  const config = {
    systemPrompt: 'Você é o Orbit',
    model: { name: 'openrouter/free' },
  };

  it('inclui userId/JID na chave', () => {
    const k1 = generateCacheKey({ messages: [] }, 'oi', config, '111@s.whatsapp.net');
    const k2 = generateCacheKey({ messages: [] }, 'oi', config, '222@s.whatsapp.net');
    assert.notEqual(k1, k2);
    assert.match(k1, /111@s\.whatsapp\.net/);
  });
});
