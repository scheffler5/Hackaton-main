const { Pool } = require('pg');

let pool; // Declare pool fora para ser acessível globalmente/pelo módulo

// Função para inicializar o pool de conexão
async function initializePool() {
    const cloudSqlConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME;
    const dbUser = process.env.DB_USER || 'postgres';
    const dbDatabase = process.env.DB_DATABASE || 'Fozzi';
    const dbPassword = process.env.DB_PASSWORD;
    const dbPort = parseInt(process.env.DB_PORT) || 5432;

    const config = {
        user: dbUser,
        database: dbDatabase,
        password: dbPassword,
        port: dbPort,
        ssl: false // O Cloud SQL Proxy já lida com SSL
    };

    if (cloudSqlConnectionName) {
        // Conexão via socket Unix quando no Cloud Run com Cloud SQL Connection
        console.log(`[DB] Usando conexão Cloud SQL via socket Unix: /cloudsql/${cloudSqlConnectionName}`);
        config.host = `/cloudsql/${cloudSqlConnectionName}`;
        // Para alguns drivers ou configurações, o port pode não ser necessário aqui
        // ou pode ser o padrão 5432 mesmo com socket. Manter por segurança.
    } else {
        // Fallback para desenvolvimento local ou outros ambientes
        console.log(`[DB] Usando conexão local/direta: ${process.env.DB_HOST || 'localhost'}:${dbPort}`);
        config.host = process.env.DB_HOST || 'localhost';
    }

    pool = new Pool(config);

    pool.on('connect', () => {
        console.log('[DB] Pool conectado ao PostgreSQL!');
    });

    pool.on('error', (err) => {
        console.error('[DB ERRO] Erro inesperado no cliente do pool PostgreSQL:', err);
    });

    // Testar a conexão imediatamente após a inicialização do pool
    let clientDB;
    try {
        clientDB = await pool.connect();
        console.log('[DB] Teste de conexão inicial com o BD: Sucesso!');
        return true; // Sucesso na inicialização e teste
    } catch (err) {
        console.error('[DB ERRO] Teste de conexão inicial com o BD: Falhou!', err);
        // Não re-throw o erro aqui se você quiser que o app continue mesmo sem BD
        // Mas pelo seu log anterior, você quer que ele falhe se o BD falhar.
        throw err; // Re-lança o erro para o Fozzi encerrar.
    } finally {
        if (clientDB) {
            clientDB.release();
        }
    }
}

// Chame initializePool uma vez quando o módulo é carregado
// ou no início da sua função startApp (se for async/await)
// Exponha o pool para outros módulos usarem
module.exports = {
    initializePool, // Nova função para iniciar o pool
    getPool: () => pool // Para outros módulos pegarem o pool após a inicialização
};

// No seu bot.js ou arquivo principal:
// const { initializePool } = require('./config/db');
//
// async function startApp() {
//   try {
//     await initializePool(); // Garante que o pool é inicializado e testado
//     // Resto da sua lógica do bot que precisa do pool
//     const express = require('express');
//     const app = express();
//     const port = process.env.PORT || 3000; // Ou a porta que você usa

//     app.get('/', (req, res) => {
//       res.send('Fozzi está online!');
//     });

//     app.listen(port, () => {
//       console.log(`Fozzi listening on port ${port}`);
//     });
//   } catch (error) {
//     console.error('Erro fatal ao iniciar o Fozzi:', error);
//     process.exit(1); // Encerra se a inicialização falhar (incluindo o BD)
//   }
// }

// startApp(); // Chama a função principal de inicialização