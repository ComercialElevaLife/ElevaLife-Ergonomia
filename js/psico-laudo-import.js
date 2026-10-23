/* ==========================================================================
   S.I.G.E — ElevaLife
   V 1.58 (Alexandre): Importação de LAUDO PSICOSSOCIAL em Word (.docx).

   Recurso À PARTE do fluxo padrão (questionário HSE-IT por colaborador). Lê um
   laudo psicossocial já pronto (Word), transcreve por Unidade/Grupo Ocupacional
   as 7 dimensões do HSE-IT (score + classificação), a média total e o "Plano de
   ação", e entrega para conferência antes de gravar.

   Por que Word e não PDF: o Word guarda as tabelas de forma estruturada, então a
   extração é 100% confiável (o PDF de 700+ páginas saía incompleto).

   Leitura do .docx sem dependência externa: o .docx é um zip; achamos
   "word/document.xml" pelo diretório central do zip e descompactamos com o
   DecompressionStream nativo do navegador (Chrome/Edge). Depois o XML é lido
   com DOMParser (no navegador).
   ========================================================================== */
"use strict";
(function (global) {
  const DIMENSOES = ["Demandas", "Controle", "Apoio da chefia", "Apoio dos colegas", "Relacionamentos", "Cargo", "Comunicação e mudanças"];

  // ---- leitura do zip (.docx) -------------------------------------------
  const dv = (buf) => new DataView(buf);
  function u16(b, o) { return dv(b).getUint16(o, true); }
  function u32(b, o) { return dv(b).getUint32(o, true); }

  // Acha, pelo diretório central do zip, a entrada "word/document.xml" e devolve
  // { metodo, inicioDados, tamComprimido }.
  function acharEntrada(buf, nomeAlvo) {
    const bytes = new Uint8Array(buf);
    const n = bytes.length;
    // End Of Central Directory: assinatura 0x06054b50, procurada do fim pra frente.
    let eocd = -1;
    for (let i = n - 22; i >= 0 && i >= n - 22 - 65536; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("Arquivo .docx inválido (sem diretório central).");
    const totalEntradas = u16(buf, eocd + 10);
    let p = u32(buf, eocd + 16); // offset do início do diretório central
    for (let k = 0; k < totalEntradas; k++) {
      if (u32(buf, p) !== 0x02014b50) break; // assinatura de entrada do diretório central
      const metodo = u16(buf, p + 10);
      const tamComp = u32(buf, p + 20);
      const nomeLen = u16(buf, p + 28);
      const extraLen = u16(buf, p + 30);
      const comentLen = u16(buf, p + 32);
      const offLocal = u32(buf, p + 42);
      const nome = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nomeLen));
      if (nome === nomeAlvo) {
        // cabeçalho local: filename/extra podem ter tamanhos diferentes do central
        const nLen = u16(buf, offLocal + 26);
        const eLen = u16(buf, offLocal + 28);
        const inicioDados = offLocal + 30 + nLen + eLen;
        return { metodo, inicioDados, tamComprimido: tamComp };
      }
      p += 46 + nomeLen + extraLen + comentLen;
    }
    throw new Error("Não achei " + nomeAlvo + " no arquivo. Confirme que é o laudo em Word (.docx).");
  }

  async function inflarRaw(uint8) {
    // deflate-raw (zip usa raw deflate, sem cabeçalho zlib)
    const ds = new global.DecompressionStream("deflate-raw");
    const stream = new global.Response(new global.Blob([uint8])).body.pipeThrough(ds);
    const buf = await new global.Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  // Lê o XML de word/document.xml de um ArrayBuffer de .docx.
  async function lerDocumentoXml(arrayBuffer) {
    const ent = acharEntrada(arrayBuffer, "word/document.xml");
    const comprimido = new Uint8Array(arrayBuffer, ent.inicioDados, ent.tamComprimido);
    const bytes = ent.metodo === 0 ? comprimido : await inflarRaw(comprimido);
    return new TextDecoder("utf-8").decode(bytes);
  }

  // ---- interpretação do conteúdo ----------------------------------------
  const norm = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  const normBaixo = (s) => norm(s).toLowerCase();
  const NORM_DIM = {}; DIMENSOES.forEach((d) => { NORM_DIM[normBaixo(d)] = d; });

  function score(s) { const m = norm(s).match(/([1-5][.,]\d\d?)/); return m ? m[1].replace(",", ".") : null; }
  function classif(s) { const m = norm(s).toUpperCase().match(/RISCO\s+(BAIXO|MODERADO|ALTO|CR[IÍ]TICO)/); return m ? m[1].replace("Í", "I") : null; }

  // Texto de um parágrafo (<w:p>): junta os <w:t>.
  function textoP(p) {
    let t = "";
    const ts = p.getElementsByTagName("w:t");
    for (let i = 0; i < ts.length; i++) t += ts[i].textContent;
    return norm(t);
  }
  // Linhas de uma tabela (<w:tbl>) -> array de arrays de texto das células.
  function linhasTabela(tbl) {
    const linhas = [];
    const trs = tbl.getElementsByTagName("w:tr");
    for (let i = 0; i < trs.length; i++) {
      // só as células diretas desta linha
      const cels = [];
      const tcs = trs[i].getElementsByTagName("w:tc");
      for (let j = 0; j < tcs.length; j++) {
        const ps = tcs[j].getElementsByTagName("w:p");
        let txt = "";
        for (let k = 0; k < ps.length; k++) txt += (k ? " " : "") + textoP(ps[k]);
        cels.push(norm(txt));
      }
      linhas.push(cels);
    }
    return linhas;
  }

  // Percorre o corpo do documento NA ORDEM (parágrafos e tabelas intercalados) e
  // monta as áreas: { unidade, grupo, dimensoes:{dim:{score,classe}}, media, plano }.
  function parsearDocumento(xml) {
    const doc = new global.DOMParser().parseFromString(xml, "application/xml");
    const body = doc.getElementsByTagName("w:body")[0];
    if (!body) throw new Error("Documento Word sem corpo reconhecível.");
    let unidade = null, grupo = null, atual = null, capturandoPlano = false;
    const areas = [];
    const filhos = body.childNodes;
    for (let i = 0; i < filhos.length; i++) {
      const el = filhos[i];
      if (el.nodeType !== 1) continue;
      const tag = el.tagName;
      if (tag === "w:p") {
        const t = textoP(el);
        if (!t || t.indexOf("....") >= 0) continue;
        let m;
        if ((m = t.match(/^UNIDADE\s*[-–]\s*(.+)$/i)) && !/^RESULTADO/i.test(t)) { unidade = norm(m[1]); grupo = null; capturandoPlano = false; }
        else if ((m = t.match(/^GRUPO OCUPACIONAL\s*[–-]\s*(.+)$/i))) { grupo = norm(m[1]); capturandoPlano = false; }
        else if (atual && /^plano de a[çc][aã]o/i.test(t)) { atual.plano = t.split(/:/)[1] ? norm(t.split(/:/).slice(1).join(":")) : ""; capturandoPlano = true; }
        else if (atual && capturandoPlano) {
          if (/^(UNIDADE|GRUPO OCUPACIONAL)\b/i.test(t) || /^Seção/i.test(t)) { capturandoPlano = false; }
          else { atual.plano = (atual.plano ? atual.plano + "\n" : "") + t; }
        }
      } else if (tag === "w:tbl") {
        const linhas = linhasTabela(el);
        const cab = (linhas[0] || []).join(" ");
        if (/Seção/i.test(cab) && /Score/i.test(cab)) {
          const dimensoes = {};
          for (let r = 1; r < linhas.length; r++) {
            const nm = normBaixo(linhas[r][0]);
            if (NORM_DIM[nm]) dimensoes[NORM_DIM[nm]] = { score: score(linhas[r][1]), classe: classif(linhas[r][2] != null ? linhas[r][2] : linhas[r][1]) };
          }
          atual = { unidade, grupo, dimensoes, media: null, plano: "" };
          areas.push(atual);
          capturandoPlano = false;
        } else if (/Resultado HSE-IT/i.test(cab) && atual) {
          for (let r = 0; r < linhas.length; r++) {
            const juncao = linhas[r].join(" ");
            if (/m[eé]dia total/i.test(juncao)) atual.media = { score: score(linhas[r][1] != null ? linhas[r][1] : juncao), classe: classif(juncao) };
          }
        }
      }
    }
    // separa o total geral (sem unidade) das áreas por unidade/grupo
    const porArea = areas.filter((a) => a.unidade && a.grupo);
    const geral = areas.find((a) => !a.unidade) || null;
    return { geral, areas: porArea, dimensoes: DIMENSOES };
  }

  async function lerLaudo(arrayBuffer) {
    const xml = await lerDocumentoXml(arrayBuffer);
    return parsearDocumento(xml);
  }

  global.BI = global.BI || {};
  global.BI.PsicoLaudoImport = { lerLaudo, lerDocumentoXml, parsearDocumento, DIMENSOES };
})(typeof window !== "undefined" ? window : globalThis);
