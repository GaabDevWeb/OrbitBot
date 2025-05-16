const axios = require('axios');
const { treinamento } = require('./treinamento');

const OPENROUTER_API_KEY = ''; //API key
const MODEL_NAME = 'deepseek/deepseek-chat';

async function handleMessage(historico, userMessage) {
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
                { role: 'user', content: userMessage }
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

    return response.data.choices[0].message.content;
}

module.exports = { handleMessage };