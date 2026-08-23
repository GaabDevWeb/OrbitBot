/**
 * Guarda contra respostas meta/lixo do LLM (ex.: "User Safety: safe").
 * Evidência: Kernel devolveu isto como `answer` (traces.sqlite3).
 */

const META_SAFETY_LINE_RE = /^\s*(?:User|Response)\s+Safety\s*:\s*\w+\s*$/i;
const META_SAFETY_ONLY_RE =
  /^(?:\s*(?:User|Response)\s+Safety\s*:\s*\w+\s*)+$/i;

/**
 * Remove linhas só com etiquetas User/Response Safety.
 * @param {unknown} answer
 * @returns {string}
 */
function stripMetaSafetyLines(answer) {
  return String(answer || '')
    .split(/\r?\n/)
    .filter((line) => !META_SAFETY_LINE_RE.test(line))
    .join('\n')
    .trim();
}

/**
 * @param {unknown} answer
 * @returns {boolean} true se a resposta é só etiquetas de safety (não enviar ao WA)
 */
function isMetaSafetyAnswer(answer) {
  const text = String(answer || '').trim();
  if (!text) return false;
  if (META_SAFETY_ONLY_RE.test(text)) return true;
  // após strip, ficou vazio → era só meta
  return stripMetaSafetyLines(text).length === 0;
}

module.exports = {
  isMetaSafetyAnswer,
  stripMetaSafetyLines,
  META_SAFETY_ONLY_RE,
  META_SAFETY_LINE_RE,
};
