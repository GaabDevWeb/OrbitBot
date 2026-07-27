const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  loadSystemPrompt,
  DEFAULT_PROMPT_PATH,
  aiConfigManager,
} = require('../src/aiConfig');

describe('system prompt (.md)', () => {
  it('carrega prompts/SYSTEM.md', () => {
    const { systemPrompt, promptPath } = loadSystemPrompt();
    assert.equal(promptPath, DEFAULT_PROMPT_PATH);
    assert.ok(systemPrompt.length > 20);
  });

  it('generateConfig usa o markdown como systemPrompt', () => {
    aiConfigManager.loadPrompt();
    const config = aiConfigManager.generateConfig();
    assert.ok(config.systemPrompt.length > 20);
    assert.equal(path.basename(config.promptPath), 'SYSTEM.md');
    assert.ok(config.model.name);
  });
});
