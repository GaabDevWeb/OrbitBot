const { cadastrarCliente, buscarCliente } = require('./clientOperations');
const { atualizarHistorico, buscarHistorico } = require('./historyOperations');

module.exports = {
    cadastrarCliente,
    buscarCliente,
    atualizarHistorico,
    buscarHistorico
};