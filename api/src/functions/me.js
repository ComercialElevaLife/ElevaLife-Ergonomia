/* ==========================================================================
   BI Ergonomia - ElevaLife
   GET /api/me - devolve a identidade resolvida (e-mail, papel, empresas
   vinculadas) para o frontend adaptar a UI: travar o seletor de empresa para
   UsuarioCliente, esconder "nova empresa" para quem nao e Administrador, e
   mostrar um aviso quando o usuario esta autenticado mas ainda sem papel
   cadastrado (ver docs/azure-setup.md, passo 8).
   ========================================================================== */

"use strict";

const { resolverIdentidade } = require("../shared/tenant");

// Exportado (nao registrado com app.http aqui) - o dispatcher unico em
// entidades.js chama isso diretamente pra /api/me. Motivo: em producao
// (Azure Static Web Apps - Managed Functions) registrar "me" e "usuarios"
// como functions HTTP separadas nunca teve suas rotas reconhecidas (toda
// chamada caia na rota generica "{colecao}/{id?}" com "Colecao
// desconhecida") - suspeita de uma limitacao/bug da camada de proxy do
// SWA com multiplas functions/rotas no plano Free. Um unico app.http()
// que despacha internamente elimina essa ambiguidade.
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

module.exports = { tratar };
