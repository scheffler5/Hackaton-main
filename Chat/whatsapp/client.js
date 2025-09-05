const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { handleWhatsAppMessage } = require('./messageEvents');
const config = require('../config');
const qrcode = require('qrcode-terminal');
const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURAÇÕES LOCAIS ---
const SESSION_CLIENT_ID = 'fozzi-local-session';
const SESSION_TEMP_DIR = './session';
const SESSION_DATA_PATH = path.join(SESSION_TEMP_DIR, SESSION_CLIENT_ID);

let sock = null;

async function initializeWhatsAppClient() {
    console.log("🚀 Inicializando cliente WhatsApp com Baileys...");

    // Criar diretório de sessão se não existir
    try {
        await fs.mkdir(SESSION_DATA_PATH, { recursive: true });
        console.log(`✅ Diretório de sessão criado/verificado: ${SESSION_DATA_PATH}`);
    } catch (error) {
        console.warn(`⚠️ Erro ao criar diretório de sessão: ${error.message}`);
    }

    try {
        // Usar autenticação multi-arquivo
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DATA_PATH);

        // Criar socket do WhatsApp
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // Vamos usar nossa própria implementação
            logger: {
                level: 'silent', // Silenciar logs do Baileys
                child: () => ({ level: 'silent' })
            }
        });

        // Event listeners
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('\n🔗 === QR CODE RECEBIDO ===');
                console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:');
                qrcode.generate(qr, { small: true });
                console.log('==========================\n');
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect ? .error) ? .output ? .statusCode !== DisconnectReason.loggedOut;
                console.log('❌ Conexão fechada devido a:', lastDisconnect ? .error);
                if (shouldReconnect) {
                    console.log('🔄 Tentando reconectar...');
                    setTimeout(initializeWhatsAppClient, 5000);
                }
            } else if (connection === 'open') {
                console.log('\n🎉 WHATSAPP CONECTADO COM SUCESSO! 🎉');
                console.log(`✅ Bot ${config.NOME_BOT} está online e pronto para ajudar turistas em ${config.CIDADE_BOT}!`);
                console.log('💾 Sessão salva localmente para próximas execuções.\n');
            }
        });

        // Salvar credenciais quando atualizadas
        sock.ev.on('creds.update', saveCreds);

        // Listener para mensagens
        sock.ev.on('messages.upsert', async(m) => {
            const message = m.messages[0];
            if (!message.key.fromMe && m.type === 'notify') {
                await handleWhatsAppMessage(message, sock);
            }
        });

        console.log("✅ Cliente WhatsApp (Baileys) inicializado com sucesso!");
        return sock;

    } catch (err) {
        console.error("❌ Falha ao inicializar cliente WhatsApp:", err.message);

        // Tentar novamente uma vez
        console.log("🔄 Tentando reinicializar em 5 segundos...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            return await initializeWhatsAppClient();
        } catch (retryErr) {
            console.error("❌ Falha na segunda tentativa:", retryErr.message);
            throw retryErr;
        }
    }
}

function client() {
    return sock;
}

module.exports = { initializeWhatsAppClient, client };