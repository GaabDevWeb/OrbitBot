require('dotenv').config();

// Libsignal/Baileys despeja "Closing session: SessionEntry { ... }" no stdout —
// ruído esperado, não é erro do OrbitBot. Filtramos para não esconder logs úteis.
const _consoleLog = console.log.bind(console);
const _consoleError = console.error.bind(console);

function shouldSilenceSessionNoise(args) {
  const first = args[0];
  const text =
    typeof first === 'string'
      ? first
      : first && typeof first === 'object' && first.constructor?.name === 'SessionEntry'
        ? 'SessionEntry'
        : String(first ?? '');
  return (
    text.includes('Closing session') ||
    text.includes('Closing open session') ||
    text.includes('SessionEntry') ||
    text.includes('Failed to decrypt message') ||
    text.includes('Bad MAC') ||
    text.includes('Session error:')
  );
}

console.log = (...args) => {
  if (shouldSilenceSessionNoise(args)) return;
  return _consoleLog(...args);
};
console.error = (...args) => {
  if (shouldSilenceSessionNoise(args)) return;
  return _consoleError(...args);
};

const { startBot } = require('./src/bot');

startBot().catch((err) => {
  console.error('Falha ao iniciar OrbitBot:', err);
  process.exit(1);
});
