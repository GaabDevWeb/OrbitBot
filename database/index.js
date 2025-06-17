const dbOperations = require('./db');

module.exports = {
    cadastrarCliente: dbOperations.cadastrarCliente,
    buscarCliente: dbOperations.buscarCliente,
    atualizarHistorico: dbOperations.adicionarMensagem,
    buscarHistorico: dbOperations.buscarHistorico,
    buscarUltimasMensagens: dbOperations.buscarUltimasMensagens
};