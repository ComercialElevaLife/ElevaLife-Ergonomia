/* ==========================================================================
   S.I.G.E - ElevaLife · V 2.05 (Alexandre)
   Aba "Contratos & Budget" — controle de contratos e análise mensal de budget.
   ACESSO RESTRITO: só os usuários da allowlist (contratoConfig/acesso; padrão
   alexandre.berloffa + joao). Qualquer um da lista pode gerenciar a lista e os dados.

   Sub-abas:
     - Coordenadores     : grade por cliente/contrato (editável; add/inativar).
     - Clientes inativos  : clientes inativados, com o mês da inativação (reativáveis).
     - Análise mensal     : grade por mês (fórmulas da planilha); cria meses/anos.
     - Painel             : dashboard corporativa da função.
     - Acessos            : gerencia quem acessa o módulo.

   Dados GLOBAIS: contratoCoord (1 doc por cliente), budgetMensal (1 doc por ano/mês),
   contratoConfig (doc "acesso"). Fórmulas replicadas da planilha (ver abaixo).
   Valores em dinheiro e nomes de usuários/ergonomistas somem no MODO APRESENTAÇÃO
   (classes ap-dinheiro / ap-nome; nomes de clientes e porcentagens permanecem).
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const ACESSO_PADRAO = ["alexandre.berloffa@elevalife.com.br", "joao@elevalife.com.br"];
  // Link da dashboard de faturamento (coluna C — "reconhecida pelo coordenador").
  const URL_FATURAMENTO = "https://elevalife-sistemas.github.io/faturamento-servicos/";

  const DB = () => BI.DB;
  const n0 = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
  const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
  function ident() { const d = DB(); return (d && d.estado && d.estado.identidade) || null; }
  function emailAtual() { const i = ident(); return i ? String(i.email || "").toLowerCase() : ""; }
  function podeGravar() { const e = DB() && DB().estado; return !!(e && e.disponivel && !e.somenteLeitura && e.modoApi); }
  function slug(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  // Grupo do cliente = primeira palavra do nome (GERDAU, CLARIANT, KC…), para agrupar as unidades.
  function grupoDe(cliente) { const t = String(cliente || "").trim().split(/\s+/); return (t[0] || "").toUpperCase(); }
  function grupoLinha(l) { return (l.ClienteGrupo && String(l.ClienteGrupo).trim()) ? String(l.ClienteGrupo).trim().toUpperCase() : grupoDe(l.Cliente); }

  // ---- acesso (allowlist)
  function docAcesso() { return (BI.dados && BI.dados.contratoConfig || []).find((d) => (d._id || d.id) === "acesso"); }
  function allowlist() { const d = docAcesso(); const arr = d && Array.isArray(d.usuarios) && d.usuarios.length ? d.usuarios : ACESSO_PADRAO; return arr.map((e) => String(e).toLowerCase()); }
  function temAcesso() { return allowlist().indexOf(emailAtual()) !== -1; }

  // ---- modo apresentação (dinheiro/nomes ocultos)
  const apresenta = () => !!(BI.apresentacaoAtiva && BI.apresentacaoAtiva());
  function moeda(v) { if (v == null || v === "" || isNaN(Number(v))) return "—"; return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  const pct = (a, b) => (n0(b) !== 0 ? n0(a) / n0(b) : null);
  const pctTxt = (p) => (p == null ? "—" : Math.round(p * 100) + "%");
  function corPct(p) { if (p == null) return "#8a7a78"; if (p >= 1) return "#1E6B44"; if (p >= 0.8) return "#2E7D5B"; if (p >= 0.5) return "#E8731A"; return "#C62828"; }
  // célula de dinheiro: marca ap-dinheiro para sumir no modo apresentação
  function tdMoeda(v, extraCls) { const td = h("td", "num ap-dinheiro" + (extraCls ? " " + extraCls : ""), moeda(v)); return td; }
  function tdNome(v) { return h("td", "ap-nome", v || "—"); }

  // ---- dados
  function docsCoord() { return (BI.dados && BI.dados.contratoCoord) || []; }
  function docsBudget() { return (BI.dados && BI.dados.budgetMensal) || []; }
  function ativos() { return docsCoord().filter((c) => !c.Inativo); }
  function inativos() { return docsCoord().filter((c) => c.Inativo); }
  function somaContratos() { return ativos().reduce((s, c) => s + n0(c.ValorCtt), 0); }
  function idBudget(ano, mes) { return "bud-" + ano + "-" + mes; }
  function acharBudget(ano, mes) { const k = idBudget(ano, mes); return docsBudget().find((d) => (d._id || d.id) === k); }

  // fórmulas da aba Coordenadores
  function derivadosCoord(c) {
    const ctt = n0(c.ValorCtt);
    const tetoMO = ctt * 0.3, tetoBen = ctt * 0.05;
    const saldoMO = tetoMO - n0(c.MOAtual), saldoBen = tetoBen - n0(c.BenefAtual);
    return { chCoord: n0(c.CHSem) * 0.1, tetoMO, tetoBen, saldoMO, saldoBen, saldoTotal: saldoMO + saldoBen };
  }
  // fórmulas da aba Análise mensal (B,C input/snapshot; I,L input; resto fórmula)
  function derivadosBudget(b) {
    const B = n0(b.totalPrevisto), C = n0(b.faturado), I = n0(b.moUtilizada), L = n0(b.benUtilizado);
    const H = C * 0.3, K = C * 0.05, E = H + K, F = I + L;
    return { B, C, D: pct(C, B), E, F, G: pct(F, E), H, I, J: pct(I, H), K, L, M: pct(L, K) };
  }

  async function recarregar(chaves) { try { await DB().recarregar(chaves || ["contratoCoord", "budgetMensal", "contratoConfig"]); } catch (e) { console.error(e); } }

  function cartao(tit, sub, cont) { const c = h("div", "cartao col-12"); if (tit) c.appendChild(h("div", "cartao-titulo", tit)); if (sub) c.appendChild(h("div", "coord-sub", sub)); if (cont) c.appendChild(cont); return c; }

  // ================================================================= sub-abas
  let subAtiva = "coordenadores";
  let anoBud = (new Date().getFullYear());
  const SUBABAS = [
    { chave: "coordenadores", rotulo: "Coordenadores", montar: renderCoordenadores },
    { chave: "inativos", rotulo: "Clientes inativos", montar: renderInativos },
    { chave: "analise", rotulo: "Análise mensal", montar: renderAnalise },
    { chave: "painel", rotulo: "Painel", montar: renderPainel },
    { chave: "acessos", rotulo: "Acessos", montar: renderAcessos },
  ];

  function render() {
    const grade = document.getElementById("grade-contratos");
    if (!grade) return;
    grade.innerHTML = "";
    if (!temAcesso()) { grade.appendChild(cartao("Contratos & Budget", null, h("div", "coord-vazio", "Acesso restrito. Peça a um usuário já liberado para incluir o seu e-mail (aba Acessos)."))); return; }
    const nav = h("nav", "subnav-cadastro coord-subnav");
    SUBABAS.forEach((s) => { const b = h("button", "subnav-cadastro-item" + (s.chave === subAtiva ? " ativa" : ""), s.rotulo); b.type = "button"; b.addEventListener("click", () => { subAtiva = s.chave; render(); }); nav.appendChild(b); });
    grade.appendChild(nav);
    const area = h("div", "coord-area"); grade.appendChild(area);
    (SUBABAS.find((s) => s.chave === subAtiva) || SUBABAS[0]).montar(area);
  }

  // ================================================================= Coordenadores
  function renderCoordenadores(area) {
    area.innerHTML = "";
    const box = h("div", "cartao col-12");
    const cab = h("div", "cadastro-cabecalho"); cab.appendChild(h("div", "cartao-titulo", "Coordenadores — contratos por cliente"));
    box.appendChild(cab);
    box.appendChild(h("div", "coord-sub", "Agrupado por cliente, uma linha por unidade. CH Coord. (=CH×10%), Teto MO (=$ CTT×30%), Teto Benefício (=$ CTT×5%) e Saldos são calculados. Cliente em pacote (várias unidades num só contrato) soma o valor UMA vez: o valor fica na unidade principal e as demais aparecem como “(pacote)”. Use o × para inativar. Clique em Salvar."));

    const linhas = ativos().map((c) => Object.assign({}, c));
    // Ordena por grupo de cliente → cliente → unidade, para agrupar na tela.
    linhas.sort((a, b) => grupoLinha(a).localeCompare(grupoLinha(b)) || String(a.Cliente || "").localeCompare(String(b.Cliente || "")) || String(a.Unidade || "").localeCompare(String(b.Unidade || "")));
    // Primário de cada pacote (quem carrega o valor): o 1º com ValorCtt definido, senão o 1º do pacote.
    const primarioPct = {};
    linhas.forEach((l) => { const p = String(l.Pacote || "").trim(); if (!p) return; if (primarioPct[p] == null) primarioPct[p] = l; if (l.ValorCtt != null && primarioPct[p].ValorCtt == null) primarioPct[p] = l; });
    const ehPacoteSec = (l) => { const p = String(l.Pacote || "").trim(); return !!p && primarioPct[p] !== l; };

    const bImp = botaoImportar(area); if (bImp) box.appendChild(bImp);

    const wrap = h("div", "tabela-scroll"); const tb = h("table", "tabela-dados kpi-grade contratos-grade");
    const thead = h("thead"); const trh = h("tr");
    ["Cliente", "Unidade", "Ergonomista", "CH (sem)", "CH Coord.", "Coordenador", "$ CTT", "Venc. contrato", "Teto MO", "MO atual", "Teto Benef.", "Benef. atual", "Saldo MO", "Saldo Benef.", "Saldo Total", ""].forEach((c) => trh.appendChild(h("th", null, c)));
    thead.appendChild(trh); tb.appendChild(thead);
    const tbody = h("tbody"); tb.appendChild(tbody);
    const refs = [];

    function inp(l, campo, tipo, cls, ro) { const i = h("input", "kpi-inp " + (cls || "")); i.type = tipo || "text"; if (tipo === "number") { i.step = "0.01"; i.min = "0"; } i.value = (l[campo] != null ? l[campo] : ""); if (ro) { i.readOnly = true; i.classList.add("kpi-inp-ro"); i.title = "Valor do pacote (editável na unidade principal)"; } else { i.addEventListener("input", () => { l[campo] = tipo === "number" ? (i.value === "" ? null : Number(i.value)) : i.value; recalc(); }); } return i; }

    function montarLinha(l) {
      const sec = ehPacoteSec(l);
      const tr = h("tr", sec ? "contratos-pct-sec" : null);
      const tdC = h("td"); tdC.appendChild(inp(l, "Cliente", "text", "kpi-inp-txt")); tr.appendChild(tdC);
      const tdU = h("td"); tdU.appendChild(inp(l, "Unidade", "text", "kpi-inp-txt")); if (String(l.Pacote || "").trim()) tdU.appendChild(h("span", "contratos-badge-pct", sec ? "no pacote" : "pacote")); tr.appendChild(tdU);
      const tdE = h("td", "ap-nome"); tdE.appendChild(inp(l, "Ergonomista", "text", "kpi-inp-txt")); tr.appendChild(tdE);
      const tdCH = h("td", "num"); tdCH.appendChild(inp(l, "CHSem", "number", "kpi-inp-qtd", sec)); tr.appendChild(tdCH);
      const tdCHc = h("td", "num"); tr.appendChild(tdCHc);
      const tdCo = h("td", "ap-nome"); tdCo.appendChild(inp(l, "Coordenador", "text", "kpi-inp-txt")); tr.appendChild(tdCo);
      const tdCtt = h("td", "num ap-dinheiro"); tdCtt.appendChild(inp(l, "ValorCtt", "number", "", sec)); tr.appendChild(tdCtt);
      const tdV = h("td"); { const i = h("input", "kpi-inp"); i.type = "date"; i.value = l.VencContrato || ""; if (sec) { i.readOnly = true; i.classList.add("kpi-inp-ro"); } else { i.addEventListener("input", () => { l.VencContrato = i.value; }); } tdV.appendChild(i); } tr.appendChild(tdV);
      const tdTMO = h("td", "num ap-dinheiro"); tr.appendChild(tdTMO);
      const tdMO = h("td", "num ap-dinheiro"); tdMO.appendChild(inp(l, "MOAtual", "number")); tr.appendChild(tdMO);
      const tdTB = h("td", "num ap-dinheiro"); tr.appendChild(tdTB);
      const tdB = h("td", "num ap-dinheiro"); tdB.appendChild(inp(l, "BenefAtual", "number")); tr.appendChild(tdB);
      const tdSMO = h("td", "num ap-dinheiro"); tr.appendChild(tdSMO);
      const tdSB = h("td", "num ap-dinheiro"); tr.appendChild(tdSB);
      const tdST = h("td", "num ap-dinheiro"); tr.appendChild(tdST);
      const tdX = h("td"); const bx = h("button", "btn-excluir", "×"); bx.type = "button"; bx.title = "Inativar unidade"; bx.addEventListener("click", () => inativar(l, area)); tdX.appendChild(bx); tr.appendChild(tdX);
      refs.push({ l, sec, tdCHc, tdTMO, tdTB, tdSMO, tdSB, tdST });
      return tr;
    }
    function recalc() {
      refs.forEach(({ l, sec, tdCHc, tdTMO, tdTB, tdSMO, tdSB, tdST }) => {
        if (sec) { tdCHc.textContent = "—"; tdTMO.textContent = "(pacote)"; tdTB.textContent = "(pacote)"; tdSMO.textContent = "(pacote)"; tdSB.textContent = "(pacote)"; tdST.textContent = "(pacote)"; return; }
        const d = derivadosCoord(l);
        tdCHc.textContent = (Math.round(d.chCoord * 100) / 100);
        tdTMO.textContent = moeda(d.tetoMO); tdTB.textContent = moeda(d.tetoBen);
        tdSMO.textContent = moeda(d.saldoMO); tdSB.textContent = moeda(d.saldoBen); tdST.textContent = moeda(d.saldoTotal);
      });
      cardResumo();
    }
    function headerGrupo(g) {
      const tr = h("tr", "contratos-grupo-row"); const td = h("td"); td.colSpan = 16;
      const doGrupo = linhas.filter((l) => grupoLinha(l) === g);
      const subtot = doGrupo.reduce((s, l) => s + n0(l.ValorCtt), 0);
      td.appendChild(h("span", "contratos-grupo-nome", g));
      td.appendChild(h("span", "contratos-grupo-sub", " · " + doGrupo.length + " unidade(s)"));
      td.appendChild(h("span", "contratos-grupo-sub ap-dinheiro", " · " + moeda(subtot)));
      tr.appendChild(td); return tr;
    }
    function redesenhar() {
      tbody.innerHTML = ""; refs.length = 0; let gAtual = null;
      linhas.forEach((l) => { const g = grupoLinha(l); if (g !== gAtual) { gAtual = g; tbody.appendChild(headerGrupo(g)); } tbody.appendChild(montarLinha(l)); });
      recalc();
    }

    const cards = h("div", "coord-kpis");
    function cardResumo() {
      cards.innerHTML = "";
      const kpi = (v, r, din) => { const d = h("div", "coord-kpi"); const vv = h("div", "coord-kpi-valor" + (din ? " ap-dinheiro" : ""), v); d.appendChild(vv); d.appendChild(h("div", "coord-kpi-rot", r)); return d; };
      const tot = linhas.reduce((s, l) => s + n0(l.ValorCtt), 0);
      const tMO = linhas.reduce((s, l) => s + derivadosCoord(l).tetoMO, 0);
      const uMO = linhas.reduce((s, l) => s + n0(l.MOAtual), 0);
      const nGrupos = new Set(linhas.map((l) => grupoLinha(l))).size;
      cards.appendChild(kpi(String(nGrupos), "Clientes"));
      cards.appendChild(kpi(String(linhas.length), "Unidades ativas"));
      cards.appendChild(kpi(moeda(tot), "Soma dos contratos", true));
      cards.appendChild(kpi(moeda(tMO), "Teto MO total", true));
      cards.appendChild(kpi(pctTxt(pct(uMO, tMO)), "% MO utilizada"));
    }
    box.appendChild(cards);
    redesenhar();
    wrap.appendChild(tb); box.appendChild(wrap);

    const rod = h("div"); rod.style.cssText = "margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
    const bAdd = h("button", "btn-cad-secundario", "+ Unidade/cliente"); bAdd.type = "button"; bAdd.addEventListener("click", () => { linhas.push({ Cliente: "", Unidade: "", Inativo: false }); redesenhar(); });
    const bSalvar = h("button", "btn-cad-primario", "Salvar"); bSalvar.type = "button";
    const msg = h("span", "aet-nota"); msg.style.margin = "0";
    bSalvar.addEventListener("click", async () => {
      if (!podeGravar()) { msg.textContent = "Banco indisponível nesta visualização."; msg.style.color = "#C62828"; return; }
      bSalvar.disabled = true; msg.style.color = "#1E6B44"; msg.textContent = "Salvando…";
      try {
        for (const l of linhas) {
          if (!String(l.Cliente || "").trim()) continue;
          const id = l._id || l.id || ("ct-" + slug(l.Cliente) + "-" + slug(l.Unidade || "") + "-" + Math.random().toString(36).slice(2, 6));
          const doc = { EmpresaId: "GLOBAL", Cliente: String(l.Cliente).trim(), Unidade: l.Unidade || "", ClienteGrupo: grupoLinha(l), Pacote: l.Pacote || "", Ergonomista: l.Ergonomista || "", CHSem: num(l.CHSem), Coordenador: l.Coordenador || "", ValorCtt: num(l.ValorCtt), VencContrato: l.VencContrato || "", MOAtual: num(l.MOAtual), BenefAtual: num(l.BenefAtual), Inativo: false };
          await DB().salvar("contratoCoord", id, doc, !(l._id || l.id));
        }
        await recarregar(["contratoCoord"]);
        if (BI.avisar) BI.avisar("Contratos salvos.");
        renderCoordenadores(area);
      } catch (e) { console.error(e); msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    rod.appendChild(bAdd); rod.appendChild(bSalvar); rod.appendChild(msg);
    box.appendChild(rod);
    area.appendChild(box);
  }

  async function inativar(l, area) {
    if (!(l._id || l.id)) { const i = -1; return; } // linha ainda não salva: só remover localmente (recarrega)
    if (!window.confirm("Inativar o cliente “" + (l.Cliente || "") + "”? Ele vai para “Clientes inativos”.")) return;
    if (!podeGravar()) { window.alert("Banco indisponível nesta visualização."); return; }
    const mes = (new Date()).getFullYear() + "-" + String((new Date()).getMonth() + 1).padStart(2, "0");
    const doc = Object.assign({}, l, { Inativo: true, InativadoEm: mes });
    delete doc._id; delete doc._origem;
    try { await DB().salvar("contratoCoord", l._id || l.id, doc, false); await recarregar(["contratoCoord"]); if (BI.avisar) BI.avisar("Cliente inativado."); renderCoordenadores(area); }
    catch (e) { console.error(e); window.alert("Não foi possível inativar: " + (e && e.message ? e.message : e)); }
  }

  // ================================================================= Clientes inativos
  function renderInativos(area) {
    area.innerHTML = "";
    const lista = inativos();
    const box = h("div", "cartao col-12");
    box.appendChild(h("div", "cartao-titulo", "Clientes inativos"));
    box.appendChild(h("div", "coord-sub", "Clientes inativados, com o mês em que saíram. É possível reativar."));
    if (!lista.length) { box.appendChild(h("div", "coord-vazio", "Nenhum cliente inativo.")); area.appendChild(box); return; }
    const wrap = h("div", "tabela-scroll"); const t = h("table", "tabela-dados kpi-grade");
    const thead = h("thead"); const trh = h("tr"); ["Cliente", "Unidade", "Ergonomista", "Coordenador", "$ CTT", "Inativado em", ""].forEach((c) => trh.appendChild(h("th", null, c))); thead.appendChild(trh); t.appendChild(thead);
    const tbody = h("tbody");
    lista.forEach((c) => {
      const tr = h("tr");
      tr.appendChild(h("td", null, c.Cliente || "—"));
      tr.appendChild(h("td", null, c.Unidade || "—"));
      tr.appendChild(tdNome(c.Ergonomista));
      tr.appendChild(tdNome(c.Coordenador));
      tr.appendChild(tdMoeda(c.ValorCtt));
      tr.appendChild(h("td", null, c.InativadoEm ? mesBR(c.InativadoEm) : "—"));
      const tdA = h("td"); const b = h("button", "btn-cad-secundario", "Reativar"); b.type = "button"; b.addEventListener("click", () => reativar(c, area)); tdA.appendChild(b); tr.appendChild(tdA);
      tbody.appendChild(tr);
    });
    t.appendChild(tbody); wrap.appendChild(t); box.appendChild(wrap); area.appendChild(box);
  }
  function mesBR(ym) { const [a, m] = String(ym).split("-"); return (MESES[Number(m) - 1] || m) + "/" + a; }
  async function reativar(c, area) {
    if (!podeGravar()) { window.alert("Banco indisponível nesta visualização."); return; }
    const doc = Object.assign({}, c, { Inativo: false }); delete doc.InativadoEm; delete doc._id; delete doc._origem;
    try { await DB().salvar("contratoCoord", c._id || c.id, doc, false); await recarregar(["contratoCoord"]); if (BI.avisar) BI.avisar("Cliente reativado."); renderInativos(area); }
    catch (e) { console.error(e); window.alert("Não foi possível reativar: " + (e && e.message ? e.message : e)); }
  }

  // ================================================================= Análise mensal
  function renderAnalise(area) {
    area.innerHTML = "";
    const box = h("div", "cartao col-12");
    const cab = h("div", "cadastro-cabecalho"); cab.appendChild(h("div", "cartao-titulo", "Análise mensal do budget"));
    const ctrls = h("div", "kpi-ctrls");
    const selA = h("select"); anosDisponiveis().forEach((a) => { const o = h("option", null, String(a)); o.value = a; selA.appendChild(o); }); selA.value = anoBud; selA.addEventListener("change", () => { anoBud = Number(selA.value); renderAnalise(area); });
    ctrls.appendChild(rotuloCampo("Ano", selA));
    cab.appendChild(ctrls); box.appendChild(cab);
    box.appendChild(h("div", "coord-sub", "B = soma dos contratos ativos (snapshot do mês, editável). C = Total Faturado (digite o valor “reconhecido” do sistema de faturamento, ou use “Puxar do faturamento”). D=C/B · E=H+K · F=I+L · G=F/E · H=C×30% · I manual · J=I/H · K=C×5% · L manual · M=L/K."));

    const bImp = botaoImportar(area); if (bImp) box.appendChild(bImp);

    const linhas = []; // meses do ano (0-11) com doc ou vazio-herdado
    for (let m = 0; m < 12; m++) { const ex = acharBudget(anoBud, m); if (ex) linhas.push(Object.assign({ Mes: m }, ex)); }

    const wrap = h("div", "tabela-scroll"); const t = h("table", "tabela-dados kpi-grade contratos-grade");
    const thead = h("thead"); const trh = h("tr");
    ["Mês", "Total previsto (B)", "Total faturado (C)", "% Fat. (D)", "Budget disp. (E)", "Total gasto (F)", "% saldo (G)", "MO disp. (H)", "MO utilizada (I)", "% (J)", "Benef. disp. (K)", "Benef. utilizado (L)", "% (M)", ""].forEach((c) => trh.appendChild(h("th", null, c)));
    thead.appendChild(trh); t.appendChild(thead);
    const tbody = h("tbody"); t.appendChild(tbody);
    const refs = [];

    function inpNum(l, campo) { const i = h("input", "kpi-inp"); i.type = "number"; i.step = "0.01"; i.value = (l[campo] != null ? l[campo] : ""); i.addEventListener("input", () => { l[campo] = i.value === "" ? null : Number(i.value); recalc(); }); return i; }
    function montarLinha(l) {
      const tr = h("tr");
      tr.appendChild(h("td", null, MESES[l.Mes]));
      const tdB = h("td", "num ap-dinheiro"); tdB.appendChild(inpNum(l, "totalPrevisto")); tr.appendChild(tdB);
      const tdC = h("td", "num ap-dinheiro"); const wrapC = h("div"); wrapC.style.cssText = "display:flex;gap:4px;align-items:center"; const iC = inpNum(l, "faturado"); wrapC.appendChild(iC); const bF = h("button", "btn-mini-fat", "↻"); bF.type = "button"; bF.title = "Abrir a dashboard do faturamento (Ergonomia · reconhecido · mês) e preencher este campo"; bF.addEventListener("click", () => puxarFaturamento(l, recalc, iC)); wrapC.appendChild(bF); tdC.appendChild(wrapC); tr.appendChild(tdC);
      const tdD = h("td", "num"); const spD = h("span", "kpi-pct"); tdD.appendChild(spD); tr.appendChild(tdD);
      const tdE = h("td", "num ap-dinheiro"); tr.appendChild(tdE);
      const tdF = h("td", "num ap-dinheiro"); tr.appendChild(tdF);
      const tdG = h("td", "num"); const spG = h("span", "kpi-pct"); tdG.appendChild(spG); tr.appendChild(tdG);
      const tdH = h("td", "num ap-dinheiro"); tr.appendChild(tdH);
      const tdI = h("td", "num ap-dinheiro"); tdI.appendChild(inpNum(l, "moUtilizada")); tr.appendChild(tdI);
      const tdJ = h("td", "num"); const spJ = h("span", "kpi-pct"); tdJ.appendChild(spJ); tr.appendChild(tdJ);
      const tdK = h("td", "num ap-dinheiro"); tr.appendChild(tdK);
      const tdL = h("td", "num ap-dinheiro"); tdL.appendChild(inpNum(l, "benUtilizado")); tr.appendChild(tdL);
      const tdM = h("td", "num"); const spM = h("span", "kpi-pct"); tdM.appendChild(spM); tr.appendChild(tdM);
      const tdX = h("td"); const bx = h("button", "btn-excluir", "×"); bx.type = "button"; bx.title = "Remover mês"; bx.addEventListener("click", () => { const i = linhas.indexOf(l); if (i >= 0) { linhas.splice(i, 1); redesenhar(); } }); tdX.appendChild(bx); tr.appendChild(tdX);
      refs.push({ l, spD, tdE, tdF, spG, tdH, spJ, tdK, spM });
      return tr;
    }
    function recalc() {
      refs.forEach(({ l, spD, tdE, tdF, spG, tdH, spJ, tdK, spM }) => {
        const d = derivadosBudget(l);
        spD.textContent = pctTxt(d.D); spD.style.color = corPct(d.D);
        tdE.textContent = moeda(d.E); tdF.textContent = moeda(d.F);
        spG.textContent = pctTxt(d.G); spG.style.color = corPct(d.G);
        tdH.textContent = moeda(d.H);
        spJ.textContent = pctTxt(d.J); spJ.style.color = corPct(d.J);
        tdK.textContent = moeda(d.K);
        spM.textContent = pctTxt(d.M); spM.style.color = corPct(d.M);
      });
    }
    function redesenhar() { tbody.innerHTML = ""; refs.length = 0; linhas.sort((a, b) => a.Mes - b.Mes).forEach((l) => tbody.appendChild(montarLinha(l))); recalc(); }
    redesenhar();
    wrap.appendChild(t); box.appendChild(wrap);

    const rod = h("div"); rod.style.cssText = "margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
    const bMes = h("button", "btn-cad-secundario", "+ Mês"); bMes.type = "button"; bMes.title = "Adiciona o próximo mês que falta neste ano, com B = soma atual dos contratos.";
    bMes.addEventListener("click", () => { const usados = new Set(linhas.map((l) => l.Mes)); let m = 0; while (m < 12 && usados.has(m)) m++; if (m > 11) { window.alert("Todos os 12 meses deste ano já existem."); return; } linhas.push({ Mes: m, Ano: anoBud, totalPrevisto: Math.round(somaContratos() * 100) / 100, faturado: null, moUtilizada: null, benUtilizado: null }); redesenhar(); });
    const bAno = h("button", "btn-cad-secundario", "+ Ano"); bAno.type = "button"; bAno.title = "Começa o próximo ano (janeiro), com B = soma atual dos contratos.";
    bAno.addEventListener("click", () => { anoBud = proximoAno(); renderAnalise(area); });
    const bLink = h("a", "btn-cad-secundario", "Abrir faturamento ↗"); bLink.href = URL_FATURAMENTO; bLink.target = "_blank"; bLink.rel = "noopener";
    const bSalvar = h("button", "btn-cad-primario", "Salvar ano"); bSalvar.type = "button";
    const msg = h("span", "aet-nota"); msg.style.margin = "0";
    bSalvar.addEventListener("click", async () => {
      if (!podeGravar()) { msg.textContent = "Banco indisponível nesta visualização."; msg.style.color = "#C62828"; return; }
      bSalvar.disabled = true; msg.style.color = "#1E6B44"; msg.textContent = "Salvando…";
      try {
        for (const l of linhas) {
          const ex = acharBudget(anoBud, l.Mes);
          const doc = { EmpresaId: "GLOBAL", Ano: anoBud, Mes: l.Mes, totalPrevisto: num(l.totalPrevisto), faturado: num(l.faturado), moUtilizada: num(l.moUtilizada), benUtilizado: num(l.benUtilizado) };
          await DB().salvar("budgetMensal", ex ? (ex._id || ex.id) : idBudget(anoBud, l.Mes), doc, !ex);
        }
        await recarregar(["budgetMensal"]);
        if (BI.avisar) BI.avisar("Análise mensal salva.");
        renderAnalise(area);
      } catch (e) { console.error(e); msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    rod.appendChild(bMes); rod.appendChild(bAno); rod.appendChild(bLink); rod.appendChild(bSalvar); rod.appendChild(msg);
    box.appendChild(rod);
    area.appendChild(box);
  }

  // Coluna C — fluxo ASSISTIDO: abre a dashboard do faturamento e deixa o campo pronto
  // para colar o valor de "Ergonomia · reconhecido · mês vigente". (Se um dia a TI ligar a
  // integração automática via Graph, basta definir BI.FaturamentoIntegra.valorMes que o
  // botão passa a preencher sozinho — o gancho já está aqui.)
  async function puxarFaturamento(l, cb, inp) {
    if (BI.FaturamentoIntegra && typeof BI.FaturamentoIntegra.valorMes === "function") {
      try { const v = await BI.FaturamentoIntegra.valorMes(l.Ano, l.Mes); if (v != null) { l.faturado = v; if (inp) inp.value = v; if (cb) cb(); if (BI.avisar) BI.avisar("Valor do faturamento puxado automaticamente."); return; } } catch (e) { console.error(e); }
    }
    try { window.open(URL_FATURAMENTO, "_blank", "noopener"); } catch (e) { /* popup bloqueado */ }
    if (BI.avisar) BI.avisar("Abri a dashboard do faturamento. Pegue o valor de “Ergonomia · reconhecido” do mês (regime caixa) e cole aqui no campo Total faturado.");
    if (inp) { try { inp.focus(); inp.select(); } catch (e) { /* */ } }
  }

  function anosDisponiveis() { const set = new Set([new Date().getFullYear(), 2026, anoBud]); docsBudget().forEach((d) => { if (d.Ano) set.add(Number(d.Ano)); }); return Array.from(set).sort((a, b) => a - b); }
  function proximoAno() { return Math.max.apply(null, anosDisponiveis()) + 1; }
  function rotuloCampo(rot, el) { const l = h("label", "kpi-campo"); l.appendChild(h("span", "aet-rot", rot)); l.appendChild(el); return l; }

  // ================================================================= Painel (dashboard)
  const graficos = {};
  function grafico(id, cfg) { if (typeof Chart === "undefined") return; const cv = document.getElementById(id); if (!cv) return; if (graficos[id]) { try { graficos[id].destroy(); } catch (e) {} } try { graficos[id] = new Chart(cv.getContext("2d"), cfg); requestAnimationFrame(() => { try { graficos[id] && graficos[id].resize(); } catch (e) {} }); } catch (e) { console.error(e); } }

  function renderPainel(area) {
    area.innerHTML = "";
    const ap = apresenta();
    // KPIs gerais
    const kcard = h("div", "cartao col-12");
    kcard.appendChild(h("div", "cartao-titulo", "Painel de Contratos & Budget"));
    const kg = h("div", "coord-kpis");
    const kpi = (v, r, din) => { const d = h("div", "coord-kpi"); d.appendChild(h("div", "coord-kpi-valor" + (din ? " ap-dinheiro" : ""), v)); d.appendChild(h("div", "coord-kpi-rot", r)); return d; };
    const at = ativos();
    const somaC = somaContratos();
    // último mês com budget
    const bud = docsBudget().slice().sort((a, b) => (a.Ano - b.Ano) || (a.Mes - b.Mes));
    const ultimo = bud[bud.length - 1];
    const dUlt = ultimo ? derivadosBudget(ultimo) : null;
    const nCli = new Set(at.map((c) => grupoLinha(c))).size;
    kg.appendChild(kpi(String(nCli), "Clientes"));
    kg.appendChild(kpi(String(at.length), "Unidades"));
    kg.appendChild(kpi(moeda(somaC), "Soma dos contratos (previsto)", true));
    kg.appendChild(kpi(dUlt ? pctTxt(dUlt.D) : "—", "% faturado (últ. mês)"));
    kg.appendChild(kpi(dUlt ? pctTxt(dUlt.G) : "—", "% saldo budget (últ. mês)"));
    kcard.appendChild(kg); area.appendChild(kcard);

    // Gráfico 1: faturado × previsto por mês
    const g1 = h("div", "cartao col-12"); g1.appendChild(h("div", "cartao-titulo", "Faturado × previsto por mês" + (ap ? " (%)" : " (R$)")));
    const b1 = h("div"); b1.style.cssText = "position:relative;height:300px"; const c1 = h("canvas"); c1.id = "ct-fat-prev"; b1.appendChild(c1); g1.appendChild(b1); area.appendChild(g1);
    // Gráfico 2: % faturamento e % saldo por mês
    const g2 = h("div", "cartao col-12"); g2.appendChild(h("div", "cartao-titulo", "% Faturamento e % saldo do budget por mês"));
    const b2 = h("div"); b2.style.cssText = "position:relative;height:280px"; const c2 = h("canvas"); c2.id = "ct-pcts"; b2.appendChild(c2); g2.appendChild(b2); area.appendChild(g2);
    // Gráfico 3: contratos por coordenador (nomes somem no modo apresentação → rótulos genéricos)
    const g3 = h("div", "cartao col-12"); g3.appendChild(h("div", "cartao-titulo", "Soma de contratos por coordenador" + (ap ? " (valores ocultos)" : "")));
    const b3 = h("div"); b3.style.cssText = "position:relative;height:300px"; const c3 = h("canvas"); c3.id = "ct-coord"; b3.appendChild(c3); g3.appendChild(b3); area.appendChild(g3);

    const labels = bud.map((b) => MESES_CURTO[b.Mes] + "/" + String(b.Ano).slice(2));
    const previsto = bud.map((b) => Math.round(n0(b.totalPrevisto)));
    const faturado = bud.map((b) => Math.round(n0(b.faturado)));
    if (ap) {
      // modo apresentação: mostra % faturado (sem R$)
      grafico("ct-fat-prev", { type: "bar", data: { labels, datasets: [{ label: "% faturado", data: bud.map((b) => { const d = derivadosBudget(b); return d.D == null ? 0 : Math.round(d.D * 100); }), backgroundColor: "#8E1B3A" }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, max: 110, title: { display: true, text: "%" } } } } });
    } else {
      grafico("ct-fat-prev", { type: "bar", data: { labels, datasets: [{ label: "Previsto", data: previsto, backgroundColor: "#cdbfc0" }, { label: "Faturado", data: faturado, backgroundColor: "#8E1B3A" }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: "R$" } } } } });
    }
    grafico("ct-pcts", { type: "line", data: { labels, datasets: [{ label: "% Faturamento", data: bud.map((b) => { const d = derivadosBudget(b); return d.D == null ? null : Math.round(d.D * 100); }), borderColor: "#2E5A88", backgroundColor: "#2E5A88", tension: 0.3, fill: false }, { label: "% Saldo budget", data: bud.map((b) => { const d = derivadosBudget(b); return d.G == null ? null : Math.round(d.G * 100); }), borderColor: "#1E6B44", backgroundColor: "#1E6B44", tension: 0.3, fill: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: "%" } } } } });
    // por coordenador (no modo apresentação os nomes viram rótulos genéricos e o eixo de R$ some)
    const mapCo = {}; at.forEach((c) => { const k = c.Coordenador || "—"; mapCo[k] = (mapCo[k] || 0) + n0(c.ValorCtt); });
    const coNomes = Object.keys(mapCo); const coVals = coNomes.map((k) => Math.round(mapCo[k]));
    const coLabels = ap ? coNomes.map((_, i) => "Coordenador " + (i + 1)) : coNomes;
    grafico("ct-coord", { type: "bar", data: { labels: coLabels, datasets: [{ label: "Soma de contratos", data: coVals, backgroundColor: "#6A4C93", borderRadius: 4 }] }, options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false }, tooltip: { enabled: !ap } }, scales: { x: { beginAtZero: true, display: !ap } } } });

    // ---- Por CLIENTE (grupo). Nomes de clientes NÃO somem no modo apresentação; o eixo R$ some.
    const cardCli = h("div", "cartao col-12"); cardCli.appendChild(h("div", "cartao-titulo", "Soma de contratos por cliente" + (ap ? " (valores ocultos)" : " (R$)")));
    const bc = h("div"); bc.style.cssText = "position:relative;height:340px"; const cc = h("canvas"); cc.id = "ct-cliente"; bc.appendChild(cc); cardCli.appendChild(bc); area.appendChild(cardCli);
    const mapCli = {}; at.forEach((c) => { const k = grupoLinha(c); mapCli[k] = (mapCli[k] || 0) + n0(c.ValorCtt); });
    const cliNomes = Object.keys(mapCli).sort((a, b) => mapCli[b] - mapCli[a]);
    grafico("ct-cliente", { type: "bar", data: { labels: cliNomes, datasets: [{ label: "Soma de contratos", data: cliNomes.map((k) => Math.round(mapCli[k])), backgroundColor: "#8E1B3A", borderRadius: 4 }] }, options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false }, tooltip: { enabled: !ap } }, scales: { x: { beginAtZero: true, display: !ap, title: { display: !ap, text: "R$" } } } } });

    // ---- Por UNIDADE (top 15 por valor). Rótulo "Cliente · Unidade". Clientes/unidades não somem; R$ some.
    const cardUni = h("div", "cartao col-12"); cardUni.appendChild(h("div", "cartao-titulo", "Top unidades por valor de contrato" + (ap ? " (valores ocultos)" : " (R$)")));
    const bu = h("div"); bu.style.cssText = "position:relative;height:420px"; const cu = h("canvas"); cu.id = "ct-unidade"; bu.appendChild(cu); cardUni.appendChild(bu); area.appendChild(cardUni);
    const urows = at.filter((c) => n0(c.ValorCtt) > 0).map((c) => ({ rot: grupoLinha(c) + " · " + (c.Unidade || "—"), v: n0(c.ValorCtt) })).sort((a, b) => b.v - a.v).slice(0, 15);
    grafico("ct-unidade", { type: "bar", data: { labels: urows.map((x) => x.rot), datasets: [{ label: "Valor do contrato", data: urows.map((x) => Math.round(x.v)), backgroundColor: "#0E7C86", borderRadius: 4 }] }, options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false }, tooltip: { enabled: !ap } }, scales: { x: { beginAtZero: true, display: !ap, title: { display: !ap, text: "R$" } } } } });

    // ---- Por ERGONOMISTA: soma de contratos + nº de unidades. Nomes de ergonomistas SOMEM no modo apresentação.
    const cardErg = h("div", "cartao col-12"); cardErg.appendChild(h("div", "cartao-titulo", "Por ergonomista — soma de contratos e nº de unidades" + (ap ? " (nomes/valores ocultos)" : "")));
    const be = h("div"); be.style.cssText = "position:relative;height:360px"; const ce = h("canvas"); ce.id = "ct-ergo"; be.appendChild(ce); cardErg.appendChild(be); area.appendChild(cardErg);
    const mapErg = {}; at.forEach((c) => { const k = c.Ergonomista || "—"; const e = mapErg[k] || (mapErg[k] = { soma: 0, n: 0 }); e.soma += n0(c.ValorCtt); e.n += 1; });
    const ergNomes = Object.keys(mapErg).sort((a, b) => mapErg[b].soma - mapErg[a].soma);
    const ergLabels = ap ? ergNomes.map((_, i) => "Ergonomista " + (i + 1)) : ergNomes;
    grafico("ct-ergo", { type: "bar", data: { labels: ergLabels, datasets: [{ label: "Soma de contratos (R$)", yAxisID: "y", data: ergNomes.map((k) => Math.round(mapErg[k].soma)), backgroundColor: "#8E1B3A", borderRadius: 4 }, { label: "Nº de unidades", yAxisID: "y1", type: "line", data: ergNomes.map((k) => mapErg[k].n), borderColor: "#1E6B44", backgroundColor: "#1E6B44", tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" }, datalabels: { display: false }, tooltip: { enabled: true } }, scales: { y: { beginAtZero: true, display: !ap, position: "left", title: { display: !ap, text: "R$" } }, y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "unidades" } } } } });
  }

  // ================================================================= Acessos (allowlist)
  function renderAcessos(area) {
    area.innerHTML = "";
    const box = h("div", "cartao col-12");
    box.appendChild(h("div", "cartao-titulo", "Acessos ao módulo"));
    box.appendChild(h("div", "coord-sub", "Quem está nesta lista pode ver e editar Contratos & Budget — e também gerenciar esta lista. (Padrão inicial: você e o joao@.)"));
    let lista = allowlist().slice();
    const wrap = h("div"); const ul = h("div"); ul.style.cssText = "display:flex;flex-direction:column;gap:6px;margin:8px 0";
    function desenhar() {
      ul.innerHTML = "";
      lista.forEach((em, idx) => { const row = h("div"); row.style.cssText = "display:flex;gap:8px;align-items:center"; row.appendChild(h("span", "ap-nome", em)); const b = h("button", "btn-excluir", "×"); b.type = "button"; b.title = "Remover"; b.addEventListener("click", () => { if (lista.length <= 1) { window.alert("Deixe pelo menos um usuário com acesso."); return; } lista.splice(idx, 1); desenhar(); }); row.appendChild(b); ul.appendChild(row); });
    }
    desenhar(); wrap.appendChild(ul);
    const addRow = h("div"); addRow.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap";
    const inpE = h("input", "kpi-inp kpi-inp-txt"); inpE.type = "email"; inpE.placeholder = "email@elevalife.com.br"; inpE.style.minWidth = "260px";
    const bAdd = h("button", "btn-cad-secundario", "+ Adicionar"); bAdd.type = "button"; bAdd.addEventListener("click", () => { const v = String(inpE.value || "").trim().toLowerCase(); if (!v || v.indexOf("@") === -1) { window.alert("Digite um e-mail válido."); return; } if (lista.indexOf(v) === -1) lista.push(v); inpE.value = ""; desenhar(); });
    addRow.appendChild(inpE); addRow.appendChild(bAdd);
    const bSalvar = h("button", "btn-cad-primario", "Salvar lista"); bSalvar.type = "button"; bSalvar.style.marginLeft = "8px";
    const msg = h("span", "aet-nota"); msg.style.margin = "0 0 0 8px";
    bSalvar.addEventListener("click", async () => {
      if (!podeGravar()) { msg.textContent = "Banco indisponível nesta visualização."; msg.style.color = "#C62828"; return; }
      bSalvar.disabled = true; msg.style.color = "#1E6B44"; msg.textContent = "Salvando…";
      try {
        const ex = docAcesso();
        await DB().salvar("contratoConfig", ex ? (ex._id || ex.id) : "acesso", { id: "acesso", EmpresaId: "GLOBAL", usuarios: lista }, !ex);
        await recarregar(["contratoConfig"]);
        if (BI.avisar) BI.avisar("Lista de acesso salva.");
        if (BI.atualizarAbaContratos) BI.atualizarAbaContratos();
        renderAcessos(area);
      } catch (e) { console.error(e); msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    addRow.appendChild(bSalvar); addRow.appendChild(msg);
    box.appendChild(wrap); box.appendChild(addRow); area.appendChild(box);
  }

  // ================================================================= importação da planilha
  function jaImportado() { return docsCoord().length > 0 || docsBudget().length > 0; }
  function botaoImportar(area) {
    if (!BI.ContratosSeed || jaImportado()) return null;
    const b = h("button", "btn-cad-secundario", "⬇ Importar da planilha"); b.type = "button";
    b.style.margin = "6px 0";
    b.title = "Importa uma vez os clientes/contratos e os meses de análise da planilha original.";
    b.addEventListener("click", () => importar(b, area));
    return b;
  }
  async function importar(botao, area) {
    const seed = BI.ContratosSeed; if (!seed) return;
    if (!podeGravar()) { window.alert("Banco indisponível nesta visualização."); return; }
    if (!window.confirm("Importar os clientes/contratos e os meses de análise da planilha original?")) return;
    if (botao) { botao.disabled = true; botao.textContent = "Importando…"; }
    try {
      const usados = {};
      for (const c of (seed.coordenadores || [])) {
        // id à prova de colisão: clientes com mesmo cliente+unidade ganham sufixo (-2, -3…)
        let base = "ct-" + slug(c.Cliente) + "-" + slug(c.Unidade || "");
        usados[base] = (usados[base] || 0) + 1;
        const id = usados[base] === 1 ? base : base + "-" + usados[base];
        await DB().salvar("contratoCoord", id, { EmpresaId: "GLOBAL", Cliente: c.Cliente, Unidade: c.Unidade || "", ClienteGrupo: c.ClienteGrupo || grupoDe(c.Cliente), Pacote: c.Pacote || "", Ergonomista: c.Ergonomista || "", CHSem: c.CHSem, Coordenador: c.Coordenador || "", ValorCtt: c.ValorCtt, VencContrato: c.VencContrato || "", MOAtual: c.MOAtual, BenefAtual: c.BenefAtual, Inativo: false }, true);
      }
      for (const b of (seed.budget || [])) {
        await DB().salvar("budgetMensal", idBudget(b.Ano, b.Mes), { EmpresaId: "GLOBAL", Ano: b.Ano, Mes: b.Mes, totalPrevisto: b.totalPrevisto, faturado: b.faturado, moUtilizada: b.moUtilizada, benUtilizado: b.benUtilizado }, true);
      }
      await recarregar();
      if (BI.avisar) BI.avisar("Planilha importada.");
      render();
    } catch (e) { console.error(e); window.alert("Não foi possível importar: " + (e && e.message ? e.message : e)); if (botao) { botao.disabled = false; botao.textContent = "⬇ Importar da planilha"; } }
  }

  // --------------------------------------------------- API pública
  BI.Contratos = {
    render,
    temAcesso,
    subabas: () => (temAcesso() ? SUBABAS.map((s) => ({ chave: s.chave, rotulo: s.rotulo })) : []),
    subAtiva: () => subAtiva,
    abrir: (chave) => { if (SUBABAS.some((s) => s.chave === chave)) subAtiva = chave; render(); },
  };
})(window);
