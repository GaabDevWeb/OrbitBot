/**
 * Sessão Baileys reutilizando auth/ do Orbit — sem QR/login novo.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

const DEFAULT_AUTH = path.join(__dirname, '..', '..', 'auth');

/**
 * @param {{ authDir?: string, timeoutMs?: number, maxAttempts?: number }} opts
 * @returns {Promise<{ sock: import('@whiskeysockets/baileys').WASocket, authDir: string, close: () => Promise<void> }>}
 */
async function connectExistingSession(opts = {}) {
  const authDir = path.resolve(opts.authDir || process.env.ORBIT_AUTH_DIR || DEFAULT_AUTH);
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const maxAttempts = opts.maxAttempts ?? 4;

  if (!fs.existsSync(path.join(authDir, 'creds.json'))) {
    throw new Error(
      `[EXPORT] Sessão não encontrada em ${authDir}/creds.json. ` +
        'Inicie o Orbit uma vez (npm start) e escaneie o QR antes de exportar.'
    );
  }

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await connectOnce(authDir, timeoutMs);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const retryable =
        msg.includes('status 428') ||
        msg.includes('status 408') ||
        msg.includes('status 515') ||
        msg.includes('Timeout');
      if (!retryable || attempt === maxAttempts) break;
      const wait = 2000 * attempt;
      console.log(`[EXPORT] Reconectar (${attempt}/${maxAttempts}) em ${wait}ms… (${msg})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function connectOnce(authDir, timeoutMs) {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  if (!state.creds?.me?.id) {
    throw new Error(
      '[EXPORT] Credenciais incompletas (sem me.id). Sessão inválida — não será gerado QR aqui.'
    );
  }

  let version;
  try {
    version = (await fetchLatestBaileysVersion()).version;
  } catch (_) {
    version = undefined;
  }

  const silent = pino({ level: 'silent' });

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silent),
    },
    version,
    logger: silent,
    printQRInTerminal: false,
    // syncFullHistory:true pode fechar a sessão (428) em alguns linked devices —
    // histórico vem de fetchMessageHistory on-demand.
    syncFullHistory: false,
    markOnlineOnConnect: false,
    browser: Browsers.macOS('Desktop'),
    getMessage: async () => undefined,
  });

  sock.ev.on('creds.update', saveCreds);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      try {
        sock.end(undefined);
      } catch (_) {
        /* noop */
      }
      reject(
        new Error(
          '[EXPORT] Timeout à espera de ligação WhatsApp. ' +
            'Pare o Orbit (npm start) se estiver a usar a mesma pasta auth/.'
        )
      );
    }, timeoutMs);

    const onUpdate = (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        cleanup();
        reject(
          new Error(
            '[EXPORT] WhatsApp pediu QR — sessão auth/ não está autenticada. ' +
              'Não implementamos login nesta ferramenta. Corra npm start e autentique primeiro.'
          )
        );
        return;
      }

      if (connection === 'open') {
        cleanup();
        resolve();
        return;
      }

      if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const replaced = statusCode === DisconnectReason.connectionReplaced;
        cleanup();
        try {
          sock.end(undefined);
        } catch (_) {
          /* noop */
        }
        reject(
          new Error(
            loggedOut
              ? '[EXPORT] Sessão desligada (loggedOut). Apague auth/ e reautentique via Orbit.'
              : replaced
                ? '[EXPORT] Ligação substituída (440). Outro cliente Baileys está a usar auth/ — pare o Orbit.'
                : `[EXPORT] Ligação encerrada (status ${statusCode}). Pare o bot se partilhar auth/.`
          )
        );
      }
    };

    function cleanup() {
      clearTimeout(timer);
      sock.ev.off('connection.update', onUpdate);
    }

    sock.ev.on('connection.update', onUpdate);
  });

  async function close() {
    try {
      sock.end(undefined);
    } catch (_) {
      /* noop */
    }
  }

  return { sock, authDir, close };
}

module.exports = {
  connectExistingSession,
  DEFAULT_AUTH,
};
