// /services/userService.js
const { getPool } = require('../config/db'); // Usar getPool ao invés de pool

async function getUserPlanDetails(userId) {
    if (!userId) return { active_plan: 'free', personaModifier: null };

    try {
        const pool = getPool(); // Obter a instância do pool
        if (!pool) {
            console.warn(`[UserService] Pool de BD não disponível. Retornando plano 'free' para ${userId}.`);
            return { active_plan: 'free', personaModifier: null };
        }

        const query = `
            SELECT active_plan, plan_expiry_timestamp, persona_modifier_text 
            FROM user_subscription_status 
            WHERE user_id = $1 
            ORDER BY plan_activation_timestamp DESC 
            LIMIT 1; 
        `;
        // A query acima busca o status mais recente.
        // Você pode querer armazenar o persona_modifier_text diretamente no banco ou mapeá-lo aqui.

        const { rows } = await pool.query(query, [userId]);

        if (rows.length > 0) {
            const plan = rows[0];
            const now = new Date();
            if (plan.plan_expiry_timestamp && new Date(plan.plan_expiry_timestamp) < now) {
                // Plano expirou
                console.log(`[UserService] Plano '${plan.active_plan}' para usuário ${userId} expirou em ${plan.plan_expiry_timestamp}. Revertendo para 'free'.`);
                return { active_plan: 'free', personaModifier: null };
            }

            // Mapear nome do plano do DB para personaModifier se não estiver no DB
            let personaModifier = plan.persona_modifier_text; // Se você salvar o texto do modificador no DB
            if (!personaModifier) {
                if (plan.active_plan === 'express') {
                    personaModifier = "\n\n**PLANO EXPRESS ATIVADO!** 🚀 Vamos direto ao ponto com as melhores dicas para seu dia!";
                } else if (plan.active_plan === 'explorer') {
                    personaModifier = "\n\n**MODO FOZZI EXPLORADOR (Trilha Completa) ATIVADO!** 🤓 ...";
                } else if (plan.active_plan === 'vip') {
                    personaModifier = "\n\n**MODO FOZZI VIP ATIVADO!** 🌟 ...";
                }
            }
            console.log(`[UserService] Usuário ${userId} tem plano ativo: ${plan.active_plan}`);
            return { active_plan: plan.active_plan, personaModifier: personaModifier };
        }
        console.log(`[UserService] Nenhum plano ativo encontrado para ${userId}. Definindo como 'free'.`);
        return { active_plan: 'free', personaModifier: null };
    } catch (dbError) {
        console.error(`[UserService DB ERRO] Falha ao buscar plano para ${userId}:`, dbError);
        return { active_plan: 'free', personaModifier: null }; // Default para free em caso de erro
    }
}

module.exports = { getUserPlanDetails };