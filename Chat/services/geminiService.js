const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const config = require('../config'); // Usa o index.js da pasta config
const { formatarLinkMapa } = require('../utils/helpers'); // Se Gemini puder gerar MAPS_TARGET

let model;
if (process.env.GOOGLE_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    model = genAI.getGenerativeModel({
        model: config.NOME_MODELO_GEMINI,
        safetySettings: [ // Exemplo de configurações de segurança
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
        // generationConfig: { temperature: 0.7, topP: 0.9, topK: 40 } // Você pode ajustar
    });
    config.model = model; // Armazena o modelo inicializado no objeto config
} else {
    console.warn("[GEMINI INIT ERRO] GOOGLE_API_KEY não encontrada nas variáveis de ambiente. O Gemini não funcionará.");
}

async function verificarStatusApiGemini() {
    if (!process.env.GOOGLE_API_KEY || !model) { // Verifica o 'model' que foi inicializado
        console.warn("[API CHECK] GOOGLE_API_KEY não definida ou modelo Gemini não inicializado. Gemini não funcionará.");
        return false;
    }
    console.log(`\n[API CHECK] Verificando a conexão com a API do Gemini (${config.NOME_MODELO_GEMINI})...`);
    try {
        const result = await model.generateContent("Olá, API Gemini! Isto é um teste de conectividade curto e direto.");
        const response = await result.response;
        const text = response.text();
        if (text) {
            console.log("[API CHECK] SUCESSO! A API do Gemini respondeu ao teste de conectividade.");
            return true;
        } else {
            console.warn("[API CHECK] ALERTA: A API do Gemini respondeu, mas a resposta do teste está vazia ou bloqueada. Verifique o promptFeedback:", response.promptFeedback);
            return false;
        }
    } catch (error) {
        console.error("[API CHECK] FALHA! Erro ao tentar conectar com a API do Gemini:");
        if (error.message) console.error(`  Mensagem do erro: ${error.message}`);
        // Adicionar mais detalhes do erro se disponíveis (pode variar com a biblioteca)
        if (error.response && error.response.promptFeedback) {
            console.error("  Prompt Feedback:", error.response.promptFeedback);
        } else if (error.cause) {
            console.error("  Causa do Erro:", error.cause);
        }
        return false;
    }
}

async function processarMensagemComGemini(promptCompleto, autor, nomeIdiomaParaResposta) {
    if (!model) {
        console.error("[GEMINI ERRO] Modelo Gemini não inicializado. Verifique a GOOGLE_API_KEY.");
        const fallbackMatch = config.INSTRUCAO_PERSONA_BASE.match(/"(Arara! 😅 [^"]*em \[IDIOMA][^"]*)"/);
        let fallbackMsg = `Desculpe, ${config.NOME_BOT} está com dificuldade para se conectar à sua inteligência principal neste momento. 🛠️ Por favor, tente mais tarde.`;
        if (fallbackMatch && fallbackMatch[1]) {
            fallbackMsg = fallbackMatch[1].replace("[IDIOMA]", nomeIdiomaParaResposta || "Português");
        }
        return fallbackMsg;
    }

    try {
        console.log(`\n[GEMINI REQ] Enviando prompt para ${autor} (Idioma: ${nomeIdiomaParaResposta}). Início do prompt: "${(promptCompleto || "").substring(0, 250)}..."`);

        const result = await model.generateContent(promptCompleto);
        const response = await result.response;

        console.log("[GEMINI RESP RAW] Resposta bruta recebida da API (antes de text()):", JSON.stringify(response, null, 2)); // Log da resposta completa

        let respostaGemini = "";
        if (response && typeof response.text === 'function') {
            respostaGemini = response.text();
        }

        console.log(`[GEMINI RESP TEXT] Texto extraído de response.text(): "${(respostaGemini || "").substring(0, 200)}..."`);

        if (!respostaGemini && response && response.promptFeedback) {
            console.warn("[GEMINI WARN] Resposta de texto vazia, verificando promptFeedback:", response.promptFeedback);
            if (response.promptFeedback.blockReason) {
                const blockMessage = `Minha inteligência artificial bloqueou a resposta por: ${response.promptFeedback.blockReason} (${response.promptFeedback.blockReasonMessage || 'sem detalhes adicionais'}). Poderia reformular sua pergunta, por favor? 😇`;
                console.log("[GEMINI] Conteúdo bloqueado, retornando mensagem:", blockMessage);
                return blockMessage;
            } else {
                console.warn("[GEMINI WARN] Resposta de texto vazia, mas sem blockReason específico no promptFeedback.");
            }
        }

        let respostaFinalParaUsuario = respostaGemini || ""; // Garante que seja uma string

        // Se Gemini gerar MAPS_TARGET, formatarLinkMapa será chamado em handleCoreLogic
        // Aqui, apenas garantimos que o formato do MAPS_TARGET esteja correto se Gemini o criar.
        // (A instrução para Gemini criar MAPS_TARGET está na INSTRUCAO_PERSONA_BASE)

        if (!respostaFinalParaUsuario.trim()) {
            console.warn("[GEMINI WARN] Resposta final do Gemini está vazia ou apenas espaços após processamento.");
            return `Hum, pensei um pouco aqui, mas não consegui formular uma resposta clara para "${promptCompleto.substring(promptCompleto.lastIndexOf("Usuário:")+8, 200)}...". 🤔 Poderia tentar perguntar de outra forma?`;
        }

        console.log(`[GEMINI] Resposta gerada para ${autor}: "${respostaFinalParaUsuario.substring(0,100)}..."`);
        return respostaFinalParaUsuario;

    } catch (error) {
        console.error(`[GEMINI ERRO FATAL] Erro ao gerar conteúdo com Gemini para ${autor}:`, error);
        if (error.message) console.error(`  Detalhe do erro Gemini: ${error.message}`);
        if (error.status) console.error(`  Status do erro Gemini: ${error.status}`); // Para erros da API do Google
        if (error.response && error.response.promptFeedback) {
            console.error("  Prompt Feedback do Erro:", error.response.promptFeedback);
        } else if (error.cause) {
            console.error("  Causa Raiz do Erro:", error.cause);
        }
        // Tenta pegar a mensagem de erro específica da API do Google, se disponível
        let specificApiErrorMsg = "";
        if (error.message && error.message.includes("API key not valid")) {
            specificApiErrorMsg = "Parece que há um problema com a minha chave de acesso à inteligência. Vou avisar meus criadores!";
        } else if (error.message && error.message.toLowerCase().includes("quota")) {
            specificApiErrorMsg = "Atingi meu limite de consultas à inteligência por agora. Tente mais tarde, por favor!";
        }


        const fallbackMatch = config.INSTRUCAO_PERSONA_BASE.match(/"(Arara! 😅 [^"]*em \[IDIOMA][^"]*)"/);
        let fallbackMsg = specificApiErrorMsg || `Desculpe, ${config.NOME_BOT} encontrou um grande soluço tropical ao tentar pensar na sua pergunta. 🦜 Poderia tentar de novo daqui a pouquinho?`;
        if (!specificApiErrorMsg && fallbackMatch && fallbackMatch[1]) { // Só usa Arara se não for erro específico de API
            fallbackMsg = fallbackMatch[1].replace("[IDIOMA]", nomeIdiomaParaResposta || "Português");
        }
        return fallbackMsg;
    }
}

module.exports = {
    verificarStatusApiGemini,
    processarMensagemComGemini,
};