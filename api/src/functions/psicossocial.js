/* ==========================================================================
   S.I.G.E. - ElevaLife
   Modulo Riscos Psicossociais (HSE-IT + checklist ISO 45003 + analise de
   risco + plano de acao + relatorio Word) - V 1.14.

   O frontend (psicossocial.html) guarda seus dados como "documentos" com
   caminho no formato colecao/documento (ex.: empresas/e_x/ghes/g_y) - o
   mesmo modelo usado no prototipo. Aqui esses documentos vivem no Cosmos,
   no container "psicossocial" (criado sob demanda, chave de particao
   /EmpresaId):
     - documentos de uma empresa avaliada (empresas/{eid}/...): EmpresaId = eid
     - raiz (empresas/{eid} e profissionais/{id}):              EmpresaId = PSICO_GLOBAL

   Duas rotas, despachadas por entidades.js/ROTAS_ESPECIAIS (o SWA Free so
   reconhece o app.http() generico "{colecao}/{id?}", por isso os parametros
   vao em query string):

   1) /api/psico/{acao}  - EQUIPE (sessao valida + papel Administrador ou
      Consultor). UsuarioCliente nao acessa.
        GET    /api/psico/doc?c=<caminho>      -> { exists, data }
        GET    /api/psico/col?c=<colecao>      -> { docs: [{ id, data }] }
        PUT    /api/psico/doc?c=<caminho>      -> grava (corpo = documento)
        DELETE /api/psico/doc?c=<caminho>      -> exclui

   2) /api/psicopub/{acao} - PUBLICA (sem login), usada pelas telas do QR
      code. So expoe o minimo: valida matricula, impede resposta duplicada e
      grava a resposta SEM a matricula (anonimato - LGPD).
        GET  /api/psicopub/codigo?c=<codigo>   -> { eid }
        GET  /api/psicopub/empresa?e=<eid>     -> { razao, cnpj, status, inicio, fim }
        POST /api/psicopub/matricula           { e, matricula } -> { colab } | { erro }
        POST /api/psicopub/resposta            { e, matricula, respostas[35] }
        GET  /api/psicopub/iso?e=<eid>         -> { doc }
        POST /api/psicopub/iso                 { e, nome, cargo, email, r }
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { garantirContainer } = require("../shared/cosmos");
const { resolverIdentidade, PAPEIS } = require("../shared/tenant");

const CONTAINER = "psicossocial";
const GLOBAL = "PSICO_GLOBAL";
const SEGMENTO = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

// ------------------------------------------------------------------
// Caminhos
// ------------------------------------------------------------------
function validarCaminho(caminho, par) {
  const partes = String(caminho || "").split("/");
  if (!partes.length || partes.length > 16) return null;
  if (par !== undefined && (partes.length % 2 === 0) !== par) return null;
  if (!partes.every((p) => SEGMENTO.test(p) && p !== "." && p !== "..")) return null;
  return partes;
}
function particao(partes) {
  // empresas/{eid}/... (com 3+ segmentos) pertence a empresa avaliada
  if (partes[0] === "empresas" && partes.length >= 3) return partes[1];
  return GLOBAL;
}
const idDoc = (caminho) => caminho.replace(/\//g, "|");

async function container() {
  return garantirContainer(CONTAINER);
}
async function lerDoc(caminho) {
  const partes = validarCaminho(caminho, true);
  if (!partes) return null;
  try {
    const { resource } = await (await container()).item(idDoc(caminho), particao(partes)).read();
    return resource || null;
  } catch (erro) {
    if (erro.code === 404) return null;
    throw erro;
  }
}
async function gravarDoc(caminho, dados) {
  const partes = validarCaminho(caminho, true);
  if (!partes) throw Object.assign(new Error("Caminho inválido"), { status: 400 });
  const doc = {
    id: idDoc(caminho),
    EmpresaId: particao(partes),
    caminho,
    colecao: partes.slice(0, -1).join("/"),
    dados,
    atualizadoEm: new Date().toISOString(),
  };
  await (await container()).items.upsert(doc);
  return doc;
}
async function criarDoc(caminho, dados) {
  // create falha com 409 se o documento ja existir (usado na trava de resposta unica)
  const partes = validarCaminho(caminho, true);
  const doc = { id: idDoc(caminho), EmpresaId: particao(partes), caminho, colecao: partes.slice(0, -1).join("/"), dados, atualizadoEm: new Date().toISOString() };
  await (await container()).items.create(doc);
  return doc;
}
async function excluirDoc(caminho) {
  const partes = validarCaminho(caminho, true);
  if (!partes) throw Object.assign(new Error("Caminho inválido"), { status: 400 });
  try {
    await (await container()).item(idDoc(caminho), particao(partes)).delete();
  } catch (erro) {
    if (erro.code !== 404) throw erro;
  }
}
async function listarColecao(colecao) {
  const partes = validarCaminho(colecao, false);
  if (!partes) throw Object.assign(new Error("Coleção inválida"), { status: 400 });
  const pk = partes[0] === "empresas" && partes.length >= 3 ? partes[1] : GLOBAL;
  const { resources } = await (await container()).items
    .query({ query: "SELECT c.caminho, c.dados FROM c WHERE c.colecao = @col", parameters: [{ name: "@col", value: colecao }] }, { partitionKey: pk })
    .fetchAll();
  return resources.map((r) => ({ id: r.caminho.split("/").pop(), data: r.dados }));
}

// ------------------------------------------------------------------
// Rota da EQUIPE
// ------------------------------------------------------------------
async function tratarEquipe(request, context) {
  let identidade;
  try {
    identidade = await resolverIdentidade(request);
  } catch (erro) {
    context.error("Falha ao resolver identidade em /api/psico", erro);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissões." } };
  }
  if (!identidade) return { status: 401, jsonBody: { erro: "Não autenticado." } };
  if (![PAPEIS.ADMIN, PAPEIS.CONSULTOR].includes(identidade.papel)) {
    return { status: 403, jsonBody: { erro: "O módulo de Riscos Psicossociais é restrito à equipe ElevaLife." } };
  }

  const acao = String(request.params.id || "");
  const caminho = request.query.get("c") || "";
  try {
    if (acao === "eu" && request.method === "GET") {
      return { jsonBody: { email: identidade.email, papel: identidade.papel } };
    }
    if (acao === "col" && request.method === "GET") {
      return { jsonBody: { docs: await listarColecao(caminho) } };
    }
    if (acao === "doc") {
      if (request.method === "GET") {
        const doc = await lerDoc(caminho);
        return { jsonBody: doc ? { exists: true, data: doc.dados } : { exists: false } };
      }
      if (request.method === "PUT") {
        const dados = await request.json().catch(() => null);
        if (!dados || typeof dados !== "object" || Array.isArray(dados)) return { status: 400, jsonBody: { erro: "Corpo inválido." } };
        if (JSON.stringify(dados).length > 1500000) return { status: 413, jsonBody: { erro: "Registro grande demais." } };
        await gravarDoc(caminho, dados);
        return { jsonBody: { ok: true } };
      }
      if (request.method === "DELETE") {
        await excluirDoc(caminho);
        return { jsonBody: { ok: true } };
      }
    }
    return { status: 404, jsonBody: { erro: "Ação desconhecida." } };
  } catch (erro) {
    if (erro.status) return { status: erro.status, jsonBody: { erro: erro.message } };
    context.error("Falha em /api/psico/" + acao, erro);
    return { status: 500, jsonBody: { erro: "Falha ao acessar os dados do módulo psicossocial." } };
  }
}

// ------------------------------------------------------------------
// Rota PUBLICA (QR code)
// ------------------------------------------------------------------
const matKey = (m) => String(m ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+(?=.)/, "");
const hoje = () => new Date().toISOString().slice(0, 10);
const eidValido = (e) => /^e_[A-Za-z0-9_\-.]{1,120}$/.test(String(e || ""));
const isoCompleto = (r) => !!r && Array.from({ length: 33 }, (_, i) => r[i]).every((v) => v === "S" || v === "P" || v === "N");

async function empresa(eid) {
  if (!eidValido(eid)) return null;
  const d = await lerDoc(`empresas/${eid}`);
  return d ? d.dados : null;
}
async function acharColaborador(eid, k) {
  const ghes = await listarColecao(`empresas/${eid}/ghes`);
  const g = ghes.map((x) => x.data).find((x) => x && x.colab && x.colab[k]);
  return g || null;
}
function coletaAberta(e) {
  const h = hoje();
  return e && e.status === "aberta" && !(e.inicio && h < e.inicio) && !(e.fim && h > e.fim);
}

async function tratarPublico(request, context) {
  const acao = String(request.params.id || "");
  try {
    if (acao === "codigo" && request.method === "GET") {
      const c = String(request.query.get("c") || "").trim();
      if (!c || c.length > 140) return { status: 400, jsonBody: { code: "invalid_argument" } };
      if (eidValido(c) && (await empresa(c))) return { jsonBody: { eid: c } };
      const { resources } = await (await container()).items
        .query({ query: "SELECT c.dados.k FROM c WHERE c.colecao = 'empresas' AND UPPER(c.dados.codigo) = @c", parameters: [{ name: "@c", value: c.toUpperCase() }] }, { partitionKey: GLOBAL })
        .fetchAll();
      return resources[0] ? { jsonBody: { eid: resources[0].k } } : { status: 404, jsonBody: { code: "not_found" } };
    }
    if (acao === "empresa" && request.method === "GET") {
      const e = await empresa(request.query.get("e"));
      return e ? { jsonBody: { razao: e.razao, cnpj: e.cnpj, status: e.status, inicio: e.inicio, fim: e.fim } } : { status: 404, jsonBody: { code: "not_found" } };
    }
    if (acao === "matricula" && request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const eid = String(b.e || ""), k = matKey(b.matricula);
      if (!eidValido(eid) || !k) return { status: 400, jsonBody: { code: "invalid_argument" } };
      const g = await acharColaborador(eid, k);
      if (!g) return { jsonBody: { erro: "nao_encontrada" } };
      const p = await lerDoc(`empresas/${eid}/participacao/${k}`);
      if (p && p.dados && p.dados.respondido === true) return { jsonBody: { erro: "ja_respondeu" } };
      const u = await lerDoc(`empresas/${eid}/unidades/${g.unidadeId}`);
      return { jsonBody: { colab: { k, gheId: g.k, unidadeId: g.unidadeId, ghe: g.nome, unidade: u ? u.dados.nome : "—", primeiro: String((g.colab[k] || [])[1] || "").split(" ")[0] || "colaborador(a)" } } };
    }
    if (acao === "resposta" && request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const eid = String(b.e || ""), k = matKey(b.matricula), r = b.respostas;
      if (!eidValido(eid) || !k || !Array.isArray(r) || r.length !== 35 || r.some((v) => !(Number.isInteger(v) && v >= 1 && v <= 5))) {
        return { status: 400, jsonBody: { code: "invalid_argument" } };
      }
      const e = await empresa(eid);
      if (!coletaAberta(e)) return { status: 403, jsonBody: { code: "fechada" } };
      const g = await acharColaborador(eid, k);
      if (!g) return { status: 404, jsonBody: { code: "nao_encontrada" } };
      // Trava de resposta unica: cria o registro de participacao primeiro
      // (create falha com 409 se a matricula ja respondeu).
      try {
        await criarDoc(`empresas/${eid}/participacao/${k}`, { k, respondido: true, unidadeId: g.unidadeId, gheId: g.k });
      } catch (erro) {
        if (erro.code === 409) return { status: 409, jsonBody: { code: "dup" } };
        throw erro;
      }
      const rid = "r" + crypto.randomBytes(8).toString("hex"); // sem relacao com a matricula
      try {
        await gravarDoc(`empresas/${eid}/respostas/${rid}`, { k: rid, unidadeId: g.unidadeId, gheId: g.k, r, data: hoje() });
      } catch (erro) {
        await excluirDoc(`empresas/${eid}/participacao/${k}`).catch(() => {});
        throw erro;
      }
      return { jsonBody: { ok: true } };
    }
    if (acao === "iso") {
      const eid = request.method === "GET" ? String(request.query.get("e") || "") : null;
      if (request.method === "GET") {
        if (!eidValido(eid)) return { status: 400, jsonBody: { code: "invalid_argument" } };
        const d = await lerDoc(`empresas/${eid}/iso/main`);
        return { jsonBody: { doc: d ? d.dados : null } };
      }
      if (request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const e2 = String(b.e || "");
        if (!eidValido(e2) || !b.nome || !isoCompleto(b.r)) return { status: 400, jsonBody: { code: "invalid_argument" } };
        if (!(await empresa(e2))) return { status: 404, jsonBody: { code: "not_found" } };
        const atual = await lerDoc(`empresas/${e2}/iso/main`);
        if (atual && isoCompleto(atual.dados.r)) return { status: 409, jsonBody: { code: "dup", doc: atual.dados } };
        const r = {}; for (let i = 0; i < 33; i++) r[i] = b.r[i];
        await gravarDoc(`empresas/${e2}/iso/main`, { nome: String(b.nome).slice(0, 120), cargo: String(b.cargo || "").slice(0, 120), email: String(b.email || "").slice(0, 160), data: hoje(), r });
        return { jsonBody: { ok: true } };
      }
    }
    return { status: 404, jsonBody: { code: "not_found" } };
  } catch (erro) {
    context.error("Falha em /api/psicopub/" + acao, erro);
    return { status: 500, jsonBody: { code: "unavailable" } };
  }
}

module.exports = { tratarEquipe, tratarPublico };
