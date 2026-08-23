/**
 * MODO TESTE LOCAL — branch `refactor/test-trigger-mode`
 *
 * Isolado na entrada de mensagens. Para reverter: apagar este ficheiro
 * e restaurar o filtro `fromMe` + remover o require em `bot.js`.
 *
 * Aceita `@orbit` (escrito) e `@~Orbit` (menção WhatsApp / push name),
 * incluindo isolates Unicode `\u2068…\u2069` que o WA injeta na menção nativa.
 */

const {
  matchTestTrigger,
  ORBIT_TRIGGER_START_RE: TRIGGER_RE,
} = require('./mentionTrigger');

module.exports = { matchTestTrigger, TRIGGER_RE };
