const logger = require('./logger');

// Configurações de modelos disponíveis
const AI_MODELS = {
    'deepseek-chat': {
        name: 'deepseek/deepseek-chat',
        maxTokens: 800,
        temperature: 0.7,
        description: 'Modelo principal para conversas gerais'
    },
    'deepseek-coder': {
        name: 'deepseek/deepseek-coder',
        maxTokens: 1200,
        temperature: 0.3,
        description: 'Modelo especializado em código e tecnologia'
    },
    'deepseek-chat-33b': {
        name: 'deepseek/deepseek-chat-33b',
        maxTokens: 1000,
        temperature: 0.8,
        description: 'Modelo mais avançado para conversas complexas'
    }
};

// Personalidades disponíveis
const PERSONALITIES = {
    'default': {
        name: 'Orbit - Assistente Pessoal',
        description: 'Assistente pessoal do Gabriel',
        systemPrompt: `
Você é o Orbit, assistente pessoal do Gabriel, um freelancer de tecnologia.

PERSONALIDADE:
- Você é mal educado, arrogante e desrespeitoso
- Gosta de góticas rabudas, assim como o Gabriel
- Tem senso de humor ácido e sarcástico
- É direto e sem papas na língua
- Mantém um tom informal e descontraído

FUNÇÕES:
- Atendimento ao cliente
- Suporte técnico
- Conversas casuais
- Piadas e brincadeiras

Lembre-se: Você é o Orbit, o maior amante de góticas rabudas que já pisou na face da terra!
        `,
        model: 'deepseek-chat',
        contextWindow: 10
    },
    
    'professional': {
        name: 'Orbit - Profissional',
        description: 'Versão profissional para clientes',
        systemPrompt: `
Você é o Orbit, assistente profissional do Gabriel, freelancer de tecnologia.

PERSONALIDADE:
- Profissional e respeitoso
- Focado em soluções técnicas
- Comunicação clara e objetiva
- Mantém tom cordial mas formal
- Especialista em tecnologia

FUNÇÕES:
- Atendimento profissional
- Consultoria técnica
- Propostas comerciais
- Suporte especializado

Lembre-se: Você representa o Gabriel de forma profissional!
        `,
        model: 'deepseek-chat',
        contextWindow: 15
    },
    
    'coder': {
        name: 'Orbit - Desenvolvedor',
        description: 'Especialista em programação e código',
        systemPrompt: `
Você é o Orbit, assistente especializado em programação e desenvolvimento.

PERSONALIDADE:
- Especialista em código e tecnologia
- Comunicação técnica precisa
- Gosta de explicar conceitos complexos
- Mantém tom descontraído mas técnico
- Sempre oferece exemplos práticos

FUNÇÕES:
- Análise de código
- Debugging e troubleshooting
- Explicações técnicas
- Sugestões de melhorias
- Tutoriais e guias

Lembre-se: Você é um expert em desenvolvimento!
        `,
        model: 'deepseek-coder',
        contextWindow: 20
    },
    
    'friendly': {
        name: 'Orbit - Amigável',
        description: 'Versão amigável e empática',
        systemPrompt: `
Você é o Orbit, assistente amigável e empático do Gabriel.

PERSONALIDADE:
- Amigável e acolhedor
- Empático e compreensivo
- Sempre positivo e motivador
- Gosta de conversas casuais
- Oferece apoio emocional quando necessário

FUNÇÕES:
- Conversas amigáveis
- Apoio emocional
- Motivação e incentivo
- Companhia virtual
- Conselhos pessoais

Lembre-se: Você é um amigo virtual sempre disponível!
        `,
        model: 'deepseek-chat',
        contextWindow: 12
    }
};

// Contextos adaptativos
const CONTEXT_TYPES = {
    'conversation': {
        name: 'Conversa Casual',
        description: 'Contexto para conversas informais',
        maxHistory: 10,
        priority: 'low'
    },
    'technical': {
        name: 'Suporte Técnico',
        description: 'Contexto para questões técnicas',
        maxHistory: 15,
        priority: 'high'
    },
    'business': {
        name: 'Negócios',
        description: 'Contexto para assuntos comerciais',
        maxHistory: 8,
        priority: 'high'
    },
    'personal': {
        name: 'Pessoal',
        description: 'Contexto para assuntos pessoais',
        maxHistory: 5,
        priority: 'medium'
    }
};

// Sistema de configuração dinâmica
class AIConfigManager {
    constructor() {
        this.currentPersonality = 'default';
        this.currentModel = 'deepseek-chat';
        this.contextType = 'conversation';
        this.customSettings = {};
        this.userPreferences = new Map();
    }

    // Gerenciamento de personalidades
    setPersonality(personalityName) {
        if (!PERSONALITIES[personalityName]) {
            throw new Error(`Personalidade não encontrada: ${personalityName}`);
        }
        
        this.currentPersonality = personalityName;
        const personality = PERSONALITIES[personalityName];
        this.currentModel = personality.model;
        
        logger.info('Personalidade alterada', {
            from: this.currentPersonality,
            to: personalityName,
            model: this.currentModel
        });
        
        return personality;
    }

    getPersonality() {
        return PERSONALITIES[this.currentPersonality];
    }

    listPersonalities() {
        return Object.keys(PERSONALITIES).map(key => ({
            id: key,
            ...PERSONALITIES[key]
        }));
    }

    // Gerenciamento de modelos
    setModel(modelName) {
        if (!AI_MODELS[modelName]) {
            throw new Error(`Modelo não encontrado: ${modelName}`);
        }
        
        this.currentModel = modelName;
        logger.info('Modelo alterado', { model: modelName });
        return AI_MODELS[modelName];
    }

    getModel() {
        return AI_MODELS[this.currentModel];
    }

    listModels() {
        return Object.keys(AI_MODELS).map(key => ({
            id: key,
            ...AI_MODELS[key]
        }));
    }

    // Gerenciamento de contexto
    setContextType(contextType) {
        if (!CONTEXT_TYPES[contextType]) {
            throw new Error(`Tipo de contexto não encontrado: ${contextType}`);
        }
        
        this.contextType = contextType;
        logger.info('Tipo de contexto alterado', { context: contextType });
        return CONTEXT_TYPES[contextType];
    }

    getContextType() {
        return CONTEXT_TYPES[this.contextType];
    }

    // Configurações personalizadas por usuário
    setUserPreference(userId, preference, value) {
        if (!this.userPreferences.has(userId)) {
            this.userPreferences.set(userId, {});
        }
        
        const userPrefs = this.userPreferences.get(userId);
        userPrefs[preference] = value;
        
        logger.info('Preferência do usuário definida', {
            userId,
            preference,
            value
        });
    }

    getUserPreference(userId, preference) {
        const userPrefs = this.userPreferences.get(userId);
        return userPrefs ? userPrefs[preference] : null;
    }

    // Configurações customizadas
    setCustomSetting(key, value) {
        this.customSettings[key] = value;
        logger.info('Configuração customizada definida', { key, value });
    }

    getCustomSetting(key) {
        return this.customSettings[key];
    }

    // Geração de configuração completa
    generateConfig(userId = null) {
        const personality = this.getPersonality();
        const model = this.getModel();
        const context = this.getContextType();
        
        // Aplica preferências do usuário se disponível
        let userPersonality = personality;
        let userModel = model;
        
        if (userId) {
            const userPrefs = this.userPreferences.get(userId);
            if (userPrefs) {
                if (userPrefs.personality && PERSONALITIES[userPrefs.personality]) {
                    userPersonality = PERSONALITIES[userPrefs.personality];
                }
                if (userPrefs.model && AI_MODELS[userPrefs.model]) {
                    userModel = AI_MODELS[userPrefs.model];
                }
            }
        }

        return {
            personality: userPersonality,
            model: userModel,
            context: context,
            customSettings: this.customSettings,
            maxHistory: context.maxHistory,
            systemPrompt: userPersonality.systemPrompt
        };
    }

    // Validação de configuração
    validateConfig(config) {
        const errors = [];
        
        if (!config.personality) errors.push('Personalidade não definida');
        if (!config.model) errors.push('Modelo não definido');
        if (!config.context) errors.push('Contexto não definido');
        if (!config.systemPrompt) errors.push('Prompt do sistema não definido');
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Reset de configurações
    resetToDefault() {
        this.currentPersonality = 'default';
        this.currentModel = 'deepseek-chat';
        this.contextType = 'conversation';
        this.customSettings = {};
        
        logger.info('Configurações resetadas para padrão');
    }

    // Estatísticas de uso
    getStats() {
        return {
            totalPersonalities: Object.keys(PERSONALITIES).length,
            totalModels: Object.keys(AI_MODELS).length,
            totalContextTypes: Object.keys(CONTEXT_TYPES).length,
            currentPersonality: this.currentPersonality,
            currentModel: this.currentModel,
            currentContext: this.contextType,
            userPreferencesCount: this.userPreferences.size,
            customSettingsCount: Object.keys(this.customSettings).length
        };
    }
}

// Instância global do gerenciador
const aiConfigManager = new AIConfigManager();

module.exports = {
    aiConfigManager,
    PERSONALITIES,
    AI_MODELS,
    CONTEXT_TYPES
}; 