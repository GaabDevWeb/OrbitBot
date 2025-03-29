const venom = require('venom-bot');
const axios = require('axios');
const { cadastrarCliente, buscarCliente, atualizarHistorico, buscarHistorico } = require('./db');

const OPENROUTER_API_KEY = ''; //Chave API
const MODEL_NAME = 'deepseek/deepseek-chat';

const treinamento = `
Você é um chatbot especializado em conversas naturais e envolventes. Sua função é interagir com humanos de forma empática e autêntica.
`;

const simularRespostaHumana = async (client, chatId, texto) => {
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));

    const frases = texto.split(/(?<=[.!?])\s+/).filter(f => f.length > 0);
    let mensagemAtual = '';

    for (const frase of frases) {
        if ((mensagemAtual + frase).length <= 180) {
            mensagemAtual += (mensagemAtual ? ' ' : '') + frase;
        } else {
            if (mensagemAtual) {
                await client.sendText(chatId, mensagemAtual);
                await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
                mensagemAtual = '';
            }
            
            if (frase.length > 180) {
                const partesLongas = frase.match(/.{1,180}(?:\s|$)/g) || [frase];
                for (const parte of partesLongas) {
                    await client.sendText(chatId, parte.trim());
                    await new Promise(resolve => setTimeout(resolve, 600));
                }
            } else {
                mensagemAtual = frase;
            }
        }
    }

    if (mensagemAtual) {
        await client.sendText(chatId, mensagemAtual);
    }
};

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
    start(client);
})
.catch((err) => {
    console.error('Erro ao criar o bot:', err);
});

const start = async (client) => {
    console.log('Iniciando escuta de mensagens...');

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

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: MODEL_NAME,
                    messages: [
                        { role: 'system', content: treinamento },
                        ...historico.map(item => ({
                            role: item.role,
                            content: item.mensagem
                        })),
                        { role: 'user', content: message.body }
                    ],
                    temperature: 0.7,
                    max_tokens: 800
                },
                {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'HTTP-Referer': 'https://www.sitename.com',
                        'X-Title': 'SiteName',
                        'Content-Type': 'application/json'
                    },
                    timeout: 20000
                }
            );

            if (!response.data?.choices?.[0]?.message?.content) {
                throw new Error('Resposta da API inválida');
            }

            const respostaGPT = response.data.choices[0].message.content;
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
};


