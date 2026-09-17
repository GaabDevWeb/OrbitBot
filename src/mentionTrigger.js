/**
 * Gatilhos de activação Kernel no texto WhatsApp.
 *
 * Formas aceites:
 * - `@kernel` / `@Kernel` (digitado)
 * - `@~Kernel` (menção UI / push name, se configurado)
 * - `@\u2068~Kernel\u2069` (menção com isolates Unicode do WhatsApp)
 *
 * Menções nativas ao número/LID do bot continuam activas via groupHandler.
 */

/** Controlo bidi / isolates que o WhatsApp injeta em volta do nome na menção */
const FORMAT_CHARS_RE = /[\u200B-\u200D\u2060\u2066-\u2069\uFEFF\u200E\u200F]/g;

const KERNEL_TRIGGER_RE = /@~?kernel\b/i;
const KERNEL_TRIGGER_START_RE = /^@~?kernel\b/i;

/**
 * Remove marcas invisíveis de formatação Unicode (WhatsApp mention).
 * @param {string} text
 * @returns {string}
 */
function normalizeTriggerText(text) {
  return String(text || '').replace(FORMAT_CHARS_RE, '');
}

/**
 * True se o texto contém `@kernel` / `@~Kernel` (após normalizar Unicode).
 * @param {string} text
 */
function hasKernelTrigger(text) {
  return KERNEL_TRIGGER_RE.test(normalizeTriggerText(text));
}

/**
 * 1:1 — mensagem deve começar com o gatilho. Devolve corpo higienizado ou null.
 * @param {string} text
 * @returns {string|null}
 */
function matchTestTrigger(text) {
  const raw = normalizeTriggerText(text).trim();
  if (!KERNEL_TRIGGER_START_RE.test(raw)) return null;
  return raw.replace(KERNEL_TRIGGER_START_RE, '').trim();
}

/**
 * Remove gatilhos `@kernel` / `@~Kernel` do texto (grupos).
 * @param {string} text
 * @returns {string}
 */
function stripKernelTrigger(text) {
  return normalizeTriggerText(text)
    .replace(KERNEL_TRIGGER_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @deprecated use hasKernelTrigger */
const hasOrbitTrigger = hasKernelTrigger;

/** @deprecated use stripKernelTrigger */
const stripOrbitTrigger = stripKernelTrigger;

/** @deprecated use KERNEL_TRIGGER_RE */
const ORBIT_TRIGGER_RE = KERNEL_TRIGGER_RE;

/** @deprecated use KERNEL_TRIGGER_START_RE */
const ORBIT_TRIGGER_START_RE = KERNEL_TRIGGER_START_RE;

module.exports = {
  FORMAT_CHARS_RE,
  KERNEL_TRIGGER_RE,
  KERNEL_TRIGGER_START_RE,
  normalizeTriggerText,
  hasKernelTrigger,
  matchTestTrigger,
  stripKernelTrigger,
  hasOrbitTrigger,
  stripOrbitTrigger,
  ORBIT_TRIGGER_RE,
  ORBIT_TRIGGER_START_RE,
};
