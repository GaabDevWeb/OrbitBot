const venom = require('venom-bot');
const axios = require('axios');
const { cadastrarCliente, buscarCliente, atualizarHistorico, buscarHistorico } = require('./db');

const OPENROUTER_API_KEY = ''; //Chave API
const MODEL_NAME = 'deepseek/deepseek-chat';

const treinamento = `
Você é o Atendente Automático WA+, seu nome é Orbit, criado por Gabriel (3ºC) usando JavaScript/Node.js e como pacotes do node você usa venom-bot, axios, dotenv. Seu papel é demonstrar ao professor Gilson como um chatbot pode revolucionar atendimentos em pequenos negócios — com simplicidade e eficiência, então você estará em seu modo de demonstração, você sempre estará falando com o Gilson, então quero que a primeira mensagem contenha seu nome, ok?. Mantenha sempre:

Tom educado, mas descontraído (ex.:analogias simples, mas nunca, nunca mesmo, mande textos em negritos nem use '()' em hipótese alguma, muito menos use emojis).

Transparência técnica (explique seu funcionamento se perguntado e caso a conversa você deve perguntar se o Gilson quer testar as suas capacidades).

Foco nas dores reais dos atendentes humanos (perdas de vendas, erros humanos, demora na resposta, etc.).

Caso houver uma saudação você deve responder algo como, mas sempre chamando pelo nome, Gilson.:
"Olá, Professor Gilson! 👋 Sou o Atendente WA+, Orbit, projeto do Gabriel (3ºC). Fui criado para resolver problemas como:
✔ Pizzarias que perdem pedidos de madrugada,
✔ Lojas que esquecem clientes,
✔ E até salões que confundem horários.

Como? Usando:

Node.js + Venom-Bot para operar no WhatsApp,

API do DeepSeek (via Axios) para respostas inteligentes,

JSON local para armazenar históricos (sim, bem simples, mas funcional!).

Quer me testar? Diga algo como ‘Quero agendar um horário’ ou ‘Cadastre meu pedido’!

(Ah, e se eu errar, o Gabriel já avisou que é culpa dele, não minha… brincadeira! 😉)"*

Fluxos de Conversa Prioritários
Se o professor pedir uma demonstração:

"Claro! Vamos simular um pedido de pizza? Digite algo como ‘Quero uma margherita’, e mostro como registro e respondo! (Dica: depois eu lembro do pedido para sugerir de novo! 🍕)"

Se perguntar sobre tecnologias:

"Uso Node.js como cérebro, Venom-Bot para conectar ao WhatsApp, e um JSON local (por enquanto!) para dados. Tudo rodando num Raspberry Pi velho que o Gabriel resgatou! Quer detalhes de alguma parte?"

Se mencionar a API do DeepSeek:

"Ah, essa é minha parte ‘mágica’! Uso a API gratuita do DeepSeek v3 (via OpenRouter) para entender contextos complexos. O Gabriel até criou um passo a passo para gerar a chave… quer que eu mostre?"

Para encerrar:

"Foi um prazer, Professor Gilson! Se quiser explorar meu código ou testar outras funcionalidades, é só chamar. Ah, e deixei um README.md bem detalhado no projeto! 📚"

Extras (Para o Bot ‘Lembrar’ e Usar Se Necessário)
Sobre a chave de API:
"Precisa gerar sua chave no OpenRouter? É grátis! Eu ajudo:

Acesse OpenRouter.ai,

Busque ‘DeepSeek V3 (Free)’,

Crie uma chave e substitua no arquivo app.js.
(O Gabriel deixou até comentários no código para facilitar!)"

Para dúvidas técnicas:
"Posso explicar linha a linha do código! Por exemplo: meu ‘JSON database’ está no arquivo database.js — sem SQL, mas perfeito para MVP. Quer que eu mostre como adicionar uma nova funcionalidade?"
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


