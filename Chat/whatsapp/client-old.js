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


let client = null;

async function initializeWhatsAppClient() {
    console.log("Inicializando cliente WhatsApp localmente...");

    // Criar diretório de sessão se não existir
    try {
        await fs.mkdir(SESSION_TEMP_DIR, { recursive: true });
        console.log(`[WhatsApp] Diretório de sessão criado/verificado: ${SESSION_TEMP_DIR}`);
    } catch (error) {
        console.warn(`[WhatsApp] Erro ao criar diretório de sessão: ${error.message}`);
    }

    // Configuração do cliente WhatsApp para ambiente local/Docker
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: SESSION_TEMP_DIR,
            clientId: SESSION_CLIENT_ID
        }),
        puppeteer: {
            headless: true,
            executablePath: '/usr/bin/chromium',
            timeout: 60000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=site-per-process',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--memory-pressure-off',
                '--max_old_space_size=4096',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--mute-audio'
            ]
        }
    });

    console.log("Cliente WhatsApp configurado para execução local. Iniciando listeners de eventos...");

    // Listener para o evento 'qr' - exibe QR code no terminal
    client.on('qr', (qr) => {
        console.log('\n=== QR CODE RECEBIDO ===');
        console.log('Escaneie o QR Code abaixo com seu WhatsApp:');
        qrcode.generate(qr, { small: true });
        console.log('========================\n');
    });

    // Listener para o evento 'ready'
    client.on('ready', () => {
        console.log('\n🎉 WHATSAPP CONECTADO COM SUCESSO! 🎉');
        console.log(`Bot ${config.NOME_BOT} está online e pronto para ajudar turistas em ${config.CIDADE_BOT}!`);
        console.log('Sessão salva localmente para próximas execuções.\n');
    });

    client.on('message', handleWhatsAppMessage);

    client.on('disconnected', (reason) => {
        console.log('❌ WHATSAPP DESCONECTADO!', reason);
        const { shutdown } = require('../utils/shutdown');
        shutdown('WHATSAPP_DISCONNECTED');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ FALHA DE AUTENTICAÇÃO WHATSAPP!', msg);
        const { shutdown } = require('../utils/shutdown');
        shutdown('WHATSAPP_AUTH_FAILED');
    });

    try {
        console.log("Inicializando cliente WhatsApp... Aguardando conexão ou QR code.");

        // Tentar inicializar com timeout
        const initPromise = client.initialize();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout na inicialização do WhatsApp')), 120000)
        );

        await Promise.race([initPromise, timeoutPromise]);
        console.log("Cliente WhatsApp inicializado com sucesso!");
        return client;
    } catch (err) {
        console.error("❌ Falha ao inicializar cliente WhatsApp:", err.message);

        // Tentar novamente uma vez
        console.log("🔄 Tentando reinicializar em 5 segundos...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            await client.initialize();
            console.log("✅ Cliente WhatsApp inicializado com sucesso na segunda tentativa!");
            return client;
        } catch (retryErr) {
            console.error("❌ Falha na segunda tentativa:", retryErr.message);
            throw retryErr;
        }
    }
}

module.exports = { initializeWhatsAppClient, client: () => client };