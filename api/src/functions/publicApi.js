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
const { COLECOES, COLECOES_GLOBAIS, COLECOES_SO_EQUIPE_GRAVA, listarComFiltro, lerPorId, codigoVerificacaoEmUso, proximoNrAvaliacao, avaliarPlanoAcaoComArquivos, aplicarAuditoria } = require("./entidades");

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
        // V 1.39 (robustez): corpo com limite de tamanho e JSON válido (ver entidades.lerCorpoJson).
        let corpo;
        try {
          const texto = await request.text();
          if (texto && Buffer.byteLength(texto, "utf8") > 1900000) return comCabecalhosPadrao({ status: 413, jsonBody: { erro: "Registro grande demais (acima de 1,9 MB)." } }, rateLimitRestante);
          corpo = texto ? JSON.parse(texto) : {};
        } catch (e) { return comCabecalhosPadrao({ status: 400, jsonBody: { erro: "Corpo da requisição não é um JSON válido." } }, rateLimitRestante); }
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
        // V 1.39 (segurança): nunca aceitar campos internos vindos do cliente (auditoria, histórico,
        // dispensa de evidência, notificações...). Eles são definidos só pelo servidor.
        const corpoLimpo = {};
        Object.keys(corpo).forEach((k) => { if (k[0] !== "_") corpoLimpo[k] = corpo[k]; });
        const novo = Object.assign({}, corpoLimpo, { id: corpoLimpo.id || crypto.randomUUID(), EmpresaId: empresaId });
        const jaExistia = corpoLimpo.id ? await lerPorId(container, novo.id) : null;
        if (jaExistia && !podeVerDocumento(identidade, colecao, jaExistia)) {
          return { status: 403, jsonBody: { erro: "Sem permissão." } };
        }
        // Mesmas regras de negócio da API interna (entidades.js):
        if (colecao === "laudo" && await codigoVerificacaoEmUso(container, novo["Codigo Verificacao"], novo.id)) {
          return { status: 409, jsonBody: { erro: "Já existe um laudo com este código de verificação." } };
        }
        let paraGravar = novo;
        if (colecao === "avaliacaoErgonomica") {
          // V 1.48: numero editavel manualmente (ver entidades.js).
          const manual = Number(paraGravar["Nr Avaliacao"]);
          if (Number.isFinite(manual) && manual > 0) {
            paraGravar = Object.assign({}, paraGravar, { "Nr Avaliacao": Math.trunc(manual) });
          } else if (jaExistia && jaExistia["Nr Avaliacao"]) {
            paraGravar = Object.assign({}, paraGravar, { "Nr Avaliacao": jaExistia["Nr Avaliacao"] });
          } else {
            paraGravar = Object.assign({}, paraGravar, { "Nr Avaliacao": await proximoNrAvaliacao(container, empresaId) });
          }
        }
        if (colecao === "planoAcao") {
          const idParaRegras = Object.assign({}, identidade, { email: "api-key:" + (identidade.nomeChave || identidade.chaveId || "publica") });
          const avaliacao = await avaliarPlanoAcaoComArquivos(jaExistia, novo, idParaRegras, context);
          if (!avaliacao.ok) return { status: avaliacao.status, jsonBody: { erro: avaliacao.erro, codigo: avaliacao.codigo } };
          paraGravar = avaliacao.doc;
        }
        const doc = aplicarAuditoria(jaExistia, paraGravar, "api-key:" + (identidade.nomeChave || identidade.chaveId || "publica"));
        if (colecao === "planoAcao") { delete doc._reenviarPsico; delete doc._reenviarAcao; }
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
