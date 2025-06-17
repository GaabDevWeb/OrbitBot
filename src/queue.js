const EventEmitter = require('events');

class MessageQueue extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.processing = false;
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    addMessage(message) {
        const queueItem = {
            message,
            retries: 0,
            timestamp: Date.now()
        };

        this.queue.push(queueItem);

        if (!this.processing) {
            this.processQueue();
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
                        this.addMessage(item.message);
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