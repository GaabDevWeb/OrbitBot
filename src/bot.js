const path = require('path');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');

const logger = require('./logger');
const backupManager = require('./backup');
const { aiConfigManager } = require('./aiConfig');
const commandBus = require('./commands/commandBus');
const aiAdmin = require('./commands/admin/ai');
const dbAdmin = require('./commands/admin/db');
const backupAdmin = require('./commands/admin/backup');
const historyAdmin = require('./commands/admin/history');
const messageHandler = require('./core/messageHandler');
const {
  extractText,
  isPrivateChat,
  isAdmin,
  loadAdminNumbers,
} = require('./whatsappUtils');
// MODO TESTE (@orbit) — branch refactor/test-trigger-mode; fácil de remover
const { matchTestTrigger } = require('./testTrigger');
const { handleGroupMessage, isGroupJid } = require('./groups/groupHandler');

const AUTH_DIR = path.join(__dirname, '..', 'auth');

aiAdmin.register(commandBus, {
  aiConfigManager,
  getSystemStats: require('./openai').getSystemStats,
  clearCache: require('./openai').clearCache,
});
dbAdmin.register(commandBus);
backupAdmin.register(commandBus, { backupManager });
historyAdmin.register(commandBus);

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version;
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
  } catch (_) {
    version = undefined;
  }

  const sock = makeWASocket({
    auth: state,
    version,
    logger: logger.baileys,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('Escaneie o QR Code no WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      logger.info('Bot conectado ao WhatsApp (Baileys)');
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      logger.error('Conexão encerrada', { statusCode, loggedOut });
      if (!loggedOut) {
        logger.info('Reconectando…');
        setTimeout(() => {
          connectWhatsApp().catch((err) => {
            logger.error('Falha na reconexão', { error: err.message });
          });
        }, 2000);
      } else {
        logger.error('Sessão desconectada (loggedOut). Apague a pasta auth/ e escaneie o QR novamente.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      try {
        const jid = msg.key?.remoteJid;

        // ——— Grupos: processar em QUALQUER type de upsert (capturar todo o chat) ———
        if (isGroupJid(jid)) {
          await handleGroupMessage(sock, msg, type);
          continue;
        }

        // MODO TESTE 1:1: fromMe costuma chegar como append
        if (type !== 'notify' && type !== 'append') continue;
        if (!msg.message) continue;

        if (!isPrivateChat(jid)) {
          logger.debug('Ignorada (não é chat 1:1 nem grupo)', {
            type,
            jid,
            fromMe: msg.key.fromMe,
          });
          continue;
        }

        const rawBody = extractText(msg).trim();
        // MODO TESTE 1:1: só processa se começar com @orbit (case-insensitive)
        const body = matchTestTrigger(rawBody);
        if (body === null) {
          if (msg.key.fromMe && rawBody) {
            logger.debug('Ignorada (sem @orbit)', { type, jid, rawBody });
          }
          continue;
        }
        if (!body) continue;

        logger.info('Nova mensagem recebida (modo @orbit)', {
          type,
          from: jid,
          fromMe: Boolean(msg.key.fromMe),
          body,
        });

        if (body.startsWith('/') && isAdmin(jid)) {
          const response = await commandBus.execute(body.slice(1), { from: jid });
          await sock.sendMessage(jid, { text: String(response ?? '') });
          continue;
        }

        const resposta = await messageHandler.run(jid, body);
        if (!resposta) {
          await sock.sendMessage(jid, {
            text: 'Erro ao processar mensagem. Tente novamente.',
          });
          continue;
        }

        await sock.sendMessage(jid, { text: String(resposta) });
      } catch (err) {
        logger.error('Erro no processamento de mensagem', {
          error: err.message,
          stack: err.stack,
        });
        try {
          const jid = msg?.key?.remoteJid;
          if (jid && (isPrivateChat(jid) || isGroupJid(jid))) {
            await sock.sendMessage(jid, {
              text: 'Estou tendo dificuldades técnicas. Por favor, tente novamente.',
            });
          }
        } catch (_) {
          /* noop */
        }
      }
    }
  });

  return sock;
}

async function startBot() {
  logger.info('Iniciando OrbitBot (Baileys) — MODO TESTE @orbit activo');
  await aiConfigManager.hydrate();

  if (!process.env.OPENROUTER_API_KEY) {
    logger.error('OPENROUTER_API_KEY ausente — defina no .env');
  }
  if (!process.env.ADMIN_NUMBERS) {
    logger.error('ADMIN_NUMBERS ausente — nenhum admin poderá usar comandos /');
  }

  await connectWhatsApp();
  logger.info('Bot pronto para mensagens 1:1 e grupos (@orbit / menção)');
}

module.exports = { startBot };
