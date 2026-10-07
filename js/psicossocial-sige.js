/* ==========================================================================
   S.I.G.E. - ElevaLife
   Ponte entre a tela psicossocial.html e a API do SIGE (V 1.14).

   psicossocial.html foi escrito sobre uma interface de banco "documental"
   (doc/collection, get/set/delete, where/orderBy/limit, onSnapshot). Aqui
   essa interface e implementada sobre /api/psico (equipe, com a sessao do
   SIGE) e as telas publicas do QR code usam /api/psicopub (sem login).
   Ver api/src/functions/psicossocial.js.
   ========================================================================== */

(function () {
  "use strict";

  const BASE = "/api";
  window.ELEVA_PUBLIC_URL = location.origin + "/psicossocial.html";
  window.ELEVA_CNPJ_URL = BASE + "/cnpj/";
  window.ELEVA_LOGIN_URL = "/";

  // V 1.24: toda chamada repete sozinha em falhas transitorias (sem rede, 408, 429, 5xx),
  // com espera crescente. So entram aqui operacoes que podem ser repetidas sem efeito
  // colateral (leituras, gravacoes por caminho fixo e o envio do HSE-IT com token).
  const TRANSITORIO = new Set([0, 408, 425, 429, 500, 502, 503, 504]);
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
  async function req(metodo, url, corpo, opcoes) {
    const tentativas = (opcoes && opcoes.tentativas) || 6;
    let ultimo;
    for (let i = 0; i < tentativas; i++) {
      let r;
      try {
        r = await fetch(BASE + url, {
          method: metodo,
          credentials: "same-origin",
          cache: "no-store",
          headers: corpo ? { "Content-Type": "application/json" } : undefined,
          body: corpo ? JSON.stringify(corpo) : undefined,
        });
      } catch (e) { r = null; }
      const status = r ? r.status : 0;
      const d = r ? await r.json().catch(() => ({})) : {};
      if (r && r.ok) return d;
      ultimo = Object.assign(new Error(d.erro || (status ? "HTTP " + status : "Sem conexão")), { status, body: d, code: d.code || (status === 401 || status === 403 ? "not_granted" : "unavailable") });
      if (!TRANSITORIO.has(status) || i === tentativas - 1) break;
      if (opcoes && opcoes.aoTentar) opcoes.aoTentar(i + 1);
      await esperar(Math.min(8000, 500 * 2 ** i) + Math.floor(Math.random() * 300));
    }
    throw ultimo;
  }

  // ---------------- Login / papel ----------------
  // V 1.25: perfis Administrador / Consultor (equipe) e UsuarioCliente (cliente, acesso restrito)
  window.ELEVA_AUTH = async function () {
    try {
      const eu = await req("GET", "/psico/eu", null, { tentativas: 3 });
      if (eu.semVinculo) return { admin: false, cliente: false, status: 403, semVinculo: true, papel: eu.papel };
      const cliente = eu.papel === "UsuarioCliente";
      return { admin: !cliente, cliente, email: eu.email, papel: eu.papel };
    } catch (e) { return { admin: false, cliente: false, status: e.status || 0, papel: (e.body && e.body.papel) || null }; }
  };
  // Rotas do perfil cliente e utilidades da equipe
  window.ELEVA_CLI = {
    empresas: () => req("GET", "/psico/cli-empresas").then((d) => d.empresas || []),
    dados: (eid) => req("GET", "/psico/cli-dados?e=" + encodeURIComponent(eid)),
    salvarIso: (eid, doc) => req("PUT", "/psico/cli-iso?e=" + encodeURIComponent(eid), doc),
  };
  window.ELEVA_EQUIPE = {
    notificarAcao: (eid, gid, cod, info, forcar) => req("POST", "/psico/notificar-acao", { e: eid, g: gid, c: cod, info, forcar: !!forcar }, { tentativas: 3 }),
    clientesSige: () => req("GET", "/cliente", null, { tentativas: 3 }).then((d) => (Array.isArray(d) ? d : d.itens || d.docs || [])).catch(() => []),
  };

  // ---------------- Banco da equipe (/api/psico) ----------------
  const cache = new Map();   // colecao -> { t, docs }
  const subs = new Set();
  const avisar = () => subs.forEach((f) => { try { f(); } catch (e) {} });
  const pai = (p) => p.split("/").slice(0, -1).join("/");
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const snap = (id, dados) => ({ id, exists: dados != null, data: () => clone(dados), metadata: { fromCache: false, hasPendingWrites: false } });

  async function listar(colecao) {
    const c = cache.get(colecao);
    if (c && Date.now() - c.t < 10000) return c.docs;
    const docs = []; let t = null;
    do { // paginado (V 1.24): segue "next" ate o fim
      const d = await req("GET", "/psico/col?c=" + encodeURIComponent(colecao) + (t ? "&t=" + encodeURIComponent(t) : ""));
      docs.push(...(d.docs || [])); t = d.next || null;
    } while (t);
    cache.set(colecao, { t: Date.now(), docs });
    return docs;
  }
  function doc(caminho) {
    return {
      id: caminho.split("/").pop(), path: caminho,
      async get() { const d = await req("GET", "/psico/doc?c=" + encodeURIComponent(caminho)); return snap(caminho.split("/").pop(), d.exists ? d.data : null); },
      async set(dados) { await req("PUT", "/psico/doc?c=" + encodeURIComponent(caminho), dados); cache.delete(pai(caminho)); avisar(); },
      async update(dados) { const s = await this.get(); if (!s.exists) throw { code: "invalid_argument" }; await this.set(Object.assign(s.data(), dados)); },
      async delete() { await req("DELETE", "/psico/doc?c=" + encodeURIComponent(caminho)); cache.delete(pai(caminho)); avisar(); },
      async acquire() { return { acquired: true }; },
      collection: (c) => col(caminho + "/" + c),
      onSnapshot(next, erro) { return assinar(() => this.get().then(next), erro); },
    };
  }
  function col(caminho, filtros = [], ordem = null, lim = 0) {
    const run = async () => {
      let docs = (await listar(caminho)).filter((x) => x.data);
      docs = docs.filter((x) => filtros.every(([a, op, v]) => {
        const y = x.data[a];
        return op === "==" ? y === v : op === "!=" ? y !== v : op === ">" ? y > v : op === ">=" ? y >= v : op === "<" ? y < v : op === "<=" ? y <= v : op === "in" ? v.includes(y) : true;
      }));
      if (ordem) docs.sort((a, b) => { const x = a.data[ordem[0]], y = b.data[ordem[0]]; return (x > y ? 1 : x < y ? -1 : 0) * (ordem[1] === "desc" ? -1 : 1); });
      else docs.sort((a, b) => (a.id > b.id ? 1 : -1));
      if (lim) docs = docs.slice(0, lim);
      const out = docs.map((x) => snap(x.id, x.data));
      return { docs: out, size: out.length, empty: !out.length, docChanges: () => [], metadata: { fromCache: false } };
    };
    return {
      path: caminho,
      doc: (id) => doc(caminho + "/" + (id || Math.random().toString(36).slice(2, 12))),
      add: async (d) => { const r = doc(caminho + "/" + Math.random().toString(36).slice(2, 12)); await r.set(d); return r; },
      where: (a, op, v) => col(caminho, [...filtros, [a, op, v]], ordem, lim),
      orderBy: (f, dir) => col(caminho, filtros, [f, dir || "asc"], lim),
      limit: (n) => col(caminho, filtros, ordem, n),
      get: run,
      onSnapshot: (next, erro) => assinar(() => run().then(next), erro),
    };
  }
  function assinar(fn, erro) {
    let vivo = true;
    const tick = () => vivo && fn().catch((e) => erro && erro(e));
    subs.add(tick); tick();
    const iv = setInterval(tick, 30000);
    return () => { vivo = false; subs.delete(tick); clearInterval(iv); };
  }
  // Exclusao de uma empresa inteira no servidor, em lotes (V 1.24)
  async function excluirEmpresa(eid, progresso) {
    let total = 0;
    for (;;) {
      const d = await req("DELETE", "/psico/empresa?e=" + encodeURIComponent(eid));
      total += d.apagados || 0; if (progresso) progresso(total);
      if (!d.restante) break;
    }
    await req("DELETE", "/psico/doc?c=" + encodeURIComponent("empresas/" + eid));
    cache.clear(); avisar();
    return total;
  }
  window.ELEVA_DB = { doc, collection: (c) => col(c), excluirEmpresa };

  // ---------------- API publica (QR code, sem login) ----------------
  const tokens = new Map();
  const chaveT = (eid, k) => "psico-t:" + eid + ":" + k;
  function tokenEnvio(eid, k) {
    const ch = chaveT(eid, k);
    let t = tokens.get(ch);
    try { t = t || localStorage.getItem(ch); } catch (e) {}
    if (!t) {
      const a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a);
      t = Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    tokens.set(ch, t); try { localStorage.setItem(ch, t); } catch (e) {}
    return t;
  }
  function limparToken(eid, k) { const ch = chaveT(eid, k); tokens.delete(ch); try { localStorage.removeItem(ch); } catch (e) {} }
  window.ELEVA_API = {
    resolver: (x) => req("GET", "/psicopub/codigo?c=" + encodeURIComponent(x)).then((d) => d.eid || null).catch(() => null),
    empresaPublica: (eid) => req("GET", "/psicopub/empresa?e=" + encodeURIComponent(eid)).catch(() => null),
    checarMatricula: (eid, k) => req("POST", "/psicopub/matricula", { e: eid, matricula: k }),
    // Envio idempotente (V 1.24): o mesmo token "t" e reaproveitado em toda nova tentativa,
    // inclusive depois de recarregar a pagina, para que nada se perca nem se duplique.
    enviarHSE: (eid, colab, respostas, aoTentar) => req("POST", "/psicopub/resposta", { e: eid, matricula: colab.k, respostas, t: tokenEnvio(eid, colab.k) }, { tentativas: 7, aoTentar })
      .then((d) => { limparToken(eid, colab.k); return d; }),
    isoStatus: (eid) => req("GET", "/psicopub/iso?e=" + encodeURIComponent(eid)).then((d) => d.doc || null),
    enviarISO: (eid, d) => req("POST", "/psicopub/iso", Object.assign({ e: eid }, d)).catch((e) => {
      const doc = e.body && e.body.doc;
      // nova tentativa de um envio que ja tinha sido gravado (a confirmacao se perdeu): trata como sucesso
      if (e.code === "dup" && doc && doc.nome === String(d.nome).slice(0, 120) && JSON.stringify(doc.r) === JSON.stringify(d.r)) return { ok: true };
      throw e.code === "dup" ? { code: "dup", doc } : e;
    }),
  };
})();
