const { readHistorico, writeHistorico } = require('./dbOperations');

const atualizarHistorico = (cliente_id, mensagem, role) => {
    const historico = readHistorico();
    historico.push({
        cliente_id,
        mensagem,
        role,
        created_at: new Date().toISOString()
    });
    writeHistorico(historico);
};

const buscarHistorico = (cliente_id) => {
    const historico = readHistorico();
    return historico.filter(item => item.cliente_id === cliente_id);
};

module.exports = { atualizarHistorico, buscarHistorico };