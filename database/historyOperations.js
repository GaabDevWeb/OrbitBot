const { readHistorico, writeHistorico } = require('./dbOperations');

const MAX_HISTORY_LENGTH = 50; // Limita o histórico às últimas 50 mensagens
const PAGE_SIZE = 10; // Número de mensagens por página

function sanitizeMessage(message) {
    if (typeof message === 'string') return message;
    if (message === null || message === undefined) return '';
    if (typeof message === 'object') {
        try {
            if (message.type === 'Buffer') {
                return Buffer.from(message.data).toString('utf-8');
            }
            if (message.content) {
                return message.content;
            }
            return JSON.stringify(message);
        } catch (err) {
            return String(message);
        }
    }
    return String(message);
}

const atualizarHistorico = (cliente_id, mensagem, role) => {
    try {
        const historico = readHistorico();
        const mensagemSanitizada = sanitizeMessage(mensagem);
        
        if (!mensagemSanitizada) {
            console.warn('Mensagem vazia ignorada');
            return false;
        }

        const novoItem = {
            cliente_id,
            mensagem: mensagemSanitizada,
            role,
            created_at: new Date().toISOString()
        };
        
        // Filtra histórico do cliente e adiciona nova mensagem
        const historicoCliente = historico
            .filter(item => item.cliente_id === cliente_id)
            .slice(-MAX_HISTORY_LENGTH + 1);
        
        historicoCliente.push(novoItem);
        
        // Atualiza o histórico completo
        const historicoAtualizado = historico
            .filter(item => item.cliente_id !== cliente_id)
            .concat(historicoCliente);
        
        writeHistorico(historicoAtualizado);
        return true;
    } catch (err) {
        console.error('Erro ao atualizar histórico:', err);
        return false;
    }
};

const buscarHistorico = (cliente_id, page = 1) => {
    try {
        const historico = readHistorico();
        const historicoCliente = historico
            .filter(item => item.cliente_id === cliente_id)
            .slice(-MAX_HISTORY_LENGTH);

        // Calcula o total de páginas
        const totalPages = Math.ceil(historicoCliente.length / PAGE_SIZE);
        
        // Ajusta a página para o intervalo válido
        const currentPage = Math.min(Math.max(1, page), totalPages);
        
        // Calcula o índice inicial e final para a página atual
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;
        
        // Retorna as mensagens da página atual e metadados
        return {
            messages: historicoCliente
                .slice(startIndex, endIndex)
                .map(item => ({
                    ...item,
                    mensagem: sanitizeMessage(item.mensagem)
                })),
            pagination: {
                currentPage,
                totalPages,
                totalMessages: historicoCliente.length,
                hasNextPage: currentPage < totalPages,
                hasPreviousPage: currentPage > 1
            }
        };
    } catch (err) {
        console.error('Erro ao buscar histórico:', err);
        return null;
    }
};

// Função para buscar apenas as últimas N mensagens
const buscarUltimasMensagens = (cliente_id, limit = 5) => {
    try {
        const historico = readHistorico();
        return historico
            .filter(item => item.cliente_id === cliente_id)
            .slice(-limit)
            .map(item => ({
                ...item,
                mensagem: sanitizeMessage(item.mensagem)
            }));
    } catch (err) {
        console.error('Erro ao buscar últimas mensagens:', err);
        return null;
    }
};

module.exports = { 
    atualizarHistorico, 
    buscarHistorico,
    buscarUltimasMensagens
};