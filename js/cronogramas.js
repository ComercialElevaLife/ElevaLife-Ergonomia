/* ==========================================================================
   S.I.G.E - ElevaLife
   V 2.16 (Alexandre): Cronogramas (sub-aba do Ergonomista). Três cronogramas:
     - Avaliações: linhas por cliente+unidade; cada uma tem um detalhamento de
       setor/cargo/posto + quantidade (soma = Total necessário). A META mensal
       (coordenador) abastece o KPI "previsto de Análises". O Real do mês vem das
       AEP criadas no mês naquele cliente+unidade.
     - Validação: META mensal (coordenador) → KPI "previsto de Validações". Total =
       AEP criadas no sistema (cliente+unidade). Real do mês = AEP que viraram "Concluída".
     - Blitz ergonômica: sem total. META mensal (coordenador) → KPI "previsto de Ações
       ElevaLife". Real mensal é digitado pelo ergonomista e abastece a coluna
       "DDS / Treinamento / Blitz" do KPI (que já soma em Ações ElevaLife).
   Regra de vínculo: só abastece o KPI a linha que tem cliente E unidade.
   Dados GLOBAIS: coleção "cronograma", 1 doc por tipo/ergonomista/ano
   (id "cron-<tipo>-<slug(email)>-<ano>").
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const n0 = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const DB = () => BI.DB;

  function ident() { const d = DB(); return (d && d.estado && d.estado.identidade) || null; }
  function papel() { const i = ident(); return i ? i.papel : null; }
  const ehAdmin = () => papel() === "Administrador";
  const ehEquipe = () => papel() === "Administrador" || papel() === "Consultor";
  function emailAtual() { const i = ident(); return i ? String(i.email || "").toLowerCase() : ""; }
  function podeGravar() { const e = DB() && DB().estado; return !!(e && e.disponivel && !e.somenteLeitura && e.modoApi); }
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function mesDe(v) { return String(v == null ? "" : v).slice(0, 7); }

  // ---- cadastro (clientes/unidades) para os seletores
  function clientesCadastro() {
    return ((BI.dados && BI.dados.cliente) || []).map((c) => ({ id: c.id || c._id, nome: c.Cliente })).filter((c) => c.nome)
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }
  function unidadesDoCliente(nomeCliente) {
    const nc = norm(nomeCliente); if (!nc) return [];
    const cli = clientesCadastro().find((c) => norm(c.nome) === nc); if (!cli) return [];
    const eidDe = (u) => u.EmpresaId || (BI.DB && BI.DB.idCliente ? BI.DB.idCliente(u) : "");
    return ((BI.dados && BI.dados.unidade) || []).filter((u) => eidDe(u) === cli.id).map((u) => u.Unidade).filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
  }
  // V 2.16 (Alexandre): o cronograma é por conta de LOGIN (como a agenda). Lista os usuários.
  let _usuarios = null;
  async function carregarUsuarios() { if (_usuarios) return _usuarios; try { const r = await fetch("/api/usuarios", { credentials: "same-origin", cache: "no-store" }); _usuarios = r.ok ? await r.json() : []; } catch (e) { _usuarios = []; } return _usuarios; }

  // ---- dados
  function docs() { return (BI.dados && BI.dados.cronograma) || []; }
  function idCron(tipo, email, ano) { return "cron-" + tipo + "-" + slug(email) + "-" + ano; }
  function achar(tipo, email, ano) { const k = idCron(tipo, email, ano); return docs().find((d) => (d._id || d.id) === k); }
  function linhaVazia() { return { Cliente: "", Unidade: "", Meta: Array(12).fill(0), RealManual: Array(12).fill(0), Itens: [] }; }
  function normalizaLinha(l) {
    return { Cliente: l.Cliente || "", Unidade: l.Unidade || "", Meta: (l.Meta || []).slice(0, 12).concat(Array(12).fill(0)).slice(0, 12).map(n0), RealManual: (l.RealManual || []).slice(0, 12).concat(Array(12).fill(0)).slice(0, 12).map(n0), Itens: Array.isArray(l.Itens) ? l.Itens.map((i) => ({ Setor: i.Setor || "", Cargo: i.Cargo || "", Posto: i.Posto || "", Qtd: n0(i.Qtd) })) : [] };
  }

  // ---- real automático (a partir das AEP) por cliente+unidade no mês
  function aepReal(tipo, cliente, unidade, ano) {
    const c = norm(cliente), u = norm(unidade); const out = Array(12).fill(0); if (!c || !u) return out;
    (BI.dados && BI.dados.avaliacaoErgonomica || []).forEach((a) => {
      if (norm(a.Cliente) !== c || norm(a.Unidade) !== u) return;
      if (tipo === "avaliacoes") { const mm = mesDe(a["Data Avaliacao"]); if (mm.slice(0, 4) === String(ano)) out[Number(mm.slice(5, 7)) - 1]++; }
      else if (tipo === "validacao") { if (String(a["Status Avaliacao"] || "") === "Concluída") { const mm = mesDe(a["Dt Conclusao Avaliacao"]); if (mm.slice(0, 4) === String(ano)) out[Number(mm.slice(5, 7)) - 1]++; } }
    });
    return out;
  }

  // ================================================================= estado de UI
  const TIPOS = [
    { chave: "avaliacoes", rotulo: "Avaliações", kpi: "previsto de Análises" },
    { chave: "validacao", rotulo: "Validação", kpi: "previsto de Validações" },
    { chave: "blitz", rotulo: "Blitz ergonômica", kpi: "previsto de Ações ElevaLife + coluna DDS/Treinamento/Blitz" },
  ];
  let tipoAtivo = "avaliacoes";
  let anoCron = (new Date().getFullYear());
  let ergoAlvo = null;

  function listaErgos() {
    const meu = emailAtual();
    const base = [{ email: meu, nome: "Eu (" + meu + ")" }];
    (_usuarios || []).forEach((u) => { const em = String(u.Email || "").toLowerCase(); if (em && em !== meu) base.push({ email: em, nome: (u.Nome ? u.Nome + " — " : "") + em }); });
    return base;
  }

  function render(area) {
    area.innerHTML = "";
    if (!ehEquipe()) { area.appendChild(cartaoVazio("Cronogramas", "Área restrita à equipe ElevaLife.")); return; }
    if (!ergoAlvo) ergoAlvo = emailAtual();
    if (!ehAdmin()) ergoAlvo = emailAtual(); // consultor só vê/edita o próprio
    if (ehAdmin() && _usuarios === null) { carregarUsuarios().then(() => render(area)); }

    const box = h("div", "cartao col-12");
    const cab = h("div", "cadastro-cabecalho"); cab.appendChild(h("div", "cartao-titulo", "Cronogramas"));
    const ctrls = h("div", "kpi-ctrls");
    if (ehAdmin()) {
      const selE = h("select"); listaErgos().forEach((e) => { const o = h("option", null, e.nome); o.value = e.email; if (e.email === ergoAlvo) o.selected = true; selE.appendChild(o); });
      selE.addEventListener("change", () => { ergoAlvo = selE.value; render(area); });
      ctrls.appendChild(rotuloCampo("Ergonomista", selE));
    }
    const selA = h("select"); anosDisp().forEach((a) => { const o = h("option", null, String(a)); o.value = a; if (a === anoCron) o.selected = true; selA.appendChild(o); });
    selA.addEventListener("change", () => { anoCron = Number(selA.value); render(area); });
    ctrls.appendChild(rotuloCampo("Ano", selA));
    cab.appendChild(ctrls); box.appendChild(cab);

    // sub-nav dos tipos
    const nav = h("nav", "subnav-cadastro coord-subnav");
    TIPOS.forEach((t) => { const b = h("button", "subnav-cadastro-item" + (t.chave === tipoAtivo ? " ativa" : ""), t.rotulo); b.type = "button"; b.addEventListener("click", () => { tipoAtivo = t.chave; render(area); }); nav.appendChild(b); });
    box.appendChild(nav);

    const tdef = TIPOS.find((t) => t.chave === tipoAtivo) || TIPOS[0];
    box.appendChild(h("p", "aet-nota", notaDoTipo(tdef.chave)));

    // estado editável (cópia do doc salvo)
    const doc = achar(tipoAtivo, ergoAlvo, anoCron);
    const linhas = (doc && Array.isArray(doc.Linhas) ? doc.Linhas : []).map(normalizaLinha);

    box.appendChild(montarGrade(tipoAtivo, linhas, area));
    area.appendChild(box);
  }

  function notaDoTipo(tipo) {
    if (tipo === "avaliacoes") return "Para cada cliente+unidade, detalhe os setores/cargos/postos a avaliar e a quantidade (soma = Total necessário). Distribua a META mês a mês (coordenador) — ela abastece o “previsto de Análises” do KPI. O Real do mês vem automaticamente das AEP criadas no mês. Só abastece o KPI quem tem cliente E unidade.";
    if (tipo === "validacao") return "O total é a quantidade de AEP criadas no sistema (cliente+unidade). Distribua a META mês a mês (coordenador) — abastece o “previsto de Validações” do KPI. O Real do mês é quando a AEP vira “Concluída” (sai de “A validar”).";
    return "Blitz não tem total fixo. A META mensal (coordenador) abastece o “previsto de Ações ElevaLife”. O ergonomista preenche o Real de cada mês (quantas blitz fez), que abastece a coluna “DDS / Treinamento / Blitz” do KPI. Só abastece o KPI quem tem cliente E unidade.";
  }

  // ---- grade por cliente+unidade × 12 meses
  function montarGrade(tipo, linhas, area) {
    const admin = ehAdmin();
    const wrapOut = h("div");
    const wrap = h("div", "tabela-scroll contratos-scroll"); const t = h("table", "tabela-dados kpi-grade");
    const thead = h("thead"); const trh = h("tr");
    const cols = ["Cliente", "Unidade"];
    if (tipo === "avaliacoes") cols.push("Total nec.");
    if (tipo === "validacao") cols.push("Total (AEP)");
    cols.forEach((c) => trh.appendChild(h("th", null, c)));
    MESES_CURTO.forEach((m) => trh.appendChild(h("th", "num", m)));
    trh.appendChild(h("th", "num", "Σ meta")); trh.appendChild(h("th", null, ""));
    thead.appendChild(trh); t.appendChild(thead);
    const tbody = h("tbody"); t.appendChild(tbody);

    const dlCliId = "cron-cli-dl"; const dlCli = h("datalist"); dlCli.id = dlCliId; clientesCadastro().forEach((c) => { const o = h("option"); o.value = c.nome; dlCli.appendChild(o); }); wrapOut.appendChild(dlCli);
    let dlSeq = 0;

    function somaItens(l) { return (l.Itens || []).reduce((s, i) => s + n0(i.Qtd), 0); }

    function montarLinha(l) {
      const tr = h("tr");
      // Cliente
      const tdC = h("td"); const iC = h("input", "kpi-inp kpi-inp-txt"); iC.value = l.Cliente || ""; iC.setAttribute("list", dlCliId); iC.placeholder = "cliente";
      const tdU = h("td"); const iU = h("input", "kpi-inp kpi-inp-txt"); iU.value = l.Unidade || ""; iU.placeholder = "unidade";
      const dlU = h("datalist"); dlU.id = "cron-uni-" + (dlSeq++); iU.setAttribute("list", dlU.id);
      const encher = () => { dlU.innerHTML = ""; unidadesDoCliente(iC.value).forEach((u) => { const o = h("option"); o.value = u; dlU.appendChild(o); }); };
      encher(); iC.addEventListener("input", () => { l.Cliente = iC.value; encher(); }); iU.addEventListener("input", () => { l.Unidade = iU.value; });
      tdC.appendChild(iC); tdU.appendChild(iU); tdU.appendChild(dlU); tr.appendChild(tdC); tr.appendChild(tdU);

      let tdTot = null;
      if (tipo === "avaliacoes") { tdTot = h("td", "num", String(somaItens(l))); tr.appendChild(tdTot); }
      if (tipo === "validacao") { const real = aepRealTotalCriadas(l.Cliente, l.Unidade, anoCron); tr.appendChild(h("td", "num", String(real))); }

      // Meta mensal (editável só admin)
      const tdSoma = h("td", "num", "0");
      const recalcSoma = () => { tdSoma.textContent = String((l.Meta || []).reduce((s, v) => s + n0(v), 0)); };
      for (let m = 0; m < 12; m++) {
        const td = h("td", "num"); const i = h("input", "kpi-inp"); i.type = "number"; i.min = "0"; i.step = "1"; i.value = l.Meta[m] || 0;
        if (!admin) { i.readOnly = true; i.classList.add("kpi-inp-ro"); i.title = "Meta é definida pelo coordenador"; }
        else i.addEventListener("input", () => { l.Meta[m] = i.value === "" ? 0 : Number(i.value); recalcSoma(); });
        td.appendChild(i); tr.appendChild(td);
      }
      tr.appendChild(tdSoma); recalcSoma();
      // remover
      const tdX = h("td"); const bx = h("button", "btn-excluir", "×"); bx.type = "button"; bx.title = "Remover linha"; bx.addEventListener("click", () => { const i = linhas.indexOf(l); if (i >= 0) { linhas.splice(i, 1); redesenhar(); } }); tdX.appendChild(bx); tr.appendChild(tdX);
      tbody.appendChild(tr);

      // Blitz: segunda linha de REAL (editável pelo ergonomista)
      if (tipo === "blitz") {
        const trR = h("tr", "cron-real-row");
        trR.appendChild(h("td", null, "")); trR.appendChild(h("td", "aet-rot", "↳ Real (blitz feitas)"));
        for (let m = 0; m < 12; m++) {
          const td = h("td", "num"); const i = h("input", "kpi-inp"); i.type = "number"; i.min = "0"; i.step = "1"; i.value = l.RealManual[m] || 0;
          i.addEventListener("input", () => { l.RealManual[m] = i.value === "" ? 0 : Number(i.value); });
          td.appendChild(i); trR.appendChild(td);
        }
        trR.appendChild(h("td")); trR.appendChild(h("td")); tbody.appendChild(trR);
      }
      // Avaliações/Validação: linha de REAL (automática, só leitura)
      if (tipo === "avaliacoes" || tipo === "validacao") {
        const real = aepReal(tipo, l.Cliente, l.Unidade, anoCron);
        const trR = h("tr", "cron-real-row");
        trR.appendChild(h("td", null, "")); trR.appendChild(h("td", "aet-rot", "↳ Real (automático)"));
        if (tipo === "avaliacoes") trR.appendChild(h("td"));
        if (tipo === "validacao") trR.appendChild(h("td"));
        for (let m = 0; m < 12; m++) trR.appendChild(h("td", "num", String(real[m])));
        trR.appendChild(h("td", "num", String(real.reduce((s, v) => s + v, 0)))); trR.appendChild(h("td")); tbody.appendChild(trR);
      }

      // Avaliações: detalhamento setor/cargo/posto (expansível)
      if (tipo === "avaliacoes") {
        const trD = h("tr"); const tdD = h("td"); tdD.colSpan = 16; tdD.appendChild(detalheItens(l, tdTot)); trD.appendChild(tdD); tbody.appendChild(trD);
      }
    }

    function redesenhar() { tbody.innerHTML = ""; dlSeq = 0; linhas.forEach(montarLinha); }
    redesenhar();
    wrap.appendChild(t); wrapOut.appendChild(wrap);

    const rod = h("div"); rod.style.cssText = "margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
    const bAdd = h("button", "btn-cad-secundario", "+ Cliente/unidade"); bAdd.type = "button"; bAdd.addEventListener("click", () => { linhas.push(linhaVazia()); redesenhar(); });
    const bSalvar = h("button", "btn-cad-primario", "Salvar"); bSalvar.type = "button";
    const msg = h("span", "aet-nota"); msg.style.margin = "0";
    bSalvar.addEventListener("click", async () => {
      if (!podeGravar()) { msg.textContent = "Banco indisponível nesta visualização."; msg.style.color = "#C62828"; return; }
      bSalvar.disabled = true; msg.style.color = "#1E6B44"; msg.textContent = "Salvando…";
      try {
        const limpas = linhas.filter((l) => String(l.Cliente || "").trim()).map((l) => ({ Cliente: String(l.Cliente).trim(), Unidade: String(l.Unidade || "").trim(), Meta: l.Meta.map(n0), RealManual: l.RealManual.map(n0), Itens: (l.Itens || []).filter((i) => i.Setor || i.Cargo || i.Posto || i.Qtd).map((i) => ({ Setor: i.Setor || "", Cargo: i.Cargo || "", Posto: i.Posto || "", Qtd: n0(i.Qtd) })) }));
        const nome = (listaErgos().find((e) => e.email === ergoAlvo) || {}).nome || ergoAlvo;
        const doc = { EmpresaId: "GLOBAL", Tipo: tipoAtivo, Ano: anoCron, EmailErgonomista: ergoAlvo, Nome: nome, Linhas: limpas };
        const ex = achar(tipoAtivo, ergoAlvo, anoCron);
        await DB().salvar("cronograma", ex ? (ex._id || ex.id) : idCron(tipoAtivo, ergoAlvo, anoCron), doc, !ex);
        await DB().recarregar(["cronograma"]);
        if (BI.avisar) BI.avisar("Cronograma salvo.");
        render(area);
      } catch (e) { console.error("cron salvar", e); msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    rod.appendChild(bAdd);
    // V 2.19 (Alexandre): no cronograma de Avaliações, importar o cadastro (setor/cargo/posto) por planilha.
    if (tipo === "avaliacoes") {
      const bModelo = h("button", "btn-cad-secundario", "⬇ Modelo (planilha)"); bModelo.type = "button"; bModelo.title = "Baixa um Excel modelo com as colunas Cliente, Unidade, Setor, Cargo, Posto, Qtd.";
      bModelo.addEventListener("click", () => baixarModelo());
      const inpImp = h("input"); inpImp.type = "file"; inpImp.accept = ".xlsx,.xls,.csv"; inpImp.style.display = "none";
      const bImp = h("button", "btn-cad-secundario", "⬆ Importar planilha"); bImp.type = "button"; bImp.title = "Importa linhas (Cliente, Unidade, Setor, Cargo, Posto, Qtd) e agrupa por cliente+unidade.";
      bImp.addEventListener("click", () => inpImp.click());
      inpImp.addEventListener("change", () => { const f = inpImp.files && inpImp.files[0]; if (f) importarPlanilha(f, linhas, redesenhar, msg); inpImp.value = ""; });
      rod.appendChild(bModelo); rod.appendChild(bImp); rod.appendChild(inpImp);
    }
    if (ehEquipe()) rod.appendChild(bSalvar); rod.appendChild(msg);
    wrapOut.appendChild(rod);
    return wrapOut;
  }

  // V 2.19 (Alexandre): lê a planilha (XLSX/CSV) e agrupa por cliente+unidade em Itens.
  function importarPlanilha(file, linhas, redesenhar, msg) {
    if (typeof g.XLSX === "undefined") { if (msg) { msg.textContent = "Leitor de planilha não carregou."; msg.style.color = "#C62828"; } return; }
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const wb = g.XLSX.read(fr.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = g.XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) { if (msg) { msg.textContent = "Planilha vazia."; msg.style.color = "#C62828"; } return; }
        const pega = (o, nomes) => { for (const k of Object.keys(o)) { const nk = norm(k); if (nomes.some((n) => nk === norm(n))) return o[k]; } return ""; };
        let add = 0;
        rows.forEach((o) => {
          const cliente = String(pega(o, ["Cliente"]) || "").trim(); if (!cliente) return;
          const unidade = String(pega(o, ["Unidade"]) || "").trim();
          const setor = String(pega(o, ["Setor"]) || "").trim();
          const cargo = String(pega(o, ["Cargo"]) || "").trim();
          const posto = String(pega(o, ["Posto", "Posto de Trabalho", "Posto Trabalho"]) || "").trim();
          const qtd = n0(pega(o, ["Qtd", "Quantidade", "Qtde"]));
          // acha/cria a linha do cliente+unidade
          let linha = linhas.find((l) => norm(l.Cliente) === norm(cliente) && norm(l.Unidade) === norm(unidade));
          if (!linha) { linha = linhaVazia(); linha.Cliente = cliente; linha.Unidade = unidade; linhas.push(linha); }
          if (!Array.isArray(linha.Itens)) linha.Itens = [];
          linha.Itens.push({ Setor: setor, Cargo: cargo, Posto: posto, Qtd: qtd }); add++;
        });
        redesenhar();
        if (msg) { msg.style.color = "#1E6B44"; msg.textContent = add + " linha(s) importada(s). Confira e clique em Salvar."; }
      } catch (e) { console.error("import planilha cron", e); if (msg) { msg.textContent = "Erro ao ler a planilha: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; } }
    };
    fr.readAsArrayBuffer(file);
  }
  function baixarModelo() {
    if (typeof g.XLSX === "undefined") { window.alert("Leitor de planilha não carregou."); return; }
    const aoa = [["Cliente", "Unidade", "Setor", "Cargo", "Posto", "Qtd"], ["ACME", "Unidade 1", "Produção", "Operador", "Linha 1", 5]];
    const ws = g.XLSX.utils.aoa_to_sheet(aoa); const wb = g.XLSX.utils.book_new(); g.XLSX.utils.book_append_sheet(wb, ws, "Avaliações");
    g.XLSX.writeFile(wb, "modelo-cronograma-avaliacoes.xlsx");
  }

  // detalhamento setor/cargo/posto da avaliação (expansível)
  function detalheItens(l, tdTot) {
    const box = h("div", "cron-detalhe");
    const tog = h("button", "btn-cad-secundario", "▸ Setores/cargos/postos (" + (l.Itens || []).length + ")"); tog.type = "button";
    const cont = h("div"); cont.style.display = "none";
    let aberto = false; tog.addEventListener("click", () => { aberto = !aberto; cont.style.display = aberto ? "" : "none"; tog.textContent = (aberto ? "▾" : "▸") + " Setores/cargos/postos (" + (l.Itens || []).length + ")"; });
    const tb = h("table", "tabela-dados"); const thd = h("thead"); const trh = h("tr"); ["Setor", "Cargo", "Posto", "Qtd", ""].forEach((c) => trh.appendChild(h("th", null, c))); thd.appendChild(trh); tb.appendChild(thd); const body = h("tbody"); tb.appendChild(body);
    function somaTot() { if (tdTot) tdTot.textContent = String((l.Itens || []).reduce((s, i) => s + n0(i.Qtd), 0)); }
    function desenhar() {
      body.innerHTML = "";
      (l.Itens || []).forEach((it, idx) => {
        const tr = h("tr");
        const mk = (campo, tipo) => { const td = h("td"); const i = h("input", "kpi-inp " + (tipo === "number" ? "" : "kpi-inp-txt")); i.type = tipo || "text"; if (tipo === "number") { i.min = "0"; } i.value = it[campo] != null ? it[campo] : ""; i.addEventListener("input", () => { it[campo] = tipo === "number" ? n0(i.value) : i.value; if (campo === "Qtd") somaTot(); }); td.appendChild(i); return td; };
        tr.appendChild(mk("Setor")); tr.appendChild(mk("Cargo")); tr.appendChild(mk("Posto")); tr.appendChild(mk("Qtd", "number"));
        const tdx = h("td"); const bx = h("button", "btn-excluir", "×"); bx.type = "button"; bx.addEventListener("click", () => { l.Itens.splice(idx, 1); desenhar(); somaTot(); }); tdx.appendChild(bx); tr.appendChild(tdx);
        body.appendChild(tr);
      });
    }
    desenhar();
    const bAdd = h("button", "btn-cad-secundario", "+ Setor/cargo/posto"); bAdd.type = "button"; bAdd.style.marginTop = "6px"; bAdd.addEventListener("click", () => { if (!Array.isArray(l.Itens)) l.Itens = []; l.Itens.push({ Setor: "", Cargo: "", Posto: "", Qtd: 0 }); desenhar(); });
    cont.appendChild(tb); cont.appendChild(bAdd);
    box.appendChild(tog); box.appendChild(cont);
    return box;
  }

  function aepRealTotalCriadas(cliente, unidade, ano) { return aepReal("avaliacoes", cliente, unidade, ano).reduce((s, v) => s + v, 0); }

  function cartaoVazio(tit, txt) { const c = h("div", "cartao col-12"); c.appendChild(h("div", "cartao-titulo", tit)); c.appendChild(h("div", "coord-vazio", txt)); return c; }
  function rotuloCampo(rot, el) { const l = h("label", "kpi-campo"); l.appendChild(h("span", "aet-rot", rot)); l.appendChild(el); return l; }
  function anosDisp() { const a = new Date().getFullYear(); const set = new Set([2026, a, a + 1, anoCron]); return Array.from(set).sort(); }

  // ================================================================= API para o KPI
  // Previsto (e blitz real) por cliente+unidade no mês, agregando TODOS os cronogramas do ano.
  // Retorna { "<cliente>||<unidade>": { analisesPrev, validPrev, acoesElevaPrev, dds } }.
  function previstoDoMes(ano, mes) {
    const mapa = {};
    docs().forEach((d) => {
      if (Number(d.Ano) !== Number(ano)) return;
      (d.Linhas || []).forEach((l) => {
        const c = norm(l.Cliente), u = norm(l.Unidade); if (!c || !u) return;
        const k = c + "||" + u; const b = mapa[k] || (mapa[k] = { analisesPrev: 0, validPrev: 0, acoesElevaPrev: 0, dds: 0 });
        const meta = n0((l.Meta || [])[mes]);
        if (d.Tipo === "avaliacoes") b.analisesPrev += meta;
        else if (d.Tipo === "validacao") b.validPrev += meta;
        else if (d.Tipo === "blitz") { b.acoesElevaPrev += meta; b.dds += n0((l.RealManual || [])[mes]); }
      });
    });
    return mapa;
  }

  BI.Cronogramas = { render, previstoDoMes };
})(window);
