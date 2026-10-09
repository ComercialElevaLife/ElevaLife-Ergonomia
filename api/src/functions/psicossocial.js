/* ==========================================================================
   S.I.G.E. - ElevaLife
   Modulo Riscos Psicossociais (HSE-IT + checklist ISO 45003 + analise de
   risco + plano de acao + relatorio Word) - V 1.14, robustez V 1.24.

   V 1.24 (empresas com ate ~10 mil colaboradores, sem perda de dados):
     - listagens paginadas (/psico/col devolve { docs, next }; o cliente segue
       "next" ate o fim), sem estourar tempo nem tamanho de resposta;
     - consulta de matricula das telas publicas usa um indice em memoria por
       empresa (renovado a cada 90 s ou quando a equipe grava um GHE), em vez de
       ler todos os GHEs a cada colaborador;
     - envio do HSE-IT idempotente: o navegador manda um token "t"; a
       participacao guarda so um hash dele (sha256("p:"+t)) e a resposta usa
       id = "r"+sha256("r:"+t). Reenviar o mesmo envio (queda de rede, resposta
       perdida) nao duplica e nao perde: completa o que faltou. O hash da
       participacao nao permite chegar ao id da resposta (anonimato mantido);
     - gravacoes com nova tentativa em falhas transitorias (408/429/449/5xx);
     - DELETE /api/psico/empresa?e=<eid> apaga em lotes todos os documentos da
       empresa (o cliente repete enquanto vier { restante: true }).

   V 1.25 (perfis do SIGE):
     - Administrador: tudo.
     - Consultor (ergonomista): tudo, exceto excluir empresa, cadastrar
       profissionais e alterar o editor de texto/referencias (config/*).
     - UsuarioCliente: so as empresas cujo "clienteId" (cliente do SIGE) esta
       nas empresas vinculadas a ele, e so por estas rotas:
         GET  /api/psico/cli-empresas            -> { empresas }
         GET  /api/psico/cli-dados?e=<eid>       -> unidades, GHEs (so contagens),
                                                    participacao por GHE, ISO e plano de acao
         PUT  /api/psico/cli-iso?e=<eid>         -> responde/edita o checklist ISO 45003
     - POST /api/psico/notificar-acao { e, g, c } (equipe): envia ao responsavel
       o e-mail da acao do plano (responsavel + e-mail + prazo preenchidos).

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
        POST /api/psicopub/resposta            { e, matricula, respostas[35], termo }
                                               { e, matricula, recusa: true, termo } (V 1.27: nao aceitou o
                                               termo de consentimento - conta como participacao, sem respostas)
        GET  /api/psicopub/iso?e=<eid>         -> { doc }
        POST /api/psicopub/iso                 { e, nome, cargo, email, r }
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { garantirContainer } = require("../shared/cosmos");
const { resolverIdentidade, PAPEIS, podeVerEmpresa } = require("../shared/tenant");
const { enviarEmail, formatarDataBR, logoEmailHtml } = require("../shared/email");

const CONTAINER = "psicossocial";
const GLOBAL = "PSICO_GLOBAL";
const SEGMENTO = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

// ------------------------------------------------------------------
// Nova tentativa em falhas transitorias (o SDK ja repete 429 sozinho)
// ------------------------------------------------------------------
const TRANSITORIOS = new Set([408, 429, 449, 500, 502, 503, 504]);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function comRetentativa(fn, tentativas = 4) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    try { return await fn(); } catch (erro) {
      ultimo = erro;
      const cod = Number(erro && (erro.code || erro.statusCode));
      if (cod && !TRANSITORIOS.has(cod)) throw erro;
      await esperar(300 * 2 ** i + Math.floor(Math.random() * 200));
    }
  }
  throw ultimo;
}

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
    const { resource } = await comRetentativa(async () => (await container()).item(idDoc(caminho), particao(partes)).read());
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
  await comRetentativa(async () => (await container()).items.upsert(doc));
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
    await comRetentativa(async () => (await container()).item(idDoc(caminho), particao(partes)).delete());
  } catch (erro) {
    if (erro.code !== 404) throw erro;
  }
}
// Uma pagina da colecao (ate POR_PAGINA documentos). next = token para a pagina seguinte, ou null.
const POR_PAGINA = 2000;
async function listarPagina(colecao, token) {
  const partes = validarCaminho(colecao, false);
  if (!partes) throw Object.assign(new Error("Coleção inválida"), { status: 400 });
  const pk = partes[0] === "empresas" && partes.length >= 3 ? partes[1] : GLOBAL;
  const r = await comRetentativa(async () => (await container()).items
    .query({ query: "SELECT c.caminho, c.dados FROM c WHERE c.colecao = @col", parameters: [{ name: "@col", value: colecao }] },
      { partitionKey: pk, maxItemCount: POR_PAGINA, continuationToken: token || undefined })
    .fetchNext());
  return { docs: (r.resources || []).map((x) => ({ id: x.caminho.split("/").pop(), data: x.dados })), next: r.hasMoreResults && r.continuationToken ? r.continuationToken : null };
}
async function listarColecao(colecao) {
  const out = []; let token = null;
  do { const pg = await listarPagina(colecao, token); out.push(...pg.docs); token = pg.next; } while (token);
  return out;
}

// Exclusao em lotes de todos os documentos de uma empresa (particao = eid), com limite de tempo por chamada.
async function excluirEmpresaLote(eid, limiteMs = 20000) {
  const ini = Date.now(); let apagados = 0;
  const c = await container();
  while (Date.now() - ini < limiteMs) {
    const r = await comRetentativa(() => c.items.query({ query: "SELECT TOP 500 c.id FROM c" }, { partitionKey: eid }).fetchNext());
    const ids = (r.resources || []).map((x) => x.id);
    if (!ids.length) return { restante: false, apagados };
    for (let i = 0; i < ids.length; i += 25) {
      await Promise.all(ids.slice(i, i + 25).map((id) => comRetentativa(() => c.item(id, eid).delete()).catch((e) => { if (e.code !== 404) throw e; })));
      apagados += Math.min(25, ids.length - i);
      if (Date.now() - ini >= limiteMs) return { restante: true, apagados };
    }
  }
  return { restante: true, apagados };
}

// ------------------------------------------------------------------
// Rota da EQUIPE
// ------------------------------------------------------------------
// V 1.27: cadastro unico com o SIGE. A empresa do modulo e o Cliente do SIGE:
// eid = "e_sige-" + id do cliente. Unidades, setores/GHE e colaboradores ficam
// nos containers do SIGE (unidade, setor, colaborador); o modulo guarda so a
// coleta, respostas, ISO 45003 e analise. Quem nao e Administrador so acessa as
// empresas vinculadas ao seu usuario (EmpresasVinculadas), como no resto do SIGE.
const EID_SIGE = "e_sige-";
const clienteDoEid = (eid) => (String(eid || "").startsWith(EID_SIGE) ? String(eid).slice(EID_SIGE.length) : null);
function escopoPsico(identidade) {
  if (identidade.papel === PAPEIS.ADMIN) return null;
  return new Set((identidade.empresasVinculadas || []).map((id) => EID_SIGE + id));
}
// Documentos de um container do SIGE para uma empresa (particao /EmpresaId).
async function listarSige(nome, clienteId) {
  const c = nome === "colaborador" ? await garantirContainer(nome) : obterContainerSige(nome);
  const { resources } = await comRetentativa(() => c.items.query({ query: "SELECT * FROM c WHERE c.EmpresaId = @e", parameters: [{ name: "@e", value: clienteId }] }, { partitionKey: clienteId }).fetchAll());
  return resources || [];
}
function obterContainerSige(nome) { return require("../shared/cosmos").obterContainer(nome); }

async function tratarEquipe(request, context) {
  let identidade;
  try {
    identidade = await resolverIdentidade(request);
  } catch (erro) {
    context.error("Falha ao resolver identidade em /api/psico", erro);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissões." } };
  }
  if (!identidade) return { status: 401, jsonBody: { erro: "Não autenticado." } };
  const acao = String(request.params.id || "");
  const caminho = request.query.get("c") || "";
  const escopo = escopoPsico(identidade);
  if (acao === "eu" && request.method === "GET") return { jsonBody: { email: identidade.email, papel: identidade.papel } };
  if (identidade.papel === PAPEIS.CLIENTE) {
    try { return await tratarCliente(request, context, identidade, acao); }
    catch (erro) { context.error("Falha em /api/psico/" + acao + " (cliente)", erro); return { status: 500, jsonBody: { erro: "Falha ao acessar os dados." } }; }
  }
  if (![PAPEIS.ADMIN, PAPEIS.CONSULTOR].includes(identidade.papel)) {
    return { status: 403, jsonBody: { erro: "O módulo de Riscos Psicossociais é restrito à equipe ElevaLife.", papel: identidade.papel || null } };
  }
  const ehAdmin = identidade.papel === PAPEIS.ADMIN;
  const soAdmin = () => ({ status: 403, jsonBody: { erro: "Somente o Administrador pode fazer esta alteração. Solicite ao coordenador." } });
  try {
    // Ergonomista (Consultor): so as empresas vinculadas ao usuario.
    if (escopo instanceof Set) {
      const pt = caminho.split("/");
      if ((acao === "col" || acao === "doc") && pt[0] === "empresas" && pt.length >= 2 && !escopo.has(pt[1])) {
        return { status: 403, jsonBody: { erro: "Sem acesso a esta empresa." } };
      }
      if (acao === "col" && request.method === "GET" && caminho === "empresas") {
        const pg = await listarPagina(caminho, request.query.get("t") || null);
        return { jsonBody: { docs: pg.docs.filter((d) => escopo.has(d.id)), next: pg.next } };
      }
    }
    if (acao === "migrar" && request.method === "POST") {
      if (!ehAdmin) return soAdmin();
      return { jsonBody: await migrarEmpresa(await request.json().catch(() => ({}))) };
    }
    if (acao === "notificar-acao" && request.method === "POST") {
      return await notificarAcao(request, context, identidade, escopo);
    }
    if (!ehAdmin && request.method !== "GET") {
      const pt = String(request.method === "DELETE" && acao === "empresa" ? "empresa" : caminho).split("/");
      if (acao === "empresa") return soAdmin(); // excluir empresa
      if (acao === "doc" && request.method === "DELETE" && pt[0] === "empresas" && pt.length === 2) return soAdmin();
      if (acao === "doc" && (pt[0] === "profissionais" || pt[0] === "config")) return soAdmin();
    }
    if (acao === "col" && request.method === "GET") {
      return { jsonBody: await listarPagina(caminho, request.query.get("t") || null) };
    }
    if (acao === "empresa" && request.method === "DELETE") {
      const eid = String(request.query.get("e") || "");
      if (!eidValido(eid)) return { status: 400, jsonBody: { erro: "Empresa inválida." } };
      indices.delete(eid);
      return { jsonBody: await excluirEmpresaLote(eid) };
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
        invalidarIndice(caminho);
        return { jsonBody: { ok: true } };
      }
      if (request.method === "DELETE") {
        await excluirDoc(caminho);
        invalidarIndice(caminho);
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
const eidValido = (e) => /^e_[A-Za-z0-9_\-.]{1,200}$/.test(String(e || ""));
const isoCompleto = (r) => !!r && Array.from({ length: 33 }, (_, i) => r[i]).every((v) => v === "S" || v === "P" || v === "N");

async function empresa(eid) {
  if (!eidValido(eid)) return null;
  const d = await lerDoc(`empresas/${eid}`);
  return d ? d.dados : null;
}
// V 1.31 - reaplicacao do projeto: cada aplicacao (ciclo) tem a sua coleta. A 1a fica em empresas/{eid}/...;
// a partir da 2a, em empresas/{eid}/ciclos/{n}/... (participacao, respostas, ISO e analise). O cadastro
// (unidades, setores/GHE e colaboradores) e o mesmo para todas as aplicacoes.
const baseCiclo = (eid, e) => { const n = Number(e && e.ciclo) || 1; return n > 1 ? `empresas/${eid}/ciclos/${n}` : `empresas/${eid}`; };
// Indice matricula -> GHE por empresa, em memoria (por instancia da Function App).
// Evita ler todos os GHEs (com milhares de colaboradores) a cada acesso de um colaborador.
const INDICE_TTL = 90000;
const indices = new Map(); // eid -> { exp, mapa: Map(k -> { g, nome }), promessa }
function invalidarIndice(caminho) {
  const p = String(caminho || "").split("/");
  if (p[0] === "empresas" && p.length >= 3 && p[2] === "ghes") indices.delete(p[1]);
}
async function carregarIndice(eid) {
  const cid = clienteDoEid(eid);
  if (cid) { // V 1.27: colaboradores do cadastro do SIGE
    const [uns, sets, cols] = await Promise.all([listarSige("unidade", cid), listarSige("setor", cid), listarSige("colaborador", cid)]);
    const uId = new Map(uns.map((u) => [u.Unidade, u.id]));
    const gInfo = new Map(sets.filter((g) => uId.has(g.Unidade)).map((g) => [g.Unidade + "|" + g.Setor, { k: g.id, nome: g.Setor, unidadeId: uId.get(g.Unidade), unidadeNome: g.Unidade }]));
    const mapa = new Map();
    for (const c of cols) { const g = gInfo.get(c.Unidade + "|" + c.Setor); if (g && c.Matricula != null) mapa.set(matKey(c.Matricula), { g, nome: c.Nome || "" }); }
    return mapa;
  }
  const ghes = await listarColecao(`empresas/${eid}/ghes`);
  const mapa = new Map();
  for (const { data: g } of ghes) {
    if (!g || !g.colab) continue;
    const info = { k: g.k, nome: g.nome, unidadeId: g.unidadeId };
    for (const [k, v] of Object.entries(g.colab)) mapa.set(k, { g: info, nome: (v || [])[1] || "" });
  }
  return mapa;
}
async function indiceEmpresa(eid, fresco) {
  const atual = indices.get(eid);
  if (!fresco && atual && atual.exp > Date.now()) return atual.promessa;
  const promessa = carregarIndice(eid);
  indices.set(eid, { exp: Date.now() + INDICE_TTL, promessa });
  promessa.catch(() => indices.delete(eid));
  return promessa;
}
async function acharColaborador(eid, k) {
  let x = (await indiceEmpresa(eid)).get(k);
  if (!x) x = (await indiceEmpresa(eid, true)).get(k); // colaborador incluido ha pouco: confere de novo, sem cache
  return x ? { ...x.g, primeiroNome: String(x.nome).split(" ")[0] } : null;
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
      const p = await lerDoc(`${baseCiclo(eid, await empresa(eid))}/participacao/${k}`);
      if (p && p.dados && p.dados.respondido === true) return { jsonBody: { erro: "ja_respondeu" } };
      const u = g.unidadeNome ? null : await lerDoc(`empresas/${eid}/unidades/${g.unidadeId}`);
      return { jsonBody: { colab: { k, gheId: g.k, unidadeId: g.unidadeId, ghe: g.nome, unidade: g.unidadeNome || (u ? u.dados.nome : "—"), primeiro: g.primeiroNome || "colaborador(a)" } } };
    }
    if (acao === "resposta" && request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const eid = String(b.e || ""), k = matKey(b.matricula), r = b.respostas;
      const recusa = b.recusa === true; // V 1.27: nao aceitou o termo de consentimento (LGPD) - conta como participacao, sem respostas
      const termoVersao = String(b.termo || "").slice(0, 40);
      if (!eidValido(eid) || !k || (!recusa && (!Array.isArray(r) || r.length !== 35 || r.some((v) => !(Number.isInteger(v) && v >= 1 && v <= 5))))) {
        return { status: 400, jsonBody: { code: "invalid_argument" } };
      }
      const e = await empresa(eid);
      if (!coletaAberta(e)) return { status: 403, jsonBody: { code: "fechada" } };
      const g = await acharColaborador(eid, k);
      if (!g) return { status: 404, jsonBody: { code: "nao_encontrada" } };
      // Trava de resposta unica + envio idempotente (ver cabecalho). t = token aleatorio do navegador.
      const t = /^[a-f0-9]{16,64}$/.test(String(b.t || "")) ? String(b.t) : crypto.randomBytes(16).toString("hex");
      const hp = crypto.createHash("sha256").update("p:" + t).digest("hex");
      const rid = "r" + crypto.createHash("sha256").update("r:" + t).digest("hex").slice(0, 24); // sem relacao com a matricula
      const base = baseCiclo(eid, e);
      const caminhoP = `${base}/participacao/${k}`, caminhoR = `${base}/respostas/${rid}`;
      const resposta = recusa
        ? { k: rid, unidadeId: g.unidadeId, gheId: g.k, recusa: true, data: hoje() }
        : { k: rid, unidadeId: g.unidadeId, gheId: g.k, r, data: hoje() };
      const termo = recusa ? { recusou: true, termo: "recusado", termoVersao } : { termo: termoVersao ? "aceito" : "", termoVersao };
      try {
        await comRetentativa(() => criarDoc(caminhoP, Object.assign({ k, respondido: true, unidadeId: g.unidadeId, gheId: g.k, h: hp }, termo)));
      } catch (erro) {
        if (erro.code !== 409) throw erro;
        const p = await lerDoc(caminhoP);
        if (!p || !p.dados || p.dados.h !== hp) return { status: 409, jsonBody: { code: "dup" } };
        // mesmo envio repetido (ex.: a confirmacao se perdeu na rede): garante a resposta e confirma
        if (!(await lerDoc(caminhoR))) await gravarDoc(caminhoR, resposta);
        return { jsonBody: { ok: true } };
      }
      try {
        await gravarDoc(caminhoR, resposta);
      } catch (erro) {
        // nao conseguiu gravar a resposta: libera a matricula para o mesmo envio ser repetido
        await excluirDoc(caminhoP).catch(() => {});
        context.error("Falha ao gravar resposta HSE-IT", erro);
        return { status: 503, jsonBody: { code: "retry" } };
      }
      return { jsonBody: { ok: true } };
    }
    if (acao === "iso") {
      const eid = request.method === "GET" ? String(request.query.get("e") || "") : null;
      if (request.method === "GET") {
        if (!eidValido(eid)) return { status: 400, jsonBody: { code: "invalid_argument" } };
        const d = await lerDoc(`${baseCiclo(eid, await empresa(eid))}/iso/main`);
        return { jsonBody: { doc: d ? d.dados : null } };
      }
      if (request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const e2 = String(b.e || "");
        if (!eidValido(e2) || !b.nome || !isoCompleto(b.r)) return { status: 400, jsonBody: { code: "invalid_argument" } };
        const emp2 = await empresa(e2);
        if (!emp2) return { status: 404, jsonBody: { code: "not_found" } };
        const isoPath = `${baseCiclo(e2, emp2)}/iso/main`;
        const atual = await lerDoc(isoPath);
        if (atual && isoCompleto(atual.dados.r)) return { status: 409, jsonBody: { code: "dup", doc: atual.dados } };
        const r = {}; for (let i = 0; i < 33; i++) r[i] = b.r[i];
        await gravarDoc(isoPath, { nome: String(b.nome).slice(0, 120), cargo: String(b.cargo || "").slice(0, 120), email: String(b.email || "").slice(0, 160), data: hoje(), r });
        return { jsonBody: { ok: true } };
      }
    }
    return { status: 404, jsonBody: { code: "not_found" } };
  } catch (erro) {
    context.error("Falha em /api/psicopub/" + acao, erro);
    return { status: 500, jsonBody: { code: "unavailable" } };
  }
}

// ------------------------------------------------------------------
// V 1.27 - Migracao das empresas cadastradas no modulo antes do cadastro unico
// (empresa, unidades, GHEs e colaboradores vao para o cadastro do SIGE; coleta,
// respostas, ISO 45003 e analise vao para a nova chave "e_sige-<cliente>").
// Feita em etapas curtas (o cliente repete a chamada ate "fim"), nada e apagado:
// a empresa antiga fica marcada com "migradoPara" e perde o codigo da coleta,
// que passa para a nova (os QR codes ja distribuidos continuam valendo).
// ------------------------------------------------------------------
const sigeSlug = (partes) => { let x = partes.join("|").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); x = x.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); return x.slice(0, 180) || "registro"; };
async function lerSigePorId(nome, id) {
  const c = nome === "ergonomista" ? await garantirContainer(nome) : obterContainerSige(nome);
  const { resources } = await comRetentativa(() => c.items.query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: id }] }).fetchAll());
  return (resources || [])[0] || null;
}
async function gravarSige(nome, doc) {
  const c = ["colaborador", "ergonomista"].includes(nome) ? await garantirContainer(nome) : obterContainerSige(nome);
  const agora = new Date().toISOString();
  const d = Object.assign({ _criadoEm: agora, _criadoPor: "migracao-psicossocial", _editadoEm: agora, _editadoPor: "migracao-psicossocial" }, doc);
  await comRetentativa(() => c.items.upsert(d));
  return d;
}
async function emLotes(itens, fn, limiteMs, ini, paralelo = 20) {
  let i = 0;
  while (i < itens.length && Date.now() - ini < limiteMs) { await Promise.all(itens.slice(i, i + paralelo).map(fn)); i += paralelo; }
  return Math.min(i, itens.length);
}
async function migrarEmpresa(b) {
  const ini = Date.now(), LIM = 18000;
  const old = String(b.e || "");
  if (!eidValido(old) || old.startsWith(EID_SIGE)) return { erro: "Empresa inválida." };
  const ext = await lerDoc(`empresas/${old}`); if (!ext) return { erro: "Empresa não encontrada." };
  const E0 = ext.dados || {};
  const [uns, ghes] = await Promise.all([listarColecao(`empresas/${old}/unidades`), listarColecao(`empresas/${old}/ghes`)]);
  const uNome = new Map(uns.map((u) => [u.id, (u.data && u.data.nome) || u.id]));
  const etapa = b.etapa || "cadastro";
  let cli = b.cliente && b.cliente !== "novo" ? await lerSigePorId("cliente", String(b.cliente)) : null;
  if (b.cliente && b.cliente !== "novo" && !cli) return { erro: "Cliente do SIGE não encontrado." };
  if (etapa === "cadastro") {
    if (!cli) {
      const id = sigeSlug([E0.razao || old]);
      cli = await lerSigePorId("cliente", id);
      if (!cli) cli = await gravarSige("cliente", { id, EmpresaId: id, Cliente: E0.razao || old, CNPJ: E0.cnpj || "", "Matriz Risco": E0.matriz === "4x4" ? "Matriz 4x4" : "Matriz 5x5", Servicos: ["psicossocial"], Telefone: E0.telefone || "", CNAE: E0.cnae || "", "Grau Risco NR4": E0.grau || "", Logradouro: E0.endereco || "" });
    } else if (Array.isArray(cli.Servicos) && !cli.Servicos.includes("psicossocial")) {
      cli = await gravarSige("cliente", Object.assign({}, cli, { Servicos: cli.Servicos.concat("psicossocial") }));
    }
    const cid = cli.id;
    await emLotes(uns, (u) => gravarSige("unidade", { id: sigeSlug([cli.Cliente, uNome.get(u.id)]), Cliente: cli.Cliente, Unidade: uNome.get(u.id), EmpresaId: cid }), 60000, ini);
    await emLotes(ghes, (g) => gravarSige("setor", { id: sigeSlug([cli.Cliente, uNome.get(g.data.unidadeId) || "", g.data.nome]), Cliente: cli.Cliente, Unidade: uNome.get(g.data.unidadeId) || "", Setor: g.data.nome, "Tipo Setor": "GHE", EmpresaId: cid }), 60000, ini);
    const nColab = ghes.reduce((a, g) => a + Object.keys((g.data && g.data.colab) || {}).length, 0);
    return { etapa: "colaboradores", cliente: cid, cursor: 0, unidades: uns.length, ghes: ghes.length, colaboradores: nColab };
  }
  const cid = cli.id, novo = EID_SIGE + cid;
  const gNovo = new Map(ghes.map((g) => [g.id, sigeSlug([cli.Cliente, uNome.get(g.data.unidadeId) || "", g.data.nome])]));
  const uNovo = new Map(uns.map((u) => [u.id, sigeSlug([cli.Cliente, uNome.get(u.id)])]));
  if (etapa === "colaboradores") {
    const lista = [];
    ghes.forEach((g) => Object.entries((g.data && g.data.colab) || {}).forEach(([k, v]) => lista.push({ g: g.data, mat: String((v || [])[0] || k), nome: (v || [])[1] || "" })));
    lista.sort((a, b2) => (a.mat > b2.mat ? 1 : -1));
    const de = +b.cursor || 0;
    const feitos = await emLotes(lista.slice(de), (x) => gravarSige("colaborador", { id: sigeSlug([cli.Cliente, x.mat]), Cliente: cli.Cliente, Unidade: uNome.get(x.g.unidadeId) || "", Setor: x.g.nome, Matricula: x.mat, Nome: x.nome, EmpresaId: cid }), LIM, ini);
    const cursor = de + feitos;
    return cursor < lista.length ? { etapa: "colaboradores", cliente: cid, cursor, total: lista.length } : { etapa: "dados", cliente: cid, cursor: { i: 0, t: null }, total: lista.length };
  }
  if (etapa === "dados") {
    const COLS = ["participacao", "respostas", "analise", "iso"];
    let { i, t } = b.cursor || { i: 0, t: null }; let copiados = +b.copiados || 0;
    while (i < COLS.length && Date.now() - ini < LIM) {
      const col = COLS[i];
      const pg = await listarPagina(`empresas/${old}/${col}`, t);
      await emLotes(pg.docs, async (d) => {
        let id = d.id; const dados = Object.assign({}, d.data);
        if (dados.gheId && gNovo.has(dados.gheId)) dados.gheId = gNovo.get(dados.gheId);
        if (dados.unidadeId && uNovo.has(dados.unidadeId)) dados.unidadeId = uNovo.get(dados.unidadeId);
        if (col === "analise") { id = gNovo.get(d.id) || d.id; dados.k = id; }
        await gravarDoc(`empresas/${novo}/${col}/${id}`, dados);
      }, 120000, ini, 25);
      copiados += pg.docs.length;
      if (pg.next) t = pg.next; else { i++; t = null; }
    }
    return i < COLS.length ? { etapa: "dados", cliente: cid, cursor: { i, t }, copiados } : { etapa: "finalizar", cliente: cid, copiados };
  }
  if (etapa === "finalizar") {
    // profissionais do modulo -> ergonomistas do SIGE (pelo nome)
    const mapaProf = {};
    for (const pid of [E0.ergId, E0.rtId].filter(Boolean)) {
      const p = await lerDoc(`profissionais/${pid}`); if (!p || !p.dados || !p.dados.nome) continue;
      const cont = await garantirContainer("ergonomista");
      const { resources } = await comRetentativa(() => cont.items.query("SELECT * FROM c").fetchAll());
      const achado = (resources || []).find((x) => String(x.Nome || "").trim().toLowerCase() === String(p.dados.nome).trim().toLowerCase());
      mapaProf[pid] = achado ? achado.id : (await gravarSige("ergonomista", { id: crypto.randomUUID(), EmpresaId: "GLOBAL", Nome: p.dados.nome, Titulo: p.dados.formacao || "", Registro: p.dados.conselho || "" })).id;
    }
    const atual = await lerDoc(`empresas/${novo}`);
    const base = atual ? atual.dados : {};
    await gravarDoc(`empresas/${novo}`, Object.assign({}, base, { v: 127, k: novo, clienteId: cid, razao: cli.Cliente, cnpj: cli.CNPJ || E0.cnpj || "",
      codigo: E0.codigo || base.codigo || "", status: E0.status || base.status || "aberta", inicio: E0.inicio || "", fim: E0.fim || "", realizadas: E0.realizadas || base.realizadas || "",
      tfGeral: E0.tfGeral != null ? E0.tfGeral : base.tfGeral, ergId: mapaProf[E0.ergId] || base.ergId || "", rtId: mapaProf[E0.rtId] || base.rtId || "", logo: E0.logo || base.logo || "", stats: E0.stats || base.stats, migradoDe: old }));
    await gravarDoc(`empresas/${old}`, Object.assign({}, E0, { migradoPara: novo, codigoAntigo: E0.codigo || "", codigo: "", migradoEm: new Date().toISOString() }));
    indices.delete(old); indices.delete(novo);
    return { etapa: "fim", cliente: cid, eid: novo };
  }
  return { erro: "Etapa desconhecida." };
}

// ------------------------------------------------------------------
// Perfil CLIENTE (UsuarioCliente do SIGE)
// ------------------------------------------------------------------
// V 1.27: o cliente ve as empresas vinculadas ao seu usuario no SIGE que tem o
// servico Riscos Psicossociais (ou cadastro antigo, sem a lista de servicos).
const temServicoPsico = (c) => !Array.isArray(c.Servicos) || c.Servicos.includes("psicossocial");
async function empresasDoCliente(identidade) {
  const ids = identidade.empresasVinculadas || [];
  if (!ids.length) return [];
  const cont = obterContainerSige("cliente");
  const { resources } = await comRetentativa(() => cont.items.query({ query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)", parameters: [{ name: "@ids", value: ids }] }).fetchAll());
  const out = [];
  for (const c of resources || []) {
    if (!temServicoPsico(c)) continue;
    const ext = (await lerDoc(`empresas/${EID_SIGE}${c.id}`)) || null; const x = ext ? ext.dados : {};
    out.push({ k: EID_SIGE + c.id, clienteId: c.id, razao: c.Cliente, cnpj: c.CNPJ || "", codigo: x.codigo || "", status: x.status || "", inicio: x.inicio || "", fim: x.fim || "" });
  }
  return out.sort((a, b) => String(a.razao).localeCompare(String(b.razao), "pt-BR"));
}
async function tratarCliente(request, context, identidade, acao) {
  if (acao === "cli-empresas" && request.method === "GET") {
    const lista = await empresasDoCliente(identidade);
    return { jsonBody: { empresas: lista.map((e) => ({ k: e.k, razao: e.razao, cnpj: e.cnpj, codigo: e.codigo, status: e.status, inicio: e.inicio, fim: e.fim })) } };
  }
  const eid = String(request.query.get("e") || "");
  if (!eidValido(eid)) return { status: 400, jsonBody: { erro: "Empresa inválida." } };
  const cid = clienteDoEid(eid);
  if (!cid || !podeVerEmpresa(identidade, cid)) return { status: 403, jsonBody: { erro: "Sem acesso a esta empresa." } };
  const e = (await empresa(eid)) || { k: eid };
  if (acao === "cli-dados" && request.method === "GET") {
    const [uns, sets, cols, plano, part, iso] = await Promise.all([
      listarSige("unidade", cid), listarSige("setor", cid), listarSige("colaborador", cid), listarSige("planoAcao", cid),
      listarColecao(`${baseCiclo(eid, e)}/participacao`), lerDoc(`${baseCiclo(eid, e)}/iso/main`)]);
    const resp = {}, rec = {};
    part.forEach(({ data: p }) => { if (p && p.respondido === true) { resp[p.gheId] = (resp[p.gheId] || 0) + 1; if (p.recusou === true) rec[p.gheId] = (rec[p.gheId] || 0) + 1; } });
    const uId = new Map(uns.map((u) => [u.Unidade, u.id]));
    const total = {}; cols.forEach((c) => { const k = c.Unidade + "|" + c.Setor; total[k] = (total[k] || 0) + 1; });
    const st = (r) => (r["Dt Conclusao"] || r["Status Execucao"] === "Concluida" ? "concluida" : r["Status Execucao"] === "Em andamento" ? "andamento" : "pendente");
    return { jsonBody: {
      empresa: { k: eid, razao: e.razao || "", cnpj: e.cnpj || "", codigo: e.codigo || "", status: e.status || "", inicio: e.inicio || "", fim: e.fim || "", ciclo: Number(e.ciclo) || 1 },
      unidades: uns.map((u) => ({ k: u.id, nome: u.Unidade })),
      ghes: sets.filter((g) => uId.has(g.Unidade)).map((g) => ({ k: g.id, nome: g.Setor, tipo: g["Tipo Setor"] === "GHE" ? "GHE" : "Setor", unidadeId: uId.get(g.Unidade), total: total[g.Unidade + "|" + g.Setor] || 0, respostas: resp[g.id] || 0, recusas: rec[g.id] || 0 })),
      acoes: plano.filter((r) => r.Origem === "Riscos Psicossociais" && r.Psico).map((r) => ({ g: r.Psico.g, c: r.Psico.c || r["Nr Acao"] || "", prazo: r["Dt Programada"] || "", resp: r["Responsavel Acao"] || "", status: st(r), conclusao: r["Dt Conclusao"] || "", acao: r["Acao Recomendada"] || "", risco: r.Psico.risco || "", fator: r.Psico.fator || "" })),
      iso: iso ? iso.dados : null,
    } };
  }
  if (acao === "cli-iso" && request.method === "PUT") {
    const b = await request.json().catch(() => ({}));
    if (!b || !b.nome || typeof b.r !== "object") return { status: 400, jsonBody: { erro: "Preencha o nome e as respostas." } };
    const r = {}; for (let i = 0; i < 33; i++) { const v = b.r[i]; if (v === "S" || v === "P" || v === "N") r[i] = v; }
    const isoPath = `${baseCiclo(eid, e)}/iso/main`;
    const atual = await lerDoc(isoPath);
    await gravarDoc(isoPath, Object.assign({}, atual ? atual.dados : {}, {
      nome: String(b.nome).slice(0, 120), cargo: String(b.cargo || "").slice(0, 120), email: String(b.email || "").slice(0, 160),
      data: (atual && atual.dados && atual.dados.data) || hoje(), r, editadoEm: hoje(), editadoPor: identidade.email }));
    return { jsonBody: { ok: true } };
  }
  return { status: 403, jsonBody: { erro: "Sem acesso." } };
}

// ------------------------------------------------------------------
// E-mail ao responsavel por uma acao do plano (V 1.25)
// ------------------------------------------------------------------
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const emailValido = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || ""));
function modeloAcaoPsico({ empresa: e, unidade, ghe, acao: a }) {
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#3A2A2E">
      <div style="background:#5E2A30;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0">
        ${logoEmailHtml()}
        <div style="font-weight:700;font-size:18px">S.I.G.E · Riscos Psicossociais</div>
        <div style="font-size:12px;opacity:.85">ElevaLife · 15 anos elevando pessoas e resultados</div>
      </div>
      <div style="border:1px solid #EADDE0;border-top:none;border-radius:0 0 12px 12px;padding:26px;background:#fff">
        <p style="font-size:16px;font-weight:700;margin:0 0 10px;color:#5E2A30">Olá, ${esc(a.resp)}!</p>
        <p style="font-size:14.5px;line-height:1.65;margin:0 0 12px">Você foi indicado(a) como <strong>responsável</strong> por uma ação do plano de ação de riscos psicossociais da <strong>${esc(e.razao)}</strong>, construído a partir da avaliação HSE-IT e do checklist ISO 45003.</p>
        <div style="background:#F5EFEA;border-left:4px solid #8B3A42;border-radius:8px;padding:14px 16px;margin:16px 0">
          <div style="font-size:12px;color:#8A7A78;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Ação</div>
          <div style="font-size:15px;font-weight:700;color:#5E2A30;margin-bottom:6px">${esc(a.titulo)}</div>
          <div style="font-size:14px;line-height:1.6">${esc(a.recomendacao)}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:6px 0 16px">
          <tr><td style="padding:5px 0;color:#8A7A78;width:42%">Unidade / grupo ocupacional</td><td style="padding:5px 0">${esc(unidade)} › ${esc(ghe)}</td></tr>
          <tr><td style="padding:5px 0;color:#8A7A78">Fator psicossocial</td><td style="padding:5px 0">${esc(a.fator)}</td></tr>
          ${a.indicador ? `<tr><td style="padding:5px 0;color:#8A7A78">Indicador de eficácia</td><td style="padding:5px 0">${esc(a.indicador)}</td></tr>` : ""}
          <tr><td style="padding:5px 0;color:#8A7A78">Prazo para conclusão</td><td style="padding:5px 0"><strong style="color:#8B3A42;font-size:15px">${formatarDataBR(a.prazo)}</strong></td></tr>
        </table>
        <p style="font-size:14.5px;line-height:1.65;margin:0 0 12px">A conclusão desta ação dentro do prazo é <strong>fundamental para a melhoria das condições de trabalho e da saúde dos colaboradores</strong>. Cada medida implantada reduz a exposição aos fatores de risco identificados, fortalece a confiança das equipes e contribui para um ambiente mais seguro, saudável e produtivo.</p>
        <p style="font-size:14.5px;line-height:1.65;margin:0 0 12px">Se precisar de apoio para planejar ou executar a ação, conte com a equipe técnica da ElevaLife.</p>
        <p style="font-size:14.5px;line-height:1.65;margin:0">Obrigado pelo seu compromisso!<br><strong>Equipe ElevaLife</strong></p>
      </div>
      <p style="font-size:11.5px;color:#8A7A78;text-align:center;margin:12px 0 0">Mensagem automática do S.I.G.E · ElevaLife. Em caso de dúvida, responda a este e-mail ou fale com o seu ergonomista.</p>
    </div>`;
}
async function notificarAcao(request, context, identidade, escopo) {
  const b = await request.json().catch(() => ({}));
  const eid = String(b.e || ""), gid = String(b.g || ""), cod = String(b.c || "");
  if (!eidValido(eid) || !SEGMENTO.test(gid) || !cod) return { status: 400, jsonBody: { erro: "Dados inválidos." } };
  if (escopo instanceof Set && !escopo.has(eid)) return { status: 403, jsonBody: { erro: "Sem acesso a esta empresa." } };
  const e = await empresa(eid);
  const docA = await lerDoc(`empresas/${eid}/analise/${gid}`);
  const a = docA && docA.dados && docA.dados.acoes && docA.dados.acoes[cod];
  if (!e || !a) return { status: 404, jsonBody: { erro: "Ação não encontrada." } };
  if (!a.resp || !emailValido(a.email) || !a.prazo) return { status: 400, jsonBody: { erro: "Preencha responsável, e-mail e prazo." } };
  const assinatura = [a.resp, a.email, a.prazo].join("|");
  if (a.notif && a.notif.assinatura === assinatura && !b.forcar) return { jsonBody: { ok: true, jaEnviado: true, em: a.notif.em } };
  const ghe = await lerDoc(`empresas/${eid}/ghes/${gid}`);
  const uni = ghe ? await lerDoc(`empresas/${eid}/unidades/${ghe.dados.unidadeId}`) : null;
  const info = b.info || {};
  try {
    await enviarEmail({
      para: a.email,
      assunto: `Ação sob sua responsabilidade · Riscos psicossociais · ${e.razao}`,
      htmlCorpo: modeloAcaoPsico({ empresa: e, unidade: uni ? uni.dados.nome : "—", ghe: ghe ? ghe.dados.nome : "—",
        acao: { resp: a.resp, prazo: a.prazo, titulo: String(info.titulo || cod).slice(0, 300), recomendacao: String(info.recomendacao || "").slice(0, 1200), fator: String(info.fator || "").slice(0, 120), indicador: String(info.indicador || "").slice(0, 300) } }),
    });
  } catch (erro) {
    context.error("Falha ao enviar e-mail da ação psicossocial", erro);
    return { status: 502, jsonBody: { erro: "Não foi possível enviar o e-mail: " + erro.message } };
  }
  const notif = { assinatura, em: new Date().toISOString(), por: identidade.email };
  const novo = Object.assign({}, docA.dados); novo.acoes = Object.assign({}, novo.acoes); novo.acoes[cod] = Object.assign({}, novo.acoes[cod], { notif });
  await gravarDoc(`empresas/${eid}/analise/${gid}`, novo);
  return { jsonBody: { ok: true, em: notif.em } };
}

// V 1.27: e-mail ao responsavel de uma acao do Plano de Acao com origem
// "Riscos Psicossociais" (disparado pela gravacao em entidades.js).
function emailAcaoPsico(r) {
  const p = r.Psico || {};
  return modeloAcaoPsico({ empresa: { razao: r.Cliente }, unidade: r.Unidade, ghe: r.Setor,
    acao: { resp: r["Responsavel Acao"], titulo: p.risco || r["Nr Acao"] || "Ação do plano", recomendacao: r["Acao Recomendada"] || "", fator: p.fator || "", indicador: p.indicador || "", prazo: r["Dt Programada"] } });
}
// V 1.37: exclusao da empresa-cliente no SIGE apaga tambem o documento raiz da empresa no modulo.
async function excluirRaizEmpresa(eid) {
  indices.delete(eid);
  try { await comRetentativa(async () => (await container()).item(idDoc(`empresas/${eid}`), GLOBAL).delete()); } catch (e) { if (e.code !== 404) throw e; }
}

module.exports = { tratarEquipe, tratarPublico, emailAcaoPsico, excluirEmpresaLote, excluirRaizEmpresa };
