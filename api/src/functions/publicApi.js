/* ==========================================================================
   BI Ergonomia - ElevaLife
   API publica (v1) - autenticacao por chave de API, para uma empresa-cliente
   consultar/gravar os proprios dados, um sistema externo (SOC/LG/ERP) se
   integrar, ou uso interno da ElevaLife (chave sem EmpresaId = escopo
   "todas as empresas", igual Administrador). Ver docs/bi-ergonomia-manual.md,
   secao "API publica".

   Nao tem nada a ver com login Azure AD (isso e a API interna, em
   entidades.js) - por isso e uma rota propria, com seu proprio app.http(),
   registrada em "public/v1/{colecao}/{id?}". Como esse caminho tem sempre 3+
   segmentos, nao ha ambiguidade com a rota generica interna "{colecao}/{id?}"
   (no maximo 2 segmentos) - o problema de "rota generica sempre ganha" que
   forcou o dispatch manual de me/usuarios/arquivos/apiKeys nao se aplica
   aqui.

   staticwebapp.config.json precisa ter uma excecao ANTES da regra geral de
   "/api/*" exigindo login, liberando "/api/public/*" como anonimo - senao o
   Static Web Apps redireciona pro login do Azure AD antes mesmo da chave de
   API ser conferida.

   GET    /api/public/v1/{colecao}       -> lista (respeitando o escopo da chave)
   GET    /api/public/v1/{colecao}/{id}  -> um registro
   POST   /api/public/v1/{colecao}       -> cria (so se a chave tiver escrita)
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { app } = require("@azure/functions");
const { obterContainer } = require("../shared/cosmos");
const { podeVerEmpresa, podeVerDocumento, empresaIdDoDocumento } = require("../shared/tenant");
const { autenticarRequisicaoPublica, colecaoPermitidaParaChave } = require("../shared/apiKeys");
const { COLECOES, COLECOES_GLOBAIS, COLECOES_SO_EQUIPE_GRAVA, listarComFiltro, lerPorId } = require("./entidades");

// "cliente" fica de fora da API publica por enquanto - criar uma empresa
// nova continua sendo so pela API interna, com Administrador de verdade.
const COLECOES_PUBLICAS = COLECOES.filter((c) => c !== "cliente");

function comCabecalhosPadrao(resposta, rateLimitRestante) {
  const headers = Object.assign({}, resposta.headers, {
    "X-RateLimit-Remaining": String(rateLimitRestante),
  });
  return Object.assign({}, resposta, { headers });
}

async function tratar(request, context) {
  const colecao = request.params.colecao;

  const auth = await autenticarRequisicaoPublica(request).catch((erro) => {
    context.error("Falha ao autenticar chave de API", erro);
    return { erro: { status: 500, jsonBody: { erro: "Falha ao verificar a chave de API." } } };
  });
  if (auth.erro) return auth.erro;
  const { identidade, rateLimitRestante } = auth;

  if (!COLECOES_PUBLICAS.includes(colecao)) {
    return { status: 404, jsonBody: { erro: `Coleção desconhecida ou não disponível na API pública: ${colecao}` } };
  }
  if (!colecaoPermitidaParaChave(identidade, colecao)) {
    return { status: 403, jsonBody: { erro: `Esta chave de API não tem acesso à coleção “${colecao}”.` } };
  }

  const container = obterContainer(colecao);
  const id = request.params.id;

  try {
    switch (request.method) {
      case "GET": {
        if (!identidade.podeLer) {
          return { status: 403, jsonBody: { erro: "Esta chave de API não tem permissão de leitura." } };
        }
        if (id) {
          const item = await lerPorId(container, id);
          if (!item || !podeVerDocumento(identidade, colecao, item)) {
            return { status: 404, jsonBody: { erro: "Não encontrado." } };
          }
          return comCabecalhosPadrao({ jsonBody: item }, rateLimitRestante);
        }
        const itens = await listarComFiltro(container, colecao, identidade);
        return comCabecalhosPadrao({ jsonBody: itens }, rateLimitRestante);
      }

      case "POST": {
        if (!identidade.podeEscrever) {
          return { status: 403, jsonBody: { erro: "Esta chave de API não tem permissão de escrita." } };
        }
        // V 1.7: colecoes globais (configuracao, ergonomista, modeloLaudo,
        // certificadoCalibracao) so se editam pela API interna - antes uma
        // chave de empresa com escrita conseguia gravar nelas (inclusive em
        // "configuracao", que e' so do Administrador).
        if (COLECOES_GLOBAIS.includes(colecao)) {
          return { status: 403, jsonBody: { erro: `A coleção “${colecao}” é somente leitura na API pública.` } };
        }
        if (identidade.papel === "UsuarioCliente" && COLECOES_SO_EQUIPE_GRAVA.includes(colecao)) {
          return { status: 403, jsonBody: { erro: `Chaves de API de empresa não gravam em “${colecao}”.` } };
        }
        const corpo = await request.json();
        // Chave escopada a uma empresa sempre grava naquela empresa, mesmo
        // que o corpo tente mandar outro EmpresaId - nunca confiar no
        // cliente pra isso. Chave admin (sem empresa) precisa informar.
        const empresaFixa = identidade.empresasVinculadas.length === 1 ? identidade.empresasVinculadas[0] : null;
        const empresaId = empresaFixa || corpo.EmpresaId;
        if (!empresaId) {
          return { status: 400, jsonBody: { erro: "EmpresaId é obrigatório." } };
        }
        if (!podeVerEmpresa(identidade, empresaId)) {
          return { status: 403, jsonBody: { erro: "Sem permissão para gravar nesta empresa." } };
        }
        const doc = Object.assign({}, corpo, { id: corpo.id || crypto.randomUUID(), EmpresaId: empresaId });
        const { resource } = await container.items.upsert(doc);
        return comCabecalhosPadrao({ status: 201, jsonBody: resource }, rateLimitRestante);
      }

      default:
        return { status: 405, jsonBody: { erro: "Método não suportado nesta rota." } };
    }
  } catch (erro) {
    context.error(`Erro em /api/public/v1/${colecao}`, erro);
    return { status: 500, jsonBody: { erro: "Erro interno." } };
  }
}

app.http("publicApi", {
  route: "public/v1/{colecao}/{id?}",
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: tratar,
});

module.exports = { tratar, COLECOES_PUBLICAS };
