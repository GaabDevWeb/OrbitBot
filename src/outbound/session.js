/** Sessão Baileys partilhada para envios proactivos (Communications). */

let _sock = null;
let _connectedAt = null;

function setSock(sock) {
  _sock = sock || null;
  _connectedAt = sock ? Date.now() : null;
}

function getSock() {
  return _sock;
}

function isReady() {
  return Boolean(_sock);
}

function status() {
  return {
    ready: isReady(),
    connectedAt: _connectedAt,
  };
}

module.exports = { setSock, getSock, isReady, status };
