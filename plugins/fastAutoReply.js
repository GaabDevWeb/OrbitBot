// Plugin de auto-resposta rápida (fast-path)
// Evita chamada à IA para mensagens simples (saudações, confirmações, curtas)

const fastAutoReply = {
  name: 'fastAutoReply',
  version: '1.0.0',
  description: 'Responde imediatamente mensagens simples sem acionar o provedor de IA',

  hooks: {
    beforeMessage: async (data) => {
      try {
        const text = String(data.message || '').trim().toLowerCase();
        if (!text) return data;

        // Heurísticas
        const isOnlyEmoji = /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}\p{Extended_Pictographic}\s]+$/u.test(text);
        const isShort = text.length <= 3; // "ok", "kk", "?"
        const greetings = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'e aí', 'eaí'];
        const confirms = ['ok', 'blz', 'beleza', 'valeu', 'vlw', 'tá', 'ta', 'tmj'];

        const isGreeting = greetings.some((g) => text === g || text.startsWith(g + ' '));
        const isConfirm = confirms.includes(text);
        const isQuestionMark = text === '?' || text === '??';

        if (isOnlyEmoji || isShort || isGreeting || isConfirm || isQuestionMark) {
          const reply = buildQuickReply({ isGreeting, isConfirm, isOnlyEmoji, isQuestionMark });
          return { ...data, autoResponse: reply };
        }
      } catch (err) {
        // não bloqueia fluxo
      }
      return data;
    },
  },
};

function buildQuickReply(flags) {
  if (flags.isGreeting) return 'Fala! Em que posso te ajudar?';
  if (flags.isConfirm) return 'Fechou.';
  if (flags.isQuestionMark) return 'Manda a dúvida.';
  if (flags.isOnlyEmoji) return '👀';
  return 'Diga.';
}

module.exports = fastAutoReply;
