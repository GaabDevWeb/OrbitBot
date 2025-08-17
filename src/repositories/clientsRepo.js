// Repositório de Clientes: encapsula acesso ao banco
const { cadastrarCliente, buscarCliente } = require('../../database');

async function getOrCreate(number) {
  let cliente = await buscarCliente(number);
  if (!cliente) {
    await cadastrarCliente(number);
    cliente = await buscarCliente(number);
  }
  return cliente;
}

module.exports = {
  getOrCreate,
  cadastrarCliente,
  buscarCliente,
};
