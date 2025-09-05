// /services/financeService.js
// Certifique-se de ter o axios instalado: npm install axios
const axios = require('axios');

async function obterCotacaoAtualizada() {
    try {
        // Solicita as cotações de USD, EUR, CAD, ARS, PYG para BRL
        const { data } = await axios.get('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,CAD-BRL,ARS-BRL,PYG-BRL');

        if (!data.USDBRL || !data.EURBRL || !data.CADBRL || !data.ARSBRL || !data.PYGBRL) {
            console.error("[COTAÇÃO ERRO] API não retornou todos os pares de moeda esperados.");
            return "🦜 Desculpe, tive um probleminha para buscar algumas cotações no momento. Tente de novo mais tarde!";
        }

        const usdBrltxt = parseFloat(data.USDBRL.bid).toFixed(2);
        const eurBrltxt = parseFloat(data.EURBRL.bid).toFixed(2);
        const cadBrltxt = parseFloat(data.CADBRL.bid).toFixed(2);
        const arsBrltxt = parseFloat(data.ARSBRL.bid).toFixed(4);
        const pygBrltxt = parseFloat(data.PYGBRL.bid).toFixed(5);

        return `🪙 **Cotações de Hoje** (valor de 1 unidade da moeda em Reais):\n` +
            `-------------------------------------\n` +
            `🇺🇸 1 Dólar Americano (USD): R$ ${usdBrltxt}\n` +
            `🇪🇺 1 Euro (EUR): R$ ${eurBrltxt}\n` +
            `🇨🇦 1 Dólar Canadense (CAD): R$ ${cadBrltxt}\n` +
            `🇦🇷 1 Peso Argentino (ARS): R$ ${arsBrltxt}\n` +
            `🇵🇾 1 Guarani Paraguaio (PYG): R$ ${pygBrltxt}\n` +
            `-------------------------------------\n` +
            `Lembre-se que estes são valores de referência e podem variar um pouco em casas de câmbio. Para valores exatos, é sempre bom confirmar antes! 😉`;

    } catch (err) {
        console.error("[COTAÇÃO ERRO] Erro ao buscar cotação atualizada:", err.message);
        return "🦜 Desculpe, não consegui buscar as cotações no momento. Por favor, tente novamente em alguns instantes!";
    }
}

module.exports = { obterCotacaoAtualizada };