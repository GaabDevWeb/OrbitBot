const fs = require('fs');
const path = require('path');

const clientesPath = path.join(__dirname, 'data/clientes.json');
const historicoPath = path.join(__dirname, 'data/historico.json');

// Inicializa os arquivos JSON se não existirem
if (!fs.existsSync(clientesPath)) {
    fs.writeFileSync(clientesPath, '[]');
}

if (!fs.existsSync(historicoPath)) {
    fs.writeFileSync(historicoPath, '[]');
}

// Cache em memória com LRU
class LRUCache {
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.lastAccess = new Map();
    }

    get(key) {
        if (this.cache.has(key)) {
            this.lastAccess.set(key, Date.now());
            return this.cache.get(key);
        }
        return null;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            // Remove o item menos acessado
            const oldestKey = Array.from(this.lastAccess.entries())
                .sort((a, b) => a[1] - b[1])[0][0];
            this.cache.delete(oldestKey);
            this.lastAccess.delete(oldestKey);
        }
        this.cache.set(key, value);
        this.lastAccess.set(key, Date.now());
    }

    clear() {
        this.cache.clear();
        this.lastAccess.clear();
    }
}

const clientesCache = new LRUCache();
const historicoCache = new LRUCache();
const CACHE_TTL = 30000; // 30 segundos

const readClientes = () => {
    try {
        const data = fs.readFileSync(clientesPath, 'utf-8');
        const clientes = data ? JSON.parse(data) : [];
        clientesCache.set('all', clientes);
        return clientes;
    } catch (err) {
        console.error('Erro ao ler clientes:', err);
        return [];
    }
};

const readHistorico = () => {
    try {
        const data = fs.readFileSync(historicoPath, 'utf-8');
        const historico = data ? JSON.parse(data) : [];
        historicoCache.set('all', historico);
        return historico;
    } catch (err) {
        console.error('Erro ao ler histórico:', err);
        return [];
    }
};

const writeClientes = (data) => {
    try {
        fs.writeFileSync(clientesPath, JSON.stringify(data, null, 2));
        clientesCache.set('all', data);
    } catch (err) {
        console.error('Erro ao escrever clientes:', err);
    }
};

const writeHistorico = (data) => {
    try {
        // Limita o tamanho do histórico se necessário
        if (data.length > 1000) {
            data = data.slice(-1000);
        }
        fs.writeFileSync(historicoPath, JSON.stringify(data, null, 2));
        historicoCache.set('all', data);
    } catch (err) {
        console.error('Erro ao escrever histórico:', err);
    }
};

// Limpa o cache periodicamente
setInterval(() => {
    clientesCache.clear();
    historicoCache.clear();
}, CACHE_TTL);

const resetDatabase = () => {
    try {
        // Limpa os arquivos JSON
        fs.writeFileSync(clientesPath, '[]');
        fs.writeFileSync(historicoPath, '[]');
        
        // Limpa os caches
        clientesCache.clear();
        historicoCache.clear();
        
        return true;
    } catch (err) {
        console.error('Erro ao resetar banco de dados:', err);
        return false;
    }
};

module.exports = { 
    readClientes, 
    readHistorico, 
    writeClientes, 
    writeHistorico,
    resetDatabase 
};