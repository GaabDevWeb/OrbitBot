/**
 * Estado global de shutdown gracioso do OrbitBot.
 */

let _shuttingDown = false;
let _internalServer = null;
let _sock = null;

function isShuttingDown() {
  return _shuttingDown;
}

function setInternalServer(server) {
  _internalServer = server;
}

function setSock(sock) {
  _sock = sock;
}

function getSock() {
  return _sock;
}

async function gracefulShutdown(signal) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  const logger = require('../logger');
  logger.info('Shutdown gracioso iniciado', { signal });

  if (_internalServer) {
    await new Promise((resolve) => {
      _internalServer.close(() => resolve());
    });
  }

  const sock = _sock;
  if (sock && typeof sock.end === 'function') {
    try {
      sock.end(undefined);
    } catch (_) {
      /* noop */
    }
  }

  // Aguarda locks activos (timeout curto)
  const { userLock } = require('../concurrency');
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (typeof userLock.pendingCount === 'function' && userLock.pendingCount() === 0) {
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  logger.info('Shutdown gracioso concluído');
}

module.exports = {
  isShuttingDown,
  setInternalServer,
  setSock,
  getSock,
  gracefulShutdown,
};
