const { userContext } = require('./userContext');
const { processarMensagemComGemini } = require('../services/geminiService');
const dbService = require('../services/dbService');
const { buscarPostsRelevantes, getFozDoIguacuPosts, buscarRespostaStaticQA, buscarRespostaFreeTierQA } = require('../services/localDataService');
const config = require('../config');
const { getUserPlanDetails } = require('../services/userService');
const axios = require('axios');
const { obterCotacaoAtualizada } = require('../services/financeService');
const { formatarLinkMapa, sanitizarNomeParaArquivo } = require('../utils/helpers');
const fs = require('fs').promises;
const { obterPrevisaoTempo } = require('../services/weatherService');
const path = require('path');


async function handleUserQueryWithLocalDB(userQuery, userKey, autorDisplayName, nomeIdiomaParaResposta, currentUserContext, instrucaoPersonaParaGemini) {
    const keywords = dbService.extractKeywords(userQuery);
    const intent = dbService.determineIntent(userQuery, keywords);

    if (intent && intent.type !== 'get_currency_rates') {
        console.log(`[DB] Intenção detectada: ${intent.type} com keywords: "${intent.keywords_for_db.join(', ')}" para query: "${userQuery}"`);
        const dbResults = await dbService.queryLocalDatabase(intent, intent.keywords_for_db);

        if (dbResults && dbResults.length > 0) {
            if (dbService.shouldRespondDirectlyFromDB(intent, dbResults)) {
                const directResponse = dbService.generateDirectResponseFromDB(dbResults, intent, nomeIdiomaParaResposta, currentUserContext);
                if (directResponse) {
                    console.log(`[DB] Resposta gerada diretamente do BD local.`);
                    return directResponse;
                }
            }
            const formattedDbData = dbService.formatDbResultsForPrompt(dbResults, intent);
            const promptForGeminiWithDBContext = `${instrucaoPersonaParaGemini} 
Contexto: O usuário (${autorDisplayName}) perguntou: "${userQuery}".
Em meu guia de ${config.CIDADE_BOT}, encontrei as seguintes informações relevantes:
${formattedDbData}
---
Tarefa para ${config.NOME_BOT}: Com base EXCLUSIVAMENTE nas informações do guia fornecidas acima, formule uma resposta amigável, útil e concisa para o usuário. Aja como se tivesse acabado de consultar seus arquivos. Se a informação for suficiente para responder bem, ótimo. Se não, indique o que encontrou e talvez pergunte se o usuário quer que você busque mais detalhes de outra forma ou refinar a busca. Use emojis apropriados.
Responda ESTRITAMENTE no idioma ${nomeIdiomaParaResposta}.
${config.NOME_BOT} (respondendo com base no guia local em ${nomeIdiomaParaResposta}):`;
            console.log(`[DB] Usando Gemini para refinar dados do BD (PLANO PAGO).`);
            return processarMensagemComGemini(promptForGeminiWithDBContext, autorDisplayName, nomeIdiomaParaResposta);
        } else {
            console.log(`[DB] Nenhum resultado encontrado no BD para a intenção: ${intent.type}`);
        }
    } else if (!intent) { // Se a intenção principal para esta função é nula
        // Ou, se você quiser verificar o tipo da intenção principal:
    } else if (intent && intent.type === 'get_currency_rates') {
        console.log(`[DB] Intenção de cotação, não processada por handleUserQueryWithLocalDB para: "${userQuery}"`);
    } else if (!intent) {
        console.log(`[DB] Nenhuma intenção específica para o BD (ou keywords insuficientes) para: "${userQuery}" (Verificar se foi cotação ou Q&A na handleCoreLogic).`);
    }
    return null;
}


async function handleUserQueryWithLocalDB(userQuery, userKey, autorDisplayName, nomeIdiomaParaResposta, currentUserContext, instrucaoPersonaParaGemini) {
    const keywords = dbService.extractKeywords(userQuery);
    const intent = dbService.determineIntent(userQuery, keywords);

    if (intent && intent.type !== 'get_currency_rates') {
        console.log(`[DB] Intenção detectada para BD: ${intent.type} com keywords: "${intent.keywords_for_db.join(', ')}" para query: "${userQuery}"`);
        const dbResults = await dbService.queryLocalDatabase(intent, intent.keywords_for_db);

        if (dbResults && dbResults.length > 0) {
            if (dbService.shouldRespondDirectlyFromDB(intent, dbResults)) {
                const directResponse = dbService.generateDirectResponseFromDB(dbResults, intent, nomeIdiomaParaResposta, currentUserContext);
                if (directResponse) {
                    console.log(`[DB] Resposta gerada diretamente do BD local.`);
                    return directResponse;
                }
            }
            const formattedDbData = dbService.formatDbResultsForPrompt(dbResults, intent);
            const promptForGeminiWithDBContext = `${instrucaoPersonaParaGemini} 
Contexto: O usuário (${autorDisplayName}) perguntou: "${userQuery}".
Em meu guia de ${config.CIDADE_BOT}, encontrei as seguintes informações relevantes:
${formattedDbData}
---
Tarefa para ${config.NOME_BOT}: Com base EXCLUSIVAMENTE nas informações do guia fornecidas acima, formule uma resposta amigável, útil e concisa para o usuário. Aja como se tivesse acabado de consultar seus arquivos. Se a informação for suficiente para responder bem, ótimo. Se não, indique o que encontrou e talvez pergunte se o usuário quer que você busque mais detalhes de outra forma ou refinar a busca. Use emojis apropriados.
Responda ESTRITAMENTE no idioma ${nomeIdiomaParaResposta}.
${config.NOME_BOT} (respondendo com base no guia local em ${nomeIdiomaParaResposta}):`;
            console.log(`[DB] Usando Gemini para refinar dados do BD (PLANO PAGO).`);
            return processarMensagemComGemini(promptForGeminiWithDBContext, autorDisplayName, nomeIdiomaParaResposta);
        } else {
            console.log(`[DB] Nenhum resultado encontrado no BD para a intenção: ${intent.type}`);
        }
    } else if (!intent) {
        // Evita logar se tempIntent (na handleCoreLogic) já indicou que é cotação
        if (dbService && typeof dbService.extractKeywords === 'function' && typeof dbService.determineIntent === 'function') {
            const keywordsForLog = dbService.extractKeywords(userQuery);
            const intentForLog = dbService.determineIntent(userQuery, keywordsForLog);
            if (!intentForLog || intentForLog.type !== 'get_currency_rates') {
                console.log(`[DB] Nenhuma intenção específica para o BD (ou keywords insuficientes) para: "${userQuery}"`);
            }
        }
    }
    return null;
}

// Função principal de lógica do bot
async function handleCoreLogic(userKey, promptDoUsuario, autorDisplayName, idiomaForcado = null) {
    if (!userContext[userKey]) {
        userContext[userKey] = {
            language: 'por',
            firstInteraction: true,
            awaitingMenuChoice: false,
            currentTopic: null,
            itineraryStage: null,
            staticFlowStage: null,
            staticFlowData: {},
            activePlan: 'free',
            personaModifier: null,
            offeredMenuAfterFallback: false,
            lastListedItems: null
        };
    }
    const currentUserContext = userContext[userKey];

    // ATUALIZA O PLANO ATIVO DO USUÁRIO NO INÍCIO DE CADA MENSAGEM
    if (promptDoUsuario.trim().toLowerCase() !== 'novo chat') { // Evita no reset do novo chat
        const planDetails = await getUserPlanDetails(userKey); // userKey é o ID do usuário no DB
        currentUserContext.activePlan = planDetails.active_plan || 'free';
        currentUserContext.personaModifier = planDetails.personaModifier;
        if (currentUserContext.activePlan !== 'free' && currentUserContext.activePlan !== 'awaiting_payment') {
            console.log(`[HCL] Plano ATIVO carregado do DB para ${userKey}: ${currentUserContext.activePlan}`);
        }
    }

    const promptRecebidoLower = promptDoUsuario.trim().toLowerCase();
    let instrucaoPersonaAtualizada = config.INSTRUCAO_PERSONA_BASE;
    if (currentUserContext.activePlan && currentUserContext.activePlan !== 'free' && currentUserContext.activePlan !== 'awaiting_payment' && currentUserContext.personaModifier) {
        instrucaoPersonaAtualizada += currentUserContext.personaModifier;
        console.log(`[PERSONA] Usando persona modificada para o plano: ${currentUserContext.activePlan}`);
    }

    if (promptRecebidoLower === 'novo chat') {
        console.log(`[${autorDisplayName}] Solicitou um novo chat.`);
        currentUserContext.language = 'por';
        currentUserContext.currentTopic = null;
        currentUserContext.itineraryStage = null;
        currentUserContext.staticFlowStage = null;
        currentUserContext.staticFlowData = {};
        currentUserContext.activePlan = 'free';
        currentUserContext.personaModifier = null;
        currentUserContext.offeredMenuAfterFallback = false;
        currentUserContext.firstInteraction = true;
        currentUserContext.awaitingMenuChoice = false;
        currentUserContext.lastListedItems = null;
        return processarMensagemComGemini(
            `${instrucaoPersonaAtualizada}\n${config.PROMPT_NOVO_CHAT_RESET}\n${config.NOME_BOT} (respondendo em Português):`,
            autorDisplayName, 'Português'
        );
    }
    // Detecção de idioma simplificada (sem franc por problemas de compatibilidade)
    let nomeIdiomaParaResposta = 'Português';
    const langCodeMapping = { 'por': 'Português', 'eng': 'Inglês', 'spa': 'Espanhol' };
    let currentMsgLang = idiomaForcado || currentUserContext.language || 'por';

    // Detecção simples baseada em palavras-chave
    if (!idiomaForcado) {
        const textoLower = promptDoUsuario.toLowerCase();
        if (textoLower.includes('english') || textoLower.includes('hello') || textoLower.includes('help')) {
            currentMsgLang = 'eng';
        } else if (textoLower.includes('español') || textoLower.includes('hola') || textoLower.includes('ayuda')) {
            currentMsgLang = 'spa';
        } else {
            currentMsgLang = 'por'; // Default português
        }
    }

    if (langCodeMapping[currentMsgLang]) {
        nomeIdiomaParaResposta = langCodeMapping[currentMsgLang];
        currentUserContext.language = currentMsgLang;
    } else {
        currentUserContext.language = 'por';
        nomeIdiomaParaResposta = 'Português';
    }

    let promptDefinitivoParaGemini;
    let instrucaoDeComportamentoAtual = config.INSTRUCAO_MENSAGEM_SUBSEQUENTE;
    let respostaEstaticaDireta = null;
    let respostaComMidia = null;

    // --- VERIFICAÇÃO DE FOLLOW-UP ---
    if (!currentUserContext.firstInteraction && !currentUserContext.awaitingMenuChoice &&
        (!currentUserContext.currentTopic || currentUserContext.currentTopic === 'outros' || currentUserContext.staticFlowStage === 'flow_complete') &&
        !(promptRecebidoLower.includes('ver planos') || promptRecebidoLower.includes('mudar plano') || promptRecebidoLower.includes('planos de assistencia')) &&
        currentUserContext.lastListedItems && currentUserContext.lastListedItems.length > 0) {

        let matchedItem = null;
        const normalizeForCompare = (str) => {
            if (!str) return "";
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
        };
        const normalizedUserInput = normalizeForCompare(promptDoUsuario);

        for (const item of currentUserContext.lastListedItems) {
            const normalizedItemName = normalizeForCompare(item.name);
            console.log(`[FOLLOW-UP DEBUG] Comparando input ("${normalizedUserInput}") com item listado ("${normalizedItemName}")`);
            if (normalizedItemName.includes(normalizedUserInput) || normalizedUserInput.includes(normalizedItemName)) {
                matchedItem = item;
                console.log(`[FOLLOW-UP DEBUG] Match ENCONTRADO para follow-up: ${item.name}`);
                break;
            }
        }

        if (matchedItem) {
            console.log(`[FOLLOW-UP] Usuário selecionou item listado: ${matchedItem.name} (ID: ${matchedItem.id}, Tipo: ${matchedItem.type})`);
            const itemDetails = await dbService.getSpecificItemById(matchedItem.id, matchedItem.type);
            if (itemDetails) {
                const tempContext = {...currentUserContext, lastListedItems: null };
                respostaEstaticaDireta = dbService.generateDirectResponseFromDB([itemDetails], { type: matchedItem.type, keywords_for_db: [] }, nomeIdiomaParaResposta, tempContext);
            } else {
                console.log(`[FOLLOW-UP ERR] Não foi possível obter detalhes para o item ID ${matchedItem.id}.`);
            }
            currentUserContext.lastListedItems = null;
        } else {
            console.log(`[FOLLOW-UP] Nenhum item correspondente encontrado em lastListedItems para: "${promptDoUsuario}"`);
        }
    }
    // --- FIM DO FOLLOW-UP ---

    // Processa fluxos principais se nenhuma resposta de follow-up foi gerada
    if (!respostaEstaticaDireta && !respostaComMidia) {
        if (promptRecebidoLower.includes('ver planos') || promptRecebidoLower.includes('mudar plano') || promptRecebidoLower.includes('planos de assistencia')) {
            if (currentUserContext.currentTopic !== 'static_itinerary_flow' || currentUserContext.staticFlowStage !== 'offer_plans_direct') {
                console.log(`[FLOW] Usuário ${autorDisplayName} solicitou para ver/mudar planos (processando agora).`);
                currentUserContext.currentTopic = 'static_itinerary_flow';
                currentUserContext.staticFlowStage = 'offer_plans_direct'; // Este estágio deve apenas mostrar os planos
                currentUserContext.awaitingMenuChoice = false;
            }
        }

        if (currentUserContext.firstInteraction) {
            console.log(`[FLOW] Primeira interação com ${autorDisplayName}. Iniciando apresentação e fluxo estático.`);
            const apresentacaoFozzi = `Olá! Sou o ${config.NOME_BOT}, seu guia virtual para ${config.CIDADE_BOT}! 👋 Que bom te ver por aqui!`;
            currentUserContext.currentTopic = 'static_itinerary_flow';
            currentUserContext.staticFlowStage = 'ask_planning_status';
            currentUserContext.staticFlowData = {};
            currentUserContext.activePlan = 'free';
            currentUserContext.personaModifier = null;
            const primeiraPerguntaFluxo = "Para começarmos a planejar sua aventura, me conta: você já está aqui em Foz ou ainda está planejando sua viagem? ✈️";
            respostaEstaticaDireta = `${apresentacaoFozzi}\n\n${primeiraPerguntaFluxo}`;
            currentUserContext.firstInteraction = false;
            currentUserContext.awaitingMenuChoice = false;
        } else if (currentUserContext.awaitingMenuChoice) {
            let escolha = promptDoUsuario.trim().toLowerCase();
            let topicoPromptParaGemini = "";
            if (escolha === '1' || escolha.includes('cataratas')) {
                topicoPromptParaGemini = config.PROMPT_MENU_CATARATAS;
                currentUserContext.currentTopic = 'cataratas';
            } else if (escolha === '2' || escolha.includes('compras no paraguai') || escolha.includes('compras py')) {
                topicoPromptParaGemini = config.PROMPT_MENU_COMPRAS_PY;
                currentUserContext.currentTopic = 'compras_py';
            } else if (escolha === '3' || escolha.includes('passeios em foz') || escolha.includes('passeios foz')) {
                topicoPromptParaGemini = config.PROMPT_MENU_PASSEIOS_FOZ;
                currentUserContext.currentTopic = 'passeios_foz';
            } else if (escolha === '4' || escolha.includes('roteiro')) {
                console.log(`[FLOW] Usuário ${autorDisplayName} escolheu Roteiro Personalizado. Iniciando fluxo estático.`);
                currentUserContext.currentTopic = 'static_itinerary_flow';
                currentUserContext.staticFlowStage = 'ask_planning_status';
                currentUserContext.staticFlowData = {};
                currentUserContext.activePlan = 'free';
                currentUserContext.personaModifier = null;
                respostaEstaticaDireta = "Que legal que quer um roteiro personalizado! 🎉 Para começar: você já está aqui em Foz ou ainda está planejando sua viagem? ✈️";
            } else {
                currentUserContext.currentTopic = 'outros';
            }
            if (topicoPromptParaGemini) {
                promptDefinitivoParaGemini = `${instrucaoPersonaAtualizada}\n${instrucaoDeComportamentoAtual}\n${topicoPromptParaGemini}\n---\n### Tarefa para ${config.NOME_BOT} ###\nO usuário escolheu "${escolha}".\nResponda ESTRITAMENTE no idioma ${nomeIdiomaParaResposta}.\n${config.NOME_BOT} (respondendo em ${nomeIdiomaParaResposta}):`;
            }
            currentUserContext.awaitingMenuChoice = false;
        } else if (currentUserContext.currentTopic === 'static_itinerary_flow') {
            let staticResponseSwitch = "";
            const textoOfertaPlanos = "Para aprimorar sua experiência, tenho alguns níveis de assistência Fozzi:\n" +
                "1. 💡 Plano Express - R$ 9,90 (1 Dia de Experiencia)\n" +
                "2. 🤓 Plano Trilha Completa - R$ 24,90 (3 Dias + Cupons e roteiros personalizados)\n" +
                "3. 🌟 Fozzi VIP - R$ 49,90 (Suporte total até o fim da viagem, reservas e prioridades nas respostas)\n" +
                "Mas relaxa que voce ainda pode ficar conversando comigo caso ainda nao queira os planos 😎)\n" +
                "Qual você prefere? (Digite 1, 2 ou 3)";

            switch (currentUserContext.staticFlowStage) {
                case 'ask_planning_status':
                    currentUserContext.staticFlowData.planningStatus = promptDoUsuario.trim();
                    staticResponseSwitch = "Entendido! E quantos dias você pretende ficar por aqui aproveitando as maravilhas de Foz?";
                    currentUserContext.staticFlowStage = 'ask_duration';
                    break;
                case 'ask_duration':
                    let days = NaN;
                    const userInputForDays = promptDoUsuario || "";
                    const matchResultDays = userInputForDays.match(/\d+/);
                    if (matchResultDays && matchResultDays[0]) { days = parseInt(matchResultDays[0]); }
                    if (isNaN(days) || days <= 0) {
                        staticResponseSwitch = "Hmm, não entendi bem o número de dias. 🤔 Poderia me dizer um número válido, por favor (ex: 3 dias, 5, uma semana)?";
                        break;
                    }
                    currentUserContext.staticFlowData.duration = days;
                    staticResponseSwitch = `Legal, ${days} dia(s)! Para eu te dar as melhores dicas, qual o seu estilo de viajante ou o da sua turma? 🛶🏞️💰\n... (lista de perfis) ...\n\n` +
                        "1. 🎒 Mochileiro Econômico\n" +
                        "2. 🧗 Aventureiro Raiz\n" +
                        "3. ✨ Conforto & Descoberta\n" +
                        "4. 💎 Luxo & Exclusividade\n" +
                        "5. 👨‍👩‍👧‍👦 Família com Crianças\n" +
                        "6. 🗺️ Turista de Primeira Viagem";


                    currentUserContext.staticFlowStage = 'ask_profile';
                    break;
                case 'ask_profile':
                    const profileChoice = promptDoUsuario.toLowerCase();
                    let profileName = ""; // Definir profileName
                    if (profileChoice.includes("1") || profileChoice.includes("mochileiro") || profileChoice.includes("econômico") || profileChoice.includes("economico")) {
                        profileName = "Mochileiro Econômico";
                        currentUserContext.staticFlowData.profileThemes = ["Econômico", "Natureza", "Aventura Leve", "Trilhas Leves"];
                    } else if (profileChoice.includes("2") || profileChoice.includes("aventureiro") || profileChoice.includes("raiz")) {
                        profileName = "Aventureiro Raiz";
                        currentUserContext.staticFlowData.profileThemes = ["Aventura", "Radical", "Natureza Intensa", "Trilhas", "Esportes Radicais"];
                    } else if (profileChoice.includes("3") || profileChoice.includes("conforto") || profileChoice.includes("descoberta") || profileChoice.includes("turístico") || profileChoice.includes("turistico")) {
                        profileName = "Conforto & Descoberta";
                        currentUserContext.staticFlowData.profileThemes = ["Cultural", "Gastronomia", "Passeios Clássicos", "Contemplação", "Compras"];
                    } else if (profileChoice.includes("4") || profileChoice.includes("luxo") || profileChoice.includes("exclusivo") || profileChoice.includes("exclusividade")) {
                        profileName = "Luxo & Exclusividade";
                        currentUserContext.staticFlowData.profileThemes = ["Premium", "VIP", "Gastronomia Sofisticada", "Experiências Únicas", "Serviços Personalizados"];
                    } else if (profileChoice.includes("5") || profileChoice.includes("familia") || profileChoice.includes("crianças") || profileChoice.includes("criancas")) {
                        profileName = "Família com Crianças";
                        currentUserContext.staticFlowData.profileThemes = ["Família", "Crianças", "Diversão", "Educativo", "Parques", "Segurança"];
                    } else if (profileChoice.includes("6") || profileChoice.includes("primeira viagem") || profileChoice.includes("essencial")) {
                        profileName = "Turista de Primeira Viagem";
                        currentUserContext.staticFlowData.profileThemes = ["Essencial", "Clássicos de Foz", "Panorâmico", "Guiado"];
                    } else {
                        staticResponseSwitch = "Não identifiquei esse estilo de viajante. 🤔 Poderia tentar uma das opções da lista, por favor, digitando o número ou o nome do estilo?";
                        // Mantém o estágio para perguntar novamente, não avança
                        // currentUserContext.staticFlowStage = 'ask_profile'; // Já está neste estágio
                        break; // Sai do switch, a staticResponseSwitch será retornada

                    }
                    currentUserContext.staticFlowData.profile = profileName;
                    console.log(`[STATIC FLOW] Perfil: ${profileName}`);
                    staticResponseSwitch = `Entendi seu perfil: "${profileName}" para ${currentUserContext.staticFlowData.duration} dia(s)! 🎉\nTenho alguns roteiros prontos em PDF. Gostaria de receber um agora? (Sim/Não)`;
                    currentUserContext.staticFlowStage = 'ask_pdf_itinerary';
                    break;
                case 'ask_pdf_itinerary':
                    const querPdf = promptDoUsuario.toLowerCase();
                    const profileForFilePdf = currentUserContext.staticFlowData.profile;
                    const durationForFilePdf = currentUserContext.staticFlowData.duration;
                    if (!profileForFilePdf || !durationForFilePdf) { /* ... erro ... */
                        staticResponseSwitch = "Ops..." + textoOfertaPlanos;
                        currentUserContext.staticFlowStage = 'handle_plan_choice';
                        break;
                    }
                    if (querPdf.includes('sim') || querPdf.includes('s')) {
                        const sanitizedProfile = sanitizarNomeParaArquivo(profileForFilePdf);
                        const pdfFileName = `${sanitizedProfile}_${durationForFilePdf}dias.pdf`;
                        const pdfDir = path.join(__dirname, '..', '..', 'roteiros');
                        const pdfFilePath = path.join(pdfDir, pdfFileName);
                        try {
                            await fs.access(pdfFilePath, fs.constants.F_OK);
                            respostaComMidia = { type: 'pdf', filePath: pdfFilePath, caption: `Seu roteiro para ${profileForFilePdf} de ${durationForFilePdf} dia(s)! 😉` };
                            respostaComMidia.accompanyingText = "\n\nEnquanto você dá uma olhada, " + textoOfertaPlanos;
                        } catch (err) {
                            staticResponseSwitch = `Puxa, PDF para "${profileForFilePdf}" com ${durationForFilePdf} dia(s) não encontrado. 😕\nMas, ${textoOfertaPlanos}`;
                        }
                    } else {
                        staticResponseSwitch = "Entendido! Sem problemas. " + textoOfertaPlanos;
                    }
                    currentUserContext.staticFlowStage = 'handle_plan_choice';
                    break;
                case 'offer_plans_direct':
                    staticResponseSwitch = textoOfertaPlanos;
                    currentUserContext.staticFlowStage = 'handle_plan_choice';
                    break;
                case 'handle_plan_choice':
                    const planInput = promptDoUsuario.toLowerCase();
                    let chosenPlanUserFriendlyName = '';
                    let stripePriceId = '';
                    let planIdentifierForContext = 'free';

                    if (planInput.includes("1") || planInput.includes("express")) {
                        chosenPlanUserFriendlyName = "Plano Express";
                        stripePriceId = process.env.STRIPE_PRICE_ID_EXPRESS;
                        planIdentifierForContext = 'express';
                    } else if (planInput.includes("2") || planInput.includes("trilha completa") || planInput.includes("explorador")) {
                        chosenPlanUserFriendlyName = "Plano Trilha Completa";
                        stripePriceId = process.env.STRIPE_PRICE_ID_TRILHA;
                        planIdentifierForContext = 'explorer';
                    } else if (planInput.includes("3") || planInput.includes("vip")) {
                        chosenPlanUserFriendlyName = "Plano VIP Fozzi";
                        stripePriceId = process.env.STRIPE_PRICE_ID_VIP;
                        planIdentifierForContext = 'vip';
                    } else {
                        currentUserContext.activePlan = 'free';
                        currentUserContext.personaModifier = null;
                        staticResponseSwitch = "Entendido! Se mudar de ideia sobre os planos ou quiser explorá-los mais tarde, é só me dizer 'ver planos'. Por enquanto, sigo com dicas pontuais! O que gostaria de saber? 🤔";
                        currentUserContext.staticFlowStage = 'flow_complete';
                        currentUserContext.currentTopic = 'outros';
                        break; // Sai do switch aqui se for plano free ou inválido
                    }

                    if (stripePriceId) { // Se for um plano pago com um Price ID do Stripe
                        console.log(`[PAYMENT] Usuário ${userKey} escolheu ${chosenPlanUserFriendlyName}. Solicitando link de pagamento.`);
                        try {
                            // Chama o seu paymentServer.js para criar a sessão de pagamento
                            const paymentServerUrl = `${process.env.PAYMENT_SERVER_URL || 'http://localhost:3001'}/criar-pagamento`;
                            const paymentResponse = await axios.post(paymentServerUrl, {
                                planoIdParaStripe: stripePriceId,
                                nomeUsuario: userKey,
                                emailUsuario: null // Adicionar se tiver email
                            });

                            if (paymentResponse.data && paymentResponse.data.url) {
                                // Envia o link de pagamento do Stripe para o usuário
                                staticResponseSwitch = `Ótima escolha o ${chosenPlanUserFriendlyName}! ✨\nPara ativar, por favor, complete o pagamento aqui: ${paymentResponse.data.url}\n\nApós a confirmação, seu plano será ativado automaticamente! Se precisar de algo, é só chamar.`;
                            } else {
                                staticResponseSwitch = "Tive um probleminha para gerar seu link de pagamento... 😥";
                            }
                        } catch (paymentError) {

                            console.error("[PAYMENT CLIENT ERROR] Erro ao chamar /criar-pagamento:", paymentError.message);
                            staticResponseSwitch = "Desculpe, não consegui gerar o link de pagamento agora. Tente mais tarde, por favor.";
                        }
                    } else {

                        currentUserContext.activePlan = 'free';
                        currentUserContext.personaModifier = null;
                        staticResponseSwitch = confirmationMessage;
                    }
                    currentUserContext.staticFlowStage = 'flow_complete';
                    currentUserContext.currentTopic = 'outros';
                    break;
                default:
                    console.warn(`[STATIC FLOW] Estágio desconhecido: ${currentUserContext.staticFlowStage}`);
                    currentUserContext.currentTopic = 'outros';
                    staticResponseSwitch = "Me perdi um pouquinho aqui. Sobre o que gostaria de falar agora?";
                    break;
            }
            if (staticResponseSwitch && !respostaComMidia) {
                respostaEstaticaDireta = staticResponseSwitch;
            } else if (respostaComMidia && staticResponseSwitch) {
                if (!respostaComMidia.accompanyingText) { respostaComMidia.accompanyingText = staticResponseSwitch; }
            } else if (currentUserContext.currentTopic === 'static_itinerary_flow' && currentUserContext.staticFlowStage !== 'flow_complete' && !staticResponseSwitch && !respostaComMidia) {
                respostaEstaticaDireta = "Desculpe, não entendi. Poderia repetir?";
                currentUserContext.currentTopic = 'outros';
            }
        }
    }

    // ----- LÓGICA DE RETORNO E FALLBACK -----
    if (respostaComMidia) { /* ... */ return respostaComMidia; }
    if (respostaEstaticaDireta) { /* ... com formatação de mapa ... */ return respostaEstaticaDireta; }

    if (!promptDefinitivoParaGemini) {
        if (!currentUserContext.currentTopic || currentUserContext.currentTopic === 'outros' ||
            (currentUserContext.staticFlowStage === 'flow_complete' && currentUserContext.currentTopic === 'outros')) {

            console.log(`[INFO] Fallback para pergunta geral: "${promptDoUsuario}"`);

            const tempKeywordsForIntent = dbService.extractKeywords(promptDoUsuario);
            const tempIntent = dbService.determineIntent(promptDoUsuario, tempKeywordsForIntent);

            if (tempIntent && tempIntent.type === 'get_currency_rates') {
                console.log(`[INFO] Intenção de cotação de moeda detectada.`);
                const cotacaoMsg = await obterCotacaoAtualizada();
                return cotacaoMsg;
            }
            if (tempIntent && tempIntent.type === 'get_weather_forecast') {
                console.log(`[INFO] Intenção de previsão do tempo detectada.`);
                const previsaoMsg = await obterPrevisaoTempo();
                return previsaoMsg; // Retorna a previsão diretamente
            }

            if (currentUserContext.activePlan && currentUserContext.activePlan !== 'free') {
                // **USUÁRIO COM PLANO PAGO**
                console.log(`[PLAN CHECK] Usuário com plano PAGO '${currentUserContext.activePlan}'.`);
                console.log(`[INFO] Tentando Q&A Básico (freeTierQA.json) para usuário PAGO: "${promptDoUsuario}"`);
                const freeQaMatchForPaid = buscarRespostaFreeTierQA(promptDoUsuario);
                if (freeQaMatchForPaid) {
                    console.log(`[INFO] Resposta encontrada no Q&A Básico para usuário PAGO: ID ${freeQaMatchForPaid.id}`);
                    let respostaFreeQA = freeQaMatchForPaid.resposta;
                    if (freeQaMatchForPaid.maps_target) { respostaFreeQA = formatarLinkMapa(freeQaMatchForPaid.maps_target, freeQaMatchForPaid.resposta); }
                    return respostaFreeQA;
                }
                console.log(`[INFO] Nenhuma resposta no Q&A Básico para usuário PAGO. Acessando BD.`);
                let respostaDB = await handleUserQueryWithLocalDB(promptDoUsuario, userKey, autorDisplayName, nomeIdiomaParaResposta, currentUserContext, instrucaoPersonaAtualizada);
                if (respostaDB) {
                    console.log(`[INFO] Resposta obtida do BD (PLANO PAGO).`);
                    if (typeof respostaDB === 'string' && respostaDB.includes("MAPS_TARGET:[")) {
                        const mapsMarker = "MAPS_TARGET:["; // Pode ser mapsMarkerInDB como antes
                        const startIndex = respostaDB.indexOf(mapsMarker);
                        if (startIndex !== -1) {
                            const endIndex = respostaDB.indexOf("]", startIndex + mapsMarker.length);
                            if (endIndex > startIndex) {
                                const nomeLocalParaMapa = respostaDB.substring(startIndex + mapsMarker.length, endIndex).trim();
                                const textoSemMarcador = respostaDB.substring(0, startIndex).trim();
                                console.log(`[HCL DB MAPS] Passando para formatarLinkMapa -> nomeLocalParaMapa: "${nomeLocalParaMapa}"`);
                                return formatarLinkMapa(nomeLocalParaMapa, textoSemMarcador);
                            }
                        }
                        // Se o marcador estiver malformado, remove para não mostrar ao usuário
                        const markerIndexClean = respostaDB.indexOf("MAPS_TARGET:[");
                        if (markerIndexClean !== -1) {
                            console.log("[HCL DB MAPS] Marcador malformado, retornando texto sem marcador.");
                            return respostaDB.substring(0, markerIndexClean).trim();
                        }
                    }
                    // Se não tinha MAPS_TARGET ou foi malformado e não tratado acima, retorna a respostaDB como está
                    return respostaDB;
                }
                // Se respostaDB for null, continua para o próximo log e fallback Gemini
                console.log(`[INFO] BD não forneceu resposta (PLANO PAGO). Prosseguindo para fallback Gemini com posts.`);

                const fozPosts = getFozDoIguacuPosts();
                const postsEncontrados = buscarPostsRelevantes(promptDoUsuario, fozPosts);
                let contextoDosPosts = "";
                if (postsEncontrados && postsEncontrados.length > 0) {
                    contextoDosPosts = "\n\n--- Informações adicionais de discussões locais ...\n";
                    postsEncontrados.forEach((post, index) => { /* ... */ });
                    contextoDosPosts += "--- Fim das informações locais ---\n";
                }
                promptDefinitivoParaGemini = `${instrucaoPersonaAtualizada}\n${instrucaoDeComportamentoAtual}${contextoDosPosts}\n---\n### Tarefa para ${config.NOME_BOT} ###\nO usuário (${autorDisplayName}) está interagindo no idioma: ${nomeIdiomaParaResposta}.\nResponda à pergunta/mensagem abaixo do usuário ESTRITAMENTE no idioma ${nomeIdiomaParaResposta}.\nUsuário: ${promptDoUsuario}\n${config.NOME_BOT} (respondendo em ${nomeIdiomaParaResposta}):`;
                console.log("[DEBUG HCL] Prompt para Gemini fallback (PLANO PAGO) construído.");
            } else {

                // PLANO FREE: staticQA -> freeTierQA -> msgPlanoGratuito
                console.log(`[PLAN CHECK] Usuário com plano 'free'.`);

                // 1. Tenta staticQA.json (Q&A Geral - SÓ PARA FREE)
                console.log(`[INFO] Tentando Q&A Estático Geral para usuário FREE: "${promptDoUsuario}"`);
                const generalQaMatchForFree = buscarRespostaStaticQA(promptDoUsuario);
                if (generalQaMatchForFree) {
                    console.log(`[INFO] Resposta encontrada no Q&A Estático Geral para usuário FREE: ID ${generalQaMatchForFree.id}`);
                    let respostaGeneralQA = generalQaMatchForFree.resposta;
                    if (generalQaMatchForFree.maps_target) {
                        respostaGeneralQA = formatarLinkMapa(generalQaMatchForFree.maps_target, generalQaMatchForFree.resposta);
                    }
                    return respostaGeneralQA; // <<<< DEVERIA RETORNAR AQUI E PARAR
                }
                console.log(`[INFO] Nenhuma resposta no Q&A Estático Geral para usuário FREE.`);

                // 2. Se Q&A Geral falhou, Tenta freeTierQA.json (Q&A Básico - SEGUNDA TENTATIVA PARA FREE)
                console.log(`[INFO] Tentando Q&A Básico (freeTierQA.json) para usuário FREE: "${promptDoUsuario}"`);
                const freeQaMatchForFree = buscarRespostaFreeTierQA(promptDoUsuario);
                if (freeQaMatchForFree) {
                    console.log(`[INFO] Resposta encontrada no Q&A Básico para usuário FREE: ID ${freeQaMatchForFree.id}`);
                    let respostaFreeQA = freeQaMatchForFree.resposta;
                    if (freeQaMatchForFree.maps_target) {
                        respostaFreeQA = formatarLinkMapa(freeQaMatchForFree.maps_target, freeQaMatchForFree.resposta);
                    }
                    return respostaFreeQA;
                }
                console.log(`[INFO] Nenhuma resposta no Q&A Básico para usuário FREE.`);

                const msgPlanoGratuito = `Poxa, não encontrei uma resposta pronta para isso nas minhas dicas rápidas. 😕\nCom os planos pagos do Fozzi (Express, Trilha Completa ou VIP), eu poderia fazer uma busca mais completa e usar minha inteligência artificial para te ajudar melhor! ✨\nQuer conhecer os planos? É só digitar "ver planos". Ou, se preferir, tente perguntar de outra forma.`;
                return msgPlanoGratuito;
            }
        }
    }

    // ... (após o else do PLAN CHECK para usuários 'free')
    // } // fim do if (!currentUserContext.currentTopic || ...)
    // } // fim do if (!promptDefinitivoParaGemini) -> ESTE BLOCO É ONDE promptDefinitivoParaGemini É CONSTRUÍDO PARA FALLBACK PAGO

    // Processa com Gemini APENAS se promptDefinitivoParaGemini foi definido
    if (promptDefinitivoParaGemini) {
        console.log("[DEBUG HCL] PromptDefinitivoParaGemini ANTES da chamada:", JSON.stringify(promptDefinitivoParaGemini)); // LOG EXTRA
        console.log("[DEBUG HCL] Chamando processarMensagemComGemini com prompt...");
        let respostaFinal = await processarMensagemComGemini(promptDefinitivoParaGemini, autorDisplayName, nomeIdiomaParaResposta);
        console.log("[DEBUG HCL] Resposta DIRETA de processarMensagemComGemini:", respostaFinal);

        if (typeof respostaFinal !== 'string') {
            console.error("[DEBUG HCL ERRO] processarMensagemComGemini retornou algo diferente de string:", respostaFinal);
            respostaFinal = "Ocorreu um probleminha com minha inteligência, mas já estou vendo isso! Tente perguntar de novo em instantes.";
        }
        if (respostaFinal.includes("MAPS_TARGET:[")) {
            const mapsMarker = "MAPS_TARGET:[";
            const startIndex = respostaFinal.indexOf(mapsMarker);
            if (startIndex !== -1) {
                const endIndex = respostaFinal.indexOf("]", startIndex + mapsMarker.length);
                if (endIndex > startIndex) {
                    const nomeLocalParaMapa = respostaFinal.substring(startIndex + mapsMarker.length, endIndex).trim();
                    const textoSemMarcador = respostaFinal.substring(0, startIndex).trim();

                    console.log(`[HCL GEMINI MAPS] Passando para formatarLinkMapa -> nomeLocalParaMapa: "${nomeLocalParaMapa}"`);
                    // Atualiza respostaFinal para ser a string formatada com o link
                    respostaFinal = formatarLinkMapa(nomeLocalParaMapa, textoSemMarcador);
                } else {
                    // Marcador malformado (sem ']') - remover para não mostrar ao usuário
                    console.warn("[HCL GEMINI MAPS] Marcador MAPS_TARGET malformado (sem ']'), removendo.");
                    respostaFinal = respostaFinal.substring(0, startIndex).trim();
                }
            } else {
                // Inconsistência se includes é true mas indexOf é -1 (improvável, mas trata)
                console.warn("[HCL GEMINI MAPS] Marcador MAPS_TARGET encontrado com 'includes' mas não com 'indexOf'.");
            }
        }

        if (respostaFinal.includes("Arara! 😅")) {
            const araraFallbackMatch = config.INSTRUCAO_PERSONA_BASE.match(/"(Arara! 😅 [^"]*em \[IDIOMA][^"]*)"/);
            if (araraFallbackMatch && araraFallbackMatch[1]) {
                respostaFinal = araraFallbackMatch[1].replace("[IDIOMA]", nomeIdiomaParaResposta);
            }
            currentUserContext.offeredMenuAfterFallback = true; // Se você usa isso para algo
            console.log(`[${autorDisplayName}] Fallback 'Arara!' padrão do GeminiService usado.`);
        }
        console.log("[DEBUG HCL] Retornando respostaFinal (após processarMensagemComGemini):", (typeof respostaFinal === 'string' ? respostaFinal.substring(0, 100) : respostaFinal) + "...");
        return respostaFinal;
    }

    // Se chegou aqui, promptDefinitivoParaGemini não foi definido ou era falsy
    console.warn(`[WARN] Nenhuma resposta pôde ser construída (promptDefinitivoParaGemini era falsy ou não definido). Usuário: ${autorDisplayName}, Plano: <span class="math-inline">\{currentUserContext\.activePlan\}, Pergunta\: "</span>{promptDoUsuario}"`);
    const fallbackMsgFinal = config.INSTRUCAO_PERSONA_BASE.match(/"(Arara! 😅 [^"]*em \[IDIOMA][^"]*)"/);
    if (fallbackMsgFinal && fallbackMsgFinal[1]) {
        return fallbackMsgFinal[1].replace("[IDIOMA]", nomeIdiomaParaResposta);
    }
    return "Desculpe, não consegui processar sua solicitação no momento. Poderia tentar de novo? 😥";

    return "Desculpe, não consegui processar...";
}

module.exports = { handleCoreLogic };