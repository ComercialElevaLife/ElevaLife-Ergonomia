/* ==========================================================================
   S.I.G.E - ElevaLife
   V 1.99 (Alexandre): KPIs operacionais + Inconsistências Sólides (substitui a
   planilha KPIS_ERGONOMIA). Duas sub-abas da Coordenação, só o Administrador
   (coordenador) vê e edita. Dados GLOBAIS no banco:
     - kpiOperacional  : 1 doc por ano/mês  (id "op-<ano>-<mes>")  — grade por cliente
     - kpiInconsistencia: 1 doc por ano     (id "inc-<ano>")       — grade por colaborador
   Gráficos em Chart.js (evolução no ano) + CSS. Importação única da planilha 2026
   pelo botão "Importar 2026" (lê BI.KpiSeed2026 de js/kpi-dados-2026.js).
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // Grupos previstas/realizadas (% calculado) + contadores simples.
  const GRUPOS = [
    { chave: "analises", rotulo: "Análises", prev: "analisesPrev", real: "analisesReal" },
    { chave: "valid", rotulo: "Validações", prev: "validPrev", real: "validReal" },
    { chave: "acoesCli", rotulo: "Ações Cliente", prev: "acoesCliPrev", real: "acoesCliReal" },
    { chave: "acoesEleva", rotulo: "Ações ElevaLife", prev: "acoesElevaPrev", real: "acoesElevaReal" },
  ];
  const CONTADORES = [
    { chave: "juridico", rotulo: "Jurídico" },
    { chave: "pcd", rotulo: "PCD / Restritos / Dem. médicas" },
    { chave: "dds", rotulo: "DDS / Treinamento / Blitz" },
    { chave: "coergo", rotulo: "COERGO" },
    { chave: "outras", rotulo: "Outras demandas" },
  ];
  // V 1.99 (Alexandre): controle de riscos do inventário por cliente, iniciado em
  // outubro/2026. As colunas aparecem em todos os meses (zeradas antes de outubro).
  const RISCOS = [
    { chave: "riscoAltissimo", rotulo: "Altíssimo" },
    { chave: "riscoAlto", rotulo: "Alto" },
    { chave: "riscoModerado", rotulo: "Moderado" },
    { chave: "riscoBaixo", rotulo: "Baixo" },
    { chave: "riscoTrivial", rotulo: "Trivial" },
    { chave: "reducaoRisco", rotulo: "Redução do risco" },
  ];
  const CAMPOS_NUM = GRUPOS.flatMap((grp) => [grp.prev, grp.real]).concat(RISCOS.map((r) => r.chave)).concat(CONTADORES.map((c) => c.chave));

  const DB = () => BI.DB;
  const ehAdmin = () => { const i = DB() && DB().estado && DB().estado.identidade; return !!(i && i.papel === "Administrador"); };
  const n0 = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
  const pct = (real, prev) => (n0(prev) > 0 ? n0(real) / n0(prev) : null);
  const pctTxt = (p) => (p == null ? "—" : Math.round(p * 100) + "%");
  function corPct(p) { if (p == null) return "#8a7a78"; if (p >= 1) return "#1E6B44"; if (p >= 0.8) return "#2E7D5B"; if (p >= 0.5) return "#E8731A"; return "#C62828"; }
  // Faixas de cor das inconsistências (quanto maior, pior).
  function corInc(v) { v = n0(v); if (v <= 0) return "#E8F5E9"; if (v === 1) return "#FFF8E1"; if (v <= 4) return "#FFE0B2"; if (v === 5) return "#FFCCBC"; return "#EF9A9A"; }

  const graficos = {};
  function grafico(id, cfg) {
    if (typeof Chart === "undefined") return;
    const cv = document.getElementById(id); if (!cv) return;
    if (graficos[id]) { try { graficos[id].destroy(); } catch (e) {} }
    try { graficos[id] = new Chart(cv.getContext("2d"), cfg); } catch (e) { console.error("KPI grafico", e); }
  }

  function docsOp() { return (BI.dados && BI.dados.kpiOperacional) || []; }
  function docsInc() { return (BI.dados && BI.dados.kpiInconsistencia) || []; }
  function idOp(ano, mes) { return "op-" + ano + "-" + mes; }
  function idInc(ano) { return "inc-" + ano; }
  function acharOp(ano, mes) { const k = idOp(ano, mes); return docsOp().find((d) => (d._id || d.id) === k); }
  function acharInc(ano) { const k = idInc(ano); return docsInc().find((d) => (d._id || d.id) === k); }
  function anosDisponiveis() {
    const set = new Set();
    docsOp().forEach((d) => { if (d.Ano) set.add(Number(d.Ano)); });
    docsInc().forEach((d) => { if (d.Ano) set.add(Number(d.Ano)); });
    const atual = new Date().getFullYear();
    set.add(atual); set.add(2026);
    return Array.from(set).sort((a, b) => a - b);
  }

  // ------------------------------------------------------------------ estado
  let anoOp = 2026, mesOp = (new Date().getMonth());
  let anoInc = 2026;

  async function recarregar() {
    try { await DB().recarregar(["kpiOperacional", "kpiInconsistencia"]); } catch (e) { console.error(e); }
  }

  // ================================================================= KPIs operacionais
  function linhasDoMes(ano, mes) {
    const doc = acharOp(ano, mes);
    if (doc && Array.isArray(doc.Linhas)) return doc.Linhas.map((l) => Object.assign({}, l));
    // sem doc do mês: herda a lista de clientes do mês anterior (ou do último mês com dados do ano), zerada.
    for (let m = mes - 1; m >= 0; m--) { const d = acharOp(ano, m); if (d && d.Linhas && d.Linhas.length) return d.Linhas.map((l) => ({ Cliente: l.Cliente, Gestor: l.Gestor })); }
    for (let m = 11; m >= 0; m--) { const d = acharOp(ano, m); if (d && d.Linhas && d.Linhas.length) return d.Linhas.map((l) => ({ Cliente: l.Cliente, Gestor: l.Gestor })); }
    return [];
  }

  function renderOperacional(area) {
    area.innerHTML = "";
    if (!ehAdmin()) { area.appendChild(cartaoVazio("KPIs operacionais", "Área restrita ao coordenador (Administrador).")); return; }
    const st = { ano: anoOp, mes: mesOp, linhas: linhasDoMes(anoOp, mesOp) };

    const box = h("div", "cartao col-12");
    const cab = h("div", "cadastro-cabecalho");
    cab.appendChild(h("div", "cartao-titulo", "KPIs operacionais"));
    const ctrls = h("div", "kpi-ctrls");
    // ano
    const selA = h("select"); anosDisponiveis().forEach((a) => { const o = h("option", null, String(a)); o.value = a; selA.appendChild(o); });
    selA.value = st.ano; selA.addEventListener("change", () => { anoOp = Number(selA.value); mesOp = st.mes; renderOperacional(area); });
    const selM = h("select"); MESES.forEach((m, i) => { const o = h("option", null, m); o.value = i; selM.appendChild(o); });
    selM.value = st.mes; selM.addEventListener("change", () => { mesOp = Number(selM.value); anoOp = st.ano; renderOperacional(area); });
    ctrls.appendChild(rotuloCampo("Ano", selA)); ctrls.appendChild(rotuloCampo("Mês", selM));
    cab.appendChild(ctrls);
    box.appendChild(cab);
    box.appendChild(h("p", "aet-nota", "Grade operacional por cliente (previstas × realizadas). O % e os totais são calculados automaticamente. Edite e clique em Salvar."));

    // cartões de % do mês (totais)
    const cards = h("div", "coord-kpis"); box.appendChild(cards);

    // grade editável
    const wrap = h("div", "tabela-scroll"); const tb = h("table", "tabela-dados kpi-grade");
    const thead = h("thead");
    const tr1 = h("tr");
    const thCli = h("th", null, "Cliente"); thCli.rowSpan = 2; tr1.appendChild(thCli);
    const thGes = h("th", null, "Gestor"); thGes.rowSpan = 2; tr1.appendChild(thGes);
    GRUPOS.forEach((grp) => { const th = h("th", null, grp.rotulo); th.colSpan = 3; th.style.textAlign = "center"; tr1.appendChild(th); });
    const thR = h("th", null, "Riscos (inventário)"); thR.colSpan = RISCOS.length; thR.style.textAlign = "center"; tr1.appendChild(thR);
    CONTADORES.forEach((c) => { const th = h("th", null, c.rotulo); th.rowSpan = 2; tr1.appendChild(th); });
    const thObs = h("th", null, "Obs. outras demandas"); thObs.rowSpan = 2; tr1.appendChild(thObs);
    const thAcao = h("th", null, ""); thAcao.rowSpan = 2; tr1.appendChild(thAcao);
    const tr2 = h("tr");
    GRUPOS.forEach(() => { ["Prev.", "Real.", "%"].forEach((x) => tr2.appendChild(h("th", null, x))); });
    RISCOS.forEach((r) => tr2.appendChild(h("th", null, r.rotulo)));
    thead.appendChild(tr1); thead.appendChild(tr2); tb.appendChild(thead);
    const tbody = h("tbody"); tb.appendChild(tbody);

    const refsPct = []; // por linha: {grp.chave: span}
    const refTotais = {}; // celulas do total
    function inputNum(l, campo) {
      const inp = h("input"); inp.type = "number"; inp.min = "0"; inp.step = "1"; inp.value = l[campo] != null ? l[campo] : 0;
      inp.className = "kpi-inp";
      inp.addEventListener("input", () => { l[campo] = inp.value === "" ? 0 : Number(inp.value); recomputar(); });
      return inp;
    }
    function montarLinha(l) {
      const tr = h("tr");
      const tdC = h("td"); const inC = h("input"); inC.type = "text"; inC.value = l.Cliente || ""; inC.className = "kpi-inp kpi-inp-txt"; inC.addEventListener("input", () => { l.Cliente = inC.value; }); tdC.appendChild(inC); tr.appendChild(tdC);
      const tdG = h("td"); const inG = h("input"); inG.type = "text"; inG.value = l.Gestor || ""; inG.className = "kpi-inp kpi-inp-txt"; inG.addEventListener("input", () => { l.Gestor = inG.value; }); tdG.appendChild(inG); tr.appendChild(tdG);
      const refs = {};
      GRUPOS.forEach((grp) => {
        const tdP = h("td"); tdP.appendChild(inputNum(l, grp.prev)); tr.appendChild(tdP);
        const tdR = h("td"); tdR.appendChild(inputNum(l, grp.real)); tr.appendChild(tdR);
        const tdPct = h("td"); const sp = h("span", "kpi-pct"); tdPct.appendChild(sp); tr.appendChild(tdPct); refs[grp.chave] = sp;
      });
      RISCOS.forEach((r) => { const td = h("td"); td.appendChild(inputNum(l, r.chave)); tr.appendChild(td); });
      CONTADORES.forEach((c) => { const td = h("td"); td.appendChild(inputNum(l, c.chave)); tr.appendChild(td); });
      const tdO = h("td"); const inO = h("input"); inO.type = "text"; inO.value = l.outrasObs || ""; inO.className = "kpi-inp kpi-inp-obs"; inO.placeholder = "descreva a demanda"; inO.addEventListener("input", () => { l.outrasObs = inO.value; }); tdO.appendChild(inO); tr.appendChild(tdO);
      const tdA = h("td"); const bx = h("button", "btn-excluir", "×"); bx.type = "button"; bx.title = "Remover cliente"; bx.addEventListener("click", () => { const i = st.linhas.indexOf(l); if (i >= 0) { st.linhas.splice(i, 1); redesenhar(); } }); tdA.appendChild(bx); tr.appendChild(tdA);
      refsPct.push({ l, refs });
      return tr;
    }
    function redesenhar() { tbody.innerHTML = ""; refsPct.length = 0; st.linhas.forEach((l) => tbody.appendChild(montarLinha(l))); montarTotal(); recomputar(); }
    let trTotal = null;
    function montarTotal() {
      if (trTotal) trTotal.remove();
      trTotal = h("tr", "kpi-total");
      const tdT = h("td", null, "TOTAL"); tdT.style.fontWeight = "700"; trTotal.appendChild(tdT); trTotal.appendChild(h("td"));
      GRUPOS.forEach((grp) => { const p = h("td", null, "0"); const r = h("td", null, "0"); const pc = h("td"); const sp = h("span", "kpi-pct"); pc.appendChild(sp); trTotal.appendChild(p); trTotal.appendChild(r); trTotal.appendChild(pc); refTotais[grp.chave] = { p, r, pc: sp }; });
      RISCOS.forEach((r) => { const td = h("td", null, "0"); td.style.fontWeight = "700"; trTotal.appendChild(td); refTotais[r.chave] = td; });
      CONTADORES.forEach((c) => { const td = h("td", null, "0"); trTotal.appendChild(td); refTotais[c.chave] = td; });
      trTotal.appendChild(h("td")); // obs
      trTotal.appendChild(h("td")); // ação
      tbody.appendChild(trTotal);
    }
    function recomputar() {
      const tot = {}; CAMPOS_NUM.forEach((c) => (tot[c] = 0));
      refsPct.forEach(({ l, refs }) => {
        GRUPOS.forEach((grp) => { const p = pct(l[grp.real], l[grp.prev]); refs[grp.chave].textContent = pctTxt(p); refs[grp.chave].style.color = corPct(p); });
        CAMPOS_NUM.forEach((c) => (tot[c] += n0(l[c])));
      });
      GRUPOS.forEach((grp) => { const t = refTotais[grp.chave]; t.p.textContent = tot[grp.prev]; t.r.textContent = tot[grp.real]; const p = pct(tot[grp.real], tot[grp.prev]); t.pc.textContent = pctTxt(p); t.pc.style.color = corPct(p); });
      RISCOS.forEach((r) => { refTotais[r.chave].textContent = tot[r.chave]; });
      CONTADORES.forEach((c) => { refTotais[c.chave].textContent = tot[c.chave]; });
      // cartões
      cards.innerHTML = "";
      GRUPOS.forEach((grp) => { const p = pct(tot[grp.real], tot[grp.prev]); const d = h("div", "coord-kpi"); const v = h("div", "coord-kpi-valor", pctTxt(p)); v.style.color = corPct(p); d.appendChild(v); d.appendChild(h("div", "coord-kpi-rot", "% " + grp.rotulo + " (" + tot[grp.real] + "/" + tot[grp.prev] + ")")); cards.appendChild(d); });
      const totalRiscos = ["riscoAltissimo", "riscoAlto", "riscoModerado", "riscoBaixo", "riscoTrivial"].reduce((s, k) => s + tot[k], 0);
      if (totalRiscos || tot.reducaoRisco) {
        const dr = h("div", "coord-kpi"); dr.appendChild(h("div", "coord-kpi-valor", String(totalRiscos))); dr.appendChild(h("div", "coord-kpi-rot", "Riscos no inventário (redução: " + tot.reducaoRisco + ")")); cards.appendChild(dr);
      }
      const somaCont = CONTADORES.reduce((s, c) => s + tot[c.chave], 0);
      const dc = h("div", "coord-kpi"); dc.appendChild(h("div", "coord-kpi-valor", String(somaCont))); dc.appendChild(h("div", "coord-kpi-rot", "Demandas (jurídico, PCD, DDS, COERGO, outras)")); cards.appendChild(dc);
    }
    redesenhar();
    wrap.appendChild(tb); box.appendChild(wrap);

    // ações
    const rodape = h("div"); rodape.style.cssText = "margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
    const bAdd = h("button", "btn-cad-secundario", "+ Cliente"); bAdd.type = "button"; bAdd.addEventListener("click", () => { st.linhas.push({ Cliente: "", Gestor: "" }); redesenhar(); });
    const bSalvar = h("button", "btn-cad-primario", "Salvar mês"); bSalvar.type = "button";
    const msg = h("span", "aet-nota"); msg.style.margin = "0";
    bSalvar.addEventListener("click", async () => {
      bSalvar.disabled = true; msg.textContent = "Salvando…"; msg.style.color = "";
      try {
        const limpas = st.linhas.filter((l) => String(l.Cliente || "").trim());
        const doc = { EmpresaId: "GLOBAL", Ano: st.ano, Mes: st.mes, Linhas: limpas.map((l) => { const o = { Cliente: String(l.Cliente).trim(), Gestor: String(l.Gestor || "").trim() }; CAMPOS_NUM.forEach((c) => (o[c] = n0(l[c]))); o.outrasObs = String(l.outrasObs || "").trim(); return o; }) };
        const ex = acharOp(st.ano, st.mes);
        await DB().salvar("kpiOperacional", ex ? (ex._id || ex.id) : idOp(st.ano, st.mes), doc, !ex);
        await recarregar();
        anoOp = st.ano; mesOp = st.mes; renderOperacional(area);
      } catch (e) { msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    rodape.appendChild(bAdd); rodape.appendChild(bSalvar);
    const bImp = botaoImportar(area); if (bImp) rodape.appendChild(bImp);
    rodape.appendChild(msg);
    box.appendChild(rodape);

    area.appendChild(box);

    // gráfico de evolução no ano (totais % por mês) + barras por gestor do mês
    const boxG = h("div", "cartao col-12");
    boxG.appendChild(h("div", "cartao-titulo", "Evolução no ano · " + st.ano));
    const g1 = h("div"); g1.style.cssText = "position:relative;height:300px"; const cv1 = h("canvas"); cv1.id = "kpi-evolucao"; g1.appendChild(cv1); boxG.appendChild(g1);
    boxG.appendChild(h("div", "cartao-titulo", "Realizadas por gestor · " + MESES[st.mes] + "/" + st.ano)); boxG.firstChild.style.marginBottom = "4px";
    const g2 = h("div"); g2.style.cssText = "position:relative;height:300px;margin-top:8px"; const cv2 = h("canvas"); cv2.id = "kpi-por-gestor"; g2.appendChild(cv2); boxG.appendChild(g2);
    boxG.appendChild(h("div", "cartao-titulo", "Distribuição de risco no inventário · " + MESES[st.mes] + "/" + st.ano));
    const g3 = h("div"); g3.style.cssText = "position:relative;height:280px;margin-top:8px"; const cv3 = h("canvas"); cv3.id = "kpi-riscos-mes"; g3.appendChild(cv3); boxG.appendChild(g3);
    area.appendChild(boxG);
    desenharGraficosOp(st.ano, st.mes);
  }

  function desenharGraficosOp(ano, mes) {
    // evolução: % de cada grupo por mês (realizadas/previstas do total do mês)
    const labels = MESES_CURTO.slice();
    const cores = { analises: "#8B3A42", valid: "#2E7D5B", acoesCli: "#E8731A", acoesEleva: "#3A6EA5" };
    const datasets = GRUPOS.map((grp) => ({
      label: grp.rotulo, borderColor: cores[grp.chave], backgroundColor: cores[grp.chave], tension: 0.3, spanGaps: true,
      data: Array.from({ length: 12 }, (_, m) => { const d = acharOp(ano, m); if (!d || !d.Linhas || !d.Linhas.length) return null; let p = 0, r = 0; d.Linhas.forEach((l) => { p += n0(l[grp.prev]); r += n0(l[grp.real]); }); return p > 0 ? Math.round((r / p) * 1000) / 10 : null; }),
    }));
    grafico("kpi-evolucao", { type: "line", data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => v + "%" } } } } });
    // por gestor (realizadas somadas dos 4 grupos) no mês
    const doc = acharOp(ano, mes); const porG = {};
    (doc && doc.Linhas || []).forEach((l) => { const gname = String(l.Gestor || "—").trim() || "—"; porG[gname] = (porG[gname] || 0) + GRUPOS.reduce((s, grp) => s + n0(l[grp.real]), 0); });
    const gl = Object.keys(porG).sort((a, b) => porG[b] - porG[a]);
    grafico("kpi-por-gestor", { type: "bar", data: { labels: gl, datasets: [{ label: "Realizadas (soma dos grupos)", data: gl.map((k) => porG[k]), backgroundColor: "#8B3A42", borderRadius: 4 }] }, options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } } });
    // distribuição de risco do inventário (soma dos clientes) no mês
    const nivs = [["riscoAltissimo", "Altíssimo", "#6A1B2A"], ["riscoAlto", "Alto", "#C62828"], ["riscoModerado", "Moderado", "#E8731A"], ["riscoBaixo", "Baixo", "#F2C200"], ["riscoTrivial", "Trivial", "#2E7D5B"]];
    const somaR = {}; nivs.forEach(([k]) => (somaR[k] = 0));
    (doc && doc.Linhas || []).forEach((l) => nivs.forEach(([k]) => (somaR[k] += n0(l[k]))));
    grafico("kpi-riscos-mes", { type: "bar", data: { labels: nivs.map((x) => x[1]), datasets: [{ label: "Riscos", data: nivs.map((x) => somaR[x[0]]), backgroundColor: nivs.map((x) => x[2]), borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
  }

  // ================================================================= Inconsistências Sólides
  function linhasInc(ano) {
    const doc = acharInc(ano);
    if (doc && Array.isArray(doc.Linhas)) return doc.Linhas.map((l) => ({ Colaborador: l.Colaborador, Coordenador: l.Coordenador, meses: (l.meses || []).slice(0, 12).concat(Array(12).fill(0)).slice(0, 12) }));
    return [];
  }
  function renderInconsistencias(area) {
    area.innerHTML = "";
    if (!ehAdmin()) { area.appendChild(cartaoVazio("Inconsistências Sólides", "Área restrita ao coordenador (Administrador).")); return; }
    const st = { ano: anoInc, linhas: linhasInc(anoInc) };
    const box = h("div", "cartao col-12");
    const cab = h("div", "cadastro-cabecalho");
    cab.appendChild(h("div", "cartao-titulo", "Inconsistências Sólides"));
    const selA = h("select"); anosDisponiveis().forEach((a) => { const o = h("option", null, String(a)); o.value = a; selA.appendChild(o); });
    selA.value = st.ano; selA.addEventListener("change", () => { anoInc = Number(selA.value); renderInconsistencias(area); });
    cab.appendChild(rotuloCampo("Ano", selA));
    box.appendChild(cab);
    box.appendChild(h("p", "aet-nota", "Inconsistências sólides confirmadas por colaborador (aprovações/exclusões de ponto, foto em local inadequado, erros do colaborador, etc.). Uma contagem por mês."));

    const wrap = h("div", "tabela-scroll"); const tb = h("table", "tabela-dados kpi-grade");
    const thead = h("thead"); const trh = h("tr");
    ["Colaborador", "Coordenador"].forEach((c) => trh.appendChild(h("th", null, c)));
    MESES_CURTO.forEach((m) => trh.appendChild(h("th", null, m)));
    trh.appendChild(h("th", null, "Total")); trh.appendChild(h("th", null, ""));
    thead.appendChild(trh); tb.appendChild(thead);
    const tbody = h("tbody"); tb.appendChild(tbody);
    const refsTot = []; const refTotMes = []; let refTotGeral = null;
    function montarLinha(l) {
      const tr = h("tr");
      const tdN = h("td"); const inN = h("input"); inN.type = "text"; inN.value = l.Colaborador || ""; inN.className = "kpi-inp kpi-inp-txt"; inN.addEventListener("input", () => { l.Colaborador = inN.value; }); tdN.appendChild(inN); tr.appendChild(tdN);
      const tdC = h("td"); const inC = h("input"); inC.type = "text"; inC.value = l.Coordenador || ""; inC.className = "kpi-inp kpi-inp-txt"; inC.addEventListener("input", () => { l.Coordenador = inC.value; }); tdC.appendChild(inC); tr.appendChild(tdC);
      for (let m = 0; m < 12; m++) {
        const td = h("td"); const inp = h("input"); inp.type = "number"; inp.min = "0"; inp.step = "1"; inp.value = n0(l.meses[m]); inp.className = "kpi-inp";
        const pintar = () => { td.style.background = corInc(l.meses[m]); };
        inp.addEventListener("input", () => { l.meses[m] = inp.value === "" ? 0 : Number(inp.value); pintar(); recomputar(); });
        pintar(); td.appendChild(inp); tr.appendChild(td);
      }
      const tdT = h("td", null, "0"); tdT.style.fontWeight = "700"; tr.appendChild(tdT);
      const tdA = h("td"); const bx = h("button", "btn-excluir", "×"); bx.type = "button"; bx.addEventListener("click", () => { const i = st.linhas.indexOf(l); if (i >= 0) { st.linhas.splice(i, 1); redesenhar(); } }); tdA.appendChild(bx); tr.appendChild(tdA);
      refsTot.push({ l, tdT });
      return tr;
    }
    let trTotal = null;
    function montarTotal() {
      if (trTotal) trTotal.remove();
      trTotal = h("tr", "kpi-total");
      const t0 = h("td", null, "TOTAL"); t0.style.fontWeight = "700"; trTotal.appendChild(t0); trTotal.appendChild(h("td"));
      refTotMes.length = 0;
      for (let m = 0; m < 12; m++) { const td = h("td", null, "0"); td.style.fontWeight = "700"; trTotal.appendChild(td); refTotMes.push(td); }
      const tg = h("td", null, "0"); tg.style.fontWeight = "700"; trTotal.appendChild(tg); refTotGeral = tg; trTotal.appendChild(h("td"));
      tbody.appendChild(trTotal);
    }
    function recomputar() {
      const totMes = Array(12).fill(0); let geral = 0;
      refsTot.forEach(({ l, tdT }) => { let s = 0; for (let m = 0; m < 12; m++) { s += n0(l.meses[m]); totMes[m] += n0(l.meses[m]); } tdT.textContent = s; geral += s; });
      for (let m = 0; m < 12; m++) refTotMes[m].textContent = totMes[m];
      if (refTotGeral) refTotGeral.textContent = geral;
      desenharGraficosInc(totMes);
    }
    function redesenhar() { tbody.innerHTML = ""; refsTot.length = 0; st.linhas.forEach((l) => tbody.appendChild(montarLinha(l))); montarTotal(); recomputar(); }
    redesenhar();
    wrap.appendChild(tb); box.appendChild(wrap);

    // legenda
    const leg = h("div"); leg.style.cssText = "display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:12.5px";
    [["0", 0], ["1", 1], ["2 a 4", 3], ["5", 5], ["≥ 6", 6]].forEach(([r, v]) => { const d = h("span"); d.style.cssText = "display:inline-flex;align-items:center;gap:6px"; const sw = h("span"); sw.style.cssText = `width:14px;height:14px;border-radius:3px;display:inline-block;background:${corInc(v)};border:1px solid #d8c9c4`; d.appendChild(sw); d.appendChild(h("span", null, r + " inconsistência(s)")); leg.appendChild(d); });
    box.appendChild(leg);

    const rodape = h("div"); rodape.style.cssText = "margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
    const bAdd = h("button", "btn-cad-secundario", "+ Colaborador"); bAdd.type = "button"; bAdd.addEventListener("click", () => { st.linhas.push({ Colaborador: "", Coordenador: "", meses: Array(12).fill(0) }); redesenhar(); });
    const bSalvar = h("button", "btn-cad-primario", "Salvar ano"); bSalvar.type = "button";
    const msg = h("span", "aet-nota"); msg.style.margin = "0";
    bSalvar.addEventListener("click", async () => {
      bSalvar.disabled = true; msg.textContent = "Salvando…"; msg.style.color = "";
      try {
        const limpas = st.linhas.filter((l) => String(l.Colaborador || "").trim());
        const doc = { EmpresaId: "GLOBAL", Ano: st.ano, Linhas: limpas.map((l) => ({ Colaborador: String(l.Colaborador).trim(), Coordenador: String(l.Coordenador || "").trim(), meses: l.meses.map(n0) })) };
        const ex = acharInc(st.ano);
        await DB().salvar("kpiInconsistencia", ex ? (ex._id || ex.id) : idInc(st.ano), doc, !ex);
        await recarregar(); anoInc = st.ano; renderInconsistencias(area);
      } catch (e) { msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    rodape.appendChild(bAdd); rodape.appendChild(bSalvar);
    const bImp = botaoImportar(area); if (bImp) rodape.appendChild(bImp);
    rodape.appendChild(msg);
    box.appendChild(rodape);
    area.appendChild(box);

    const boxG = h("div", "cartao col-12");
    boxG.appendChild(h("div", "cartao-titulo", "Inconsistências por mês · " + st.ano));
    const g1 = h("div"); g1.style.cssText = "position:relative;height:280px"; const cv1 = h("canvas"); cv1.id = "inc-mes"; g1.appendChild(cv1); boxG.appendChild(g1);
    boxG.appendChild(h("div", "cartao-titulo", "Por colaborador (total no ano) · " + st.ano));
    const g2 = h("div"); g2.style.cssText = "position:relative;height:420px;margin-top:8px"; const cv2 = h("canvas"); cv2.id = "inc-colab"; g2.appendChild(cv2); boxG.appendChild(g2);
    area.appendChild(boxG);
    // barras por colaborador
    const porColab = st.linhas.map((l) => ({ nome: l.Colaborador || "—", total: l.meses.reduce((s, v) => s + n0(v), 0) })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
    grafico("inc-colab", { type: "bar", data: { labels: porColab.map((x) => x.nome), datasets: [{ label: "Inconsistências no ano", data: porColab.map((x) => x.total), backgroundColor: "#C0392B", borderRadius: 4 }] }, options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } } });
  }
  function desenharGraficosInc(totMes) {
    grafico("inc-mes", { type: "line", data: { labels: MESES_CURTO.slice(), datasets: [{ label: "Inconsistências", data: totMes.map((v) => v), borderColor: "#C0392B", backgroundColor: "#C0392B", tension: 0.3, fill: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
  }

  // ------------------------------------------------------------------ importação 2026
  function jaImportado() { return !!acharOp(2026, 0) || !!acharInc(2026); }
  function botaoImportar(area) {
    if (!BI.KpiSeed2026 || jaImportado()) return null;
    const b = h("button", "btn-cad-secundario", "⬇ Importar 2026 (planilha)"); b.type = "button";
    b.title = "Importa uma vez os KPIs e inconsistências de 2026 da planilha original.";
    b.addEventListener("click", () => importar2026(b, area));
    return b;
  }
  async function importar2026(botao, area) {
    const seed = BI.KpiSeed2026; if (!seed) return;
    if (!window.confirm("Importar os KPIs operacionais (12 meses) e as inconsistências de 2026 da planilha? Isso cria/atualiza os dados de 2026 no sistema.")) return;
    if (botao) { botao.disabled = true; botao.textContent = "Importando…"; }
    try {
      for (let m = 1; m <= 12; m++) {
        const mes = seed.operacional[m] || seed.operacional[String(m)]; if (!mes) continue;
        const linhas = (mes.linhas || []).map((l) => { const o = { Cliente: l.Cliente, Gestor: l.Gestor }; CAMPOS_NUM.forEach((c) => (o[c] = n0(l[c]))); return o; });
        const mi = m - 1; const ex = acharOp(2026, mi);
        await DB().salvar("kpiOperacional", ex ? (ex._id || ex.id) : idOp(2026, mi), { EmpresaId: "GLOBAL", Ano: 2026, Mes: mi, Linhas: linhas }, !ex);
      }
      const inc = (seed.inconsistencias || []).map((l) => ({ Colaborador: l.Colaborador, Coordenador: l.Coordenador, meses: (l.meses || []).map(n0) }));
      const exi = acharInc(2026);
      await DB().salvar("kpiInconsistencia", exi ? (exi._id || exi.id) : idInc(2026), { EmpresaId: "GLOBAL", Ano: 2026, Linhas: inc }, !exi);
      await recarregar();
      window.alert("Importação de 2026 concluída.");
      anoOp = 2026; anoInc = 2026; BI.Coordenacao && BI.Coordenacao.render ? BI.Coordenacao.render() : renderOperacional(area);
    } catch (e) { console.error(e); window.alert("Falha na importação: " + (e && e.message ? e.message : e)); if (botao) { botao.disabled = false; botao.textContent = "⬇ Importar 2026 (planilha)"; } }
  }

  // ------------------------------------------------------------------ helpers UI
  function cartaoVazio(tit, txt) { const c = h("div", "cartao col-12"); c.appendChild(h("div", "cartao-titulo", tit)); c.appendChild(h("div", "coord-vazio", txt)); return c; }
  function rotuloCampo(rot, el) { const l = h("label", "kpi-campo"); l.appendChild(h("span", "aet-rot", rot)); l.appendChild(el); return l; }

  BI.KpiOp = { renderOperacional, renderInconsistencias };
})(typeof window !== "undefined" ? window : this);
