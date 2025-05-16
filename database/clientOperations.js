const { readClientes, writeClientes } = require('./dbOperations');

const cadastrarCliente = (numero) => {
    const clientes = readClientes();
    const novoCliente = {
        id: clientes.length + 1,
        numero,
        created_at: new Date().toISOString()
    };
    clientes.push(novoCliente);
    writeClientes(clientes);
    return novoCliente;
};

const buscarCliente = (numero) => {
    const clientes = readClientes();
    return clientes.find(cliente => cliente.numero === numero);
};

module.exports = { cadastrarCliente, buscarCliente };