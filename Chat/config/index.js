// /config/index.js
const dbConfig = require('./db');
const geminiConfig = require('./gemini');
const botParams = require('./botParameters');

module.exports = {
    ...dbConfig, // pool, testarConexaoDB
    ...geminiConfig, // model, GoogleGenerativeAIResponseError, NOME_MODELO_GEMINI
    ...botParams, // Todas as constantes do bot
};