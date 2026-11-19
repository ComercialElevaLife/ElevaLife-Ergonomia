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

  // Grupos previstas/realizadas (% calculado). Meta = linha de referência nos gráficos.
  const GRUPOS = [
    { chave: "analises", rotulo: "Análises", prev: "analisesPrev", real: "analisesReal", meta: 0.95 },
    { chave: "valid", rotulo: "Validações", prev: "validPrev", real: "validReal", meta: 0.95 },
    { chave: "acoesCli", rotulo: "Ações Cliente", prev: "acoesCliPrev", real: "acoesCliReal", meta: 0.75 },
  ];
  // V 1.99 (Alexandre): Ações ElevaLife — "realizadas" = soma dos contadores abaixo
  // (Jurídico + PCD + DDS + COERGO + Outras demandas). Por isso ficam lado a lado.
  const ELEVA = { chave: "acoesEleva", rotulo: "Ações ElevaLife", prev: "acoesElevaPrev", real: "acoesElevaReal", meta: 0.95 };
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
  const CAMPOS_NUM = GRUPOS.flatMap((grp) => [grp.prev, grp.real]).concat([ELEVA.prev]).concat(RISCOS.map((r) => r.chave)).concat(CONTADORES.map((c) => c.chave)).concat(["casesReportados"]);
  // "Realizadas" de Ações ElevaLife = soma dos contadores.
  const elevaReal = (l) => CONTADORES.reduce((s, c) => s + n0(l[c.chave]), 0);

  const DB = () => BI.DB;
  const ehAdmin = () => { const i = DB() && DB().estado && DB().estado.identidade; return !!(i && i.papel === "Administrador"); };
  const n0 = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
  const pct = (real, prev) => (n0(prev) > 0 ? n0(real) / n0(prev) : null);
  const pctTxt = (p) => (p == null ? "—" : Math.round(p * 100) + "%");
  function corPct(p) { if (p == null) return "#8a7a78"; if (p >= 1) return "#1E6B44"; if (p >= 0.8) return "#2E7D5B"; if (p >= 0.5) return "#E8731A"; return "#C62828"; }
  // V 1.99: "NA" = colaborador fora do time naquele mês (célula preta na planilha).
  const isNA = (v) => { const s = String(v == null ? "" : v).trim().toUpperCase(); return s === "NA" || s === "N/A"; };
  function parseMes(txt) { const t = String(txt == null ? "" : txt).trim().toUpperCase(); if (t === "NA" || t === "N/A" || t === "-") return "NA"; if (t === "") return 0; const n = Number(t); return isFinite(n) ? n : 0; }
  // Faixas de cor das inconsistências (quanto maior, pior). NA = célula escura.
  function corInc(v) { if (isNA(v)) return "#3a3a3a"; v = n0(v); if (v <= 0) return "#E8F5E9"; if (v === 1) return "#FFF8E1"; if (v <= 4) return "#FFE0B2"; if (v === 5) return "#FFCCBC"; return "#EF9A9A"; }

  const graficos = {};
  function grafico(id, cfg) {
    if (typeof Chart === "undefined") return;
    const cv = document.getElementById(id); if (!cv) return;
    if (graficos[id]) { try { graficos[id].destroy(); } catch (e) {} }
    try {
      graficos[id] = new Chart(cv.getContext("2d"), cfg);
      // V 2.00: redimensiona no quadro seguinte (evita gráfico em branco quando o
      // canvas é medido antes de o painel assentar o layout).
      requestAnimationFrame(() => { try { graficos[id] && graficos[id].resize(); } catch (e) {} });
    } catch (e) { console.error("KPI grafico", e); }
  }

  function docsOp() { return (BI.dados && BI.dados.kpiOperacional) || []; }
  function docsInc() { return (BI.dados && BI.dados.kpiInconsistencia) || []; }
  function idOp(ano, mes) { return "op-" + ano + "-" + mes; }
  function idInc(ano) { return "inc-" + ano; }
  function acharOp(ano, mes) { const k = idOp(ano, mes); return docsOp().find((d) => (d._id || d.id) === k); }
  function acharInc(ano) { const k = idInc(ano); return docsInc().find((d) => (d._id || d.id) === k); }
  const anosExtra = new Set(); // anos adicionados na sessão pelo botão "+ Ano"
  function anosDisponiveis() {
    const set = new Set();
    docsOp().forEach((d) => { if (d.Ano) set.add(Number(d.Ano)); });
    docsInc().forEach((d) => { if (d.Ano) set.add(Number(d.Ano)); });
    const atual = new Date().getFullYear();
    set.add(atual); set.add(2026);
    anosExtra.forEach((a) => set.add(a));
    return Array.from(set).sort((a, b) => a - b);
  }
  function proximoAno() { const anos = anosDisponiveis(); return Math.max.apply(null, anos) + 1; }

  // ------------------------------------------------------------------ estado
  let anoOp = 2026, mesOp = (new Date().getMonth());
  let indEvol = "analises"; // indicador selecionado no gráfico de evolução
  let anoInc = 2026;
  // V 2.15 (Alexandre): filtro próprio dos gráficos de risco (distribuição + redução) mês a mês.
  let riscoAno = null, riscoMeses = []; // riscoAno null = usa o ano do topo; riscoMeses vazio = todos com dados
  let viewDash = "analises"; // V 2.22: visão escolhida no Dashboard KPI Recorrentes

  async function recarregar() {
    try { await DB().recarregar(["kpiOperacional", "kpiInconsistencia"]); } catch (e) { console.error(e); }
  }

  // ================================================================= KPIs operacionais
  const CAMPOS_RISCO = ["riscoAltissimo", "riscoAlto", "riscoModerado", "riscoBaixo", "riscoTrivial"];
  function mesAnterior(ano, mes) { return mes === 0 ? { ano: ano - 1, mes: 11 } : { ano: ano, mes: mes - 1 }; }
  // V 2.22 (Alexandre): Unidade preenchida num mês vale para os SEGUINTES (nunca para os anteriores).
  // Busca a Unidade de um cliente no mês anterior mais recente que a tenha preenchida.
  function unidadePrioriDe(ano, mes, cliente) {
    const nc = String(cliente == null ? "" : cliente).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (!nc) return "";
    let a = ano, m = mes;
    for (let i = 0; i < 24; i++) {
      const pm = mesAnterior(a, m); a = pm.ano; m = pm.mes; const d = acharOp(a, m);
      if (d && Array.isArray(d.Linhas)) {
        const ln = d.Linhas.find((l) => String(l.Cliente || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim() === nc && String(l.Unidade || "").trim());
        if (ln) return ln.Unidade;
      }
    }
    return "";
  }
  function herdarUnidades(linhas, ano, mes) { linhas.forEach((l) => { if (!String(l.Unidade || "").trim()) { const u = unidadePrioriDe(ano, mes, l.Cliente); if (u) l.Unidade = u; } }); return linhas; }
  function linhasDoMes(ano, mes) {
    const doc = acharOp(ano, mes);
    if (doc && Array.isArray(doc.Linhas)) return herdarUnidades(doc.Linhas.map((l) => Object.assign({}, l)), ano, mes);
    // V 1.99: mês ainda sem dados — herda a lista de clientes/gestores E os RISCOS do
    // inventário do mês anterior (os riscos acumulam de mês para mês, atravessando anos;
    // a Redução e os demais KPIs reiniciam zerados). Ex.: outubro → novembro → dezembro → jan/2027.
    let a = ano, m = mes;
    for (let i = 0; i < 24; i++) {
      const pm = mesAnterior(a, m); a = pm.ano; m = pm.mes;
      const d = acharOp(a, m);
      if (d && d.Linhas && d.Linhas.length) {
        return herdarUnidades(d.Linhas.map((l) => { const o = { Cliente: l.Cliente, Unidade: l.Unidade, Gestor: l.Gestor }; CAMPOS_RISCO.forEach((k) => (o[k] = n0(l[k]))); return o; }), ano, mes);
      }
    }
    return [];
  }

  // ================================================================= Abastecimento automático (Etapa 2)
  // O abastecimento começa em novembro/2026 (os meses anteriores ficam com os dados
  // já preenchidos/importados). Os registros do SIGE são casados com a linha do KPI
  // pelo nome do cliente (KpiCliente, senão o próprio Cliente), comparado sem acento/
  // maiúsculas. Os valores entram de forma ADITIVA e idempotente: cada métrica guarda
  // quanto veio do SIGE (_auto_<campo>), então re-“puxar” nunca duplica e a parte
  // digitada à mão (ou importada) é sempre preservada.
  const ANO_INICIO_AUTO = 2026, MES_INICIO_AUTO = 10; // novembro/2026 (mês 0-indexado)
  function autoAtivo(ano, mes) { return ano > ANO_INICIO_AUTO || (ano === ANO_INICIO_AUTO && mes >= MES_INICIO_AUTO); }
  // Métricas abastecidas automaticamente e o campo da grade que recebem.
  const AUTO_METRICAS = [
    { campo: "analisesReal", tipo: "analises" },
    { campo: "validReal", tipo: "valid" },
    { campo: "acoesCliReal", tipo: "acoesCli" },
    { campo: "acoesCliPrev", tipo: "acoesCliPrev" }, // V 2.12: Previsto de Ações Cliente vem do vencimento no Plano de Ação
    { campo: "pcd", tipo: "pcd" },
    { campo: "outras", tipo: "outras" },
    // V 2.16: previstos vindos dos Cronogramas (meta mensal por cliente+unidade) + blitz real → DDS.
    { campo: "analisesPrev", tipo: "cronAnalisesPrev" },
    { campo: "validPrev", tipo: "cronValidPrev" },
    { campo: ELEVA.prev, tipo: "cronBlitzPrev" },
    { campo: "dds", tipo: "cronBlitzReal" },
    // V 2.17: cases aprovados no mês → coluna "Cases reportados" (por cliente+unidade).
    { campo: "casesReportados", tipo: "casesRep" },
  ];
  const OBS_ABSENTEISMO = "lançamento de absenteísmos";
  function normNome(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function mesDe(v) { return String(v == null ? "" : v).slice(0, 7); }
  function acaoConcluida(a) { if (BI.Acoes && BI.Acoes.estaConcluida) return BI.Acoes.estaConcluida(a); return !!(a && (a["Dt Conclusao"] || a["Status Execucao"] === "Concluida")); }
  // Cliente usado no casamento com a linha do KPI: se o registro TEM o campo KpiCliente
  // (definido na confirmação ao finalizar), usa-o — mesmo vazio (vazio = não abastece).
  // Registros antigos, sem esse campo, continuam casando pelo próprio Cliente.
  // V 2.12 (Alexandre): o vínculo passou a ser por LINHA do KPI (cliente + unidade),
  // definido na própria planilha — não mais perguntado ao ergonomista ao finalizar.
  // Chave de casamento = cliente + unidade (normalizados). Sem unidade não casa.
  const chaveCliUni = (cli, uni) => { const c = normNome(cli), u = normNome(uni); return (c && u) ? (c + "||" + u) : ""; };

  // Clientes e unidades do cadastro (para os seletores da planilha de KPI).
  function clientesCadastro() {
    return ((BI.dados && BI.dados.cliente) || []).map((c) => ({ id: c.id || c._id, nome: c.Cliente })).filter((c) => c.nome)
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }
  function unidadesDoCliente(nomeCliente) {
    const nc = normNome(nomeCliente); if (!nc) return [];
    const cli = clientesCadastro().find((c) => normNome(c.nome) === nc); if (!cli) return [];
    const eidDe = (u) => u.EmpresaId || (BI.DB && BI.DB.idCliente ? BI.DB.idCliente(u) : "");
    return ((BI.dados && BI.dados.unidade) || []).filter((u) => eidDe(u) === cli.id).map((u) => u.Unidade).filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
  }

  // Agrega os registros do SIGE do mês escolhido por cliente+unidade (normalizados).
  function autoKpiDoMes(ano, mes) {
    const alvo = ano + "-" + String(mes + 1).padStart(2, "0");
    const mapa = {};
    const bucket = (r) => { const k = chaveCliUni(r.Cliente, r.Unidade); if (!k) return null; return (mapa[k] = mapa[k] || { analises: 0, valid: 0, acoesCli: 0, acoesCliPrev: 0, pcd: 0, absent: 0 }); };
    const D = (BI.dados) || {};
    // AEP: criação (Data Avaliacao) → Análises; conclusão (Dt Conclusao Avaliacao) → Validações
    (D.avaliacaoErgonomica || []).forEach((a) => {
      if (mesDe(a["Data Avaliacao"]) === alvo) { const b = bucket(a); if (b) b.analises++; }
      if (String(a["Status Avaliacao"] || "") === "Concluída" && mesDe(a["Dt Conclusao Avaliacao"]) === alvo) { const b = bucket(a); if (b) b.valid++; }
    });
    // AET: criação (Data Analise) → Análises; conclusão (Dt Conclusao Avaliacao) → Validações
    (D.aet || []).forEach((a) => {
      if (mesDe(a["Data Analise"]) === alvo) { const b = bucket(a); if (b) b.analises++; }
      if (String(a["Status Avaliacao"] || "") === "Concluída" && mesDe(a["Dt Conclusao Avaliacao"]) === alvo) { const b = bucket(a); if (b) b.valid++; }
    });
    // Plano de Ação: TODA ação concluída no mês (Dt Conclusao) → Ações Cliente
    (D.planoAcao || []).forEach((a) => {
      if (acaoConcluida(a) && mesDe(a["Dt Conclusao"]) === alvo) { const b = bucket(a); if (b) b.acoesCli++; } // Real: ações concluídas no mês
      if (mesDe(a["Dt Programada"]) === alvo) { const b = bucket(a); if (b) b.acoesCliPrev++; } // V 2.12: Previsto = ações com vencimento no mês
    });
    // Restritos (compativeis) iniciados no mês → coluna PCD/Restritos
    (D.compativeis || []).forEach((r) => { if (mesDe(r["Inicio Restricao"]) === alvo) { const b = bucket(r); if (b) b.pcd++; } });
    // Absenteísmo lançado no mês → 1 em Outras demandas (independe da quantidade)
    (D.absenteismo || []).forEach((r) => { if (mesDe(r["Dt Afastamento"]) === alvo) { const b = bucket(r); if (b) b.absent++; } });
    return mapa;
  }

  // Aplica o abastecimento às linhas do mês de forma idempotente (preserva o manual).
  function aplicarAutoNasLinhas(linhas, ano, mes) {
    if (!autoAtivo(ano, mes)) return;
    const mapa = autoKpiDoMes(ano, mes);
    // V 2.16: previsto vindo dos Cronogramas (meta mensal por cliente+unidade) + blitz real → DDS.
    const cron = (BI.Cronogramas && BI.Cronogramas.previstoDoMes) ? BI.Cronogramas.previstoDoMes(ano, mes) : {};
    const cases = (BI.Cases && BI.Cases.reportadosDoMes) ? BI.Cases.reportadosDoMes(ano, mes) : {};
    linhas.forEach((l) => {
      // V 2.12 (Alexandre): só abastece a linha que tem cliente E unidade vinculados.
      // Linha sem vínculo (sem unidade) fica 100% manual.
      const chave = chaveCliUni(l.Cliente, l.Unidade);
      const auto = (chave && mapa[chave]) || { analises: 0, valid: 0, acoesCli: 0, acoesCliPrev: 0, pcd: 0, absent: 0 };
      const cv = (chave && cron[chave]) || { analisesPrev: 0, validPrev: 0, acoesElevaPrev: 0, dds: 0 };
      const novo = { analises: auto.analises, valid: auto.valid, acoesCli: auto.acoesCli, acoesCliPrev: auto.acoesCliPrev, pcd: auto.pcd, outras: auto.absent ? 1 : 0,
        cronAnalisesPrev: cv.analisesPrev, cronValidPrev: cv.validPrev, cronBlitzPrev: cv.acoesElevaPrev, cronBlitzReal: cv.dds,
        casesRep: (chave && cases[chave]) || 0 };
      AUTO_METRICAS.forEach((m) => {
        const chaveAuto = "_auto_" + m.campo;
        const base = n0(l[m.campo]) - n0(l[chaveAuto]); // parte manual/importada
        l[m.campo] = Math.max(0, base) + n0(novo[m.tipo]);
        l[chaveAuto] = n0(novo[m.tipo]);
      });
      // Observação do absenteísmo: garante a nota quando há lançamento; remove quando não há.
      const obs = String(l.outrasObs || "");
      const temNota = obs.toLowerCase().indexOf(OBS_ABSENTEISMO) !== -1;
      if (auto.absent && !temNota) l.outrasObs = (obs ? obs + "; " : "") + OBS_ABSENTEISMO;
      else if (!auto.absent && temNota) l.outrasObs = obs.replace(new RegExp("\\s*;?\\s*" + OBS_ABSENTEISMO, "ig"), "").replace(/^[;\s]+|[;\s]+$/g, "");
    });
  }

  function renderPreenchimento(area) {
    area.innerHTML = "";
    if (!ehAdmin()) { area.appendChild(cartaoVazio("KPIs operacionais", "Área restrita ao coordenador (Administrador).")); return; }
    const st = { ano: anoOp, mes: mesOp, linhas: linhasDoMes(anoOp, mesOp) };
    // V 2.02 (Alexandre): abastecimento automático (Etapa 2) — preenche o Real das linhas
    // com o que foi feito no SIGE no mês (nov/2026+), de forma idempotente e editável.
    aplicarAutoNasLinhas(st.linhas, st.ano, st.mes);

    const box = h("div", "cartao col-12");
    const cab = h("div", "cadastro-cabecalho");
    cab.appendChild(h("div", "cartao-titulo", "Preenchimento KPI recorrentes"));
    const ctrls = h("div", "kpi-ctrls");
    // ano
    const selA = h("select"); anosDisponiveis().forEach((a) => { const o = h("option", null, String(a)); o.value = a; selA.appendChild(o); });
    { const o = h("option", null, "+ Novo ano…"); o.value = "__novo"; selA.appendChild(o); }
    selA.value = st.ano; selA.addEventListener("change", () => { if (selA.value === "__novo") { const na = proximoAno(); anosExtra.add(na); anoOp = na; mesOp = 0; } else { anoOp = Number(selA.value); mesOp = st.mes; } renderPreenchimento(area); });
    const selM = h("select"); MESES.forEach((m, i) => { const o = h("option", null, m); o.value = i; selM.appendChild(o); });
    selM.value = st.mes; selM.addEventListener("change", () => { mesOp = Number(selM.value); anoOp = st.ano; renderPreenchimento(area); });
    ctrls.appendChild(rotuloCampo("Ano", selA)); ctrls.appendChild(rotuloCampo("Mês", selM));
    const bNovoAno = h("button", "btn-cad-secundario", "+ Ano"); bNovoAno.type = "button"; bNovoAno.title = "Começar um novo ano (ex.: 2027). Os riscos do inventário são herdados de dezembro do ano anterior.";
    bNovoAno.addEventListener("click", () => { const na = proximoAno(); anosExtra.add(na); anoOp = na; mesOp = 0; renderPreenchimento(area); });
    ctrls.appendChild(bNovoAno);
    cab.appendChild(ctrls);
    box.appendChild(cab);
    box.appendChild(h("p", "aet-nota", "Grade por cliente. Os riscos do inventário vêm primeiro e são herdados do mês anterior (edite ao mudar). “Ações ElevaLife · Real.” é a soma de Jurídico + PCD + DDS + COERGO + Outras demandas. % e totais são automáticos — edite e clique em Salvar."));
    if (autoAtivo(st.ano, st.mes)) box.appendChild(h("p", "aet-nota", "Abastecimento automático (a partir de nov/2026): cada linha só é abastecida se tiver Cliente E Unidade vinculados — sem vínculo, a linha é 100% manual. Análises vêm das AEP/AET criadas no mês (editar uma já existente não conta de novo) e Validações, das concluídas; Ações Cliente: Previsto = ações com vencimento no mês no Plano de Ação, Real = ações concluídas; PCD/Restritos, dos restritos do mês; e Outras demandas recebe 1 quando houve lançamento de absenteísmo. O valor é somado ao que você digitou (sem duplicar) e continua editável — ajuste e Salve."));

    const cards = h("div", "coord-kpis"); box.appendChild(cards);

    // V 2.12 (Alexandre): datalist compartilhado com os clientes do cadastro + contador de ids.
    let _dlSeq = 0;
    const dlCli = h("datalist"); dlCli.id = "kpi-cli-dl"; clientesCadastro().forEach((c) => { const o = h("option"); o.value = c.nome; dlCli.appendChild(o); }); box.appendChild(dlCli);
    const wrap = h("div", "tabela-scroll"); const tb = h("table", "tabela-dados kpi-grade kpi-grade-fixa");
    const thead = h("thead"); const tr1 = h("tr");
    const thCli = h("th", null, "Cliente"); thCli.rowSpan = 2; tr1.appendChild(thCli);
    const thUni = h("th", null, "Unidade"); thUni.rowSpan = 2; tr1.appendChild(thUni);
    const thGes = h("th", null, "Gestor"); thGes.rowSpan = 2; tr1.appendChild(thGes);
    const thR = h("th", null, "Riscos (inventário)"); thR.colSpan = RISCOS.length; thR.style.textAlign = "center"; tr1.appendChild(thR);
    GRUPOS.forEach((grp) => { const th = h("th", null, grp.rotulo); th.colSpan = 3; th.style.textAlign = "center"; tr1.appendChild(th); });
    CONTADORES.forEach((c) => { const th = h("th", null, c.rotulo); th.rowSpan = 2; tr1.appendChild(th); });
    const thCases = h("th", null, "Cases reportados"); thCases.rowSpan = 2; tr1.appendChild(thCases);
    const thObs = h("th", null, "Obs. outras demandas"); thObs.rowSpan = 2; tr1.appendChild(thObs);
    const thE = h("th", null, ELEVA.rotulo); thE.colSpan = 3; thE.style.textAlign = "center"; tr1.appendChild(thE);
    const thAcao = h("th", null, ""); thAcao.rowSpan = 2; tr1.appendChild(thAcao);
    const tr2 = h("tr");
    RISCOS.forEach((r) => tr2.appendChild(h("th", null, r.rotulo)));
    GRUPOS.forEach(() => { ["Prev.", "Real.", "%"].forEach((x) => tr2.appendChild(h("th", null, x))); });
    ["Prev.", "Real. (soma)", "%"].forEach((x) => tr2.appendChild(h("th", null, x)));
    thead.appendChild(tr1); thead.appendChild(tr2); tb.appendChild(thead);
    const tbody = h("tbody"); tb.appendChild(tbody);

    const refsLin = []; const refTotais = {};
    function inputNum(l, campo) {
      const inp = h("input"); inp.type = "number"; inp.min = "0"; inp.step = "1"; inp.value = l[campo] != null ? l[campo] : 0; inp.className = "kpi-inp";
      inp.addEventListener("input", () => { l[campo] = inp.value === "" ? 0 : Number(inp.value); recomputar(); });
      return inp;
    }
    function montarLinha(l) {
      const tr = h("tr");
      // V 2.12 (Alexandre): Cliente e Unidade são o VÍNCULO que abastece a linha (datalists do cadastro).
      const tdC = h("td"); const inC = h("input"); inC.type = "text"; inC.value = l.Cliente || ""; inC.className = "kpi-inp kpi-inp-txt"; inC.setAttribute("list", "kpi-cli-dl"); inC.placeholder = "cliente"; tdC.appendChild(inC); tr.appendChild(tdC);
      const tdU = h("td"); const inU = h("input"); inU.type = "text"; inU.value = l.Unidade || ""; inU.className = "kpi-inp kpi-inp-txt"; inU.placeholder = "unidade (p/ abastecer)";
      const dlU = h("datalist"); dlU.id = "kpi-uni-dl-" + (_dlSeq++); inU.setAttribute("list", dlU.id);
      const encherUnidades = () => { dlU.innerHTML = ""; unidadesDoCliente(inC.value).forEach((u) => { const o = h("option"); o.value = u; dlU.appendChild(o); }); };
      encherUnidades();
      inC.addEventListener("input", () => { l.Cliente = inC.value; encherUnidades(); });
      inU.addEventListener("input", () => { l.Unidade = inU.value; });
      tdU.appendChild(inU); tdU.appendChild(dlU); tr.appendChild(tdU);
      const tdG = h("td"); const inG = h("input"); inG.type = "text"; inG.value = l.Gestor || ""; inG.className = "kpi-inp kpi-inp-txt"; inG.addEventListener("input", () => { l.Gestor = inG.value; }); tdG.appendChild(inG); tr.appendChild(tdG);
      RISCOS.forEach((r) => { const td = h("td"); td.appendChild(inputNum(l, r.chave)); tr.appendChild(td); });
      const refs = {};
      GRUPOS.forEach((grp) => {
        const tdP = h("td"); tdP.appendChild(inputNum(l, grp.prev)); tr.appendChild(tdP);
        const tdR = h("td"); tdR.appendChild(inputNum(l, grp.real)); tr.appendChild(tdR);
        const tdPct = h("td"); const sp = h("span", "kpi-pct"); tdPct.appendChild(sp); tr.appendChild(tdPct); refs[grp.chave] = sp;
      });
      CONTADORES.forEach((c) => { const td = h("td"); td.appendChild(inputNum(l, c.chave)); tr.appendChild(td); });
      { const td = h("td"); td.appendChild(inputNum(l, "casesReportados")); tr.appendChild(td); } // V 2.17: Cases reportados (abastecido por cases aprovados)
      const tdO = h("td"); const inO = h("input"); inO.type = "text"; inO.value = l.outrasObs || ""; inO.className = "kpi-inp kpi-inp-obs"; inO.placeholder = "descreva a demanda"; inO.addEventListener("input", () => { l.outrasObs = inO.value; }); tdO.appendChild(inO); tr.appendChild(tdO);
      // Ações ElevaLife: Prev. editável, Real. = soma dos contadores (automático), %
      const tdEP = h("td"); tdEP.appendChild(inputNum(l, ELEVA.prev)); tr.appendChild(tdEP);
      const tdER = h("td"); const spR = h("span"); spR.style.fontWeight = "600"; tdER.appendChild(spR); tr.appendChild(tdER);
      const tdEPct = h("td"); const spPct = h("span", "kpi-pct"); tdEPct.appendChild(spPct); tr.appendChild(tdEPct);
      refs.__eleva = { real: spR, pct: spPct };
      const tdA = h("td"); const bx = h("button", "btn-excluir", "×"); bx.type = "button"; bx.title = "Remover cliente"; bx.addEventListener("click", () => { const i = st.linhas.indexOf(l); if (i >= 0) { st.linhas.splice(i, 1); redesenhar(); } }); tdA.appendChild(bx); tr.appendChild(tdA);
      refsLin.push({ l, refs });
      return tr;
    }
    function redesenhar() { tbody.innerHTML = ""; refsLin.length = 0; st.linhas.forEach((l) => tbody.appendChild(montarLinha(l))); montarTotal(); recomputar(); }
    let trTotal = null;
    function montarTotal() {
      if (trTotal) trTotal.remove();
      trTotal = h("tr", "kpi-total");
      const tdT = h("td", null, "TOTAL"); tdT.style.fontWeight = "700"; trTotal.appendChild(tdT); trTotal.appendChild(h("td")); trTotal.appendChild(h("td"));
      RISCOS.forEach((r) => { const td = h("td", null, "0"); td.style.fontWeight = "700"; trTotal.appendChild(td); refTotais[r.chave] = td; });
      GRUPOS.forEach((grp) => { const p = h("td", null, "0"); const r = h("td", null, "0"); const pc = h("td"); const sp = h("span", "kpi-pct"); pc.appendChild(sp); trTotal.appendChild(p); trTotal.appendChild(r); trTotal.appendChild(pc); refTotais[grp.chave] = { p, r, pc: sp }; });
      CONTADORES.forEach((c) => { const td = h("td", null, "0"); trTotal.appendChild(td); refTotais[c.chave] = td; });
      { const td = h("td", null, "0"); td.style.fontWeight = "700"; trTotal.appendChild(td); refTotais.casesReportados = td; }
      trTotal.appendChild(h("td")); // obs
      const ep = h("td", null, "0"); ep.style.fontWeight = "700"; const er = h("td", null, "0"); er.style.fontWeight = "700"; const epc = h("td"); const esp = h("span", "kpi-pct"); epc.appendChild(esp); trTotal.appendChild(ep); trTotal.appendChild(er); trTotal.appendChild(epc); refTotais.__eleva = { p: ep, r: er, pc: esp };
      trTotal.appendChild(h("td")); // ação
      tbody.appendChild(trTotal);
    }
    function recomputar() {
      const tot = {}; CAMPOS_NUM.forEach((c) => (tot[c] = 0)); let totElevaReal = 0;
      refsLin.forEach(({ l, refs }) => {
        GRUPOS.forEach((grp) => { const p = pct(l[grp.real], l[grp.prev]); refs[grp.chave].textContent = pctTxt(p); refs[grp.chave].style.color = corPct(p); });
        const er = elevaReal(l); const ep = pct(er, l[ELEVA.prev]); refs.__eleva.real.textContent = er; refs.__eleva.pct.textContent = pctTxt(ep); refs.__eleva.pct.style.color = corPct(ep);
        CAMPOS_NUM.forEach((c) => (tot[c] += n0(l[c]))); totElevaReal += er;
      });
      RISCOS.forEach((r) => { refTotais[r.chave].textContent = tot[r.chave]; });
      GRUPOS.forEach((grp) => { const t = refTotais[grp.chave]; t.p.textContent = tot[grp.prev]; t.r.textContent = tot[grp.real]; const p = pct(tot[grp.real], tot[grp.prev]); t.pc.textContent = pctTxt(p); t.pc.style.color = corPct(p); });
      CONTADORES.forEach((c) => { refTotais[c.chave].textContent = tot[c.chave]; });
      if (refTotais.casesReportados) refTotais.casesReportados.textContent = tot.casesReportados;
      { const t = refTotais.__eleva; t.p.textContent = tot[ELEVA.prev]; t.r.textContent = totElevaReal; const p = pct(totElevaReal, tot[ELEVA.prev]); t.pc.textContent = pctTxt(p); t.pc.style.color = corPct(p); }
      // cartões
      cards.innerHTML = "";
      const totalRiscos = CAMPOS_RISCO.reduce((s, k) => s + tot[k], 0);
      const dr = h("div", "coord-kpi"); dr.appendChild(h("div", "coord-kpi-valor", String(totalRiscos))); dr.appendChild(h("div", "coord-kpi-rot", "Riscos no inventário (redução: " + tot.reducaoRisco + ")")); cards.appendChild(dr);
      GRUPOS.forEach((grp) => { const p = pct(tot[grp.real], tot[grp.prev]); const d = h("div", "coord-kpi"); const v = h("div", "coord-kpi-valor", pctTxt(p)); v.style.color = corPct(p); d.appendChild(v); d.appendChild(h("div", "coord-kpi-rot", "% " + grp.rotulo + " (" + tot[grp.real] + "/" + tot[grp.prev] + ")")); cards.appendChild(d); });
      { const p = pct(totElevaReal, tot[ELEVA.prev]); const d = h("div", "coord-kpi"); const v = h("div", "coord-kpi-valor", pctTxt(p)); v.style.color = corPct(p); d.appendChild(v); d.appendChild(h("div", "coord-kpi-rot", "% " + ELEVA.rotulo + " (" + totElevaReal + "/" + tot[ELEVA.prev] + ")")); cards.appendChild(d); }
    }
    redesenhar();
    wrap.appendChild(tb); box.appendChild(wrap);

    const rodape = h("div"); rodape.style.cssText = "margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
    const bAdd = h("button", "btn-cad-secundario", "+ Cliente"); bAdd.type = "button"; bAdd.addEventListener("click", () => { st.linhas.push({ Cliente: "", Unidade: "", Gestor: "" }); redesenhar(); });
    const bSync = h("button", "btn-cad-secundario", "↻ Atualizar do SIGE"); bSync.type = "button"; bSync.title = "Relê os registros do SIGE e reaplica o abastecimento automático neste mês (sem duplicar).";
    bSync.addEventListener("click", async () => { bSync.disabled = true; try { await DB().recarregar(["kpiOperacional", "kpiInconsistencia", "avaliacaoErgonomica", "aet", "planoAcao", "compativeis", "absenteismo", "cronograma"]); } catch (e) { console.error(e); } anoOp = st.ano; mesOp = st.mes; renderPreenchimento(area); if (BI.avisar) BI.avisar("KPIs atualizados com o que foi feito no SIGE."); });
    const bSalvar = h("button", "btn-cad-primario", "Salvar mês"); bSalvar.type = "button";
    const msg = h("span", "aet-nota"); msg.style.margin = "0";
    bSalvar.addEventListener("click", async () => {
      bSalvar.disabled = true; msg.textContent = "Salvando…"; msg.style.color = "";
      try {
        const limpas = st.linhas.filter((l) => String(l.Cliente || "").trim());
        const doc = { EmpresaId: "GLOBAL", Ano: st.ano, Mes: st.mes, Linhas: limpas.map((l) => { const o = { Cliente: String(l.Cliente).trim(), Unidade: String(l.Unidade || "").trim(), Gestor: String(l.Gestor || "").trim() }; CAMPOS_NUM.forEach((c) => (o[c] = n0(l[c]))); o.acoesElevaReal = elevaReal(l); o.outrasObs = String(l.outrasObs || "").trim(); AUTO_METRICAS.forEach((m) => { o["_auto_" + m.campo] = n0(l["_auto_" + m.campo]); }); return o; }) };
        const ex = acharOp(st.ano, st.mes);
        await DB().salvar("kpiOperacional", ex ? (ex._id || ex.id) : idOp(st.ano, st.mes), doc, !ex);
        await recarregar();
        anoOp = st.ano; mesOp = st.mes; renderPreenchimento(area);
      } catch (e) { msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    rodape.appendChild(bAdd); rodape.appendChild(bSync); rodape.appendChild(bSalvar);
    const bImp = botaoImportar(area); if (bImp) rodape.appendChild(bImp);
    rodape.appendChild(msg);
    box.appendChild(rodape);
    area.appendChild(box);
  }

  // meses com doc de KPI no ano; seleção efetiva do dashboard (vazio = todos com dados).
  function mesesComDados(ano) { const a = []; for (let m = 0; m < 12; m++) { const d = acharOp(ano, m); if (d && d.Linhas && d.Linhas.length) a.push(m); } return a; }
  function mesesDash(ano) { if (riscoMeses.length) return riscoMeses.slice().sort((a, b) => a - b); const cd = mesesComDados(ano); return cd.length ? cd : [mesOp]; }
  function aggInd(ano, meses, chave) { let p = 0, r = 0; meses.forEach((m) => { const t = totMesIndicador(ano, m, chave); p += t.prev; r += t.real; }); return { prev: p, real: r, pct: p > 0 ? r / p : null }; }

  // V 2.22 (Alexandre): Dashboard KPI Recorrentes — filtro único (ano + vários meses) no topo e
  // "visões" em chips: 4 indicadores + Riscos ergonômicos + Inconsistências Sólides.
  function renderDashboard(area) {
    area.innerHTML = "";
    if (!ehAdmin()) { area.appendChild(cartaoVazio("Dashboard KPI Recorrentes", "Área restrita ao coordenador (Administrador).")); return; }
    riscoAno = anoOp;
    const meses = mesesDash(anoOp);
    const rotuloMeses = riscoMeses.length ? riscoMeses.slice().sort((a, b) => a - b).map((m) => MESES_CURTO[m]).join(", ") : "todos os meses";

    // ---- filtro único (ano + vários meses) no topo
    const dcab = h("div", "cartao col-12"); const cab2 = h("div", "cadastro-cabecalho");
    cab2.appendChild(h("div", "cartao-titulo", "Dashboard KPI Recorrentes"));
    const frTop = h("div", "kpi-ctrls"); frTop.style.flexWrap = "wrap";
    const selA = h("select"); anosDisponiveis().forEach((a) => { const o = h("option", null, String(a)); o.value = a; if (a === anoOp) o.selected = true; selA.appendChild(o); });
    selA.addEventListener("change", () => { anoOp = Number(selA.value); renderDashboard(area); });
    const selM = h("select"); selM.multiple = true; selM.size = 4; selM.style.minWidth = "160px";
    MESES.forEach((m, i) => { const o = h("option", null, m); o.value = i; if (riscoMeses.indexOf(i) !== -1) o.selected = true; selM.appendChild(o); });
    selM.addEventListener("change", () => { riscoMeses = Array.from(selM.selectedOptions).map((o) => Number(o.value)); renderDashboard(area); });
    const bTodos = h("button", "btn-cad-secundario", "Todos os meses"); bTodos.type = "button"; bTodos.addEventListener("click", () => { riscoMeses = []; renderDashboard(area); });
    frTop.appendChild(rotuloCampo("Ano", selA)); frTop.appendChild(rotuloCampo("Meses (Ctrl/⌘ p/ vários)", selM)); frTop.appendChild(bTodos);
    cab2.appendChild(frTop); dcab.appendChild(cab2);

    // ---- cards (agregados pelos meses selecionados)
    const cards = h("div", "coord-kpis"); dcab.appendChild(cards);
    const kc = (v, r, cor) => { const d = h("div", "coord-kpi"); const vv = h("div", "coord-kpi-valor", v); if (cor) vv.style.color = cor; d.appendChild(vv); d.appendChild(h("div", "coord-kpi-rot", r)); return d; };
    const ultimoMes = meses[meses.length - 1]; const docU = acharOp(anoOp, ultimoMes); const linhasU = (docU && docU.Linhas) || [];
    cards.appendChild(kc(String(new Set(linhasU.map((l) => normNome(l.Cliente)).filter(Boolean)).size), "Clientes"));
    cards.appendChild(kc(String(linhasU.filter((l) => String(l.Cliente || "").trim()).length), "Unidades"));
    [["analises", "Análises"], ["valid", "Validações"], ["acoesCli", "Ações Cliente"], ["acoesEleva", "Ações ElevaLife"]].forEach(([k, rot]) => { const t = aggInd(anoOp, meses, k); cards.appendChild(kc(pctTxt(t.pct), "% " + rot + " (" + t.real + "/" + t.prev + ")", corPct(t.pct))); });
    area.appendChild(dcab);

    // ---- chips de visão + área do gráfico
    const boxV = h("div", "cartao col-12");
    const chips = h("div"); chips.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px";
    const VIEWS = [["analises", "Análises"], ["valid", "Validações"], ["acoesCli", "Ações Cliente"], ["acoesEleva", "Ações ElevaLife"], ["riscos", "Riscos ergonômicos"], ["inconsistencias", "Inconsistências Sólides"]];
    VIEWS.forEach(([k, rot]) => { const b = h("button", "btn-cad-secundario", rot); b.type = "button"; if (k === viewDash) b.classList.add("kpi-chip-ativo"); b.addEventListener("click", () => { viewDash = k; renderDashboard(area); }); chips.appendChild(b); });
    const areaG = h("div");
    boxV.appendChild(chips); boxV.appendChild(areaG); area.appendChild(boxV);

    if (viewDash === "riscos") {
      areaG.appendChild(h("div", "cartao-titulo", "Distribuição de risco no inventário · " + rotuloMeses));
      const g3 = h("div"); g3.style.cssText = "position:relative;height:320px;margin-top:4px"; const cv3 = h("canvas"); cv3.id = "kpi-riscos-mes"; g3.appendChild(cv3); areaG.appendChild(g3);
      areaG.appendChild(h("div", "cartao-titulo", "Redução de riscos por mês"));
      const g4 = h("div"); g4.style.cssText = "position:relative;height:280px;margin-top:4px"; const cv4 = h("canvas"); cv4.id = "kpi-reducao-mes"; g4.appendChild(cv4); areaG.appendChild(g4);
      desenharRiscos();
    } else if (viewDash === "inconsistencias") {
      areaG.appendChild(h("div", "cartao-titulo", "Inconsistências por mês · " + anoOp));
      const g1 = h("div"); g1.style.cssText = "position:relative;height:280px"; const c1 = h("canvas"); c1.id = "inc-mes"; g1.appendChild(c1); areaG.appendChild(g1);
      areaG.appendChild(h("div", "cartao-titulo", "Por colaborador (total no ano) · " + anoOp));
      const g2 = h("div"); g2.style.cssText = "position:relative;margin-top:8px"; const c2 = h("canvas"); c2.id = "inc-colab"; g2.appendChild(c2); areaG.appendChild(g2);
      desenharIncCharts(anoOp);
    } else {
      indEvol = viewDash;
      areaG.appendChild(h("div", "cartao-titulo", "Evolução por indicador · " + anoOp));
      areaG.appendChild(h("p", "aet-nota", "Coluna = % realizado no mês (realizadas/previstas) · linha tracejada = meta (95%, exceto Ações Cliente = 75%)."));
      const resumoEl = h("div", "aet-rot"); resumoEl.style.cssText = "font-weight:700;margin:4px 0 8px"; areaG.appendChild(resumoEl);
      const gE = h("div"); gE.style.cssText = "position:relative;height:340px"; const cvE = h("canvas"); cvE.id = "kpi-combo"; gE.appendChild(cvE); areaG.appendChild(gE);
      if (viewDash === "acoesEleva") {
        areaG.appendChild(h("div", "cartao-titulo", "Composição das Ações ElevaLife · " + rotuloMeses));
        const ge = h("div"); ge.style.cssText = "position:relative;height:340px;margin-top:8px"; const cve = h("canvas"); cve.id = "kpi-eleva-comp"; ge.appendChild(cve); areaG.appendChild(ge);
      }
      desenharEvolucao(anoOp, resumoEl);
      if (viewDash === "acoesEleva") desenharDonutEleva(anoOp, meses);
    }
  }
  // V 2.22: desenha os dois gráficos de Inconsistências (mês + por colaborador) no ano.
  function desenharIncCharts(ano) {
    const linhas = linhasInc(ano);
    const totMes = Array(12).fill(0); linhas.forEach((l) => { for (let m = 0; m < 12; m++) totMes[m] += n0(l.meses[m]); });
    desenharGraficosInc(totMes);
    const porColab = linhas.map((l) => ({ nome: l.Colaborador || "—", total: (l.meses || []).reduce((s, v) => s + n0(v), 0) })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
    const apI = !!(BI.apresentacaoAtiva && BI.apresentacaoAtiva());
    const labels = apI ? porColab.map((_, i) => "Colaborador " + (i + 1)) : porColab.map((x) => x.nome);
    const cv = document.getElementById("inc-colab"); if (cv && cv.parentElement) cv.parentElement.style.height = Math.max(280, porColab.length * 26 + 60) + "px";
    grafico("inc-colab", { type: "bar", data: { labels, datasets: [{ label: "Inconsistências no ano", data: porColab.map((x) => x.total), backgroundColor: "#C0392B", borderRadius: 4 }] }, options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }, y: { ticks: { autoSkip: false, font: { size: 11 } } } } } });
  }

  // Totais do indicador em um mês: { prev, real, pct(0-1 ou null) }.
  function totMesIndicador(ano, m, chave) {
    const d = acharOp(ano, m); if (!d || !d.Linhas || !d.Linhas.length) return { prev: 0, real: 0, pct: null, vazio: true };
    let p = 0, r = 0;
    if (chave === "acoesEleva") { d.Linhas.forEach((l) => { p += n0(l[ELEVA.prev]); r += elevaReal(l); }); }
    else { const grp = GRUPOS.find((gg) => gg.chave === chave); d.Linhas.forEach((l) => { p += n0(l[grp.prev]); r += n0(l[grp.real]); }); }
    return { prev: p, real: r, pct: p > 0 ? r / p : null, vazio: false };
  }
  const defIndicador = (chave) => { if (chave === "acoesEleva") return ELEVA; return GRUPOS.find((g) => g.chave === chave) || GRUPOS[0]; };
  const CORES_IND = { analises: "#8B3A42", valid: "#2E7D5B", acoesCli: "#E8731A", acoesEleva: "#3A6EA5" };
  // Gráfico de evolução (coluna = % do mês, linha = meta), filtrado por indicador,
  // com número (real/prev) e % sempre visíveis em cada mês (datalabels).
  function desenharEvolucao(ano, resumoEl) {
    const chave = indEvol; const def = defIndicador(chave); const meta = def.meta;
    const labels = MESES_CURTO.slice();
    const tm = labels.map((_, m) => totMesIndicador(ano, m, chave));
    const pcts = tm.map((t) => (t.pct == null ? null : Math.round(t.pct * 1000) / 10));
    const cor = CORES_IND[chave] || "#8B3A42";
    if (resumoEl) {
      const tr = tm.reduce((s, t) => s + t.real, 0), tp = tm.reduce((s, t) => s + t.prev, 0);
      const pa = tp > 0 ? Math.round((tr / tp) * 1000) / 10 : null;
      resumoEl.textContent = `${def.rotulo} no ano: ${tr} de ${tp} previstas` + (pa == null ? "" : ` · ${pa}%`) + ` · meta ${Math.round(meta * 100)}%`;
      resumoEl.style.color = pa == null ? "#8a7a78" : corPct(pa / 100);
    }
    grafico("kpi-combo", {
      type: "bar",
      data: { labels, datasets: [
        { type: "bar", label: "% realizado", data: pcts, backgroundColor: cor, borderRadius: 4, order: 2, maxBarThickness: 46 },
        { type: "line", label: "Meta " + Math.round(meta * 100) + "%", data: labels.map(() => Math.round(meta * 100)), borderColor: "#444", borderDash: [6, 4], pointRadius: 0, fill: false, order: 1 },
      ] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          datalabels: {
            display: (ctx) => ctx.dataset.type === "bar" && pcts[ctx.dataIndex] != null,
            anchor: "end", align: "end", clip: false, color: "#5a2a33", font: { size: 10, weight: "600" },
            formatter: (v, ctx) => { const t = tm[ctx.dataIndex]; return [String(t.real) + "/" + String(t.prev), pcts[ctx.dataIndex] + "%"]; },
          },
        },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => v + "%" } } },
      },
    });
  }
  // Donut da composição das Ações ElevaLife — com TODAS as porcentagens (rótulo fora da fatia).
  function desenharDonutEleva(ano, meses) {
    const ms = Array.isArray(meses) ? meses : [meses];
    const comp = CONTADORES.map((c) => ({ rot: c.rotulo, val: ms.reduce((acc, m) => { const doc = acharOp(ano, m); return acc + (doc && doc.Linhas || []).reduce((s, l) => s + n0(l[c.chave]), 0); }, 0) }));
    const coresC = ["#8B3A42", "#E8731A", "#3A6EA5", "#2E7D5B", "#7A5195"];
    const totComp = comp.reduce((s, x) => s + x.val, 0);
    grafico("kpi-eleva-comp", { type: "doughnut", data: { labels: comp.map((x) => x.rot), datasets: [{ data: comp.map((x) => x.val), backgroundColor: coresC }] }, options: { responsive: true, maintainAspectRatio: false, layout: { padding: 24 }, plugins: { legend: { position: "right", labels: { generateLabels: (chart) => { const d = chart.data; return d.labels.map((l, i) => { const v = d.datasets[0].data[i]; const pc = totComp ? Math.round((v / totComp) * 100) : 0; return { text: l + " — " + v + " (" + pc + "%)", fillStyle: d.datasets[0].backgroundColor[i], strokeStyle: d.datasets[0].backgroundColor[i], index: i }; }); } } }, datalabels: { display: (ctx) => n0(ctx.dataset.data[ctx.dataIndex]) > 0, anchor: "end", align: "end", offset: 6, clamp: true, color: "#3a2a2e", backgroundColor: "rgba(255,255,255,.85)", borderRadius: 4, padding: 2, font: { size: 11, weight: "700" }, formatter: (v) => (totComp ? Math.round((v / totComp) * 100) + "%" : "") } } } });
  }
  // Soma dos níveis de risco de um mês (todas as linhas do doc daquele mês).
  function somaRiscosMes(ano, m) { const doc = acharOp(ano, m); const chaves = CAMPOS_RISCO.concat(["reducaoRisco"]); const r = {}; chaves.forEach((k) => (r[k] = 0)); (doc && doc.Linhas || []).forEach((l) => chaves.forEach((k) => (r[k] += n0(l[k])))); r._tem = !!(doc && doc.Linhas && doc.Linhas.length); return r; }
  // Distribuição de risco (mês a mês) + redução por mês, conforme filtro riscoAno/riscoMes.
  function desenharRiscos() {
    const ano = riscoAno; const niveis = [["riscoAltissimo", "Altíssimo", "#6A1B2A"], ["riscoAlto", "Alto", "#C62828"], ["riscoModerado", "Moderado", "#E8731A"], ["riscoBaixo", "Baixo", "#F2C200"], ["riscoTrivial", "Trivial", "#2E7D5B"]];
    let meses;
    if (!riscoMeses.length) { meses = []; for (let m = 0; m < 12; m++) if (somaRiscosMes(ano, m)._tem) meses.push(m); if (!meses.length) meses = [mesOp]; }
    else { meses = riscoMeses.slice().sort((a, b) => a - b); }
    const somas = meses.map((m) => somaRiscosMes(ano, m));
    const labels = meses.map((m) => MESES_CURTO[m] + "/" + String(ano).slice(2));
    grafico("kpi-riscos-mes", { type: "bar", data: { labels, datasets: niveis.map(([k, rot, cor]) => ({ label: rot, data: somas.map((s) => s[k]), backgroundColor: cor, borderRadius: 3 })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { x: { stacked: false }, y: { beginAtZero: true } } } });
    grafico("kpi-reducao-mes", { type: "bar", data: { labels, datasets: [{ label: "Riscos reduzidos", data: somas.map((s) => s.reducaoRisco), backgroundColor: "#1565C0", borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
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
    { const o = h("option", null, "+ Novo ano…"); o.value = "__novo"; selA.appendChild(o); }
    selA.value = st.ano; selA.addEventListener("change", () => { if (selA.value === "__novo") { const na = proximoAno(); anosExtra.add(na); anoInc = na; } else { anoInc = Number(selA.value); } renderInconsistencias(area); });
    const ctrlsI = h("div", "kpi-ctrls"); ctrlsI.appendChild(rotuloCampo("Ano", selA));
    const bNovoAnoI = h("button", "btn-cad-secundario", "+ Ano"); bNovoAnoI.type = "button"; bNovoAnoI.title = "Começar um novo ano.";
    bNovoAnoI.addEventListener("click", () => { const na = proximoAno(); anosExtra.add(na); anoInc = na; renderInconsistencias(area); });
    ctrlsI.appendChild(bNovoAnoI); cab.appendChild(ctrlsI);
    box.appendChild(cab);
    box.appendChild(h("p", "aet-nota", "Inconsistências sólides confirmadas por colaborador (aprovações/exclusões de ponto, foto em local inadequado, erros do colaborador, etc.). Uma contagem por mês — digite “NA” no mês em que o colaborador não fazia parte do time (fica em preto e sai das somas)."));

    const wrap = h("div", "tabela-scroll"); const tb = h("table", "tabela-dados kpi-grade kpi-grade-fixa");
    const thead = h("thead"); const trh = h("tr");
    ["Colaborador", "Coordenador"].forEach((c) => trh.appendChild(h("th", null, c)));
    MESES_CURTO.forEach((m) => trh.appendChild(h("th", null, m)));
    trh.appendChild(h("th", null, "Total")); trh.appendChild(h("th", null, ""));
    thead.appendChild(trh); tb.appendChild(thead);
    const tbody = h("tbody"); tb.appendChild(tbody);
    const refsTot = []; const refTotMes = []; let refTotGeral = null;
    function montarLinha(l) {
      const tr = h("tr");
      // V 2.15 (Alexandre): nomes de colaborador/coordenador somem no modo apresentação (ap-nome).
      const tdN = h("td", "ap-nome"); const inN = h("input"); inN.type = "text"; inN.value = l.Colaborador || ""; inN.className = "kpi-inp kpi-inp-txt"; inN.addEventListener("input", () => { l.Colaborador = inN.value; }); tdN.appendChild(inN); tr.appendChild(tdN);
      const tdC = h("td", "ap-nome"); const inC = h("input"); inC.type = "text"; inC.value = l.Coordenador || ""; inC.className = "kpi-inp kpi-inp-txt"; inC.addEventListener("input", () => { l.Coordenador = inC.value; }); tdC.appendChild(inC); tr.appendChild(tdC);
      for (let m = 0; m < 12; m++) {
        const td = h("td"); const inp = h("input"); inp.type = "text"; inp.inputMode = "numeric"; inp.className = "kpi-inp"; inp.title = 'Número de inconsistências, ou "NA" se o colaborador não fazia parte do time no mês';
        inp.value = isNA(l.meses[m]) ? "NA" : n0(l.meses[m]);
        const pintar = () => { const na = isNA(l.meses[m]); td.style.background = corInc(l.meses[m]); inp.style.color = na ? "#fff" : ""; };
        inp.addEventListener("input", () => { l.meses[m] = parseMes(inp.value); pintar(); recomputar(); });
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
    [["0 inconsistência(s)", 0], ["1 inconsistência(s)", 1], ["2 a 4 inconsistência(s)", 3], ["5 inconsistência(s)", 5], ["≥ 6 inconsistência(s)", 6], ["NA (fora do time)", "NA"]].forEach(([r, v]) => { const d = h("span"); d.style.cssText = "display:inline-flex;align-items:center;gap:6px"; const sw = h("span"); sw.style.cssText = `width:14px;height:14px;border-radius:3px;display:inline-block;background:${corInc(v)};border:1px solid #d8c9c4`; d.appendChild(sw); d.appendChild(h("span", null, r)); leg.appendChild(d); });
    box.appendChild(leg);

    const rodape = h("div"); rodape.style.cssText = "margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
    const bAdd = h("button", "btn-cad-secundario", "+ Colaborador"); bAdd.type = "button"; bAdd.addEventListener("click", () => { st.linhas.push({ Colaborador: "", Coordenador: "", meses: Array(12).fill(0) }); redesenhar(); });
    const bSalvar = h("button", "btn-cad-primario", "Salvar ano"); bSalvar.type = "button";
    const msg = h("span", "aet-nota"); msg.style.margin = "0";
    bSalvar.addEventListener("click", async () => {
      bSalvar.disabled = true; msg.textContent = "Salvando…"; msg.style.color = "";
      try {
        const limpas = st.linhas.filter((l) => String(l.Colaborador || "").trim());
        const doc = { EmpresaId: "GLOBAL", Ano: st.ano, Linhas: limpas.map((l) => ({ Colaborador: String(l.Colaborador).trim(), Coordenador: String(l.Coordenador || "").trim(), meses: l.meses.map((v) => (isNA(v) ? "NA" : n0(v))) })) };
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
    // V 2.22 (Alexandre): os gráficos de inconsistências foram para o Dashboard KPI Recorrentes
    // (visão "Inconsistências Sólides"). Esta sub-aba fica só com o preenchimento (a grade).
  }
  function desenharGraficosInc(totMes) {
    grafico("inc-mes", { type: "line", data: { labels: MESES_CURTO.slice(), datasets: [{ label: "Inconsistências", data: totMes.map((v) => v), borderColor: "#C0392B", backgroundColor: "#C0392B", tension: 0.3, fill: false }] }, options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 18 } }, plugins: { legend: { display: false }, datalabels: { display: true, align: "top", anchor: "end", color: "#C0392B", font: { weight: "600", size: 11 }, formatter: (v) => (v == null ? "" : v) } }, scales: { y: { beginAtZero: true } } } });
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
      const inc = (seed.inconsistencias || []).map((l) => ({ Colaborador: l.Colaborador, Coordenador: l.Coordenador, meses: (l.meses || []).map((v) => (isNA(v) ? "NA" : n0(v))) }));
      const exi = acharInc(2026);
      await DB().salvar("kpiInconsistencia", exi ? (exi._id || exi.id) : idInc(2026), { EmpresaId: "GLOBAL", Ano: 2026, Linhas: inc }, !exi);
      await recarregar();
      window.alert("Importação de 2026 concluída.");
      anoOp = 2026; anoInc = 2026; BI.Coordenacao && BI.Coordenacao.render ? BI.Coordenacao.render() : renderPreenchimento(area);
    } catch (e) { console.error(e); window.alert("Falha na importação: " + (e && e.message ? e.message : e)); if (botao) { botao.disabled = false; botao.textContent = "⬇ Importar 2026 (planilha)"; } }
  }

  // ------------------------------------------------------------------ helpers UI
  function cartaoVazio(tit, txt) { const c = h("div", "cartao col-12"); c.appendChild(h("div", "cartao-titulo", tit)); c.appendChild(h("div", "coord-vazio", txt)); return c; }
  function rotuloCampo(rot, el) { const l = h("label", "kpi-campo"); l.appendChild(h("span", "aet-rot", rot)); l.appendChild(el); return l; }

  // renderOperacional mantido como alias do preenchimento (compatibilidade).
  BI.KpiOp = { renderPreenchimento, renderDashboard, renderOperacional: renderPreenchimento, renderInconsistencias };
})(typeof window !== "undefined" ? window : this);
