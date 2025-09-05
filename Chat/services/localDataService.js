// /services/localDataService.js
const fs = require('fs').promises;
const path = require('path');
// Assumindo que extractKeywords está em dbService.js ou utils/helpers.js e é importada aqui
const { extractKeywords } = require('./dbService'); // Ou de onde você a exporta

let staticQAData = [];
let fozDoIguacuPosts = [];
let freeTierQAData = []; // Para o JSON de não assinantes

async function carregarPostsLocais() {
    // Tentar diferentes caminhos possíveis
    const possiblePaths = [
        path.join(process.cwd(), '..', 'web-Test', 'posts_FozDoIguacu.json'), // Quando roda da pasta Chat
        path.join(process.cwd(), 'web-Test', 'posts_FozDoIguacu.json'), // Quando roda da raiz
        path.join(__dirname, '..', '..', 'web-Test', 'posts_FozDoIguacu.json') // Relativo ao arquivo atual
    ];

    let jsonFilePath = null;
    for (const testPath of possiblePaths) {
        try {
            await fs.access(testPath);
            jsonFilePath = testPath;
            break;
        } catch (err) {
            // Arquivo não existe neste caminho, tenta o próximo
        }
    }

    if (!jsonFilePath) {
        console.warn("[AVISO] Arquivo posts_FozDoIguacu.json não encontrado em nenhum caminho esperado.");
        fozDoIguacuPosts = [];
        return;
    }

    try {
        const jsonData = await fs.readFile(jsonFilePath, 'utf-8');
        const parsedData = JSON.parse(jsonData);
        if (parsedData && Array.isArray(parsedData.posts)) {
            fozDoIguacuPosts = parsedData.posts.map(post => ({
                id: post.id || 'desconhecido',
                texto: post.texto || ''
            }));
            console.log(`[INFO] Carregados ${fozDoIguacuPosts.length} posts do arquivo JSON '${path.basename(jsonFilePath)}'.`);
        } else {
            console.error("[ERRO] Formato do JSON de posts inválido.");
            fozDoIguacuPosts = [];
        }
    } catch (err) {
        console.warn("[AVISO] Não foi possível carregar ou parsear o arquivo JSON de posts:", jsonFilePath, err.message);
        fozDoIguacuPosts = [];
    }
}

function buscarPostsRelevantes(query, maxResultados = 2, minPalavrasChaveMatch = 1) {
    if (!query || !fozDoIguacuPosts || !Array.isArray(fozDoIguacuPosts) || fozDoIguacuPosts.length === 0) {
        return [];
    }
    const palavrasChaveQuery = extractKeywords(query);
    if (palavrasChaveQuery.length === 0) {
        return [];
    }
    const postsRelevantes = [];
    fozDoIguacuPosts.forEach(post => {
        if (!post || !post.texto || typeof post.texto !== 'string') { return; }
        const textoPostLower = post.texto.toLowerCase();
        let score = 0;
        let palavrasEncontradas = new Set();
        palavrasChaveQuery.forEach(palavraChave => {
            if (textoPostLower.includes(palavraChave.toLowerCase())) {
                score++;
                palavrasEncontradas.add(palavraChave);
            }
        });
        if (palavrasEncontradas.size >= minPalavrasChaveMatch) {
            postsRelevantes.push({...post, score });
        }
    });
    return postsRelevantes.sort((a, b) => b.score - a.score).slice(0, maxResultados);
}

function getFozDoIguacuPosts() {
    return fozDoIguacuPosts;
}

async function carregarStaticQA() {
    // Tentar diferentes caminhos possíveis
    const possiblePaths = [
        path.join(process.cwd(), '..', 'data', 'staticQA.json'), // Quando roda da pasta Chat
        path.join(process.cwd(), 'data', 'staticQA.json'), // Quando roda da raiz
        path.join(__dirname, '..', '..', 'data', 'staticQA.json') // Relativo ao arquivo atual
    ];

    let qaFilePath = null;
    for (const testPath of possiblePaths) {
        try {
            await fs.access(testPath);
            qaFilePath = testPath;
            break;
        } catch (err) {
            // Arquivo não existe neste caminho, tenta o próximo
        }
    }

    if (!qaFilePath) {
        console.warn("[AVISO] Arquivo staticQA.json não encontrado em nenhum caminho esperado.");
        staticQAData = [];
        return;
    }

    try {
        const jsonData = await fs.readFile(qaFilePath, 'utf-8');
        const parsedData = JSON.parse(jsonData);
        if (parsedData && Array.isArray(parsedData.perguntas_respostas)) {
            staticQAData = parsedData.perguntas_respostas;
            console.log(`[INFO] Carregados ${staticQAData.length} Q&As estáticos (geral) do arquivo JSON '${path.basename(qaFilePath)}'.`);
        } else {
            console.error("[ERRO] Formato do JSON de Q&A estático (geral) inválido.");
            staticQAData = [];
        }
    } catch (err) {
        console.warn("[AVISO] Não foi possível carregar ou parsear o arquivo JSON de Q&A estático (geral):", qaFilePath, err.message);
        staticQAData = [];
    }
}

// Função para carregar o freeTierQA.json
async function carregarFreeTierQA() {
    // Tentar diferentes caminhos possíveis
    const possiblePaths = [
        path.join(process.cwd(), '..', 'data', 'freeTierQA.json'), // Quando roda da pasta Chat
        path.join(process.cwd(), 'data', 'freeTierQA.json'), // Quando roda da raiz
        path.join(__dirname, '..', '..', 'data', 'freeTierQA.json') // Relativo ao arquivo atual
    ];

    let qaFilePath = null;
    for (const testPath of possiblePaths) {
        try {
            await fs.access(testPath);
            qaFilePath = testPath;
            break;
        } catch (err) {
            // Arquivo não existe neste caminho, tenta o próximo
        }
    }

    if (!qaFilePath) {
        console.warn("[AVISO] Arquivo freeTierQA.json não encontrado em nenhum caminho esperado.");
        freeTierQAData = [];
        return;
    }

    try {
        const jsonData = await fs.readFile(qaFilePath, 'utf-8');
        const parsedData = JSON.parse(jsonData);
        if (parsedData && Array.isArray(parsedData.perguntas_respostas)) {
            freeTierQAData = parsedData.perguntas_respostas;
            console.log(`[INFO] Carregados ${freeTierQAData.length} Q&As para NÃO ASSINANTES do arquivo JSON '${path.basename(qaFilePath)}'.`);
        } else {
            console.error("[ERRO] Formato do JSON de Q&A para não assinantes inválido.");
            freeTierQAData = [];
        }
    } catch (err) {
        console.warn("[AVISO] Não foi possível carregar ou parsear o arquivo JSON de Q&A para não assinantes:", qaFilePath, err.message);
        freeTierQAData = [];
    }
}

function buscarRespostaStaticQA(userQuery) {
    if (!userQuery || !staticQAData || !Array.isArray(staticQAData) || staticQAData.length === 0) return null;
    const queryLower = userQuery.toLowerCase();
    const queryKeywords = extractKeywords(userQuery);
    if (queryKeywords.length === 0 && queryLower.length < 5) return null;

    let melhorMatch = null;
    let maxScore = 0;
    staticQAData.forEach(qa => {
        let scoreAtual = 0;
        let palavrasChaveDiretasEncontradas = 0;
        if (qa.keywords && Array.isArray(qa.keywords)) {
            qa.keywords.forEach(kw => {
                if (queryLower.includes(kw.toLowerCase())) {
                    scoreAtual += 2;
                    palavrasChaveDiretasEncontradas++;
                }
            });
            queryKeywords.forEach(qkw => {
                if (qa.keywords.some(k => k.toLowerCase().includes(qkw))) {
                    scoreAtual += 1;
                }
            });
        }
        if (qa.pergunta_exemplo && queryLower.includes(qa.pergunta_exemplo.toLowerCase().substring(0, 15))) {
            scoreAtual += 1;
        }
        if (palavrasChaveDiretasEncontradas > 0 && scoreAtual > maxScore) {
            maxScore = scoreAtual;
            melhorMatch = qa;
        } else if (scoreAtual > 0 && scoreAtual > maxScore && palavrasChaveDiretasEncontradas === 0 && queryKeywords.length > 0) {
            if (scoreAtual >= 2) { // Limiar
                maxScore = scoreAtual;
                melhorMatch = qa;
            }
        }
    });
    if (melhorMatch && maxScore >= 2) {
        console.log(`[QA GERAL] Match encontrado para "${userQuery}" com score ${maxScore}: ID ${melhorMatch.id}`);
        return melhorMatch;
    }
    return null;
}

// Função COMPLETA para buscar no freeTierQA.json
function buscarRespostaFreeTierQA(userQuery) {
    console.log(`[LDS - FreeQA] Buscando no freeTierQA para: "${userQuery}"`);
    console.log(`[LDS - FreeQA] Tamanho do freeTierQAData: ${freeTierQAData.length}`);

    // Debug: mostrar algumas keywords para verificar se "ola" está lá
    const sampleQA = freeTierQAData.find(qa => qa.keywords && qa.keywords.some(k => k.toLowerCase().includes('ola')));
    if (sampleQA) {
        console.log(`[LDS - FreeQA] Encontrei QA com "ola": ${sampleQA.id}, keywords: ${JSON.stringify(sampleQA.keywords)}`);
    } else {
        console.log(`[LDS - FreeQA] NÃO encontrei QA com "ola" nas keywords`);
    }


    if (!userQuery || !freeTierQAData || !Array.isArray(freeTierQAData) || freeTierQAData.length === 0) {
        console.log("[LDS - FreeQA] Query ou dados do freeTierQA inválidos/vazios.");
        return null;
    }

    const queryLower = userQuery.toLowerCase();
    const queryKeywords = extractKeywords(userQuery);

    // Verificação mais permissiva para permitir saudações simples
    if (queryKeywords.length === 0 && queryLower.length < 3) {
        console.log("[LDS - FreeQA] Query muito curta e sem keywords válidas.");
        return null;
    }

    let melhorMatch = null;
    let maxScore = 0;

    freeTierQAData.forEach(qa => {
        let scoreAtual = 0;
        let palavrasChaveDiretasEncontradas = 0;

        if (qa.keywords && Array.isArray(qa.keywords)) {
            // Busca exata nas keywords (case insensitive)
            qa.keywords.forEach(kw => {
                const kwLower = kw.toLowerCase();
                if (queryLower === kwLower || queryLower.includes(kwLower) || kwLower.includes(queryLower)) {
                    scoreAtual += 3; // Score maior para match exato
                    palavrasChaveDiretasEncontradas++;
                }
            });

            // Busca por keywords extraídas
            queryKeywords.forEach(qkw => {
                qa.keywords.forEach(kw => {
                    if (kw.toLowerCase().includes(qkw.toLowerCase())) {
                        scoreAtual += 1;
                    }
                });
            });
        }
        if (qa.pergunta_exemplo && queryLower.includes(qa.pergunta_exemplo.toLowerCase().substring(0, 15))) {
            scoreAtual += 1;
        }

        if (palavrasChaveDiretasEncontradas > 0 && scoreAtual > maxScore) {
            maxScore = scoreAtual;
            melhorMatch = qa;
        } else if (scoreAtual > 0 && scoreAtual > maxScore && palavrasChaveDiretasEncontradas === 0 && queryKeywords.length > 0) {
            if (scoreAtual >= 2) {
                maxScore = scoreAtual;
                melhorMatch = qa;
            }
        }
    });

    if (melhorMatch && maxScore >= 2) {
        console.log(`[LDS - FreeQA] Match encontrado no freeTierQA para "${userQuery}" com score ${maxScore}: ID ${melhorMatch.id}`);
        return melhorMatch;
    }
    console.log(`[LDS - FreeQA] Nenhum match encontrado no freeTierQA para: "${userQuery}"`);
    return null;
}

module.exports = {
    carregarPostsLocais,
    buscarPostsRelevantes,
    getFozDoIguacuPosts,
    carregarStaticQA,
    buscarRespostaStaticQA,
    carregarFreeTierQA, // Exporta a nova função de carregamento
    buscarRespostaFreeTierQA, // Exporta a nova função de busca
};