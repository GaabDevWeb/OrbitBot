// Utilitário de retry com backoff exponencial
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Executa uma operação com tentativas e backoff exponencial
 * @param {(attempt:number)=>Promise<any>} operation função a executar; recebe o índice da tentativa
 * @param {{
 *  retries?: number, // número máximo de tentativas
 *  baseDelayMs?: number, // atraso inicial
 *  factor?: number, // multiplicador por tentativa
 *  onError?: (err: Error, attempt: number) => void,
 *  shouldRetry?: (err: any, attempt: number) => boolean,
 * }} options
 */
async function execute(operation, options = {}) {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const factor = options.factor ?? 2;
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err;
      if (options.onError) options.onError(err, attempt);
      const tryAgain = attempt < retries - 1 && shouldRetry(err, attempt);
      if (tryAgain) {
        const delay = Math.pow(factor, attempt) * baseDelayMs;
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Todas as tentativas falharam');
}

module.exports = { execute };
