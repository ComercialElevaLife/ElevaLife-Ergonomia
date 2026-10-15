/* ==========================================================================
   S.I.G.E - ElevaLife · V 1.40
   Aba Coordenacao (so Administrador) - contabilidade de tempo.

   Le a colecao "tempoTrabalho" (gravada por js/tempo.js) e mostra, por login:
     - quanto tempo cada ergonomista levou para cadastrar as entidades
       (empresa, colaboradores, setores, etc.) e nas AEP/AET;
     - o ciclo de vida de cada AEP/AET: do inicio (primeira abertura) ate a
       finalizacao (ultimo salvamento) - relogio de parede - e o tempo ATIVO
       de edicao somado no periodo.

   Cada ergonomista tem (ou tera) o seu proprio login, entao o detalhamento e
   por "Por" (e-mail do login) e por categoria (Cadastro / AEP / AET).
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  // ms -> "1h 05m", "7m 12s", "42s"
  function fmtDur(ms) {
    ms = Math.max(0, Math.round(Number(ms) || 0));
    const s = Math.round(ms / 1000);
    if (s < 60) return s + "s";
    const m = Math.floor(s / 60), rs = s % 60;
    if (m < 60) return m + "m" + (rs ? " " + String(rs).padStart(2, "0") + "s" : "");
    const hh = Math.floor(m / 60), rm = m % 60;
    return hh + "h" + (rm ? " " + String(rm).padStart(2, "0") + "m" : "");
  }
  function fmtData(iso) {
    if (!iso) return "—";
    const d = new Date(iso); if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const ROT_CAT = { Cadastro: "Cadastro", AEP: "AEP", AET: "AET" };
  const ROT_TIPO = {
    cliente: "Empresa (cliente)", unidade: "Unidade", setor: "Setor / GHE", cargo: "Cargo", posto: "Posto de trabalho",
    atividade: "Atividade", colaborador: "Colaborador", ergonomista: "Ergonomista", certificadoCalibracao: "Certificado de calibração",
    diasUteis: "HHT / Dias úteis", mapaRisco: "Mapa de risco", planoAcao: "Plano de ação", absenteismo: "Absenteísmo",
    compativeis: "Restritos / compatíveis", avaliacaoErgonomica: "AEP (inventário)", aet: "AET", modeloLaudo: "Modelo de laudo", laudo: "Laudo",
  };
  const rotTipo = (t) => ROT_TIPO[t] || t || "—";

  // Respeita o filtro global de Cliente (se houver), para o Administrador
  // focar numa empresa. Os demais filtros nao se aplicam a tempo de trabalho.
  function registros() {
    const todos = (BI.dados && BI.dados.tempoTrabalho) || [];
    const f = (BI.filtros && BI.filtros.Cliente) || [];
    if (f.length) return todos.filter((r) => f.indexOf(r.Cliente) !== -1);
    return todos.slice();
  }

  function nomeDe(r) { return r.PorNome || r.Por || "—"; }

  function tabela(colunas, linhas, vazioTxt) {
    const wrap = h("div", "coord-tabela-wrap");
    if (!linhas.length) { wrap.appendChild(h("div", "coord-vazio", vazioTxt || "Sem dados ainda.")); return wrap; }
    const t = h("table", "coord-tabela");
    const thead = h("thead"); const trh = h("tr");
    colunas.forEach((c) => { const th = h("th", c.num ? "num" : null, c.rot); trh.appendChild(th); });
    thead.appendChild(trh); t.appendChild(thead);
    const tb = h("tbody");
    linhas.forEach((ln) => {
      const tr = h("tr");
      colunas.forEach((c) => { const td = h("td", c.num ? "num" : null); const v = c.val(ln); if (v instanceof Node) td.appendChild(v); else td.textContent = v == null ? "" : v; tr.appendChild(td); });
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); return wrap;
  }

  function cartao(titulo, sub, conteudo) {
    const c = h("div", "cartao col-12");
    c.appendChild(h("div", "cartao-titulo", titulo));
    if (sub) c.appendChild(h("div", "coord-sub", sub));
    c.appendChild(conteudo);
    return c;
  }

  function render() {
    const grade = document.getElementById("grade-coordenacao");
    if (!grade) return;
    grade.innerHTML = "";

    const DB = BI.DB;
    if (DB && DB.estado && DB.estado.identidade && DB.estado.identidade.papel !== "Administrador") {
      grade.appendChild(cartao("Coordenação", null, h("div", "coord-vazio", "Área restrita ao Administrador.")));
      return;
    }

    const regs = registros();

    // ---- KPIs
    const totalAtivo = regs.reduce((s, r) => s + (Number(r.AtivoMs) || 0), 0);
    const porLogin = {}; // Por -> agregado
    regs.forEach((r) => {
      const k = r.Por || "—";
      const a = porLogin[k] || (porLogin[k] = { Por: k, nome: nomeDe(r), ativo: 0, nCad: 0, nAEP: new Set(), nAET: new Set(), ativoCad: 0, ativoAEP: 0, ativoAET: 0 });
      a.nome = nomeDe(r);
      const ms = Number(r.AtivoMs) || 0; a.ativo += ms;
      if (r.Categoria === "AEP") { a.ativoAEP += ms; if (r.RefId) a.nAEP.add(r.RefId); }
      else if (r.Categoria === "AET") { a.ativoAET += ms; if (r.RefId) a.nAET.add(r.RefId); }
      else { a.ativoCad += ms; a.nCad += 1; }
    });
    const logins = Object.values(porLogin).sort((x, y) => y.ativo - x.ativo);

    const kpis = h("div", "cartao col-12");
    const kg = h("div", "coord-kpis");
    const kpi = (valor, rot) => { const d = h("div", "coord-kpi"); d.appendChild(h("div", "coord-kpi-valor", valor)); d.appendChild(h("div", "coord-kpi-rot", rot)); return d; };
    kg.appendChild(kpi(String(regs.length), "Sessões de trabalho registradas"));
    kg.appendChild(kpi(String(logins.length), "Logins (ergonomistas)"));
    kg.appendChild(kpi(fmtDur(totalAtivo), "Tempo ativo total"));
    kg.appendChild(kpi(fmtDur(regs.length ? totalAtivo / regs.length : 0), "Tempo ativo médio por sessão"));
    kpis.appendChild(h("div", "cartao-titulo", "Coordenação — contabilidade de tempo"));
    kpis.appendChild(h("div", "coord-sub", "Tempo que cada ergonomista levou para cadastrar e avaliar. “Ativo” conta só enquanto a tela estava em uso; o ciclo de vida das AEP/AET mede do início (primeira abertura) à finalização (último salvamento)." + ((BI.filtros && BI.filtros.Cliente && BI.filtros.Cliente.length) ? " Filtrado por: " + BI.filtros.Cliente.join(", ") + "." : "")));
    kpis.appendChild(kg);
    grade.appendChild(kpis);

    // ---- Por login
    grade.appendChild(cartao("Por login", "Tempo ativo e volume de trabalho de cada ergonomista.", tabela([
      { rot: "Ergonomista", val: (l) => l.nome },
      { rot: "Login", val: (l) => l.Por },
      { rot: "Cadastros", num: true, val: (l) => String(l.nCad) },
      { rot: "AEPs", num: true, val: (l) => String(l.nAEP.size) },
      { rot: "AETs", num: true, val: (l) => String(l.nAET.size) },
      { rot: "Ativo cadastro", num: true, val: (l) => fmtDur(l.ativoCad) },
      { rot: "Ativo AEP", num: true, val: (l) => fmtDur(l.ativoAEP) },
      { rot: "Ativo AET", num: true, val: (l) => fmtDur(l.ativoAET) },
      { rot: "Ativo total", num: true, val: (l) => fmtDur(l.ativo) },
    ], logins, "Nenhum tempo registrado ainda. Assim que a equipe cadastrar ou avaliar com o sistema, o tempo aparece aqui.")));

    // ---- Por tipo de cadastro
    const porTipo = {};
    regs.filter((r) => r.Categoria === "Cadastro").forEach((r) => {
      const k = r.Tipo || "—"; const a = porTipo[k] || (porTipo[k] = { tipo: k, n: 0, ativo: 0 });
      a.n += 1; a.ativo += Number(r.AtivoMs) || 0;
    });
    const tipos = Object.values(porTipo).sort((x, y) => y.ativo - x.ativo);
    grade.appendChild(cartao("Por tipo de cadastro", "Quanto tempo cada tipo de entidade levou para ser cadastrado.", tabela([
      { rot: "Tipo", val: (t) => rotTipo(t.tipo) },
      { rot: "Qtd.", num: true, val: (t) => String(t.n) },
      { rot: "Ativo total", num: true, val: (t) => fmtDur(t.ativo) },
      { rot: "Ativo médio", num: true, val: (t) => fmtDur(t.n ? t.ativo / t.n : 0) },
    ], tipos, "Nenhum cadastro cronometrado ainda.")));

    // ---- Ciclo de vida AEP / AET (inicio -> finalizacao)
    const ciclos = {}; // Categoria|RefId -> agregado
    regs.filter((r) => (r.Categoria === "AEP" || r.Categoria === "AET") && r.RefId).forEach((r) => {
      const k = r.Categoria + "|" + r.RefId;
      const c = ciclos[k] || (ciclos[k] = { cat: r.Categoria, refId: r.RefId, nome: "", ab: null, sv: null, ativo: 0, nSess: 0, logins: new Set(), cliente: r.Cliente || "" });
      if (r.RefNome) c.nome = r.RefNome;
      if (!c.cliente && r.Cliente) c.cliente = r.Cliente;
      if (r.AberturaEm && (!c.ab || r.AberturaEm < c.ab)) c.ab = r.AberturaEm;
      if (r.SalvoEm && (!c.sv || r.SalvoEm > c.sv)) c.sv = r.SalvoEm;
      c.ativo += Number(r.AtivoMs) || 0; c.nSess += 1;
      if (r.Por) c.logins.add(r.PorNome || r.Por);
    });
    const listaCiclos = Object.values(ciclos).map((c) => {
      const wall = (c.ab && c.sv) ? (new Date(c.sv).getTime() - new Date(c.ab).getTime()) : 0;
      return Object.assign(c, { wall: Math.max(0, wall) });
    }).sort((x, y) => (y.sv || "").localeCompare(x.sv || ""));

    grade.appendChild(cartao("Ciclo de vida das AEP / AET", "Do início (primeira abertura) à finalização (último salvamento), com o tempo ativo somado.", tabela([
      { rot: "Tipo", val: (c) => ROT_CAT[c.cat] || c.cat },
      { rot: "Posto / referência", val: (c) => c.nome || c.refId },
      { rot: "Empresa", val: (c) => c.cliente || "—" },
      { rot: "Quem", val: (c) => Array.from(c.logins).join(", ") || "—" },
      { rot: "Início", val: (c) => fmtData(c.ab) },
      { rot: "Finalização", val: (c) => fmtData(c.sv) },
      { rot: "Duração total", num: true, val: (c) => fmtDur(c.wall) },
      { rot: "Tempo ativo", num: true, val: (c) => fmtDur(c.ativo) },
      { rot: "Sessões", num: true, val: (c) => String(c.nSess) },
    ], listaCiclos, "Nenhuma AEP/AET cronometrada ainda.")));
  }

  BI.Coordenacao = { render };
})(window);
