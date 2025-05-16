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

const writeClientes = (data) => {
    try {
        fs.writeFileSync(clientesPath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Erro ao escrever clientes:', err);
    }
};

const writeHistorico = (data) => {
    try {
        fs.writeFileSync(historicoPath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Erro ao escrever histórico:', err);
    }
};

module.exports = { readClientes, readHistorico, writeClientes, writeHistorico };