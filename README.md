Olá, pessoal! Sou o Gabriel do 3º ano C e apresento meu projeto: um atendente automático para WhatsApp que nunca dorme, não erra pedidos e ainda lembra dos clientes!

🚀 **Ele responde em média 7 segundos e tem aquele charme que só a IA consegue.**

---

## 💻 Tecnologias Utilizadas

Para construir esse bot, utilizei as melhores ferramentas:

- **JavaScript + Node.js** – A base sólida do projeto;
- **Axios** – Para comunicação com a API do DeepSeek;
- **Venom-Bot** – Para interação com o WhatsApp de forma segura;
- **Banco de dados JSON** – Simples, mas eficiente para armazenar clientes e pedidos.

---

## 🎯 Por Que Criar Esse Bot?

Esse projeto nasceu da ideia de ajudar pequenos negócios, como:

- **Pizzarias** sem atendentes 24h;
- **Lojas** que perdem vendas por não responder a tempo;
- **Salões** que erram horários agendados.

Esse bot atua como um **estagiário digital incansável**, sempre pronto para atender!

---

## 🧠 Funcionalidades Principais

### 🔥 Memória Inteligente

- Lembra o pedido do cliente e sugere automaticamente na próxima conversa;
- Guarda o histórico da conversa, retomando de onde parou.

### ⏱️ Respostas Naturais

- Simula digitação com pequenos atrasos;
- Divide respostas longas em trechos menores;
- Insere pausas estratégicas para parecer mais humano.

**Exemplo:**

```
Bot: Beleza, anotei seu pedido! 🍕
(1 segundo...)
Bot: Sua pizza de calabresa ficará pronta em 25 minutos! Quer adicionar uma Coca gelada? 🥤
```

---

# Para rodar o bot no seu ambiente local, siga os passos abaixo:

## 1. **Instale as dependências necessárias:**
   ```sh
   npm install venom-bot axios dotenv
   ```
   
# 🔑 Gerando uma Nova Chave de API para o Bot

Para que o bot funcione corretamente, é necessário obter uma chave de API da plataforma OpenRouter. Siga os passos abaixo para gerar a sua.

## 🚀 Passos para Criar uma Nova Chave de API

1. **Crie uma conta no OpenRouter:**
   - Acesse [OpenRouter.ai](https://openrouter.ai/)
   - Clique em **Sign Up** e siga o processo de registro.

2. **Pesquise pelo modelo DeepSeek V3 (Free):**
   - Após fazer login, vá até a aba **Search Models**
   - Pesquise por **DeepSeek V3 (Free)** e selecione-o

3. **Gerar a Chave de API:**
   - No menu inferior, clique em **API**
   - Clique no botão para **Criar Nova Chave de API**
   - Copie a chave gerada

4. **Substitua a chave no código:**
   - Abra o arquivo do bot e localize a linha:
     ```js
     const OPENROUTER_API_KEY = '';
     ```
   - Substitua as aspas vazias pela sua nova chave de API:
     ```js
     const OPENROUTER_API_KEY = 'SUA_CHAVE_AQUI';
     ```

5. **Salve as alterações e execute o bot!** 🚀

   ```sh
   node app.js
