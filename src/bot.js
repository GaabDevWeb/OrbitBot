const path = require('path');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
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
const { markdownToWhatsapp } = require('./utils/whatsappFormatter');
const { claimMessageKey } = require('./messageDedupe');
// MODO TESTE (@orbit) — branch refactor/test-trigger-mode; fácil de remover
const { matchTestTrigger } = require('./testTrigger');
const { handleGroupMessage, isGroupJid } = require('./groups/groupHandler');
const { isKernelContextResetCommand } = require('./kernelContext');
const { newTraceId, emitTraceEvent } = require('./traceClient');
const { setSock } = require('./outbound/session');
const { setSock: registerShutdownSock, isShuttingDown } = require('./shutdown');
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
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger.baileys),
    },
    version,
    logger: logger.baileys,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined,
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
      setSock(sock);
      registerShutdownSock(sock);
    }

    if (connection === 'close') {
      setSock(null);
      registerShutdownSock(null);
      if (isShuttingDown()) {
        logger.info('Conexão fechada durante shutdown — sem reconexão');
        return;
      }
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
    // Diagnóstico: provar se o Baileys está a entregar eventos (remover após debug)
    logger.info('messages.upsert', {
      type,
      count: Array.isArray(messages) ? messages.length : 0,
      sample: (messages || []).slice(0, 5).map((m) => ({
        jid: m?.key?.remoteJid,
        fromMe: Boolean(m?.key?.fromMe),
        hasMessage: Boolean(m?.message),
        msgId: m?.key?.id,
        preview: extractText(m).trim().slice(0, 60),
      })),
    });

    for (const msg of messages) {
      try {
        const jid = msg.key?.remoteJid;

        // ——— Grupos: processar em QUALQUER type de upsert (capturar todo o chat) ———
        if (isGroupJid(jid)) {
          await handleGroupMessage(sock, msg, type);
          continue;
        }

        // MODO TESTE 1:1: fromMe costuma chegar como append
        if (type !== 'notify' && type !== 'append') {
          logger.info('1:1: upsert type ignorado', {
            type,
            jid,
            fromMe: Boolean(msg.key?.fromMe),
            preview: extractText(msg).trim().slice(0, 60),
          });
          continue;
        }
        if (!msg.message) {
          logger.info('1:1: mensagem sem conteúdo (possível falha de decrypt)', {
            type,
            jid,
            fromMe: Boolean(msg.key?.fromMe),
            msgId: msg.key?.id,
          });
          continue;
        }

        if (!isPrivateChat(jid)) {
          logger.info('Ignorada (não é chat 1:1 nem grupo)', {
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
          logger.info('Ignorada (sem @orbit)', {
            type,
            jid,
            fromMe: Boolean(msg.key?.fromMe),
            rawBody: rawBody.slice(0, 80),
          });
          continue;
        }
        if (!body) continue;

        if (!claimMessageKey(msg.key)) {
          logger.info('1:1: mensagem duplicada ignorada', { jid, msgId: msg.key?.id });
          continue;
        }

        const traceId = newTraceId();
        emitTraceEvent({
          traceId,
          stage: 'MESSAGE_RECEIVED',
          data: {
            type,
            jid,
            fromMe: Boolean(msg.key.fromMe),
            chars: body.length,
            channel: '1:1',
          },
        });

        logger.info('Nova mensagem recebida (modo @orbit)', {
          type,
          from: jid,
          fromMe: Boolean(msg.key.fromMe),
          body,
          traceId,
        });

        // Admin commands: excepto /reset e /nova (contexto Kernel — não confundir com /reset confirmar)
        if (
          body.startsWith('/') &&
          isAdmin(jid) &&
          !isKernelContextResetCommand(body)
        ) {
          const response = await commandBus.execute(body.slice(1), { from: jid });
          await sock.sendMessage(jid, { text: String(response ?? '') });
          continue;
        }

        const resposta = await messageHandler.run(jid, body, {
          traceId,
          messageId: msg.key?.id || null,
        });
        if (!resposta) {
          emitTraceEvent({
            traceId,
            stage: 'ERROR',
            data: { reason: 'empty_response', channel: '1:1' },
          });
          await sock.sendMessage(jid, {
            text: 'Erro ao processar mensagem. Tente novamente.',
          });
          continue;
        }

        const waText = markdownToWhatsapp(String(resposta));
        logger.info('1:1: a enviar resposta', { jid, chars: waText.length, traceId });
        await sock.sendMessage(jid, { text: waText });
        emitTraceEvent({
          traceId,
          stage: 'MESSAGE_SENT_TO_WHATSAPP',
          data: { jid, chars: waText.length, channel: '1:1' },
        });
        logger.info('1:1: resposta enviada', { jid, traceId });
      } catch (err) {
        logger.error('Erro no processamento de mensagem', {
          error: err.message,
          stack: err.stack,
          code: err.code || null,
        });
        try {
          const jid = msg?.key?.remoteJid;
          if (jid && (isPrivateChat(jid) || isGroupJid(jid))) {
            const text =
              err.code === 'KERNEL_META_SAFETY'
                ? 'Não consegui gerar uma resposta útil agora. Tenta outra vez (ou @orbit /nova).'
                : 'Estou tendo dificuldades técnicas. Por favor, tente novamente.';
            await sock.sendMessage(jid, { text });
          }
        } catch (_) {
          /* noop */
        }
      }
    }
  });

  return sock;
}

const { startInternalHttpServer } = require('./outbound/internalHttp');
const { setInternalServer } = require('./shutdown');

async function startBot() {
  logger.info('Iniciando OrbitBot (Baileys) — MODO TESTE @orbit activo');
  await aiConfigManager.hydrate();

  const kernelUrl = process.env.KERNEL_API_URL || 'http://127.0.0.1:8001';
  logger.info('Provider IA: Kernel', {
    kernelUrl,
    hasToken: Boolean(
      (process.env.KERNEL_API_TOKEN || process.env.ACL_API_BEARER_TOKEN || '').trim()
    ),
  });
  if (!process.env.ADMIN_NUMBERS) {
    logger.error('ADMIN_NUMBERS ausente — nenhum admin poderá usar comandos /');
  }

  const server = startInternalHttpServer();
  setInternalServer(server);
  await connectWhatsApp();
  logger.info('Bot pronto para mensagens 1:1 e grupos (@orbit / menção)');
}

module.exports = { startBot };
