// /utils/shutdown.js
// As instâncias serão passadas para setupShutdownHandlers

let _clientInstance = null;
let _poolInstance = null;
let _readlineInterface = null;

function setupShutdownHandlers(client, pool, rl) {
    _clientInstance = client;
    _poolInstance = pool;
    _readlineInterface = rl; // rl pode ser null se não estiver em modo teste

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function shutdown(signal) {
    console.log(`\nRecebido ${signal}. Encerrando Fozzi Bot...`);

    if (_clientInstance && typeof _clientInstance.destroy === 'function') {
        try {
            await _clientInstance.destroy();
            console.log("Cliente WhatsApp encerrado.");
        } catch (e) {
            console.error("Erro ao encerrar cliente WhatsApp:", e);
        }
    }

    // Se readline está ativo e não fechado, seu evento 'close' cuidará do pool.
    // Se não, fechamos o pool aqui.
    if (_readlineInterface && !_readlineInterface.closed) {
        console.log("Fechando interface readline (que fechará o pool)...");
        _readlineInterface.close();
    } else if (_poolInstance) {
        console.log("Tentando fechar pool do BD diretamente...");
        await _poolInstance.end()
            .then(() => console.log("Pool do BD fechado."))
            .catch(err => console.error("Erro ao fechar pool do BD no shutdown:", err));
    } else {
        console.log("Pool do BD não necessitou fechamento direto ou já estava fechado.");
    }

    console.log("Fozzi Bot encerrado. Até logo!");
    process.exit(signal === 'WHATSAPP_INIT_FAIL' || signal === 'FATAL_ERROR' || signal === 'DB_CONNECTION_FAILED_PROD' ? 1 : 0);
}

module.exports = { setupShutdownHandlers, shutdown };