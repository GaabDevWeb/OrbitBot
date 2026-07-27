const db = require('./db');

module.exports = {
  getOrCreateClient: db.getOrCreateClient,
  appendHistory: db.appendHistory,
  getRecentHistory: db.getRecentHistory,
  getPagedHistory: db.getPagedHistory,
  getConfig: db.getConfig,
  setConfig: db.setConfig,
  resetAllData: db.resetAllData,
  // aliases legados
  cadastrarCliente: db.cadastrarCliente,
  buscarCliente: db.buscarCliente,
  atualizarHistorico: db.adicionarMensagem,
  buscarHistorico: db.buscarHistorico,
  buscarUltimasMensagens: db.buscarUltimasMensagens,
};
