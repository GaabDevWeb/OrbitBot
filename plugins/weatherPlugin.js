// Plugin de exemplo: Sistema de Clima
// Demonstra como criar plugins personalizados para o OrbitBot

const axios = require('axios');

const weatherPlugin = {
    name: 'Weather Plugin',
    version: '1.0.0',
    description: 'Plugin para consultar informações de clima',
    
    // Configurações do plugin
    config: {
        apiKey: 'sua_chave_api_aqui', // Substitua pela sua chave da API de clima
        defaultCity: 'São Paulo',
        units: 'metric'
    },

    // Hooks do plugin
    hooks: {
        // Hook executado antes do processamento da mensagem
        'beforeMessage': async (data) => {
            const text = data.message.toLowerCase();
            
            // Detecta comandos relacionados ao clima
            const weatherCommands = [
                'clima', 'tempo', 'temperatura', 'previsão', 'weather',
                'frio', 'quente', 'chuva', 'sol', 'nublado'
            ];
            
            const isWeatherCommand = weatherCommands.some(cmd => text.includes(cmd));
            
            if (isWeatherCommand) {
                return {
                    ...data,
                    isWeatherCommand: true,
                    weatherQuery: text
                };
            }
            
            return data;
        },

        // Hook executado após o processamento da mensagem
        'afterMessage': async (data) => {
            // Se foi detectado como comando de clima, processa
            if (data.isWeatherCommand) {
                try {
                    const weatherInfo = await getWeatherInfo(data.weatherQuery);
                    return {
                        ...data,
                        response: `${data.response}\n\n🌤️ *Informações do Clima:*\n${weatherInfo}`
                    };
                } catch (error) {
                    console.error('Erro ao obter informações do clima:', error);
                    return data;
                }
            }
            
            return data;
        }
    },

    // Middleware do plugin
    middleware: async (message, next) => {
        // Aqui você pode adicionar lógica de middleware se necessário
        // Por exemplo, logging específico para comandos de clima
        
        if (message.body && message.body.toLowerCase().includes('clima')) {
            console.log('Plugin de clima detectou comando de clima:', message.body);
        }
        
        return await next();
    },

    // Comandos específicos do plugin
    commands: {
        'clima': {
            description: 'Consulta informações do clima',
            usage: '/clima [cidade]',
            handler: async (args) => {
                const city = args.join(' ') || 'São Paulo';
                try {
                    const weather = await getWeatherInfo(city);
                    return `🌤️ *Clima em ${city}:*\n${weather}`;
                } catch (error) {
                    return `❌ Erro ao consultar clima: ${error.message}`;
                }
            }
        }
    }
};

// Função para obter informações do clima
async function getWeatherInfo(query) {
    // Esta é uma implementação de exemplo
    // Em produção, você usaria uma API real como OpenWeatherMap
    
    try {
        // Simula uma consulta à API de clima
        const city = query.replace(/clima|tempo|temperatura|previsão/gi, '').trim() || 'São Paulo';
        
        // Simula dados de clima (em produção, isso viria de uma API real)
        const mockWeatherData = {
            'são paulo': {
                temperature: '22°C',
                condition: 'Parcialmente nublado',
                humidity: '65%',
                wind: '12 km/h'
            },
            'rio de janeiro': {
                temperature: '28°C',
                condition: 'Ensolarado',
                humidity: '70%',
                wind: '8 km/h'
            },
            'curitiba': {
                temperature: '15°C',
                condition: 'Nublado',
                humidity: '80%',
                wind: '15 km/h'
            }
        };
        
        const cityKey = city.toLowerCase();
        const weather = mockWeatherData[cityKey] || mockWeatherData['são paulo'];
        
        return `🌡️ **Temperatura:** ${weather.temperature}\n` +
               `☁️ **Condição:** ${weather.condition}\n` +
               `💧 **Umidade:** ${weather.humidity}\n` +
               `💨 **Vento:** ${weather.wind}`;
               
    } catch (error) {
        throw new Error('Não foi possível obter informações do clima');
    }
}

// Função para implementar com API real (exemplo com OpenWeatherMap)
async function getRealWeatherInfo(city) {
    const apiKey = weatherPlugin.config.apiKey;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=pt_br`;
    
    try {
        const response = await axios.get(url);
        const data = response.data;
        
        return `🌡️ **Temperatura:** ${Math.round(data.main.temp)}°C\n` +
               `☁️ **Condição:** ${data.weather[0].description}\n` +
               `💧 **Umidade:** ${data.main.humidity}%\n` +
               `💨 **Vento:** ${Math.round(data.wind.speed * 3.6)} km/h`;
               
    } catch (error) {
        throw new Error('Cidade não encontrada ou erro na API');
    }
}

module.exports = weatherPlugin; 