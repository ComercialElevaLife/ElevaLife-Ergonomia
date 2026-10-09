/* S.I.G.E V 1.35 - Importar AET (Word .docx ou PDF) - sub-aba AET › Importar AET.

   Le uma AET feita fora do sistema (modelo ElevaLife ou de outras empresas), identifica empresa, setor,
   posto, cargo, organizacao do trabalho, demandas, ambiente, ciclo, cargas, atividades (descricao, fotos e
   fatores de risco com consequencia, metodologia, criticidade, probabilidade e grau) e o diagnostico, e
   monta uma AET do sistema para o ergonomista conferir. Na conferencia, o que nao existir no Cadastro Empresa
   (empresa, unidade, setor, posto, cargo) e criado; cada AET abre no editor da AET ja preenchida e so e gravada
   (com os riscos no Inventario e as acoes no Plano de Acao) quando o ergonomista clica em Salvar AET.

   Leitura:
   - Word (.docx): texto, tabelas e imagens (fotos do posto e das atividades), na ordem do documento.
   - PDF: texto com a posicao de cada trecho (linhas e colunas reconstruidas); imagens nao sao lidas.
   Modelos variados: a leitura e por aproximacao (rotulos conhecidos); o que nao for reconhecido fica em
   branco para completar no editor. */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const Calc = () => BI.Calc;
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const limpa = (s) => String(s || "").replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  // ------------------------------------------------------------------ leitura do Word (.docx)
  async function lerZip(buf) {
    if (!g.XLSX || !g.XLSX.CFB) throw new Error("A biblioteca de leitura de arquivos não carregou. Atualize a página (Ctrl+F5).");
    const cfb = g.XLSX.CFB.read(new Uint8Array(buf), { type: "array" });
    const arq = (nome) => { const e = g.XLSX.CFB.find(cfb, "/" + nome) || g.XLSX.CFB.find(cfb, nome); return e ? e.content : null; };
    return arq;
  }
  const dec = (u8) => new TextDecoder("utf-8").decode(u8 instanceof Uint8Array ? u8 : new Uint8Array(u8));
  async function lerDocx(arquivo) {
    const arq = await lerZip(await arquivo.arrayBuffer());
    const xml = arq("word/document.xml"); if (!xml) throw new Error("O arquivo não parece ser um Word (.docx).");
    const rels = {}; const rx = arq("word/_rels/document.xml.rels");
    if (rx) { const d = new DOMParser().parseFromString(dec(rx), "application/xml"); Array.from(d.getElementsByTagName("Relationship")).forEach((r) => { rels[r.getAttribute("Id")] = r.getAttribute("Target"); }); }
    const doc = new DOMParser().parseFromString(dec(xml), "application/xml");
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const imagens = []; // { id, nome, bytes, tipo }
    const imagemDe = (rid) => {
      const alvo = rels[rid]; if (!alvo) return null;
      const caminho = ("word/" + alvo).replace(/\/\.\//g, "/").replace(/word\/\.\.\//, "");
      const bytes = arq(caminho); if (!bytes) return null;
      const ext = (caminho.split(".").pop() || "").toLowerCase();
      const tipo = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;
      if (!tipo) return null; // emf/wmf/gif nao entram
      const im = { id: imagens.length, nome: caminho.split("/").pop(), bytes: new Uint8Array(bytes), tipo };
      imagens.push(im); return im.id;
    };
    const textoDe = (el) => {
      const partes = [];
      const walk = (n) => {
        for (const c of Array.from(n.childNodes)) {
          if (c.nodeType !== 1) continue;
          const ln = c.localName;
          if (ln === "t") partes.push(c.textContent);
          else if (ln === "tab") partes.push(" ");
          else if (ln === "br" || ln === "cr") partes.push("\n");
          else if (ln === "p" && c !== el) { walk(c); partes.push("\n"); }
          else if (ln === "tbl") continue; // tabela aninhada: lida a parte
          else walk(c);
        }
      };
      walk(el); return limpa(partes.join(""));
    };
    const imgsDe = (el) => Array.from(el.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "blip")).map((b) => imagemDe(b.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed") || b.getAttribute("r:embed"))).filter((x) => x != null);
    const linhas = []; // [{ cells: [texto], imgs: [id], tabela: bool }]
    const percorrer = (pai) => {
      for (const el of Array.from(pai.childNodes)) {
        if (el.nodeType !== 1 || el.namespaceURI !== W) continue;
        if (el.localName === "p") { const t = textoDe(el); const im = imgsDe(el); if (t || im.length) linhas.push({ cells: [t], imgs: im, tabela: false }); }
        else if (el.localName === "tbl") {
          for (const tr of Array.from(el.childNodes).filter((x) => x.localName === "tr")) {
            const tcs = Array.from(tr.childNodes).filter((x) => x.localName === "tc");
            const cells = tcs.map((tc) => textoDe(tc)); const im = [].concat(...tcs.map(imgsDe));
            if (cells.some(Boolean) || im.length) linhas.push({ cells, imgs: im, tabela: true });
            tcs.forEach((tc) => Array.from(tc.childNodes).filter((x) => x.localName === "tbl").forEach((t) => percorrer({ childNodes: [t] })));
          }
        } else if (el.localName === "sdt" || el.localName === "sdtContent" || el.localName === "body") percorrer(el);
      }
    };
    percorrer(doc.getElementsByTagNameNS(W, "body")[0]);
    return { linhas, imagens };
  }

  // ------------------------------------------------------------------ leitura do PDF (texto com posicao)
  async function lerPdf(arquivo) {
    if (!g.pdfjsLib) throw new Error("O leitor de PDF não carregou. Atualize a página (Ctrl+F5).");
    const pdf = await g.pdfjsLib.getDocument({ data: await arquivo.arrayBuffer(), isEvalSupported: false }).promise;
    const linhas = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 200); p++) {
      const pg = await pdf.getPage(p); const tc = await pg.getTextContent(); const base = p * 10000;
      const itens = tc.items.filter((it) => it.str && it.str.trim()).map((it) => ({ x: it.transform[4], y: Math.round(it.transform[5]), w: it.width || 0, s: it.str }));
      const porY = [];
      itens.sort((a, b) => b.y - a.y || a.x - b.x).forEach((it) => { const l = porY.find((r) => Math.abs(r.y - it.y) <= 2.5); if (l) l.itens.push(it); else porY.push({ y: it.y, itens: [it] }); });
      porY.forEach((r) => {
        r.itens.sort((a, b) => a.x - b.x); const cells = []; const xs = []; let atual = null; let fim = -1e9;
        r.itens.forEach((it) => { if (atual === null || it.x - fim > 14) { if (atual !== null) cells.push(atual.trim()); atual = it.s; xs.push(it.x); } else atual += (it.x - fim > 1.5 ? " " : "") + it.s; fim = it.x + it.w; });
        if (atual !== null) cells.push(atual.trim());
        // y cresce para baixo ao longo do documento (pagina * 10000 - y da pagina)
        if (cells.some(Boolean)) linhas.push({ cells, xs, y: base - r.y, itens: r.itens.map((it) => ({ x: it.x, w: it.w, s: it.s })), imgs: [], tabela: cells.length > 1 });
      });
    }
    return { linhas, imagens: [], pdf: true };
  }

  // ------------------------------------------------------------------ interpretacao
  const RX = {
    cliente: /^(nome do cliente|raz[aã]o social|empresa( avaliada| contratante)?|cliente)\s*[:\-–]\s*(.+)$/i,
    cnpj: /cnpj\s*[:\-–]?\s*([\d./-]{14,20})/i,
    setor: /(?:^|\b)setor(?:\s*\/\s*ghe)?\s*[:\-–]\s*(.+?)(?=\s*(?:\/|\||posto de trabalho|posto|fun[cç][aã]o|cargo)\s*[:\-–]|$)/i,
    posto: /posto(?: de trabalho)?\s*[:\-–]\s*(.+?)(?=\s*(?:\/|\||fun[cç][aã]o|cargo|setor)\s*[:\-–]|$)/i,
    cargo: /(?:fun[cç][aã]o|cargo)\s*[:\-–]\s*(.+?)(?=\s*(?:\/|\||posto|setor)\s*[:\-–]|$)/i,
    unidade: /^unidade\s*[:\-–]\s*(.+)$/i,
    cabecalhoPosto: /^setor\s+(.+?)\s*[–-]\s*posto\s+(.+?)\s*[–-]\s*(?:cargo|fun[cç][aã]o)\s*:?\s*(.+)$/i,
    atividade: /^atividade\s*(\d+)\s*[:\-–.]?\s*(.*)$/i,
  };
  const ROT_ORG = [["Jornada", /^jornada/], ["Ritmo", /^ritmo/], ["Rodizio", /^(rotatividade|rod[ií]zio)/], ["Necessidades", /^necessidades/], ["Pausas", /^(micro ?pausas|pausas)/]];
  const ROT_DEM = [["estresse", /^estresse/], ["sobrecarga", /^sobrecarga/], ["concentracao", /^n[ií]vel de concentra/], ["conflitos", /^conflitos/], ["comunicacao", /^comunica/], ["divergentes", /^demandas divergentes/], ["multiplas", /^m[uú]ltiplas tarefas/], ["autonomia", /^autonomia/], ["insatisfacao", /^insatisfa/]];
  const ROT_AMB = [["Descricao Ambiente", /^descri[cç][aã]o do ambiente\s*:?/i], ["Iluminacao", /^ilumina[cç][aã]o\s*:/i], ["Ruido", /^ru[ií]do\s*:/i], ["Temperatura", /^temperatura\s*:/i]];
  const FERR_POR_NOME = [[/niosh/i, "niosh"], [/kim.*(empurr|pux)|push|pull/i, "kimPp"], [/\bkim\b|kim[- ]?lhc|lmm/i, "kimLhc"], [/\brula\b/i, "rula"], [/\breba\b/i, "reba"], [/check.*ocra|ocra.*check|tradicional/i, "ocraTrad"], [/\bocra\b/i, "ocra"], [/\brosa\b/i, "rosa"], [/strain|moore/i, "strain"], [/liberty|snook/i, "liberty"], [/\bqec\b/i, "qec"], [/rodgers/i, "rodgers"], [/nasa/i, "nasa"], [/ergos/i, "ergos"], [/plibel/i, "plibel"], [/\bice\b/i, "ice"], [/\bhal\b|acgih/i, "hal"], [/nr[- ]?17|checklist nr/i, "nr17"]];

  // Termos usuais nas AETs -> fator da lista ISO/TS 20646 (a ordem importa: o primeiro que casar vale)
  const SINONIMOS = [
    [/acima do ombro|abaixo do joelho/, "Manuseio de objetos de trabalho acima do ombro ou abaixo do joelho"],
    [/empurr|pux/, "Forças acentuadas para empurrar e puxar"],
    [/levantament|carregar|manuseio de carga|transporte (manual )?de carga|carga - transporte|movimentacao (manual )?de carga/, "Levantar e carregar objetos pesados"],
    [/repetit/, "Trabalho repetitivo (ciclos idênticos, menores que 30 seg)"],
    [/teclado|digita/, "Trabalho intensivo com um teclado ou outros dispositivos de entrada de dados"],
    [/(posicao|postura) (prolongad|)?.*(sentad|em pe|ortostat)|trabalho (em pe|sentado)|ortostat/, "Trabalho prolongado em posição sentada/de pé"],
    [/postura|membros superiores|flexao|rotacao de tronco/, "Posturas e movimentos desconfortáveis"],
    [/grande forca|esforco fisico|forca/, "Trabalho requer grande força"],
    [/precisao/, "Trabalho de precisão"],
    [/requisitos visuais|acuidade|esforco visual/, "Elevados requisitos visuais"],
    [/altura.*(bancada|superficie|mesa)|mobiliario|bancada/, "Altura e dimensões inadequadas da superfície de trabalho"],
    [/vibra/, "Vibração em todo o corpo ou vibração na mão e braço"],
    [/ilumina/, "Condições visuais precárias (iluminação insuficiente)"],
    [/ruido/, "Ruído inadequado"],
    [/calor|frio|temperatura|termic/, "Ambiente de trabalho extremamente quente ou frio"],
    [/piso/, "Piso escorregadio e/ou irregular"],
    [/sobrecarga|mental|cognit/, "Sobrecarga ou subcarga mental"],
    [/pressao de tempo|ritmo|metas/, "Pressão de tempo e altas demandas"],
    [/estresse/, "Estresse relacionado ao trabalho"],
    [/hora extra/, "Longas e frequentes horas extras de trabalho (>2h/dia e >2x na semana)"],
    [/jornada/, "Jornada longa de trabalho de mais de 8h por dia"],
  ];
  function casarFator(texto) {
    const C = Calc(); const alvo = norm(texto); if (!alvo) return { grupo: "", fator: "", outro: "" };
    for (const [rx, nome] of SINONIMOS) if (rx.test(alvo)) { const gr = (C.GRUPOS_FATOR_RISCO || []).find((g0) => (C.fatoresDoGrupo(g0) || []).includes(nome)); if (gr) return { grupo: gr, fator: nome, outro: "" }; }
    const tok = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2));
    const ta = tok(texto); let melhor = null; let nota = 0;
    (C.GRUPOS_FATOR_RISCO || []).forEach((gr) => (C.fatoresDoGrupo(gr) || []).forEach((f) => {
      if (norm(f) === alvo) { melhor = { grupo: gr, fator: f }; nota = 2; return; }
      const tb = tok(f); let comum = 0; ta.forEach((w) => { if (tb.has(w)) comum++; });
      const n = comum / Math.max(ta.size, tb.size, 1); if (n > nota) { nota = n; melhor = { grupo: gr, fator: f }; }
    }));
    return nota >= 0.6 && melhor ? { grupo: melhor.grupo, fator: melhor.fator, outro: "" } : { grupo: melhor && nota >= 0.3 ? melhor.grupo : "", fator: "__outro", outro: limpa(texto) };
  }
  function casarSegmento(texto) {
    const segs = (BI.Acoes && BI.Acoes.segmentosDisponiveis ? BI.Acoes.segmentosDisponiveis() : []);
    const t = norm(texto);
    const mapa = [[/lombar|coluna/, "Lombar"], [/cervical|pescoco/, "Cervical"], [/dorsal|tronco/, "Dorsal"], [/ombro|membros superiores/, "Ombro"], [/cotovelo|antebraco/, "Cotovelo"], [/punho/, "Punho"], [/mao|maos|dedo/, "Mao"], [/quadril/, "Quadril"], [/joelho|membros inferiores|perna/, "Joelho"], [/tornozelo/, "Tornozelo"], [/\bpe\b|\bpes\b/, "Pe"], [/psico|mental|cognit/, "Psicossocial"]];
    for (const [rx, s] of mapa) if (rx.test(t)) { const achado = segs.find((x) => norm(x) === norm(s)); if (achado) return achado; }
    const direto = segs.find((x) => t.includes(norm(x))); return direto || (segs.find((x) => /nao identificado/.test(norm(x))) || "");
  }
  const numDe = (s) => { const m = String(s || "").match(/\((\d)\)|^\s*(\d)\s*$|\b(\d)\b/); return m ? Number(m[1] || m[2] || m[3]) : null; };
  const nivelTexto = (s) => { const t = norm(s); if (!t) return ""; if (/altissim|muito alto|intoler|critic/.test(t)) return "Muito Alto"; if (/\balto\b/.test(t)) return "Alto"; if (/moderad|medio|media/.test(t)) return "Moderado"; if (/baix|trivial|irrelev|tolerav|aceitav/.test(t)) return "Baixo"; return ""; };

  function interpretar(lido, nomeArquivo) {
    const L = lido.linhas; const res = { cliente: "", cnpj: "", aets: [], avisos: [] };
    let atual = null; let ativ = null; let modo = ""; let fatCols = null; let medFator = "";
    const novaAet = (base) => { atual = { setor: "", posto: "", cargo: "", unidade: "", d: { "Descricao Setor": "", "Descricao Cargo": "", Demandas: {}, Medicoes: [], Ciclos: [], Cargas: [], Atividades: [], "Foto Geral": [], "Arquivo Importado": nomeArquivo }, fotosGeral: [], ...base }; res.aets.push(atual); ativ = null; modo = ""; return atual; };
    const garantirAet = () => atual || novaAet({});
    const adicionarFator = (cells, fc) => {
      const pega = (k) => (fc[k] >= 0 ? cells[fc[k]] || "" : "");
      const m = casarFator(cells[0]); const conseq = pega("conseq"); const met = pega("met");
      const ferramentas = []; FERR_POR_NOME.forEach(([rx, id]) => { if (rx.test(met) && !ferramentas.some((x) => x.id === id)) ferramentas.push({ id, valores: {}, exposicao: null, nivelManual: "" }); });
      ativ.fatores.push({ uid: uid(), grupo: m.grupo, fator: m.fator, outro: m.outro, consequencia: conseq || "", segmento: casarSegmento(pega("seg") + " " + conseq), fonte: met && !ferramentas.length ? "Metodologia informada: " + met : "", ferramentas, exposicao: "", severidade: "",
        _crit: numDe(pega("crit")), _prob: numDe(pega("prob")), grauImportado: nivelTexto(pega("grau")) });
    };
    const proximaTexto = (i) => { for (let k = i + 1; k < Math.min(L.length, i + 6); k++) { const t = L[k].cells.filter(Boolean).join("\n"); if (t) return { t, k }; } return { t: "", k: i }; };
    for (let i = 0; i < L.length; i++) {
      const row = L[i]; const cells = row.cells.map(limpa); const tudo = cells.filter(Boolean).join(" / "); const n0 = norm(cells[0] || "");
      // empresa
      if (!res.cliente) { for (const c of cells) for (const parte of c.split(/\n| \/ /)) { const m = parte.trim().match(RX.cliente); if (m && m[2] && !/x{2,}/i.test(m[2])) { res.cliente = limpa(m[2]).replace(/\s*cnpj.*$/i, ""); break; } } }
      if (!res.cnpj) { const m = tudo.match(RX.cnpj); if (m) res.cnpj = m[1]; }
      // inicio de uma AET (setor / posto / cargo)
      const cab = (cells[0] || "").match(RX.cabecalhoPosto);
      const temSetor = /\bsetor\s*(\/\s*ghe)?\s*[:\-–]/i.test(tudo) && /(posto|fun[cç][aã]o|cargo)\s*(de trabalho)?\s*[:\-–]/i.test(tudo);
      if (cab || temSetor) {
        const blob = cells.join(" / ").replace(/\n/g, " / ");
        const s = cab ? cab[1] : ((blob.match(RX.setor) || [])[1] || ""); const p = cab ? cab[2] : ((blob.match(RX.posto) || [])[1] || ""); const c = cab ? cab[3] : ((blob.match(RX.cargo) || [])[1] || "");
        const lixo = (v) => !v || /^x+$/i.test(v.trim());
        const val = (v) => (lixo(v) ? "" : limpa(v).replace(/[\s/|]+$/, ""));
        // titulo "SETOR X – POSTO Y – CARGO: Z" seguido da tabela "Setor: / Posto: / Funcao:" = a mesma AET
        const mesma = atual && !atual.d.Atividades.length && (!atual.setor || !val(s) || norm(atual.setor) === norm(val(s)));
        if (mesma) { if (val(s)) atual.setor = val(s); if (val(p)) atual.posto = val(p); if (val(c)) atual.cargo = val(c); }
        else novaAet({ setor: val(s), posto: val(p), cargo: val(c) });
        continue;
      }
      const mu = (cells[0] || "").match(RX.unidade); if (mu) { garantirAet().unidade = limpa(mu[1]); continue; }
      // rotulos de bloco (titulo de tabela)
      if (/^descri[cç][aã]o do setor/.test(n0)) { const p = proximaTexto(i); garantirAet().d["Descricao Setor"] = cells[1] || p.t; if (!cells[1]) i = p.k; continue; }
      if (/^descri[cç][aã]o da popula/.test(n0)) {
        const p = cells[1] ? { t: cells[1], k: i } : proximaTexto(i); const t = p.t; const a = garantirAet();
        const tot = t.match(/(\d+)\s*(colaboradores|trabalhadores|pessoas|funcion)/i) || t.match(/popula[cç][aã]o\s*(de|:)?\s*(\d+)/i); const m = t.match(/(\d+)\s*(pessoas\s*)?(do sexo\s*)?masculin/i); const f = t.match(/(\d+)\s*(pessoas\s*)?(do sexo\s*)?feminin/i);
        if (tot) a.d["Populacao Total"] = Number(tot[1] && /^\d+$/.test(tot[1]) ? tot[1] : tot[2]); if (m) a.d["Populacao Masculina"] = Number(m[1]); if (f) a.d["Populacao Feminina"] = Number(f[1]);
        i = p.k; continue;
      }
      if (/^descri[cç][aã]o do cargo/.test(n0)) { const resto = (cells[0] || "").replace(/^descri[cç][aã]o do cargo[^:]*:\s*/i, ""); const p = resto ? { t: resto, k: i } : proximaTexto(i); garantirAet().d["Descricao Cargo"] = p.t.replace(/^\s*-\s*/gm, "").trim(); i = p.k; continue; }
      // organizacao / demandas (linhas rotulo | valor)
      if (cells.length >= 2 && cells[1]) {
        const o = ROT_ORG.find(([, rx]) => rx.test(n0)); if (o && atual) { atual.d[o[0]] = cells[1]; continue; }
        const dm = ROT_DEM.find(([, rx]) => rx.test(n0)); if (dm && atual) { atual.d.Demandas[dm[0]] = cells[1]; continue; }
      } else if (atual && cells.length === 1) {
        const o = ROT_ORG.find(([, rx]) => rx.test(n0)); if (o && !/^an[aá]lise/.test(n0)) { const p = proximaTexto(i); if (p.t && !ROT_ORG.some(([, rx]) => rx.test(norm(p.t)))) { atual.d[o[0]] = p.t; i = p.k; continue; } }
      }
      // posto e ambiente
      if (/^an[aá]lise do posto de trabalho$/.test(n0)) { modo = "posto"; continue; }
      if (/^vis[aã]o geral do posto/.test(n0)) { modo = "fotoGeral"; continue; }
      if (modo === "fotoGeral" && row.imgs.length) { garantirAet().fotosGeral.push(...row.imgs); modo = "posto"; continue; }
      const amb = ROT_AMB.find(([, rx]) => rx.test(cells[0] || "")); if (amb && atual) { const v = limpa((cells[0] || "").replace(amb[1], "")) || cells[1] || proximaTexto(i).t; atual.d[amb[0]] = v; continue; }
      if (modo === "posto" && atual && !atual.d["Descricao Posto"] && cells.filter(Boolean).length) { atual.d["Descricao Posto"] = cells.filter(Boolean).join("\n"); continue; }
      // medicoes
      const mf = (cells[0] || "").match(/^fator\s*:\s*(.+)$/i); if (mf) { medFator = limpa(mf[1]); modo = "medicao"; continue; }
      if (modo === "medicao" && atual) {
        if (/^considera[cç][oõ]es t[eé]cnicas/i.test(cells[0] || "") || /^obs/i.test(cells[0] || "")) { atual.d["Consideracoes Ambiente"] = [atual.d["Consideracoes Ambiente"], cells[0]].filter(Boolean).join("\n"); continue; }
        if (/^medi[cç][aã]o/i.test(norm(cells[0]))) continue;
        if (cells.length >= 3 && cells[0]) { atual.d.Medicoes.push({ fator: medFator, local: "", medicao: cells[0], parametro: cells[1], condicao: cells[2] }); continue; }
        if (/^n[aã]o se aplica/i.test(cells[0] || "")) continue;
      }
      if (/^manifesta[cç][oõ]es/.test(n0)) { const p = proximaTexto(i); if (atual) atual.d.Manifestacoes = p.t; i = p.k; modo = ""; continue; }
      if (/^ciclo de trabalho/.test(n0)) { modo = "ciclo"; continue; }
      if (modo === "ciclo") { if (/^atividade$/i.test(cells[0] || "")) continue; if (cells.length >= 2 && cells[0]) { garantirAet().d.Ciclos.push({ atividade: cells[0], tempo: cells[1] || "", ciclos: cells[2] || "" }); continue; } }
      if (/^movimenta[cç][aã]o manual de carga/.test(n0)) { modo = "carga"; continue; }
      if (modo === "carga") { if (/^cargas? movimentad/i.test(norm(cells[0]))) continue; if (cells.length >= 2 && cells[0]) { garantirAet().d.Cargas.push({ carga: cells[0], peso: cells[1] || "", padrao: cells[2] || "", vezes: cells[3] || "" }); continue; } }
      // atividades
      const ma = (cells[0] || "").match(RX.atividade);
      if (ma && (cells.length === 1 || !cells[1])) { const a = garantirAet(); ativ = { uid: uid(), nome: limpa(ma[2]) || "Atividade " + ma[1].padStart(2, "0"), descricao: "", fotos: [], _fotos: [], fatores: [], recomendacoes: "" }; a.d.Atividades.push(ativ); modo = "ativ"; fatCols = null; continue; }
      if (ativ && /^descri[cç][aã]o da atividade/i.test(cells[0] || "")) { const resto = (cells[0] || "").replace(/^descri[cç][aã]o da atividade\s*:?\s*/i, ""); const p = resto ? { t: resto, k: i } : proximaTexto(i); ativ.descricao = p.t; i = p.k; continue; }
      if (ativ && /^registro fotogr[aá]fico/i.test(cells[0] || "")) { modo = "fotosAtiv"; continue; }
      if (ativ && row.imgs.length && (modo === "fotosAtiv" || modo === "ativ")) { ativ._fotos.push(...row.imgs); continue; }
      // tabela de fatores (cabecalho com Fator e Risco/Grau)
      if (cells.length >= 3 && /^fator(es)?( de risco)?\b/.test(n0) && cells.some((c) => /consequ|grau|metodolog/i.test(c))) {
        const colunasDe = (cs) => { const idx = (rx) => cs.findIndex((c) => rx.test(norm(c))); return { fator: 0, conseq: idx(/consequ/), seg: idx(/segmento/), met: idx(/metodolog|ferrament/), crit: idx(/criticidade|severidade|gravidade/), prob: idx(/probabilidade|exposi/), grau: (() => { const gI = idx(/^grau|grau de risco|graduacao/); return gI > 0 ? gI : cs.findIndex((c, q) => q > 0 && /risco$/.test(norm(c))); })() }; };
        if (!ativ) { const a = garantirAet(); ativ = { uid: uid(), nome: "Atividade 01", descricao: "", fotos: [], _fotos: [], fatores: [], recomendacoes: "" }; a.d.Atividades.push(ativ); }
        if (!lido.pdf) { fatCols = colunasDe(cells); modo = "fatores"; continue; }
        // PDF: as celulas quebram em varias linhas e o texto fica centralizado na celula. As colunas saem da
        // posicao x das palavras do cabecalho; cada registro e ancorado na coluna de uma linha so (metodologia,
        // grau, criticidade ou probabilidade) e cada linha vai para a ancora mais proxima.
        const RX_CAB = /^(fator|de|risco|riscos|consequ|ncia|encia|metodologia|de estudo|estudo|criticidade|severidade|gravidade|probabilidade|exposi|grau|segmento|acometido|corporal)/;
        const cab = [row]; let k = i + 1;
        while (k < L.length && L[k].cells.every((c) => RX_CAB.test(norm(c)))) { cab.push(L[k]); k++; }
        const resto = [];
        while (k < L.length) { const c0 = limpa(L[k].cells[0] || ""); if (/^(recomenda|mem[oó]rial|atividade\s*\d|diagn[oó]stico|registro fotogr)/i.test(c0)) break; resto.push(L[k]); k++; }
        const itCab = [].concat(...cab.map((r) => (r.itens || []).map((it) => Object.assign({ y: r.y }, it)))).filter((it) => it.s.trim()).sort((a, b) => a.x - b.x);
        const colunas = []; itCab.forEach((it) => { const c = colunas[colunas.length - 1]; if (c && it.x - c.x <= 35) c.itens.push(it); else colunas.push({ x: it.x, itens: [it] }); });
        const cabTxt = colunas.map((c) => limpa(c.itens.sort((a, b) => a.y - b.y || a.x - b.x).map((x) => x.s).join(" ")));
        const fc = colunasDe(cabTxt);
        const colDe = (x) => { let j = 0; colunas.forEach((c, q) => { if (x >= c.x - 10) j = q; }); return j; };
        const linhasDados = resto.map((r) => ({ y: r.y, itens: (r.itens || []).filter((it) => it.s.trim()).map((it) => Object.assign({ col: colDe(it.x), y: r.y }, it)) })).filter((r) => r.itens.length);
        const ancoraCol = [fc.met, fc.grau, fc.crit, fc.prob].find((c) => c >= 0 && linhasDados.some((r) => r.itens.some((it) => it.col === c)));
        const ancoras = ancoraCol != null ? linhasDados.filter((r) => r.itens.some((it) => it.col === ancoraCol)).map((r) => r.y) : [];
        const regs = (ancoras.length ? ancoras : [null]).map(() => colunas.map(() => []));
        linhasDados.forEach((r) => { let q = 0; if (ancoras.length) { let d = 1e9; ancoras.forEach((ay, ai) => { const dd = Math.abs(ay - r.y); if (dd < d) { d = dd; q = ai; } }); } r.itens.forEach((it) => regs[q][it.col].push(it)); });
        regs.map((cols) => cols.map((a) => limpa(a.sort((x, y) => x.y - y.y || x.x - y.x).map((x) => x.s).join(" ")))).filter((r) => r[0]).forEach((r) => adicionarFator(r, fc));
        i = k - 1; modo = ""; continue;
      }
      if (modo === "fatores" && fatCols && ativ) {
        if (!cells[0] || /^recomenda/i.test(cells[0])) { if (/^recomenda/i.test(cells[0] || "")) modo = "recom"; else if (!cells.some(Boolean)) continue; }
        else if (cells.length >= 2) { adicionarFator(cells, fatCols); continue; }
      }
      if (/^recomenda[cç][oõ]es espec/i.test(cells[0] || "")) { modo = "recom"; continue; }
      if (modo === "recom" && ativ) { if (/^mem[oó]rial de c[aá]lculo/i.test(cells[0] || "")) { modo = "memorial"; continue; } const t = cells.filter(Boolean).join(" "); if (t) ativ.recomendacoes = [ativ.recomendacoes, t].filter(Boolean).join("\n"); continue; }
      if (/^mem[oó]rial de c[aá]lculo/i.test(cells[0] || "")) { modo = "memorial"; continue; }
      if (/^diagn[oó]stico global/i.test(cells[0] || "")) { const p = cells[1] ? { t: cells[1], k: i } : proximaTexto(i); if (atual) atual.d["Diagnostico Global"] = p.t; i = p.k; modo = ""; ativ = null; continue; }
      if (/^(conclus[aã]o|encerramento|certificado)/i.test(n0) && !row.tabela) { modo = "fim"; ativ = null; }
    }
    // limpeza: AETs sem nada
    res.aets = res.aets.filter((a) => a.setor || a.posto || a.cargo || a.d.Atividades.length);
    if (!res.aets.length) res.avisos.push("Não foi possível identificar setor, posto, cargo ou atividades neste arquivo.");
    res.aets.forEach((a) => { a.d.Atividades.forEach((at) => { at.fatores.forEach((fa) => { if (!fa.consequencia) res.avisos.push(`“${at.nome}”: fator sem consequência – complete no editor.`); }); }); });
    return res;
  }

  // Severidade/probabilidade do documento (indices 1..n) levadas a escala da matriz do cliente.
  function aplicarMatriz(d, mz) {
    const C = Calc(); const esc = C.escalaDaMatriz(mz); const n = esc.length;
    d.Atividades.forEach((at) => at.fatores.forEach((fa) => {
      if (fa._crit) fa.severidade = esc[Math.max(0, Math.min(n - 1, fa._crit - 1))];
      if (fa._prob) fa.exposicao = String(Math.max(0, Math.min(n - 1, fa._prob - 1)));
      delete fa._crit; delete fa._prob; delete fa._textoOriginal;
    }));
  }

  // V 1.38: campos obrigatorios que o documento nao trouxe sobem com "ATUALIZAR INFORMAÇÕES" (a AET salva
  // mesmo assim e o ergonomista completa depois); fator sem graduacao possivel fica marcado como pendente.
  const PENDENTE = "ATUALIZAR INFORMAÇÕES";
  function marcarPendentes(d, mz) {
    let n = 0; const marca = (o, k) => { if (!String(o[k] || "").trim()) { o[k] = PENDENTE; n++; } };
    ["Unidade", "Setor", "Posto Trabalho", "Cargo"].forEach((k) => marca(d, k));
    if (!d.Atividades.length) d.Atividades.push({ uid: uid(), nome: PENDENTE, descricao: "", fotos: [], fatores: [], recomendacoes: "" });
    d.Atividades.forEach((at) => {
      marca(at, "nome");
      at.fatores.forEach((fa) => {
        if (!fa.fator || (fa.fator === "__outro" && !String(fa.outro || "").trim())) { fa.fator = "__outro"; fa.outro = PENDENTE; fa.grupo = fa.grupo || "Outros"; n++; }
        marca(fa, "consequencia"); marca(fa, "segmento");
        if (BI.AET && !BI.AET.avaliarFator(fa, mz).graduacao) { fa.semGraduacaoImportada = true; n++; }
      });
    });
    if (n) d["Atualizar Informacoes"] = true;
    return n;
  }

  // ------------------------------------------------------------------ tela
  const estado = { arquivo: null, lido: null, res: null, msg: "", erro: false, processando: false };
  function podeImportar() { const i = BI.DB && BI.DB.estado.identidade; return !(i && i.papel === "UsuarioCliente") && !(BI.DB && BI.DB.estado.somenteLeitura); }
  function renderAba(el) {
    if (!el) return; el.innerHTML = "";
    const card = h("div", "cartao bloco-cadastro"); el.appendChild(card);
    const cab = h("div", "cadastro-cabecalho"); cab.appendChild(h("div", "cartao-titulo", "Importar AET (Word ou PDF)")); card.appendChild(cab);
    card.appendChild(h("p", "aet-ajuda", "Anexe uma AET feita fora do sistema (Word .docx ou PDF). O SIGE lê o arquivo e identifica a empresa, o setor, o posto, o cargo, a organização do trabalho, o ambiente, as atividades e os fatores de risco (com consequência, metodologia, severidade, probabilidade e grau). No Word também vêm as fotos do posto e das atividades. Você confere tudo antes: o que não existir no Cadastro Empresa é criado e cada AET abre no editor já preenchida para revisar e salvar."));
    if (!podeImportar()) { card.appendChild(h("div", "plano-vazio", "Somente a equipe ElevaLife importa AETs.")); return; }
    const lb = h("label", "aet-import-arquivo"); const inp = h("input"); inp.type = "file"; inp.accept = ".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    lb.appendChild(h("span", "btn-cad-primario", estado.processando ? "Lendo o arquivo…" : "⬆ Escolher arquivo (Word ou PDF)")); lb.appendChild(inp); card.appendChild(lb);
    if (estado.arquivo) card.appendChild(h("div", "aet-nota", "Arquivo: " + estado.arquivo.name));
    const msg = h("div", "aet-msg" + (estado.erro ? " erro" : ""), estado.msg); msg.hidden = !estado.msg; card.appendChild(msg);
    inp.addEventListener("change", async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      estado.arquivo = f; estado.res = null; estado.erro = false; estado.msg = ""; estado.processando = true; renderAba(el);
      try {
        const ehPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
        if (!ehPdf && !/\.docx$/i.test(f.name)) throw new Error("Use um arquivo Word (.docx) ou PDF. Arquivos .doc antigos: salve como .docx no Word.");
        estado.lido = ehPdf ? await lerPdf(f) : await lerDocx(f);
        estado.res = interpretar(estado.lido, f.name);
        estado.msg = estado.res.aets.length ? `${estado.res.aets.length} AET(s) encontrada(s). Confira abaixo.` : "Nenhuma AET identificada no arquivo."; estado.erro = !estado.res.aets.length;
      } catch (e) { console.error("importar AET", e); estado.msg = "Não foi possível ler o arquivo: " + (e && e.message ? e.message : e); estado.erro = true; }
      estado.processando = false; renderAba(el);
    });
    if (estado.res && estado.res.aets.length) renderConferencia(el, estado.res);
  }

  function renderConferencia(el, res) {
    const C = Calc(); const card = h("div", "cartao bloco-cadastro aet-import-conf"); el.appendChild(card);
    const cab = h("div", "cadastro-cabecalho"); cab.appendChild(h("div", "cartao-titulo", "Conferência")); card.appendChild(cab);
    const clientes = (BI.dados.cliente || []).map((c) => c.Cliente).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const casaCli = clientes.find((c) => norm(c) === norm(res.cliente)) || clientes.find((c) => res.cliente && (norm(c).includes(norm(res.cliente).slice(0, 18)) || norm(res.cliente).includes(norm(c))));
    if (res._cliente == null) res._cliente = casaCli || (BI.filtros && BI.filtros.Cliente && BI.filtros.Cliente.length === 1 ? BI.filtros.Cliente[0] : "") || "";
    const gr = h("div", "aet-grade"); card.appendChild(gr);
    const lCli = h("label", "aet-campo aet-campo--largo"); lCli.appendChild(h("span", "aet-rot", "Empresa *" + (res.cliente ? ` (no arquivo: ${res.cliente}${res.cnpj ? " · CNPJ " + res.cnpj : ""})` : "")));
    const sCli = h("select"); [["", "Escolha…"]].concat(clientes.map((c) => [c, c])).concat(res.cliente && !casaCli ? [["__nova", `Cadastrar nova empresa: ${res.cliente}`]] : []).forEach(([v, t]) => { const o = h("option", null, t); o.value = v; sCli.appendChild(o); });
    sCli.value = res._cliente; sCli.addEventListener("change", () => { res._cliente = sCli.value; el.innerHTML = ""; renderAba(el); }); lCli.appendChild(sCli); gr.appendChild(lCli);
    const nomeCli = res._cliente === "__nova" ? res.cliente : res._cliente;
    const mz = nomeCli && res._cliente !== "__nova" ? C.matrizDoCliente(BI.dados.cliente || [], nomeCli) : (C.MATRIZ_PADRAO || "Matriz 5x5");
    if (res.avisos.length) { const av = h("div", "aet-msg"); av.textContent = "Atenção: " + Array.from(new Set(res.avisos)).slice(0, 6).join(" "); card.appendChild(av); }
    const lista = (nivel, filtro) => Array.from(new Set((BI.dados.cargo || []).filter((c) => c.Cliente === nomeCli && Object.keys(filtro).every((k) => !filtro[k] || c[k] === filtro[k])).map((c) => c[nivel]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    res.aets.forEach((a, ix) => {
      const box = h("div", "aet-import-item"); card.appendChild(box);
      const nAt = a.d.Atividades.length; const nFa = a.d.Atividades.reduce((s, x) => s + x.fatores.length, 0); const nFo = a.fotosGeral.length + a.d.Atividades.reduce((s, x) => s + x._fotos.length, 0);
      box.appendChild(h("div", "aet-subtitulo", `AET ${ix + 1}: ${[a.setor, a.posto, a.cargo].filter(Boolean).join(" › ") || "posto não identificado"}`));
      box.appendChild(h("div", "aet-nota", `${nAt} atividade(s) · ${nFa} fator(es) de risco · ${nFo} foto(s)${a.d["Diagnostico Global"] ? " · diagnóstico" : ""}${a._aberta ? " · aberta no editor" : ""}`));
      const g2 = h("div", "aet-grade"); box.appendChild(g2);
      const unidades = lista("Unidade", {}); if (!a.unidade && unidades.length === 1) a.unidade = unidades[0];
      const campo = (rot, chave, sugestoes) => { const l = h("label", "aet-campo"); l.appendChild(h("span", "aet-rot", rot)); const i = h("input"); i.type = "text"; i.value = a[chave] || ""; const dl = h("datalist"); dl.id = "dl-imp-" + ix + "-" + chave.replace(/\W/g, ""); sugestoes.forEach((s) => { const o = h("option"); o.value = s; dl.appendChild(o); }); i.setAttribute("list", dl.id); i.addEventListener("input", () => { a[chave] = i.value.trim(); }); l.appendChild(i); l.appendChild(dl); if (sugestoes.length && a[chave] && !sugestoes.includes(a[chave])) l.appendChild(h("span", "aet-import-novo", "novo – será cadastrado")); g2.appendChild(l); };
      campo("Unidade *", "unidade", unidades);
      campo("Setor / GHE *", "setor", lista("Setor", { Unidade: a.unidade }));
      campo("Posto de trabalho *", "posto", lista("Posto Trabalho", { Unidade: a.unidade, Setor: a.setor }));
      campo("Cargo / função *", "cargo", lista("Cargo", { Unidade: a.unidade, Setor: a.setor, "Posto Trabalho": a.posto }));
      const det = h("details", "aet-import-det"); det.appendChild(h("summary", null, "Ver o que foi lido"));
      const ul = h("ul"); a.d.Atividades.forEach((at) => { const li = h("li"); li.appendChild(h("strong", null, at.nome)); li.appendChild(document.createTextNode(` – ${at.fatores.length} fator(es)${at._fotos.length ? ", " + at._fotos.length + " foto(s)" : ""}`)); const ul2 = h("ul"); at.fatores.forEach((fa) => ul2.appendChild(h("li", null, `${fa.fator === "__outro" ? fa.outro + " (outro)" : fa.fator}${fa.consequencia ? " · " + fa.consequencia : ""}${fa.ferramentas.length ? " · " + fa.ferramentas.map((x) => (BI.Ferramentas.porId(x.id) || {}).sigla).join(", ") : ""}${fa.grauImportado ? " · grau " + fa.grauImportado : ""}`))); li.appendChild(ul2); ul.appendChild(li); });
      det.appendChild(ul); box.appendChild(det);
      const msg = h("div", "aet-msg"); msg.hidden = true; box.appendChild(msg);
      const b = h("button", "btn-cad-primario", a._aberta ? "Abrir de novo no editor" : "Cadastrar o que faltar e abrir no editor"); b.type = "button"; box.appendChild(b);
      b.addEventListener("click", async () => {
        // V 1.38: so a empresa e indispensavel; o que faltar no documento sobe como "ATUALIZAR INFORMAÇÕES"
        if (!nomeCli) { msg.hidden = false; msg.className = "aet-msg erro"; msg.textContent = "Escolha a empresa."; return; }
        const AT = PENDENTE; ["unidade", "setor", "posto", "cargo"].forEach((k) => { if (!a[k]) a[k] = AT; });
        b.disabled = true; msg.hidden = false; msg.className = "aet-msg"; msg.textContent = "Cadastrando e enviando as fotos…";
        try {
          const valores = { Cliente: nomeCli, Unidade: a.unidade, Setor: a.setor, "Posto Trabalho": a.posto, Cargo: a.cargo };
          const criados = await BI.garantirHierarquia(valores, res.cnpj ? { CNPJ: res.cnpj } : {});
          const emp = (BI.dados.cliente || []).find((c) => c.Cliente === nomeCli); const empresaId = emp ? (emp.id || emp._id) : null;
          const mzCli = C.matrizDoCliente(BI.dados.cliente || [], nomeCli);
          const enviar = async (ids) => { const out = []; for (const id of ids) { /* V 1.38: sem limite de fotos */ const im = (estado.lido.imagens || [])[id]; if (!im || !empresaId) continue; try { const r = await BI.DB.enviarArquivo("aet", empresaId, new File([im.bytes], im.nome, { type: im.tipo })); out.push({ chave: r.chave, nomeArquivo: r.nomeArquivo || im.nome }); } catch (e) { console.warn("foto", e); } } return out; };
          const d = JSON.parse(JSON.stringify(a.d));
          Object.assign(d, valores);
          d["Foto Geral"] = a._fotosGeralEnviadas || (a._fotosGeralEnviadas = await enviar(a.fotosGeral));
          for (let k = 0; k < d.Atividades.length; k++) { const orig = a.d.Atividades[k]; orig._enviadas = orig._enviadas || await enviar(orig._fotos); d.Atividades[k].fotos = orig._enviadas; delete d.Atividades[k]._fotos; delete d.Atividades[k]._enviadas; }
          aplicarMatriz(d, mzCli);
          marcarPendentes(d, mzCli);
          a._aberta = true;
          msg.textContent = (criados.length ? "Cadastrado: " + criados.join(", ") + ". " : "") + "AET aberta no editor – confira e clique em Salvar AET.";
          b.disabled = false; b.textContent = "Abrir de novo no editor";
          BI.AET.abrirEditor(null, d);
        } catch (e) { console.error(e); msg.className = "aet-msg erro"; msg.textContent = (e && e.message ? e.message : String(e)); b.disabled = false; }
      });
    });
  }

  BI.AETImport = { renderAba, lerDocx, lerPdf, interpretar };
})(window);
