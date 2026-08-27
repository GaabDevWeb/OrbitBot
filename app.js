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
const { gracefulShutdown } = require('./src/shutdown');

let _booted = false;

startBot()
  .then(() => {
    _booted = true;
  })
  .catch((err) => {
    console.error('Falha ao iniciar OrbitBot:', err);
    process.exit(1);
  });

async function onSignal(signal) {
  if (!_booted) {
    process.exit(0);
    return;
  }
  try {
    await gracefulShutdown(signal);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => onSignal('SIGTERM'));
process.on('SIGINT', () => onSignal('SIGINT'));
