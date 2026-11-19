/* ==========================================================================
   S.I.G.E - ElevaLife
   V 2.17 (Alexandre): CASES — o ergonomista reporta cases (antes/depois), com
   foto OU vídeo (upload), risco antigo/atual e o impacto. Vincula a um cliente.
   O case precisa da APROVAÇÃO do coordenador (lista de aprovadores; padrão: o
   Administrador) antes de contar. Case aprovado abastece a coluna "Cases
   reportados" do KPI (mês a mês, pela data do case, respeitando cliente+unidade).
   Gera também um PPT de 1 slide padrão Eleva (antes/depois, risco e impacto).
   Coleções: caseErgo (1 doc por case, EmpresaId = cliente) e caseConfig
   (GLOBAL, doc "aprovadores").
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const n0 = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
  const DB = () => BI.DB;
  const APROV_PADRAO = ["alexandre.berloffa@elevalife.com.br"];
  const IMPACTOS = ["Redução no tempo de execução", "Melhora na produtividade"];
  const RISCOS = ["Altíssimo", "Alto", "Moderado", "Baixo", "Trivial"];

  function ident() { const d = DB(); return (d && d.estado && d.estado.identidade) || null; }
  function papel() { const i = ident(); return i ? i.papel : null; }
  const ehAdmin = () => papel() === "Administrador";
  const ehEquipe = () => papel() === "Administrador" || papel() === "Consultor";
  function emailAtual() { const i = ident(); return i ? String(i.email || "").toLowerCase() : ""; }
  function podeGravar() { const e = DB() && DB().estado; return !!(e && e.disponivel && !e.somenteLeitura && e.modoApi); }
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function mesDe(v) { return String(v == null ? "" : v).slice(0, 7); }
  function dataBR(iso) { if (!iso) return "—"; const [a, m, d] = String(iso).split("-"); return d + "/" + m + "/" + a; }

  function clientes() { return ((BI.dados && BI.dados.cliente) || []).map((c) => ({ id: c.id || c._id, nome: c.Cliente })).filter((c) => c.nome).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")); }
  function idDoCliente(nome) { const nc = norm(nome); const c = clientes().find((x) => norm(x.nome) === nc); return c ? c.id : ""; }
  function unidadesDoCliente(nome) {
    const id = idDoCliente(nome); if (!id) return [];
    const eidDe = (u) => u.EmpresaId || (BI.DB && BI.DB.idCliente ? BI.DB.idCliente(u) : "");
    return ((BI.dados && BI.dados.unidade) || []).filter((u) => eidDe(u) === id).map((u) => u.Unidade).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
  }

  function docs() { return (BI.dados && BI.dados.caseErgo) || []; }
  function configAprov() { const d = (BI.dados && BI.dados.caseConfig || []).find((x) => (x._id || x.id) === "aprovadores"); const arr = d && Array.isArray(d.usuarios) && d.usuarios.length ? d.usuarios : APROV_PADRAO; return arr.map((e) => String(e).toLowerCase()); }
  function podeAprovar() { return ehAdmin() || configAprov().indexOf(emailAtual()) !== -1; }

  // cases que o usuário pode ver: equipe vê todos; (cliente não entra nesta aba)
  function casesVisiveis() { return docs().slice().sort((a, b) => String(b.DataCase || "").localeCompare(String(a.DataCase || ""))); }

  let filtroStatus = "todos";
  let editId = null;

  function render() {
    const grade = document.getElementById("grade-cases");
    if (!grade) return;
    grade.innerHTML = "";
    if (!ehEquipe()) { grade.appendChild(cartao("Cases", h("div", "coord-vazio", "Área restrita à equipe ElevaLife."))); return; }

    // Cabeçalho + ações
    const box = h("div", "cartao col-12");
    const cab = h("div", "cadastro-cabecalho"); cab.appendChild(h("div", "cartao-titulo", "Cases"));
    const acoes = h("div", "kpi-ctrls");
    const bNovo = h("button", "btn-cad-primario", editId === "novo" ? "Fechar" : "+ Novo case"); bNovo.type = "button";
    bNovo.addEventListener("click", () => { editId = (editId === "novo" ? null : "novo"); render(); });
    acoes.appendChild(bNovo);
    if (podeAprovar()) { const bAp = h("button", "btn-cad-secundario", "Aprovadores"); bAp.type = "button"; bAp.addEventListener("click", () => abrirAprovadores()); acoes.appendChild(bAp); }
    cab.appendChild(acoes); box.appendChild(cab);
    box.appendChild(h("div", "coord-sub", "O ergonomista reporta o case (antes/depois, risco e impacto) e vincula a um cliente. Depois da aprovação do coordenador, o case entra na coluna “Cases reportados” do KPI (pela data do case)."));
    grade.appendChild(box);

    if (editId) grade.appendChild(formCase(editId));

    // Filtro de status
    const fbox = h("div", "cartao col-12");
    const fb = h("div", "contratos-filtros");
    const lab = h("label", "contratos-filtro"); lab.appendChild(h("span", "contratos-filtro-rot", "Status"));
    const sel = h("select", "kpi-inp"); [["todos", "Todos"], ["Pendente", "Pendentes"], ["Aprovado", "Aprovados"], ["Reprovado", "Reprovados"]].forEach(([v, r]) => { const o = h("option", null, r); o.value = v; if (v === filtroStatus) o.selected = true; sel.appendChild(o); });
    sel.addEventListener("change", () => { filtroStatus = sel.value; render(); });
    lab.appendChild(sel); fb.appendChild(lab); fbox.appendChild(fb);

    const lista = casesVisiveis().filter((c) => filtroStatus === "todos" || (c.Status || "Pendente") === filtroStatus);
    if (!lista.length) fbox.appendChild(h("div", "coord-vazio", "Nenhum case." ));
    else lista.forEach((c) => fbox.appendChild(cardCase(c)));
    grade.appendChild(fbox);
  }

  // ---- card de um case
  function cardCase(c) {
    const st = c.Status || "Pendente";
    const card = h("div", "case-card");
    const top = h("div", "case-top");
    const tit = h("div", "case-tit"); tit.appendChild(h("span", "ap-nome", c.Cliente || "—")); if (c.Unidade) tit.appendChild(h("span", "case-uni", " · " + c.Unidade)); tit.appendChild(h("span", "case-data", " · " + dataBR(c.DataCase)));
    const badge = h("span", "case-badge case-" + st.toLowerCase(), st);
    top.appendChild(tit); top.appendChild(badge); card.appendChild(top);

    const mid = h("div", "case-midias");
    mid.appendChild(midiaBox("Antes", c.MidiaAntesChave, c.MidiaAntesTipo));
    mid.appendChild(midiaBox("Depois", c.MidiaDepoisChave, c.MidiaDepoisTipo));
    card.appendChild(mid);

    const info = h("div", "case-info");
    info.appendChild(linhaInfo("Risco", (c.RiscoAntigo || "—") + "  →  " + (c.RiscoAtual || "—")));
    info.appendChild(linhaInfo("Impacto", (c.ImpactoTipo || "—") + (c.ImpactoDesc ? " — " + c.ImpactoDesc : "")));
    if (st === "Aprovado" && c.AprovadoPor) info.appendChild(linhaInfo("Aprovado por", c.AprovadoPor + (c.AprovadoEm ? " em " + dataBR(c.AprovadoEm) : "")));
    card.appendChild(info);

    const rod = h("div", "case-acoes");
    const bPpt = h("button", "btn-cad-secundario", "⬇ Gerar PPT"); bPpt.type = "button"; bPpt.addEventListener("click", () => gerarPPT(c, bPpt)); rod.appendChild(bPpt);
    if (podeAprovar() && st !== "Aprovado") { const b = h("button", "btn-cad-primario", "Aprovar"); b.type = "button"; b.addEventListener("click", () => mudarStatus(c, "Aprovado")); rod.appendChild(b); }
    if (podeAprovar() && st !== "Reprovado") { const b = h("button", "btn-cad-secundario", "Reprovar"); b.type = "button"; b.addEventListener("click", () => mudarStatus(c, "Reprovado")); rod.appendChild(b); }
    // editar/excluir: autor ou admin
    if (ehAdmin() || norm(c.EmailErgonomista) === norm(emailAtual())) {
      const be = h("button", "btn-acao-linha btn-acao-editar", "Editar"); be.type = "button"; be.addEventListener("click", () => { editId = (c._id || c.id); render(); }); rod.appendChild(be);
      const bx = h("button", "btn-acao-linha", "Excluir"); bx.type = "button"; bx.addEventListener("click", () => excluir(c)); rod.appendChild(bx);
    }
    card.appendChild(rod);
    if (editId === (c._id || c.id)) card.appendChild(formCase(c._id || c.id));
    return card;
  }
  function linhaInfo(rot, val) { const d = h("div", "case-linha"); d.appendChild(h("span", "case-rot", rot + ": ")); d.appendChild(h("span", null, val)); return d; }
  function midiaBox(rot, chave, tipo) {
    const box = h("div", "case-midia");
    box.appendChild(h("div", "case-midia-rot", rot));
    if (!chave) { box.appendChild(h("div", "case-midia-vazia", "— sem mídia —")); return box; }
    const url = DB().urlArquivo ? DB().urlArquivo(chave) : "";
    if (String(tipo || "").indexOf("video") === 0) { const v = h("video"); v.src = url; v.controls = true; v.className = "case-midia-el"; box.appendChild(v); }
    else { const img = h("img"); img.src = url; img.loading = "lazy"; img.className = "case-midia-el"; box.appendChild(img); }
    return box;
  }

  // ---- formulário de case
  function formCase(id) {
    const novo = id === "novo";
    const base = novo ? { Cliente: "", Unidade: "", DataCase: hojeISO(), RiscoAntigo: "", RiscoAtual: "", ImpactoTipo: IMPACTOS[0], ImpactoDesc: "", MidiaAntesChave: "", MidiaAntesTipo: "", MidiaDepoisChave: "", MidiaDepoisTipo: "", Status: "Pendente" } : Object.assign({}, docs().find((d) => (d._id || d.id) === id));
    const l = Object.assign({}, base);
    const box = h("div", "cartao col-12");
    box.appendChild(h("div", "cartao-titulo", novo ? "Novo case" : "Editar case"));
    const grid = h("div", "case-form");

    // Cliente (datalist) + Unidade (datalist)
    const dlC = h("datalist"); dlC.id = "case-cli-dl"; clientes().forEach((c) => { const o = h("option"); o.value = c.nome; dlC.appendChild(o); }); box.appendChild(dlC);
    const iCli = campo(grid, "Cliente *", "text", l.Cliente, (v) => { l.Cliente = v; encherUni(); }); iCli.setAttribute("list", "case-cli-dl");
    const dlU = h("datalist"); dlU.id = "case-uni-dl"; box.appendChild(dlU);
    const iUni = campo(grid, "Unidade", "text", l.Unidade, (v) => { l.Unidade = v; }); iUni.setAttribute("list", "case-uni-dl");
    function encherUni() { dlU.innerHTML = ""; unidadesDoCliente(l.Cliente).forEach((u) => { const o = h("option"); o.value = u; dlU.appendChild(o); }); }
    encherUni();
    campo(grid, "Data do case *", "date", l.DataCase, (v) => { l.DataCase = v; });
    campoSelect(grid, "Risco antigo", RISCOS, l.RiscoAntigo, (v) => { l.RiscoAntigo = v; });
    campoSelect(grid, "Risco atual", RISCOS, l.RiscoAtual, (v) => { l.RiscoAtual = v; });
    // Impacto
    const impSel = campoSelect(grid, "Impacto", IMPACTOS.concat(["Outro"]), (IMPACTOS.indexOf(l.ImpactoTipo) === -1 && l.ImpactoTipo ? "Outro" : l.ImpactoTipo), (v) => { l.ImpactoTipo = v; descWrap.style.display = (v === "Outro") ? "" : "none"; });
    const descWrap = h("div", "case-campo"); descWrap.style.display = (IMPACTOS.indexOf(l.ImpactoTipo) === -1 && l.ImpactoTipo) ? "" : "none";
    descWrap.appendChild(h("span", "aet-rot", "Descreva o impacto")); const iDesc = h("input", "kpi-inp kpi-inp-txt"); iDesc.value = (IMPACTOS.indexOf(l.ImpactoTipo) === -1 ? l.ImpactoTipo : "") || l.ImpactoDesc || ""; iDesc.addEventListener("input", () => { l.ImpactoDesc = iDesc.value; }); descWrap.appendChild(iDesc); grid.appendChild(descWrap);

    box.appendChild(grid);

    // Mídias (antes/depois) — foto ou vídeo por upload
    const mids = h("div", "case-form-midias");
    mids.appendChild(uploadMidia("Mídia ANTES (foto ou vídeo)", l, "MidiaAntes"));
    mids.appendChild(uploadMidia("Mídia DEPOIS (foto ou vídeo)", l, "MidiaDepois"));
    box.appendChild(mids);

    const rod = h("div", "case-acoes"); const msg = h("span", "aet-nota"); msg.style.margin = "0";
    const bSalvar = h("button", "btn-cad-primario", "Salvar case"); bSalvar.type = "button";
    bSalvar.addEventListener("click", async () => {
      if (!String(l.Cliente || "").trim()) { msg.textContent = "Informe o cliente."; msg.style.color = "#C62828"; return; }
      if (!String(l.DataCase || "").trim()) { msg.textContent = "Informe a data do case."; msg.style.color = "#C62828"; return; }
      if (!podeGravar()) { msg.textContent = "Banco indisponível nesta visualização."; msg.style.color = "#C62828"; return; }
      bSalvar.disabled = true; msg.style.color = "#1E6B44"; msg.textContent = "Salvando…";
      try {
        const cid = idDoCliente(l.Cliente);
        const doc = {
          EmpresaId: cid || "GLOBAL", Cliente: String(l.Cliente).trim(), Unidade: l.Unidade || "", DataCase: l.DataCase,
          RiscoAntigo: l.RiscoAntigo || "", RiscoAtual: l.RiscoAtual || "", ImpactoTipo: l.ImpactoTipo || "", ImpactoDesc: l.ImpactoTipo === "Outro" ? (iDesc.value || "") : (l.ImpactoDesc || ""),
          MidiaAntesChave: l.MidiaAntesChave || "", MidiaAntesTipo: l.MidiaAntesTipo || "", MidiaDepoisChave: l.MidiaDepoisChave || "", MidiaDepoisTipo: l.MidiaDepoisTipo || "",
          Status: novo ? "Pendente" : (l.Status || "Pendente"), EmailErgonomista: novo ? emailAtual() : (l.EmailErgonomista || emailAtual()),
        };
        if (!novo) { doc.AprovadoPor = l.AprovadoPor || ""; doc.AprovadoEm = l.AprovadoEm || ""; }
        await DB().salvar("caseErgo", novo ? null : id, doc, novo);
        await DB().recarregar(["caseErgo"]);
        editId = null; if (BI.avisar) BI.avisar("Case salvo."); render();
      } catch (e) { console.error("case salvar", e); msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    const bCanc = h("button", "btn-cad-secundario", "Cancelar"); bCanc.type = "button"; bCanc.addEventListener("click", () => { editId = null; render(); });
    rod.appendChild(bSalvar); rod.appendChild(bCanc); rod.appendChild(msg); box.appendChild(rod);
    return box;
  }

  function uploadMidia(rot, l, prefixo) {
    const box = h("div", "case-up");
    box.appendChild(h("div", "aet-rot", rot));
    const prev = h("div", "case-up-prev");
    const atualizarPrev = () => { prev.innerHTML = ""; const ch = l[prefixo + "Chave"], tp = l[prefixo + "Tipo"]; if (!ch) { prev.appendChild(h("div", "case-midia-vazia", "— sem mídia —")); return; } const url = DB().urlArquivo(ch); if (String(tp || "").indexOf("video") === 0) { const v = h("video"); v.src = url; v.controls = true; v.className = "case-midia-el"; prev.appendChild(v); } else { const img = h("img"); img.src = url; img.className = "case-midia-el"; prev.appendChild(img); } };
    atualizarPrev();
    const inp = h("input"); inp.type = "file"; inp.accept = "image/*,video/*";
    const st = h("span", "aet-nota"); st.style.margin = "0";
    inp.addEventListener("change", async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const cid = idDoCliente(l.Cliente);
      if (!cid) { st.textContent = "Selecione o cliente (cadastrado) antes de anexar."; st.style.color = "#C62828"; inp.value = ""; return; }
      st.style.color = "#1E6B44"; st.textContent = "Enviando…";
      try {
        const r = await DB().enviarArquivo("caseErgo", cid, f);
        const chave = (r && r.chave) ? r.chave : r;
        l[prefixo + "Chave"] = chave; l[prefixo + "Tipo"] = f.type || ""; atualizarPrev(); st.textContent = "Enviado.";
      } catch (e) { console.error("upload case", e); st.textContent = "Falha no envio: " + (e && e.message ? e.message : e); st.style.color = "#C62828"; }
    });
    box.appendChild(prev); box.appendChild(inp); box.appendChild(st);
    return box;
  }

  async function mudarStatus(c, status) {
    if (!podeAprovar()) return;
    if (!podeGravar()) { window.alert("Banco indisponível nesta visualização."); return; }
    const doc = Object.assign({}, c, { Status: status, AprovadoPor: status === "Aprovado" ? emailAtual() : (c.AprovadoPor || ""), AprovadoEm: status === "Aprovado" ? hojeISO() : (c.AprovadoEm || "") });
    delete doc._origem;
    try { await DB().salvar("caseErgo", c._id || c.id, doc, false); await DB().recarregar(["caseErgo"]); if (BI.avisar) BI.avisar("Case " + (status === "Aprovado" ? "aprovado" : "reprovado") + "."); render(); }
    catch (e) { window.alert("Erro: " + (e && e.message ? e.message : e)); }
  }
  async function excluir(c) {
    if (!window.confirm("Excluir este case?")) return;
    try { await DB().excluir("caseErgo", c._id || c.id); await DB().recarregar(["caseErgo"]); render(); }
    catch (e) { window.alert("Erro ao excluir: " + (e && e.message ? e.message : e)); }
  }

  // ---- aprovadores (allowlist)
  function abrirAprovadores() {
    const atual = configAprov();
    const txt = window.prompt("E-mails que podem aprovar cases (separados por vírgula):", atual.join(", "));
    if (txt == null) return;
    const usuarios = txt.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    DB().salvar("caseConfig", "aprovadores", { EmpresaId: "GLOBAL", usuarios }, !(BI.dados.caseConfig || []).some((x) => (x._id || x.id) === "aprovadores"))
      .then(() => DB().recarregar(["caseConfig"])).then(() => { if (BI.avisar) BI.avisar("Aprovadores atualizados."); render(); })
      .catch((e) => window.alert("Erro: " + (e && e.message ? e.message : e)));
  }

  // ---- PPT de 1 slide (padrão Eleva)
  async function gerarPPT(c, botao) {
    if (typeof g.PptxGenJS === "undefined") { window.alert("Biblioteca de PPT não carregou. Tente novamente em instantes."); return; }
    if (botao) { botao.disabled = true; botao.textContent = "Gerando…"; }
    try {
      const pptx = new g.PptxGenJS(); pptx.defineLayout({ name: "W", width: 13.33, height: 7.5 }); pptx.layout = "W";
      const VINHO = "6B2F37", CINZA = "5A5A5A";
      const s = pptx.addSlide(); s.background = { color: "FFFFFF" };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: VINHO } });
      s.addText("CASE ERGONÔMICO — ElevaLife", { x: 0.4, y: 0.12, w: 12.5, h: 0.66, color: "FFFFFF", fontSize: 24, bold: true, valign: "middle" });
      s.addText((c.Cliente || "—") + (c.Unidade ? " · " + c.Unidade : "") + "   |   " + dataBR(c.DataCase), { x: 0.4, y: 1.0, w: 12.5, h: 0.4, color: CINZA, fontSize: 14, bold: true });
      // imagens antes/depois
      const antes = await midiaParaPpt(c.MidiaAntesChave, c.MidiaAntesTipo);
      const depois = await midiaParaPpt(c.MidiaDepoisChave, c.MidiaDepoisTipo);
      s.addText("ANTES", { x: 0.6, y: 1.5, w: 5.8, h: 0.35, color: VINHO, bold: true, fontSize: 14, align: "center" });
      s.addText("DEPOIS", { x: 6.9, y: 1.5, w: 5.8, h: 0.35, color: VINHO, bold: true, fontSize: 14, align: "center" });
      colocarMidia(s, antes, 0.6, 1.9);
      colocarMidia(s, depois, 6.9, 1.9);
      // risco e impacto
      s.addText([
        { text: "Risco: ", options: { bold: true, color: VINHO } },
        { text: (c.RiscoAntigo || "—") + "  →  " + (c.RiscoAtual || "—"), options: { color: CINZA } },
      ], { x: 0.6, y: 6.2, w: 12.1, h: 0.4, fontSize: 15 });
      s.addText([
        { text: "Impacto: ", options: { bold: true, color: VINHO } },
        { text: (c.ImpactoTipo || "—") + (c.ImpactoDesc ? " — " + c.ImpactoDesc : ""), options: { color: CINZA } },
      ], { x: 0.6, y: 6.7, w: 12.1, h: 0.5, fontSize: 15 });
      await pptx.writeFile({ fileName: "Case - " + (c.Cliente || "cliente") + " - " + (c.DataCase || "") + ".pptx" });
    } catch (e) { console.error("ppt case", e); window.alert("Erro ao gerar PPT: " + (e && e.message ? e.message : e)); }
    finally { if (botao) { botao.disabled = false; botao.textContent = "⬇ Gerar PPT"; } }
  }
  function colocarMidia(s, m, x, y) {
    const W = 5.8, H = 4.0;
    if (m && m.img) { s.addImage({ data: m.img, x, y, w: W, h: H, sizing: { type: "contain", w: W, h: H } }); }
    else { s.addShape(g.PptxGenJS ? "rect" : "rect", { x, y, w: W, h: H, fill: { color: "F0ECEC" }, line: { color: "CCCCCC" } }); s.addText(m && m.video ? "🎬 Vídeo — ver no sistema" : "— sem mídia —", { x, y: y + 1.7, w: W, h: 0.6, align: "center", color: "888888", fontSize: 13 }); }
  }
  async function midiaParaPpt(chave, tipo) {
    if (!chave) return null;
    if (String(tipo || "").indexOf("video") === 0) return { video: true };
    try { const url = DB().urlArquivo(chave); const resp = await fetch(url, { credentials: "same-origin" }); const blob = await resp.blob(); const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); }); return { img: data }; }
    catch (e) { console.error("midia ppt", e); return null; }
  }

  // ================================================================= API p/ KPI
  // Cases APROVADOS por cliente+unidade no mês (pela DataCase). Só conta quem tem cliente E unidade.
  function reportadosDoMes(ano, mes) {
    const alvo = ano + "-" + String(mes + 1).padStart(2, "0"); const mapa = {};
    docs().forEach((c) => {
      if ((c.Status || "") !== "Aprovado") return;
      if (mesDe(c.DataCase) !== alvo) return;
      const cc = norm(c.Cliente), u = norm(c.Unidade); if (!cc || !u) return;
      const k = cc + "||" + u; mapa[k] = (mapa[k] || 0) + 1;
    });
    return mapa;
  }

  function cartao(tit, cont) { const c = h("div", "cartao col-12"); if (tit) c.appendChild(h("div", "cartao-titulo", tit)); if (cont) c.appendChild(cont); return c; }
  function hojeISO() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function campo(grid, rot, tipo, val, onIn) { const w = h("label", "case-campo"); w.appendChild(h("span", "aet-rot", rot)); const i = h("input", "kpi-inp kpi-inp-txt"); i.type = tipo || "text"; i.value = val || ""; i.addEventListener("input", () => onIn(i.value)); w.appendChild(i); grid.appendChild(w); return i; }
  function campoSelect(grid, rot, opcoes, val, onCh) { const w = h("label", "case-campo"); w.appendChild(h("span", "aet-rot", rot)); const s = h("select", "kpi-inp"); const o0 = h("option", null, "—"); o0.value = ""; s.appendChild(o0); opcoes.forEach((v) => { const o = h("option", null, v); o.value = v; if (v === val) o.selected = true; s.appendChild(o); }); s.addEventListener("change", () => onCh(s.value)); w.appendChild(s); grid.appendChild(w); return s; }

  BI.Cases = { render, reportadosDoMes };
})(window);
