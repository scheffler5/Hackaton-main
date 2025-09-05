// /services/weatherService.js
const axios = require('axios');

// Coordenadas de Foz do Iguaçu (Lat/Lon)
const FOZ_LAT = -25.5478;
const FOZ_LON = -54.5882;

// Mapeia ícones do OpenWeather para emojis
const weatherIcons = {
    '01d': '☀️',
    '01n': '🌙', // Céu limpo
    '02d': '🌤️',
    '02n': '🌤️', // Poucas nuvens
    '03d': '🌥️',
    '03n': '🌥️', // Nuvens dispersas
    '04d': '☁️',
    '04n': '☁️', // Nublado
    '09d': '🌦️',
    '09n': '🌦️', // Chuva de banho
    '10d': '🌧️',
    '10n': '🌧️', // Chuva
    '11d': '⛈️',
    '11n': '⛈️', // Tempestade
    '13d': '🌨️',
    '13n': '🌨️', // Neve
    '50d': '🌫️',
    '50n': '🌫️', // Névoa
};

async function obterPrevisaoTempo() {
    // A chave DEVE vir do seu arquivo .env
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
        console.error("[WEATHER] Chave da API da OpenWeather não encontrada em .env");
        return "Ops, parece que meu radar meteorológico está fora do ar! Não consegui buscar a previsão do tempo agora.";
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${FOZ_LAT}&lon=${FOZ_LON}&appid=${apiKey}&units=metric&lang=pt_br`;

    try {
        console.log("[WEATHER] Buscando previsão do tempo na OpenWeather...");
        const { data } = await axios.get(url);

        if (!data || !data.main || !data.weather) {
            throw new Error("Resposta da API de clima está incompleta.");
        }

        const descricao = data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);
        const icone = weatherIcons[data.weather[0].icon] || '🌡️';
        const tempAtual = Math.round(data.main.temp);
        const sensacao = Math.round(data.main.feels_like);
        const min = Math.round(data.main.temp_min);
        const max = Math.round(data.main.temp_max);
        const umidade = data.main.humidity;

        const respostaFormatada =
            `🌦️ **Previsão do Tempo para Foz do Iguaçu agora:**
-------------------------------------
${icone} ${descricao}
🌡️ Temperatura: ${tempAtual}°C (Sensação de ${sensacao}°C)
🔼 Máxima hoje: ${max}°C
🔽 Mínima hoje: ${min}°C
💧 Umidade: ${umidade}%
-------------------------------------
Lembre-se que o tempo por aqui pode mudar rapidinho, viu? 😉`;

        return respostaFormatada;

    } catch (err) {
        console.error("[WEATHER ERRO] Erro ao buscar previsão do tempo:", err.message);
        return "🦜 Desculpe, uma nuvem de chuva passou pelo meu sistema e não consegui buscar a previsão do tempo! Tente de novo daqui a pouco.";
    }
}

module.exports = { obterPrevisaoTempo };