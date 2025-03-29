const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ clientes: [], historico: [] }, null, 2));
}

const readDB = () => {
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch (err) {
        console.error('Erro ao ler banco de dados:', err);
        return { clientes: [], historico: [] };
    }
};

const writeDB = (data) => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Erro ao escrever no banco de dados:', err);
    }
};

const cadastrarCliente = (numero) => {
    const db = readDB();
    const novoCliente = {
        id: db.clientes.length + 1,
        numero,
        created_at: new Date().toISOString()
    };
    db.clientes.push(novoCliente);
    writeDB(db);
    return novoCliente;
};

const buscarCliente = (numero) => {
    const db = readDB();
    return db.clientes.find(cliente => cliente.numero === numero);
};

const atualizarHistorico = (cliente_id, mensagem, role) => {
    const db = readDB();
    db.historico.push({
        cliente_id,
        mensagem,
        role,
        created_at: new Date().toISOString()
    });
    writeDB(db);
};

const buscarHistorico = (cliente_id) => {
    const db = readDB();
    return db.historico.filter(item => item.cliente_id === cliente_id);
};

module.exports = {
    cadastrarCliente,
    buscarCliente,
    atualizarHistorico,
    buscarHistorico
};