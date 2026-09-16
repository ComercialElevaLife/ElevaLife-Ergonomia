/* ==========================================================================
   BI Ergonomia - ElevaLife
   Rotas REST genericas para as 10 colecoes de negocio (6 do cadastro-mestre +
   4 operacionais). Uma unica function cobre todas porque o CRUD e identico -
   so muda o nome da colecao e, no caso de "cliente", duas regras extras
   (so Administrador cria/exclui uma empresa-cliente nova).

   GET    /api/{colecao}          -> lista, ja filtrada por EmpresaId/papel
   GET    /api/{colecao}/{id}     -> um registro (404 se fora do escopo)
   POST   /api/{colecao}          -> cria (corpo deve trazer EmpresaId, exceto
                                      em "cliente", onde o EmpresaId e gerado)
   PUT    /api/{colecao}/{id}     -> atualiza
   DELETE /api/{colecao}/{id}     -> exclui
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { app } = require("@azure/functions");
const { obterContainer } = require("../shared/cosmos");
const { resolverIdentidade, empresasVisiveis, podeVerEmpresa, podeVerDocumento, empresaIdDoDocumento } = require("../shared/tenant");
const rotaMe = require("./me");
const rotaUsuarios = require("./usuarios");

const COLECOES = [
  "cliente", "unidade", "setor", "cargo", "posto", "atividade",
  "mapaRisco", "planoAcao", "absenteismo", "compativeis",
];

// "me" e "usuarios" sao despachadas aqui dentro (em vez de cada uma ter seu
// proprio app.http()) porque em producao a rota generica "{colecao}/{id?}"
// sempre "ganhava" delas - ver comentario em src/functions/me.js.
const ROTAS_ESPECIAIS = { me: rotaMe.tratar, usuarios: rotaUsuarios.tratar };

async function lerPorId(container, id) {
  const consulta = {
    query: "SELECT * FROM c WHERE c.id = @id",
    parameters: [{ name: "@id", value: id }],
  };
  const { resources } = await container.items.query(consulta).fetchAll();
  return resources[0] || null;
}

async function listarComFiltro(container, colecao, identidade) {
  const empresas = empresasVisiveis(identidade);
  if (empresas === null) {
    const { resources } = await container.items.query("SELECT * FROM c").fetchAll();
    return resources;
  }
  if (empresas.length === 0) return [];
  const campo = colecao === "cliente" ? "c.id" : "c.EmpresaId";
  const consulta = {
    query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@empresas, ${campo})`,
    parameters: [{ name: "@empresas", value: empresas }],
  };
  const { resources } = await container.items.query(consulta).fetchAll();
  return resources;
}

async function tratar(request, context) {
  const colecao = request.params.colecao;

  if (Object.prototype.hasOwnProperty.call(ROTAS_ESPECIAIS, colecao)) {
    return ROTAS_ESPECIAIS[colecao](request, context);
  }

  if (!COLECOES.includes(colecao)) {
    return { status: 404, jsonBody: { erro: `Colecao desconhecida: ${colecao}` } };
  }

  let identidade;
  try {
    identidade = await resolverIdentidade(request);
  } catch (erro) {
    context.error("Falha ao resolver identidade", erro);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissoes." } };
  }
  if (!identidade) {
    return { status: 401, jsonBody: { erro: "Nao autenticado." } };
  }
  if (!identidade.papel) {
    return {
      status: 403,
      jsonBody: { erro: "Seu acesso ainda nao foi liberado. Peca a um Administrador para te vincular a uma empresa." },
    };
  }

  const container = obterContainer(colecao);
  const id = request.params.id;

  try {
    switch (request.method) {
      case "GET": {
        if (id) {
          const item = await lerPorId(container, id);
          if (!item || !podeVerDocumento(identidade, colecao, item)) {
            return { status: 404, jsonBody: { erro: "Nao encontrado." } };
          }
          return { jsonBody: item };
        }
        return { jsonBody: await listarComFiltro(container, colecao, identidade) };
      }

      case "POST": {
        const corpo = await request.json();
        if (colecao === "cliente" && identidade.papel !== "Administrador") {
          return { status: 403, jsonBody: { erro: "So Administrador pode cadastrar uma nova empresa-cliente." } };
        }
        const empresaId = colecao === "cliente" ? corpo.EmpresaId || crypto.randomUUID() : corpo.EmpresaId;
        if (!empresaId) {
          return { status: 400, jsonBody: { erro: "EmpresaId e obrigatorio." } };
        }
        if (!podeVerEmpresa(identidade, empresaId)) {
          return { status: 403, jsonBody: { erro: "Sem permissao para gravar nesta empresa." } };
        }
        const doc = Object.assign({}, corpo, { id: corpo.id || crypto.randomUUID(), EmpresaId: empresaId });
        const { resource } = await container.items.upsert(doc);
        return { status: 201, jsonBody: resource };
      }

      case "PUT": {
        if (!id) return { status: 400, jsonBody: { erro: "Id e obrigatorio para atualizar." } };
        const existente = await lerPorId(container, id);
        if (!existente) return { status: 404, jsonBody: { erro: "Nao encontrado." } };
        if (!podeVerDocumento(identidade, colecao, existente)) {
          return { status: 403, jsonBody: { erro: "Sem permissao." } };
        }
        const corpo = await request.json();
        const empresaIdFinal = colecao === "cliente" ? empresaIdDoDocumento(colecao, existente) : corpo.EmpresaId || existente.EmpresaId;
        if (!podeVerEmpresa(identidade, empresaIdFinal)) {
          return { status: 403, jsonBody: { erro: "Sem permissao para gravar nesta empresa." } };
        }
        const doc = Object.assign({}, existente, corpo, { id, EmpresaId: empresaIdFinal });
        const { resource } = await container.item(id, empresaIdDoDocumento(colecao, doc)).replace(doc);
        return { jsonBody: resource };
      }

      case "DELETE": {
        if (!id) return { status: 400, jsonBody: { erro: "Id e obrigatorio para excluir." } };
        const existente = await lerPorId(container, id);
        if (!existente) return { status: 204 };
        if (!podeVerDocumento(identidade, colecao, existente)) {
          return { status: 403, jsonBody: { erro: "Sem permissao." } };
        }
        if (colecao === "cliente" && identidade.papel !== "Administrador") {
          return { status: 403, jsonBody: { erro: "So Administrador pode excluir uma empresa-cliente." } };
        }
        await container.item(id, empresaIdDoDocumento(colecao, existente)).delete();
        return { status: 204 };
      }

      default:
        return { status: 405, jsonBody: { erro: "Metodo nao suportado." } };
    }
  } catch (erro) {
    context.error(`Erro em /api/${colecao}`, erro);
    return { status: 500, jsonBody: { erro: "Erro interno." } };
  }
}

app.http("entidades", {
  route: "{colecao}/{id?}",
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: tratar,
});

module.exports = { COLECOES, listarComFiltro, lerPorId };
