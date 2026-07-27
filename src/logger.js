const pino = require('pino');

const root = pino({
  level: process.env.LOG_LEVEL || 'info',
});

function format(message, data) {
  if (data && typeof data === 'object' && Object.keys(data).length > 0) {
    return { msg: String(message), ...data };
  }
  return { msg: String(message) };
}

/** Facade compatível com call-sites existentes (info/error/debug/api/queue). */
const logger = {
  info: (message, data = {}) => root.info(format(message, data)),
  error: (message, data = {}) => root.error(format(message, data)),
  debug: (message, data = {}) => root.debug(format(message, data)),
  api: (message, data = {}) => root.info(format(message, { category: 'api', ...data })),
  queue: (message, data = {}) => root.info(format(message, { category: 'queue', ...data })),
  performance: (data = {}) => root.info({ msg: 'performance', ...data }),
  child: (opts) => root.child(opts),
  /** Logger silencioso para o motor Baileys */
  baileys: pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' }),
};

module.exports = logger;
