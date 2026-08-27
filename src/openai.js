require('dotenv').config();
const logger = require('./logger');
const { aiConfigManager } = require('./aiConfig');
const kernelProvider = require('./providers/kernelProvider');
const {
  parseKernelResetCommand,
  resolveChannelContext,
} = require('./kernelContext');
const { isMetaSafetyAnswer, stripMetaSafetyLines } = require('./answerGuard');

/**
 * Cache-key helpers mantidos para testes/legado OpenRouter (não usados no caminho Kernel).
 */
function generateCacheKey(historico, userMessage, config, userId, models = []) {
  const histLen = Array.isArray(historico)
    ? historico.length
    : Array.isArray(historico?.messages)
      ? historico.messages.length
      : 0;
  const uid = userId == null ? 'anon' : String(userId);
  const modelsKey =
    Array.isArray(models) && models.length ? models.join(',') : config.model?.name || '';
  const promptSig = String(config.systemPrompt || '').slice(0, 64);
  return `${uid}|${userMessage}|${histLen}|${promptSig}|${modelsKey}`;
}

/**
 * Normaliza answer do Kernel: remove linhas meta/safety.
 * @param {string} answer
 * @returns {string|null} texto útil ou null se só meta
 */
function normalizeKernelAnswer(answer) {
  const cleaned = stripMetaSafetyLines(answer);
  if (!cleaned || isMetaSafetyAnswer(cleaned)) return null;
  return cleaned;
}

/**
 * Gera resposta via Kernel (POST /v1/chat).
 * `historico` é ignorado — SSOT do transcript é o Kernel (grill-me Orbit Q2).
 *
 * Se o Kernel devolver só "User Safety: safe", faz **uma** retentativa com
 * `reset_context` (histórico envenenado é a causa habitual).
 *
 * @param {object} _historico ignorado
 * @param {string} userMessage texto já sem @orbit
 * @param {string|{ userId: string, channelId: string, traceId?: string, resetHint?: boolean, resetContext?: boolean }} sessionRef
 * @returns {Promise<string>}
 */
async function handleMessage(_historico, userMessage, sessionRef = null) {
  const { userId, channelId, resetHint } = resolveChannelContext(sessionRef);
  const parsed = parseKernelResetCommand(userMessage);
  const resetContext = resetHint || parsed.resetContext;

  const invocation =
    sessionRef && typeof sessionRef === 'object' ? sessionRef.invocation : null;
  const isContextualInvocation =
    invocation?.type === 'contextual_invocation' && !parsed.resetContext;

  let text;
  if (resetHint) {
    text = String(userMessage || '').trim() || 'olá';
  } else if (isContextualInvocation) {
    text = '';
  } else {
    text = parsed.text;
  }

  if (!text && !isContextualInvocation) {
    throw new Error('Mensagem vazia após parse');
  }

  const traceId =
    (sessionRef && typeof sessionRef === 'object' && sessionRef.traceId) || null;

  const metadata = {};
  if (invocation) {
    metadata.invocation = {
      type: invocation.type,
      explicit_text: Boolean(invocation.explicit_text),
    };
  }
  if (sessionRef?.senderName) {
    metadata.sender_name = String(sessionRef.senderName);
  }
  if (Array.isArray(sessionRef?.recentContext) && sessionRef.recentContext.length) {
    metadata.recent_context = sessionRef.recentContext.map((m) => {
      const sender = String(m.sender || 'membro');
      const text = String(m.text || '');
      const prefix = m.is_bot ?? m.isBot ? 'OrbitBot' : sender;
      return `${prefix}: ${text}`;
    });
  }
  if (sessionRef?.quoted) {
    metadata.quoted_context = String(sessionRef.quoted);
  }

  const baseUrl = kernelProvider.resolveKernelBaseUrl();

  async function callKernel(reset) {
    logger.api('Kernel request', {
      url: `${baseUrl}/v1/chat`,
      platform: 'whatsapp',
      userId,
      channelId,
      resetContext: reset,
      chars: text.length,
      traceId: traceId || undefined,
    });

    const answer = await kernelProvider.chat({
      baseUrl,
      userId,
      channelId,
      message: text,
      resetContext: reset,
      platform: 'whatsapp',
      traceId,
      messageId:
        sessionRef && typeof sessionRef === 'object' ? sessionRef.messageId || null : null,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    });

    logger.api('Kernel OK', {
      userId,
      channelId,
      resetContext: reset,
      chars: String(answer).length,
      traceId: traceId || undefined,
    });

    return answer;
  }

  try {
    let answer = await callKernel(resetContext);
    let useful = normalizeKernelAnswer(answer);

    // Meta-safety: retry 1x com reset (limpa transcript envenenado no Kernel)
    if (!useful && !resetContext) {
      logger.error('Kernel devolveu resposta meta/safety — retry com reset_context', {
        userId,
        channelId,
        preview: String(answer).slice(0, 80),
        traceId: traceId || undefined,
      });
      answer = await callKernel(true);
      useful = normalizeKernelAnswer(answer);
    }

    if (!useful) {
      logger.error('Kernel devolveu resposta meta/safety — a rejeitar', {
        userId,
        channelId,
        preview: String(answer).slice(0, 80),
        traceId: traceId || undefined,
      });
      const err = new Error(
        'Resposta inválida do Kernel (meta safety). Tenta de novo ou @orbit /nova.'
      );
      err.code = 'KERNEL_META_SAFETY';
      throw err;
    }

    return useful;
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      logger.error('Kernel timeout', {
        userId,
        channelId,
        message: error.message,
      });
    } else if (error.code === 'KERNEL_HTTP_ERROR') {
      logger.error('Kernel HTTP error', {
        userId,
        channelId,
        status: error.response?.status,
        message: error.message,
      });
    } else if (error.code === 'KERNEL_VALIDATION') {
      logger.error('Kernel validation error', {
        userId,
        channelId,
        message: error.message,
      });
    } else if (error.code === 'KERNEL_META_SAFETY') {
      // já logado acima
    } else {
      logger.error('Kernel error', {
        userId,
        channelId,
        message: error.message,
        code: error.code,
      });
    }
    throw error;
  }
}

function getSystemStats() {
  return {
    ai: aiConfigManager.getStats(),
    provider: 'kernel',
    kernelUrl: kernelProvider.resolveKernelBaseUrl(),
  };
}

function clearCache() {
  // Caminho Kernel não usa cache de respostas; no-op compatível com admin /ai
  return { cleared: true, provider: 'kernel' };
}

module.exports = {
  handleMessage,
  getSystemStats,
  clearCache,
  generateCacheKey,
  normalizeKernelAnswer,
};
