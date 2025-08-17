const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const EventEmitter = require('events');

// Emissor de eventos para painel em tempo real
const emitter = new EventEmitter();
function emitLog(level, category, message, data = {}) {
    try {
        emitter.emit('log', {
            ts: Date.now(),
            level,
            category,
            message,
            data
        });
    } catch (_) { /* noop */ }
}

const logger = {
    info: (message, data = {}) => {
        console.log('INFO:', message);
        if (Object.keys(data).length > 0) {
            console.log('Dados:', data);
        }
        emitLog('info', 'general', message, data);
    },

    error: (message, data = {}) => {
        console.log('ERRO:', message);
        if (Object.keys(data).length > 0) {
            console.log('Dados:', data);
        }
        emitLog('error', 'general', message, data);
    },

    debug: (message, data = {}) => {
        console.log('DEBUG:', message);
        if (Object.keys(data).length > 0) {
            console.log('Dados:', data);
        }
        emitLog('debug', 'general', message, data);
    },

    performance: (data) => {
        const {
            uptime,
            messageCount,
            errorCount,
            avgResponseTime,
            memory = {},
            memoryDiff = 0,
            cpu = {},
            cpuDiff = 0
        } = data;

        // Lê informações do banco de dados SQLite
        const dbPath = path.join(__dirname, '../database/data/orbitbot.db');
        
        let totalClientes = 0;
        let totalMensagens = 0;
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Erro ao conectar ao banco para métricas:', err.message);
                return;
            }

            db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM clientes) as totalClientes,
                    (SELECT COUNT(*) FROM historico) as totalMensagens
            `, (err, row) => {
                db.close();
                if (err) {
                    console.error('Erro ao ler dados do banco:', err.message);
                } else {
                    totalClientes = row.totalClientes;
                    totalMensagens = row.totalMensagens;
                }

                console.log('\n=== MÉTRICAS DE PERFORMANCE ===');
                console.log(`Tempo de execução: ${uptime} segundos`);
                console.log(`Total de mensagens: ${messageCount}`);
                console.log(`Tempo médio de resposta: ${avgResponseTime}ms`);
                console.log(`Erros: ${errorCount}`);
                console.log(`Uso de memória: ${memory.heapUsed}MB (${memoryDiff > 0 ? '+' : ''}${memoryDiff}MB)`);
                console.log(`CPU Load (1min): ${cpu['1min']} (${cpuDiff > 0 ? '+' : ''}${cpuDiff})`);
                
                console.log('\n=== DADOS DO BANCO ===');
                console.log(`Total de clientes: ${totalClientes}`);
                console.log(`Total de mensagens no histórico: ${totalMensagens}`);
                console.log('==============================\n');

                // Emite evento de métricas para o painel
                try {
                    emitter.emit('metrics', {
                        ts: Date.now(),
                        uptime,
                        messageCount,
                        errorCount,
                        avgResponseTime,
                        memory,
                        memoryDiff,
                        cpu,
                        cpuDiff,
                        totalClientes,
                        totalMensagens
                    });
                } catch (_) { /* noop */ }
            });
        });
    },

    api: (message, data = {}) => {
        console.log('API:', message);
        if (Object.keys(data).length > 0) {
            console.log('Dados:', data);
        }
        emitLog('info', 'api', message, data);
    },

    queue: (message, data = {}) => {
        console.log('FILA:', message);
        if (Object.keys(data).length > 0) {
            console.log('Dados:', data);
        }
        emitLog('info', 'queue', message, data);
    },

    // Utilitário para outros módulos emitirem eventos customizados (ex.: métricas)
    emitEvent: (type, payload = {}) => {
        try {
            emitter.emit(type, { ts: Date.now(), ...payload });
        } catch (_) { /* noop */ }
    },

    // Assinatura para o painel
    on: (event, listener) => emitter.on(event, listener),
    off: (event, listener) => emitter.off(event, listener)
};

module.exports = logger;