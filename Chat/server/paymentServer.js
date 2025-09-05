// /paymentServer.js
require('dotenv').config(); // Para carregar STRIPE_SECRET_KEY e WEBHOOK_SECRET
const express = require('express');
const Stripe = require('stripe');
const { Pool } = require('pg'); // Para interagir com o banco de dados

const app = express();

// Use suas chaves do Stripe (coloque-as no seu arquivo .env)
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Configuração do Pool do PostgreSQL (igual ao seu bot.js ou config/db.js)
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 5432,
});

// Middleware para parsear JSON apenas na rota de criar-pagamento
app.use('/criar-pagamento', express.json());

// Função para ativar/atualizar o plano do usuário no banco de dados
async function activateUserPlan(userId, planIdentifier, stripeCustomerId, stripeSubscriptionId = null) {
    console.log(`[PaymentServer] Ativando plano para userId: ${userId}, plano: ${planIdentifier}`);
    let durationDays = 0;
    let planNameForDB = 'free'; // Nome do plano como será salvo no DB

    if (planIdentifier === 'price_1RVuYvFfl11ASjfZQeoDGYx8') { // Plano Express
        planNameForDB = 'express';
        durationDays = 1;
    } else if (planIdentifier === 'price_1RVuzOFfl11ASjfZ9LjmVGfJ') { // Plano Trilha Completa
        planNameForDB = 'explorer'; // Ou 'trilha_completa'
        durationDays = 3;
    } else if (planIdentifier === process.env.STRIPE_PRICE_ID_VIP) { // Plano VIP (use Price ID do .env)
        planNameForDB = 'vip';
        durationDays = 30; // Exemplo: VIP dá 30 dias de acesso
    } else {
        console.error(`[PaymentServer] Identificador de plano desconhecido: ${planIdentifier}`);
        return false;
    }

    if (durationDays > 0) {
        const activationTime = new Date();
        const expiryTime = new Date(activationTime.getTime() + durationDays * 24 * 60 * 60 * 1000);

        try {
            // Aqui você faria um UPDATE ou INSERT na sua tabela de usuários/planos
            // Exemplo: Supondo uma tabela 'user_plans'
            // A coluna user_id deve corresponder ao client_reference_id (ex: número do WhatsApp)
            const query = `
                INSERT INTO user_subscription_status (user_id, active_plan, plan_activation_timestamp, plan_expiry_timestamp, stripe_customer_id, stripe_subscription_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (user_id) DO UPDATE 
                SET active_plan = EXCLUDED.active_plan,
                    plan_activation_timestamp = EXCLUDED.plan_activation_timestamp,
                    plan_expiry_timestamp = EXCLUDED.plan_expiry_timestamp,
                    stripe_customer_id = EXCLUDED.stripe_customer_id,
                    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                    updated_at = NOW();
            `;
            await pool.query(query, [userId, planNameForDB, activationTime, expiryTime, stripeCustomerId, stripeSubscriptionId]);
            console.log(`[PaymentServer] Plano '${planNameForDB}' ativado para ${userId} até ${expiryTime.toISOString()}`);
            return true;
        } catch (dbError) {
            console.error(`[PaymentServer DB ERRO] Falha ao atualizar plano para ${userId}:`, dbError);
            return false;
        }
    }
    return false;
}


// Rota para criar um link de pagamento para um plano
app.post('/criar-pagamento', async(req, res) => {
    const { planoIdParaStripe, nomeUsuario, emailUsuario } = req.body; // planoIdParaStripe é o Price ID do Stripe

    // Verifique se o planoIdParaStripe foi fornecido
    if (!planoIdParaStripe) {
        return res.status(400).json({ error: 'ID do plano não fornecido.' });
    }

    console.log(`[PaymentServer] Recebida solicitação de pagamento para plano ID: ${planoIdParaStripe} por usuário: ${nomeUsuario}`);

    try {
        const sessionParams = {
            payment_method_types: ['card'], // Ou ['card', 'boleto'] etc.
            mode: 'payment', // Para pagamentos únicos. Se for assinatura, use 'subscription'
            line_items: [{
                price: planoIdParaStripe, // Este DEVE ser um Price ID (price_xxxx)
                quantity: 1
            }],
            // Se for assinatura e você quiser coletar dados do cliente no Stripe
            // customer_email: emailUsuario, // Opcional se o cliente já existe ou se o Checkout coleta
            // client_reference_id idealmente é o seu userKey do WhatsApp (ex: número de telefone)
            client_reference_id: nomeUsuario,
            success_url: process.env.STRIPE_SUCCESS_URL || `https://fozzytour.com/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: process.env.STRIPE_CANCEL_URL || `https://fozzytour.com/cancelado`
        };

        // Se você tiver um cliente Stripe e quiser associar:
        // let customer;
        // if (emailUsuario) {
        //     const existingCustomers = await stripe.customers.list({ email: emailUsuario, limit: 1 });
        //     if (existingCustomers.data.length > 0) {
        //         customer = existingCustomers.data[0];
        //     } else {
        //         customer = await stripe.customers.create({ email: emailUsuario, name: nomeUsuario });
        //     }
        //     sessionParams.customer = customer.id;
        // }

        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log(`[PaymentServer] Sessão de checkout criada: ${session.id} para ${nomeUsuario}`);
        res.json({ url: session.url, sessionId: session.id }); // Retorna a URL e o ID da sessão

    } catch (err) {
        console.error('[PaymentServer Stripe ERRO] Erro ao criar sessão de pagamento:', err.message);
        res.status(500).json({ error: 'Erro ao criar sessão de pagamento', details: err.message });
    }
});

// Webhook para receber confirmações de pagamento
// Use express.raw para ter acesso ao corpo bruto da requisição, necessário para verificação da assinatura do Stripe
app.post('/webhook', express.raw({ type: 'application/json' }), async(req, res) => {
    console.log('\n[PaymentServer Webhook] Endpoint /webhook ATINGIDO!'); // Log para ver se a rota é chamada
    const sig = req.headers['stripe-signature'];
    let event;

    if (!endpointSecret) {
        console.error('[PaymentServer Webhook ERRO] STRIPE_WEBHOOK_SECRET não está definido nas variáveis de ambiente!');
        return res.status(400).send('Webhook secret não configurado no servidor.');
    }

    try {
        console.log('[PaymentServer Webhook] Corpo da requisição (buffer):', req.body.toString('utf8').substring(0, 200) + "..."); // Loga o início do corpo bruto
        console.log('[PaymentServer Webhook] Assinatura recebida:', sig);
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log('[PaymentServer Webhook] Evento Stripe CONSTRUÍDO com sucesso! Tipo:', event.type, 'ID:', event.id);
    } catch (err) {
        console.error('[PaymentServer Webhook ERRO] Erro na validação/construção do evento Stripe:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Lidar com o evento
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const clientReferenceId = session.client_reference_id; // Seu ID de usuário (ex: número WhatsApp)
        const stripeCustomerId = session.customer;
        let priceIdComprado = null;

        console.log(`[PaymentServer Webhook] Evento checkout.session.completed para client_reference_id: ${clientReferenceId}`);
        console.log(`[PaymentServer Webhook] Detalhes da sessão (parcial):`, { id: session.id, payment_status: session.payment_status, customer: session.customer, display_items_length: session.display_items ? session.display_items.length : 'N/A' });


        // Tentativa de obter o Price ID do item pago
        if (session.display_items && session.display_items.length > 0 && session.display_items[0].price) {
            priceIdComprado = session.display_items[0].price.id;
        } else if (session.line_items && session.line_items.data && session.line_items.data.length > 0 && session.line_items.data[0].price) {
            // Se 'line_items' foi expandido na recuperação da sessão (geralmente não é por padrão no evento)
            priceIdComprado = session.line_items.data[0].price.id;
        } else {
            // Se não encontrar em display_items, tenta listar os line_items da sessão
            console.log(`[PaymentServer Webhook] Price ID não encontrado em display_items, tentando listar line_items para session ID: ${session.id}`);
            try {
                const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
                if (lineItems.data.length > 0 && lineItems.data[0].price) {
                    priceIdComprado = lineItems.data[0].price.id;
                    console.log(`[PaymentServer Webhook] Price ID obtido via listLineItems: ${priceIdComprado}`);
                } else {
                    console.warn(`[PaymentServer Webhook] Nenhum line_item encontrado para a sessão ${session.id}`);
                }
            } catch (listLineItemsError) {
                console.error("[PaymentServer Webhook ERRO] Falha ao listar line_items da sessão:", listLineItemsError.message);
            }
        }


        if (clientReferenceId && priceIdComprado) {
            console.log(`[PaymentServer Webhook] Processando ativação para usuário: ${clientReferenceId}, Plano Price ID: ${priceIdComprado}`);
            const ativacaoSucesso = await activateUserPlan(clientReferenceId, priceIdComprado, stripeCustomerId);
            if (ativacaoSucesso) {
                console.log(`[PaymentServer Webhook] Plano ATIVADO com sucesso no DB para ${clientReferenceId}.`);
            } else {
                console.error(`[PaymentServer Webhook ERRO] Falha na função activateUserPlan para ${clientReferenceId}.`);
            }
        } else {
            console.error(`[PaymentServer Webhook] Informação incompleta na sessão: client_reference_id ("<span class="math-inline">\{clientReferenceId\}"\) ou Price ID \("</span>{priceIdComprado}") faltando. Session ID: ${session.id}`);
        }
    } else if (event.type === 'invoice.payment_succeeded') {
        // ... (sua lógica para assinaturas recorrentes, se aplicável) ...
        console.log(`[PaymentServer Webhook] Evento invoice.payment_succeeded recebido.`);
    } else {
        console.log(`[PaymentServer Webhook] Evento recebido não tratado: ${event.type}`);
    }

    res.status(200).json({ received: true });
});

const PORT = process.env.PAYMENT_SERVER_PORT || 3001; // Usar uma porta diferente do bot principal
app.listen(PORT, () => console.log(`[PaymentServer] Servidor de pagamentos rodando na porta ${PORT}`));