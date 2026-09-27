/* ==========================================================================
   BI Ergonomia - ElevaLife
   Chaves de API para a API publica (/api/public/v1/...) - autenticacao por
   chave, sem login interativo, pensada pra empresa-cliente, sistema externo
   (SOC/LG/ERP) ou uso interno da ElevaLife (ver docs/bi-ergonomia-manual.md,
   secao "API publica").

   A colecao "apiKeys" guarda so o HASH da chave (SHA-256, igual senha) -
   nunca o texto puro. A chave de verdade so existe uma vez, no momento em
   que e gerada (retornada na resposta do POST /api/apiKeys) - depois disso
   e impossivel recupera-la, so revogar e gerar outra.
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { obterContainer } = require("./cosmos");
const { PAPEIS } = require("./tenant");

const PREFIXO_CHAVE = "bierg";
const TAMANHO_CHAVE_BYTES = 32; // 256 bits de entropia
const JANELA_RATE_LIMIT_MS = 60_000; // 1 minuto
const LIMITE_PADRAO_POR_MINUTO = 60;

// Gera uma chave nova em texto puro, no formato "bierg_<40 chars base64url>".
// So existe em memoria neste momento - quem chama e responsavel por mostrar
// pro usuario UMA vez e nunca guardar em lugar nenhum alem do hash.
function gerarChaveTextoPuro() {
  const bytesAleatorios = crypto.randomBytes(TAMANHO_CHAVE_BYTES);
  const corpo = bytesAleatorios.toString("base64url");
  return `${PREFIXO_CHAVE}_${corpo}`;
}

function hashChave(chaveTextoPuro) {
  return crypto.createHash("sha256").update(String(chaveTextoPuro), "utf8").digest("hex");
}

// So os ultimos 4 caracteres, pra permitir a um Administrador reconhecer
// qual chave e qual numa lista, sem nunca reexibir a chave inteira.
function sufixoParaExibicao(chaveTextoPuro) {
  return chaveTextoPuro.slice(-4);
}

function extrairChaveDoRequest(request) {
  const cabecalhoAuth = request.headers.get("authorization") || "";
  const viaBearer = /^Bearer\s+(.+)$/i.exec(cabecalhoAuth.trim());
  if (viaBearer) return viaBearer[1].trim();
  const viaHeaderDedicado = request.headers.get("x-api-key");
  if (viaHeaderDedicado) return viaHeaderDedicado.trim();
  return null;
}

// Busca a chave pelo hash (indice implicito, ja que HashChave e unico por
// design - colisao de SHA-256 sobre 256 bits aleatorios e praticamente
// impossivel). Retorna null se nao existe ou ja foi revogada.
async function buscarChavePorHash(hash) {
  const container = obterContainer("apiKeys");
  const consulta = {
    query: "SELECT * FROM c WHERE c.HashChave = @hash",
    parameters: [{ name: "@hash", value: hash }],
  };
  const { resources } = await container.items.query(consulta).fetchAll();
  const doc = resources[0];
  if (!doc || doc.RevogadoEm) return null;
  return doc;
}

// Aplica o limite de requisicoes por minuto de forma atomica (Patch com
// operacao "incr" do Cosmos DB - nao tem condicao de corrida mesmo com
// varias instancias da Function App rodando ao mesmo tempo). Cada chave tem
// seu proprio contador (campos ContadorJanela/JanelaAtual no proprio
// documento da chave). Se a janela (1 minuto) mudou, reseta o contador.
// Retorna { permitido, restante }.
async function verificarRateLimit(chaveDoc) {
  const container = obterContainer("apiKeys");
  const limite = chaveDoc.LimiteRequisicoesPorMinuto || LIMITE_PADRAO_POR_MINUTO;
  const janelaAtual = Math.floor(Date.now() / JANELA_RATE_LIMIT_MS);

  if (chaveDoc.JanelaAtual !== janelaAtual) {
    // Janela nova - reseta o contador para 1 (esta propria requisicao).
    try {
      const { resource } = await container.item(chaveDoc.id, chaveDoc.id).patch([
        { op: "set", path: "/JanelaAtual", value: janelaAtual },
        { op: "set", path: "/ContadorJanela", value: 1 },
        { op: "set", path: "/UltimoUsoEm", value: new Date().toISOString() },
      ]);
      return { permitido: true, restante: (resource.LimiteRequisicoesPorMinuto || limite) - 1 };
    } catch (erro) {
      // Corrida rara (2 requisicoes resetando ao mesmo tempo) - deixa passar,
      // nao vale a pena bloquear o cliente por causa disso.
      return { permitido: true, restante: limite - 1 };
    }
  }

  const { resource } = await container.item(chaveDoc.id, chaveDoc.id).patch([
    { op: "incr", path: "/ContadorJanela", value: 1 },
    { op: "set", path: "/UltimoUsoEm", value: new Date().toISOString() },
  ]);
  const contadorAtual = resource.ContadorJanela;
  return { permitido: contadorAtual <= limite, restante: Math.max(0, limite - contadorAtual) };
}

// Monta um objeto "identidade" compativel com as funcoes de src/shared/tenant.js
// (empresasVisiveis/podeVerEmpresa/podeVerDocumento) - chave sem EmpresaId
// (escopo admin) se comporta como Administrador (ve tudo); chave com
// EmpresaId so ve/grava naquela empresa, igual um UsuarioCliente vinculado
// so a ela.
function identidadeDaChave(chaveDoc) {
  const escopoAdmin = !chaveDoc.EmpresaId;
  return {
    viaApiKey: true,
    chaveId: chaveDoc.id,
    nomeChave: chaveDoc.Nome || null,
    papel: escopoAdmin ? PAPEIS.ADMIN : PAPEIS.CLIENTE,
    empresasVinculadas: escopoAdmin ? [] : [chaveDoc.EmpresaId],
    podeLer: chaveDoc.Escopos ? chaveDoc.Escopos.leitura !== false : true,
    podeEscrever: chaveDoc.Escopos ? !!chaveDoc.Escopos.escrita : false,
    colecoesPermitidas: chaveDoc.Escopos && Array.isArray(chaveDoc.Escopos.colecoes) ? chaveDoc.Escopos.colecoes : null, // null = todas
  };
}

function colecaoPermitidaParaChave(identidadeChave, colecao) {
  if (!identidadeChave.colecoesPermitidas) return true;
  return identidadeChave.colecoesPermitidas.includes(colecao);
}

// Resolve a chave a partir do request (Authorization: Bearer / x-api-key),
// aplica o rate limit e devolve { identidade, rateLimit } ou um erro pronto
// pra devolver ({ status, jsonBody }). Um unico ponto de entrada pra
// api/src/functions/publicApi.js nao precisar repetir essa logica.
async function autenticarRequisicaoPublica(request) {
  const chaveTextoPuro = extrairChaveDoRequest(request);
  if (!chaveTextoPuro) {
    return { erro: { status: 401, jsonBody: { erro: "Chave de API ausente. Envie em 'Authorization: Bearer <chave>' ou 'x-api-key'." } } };
  }

  const chaveDoc = await buscarChavePorHash(hashChave(chaveTextoPuro));
  if (!chaveDoc) {
    return { erro: { status: 401, jsonBody: { erro: "Chave de API invalida ou revogada." } } };
  }

  const { permitido, restante } = await verificarRateLimit(chaveDoc);
  if (!permitido) {
    return {
      erro: {
        status: 429,
        jsonBody: { erro: "Limite de requisicoes excedido. Tente novamente em instantes." },
        headers: { "Retry-After": "60" },
      },
    };
  }

  return { identidade: identidadeDaChave(chaveDoc), rateLimitRestante: restante };
}

module.exports = {
  gerarChaveTextoPuro,
  hashChave,
  sufixoParaExibicao,
  extrairChaveDoRequest,
  buscarChavePorHash,
  verificarRateLimit,
  identidadeDaChave,
  colecaoPermitidaParaChave,
  autenticarRequisicaoPublica,
  LIMITE_PADRAO_POR_MINUTO,
};
