/* ==========================================================================
   S.I.G.E - ElevaLife · V 1.42
   Análise crítica do Absenteísmo (PDF + Word) - pedido do Alexandre.

   Lê todo o absenteísmo do filtro, cruza com os riscos ergonômicos (Inventário)
   por setor/posto e com as ações concluídas (Plano de Ação geral + Plano de Ação
   do Absenteísmo), e gera um documento no padrão dos laudos (AEP/AET): PDF para
   baixar/imprimir e Word (.docx) editável.
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const Calc = () => BI.Calc;

  const NIVEL_ORD = { "Muito Alto": 4, Altíssimo: 5, Alto: 3, Moderado: 2, Medio: 2, Médio: 2, Baixo: 1, "Muito Baixo": 0 };
  const dataBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : (iso || "—"));
  const hojeBR = () => { const d = new Date(); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear(); };
  const soma = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
  const top = (mapa, n) => Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, n);

  // ---------------------------------------------------------------- análise
  function analisar(filtros) {
    const C = Calc(); const D = BI.dados;
    const cliente = (filtros.Cliente && filtros.Cliente[0]) || "";
    const abs = C.filtrar(D.absenteismo || [], filtros, ["Dt Afastamento"]);
    const du = C.filtrar(D.diasUteis || [], filtros, ["Ano/Mes Uteis"]);
    const fat = C.filtrar((D.fatorRisco || []).filter((f) => C.riscoAtivo(f)), filtros, []);
    const planoGeralConcl = C.filtrar((D.planoAcao || []).filter((a) => a["Dt Conclusao"]), filtros, ["Dt Conclusao"]);
    const acaoAbs = C.filtrar(D.acaoAbsenteismo || [], filtros, ["Dt Programada", "Dt Conclusao"]);
    const acaoAbsConcl = acaoAbs.filter((a) => a["Status Execucao"] === "Concluida" || a["Dt Conclusao"]);

    const totais = C.totaisMedOcup(abs, du);
    const colaboradoresAfastados = new Set(abs.map((a) => a.Matricula || a.Nome).filter(Boolean)).size;
    const diasPerdidos = soma(abs, (a) => a["Qtd Dias"]);

    // por setor: atestados, dias, risco ergonômico máximo
    const setores = {};
    abs.forEach((a) => { const s = a.Setor || "—"; const o = setores[s] || (setores[s] = { setor: s, atestados: 0, dias: 0, riscoMax: "", riscoOrd: -1 }); o.atestados++; o.dias += Number(a["Qtd Dias"]) || 0; });
    fat.forEach((f) => { const s = f.Setor || "—"; if (!setores[s]) return; const ord = NIVEL_ORD[f["Graduacao Risco"]] != null ? NIVEL_ORD[f["Graduacao Risco"]] : -1; if (ord > setores[s].riscoOrd) { setores[s].riscoOrd = ord; setores[s].riscoMax = f["Graduacao Risco"] || ""; } });
    const porSetor = Object.values(setores).sort((a, b) => b.dias - a.dias);

    // risco por setor (mesmo que não haja absenteísmo) - para o cruzamento
    const riscoSetor = {};
    fat.forEach((f) => { const s = f.Setor || "—"; const ord = NIVEL_ORD[f["Graduacao Risco"]] != null ? NIVEL_ORD[f["Graduacao Risco"]] : -1; if (!riscoSetor[s] || ord > riscoSetor[s].ord) riscoSetor[s] = { nivel: f["Graduacao Risco"] || "", ord }; });

    // top CIDs e segmentos
    const cids = {}; abs.forEach((a) => { const c = a["Cod CID"] || a["Cod CID"] || "—"; cids[c] = (cids[c] || 0) + 1; });
    const segs = {}; abs.forEach((a) => { const s = C.regiaoSemLado(a["Regiao Corporal"]) || "—"; segs[s] = (segs[s] || { atest: 0, dias: 0 }); segs[s].atest++; segs[s].dias += Number(a["Qtd Dias"]) || 0; });
    const segsFat = {}; fat.forEach((f) => { const s = C.regiaoSemLado(f["Segmento Corporal"]) || ""; if (s) segsFat[s] = (segsFat[s] || 0) + 1; });

    // cruzamento: setores com absenteísmo relevante E risco ergonômico Alto/Muito Alto
    const prioridades = porSetor.filter((s) => s.riscoOrd >= 3 && s.dias > 0)
      .map((s) => ({ setor: s.setor, dias: s.dias, atestados: s.atestados, risco: s.riscoMax }))
      .sort((a, b) => b.dias - a.dias);

    // correlação por segmento (absenteísmo x risco)
    const segCorr = Object.keys(segs).filter((s) => segsFat[s]).map((s) => ({ segmento: s, diasAbs: segs[s].dias, atestAbs: segs[s].atest, fatores: segsFat[s] })).sort((a, b) => b.diasAbs - a.diasAbs);

    return {
      cliente, filtros, abs, du, fat, totais, colaboradoresAfastados, diasPerdidos,
      porSetor, riscoSetor, cids: top(cids, 8), segs: Object.entries(segs).map(([k, v]) => [k, v]).sort((a, b) => b[1].dias - a[1].dias).slice(0, 8),
      prioridades, segCorr,
      planoGeralConcl, acaoAbs, acaoAbsConcl,
    };
  }

  // ---------------------------------------------------------------- textos (conhecimento técnico)
  function textos(an) {
    const fmt = (n) => (Number.isInteger(n) ? String(n) : Number(n).toFixed(2));
    const t = {};
    t.resumo = `No período e escopo filtrados foram registrados ${an.abs.length} atestado(s), totalizando ${an.diasPerdidos} dia(s) de trabalho perdido(s) e envolvendo ${an.colaboradoresAfastados} colaborador(es). A Taxa de Frequência calculada (NBR 14280) é de ${fmt(an.totais.taxaFrequencia)} casos por milhão de homens-hora trabalhadas (HHT). ` +
      (an.porSetor.length ? `O(s) setor(es) com maior perda de dias é(são) ${an.porSetor.slice(0, 3).map((s) => `${s.setor} (${s.dias} dia(s))`).join(", ")}.` : "Não há setores com dias perdidos no filtro atual.");
    t.metodo = "Esta análise crítica cruza o absenteísmo registrado (CID, dias perdidos e segmento corporal) com os riscos ergonômicos do Inventário de Riscos (AEP/AET) por setor e posto de trabalho, e com as ações já concluídas no Plano de Ação geral e no Plano de Ação específico do Absenteísmo. O objetivo é identificar onde o afastamento por saúde pode ter relação com a exposição ergonômica e priorizar as intervenções de maior impacto.";
    const prio = an.prioridades;
    t.cruzamento = prio.length
      ? `Foram identificados ${prio.length} setor(es) que concentram, ao mesmo tempo, perda relevante de dias por absenteísmo e risco ergonômico Alto ou Muito Alto no Inventário: ${prio.slice(0, 5).map((p) => `${p.setor} (risco ${String(p.risco).toLowerCase()}, ${p.dias} dia(s) perdido(s))`).join("; ")}. Esses setores devem ter prioridade nas ações de controle, pois a coincidência entre afastamento e risco ergonômico sugere nexo e maior potencial de retorno das intervenções.`
      : "Não foi identificada, no filtro atual, coincidência direta entre setores com alto absenteísmo e setores com risco ergonômico Alto/Muito Alto no Inventário. Ainda assim, recomenda-se acompanhar a evolução e revisar a cobertura das avaliações ergonômicas (AEP/AET).";
    t.segmento = an.segCorr.length
      ? `Na correlação por segmento corporal, destacam-se ${an.segCorr.slice(0, 4).map((s) => `${s.segmento} (${s.diasAbs} dia(s) de afastamento e ${s.fatores} fator(es) de risco mapeado(s))`).join("; ")}. A presença de fatores de risco ergonômico nos mesmos segmentos acometidos pelos afastamentos reforça a hipótese de origem ocupacional e orienta a escolha das medidas (engenharia e organizacionais).`
      : "Não há, no filtro atual, segmentos corporais com afastamento e fatores de risco mapeados simultaneamente.";
    const nConcl = an.planoGeralConcl.length + an.acaoAbsConcl.length;
    t.acoes = nConcl
      ? `Já foram concluídas ${nConcl} ação(ões) de controle (${an.planoGeralConcl.length} no Plano de Ação geral e ${an.acaoAbsConcl.length} no Plano de Ação do Absenteísmo). Recomenda-se monitorar o efeito dessas ações sobre a Taxa de Frequência e os dias perdidos nos meses seguintes, confirmando a eficácia antes de encerrar o acompanhamento.`
      : "Ainda não há ações concluídas registradas (Plano geral ou Plano do Absenteísmo). Recomenda-se iniciar o plano de ação priorizando os setores e segmentos destacados acima.";
    t.conclusao = (prio.length
      ? "Conclui-se que há setores em que o absenteísmo e o risco ergonômico se sobrepõem, indicando prioridade para medidas de engenharia (adequação de postos, dispositivos de auxílio) e organizacionais (rodízio, pausas, ritmo), seguidas de reavaliação. "
      : "Conclui-se que o absenteísmo atual não apresenta sobreposição direta com riscos ergonômicos Altos no Inventário; recomenda-se manter a vigilância e ampliar a cobertura das avaliações. ") +
      "Recomenda-se: (1) priorizar os setores destacados; (2) tratar os fatores de risco dos segmentos mais acometidos; (3) registrar e acompanhar as ações no Plano de Ação do Absenteísmo; (4) reavaliar a Taxa de Frequência mês a mês; e (5) integrar os achados às próximas AEP/AET dos postos envolvidos.";
    return t;
  }

  // ---------------------------------------------------------------- PDF (jsPDF)
  function gerarPDF(an, tx) {
    const Ctor = g.jspdf && g.jspdf.jsPDF; if (!Ctor) throw new Error("O gerador de PDF não carregou (jsPDF).");
    const doc = new Ctor({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const M = 48; let y = 0;
    const VINHO = [139, 58, 66], CINZA = [90, 80, 82], PRETO = [40, 30, 32];
    const novaPagina = () => { doc.addPage(); y = M; cabecalhoTopo(); };
    const garante = (h) => { if (y + h > H - M) novaPagina(); };
    function cabecalhoTopo() {
      doc.setFillColor(139, 58, 66); doc.rect(0, 0, W, 6, "F"); y = M;
    }
    function titulo(txt) { garante(28); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...VINHO); doc.text(txt, M, y); y += 8; doc.setDrawColor(220, 205, 205); doc.line(M, y, W - M, y); y += 14; }
    function paragrafo(txt) { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...PRETO); const linhas = doc.splitTextToSize(txt, W - 2 * M); linhas.forEach((ln) => { garante(14); doc.text(ln, M, y); y += 14; }); y += 6; }
    function tabela(cabs, linhas, larguras) {
      const larg = larguras.map((f) => f * (W - 2 * M));
      const desenhaLinha = (cells, bold, fill) => {
        const alturas = cells.map((c, i) => doc.splitTextToSize(String(c == null ? "" : c), larg[i] - 8).length);
        const nLin = Math.max.apply(null, alturas); const hLin = nLin * 12 + 8;
        garante(hLin);
        let x = M;
        if (fill) { doc.setFillColor(245, 239, 235); doc.rect(x, y - 2, W - 2 * M, hLin, "F"); }
        doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9); doc.setTextColor(...(bold ? VINHO : PRETO));
        cells.forEach((c, i) => { const txt = doc.splitTextToSize(String(c == null ? "" : c), larg[i] - 8); doc.text(txt, x + 4, y + 10); x += larg[i]; });
        doc.setDrawColor(230, 220, 220); doc.line(M, y + hLin - 2, W - M, y + hLin - 2);
        y += hLin;
      };
      desenhaLinha(cabs, true, true);
      linhas.forEach((l) => desenhaLinha(l, false, false));
      y += 8;
    }
    // Capa / cabeçalho
    cabecalhoTopo();
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...VINHO);
    doc.text("Análise Crítica de Absenteísmo", M, y + 10); y += 34;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...CINZA);
    doc.text(an.cliente || "—", M, y); y += 16;
    doc.setFontSize(9.5); doc.text("Emitida em " + hojeBR() + " · S.I.G.E — ElevaLife", M, y); y += 10;
    const filtroTxt = ["Unidade", "Setor", "Cargo", "Posto Trabalho"].map((d) => (an.filtros[d] && an.filtros[d].length ? d + ": " + an.filtros[d].join(", ") : "")).filter(Boolean).join(" · ");
    if (filtroTxt) { doc.text(doc.splitTextToSize("Filtro: " + filtroTxt, W - 2 * M), M, y += 14); }
    y += 18;

    titulo("1. Resumo"); paragrafo(tx.resumo);
    titulo("2. Metodologia"); paragrafo(tx.metodo);

    titulo("3. Absenteísmo por setor");
    tabela(["Setor", "Atestados", "Dias perdidos", "Risco ergonômico"],
      (an.porSetor.length ? an.porSetor : [{ setor: "—", atestados: 0, dias: 0, riscoMax: "—" }]).map((s) => [s.setor, s.atestados, s.dias, s.riscoMax || "—"]),
      [0.46, 0.16, 0.18, 0.20]);

    titulo("4. Principais CIDs e segmentos");
    tabela(["CID (nº de atestados)"], an.cids.length ? an.cids.map((c) => [c[0] + " — " + c[1]]) : [["—"]], [1]);
    tabela(["Segmento corporal", "Atestados", "Dias"], an.segs.length ? an.segs.map((s) => [s[0], s[1].atest, s[1].dias]) : [["—", 0, 0]], [0.5, 0.25, 0.25]);

    titulo("5. Cruzamento com os riscos ergonômicos"); paragrafo(tx.cruzamento); paragrafo(tx.segmento);
    if (an.prioridades.length) tabela(["Setor prioritário", "Risco", "Dias perdidos", "Atestados"], an.prioridades.slice(0, 10).map((p) => [p.setor, p.risco, p.dias, p.atestados]), [0.4, 0.2, 0.22, 0.18]);

    titulo("6. Ações de controle"); paragrafo(tx.acoes);
    const acoesLinhas = an.planoGeralConcl.slice(0, 12).map((a) => [a.Setor || "—", (a["Acao Recomendada"] || a["Acao"] || "—"), "Geral", dataBR(a["Dt Conclusao"])])
      .concat(an.acaoAbsConcl.slice(0, 12).map((a) => [a.Setor || "—", a["Acao Recomendada"] || "—", "Absenteísmo", dataBR(a["Dt Conclusao"])]));
    if (acoesLinhas.length) tabela(["Setor", "Ação concluída", "Origem", "Conclusão"], acoesLinhas, [0.26, 0.44, 0.16, 0.14]);

    titulo("7. Conclusão e recomendações"); paragrafo(tx.conclusao);

    // rodapé com paginação
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150, 140, 142); doc.text(`S.I.G.E — Análise Crítica de Absenteísmo — ${an.cliente || ""}`, M, H - 20); doc.text(`${i}/${n}`, W - M, H - 20, { align: "right" }); }
    return doc.output("blob");
  }

  // ---------------------------------------------------------------- DOCX (zip "store" + WordprocessingML)
  const TAB_CRC = (function () { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = TAB_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u8(s) { return new TextEncoder().encode(s); }
  function zipStore(arqs) {
    // arqs: [{nome, dados:Uint8Array}] -> Uint8Array (sem compressão)
    const locais = []; const central = []; let off = 0;
    const put16 = (a, v) => { a.push(v & 0xFF, (v >>> 8) & 0xFF); }; const put32 = (a, v) => { a.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); };
    const partes = [];
    arqs.forEach((f) => {
      const nome = u8(f.nome); const dados = f.dados; const crc = crc32(dados);
      const lh = []; put32(lh, 0x04034b50); put16(lh, 20); put16(lh, 0); put16(lh, 0); put16(lh, 0); put16(lh, 0);
      put32(lh, crc); put32(lh, dados.length); put32(lh, dados.length); put16(lh, nome.length); put16(lh, 0);
      const lhU = new Uint8Array(lh);
      partes.push(lhU, nome, dados);
      const ch = []; put32(ch, 0x02014b50); put16(ch, 20); put16(ch, 20); put16(ch, 0); put16(ch, 0); put16(ch, 0); put16(ch, 0);
      put32(ch, crc); put32(ch, dados.length); put32(ch, dados.length); put16(ch, nome.length); put16(ch, 0); put16(ch, 0); put16(ch, 0); put16(ch, 0); put32(ch, 0); put32(ch, off);
      central.push({ head: new Uint8Array(ch), nome }); off += lhU.length + nome.length + dados.length;
    });
    const centralIni = off; let centralLen = 0; const centralPartes = [];
    central.forEach((c) => { centralPartes.push(c.head, c.nome); centralLen += c.head.length + c.nome.length; });
    const eocd = []; put32(eocd, 0x06054b50); put16(eocd, 0); put16(eocd, 0); put16(eocd, arqs.length); put16(eocd, arqs.length); put32(eocd, centralLen); put32(eocd, centralIni); put16(eocd, 0);
    const todas = partes.concat(centralPartes, [new Uint8Array(eocd)]);
    let tam = 0; todas.forEach((p) => { tam += p.length; }); const out = new Uint8Array(tam); let p = 0; todas.forEach((x) => { out.set(x, p); p += x.length; });
    return out;
  }
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function par(txt, opc) { opc = opc || {}; const rPr = `<w:rPr>${opc.bold ? "<w:b/>" : ""}${opc.sz ? `<w:sz w:val="${opc.sz}"/>` : ""}${opc.color ? `<w:color w:val="${opc.color}"/>` : ""}</w:rPr>`; const pPr = `<w:pPr>${opc.heading ? `<w:pStyle w:val="Heading${opc.heading}"/>` : ""}${opc.space ? `<w:spacing w:before="${opc.space}" w:after="80"/>` : "<w:spacing w:after=\"80\"/>"}</w:pPr>`; return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(txt)}</w:t></w:r></w:p>`; }
  function tabelaXml(cabs, linhas) {
    const cell = (txt, bold) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p><w:pPr><w:spacing w:after="20"/></w:pPr><w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${esc(txt)}</w:t></w:r></w:p></w:tc>`;
    const linhaXml = (cells, bold) => `<w:tr>${cells.map((c) => cell(c, bold)).join("")}</w:tr>`;
    const borda = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="DDD0D0"/><w:left w:val="single" w:sz="4" w:color="DDD0D0"/><w:bottom w:val="single" w:sz="4" w:color="DDD0D0"/><w:right w:val="single" w:sz="4" w:color="DDD0D0"/><w:insideH w:val="single" w:sz="4" w:color="DDD0D0"/><w:insideV w:val="single" w:sz="4" w:color="DDD0D0"/></w:tblBorders>';
    return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borda}</w:tblPr>${linhaXml(cabs, true)}${linhas.map((l) => linhaXml(l.map(String), false)).join("")}</w:tbl>` + par("");
  }
  function gerarDOCX(an, tx) {
    const corpo = [];
    corpo.push(par("Análise Crítica de Absenteísmo", { bold: true, sz: 36, color: "8B3A42" }));
    corpo.push(par(an.cliente || "—", { bold: true, sz: 24 }));
    corpo.push(par("Emitida em " + hojeBR() + " · S.I.G.E — ElevaLife", { sz: 18, color: "5A5052" }));
    const filtroTxt = ["Unidade", "Setor", "Cargo", "Posto Trabalho"].map((d) => (an.filtros[d] && an.filtros[d].length ? d + ": " + an.filtros[d].join(", ") : "")).filter(Boolean).join(" · ");
    if (filtroTxt) corpo.push(par("Filtro: " + filtroTxt, { sz: 18, color: "5A5052" }));
    const sec = (titulo, paras, tabela) => { corpo.push(par(titulo, { bold: true, sz: 26, color: "8B3A42", space: 200 })); (paras || []).forEach((p) => corpo.push(par(p, { sz: 20 }))); if (tabela) corpo.push(tabela); };
    sec("1. Resumo", [tx.resumo]);
    sec("2. Metodologia", [tx.metodo]);
    sec("3. Absenteísmo por setor", [], tabelaXml(["Setor", "Atestados", "Dias perdidos", "Risco ergonômico"], (an.porSetor.length ? an.porSetor : [{ setor: "—", atestados: 0, dias: 0, riscoMax: "—" }]).map((s) => [s.setor, s.atestados, s.dias, s.riscoMax || "—"])));
    sec("4. Principais CIDs e segmentos", [], tabelaXml(["Segmento corporal", "Atestados", "Dias"], an.segs.length ? an.segs.map((s) => [s[0], s[1].atest, s[1].dias]) : [["—", 0, 0]]));
    corpo.push(tabelaXml(["CID", "Atestados"], an.cids.length ? an.cids.map((c) => [c[0], c[1]]) : [["—", 0]]));
    sec("5. Cruzamento com os riscos ergonômicos", [tx.cruzamento, tx.segmento], an.prioridades.length ? tabelaXml(["Setor prioritário", "Risco", "Dias perdidos", "Atestados"], an.prioridades.slice(0, 12).map((p) => [p.setor, p.risco, p.dias, p.atestados])) : null);
    const acoesLinhas = an.planoGeralConcl.slice(0, 15).map((a) => [a.Setor || "—", (a["Acao Recomendada"] || a["Acao"] || "—"), "Geral", dataBR(a["Dt Conclusao"])]).concat(an.acaoAbsConcl.slice(0, 15).map((a) => [a.Setor || "—", a["Acao Recomendada"] || "—", "Absenteísmo", dataBR(a["Dt Conclusao"])]));
    sec("6. Ações de controle", [tx.acoes], acoesLinhas.length ? tabelaXml(["Setor", "Ação concluída", "Origem", "Conclusão"], acoesLinhas) : null);
    sec("7. Conclusão e recomendações", [tx.conclusao]);

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
    const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    const zip = zipStore([
      { nome: "[Content_Types].xml", dados: u8(contentTypes) },
      { nome: "_rels/.rels", dados: u8(rels) },
      { nome: "word/document.xml", dados: u8(documentXml) },
      { nome: "word/_rels/document.xml.rels", dados: u8(docRels) },
    ]);
    return new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  function baixar(blob, nome) {
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function gerar(filtros) {
    const an = analisar(filtros); const tx = textos(an);
    const base = "analise-critica-absenteismo-" + String(an.cliente || "empresa").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().slice(0, 40);
    try { baixar(gerarPDF(an, tx), base + ".pdf"); } catch (e) { console.error("PDF analise", e); throw e; }
    try { baixar(gerarDOCX(an, tx), base + ".docx"); } catch (e) { console.error("DOCX analise", e); }
    if (BI.avisar) BI.avisar("Análise crítica de absenteísmo gerada (PDF e Word).");
  }

  BI.AnaliseAbsenteismo = { gerar, analisar };
})(window);
