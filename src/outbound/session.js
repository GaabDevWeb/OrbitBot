/** Sessão Baileys partilhada para envios proactivos (Communications). */

let _sock = null;
let _connectedAt = null;
/** Identidade canónica (PN + LID) — creds.me pode ter LID antes de sock.user. */
let _me = null;

function setMe(me) {
  _me = me && typeof me === 'object' ? { ...me } : null;
}

function getMe() {
  return _me;
}

function setSock(sock, me = null) {
  _sock = sock || null;
  _connectedAt = sock ? Date.now() : null;
  if (me) setMe(me);
  else if (!sock) setMe(null);
}

function getSock() {
  return _sock;
}

function isReady() {
  return Boolean(_sock);
}

function status() {
  const me = _me || _sock?.user || null;
  return {
    ready: isReady(),
    connectedAt: _connectedAt,
    me_id: me?.id || null,
    me_lid: me?.lid || null,
    me_name: me?.name || null,
  };
}

module.exports = { setSock, getSock, getMe, setMe, isReady, status };
