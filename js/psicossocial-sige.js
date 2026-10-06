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

  async function req(metodo, url, corpo) {
    const r = await fetch(BASE + url, {
      method: metodo,
      credentials: "same-origin",
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.erro || "HTTP " + r.status), { status: r.status, body: d, code: d.code || (r.status === 401 || r.status === 403 ? "not_granted" : "unavailable") });
    return d;
  }

  // ---------------- Login / papel ----------------
  window.ELEVA_AUTH = async function () {
    try { const eu = await req("GET", "/psico/eu"); return { admin: true, email: eu.email, papel: eu.papel }; }
    catch (e) { return { admin: false }; }
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
    if (c && Date.now() - c.t < 2500) return c.docs;
    const d = await req("GET", "/psico/col?c=" + encodeURIComponent(colecao));
    cache.set(colecao, { t: Date.now(), docs: d.docs });
    return d.docs;
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
  window.ELEVA_DB = { doc, collection: (c) => col(c) };

  // ---------------- API publica (QR code, sem login) ----------------
  window.ELEVA_API = {
    resolver: (x) => req("GET", "/psicopub/codigo?c=" + encodeURIComponent(x)).then((d) => d.eid || null).catch(() => null),
    empresaPublica: (eid) => req("GET", "/psicopub/empresa?e=" + encodeURIComponent(eid)).catch(() => null),
    checarMatricula: (eid, k) => req("POST", "/psicopub/matricula", { e: eid, matricula: k }),
    enviarHSE: (eid, colab, respostas) => req("POST", "/psicopub/resposta", { e: eid, matricula: colab.k, respostas }),
    isoStatus: (eid) => req("GET", "/psicopub/iso?e=" + encodeURIComponent(eid)).then((d) => d.doc || null),
    enviarISO: (eid, d) => req("POST", "/psicopub/iso", Object.assign({ e: eid }, d)).catch((e) => { throw e.code === "dup" ? { code: "dup", doc: e.body && e.body.doc } : e; }),
  };
})();
