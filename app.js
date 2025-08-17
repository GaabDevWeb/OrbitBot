const { startBot } = require('./src/bot');
const { startDashboardServer } = require('./src/dashboard');

// Inicia painel antes do bot
startDashboardServer(3000);
startBot();