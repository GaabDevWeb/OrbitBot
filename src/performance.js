const os = require('os');
const logger = require('./logger');

class PerformanceMonitor {
    constructor() {
        this.startTime = Date.now();
        this.messageCount = 0;
        this.errorCount = 0;
        this.totalResponseTime = 0;
        this.metricsInterval = null;

        this.prevMemoryMB = 0;
        this.prevCpu1Min = 0;
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

        const mu = process.memoryUsage();
        const memory = {
            heapUsed: Math.floor(mu.heapUsed / 1024 / 1024),
            heapTotal: Math.floor(mu.heapTotal / 1024 / 1024)
        };
        const cpu1 = os.loadavg()[0] || 0;
        const cpu = { '1min': Number(cpu1.toFixed ? cpu1.toFixed(2) : cpu1) };

        const memoryDiff = memory.heapUsed - this.prevMemoryMB;
        const cpuDiff = cpu['1min'] - this.prevCpu1Min;

        this.prevMemoryMB = memory.heapUsed;
        this.prevCpu1Min = cpu['1min'];

        // Emite métricas estruturadas (o logger também imprime no console e emite para o painel)
        logger.performance({
            uptime,
            messageCount: this.messageCount,
            errorCount: this.errorCount,
            avgResponseTime,
            memory,
            memoryDiff,
            cpu,
            cpuDiff
        });
    }
}

module.exports = new PerformanceMonitor();