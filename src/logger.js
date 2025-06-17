const fs = require('fs');
const path = require('path');

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

        // Lê informações do banco de dados
        const clientesPath = path.join(__dirname, '../database/data/clientes.json');
        const historicoPath = path.join(__dirname, '../database/data/historico.json');
        
        let totalClientes = 0;
        let totalMensagens = 0;
        let clientesData = [];
        let historicoData = [];
        
        try {
            const clientes = JSON.parse(fs.readFileSync(clientesPath, 'utf-8'));
            const historico = JSON.parse(fs.readFileSync(historicoPath, 'utf-8'));
            totalClientes = clientes.length;
            totalMensagens = historico.length;
            clientesData = clientes;
            historicoData = historico;
        } catch (err) {
            console.error('Erro ao ler dados do banco:', err.message);
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
        console.log('\n Clientes:', clientesData);
        console.log('\n Histórico:', historicoData);
        console.log('==============================\n');
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