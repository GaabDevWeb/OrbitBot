/**
 * Trava de concorrência em memória por chave (JID/número).
 * Mensagens do mesmo utilizador são serializadas; JIDs distintas podem correr em paralelo.
 */
class UserLock {
  constructor() {
    /** @type {Map<string, Promise<void>>} */
    this.tails = new Map();
  }

  /**
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async runExclusive(key, fn) {
    const id = String(key || '');
    const prev = this.tails.get(id) || Promise.resolve();

    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });

    const tail = prev.then(() => gate, () => gate);
    this.tails.set(id, tail);

    await prev.catch(() => {});

    try {
      return await fn();
    } finally {
      release();
      if (this.tails.get(id) === tail) {
        this.tails.delete(id);
      }
    }
  }

  pendingCount() {
    return this.tails.size;
  }
}

const userLock = new UserLock();

module.exports = { UserLock, userLock };
