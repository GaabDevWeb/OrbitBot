const venom = require('venom-bot');
const { handleMessage } = require('./openai');
const { simularRespostaHumana } = require('./humanizer');
const { cadastrarCliente, buscarCliente, atualizarHistorico, buscarHistorico } = require('../database');

function startBot() {
    venom.create({
        session: 'sessionName',
        multidevice: true,
        headless: false,
        logQR: true,
        debug: true,
        browserArgs: ['--no-sandbox']
    })
    .then((client) => {
        console.log('Bot iniciado com sucesso!');
        client.onMessage(async (message) => {
            if (!message.from.includes('@c.us') || message.isGroupMsg) return;

            console.log('\n=== NOVA MENSAGEM ===');
            console.log('De:', message.from);
            console.log('Texto:', message.body);

            try {
                let cliente = buscarCliente(message.from);
                if (!cliente) {
                    console.log('Cadastrando novo cliente...');
                    cliente = cadastrarCliente(message.from);
                }

                atualizarHistorico(cliente.id, message.body, 'user');
                const historico = buscarHistorico(cliente.id);

                const respostaGPT = await handleMessage(historico, message.body);

                console.log('Resposta gerada:', respostaGPT);

                await simularRespostaHumana(client, message.from, respostaGPT);
                atualizarHistorico(cliente.id, respostaGPT, 'assistant');
            } catch (err) {
                console.error('Erro no processamento:', err);
                try {
                    await client.sendText(message.from, 'Estou tendo dificuldades técnicas. Por favor, tente novamente.');
                } catch (sendError) {
                    console.error('Erro ao enviar mensagem de erro:', sendError);
                }
            }
        });
        console.log('Bot pronto para receber mensagens!');
    })
    .catch((err) => {
        console.error('Erro ao criar o bot:', err);
    });
}

module.exports = { startBot };