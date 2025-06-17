const os = require('os');
const logger = require('./logger');

class PerformanceMonitor {
    constructor() {
        this.startTime = Date.now();
        this.messageCount = 0;
        this.errorCount = 0;
        this.totalResponseTime = 0;
        this.metricsInterval = null;
    }

    start() {
        this.metricsInterval = setInterval(() => {
            this.logMetrics();
        }, 60000); // A cada 1 minuto
    }

    stop() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
    }

    addMessageResponseTime(responseTime) {
        this.messageCount++;
        this.totalResponseTime += responseTime;
    }

    addError() {
        this.errorCount++;
    }

    logMetrics() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const avgResponseTime = this.messageCount > 0 ? this.totalResponseTime / this.messageCount : 0;
        const memoryUsage = process.memoryUsage();
        const cpuLoad = os.loadavg()[0];

        logger.info('=== MÉTRICAS DE PERFORMANCE ===');
        logger.info(`Tempo de execução: ${uptime} segundos`);
        logger.info(`Total de mensagens: ${this.messageCount}`);
        logger.info(`Tempo médio de resposta: ${avgResponseTime.toFixed(2)}ms`);
        logger.info(`Erros: ${this.errorCount}`);
        logger.info(`Uso de memória: ${Math.floor(memoryUsage.heapUsed / 1024 / 1024)}MB (${Math.floor(memoryUsage.heapTotal / 1024 / 1024)}MB)`);
        logger.info(`CPU Load (1min): ${cpuLoad.toFixed(2)}`);
        logger.info('==============================');
    }
}

module.exports = new PerformanceMonitor(); 