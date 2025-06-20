# 🤖 Sistema Modular do OrbitBot

## 📋 Visão Geral

O OrbitBot agora possui um **sistema modular avançado** que permite personalização completa da experiência do usuário através de:

- **Personalidades dinâmicas** - Diferentes modos de comportamento
- **Modelos de IA configuráveis** - Múltiplos modelos DeepSeek
- **Sistema de plugins** - Extensões dinâmicas
- **Contextos adaptativos** - Configurações por tipo de conversa
- **Preferências por usuário** - Personalização individual

---

## 🎯 Benefícios do Sistema Modular

### ✅ **Flexibilidade Total**
- Mude o comportamento do bot em tempo real
- Adapte-se a diferentes tipos de usuários
- Configure modelos específicos para cada situação

### ✅ **Extensibilidade**
- Crie plugins personalizados
- Adicione funcionalidades sem modificar o código principal
- Sistema de hooks para integração

### ✅ **Performance Otimizada**
- Cache inteligente por configuração
- Processamento paralelo
- Limpeza automática de recursos

### ✅ **Experiência Personalizada**
- Cada usuário pode ter suas preferências
- Contextos específicos para diferentes situações
- Respostas adaptadas ao perfil

---

## 👤 Sistema de Personalidades

### **Personalidades Disponíveis:**

#### 🎭 **Default (Padrão)**
- **Comportamento:** Mal educado, arrogante e desrespeitoso
- **Tom:** Informal e sarcástico
- **Ideal para:** Conversas casuais e amigos
- **Modelo:** deepseek-chat

#### 💼 **Professional (Profissional)**
- **Comportamento:** Respeitoso e focado em soluções
- **Tom:** Formal e técnico
- **Ideal para:** Clientes e negócios
- **Modelo:** deepseek-chat

#### 👨‍💻 **Coder (Desenvolvedor)**
- **Comportamento:** Especialista em programação
- **Tom:** Técnico mas descontraído
- **Ideal para:** Questões de desenvolvimento
- **Modelo:** deepseek-coder

#### 😊 **Friendly (Amigável)**
- **Comportamento:** Empático e acolhedor
- **Tom:** Positivo e motivador
- **Ideal para:** Apoio emocional
- **Modelo:** deepseek-chat

### **Comandos de Personalidade:**
```bash
/ai personalidade listar          # Lista todas as personalidades
/ai personalidade [nome]          # Altera personalidade
/ai personalidade info            # Mostra personalidade atual
```

---

## 🧠 Sistema de Modelos

### **Modelos Disponíveis:**

#### 🤖 **deepseek-chat**
- **Tokens:** 800
- **Temperature:** 0.7
- **Uso:** Conversas gerais
- **Performance:** Equilibrada

#### 💻 **deepseek-coder**
- **Tokens:** 1200
- **Temperature:** 0.3
- **Uso:** Código e tecnologia
- **Performance:** Mais preciso para código

#### 🚀 **deepseek-chat-33b**
- **Tokens:** 1000
- **Temperature:** 0.8
- **Uso:** Conversas complexas
- **Performance:** Mais criativo

### **Comandos de Modelo:**
```bash
/ai modelo listar                 # Lista todos os modelos
/ai modelo [nome]                 # Altera modelo
/ai modelo info                   # Mostra modelo atual
```

---

## 🔌 Sistema de Plugins

### **Plugins Padrão:**

#### 📊 **Sentiment Analysis**
- **Função:** Analisa sentimento das mensagens
- **Hooks:** beforeMessage
- **Status:** 🟢 Ativo por padrão

#### 🎯 **Command Detector**
- **Função:** Detecta comandos especiais
- **Hooks:** beforeMessage
- **Status:** 🟢 Ativo por padrão

#### 🤖 **Auto Response**
- **Função:** Respostas automáticas
- **Hooks:** afterMessage
- **Status:** 🟢 Ativo por padrão

#### 📈 **Statistics**
- **Função:** Coleta estatísticas
- **Hooks:** messageProcessed
- **Status:** 🟢 Ativo por padrão

### **Comandos de Plugin:**
```bash
/ai plugin listar                 # Lista todos os plugins
/ai plugin [nome] on/off          # Habilita/desabilita plugin
/ai plugin info [nome]            # Mostra informações do plugin
```

---

## 🎨 Criando Plugins Personalizados

### **Estrutura de um Plugin:**

```javascript
const meuPlugin = {
    name: 'Meu Plugin',
    version: '1.0.0',
    description: 'Descrição do plugin',
    
    // Configurações
    config: {
        // Suas configurações aqui
    },

    // Hooks (opcional)
    hooks: {
        'beforeMessage': async (data) => {
            // Lógica executada antes do processamento
            return data;
        },
        
        'afterMessage': async (data) => {
            // Lógica executada após o processamento
            return data;
        },
        
        'messageProcessed': async (data) => {
            // Lógica executada após mensagem processada
            return data;
        }
    },

    // Middleware (opcional)
    middleware: async (message, next) => {
        // Lógica de middleware
        return await next();
    },

    // Comandos específicos (opcional)
    commands: {
        'meucomando': {
            description: 'Descrição do comando',
            usage: '/meucomando [args]',
            handler: async (args) => {
                // Lógica do comando
                return 'Resposta do comando';
            }
        }
    }
};

module.exports = meuPlugin;
```

### **Hooks Disponíveis:**

#### 🔄 **beforeMessage**
- **Execução:** Antes do processamento da mensagem
- **Dados:** `{ message, historico, config, userId }`
- **Uso:** Análise, detecção de comandos, modificação de entrada

#### 🔄 **afterMessage**
- **Execução:** Após geração da resposta
- **Dados:** `{ message, response, historico, config, userId, sentiment }`
- **Uso:** Modificação de resposta, adição de informações

#### 🔄 **messageProcessed**
- **Execução:** Após processamento completo
- **Dados:** `{ userId, message, response, config, timestamp }`
- **Uso:** Logging, estatísticas, ações finais

### **Exemplo de Plugin Real:**

Veja o arquivo `plugins/weatherPlugin.js` para um exemplo completo de plugin que adiciona funcionalidade de consulta de clima.

---

## 🎛️ Sistema de Contextos

### **Tipos de Contexto:**

#### 💬 **Conversation (Conversa Casual)**
- **Histórico:** 10 mensagens
- **Prioridade:** Baixa
- **Uso:** Conversas informais

#### 🔧 **Technical (Suporte Técnico)**
- **Histórico:** 15 mensagens
- **Prioridade:** Alta
- **Uso:** Questões técnicas

#### 💼 **Business (Negócios)**
- **Histórico:** 8 mensagens
- **Prioridade:** Alta
- **Uso:** Assuntos comerciais

#### 👤 **Personal (Pessoal)**
- **Histórico:** 5 mensagens
- **Prioridade:** Média
- **Uso:** Assuntos pessoais

---

## 👤 Preferências por Usuário

### **Sistema de Personalização:**

Cada usuário pode ter suas próprias preferências que são aplicadas automaticamente:

```javascript
// Definir preferência para um usuário
aiConfigManager.setUserPreference(userId, 'personality', 'professional');
aiConfigManager.setUserPreference(userId, 'model', 'deepseek-coder');

// Obter preferência de um usuário
const personality = aiConfigManager.getUserPreference(userId, 'personality');
```

### **Preferências Disponíveis:**
- `personality` - Personalidade preferida
- `model` - Modelo de IA preferido
- `context` - Tipo de contexto preferido

---

## 📊 Comandos Administrativos

### **Comandos Principais:**

```bash
/ai                           # Menu principal do sistema
/ai stats                     # Estatísticas completas
/ai cache limpar              # Limpa cache de respostas
```

### **Comandos de Personalidade:**
```bash
/ai personalidade listar      # Lista personalidades
/ai personalidade default     # Define personalidade
/ai personalidade info        # Informações atuais
```

### **Comandos de Modelo:**
```bash
/ai modelo listar             # Lista modelos
/ai modelo deepseek-coder     # Define modelo
/ai modelo info               # Informações atuais
```

### **Comandos de Plugin:**
```bash
/ai plugin listar             # Lista plugins
/ai plugin sentimentAnalysis off  # Desabilita plugin
/ai plugin info statistics    # Informações do plugin
```

---

## 🔧 Configuração Avançada

### **Arquivo de Configuração:**

O sistema usa o arquivo `src/aiConfig.js` para configurações. Você pode:

1. **Adicionar novas personalidades**
2. **Configurar novos modelos**
3. **Definir contextos personalizados**
4. **Ajustar parâmetros**

### **Exemplo de Personalização:**

```javascript
// Adicionar nova personalidade
const PERSONALITIES = {
    // ... personalidades existentes ...
    
    'custom': {
        name: 'Minha Personalidade',
        description: 'Personalidade personalizada',
        systemPrompt: 'Seu prompt personalizado aqui...',
        model: 'deepseek-chat',
        contextWindow: 10
    }
};
```

---

## 📈 Métricas e Monitoramento

### **Estatísticas Disponíveis:**

```bash
/ai stats
```

**Retorna:**
- **IA:** Personalidades, modelos, contextos ativos
- **Plugins:** Total, ativos, inativos, hooks, middleware
- **Cache:** Itens, tamanho máximo, TTL

### **Logs Detalhados:**

O sistema registra logs detalhados para:
- Mudanças de personalidade
- Alterações de modelo
- Ativação/desativação de plugins
- Performance de cache
- Erros e exceções

---

## 🚀 Melhorias Futuras

### **Funcionalidades Planejadas:**

#### 🔄 **Aprendizado Automático**
- Sistema que aprende com interações
- Ajuste automático de personalidades
- Otimização baseada em feedback

#### 🌐 **API REST**
- Endpoints para configuração remota
- Dashboard web para administração
- Integração com sistemas externos

#### 🎨 **Interface Visual**
- Dashboard para configuração
- Gráficos de performance
- Editor visual de personalidades

#### 🔌 **Marketplace de Plugins**
- Repositório de plugins
- Sistema de instalação automática
- Comunidade de desenvolvedores

---

## 🛠️ Troubleshooting

### **Problemas Comuns:**

#### ❌ **Plugin não carrega**
```bash
# Verifique se o plugin está registrado
/ai plugin listar

# Verifique logs de erro
# Reinicie o bot se necessário
```

#### ❌ **Personalidade não muda**
```bash
# Verifique se a personalidade existe
/ai personalidade listar

# Verifique logs de erro
# Use comando de reset se necessário
```

#### ❌ **Cache não funciona**
```bash
# Limpe o cache
/ai cache limpar

# Verifique estatísticas
/ai stats
```

### **Logs Úteis:**

```bash
# Logs de personalidade
logger.info('Personalidade alterada', { from, to, model });

# Logs de plugin
logger.info('Plugin registrado com sucesso', { name });

# Logs de cache
logger.info('Cache limpo', { previousSize });
```

---

## 📚 Exemplos Práticos

### **Exemplo 1: Plugin de Tradução**

```javascript
const translationPlugin = {
    name: 'Translation Plugin',
    version: '1.0.0',
    description: 'Traduz mensagens automaticamente',
    
    hooks: {
        'beforeMessage': async (data) => {
            // Detecta idioma e traduz se necessário
            if (detectLanguage(data.message) !== 'pt') {
                data.message = await translate(data.message, 'pt');
            }
            return data;
        }
    }
};
```

### **Exemplo 2: Plugin de Moderação**

```javascript
const moderationPlugin = {
    name: 'Moderation Plugin',
    version: '1.0.0',
    description: 'Modera conteúdo inadequado',
    
    hooks: {
        'beforeMessage': async (data) => {
            if (containsInappropriateContent(data.message)) {
                return {
                    ...data,
                    autoResponse: '⚠️ Sua mensagem contém conteúdo inadequado.'
                };
            }
            return data;
        }
    }
};
```

### **Exemplo 3: Plugin de Lembretes**

```javascript
const reminderPlugin = {
    name: 'Reminder Plugin',
    version: '1.0.0',
    description: 'Sistema de lembretes',
    
    hooks: {
        'afterMessage': async (data) => {
            if (containsReminder(data.message)) {
                const reminder = extractReminder(data.message);
                scheduleReminder(reminder, data.userId);
                
                return {
                    ...data,
                    response: `${data.response}\n\n⏰ Lembrete configurado: ${reminder}`
                };
            }
            return data;
        }
    }
};
```

---

## 🎉 Conclusão

O sistema modular do OrbitBot oferece:

- ✅ **Flexibilidade total** para personalização
- ✅ **Extensibilidade** através de plugins
- ✅ **Performance otimizada** com cache inteligente
- ✅ **Experiência personalizada** por usuário
- ✅ **Fácil manutenção** e desenvolvimento

Com este sistema, o OrbitBot se torna uma plataforma verdadeiramente dinâmica e adaptável, capaz de atender às necessidades mais específicas de cada usuário e situação.

---

*Documentação gerada em: 20/06/2025*  
*Versão do Sistema: 2.4*  
*Status: ✅ PRODUÇÃO PRONTA* 