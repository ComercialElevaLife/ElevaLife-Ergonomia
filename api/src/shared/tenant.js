/* ==========================================================================
   BI Ergonomia - ElevaLife
   Regras de multi-tenant e RBAC (Administrador / Consultor / UsuarioCliente).

   Ate 29/09/2026 a identidade vinha do cabecalho x-ms-client-principal que
   o Static Web Apps injetava automaticamente (login "Entrar com Microsoft" /
   Azure AD Easy Auth). Trocado por login proprio de e-mail e senha (pedido
   do Leo: "nao sei se o cliente usa Microsoft... e login e senha, tem que
   ter" - ver api/src/functions/auth.js e api/src/shared/auth.js) - agora a
   identidade vem de um cookie de sessao (JWT) que so o backend emite/le,
   nunca do frontend. staticwebapp.config.json deixou de exigir
   "authenticated" em /api/* por isso: cada function verifica a sessao por
   conta propria (ver emailDaSessao em shared/auth.js).

   Aqui so decodificamos esse cookie e cruzamos o e-mail com o container
   "usuarios" para saber o papel e as empresas vinculadas - NUNCA confiar em
   nenhum filtro vindo do frontend.
   ========================================================================== */

"use strict";

const { obterContainer } = require("./cosmos");
const { emailDaSessao } = require("./auth");

const PAPEIS = Object.freeze({
  ADMIN: "Administrador",
  CONSULTOR: "Consultor",
  CLIENTE: "UsuarioCliente",
});

// Resolve a identidade completa: e-mail (da sessao) + papel + empresas
// vinculadas, consultando o container "usuarios". Um usuario com sessao
// valida mas ainda nao cadastrado em "usuarios" (nao deveria acontecer no
// fluxo normal, ja que so existe sessao apos login/primeiro-acesso, que por
// sua vez exigem um documento em "usuarios") volta com papel=null - bloqueado
// ate um Administrador vincula-lo.
async function resolverIdentidade(request) {
  const email = emailDaSessao(request);
  if (!email) return null;

  const container = obterContainer("usuarios");
  const consulta = {
    query: "SELECT * FROM c WHERE LOWER(c.Email) = @email",
    parameters: [{ name: "@email", value: email }],
  };
  const { resources } = await container.items.query(consulta).fetchAll();
  const doc = resources[0];

  if (!doc) {
    return { email, papel: null, empresasVinculadas: [], unidadesVinculadas: [], fonteUsuario: true };
  }

  return {
    email,
    papel: doc.Papel || null,
    empresasVinculadas: Array.isArray(doc.EmpresasVinculadas) ? doc.EmpresasVinculadas : [],
    // V 1.55 (Alexandre): vínculo por unidade. Chaves no formato "EmpresaId::Unidade".
    unidadesVinculadas: Array.isArray(doc.UnidadesVinculadas) ? doc.UnidadesVinculadas : [],
    // marca que esta identidade veio da coleção de usuários (login na interface) -
    // só nesses casos a restrição por unidade vale (chaves de API não são afetadas).
    fonteUsuario: true,
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

// V 1.55 (Alexandre): restrição por UNIDADE. Vale só para usuários da interface
// (fonteUsuario) com papel Consultor (ergonomista) ou UsuarioCliente (cliente).
// Admin vê tudo; chaves de API não têm fonteUsuario, então não são afetadas.
function restritoPorUnidade(identidade) {
  return !!(identidade && identidade.fonteUsuario && (identidade.papel === PAPEIS.CONSULTOR || identidade.papel === PAPEIS.CLIENTE));
}
// Unidades que a identidade tem naquela empresa (chaves "EmpresaId::Unidade").
function unidadesDaEmpresa(identidade, empresaId) {
  const pref = String(empresaId) + "::";
  return (identidade.unidadesVinculadas || [])
    .filter((k) => String(k).indexOf(pref) === 0)
    .map((k) => String(k).slice(pref.length));
}
// Regra de unidade para um documento. Para quem não é restrito, sempre passa
// (a checagem de empresa continua valendo à parte).
function podeVerUnidadeDoc(identidade, colecao, doc) {
  if (!restritoPorUnidade(identidade)) return true;
  const empresaId = empresaIdDoDocumento(colecao, doc);
  const minhas = unidadesDaEmpresa(identidade, empresaId);
  // V 1.73 (Alexandre): se o usuário está vinculado à EMPRESA mas não marcou nenhuma
  // UNIDADE nela, passa a ter acesso no nível da empresa (vê todas as unidades dela).
  // Antes isso devolvia false e o usuário (ex.: Ergonomista vinculado só à empresa) não
  // via NADA no dashboard. A restrição por unidade só vale quando ele marca unidades.
  if (!minhas.length) return true;
  if (colecao === "cliente") return true; // a empresa aparece porque o usuário tem ≥1 unidade nela
  if (colecao === "unidade") return minhas.indexOf(doc.Unidade) !== -1;
  const u = doc.Unidade;
  if (u == null || u === "") return true; // documento sem unidade (empresa já liberada por ter ≥1 unidade)
  return minhas.indexOf(u) !== -1;
}

function podeVerDocumento(identidade, colecao, doc) {
  return podeVerEmpresa(identidade, empresaIdDoDocumento(colecao, doc)) && podeVerUnidadeDoc(identidade, colecao, doc);
}

module.exports = {
  PAPEIS,
  resolverIdentidade,
  empresasVisiveis,
  podeVerEmpresa,
  empresaIdDoDocumento,
  podeVerDocumento,
  restritoPorUnidade,
  podeVerUnidadeDoc,
  unidadesDaEmpresa,
};
