/* ==========================================================================
   BI Ergonomia - ElevaLife
   Login por e-mail e senha (substitui o "Entrar com Microsoft"/Azure AD -
   pedido do Leo, 28-29/09/2026: "nao sei se o cliente usa Microsoft, e
   login e senha, tem que ter... a pessoa tem que receber um e-mail dizendo
   que esta sendo convidada, clique aqui para primeiro acesso").

   Este modulo concentra as 3 pecas criptograficas do fluxo, todas sem
   dependencia nenhuma do Azure AD / x-ms-client-principal:

   1. Senha: hash com bcryptjs (nunca texto puro, nunca reversivel).
   2. Convite / redefinicao de senha: um token aleatorio de posse (o "clique
      aqui" do e-mail) - so o HASH dele (SHA-256) fica gravado no Cosmos,
      igual a um "hash de senha" de uso unico; o token em si so existe no
      e-mail e na URL que o usuario clica, nunca em texto puro no banco.
   3. Sessao: um JWT assinado (HS256) guardado num cookie httpOnly - troca
      o antigo cabecalho x-ms-client-principal que o Static Web Apps injetava
      sozinho. api/src/shared/tenant.js decodifica esse cookie (nunca o
      corpo/query da requisicao) pra saber quem esta logado.

   Variavel de ambiente obrigatoria (Azure Portal > Static Web App >
   Configuracao > Configuracoes do aplicativo - ver docs/login-email-senha.md):
     SESSION_JWT_SECRET  - string aleatoria longa (32+ caracteres), so pra
                            assinar/validar o cookie de sessao. Trocar esse
                            valor de-loga todo mundo de uma vez (util em caso
                            de suspeita de vazamento).
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const NOME_COOKIE = "sige_sessao";
const VALIDADE_SESSAO_SEGUNDOS = 7 * 24 * 60 * 60; // 7 dias
const VALIDADE_CONVITE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const VALIDADE_RESET_MS = 2 * 60 * 60 * 1000; // 2 horas (mais curto - autosservico)
const CUSTO_BCRYPT = 10;

function segredoSessao() {
  const segredo = process.env.SESSION_JWT_SECRET;
  if (!segredo || segredo.length < 16) {
    throw new Error(
      "SESSION_JWT_SECRET nao configurado (ou curto demais) nas Configuracoes do aplicativo do Static Web App."
    );
  }
  return segredo;
}

// ------------------------------------------------------------------
// Senha
// ------------------------------------------------------------------
async function gerarHashSenha(senha) {
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

async function conferirSenha(senha, hash) {
  if (!senha || !hash) return false;
  return bcrypt.compare(senha, hash);
}

function senhaValida(senha) {
  return typeof senha === "string" && senha.length >= 8;
}

// ------------------------------------------------------------------
// Token de posse (convite / redefinicao de senha) - mesma mecanica pras
// duas coisas, so muda o campo onde fica gravado e a validade.
// ------------------------------------------------------------------
function gerarTokenBruto() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(tokenBruto) {
  return crypto.createHash("sha256").update(String(tokenBruto || "")).digest("hex");
}

// Comparacao em tempo constante (evita "timing attack" no token de posse).
function tokensIguais(hashA, hashB) {
  if (!hashA || !hashB) return false;
  const bufA = Buffer.from(String(hashA));
  const bufB = Buffer.from(String(hashB));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function gerarConvite() {
  const tokenBruto = gerarTokenBruto();
  return {
    tokenBruto,
    tokenHash: hashToken(tokenBruto),
    expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS).toISOString(),
  };
}

function gerarReset() {
  const tokenBruto = gerarTokenBruto();
  return {
    tokenBruto,
    tokenHash: hashToken(tokenBruto),
    expiraEm: new Date(Date.now() + VALIDADE_RESET_MS).toISOString(),
  };
}

function tokenExpirado(expiraEmIso) {
  if (!expiraEmIso) return true;
  const t = Date.parse(expiraEmIso);
  return !Number.isFinite(t) || Date.now() > t;
}

// ------------------------------------------------------------------
// Sessao (JWT em cookie httpOnly)
// ------------------------------------------------------------------
function assinarSessao(email) {
  return jwt.sign({ sub: email }, segredoSessao(), { expiresIn: VALIDADE_SESSAO_SEGUNDOS });
}

function verificarSessao(tokenJwt) {
  try {
    const payload = jwt.verify(tokenJwt, segredoSessao());
    const email = String(payload.sub || "").trim().toLowerCase();
    return email || null;
  } catch (erro) {
    return null;
  }
}

function lerCookie(request, nome) {
  const cabecalho = request.headers.get("cookie");
  if (!cabecalho) return null;
  const partes = cabecalho.split(";");
  for (const parte of partes) {
    const i = parte.indexOf("=");
    if (i === -1) continue;
    const chave = parte.slice(0, i).trim();
    if (chave === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

function emailDaSessao(request) {
  const tokenJwt = lerCookie(request, NOME_COOKIE);
  if (!tokenJwt) return null;
  return verificarSessao(tokenJwt);
}

// "Secure" exige HTTPS - Azure Static Web Apps sempre serve em HTTPS em
// producao, entao isso nunca atrapalha o ambiente que importa.
function cookieDeSessao(email) {
  const tokenJwt = assinarSessao(email);
  return `${NOME_COOKIE}=${encodeURIComponent(tokenJwt)}; Path=/; Max-Age=${VALIDADE_SESSAO_SEGUNDOS}; HttpOnly; Secure; SameSite=Lax`;
}

function cookieDeLogout() {
  return `${NOME_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

module.exports = {
  gerarHashSenha,
  conferirSenha,
  senhaValida,
  gerarConvite,
  gerarReset,
  hashToken,
  tokensIguais,
  tokenExpirado,
  emailDaSessao,
  cookieDeSessao,
  cookieDeLogout,
};
