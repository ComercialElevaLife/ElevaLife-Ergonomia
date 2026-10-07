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
        POST /api/psicopub/resposta            { e, matricula, respostas[35] }
        GET  /api/psicopub/iso?e=<eid>         -> { doc }
        POST /api/psicopub/iso                 { e, nome, cargo, email, r }
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { garantirContainer } = require("../shared/cosmos");
const { resolverIdentidade, PAPEIS, podeVerEmpresa } = require("../shared/tenant");
const { enviarEmail, formatarDataBR } = require("../shared/email");

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
// V 1.26: empresas do psicossocial que a pessoa pode ver (ver shared/tenant.js).
// null = todas; Set = so essas; "nenhuma" = sem acesso ao modulo.
function escopoPsico(identidade) {
  if (identidade.papel === PAPEIS.ADMIN) return null;
  const v = identidade.psicoVinculo || (identidade.papel === PAPEIS.CONSULTOR ? "todas" : "marcadas");
  if (v === "nenhuma") return "nenhuma";
  if (v === "todas" && identidade.papel === PAPEIS.CONSULTOR) return null;
  return new Set(identidade.empresasPsico || []);
}
const SEM_VINCULO_PSICO = { status: 403, jsonBody: { erro: "Seu usuário não está vinculado ao módulo de Riscos Psicossociais. Fale com o Administrador.", semVinculo: true } };
// Consultor com empresas marcadas que cadastra uma empresa nova: ela entra
// no vinculo dele automaticamente (senao ele mesmo perderia o acesso).
async function vincularEmpresaAoUsuario(identidade, eid) {
  const { obterContainer } = require("../shared/cosmos");
  const c = obterContainer("usuarios");
  const { resources } = await c.items.query({ query: "SELECT * FROM c WHERE LOWER(c.Email) = @email", parameters: [{ name: "@email", value: identidade.email }] }).fetchAll();
  const doc = resources[0]; if (!doc) return;
  const lista = Array.isArray(doc.EmpresasPsico) ? doc.EmpresasPsico : [];
  if (lista.includes(eid)) return;
  doc.EmpresasPsico = lista.concat(eid); doc.PsicoVinculo = "marcadas";
  await c.item(doc.id, doc.id).replace(doc);
}

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
  if (acao === "eu" && request.method === "GET") return { jsonBody: { email: identidade.email, papel: identidade.papel, semVinculo: escopo === "nenhuma" } };
  if (escopo === "nenhuma") return SEM_VINCULO_PSICO;
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
    // Ergonomista vinculado so a algumas empresas do psicossocial.
    if (escopo instanceof Set) {
      const pt = caminho.split("/");
      if ((acao === "col" || acao === "doc") && pt[0] === "empresas" && pt.length >= 2) {
        if (!escopo.has(pt[1])) {
          const novaEmpresa = acao === "doc" && request.method === "PUT" && pt.length === 2 && !(await lerDoc(caminho));
          if (!novaEmpresa) return { status: 403, jsonBody: { erro: "Sem acesso a esta empresa." } };
          await vincularEmpresaAoUsuario(identidade, pt[1]);
        }
      }
      if (acao === "col" && request.method === "GET" && caminho === "empresas") {
        const pg = await listarPagina(caminho, request.query.get("t") || null);
        return { jsonBody: { docs: pg.docs.filter((d) => escopo.has(d.id)), next: pg.next } };
      }
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
const eidValido = (e) => /^e_[A-Za-z0-9_\-.]{1,120}$/.test(String(e || ""));
const isoCompleto = (r) => !!r && Array.from({ length: 33 }, (_, i) => r[i]).every((v) => v === "S" || v === "P" || v === "N");

async function empresa(eid) {
  if (!eidValido(eid)) return null;
  const d = await lerDoc(`empresas/${eid}`);
  return d ? d.dados : null;
}
// Indice matricula -> GHE por empresa, em memoria (por instancia da Function App).
// Evita ler todos os GHEs (com milhares de colaboradores) a cada acesso de um colaborador.
const INDICE_TTL = 90000;
const indices = new Map(); // eid -> { exp, mapa: Map(k -> { g, nome }), promessa }
function invalidarIndice(caminho) {
  const p = String(caminho || "").split("/");
  if (p[0] === "empresas" && p.length >= 3 && p[2] === "ghes") indices.delete(p[1]);
}
async function carregarIndice(eid) {
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
      const p = await lerDoc(`empresas/${eid}/participacao/${k}`);
      if (p && p.dados && p.dados.respondido === true) return { jsonBody: { erro: "ja_respondeu" } };
      const u = await lerDoc(`empresas/${eid}/unidades/${g.unidadeId}`);
      return { jsonBody: { colab: { k, gheId: g.k, unidadeId: g.unidadeId, ghe: g.nome, unidade: u ? u.dados.nome : "—", primeiro: g.primeiroNome || "colaborador(a)" } } };
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
      // Trava de resposta unica + envio idempotente (ver cabecalho). t = token aleatorio do navegador.
      const t = /^[a-f0-9]{16,64}$/.test(String(b.t || "")) ? String(b.t) : crypto.randomBytes(16).toString("hex");
      const hp = crypto.createHash("sha256").update("p:" + t).digest("hex");
      const rid = "r" + crypto.createHash("sha256").update("r:" + t).digest("hex").slice(0, 24); // sem relacao com a matricula
      const caminhoP = `empresas/${eid}/participacao/${k}`, caminhoR = `empresas/${eid}/respostas/${rid}`;
      const resposta = { k: rid, unidadeId: g.unidadeId, gheId: g.k, r, data: hoje() };
      try {
        await comRetentativa(() => criarDoc(caminhoP, { k, respondido: true, unidadeId: g.unidadeId, gheId: g.k, h: hp }));
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

// ------------------------------------------------------------------
// Perfil CLIENTE (UsuarioCliente do SIGE)
// ------------------------------------------------------------------
// Cliente ve a empresa do psicossocial se ela estiver marcada no usuario
// (EmpresasPsico) ou ligada a um cliente do SIGE ao qual ele esta vinculado.
function clienteVeEmpresa(identidade, e) {
  if (!e || identidade.psicoVinculo === "nenhuma") return false;
  if ((identidade.empresasPsico || []).includes(e.k)) return true;
  return !!(e.clienteId && podeVerEmpresa(identidade, e.clienteId));
}
async function empresasDoCliente(identidade) {
  const todas = await listarColecao("empresas");
  return todas.map((x) => x.data).filter((e) => clienteVeEmpresa(identidade, e));
}
async function tratarCliente(request, context, identidade, acao) {
  if (acao === "cli-empresas" && request.method === "GET") {
    const lista = await empresasDoCliente(identidade);
    return { jsonBody: { empresas: lista.map((e) => ({ k: e.k, razao: e.razao, cnpj: e.cnpj, codigo: e.codigo, status: e.status, inicio: e.inicio, fim: e.fim })) } };
  }
  const eid = String(request.query.get("e") || "");
  if (!eidValido(eid)) return { status: 400, jsonBody: { erro: "Empresa inválida." } };
  const e = await empresa(eid);
  if (!clienteVeEmpresa(identidade, e)) return { status: 403, jsonBody: { erro: "Sem acesso a esta empresa." } };
  if (acao === "cli-dados" && request.method === "GET") {
    const [unidades, ghes, part, analise, iso] = await Promise.all([
      listarColecao(`empresas/${eid}/unidades`), listarColecao(`empresas/${eid}/ghes`),
      listarColecao(`empresas/${eid}/participacao`), listarColecao(`empresas/${eid}/analise`), lerDoc(`empresas/${eid}/iso/main`)]);
    const resp = {};
    part.forEach(({ data: p }) => { if (p && p.respondido === true) resp[p.gheId] = (resp[p.gheId] || 0) + 1; });
    return { jsonBody: {
      empresa: { k: e.k, razao: e.razao, cnpj: e.cnpj, codigo: e.codigo, status: e.status, inicio: e.inicio, fim: e.fim },
      unidades: unidades.map((x) => ({ k: x.data.k, nome: x.data.nome })),
      ghes: ghes.map(({ data: g }) => ({ k: g.k, nome: g.nome, unidadeId: g.unidadeId, total: Object.keys(g.colab || {}).length, respostas: resp[g.k] || 0 })),
      acoes: analise.flatMap(({ data: a }) => Object.entries((a && a.acoes) || {}).map(([c, v]) => ({ g: a.k, c, prazo: v.prazo && (v.prazoManual || v.resp || v.email || v.notif) ? v.prazo : "", resp: v.resp || "", status: v.status || "pendente", conclusao: v.conclusao || "" }))),
      iso: iso ? iso.dados : null,
    } };
  }
  if (acao === "cli-iso" && request.method === "PUT") {
    const b = await request.json().catch(() => ({}));
    if (!b || !b.nome || typeof b.r !== "object") return { status: 400, jsonBody: { erro: "Preencha o nome e as respostas." } };
    const r = {}; for (let i = 0; i < 33; i++) { const v = b.r[i]; if (v === "S" || v === "P" || v === "N") r[i] = v; }
    const atual = await lerDoc(`empresas/${eid}/iso/main`);
    await gravarDoc(`empresas/${eid}/iso/main`, Object.assign({}, atual ? atual.dados : {}, {
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

module.exports = { tratarEquipe, tratarPublico };
