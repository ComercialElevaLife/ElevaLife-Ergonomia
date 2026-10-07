/* ==========================================================================
   S.I.G.E. - ElevaLife
   LAUDO (AEP) EM WORD (.docx) - V 1.9. Mesmo conteudo do PDF (BI.Laudo.gerar), mas
   em documento editavel: titulos com estilos do Word (Titulo 1/2/3), sumario como
   campo do Word, numeracao "Pagina X de Y" por campo, tabelas e imagens nativas.
   Todo o texto vem do Editor de Texto (BI.LaudoTextos + modelo de laudo).

   Sem biblioteca externa: o .docx e um zip (armazenado, sem compressao) com
   WordprocessingML escrito aqui mesmo.

   API:  BI.LaudoDocx.construir(ctx, opcoes) -> Promise<ArrayBuffer>
         (ctx vem de preparar() em js/laudo.js; use BI.Laudo.gerarDocx(opcoes))
   ========================================================================== */
(function (global) {
  "use strict";
  const BI = (global.BI = global.BI || {});

  const TW = 10206; // largura util da pagina em twips (A4, margens de 1,5 cm)
  const FONTE = "Calibri";

  // ---------------------------------------------------------------- zip (store)
  const TABELA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = TABELA_CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const utf8 = (s) => new TextEncoder().encode(s);
  function criarZip(arquivos) { // [{ nome, dados: Uint8Array }]
    const partes = []; const central = []; let desloc = 0;
    const d = new Date(); const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    arquivos.forEach((a) => {
      const nome = utf8(a.nome); const crc = crc32(a.dados); const tam = a.dados.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, hora, true); lh.setUint16(12, data, true); lh.setUint32(14, crc, true); lh.setUint32(18, tam, true); lh.setUint32(22, tam, true);
      lh.setUint16(26, nome.length, true); lh.setUint16(28, 0, true);
      partes.push(new Uint8Array(lh.buffer), nome, a.dados);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, hora, true); ch.setUint16(14, data, true); ch.setUint32(16, crc, true); ch.setUint32(20, tam, true); ch.setUint32(24, tam, true);
      ch.setUint16(28, nome.length, true); ch.setUint32(42, desloc, true);
      central.push(new Uint8Array(ch.buffer), nome);
      desloc += 30 + nome.length + tam;
    });
    const tamCentral = central.reduce((s, x) => s + x.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
    fim.setUint32(12, tamCentral, true); fim.setUint32(16, desloc, true);
    const todos = partes.concat(central, [new Uint8Array(fim.buffer)]);
    const total = todos.reduce((s, x) => s + x.length, 0); const saida = new Uint8Array(total); let p = 0;
    todos.forEach((x) => { saida.set(x, p); p += x.length; });
    return saida;
  }

  // ---------------------------------------------------------------- xml
  const esc = (s) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const hex = (c) => (Array.isArray(c) ? c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase() : c);

  function run(txt, o) {
    o = o || {};
    const rpr = [`<w:rFonts w:ascii="${o.fonte || FONTE}" w:hAnsi="${o.fonte || FONTE}" w:cs="${o.fonte || FONTE}"/>`];
    if (o.b) rpr.push("<w:b/><w:bCs/>");
    if (o.i) rpr.push("<w:i/><w:iCs/>");
    if (o.caps) rpr.push("<w:caps/>");
    if (o.cor) rpr.push(`<w:color w:val="${hex(o.cor)}"/>`);
    if (o.tam) rpr.push(`<w:sz w:val="${Math.round(o.tam * 2)}"/><w:szCs w:val="${Math.round(o.tam * 2)}"/>`);
    const partes = String(txt == null ? "" : txt).split("\n");
    const corpo = partes.map((t, k) => (k ? "<w:br/>" : "") + `<w:t xml:space="preserve">${esc(t)}</w:t>`).join("");
    return `<w:r><w:rPr>${rpr.join("")}</w:rPr>${corpo}</w:r>`;
  }
  // **negrito** e *italico* (mesma convencao do Editor de Texto)
  function rico(txt, base) {
    base = base || {};
    const saida = [];
    String(txt == null ? "" : txt).replace(/\n/g, " ").split("**").forEach((trecho, i) => {
      trecho.split("*").forEach((t, j) => { if (t) saida.push(run(t, Object.assign({}, base, { b: base.b || i % 2 === 1, i: base.i || j % 2 === 1 }))); });
    });
    return saida.join("");
  }
  function par(conteudo, o) {
    o = o || {};
    const ppr = [];
    if (o.estilo) ppr.push(`<w:pStyle w:val="${o.estilo}"/>`);
    if (o.manter) ppr.push("<w:keepNext/>");
    if (o.quebraAntes) ppr.push("<w:pageBreakBefore/>");
    if (o.lista) ppr.push('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
    if (o.bordaEsq) ppr.push(`<w:pBdr><w:left w:val="single" w:sz="24" w:space="6" w:color="${hex(o.bordaEsq)}"/></w:pBdr>`);
    if (o.fundo) ppr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${hex(o.fundo)}"/>`);
    if (o.tabs) ppr.push(`<w:tabs>${o.tabs}</w:tabs>`);
    ppr.push(`<w:spacing w:before="${o.antes || 0}" w:after="${o.depois != null ? o.depois : 100}" w:line="${o.linha || 264}" w:lineRule="auto"/>`);
    if (o.recuo) ppr.push(`<w:ind w:left="${o.recuo}"${o.suspenso ? ` w:hanging="${o.suspenso}"` : ""}/>`);
    if (o.jc) ppr.push(`<w:jc w:val="${o.jc}"/>`);
    return `<w:p><w:pPr>${ppr.join("")}</w:pPr>${conteudo || ""}</w:p>`;
  }

  // celula: { t, b, cor, fundo, jc, tam, pilula, extra, span, paras }
  function celula(spec, larg) {
    if (typeof spec !== "object" || spec === null) spec = { t: spec };
    const tam = spec.tam || 8.5;
    let paras;
    if (spec.paras) paras = spec.paras;
    else if (spec.pilula) paras = par(run(spec.t, { b: true, cor: "FFFFFF", tam }), { jc: "center", depois: 0, antes: 20 });
    else {
      paras = par(rico(spec.t == null || spec.t === "" ? "-" : spec.t, { b: spec.b, cor: spec.cor, tam, i: spec.i }), { jc: spec.jc, depois: 0 });
      if (spec.extra) paras += par(run(spec.extra, { b: true, cor: "2E5F62", tam: tam - 0.6 }), { depois: 0 });
    }
    const fundo = spec.pilula || spec.fundo;
    const bordas = spec.bordas ? `<w:tcBorders>${spec.bordas}</w:tcBorders>` : "";
    return `<w:tc><w:tcPr><w:tcW w:w="${larg}" w:type="dxa"/>${spec.span ? `<w:gridSpan w:val="${spec.span}"/>` : ""}${bordas}${fundo ? `<w:shd w:val="clear" w:color="auto" w:fill="${hex(fundo)}"/>` : ""}<w:vAlign w:val="${spec.v || "center"}"/></w:tcPr>${paras}</w:tc>`;
  }
  // tbl(pcts, linhas, o): linhas = [[spec,...],...]; o.cab = [titulos]; o.zebra; o.semBorda
  function tbl(pcts, linhas, o) {
    o = o || {};
    const soma = pcts.reduce((s, v) => s + v, 0);
    const lw = pcts.map((v) => Math.round((v / soma) * TW));
    const bordaH = o.semBorda ? "" : '<w:top w:val="single" w:sz="4" w:space="0" w:color="D8B7BB"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D8B7BB"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D8B7BB"/>';
    const bordaB = o.bordaBranca ? '<w:insideV w:val="single" w:sz="12" w:space="0" w:color="FFFFFF"/><w:insideH w:val="single" w:sz="12" w:space="0" w:color="FFFFFF"/>' : "";
    let xml = `<w:tbl><w:tblPr><w:tblW w:w="${TW}" w:type="dxa"/><w:tblBorders>${bordaH}${bordaB}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="${o.margemV != null ? o.margemV : 50}" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="${o.margemV != null ? o.margemV : 50}" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
    xml += `<w:tblGrid>${lw.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
    const linhaXml = (cels, extra) => {
      let k = 0;
      const tcs = cels.map((c) => { const sp = (c && c.span) || 1; const w = lw.slice(k, k + sp).reduce((s, v) => s + v, 0); k += sp; return celula(c, w); }).join("");
      return `<w:tr><w:trPr><w:cantSplit/>${extra || ""}</w:trPr>${tcs}</w:tr>`;
    };
    if (o.cab) xml += linhaXml(o.cab.map((t) => ({ t, b: true, cor: "FFFFFF", fundo: o.corCab || "8B3A42", tam: o.tam || 8.5 })), "<w:tblHeader/>");
    linhas.forEach((l, i) => {
      const cels = l.map((c) => { const s = typeof c === "object" && c !== null ? c : { t: c }; return Object.assign({ tam: o.tam }, (!s.fundo && !s.pilula && o.zebra && i % 2 === 1) ? { fundo: "FAF6F3" } : {}, s); });
      xml += linhaXml(cels);
    });
    return xml + "</w:tbl>" + par("", { depois: 80, linha: 120 });
  }

  function imgXml(info, wEmu, hEmu, nome) {
    const id = info.id;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${wEmu}" cy="${hEmu}"/><wp:docPr id="${id}" name="${esc(nome || "Imagem " + id)}" descr="${esc(nome || "")}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${esc(nome || "Imagem " + id)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${info.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  const EMU_PT = 12700;

  // ---------------------------------------------------------------- imagens
  function dataUrlParaBytes(url) {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url || "");
    if (!m) return null;
    const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return { mime: m[1].toLowerCase(), bytes: u8 };
  }
  function carregarImagem(url) {
    return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  }
  async function registrarImagens(urls) { // -> { [dataUrl]: { rid, id, w, h, ext, bytes } }
    const mapa = {}; let n = 0;
    for (const url of urls) {
      if (!url || mapa[url]) continue;
      const im = await carregarImagem(url);
      if (!im) continue;
      let d = dataUrlParaBytes(url);
      if (!d) continue;
      if (d.mime !== "image/png" && d.mime !== "image/jpeg") { // converte outros formatos (webp, gif...) para PNG
        const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0);
        d = dataUrlParaBytes(c.toDataURL("image/png"));
      }
      n++;
      mapa[url] = { rid: "rIdImg" + n, id: 100 + n, w: im.naturalWidth, h: im.naturalHeight, ext: d.mime === "image/jpeg" ? "jpeg" : "png", bytes: d.bytes, arquivo: `image${n}.${d.mime === "image/jpeg" ? "jpeg" : "png"}` };
    }
    return mapa;
  }
  function qrComoPng(texto) {
    try {
      if (typeof global.qrcode !== "function") return null;
      const q = global.qrcode(0, "M"); q.addData(texto); q.make();
      const mc = q.getModuleCount(); const esc2 = 8; const borda = 2; const tam = (mc + borda * 2) * esc2;
      const c = document.createElement("canvas"); c.width = tam; c.height = tam; const x = c.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, tam, tam); x.fillStyle = "#000";
      for (let r = 0; r < mc; r++) for (let k = 0; k < mc; k++) if (q.isDark(r, k)) x.fillRect((k + borda) * esc2, (r + borda) * esc2, esc2, esc2);
      return c.toDataURL("image/png");
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- documento
  async function construir(ctx, opcoes) {
    const { Calc, Acoes, PAL, corNivel, dataBR, hojeISO, ROTULO_ESCALA, URL_VERIFICACAO, dadosAcao, avaliacoes, fatoresDoPosto, grau, pontos, rotCanon, acoesDe,
      nomeMatriz, escala, docCliente, responsavel, executor, assinantes, cacheImg, logoCliente, logoEleva, todosFatores, todasAcoes, concluidas, contaNivel, NIVEIS4,
      setoresAv, unidadesAv, periodo, emissao, codigo, revisao, texto, linhasDe, celulas, mapaDe, titDe } = ctx;

    // imagens: logotipo, fotos, assinaturas e QR Code
    const urlQr = qrComoPng(URL_VERIFICACAO + codigo);
    const urls = [logoCliente, logoEleva, urlQr].concat(Object.keys(cacheImg).map((k) => cacheImg[k]), assinantes.map((a) => a._assinatura));
    const imgs = await registrarImagens(urls);

    const C = { vinhoE: hex(PAL.vinhoE), vinho: hex(PAL.vinho), vinhoM: hex(PAL.vinhoM), suave: hex(PAL.suave), creme: hex(PAL.creme), texto: hex(PAL.texto), cinza: hex(PAL.cinza), teal: hex(PAL.teal), tealE: hex(PAL.tealE) };
    const toc = [];
    const sumarioFim = []; // marcador
    const B = []; // corpo (apos o sumario)

    // ---- blocos de texto
    const P = (txt, o) => par(rico(txt, { tam: 10, cor: C.texto }), Object.assign({ jc: "both", depois: 110 }, o));
    const paragrafos = (campo, o) => texto(campo).split(/\n{2,}/).map((t) => P(t, o)).join("");
    const lista = (itens) => itens.map((t) => par(rico(t, { tam: 10, cor: C.texto }), { lista: true, depois: 50 })).join("") + par("", { depois: 40, linha: 120 });
    const legenda = (txt) => par(rico(txt, { tam: 8.5, cor: C.cinza }), { depois: 120 });
    const H1 = (chave, padrao, novaPag) => { const t = titDe(chave, padrao); toc.push([1, t]); return par(run(t), { estilo: "Heading1", quebraAntes: !!novaPag }); };
    const H2 = (chave, padrao) => { const t = titDe(chave, padrao); toc.push([2, t]); return par(run(t), { estilo: "Heading2" }); };
    const H3 = (t) => par(run(t), { estilo: "Heading3" });
    const caixa = (titulo, paras, fundo) => tbl([100], [[{ paras: par(run(titulo, { b: true, cor: C.vinhoE, tam: 10 }), { depois: 60, bordaEsq: C.vinho }) + paras, fundo: fundo || C.creme }]], { semBorda: true, margemV: 90 });
    const azulejos = (itens) => tbl(itens.map(() => 1), [itens.map((it) => ({ paras: par(run(String(it.n), { b: true, cor: "FFFFFF", tam: 18 }), { jc: "center", depois: 0 }) + par(run(it.rot, { cor: "FFFFFF", tam: 8 }), { jc: "center", depois: 0 }), fundo: hex(it.cor) }))], { bordaBranca: true, semBorda: true, margemV: 90 });
    const imagemPar = (url, maxW, maxH, o) => {
      const info = imgs[url]; if (!info) return "";
      let w = maxW; let h = w * info.h / info.w; if (h > maxH) { h = maxH; w = h * info.w / info.h; }
      return par(imgXml(info, Math.round(w * EMU_PT), Math.round(h * EMU_PT), o && o.nome), { jc: (o && o.jc) || "left", depois: (o && o.depois) != null ? o.depois : 60 });
    };

    // ================================================================ 1 a 4
    B.push(H1("s1", "1. Apresentação", false), paragrafos("Apresentacao"));
    B.push(H1("s2", "2. A ElevaLife", false), paragrafos("Sobre ElevaLife"));
    {
      const et = linhasDe("Etapas Relacionamento"); const cols = 4; const linhas = [];
      for (let i = 0; i < et.length; i += cols) { const l = et.slice(i, i + cols).map((e, k) => ({ t: `${i + k + 1}. ${e}`, b: true, cor: C.vinhoE, fundo: C.creme, tam: 8.5 })); while (l.length < cols) l.push({ t: "", fundo: "FFFFFF" }); linhas.push(l); }
      B.push(tbl([1, 1, 1, 1], linhas, { bordaBranca: true, semBorda: true, margemV: 80 }));
    }
    B.push(H1("s3", "3. Responsabilidade técnica e execução", false), paragrafos("Responsabilidade"));
    B.push(tbl([1, 1], [[["Responsável técnico", responsavel], ["Ergonomista executor", executor]].map(([papel, p]) => ({
      paras: par(run(papel.toUpperCase(), { cor: C.cinza, tam: 7 }), { depois: 20 }) + par(run(p ? p.Nome : "-", { b: true, cor: C.vinhoE, tam: 11 }), { depois: 20 }) + par(run([p && p.Titulo, p && p.Registro].filter(Boolean).join("\n") || " ", { tam: 8.5, cor: C.texto }), { depois: 0 }),
      fundo: "FFFFFF", v: "top",
    }))], { margemV: 90 }));
    B.push(H1("s4", "4. Demanda do trabalho", false), paragrafos("Demanda Intro"), lista(linhasDe("Demanda")));

    // ================================================================ 5
    B.push(H1("s5", "5. Informações cadastrais da empresa", true));
    if (logoCliente && imgs[logoCliente]) B.push(imagemPar(logoCliente, 190, 52, { jc: "center", depois: 100, nome: "Logotipo do cliente" }));
    {
      const end = [docCliente.Logradouro, docCliente.Numero, docCliente.Complemento, docCliente.Bairro, [docCliente.Cidade, docCliente.Estado].filter(Boolean).join("/"), docCliente.CEP ? "CEP " + docCliente.CEP : ""].filter(Boolean).join(", ");
      const ficha = [["Razão social", opcoes.nomeCliente], ["CNPJ", docCliente.CNPJ], ["Inscrição estadual", docCliente["Inscricao Estadual"]], ["CNAE", docCliente.CNAE],
        ["Grau de risco (NR-04)", docCliente["Grau Risco NR4"]], ["Unidade avaliada", unidadesAv.join(" · ")], ["Endereço", end], ["Telefone", docCliente.Telefone],
        ["Postos avaliados", `${avaliacoes.length} posto(s) de trabalho`], ["Período da avaliação", periodo]].filter((r) => r[1]);
      B.push(tbl([30, 70], ficha.map((r) => [{ t: r[0], b: true, fundo: C.creme }, String(r[1])]), { tam: 9 }));
    }

    // ================================================================ 6
    B.push(H1("s6", "6. Fundamentação", true), H2("s61", "6.1 Ergonomia e os pilares da gestão ElevaLife"), paragrafos("Fundamentacao Ergonomia"));
    {
      const pil = celulas("Pilares"); const cols = Math.min(5, pil.length) || 1; const linhas = [];
      for (let i = 0; i < pil.length; i += cols) {
        const l = pil.slice(i, i + cols).map((r, k) => ({ paras: par(run(`${i + k + 1}. ${r[0]}`, { b: true, cor: C.vinhoE, tam: 8.5 }), { depois: 40 }) + par(run(r[1] || "", { tam: 8, cor: C.texto }), { depois: 0 }), fundo: C.creme, v: "top" }));
        while (l.length < cols) l.push({ t: "", fundo: "FFFFFF" }); linhas.push(l);
      }
      B.push(tbl(Array(cols).fill(1), linhas, { bordaBranca: true, semBorda: true, margemV: 80 }));
    }
    B.push(paragrafos("Pilar AEP"), H2("s62", "6.2 A NR-17 e a Avaliação Ergonômica Preliminar"), paragrafos("Fundamentacao NR17"));
    B.push(H2("s63", "6.3 Gestão do risco ergonômico no GRO/PGR (NR-01)"), paragrafos("Fundamentacao GRO"));
    B.push(caixa(titDe("caixa-prioridade", "Prioridade das medidas de prevenção"), par(rico(texto("Prioridade Medidas"), { tam: 9, cor: C.texto }), { jc: "both", depois: 0 })));

    // ================================================================ 7
    B.push(H1("s7", "7. Métodos e metodologia utilizada", false), paragrafos("Metodologia"));
    {
      const passos = linhasDe("Metodologia Passos");
      B.push(tbl(passos.map(() => 1), [passos.map((t) => ({ t, b: true, cor: C.vinhoE, fundo: C.creme, jc: "center", tam: 9 }))], { bordaBranca: true, semBorda: true, margemV: 90 }));
    }
    B.push(H2("s71", "7.1 As cinco etapas da gestão do risco ergonômico"), paragrafos("Etapas Intro"));
    {
      const cores = [C.vinho, C.teal, C.vinhoM, C.tealE, C.vinhoE]; const et = celulas("Etapas Cinco");
      B.push(tbl(et.map(() => 1), [et.map((r, k) => ({ paras: par(run(`${k + 1}  ${r[0]}`, { b: true, cor: "FFFFFF", tam: 9 }), { depois: 40 }) + par(run(r[1] || "", { cor: "FFFFFF", tam: 7.8 }), { depois: 0 }), fundo: cores[k % cores.length], v: "top" }))], { bordaBranca: true, semBorda: true, margemV: 90 }));
    }
    B.push(paragrafos("Etapas Nota"));
    {
      const CORES = ["E1EDF7", "E2F2E8", "FCF3D6", "FAE2E2"]; const pd = celulas("PDCA"); const linhas = [];
      for (let i = 0; i < pd.length; i += 2) linhas.push(pd.slice(i, i + 2).map((r, k) => ({ paras: par(run(r[0], { b: true, cor: C.vinhoE, tam: 9 }), { depois: 30 }) + par(run(r[1] || "", { tam: 8.5, cor: C.texto }), { depois: 0 }), fundo: CORES[(i + k) % 4], v: "top" })).concat(pd.length - i < 2 ? [{ t: "", fundo: "FFFFFF" }] : []));
      B.push(tbl([1, 1], linhas, { bordaBranca: true, semBorda: true, margemV: 90 }));
    }
    B.push(H2("s72", "7.2 Técnicas e instrumentos"), lista(linhasDe("Tecnicas")), paragrafos("AEP AET"));
    B.push(tbl([32, 68], celulas("Metodos").map((r) => [{ t: r[0], b: true }, r[1] || ""]), { cab: ["Norma / ferramenta", "Aplicação"], zebra: true }));
    B.push(H2("s73", "7.3 Lista de fatores de risco (ISO/TS 20646)"), paragrafos("ISO Intro"));
    B.push(tbl([10, 78, 12], Calc.GRUPOS_FATOR_RISCO.map((g, i) => [{ t: String(i + 1), jc: "center" }, g, { t: String(Calc.fatoresDoGrupo(g).length), jc: "center" }]), { cab: ["Grupo", "Descrição do grupo", "Fatores"], zebra: true }));
    B.push(legenda(texto("ISO Legenda")));
    B.push(H2("s74", "7.4 Guias de referência para graduação"), paragrafos("Guias Intro"), H3(titDe("adm", "Referência para postura – amplitude de movimento (ADM)")));
    B.push(tbl([14, 24, 12, 14, 18, 18], celulas("ADM Tabela").map((r) => [0, 1, 2, 3, 4, 5].map((c) => r[c] || "")), { cab: ["Segmento", "Postura", "Leve", "Moderada", "Acentuada", "Não recomendada"], zebra: true, tam: 8 }), legenda(texto("ADM Fonte")));
    texto("Escalas").split(/\n{2,}/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean)).filter((b) => b.length >= 2).forEach((b) => {
      const cab = b[1].split("|").map((c) => c.trim());
      B.push(par(run(b[0].toUpperCase(), { b: true, cor: C.tealE, tam: 8.5 }), { manter: true, depois: 40 }), tbl([30].concat(cab.slice(1).map(() => 70 / Math.max(cab.length - 1, 1))), b.slice(2).map((l) => l.split("|").map((c) => c.trim())), { cab, zebra: true, tam: 8 }));
    });
    B.push(legenda(texto("Escalas Legenda")));
    B.push(H2("s75", "7.5 Interfaces com as demais frentes da ElevaLife"), paragrafos("Interfaces Intro"));
    B.push(tbl([32, 68], celulas("Interfaces").map((r) => [{ t: r[0], b: true }, r[1] || ""]), { cab: ["Frente", "Como se conecta a esta AEP"], zebra: true }));

    // ================================================================ 8
    B.push(H1("s8", "8. Identificação e classificação do risco", true));
    {
      const defG = mapaDe("Gravidade"); const defP = mapaDe("Probabilidade"); const defN = mapaDe("Graduacao");
      B.push(paragrafos("Risco Intro"), H2("s81", "8.1 Gravidade e probabilidade"));
      B.push(tbl([26, 74], escala.map((g, i) => [{ t: `${Calc.rotuloEscala(nomeMatriz, g)} (${i + 1})`, b: true }, defG[g] || ""]), { cab: ["Gravidade", "Efeitos"], zebra: true }));
      B.push(tbl([26, 74], escala.map((g, i) => [{ t: `${Calc.rotuloEscala(nomeMatriz, g)} (${i + 1})`, b: true }, defP[g] || ""]), { cab: ["Probabilidade", "Perfil de exposição qualitativa"], zebra: true }));
      B.push(H2("s82", "8.2 Matriz de risco e graduação"), paragrafos("Matriz Intro"));
      {
        const n = escala.length; const rows = [];
        rows.push([{ t: "", fundo: "FFFFFF" }, { t: "GRAVIDADE", b: true, cor: "FFFFFF", fundo: C.vinho, jc: "center", span: n, tam: 8 }]);
        rows.push([{ t: "PROBABILIDADE", b: true, cor: "FFFFFF", fundo: C.vinho, tam: 7.5 }].concat(escala.map((g) => ({ t: Calc.rotuloEscala(nomeMatriz, g), b: true, cor: "FFFFFF", fundo: C.vinhoM, jc: "center", tam: 8 }))));
        for (let r = 0; r < n; r++) {
          const prob = escala[n - 1 - r];
          rows.push([{ t: Calc.rotuloEscala(nomeMatriz, prob), b: true, fundo: C.creme, jc: "right", tam: 8 }].concat(escala.map((g) => ({ t: String(Calc.pontuacaoDaMatriz(nomeMatriz, prob, g)), b: true, jc: "center", pilula: hex(corNivel(Calc.nivelDaMatriz(nomeMatriz, prob, g))), tam: 10 }))));
        }
        B.push(tbl([16].concat(escala.map(() => 84 / n)), rows, { bordaBranca: true, semBorda: true, margemV: 70 }));
      }
      const niveis = []; escala.forEach((p) => escala.forEach((g) => { const n = Calc.nivelDaMatriz(nomeMatriz, p, g); if (n && !niveis.includes(n)) niveis.push(n); }));
      B.push(tbl([14, 18, 68], niveis.map((n) => {
        const ps = []; escala.forEach((p) => escala.forEach((g) => { if (Calc.nivelDaMatriz(nomeMatriz, p, g) === n) ps.push(Calc.pontuacaoDaMatriz(nomeMatriz, p, g)); }));
        return [`${Math.min.apply(null, ps)} a ${Math.max.apply(null, ps)}`, { t: n, pilula: hex(corNivel(n)) }, defN[n] || ""];
      }), { cab: ["Pontuação", "Graduação", "Descrição do risco e conduta"], zebra: true }));
    }
    B.push(H2("s83", "8.3 Medidas de controle e risco residual"), paragrafos("Medidas Intro"));
    {
      const desc = linhasDe("Medidas Tipos"); const pil = [C.vinhoE, C.tealE, C.vinhoM];
      B.push(tbl([22, 78], (Acoes ? Acoes.tipos() : []).map((t, i) => [{ t: t.rotulo, pilula: pil[i % 3] }, desc[i % (desc.length || 1)] || ""]), {}));
    }
    B.push(caixa(titDe("caixa-residual", "Como o risco residual é calculado"), texto("Residual Caixa").split("\n").map((t) => par(rico(t, { tam: 9, cor: C.texto }), { jc: "both", depois: 50 })).join("")));

    // ================================================================ 9
    B.push(H1("s9", "9. Avaliações ergonômicas preliminares", true), paragrafos("Avaliacoes Intro"));
    let nFigura = 0;
    avaliacoes.forEach((av, i) => {
      const fatores = fatoresDoPosto(av);
      const titPosto = `9.${i + 1} ${av.Setor} – ${av["Posto Trabalho"]}`;
      toc.push([2, titPosto]);
      B.push(par(run(titPosto), { estilo: "Heading2", quebraAntes: i > 0 }));
      const campos = [["Setor", av.Setor], ["Posto de trabalho", av["Posto Trabalho"]], ["Cargo", av.Cargo], ["Atividade", av.Atividade], ["Jornada", av["Jornada de Trabalho"]], ["Pausas", av.Pausas], ["Rodízio", av.Rodizio], ["Histórico de acidentes e doenças", av["Historico Acidentes"]]].filter((c) => c[1]);
      {
        const linhas = [];
        for (let k = 0; k < campos.length; k += 2) {
          const l = campos.slice(k, k + 2).map((c) => ({ paras: par(run(c[0].toUpperCase(), { cor: C.cinza, tam: 6.5 }), { depois: 10 }) + par(run(String(c[1]), { tam: 9, cor: C.texto }), { depois: 0 }), fundo: C.creme, v: "top" }));
          if (l.length < 2) l.push({ t: "", fundo: "FFFFFF" }); linhas.push(l);
        }
        B.push(tbl([1, 1], linhas, { bordaBranca: true, semBorda: true, margemV: 70 }));
      }
      const fotos = (av.Fotos || []).filter((f) => f && f.chave && cacheImg[f.chave] && imgs[cacheImg[f.chave]]);
      for (let k = 0; k < fotos.length; k += 2) {
        const l = fotos.slice(k, k + 2).map((f) => {
          nFigura++;
          return { paras: imagemPar(cacheImg[f.chave], 235, 160, { jc: "center", depois: 30, nome: f.nomeArquivo || "Registro fotográfico" }) + par(run(`Figura ${nFigura} – ${(f.nomeArquivo || "registro fotográfico").replace(/\.[a-z0-9]+$/i, "").slice(0, 60)}`, { tam: 7.5, cor: C.cinza }), { depois: 0 }), fundo: "FFFFFF", v: "top" };
        });
        if (l.length < 2) l.push({ t: "", fundo: "FFFFFF" });
        B.push(tbl([1, 1], [l], { semBorda: true }));
      }
      if (av["Descricao Setor"]) B.push(H3(titDe("p-descsetor", "Descrição do setor")), P(av["Descricao Setor"]));
      if (av["Descricao Atividade Observada"]) B.push(H3(titDe("p-descatividade", "Descrição da atividade (tarefa real observada)")), P(av["Descricao Atividade Observada"]));
      if (av["Caracteristicas Trabalhadores"]) B.push(H3(titDe("p-caract", "Características dos trabalhadores")), P(av["Caracteristicas Trabalhadores"]));
      B.push(H3(titDe("p-panorama", "Panorama do posto")));
      const cnt = contaNivel(fatores);
      B.push(azulejos(NIVEIS4.map(([k, r]) => ({ n: cnt[k], rot: r, cor: corNivel(k) }))));
      B.push(tbl([8, 52, 11, 11, 18], Calc.GRUPOS_FATOR_RISCO.map((g, gi) => {
        const doGrupo = fatores.filter((f) => f.Grupo === g);
        const maior = doGrupo.map((f) => grau(f)).sort((a, b) => NIVEIS4.findIndex(([k]) => k === Calc.nivelCanonico(b)) - NIVEIS4.findIndex(([k]) => k === Calc.nivelCanonico(a)))[0];
        return [{ t: String(gi + 1), jc: "center" }, g, { t: String(Calc.fatoresDoGrupo(g).length), jc: "center" }, { t: String(doGrupo.length), jc: "center" }, maior ? { t: rotCanon(Calc.nivelCanonico(maior)), pilula: hex(corNivel(maior)) } : { t: "-", jc: "center", cor: C.cinza }];
      }), { cab: ["Grupo", "Grupo de fatores (ISO/TS 20646)", "Avaliados", "Com risco", "Diagnóstico"], zebra: true, tam: 8 }));
      B.push(H3(titDe("p-fatores", "Fatores de risco identificados, medidas e ações")));
      if (!fatores.length) B.push(P("Nenhum fator de risco com “Existe Fator de Risco: Sim” cadastrado para este posto de trabalho.", { cor: C.cinza }));
      fatores.forEach((fr) => {
        const gi = Calc.GRUPOS_FATOR_RISCO.indexOf(fr.Grupo); const fi = gi >= 0 ? Calc.fatoresDoGrupo(fr.Grupo).indexOf(fr.Fator) : -1;
        const codigoF = gi >= 0 ? `${gi + 1}.${fi >= 0 ? String.fromCharCode(97 + fi) : "?"}` : "";
        const g = grau(fr); const p = pontos(fr);
        B.push(tbl([80, 20], [[{ t: `${codigoF} ${fr.Fator || ""}`.trim(), b: true, cor: C.vinhoE, fundo: C.creme, tam: 9.5 }, { t: `${g}${p != null ? " · " + p : ""}`, pilula: hex(corNivel(g)), tam: 8 }]], { margemV: 70 }));
        B.push(tbl([1, 1, 1], [[
          ["Circunstância geradora", fr["Circunstancia Geradora"]], ["Consequência", fr.Consequencia], ["Medida de controle existente", fr["Medida Controle Existente"] || "Nenhuma medida de controle existente."],
        ].map(([t, v]) => ({ paras: par(run(t.toUpperCase(), { b: true, cor: C.cinza, tam: 6.5 }), { depois: 20 }) + par(run(String(v || "-"), { tam: 8.5, cor: C.texto }), { depois: 0 }), fundo: "FFFFFF", v: "top" }))], { semBorda: true }));
        B.push(par(run(`Gravidade ${Calc.rotuloEscala(nomeMatriz, fr.Criticidade) || "-"}  ×  Probabilidade ${Calc.rotuloEscala(nomeMatriz, fr.Probabilidade) || "-"}  =  Pontuação ${p != null ? p : "-"}`, { tam: 8.5, cor: C.texto }), { depois: 60 }));
        const acoesF = acoesDe(fr); const resumo = acoesF.length ? Acoes.resumoRisco(g, acoesF) : null;
        const lbl = (t) => ({ t, b: true, cor: C.cinza, tam: 7, fundo: "FFFFFF" });
        const cels = [lbl("RISCO DO FATOR"), { t: rotCanon(Calc.nivelCanonico(g)), pilula: hex(corNivel(g)), tam: 8 }];
        if (resumo) cels.push(lbl("PREVISTO"), { t: rotCanon(resumo.previsto), pilula: hex(corNivel(resumo.previsto)), tam: 8 }, lbl("REALIZADO"), { t: rotCanon(resumo.realizado), pilula: hex(corNivel(resumo.realizado)), tam: 8 });
        else cels.push({ t: "sem ação proposta (risco residual não calculado)", cor: C.cinza, tam: 8, span: 4, fundo: "FFFFFF" });
        B.push(tbl(resumo ? [17, 13, 13, 13, 13, 13] : [17, 13, 13, 13, 13, 13], [cels], { semBorda: true, bordaBranca: true }));
        if (acoesF.length) {
          const sorted = acoesF.slice().sort((a, b) => (Number(a["Nr Acao"]) || 0) - (Number(b["Nr Acao"]) || 0));
          B.push(tbl([9, 31, 16, 14, 14, 16], sorted.map((a) => { const d = dadosAcao(a, g); return [{ t: d.nr, b: true }, { t: `${d.tipo ? d.tipo + " – " : ""}${d.descricao}`, extra: d.evidencia }, d.segmentoRisco, d.responsavel, d.prazo, { t: d.status.rotulo, pilula: hex(d.status.cor), tam: 7.5 }]; }), { cab: ["Ação", "Descrição", "Segmento · risco", "Responsável", "Prazo", "Situação"], zebra: true, tam: 8 }));
        }
      });
    });

    // ================================================================ 10 a 12
    B.push(H1("s10", "10. Plano de ação e risco residual", true), paragrafos("Recomendacoes"));
    {
      const hoje = ctx.hoje; const cont = { c: 0, a: 0, n: 0 };
      todasAcoes.forEach(({ a }) => { const s = Calc.statusDaLinhaAcao ? Calc.statusDaLinhaAcao(a, hoje) : ""; if (Acoes.estaConcluida(a)) cont.c++; else if (s === "Em Andamento" || s === "Atrasada") cont.a++; else cont.n++; });
      B.push(azulejos([{ n: todasAcoes.length, rot: "Ações no plano", cor: PAL.vinhoE }, { n: cont.c, rot: "Concluídas", cor: PAL.verde }, { n: cont.a, rot: "Em andamento / atrasadas", cor: PAL.azul }, { n: cont.n, rot: "Não iniciadas", cor: [138, 122, 120] }]));
    }
    if (todasAcoes.length) {
      const ord = todasAcoes.slice().sort((x, z) => (x.av.Setor + x.av["Posto Trabalho"]).localeCompare(z.av.Setor + z.av["Posto Trabalho"], "pt-BR") || (Number(x.a["Nr Acao"]) || 0) - (Number(z.a["Nr Acao"]) || 0));
      B.push(tbl([7, 19, 12, 22, 12, 13, 15], ord.map(({ av, fr, a }) => { const d = dadosAcao(a, grau(fr)); return [{ t: d.nr, b: true }, `${av.Setor} · ${fr.Fator || ""}`, d.tipo || "-", { t: d.descricao || "-", extra: d.evidencia }, d.responsavel, d.prazo, { t: d.status.rotulo, pilula: hex(d.status.cor), tam: 7.5 }]; }), { cab: ["Ação", "Setor · fator", "Tipo", "Descrição", "Responsável", "Prazo", "Situação"], zebra: true, tam: 7.8 }));
    } else B.push(P("Nenhuma ação cadastrada para os fatores deste documento.", { cor: C.cinza }));
    B.push(H3(titDe("residual", "Risco residual por fator")));
    B.push(tbl([14, 44, 14, 14, 14], todosFatores.map(({ av, fr }) => {
      const g = grau(fr); const ac = acoesDe(fr); const r = ac.length ? Acoes.resumoRisco(g, ac) : null;
      return [av.Setor, fr.Fator || "", { t: rotCanon(Calc.nivelCanonico(g)), pilula: hex(corNivel(g)), tam: 7.5 }, r ? { t: rotCanon(r.previsto), pilula: hex(corNivel(r.previsto)), tam: 7.5 } : { t: "Sem ação proposta", cor: C.cinza }, r ? { t: rotCanon(r.realizado), pilula: hex(corNivel(r.realizado)), tam: 7.5 } : { t: "–", cor: C.cinza }];
    }), { cab: ["Setor", "Fator de risco", "Risco atual", "Previsto", "Realizado"], zebra: true, tam: 8 }));
    B.push(legenda(texto("Residual Legenda")));
    B.push(H1("s11", "11. Referências", false));
    linhasDe("Referencias").forEach((r, i) => B.push(par(run(`${i + 1}.\t`, { tam: 9, cor: C.texto }) + rico(r, { tam: 9, cor: C.texto }), { recuo: 400, suspenso: 400, depois: 60, tabs: '<w:tab w:val="left" w:pos="400"/>' })));
    B.push(H1("s12", "12. Conclusão e validação do documento", true), paragrafos("Conclusao"));
    {
      const ass = assinantes.length ? assinantes : [{ Nome: "Responsável técnico" }];
      B.push(tbl(ass.map(() => 1), [ass.map((p) => ({
        paras: (p._assinatura && imgs[p._assinatura] ? imagemPar(p._assinatura, 150, 48, { jc: "center", depois: 0, nome: "Assinatura de " + p.Nome }) : par("", { depois: 600 }))
          + par(run(p.Nome || "-", { b: true, tam: 10, cor: C.texto }), { jc: "center", depois: 20, antes: 40, bordaEsq: null })
          + par(run([p.Titulo, p.Registro].filter(Boolean).join(" · ") || " ", { tam: 8, cor: C.cinza }), { jc: "center", depois: 0 }),
        fundo: "FFFFFF", v: "bottom", bordas: '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="C99AA0"/>',
      }))], { semBorda: true, bordaBranca: true, margemV: 40 }));
      B.push(par("", { depois: 120 }));
      B.push(caixa(titDe("cliente-assinatura", `Cliente – ${opcoes.nomeCliente}`),
        par(run("Nome / cargo: ______________________________________      Data: ____ / ____ / ________", { tam: 9, cor: C.texto }), { depois: 120 }) + par(run("Assinatura: ___________________________________________", { tam: 9, cor: C.texto }), { depois: 0 }), "FFFFFF"));
      const qrInfo = urlQr && imgs[urlQr];
      B.push(tbl([22, 78], [[
        qrInfo ? { paras: imagemPar(urlQr, 84, 84, { jc: "center", depois: 0, nome: "QR Code de validação" }), fundo: "FFFFFF" } : { t: "QR Code indisponível", cor: C.cinza, tam: 8, jc: "center", fundo: "FFFFFF" },
        { paras: par(run(titDe("validacao", "Validação do documento"), { b: true, cor: C.tealE, tam: 10 }), { depois: 60 }) + par(rico(texto("Validacao Texto"), { tam: 8.5, cor: C.texto }), { depois: 0 }), fundo: "ECF6F5", v: "top" },
      ]], { margemV: 100 }));
    }

    // ================================================================ capa
    const capa = [];
    {
      const alvo = (txt, o) => par(run(txt, o), { depois: o.depois != null ? o.depois : 0, jc: o.jc });
      const logo = logoCliente && imgs[logoCliente] ? imagemPar(logoCliente, 130, 44, { jc: "center", depois: 0, nome: "Logotipo do cliente" }) : par(run(opcoes.nomeCliente, { b: true, cor: C.vinho, tam: 10 }), { jc: "center", depois: 0 });
      capa.push(tbl([68, 32], [
        [{ paras: (logoEleva && imgs[logoEleva] ? imagemPar(logoEleva, 150, 31, { jc: "left", depois: 80, nome: "Logotipo ElevaLife" }) : alvo("ElevaLife", { b: true, cor: "FFFFFF", tam: 26 })) + alvo(texto("Capa Lema"), { cor: "E8D6D8", tam: 9.5 }), fundo: C.vinhoE, v: "top" }, { paras: logo, fundo: "FFFFFF", v: "center" }],
        [{ span: 2, paras: par("", { depois: 1400 }) + linhasDe("Capa Titulo").map((l) => alvo(l, { b: true, cor: "FFFFFF", tam: 30 })).join("") + par("", { depois: 120 }) + alvo(texto("Capa Subtitulo"), { cor: "E8D6D8", tam: 10 }) + par("", { depois: 500 }), fundo: C.vinhoE, v: "top" }],
      ], { semBorda: true, bordaBranca: true, margemV: 180 }));
      capa.push(par("", { depois: 160 }));
      const infos = [["Empresa avaliada", opcoes.nomeCliente], ["Unidade", unidadesAv.join(" · ")], ["Setores avaliados", setoresAv.join(" · ")], ["Período da avaliação", periodo], ["Data de emissão", emissao], ["Responsável técnico", responsavel ? responsavel.Nome : "-"], ["Documento / revisão", `${codigo} · Rev. ${revisao}`]];
      const celInfo = (it) => ({ paras: par(run(it[0].toUpperCase(), { cor: C.cinza, tam: 6.5 }), { depois: 10 }) + par(run(String(it[1] || "-"), { b: true, cor: C.vinhoE, tam: 10 }), { depois: 0 }), fundo: C.creme, v: "top" });
      const linhasInfo = [[Object.assign(celInfo(infos[0]), { span: 2 })]];
      for (let k = 1; k < infos.length; k += 2) { const l = infos.slice(k, k + 2).map(celInfo); if (l.length < 2) l.push({ t: "", fundo: "FFFFFF" }); linhasInfo.push(l); }
      capa.push(tbl([1, 1], linhasInfo, { semBorda: true, bordaBranca: true, margemV: 80 }));
      const resumo = [[avaliacoes.length, "postos de trabalho avaliados"], [todosFatores.length, "fatores de risco identificados"], [todasAcoes.length, `ações no plano${concluidas ? ", " + concluidas + " já concluídas" : ""}`]];
      capa.push(tbl([1, 1, 1], [resumo.map((r) => ({ paras: par(run(String(r[0]), { b: true, cor: C.vinho, tam: 24 }), { depois: 0 }) + par(run(r[1], { cor: C.cinza, tam: 8 }), { depois: 0 }), fundo: "FFFFFF", v: "top" }))], { semBorda: true }));
      capa.push(par(run("Documento gerado pelo S.I.G.E – Sistema Integrado de Gestão ElevaLife.", { tam: 7.5, cor: C.cinza }), { depois: 0 }));
    }

    // ---- sumario (campo do Word + entradas ja preenchidas)
    const sumario = [];
    sumario.push(par(run("Sumário", { b: true, cor: C.vinho, tam: 15 }), { quebraAntes: true, depois: 160, bordaEsq: null }));
    {
      const entradas = toc.map(([nivel, t]) => ({ nivel, t }));
      entradas.forEach((e, k) => {
        const ini = k === 0 ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' : "";
        const fim = k === entradas.length - 1 ? '<w:r><w:fldChar w:fldCharType="end"/></w:r>' : "";
        sumario.push(par(ini + run(e.t, { tam: e.nivel === 1 ? 10 : 9, b: e.nivel === 1, cor: C.texto }) + fim, { estilo: e.nivel === 1 ? "TOC1" : "TOC2" }));
      });
      sumario.push(par(run("O sumário é um campo do Word: ao abrir, aceite a atualização dos campos (ou clique com o botão direito no sumário › Atualizar campo) para exibir os números de página.", { tam: 8, cor: C.cinza }), { antes: 200 }));
    }

    // ---- montagem do pacote
    const sect = '<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr1"/><w:footerReference w:type="default" r:id="rIdFtr1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="850" w:header="567" w:footer="567" w:gutter="0"/><w:titlePg/></w:sectPr>';
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${capa.join("")}${sumario.join("")}${B.join("")}${sect}</w:body></w:document>`;

    const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONTE}" w:hAnsi="${FONTE}" w:cs="${FONTE}" w:eastAsia="${FONTE}"/><w:color w:val="${C.texto}"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
      + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
      + `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:pBdr><w:bottom w:val="single" w:sz="10" w:space="2" w:color="${C.vinho}"/></w:pBdr><w:spacing w:before="320" w:after="180"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${C.vinho}"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>`
      + `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="220" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${C.vinhoM}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>`
      + `<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:bCs/><w:caps/><w:color w:val="${C.tealE}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>`
      + `<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${TW}"/></w:tabs><w:spacing w:before="80" w:after="40"/></w:pPr></w:style>`
      + `<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${TW}"/></w:tabs><w:spacing w:before="0" w:after="30"/><w:ind w:left="280"/></w:pPr></w:style>`
      + `<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="right" w:pos="${TW}"/></w:tabs><w:spacing w:after="0"/></w:pPr></w:style>`
      + `<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="right" w:pos="${TW}"/></w:tabs><w:spacing w:after="0"/></w:pPr></w:style></w:styles>`;

    const numeracao = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="400" w:hanging="260"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="' + C.vinho + '"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';
    const config = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:defaultTabStop w:val="708"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';
    const cab = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${par(run(titDe("cabecalho", "ElevaLife · Avaliação Ergonômica Preliminar (AEP)"), { b: true, cor: C.vinho, tam: 8 }) + run("\t" + `Doc. ${codigo} · Rev. ${revisao}`, { cor: C.cinza, tam: 8 }), { estilo: "Header", depois: 0, bordaEsq: null }).replace("<w:spacing", `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="3" w:color="${C.suave}"/></w:pBdr><w:spacing`)}</w:hdr>`;
    const campo = (instr, txt) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run(txt, { b: true, cor: C.vinho, tam: 8 })}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    const rodape = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${par(run(`${opcoes.nomeCliente} – ${unidadesAv.join(" · ")}`, { cor: C.cinza, tam: 7.5 }) + run("\tPágina ", { b: true, cor: C.vinho, tam: 8 }) + campo("PAGE", "1") + run(" de ", { b: true, cor: C.vinho, tam: 8 }) + campo("NUMPAGES", "1"), { estilo: "Footer", depois: 0 }).replace("<w:spacing", `<w:pBdr><w:top w:val="single" w:sz="4" w:space="3" w:color="${C.suave}"/></w:pBdr><w:spacing`)}</w:ftr>`;

    const usados = Object.keys(imgs).map((k) => imgs[k]);
    const relsDoc = ['<Relationship Id="rIdSty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>', '<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>', '<Relationship Id="rIdSet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>', '<Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>', '<Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>']
      .concat(usados.map((u) => `<Relationship Id="${u.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${u.arquivo}"/>`));
    const hojeIso = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    const arquivos = [
      ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'],
      ["docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc("Avaliação Ergonômica Preliminar – " + opcoes.nomeCliente)}</dc:title><dc:subject>${esc("Documento " + codigo)}</dc:subject><dc:creator>ElevaLife – S.I.G.E</dc:creator><cp:keywords>AEP, NR-17, NR-01, ergonomia</cp:keywords><dcterms:created xsi:type="dcterms:W3CDTF">${hojeIso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${hojeIso}</dcterms:modified></cp:coreProperties>`],
      ["docProps/app.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>S.I.G.E ElevaLife</Application></Properties>'],
      ["word/document.xml", documento], ["word/styles.xml", estilos], ["word/numbering.xml", numeracao], ["word/settings.xml", config], ["word/header1.xml", cab], ["word/footer1.xml", rodape],
      ["word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relsDoc.join("")}</Relationships>`],
    ].map(([nome, xml]) => ({ nome, dados: utf8(xml) })).concat(usados.map((u) => ({ nome: "word/media/" + u.arquivo, dados: u.bytes })));
    const zip = criarZip(arquivos);
    return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
  }

  BI.LaudoDocx = { construir, criarZip, crc32 };
})(window);
