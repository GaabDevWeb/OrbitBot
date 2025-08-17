const EventEmitter = require('events');
const logger = require('./logger');

class MessageQueue extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.processing = false;
        this.maxRetries = 3;
        this.retryDelay = 1000;

        // Buffer por cliente: { messages: string[], timer: NodeJS.Timeout, lastAt: number }
        this.buffers = new Map(); // key: from, value: bufferEntry
        this.BUFFER_MS = 15000; // 15 segundos
    }

    // Enfileira um item pronto para processamento imediato (já combinado)
    _enqueueCombined(from, combinedBody) {
        const queueItem = {
            message: { from, body: combinedBody },
            retries: 0,
            timestamp: Date.now()
        };
        this.queue.push(queueItem);
        if (!this.processing) {
            this.processQueue();
        }
    }

    // Faz o flush do buffer de um cliente específico
    _flushBuffer(from) {
        const entry = this.buffers.get(from);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.buffers.delete(from);

        const combinedBody = entry.messages.join('\n');
        logger.queue('Buffer expirado: enviando mensagens combinadas', {
            from,
            count: entry.messages.length,
            preview: combinedBody.slice(0, 120)
        });
        this._enqueueCombined(from, combinedBody);
    }

    // Adiciona mensagem recebida ao buffer do remetente
    addMessage(message) {
        const { from, body } = message;
        if (!from) return; // segurança

        const now = Date.now();
        const existing = this.buffers.get(from);

        if (existing) {
            // Acrescenta e reinicia o timer para segurar mais 15s
            existing.messages.push(body || '');
            existing.lastAt = now;
            clearTimeout(existing.timer);
            existing.timer = setTimeout(() => this._flushBuffer(from), this.BUFFER_MS);
            this.buffers.set(from, existing);
            logger.queue('Buffer estendido', {
                from,
                count: existing.messages.length,
                remainingMs: this.BUFFER_MS
            });
        } else {
            // Cria novo buffer e agenda flush
            const timer = setTimeout(() => this._flushBuffer(from), this.BUFFER_MS);
            this.buffers.set(from, {
                messages: [body || ''],
                timer,
                lastAt: now
            });
            logger.queue('Buffer iniciado', {
                from,
                count: 1,
                ttlMs: this.BUFFER_MS
            });
        }
    }

    async processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (this.hasMessages()) {
            const item = this.getNextMessage();
            if (!item) break;

            try {
                await this.emit('process', item.message);
            } catch (error) {
                console.error('Erro ao processar mensagem:', error);

                if (item.retries < this.maxRetries) {
                    item.retries++;
                    setTimeout(() => {
                        // re-enfileira mantendo o mesmo payload combinado
                        this.queue.push(item);
                        if (!this.processing) this.processQueue();
                    }, this.retryDelay * item.retries);
                } else {
                    this.emit('error', {
                        message: item.message,
                        error,
                        retries: item.retries
                    });
                }
            }
        }

        this.processing = false;
    }

    hasMessages() {
        return this.queue.length > 0;
    }

    getNextMessage() {
        return this.queue.shift();
    }

    getQueueSize() {
        return this.queue.length;
    }
}

module.exports = new MessageQueue();