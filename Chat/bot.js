// bot.js (Arquivo principal na raiz do projeto)
require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const { verificarStatusApiGemini } = require('./services/geminiService');
const { initializePool, getPool } = require('./config/db'); // Mantenha initializePool e getPool
const { iniciarModoTesteLocal, rl } = require('./utils/localTester');
const { initializeWhatsAppClient, client } = require('./whatsapp/client'); // client importado aqui
const { setupShutdownHandlers, shutdown } = require('./utils/shutdown');
const { userContext } = require('./core/userContext');
const { carregarPostsLocais, carregarStaticQA, carregarFreeTierQA } = require('./services/localDataService');


const MODO_TESTE_LOCAL = (process.env.MODO_TESTE_LOCAL === 'false') || false;
let whatsappClientInstance = null;
let dbPoolInstance = null;

async function startApp() {
    console.log("🚀 Iniciando Fozzi Bot...");

    // Carregamento de dados locais (tornando não bloqueante)
    try {
        await carregarPostsLocais();
        await carregarStaticQA();
        await carregarFreeTierQA();
        console.log("✅ Dados locais carregados com sucesso");
    } catch (dataError) {
        console.warn("⚠️ Erro ao carregar dados locais:", dataError.message);
    }

    // Verificação da API Gemini (tornando não bloqueante)
    let apiGeminiOk = false;
    try {
        apiGeminiOk = await verificarStatusApiGemini();
        console.log(apiGeminiOk ? "✅ API Gemini OK" : "⚠️ API Gemini não disponível");
    } catch (geminiError) {
        console.warn("⚠️ Erro ao verificar API Gemini:", geminiError.message);
    }


    // Inicialização e teste da conexão com o banco de dados (tornando não bloqueante)
    let dbOk = false;
    try {
        await initializePool();
        dbPoolInstance = getPool();
        dbOk = true;
        console.log("✅ Conexão com BD estabelecida com sucesso");
    } catch (dbInitError) {
        console.warn("⚠️ Falha na conexão com BD:", dbInitError.message);
        dbOk = false;
    }

    // Modo WhatsApp ou Teste Local
    if (MODO_TESTE_LOCAL) {
        console.log("\n🧪 === MODO DE TESTE LOCAL INTERATIVO ATIVADO ===");
        console.log(`API Gemini: ${apiGeminiOk ? 'OK' : 'Limitada'}`);
        console.log(`BD: ${dbOk ? 'OK' : 'Desabilitado'}`);

        const userKeyLocal = `local_TesterInterativo`;
        if (!userContext[userKeyLocal]) {
            userContext[userKeyLocal] = { language: 'por', firstInteraction: true, awaitingMenuChoice: false, currentTopic: null, itineraryStage: null, staticFlowStage: null, staticFlowData: {}, activePlan: 'free', personaModifier: null, offeredMenuAfterFallback: false };
        }
        iniciarModoTesteLocal();
    } else {
        console.log("\n📱 === MODO WHATSAPP ATIVADO ===");
        console.log(`API Gemini: ${apiGeminiOk ? 'OK' : 'Limitada'}`);
        console.log(`BD: ${dbOk ? 'OK' : 'Desabilitado'}`);

        try {
            console.log("🔄 Inicializando cliente WhatsApp...");
            await initializeWhatsAppClient();
            whatsappClientInstance = client();
            console.log("✅ Cliente WhatsApp inicializado com sucesso!");
        } catch (initError) {
            console.error("❌ Erro na inicialização do cliente WhatsApp:", initError.message);
            throw initError;
        }
    }

    setupShutdownHandlers(MODO_TESTE_LOCAL ? null : whatsappClientInstance, dbPoolInstance, MODO_TESTE_LOCAL ? rl : null);

    console.log("🎉 Fozzi Bot pronto e rodando!");
}

app.get('/', (req, res) => {
    res.status(200).send('Fozzi Bot está online e pronto para ajudar turistas!');
});

app.listen(port, () => {
    console.log(`🌐 Servidor HTTP rodando na porta ${port}`);
    console.log(`🔗 Acesse: http://localhost:${port}`);

    // Chama a função principal de inicialização da lógica APÓS o Express estar ativo
    console.log("🔄 Iniciando lógica principal do bot...");
    startApp().catch(err => {
        console.error("💥 Erro fatal na execução:", err.message || err);
        process.exit(1);
    });
});