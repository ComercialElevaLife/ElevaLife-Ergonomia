/* ==========================================================================
   BI Ergonomia - ElevaLife
   Regras de multi-tenant e RBAC (Administrador / Consultor / UsuarioCliente).

   Identidade vem do cabecalho x-ms-client-principal que o Static Web Apps
   injeta automaticamente em toda requisicao autenticada para /api/* (ver
   staticwebapp.config.json na raiz do repo, que exige "authenticated" nessa
   rota). Aqui so decodificamos esse cabecalho e cruzamos o e-mail com o
   container "usuarios" para saber o papel e as empresas vinculadas -
   NUNCA confiar em nenhum filtro vindo do frontend.
   ========================================================================== */

"use strict";

const { obterContainer } = require("./cosmos");

const PAPEIS = Object.freeze({
  ADMIN: "Administrador",
  CONSULTOR: "Consultor",
  CLIENTE: "UsuarioCliente",
});

function decodificarPrincipal(request) {
  const cabecalho = request.headers.get("x-ms-client-principal");
  if (!cabecalho) return null;
  try {
    const json = Buffer.from(cabecalho, "base64").toString("utf-8");
    const principal = JSON.parse(json);
    if (!principal || !principal.userId) return null;
    return principal;
  } catch (erro) {
    return null;
  }
}

// Resolve a identidade completa: e-mail (do Azure AD) + papel + empresas
// vinculadas, consultando o container "usuarios". Um usuario autenticado no
// Azure AD mas ainda nao cadastrado em "usuarios" volta com papel=null -
// bloqueado ate um Administrador vincula-lo (ver docs/azure-setup.md, passo 8).
async function resolverIdentidade(request) {
  const principal = decodificarPrincipal(request);
  if (!principal) return null;

  const email = String(principal.userDetails || "").trim().toLowerCase();
  if (!email) return null;

  const container = obterContainer("usuarios");
  const consulta = {
    query: "SELECT * FROM c WHERE LOWER(c.Email) = @email",
    parameters: [{ name: "@email", value: email }],
  };
  const { resources } = await container.items.query(consulta).fetchAll();
  const doc = resources[0];

  if (!doc) {
    return { email, papel: null, empresasVinculadas: [] };
  }

  return {
    email,
    papel: doc.Papel || null,
    empresasVinculadas: Array.isArray(doc.EmpresasVinculadas) ? doc.EmpresasVinculadas : [],
  };
}

// null = sem filtro (Administrador ve tudo); array = lista fechada de EmpresaId.
function empresasVisiveis(identidade) {
  if (identidade.papel === PAPEIS.ADMIN) return null;
  return identidade.empresasVinculadas || [];
}

function podeVerEmpresa(identidade, empresaId) {
  if (!identidade || !identidade.papel) return false;
  if (identidade.papel === PAPEIS.ADMIN) return true;
  return (identidade.empresasVinculadas || []).includes(empresaId);
}

// "cliente" e a unica colecao onde o proprio documento representa a empresa;
// nela EmpresaId == id do documento (ver src/functions/entidades.js).
function empresaIdDoDocumento(colecao, doc) {
  if (colecao === "cliente") return doc.EmpresaId || doc.id;
  return doc.EmpresaId;
}

function podeVerDocumento(identidade, colecao, doc) {
  return podeVerEmpresa(identidade, empresaIdDoDocumento(colecao, doc));
}

module.exports = {
  PAPEIS,
  decodificarPrincipal,
  resolverIdentidade,
  empresasVisiveis,
  podeVerEmpresa,
  empresaIdDoDocumento,
  podeVerDocumento,
};
