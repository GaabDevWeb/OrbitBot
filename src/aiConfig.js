require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/** Fallback se nenhuma lista/modelo estiver no .env */
const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-chat-v3-0324:free';

const DEFAULT_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'SYSTEM.md');

/**
 * Lista ordenada de model IDs OpenRouter (primário + fallbacks).
 * @returns {string[]}
 */
function resolveOpenRouterModels() {
  const rawList = process.env.OPENROUTER_MODELS?.trim();
  if (rawList) {
    if (rawList.startsWith('[')) {
      try {
        const parsed = JSON.parse(rawList);
        if (Array.isArray(parsed)) {
          const models = parsed.map((m) => String(m).trim()).filter(Boolean);
          if (models.length) return models;
        }
      } catch (_) {
        /* CSV abaixo */
      }
    }
    const csv = rawList
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    if (csv.length) return csv;
  }

  const single = process.env.OPENROUTER_MODEL?.trim();
  if (single) return [single];

  return [DEFAULT_OPENROUTER_MODEL];
}

function resolveOpenRouterModelId() {
  return resolveOpenRouterModels()[0];
}

function resolvePromptPath() {
  const fromEnv = process.env.SYSTEM_PROMPT_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }
  return DEFAULT_PROMPT_PATH;
}

/**
 * Carrega o system prompt (persona) a partir do ficheiro Markdown.
 * O conteúdo do .md é enviado tal como está à API (como system message).
 */
function loadSystemPrompt(filePath = resolvePromptPath()) {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) {
      throw new Error(`System prompt vazio: ${filePath}`);
    }
    return { systemPrompt: content, promptPath: filePath };
  } catch (err) {
    logger.error('Falha ao ler system prompt', {
      path: filePath,
      error: err.message,
    });
    throw err;
  }
}

class AIConfigManager {
  constructor() {
    this.systemPrompt = '';
    this.promptPath = resolvePromptPath();
    this.maxHistory = parseInt(process.env.OPENAI_MAX_HISTORY || '10', 10);
    this.temperature = process.env.OPENROUTER_TEMPERATURE
      ? parseFloat(process.env.OPENROUTER_TEMPERATURE)
      : 0.7;
    this.maxTokens = process.env.OPENROUTER_MAX_TOKENS
      ? parseInt(process.env.OPENROUTER_MAX_TOKENS, 10)
      : 800;
  }

  /** Carrega/recarrega o persona a partir do .md */
  loadPrompt() {
    const { systemPrompt, promptPath } = loadSystemPrompt();
    this.systemPrompt = systemPrompt;
    this.promptPath = promptPath;
    logger.info('System prompt (persona) carregado', {
      path: promptPath,
      chars: systemPrompt.length,
    });
    return this.systemPrompt;
  }

  /** Compat com boot antigo */
  async hydrate() {
    this.loadPrompt();
  }

  generateConfig(_userId = null) {
    if (!this.systemPrompt) {
      this.loadPrompt();
    }
    return {
      systemPrompt: this.systemPrompt,
      promptPath: this.promptPath,
      personaName: 'Orbit',
      maxHistory: this.maxHistory,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      model: { name: resolveOpenRouterModelId() },
    };
  }

  validateConfig(config) {
    const errors = [];
    if (!config.systemPrompt) errors.push('System prompt não definido');
    if (!config.model?.name) errors.push('Modelo não definido');
    return { isValid: errors.length === 0, errors };
  }

  getStats() {
    return {
      persona: 'Orbit',
      promptPath: this.promptPath,
      promptChars: this.systemPrompt?.length || 0,
      maxHistory: this.maxHistory,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      openRouterModels: resolveOpenRouterModels(),
    };
  }
}

const aiConfigManager = new AIConfigManager();

module.exports = {
  aiConfigManager,
  resolveOpenRouterModelId,
  resolveOpenRouterModels,
  loadSystemPrompt,
  resolvePromptPath,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_PROMPT_PATH,
};
