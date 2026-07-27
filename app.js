require('dotenv').config();

const { startBot } = require('./src/bot');

startBot().catch((err) => {
  console.error('Falha ao iniciar OrbitBot:', err);
  process.exit(1);
});
