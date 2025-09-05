// /config/gemini.js
const { GoogleGenerativeAI, GoogleGenerativeAIResponseError } = require("@google/generative-ai");

let model = null;
const NOME_MODELO_GEMINI = "gemini-1.5-flash-latest";

if (process.env.GOOGLE_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        model = genAI.getGenerativeModel({ model: NOME_MODELO_GEMINI });
        console.log(`[GEMINI] Modelo Gemini (${NOME_MODELO_GEMINI}) inicializado com sucesso.`);
    } catch (e) {
        console.error("[GEMINI INIT ERRO] Falha ao inicializar o modelo Gemini.", e);
        model = null;
    }
} else {
    console.warn("[GEMINI INIT WARN] GOOGLE_API_KEY não definida. Funcionalidades de IA generativa estarão desabilitadas.");
    model = null;
}

module.exports = { model, GoogleGenerativeAIResponseError, NOME_MODELO_GEMINI };