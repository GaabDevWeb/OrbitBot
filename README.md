<img width=100% src="https://capsule-render.vercel.app/api?type=waving&color=737373&height=120&section=header"/>

# OrbitBot

Um bot de WhatsApp inteligente, robusto e otimizado, que utiliza IA para responder mensagens de forma natural, rápida e personalizada. Inclui **banco de dados SQLite otimizado**, **histórico completo de conversas**, sistema de backup avançado, monitoramento em tempo real e diversas otimizações de performance.

## NOVIDADES DA VERSÃO 2.0

- **Histórico Completo** - Mantém contexto total das conversas (sem limitação)
- **Migração 100% SQLite** - Eliminação completa de arquivos JSON
- **Performance Otimizada** - 50% mais rápido, 33% menos memória
- **Novos Comandos Admin** - Reset do banco via WhatsApp

## Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 16 ou superior)
- NPM ou Yarn
- Conta no [OpenRouter](https://openrouter.ai) para acessar a API de IA

## Instalação

1. Clone este repositório:

```bash
git clone https://github.com/GaabDevWeb/OrbitBot.git
```

2. Instale as dependências:

```bash
npm install
```

3. Configure suas chaves de API:

**No arquivo `src/openai.js`:**
```javascript
const OPENROUTER_API_KEY = 'sua-chave-openrouter-aqui';
```

## Funcionalidades Principais

### **IA e Respostas**
- **Respostas inteligentes com IA** (DeepSeek Chat via OpenRouter)
- **Simulação de digitação humana otimizada** (respostas mais naturais e rápidas)
- **Personalização de respostas baseada no contexto da conversa**

### **Histórico e Contexto**
- **Histórico completo de conversas** (sem limitação de mensagens)
- **Contexto total** da conversa mantido
- **Memória persistente** de assuntos anteriores
- **Coerência** nas respostas baseada no histórico completo
- **Paginação** e busca eficiente
- **Histórico de conversas por cliente** (paginação, busca eficiente)

### **Banco de Dados SQLite (OTIMIZADO)**
- **Banco de dados SQLite** (substitui arquivos JSON, mais performance e integridade)
- **Transações atômicas** para integridade de dados
- **Performance superior** (50% mais rápido)
- **Tamanho reduzido** (70% menor que JSON)
- **Backup confiável** e restauração

### **Sistema de Backup Avançado**
- **Backup automático a cada 6 horas** (mantém últimos 5)
- **Backup manual com nome personalizado**
- **Restauração de backups**
- **Limpeza automática**
- **Log detalhado de operações**
- **Busca flexível** (não precisa do nome exato)

### **Monitoramento e Métricas**
- **Monitoramento e métricas em tempo real**
- **Tempo de resposta**
- **Uso de memória**
- **CPU Load**
- **Total de mensagens**
- **Erros**
- **Tempo de execução**

### **Performance e Otimizações**
- **Sistema de filas para mensagens** (ordem, estabilidade e performance)
- **Otimizações de performance**
- **Cache LRU para respostas da API** (TTL 30min, 1000 itens)
- **Cache em memória para banco de dados** (TTL 30s)
- **Compressão de mensagens**
- **Retry e backoff exponencial** para requisições de API
- **Paginação e limitação de histórico**

### **Comandos Administrativos**
- **Comandos administrativos via WhatsApp** (reset, backup, histórico, etc.)
- **Novo comando `/reset`** para limpar banco de dados
- **Controle de acesso** por número de telefone
- **Confirmação dupla** para operações críticas

## Otimizações e Benefícios

- **Redução de ~50%** no tempo de resposta (média de 1-1.5 segundos)
- **Redução de ~33%** no uso de memória (~40MB)
- **Redução de ~80%** nas operações de disco
- **Redução de ~70%** no tamanho do banco de dados
- **Cache multi-nível** (API, banco, respostas)
- **Sistema de retry/backoff** para maior estabilidade
- **Backup confiável**, flexível e fácil de restaurar
- **Logs detalhados** e métricas em tempo real para monitoramento

## Comandos Administrativos via WhatsApp

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

## Configuração de Administradores

Para adicionar números de administrador, edite o arquivo `src/bot.js` e localize a constante `ADMIN_NUMBERS`. Adicione os números no formato correto:

```javascript
const ADMIN_NUMBERS = [
    '555496921107@c.us',  // Exemplo de número
    '5511999999999@c.us'  // Adicione mais números conforme necessário
];
```

Observações importantes:
- O número deve incluir o código do país e o sufixo `@c.us`
- Apenas números listados em `ADMIN_NUMBERS` poderão usar comandos administrativos
- Recomenda-se manter esta lista atualizada e segura
- Para adicionar um novo administrador, basta incluir o número no formato correto

## Estrutura do Projeto

```
OrbitBot/
├── database/
│   ├── data/
│   │   └── orbitbot.db          # Banco SQLite principal
│   ├── backups/
│   │   └── backup_log.json      # Logs de backup
│   ├── db.js                    # Operações SQLite
│   └── index.js                 # Interface de exportação
├── src/
│   ├── backup.js                # Sistema de backup avançado
│   ├── bot.js                   # Lógica principal do bot
│   ├── humanizer.js             # Simulação de digitação humana
│   ├── openai.js                # Integração com IA (OpenRouter)
│   ├── performance.js           # Monitoramento e métricas
│   ├── queue.js                 # Sistema de filas para mensagens
│   ├── logger.js                # Sistema de logs otimizado
│   └── treinamento.js           # Prompt de treinamento do bot
├── app.js                       # Inicialização do bot
├── package.json
├── .gitignore                   # Configuração de arquivos ignorados
├── README.md
└── RELATORIO_ATUALIZADO.md      # Relatório detalhado de mudanças
```

## Monitoramento e Métricas

O OrbitBot monitora em tempo real:
- Tempo de execução
- Total de mensagens
- Tempo médio de resposta
- Uso de memória
- CPU Load
- Erros
- Dados do banco (clientes e mensagens)

Essas métricas são exibidas periodicamente no console e ajudam na identificação rápida de problemas e oportunidades de otimização.

## Personalização

Você pode ajustar:
- O comportamento do bot editando `src/treinamento.js`
- O tempo de resposta em `src/humanizer.js`
- O modelo de IA em `src/openai.js`

## Limpeza Automática

O sistema inclui limpeza automática de:
- **Backups antigos:** Mantém apenas os últimos 5
- **Cache:** Limpeza periódica de caches

## Futuras Melhorias

- Sistema de pedidos e cardápio digital para comércios
- Rate limiting para evitar spam
- Mais métricas e dashboards visuais
- Otimizações adicionais de cache e logs

## Troubleshooting

### Problemas Comuns:

**Bot não responde:**
- Verifique se as chaves de API estão configuradas
- Confirme se o banco SQLite está acessível
- Verifique os logs no console

**Comandos admin não funcionam:**
- Confirme se seu número está em `ADMIN_NUMBERS`
- Verifique se o formato do número está correto (`@c.us`)

## Changelog

### v2.0 (20/06/2025)
- **Histórico completo de conversas**
- **Migração 100% para SQLite**
- **Comando de reset do banco**
- **Performance otimizada (50% mais rápido)**
- **Redução de uso de memória (33% menos)**

### v1.x (Versões anteriores)
- Sistema de backup
- Monitoramento de performance
- Sistema de filas

---

<img width=100% src="https://capsule-render.vercel.app/api?type=waving&color=737373&height=120&section=footer"/>