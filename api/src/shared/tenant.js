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
    return { email, papel: null, empresasVinculadas: [], unidadesVinculadas: [], setoresVinculados: [], clientesGestao: [], fonteUsuario: true };
  }

  // V 2.08 (Alexandre): usuário DESLIGADO perde o acesso (papel nulo = bloqueado), mas o
  // cadastro e TUDO que ele criou continuam no sistema. É reversível (Reativar).
  const desligado = String(doc.StatusConta || "").toLowerCase() === "desligado";

  return {
    email,
    papel: desligado ? null : (doc.Papel || null),
    empresasVinculadas: Array.isArray(doc.EmpresasVinculadas) ? doc.EmpresasVinculadas : [],
    // V 1.55 (Alexandre): vínculo por unidade. Chaves no formato "EmpresaId::Unidade".
    unidadesVinculadas: Array.isArray(doc.UnidadesVinculadas) ? doc.UnidadesVinculadas : [],
    // V 2.50 (Alexandre): nível 2 - vínculo por SETOR. Chaves "EmpresaId::Unidade::Setor".
    // Nível de acesso do cliente é automático pelo que estiver vinculado:
    //   só empresa  -> nível 0 (vê tudo da empresa)
    //   unidade(s)  -> nível 1 (vê só as unidades vinculadas)
    //   setor(es)   -> nível 2 (vê só os setores vinculados)
    setoresVinculados: Array.isArray(doc.SetoresVinculados) ? doc.SetoresVinculados : [],
    // V 2.50 (Alexandre): carteira de cobrança do ADM (clientes que ele gere). O ADM continua
    // vendo tudo; isto só restringe as notificações/e-mails de cobrança (ver notificações).
    clientesGestao: Array.isArray(doc.ClientesGestao) ? doc.ClientesGestao : [],
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
    .map((k) => String(k).slice(pref.length))
    .filter(Boolean);
}
// V 2.50 (Alexandre): setores vinculados naquela empresa (chaves "EmpresaId::Unidade::Setor").
// Devolve pares "Unidade::Setor".
function setoresDaEmpresa(identidade, empresaId) {
  const pref = String(empresaId) + "::";
  return (identidade.setoresVinculados || [])
    .filter((k) => String(k).indexOf(pref) === 0)
    .map((k) => String(k).slice(pref.length))
    .filter((k) => k.indexOf("::") !== -1);
}
// Regra de unidade/setor para um documento. Para quem não é restrito, sempre passa
// (a checagem de empresa continua valendo à parte). O nível é automático pelo vínculo:
//   só empresa  -> nível 0: vê tudo da empresa
//   unidade(s)  -> nível 1: vê só as unidades vinculadas (todos os setores delas)
//   setor(es)   -> nível 2: vê só os setores vinculados (daquela unidade)
function podeVerUnidadeDoc(identidade, colecao, doc) {
  if (!restritoPorUnidade(identidade)) return true;
  const empresaId = empresaIdDoDocumento(colecao, doc);
  const unidades = unidadesDaEmpresa(identidade, empresaId); // nível 1 (unidade plena)
  const setores = setoresDaEmpresa(identidade, empresaId);   // nível 2 (par "Unidade::Setor")
  // V 1.73 (Alexandre): vinculado só à EMPRESA (sem unidade e sem setor) = nível 0, vê tudo dela.
  if (!unidades.length && !setores.length) return true;
  if (colecao === "cliente") return true; // a empresa aparece porque o usuário tem vínculo nela
  const u = doc.Unidade;
  // Unidades que o usuário pode ao menos navegar: as plenas (nível 1) e as que contêm
  // algum setor vinculado (nível 2) - para enxergar a unidade e chegar ao seu setor.
  const unidadesDosSetores = setores.map((s) => s.split("::")[0]);
  const unidadesVisiveis = new Set([].concat(unidades, unidadesDosSetores));
  if (colecao === "unidade") return unidadesVisiveis.has(doc.Unidade);
  if (u == null || u === "") return true; // documento no nível da empresa toda
  if (!unidadesVisiveis.has(u)) return false;
  if (unidades.indexOf(u) !== -1) return true; // nível 1 nessa unidade: vê todos os setores dela
  // nível 2 nessa unidade: só os setores vinculados.
  const s = doc.Setor;
  if (s == null || s === "") return true; // nós da hierarquia acima do setor (ex.: a própria unidade)
  return setores.indexOf(u + "::" + s) !== -1;
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
  setoresDaEmpresa,
};
