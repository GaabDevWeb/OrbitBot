// Utilitário simples de cache com TTL e capacidade máxima (LRU FIFO)
const logger = require('../logger');

let TTL = 30 * 60 * 1000; // 30 min
let MAX_SIZE = 1000;
let CLEAN_INTERVAL_MS = 5 * 60 * 1000; // 5 min

const store = new Map();
let cleaner = null;

function startCleaner() {
  stopCleaner();
  cleaner = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now - value.timestamp > TTL) {
        store.delete(key);
      }
    }
  }, CLEAN_INTERVAL_MS);
}

function stopCleaner() {
  if (cleaner) {
    clearInterval(cleaner);
    cleaner = null;
  }
}

function configure({ ttl, maxSize, cleanIntervalMs } = {}) {
  if (typeof ttl === 'number') TTL = ttl;
  if (typeof maxSize === 'number') MAX_SIZE = maxSize;
  if (typeof cleanIntervalMs === 'number') CLEAN_INTERVAL_MS = cleanIntervalMs;
  startCleaner();
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value) {
  // Evict FIFO se exceder
  if (store.size >= MAX_SIZE) {
    const oldestKey = store.keys().next().value;
    store.delete(oldestKey);
  }
  store.set(key, { value, timestamp: Date.now() });
}

function clear() {
  const size = store.size;
  store.clear();
  logger.info('Cache limpo', { previousSize: size });
  return size;
}

function stats() {
  return { size: store.size, maxSize: MAX_SIZE, ttl: TTL };
}

// Inicializa limpador
startCleaner();

module.exports = {
  configure,
  get,
  set,
  clear,
  stats,
};
