/* ==========================================================================
   BI Ergonomia - ElevaLife
   GET /api/me - devolve a identidade resolvida (e-mail, papel, empresas
   vinculadas) para o frontend adaptar a UI: travar o seletor de empresa para
   UsuarioCliente, esconder "nova empresa" para quem nao e Administrador, e
   mostrar um aviso quando o usuario esta autenticado mas ainda sem papel
   cadastrado (ver docs/azure-setup.md, passo 8).
   ========================================================================== */

"use strict";

const { app } = require("@azure/functions");
const { resolverIdentidade } = require("../shared/tenant");

async function tratar(request, context) {
  let identidade;
  try {
    identidade = await resolverIdentidade(request);
  } catch (erro) {
    context.error("Falha ao resolver identidade em /api/me", erro);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissoes." } };
  }
  if (!identidade) {
    return { status: 401, jsonBody: { erro: "Nao autenticado." } };
  }
  return {
    jsonBody: {
      email: identidade.email,
      papel: identidade.papel,
      empresasVinculadas: identidade.empresasVinculadas,
      acessoLiberado: Boolean(identidade.papel),
    },
  };
}

app.http("me", {
  route: "me",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: tratar,
});
