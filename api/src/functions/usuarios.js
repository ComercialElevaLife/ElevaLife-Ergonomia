/* ==========================================================================
   BI Ergonomia - ElevaLife
   Gestao de usuarios/papeis - somente Administrador. Nao faz parte das 10
   colecoes de negocio (entidades.js) de proposito: aqui a regra de acesso e
   fixa (so Administrador), nao depende de EmpresaId.

   GET    /api/usuarios          -> lista todos os usuarios cadastrados
   POST   /api/usuarios          -> cria { Email, Papel, EmpresasVinculadas }
   PUT    /api/usuarios/{id}     -> atualiza papel/empresas vinculadas
   DELETE /api/usuarios/{id}     -> remove o acesso de um usuario
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { obterContainer } = require("../shared/cosmos");
const { resolverIdentidade, PAPEIS } = require("../shared/tenant");

const PAPEIS_VALIDOS = new Set(Object.values(PAPEIS));

async function tratar(request, context) {
  let identidade;
  try {
    identidade = await resolverIdentidade(request);
  } catch (erro) {
    context.error("Falha ao resolver identidade em /api/usuarios", erro);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissoes." } };
  }
  if (!identidade) return { status: 401, jsonBody: { erro: "Nao autenticado." } };
  if (identidade.papel !== PAPEIS.ADMIN) {
    return { status: 403, jsonBody: { erro: "So Administrador pode gerenciar usuarios." } };
  }

  const container = obterContainer("usuarios");
  const id = request.params.id;

  try {
    switch (request.method) {
      case "GET": {
        const { resources } = await container.items.query("SELECT * FROM c").fetchAll();
        return { jsonBody: resources };
      }

      case "POST": {
        const corpo = await request.json();
        const email = String(corpo.Email || "").trim().toLowerCase();
        if (!email) return { status: 400, jsonBody: { erro: "Email e obrigatorio." } };
        if (!PAPEIS_VALIDOS.has(corpo.Papel)) {
          return { status: 400, jsonBody: { erro: `Papel invalido. Use um de: ${Array.from(PAPEIS_VALIDOS).join(", ")}.` } };
        }
        const doc = {
          id: corpo.id || crypto.randomUUID(),
          Email: email,
          Papel: corpo.Papel,
          EmpresasVinculadas: Array.isArray(corpo.EmpresasVinculadas) ? corpo.EmpresasVinculadas : [],
        };
        const { resource } = await container.items.upsert(doc);
        return { status: 201, jsonBody: resource };
      }

      case "PUT": {
        if (!id) return { status: 400, jsonBody: { erro: "Id e obrigatorio para atualizar." } };
        const corpo = await request.json();
        if (corpo.Papel && !PAPEIS_VALIDOS.has(corpo.Papel)) {
          return { status: 400, jsonBody: { erro: `Papel invalido. Use um de: ${Array.from(PAPEIS_VALIDOS).join(", ")}.` } };
        }
        const { resource: existente } = await container.item(id, id).read();
        if (!existente) return { status: 404, jsonBody: { erro: "Nao encontrado." } };
        const doc = Object.assign({}, existente, corpo, { id });
        const { resource } = await container.item(id, id).replace(doc);
        return { jsonBody: resource };
      }

      case "DELETE": {
        if (!id) return { status: 400, jsonBody: { erro: "Id e obrigatorio para excluir." } };
        await container.item(id, id).delete().catch(() => null);
        return { status: 204 };
      }

      default:
        return { status: 405, jsonBody: { erro: "Metodo nao suportado." } };
    }
  } catch (erro) {
    context.error("Erro em /api/usuarios", erro);
    return { status: 500, jsonBody: { erro: "Erro interno." } };
  }
}

// Exportado (nao registrado com app.http aqui) - ver comentario em me.js:
// o dispatcher unico em entidades.js chama isso diretamente pra /api/usuarios.
module.exports = { tratar };
