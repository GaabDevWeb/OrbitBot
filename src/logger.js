const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const logger = {
    info: (message, data = {}) => {
        console.log('INFO:', message);
        if (Object.keys(data).length > 0) {
            console.log('Dados:', data);
        }
    },

    error: (message, data = {}) => {
        console.log('ERRO:', message);
        if (Object.keys(data).length > 0) {
            console.log('Dados:', data);
        }
    },

    debug: (message, data = {}) => {
        console.log('DEBUG:', message);
        if (Object.keys(data).length > 0) {
            console.log('Dados:', data);
        }
    },

    performance: (data) => {
        const {
            uptime,
            messageCount,
            errorCount,
            avgResponseTime,
            memory,
            memoryDiff,
            cpu,
            cpuDiff
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
            });
        });
    },

    api: (message, data = {}) => {
        console.log('API:', message);
        if (Object.keys(data).length > 0) {
            console.log('Dados:', data);
        }
    },

    queue: (message, data = {}) => {
        console.log('FILA:', message);
        if (Object.keys(data).length > 0) {
            console.log('Dados:', data);
        }
    }
};

module.exports = logger; 