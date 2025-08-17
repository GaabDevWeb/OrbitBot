const logger = require('../logger');

class CommandBus {
  constructor() {
    this.commands = new Map();
  }

  register(name, handler, help = null) {
    if (this.commands.has(name)) {
      logger.warn('Comando já registrado', { name });
      return false;
    }
    this.commands.set(name, { handler, help });
    return true;
  }

  list() {
    return Array.from(this.commands.keys());
  }

  async execute(rawText, ctx = {}) {
    if (!rawText || typeof rawText !== 'string') return 'Comando inválido';

    const parts = rawText.trim().split(/\s+/);
    const name = (parts.shift() || '').toLowerCase();

    if (!this.commands.has(name)) {
      return 'Comando inválido';
    }

    try {
      const { handler } = this.commands.get(name);
      const result = await handler(parts, ctx);
      return typeof result === 'string' ? result : String(result ?? '');
    } catch (error) {
      logger.error('Erro ao executar comando', { name, error: error.message });
      return '❌ Erro ao executar comando.';
    }
  }
}

module.exports = new CommandBus();
