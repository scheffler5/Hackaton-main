// /whatsapp/messageEvents.js
const { handleCoreLogic } = require('../core/handleCoreLogic');
const config = require('../config');
const { client } = require('./client'); // Importa a função client

async function handleWhatsAppMessage(message, sock) {
    try {
        const remoteJid = message.key.remoteJid;
        const messageText = message.message?.conversation || 
                          message.message?.extendedTextMessage?.text || 
                          '';

        // Ignorar mensagens em grupos ou sem texto
        if (remoteJid.includes('@g.us') || !messageText || messageText.trim() === "") {
            return;
        }

        const userNumber = remoteJid.split('@')[0];
        const autorMensagem = userNumber;
        const promptDoUsuario = messageText;

        console.log(`\n📱 [WPP MSG] De: ${autorMensagem} (${userNumber}), Texto: "${promptDoUsuario}"`);
        
        const clientInstance = sock || client(); // Usar o sock passado ou obter a instância
        const respostaDoCore = await handleCoreLogic(userNumber, promptDoUsuario, autorMensagem, null, clientInstance);

        if (respostaDoCore && !message.key.fromMe) {
            if (typeof respostaDoCore === 'string') {
                // Resposta de texto simples
                console.log(`✅ [WPP REPLY TEXT] Para: ${autorMensagem}, Resposta: "${respostaDoCore.substring(0, 100)}..."`);
                await sock.sendMessage(remoteJid, { text: respostaDoCore });
            } else if (typeof respostaDoCore === 'object' && respostaDoCore.type === 'pdf') {
                // Resposta com PDF
                console.log(`📄 [WPP REPLY PDF] Enviando PDF: ${respostaDoCore.filePath} para ${autorMensagem}`);
                try {
                    const fs = require('fs');
                    const pdfBuffer = fs.readFileSync(respostaDoCore.filePath);
                    
                    await sock.sendMessage(remoteJid, {
                        document: pdfBuffer,
                        mimetype: 'application/pdf',
                        fileName: `roteiro_${autorMensagem}.pdf`,
                        caption: respostaDoCore.caption || `Aqui está o seu roteiro, ${autorMensagem}! 😊`
                    });

                    // Se houver um texto para enviar APÓS o PDF
                    if (respostaDoCore.accompanyingText) {
                        console.log(`📝 [WPP REPLY TEXT AFTER PDF] Para: ${autorMensagem}, Texto: "${respostaDoCore.accompanyingText.substring(0,100)}..."`);
                        await sock.sendMessage(remoteJid, { text: respostaDoCore.accompanyingText });
                    }
                } catch (mediaError) {
                    console.error("❌ [WPP MEDIA ERRO] Falha ao enviar PDF:", mediaError);
                    let errorReply = "Tive um problema ao tentar te enviar o roteiro em PDF. 😥 ";
                    if (respostaDoCore.accompanyingText) {
                        errorReply += "Mas ainda podemos conversar sobre os planos de assistência!\n\n" + respostaDoCore.accompanyingText;
                    } else {
                        errorReply += "Por favor, tente pedir o roteiro novamente mais tarde ou escolha outra opção."
                    }
                    await sock.sendMessage(remoteJid, { text: errorReply });
                }
            } else if (typeof respostaDoCore === 'object') {
                // Caso handleCoreLogic retorne um objeto não esperado
                console.warn(`⚠️ [WPP WARN] Resposta do Core é um objeto não tratado:`, respostaDoCore);
                await sock.sendMessage(remoteJid, { text: `Hum, recebi uma resposta interna que não sei como te mostrar. Podemos tentar de novo?` });
            }
        } else if (!respostaDoCore && !message.key.fromMe) {
            console.log(`⚠️ [WPP WARN] Nenhuma resposta final gerada para ${autorMensagem}.`);
        }
    } catch (error) {
        console.error('\n❌ [!] WPP: Erro GERAL ao processar mensagem:', error);
        if (!message.key.fromMe && sock) {
            try {
                await sock.sendMessage(message.key.remoteJid, { 
                    text: `Ops! ${config.NOME_BOT} tropeçou numa arara aqui 🦜... Brincadeira! Tive um pequeno imprevisto técnico. Poderia tentar de novo em instantes?` 
                });
            } catch (replyError) {
                console.error('❌ [!] WPP: Erro ao tentar enviar mensagem de erro para o usuário:', replyError);
            }
        }
    }
}

module.exports = { handleWhatsAppMessage };
