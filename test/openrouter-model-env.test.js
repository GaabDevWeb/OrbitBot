const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('OPENROUTER_MODELS / OPENROUTER_MODEL', () => {
  let previousModels;
  let previousModel;
  let resolveOpenRouterModels;
  let resolveOpenRouterModelId;

  before(() => {
    previousModels = process.env.OPENROUTER_MODELS;
    previousModel = process.env.OPENROUTER_MODEL;
    ({ resolveOpenRouterModels, resolveOpenRouterModelId } = require('../src/aiConfig'));
  });

  afterEach(() => {
    if (previousModels === undefined) delete process.env.OPENROUTER_MODELS;
    else process.env.OPENROUTER_MODELS = previousModels;
    if (previousModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = previousModel;
  });

  it('parseia JSON array com fallbacks', () => {
    process.env.OPENROUTER_MODELS =
      '["deepseek/deepseek-chat-v3-0324:free","google/gemini-2.0-flash-exp:free"]';
    delete process.env.OPENROUTER_MODEL;
    assert.deepEqual(resolveOpenRouterModels(), [
      'deepseek/deepseek-chat-v3-0324:free',
      'google/gemini-2.0-flash-exp:free',
    ]);
    assert.equal(resolveOpenRouterModelId(), 'deepseek/deepseek-chat-v3-0324:free');
  });

  it('parseia lista CSV', () => {
    process.env.OPENROUTER_MODELS = 'model-a, model-b ,model-c';
    delete process.env.OPENROUTER_MODEL;
    assert.deepEqual(resolveOpenRouterModels(), ['model-a', 'model-b', 'model-c']);
  });

  it('usa OPENROUTER_MODEL único como lista de 1', () => {
    delete process.env.OPENROUTER_MODELS;
    process.env.OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet';
    assert.deepEqual(resolveOpenRouterModels(), ['anthropic/claude-3.5-sonnet']);
  });

  it('faz fallback para o default quando vazio', () => {
    delete process.env.OPENROUTER_MODELS;
    process.env.OPENROUTER_MODEL = '   ';
    assert.deepEqual(resolveOpenRouterModels(), [
      'deepseek/deepseek-chat-v3-0324:free',
    ]);
  });
});
