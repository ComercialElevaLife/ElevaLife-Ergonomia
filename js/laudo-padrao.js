/* ==========================================================================
   S.I.G.E. - ElevaLife
   PADRAO DE LAUDO ElevaLife (V 1.30) - uma so formatacao para TODOS os laudos
   (AEP em PDF e Word e Riscos Psicossociais em PDF e Word):
     - cores padrao de risco e de status (as mesmas da tela - ver js/calc.js);
     - capa (faixa vinho, logotipo, caixa do cliente, cartoes de dados e numeros);
     - cabecalho (logotipo + titulo + "Doc. codigo · Rev.") e rodape
       (cliente + "Pagina X de Y") a partir da 2a pagina;
     - titulos (1., 1.1, SUBTITULO), sumario, assinaturas, caixa do cliente e
       validacao por QR Code + codigo (pagina publica /verificar).
   Usado por js/laudo.js (AEP) e pelo modulo Riscos Psicossociais (psicossocial.html).
   API: BI.LaudoPadrao.{ PAL, M, TOPO, BASE, URL_VERIFICACAO, corNivel, corStatus,
        novoCodigo, fontes, capa, cabecalhoRodape, h1, h2, h3, sumario, fechamento }
   ========================================================================== */
(function (global) {
  "use strict";
  const BI = (global.BI = global.BI || {});

  const PAL = {
    vinhoE: [94, 42, 48], vinho: [139, 58, 66], vinhoM: [163, 78, 86],
    suave: [216, 183, 187], suave2: [201, 154, 160], creme: [245, 239, 234],
    zebra: [250, 246, 243], texto: [61, 46, 48], cinza: [138, 122, 120],
    teal: [62, 123, 126], tealE: [46, 95, 98], branco: [255, 255, 255],
    azul: [47, 111, 159], verde: [46, 139, 87],
  };
  const URL_VERIFICACAO = "https://sige-ergo.elevalife.com.br/verificar/";
  const M = 42;     // margem lateral (pt)
  const TOPO = 70;  // inicio do texto nas paginas internas
  const BASE = 52;  // limite inferior do texto

  const Calc = () => BI.Calc || {};
  const rgb = (h) => (Calc().hexParaRGB ? Calc().hexParaRGB(h) : [138, 122, 120]);
  // Cor padrao de uma graduacao de risco (RGB). Sem graduacao: cinza.
  function corNivel(nivel) { const h = Calc().corRiscoHex ? Calc().corRiscoHex(nivel) : null; return h ? rgb(h) : PAL.cinza; }
  // Cor padrao de um status de acao (RGB).
  function corStatus(st) { const h = Calc().corStatusAcaoHex ? Calc().corStatusAcaoHex(st) : null; return h ? rgb(h) : PAL.cinza; }
  // Texto sobre um fundo colorido (escuro sobre azul-claro e amarelo, branco nos demais).
  function textoSobre(c) { const h = Array.isArray(c) ? c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase() : String(c || ""); return Calc().textoSobreHex ? rgb(Calc().textoSobreHex(h)) : PAL.branco; }

  function novoCodigo(existentes, sigla) {
    const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const usados = new Set((existentes || []).filter(Boolean));
    for (let t = 0; t < 50; t++) {
      let s = "";
      const bytes = new Uint8Array(6);
      (global.crypto || {}).getRandomValues ? global.crypto.getRandomValues(bytes) : bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
      bytes.forEach((b) => { s += alfabeto[b % alfabeto.length]; });
      const codigo = `ELV-${sigla || "AEP"}-${new Date().getFullYear()}-${s}`;
      if (!usados.has(codigo)) return codigo;
    }
    return `ELV-${sigla || "AEP"}-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  // Fontes do padrao (Montserrat no texto, Montserrat Alternates nos titulos), com
  // reserva em Helvetica quando as fontes nao carregaram.
  function fontes(doc) {
    let ok = false;
    try { const l = doc.getFontList ? doc.getFontList() : {}; ok = !!(l.Montserrat && l.MontserratAlternates); } catch (e) { ok = false; }
    const FN = ok ? "Montserrat" : "helvetica"; const FT = ok ? "MontserratAlternates" : "helvetica";
    return {
      texto: (estilo, tam) => { doc.setFont(FN, estilo || "normal"); doc.setFontSize(tam || 9); },
      titulo: (tam) => { doc.setFont(FT, "bold"); doc.setFontSize(tam); },
      cor: (c) => doc.setTextColor(c[0], c[1], c[2]),
      preencher: (c) => doc.setFillColor(c[0], c[1], c[2]),
      traco: (c, w) => { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w == null ? 0.5 : w); },
    };
  }

  // ---------------------------------------------------------------- capa
  // o = { logoEleva, lema, logoCliente, nomeCliente, titulo: [linhas], subtitulo,
  //       infos: [[rotulo, valor, larga?]], numeros: [[n, rotulo]], rodape }
  function capa(doc, o) {
    const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight(); const L = W - M * 2;
    const f = fontes(doc);
    const alt = 360; const passos = 48;
    for (let p = 0; p < passos; p++) {
      const t = p / (passos - 1);
      doc.setFillColor(Math.round(PAL.vinhoE[0] + (PAL.vinho[0] - PAL.vinhoE[0]) * t), Math.round(PAL.vinhoE[1] + (PAL.vinho[1] - PAL.vinhoE[1]) * t), Math.round(PAL.vinhoE[2] + (PAL.vinho[2] - PAL.vinhoE[2]) * t));
      doc.rect((W / passos) * p, 0, W / passos + 1, alt, "F");
    }
    let logoOk = false;
    if (o.logoEleva) { try { const pr = doc.getImageProperties(o.logoEleva); const h = 30; doc.addImage(o.logoEleva, "PNG", M, 36, h * pr.width / pr.height, h); logoOk = true; } catch (e) { /* sem logo */ } }
    if (!logoOk) { f.titulo(26); doc.setTextColor(255, 255, 255); doc.text("ElevaLife", M, 62); }
    f.texto("normal", 9.5); doc.setTextColor(232, 214, 216); doc.text(o.lema || "15 anos elevando pessoas e resultados", M, 79);
    // logotipo do cliente (caixa branca)
    const bx = W - M - 150; const by = 40; f.preencher(PAL.branco); doc.roundedRect(bx, by, 150, 62, 6, 6, "F");
    const nomeNaCaixa = () => { f.texto("bold", 10); f.cor(PAL.vinho); const ls = doc.splitTextToSize(o.nomeCliente || "", 138).slice(0, 3); doc.text(ls, bx + 75, by + 31 - (ls.length - 1) * 6, { align: "center" }); };
    if (o.logoCliente) {
      try {
        const pr = doc.getImageProperties(o.logoCliente); let w = 130; let h = w * pr.height / pr.width; if (h > 44) { h = 44; w = h * pr.width / pr.height; }
        doc.addImage(o.logoCliente, pr.fileType, bx + (150 - w) / 2, by + (62 - h) / 2, w, h);
      } catch (e) { nomeNaCaixa(); }
    } else nomeNaCaixa();
    // titulo e subtitulo (fonte reduzida quando o titulo e longo)
    const titulo = Array.isArray(o.titulo) ? o.titulo : [String(o.titulo || "")];
    let tam = 30; f.titulo(tam);
    let linhas = []; titulo.forEach((t) => { linhas = linhas.concat(doc.splitTextToSize(t, L - 10)); });
    while (linhas.length > 3 && tam > 21) { tam -= 2; f.titulo(tam); linhas = []; titulo.forEach((t) => { linhas = linhas.concat(doc.splitTextToSize(t, L - 10)); }); }
    doc.setTextColor(255, 255, 255);
    const yT = linhas.length > 2 ? 180 : 205;
    doc.text(linhas, M, yT, { lineHeightFactor: 1.2 });
    f.texto("normal", 10); doc.setTextColor(232, 214, 216);
    doc.text(doc.splitTextToSize(o.subtitulo || "", L - 40), M, Math.max(292, yT + linhas.length * tam * 1.2 + 10));
    // cartoes de dados
    let yy = alt + 28;
    const cw = (L - 10) / 2; let col = 0;
    (o.infos || []).forEach((it) => {
      const larga = it[2]; const h = 34;
      const x = larga || col === 0 ? M : M + cw + 10; const w = larga ? L : cw;
      f.preencher(PAL.creme); doc.roundedRect(x, yy, w, h, 4, 4, "F");
      f.texto("normal", 6.5); f.cor(PAL.cinza); doc.text(String(it[0]).toUpperCase(), x + 8, yy + 11);
      f.texto("bold", 9.5); f.cor(PAL.vinhoE); doc.text(doc.splitTextToSize(String(it[1] || "-"), w - 16)[0], x + 8, yy + 25);
      if (larga) { yy += h + 6; col = 0; } else if (col === 0) col = 1; else { yy += h + 6; col = 0; }
    });
    if (col === 1) yy += 40;
    yy += 10;
    // numeros do documento
    const nums = o.numeros || []; const rw = L / Math.max(nums.length, 1);
    nums.forEach((r, i) => {
      const x = M + i * rw; f.traco(PAL.vinho, 1.4); doc.line(x, yy, x + rw - 14, yy);
      f.titulo(24); f.cor(PAL.vinho); doc.text(String(r[0]), x, yy + 28);
      f.texto("normal", 7.5); f.cor(PAL.cinza); doc.text(doc.splitTextToSize(String(r[1]), rw - 20), x, yy + 41);
    });
    f.texto("normal", 7); f.cor(PAL.cinza);
    doc.text(o.rodape || "Documento gerado pelo S.I.G.E – Sistema Integrado de Gestão ElevaLife.", M, H - 36);
    doc.text(new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }), W - M, H - 36, { align: "right" });
  }

  // ---------------------------------------------------------------- cabecalho e rodape
  // o = { logoCor, titulo, codigo, revisao, rodape, desde (pagina inicial, padrao 2) }
  function cabecalhoRodape(doc, o) {
    const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
    const f = fontes(doc);
    const total = doc.internal.getNumberOfPages();
    for (let p = o.desde || 2; p <= total; p++) {
      doc.setPage(p);
      let xCab = M;
      if (o.logoCor) { try { const pr = doc.getImageProperties(o.logoCor); const h = 11; const w = h * pr.width / pr.height; doc.addImage(o.logoCor, "PNG", M, 21, w, h); xCab = M + w + 8; } catch (e) { /* sem logo */ } }
      const doca = o.codigo ? `Doc. ${o.codigo} · Rev. ${o.revisao || "00"}` : "";
      f.texto("normal", 7.2); const wDoc = doca ? doc.getTextWidth(doca) + 12 : 0;
      f.texto("bold", 7.2); f.cor(PAL.vinho); doc.text(doc.splitTextToSize(o.titulo || "", W - M - xCab - wDoc)[0] || "", xCab, 30);
      if (doca) { f.texto("normal", 7.2); f.cor(PAL.cinza); doc.text(doca, W - M, 30, { align: "right" }); }
      f.traco(PAL.suave, 0.6); doc.line(M, 36, W - M, 36); doc.line(M, H - 34, W - M, H - 34);
      f.texto("normal", 7); f.cor(PAL.cinza); doc.text(doc.splitTextToSize(o.rodape || "", W - M * 2 - 90)[0] || "", M, H - 22);
      f.texto("bold", 7.5); f.cor(PAL.vinho); doc.text(`Página ${p} de ${total}`, W - M, H - 22, { align: "right" });
    }
  }

  // ---------------------------------------------------------------- titulos (desenha em y e devolve o novo y)
  const H1 = { tam: 15, cor: PAL.vinho, antes: 14, depois: 18 };
  const H2 = { tam: 11.5, cor: PAL.vinhoM, antes: 9, depois: 15 };
  const H3 = { tam: 8.5, cor: PAL.tealE };
  function h1(doc, titulo, y) {
    const W = doc.internal.pageSize.getWidth(); const L = W - M * 2; const f = fontes(doc);
    f.titulo(H1.tam); f.cor(H1.cor);
    const ls = doc.splitTextToSize(titulo, L); doc.text(ls, M, y); y += (ls.length - 1) * H1.tam * 1.2;
    y += 7; f.traco(PAL.vinho, 1.2); doc.line(M, y, M + L, y); f.traco(PAL.vinho, 0.5);
    return y + H1.depois;
  }
  function h2(doc, titulo, y) {
    const W = doc.internal.pageSize.getWidth(); const L = W - M * 2; const f = fontes(doc);
    f.titulo(H2.tam); f.cor(H2.cor); y += H2.antes;
    const ls = doc.splitTextToSize(titulo, L); doc.text(ls, M, y); y += (ls.length - 1) * H2.tam * 1.25;
    return y + H2.depois;
  }
  function h3(doc, titulo, y) {
    const f = fontes(doc); y += 4; f.texto("bold", H3.tam); f.cor(H3.cor); doc.text(String(titulo).toUpperCase(), M, y); return y + 13;
  }

  // ---------------------------------------------------------------- sumario
  // itens = [{ titulo, nivel (1|2), pagina }]; devolve o y final. Quebra de pagina via
  // callback proximaPagina() -> novo y.
  function sumario(doc, itens, y, o) {
    o = o || {};
    const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight(); const L = W - M * 2; const f = fontes(doc);
    itens.forEach((t) => {
      const sub = t.nivel === 2;
      if (y > H - BASE - 6 && o.proximaPagina) y = o.proximaPagina();
      f.texto(sub ? "normal" : "bold", sub ? 8.4 : 9.4); f.cor(PAL.texto);
      const x0 = M + (sub ? 14 : 0); const num = String(t.pagina || "-");
      const wn = doc.getTextWidth(num); let tx = t.titulo; const maxT = L - (x0 - M) - wn - 18;
      while (doc.getTextWidth(tx) > maxT && tx.length > 4) tx = tx.slice(0, -2);
      if (tx !== t.titulo) tx = tx.trim() + "…";
      doc.text(tx, x0, y);
      const wt = doc.getTextWidth(tx);
      const pontos = Math.max(0, Math.floor((L - (x0 - M) - wt - wn - 10) / doc.getTextWidth(".")));
      f.cor(PAL.suave2); doc.text(".".repeat(pontos), x0 + wt + 4, y); f.cor(PAL.texto); doc.text(num, M + L - wn, y);
      if (o.links && t.pagina) doc.link(M, y - 11, L, 15, { pageNumber: t.pagina });
      y += sub ? 15.5 : 19;
    });
    f.texto("normal", 7.5); f.cor(PAL.cinza);
    doc.text(doc.splitTextToSize("Clique em um item do sumário para ir direto à página correspondente. Os marcadores do arquivo PDF (painel lateral do leitor) seguem a mesma estrutura.", L), M, y + 10);
    return y + 30;
  }

  // ---------------------------------------------------------------- fechamento
  // Assinaturas (com imagem da assinatura quando cadastrada), caixa de ciencia do cliente e
  // validacao por QR Code. o = { assinantes: [{ nome, cargo, assinatura }], cliente, tituloCliente,
  // codigo, tituloValidacao, textoValidacao (string ja preenchida), paragrafo(txt, opcoes) }.
  // Recebe "y" e uma funcao garantir(h) -> y (quebra de pagina); devolve o y final.
  function fechamento(doc, y, o, garantir) {
    const W = doc.internal.pageSize.getWidth(); const L = W - M * 2; const f = fontes(doc);
    // assinaturas
    y += 14; y = garantir(y, 150);
    const lista = (o.assinantes && o.assinantes.length) ? o.assinantes : [{ nome: "Responsável técnico" }];
    const n = lista.length; const gap = 18; const w = (L - gap * (n - 1)) / n; const ySig = y;
    lista.forEach((p, k) => {
      const x = M + k * (w + gap);
      if (p.assinatura) { try { const pr = doc.getImageProperties(p.assinatura); let iw = Math.min(w - 20, 150); let ih = iw * pr.height / pr.width; if (ih > 48) { ih = 48; iw = ih * pr.width / pr.height; } doc.addImage(p.assinatura, pr.fileType, x + (w - iw) / 2, ySig + 50 - ih, iw, ih); } catch (e) { /* sem imagem */ } }
      f.traco(PAL.suave2, 0.8); doc.line(x, ySig + 54, x + w, ySig + 54);
      f.texto("bold", 9); f.cor(PAL.texto); doc.text(p.nome || "-", x + w / 2, ySig + 66, { align: "center" });
      f.texto("normal", 7.2); f.cor(PAL.cinza);
      doc.text(doc.splitTextToSize(p.cargo || " ", w), x + w / 2, ySig + 77, { align: "center" });
    });
    y = ySig + 100;
    // ciencia do cliente
    y = garantir(y, 66);
    f.preencher(PAL.branco); f.traco(PAL.suave2, 0.6); doc.roundedRect(M, y, L, 56, 4, 4, "FD");
    f.texto("bold", 8.5); f.cor(PAL.vinhoE); doc.text(o.tituloCliente || `Cliente – ${o.cliente || ""}`, M + 10, y + 14);
    f.texto("normal", 8); f.cor(PAL.texto);
    doc.text("Nome / cargo: ______________________________________", M + 10, y + 32); doc.text("Data: ____ / ____ / ________", M + L - 160, y + 32);
    doc.text("Assinatura: ___________________________________________", M + 10, y + 48);
    y += 70;
    // validacao + QR
    y = garantir(y, 110);
    doc.setFillColor(236, 246, 245); doc.setDrawColor(160, 205, 202); doc.setLineWidth(0.6); doc.roundedRect(M, y, L, 100, 4, 4, "FD");
    const qr = (typeof global.qrcode === "function") ? (() => { try { const q = global.qrcode(0, "M"); q.addData(URL_VERIFICACAO + o.codigo); q.make(); return q; } catch (e) { return null; } })() : null;
    const tq = 84;
    f.preencher(PAL.branco); doc.rect(M + 8, y + 8, tq, tq, "F");
    if (qr) {
      const mc = qr.getModuleCount(); const mod = (tq - 8) / mc; doc.setFillColor(0, 0, 0);
      for (let r = 0; r < mc; r++) for (let c = 0; c < mc; c++) if (qr.isDark(r, c)) doc.rect(M + 12 + c * mod, y + 12 + r * mod, mod + 0.15, mod + 0.15, "F");
    } else { f.texto("normal", 6.5); f.cor(PAL.cinza); doc.text("QR Code indisponível", M + 8 + tq / 2, y + 8 + tq / 2, { align: "center" }); }
    const tx = M + tq + 22;
    f.texto("bold", 9); f.cor(PAL.tealE); doc.text(o.tituloValidacao || "Validação do documento", tx, y + 17);
    // texto com **negrito**
    const larg = L - (tx - M) - 8; let yy = y + 31;
    const ws = []; String(o.textoValidacao || "").split("**").forEach((parte, i) => parte.split(/\s+/).filter(Boolean).forEach((t) => ws.push({ t, b: i % 2 === 1 })));
    f.texto("normal", 7.8); const esp = doc.getTextWidth(" "); let cx = tx;
    ws.forEach((p) => { f.texto(p.b ? "bold" : "normal", 7.8); const wpal = doc.getTextWidth(p.t); if (cx + wpal > tx + larg && cx > tx) { cx = tx; yy += 11.6; } f.cor(PAL.texto); doc.text(p.t, cx, yy); cx += wpal + esp; });
    return y + 110;
  }

  const TEXTO_VALIDACAO = "Documento emitido eletronicamente no S.I.G.E por {nomes} em {emissao}. Código de verificação: **{codigo}** · Revisão {revisao}. Aponte a câmera para o QR Code ou acesse **sige-ergo.elevalife.com.br/verificar** e informe o código para confirmar a autoria, a data e a integridade do arquivo.";

  // V 1.35: paginas de um arquivo anexado (certificado de calibracao) como imagens para o laudo:
  // JPG/PNG -> [imagem]; PDF -> uma imagem por pagina (ate 6), desenhada com o pdf.js.
  async function paginasDoArquivo(chave, maxPaginas) {
    if (!chave || !BI.DB) return [];
    try {
      const r = await fetch(BI.DB.urlArquivo(chave), { credentials: "same-origin" }); if (!r.ok) return [];
      const blob = await r.blob();
      const ehPdf = /pdf/i.test(blob.type) || /\.pdf$/i.test(chave);
      if (!ehPdf) {
        if (!/^image\/(png|jpe?g)/i.test(blob.type) && !/\.(png|jpe?g)$/i.test(chave)) return [];
        return [await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result || "") || null); f.onerror = () => ok(null); f.readAsDataURL(blob); })].filter(Boolean);
      }
      if (!global.pdfjsLib) return [];
      const pdf = await global.pdfjsLib.getDocument({ data: await blob.arrayBuffer(), isEvalSupported: false }).promise;
      const out = [];
      for (let p = 1; p <= Math.min(pdf.numPages, maxPaginas || 6); p++) {
        const pg = await pdf.getPage(p); const vp = pg.getViewport({ scale: 1.6 });
        const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
        out.push(c.toDataURL("image/jpeg", 0.85));
      }
      return out;
    } catch (e) { console.warn("certificado", e); return []; }
  }

  BI.LaudoPadrao = { PAL, M, TOPO, BASE, URL_VERIFICACAO, TEXTO_VALIDACAO, corNivel, corStatus, textoSobre, novoCodigo, fontes, capa, cabecalhoRodape, h1, h2, h3, sumario, fechamento, paginasDoArquivo };
})(window);
