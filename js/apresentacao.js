/* ==========================================================================
   S.I.G.E - ElevaLife
   V 2.18 (Alexandre): "Gerar apresentação" (sub-aba da Coordenação). Monta um
   PowerPoint padrão Eleva com os KPIs/gráficos do mês (versão simplificada, no
   mesmo espírito da apresentação mensal da diretoria): capa, performance dos 4
   indicadores (previsto × realizado), riscos do inventário, inconsistências,
   faturamento e gastos, cases aprovados e encerramento. Usa PptxGenJS.
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const n0 = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const VINHO = "6B2F37", VINHO2 = "8E1B3A", CINZA = "5A5A5A", VERDE = "1E6B44";
  const DB = () => BI.DB;
  const ehAdmin = () => { const i = DB() && DB().estado && DB().estado.identidade; return !!(i && i.papel === "Administrador"); };

  // ---- leitura de dados
  function docOp(ano, mes) { return (BI.dados && BI.dados.kpiOperacional || []).find((d) => Number(d.Ano) === Number(ano) && Number(d.Mes) === Number(mes)); }
  function docInc(ano) { return (BI.dados && BI.dados.kpiInconsistencia || []).find((d) => Number(d.Ano) === Number(ano)); }
  function budget(ano, mes) { return (BI.dados && BI.dados.budgetMensal || []).find((d) => Number(d.Ano) === Number(ano) && Number(d.Mes) === Number(mes)); }
  const CONT = ["juridico", "pcd", "dds", "coergo", "outras"];
  function elevaReal(l) { return CONT.reduce((s, c) => s + n0(l[c]), 0); }

  // Totais de um indicador no mês: {prev, real}
  function totInd(ano, mes, chave) {
    const d = docOp(ano, mes); if (!d || !Array.isArray(d.Linhas)) return { prev: 0, real: 0 };
    let p = 0, r = 0;
    d.Linhas.forEach((l) => {
      if (chave === "analises") { p += n0(l.analisesPrev); r += n0(l.analisesReal); }
      else if (chave === "valid") { p += n0(l.validPrev); r += n0(l.validReal); }
      else if (chave === "acoesCli") { p += n0(l.acoesCliPrev); r += n0(l.acoesCliReal); }
      else if (chave === "acoesEleva") { p += n0(l.acoesElevaPrev); r += elevaReal(l); }
    });
    return { prev: p, real: r };
  }
  function nUnidades(ano, mes) { const d = docOp(ano, mes); return d && Array.isArray(d.Linhas) ? d.Linhas.filter((l) => String(l.Cliente || "").trim()).length : 0; }
  function somaRiscos(ano, mes) { const d = docOp(ano, mes); const nivs = ["riscoAltissimo", "riscoAlto", "riscoModerado", "riscoBaixo", "riscoTrivial", "reducaoRisco"]; const r = {}; nivs.forEach((k) => (r[k] = 0)); (d && d.Linhas || []).forEach((l) => nivs.forEach((k) => (r[k] += n0(l[k])))); return r; }
  function incPorMes(ano) { const d = docInc(ano); const tot = Array(12).fill(0); (d && d.Linhas || []).forEach((l) => { for (let m = 0; m < 12; m++) { const v = l.meses && l.meses[m]; const s = String(v == null ? "" : v).toUpperCase(); if (s === "NA" || s === "N/A") continue; tot[m] += n0(v); } }); return tot; }
  function casesAprovados(ano, mes) { const alvo = ano + "-" + String(mes + 1).padStart(2, "0"); return (BI.dados && BI.dados.caseErgo || []).filter((c) => (c.Status || "") === "Aprovado" && String(c.DataCase || "").slice(0, 7) === alvo); }

  // ================================================================= UI
  let apAno = (new Date().getFullYear()), apMes = (new Date().getMonth());
  function render(area) {
    area.innerHTML = "";
    if (!ehAdmin()) { const c = h("div", "cartao col-12"); c.appendChild(h("div", "coord-vazio", "Área restrita ao coordenador (Administrador).")); area.appendChild(c); return; }
    const box = h("div", "cartao col-12");
    box.appendChild(h("div", "cartao-titulo", "Gerar apresentação (PowerPoint)"));
    box.appendChild(h("div", "coord-sub", "Monta uma apresentação padrão Eleva com os KPIs do mês: capa, performance dos 4 indicadores (previsto × realizado), riscos do inventário, inconsistências Sólides, faturamento, gastos, cases aprovados e encerramento. (Versão simplificada — evolui para ficar igual à da diretoria.)"));
    const ctrls = h("div", "kpi-ctrls");
    const selA = h("select"); anos().forEach((a) => { const o = h("option", null, String(a)); o.value = a; if (a === apAno) o.selected = true; selA.appendChild(o); }); selA.addEventListener("change", () => { apAno = Number(selA.value); });
    const selM = h("select"); MESES.forEach((m, i) => { const o = h("option", null, m); o.value = i; if (i === apMes) o.selected = true; selM.appendChild(o); }); selM.addEventListener("change", () => { apMes = Number(selM.value); });
    ctrls.appendChild(rot("Ano", selA)); ctrls.appendChild(rot("Mês", selM));
    box.appendChild(ctrls);
    const bGerar = h("button", "btn-cad-primario", "⬇ Gerar apresentação"); bGerar.type = "button"; bGerar.style.marginTop = "10px";
    const msg = h("span", "aet-nota"); msg.style.marginLeft = "10px";
    bGerar.addEventListener("click", () => gerar(apAno, apMes, bGerar, msg));
    box.appendChild(bGerar); box.appendChild(msg);
    area.appendChild(box);
  }
  function anos() { const a = new Date().getFullYear(); const set = new Set([2026, a, a + 1, apAno]); return Array.from(set).sort(); }
  function rot(r, el) { const l = h("label", "kpi-campo"); l.appendChild(h("span", "aet-rot", r)); l.appendChild(el); return l; }

  // ================================================================= PPT
  async function gerar(ano, mes, botao, msg) {
    if (typeof g.PptxGenJS === "undefined") { if (msg) { msg.textContent = "Biblioteca de PPT não carregou — tente de novo em instantes."; msg.style.color = "#C62828"; } return; }
    if (botao) { botao.disabled = true; botao.textContent = "Gerando…"; }
    if (msg) { msg.style.color = "#1E6B44"; msg.textContent = "Montando a apresentação…"; }
    try {
      const pptx = new g.PptxGenJS();
      pptx.defineLayout({ name: "ELEVA", width: 13.33, height: 7.5 }); pptx.layout = "ELEVA";
      const W = 13.33;
      const header = (s, titulo, sub) => {
        s.background = { color: "FFFFFF" };
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.95, fill: { color: VINHO } });
        s.addText(titulo, { x: 0.5, y: 0.12, w: W - 1, h: 0.7, color: "FFFFFF", fontSize: 24, bold: true, valign: "middle" });
        if (sub) s.addText(sub, { x: 0.5, y: 1.05, w: W - 1, h: 0.4, color: CINZA, fontSize: 14, bold: true });
      };

      // 1) Capa
      const c1 = pptx.addSlide(); c1.background = { color: VINHO };
      c1.addText("APRESENTAÇÃO MENSAL KPI'S", { x: 0.8, y: 2.6, w: W - 1.6, h: 1.0, color: "FFFFFF", fontSize: 40, bold: true });
      c1.addText("Referente ao mês de " + MESES[mes] + " " + ano, { x: 0.8, y: 3.8, w: W - 1.6, h: 0.6, color: "F3D9DF", fontSize: 20 });
      c1.addText("ElevaLife · elevando pessoas e resultados", { x: 0.8, y: 6.6, w: W - 1.6, h: 0.4, color: "F3D9DF", fontSize: 13 });

      // 2) Divisor RECORRENTES
      const c2 = pptx.addSlide(); c2.background = { color: "FFFFFF" };
      c2.addShape(pptx.ShapeType.rect, { x: 0, y: 3.1, w: W, h: 1.3, fill: { color: VINHO } });
      c2.addText("RECORRENTES", { x: 0, y: 3.1, w: W, h: 1.3, color: "FFFFFF", fontSize: 34, bold: true, align: "center", valign: "middle" });

      // 3-6) Performance dos indicadores
      const inds = [["analises", "PERFORMANCE DIAGNÓSTICO"], ["valid", "PERFORMANCE VALIDAÇÃO"], ["acoesCli", "PERFORMANCE AÇÕES CLIENTE"], ["acoesEleva", "PERFORMANCE AÇÕES ELEVALIFE"]];
      const nUni = nUnidades(ano, mes);
      inds.forEach(([k, tit]) => {
        const t = totInd(ano, mes, k); const s = pptx.addSlide(); header(s, tit, nUni ? (nUni + " unidade(s)") : "");
        const pc = t.prev ? Math.round((t.real / t.prev) * 100) : 0;
        s.addText(t.real + " realizados de " + t.prev + " previstos", { x: 0.5, y: 1.6, w: W - 1, h: 0.6, color: VINHO, fontSize: 22, bold: true });
        s.addText(pc + "%", { x: 0.5, y: 2.2, w: 3, h: 1.0, color: pc >= 95 ? VERDE : (pc >= 80 ? "2E7D5B" : "C62828"), fontSize: 44, bold: true });
        s.addChart(pptx.ChartType.bar, [{ name: tit, labels: ["Previsto", "Realizado"], values: [t.prev, t.real] }], { x: 4.2, y: 2.0, w: 8.6, h: 4.8, chartColors: ["CDBFC0", VINHO2], showValue: true, barDir: "col", showLegend: false, valAxisHidden: false });
      });

      // 6b) Composição das Ações ElevaLife (donut)
      const dComp = docOp(ano, mes);
      const comp = [["Jurídico", "juridico"], ["PCD / Restritos", "pcd"], ["DDS / Treino / Blitz", "dds"], ["COERGO", "coergo"], ["Outras demandas", "outras"]].map(([rot, k]) => ({ rot, val: (dComp && dComp.Linhas || []).reduce((s, l) => s + n0(l[k]), 0) }));
      const totC = comp.reduce((s, x) => s + x.val, 0);
      if (totC > 0) {
        const sc = pptx.addSlide(); header(sc, "PERFORMANCE AÇÕES ELEVALIFE", "Composição — " + totC + " atividades");
        sc.addChart(pptx.ChartType.doughnut, [{ name: "Composição", labels: comp.map((x) => x.rot), values: comp.map((x) => x.val) }], { x: 2.3, y: 1.6, w: 8.7, h: 5.2, showPercent: true, showValue: false, showLegend: true, legendPos: "r", chartColors: ["8B3A42", "E8731A", "3A6EA5", "2E7D5B", "7A5195"], holeSize: 55 });
      }

      // 7) Riscos do inventário
      const r = somaRiscos(ano, mes); const s7 = pptx.addSlide(); header(s7, "RESULTADOS — Riscos e reduções", MESES[mes] + "/" + ano);
      s7.addChart(pptx.ChartType.bar, [{ name: "Riscos", labels: ["Altíssimo", "Alto", "Moderado", "Baixo", "Trivial", "Reduzidos"], values: [r.riscoAltissimo, r.riscoAlto, r.riscoModerado, r.riscoBaixo, r.riscoTrivial, r.reducaoRisco] }], { x: 0.6, y: 1.6, w: W - 1.2, h: 5.2, chartColors: ["6A1B2A", "C62828", "E8731A", "F2C200", "2E7D5B", "1565C0"], showValue: true, barDir: "col", showLegend: false });

      // 8) Inconsistências Sólides (ano)
      const inc = incPorMes(ano); const s8 = pptx.addSlide(); header(s8, "GESTÃO SÓLIDES — Inconsistências", "Total no ano: " + inc.reduce((a, b) => a + b, 0));
      s8.addChart(pptx.ChartType.line, [{ name: "Inconsistências", labels: MESES_CURTO.slice(), values: inc }], { x: 0.6, y: 1.6, w: W - 1.2, h: 5.2, chartColors: ["C0392B"], showValue: true, showLegend: false, lineDataSymbol: "circle" });

      // 9) Faturamento + 10) Gastos (se houver budget)
      const bud = budget(ano, mes);
      if (bud) {
        const B = n0(bud.totalPrevisto), C = n0(bud.faturado), I = n0(bud.moUtilizada), L = n0(bud.benUtilizado);
        const pcF = B ? Math.round((C / B) * 100) : 0;
        const s9 = pptx.addSlide(); header(s9, "FATURAMENTO — RECORRENTES", "Valor faturado / previsto");
        s9.addText(pcF + "% faturado", { x: 0.5, y: 1.6, w: 5, h: 0.8, color: VINHO, fontSize: 26, bold: true });
        s9.addChart(pptx.ChartType.bar, [{ name: "R$", labels: ["Previsto", "Faturado"], values: [Math.round(B), Math.round(C)] }], { x: 0.6, y: 2.5, w: W - 1.2, h: 4.3, chartColors: ["CDBFC0", VINHO2], showValue: true, barDir: "col", showLegend: false });
        const tetoMO = C * 0.3, tetoBEN = C * 0.05; const pcG = (tetoMO + tetoBEN) ? Math.round(((I + L) / (tetoMO + tetoBEN)) * 100) : 0;
        const s10 = pptx.addSlide(); header(s10, "GASTOS — RECORRENTES", "Budget gasto (MO + BEN) / disponível");
        s10.addText(pcG + "% do budget", { x: 0.5, y: 1.6, w: 6, h: 0.8, color: VINHO, fontSize: 26, bold: true });
        s10.addChart(pptx.ChartType.bar, [{ name: "MO", labels: ["Disponível", "Gasto"], values: [Math.round(tetoMO), Math.round(I)] }, { name: "BEN", labels: ["Disponível", "Gasto"], values: [Math.round(tetoBEN), Math.round(L)] }], { x: 0.6, y: 2.5, w: W - 1.2, h: 4.3, chartColors: ["CDBFC0", VINHO2], showValue: true, barDir: "col", showLegend: true, legendPos: "b" });
      }

      // 11) Cases aprovados do mês
      const cs = casesAprovados(ano, mes); const s11 = pptx.addSlide(); header(s11, "CASES — reportados no mês", cs.length + " case(s) aprovado(s)");
      if (!cs.length) s11.addText("Nenhum case aprovado neste mês.", { x: 0.6, y: 2.0, w: W - 1.2, h: 0.6, color: CINZA, fontSize: 16 });
      else {
        const linhas = cs.slice(0, 10).map((c) => [{ text: (c.Cliente || "—") + (c.Unidade ? " · " + c.Unidade : "") }, { text: (c.RiscoAntigo || "—") + " → " + (c.RiscoAtual || "—") }, { text: (c.ImpactoTipo || "—") + (c.ImpactoDesc ? " — " + c.ImpactoDesc : "") }]);
        const header3 = [{ text: "Cliente / Unidade", options: { bold: true, color: "FFFFFF", fill: VINHO } }, { text: "Risco", options: { bold: true, color: "FFFFFF", fill: VINHO } }, { text: "Impacto", options: { bold: true, color: "FFFFFF", fill: VINHO } }];
        s11.addTable([header3].concat(linhas), { x: 0.6, y: 1.6, w: W - 1.2, colW: [3.6, 3.2, 5.3], fontSize: 12, border: { type: "solid", color: "E0D2D2", pt: 1 }, valign: "middle" });
      }
      // 11b) Um slide por case (antes/depois com imagem), até 6 cases
      for (const c of cs.slice(0, 6)) {
        const s = pptx.addSlide(); header(s, "CASE — " + (c.Cliente || "—") + (c.Unidade ? " · " + c.Unidade : ""), (c.RiscoAntigo || "—") + "  →  " + (c.RiscoAtual || "—"));
        s.addText("ANTES", { x: 0.6, y: 1.5, w: 5.8, h: 0.35, color: VINHO, bold: true, fontSize: 14, align: "center" });
        s.addText("DEPOIS", { x: 6.9, y: 1.5, w: 5.8, h: 0.35, color: VINHO, bold: true, fontSize: 14, align: "center" });
        const ma = await midiaImg(c.MidiaAntesChave, c.MidiaAntesTipo), md = await midiaImg(c.MidiaDepoisChave, c.MidiaDepoisTipo);
        colocarMidia(pptx, s, ma, 0.6, 1.9); colocarMidia(pptx, s, md, 6.9, 1.9);
        s.addText([{ text: "Impacto: ", options: { bold: true, color: VINHO } }, { text: (c.ImpactoTipo || "—") + (c.ImpactoDesc ? " — " + c.ImpactoDesc : ""), options: { color: CINZA } }], { x: 0.6, y: 6.3, w: W - 1.2, h: 0.7, fontSize: 15 });
      }

      // 12) Encerramento
      const c12 = pptx.addSlide(); c12.background = { color: VINHO };
      c12.addText("MUITO OBRIGADO!", { x: 0.8, y: 3.0, w: W - 1.6, h: 1.0, color: "FFFFFF", fontSize: 40, bold: true, align: "center" });
      c12.addText("@elevalifebrasil", { x: 0.8, y: 4.2, w: W - 1.6, h: 0.5, color: "F3D9DF", fontSize: 18, align: "center" });

      await pptx.writeFile({ fileName: "Apresentacao KPIs - " + MESES[mes] + " " + ano + ".pptx" });
      if (msg) { msg.style.color = "#1E6B44"; msg.textContent = "Apresentação gerada."; }
    } catch (e) { console.error("apresentacao", e); if (msg) { msg.textContent = "Erro ao gerar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; } }
    finally { if (botao) { botao.disabled = false; botao.textContent = "⬇ Gerar apresentação"; } }
  }

  // mídia do case → {img:dataURL} (foto) ou {video:true}; null se não houver
  async function midiaImg(chave, tipo) {
    if (!chave) return null;
    if (String(tipo || "").indexOf("video") === 0) return { video: true };
    try { const url = DB().urlArquivo(chave); const resp = await fetch(url, { credentials: "same-origin" }); const blob = await resp.blob(); const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); }); return { img: data }; }
    catch (e) { console.error("midia aprese", e); return null; }
  }
  function colocarMidia(pptx, s, m, x, y) {
    const w = 5.8, hh = 4.0;
    if (m && m.img) s.addImage({ data: m.img, x, y, w, h: hh, sizing: { type: "contain", w, h: hh } });
    else { s.addShape(pptx.ShapeType.rect, { x, y, w, h: hh, fill: { color: "F0ECEC" }, line: { color: "CCCCCC" } }); s.addText(m && m.video ? "🎬 Vídeo — ver no sistema" : "— sem mídia —", { x, y: y + 1.7, w, h: 0.6, align: "center", color: "888888", fontSize: 13 }); }
  }

  BI.Apresentacao = { render };
})(window);
