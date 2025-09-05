function formatarLinkMapa(localInfo, textoSemMarcador) {
    // Log inicial para debug
    console.log(`[MAPS HELPER - ENTRADA CRUA] localInfo: "${localInfo}", textoSemMarcador: "${textoSemMarcador ? textoSemMarcador.substring(0, 70) + '...' : 'N/A'}"`);

    const local = localInfo.trim(); // Corrigido aqui

    if (!local) {
        console.log(`[MAPS HELPER] localInfo está vazio ou inválido. Não será gerado link de mapa.`);
        return textoSemMarcador || "❌ Desculpe, não consegui identificar o local para gerar o mapa.";
    }

    const localEncoded = encodeURIComponent(local);
    const linkMaps = `https://www.google.com/maps/search/?api=1&query=${localEncoded}`;

    console.log(`[MAPS HELPER] URL final do mapa gerado: ${linkMaps}`);

    return `${textoSemMarcador || ""}\n\n🗺️ Link para o mapa: ${linkMaps}`;
}

function sanitizarNomeParaArquivo(nome) {
    if (!nome) return "roteiro_padrao";
    const comAcento = "áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇñÑ";
    const semAcento = "aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUCnN";
    let nomeSanitizado = nome.split('').map(letra => {
        const index = comAcento.indexOf(letra);
        return index >= 0 ? semAcento[index] : letra;
    }).join('');

    return nomeSanitizado
        .replace(/\s+/g, '_')
        .replace(/[^\w-]/g, '')
        .replace(/__+/g, '_');
}

module.exports = {
    formatarLinkMapa,
    sanitizarNomeParaArquivo,
};