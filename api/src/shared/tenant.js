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
    return { email, papel: null, empresasVinculadas: [], sigeVinculo: "nenhuma", psicoVinculo: "nenhuma", empresasPsico: [] };
  }

  const v = vinculosDoDoc(doc);
  return {
    email,
    papel: doc.Papel || null,
    empresasVinculadas: v.sigeVinculo === "nenhuma" ? [] : (Array.isArray(doc.EmpresasVinculadas) ? doc.EmpresasVinculadas : []),
    sigeVinculo: v.sigeVinculo,
    psicoVinculo: v.psicoVinculo,
    empresasPsico: v.empresasPsico,
  };
}

// V 1.26 - vinculos separados por modulo (pedido do Alexandre): o usuario
// tem as empresas do SIGE (EmpresasVinculadas, como antes) e, a parte, as
// empresas do modulo Riscos Psicossociais (EmpresasPsico). Em cada um pode
// ficar "nao vinculado" (SigeVinculo/PsicoVinculo = "nenhuma"). PsicoVinculo:
// "todas" (so Consultor - ergonomista que atende todas as empresas do
// psicossocial), "marcadas" (so as de EmpresasPsico) ou "nenhuma".
// Documentos antigos (sem esses campos) continuam como estavam: SIGE pelas
// empresas marcadas; psicossocial "todas" para Consultor e "marcadas" para
// UsuarioCliente (que tambem ve as empresas do psicossocial ligadas a um
// cliente do SIGE ao qual ele esta vinculado).
const VINC_PSICO = new Set(["todas", "marcadas", "nenhuma"]);
function vinculosDoDoc(doc) {
  const papel = doc.Papel || null;
  const sigeVinculo = doc.SigeVinculo === "nenhuma" ? "nenhuma" : "marcadas";
  let psicoVinculo = papel === PAPEIS.ADMIN ? "todas" : VINC_PSICO.has(doc.PsicoVinculo) ? doc.PsicoVinculo : (papel === PAPEIS.CONSULTOR ? "todas" : "marcadas");
  if (psicoVinculo === "todas" && papel === PAPEIS.CLIENTE) psicoVinculo = "marcadas";
  const empresasPsico = psicoVinculo === "marcadas" && Array.isArray(doc.EmpresasPsico) ? doc.EmpresasPsico.filter((e) => typeof e === "string" && /^e_/.test(e)) : [];
  return { sigeVinculo, psicoVinculo, empresasPsico };
}

// Normaliza os campos de vinculo vindos da tela de Usuarios (POST/PUT).
function vinculosDoCorpo(corpo, papel) {
  const v = vinculosDoDoc({ Papel: papel, SigeVinculo: corpo.SigeVinculo, PsicoVinculo: corpo.PsicoVinculo, EmpresasPsico: corpo.EmpresasPsico });
  return { SigeVinculo: v.sigeVinculo, PsicoVinculo: v.psicoVinculo, EmpresasPsico: v.empresasPsico };
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
  resolverIdentidade,
  empresasVisiveis,
  podeVerEmpresa,
  empresaIdDoDocumento,
  podeVerDocumento,
  vinculosDoDoc,
  vinculosDoCorpo,
};
