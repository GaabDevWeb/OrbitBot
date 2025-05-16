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