const fs = require('fs');
const path = require('path');

const clientesPath = path.join(__dirname, 'data/clientes.json');
const historicoPath = path.join(__dirname, 'data/historico.json');

const readClientes = () => {
    try {
        return JSON.parse(fs.readFileSync(clientesPath, 'utf-8')) || [];
    } catch (err) {
        console.error('Erro ao ler clientes:', err);
        return [];
    }
};

const readHistorico = () => {
    try {
        return JSON.parse(fs.readFileSync(historicoPath, 'utf-8')) || [];
    } catch (err) {
        console.error('Erro ao ler histórico:', err);
        return [];
    }
};