// /whatsapp/messageEvents.js
const { handleCoreLogic } = require('../core/handleCoreLogic');
const config = require('../config');
const { MessageMedia } = require('whatsapp-web.js');
const { client } = require('./client'); // Importa a função client

async function handleWhatsAppMessage(msg) {
    try {
        const autorMensagem = msg.fromMe ? "VOCÊ MESMO" : msg.from.split('@')[0];
        const userNumber = msg.fromMe ? (process.env.MEU_NUMERO_WPP || 'proprio_usuario_bot') : msg.from.split('@')[0];
        const promptDoUsuario = msg.body;

        if (msg.isGroupMsg || msg.from === 'status@broadcast' || !promptDoUsuario || promptDoUsuario.trim() === "") {
            return;
        }
        if (msg.type && typeof msg.type === 'string' && msg.type.toLowerCase() !== 'chat' && msg.type.toLowerCase() !== 'text') {
            if (!msg.body) {
                console.log(`[INFO] Mensagem de tipo '${msg.type}' sem corpo de texto ignorada de ${autorMensagem}.`);
                return;
            }
        }

        console.log(`\n[WPP MSG] De: ${autorMensagem} (${userNumber}), Texto: "${promptDoUsuario}"`);
        const clientInstance = client(); // Obtém a instância do cliente
        const respostaDoCore = await handleCoreLogic(userNumber, promptDoUsuario, autorMensagem, null, clientInstance);
        // Melhor seria handleCoreLogic apenas retornar o que fazer.

        if (respostaDoCore && !msg.fromMe) {
            if (typeof respostaDoCore === 'string') {
                // Resposta de texto simples
                console.log(`[WPP REPLY TEXT] Para: ${autorMensagem}, Resposta: "${respostaDoCore.substring(0, 100)}..."`);
                await msg.reply(respostaDoCore);
            } else if (typeof respostaDoCore === 'object' && respostaDoCore.type === 'pdf') {
                // Resposta com PDF
                console.log(`[WPP REPLY PDF] Enviando PDF: ${respostaDoCore.filePath} para ${autorMensagem}`);
                try {
                    const clientInstance = client(); // Obtém a instância do cliente
                    const media = MessageMedia.fromFilePath(respostaDoCore.filePath);
                    await clientInstance.sendMessage(msg.from, media, { caption: respostaDoCore.caption || `Aqui está o seu roteiro, ${autorMensagem}! 😊` });

                    // Se houver um texto para enviar APÓS o PDF (ex: oferta de planos)
                    if (respostaDoCore.accompanyingText) {
                        console.log(`[WPP REPLY TEXT AFTER PDF] Para: ${autorMensagem}, Texto: "${respostaDoCore.accompanyingText.substring(0,100)}..."`);
                        // Usar client.sendMessage para garantir que seja uma nova mensagem, não uma resposta ao PDF.
                        await clientInstance.sendMessage(msg.from, respostaDoCore.accompanyingText);
                    }
                } catch (mediaError) {
                    console.error("[WPP MEDIA ERRO] Falha ao enviar PDF:", mediaError);
                    let errorReply = "Tive um problema ao tentar te enviar o roteiro em PDF. 😥 ";
                    if (respostaDoCore.accompanyingText) {
                        errorReply += "Mas ainda podemos conversar sobre os planos de assistência!\n\n" + respostaDoCore.accompanyingText;
                    } else {
                        errorReply += "Por favor, tente pedir o roteiro novamente mais tarde ou escolha outra opção."
                    }
                    await msg.reply(errorReply);
                }
            } else if (typeof respostaDoCore === 'object') {
                // Caso handleCoreLogic retorne um objeto não esperado, logar e enviar uma mensagem genérica.
                console.warn(`[WPP WARN] Resposta do Core é um objeto não tratado:`, respostaDoCore);
                await msg.reply(`Hum, recebi uma resposta interna que não sei como te mostrar. Podemos tentar de novo?`);
            }
        } else if (!respostaDoCore && !msg.fromMe) {
            console.log(`[WPP WARN] Nenhuma resposta final gerada para ${autorMensagem}.`);
            // Considerar enviar uma mensagem padrão aqui se desejar, como "Não entendi, pode repetir?"
            // ou deixar o Fozzi quieto.
        }
    } catch (error) {
        console.error('\n[!] WPP: Erro GERAL ao processar mensagem:', error);
        if (!msg.fromMe && msg.reply) {
            try {
                await msg.reply(`Ops! ${config.NOME_BOT} tropeçou numa arara aqui 🦜... Brincadeira! Tive um pequeno imprevisto técnico. Poderia tentar de novo em instantes?`);
            } catch (replyError) {
                console.error('[!] WPP: Erro ao tentar enviar mensagem de erro para o usuário:', replyError);
            }
        }
    }
}

module.exports = { handleWhatsAppMessage };