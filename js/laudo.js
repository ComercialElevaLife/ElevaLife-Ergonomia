/* ==========================================================================
   S.I.G.E. - ElevaLife
   LAUDO (AEP) V 1.3 - documento oficial em PDF (jsPDF): A4 retrato, capa com
   logotipo do cliente, sumario clicavel (links + marcadores do PDF), numeracao
   "Pagina X de Y", cabecalho/rodape corridos, metodologia ElevaLife
   (BI.LaudoTextos, editavel no Editor de Texto), inventario por posto com
   fotos, acoes por fator (V 1.2) e risco residual, plano de acao, referencias
   e, na ULTIMA pagina, assinaturas (imagem do ergonomista cadastrado) e
   validacao por QR Code + codigo (pagina publica /verificar).

   API:  BI.Laudo.gerar(opcoes) -> Promise<ArrayBuffer>
         BI.Laudo.novoCodigo(codigosExistentes, sigla) -> "ELV-AEP-2026-K7QX9M"
   Renderiza em 2 passadas com o mesmo conteudo (a 1a so descobre em que
   pagina cada secao comeca, para o sumario e para "Pagina X de Y").
   ========================================================================== */
(function (global) {
  "use strict";
  const BI = (global.BI = global.BI || {});

  const PAL = {
    vinhoE: [94, 42, 48], vinho: [139, 58, 66], vinhoM: [163, 78, 86],
    suave: [216, 183, 187], suave2: [201, 154, 160], creme: [245, 239, 234],
    zebra: [250, 246, 243], texto: [61, 46, 48], cinza: [138, 122, 120],
    teal: [62, 123, 126], tealE: [46, 95, 98], branco: [255, 255, 255],
    azul: [47, 111, 159], verde: [42, 157, 143],
  };
  const URL_VERIFICACAO = "https://sige-ergo.elevalife.com.br/verificar/";
  const M = 42; // margem lateral
  const TOPO = 70;
  const BASE = 52;

  // ---- helpers puros ------------------------------------------------------
  function semAcento(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function corNivel(nivel) {
    const n = semAcento(nivel);
    if (n.includes("muito alto") || n.includes("altissimo")) return [124, 58, 237];
    if (n.includes("alto")) return [217, 54, 54];
    if (n.includes("moder") || n.includes("medio") || n.includes("toler")) return [201, 150, 12];
    if (!n || n === "-") return PAL.cinza;
    return [26, 156, 75];
  }
  function dataBR(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "-");
  }
  function hojeISO() { return new Date().toISOString().slice(0, 10); }
  function substituir(texto, vars) {
    return String(texto || "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  }
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

  // ---- dados da metodologia ElevaLife ---------------------------------------
  // V 1.9: textos, tabelas e definicoes agora ficam em js/laudo-textos.js (BI.LaudoTextos.PADRAO)
  // e podem ser editados no Editor de Texto; aqui sobram so as cores de apoio.
  const CORES_PDCA = [[225, 237, 247], [226, 242, 232], [252, 243, 214], [250, 226, 226]];
  const ROTULO_ESCALA = { "Media": "Média" };

  // ---------------------------------------------------------------------------
  // V 1.9: reunia o conteudo do documento (dados, textos do modelo, imagens) para os dois
  // formatos de saida - PDF (gerar) e Word (gerarDocx, em js/laudo-docx.js).
  async function preparar(opcoes) {
    const Calc = BI.Calc;
    const Acoes = BI.Acoes;
    const dados = BI.dados;
    const T = BI.LaudoTextos;
    const modelo = (dados.modeloLaudo || [])[0] || {};
    const nomeMatriz = Calc.matrizDoCliente(dados.cliente, opcoes.nomeCliente);
    const escala = Calc.escalaDaMatriz(nomeMatriz);
    const docCliente = (dados.cliente || []).find((c) => c.Cliente === opcoes.nomeCliente) || {};
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

    const avaliacoes = (dados.avaliacaoErgonomica || []).filter((a) => {
      if (a.Cliente !== opcoes.nomeCliente) return false;
      if (opcoes.setor && a.Setor !== opcoes.setor) return false;
      if (opcoes.postoTrabalho && a["Posto Trabalho"] !== opcoes.postoTrabalho) return false;
      return true;
    });
    if (!avaliacoes.length) {
      throw new Error("Nenhuma Avaliação Ergonômica cadastrada para esse Cliente/Setor/Posto - cadastre a Avaliação Ergonômica antes de gerar o laudo.");
    }

    const fatoresDoPosto = (av) => (dados.fatorRisco || []).filter((f) =>
      f.Cliente === av.Cliente && f.Unidade === av.Unidade && f.Setor === av.Setor && f.Cargo === av.Cargo &&
      f["Posto Trabalho"] === av["Posto Trabalho"] && f.Atividade === av.Atividade && f["Existe Fator Risco"] === "Sim");
    const grau = (fr) => fr["Graduacao Risco"] || Calc.nivelDaMatriz(nomeMatriz, fr.Probabilidade, fr.Criticidade) || "";
    const pontos = (fr) => (fr["Pontuacao Risco"] != null ? fr["Pontuacao Risco"] : Calc.pontuacaoDaMatriz(nomeMatriz, fr.Probabilidade, fr.Criticidade));
    const rotCanon = (n) => (n ? Calc.rotuloNivel(n) : "-");
    const acoesDe = (fr) => (Acoes ? Acoes.acoesDoFator(fr._id) : []);

    // ---- ergonomistas (cadastro global) ----------------------------------
    const ergo = (nome) => (dados.ergonomista || []).find((e) => e.Nome === nome) || (nome ? { Nome: nome } : null);
    const responsavel = ergo(opcoes.responsavelTecnico || opcoes.emitidoPor);
    const executor = ergo(opcoes.ergonomistaExecutor);
    const assinantes = [responsavel, executor && (!responsavel || executor.Nome !== responsavel.Nome) ? executor : null].filter(Boolean);

    // ---- imagens (logo, fotos, assinaturas) ---------------------------------
    const cacheImg = {};
    async function imagem(chave) {
      if (!chave) return null;
      if (cacheImg[chave] !== undefined) return cacheImg[chave];
      try {
        const resp = await fetch(BI.DB.urlArquivo(chave), { credentials: "same-origin" });
        if (!resp.ok) return (cacheImg[chave] = null);
        const blob = await resp.blob();
        cacheImg[chave] = await new Promise((res) => {
          const l = new FileReader();
          l.onload = () => res(String(l.result || "") || null);
          l.onerror = () => res(null);
          l.readAsDataURL(blob);
        });
      } catch (e) { cacheImg[chave] = null; }
      return cacheImg[chave];
    }
    const chaveDe = (v) => (Array.isArray(v) ? v[0] : v) && (Array.isArray(v) ? v[0] : v).chave;
    const logoCliente = await imagem(chaveDe(docCliente.Logotipo));
    for (const av of avaliacoes) for (const f of av.Fotos || []) await imagem(f && f.chave);
    for (const e of assinantes) e._assinatura = await imagem(chaveDe(e.Assinatura));

    // ---- metricas gerais -------------------------------------------------------
    const todosFatores = [];
    avaliacoes.forEach((av) => fatoresDoPosto(av).forEach((fr) => todosFatores.push({ av, fr })));
    const todasAcoes = [];
    todosFatores.forEach(({ av, fr }) => acoesDe(fr).forEach((a) => todasAcoes.push({ av, fr, a })));
    const concluidas = todasAcoes.filter((x) => Acoes.estaConcluida(x.a)).length;
    const contaNivel = (lista) => {
      const c = { Baixo: 0, Medio: 0, Alto: 0, "Muito Alto": 0 };
      lista.forEach((fr) => { const n = Calc.nivelCanonico(grau(fr)); if (n in c) c[n]++; });
      return c;
    };
    const NIVEIS4 = [["Baixo", "Baixo"], ["Medio", "Moderado"], ["Alto", "Alto"], ["Muito Alto", "Muito Alto"]];
    const resumoNiveis = (() => {
      const c = contaNivel(todosFatores.map((x) => x.fr));
      const partes = NIVEIS4.filter(([k]) => c[k]).map(([k, r]) => `${c[k]} com graduação ${r}`);
      return partes.length ? `, dos quais ${partes.join(", ").replace(/, ([^,]*)$/, " e $1")}` : "";
    })();
    const setoresAv = Array.from(new Set(avaliacoes.map((a) => a.Setor)));
    const unidadesAv = Array.from(new Set(avaliacoes.map((a) => a.Unidade)));
    const datas = avaliacoes.map((a) => a["Data Avaliacao"]).filter(Boolean).sort();
    const periodo = datas.length ? (datas[0] === datas[datas.length - 1] ? dataBR(datas[0]) : `${dataBR(datas[0])} a ${dataBR(datas[datas.length - 1])}`) : "-";
    const emissao = opcoes.emitidoEm ? dataBR(opcoes.emitidoEm) : dataBR(hojeISO());
    const codigo = opcoes.codigo || novoCodigo([], "AEP");
    const revisao = opcoes.revisao || "00";
    const vars = {
      cliente: opcoes.nomeCliente, unidade: unidadesAv.length === 1 ? "Unidade " + unidadesAv[0] : "unidades " + unidadesAv.join(", "),
      setores: setoresAv.length === 1 ? "o setor de " + setoresAv[0] : "os setores de " + setoresAv.join(", ").replace(/, ([^,]*)$/, " e $1"),
      nPostos: avaliacoes.length, nFatores: todosFatores.length, nAcoes: todasAcoes.length, resumoNiveis,
      // V 1.9: marcadores dos textos que antes eram fixos
      nFatoresISO: (Calc.GRUPOS_FATOR_RISCO || []).reduce((t, g) => t + Calc.fatoresDoGrupo(g).length, 0), nGruposISO: (Calc.GRUPOS_FATOR_RISCO || []).length,
      matriz: nomeMatriz.toLowerCase(), dataBase: dataBR(hojeISO()), emissao, codigo, revisao,
      nomes: assinantes.map((a) => a.Nome).join(" e ") || "o responsável técnico",
    };
    const texto = (campo) => substituir(String(modelo[campo] || "").trim() || T.PADRAO[campo] || "", vars);
    const linhasDe = (campo) => texto(campo).split(/\n+/).map((s) => s.trim()).filter(Boolean);
    // V 1.9: tabelas e listas editaveis - uma linha por registro, colunas separadas por "|".
    const celulas = (campo) => texto(campo).split("\n").map((l) => l.split("|").map((c) => c.trim())).filter((r) => r.some(Boolean));
    const mapaDe = (campo) => { const o = {}; celulas(campo).forEach((r) => { if (r[0]) o[r[0]] = r.slice(1).join(" | "); }); return o; };
    const titulosMapa = mapaDe("Titulos");
    const titDe = (chave, padrao) => titulosMapa[chave] || padrao;

    // dados de saida p/ o formulario (registro p/ verificacao)
    opcoes.saida = {
      codigo, revisao,
      registroResponsavel: responsavel ? responsavel.Registro || "" : "",
      registroExecutor: executor ? executor.Registro || "" : "",
    };
    // V 1.9: dados de uma acao do plano - usados pelo PDF e pelo Word.
    const statusAcaoInfo = (a) => {
      const st = Calc.statusDaLinhaAcao ? Calc.statusDaLinhaAcao(a, hoje) : (Acoes.estaConcluida(a) ? "Concluida" : "Nao Iniciado");
      const mapa = { "Concluida": [PAL.verde, "Concluída"], "Concluida com atraso": [PAL.verde, "Concluída c/ atraso"], "Em Andamento": [PAL.azul, "Em andamento"], "Atrasada": [[217, 54, 54], "Atrasada"], "Nao Iniciado": [[138, 122, 120], "Não iniciada"] };
      const m = mapa[st] || mapa["Nao Iniciado"]; return { rotulo: m[1], cor: m[0] };
    };
    const dadosAcao = (a, grauFator) => {
      const atual = a["Risco Atual Segmento"] || Calc.nivelCanonico(grauFator);
      const reduz = a["Risco Apos Acao"] ? `${rotCanon(atual)} para ${rotCanon(a["Risco Apos Acao"])}` : rotCanon(atual);
      return {
        nr: a["Nr Acao"] != null ? "A-" + String(a["Nr Acao"]).padStart(2, "0") : "-",
        tipo: Acoes.rotuloTipo(a["Tipo Acao"]) || a["Categoria Acao"] || "",
        descricao: a["Acao Recomendada"] || "",
        evidencia: (a.Evidencias || []).length ? `Evidência anexada (${a.Evidencias.length})` : "",
        segmentoRisco: `${a["Segmento Corporal"] || "Geral"}: ${reduz}`,
        responsavel: a["Responsavel Acao"] || "-",
        prazo: a["Dt Programada"] ? dataBR(a["Dt Programada"]) : "-",
        status: statusAcaoInfo(a),
      };
    };
    return {
      statusAcaoInfo, dadosAcao, corNivel, dataBR, hojeISO, PAL, ROTULO_ESCALA, URL_VERIFICACAO,
      Calc, Acoes, dados, T, modelo, nomeMatriz, escala, docCliente, hoje, avaliacoes, fatoresDoPosto, grau, pontos, rotCanon, acoesDe, responsavel, executor, assinantes, cacheImg, logoCliente, todosFatores, todasAcoes, concluidas, contaNivel, NIVEIS4, resumoNiveis, setoresAv, unidadesAv, periodo, emissao, codigo, revisao, vars, texto, linhasDe, celulas, mapaDe, titDe,
    };
  }

  async function gerar(opcoes) {
    const jsPDFCtor = global.jspdf && global.jspdf.jsPDF;
    if (!jsPDFCtor) throw new Error("A biblioteca de geração de PDF não carregou (script externo bloqueado ou indisponível).");
    const { statusAcaoInfo, dadosAcao, Calc, Acoes, dados, T, modelo, nomeMatriz, escala, docCliente, hoje, avaliacoes, fatoresDoPosto, grau, pontos, rotCanon, acoesDe, responsavel, executor, assinantes, cacheImg, logoCliente, todosFatores, todasAcoes, concluidas, contaNivel, NIVEIS4, resumoNiveis, setoresAv, unidadesAv, periodo, emissao, codigo, revisao, vars, texto, linhasDe, celulas, mapaDe, titDe } = await preparar(opcoes);

    // ========================================================================
    function construir(doc, mapa, final) {
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const L = W - M * 2;
      let y = TOPO;
      let pagina = 1;
      const toc = [];

      const fonte = (estilo, tam) => { doc.setFont("Montserrat", estilo || "normal"); doc.setFontSize(tam || 9); };
      const cor = (c) => doc.setTextColor(c[0], c[1], c[2]);
      const preencher = (c) => doc.setFillColor(c[0], c[1], c[2]);
      const traco = (c, w) => { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w == null ? 0.5 : w); };
      const novaPagina = () => { doc.addPage(); pagina++; y = TOPO; };
      const garantir = (h) => { if (y + h > H - BASE) { novaPagina(); return true; } return false; };
      const registrar = (chave, titulo, nivel) => {
        if (!mapa.pags[chave]) mapa.pags[chave] = pagina;
        if (final) { try { doc.outline.add(null, titulo, { pageNumber: pagina }); } catch (e) { /* marcador e opcional */ } }
        toc.push({ chave, titulo, nivel });
      };

      // ---- texto rico (**negrito**, justificado) ------------------------------
      function palavras(txt) {
        const out = [];
        let anteriorSemEspaco = false;
        String(txt).replace(/\n/g, " ").split("**").forEach((parte, i) => {
          const limpa = parte.replace(/\*/g, "");
          const ws = limpa.split(/\s+/).filter(Boolean);
          ws.forEach((w, k) => out.push({ t: w, b: i % 2 === 1, glue: k === 0 && anteriorSemEspaco && !/^\s/.test(limpa) }));
          if (ws.length) anteriorSemEspaco = !/\s$/.test(limpa);
        });
        return out;
      }
      function quebrar(ws, largura, tam) {
        fonte("normal", tam);
        const esp = doc.getTextWidth(" ");
        const linhas = []; let atual = []; let w = 0;
        ws.forEach((p) => {
          fonte(p.b ? "bold" : "normal", tam);
          p.w = doc.getTextWidth(p.t);
          const nova = atual.length ? w + (p.glue ? 0 : esp) + p.w : p.w;
          if (nova > largura && atual.length) { linhas.push({ ws: atual, w }); atual = [p]; w = p.w; } else { atual.push(p); w = nova; }
        });
        if (atual.length) linhas.push({ ws: atual, w });
        return { linhas, esp };
      }
      function paragrafo(txt, o) {
        o = o || {};
        const tam = o.tam || 9; const lh = tam * (o.lh || 1.55); const x = M + (o.recuo || 0); const larg = (o.largura || L) - (o.recuo || 0);
        const q = quebrar(palavras(txt), larg, tam);
        q.linhas.forEach((ln, i) => {
          garantir(lh);
          const ultima = i === q.linhas.length - 1;
          const nGaps = ln.ws.filter((p, k) => k > 0 && !p.glue).length;
          const gap = (o.justificar !== false && !ultima && nGaps > 0) ? (larg - ln.ws.reduce((s, p) => s + p.w, 0)) / nGaps : q.esp;
          let cx = x;
          ln.ws.forEach((p, k) => { if (k > 0 && !p.glue) cx += gap; fonte(p.b || o.negrito ? "bold" : "normal", tam); cor(o.cor || PAL.texto); doc.text(p.t, cx, y); cx += p.w; });
          y += lh;
        });
        y += o.depois != null ? o.depois : 5;
      }
      const paragrafos = (campo, o) => texto(campo).split(/\n{2,}/).forEach((p) => paragrafo(p, o));
      function lista(itens, o) {
        o = o || {};
        itens.forEach((it) => {
          garantir(14);
          fonte("bold", 9); cor(PAL.vinho); doc.text("•", M + 3, y);
          paragrafo(it, Object.assign({}, o, { recuo: 14, depois: 2.5 }));
        });
        y += 3;
      }

      // ---- titulos ---------------------------------------------------------------
      function h1(chave, titulo, novaPag) {
        titulo = titDe(chave, titulo);
        if (novaPag) novaPagina(); else { if (y > TOPO) y += 14; garantir(70); }
        registrar(chave, titulo, 1);
        doc.setFont("MontserratAlternates", "bold"); doc.setFontSize(15); cor(PAL.vinho);
        doc.text(titulo, M, y);
        y += 7; traco(PAL.vinho, 1.2); doc.line(M, y, M + L, y); traco(PAL.vinho, 0.5);
        y += 18;
      }
      function h2(chave, titulo) {
        titulo = titDe(chave, titulo);
        garantir(48);
        registrar(chave, titulo, 2);
        doc.setFont("MontserratAlternates", "bold"); doc.setFontSize(11.5); cor(PAL.vinhoM);
        y += 9; doc.text(titulo, M, y); y += 15;
      }
      function h3(titulo) {
        garantir(34); y += 4;
        fonte("bold", 8.5); cor(PAL.tealE); doc.text(titulo.toUpperCase(), M, y); y += 13;
      }
      function legenda(txt) { paragrafo(txt, { tam: 7.5, cor: PAL.cinza, justificar: false, depois: 6 }); }

      // ---- elementos graficos --------------------------------------------------------
      function pilula(txt, c, x, yBase, tam) {
        tam = tam || 7.5; fonte("bold", tam);
        const w = doc.getTextWidth(txt) + 10;
        preencher(c); doc.roundedRect(x, yBase - tam - 1.5, w, tam + 5, 2.5, 2.5, "F");
        doc.setTextColor(255, 255, 255); doc.text(txt, x + 5, yBase);
        return w;
      }
      function caixa(x, yy, w, h, fundo, borda) {
        preencher(fundo); traco(borda || PAL.suave, 0.6); doc.roundedRect(x, yy, w, h, 4, 4, borda ? "FD" : "F");
      }
      function azulejos(itens) { // [{n, rot, cor}]
        const gap = 8; const w = (L - gap * (itens.length - 1)) / itens.length; const h = 42;
        garantir(h + 10);
        itens.forEach((it, i) => {
          const x = M + i * (w + gap);
          preencher(it.cor); doc.roundedRect(x, y, w, h, 4, 4, "F");
          doc.setTextColor(255, 255, 255); fonte("bold", 18); doc.text(String(it.n), x + w / 2, y + 22, { align: "center" });
          fonte("normal", 7.5); doc.text(it.rot, x + w / 2, y + 34, { align: "center" });
        });
        y += h + 10;
      }
      function cartoes(itens, colunas, opcoesC) {
        opcoesC = opcoesC || {};
        const gap = 7; const w = (L - gap * (colunas - 1)) / colunas;
        for (let i = 0; i < itens.length; i += colunas) {
          const grupo = itens.slice(i, i + colunas);
          const medidas = grupo.map((it) => {
            const tit = quebrar(palavras("**" + it[0] + "**"), w - 16, 8); const corpo = it[1] ? quebrar(palavras(it[1]), w - 16, 7.3) : { linhas: [] };
            return { tit, corpo };
          });
          const h = 30 + Math.max.apply(null, medidas.map((m) => m.tit.linhas.length * 10.5 + m.corpo.linhas.length * 9.6)) + 6;
          garantir(h + 6);
          grupo.forEach((it, k) => {
            const x = M + k * (w + gap);
            caixa(x, y, w, h, PAL.creme, PAL.suave);
            preencher(opcoesC.corNumero || PAL.vinho); doc.circle(x + 14, y + 14, 7, "F");
            doc.setTextColor(255, 255, 255); fonte("bold", 8); doc.text(String(i + k + 1), x + 14, y + 16.8, { align: "center" });
            let yy = y + 28;
            medidas[k].tit.linhas.forEach((ln) => { let cx = x + 8; ln.ws.forEach((p) => { fonte("bold", 8); cor(PAL.vinhoE); doc.text(p.t, cx, yy); cx += p.w + medidas[k].tit.esp; }); yy += 10.5; });
            yy += 1;
            medidas[k].corpo.linhas.forEach((ln) => { let cx = x + 8; ln.ws.forEach((p) => { fonte("normal", 7.3); cor(PAL.texto); doc.text(p.t, cx, yy); cx += p.w + medidas[k].corpo.esp; }); yy += 9.6; });
          });
          y += h + 6;
        }
      }
      function faixaEtapas(itens, corBase) {
        const gap = 5; const w = (L - gap * (itens.length - 1)) / itens.length;
        const cores = [PAL.vinho, PAL.teal, PAL.vinhoM, PAL.tealE, PAL.vinhoE];
        const medidas = itens.map((it) => ({ tit: it[0], corpo: quebrar(palavras(it[1]), w - 14, 7) }));
        const h = 34 + Math.max.apply(null, medidas.map((m) => m.corpo.linhas.length)) * 9;
        garantir(h + 8);
        itens.forEach((it, k) => {
          const x = M + k * (w + gap);
          preencher(cores[k % cores.length]); doc.roundedRect(x, y, w, h, 4, 4, "F");
          doc.setTextColor(255, 255, 255); fonte("bold", 14); doc.text(String(k + 1), x + 8, y + 18);
          fonte("bold", 8.2); doc.text(it[0], x + 22, y + 17);
          let yy = y + 30;
          medidas[k].corpo.linhas.forEach((ln) => { let cx = x + 7; ln.ws.forEach((p) => { fonte("normal", 7); doc.text(p.t, cx, yy); cx += p.w + medidas[k].corpo.esp; }); yy += 9; });
        });
        y += h + 8;
      }
      function blocosColoridos(itens) { // PDCA 2x2
        const gap = 6; const w = (L - gap) / 2;
        for (let i = 0; i < itens.length; i += 2) {
          const par = itens.slice(i, i + 2);
          const m = par.map((it) => quebrar(palavras(it[1]), w - 16, 7.6));
          const h = 22 + Math.max.apply(null, m.map((q) => q.linhas.length)) * 9.8;
          garantir(h + 6);
          par.forEach((it, k) => {
            const x = M + k * (w + gap);
            preencher(it[2]); doc.roundedRect(x, y, w, h, 3, 3, "F");
            fonte("bold", 8); cor(PAL.vinhoE); doc.text(it[0], x + 8, y + 12);
            let yy = y + 23;
            m[k].linhas.forEach((ln) => { let cx = x + 8; ln.ws.forEach((p) => { fonte("normal", 7.6); cor(PAL.texto); doc.text(p.t, cx, yy); cx += p.w + m[k].esp; }); yy += 9.8; });
          });
          y += h + 6;
        }
      }

      // ---- tabela com quebra de linha e de pagina -------------------------------
      // celula: "texto" | { t, fundo, cor, negrito, pilula:cor, extra, alinhar }
      function tabela(cab, linhas, larguras, o) {
        o = o || {};
        const tam = o.tam || 7.8; const lh = tam * 1.38; const pad = 3.6;
        const soma = larguras.reduce((s, v) => s + v, 0);
        const lw = larguras.map((v) => (v / soma) * L);
        const medir = (c, i) => {
          const cel = typeof c === "object" && c ? c : { t: c };
          fonte(cel.negrito ? "bold" : "normal", tam);
          const ls = cel.pilula ? [String(cel.t)] : doc.splitTextToSize(String(cel.t == null || cel.t === "" ? "-" : cel.t), lw[i] - pad * 2);
          let ex = [];
          if (cel.extra) { fonte("bold", tam - 0.6); ex = doc.splitTextToSize(String(cel.extra), lw[i] - pad * 2); }
          return { cel, ls, ex, h: cel.pilula ? 12 + pad * 2 : (ls.length + ex.length) * lh + pad * 2 - 1 };
        };
        const desenharCab = () => {
          const hh = lh + pad * 2;
          garantir(hh + 20);
          preencher(o.corCab || PAL.vinho); doc.rect(M, y, L, hh, "F");
          doc.setTextColor(255, 255, 255); fonte("bold", tam);
          let x = M; cab.forEach((c, i) => { doc.text(String(c), x + pad, y + pad + tam - 1.5, { align: "left" }); x += lw[i]; });
          y += hh;
        };
        if (cab) desenharCab();
        linhas.forEach((ln, r) => {
          const ms = ln.map(medir); const h = Math.max.apply(null, ms.map((m) => m.h));
          if (y + h > H - BASE) { novaPagina(); if (cab) desenharCab(); }
          if (r % 2 === 1) { preencher(PAL.zebra); doc.rect(M, y, L, h, "F"); }
          let x = M;
          ms.forEach((m, i) => {
            if (m.cel.fundo) { preencher(m.cel.fundo); doc.rect(x, y, lw[i], h, "F"); }
            if (m.cel.pilula) {
              fonte("bold", 7); const pw = doc.getTextWidth(String(m.cel.t)) + 10;
              preencher(m.cel.pilula); doc.roundedRect(x + pad, y + (h - 12) / 2, Math.min(pw, lw[i] - pad * 2), 12, 2.5, 2.5, "F");
              doc.setTextColor(255, 255, 255); doc.text(String(m.cel.t), x + pad + 5, y + (h - 12) / 2 + 8.6);
            } else {
              fonte(m.cel.negrito ? "bold" : "normal", tam); cor(m.cel.cor || PAL.texto);
              let yy = y + pad + tam - 1.3;
              m.ls.forEach((t) => { doc.text(t, m.cel.alinhar === "centro" ? x + lw[i] / 2 : x + pad, yy, m.cel.alinhar === "centro" ? { align: "center" } : undefined); yy += lh; });
              if (m.ex.length) { fonte("bold", tam - 0.6); cor(PAL.tealE); m.ex.forEach((t) => { doc.text(t, x + pad, yy); yy += lh; }); }
            }
            x += lw[i];
          });
          traco(PAL.suave, 0.3); doc.line(M, y + h, M + L, y + h);
          y += h;
        });
        y += 9;
      }

      // ---- matriz de risco ------------------------------------------------------------
      function desenharMatriz() {
        const n = escala.length; const eixo = 62; const lab = 14; const cw = Math.min(70, (L - eixo - lab) / n); const ch = 24;
        const total = eixo + lab + cw * n; const x0 = M + (L - total) / 2;
        garantir(ch * (n + 2) + 12);
        const y0 = y;
        fonte("bold", 7.5); preencher(PAL.vinho); doc.rect(x0 + lab + eixo, y0, cw * n, ch * 0.8, "F");
        doc.setTextColor(255, 255, 255); doc.text("GRAVIDADE", x0 + lab + eixo + (cw * n) / 2, y0 + 11, { align: "center" });
        escala.forEach((g, i) => { preencher(PAL.vinhoM); doc.rect(x0 + lab + eixo + i * cw, y0 + ch * 0.8, cw, ch * 0.8, "F"); doc.setTextColor(255, 255, 255); fonte("bold", 7); doc.text(ROTULO_ESCALA[g] || g, x0 + lab + eixo + i * cw + cw / 2, y0 + ch * 0.8 + 10.5, { align: "center" }); });
        const yl = y0 + ch * 1.6;
        preencher(PAL.vinho); doc.rect(x0, yl, lab, ch * n, "F");
        doc.setTextColor(255, 255, 255); fonte("bold", 7); doc.text("PROBABILIDADE", x0 + 9.5, yl + (ch * n) / 2 + 28, { angle: 90 });
        for (let r = 0; r < n; r++) {
          const prob = escala[n - 1 - r]; const yy = yl + r * ch;
          preencher(PAL.creme); doc.rect(x0 + lab, yy, eixo, ch, "F"); cor(PAL.texto); fonte("bold", 7); doc.text(ROTULO_ESCALA[prob] || prob, x0 + lab + eixo - 4, yy + ch / 2 + 2.5, { align: "right" });
          escala.forEach((g, i) => {
            const nivel = Calc.nivelDaMatriz(nomeMatriz, prob, g);
            preencher(corNivel(nivel)); doc.rect(x0 + lab + eixo + i * cw, yy, cw, ch, "F");
            traco(PAL.branco, 0.8); doc.rect(x0 + lab + eixo + i * cw, yy, cw, ch);
            doc.setTextColor(255, 255, 255); fonte("bold", 9); doc.text(String(Calc.pontuacaoDaMatriz(nomeMatriz, prob, g)), x0 + lab + eixo + i * cw + cw / 2, yy + ch / 2 + 3.2, { align: "center" });
          });
        }
        y = yl + ch * n + 12;
      }

      // ============================ CAPA ==========================================
      registrar("capa", "Capa", 0);
      {
        const alt = 360; const passos = 48;
        for (let p = 0; p < passos; p++) {
          const t = p / (passos - 1);
          doc.setFillColor(Math.round(PAL.vinhoE[0] + (PAL.vinho[0] - PAL.vinhoE[0]) * t), Math.round(PAL.vinhoE[1] + (PAL.vinho[1] - PAL.vinhoE[1]) * t), Math.round(PAL.vinhoE[2] + (PAL.vinho[2] - PAL.vinhoE[2]) * t));
          doc.rect((W / passos) * p, 0, W / passos + 1, alt, "F");
        }
        doc.setFont("MontserratAlternates", "bold"); doc.setFontSize(26); doc.setTextColor(255, 255, 255); doc.text("ElevaLife", M, 62);
        fonte("normal", 9.5); doc.setTextColor(232, 214, 216); doc.text(texto("Capa Lema"), M, 79);
        // logotipo do cliente (caixa branca)
        const bx = W - M - 150; const by = 40; preencher(PAL.branco); doc.roundedRect(bx, by, 150, 62, 6, 6, "F");
        if (logoCliente) {
          try {
            const pr = doc.getImageProperties(logoCliente); let w = 130; let h = w * pr.height / pr.width; if (h > 44) { h = 44; w = h * pr.width / pr.height; }
            doc.addImage(logoCliente, pr.fileType, bx + (150 - w) / 2, by + (62 - h) / 2, w, h);
          } catch (e) { fonte("bold", 10); cor(PAL.vinho); doc.text(opcoes.nomeCliente, bx + 75, by + 34, { align: "center", maxWidth: 138 }); }
        } else { fonte("bold", 10); cor(PAL.vinho); doc.text(doc.splitTextToSize(opcoes.nomeCliente, 138), bx + 75, by + 30, { align: "center" }); }
        doc.setFont("MontserratAlternates", "bold"); doc.setFontSize(30); doc.setTextColor(255, 255, 255);
        doc.text(linhasDe("Capa Titulo"), M, 205, { lineHeightFactor: 1.2 });
        fonte("normal", 10); doc.setTextColor(232, 214, 216);
        doc.text(doc.splitTextToSize(texto("Capa Subtitulo"), L - 40), M, 292);
        y = alt + 28;
        const infos = [
          ["Empresa avaliada", opcoes.nomeCliente, true],
          ["Unidade", unidadesAv.join(" · ")], ["Setores avaliados", setoresAv.join(" · ")],
          ["Período da avaliação", periodo], ["Data de emissão", emissao],
          ["Responsável técnico", responsavel ? responsavel.Nome : "-"], ["Documento / revisão", `${codigo} · Rev. ${revisao}`],
        ];
        const cw = (L - 10) / 2; let col = 0; let yy = y;
        infos.forEach((it) => {
          const larga = it[2]; const h = 34;
          const x = larga || col === 0 ? M : M + cw + 10; const w = larga ? L : cw;
          caixa(x, yy, w, h, PAL.creme);
          fonte("normal", 6.5); cor(PAL.cinza); doc.text(it[0].toUpperCase(), x + 8, yy + 11);
          fonte("bold", 9.5); cor(PAL.vinhoE); doc.text(doc.splitTextToSize(String(it[1] || "-"), w - 16)[0], x + 8, yy + 25);
          if (larga) { yy += h + 6; col = 0; } else if (col === 0) col = 1; else { yy += h + 6; col = 0; }
        });
        if (col === 1) yy += 40;
        yy += 10;
        const resumo = [[avaliacoes.length, "postos de trabalho avaliados"], [todosFatores.length, "fatores de risco identificados"], [todasAcoes.length, `ações no plano${concluidas ? ", " + concluidas + " já concluídas" : ""}`]];
        const rw = L / 3;
        resumo.forEach((r, i) => {
          const x = M + i * rw; traco(PAL.vinho, 1.4); doc.line(x, yy, x + rw - 14, yy);
          doc.setFont("MontserratAlternates", "bold"); doc.setFontSize(24); cor(PAL.vinho); doc.text(String(r[0]), x, yy + 28);
          fonte("normal", 7.5); cor(PAL.cinza); doc.text(doc.splitTextToSize(r[1], rw - 20), x, yy + 41);
        });
        fonte("normal", 7); cor(PAL.cinza);
        doc.text("Documento gerado pelo S.I.G.E – Sistema Integrado de Gestão ElevaLife.", M, H - 36);
        doc.text(new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }), W - M, H - 36, { align: "right" });
      }

      // ============================ SUMARIO ========================================
      novaPagina();
      const paginaSumario = pagina;
      registrar("sumario", "Sumário", 1);
      doc.setFont("MontserratAlternates", "bold"); doc.setFontSize(15); cor(PAL.vinho); doc.text("Sumário", M, y);
      y += 7; traco(PAL.vinho, 1.2); doc.line(M, y, M + L, y); traco(PAL.vinho, 0.5); y += 22;
      const ySumario = y; // desenhado ao final, quando se conhece a estrutura (mapa da passada 1)
      const hSum = 12 * 19 + 11 * 15.5 + avaliacoes.length * 15.5 + 40;
      const dispo1 = H - BASE - ySumario;
      const paginasSum = hSum > dispo1 ? 1 + Math.ceil((hSum - dispo1) / (H - BASE - TOPO)) : 1;
      for (let k = 1; k < paginasSum; k++) novaPagina();
      novaPagina();

      // ============================ 1-4 ================================================
      h1("s1", "1. Apresentação", false);
      paragrafos("Apresentacao");
      h1("s2", "2. A ElevaLife", false);
      paragrafos("Sobre ElevaLife");
      {
        const gap = 5; const cols = 4; const w = (L - gap * (cols - 1)) / cols;
        const etapas8 = linhasDe("Etapas Relacionamento");
        etapas8.forEach((e, i) => {
          if (i % cols === 0) garantir(30);
          const x = M + (i % cols) * (w + gap);
          caixa(x, y, w, 26, PAL.creme);
          preencher(PAL.vinho); doc.circle(x + 10, y + 13, 5.5, "F"); doc.setTextColor(255, 255, 255); fonte("bold", 6.5); doc.text(String(i + 1), x + 10, y + 15.2, { align: "center" });
          fonte("bold", 6.8); cor(PAL.vinhoE); doc.text(doc.splitTextToSize(e, w - 24).slice(0, 2), x + 19, y + (e.length > 22 ? 11 : 15));
          if (i % cols === cols - 1 || i === etapas8.length - 1) y += 31;
        });
        y += 4;
      }
      h1("s3", "3. Responsabilidade técnica e execução", false);
      paragrafos("Responsabilidade");
      {
        const gap = 8; const w = (L - gap) / 2; garantir(66);
        [["Responsável técnico", responsavel], ["Ergonomista executor", executor]].forEach(([papel, p], k) => {
          const x = M + k * (w + gap); caixa(x, y, w, 58, PAL.branco, PAL.suave);
          fonte("normal", 6.5); cor(PAL.cinza); doc.text(papel.toUpperCase(), x + 9, y + 12);
          fonte("bold", 10); cor(PAL.vinhoE); doc.text(p ? p.Nome : "-", x + 9, y + 26);
          fonte("normal", 7.5); cor(PAL.texto);
          doc.text(doc.splitTextToSize([p && p.Titulo, p && p.Registro].filter(Boolean).join("\n") || " ", w - 18), x + 9, y + 38);
        });
        y += 70;
      }
      h1("s4", "4. Demanda do trabalho", false);
      paragrafos("Demanda Intro", { depois: 3 });
      lista(linhasDe("Demanda"));

      // ============================ 5 ===================================================
      h1("s5", "5. Informações cadastrais da empresa", true);
      if (logoCliente) {
        try {
          garantir(80); caixa(M, y, L, 70, PAL.branco, PAL.suave);
          const pr = doc.getImageProperties(logoCliente); let w = 190; let h = w * pr.height / pr.width; if (h > 52) { h = 52; w = h * pr.width / pr.height; }
          doc.addImage(logoCliente, pr.fileType, M + (L - w) / 2, y + (70 - h) / 2, w, h); y += 82;
        } catch (e) { /* sem logotipo */ }
      }
      {
        const end = [docCliente.Logradouro, docCliente.Numero, docCliente.Complemento, docCliente.Bairro, [docCliente.Cidade, docCliente.Estado].filter(Boolean).join("/"), docCliente.CEP ? "CEP " + docCliente.CEP : ""].filter(Boolean).join(", ");
        const ficha = [
          ["Razão social", opcoes.nomeCliente], ["CNPJ", docCliente.CNPJ], ["Inscrição estadual", docCliente["Inscricao Estadual"]], ["CNAE", docCliente.CNAE],
          ["Grau de risco (NR-04)", docCliente["Grau Risco NR4"]], ["Unidade avaliada", unidadesAv.join(" · ")], ["Endereço", end],
          ["Telefone", docCliente.Telefone], ["Postos avaliados", `${avaliacoes.length} posto(s) de trabalho`], ["Período da avaliação", periodo],
        ].filter((r) => r[1]);
        tabela(null, ficha.map((r) => [{ t: r[0], negrito: true, fundo: PAL.creme }, String(r[1])]), [30, 70], { tam: 8.4 });
      }

      // ============================ 6 ===================================================
      h1("s6", "6. Fundamentação", true);
      h2("s61", "6.1 Ergonomia e os pilares da gestão ElevaLife");
      paragrafos("Fundamentacao Ergonomia");
      { const pilares = celulas("Pilares"); cartoes(pilares, Math.min(5, pilares.length) || 1); }
      y += 4;
      paragrafos("Pilar AEP");
      h2("s62", "6.2 A NR-17 e a Avaliação Ergonômica Preliminar");
      paragrafos("Fundamentacao NR17");
      h2("s63", "6.3 Gestão do risco ergonômico no GRO/PGR (NR-01)");
      paragrafos("Fundamentacao GRO");
      {
        const txt = texto("Prioridade Medidas");
        const q = quebrar(palavras(txt), L - 24, 8.5); const h = 28 + q.linhas.length * 12.5;
        garantir(h + 8); caixa(M, y, L, h, PAL.creme); preencher(PAL.vinho); doc.rect(M, y, 3, h, "F");
        fonte("bold", 8.5); cor(PAL.vinhoE); doc.text(titDe("caixa-prioridade", "Prioridade das medidas de prevenção"), M + 12, y + 14);
        const y0 = y; y = y0 + 27; paragrafo(txt, { tam: 8.5, largura: L - 12, recuo: 12, depois: 0 }); y = y0 + h + 8;
      }

      // ============================ 7 ===================================================
      h1("s7", "7. Métodos e metodologia utilizada", false);
      paragrafos("Metodologia");
      {
        const itens = linhasDe("Metodologia Passos"); const gap = 14; const w = (L - gap * (itens.length - 1)) / (itens.length || 1); garantir(30);
        itens.forEach((t, i) => { const x = M + i * (w + gap); caixa(x, y, w, 22, PAL.creme, PAL.suave); fonte("bold", 8); cor(PAL.vinhoE); doc.text(t, x + w / 2, y + 14, { align: "center" }); if (i < itens.length - 1) { const ax = x + w + gap / 2; traco(PAL.vinho, 1); doc.line(ax - 4, y + 11, ax + 2, y + 11); preencher(PAL.vinho); doc.triangle(ax + 2, y + 8, ax + 2, y + 14, ax + 5.5, y + 11, "F"); } });
        y += 32;
      }
      h2("s71", "7.1 As cinco etapas da gestão do risco ergonômico");
      paragrafos("Etapas Intro");
      faixaEtapas(celulas("Etapas Cinco").map((r) => [r[0], r[1] || ""]));
      paragrafos("Etapas Nota");
      blocosColoridos(celulas("PDCA").map((r, i) => [r[0], r[1] || "", CORES_PDCA[i % CORES_PDCA.length]]));
      h2("s72", "7.2 Técnicas e instrumentos");
      lista(linhasDe("Tecnicas"));
      paragrafos("AEP AET");
      tabela(["Norma / ferramenta", "Aplicação"], celulas("Metodos").map((r) => [r[0], r[1] || ""]), [32, 68]);
      h2("s73", "7.3 Lista de fatores de risco (ISO/TS 20646)");
      {
        paragrafos("ISO Intro");
        tabela(["Grupo", "Descrição do grupo", "Fatores"], Calc.GRUPOS_FATOR_RISCO.map((g, i) => [{ t: String(i + 1), alinhar: "centro" }, g, { t: String(Calc.fatoresDoGrupo(g).length), alinhar: "centro" }]), [10, 78, 12]);
        legenda(texto("ISO Legenda"));
      }
      h2("s74", "7.4 Guias de referência para graduação");
      paragrafos("Guias Intro");
      h3(titDe("adm", "Referência para postura – amplitude de movimento (ADM)"));
      tabela(["Segmento", "Postura", "Leve", "Moderada", "Acentuada", "Não recomendada"], celulas("ADM Tabela").map((r) => [0, 1, 2, 3, 4, 5].map((c) => r[c] || "")), [14, 24, 12, 14, 18, 18], { tam: 7.4 });
      legenda(texto("ADM Fonte"));
      {
        const escalas = texto("Escalas").split(/\n{2,}/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean)).filter((b) => b.length >= 2).map((b) => [b[0], b[1].split("|").map((c) => c.trim()), b.slice(2).map((l) => l.split("|").map((c) => c.trim()))]);
        const gap = 8; const w = (L - gap * (escalas.length - 1)) / (escalas.length || 1); let hmax = 0;
        garantir(80);
        const y0 = y;
        escalas.forEach(([tit, cab, lin], k) => {
          const x = M + k * (w + gap); fonte("bold", 7.8); cor(PAL.tealE); doc.text(tit.toUpperCase(), x, y0 + 8);
          const ySalvo = y; y = y0 + 14; const salvoM = M;
          // mini-tabela manual (largura fixa, sem quebra de pagina)
          const larg1 = w * 0.3; const cwid = (w - larg1) / (cab.length - 1); const px = (i) => x + (i === 0 ? 0 : larg1 + cwid * (i - 1)) + 3;
          preencher(PAL.vinho); doc.rect(x, y, w, 13, "F"); doc.setTextColor(255, 255, 255); fonte("bold", 6.8);
          cab.forEach((c, i) => doc.text(c, px(i), y + 9));
          let yy = y + 13; fonte("normal", 6.8);
          lin.forEach((r, ri) => { if (ri % 2) { preencher(PAL.zebra); doc.rect(x, yy, w, 13, "F"); } cor(PAL.texto); r.forEach((c, i) => doc.text(c, px(i), yy + 9)); yy += 13; });
          hmax = Math.max(hmax, yy - y0); y = ySalvo;
        });
        y = y0 + hmax + 8; legenda(texto("Escalas Legenda"));
      }
      h2("s75", "7.5 Interfaces com as demais frentes da ElevaLife");
      paragrafos("Interfaces Intro");
      tabela(["Frente", "Como se conecta a esta AEP"], celulas("Interfaces").map((r) => [r[0], r[1] || ""]), [32, 68]);

      // ============================ 8 ===================================================
      h1("s8", "8. Identificação e classificação do risco", true);
      const defGravidade = mapaDe("Gravidade"); const defProbabilidade = mapaDe("Probabilidade"); const defNivel = mapaDe("Graduacao");
      paragrafos("Risco Intro");
      h2("s81", "8.1 Gravidade e probabilidade");
      tabela(["Gravidade", "Efeitos"], escala.map((g, i) => [{ t: `${ROTULO_ESCALA[g] || g} (${i + 1})`, negrito: true }, defGravidade[g] || ""]), [26, 74]);
      tabela(["Probabilidade", "Perfil de exposição qualitativa"], escala.map((g, i) => [{ t: `${ROTULO_ESCALA[g] || g} (${i + 1})`, negrito: true }, defProbabilidade[g] || ""]), [26, 74]);
      h2("s82", "8.2 Matriz de risco e graduação");
      paragrafos("Matriz Intro");
      desenharMatriz();
      {
        const niveis = []; escala.forEach((p) => escala.forEach((g) => { const n = Calc.nivelDaMatriz(nomeMatriz, p, g); if (n && !niveis.includes(n)) niveis.push(n); }));
        tabela(["Pontuação", "Graduação", "Descrição do risco e conduta"], niveis.map((n) => {
          const ps = []; escala.forEach((p) => escala.forEach((g) => { if (Calc.nivelDaMatriz(nomeMatriz, p, g) === n) ps.push(Calc.pontuacaoDaMatriz(nomeMatriz, p, g)); }));
          return [`${Math.min.apply(null, ps)} a ${Math.max.apply(null, ps)}`, { t: n, pilula: corNivel(n) }, defNivel[n] || ""];
        }), [14, 18, 68]);
      }
      h2("s83", "8.3 Medidas de controle e risco residual");
      paragrafos("Medidas Intro");
      tabela(null, (Acoes ? Acoes.tipos() : []).map((t, i) => [{ t: t.rotulo, pilula: [PAL.vinhoE, PAL.tealE, PAL.vinhoM][i % 3] }, (linhasDe("Medidas Tipos")[i % (linhasDe("Medidas Tipos").length || 1)] || "")]), [22, 78]);
      {
        const txt = texto("Residual Caixa");
        const q = txt.split("\n").map((p) => quebrar(palavras(p), L - 24, 8.2)); const h = 26 + q.reduce((s, x) => s + x.linhas.length * 11.6 + 3, 0);
        garantir(h + 8); caixa(M, y, L, h, PAL.creme); preencher(PAL.vinho); doc.rect(M, y, 3, h, "F");
        fonte("bold", 8.5); cor(PAL.vinhoE); doc.text(titDe("caixa-residual", "Como o risco residual é calculado"), M + 12, y + 14);
        const y0 = y; y = y0 + 26; txt.split("\n").forEach((p) => paragrafo(p, { tam: 8.2, largura: L - 12, recuo: 12, depois: 3 })); y = y0 + h + 8;
      }

      // ============================ 9 ===================================================
      h1("s9", "9. Avaliações ergonômicas preliminares", true);
      paragrafos("Avaliacoes Intro");
      let nFigura = 0;
      avaliacoes.forEach((av, i) => {
        const chavePosto = "s9p" + i;
        const fatores = fatoresDoPosto(av);
        if (i > 0) novaPagina(); else garantir(120);
        registrar(chavePosto, `9.${i + 1} ${av.Setor} – ${av["Posto Trabalho"]}`, 2);
        preencher(PAL.vinhoE); doc.roundedRect(M, y, L, 26, 4, 4, "F");
        doc.setFont("MontserratAlternates", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
        doc.text(doc.splitTextToSize(`9.${i + 1} ${av.Setor} – ${av["Posto Trabalho"]}`, L - 20)[0], M + 10, y + 17); y += 36;
        // grade de identificacao
        const campos = [["Setor", av.Setor], ["Posto de trabalho", av["Posto Trabalho"]], ["Cargo", av.Cargo], ["Atividade", av.Atividade], ["Jornada", av["Jornada de Trabalho"]], ["Pausas", av.Pausas], ["Rodízio", av.Rodizio], ["Histórico de acidentes e doenças", av["Historico Acidentes"]]].filter((c) => c[1]);
        const cw = (L - 10) / 2;
        for (let k = 0; k < campos.length; k += 2) {
          const par = campos.slice(k, k + 2);
          const ls = par.map((c) => doc.splitTextToSize(String(c[1]), cw - 16));
          const h = 18 + Math.max.apply(null, ls.map((l) => l.length)) * 10.5;
          garantir(h + 5);
          par.forEach((c, j) => { const x = M + j * (cw + 10); caixa(x, y, cw, h, PAL.creme); fonte("normal", 6.3); cor(PAL.cinza); doc.text(c[0].toUpperCase(), x + 8, y + 10); fonte("normal", 8); cor(PAL.texto); ls[j].forEach((t, n) => doc.text(t, x + 8, y + 21 + n * 10.5)); });
          y += h + 5;
        }
        y += 4;
        // fotos
        const fotos = (av.Fotos || []).filter((f) => f && f.chave && cacheImg[f.chave]);
        if (fotos.length) {
          const gap = 8; const w = (L - gap) / 2; const hImg = 150;
          for (let k = 0; k < fotos.length; k += 2) {
            garantir(hImg + 26);
            fotos.slice(k, k + 2).forEach((f, j) => {
              const x = M + j * (w + gap); caixa(x, y, w, hImg, PAL.creme, PAL.suave);
              try {
                const dURL = cacheImg[f.chave]; const pr = doc.getImageProperties(dURL); let iw = w - 10; let ih = iw * pr.height / pr.width; if (ih > hImg - 10) { ih = hImg - 10; iw = ih * pr.width / pr.height; }
                doc.addImage(dURL, pr.fileType, x + (w - iw) / 2, y + (hImg - ih) / 2, iw, ih);
              } catch (e) { fonte("normal", 8); cor(PAL.cinza); doc.text("(imagem indisponível)", x + w / 2, y + hImg / 2, { align: "center" }); }
              nFigura++;
              fonte("normal", 7); cor(PAL.cinza); doc.text(`Figura ${nFigura} – ${(f.nomeArquivo || "registro fotográfico").replace(/\.[a-z0-9]+$/i, "").slice(0, 60)}`, x, y + hImg + 11);
            });
            y += hImg + 26;
          }
        }
        if (av["Descricao Setor"]) { h3(titDe("p-descsetor", "Descrição do setor")); paragrafo(av["Descricao Setor"]); }
        if (av["Descricao Atividade Observada"]) { h3(titDe("p-descatividade", "Descrição da atividade (tarefa real observada)")); paragrafo(av["Descricao Atividade Observada"]); }
        if (av["Caracteristicas Trabalhadores"]) { h3(titDe("p-caract", "Características dos trabalhadores")); paragrafo(av["Caracteristicas Trabalhadores"]); }
        h3(titDe("p-panorama", "Panorama do posto"));
        const cnt = contaNivel(fatores);
        azulejos(NIVEIS4.map(([k, r]) => ({ n: cnt[k], rot: r, cor: corNivel(k) })));
        // grupos
        tabela(["Grupo", "Grupo de fatores (ISO/TS 20646)", "Avaliados", "Com risco", "Diagnóstico"], Calc.GRUPOS_FATOR_RISCO.map((g, gi) => {
          const doGrupo = fatores.filter((f) => f.Grupo === g);
          const maior = doGrupo.map((f) => grau(f)).sort((a, b) => NIVEIS4.findIndex(([k]) => k === Calc.nivelCanonico(b)) - NIVEIS4.findIndex(([k]) => k === Calc.nivelCanonico(a)))[0];
          return [{ t: String(gi + 1), alinhar: "centro" }, g, { t: String(Calc.fatoresDoGrupo(g).length), alinhar: "centro" }, { t: String(doGrupo.length), alinhar: "centro" }, maior ? { t: rotCanon(Calc.nivelCanonico(maior)), pilula: corNivel(maior) } : { t: "Sem risco identificado", cor: PAL.cinza }];
        }), [8, 52, 11, 11, 18]);
        // fatores
        h3(titDe("p-fatores", "Fatores de risco identificados, medidas e ações"));
        if (!fatores.length) paragrafo("Nenhum fator de risco com “Existe Fator de Risco: Sim” cadastrado para este posto de trabalho.", { cor: PAL.cinza });
        fatores.forEach((fr) => {
          const gi = Calc.GRUPOS_FATOR_RISCO.indexOf(fr.Grupo); const fi = gi >= 0 ? Calc.fatoresDoGrupo(fr.Grupo).indexOf(fr.Fator) : -1;
          const codigoF = gi >= 0 ? `${gi + 1}.${fi >= 0 ? String.fromCharCode(97 + fi) : "?"}` : "";
          const g = grau(fr); const p = pontos(fr);
          garantir(130);
          caixa(M, y, L, 24, PAL.creme, PAL.suave);
          fonte("bold", 9); cor(PAL.vinhoE); doc.text(doc.splitTextToSize(`${codigoF} ${fr.Fator || ""}`.trim(), L - 130)[0], M + 9, y + 15.5);
          const rt = `${g}${p != null ? " · " + p : ""}`; fonte("bold", 7.5);
          const pw = doc.getTextWidth(rt) + 12; pilula(rt, corNivel(g), M + L - pw - 8, y + 15.5);
          y += 32;
          // 3 colunas
          const cwc = (L - 16) / 3;
          const cols = [["Circunstância geradora", fr["Circunstancia Geradora"]], ["Consequência", fr.Consequencia], ["Medida de controle existente", fr["Medida Controle Existente"] || "Nenhuma medida de controle existente."]];
          const ls = cols.map((c) => doc.splitTextToSize(String(c[1] || "-"), cwc));
          const hc = 12 + Math.max.apply(null, ls.map((l) => l.length)) * 10; garantir(hc + 40);
          cols.forEach((c, j) => { const x = M + j * (cwc + 8); fonte("bold", 6.3); cor(PAL.cinza); doc.text(c[0].toUpperCase(), x, y); fonte("normal", 7.8); cor(PAL.texto); ls[j].forEach((t, n) => doc.text(t, x, y + 11 + n * 10)); });
          y += hc + 6;
          // formula e risco
          fonte("normal", 7.8); cor(PAL.texto);
          doc.text(`Gravidade ${ROTULO_ESCALA[fr.Criticidade] || fr.Criticidade || "-"}  ×  Probabilidade ${ROTULO_ESCALA[fr.Probabilidade] || fr.Probabilidade || "-"}  =  Pontuação ${p != null ? p : "-"}`, M, y + 8); y += 18;
          const acoesF = acoesDe(fr);
          const resumo = acoesF.length ? Acoes.resumoRisco(g, acoesF) : null;
          garantir(20);
          fonte("bold", 6.5); cor(PAL.cinza); doc.text("RISCO DO FATOR", M, y + 7);
          let x = M + 62; x += pilula(rotCanon(Calc.nivelCanonico(g)) , corNivel(g), x, y + 8) + 6;
          if (resumo) {
            fonte("bold", 6.5); cor(PAL.cinza); doc.text("PREVISTO", x, y + 7); x += 40; x += pilula(rotCanon(resumo.previsto), corNivel(resumo.previsto), x, y + 8) + 8;
            fonte("bold", 6.5); cor(PAL.cinza); doc.text("REALIZADO", x, y + 7); x += 44; pilula(rotCanon(resumo.realizado), corNivel(resumo.realizado), x, y + 8);
          } else { fonte("normal", 7.5); cor(PAL.cinza); doc.text("sem ação proposta (risco residual não calculado)", x, y + 8); }
          y += 18;
          if (acoesF.length) {
            const sorted = acoesF.slice().sort((a, b) => (Number(a["Nr Acao"]) || 0) - (Number(b["Nr Acao"]) || 0));
            tabela(["Ação", "Descrição", "Segmento · risco", "Responsável", "Prazo", "Situação"], sorted.map((a) => linhaAcao(a, g, false)), [9, 33, 17, 15, 11, 15], { tam: 7.2 });
          }
          y += 4;
        });
      });

      function statusAcao(a) { const m = statusAcaoInfo(a); return { t: m.rotulo, pilula: m.cor }; }
      function linhaAcao(a, grauFator, comSetor) {
        const d = dadosAcao(a, grauFator);
        return [{ t: d.nr, negrito: true }, { t: `${d.tipo ? d.tipo + " – " : ""}${d.descricao}`, extra: d.evidencia }, d.segmentoRisco, d.responsavel, d.prazo, statusAcao(a)];
      }

      // ============================ 10 ==================================================
      h1("s10", "10. Plano de ação e risco residual", true);
      paragrafos("Recomendacoes");
      {
        const cont = { c: 0, a: 0, n: 0 };
        todasAcoes.forEach(({ a }) => { const s = Calc.statusDaLinhaAcao ? Calc.statusDaLinhaAcao(a, hoje) : ""; if (Acoes.estaConcluida(a)) cont.c++; else if (s === "Em Andamento" || s === "Atrasada") cont.a++; else cont.n++; });
        azulejos([{ n: todasAcoes.length, rot: "Ações no plano", cor: PAL.vinhoE }, { n: cont.c, rot: "Concluídas", cor: PAL.verde }, { n: cont.a, rot: "Em andamento / atrasadas", cor: PAL.azul }, { n: cont.n, rot: "Não iniciadas", cor: [138, 122, 120] }]);
      }
      if (todasAcoes.length) {
        const ord = todasAcoes.slice().sort((x, z) => (x.av.Setor + x.av["Posto Trabalho"]).localeCompare(z.av.Setor + z.av["Posto Trabalho"], "pt-BR") || (Number(x.a["Nr Acao"]) || 0) - (Number(z.a["Nr Acao"]) || 0));
        tabela(["Ação", "Setor · fator", "Tipo", "Descrição", "Responsável", "Prazo", "Situação"], ord.map(({ av, fr, a }) => {
          const l = linhaAcao(a, grau(fr), true);
          return [l[0], `${av.Setor} · ${fr.Fator || ""}`, { t: Acoes.rotuloTipo(a["Tipo Acao"]) || a["Categoria Acao"] || "-" }, { t: a["Acao Recomendada"] || "-", extra: l[1].extra }, l[3], l[4], l[5]];
        }), [7, 21, 13, 24, 12, 9, 14], { tam: 7 });
      } else paragrafo("Nenhuma ação cadastrada para os fatores deste documento.", { cor: PAL.cinza });
      h3(titDe("residual", "Risco residual por fator"));
      tabela(["Setor", "Fator de risco", "Risco atual", "Previsto", "Realizado"], todosFatores.map(({ av, fr }) => {
        const g = grau(fr); const ac = acoesDe(fr); const r = ac.length ? Acoes.resumoRisco(g, ac) : null;
        return [av.Setor, fr.Fator || "", { t: rotCanon(Calc.nivelCanonico(g)), pilula: corNivel(g) }, r ? { t: rotCanon(r.previsto), pilula: corNivel(r.previsto) } : { t: "Sem ação proposta", cor: PAL.cinza }, r ? { t: rotCanon(r.realizado), pilula: corNivel(r.realizado) } : { t: "–", cor: PAL.cinza }];
      }), [14, 44, 14, 14, 14], { tam: 7.4 });
      legenda(texto("Residual Legenda"));

      // ============================ 11 ==================================================
      h1("s11", "11. Referências", false);
      linhasDe("Referencias").forEach((r, i) => {
        const q = quebrar(palavras(r), L - 20, 8);
        garantir(q.linhas.length * 11.5 + 4);
        fonte("normal", 8); cor(PAL.texto); doc.text(`${i + 1}.`, M, y);
        paragrafo(r, { tam: 8, recuo: 20, depois: 2.5, justificar: false });
      });

      // ============================ 12 ==================================================
      h1("s12", "12. Conclusão e validação do documento", true);
      paragrafos("Conclusao");
      {
        // assinaturas
        y += 14; garantir(150);
        const n = Math.max(assinantes.length, 1); const gap = 18; const w = (L - gap * (n - 1)) / n;
        const ySig = y;
        (assinantes.length ? assinantes : [{ Nome: "Responsável técnico" }]).forEach((p, k) => {
          const x = M + k * (w + gap);
          if (p._assinatura) { try { const pr = doc.getImageProperties(p._assinatura); let iw = Math.min(w - 20, 150); let ih = iw * pr.height / pr.width; if (ih > 48) { ih = 48; iw = ih * pr.width / pr.height; } doc.addImage(p._assinatura, pr.fileType, x + (w - iw) / 2, ySig + 50 - ih, iw, ih); } catch (e) { /* sem imagem */ } }
          traco(PAL.suave2, 0.8); doc.line(x, ySig + 54, x + w, ySig + 54);
          fonte("bold", 9); cor(PAL.texto); doc.text(p.Nome || "-", x + w / 2, ySig + 66, { align: "center" });
          fonte("normal", 7.2); cor(PAL.cinza);
          doc.text(doc.splitTextToSize([p.Titulo, p.Registro].filter(Boolean).join(" · ") || " ", w), x + w / 2, ySig + 77, { align: "center" });
        });
        y = ySig + 100;
        // cliente
        garantir(66);
        caixa(M, y, L, 56, PAL.branco, PAL.suave2);
        fonte("bold", 8.5); cor(PAL.vinhoE); doc.text(titDe("cliente-assinatura", `Cliente – ${opcoes.nomeCliente}`), M + 10, y + 14);
        fonte("normal", 8); cor(PAL.texto);
        doc.text("Nome / cargo: ______________________________________", M + 10, y + 32); doc.text("Data: ____ / ____ / ________", M + L - 160, y + 32);
        doc.text("Assinatura: ___________________________________________", M + 10, y + 48);
        y += 70;
        // validacao + QR
        garantir(110);
        caixa(M, y, L, 100, [236, 246, 245], [160, 205, 202]);
        const qr = (typeof global.qrcode === "function") ? (() => { try { const q = global.qrcode(0, "M"); q.addData(URL_VERIFICACAO + codigo); q.make(); return q; } catch (e) { return null; } })() : null;
        const tq = 84;
        preencher(PAL.branco); doc.rect(M + 8, y + 8, tq, tq, "F");
        if (qr) {
          const mc = qr.getModuleCount(); const mod = (tq - 8) / mc; doc.setFillColor(0, 0, 0);
          for (let r = 0; r < mc; r++) for (let c = 0; c < mc; c++) if (qr.isDark(r, c)) doc.rect(M + 12 + c * mod, y + 12 + r * mod, mod + 0.15, mod + 0.15, "F");
        } else { fonte("normal", 6.5); cor(PAL.cinza); doc.text("QR Code indisponível", M + 8 + tq / 2, y + 8 + tq / 2, { align: "center" }); }
        const tx = M + tq + 22;
        fonte("bold", 9); cor(PAL.tealE); doc.text(titDe("validacao", "Validação do documento"), tx, y + 17);
        const corpo = texto("Validacao Texto");
        const y0 = y; y = y0 + 31; paragrafo(corpo, { tam: 7.8, recuo: tx - M, largura: L - 8, justificar: false, depois: 0 }); y = y0 + 110;
      }

      // ---------- sumario (agora que se conhece a estrutura) ----------------------------------------
      if (final || true) {
        const salvoY = y; const salvoP = pagina;
        let kSum = 0; doc.setPage(paginaSumario); let ys = ySumario;
        const itens = toc.filter((t) => t.nivel >= 1 && t.chave !== "sumario");
        itens.forEach((t) => {
          const pg = mapa.pags[t.chave];
          const sub = t.nivel === 2;
          if (ys > H - BASE - 6) { kSum++; doc.setPage(paginaSumario + kSum); ys = TOPO; }
          fonte(sub ? "normal" : "bold", sub ? 8.4 : 9.4); cor(PAL.texto);
          const x0 = M + (sub ? 14 : 0); const num = String(pg || "-");
          doc.text(t.titulo, x0, ys);
          const wt = doc.getTextWidth(t.titulo); const wn = doc.getTextWidth(num);
          const pontos = Math.max(0, Math.floor((L - (x0 - M) - wt - wn - 10) / doc.getTextWidth(".")));
          cor(PAL.suave2); doc.text(".".repeat(pontos), x0 + wt + 4, ys); cor(PAL.texto); doc.text(num, M + L - wn, ys);
          if (final && pg) doc.link(M, ys - 11, L, 15, { pageNumber: pg });
          ys += sub ? 15.5 : 19;
        });
        fonte("normal", 7.5); cor(PAL.cinza);
        doc.text(doc.splitTextToSize("Clique em um item do sumário para ir direto à página correspondente. Os marcadores do arquivo PDF (painel lateral do leitor) seguem a mesma estrutura.", L), M, ys + 10);
        doc.setPage(salvoP); y = salvoY;
      }

      // ---------- cabecalho e rodape (so na passada final) -----------------------------------------------
      if (final) {
        const total = doc.internal.getNumberOfPages();
        for (let p = 2; p <= total; p++) {
          doc.setPage(p);
          fonte("bold", 7.2); cor(PAL.vinho); doc.text(titDe("cabecalho", "ElevaLife · Avaliação Ergonômica Preliminar (AEP)"), M, 30);
          fonte("normal", 7.2); cor(PAL.cinza); doc.text(`Doc. ${codigo} · Rev. ${revisao}`, W - M, 30, { align: "right" });
          traco(PAL.suave, 0.6); doc.line(M, 36, W - M, 36); doc.line(M, H - 34, W - M, H - 34);
          fonte("normal", 7); cor(PAL.cinza); doc.text(`${opcoes.nomeCliente} – ${unidadesAv.join(" · ")}`, M, H - 22);
          fonte("bold", 7.5); cor(PAL.vinho); doc.text(`Página ${p} de ${total}`, W - M, H - 22, { align: "right" });
        }
      }
      return pagina;
    }

    // passada 1 (mede) -> passada 2 (final com paginas certas)
    const mapa = { pags: {} };
    const seco = new jsPDFCtor({ unit: "pt", format: "a4", orientation: "portrait" });
    if (BI.registrarFontesPDF) BI.registrarFontesPDF(seco);
    construir(seco, mapa, false);
    const doc = new jsPDFCtor({ unit: "pt", format: "a4", orientation: "portrait" });
    if (BI.registrarFontesPDF) BI.registrarFontesPDF(doc);
    doc.setProperties({ title: `Avaliação Ergonômica Preliminar – ${opcoes.nomeCliente}`, author: "ElevaLife – S.I.G.E", subject: `Documento ${codigo}`, keywords: "AEP, NR-17, NR-01, ergonomia" });
    construir(doc, mapa, true);
    return doc.output("arraybuffer");
  }

  async function gerarDocx(opcoes) {
    const ctx = await preparar(opcoes);
    return BI.LaudoDocx.construir(ctx, opcoes);
  }

  BI.Laudo = { gerar, gerarDocx, novoCodigo };
})(window);
