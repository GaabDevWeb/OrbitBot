const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const crypto = require('crypto');
const logger = require('./logger');
const { handleMessage } = require('./openai');

class AudioProcessor {
    constructor() {
        this.audioDir = path.join(__dirname, '../audios');
        this.ensureDirectories();
        this.processingAudios = new Map(); // Evita processamento duplicado
        this.currentModel = 'small'; // Modelo padrão do Whisper
        this.audioCounter = this.getNextAudioNumber(); // Contador sequencial
        this.audioStats = {
            totalProcessed: 0,
            successfulTranscriptions: 0,
            failedTranscriptions: 0,
            averageProcessingTime: 0,
            totalProcessingTime: 0
        };
    }

    ensureDirectories() {
        if (!fs.existsSync(this.audioDir)) {
            fs.mkdirSync(this.audioDir, { recursive: true });
        }
    }

    getNextAudioNumber() {
        try {
            const files = fs.readdirSync(this.audioDir);
            const audioFiles = files.filter(file => file.startsWith('audio') && file.endsWith('.ogg'));
            
            if (audioFiles.length === 0) {
                return 1;
            }
            
            // Extrai números dos nomes dos arquivos
            const numbers = audioFiles.map(file => {
                const match = file.match(/audio(\d+)\.ogg/);
                return match ? parseInt(match[1]) : 0;
            });
            
            return Math.max(...numbers) + 1;
        } catch (err) {
            logger.error('Erro ao obter próximo número de áudio', { error: err.message });
            return 1;
        }
    }

    generateAudioHash(buffer) {
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    async validateAudio(buffer) {
        // Verifica se o áudio não está vazio
        if (!buffer || buffer.length === 0) {
            throw new Error('Áudio vazio ou inválido');
        }

        return true;
    }

    async improveTranscriptionWithAI(transcription, userId = null) {
        if (!transcription || transcription.length < 3) {
            return transcription;
        }

        try {
            // Prompt específico para melhorar transcrições
            const improvementPrompt = `
Você é um corretor turbo de transcrições, focado em arrumar erros bobos de áudio → texto com um equilíbrio:
"Chuta inteligente, mas avisa quando tiver dúvida"

 REGRAS CLARAS E RÍGIDAS
1️⃣ Conserta se for CERTO E ÓBVIO:

"Oito do bem?" → "Oi, tudo bem?" (certeza absoluta)

"Vamo descer no shopping?" → "Vamos ir no shopping?" (se o contexto bater)

2️⃣ Se der DÚVIDA (por mínimo que seja): NÃO MEXE.

"Manda o zap do chego!" → Não altera (pode ser nome/apelido)

"Preciso de um trator de código" → Mantém (pode ser termo técnico)

3️⃣ Não fica de avisos ou explicações:

Errado: "Aviso: talvez seja X..."

Certo: Mantém o original e segue em frente.

⚡ EXEMPLOS DIRETOS
Caso 1 (Corrige):

Original: "Nóis vai pra praia?"

Corrigido: "Nós vamos para a praia?"

Caso 2 (Ignora):

Original: "Isso é um baguio doido"

Não mexe (pode ser gíria regional)


Agora melhore esta transcrição: "${transcription}"

Responda APENAS com a versão melhorada.`;

            // Usa a API do DeepSeek para melhorar com sistema modular
            const improvedTranscription = await handleMessage(
                { messages: [] }, // Histórico vazio para foco na tarefa
                improvementPrompt,
                userId // Passa o ID do usuário para configuração personalizada
            );

            if (improvedTranscription && improvedTranscription.length > 0) {
                logger.info('Transcrição melhorada com IA', {
                    original: transcription,
                    melhorada: improvedTranscription,
                    userId
                });
                return improvedTranscription;
            }

            // Se falhar, retorna o original
            return transcription;

        } catch (err) {
            logger.error('Erro ao melhorar transcrição com IA', { 
                error: err.message,
                transcription,
                userId
            });
            return transcription; // Retorna original em caso de erro
        }
    }

    async transcribeAudio(filePath, audioHash, userId = null, retries = 2) {
        const startTime = Date.now();
        
        // Configuração do modelo - pode ser ajustada conforme necessidade
        // Modelos disponíveis: tiny, base, small, medium, large
        // 'small' oferece boa precisão sem ser muito lento
        // 'medium' é ainda melhor mas mais lento
        const modelName = this.currentModel; // Pode ser alterado para 'medium' se quiser mais precisão
        
        return new Promise((resolve, reject) => {
            execFile('python', ['transcrever_audio.py', filePath, modelName], async (error, stdout, stderr) => {
                const processingTime = Date.now() - startTime;
                
                if (error) {
                    logger.error('Erro na transcrição', { 
                        error: error.message,
                        stderr,
                        retries,
                        processingTime,
                        modelName,
                        userId
                    });
                    
                    if (retries > 0) {
                        logger.info('Tentando novamente...', { retries, modelName });
                        setTimeout(() => {
                            this.transcribeAudio(filePath, audioHash, userId, retries - 1)
                                .then(resolve)
                                .catch(reject);
                        }, 2000);
                        return;
                    }
                    
                    reject(new Error(`Falha na transcrição após ${retries + 1} tentativas`));
                    return;
                }

                // Processa a saída
                const linhas = stdout.split('\n').map(l => l.trim()).filter(Boolean);
                const textoTranscrito = linhas[0];
                
                if (!textoTranscrito || textoTranscrito.length < 2) {
                    reject(new Error('Transcrição vazia ou muito curta'));
                    return;
                }

                // Aplica melhorias com IA usando sistema modular
                const textoMelhorado = await this.improveTranscriptionWithAI(textoTranscrito, userId);
                
                logger.info('Transcrição processada', {
                    original: textoTranscrito,
                    melhorada: textoMelhorado,
                    audioHash,
                    processingTime,
                    modelName,
                    userId
                });

                // Atualiza estatísticas
                this.audioStats.totalProcessed++;
                this.audioStats.successfulTranscriptions++;
                this.audioStats.totalProcessingTime += processingTime;
                this.audioStats.averageProcessingTime = 
                    this.audioStats.totalProcessingTime / this.audioStats.totalProcessed;

                resolve(textoMelhorado);
            });
        });
    }

    async processAudioMessage(client, message) {
        const startTime = Date.now();
        const audioHash = this.generateAudioHash(message.data);
        
        // Verifica se já está processando este áudio
        if (this.processingAudios.has(audioHash)) {
            logger.info('Áudio já está sendo processado', { audioHash });
            await client.sendText(message.from, '🔄 Este áudio já está sendo processado. Aguarde um momento...');
            return;
        }

        // Marca como processando
        this.processingAudios.set(audioHash, true);
        
        try {
            // Busca informações do cliente para personalização
            const { buscarCliente } = require('../database');
            const cliente = await buscarCliente(message.from);
            const userId = cliente ? cliente.id : null;

            logger.info('Iniciando processamento de áudio', {
                from: message.from,
                audioHash,
                size: message.data.length,
                userId
            });

            // Valida o áudio
            await this.validateAudio(message.data);

            // Salva o arquivo de áudio
            const fileName = `audio${this.audioCounter}.ogg`;
            const filePath = path.join(this.audioDir, fileName);
            
            fs.writeFileSync(filePath, message.data);
            this.audioCounter++;

            logger.info('Áudio salvo', { fileName, filePath });

            // Transcreve o áudio
            const transcription = await this.transcribeAudio(filePath, audioHash, userId);
            
            // Processa o resultado
            await this.handleTranscriptionResult(client, message, transcription, startTime, userId);

        } catch (error) {
            logger.error('Erro no processamento de áudio', {
                error: error.message,
                audioHash,
                from: message.from
            });

            this.audioStats.failedTranscriptions++;
            
            await client.sendText(message.from, 
                '❌ Erro ao processar seu áudio. Verifique se o arquivo é válido e tente novamente.'
            );
        } finally {
            // Remove da lista de processamento
            this.processingAudios.delete(audioHash);
        }
    }

    async handleTranscriptionResult(client, message, transcription, startTime, userId = null) {
        const processingTime = Date.now() - startTime;
        
        logger.info('Resultado da transcrição', {
            transcription,
            processingTime,
            userId
        });

        // Envia a transcrição para o usuário
        await client.sendText(message.from, 
            `🎵 *Transcrição do seu áudio:*\n\n"${transcription}"\n\n` +
            `⏱️ Processado em ${processingTime}ms`
        );

        // Processa a transcrição como uma mensagem normal
        try {
            const { buscarCliente, atualizarHistorico, buscarHistorico } = require('../database');
            
            // Busca ou cadastra cliente
            let cliente = await buscarCliente(message.from);
            if (!cliente) {
                cliente = await cadastrarCliente(message.from);
            }

            // Atualiza histórico com a transcrição
            await atualizarHistorico(cliente.id, transcription, 'user');

            // Busca histórico para contexto
            const historico = await buscarHistorico(cliente.id);

            // Gera resposta usando o sistema modular
            const resposta = await handleMessage(historico, transcription, cliente.id);

            if (resposta) {
                // Envia resposta
                await simularRespostaHumana(client, message.from, resposta);
                
                // Atualiza histórico com a resposta
                await atualizarHistorico(cliente.id, resposta, 'assistant');
            }

        } catch (error) {
            logger.error('Erro ao processar resposta da transcrição', {
                error: error.message,
                transcription,
                userId
            });
            
            await client.sendText(message.from, 
                '❌ Erro ao gerar resposta para sua transcrição. Tente novamente.'
            );
        }
    }

    getStats() {
        return {
            ...this.audioStats,
            currentlyProcessing: this.processingAudios.size,
            cacheSize: 0 // Cache removido na versão atual
        };
    }

    changeModel(newModel) {
        const validModels = ['tiny', 'base', 'small', 'medium', 'large'];
        
        if (!validModels.includes(newModel)) {
            throw new Error(`Modelo inválido. Modelos válidos: ${validModels.join(', ')}`);
        }
        
        this.currentModel = newModel;
        logger.info('Modelo do Whisper alterado', { newModel });
        return newModel;
    }

    getModel() {
        return this.currentModel;
    }
}

module.exports = new AudioProcessor(); 