// Repositório de Histórico: encapsula acesso ao banco
const { atualizarHistorico, buscarHistorico, buscarUltimasMensagens } = require('../../database');

async function append(clienteId, role, mensagem) {
  // Ordem no DB: (clienteId, mensagem, role)
  await atualizarHistorico(clienteId, mensagem, role);
}

async function getPaged(identifier, page = 1) {
  return await buscarHistorico(identifier, page);
}

async function getRecent(identifier, limit = 50) {
  const messages = await buscarUltimasMensagens(identifier, limit);
  return { messages };
}

module.exports = {
  append,
  getPaged,
  getRecent,
};
