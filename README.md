<img width=100% src="https://capsule-render.vercel.app/api?type=waving&color=737373&height=120&section=header"/>

# OrbitBot

Um bot de WhatsApp inteligente, robusto e otimizado, que utiliza IA para responder mensagens de forma natural, rápida e personalizada. Agora com sistema de backup avançado, banco de dados SQLite, monitoramento em tempo real e diversas otimizações de performance.

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

## ⚙️ Funcionalidades Principais

- 🤖 **Respostas inteligentes com IA** (DeepSeek Chat via OpenRouter)
- 🧑‍💻 **Simulação de digitação humana otimizada** (respostas mais naturais e rápidas)
- 🗂️ **Histórico de conversas por cliente** (limite de 50 mensagens, paginação, busca eficiente)
- 🧠 **Personalização de respostas baseada no contexto da conversa**
- 💾 **Sistema de backup avançado**
  - Backup automático a cada 6 horas (mantém últimos 5)
  - Backup manual com nome personalizado
  - Restauração de backups
  - Limpeza automática
  - Log detalhado de operações
  - Busca flexível (não precisa do nome exato)
- 📊 **Monitoramento e métricas em tempo real**
  - Tempo de resposta
  - Uso de memória
  - CPU Load
  - Total de mensagens
  - Erros
  - Tempo de execução
- 📨 **Sistema de filas para mensagens** (ordem, estabilidade e performance)
- 🚀 **Otimizações de performance**
  - Cache LRU para respostas da API (TTL 30min, 1000 itens)
  - Cache em memória para banco de dados (TTL 30s)
  - Compressão de mensagens
  - Retry e backoff exponencial para requisições de API
  - Paginação e limitação de histórico
- 🗄️ **Banco de dados SQLite** (substitui arquivos JSON, mais performance e integridade)
- 🔒 **Comandos administrativos via WhatsApp** (reset, backup, histórico, etc.)

## 🏆 Otimizações e Benefícios

- Redução de ~50% no tempo de resposta (média de 1-1.5 segundos)
- Redução de ~33% no uso de memória (~40MB)
- Redução de ~80% nas operações de disco
- Redução de ~70% no tamanho do banco de dados
- Cache multi-nível (API, banco, respostas)
- Paginação e limitação do histórico (mais rápido e leve)
- Sistema de retry/backoff para maior estabilidade
- Backup confiável, flexível e fácil de restaurar
- Logs detalhados e métricas em tempo real para monitoramento

## 🛠️ Comandos Administrativos via WhatsApp

Todos os comandos abaixo devem ser enviados por um número autorizado (admin):

```
/backup criar [nome]         - Cria um novo backup (nome opcional)
/backup listar               - Lista todos os backups disponíveis
/backup restaurar [nome]     - Restaura um backup específico
/backup excluir [nome]       - Exclui um backup específico
/backup info [nome]          - Mostra informações detalhadas de um backup
/backup atual                - Mostra informações do backup atual
/backup logs                 - Mostra o histórico de operações de backup
/historico [numero] [página] - Mostra o histórico de um cliente (com paginação)
/reset confirmar             - Reseta todo o banco de dados (ação irreversível)
```

- Não é necessário digitar o nome exato do backup, a busca é flexível e ignora maiúsculas/minúsculas.
- Use `/backup listar` para ver os nomes disponíveis.

## 🏗️ Estrutura do Projeto

```
OrbitBot/
├── database/
│   ├── data/                 # Dados do banco (SQLite e backups)
│   ├── backups/              # Backups automáticos e manuais
│   ├── clientOperations.js   # Operações com clientes (legado)
│   ├── db.js                 # Banco de dados SQLite
│   ├── dbOperations.js       # Operações com arquivos JSON (legado)
│   ├── historyOperations.js  # Operações de histórico (legado)
│   └── index.js              # Exporta operações principais
├── src/
│   ├── backup.js             # Sistema de backup avançado
│   ├── bot.js                # Lógica principal do bot
│   ├── humanizer.js          # Simulação de digitação humana
│   ├── openai.js             # Integração com IA (OpenRouter)
│   ├── performance.js        # Monitoramento e métricas
│   ├── queue.js              # Sistema de filas para mensagens
│   └── treinamento.js        # Prompt de treinamento do bot
├── app.js                    # Inicialização do bot
├── package.json
├── README.md
└── RELATORIO.md              # Relatório detalhado de otimizações
```

## 📈 Monitoramento e Métricas

O OrbitBot monitora em tempo real:
- Tempo de execução
- Total de mensagens
- Tempo médio de resposta
- Uso de memória
- CPU Load
- Erros
- Dados do banco (clientes e mensagens)

Essas métricas são exibidas periodicamente no console e ajudam na identificação rápida de problemas e oportunidades de otimização.

## 📝 Personalização

Você pode ajustar:
- O comportamento do bot editando `src/treinamento.js`
- O tempo de resposta em `src/humanizer.js`
- O modelo de IA em `src/openai.js`

## 💡 Futuras Melhorias

- Sistema de pedidos e cardápio digital para comércios
- Rate limiting para evitar spam
- Mais métricas e dashboards visuais
- Otimizações adicionais de cache e logs

<img width=100% src="https://capsule-render.vercel.app/api?type=waving&color=737373&height=120&section=footer"/>