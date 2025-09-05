// /utils/localTester.js
const readline = require('readline');
const { handleCoreLogic } = require('../core/handleCoreLogic');
const { userContext } = require('../core/userContext'); // Importa o userContext compartilhado
const config = require('../config');
const { pool } = require('../config/db'); // Para fechar o pool no 'close' do readline

// rl deve ser uma instância única
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function testarBotLocalmenteWrapper(textoDoPrompt, autorSimulado = "TesterLocal", idiomaForcadoParam = null) {
    const userKey = `local_${autorSimulado.replace(/\s+/g, '')}`;
    if (!userContext[userKey]) { // Garante que o contexto exista
        userContext[userKey] = { language: idiomaForcadoParam || 'por', firstInteraction: true, awaitingMenuChoice: false, currentTopic: null, itineraryStage: null, itineraryData: {}, offeredMenuAfterFallback: false };
    }

    const resposta = await handleCoreLogic(userKey, textoDoPrompt, autorSimulado, idiomaForcadoParam);
    console.log("----------------------------------------------------");
    let langDisplay = userContext[userKey] ? userContext[userKey].language : (idiomaForcadoParam || 'N/A');
    console.log(`[TESTE LOCAL] ${config.NOME_BOT} para ${autorSimulado} (Idioma da sessão: ${langDisplay}):`);
    console.log(resposta);
    console.log("----------------------------------------------------");
}

function iniciarModoTesteLocal() {
    rl.question(`\nDigite sua mensagem para ${config.NOME_BOT} (ou "sair"). "menu" para simular 1ª interação. "novo chat" para recomeçar.\nIdiomas com prefixo (ex: "en:Hello", "es:Hola", "pt:Olá"):\n> `, async(input) => {
        const lowerInput = input.trim().toLowerCase();
        if (['sair', 'exit', 'quit'].includes(lowerInput)) {
            rl.close(); // Dispara o evento 'close'
            return;
        }

        let textoDoPrompt = input.trim();
        let idiomaSimulado = null;
        const matchIdioma = input.match(/^([a-zA-Z]{2}):\s*(.*)/);

        if (matchIdioma && matchIdioma[1] && matchIdioma[2]) {
            const langPrefix = matchIdioma[1].toLowerCase();
            if (langPrefix === 'en') idiomaSimulado = 'eng';
            else if (langPrefix === 'es') idiomaSimulado = 'spa';
            else if (langPrefix === 'pt') idiomaSimulado = 'por';
            textoDoPrompt = matchIdioma[2].trim();
        }

        const userKeyLocal = `local_TesterInterativo`;
        if (!userContext[userKeyLocal]) {
            userContext[userKeyLocal] = { language: idiomaSimulado || 'por', firstInteraction: true, awaitingMenuChoice: false, currentTopic: null, itineraryStage: null, itineraryData: {}, offeredMenuAfterFallback: false };
        }
        if (idiomaSimulado) {
            userContext[userKeyLocal].language = idiomaSimulado;
        }

        if (lowerInput === 'menu') {
            userContext[userKeyLocal].firstInteraction = true;
            userContext[userKeyLocal].awaitingMenuChoice = false;
            console.log("[TESTE INTERATIVO] Contexto resetado para simular primeira interação (menu). Envie uma mensagem como 'oi' para ver o menu.");
        } else if (textoDoPrompt) {
            await testarBotLocalmenteWrapper(textoDoPrompt, "TesterInterativo", idiomaSimulado);
        }

        if (!rl.closed) {
            iniciarModoTesteLocal();
        }
    });

    // Adiciona listener apenas uma vez
    if (!rl.listenerCount('close')) {
        rl.on('close', async() => {
            console.log("Encerrando teste interativo local. Fechando pool do BD...");
            if (pool) await pool.end().catch(err => console.error("Erro ao fechar pool no readline close:", err));
            console.log("Pool do BD fechado. Até mais!");
            // Não chamar process.exit() aqui, deixar o shutdown principal lidar com isso se for o caso
        });
    }
}

module.exports = { iniciarModoTesteLocal, rl }; // Exporta rl para o shutdown handler principal