/**
 * Gatilhos de activação Orbit no texto WhatsApp.
 *
 * Formas aceites:
 * - `@orbit` / `@Orbit` (digitado)
 * - `@~Orbit` (menção UI / push name)
 * - `@\u2068~Orbit\u2069` (menção com isolates Unicode do WhatsApp)
 */

/** Controlo bidi / isolates que o WhatsApp injeta em volta do nome na menção */
const FORMAT_CHARS_RE = /[\u200B-\u200D\u2060\u2066-\u2069\uFEFF\u200E\u200F]/g;

const ORBIT_TRIGGER_RE = /@~?orbit\b/i;
const ORBIT_TRIGGER_START_RE = /^@~?orbit\b/i;

/**
 * Remove marcas invisíveis de formatação Unicode (WhatsApp mention).
 * @param {string} text
 * @returns {string}
 */
function normalizeTriggerText(text) {
  return String(text || '').replace(FORMAT_CHARS_RE, '');
}

/**
 * True se o texto contém `@orbit` / `@~Orbit` (após normalizar Unicode).
 * @param {string} text
 */
function hasOrbitTrigger(text) {
  return ORBIT_TRIGGER_RE.test(normalizeTriggerText(text));
}

/**
 * 1:1 — mensagem deve começar com o gatilho. Devolve corpo higienizado ou null.
 * @param {string} text
 * @returns {string|null}
 */
function matchTestTrigger(text) {
  const raw = normalizeTriggerText(text).trim();
  if (!ORBIT_TRIGGER_START_RE.test(raw)) return null;
  return raw.replace(ORBIT_TRIGGER_START_RE, '').trim();
}

/**
 * Remove gatilhos `@orbit` / `@~Orbit` do texto (grupos).
 * @param {string} text
 * @returns {string}
 */
function stripOrbitTrigger(text) {
  return normalizeTriggerText(text)
    .replace(ORBIT_TRIGGER_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  FORMAT_CHARS_RE,
  ORBIT_TRIGGER_RE,
  ORBIT_TRIGGER_START_RE,
  normalizeTriggerText,
  hasOrbitTrigger,
  matchTestTrigger,
  stripOrbitTrigger,
};
