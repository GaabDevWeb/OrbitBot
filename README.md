<img width=100% src="https://capsule-render.vercel.app/api?type=waving&color=737373&height=120&section=header"/>


# OrbitBot 

Um bot de WhatsApp inteligente que utiliza IA para responder mensagens de forma natural e personalizada.

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 16 ou superior)
- NPM ou Yarn
- Conta no [OpenRouter](https://openrouter.ai) para acessar a API de IA

## 🚀 Instalação

1. Clone este repositório:

```bash
git clone https://github.com/GaabDevWeb/OrbitBot.git
```

2. Instale as dependências:

```bash
npm install
```

3. Configure sua chave da API no arquivo `src/openai.js`:

```javascript
const OPENROUTER_API_KEY = 'sua-chave-aqui';
```

## 🔑 Como Obter sua Chave de API no OpenRouter

1. Crie uma conta no [OpenRouter](https://openrouter.ai)
2. Clique em **Sign Up** e conclua o cadastro
3. Encontre o modelo **DeepSeek V3 (Free)**
   - Após o login, vá para a aba **Search Models**
   - Procure por **DeepSeek V3 (Free)** e selecione o modelo
4. Gere sua chave de API
   - Clique em **API** no menu inferior
   - Clique em **Create API Key**
   - Copie a chave gerada
5. Adicione a chave ao projeto
   - No arquivo `src/openai.js`, substitua:

```javascript
const OPENROUTER_API_KEY = '';
```

   - por:

```javascript
const OPENROUTER_API_KEY = 'SUA_CHAVE_AQUI';
```

## ⚙️ Funcionalidades

- Respostas inteligentes usando o modelo DeepSeek Chat
- Simulação de digitação humana para respostas mais naturais
- Armazenamento de histórico de conversas por cliente
- Personalização de respostas baseada no contexto da conversa

## 🏗️ Estrutura do Projeto

```
OrbitBot/
├── database/             
│   ├── data/             
│   ├── clientOperations.js     
│   ├── dbOperations.js        
│   ├── historyOperations.js  
│   └── index.js
├── src/
│   ├── bot.js              
│   ├── humanizer.js        
│   ├── openai.js           
│   └── treinamento.js      
├── package.json
├── README.md
└── app.js
```

## 🛠️ Como Executar

Inicie o bot com o comando:

```bash
node app.js
```

O bot irá:

- Mostrar um QR Code para autenticação no WhatsApp
- Iniciar escuta de mensagens
- Responder mensagens de forma inteligente

## 📝 Personalização

Você pode ajustar:

- O comportamento do bot editando `src/treinamento.js`
- O tempo de resposta em `src/humanizer.js`
- O modelo de IA em `src/openai.js`


<img width=100% src="https://capsule-render.vercel.app/api?type=waving&color=737373&height=120&section=footer"/>