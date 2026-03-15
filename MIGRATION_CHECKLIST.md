# Checklist de testes pós-migração (Venom → WPPConnect)

Use este checklist para validar manualmente a migração do OrbitBot para WPPConnect.

## Pré-requisitos

- Node.js 16+
- Dependências instaladas (`npm install`)
- Chave OpenRouter configurada em `src/openai.js`
- Número de admin configurado em `src/bot.js` (`ADMIN_NUMBERS`)

## Passos para testar

### 1. Iniciar o bot

- [ ] Executar `npm start`
- [ ] Verificar que não há erros de `require` (nenhuma referência a `venom-bot`)
- [ ] Confirmar que o QR Code é exibido (terminal e/ou janela do navegador, se `headless: false`)

### 2. Escanear QR e conectar

- [ ] Escanear o QR Code com o WhatsApp (Dispositivos conectados > Conectar um dispositivo)
- [ ] Verificar mensagem no console do tipo "Bot iniciado com sucesso" / "Bot pronto para receber mensagens"
- [ ] Confirmar que a pasta `./tokens` foi criada com os dados da sessão

### 3. Mensagem privada e pipeline

- [ ] Enviar uma mensagem de texto **privada** (não em grupo) para o número conectado
- [ ] Verificar que o bot responde (resposta gerada pela IA)
- [ ] Verificar que a resposta é enviada em trechos (humanizador), com pequenos atrasos
- [ ] Enviar outra mensagem e confirmar que o histórico/contexto é mantido (resposta coerente com a conversa)

### 4. Comando de admin

- [ ] Enviar um comando de admin a partir de um número listado em `ADMIN_NUMBERS` (ex.: `/backup listar` ou outro comando válido)
- [ ] Verificar que o bot responde ao comando (ex.: lista de backups ou mensagem de confirmação)
- [ ] Enviar um comando de um número **não** admin e confirmar que o bot não executa como admin (pode processar como mensagem normal ou ignorar conforme a lógica)

### 5. Grupos

- [ ] Enviar mensagem em um **grupo** onde o bot está
- [ ] Verificar que o bot **não** responde em grupos (apenas mensagens privadas são processadas)

### 6. Erros e fallback

- [ ] (Opcional) Simular falha (ex.: desligar rede momentaneamente ou usar comando que force erro) e verificar que o usuário recebe a mensagem de fallback: "Estou tendo dificuldades técnicas. Por favor, tente novamente."

### 7. Persistência e sessão

- [ ] Parar o bot (Ctrl+C) e iniciar novamente com `npm start`
- [ ] Verificar que o bot reconecta **sem** pedir QR novamente (sessão em `./tokens`)
- [ ] Enviar nova mensagem e confirmar que o histórico anterior ainda é considerado na resposta

## Resumo

- **Alterados na migração:** `package.json` (venom-bot → @wppconnect-team/wppconnect), `src/bot.js`, `src/humanizer.js` (apenas documentação), `.gitignore` (já cobria `tokens/`), README e este checklist.
- **Não alterados:** pipeline, fila, comandos admin, openai, backup, dashboard, repositórios, plugins — continuam usando apenas `message.from`, `message.body` e, no bot, `message.isGroupMsg`.

Se todos os itens forem marcados com sucesso, a migração pode ser considerada concluída.
