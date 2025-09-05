// /services/dbService.js
const { pool } = require('../config/db');
const botConfig = require('../config/botParameters');
const { processarMensagemComGemini } = require('./geminiService');
const searchFieldsConfig = {
    'find_restaurant': { table: 'restaurantes_foz_do_iguacu', alias: 'r', fields: ['nome_local', 'descricao'], id_column: 'id_restaurante', tema: true, order: 'avaliacao_media DESC NULLS LAST, nome_local' },
    'find_hotel': { table: 'hoteis_foz_do_iguacu', alias: 'h', fields: ['nome_local', 'descricao', 'comodidades', 'tipo'], id_column: 'id_hotel', tema: true, order: 'avaliacao_media DESC NULLS LAST, nome_local' },
    'find_shop_cde': { table: 'lojas_ciudad_del_este', alias: 's', fields: ['nome_local', 'tipo_local', 'categorias_principais', 'observacoes_importantes'], id_column: 'id_loja_py', tema: true, order: 'nome_local' },
    'find_tourist_spot': { table: 'pontos_turisticos_foz_do_iguacu', alias: 'pt', fields: ['nome_local', 'descricao'], id_column: 'id_ponto_turistico', tema: true, order: 'avaliacao_media DESC NULLS LAST, nome_local' },
    'find_museum': { table: 'museus_foz_do_iguacu', alias: 'm', fields: ['nome_local', 'descricao', 'tipo_exposicao'], id_column: 'id_museu', tema: true, order: 'avaliacao_media DESC NULLS LAST, nome_local' },
    'find_useful_service': { table: 'servicos_uteis_foz_do_iguacu', alias: 'su', fields: ['nome_local', 'tipo_servico', 'descricao'], id_column: 'id_servico', tema: false, order: 'nome_local' },
    'find_local_shop_foz': { table: 'lojas_comercio_foz_do_iguacu', alias: 'lf', fields: ['nome_local', 'tipo_produto', 'descricao', 'faixa_preco'], id_column: 'id_loja', tema: true, order: 'nome_local' },
    'find_leisure_spot': { table: 'lazer_foz_do_iguacu', alias: 'lz', fields: ['nome_local', 'tipo_lazer', 'descricao'], id_column: 'id_lazer', tema: true, order: 'avaliacao_media DESC NULLS LAST, nome_local' },
    'find_church_temple': { table: 'igrejas_templos_foz_do_iguacu', alias: 'it', fields: ['nome_local', 'religiao_predominante', 'descricao', 'estilo_arquitetonico'], id_column: 'id_igreja_templo', tema: false, order: 'nome_local' },
};

function extractKeywords(userQuery) {
    const lowerQuery = userQuery.toLowerCase();
    const tokens = lowerQuery.split(/\s+/);
    const stopwords = new Set([
        'de', 'o', 'a', 'para', 'com', 'em', 'onde', 'qual', 'um', 'uma', 'uns', 'umas', 'que', 'quer', 'queria',
        'gostaria', 'saber', 'posso', 'poderia', 'me', 'indica', 'indicar', 'tem', 'existe', 'sugere', 'sugestão',
        'pra', 'sobre', 'do', 'da', 'no', 'na', 'como', 'eu', 'você', 'ele', 'ela', 'nós', 'eles', 'elas',
        'estou', 'está', 'estamos', 'estão', 'ser', 'ir', 'ver', 'achar', 'encontrar',
        'quero', 'aconselhe', 'sugestao', 'sugestões', 'alguma', 'algum', 'coisa', 'coisas', 'nas', 'nos',
        'comprar', 'por favor', 'pfv', 'obrigado', 'obg', 'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite'
    ]);
    const keywords = tokens.filter(token => {
        const cleanToken = token.replace(/[^\wà-úÀ-Ú-]/g, '');
        return cleanToken.length > 2 && !stopwords.has(cleanToken);
    });
    return keywords;
}

function idColumnNameFromIntent(intentType) {
    const configEntry = searchFieldsConfig[intentType]; // Renomeado para evitar conflito com a variável 'config' global
    return configEntry ? configEntry.id_column : `id_${intentType.replace('find_', '')}`;
}

function determineIntent(userQuery, keywords) {
    const lowerQuery = userQuery.toLowerCase();

    const palavrasChaveCotacao = ['cotação', 'cotacao', 'dólar', 'dolar', 'euro', 'moeda', 'câmbio', 'cambio', 'converter', 'libras', 'ienes', 'cotaçao', 'Cotação', 'Cotaçao'];
    if (keywords.some(kw => palavrasChaveCotacao.includes(kw.toLowerCase())) ||
        lowerQuery.includes("quanto ta o dolar") ||
        lowerQuery.includes("valor do dolar") ||
        lowerQuery.includes("valor do euro") ||
        lowerQuery.includes("preço do dolar")) {
        console.log("[INTENT DEBUG] Intenção de cotação de moeda detectada por determineIntent.");
        return { type: 'get_currency_rates', keywords_for_db: keywords };
    }
    const palavrasChaveClima = ['clima ', 'Esta frio em ', 'Qual o clima em ', 'Qual a temperatura '];
    if (keywords.some(kw => palavrasChaveClima.includes(kw.toLowerCase())) || lowerQuery.includes("como esta o tempo")) {
        return { type: 'get_weather_forecast', keywords_for_db: keywords };
    }
    if (keywords.some(kw => [
            'restaurante', 'restaurantes', 'comer', 'comida', 'jantar', 'almoço', 'almocar', 'lanchar', 'lanche', 'bar', 'bares', 'pizzaria', 'churrascaria', 'petiscos', 'bebidas',
            'café da manhã', 'brunch', 'sobremesa', 'doce', 'salgado', 'fast food', 'delivery', 'buffet', 'rodízio', 'a la carte', 'prato feito', 'refeição',
            'vegetariano', 'vegano', 'sem glúten', 'frutos do mar', 'massa', 'carne', 'frango', 'peixe', 'sopa', 'salada', 'porção', 'porções', 'tira-gosto',
            'lanchonete', 'cafeteria', 'padaria', 'pub', 'boteco', 'botequim', 'hamburgueria', 'sorveteria', 'sushi', 'temakeria', 'cantina', 'bistrô', 'espetinho', 'pastelaria', 'galeteria',
            'fome', 'alimentação', 'cardápio', 'culinária', 'gastronomia', 'onde comer', 'indicação de restaurante', 'sugestão de restaurante'
        ].includes(kw)) ||
        lowerQuery.includes("onde comer") ||
        lowerQuery.includes("lugar para comer") ||
        lowerQuery.includes("onde posso comer") ||
        lowerQuery.includes("Lugares para comer em foz") ||
        lowerQuery.includes("Lugares para almoçar em foz") ||
        lowerQuery.includes("me indica um restaurante") ||
        lowerQuery.includes("sugestão de lugar para comer") ||
        lowerQuery.includes("onde almoçar") ||
        lowerQuery.includes("onde jantar") ||
        lowerQuery.includes("onde tomar café da manhã") ||
        lowerQuery.includes("procurando restaurante") ||
        lowerQuery.includes("procurando um bar") ||
        lowerQuery.includes("quero comer alguma coisa") ||
        lowerQuery.includes("estou com fome") ||
        lowerQuery.includes("opções de comida") ||
        lowerQuery.includes("melhores lugares para comer") ||
        lowerQuery.includes("onde tem comida boa") ||
        lowerQuery.includes("restaurante bom e barato") || // Pode ser um filtro posterior, mas a intenção é restaurante
        lowerQuery.includes("onde fazer um lanche") ||
        lowerQuery.includes("comer um petisco") ||
        lowerQuery.includes("tomar umas bebidas") ||
        lowerQuery.includes("achar um lugar para comer")
    ) {
        return { type: 'find_restaurant', keywords_for_db: keywords };
    }
    if (keywords.some(kw => [
            'hotel', 'hoteis', 'hospedagem', 'hospedar', 'pousada', 'pousadas', 'alojamento', 'dormir', 'quarto', 'quartos', 'resort', 'resorts',
            'motel', 'hostel', 'albergue', 'albergues', 'apart-hotel', 'flat', 'flats', 'suíte', 'suítes',
            'airb&b', 'pensão', 'estalagem', 'chalé', 'chalés', 'bangalô', 'cabana', 'guest house', 'casa de hóspedes',
            'estadia', 'pernoite', 'diária', 'diárias', 'reserva', 'reservar', 'acomodação', 'acomodações', 'vaga', 'hospedaria'
        ].includes(kw)) ||
        lowerQuery.includes("onde ficar") ||
        lowerQuery.includes("lugar para dormir") ||
        lowerQuery.includes("onde dormir") ||
        lowerQuery.includes("onde me hospedar") ||
        lowerQuery.includes("preciso de um hotel") ||
        lowerQuery.includes("preciso de uma pousada") ||
        lowerQuery.includes("indica um hotel") ||
        lowerQuery.includes("sugestão de hotel") ||
        lowerQuery.includes("indica uma pousada") ||
        lowerQuery.includes("sugestão de pousada") ||
        lowerQuery.includes("procurando hotel") ||
        lowerQuery.includes("procurando pousada") ||
        lowerQuery.includes("lugar para passar a noite") ||
        lowerQuery.includes("quarto para alugar") || // Pode ser um pouco ambíguo, mas turistas podem usar
        lowerQuery.includes("onde encontrar hospedagem") ||
        lowerQuery.includes("opções de hospedagem") ||
        lowerQuery.includes("melhores hoteis") ||
        lowerQuery.includes("pousada boa e barata") || // A intenção principal é pousada
        lowerQuery.includes("hotel perto de") || // "perto de" seria um filtro, mas a intenção é hotel
        lowerQuery.includes("fazer check-in") || // Implica busca por hotel
        lowerQuery.includes("reservar um quarto")
    ) {
        return { type: 'find_hotel', keywords_for_db: keywords };
    }
    if (
        keywords.some(kw => [
            // Palavras-chave existentes
            'compras no paraguai', 'compras no paraguay', 'Mega Eletronica',
            'comprar no paraguai', 'loja no paraguai',
            'compras bebidas no paraguai', 'compras maquiagem no paraguai', 'compras cosmeticos no paraguai', 'compras cosméticos no paraguai', 'compras relogios no paraguai', 'compras relógios no paraguai', 'compras oculos no paraguai', 'compras óculos no paraguai',
            'compras pesca no paraguai', 'compras artigos esportivos no paraguai', 'compras suplementos no paraguai', 'compras ferramentas no paraguai', 'compras pneus no paraguai', 'compras peças de carro no paraguai', 'compras peças de moto no paraguai',
            'compras video games no paraguai', 'compras consoles no paraguai', 'compras notebook no paraguai', 'compras notebooks no paraguai', 'compras tablet no paraguai', 'compras tablets no paraguai', 'compras som automotivo no paraguai', 'compras cameras no paraguai', 'compras câmeras no paraguai', 'compras drones no paraguai',
            'importados', 'produtos do paraguai', 'comprinhas no paraguai'
        ].includes(kw)) ||
        lowerQuery.includes("compras no paraguai") ||
        lowerQuery.includes("lojas cde") ||
        lowerQuery.includes("lojas no paraguai") ||
        lowerQuery.includes("comprar no paraguai") ||
        lowerQuery.includes("ir ao paraguai fazer compras") ||
        lowerQuery.includes("o que comprar no paraguai") ||
        lowerQuery.includes("melhores lojas no paraguai") ||
        lowerQuery.includes("lojas confiaveis no paraguai") ||
        lowerQuery.includes("loja de eletronicos no paraguai") ||
        lowerQuery.includes("onde comprar celular no paraguai") ||
        lowerQuery.includes("onde comprar no paraguai") ||
        lowerQuery.includes("perfumes no paraguai onde comprar") ||
        lowerQuery.includes("informatica ciudad del este") ||
        lowerQuery.includes("games em ciudad del este") ||
        lowerQuery.includes("roupas baratas no paraguai") ||
        lowerQuery.includes("bebidas cde no paraguai") ||
        lowerQuery.includes("maquiagem paraguai") ||
        lowerQuery.includes("shopping no paraguai")
    ) {
        return { type: 'find_shop_cde', keywords_for_db: keywords };
    }
    if (
        (keywords.some(kw => [
                // Palavras-chave existentes
                'loja foz', 'comercio foz', 'comprar em foz', 'shopping foz', 'souvenir em foz', 'souvenirs em foz', 'artesanato foz', 'lembrancinha foz', 'lembrancinhas em foz',
                'lojas em foz', 'loja em foz do iguaçu', 'comprar no brasil',
                'lojinhas em foz', 'galerias em foz',
                'presentes em foz', 'produtos regionais de foz', 'doces locais foz', 'cachaça artesanal de foz', 'pedras preciosas de foz', 'artigos de couro em foz',
                'roupas em foz', 'calçados em foz', 'livraria em foz', 'shopping center foz', 'lojas de departamento foz'
            ].includes(kw)) ||
            lowerQuery.includes("onde comprar em foz") ||
            lowerQuery.includes("lojas em foz do iguaçu") ||
            lowerQuery.includes("shopping em foz") ||
            lowerQuery.includes("onde comprar souvenir em foz") ||
            lowerQuery.includes("onde comprar artesanato em foz") ||
            lowerQuery.includes("lembrancinhas de foz") ||
            lowerQuery.includes("o que comprar em foz do iguaçu") ||
            lowerQuery.includes("rua de comercio em foz") ||
            lowerQuery.includes("melhores lojas em foz") ||
            lowerQuery.includes("lojas no centro de foz") ||
            lowerQuery.includes("presentes de foz do iguaçu") ||
            lowerQuery.includes("comprar roupa em foz") ||
            lowerQuery.includes("comprar calçado em foz") ||
            lowerQuery.includes("lojas abertas em foz hoje")
        ) &&
        !keywords.some(k => ['paraguai', 'paraguay', 'cde', 'ciudad del este', 'py'].includes(k.toLowerCase())) && // Garante que não são keywords do Paraguai
        !lowerQuery.includes("paraguai") && !lowerQuery.includes("ciudad del este") && !lowerQuery.includes(" cde") // Garante que não são frases sobre o Paraguai
    ) {
        return { type: 'find_local_shop_foz', keywords_for_db: keywords };
    }
    if (
        keywords.some(kw => [
            // Palavras-chave existentes
            'ponto turistico de foz', 'pontos turisticos', 'passeio em foz', 'passeios em foz', 'visitar em foz', 'conhecer em foz', 'atracao em foz', 'atrações em foz', 'atrativos em foz',
            'cataratas', 'cataratas do iguaçu', 'itaipu', 'usina de itaipu', 'parque das aves', 'marco das tres fronteiras', 'dreamland', 'vale dos dinossauros',
            'turismo', 'turistar em foz', 'explorar em foz', 'lugar interessante em foz', 'lugares interessantes em foz', 'atividades em foz', 'pontos de interesse em foz', 'o que tem pra fazer em foz', 'imperdível em foz', 'imperdíveis em foz',
            'macuco safari', 'trilha em foz', 'trilhas em foz', 'garganta do diabo',
            'circuito especial itaipu', 'visita panorâmica itaipu', 'kattamaram', 'refúgio biológico',
            'templo budista',
            'museu de cera', 'maravilhas do mundo', 'bar de gelo',
            'roda gigante', 'yup star',
            'blue park', 'parque aquático',
            'movie cars',
            'dreams park show',
            'agência de turismo em foz', 'agências de turismo em foz'
        ].includes(kw)) ||
        lowerQuery.includes("o que fazer em foz") ||
        lowerQuery.includes("o que fazer em foz do iguaçu") ||
        lowerQuery.includes("o que fazer agora em foz do iguaçu") ||
        lowerQuery.includes("lugares para visitar") ||
        lowerQuery.includes("lugares para conhecer em foz") ||
        lowerQuery.includes("quais os pontos turisticos") ||
        lowerQuery.includes("melhores passeios de foz") ||
        lowerQuery.includes("principais atrações de foz") ||
        lowerQuery.includes("roteiro em foz do iguaçu") ||
        lowerQuery.includes("dicas de passeios em foz") ||
        lowerQuery.includes("quero conhecer as cataratas") ||
        lowerQuery.includes("quero visitar itaipu") ||
        lowerQuery.includes("o que tem de bom pra fazer em foz") ||
        lowerQuery.includes("sugestões de passeios") ||
        lowerQuery.includes("pontos turisticos imperdiveis") ||
        lowerQuery.includes("o que ver em foz") ||
        lowerQuery.includes("atividades turisticas em foz") ||
        lowerQuery.includes("passeios em foz do iguaçu")
    ) {
        return { type: 'find_tourist_spot', keywords_for_db: keywords };
    }
    if (
        keywords.some(kw => [
            'museu', 'museus', 'exposição', 'exposicoes', 'arte', 'ecomuseu',
            'galeria', 'galerias', 'acervo', 'arqueologia',
            'museu de arte', 'museu histórico'
        ].includes(kw)) ||
        lowerQuery.includes("visitar museu") ||
        lowerQuery.includes("ver uma exposição") ||
        lowerQuery.includes("onde tem museu em foz") ||
        lowerQuery.includes("museus em foz do iguaçu") ||
        lowerQuery.includes("exposição de arte em foz") ||
        lowerQuery.includes("museu de história para visitar") ||
        lowerQuery.includes("o que tem no ecomuseu") || // Específico, mas relevante
        lowerQuery.includes("programação cultural museu") ||
        lowerQuery.includes("quero ir a um museu") ||
        lowerQuery.includes("sugestão de museu") ||
        lowerQuery.includes("galeria de arte para visitar") ||
        lowerQuery.includes("mostra cultural") ||
        lowerQuery.includes("lugares culturais em foz")
    ) {
        return { type: 'find_museum', keywords_for_db: keywords };
    }
    if (
        keywords.some(kw => [
            'serviço', 'servicos', 'serviços util em foz', 'serviços úteis em foz', 'útil', 'úteis', 'farmacia', 'farmácia', 'hospital', 'banco', 'bancos',
            'correio', 'correios', 'delegacia', 'cambio', 'câmbio', 'dinheiro', 'rodoviaria', 'rodoviária', 'aeroporto',
            'posto de saude', 'posto de saúde', 'informacao turistica', 'informação turística', 'policia', 'polícia',
            'emergência', 'emergencia', 'ajuda', 'assistência', 'assistencia', 'suporte', 'necessidade', 'pratico', 'prático', 'essencial',
            'médico', 'medico', 'dentista', 'clínica', 'clinica', 'upa', 'ambulância', 'ambulancia', 'pronto-socorro', 'remédio', 'remedio', 'drogaria',
            'caixa eletrônico', 'caixa eletronico', 'atm', 'sacar dinheiro', 'trocar dinheiro', 'casa de câmbio',
            'bombeiro', 'bombeiros', 'guarda municipal', 'segurança', 'seguranca', 'denúncia', 'denuncia', '190', '193',
            'ponto de táxi', 'ponto de taxi', 'parada de ônibus', 'ponto de onibus', 'aluguel de carro', 'locadora de veículos', 'transporte público', 'passagem', 'passagens', 'bilhete',
            'internet', 'wi-fi', 'wifi', 'lan house', 'recarga de celular', 'loja de conveniência', 'conveniencia', 'lavanderia', 'achados e perdidos',
            'banheiro público', 'banheiro', 'consulado', 'embaixada',
            'cat', 'centro de atendimento ao turista', 'guia', 'mapa',
            'mecânico', 'mecanico', 'borracharia', 'chaveiro', 'supermercado', 'posto de gasolina', 'combustível', 'combustivel'
        ].includes(kw.toLowerCase())) ||
        lowerQuery.includes("onde fica o hospital mais próximo") ||
        lowerQuery.includes("onde fica a Delegacia mais próximo") ||
        lowerQuery.includes("onde fica o Bombeiro mais próximo") ||
        lowerQuery.includes("farmácia de plantão") ||
        lowerQuery.includes("casa de câmbio aberta") ||
        lowerQuery.includes("preciso sacar dinheiro") ||
        lowerQuery.includes("comprar passagem de ônibus") ||
        lowerQuery.includes("alugar um carro") ||
        lowerQuery.includes("posto de saúde perto") ||
        lowerQuery.includes("delegacia de turismo")
    ) {
        return { type: 'find_useful_service', keywords_for_db: keywords };
    }
    if (
        (keywords.some(kw => [
                'lazer', 'diversao', 'diversão', 'entretenimento', 'parque', 'parques',
                'cinema', 'cinemas', 'teatro', 'teatros', 'show', 'shows', 'balada', 'baladas', 'vida noturna', 'boliche', 'kart',
                'passatempo', 'happy hour', 'sair à noite', 'curtir', 'agito', 'badalação', 'evento', 'eventos', 'para relaxar', 'descontrair', 'programa',
                'barzinho', 'barzinhos', 'pub', 'pubs', 'danceteria', 'boate', 'clube noturno', 'música ao vivo', 'musica ao vivo', 'stand-up', 'comédia',
                'quadra', 'quadras', 'pista de patinação', 'sinuca', 'bilhar', 'paintball', 'escape room', 'jogo de fuga',
                'feira', 'feiras', 'festival', 'festivais', 'apresentação', 'apresentações',
                'parquinho', 'playground', 'brinquedoteca', 'recreação',
                'praça', 'praças',
                'shopping'
            ].includes(kw.toLowerCase())) ||
            lowerQuery.includes("o que fazer a noite") ||
            lowerQuery.includes("onde ir a noite em foz") ||
            lowerQuery.includes("lugares para se divertir") ||
            lowerQuery.includes("opções de lazer em foz") ||
            lowerQuery.includes("sugestões de entretenimento") ||
            lowerQuery.includes("onde tem balada") ||
            lowerQuery.includes("barzinhos em foz") ||
            lowerQuery.includes("programação do cinema") ||
            lowerQuery.includes("show hoje") ||
            lowerQuery.includes("vida noturna em foz do iguaçu") ||
            lowerQuery.includes("lugar para dançar") ||
            lowerQuery.includes("jogar boliche") ||
            lowerQuery.includes("correr de kart") ||
            lowerQuery.includes("happy hour em foz") ||
            lowerQuery.includes("evento cultural em foz") ||
            lowerQuery.includes("parque para levar crianças") && !lowerQuery.includes("aves")
        ) &&
        !keywords.some(k => ['cataratas', 'cataratas do iguaçu', 'itaipu', 'usina de itaipu', 'parque das aves', 'marco das tres fronteiras', 'dreamland', 'ecomuseu', 'macuco safari', 'templo budista', 'mesquita', 'blue park'].includes(k.toLowerCase())) && // Lista de exclusão mais completa
        !(lowerQuery.includes("cataratas") || lowerQuery.includes("itaipu") || lowerQuery.includes("parque das aves") || lowerQuery.includes("marco das 3 fronteiras") || lowerQuery.includes("dreamland") || lowerQuery.includes("ecomuseu") || lowerQuery.includes("macuco") || lowerQuery.includes("templo budista") || lowerQuery.includes("mesquita") || lowerQuery.includes("blue park")) // Reforço na query
    ) {
        return { type: 'find_leisure_spot', keywords_for_db: keywords };
    }
    if (
        keywords.some(kw => [
            'igreja', 'igrejas', 'templo', 'templos', 'catedral', 'mesquita', 'budista',
            'religiao', 'religião', 'fé', 'missa', 'missas', 'culto', 'cultos', 'capela', 'capelas',
            'santuário', 'santuario', 'paróquia', 'paroquia', 'basílica', 'basilica', 'mosteiro', 'convento', 'sinagoga',
            'centro espírita', 'centro espirita', 'casa de oração', 'casa de oracao', 'local sagrado', 'local de culto', 'turismo religioso',
            'espiritual', 'meditação', 'meditacao', 'oração', 'oracao', 'rezar', 'benção', 'bencao',
            'cristão', 'cristao', 'católica', 'catolico', 'evangélica', 'evangelico', 'muçulmana', 'muculmana', 'islâmica', 'islamica',
            'chen tien',
            'omar ibn al-khattab'
        ].includes(kw.toLowerCase())) || // Adicionado toLowerCase() para as keywords
        lowerQuery.includes("visitar igreja") ||
        lowerQuery.includes("assistir missa") ||
        lowerQuery.includes("horário de culto") ||
        lowerQuery.includes("igrejas abertas para visitação") ||
        lowerQuery.includes("templo para visitar") ||
        lowerQuery.includes("como visitar o templo budista") || // Embora possa ser turístico, a base é "templo"
        lowerQuery.includes("como visitar a mesquita") || // Idem
        lowerQuery.includes("locais religiosos em foz") ||
        lowerQuery.includes("onde rezar em foz") ||
        lowerQuery.includes("igreja matriz de foz") ||
        lowerQuery.includes("catedral de nossa senhora de guadalupe") || // Nome da catedral de Foz
        lowerQuery.includes("lugares de fé para conhecer") ||
        lowerQuery.includes("turismo de fé") ||
        lowerQuery.includes("encontrar paz espiritual")
    ) {
        return { type: 'find_church_temple', keywords_for_db: keywords };
    }
    return null;
}

// DEFINIÇÃO DA FUNÇÃO FALTANTE
function shouldRespondDirectlyFromDB(intent, dbResults) {
    if (!dbResults || dbResults.length === 0) return false;
    if (dbResults.length >= 1 && dbResults.length <= 3) {
        return dbResults.every(r => r.nome_local); // Verifica se tem pelo menos o nome
    }
    return false; // Mais de 3, melhor refinar ou Gemini resumir
}

async function queryLocalDatabase(intent, originalKeywords) {
    if (!intent || !pool) {
        console.log('[DB] Pool do BD não configurado ou sem intenção, pulando query.');
        return [];
    }

    const relevantKeywords = originalKeywords.filter(kw => kw.length > 2);
    let rows = [];

    const executeQuery = async(sql, params, queryType) => {
        if (!sql) return [];
        // Removendo a substituição de múltiplos espaços para ver a query mais crua no log
        console.log(`[DB DEBUG] Query ${queryType}: ${sql.trim()}`);
        console.log(`[DB DEBUG] Params ${queryType}:`, params);
        try {
            const result = await pool.query(sql, params);
            console.log(`[DB DEBUG] Resultados ${queryType}: ${result.rows.length}`);
            return result.rows;
        } catch (err) {
            console.error(`[DB ERRO] Erro ao executar query ${queryType} para ${intent.type}:`, err.message, err.stack); // Logar a mensagem de erro também
            return [];
        }
    };

    const queryConfig = searchFieldsConfig[intent.type];

    // 1. TENTATIVA COM KEYWORDS
    if (relevantKeywords.length > 0 && queryConfig) {
        console.log(`[DB] Tentando busca com keywords: ${relevantKeywords.join(', ')} para intenção ${intent.type}`);
        let queryParams = [];
        let paramIndex = 1;
        let conditions = [];

        // Construção correta de selectFields
        let selectFields = queryConfig.fields.map(f => `${queryConfig.alias}.${f}`).join(', ');
        selectFields += `, ${queryConfig.alias}.${queryConfig.id_column}`; // Garante que a coluna de ID seja selecionada
        if (queryConfig.alias === 's') { // Para lojas_ciudad_del_este, pegamos todos os campos por enquanto
            selectFields = `${queryConfig.alias}.*`;
        } else if (queryConfig.alias === 'pt') { // Para pontos_turisticos, pegamos todos
            selectFields = `${queryConfig.alias}.*`;
        } // Adicione mais 'else if' para outras tabelas se precisar de SELECT *
        // Ou seja mais explícito em searchFieldsConfig sobre quais colunas cada tabela realmente precisa.

        if (queryConfig.tema) {
            selectFields += `, t.nome_tema AS tema_nome`;
        }

        let fromClause = `FROM ${queryConfig.table} ${queryConfig.alias}`;
        let joinClause = "";
        if (queryConfig.tema) {
            joinClause = ` LEFT JOIN temas_lugares t ON ${queryConfig.alias}.id_tema = t.id_tema`;
        }

        // Fallback para ordenação se config.order não estiver completo
        let orderByField = queryConfig.order ? queryConfig.order.split(' ')[0] : queryConfig.fields[0];
        let orderByDirection = (queryConfig.order && queryConfig.order.split(' ').length > 1) ? queryConfig.order.split(' ')[1] : 'ASC';

        let orderByClause = `ORDER BY ${queryConfig.alias}.${orderByField} ${orderByDirection} NULLS LAST LIMIT 3`;
        if (queryConfig.table.match(/restaurant|hotel|tourist_spot|museum|leisure_spot/i) && queryConfig.fields.includes('avaliacao_media')) {
            orderByClause = `ORDER BY ${queryConfig.alias}.avaliacao_media DESC NULLS LAST, ${queryConfig.alias}.nome_local LIMIT 3`;
        }

        const keywordConditions = [];
        relevantKeywords.forEach(kw => {
            const keywordParam = `%${kw}%`;
            let conditionParts = [];
            queryConfig.fields.forEach(field => {
                // CONSTRUÇÃO CORRETA DA CONDIÇÃO ILIKE
                conditionParts.push(`${queryConfig.alias}."${field}" ILIKE $${paramIndex++}`); // Coloca nome do campo entre aspas se tiver caracteres especiais/maiúsculas
                queryParams.push(keywordParam);
            });
            if (queryConfig.tema) {
                conditionParts.push(`t.nome_tema ILIKE $${paramIndex++}`);
                queryParams.push(keywordParam);
            }
            if (conditionParts.length > 0) { // Garante que haja algo para juntar
                keywordConditions.push(`(${conditionParts.join(' OR ')})`);
            }
        });

        if (keywordConditions.length > 0) {
            conditions.push(`(${keywordConditions.join(' OR ')})`);
        }

        // Adicionar filtros específicos (como preço)
        if (intent.type === 'find_restaurant') {
            if (originalKeywords.some(k => ["barato", "econômico"].includes(k))) conditions.push(`${queryConfig.alias}.preco_medio_pessoa <= 50.00`);
            // ... outros filtros de preço ...
        } else if (intent.type === 'find_hotel') {
            // ... filtros de hotel ...
        } // ... etc para outros tipos de intenção ...

        if (fromClause) { // Garante que fromClause foi definida
            let sqlWithKeywords = `SELECT ${selectFields} ${fromClause} ${joinClause} `;
            if (conditions.length > 0) {
                sqlWithKeywords += " WHERE " + conditions.join(" AND ");
            }
            sqlWithKeywords += ` ${orderByClause}`;
            rows = await executeQuery(sqlWithKeywords, queryParams, "com Keywords");
        }
    }

    // 2. SE NÃO HOUVE RESULTADOS COM KEYWORDS, TENTA BUSCA GENÉRICA
    if (rows.length === 0 && intent.type && queryConfig) {
        console.log(`[DB] Sem resultados com keywords para ${intent.type}. Tentando busca genérica.`);

        let selectFields = `${queryConfig.alias}.*`;
        if (queryConfig.tema) selectFields += `, t.nome_tema AS tema_nome`;

        let baseQuery = `FROM ${queryConfig.table} ${queryConfig.alias}`;
        let orderByField = queryConfig.order ? queryConfig.order.split(' ')[0] : queryConfig.fields[0];
        let orderByDirection = (queryConfig.order && queryConfig.order.split(' ').length > 1) ? queryConfig.order.split(' ')[1] : 'ASC';
        let orderByClause = `ORDER BY ${queryConfig.alias}."${orderByField}" ${orderByDirection} NULLS LAST LIMIT 3`; // Aspas no campo de ordenação

        if (queryConfig.table.match(/restaurant|hotel|tourist_spot|museum|leisure_spot/i) && queryConfig.fields.includes('avaliacao_media')) { // Ajuste para verificar se avaliacao_media está em queryConfig.fields
            orderByClause = `ORDER BY ${queryConfig.alias}.avaliacao_media DESC NULLS LAST, ${queryConfig.alias}.nome_local LIMIT 3`;
        }

        let sqlGeneric = `SELECT ${selectFields} ${baseQuery} `;
        if (queryConfig.tema) {
            sqlGeneric += ` LEFT JOIN temas_lugares t ON ${queryConfig.alias}.id_tema = t.id_tema `;
        }
        sqlGeneric += ` ${orderByClause}`;
        rows = await executeQuery(sqlGeneric, [], "Genérica");
    }
    return rows;
}



function formatDbResultsForPrompt(results, intent) {
    if (!results || results.length === 0) return "Nenhum resultado encontrado no guia local.";
    let typeName = "resultados";
    if (intent.type === 'find_restaurant') typeName = 'restaurantes';
    else if (intent.type === 'find_hotel') typeName = 'hotéis';
    else if (intent.type === 'find_shop_cde') typeName = 'lojas em Ciudad del Este';
    else if (intent.type === 'find_tourist_spot') typeName = 'pontos turísticos';
    else if (intent.type === 'find_museum') typeName = 'museus';
    else if (intent.type === 'find_useful_service') typeName = 'serviços úteis';
    else if (intent.type === 'find_local_shop_foz') typeName = 'lojas em Foz';
    else if (intent.type === 'find_leisure_spot') typeName = 'opções de lazer';
    else if (intent.type === 'find_church_temple') typeName = 'igrejas ou templos';

    let formatted = `Encontrei ${results.length} ${typeName} em nosso guia que podem te interessar:\n`;
    results.forEach((r, index) => {
                formatted += `\n${index + 1}. ${r.nome_local}:\n`;
                if (r.descricao) formatted += `   - Sobre: ${r.descricao.substring(0,150)}${r.descricao.length > 150 ? '...' : ''}\n`;
                if (r.tema_nome) formatted += `   - Tema: ${r.tema_nome}\n`;

                if (intent.type === 'find_restaurant' && r.preco_medio_pessoa) formatted += `   - Preço Médio: R$ ${parseFloat(r.preco_medio_pessoa).toFixed(2)}\n`;
                if (intent.type === 'find_hotel') {
                    if (r.faixa_preco_diaria) formatted += `   - Faixa de Preço: ${r.faixa_preco_diaria}\n`;
                    if (r.tipo) formatted += `   - Tipo: ${r.tipo}\n`;
                    if (r.comodidades) formatted += `   - Comodidades: ${r.comodidades.substring(0,100)}...\n`;
                }
                if (intent.type === 'find_shop_cde') {
                    if (r.categorias_principais) formatted += `   - Categorias: ${r.categorias_principais}\n`;
                    if (r.tipo_local) formatted += `   - Tipo: ${r.tipo_local}\n`;
                    if (r.observacoes_importantes) formatted += `   - Obs: ${r.observacoes_importantes.substring(0,100)}...\n`;
                    if (r.avaliacao_geral_informal) formatted += `   - Avaliação (informal): ${r.avaliacao_geral_informal}\n`;
                }
                if ((intent.type === 'find_tourist_spot' || intent.type === 'find_museum' || intent.type === 'find_leisure_spot')) {
                    const priceField = intent.type === 'find_leisure_spot' ? r.preco_medio : r.preco_entrada;
                    if (priceField !== null && priceField !== undefined) {
                        formatted += `   - Entrada/Preço: ${priceField == 0 ? 'Grátis!' : `R$ ${parseFloat(priceField).toFixed(2)}`}\n`;
            }
        }
        if (intent.type === 'find_museum' && r.tipo_exposicao) formatted += `   - Tipo de Exposição: ${r.tipo_exposicao}\n`;
        if (intent.type === 'find_useful_service' && r.tipo_servico) formatted += `   - Tipo de Serviço: ${r.tipo_servico}\n`;
        if (intent.type === 'find_local_shop_foz') {
            if (r.tipo_produto) formatted += `   - Produtos: ${r.tipo_produto}\n`;
            if (r.faixa_preco) formatted += `   - Faixa de Preço: ${r.faixa_preco}\n`;
        }
        if (intent.type === 'find_leisure_spot' && r.tipo_lazer) formatted += `   - Tipo de Lazer: ${r.tipo_lazer}\n`;
        if (intent.type === 'find_church_temple') {
            if (r.religiao_predominante) formatted += `   - Religião: ${r.religiao_predominante}\n`;
            if (r.estilo_arquitetonico) formatted += `   - Estilo: ${r.estilo_arquitetonico}\n`;
            if (r.horario_visita) formatted += `   - Visitação: ${r.horario_visita}\n`;
        }

        if (r.endereco) formatted += `   - Endereço: ${r.endereco}\n`;
        if (r.avaliacao_media && intent.type !== 'find_shop_cde') formatted += `   - Avaliação: ${parseFloat(r.avaliacao_media).toFixed(1)}/5.0\n`;
        
        if (!(intent.type === 'find_church_temple' && r.horario_visita) && r.horario_funcionamento) {
            formatted += `   - Horário: ${r.horario_funcionamento}\n`;
        }
    });
    return formatted;
}

function generateDirectResponseFromDB(results, intent, language, currentUserContext) { // Adicionado currentUserContext
    if (!results || results.length === 0) {
        if (currentUserContext) currentUserContext.lastListedItems = null;
        return null;
    }

    let responseText = "";
    const mapsTargetBase = "MAPS_TARGET:[";

    const addCommonDetails = (item, text, isChurch = false) => {
        // ... (sua lógica de addCommonDetails com prioridade para endereço/nome para MAPS_TARGET) ...
        // Esta função já está boa conforme nossa última versão.
        // Apenas garanta que botConfig.CIDADE_BOT está acessível.
        if (item.tema_nome) text += `\n🎨 Tema: ${item.tema_nome}.`;
        if (item.avaliacao_media && intent.type !== 'find_shop_cde') {
             text += `\n🌟 Avaliação: ${parseFloat(item.avaliacao_media).toFixed(1)}/5.0.`;
        }
        if (isChurch && item.horario_visita) {
            text += `\n🕒 Visitação: ${item.horario_visita}.`;
        } else if (item.horario_funcionamento) {
            text += `\n🕒 Horário: ${item.horario_funcionamento}.`;
        }
        let targetLocation;
        const isStoreCDEIntent = intent.type === 'find_shop_cde';
        const isStoreFozIntent = intent.type === 'find_local_shop_foz';

        if ((isStoreCDEIntent || isStoreFozIntent) && item.nome_local && item.nome_local.trim() !== "") {
            targetLocation = `${item.nome_local}, ${isStoreCDEIntent ? 'Ciudad del Este' : botConfig.CIDADE_BOT}`;
        } else if (item.endereco && item.endereco.trim() !== "") {
            targetLocation = item.endereco;
        } else if (item.nome_local && item.nome_local.trim() !== "") {
            if (isStoreCDEIntent && item.referencia_localizacao) {
                targetLocation = `${item.nome_local}, ${item.referencia_localizacao}, Ciudad del Este`;
            } else {
                targetLocation = `${item.nome_local}, ${botConfig.CIDADE_BOT}`;
            }
        } else {
            targetLocation = botConfig.CIDADE_BOT;
        }
        console.log(`[MAPS DB] targetLocation para MAPS_TARGET: "${targetLocation}"`);
        text += ` ${mapsTargetBase}${targetLocation}]`;
        return text;
    };

    if (results.length === 1) {
        const r = results[0];
        // ... (sua lógica para formatar um único resultado) ...
        if (currentUserContext) currentUserContext.lastListedItems = null;
    } else { // Múltiplos resultados
        let typeNameMultiple = "opções";
        // ... (sua lógica para definir typeNameMultiple) ...
        responseText = `Opa! Encontrei estas ${typeNameMultiple} que podem te interessar:\n`;
        
        const listedItemsContext = [];
        const tableNameFromConfig = searchFieldsConfig[intent.type]?.table; // Pega o nome da tabela da config

        results.forEach((r, index) => {
            responseText += `\n${index + 1}. "${r.nome_local}"`;
            // ... (adicionar alguns detalhes breves) ...
            responseText += "\n";

            const idColName = idColumnNameFromTable(tableNameFromConfig || intent.type); // Usa o nome da tabela da config se disponível
            if (r[idColName]) {
                listedItemsContext.push({
                    name: r.nome_local,
                    id: r[idColName],
                    type: intent.type, // ex: 'find_shop_cde'
                    locationContext: (intent.type === 'find_shop_cde' ? 'Ciudad del Este' : botConfig.CIDADE_BOT) // Contexto geográfico
                });
            } else {
                console.warn(`[CONTEXTO DB] Item "${r.nome_local}" (tipo: ${intent.type}) não possui a coluna de ID esperada '${idColName}'. Não será adicionado ao contexto de follow-up.`);
            }
        });
        responseText += `\nQual deles te chamou mais atenção ou quer refinar a busca? 😉`;
        
        if (currentUserContext && listedItemsContext.length > 0) {
            currentUserContext.lastListedItems = listedItemsContext;
            currentUserContext.lastListedItemsTimestamp = Date.now(); // Opcional
            console.log('[CONTEXTO DB] Itens listados armazenados para follow-up:', currentUserContext.lastListedItems);
        } else if (currentUserContext) {
            currentUserContext.lastListedItems = null; // Limpa se nada foi adicionado
        }
    }
    return responseText || null;
}

async function getStaticSuggestionsByProfile(profileThemes, duration) {
    if (!pool || !profileThemes || profileThemes.length === 0) return [];

    console.log(`[DB] Buscando sugestões estáticas para temas: ${profileThemes.join(', ')} e duração: ${duration} dias.`);
    const suggestions = [];
    const limitPerType = duration <= 2 ? 1 : (duration <= 4 ? 2 : 3); // Sugestões por tipo de local

    // Mapeia temas de perfil para nomes de tema no BD (EXEMPLO, ajuste conforme seus dados em 'temas_lugares')
    // Isso pode ser mais sofisticado. Por ora, vamos assumir que os profileThemes são os nomes dos temas.
    const themePlaceholders = profileThemes.map((_, i) => `$${i + 1}`).join(', ');
    
    try {
        // Exemplo: Buscar Pontos Turísticos
        let query = `
            SELECT pt.nome_local, pt.descricao, pt.endereco, pt.latitude, pt.longitude, t.nome_tema
            FROM pontos_turisticos_foz_do_iguacu pt
            LEFT JOIN temas_lugares t ON pt.id_tema = t.id_tema
            WHERE t.nome_tema IN (${themePlaceholders}) 
            ORDER BY RANDOM() -- Ou por avaliação_media DESC NULLS LAST
            LIMIT $${profileThemes.length + 1};
        `;
        let result = await pool.query(query, [...profileThemes, limitPerType]);
        result.rows.forEach(r => suggestions.push({
            nome_local: r.nome_local,
            descricao_curta: r.descricao ? r.descricao.substring(0, 70) + "..." : "Ótima opção!",
            mapsTarget: `MAPS_TARGET:[${r.endereco || r.nome_local + ', ' + botConfig.CIDADE_BOT}]`
        }));

        // Exemplo: Buscar Lazer (se tiver poucos pontos turísticos ou para variar)
        if (suggestions.length < (limitPerType * 2)) { // Tenta buscar mais se ainda não tem muitas sugestões
            query = `
                SELECT lz.nome_local, lz.descricao, lz.endereco, lz.latitude, lz.longitude, t.nome_tema, lz.tipo_lazer
                FROM lazer_foz_do_iguacu lz
                LEFT JOIN temas_lugares t ON lz.id_tema = t.id_tema
                WHERE t.nome_tema IN (${themePlaceholders})
                ORDER BY RANDOM()
                LIMIT $${profileThemes.length + 1};
            `;
            result = await pool.query(query, [...profileThemes, limitPerType]);
            result.rows.forEach(r => {
                if (!suggestions.some(s => s.nome_local === r.nome_local)) { // Evita duplicados
                    suggestions.push({
                        nome_local: r.nome_local,
                        descricao_curta: r.tipo_lazer || (r.descricao ? r.descricao.substring(0, 70) + "..." : "Diversão garantida!"),
                        mapsTarget: `MAPS_TARGET:[${r.endereco || r.nome_local + ', ' + botConfig.CIDADE_BOT}]`
                    });
                }
            });
        }
        
        // Você pode adicionar buscas em 'restaurantes', 'museus', etc., de forma similar,
        // sempre verificando se já tem sugestões suficientes e evitando duplicados.

        console.log(`[DB] Sugestões estáticas encontradas: ${suggestions.length}`);
        return suggestions.slice(0, 3); // Retorna no máximo 3 sugestões no total

    } catch (error) {
        console.error("[DB ERRO] Erro ao buscar sugestões estáticas por perfil:", error);
        return [];
    }
}
function idColumnNameFromTable(tableName) {
    if (tableName.startsWith('restaurantes')) return 'id_restaurante';
    if (tableName.startsWith('hoteis')) return 'id_hotel';
    if (tableName.startsWith('lojas_ciudad_del_este')) return 'id_loja_py';
    if (tableName.startsWith('pontos_turisticos')) return 'id_ponto_turistico';
    if (tableName.startsWith('museus')) return 'id_museu';
    if (tableName.startsWith('servicos_uteis')) return 'id_servico';
    if (tableName.startsWith('lojas_comercio_foz')) return 'id_loja';
    if (tableName.startsWith('lazer')) return 'id_lazer';
    if (tableName.startsWith('igrejas_templos')) return 'id_igreja_templo';
    return `id_${tableName.split('_')[0]}`; // Tentativa genérica
}
async function getSpecificItemById(itemId, itemType) {
    if (!itemId || !itemType || !pool) return null;

    let tableName = "";
    let idColumn = "";
    let joinWithTemas = false;
    let tableAlias = "main"; // Usado para consistência com queryLocalDatabase
    let selectFields = `${tableAlias}.*`;

    // Mapeia itemType para tabela e coluna de ID.
    // Certifique-se de que os nomes das tabelas e colunas de ID correspondam ao seu banco.
    const config = searchFieldsConfig[itemType]; // Reutiliza searchFieldsConfig de queryLocalDatabase
    if (!config) {
        console.error(`[DB ERR] Configuração não encontrada para itemType: ${itemType} em getSpecificItemById`);
        return null;
    }
    
    tableName = config.table;
    idColumn = Object.keys(searchFieldsConfig).find(key => searchFieldsConfig[key].table === tableName && searchFieldsConfig[key].alias + '.' + idColumnNameFromTable(tableName) === config.alias + '.' + idColumnNameFromTable(tableName)) ? idColumnNameFromTable(tableName) : 'id'; // Tenta deduzir nome da coluna ID
    tableAlias = config.alias;
    joinWithTemas = config.tema;

    if (joinWithTemas) {
        selectFields += ', t.nome_tema AS tema_nome';
    }

    let sql = `SELECT ${selectFields} FROM ${tableName} ${tableAlias}`;
    if (joinWithTemas) {
        sql += ` LEFT JOIN temas_lugares t ON ${tableAlias}.id_tema = t.id_tema`;
    }
    sql += ` WHERE ${tableAlias}.${idColumn} = $1 LIMIT 1`;

    try {
        console.log(`[DB DEBUG] Query Específica: ${sql} com ID: ${itemId}`);
        const { rows } = await pool.query(sql, [itemId]);
        if (rows.length > 0) {
            console.log(`[DB DEBUG] Item específico encontrado:`, rows[0].nome_local);
            return rows[0];
        }
        return null;
    } catch (err) {
        console.error(`[DB ERRO] Erro ao buscar item específico ${itemType} (ID: ${itemId}, Tabela: ${tableName}, ColunaID: ${idColumn}):`, err.stack);
        return null;
    }
}



module.exports = {
    extractKeywords,
    determineIntent,
    queryLocalDatabase,
    formatDbResultsForPrompt,
    generateDirectResponseFromDB,
    shouldRespondDirectlyFromDB,
    getStaticSuggestionsByProfile,
    getSpecificItemById,
};