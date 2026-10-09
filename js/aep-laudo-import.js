/* S.I.G.E V 1.36 - Migracao do laudo da AEP do sistema anterior (PDF) - AEP › Importar Excel.

   Complementa a importacao da planilha do sistema anterior: le o laudo em PDF ("Analise Ergonomica
   Preliminar" do Sistema de Gestao Integrada) e, para cada posto (secao "4.N. Setor ..."), traz:
   - os dados da AEP: data, setor, posto, cargo, maquina/linha/celula, jornada, caracteristicas dos
     trabalhadores, pausas, rodizio, historico de acidentes, descricao da atividade e descricao do setor;
   - as fotos ("Imagens da interacao do colaborador com o posto de trabalho"), na resolucao original;
   - os fatores de risco (secoes "4.N.M. <grupo>"): fator, existe fator, circunstancia geradora,
     consequencia, medida de controle, criticidade, probabilidade, pontuacao, graduacao, propor acao,
     acao para eliminacao e controles administrativos.
   Na conferencia, cada posto e ligado a AEP que a planilha ja criou (Cliente + Unidade + Setor + Posto +
   Cargo); o que nao existir e criado. Campos ja preenchidos so sao trocados se o usuario pedir; fotos ja
   migradas (mesma imagem) nao se repetem; fatores ja existentes sao completados, nao duplicados.
   O PDF do laudo antigo fica no historico de laudos do cliente. */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const Calc = () => BI.Calc;
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const limpa = (s) => String(s || "").replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

  // ------------------------------------------------------------------ leitura do PDF: texto (linhas) e fotos
  function mul(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
  function objeto(objs, id) { return new Promise((ok) => { try { objs.get(id, (o) => ok(o)); } catch (e) { ok(null); } setTimeout(() => ok(null), 4000); }); }
  async function imagemComoJpeg(img) {
    if (!img) return null;
    const w = img.width || (img.bitmap && img.bitmap.width), hh = img.height || (img.bitmap && img.bitmap.height);
    if (!w || !hh) return null;
    const c = document.createElement("canvas"); c.width = w; c.height = hh; const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, hh);
    if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0);
    else if (img.data) {
      const id = ctx.createImageData(w, hh); const d = img.data; const n = w * hh;
      if (d.length >= n * 4) id.data.set(d.subarray ? d.subarray(0, n * 4) : d.slice(0, n * 4));
      else if (d.length >= n * 3) { for (let i = 0, j = 0; i < n; i++, j += 3) { id.data[i * 4] = d[j]; id.data[i * 4 + 1] = d[j + 1]; id.data[i * 4 + 2] = d[j + 2]; id.data[i * 4 + 3] = 255; } }
      else return null;
      ctx.putImageData(id, 0, 0);
    } else return null;
    return c.toDataURL("image/jpeg", 0.88);
  }
  async function lerPdf(arquivo, aoProgresso) {
    if (!g.pdfjsLib) throw new Error("O leitor de PDF não carregou. Atualize a página (Ctrl+F5).");
    const pdf = await g.pdfjsLib.getDocument({ data: await arquivo.arrayBuffer(), isEvalSupported: false }).promise;
    const OPS = g.pdfjsLib.OPS; const linhas = []; const imagens = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      if (aoProgresso) aoProgresso(p, pdf.numPages);
      const pg = await pdf.getPage(p); const base = p * 10000;
      // texto, agrupado em linhas e celulas (pela posicao)
      const tc = await pg.getTextContent();
      const itens = tc.items.filter((it) => it.str && it.str.trim()).map((it) => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, s: it.str }));
      const porY = [];
      itens.sort((a, b) => b.y - a.y || a.x - b.x).forEach((it) => { const l = porY.find((r) => Math.abs(r.y - it.y) <= 2.5); if (l) l.itens.push(it); else porY.push({ y: it.y, itens: [it] }); });
      porY.forEach((r) => {
        r.itens.sort((a, b) => a.x - b.x); const cells = []; const xs = []; let atual = null; let fim = -1e9;
        r.itens.forEach((it) => { if (atual === null || it.x - fim > 14) { if (atual !== null) cells.push(atual.trim()); atual = it.s; xs.push(it.x); } else atual += (it.x - fim > 1.5 ? " " : "") + it.s; fim = it.x + it.w; });
        if (atual !== null) cells.push(atual.trim());
        linhas.push({ y: base - r.y, p, cells, xs, texto: cells.join(" ").trim() });
      });
      // fotos: posicao pela matriz de transformacao; bytes originais pelo objeto da imagem
      const ops = await pg.getOperatorList(); let ctm = [1, 0, 0, 1, 0, 0]; const pilha = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i]; const a = ops.argsArray[i];
        if (fn === OPS.save) pilha.push(ctm.slice());
        else if (fn === OPS.restore) ctm = pilha.pop() || ctm;
        else if (fn === OPS.transform) ctm = mul(ctm, a);
        else if (fn === OPS.paintFormXObjectBegin) { pilha.push(ctm.slice()); if (a && a[0]) ctm = mul(ctm, a[0]); }
        else if (fn === OPS.paintFormXObjectEnd) ctm = pilha.pop() || ctm;
        else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
          const xsI = [ctm[4], ctm[4] + ctm[0], ctm[4] + ctm[2], ctm[4] + ctm[0] + ctm[2]]; const ysI = [ctm[5], ctm[5] + ctm[1], ctm[5] + ctm[3], ctm[5] + ctm[1] + ctm[3]];
          const larg = Math.max(...xsI) - Math.min(...xsI), alt = Math.max(...ysI) - Math.min(...ysI);
          if (larg < 40 || alt < 40) continue; // icones e logotipos pequenos
          imagens.push({ p, id: a[0], y: base - Math.max(...ysI), x: Math.min(...xsI), larg, alt, pagina: pg });
        }
      }
    }
    return { linhas, imagens, paginas: pdf.numPages };
  }

  // ------------------------------------------------------------------ interpretacao
  const ROTULOS = [
    ["Data Avaliacao", /^data da avaliacao\s*:?/],
    ["Setor", /^setor\s*:/], ["Cargo", /^cargo\s*:/], ["Posto Trabalho", /^posto de trabalho\s*:/],
    ["Maquina", /^maquina\s*\/\s*linha\s*\/\s*celula/],
    ["Jornada de Trabalho", /^jornada de trabalho\s*:?/],
    ["Caracteristicas Trabalhadores", /^caracteristicas dos trabalhadores/],
    ["Pausas", /^tempo de recuperacao fisiologica|^pausas\s*:?$/],
    ["Rodizio", /^rodizio/],
    ["Historico Acidentes", /^ha historico de acidentes/],
    ["Descricao Atividade Observada", /^descricao da atividade/],
    ["__imagens", /^imagens da interacao/],
    ["Descricao Setor", /^descricao do setor/],
  ];
  const ROT_FATOR = [
    ["Existe Fator Risco", /^existe fator de risco\??$/], ["Circunstancia Geradora", /^circunstancia geradora$/], ["Consequencia", /^consequencia$/],
    ["Medida Controle Existente", /^medidas? de controle existentes?$/], ["Propor Acao", /^propor acao\??$/], ["Acao Eliminacao", /^acao para eliminacao$/],
    ["Controles Administrativos", /^controles administrativos e organizacionais$/],
  ];
  const CABECALHO_REPETIDO = /^avaliacao ergonomica preliminar - aep/;

  function interpretar(lido) {
    const res = { cliente: "", unidade: "", postos: [], avisos: [] };
    const L = lido.linhas.filter((l) => l.texto);
    // capa: titulo, empresa, unidade, mes
    const capa = L.filter((l) => l.p === 1).map((l) => l.texto).filter((t) => !/an[aá]lise ergon[oô]mica|^sum[aá]rio/i.test(t) && !/^(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i.test(t));
    res.cliente = capa[0] || ""; res.unidade = capa[1] || "";
    let dentro = false; let posto = null; let campo = null; let fator = null; let campoF = null; let cabRisco = null; let esperandoNomeFator = false;
    const acrescenta = (obj, k, t) => { obj[k] = obj[k] ? obj[k] + "\n" + t : t; };
    for (let i = 0; i < L.length; i++) {
      const l = L[i]; const t = l.texto; const n = norm(t);
      const ehTitulo = l.cells.length === 1 && !/\s\d{1,3}$/.test(t); // no sumario a linha termina no numero da pagina
      if (!dentro) { if (ehTitulo && /^4\.?\s*avaliacoes ergonomicas preliminares/.test(n)) dentro = true; continue; }
      if (ehTitulo && /^5\.?\s*conclus/.test(n)) break;
      if (CABECALHO_REPETIDO.test(n)) continue;
      if (/^\d{1,3}$/.test(t) && l.xs[0] > 480) continue; // numero da pagina
      const mf = t.match(/^4\.(\d+)\.(\d+)\.\s+(.+)$/);
      const ms = !mf && t.match(/^4\.(\d+)\.\s+(.+)$/);
      if (ms) { posto = { secao: ms[1], titulo: limpa(ms[2]), dados: {}, fatores: [], imgDe: null, y0: l.y }; res.postos.push(posto); campo = null; fator = null; continue; }
      if (!posto) continue;
      if (mf) { fator = { grupoLaudo: limpa(mf[3]).replace(/^a\s+/i, ""), Fator: "" }; posto.fatores.push(fator); campo = null; campoF = null; cabRisco = null; esperandoNomeFator = true; if (!posto.yFim) posto.yFim = l.y; continue; }
      if (fator) {
        if (esperandoNomeFator) { fator.Fator = t; esperandoNomeFator = false; continue; }
        if (/^criticidade\b/.test(n) && /probabilidade/.test(n)) { cabRisco = { y: l.y, xs: l.xs, cells: l.cells }; campoF = "__risco"; continue; }
        if (campoF === "__risco" && cabRisco) {
          // valores da linha de risco: cada celula vai para a coluna do cabecalho mais proxima
          l.cells.forEach((c, ci) => { let q = 0; cabRisco.xs.forEach((x0, k) => { if (l.xs[ci] >= x0 - 20) q = k; }); const rot = norm(cabRisco.cells[q] || ""); const chave = /criticidade/.test(rot) ? "_crit" : /probabilidade/.test(rot) ? "_prob" : /pontuacao/.test(rot) ? "Pontuacao Risco" : "Graduacao Risco"; fator[chave] = c; });
          campoF = null; continue;
        }
        const rf = ROT_FATOR.find(([, rx]) => rx.test(n)); if (rf) { campoF = rf[0]; continue; }
        if (campoF) { acrescenta(fator, campoF, t); continue; }
        continue;
      }
      const r = ROTULOS.find(([, rx]) => rx.test(n));
      if (r) {
        campo = r[0];
        if (campo === "__imagens") { posto.imgDe = l.y; campo = null; continue; }
        const resto = limpa(t.replace(/^[^:]*:\s*/, "")); // valor na mesma linha ("Setor: Moldagem")
        if (/:/.test(t) && resto && resto !== t) { posto.dados[campo] = resto; if (["Data Avaliacao", "Setor", "Cargo", "Posto Trabalho"].includes(campo)) campo = null; }
        continue;
      }
      if (campo) acrescenta(posto.dados, campo, t);
    }
    // fotos de cada posto: entre "Imagens da interacao" e o primeiro fator (ou o proximo posto)
    res.postos.forEach((p, k) => {
      const prox = res.postos[k + 1]; const fim = Math.min(p.yFim || 1e12, prox ? prox.y0 : 1e12);
      p.imagens = p.imgDe == null ? [] : lido.imagens.filter((im) => im.y >= p.imgDe - 2 && im.y < fim).sort((a, b) => a.y - b.y || a.x - b.x);
      // normalizacoes
      const d = p.dados;
      if (d["Data Avaliacao"]) { const m = d["Data Avaliacao"].match(/(\d{2})\/(\d{2})\/(\d{4})/); d["Data Avaliacao"] = m ? `${m[3]}-${m[2]}-${m[1]}` : ""; }
      Object.keys(d).forEach((k) => { d[k] = limpa(d[k]); });
      if (d.Maquina) { d["Descricao Atividade Observada"] = d["Descricao Atividade Observada"] || ""; }
      p.fatores.forEach((f) => { Object.keys(f).forEach((k) => { if (typeof f[k] === "string") f[k] = limpa(f[k]); }); });
      if (!d.Setor || !d.Cargo || !d["Posto Trabalho"]) res.avisos.push(`Seção ${p.secao} (${p.titulo}): setor, cargo ou posto não identificados.`);
    });
    return res;
  }

  // ------------------------------------------------------------------ correspondencias com o SIGE
  function grupoSige(txt) {
    const C = Calc(); const t = norm(txt);
    return (C.GRUPOS_FATOR_RISCO || []).find((g0) => norm(g0) === t) || (C.GRUPOS_FATOR_RISCO || []).find((g0) => norm(g0).includes(t) || t.includes(norm(g0))) || "";
  }
  function fatorSige(grupo, txt) {
    const C = Calc(); const t = norm(txt); const lista = grupo ? C.fatoresDoGrupo(grupo) : [].concat(...(C.GRUPOS_FATOR_RISCO || []).map((g0) => C.fatoresDoGrupo(g0)));
    const exato = lista.find((f) => norm(f) === t); if (exato) return exato;
    if (/^temperatura|calor|frio/.test(t)) { const q = lista.find((f) => /quente ou frio/.test(norm(f))); if (q) return q; } // mesmo sinonimo da planilha
    const tok = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2)); const ta = tok(txt);
    let melhor = "", nota = 0; lista.forEach((f) => { const tb = tok(f); let c = 0; ta.forEach((w) => { if (tb.has(w)) c++; }); const s = c / Math.max(ta.size, tb.size, 1); if (s > nota) { nota = s; melhor = f; } });
    return nota >= 0.6 ? melhor : txt; // sem correspondencia: mantem o texto do laudo (como a planilha faz)
  }
  const SIN_ESCALA = { leve: "Baixa", baixo: "Baixa", baixa: "Baixa", "muito baixo": "Muito Baixa", "muito baixa": "Muito Baixa", medio: "Media", media: "Media", moderado: "Media", moderada: "Media", alto: "Alta", alta: "Alta", "muito alto": "Muito Alta", "muito alta": "Muito Alta" };
  function escalaSige(mz, txt) {
    const esc = Calc().escalaDaMatriz(mz); const v = SIN_ESCALA[norm(txt)] || ""; if (!v) return "";
    if (esc.includes(v)) return v;
    const ordem = ["Muito Baixa", "Baixa", "Media", "Alta", "Muito Alta"]; const i = ordem.indexOf(v);
    let melhor = esc[0]; let d0 = 99; esc.forEach((e) => { const d = Math.abs(ordem.indexOf(e) - i); if (d < d0) { d0 = d; melhor = e; } }); return melhor;
  }
  function segmentoDe(txt) {
    const segs = BI.Acoes && BI.Acoes.segmentosDisponiveis ? BI.Acoes.segmentosDisponiveis() : []; const t = norm(txt);
    const acha = (nome) => segs.find((s) => norm(s) === norm(nome)) || "";
    const regras = [[/mmii|membros inferiores|perna/, "Membros Inferiores"], [/mmss|membros superiores|braco/, "Membros Superiores"], [/lombar|coluna/, "Lombar"], [/cervical|pescoco/, "Cervical"], [/ombro/, "Ombro"], [/punho/, "Punho"], [/\bmaos?\b|dedo/, "Mao"], [/joelho/, "Joelho"], [/visual|olho|vista/, "Corpo Todo"], [/fadiga|cansaco/, "Corpo Todo"]];
    for (const [rx, s] of regras) if (rx.test(t) && acha(s)) return acha(s);
    return acha("Não identificado") || "";
  }
  const chavePosto = (o) => [o.Cliente, o.Unidade, o.Setor, o["Posto Trabalho"], o.Cargo].map(norm).join("|");
  const igualAo = (lista, campo, v) => (lista || []).find((x) => norm(x) === norm(v)) || v;
  async function sha1(texto) { try { const b = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(texto)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""); } catch (e) { return String(texto.length) + texto.slice(-60); } }

  // ------------------------------------------------------------------ tela (cartao dentro de AEP › Importar Excel)
  const est = { arquivo: null, lido: null, res: null, msg: "", erro: false, ocupado: false, escolhas: {}, sobrescrever: false, criarFatores: true, converterAcoes: true, guardarLaudo: true, cliente: "", unidade: "", log: [] };
  function montar(el) {
    if (!el) return; el.innerHTML = "";
    el.appendChild(h("div", "importar-opcao-titulo", "📄 Laudo da AEP do sistema anterior (PDF)"));
    el.appendChild(h("p", null, "Depois de importar a planilha do sistema anterior, envie o laudo correspondente em PDF. O SIGE liga cada posto do laudo à AEP da planilha e traz as fotos, a jornada, as pausas, as descrições e os fatores de risco que faltarem. Você confere tudo antes de gravar."));
    const lb = h("label", "aet-import-arquivo"); const inp = h("input"); inp.type = "file"; inp.accept = ".pdf,application/pdf";
    lb.appendChild(h("span", "btn-cad-primario", est.ocupado && !est.res ? "Lendo o laudo…" : "⬆ Escolher laudo (PDF)")); lb.appendChild(inp); el.appendChild(lb);
    if (est.arquivo) el.appendChild(h("div", "aet-nota", "Arquivo: " + est.arquivo.name));
    const msg = h("div", "aet-msg" + (est.erro ? " erro" : ""), est.msg); msg.hidden = !est.msg; el.appendChild(msg);
    inp.addEventListener("change", async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      Object.assign(est, { arquivo: f, res: null, lido: null, erro: false, msg: "Lendo o laudo…", ocupado: true, log: [] }); montar(el);
      try {
        est.lido = await lerPdf(f, (p, n) => { const m = el.querySelector(".aet-msg"); if (m) { m.hidden = false; m.textContent = `Lendo o laudo… página ${p} de ${n}`; } });
        est.res = interpretar(est.lido);
        const nFot = est.res.postos.reduce((s, p) => s + p.imagens.length, 0); const nFat = est.res.postos.reduce((s, p) => s + p.fatores.length, 0);
        est.msg = est.res.postos.length ? `${est.res.postos.length} posto(s), ${nFat} fator(es) de risco e ${nFot} foto(s) encontrados. Confira abaixo.` : "Nenhuma avaliação encontrada no laudo (seção “4. Avaliações ergonômicas preliminares”).";
        est.erro = !est.res.postos.length;
        const clientes = (BI.dados.cliente || []).map((c) => c.Cliente);
        est.cliente = clientes.find((c) => norm(c) === norm(est.res.cliente)) || clientes.find((c) => est.res.cliente && (norm(c).includes(norm(est.res.cliente)) || norm(est.res.cliente).includes(norm(c)))) || ((BI.filtros && BI.filtros.Cliente && BI.filtros.Cliente.length === 1) ? BI.filtros.Cliente[0] : "");
        est.unidade = ""; est.escolhas = {};
      } catch (e) { console.error("laudo antigo", e); est.msg = "Não foi possível ler o laudo: " + (e && e.message ? e.message : e); est.erro = true; }
      est.ocupado = false; montar(el);
    });
    if (est.res && est.res.postos.length) conferencia(el);
  }

  function aepsDoCliente(cli) { return (BI.dados.avaliacaoErgonomica || []).filter((a) => a.Cliente === cli); }
  function planejar() {
    const res = est.res; const cli = est.cliente; const un = est.unidade;
    const aeps = aepsDoCliente(cli); const cargos = (BI.dados.cargo || []).filter((c) => c.Cliente === cli && (!un || c.Unidade === un));
    const nomes = (k) => Array.from(new Set(cargos.map((c) => c[k]).filter(Boolean)));
    return res.postos.map((p) => {
      const v = { Cliente: cli, Unidade: un, Setor: igualAo(nomes("Setor"), "Setor", p.dados.Setor || ""), "Posto Trabalho": igualAo(nomes("Posto Trabalho"), "Posto Trabalho", p.dados["Posto Trabalho"] || ""), Cargo: igualAo(nomes("Cargo"), "Cargo", p.dados.Cargo || "") };
      let aep = aeps.find((a) => chavePosto(a) === chavePosto(v));
      // sem correspondencia exata: sugere a AEP mais parecida (posto + cargo); o usuario confirma ou troca na conferencia
      const tok = (t) => new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 1));
      const simil = (a) => { const ta = tok([v.Setor, v["Posto Trabalho"], v.Cargo].join(" ")); const tb = tok([a.Setor, a["Posto Trabalho"], a.Cargo].join(" ")); let c = 0; ta.forEach((w) => { if (tb.has(w)) c++; }); return c / Math.max(ta.size, tb.size, 1); };
      const escolhida = est.escolhas[p.secao];
      if (escolhida === "__nova") aep = null;
      else if (escolhida) aep = aeps.find((a) => a._id === escolhida) || aep;
      else if (!aep) { const melhor = aeps.filter((a) => !un || a.Unidade === un).map((a) => [a, simil(a)]).sort((x1, x2) => x2[1] - x1[1])[0]; if (melhor && melhor[1] >= 0.75) aep = melhor[0]; }
      if (aep) Object.assign(v, { Unidade: aep.Unidade, Setor: aep.Setor, "Posto Trabalho": aep["Posto Trabalho"], Cargo: aep.Cargo });
      const fatsExist = (BI.dados.fatorRisco || []).filter((f) => chavePosto(f) === chavePosto(v));
      const fatores = p.fatores.map((f) => { const grupo = grupoSige(f.grupoLaudo); const nome = fatorSige(grupo, f.Fator); const ex = fatsExist.find((x) => norm(x.Fator) === norm(nome) && (!x["Circunstancia Geradora"] || !f["Circunstancia Geradora"] || norm(x["Circunstancia Geradora"]) === norm(f["Circunstancia Geradora"]))) || fatsExist.find((x) => norm(x.Fator) === norm(nome)); return { f, grupo, nome, ex }; });
      return { p, v, aep, fatores };
    });
  }

  function conferencia(el) {
    const C = Calc(); const res = est.res; const card = h("div", "aet-import-conf"); el.appendChild(card);
    card.appendChild(h("div", "aet-subtitulo", "Conferência"));
    const gr = h("div", "aet-grade"); card.appendChild(gr);
    const clientes = (BI.dados.cliente || []).map((c) => c.Cliente).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const lc = h("label", "aet-campo aet-campo--largo"); lc.appendChild(h("span", "aet-rot", `Empresa *${res.cliente ? " (no laudo: " + res.cliente + ")" : ""}`));
    const sc = h("select"); [["", "Escolha…"]].concat(clientes.map((c) => [c, c])).forEach(([v, t]) => { const o = h("option", null, t); o.value = v; sc.appendChild(o); }); sc.value = est.cliente; sc.addEventListener("change", () => { est.cliente = sc.value; est.unidade = ""; montar(el); }); lc.appendChild(sc); gr.appendChild(lc);
    const unidades = Array.from(new Set((BI.dados.unidade || []).filter((u) => u.Cliente === est.cliente).map((u) => u.Unidade).concat((BI.dados.cargo || []).filter((c) => c.Cliente === est.cliente).map((c) => c.Unidade)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (!est.unidade) est.unidade = unidades.find((u) => res.unidade && (norm(u) === norm(res.unidade) || norm(u).includes(norm(res.unidade)) || norm(res.unidade).includes(norm(u)))) || (unidades.length === 1 ? unidades[0] : "") || res.unidade || "";
    const lu = h("label", "aet-campo"); lu.appendChild(h("span", "aet-rot", `Unidade *${res.unidade ? " (no laudo: " + res.unidade + ")" : ""}`)); const iu = h("input"); iu.type = "text"; iu.value = est.unidade; const dl = h("datalist"); dl.id = "dl-laudo-antigo-un"; unidades.forEach((u) => { const o = h("option"); o.value = u; dl.appendChild(o); }); iu.setAttribute("list", dl.id); iu.addEventListener("change", () => { est.unidade = iu.value.trim(); montar(el); }); lu.appendChild(iu); lu.appendChild(dl); gr.appendChild(lu);
    if (!est.cliente) { card.appendChild(h("div", "aet-nota", "Escolha a empresa para ligar os postos às AEPs.")); return; }
    const plano = planejar(); est.plano = plano;
    const op = h("div", "ferr-multi"); card.appendChild(op);
    [["sobrescrever", "Trocar também os campos da AEP já preenchidos (jornada, pausas, descrições…)"], ["criarFatores", "Criar os fatores de risco que ainda não existem no Inventário"], ["converterAcoes", "Levar as ações do laudo (eliminação e controles administrativos) para o Plano de Ação"], ["guardarLaudo", "Guardar o PDF do laudo antigo no histórico de laudos do cliente"]].forEach(([k, t]) => { const l = h("label"); const cb = h("input"); cb.type = "checkbox"; cb.checked = !!est[k]; cb.addEventListener("change", () => { est[k] = cb.checked; }); l.appendChild(cb); l.appendChild(document.createTextNode(" " + t)); op.appendChild(l); });
    if (res.avisos.length) { const av = h("div", "aet-msg"); av.textContent = "Atenção: " + res.avisos.slice(0, 5).join(" "); card.appendChild(av); }
    const wrap = h("div", "tabela-scroll"); const tb = h("table", "tabela-dados tabela-secao"); const tr0 = h("tr");
    ["Seção", "Setor › posto › cargo", "AEP no SIGE", "Campos", "Fotos", "Fatores (existentes / novos)"].forEach((c) => tr0.appendChild(h("th", null, c)));
    const th = h("thead"); th.appendChild(tr0); tb.appendChild(th); const tbody = h("tbody");
    plano.forEach((x) => {
      const tr = h("tr");
      const campos = ["Data Avaliacao", "Jornada de Trabalho", "Pausas", "Rodizio", "Caracteristicas Trabalhadores", "Historico Acidentes", "Descricao Atividade Observada", "Descricao Setor"].filter((k) => x.p.dados[k]).length;
      const nEx = x.fatores.filter((f) => f.ex).length;
      [x.p.secao, [x.p.dados.Setor, x.p.dados["Posto Trabalho"], x.p.dados.Cargo].join(" › ")].forEach((c) => tr.appendChild(h("td", null, c)));
      // AEP do SIGE ligada a este posto (sugerida; pode trocar ou mandar criar nova)
      const td = h("td"); const sel = h("select", "laudo-antigo-aep");
      const nr = (a) => (a["Nr Avaliacao"] ? "AEP-" + String(a["Nr Avaliacao"]).padStart(3, "0") + " · " : "");
      [["__nova", "Criar AEP nova"]].concat(aepsDoCliente(est.cliente).filter((a) => !est.unidade || a.Unidade === est.unidade).sort((a, b) => String(a["Posto Trabalho"]).localeCompare(String(b["Posto Trabalho"]), "pt-BR")).map((a) => [a._id, `${nr(a)}${a.Setor} › ${a["Posto Trabalho"]} › ${a.Cargo}`])).forEach(([v0, t0]) => { const o = h("option", null, t0); o.value = v0; sel.appendChild(o); });
      sel.value = x.aep ? x.aep._id : "__nova"; sel.addEventListener("change", () => { est.escolhas[x.p.secao] = sel.value; montar(el); });
      td.appendChild(sel); tr.appendChild(td);
      [String(campos), String(x.p.imagens.length), `${nEx} / ${x.fatores.length - nEx}`].forEach((c) => tr.appendChild(h("td", null, c)));
      if (!x.aep) tr.classList.add("laudo-antigo-nova");
      tbody.appendChild(tr);
    });
    tb.appendChild(tbody); wrap.appendChild(tb); card.appendChild(wrap);
    const novas = plano.filter((x) => !x.aep).length;
    card.appendChild(h("p", "aet-nota", `${plano.length - novas} posto(s) ligados a AEPs existentes${novas ? `; ${novas} AEP(s) nova(s) — confira se setor, posto e cargo batem com a planilha antes de migrar` : ""}.`));
    const barra = h("div", "reav-barra"); const b = h("button", "btn-cad-primario", est.ocupado ? "Migrando…" : "Migrar laudo para o SIGE"); b.type = "button"; b.disabled = est.ocupado || !est.unidade; barra.appendChild(b); card.appendChild(barra);
    const log = h("div", "laudo-antigo-log"); est.log.forEach((t) => log.appendChild(h("div", null, t))); card.appendChild(log);
    b.addEventListener("click", () => migrar(el));
  }

  async function migrar(el) {
    if (est.ocupado) return; est.ocupado = true; est.log = []; est.erro = false; est.msg = "Migrando…"; montar(el);
    const C = Calc(); const plano = est.plano; const mz = C.matrizDoCliente(BI.dados.cliente || [], est.cliente);
    const registrar = (t) => { est.log.push(t); const lg = el.querySelector(".laudo-antigo-log"); if (lg) lg.appendChild(h("div", null, t)); };
    const emp = (BI.dados.cliente || []).find((c) => c.Cliente === est.cliente); const empresaId = emp ? (emp.id || emp._id) : null;
    let nAep = 0, nFot = 0, nFat = 0, nFatComp = 0, nAc = 0;
    // acoes do laudo -> Plano de Acao (uma por texto; nao repete se o fator ja tem acao)
    const VAZIO = /^(-+|n[aã]o( h[aá])?\.?|nenhum[ao]?\.?|n\/a)$/i;
    async function levarAcoes(fatorId, f, v) {
      if (!est.converterAcoes || !fatorId) return 0;
      if ((BI.dados.planoAcao || []).some((a) => a["Fator Risco Id"] === fatorId)) return 0;
      const textos = [["Eliminacao", f["Acao Eliminacao"]], ["Organizacional", f["Controles Administrativos"]]].filter(([, t]) => t && !VAZIO.test(String(t).trim()));
      let n = 0;
      for (const [tipo, txt] of textos) {
        const nrs = (BI.dados.planoAcao || []).filter((a) => a.Cliente === v.Cliente).map((a) => Number(a["Nr Acao"]) || 0);
        await BI.DB.salvar("planoAcao", null, Object.assign({}, v, {
          Origem: "AEP", "Nr Acao": (nrs.length ? Math.max.apply(null, nrs) : 0) + 1, "Fator Risco Id": fatorId, "Fator Risco Nome": f.Fator, "Status Execucao": "Nao iniciada",
          "Tipo Acao": tipo, "Acao Recomendada": String(txt).trim(), "Categoria Acao": BI.Acoes && BI.Acoes.categoriaDoTipo ? BI.Acoes.categoriaDoTipo(tipo) : null, "Gestao Acao": "ElevaLife",
          "Segmento Corporal": f["Segmento Corporal"] || null, "Risco Atual Segmento": f["Graduacao Risco"] || null, "Reduz Risco": "Nao", "Risco Apos Acao": null, "Importado Laudo Anterior": true,
        }));
        n++;
      }
      return n;
    }
    try {
      for (const x of plano) {
        await BI.garantirHierarquia(x.v);
        let aep = x.aep ? (BI.dados.avaliacaoErgonomica || []).find((a) => a._id === x.aep._id) : (BI.dados.avaliacaoErgonomica || []).find((a) => chavePosto(a) === chavePosto(x.v));
        const dados = {}; if (aep) Object.keys(aep).forEach((k) => { if (k[0] !== "_" && k !== "id") dados[k] = aep[k]; });
        Object.assign(dados, x.v);
        ["Data Avaliacao", "Jornada de Trabalho", "Pausas", "Rodizio", "Caracteristicas Trabalhadores", "Historico Acidentes", "Descricao Atividade Observada", "Descricao Setor"].forEach((k) => { const v = x.p.dados[k]; if (v && (est.sobrescrever || !dados[k])) dados[k] = v; });
        if (x.p.dados.Maquina && (!dados["Descricao Atividade Observada"] || !dados["Descricao Atividade Observada"].includes(x.p.dados.Maquina))) dados["Descricao Atividade Observada"] = `Máquina/linha/célula: ${x.p.dados.Maquina}` + (dados["Descricao Atividade Observada"] ? "\n" + dados["Descricao Atividade Observada"] : "");
        // obrigatorios da AEP sem dado no laudo
        ["Jornada de Trabalho", "Pausas", "Rodizio"].forEach((k) => { if (!dados[k]) dados[k] = "Não informado no laudo do sistema anterior."; });
        if (!dados["Data Avaliacao"]) dados["Data Avaliacao"] = new Date().toISOString().slice(0, 10);
        // fotos (sem repetir as ja migradas)
        const jaHash = new Set(dados["Fotos Laudo Anterior"] || []); const fotos = Array.isArray(dados.Fotos) ? dados.Fotos.slice() : [];
        for (let k = 0; k < x.p.imagens.length; k++) {
          const im = x.p.imagens[k]; const obj = await objeto(String(im.id).startsWith("g_") ? im.pagina.commonObjs : im.pagina.objs, im.id); const dUrl = await imagemComoJpeg(obj); if (!dUrl) continue;
          const hs = await sha1(dUrl); if (jaHash.has(hs)) continue;
          const bin = Uint8Array.from(atob(dUrl.split(",")[1]), (c) => c.charCodeAt(0));
          const nome = `laudo-anterior-${x.p.secao}-${k + 1}.jpg`;
          try { const r = await BI.DB.enviarArquivo("avaliacaoErgonomica", empresaId, new File([bin], nome, { type: "image/jpeg" })); fotos.push({ chave: r.chave, nomeArquivo: r.nomeArquivo || nome, tamanho: r.tamanho || bin.length, tipoConteudo: "image/jpeg" }); jaHash.add(hs); nFot++; }
          catch (e) { registrar(`Seção ${x.p.secao}: foto ${k + 1} não enviada (${e && e.message ? e.message : e}).`); }
        }
        dados.Fotos = fotos; dados["Fotos Laudo Anterior"] = Array.from(jaHash);
        dados["Migrado Laudo Anterior"] = new Date().toISOString();
        await BI.DB.salvar("avaliacaoErgonomica", aep ? aep._id : null, dados, !aep);
        nAep++;
        aep = (BI.dados.avaliacaoErgonomica || []).find((a) => chavePosto(a) === chavePosto(x.v)) || aep;
        // fatores
        for (const ff of x.fatores) {
          const f = ff.f; const ex = (BI.dados.fatorRisco || []).find((r) => r._id === (ff.ex && ff.ex._id));
          const vals = { "Circunstancia Geradora": f["Circunstancia Geradora"], Consequencia: f.Consequencia, "Medida Controle Existente": f["Medida Controle Existente"], "Acao Eliminacao": f["Acao Eliminacao"], "Controles Administrativos": f["Controles Administrativos"], "Propor Acao": /^sim/i.test(f["Propor Acao"] || "") ? "Sim" : /^n/i.test(f["Propor Acao"] || "") ? "Nao" : "" };
          if (ex) {
            const d2 = {}; Object.keys(ex).forEach((k) => { if (k[0] !== "_" && k !== "id") d2[k] = ex[k]; });
            let mudou = false; Object.keys(vals).forEach((k) => { if (vals[k] && (est.sobrescrever || !d2[k])) { d2[k] = vals[k]; mudou = true; } });
            if (!d2["Segmento Corporal"]) { const s = segmentoDe(f.Consequencia); if (s) { d2["Segmento Corporal"] = s; mudou = true; } }
            if (mudou) { await BI.DB.salvar("fatorRisco", ex._id, d2); nFatComp++; }
            nAc += await levarAcoes(ex._id, Object.assign({}, ex, vals), x.v);
            continue;
          }
          if (!est.criarFatores) continue;
          const crit = escalaSige(mz, f._crit), prob = escalaSige(mz, f._prob);
          const grad = f["Graduacao Risco"] || (crit && prob ? C.nivelDaMatriz(mz, prob, crit) : "");
          const novo = Object.assign({}, x.v, vals, { Grupo: ff.grupo || ff.f.grupoLaudo, Fator: ff.nome, "Existe Fator Risco": /^n/i.test(f["Existe Fator Risco"] || "") ? "Nao" : "Sim", Criticidade: crit || null, Probabilidade: prob || null,
            "Pontuacao Risco": Number(f["Pontuacao Risco"]) || (crit && prob ? C.pontuacaoDaMatriz(mz, prob, crit) : null), "Graduacao Risco": grad, "Graduacao Inicial": grad, Matriz: mz, Status: "Em andamento", "Segmento Corporal": segmentoDe(f.Consequencia), "Dt Identificacao": dados["Data Avaliacao"], Origem: "AEP", "Importado Laudo Anterior": true });
          if (!novo["Propor Acao"]) delete novo["Propor Acao"];
          const idF = await BI.DB.salvar("fatorRisco", null, novo); nFat++;
          const idFator = typeof idF === "string" ? idF : ((BI.dados.fatorRisco || []).find((r) => r["Importado Laudo Anterior"] && chavePosto(r) === chavePosto(x.v) && r.Fator === novo.Fator && r["Circunstancia Geradora"] === novo["Circunstancia Geradora"]) || {})._id;
          if (idFator) nAc += await levarAcoes(idFator, novo, x.v);
        }
        registrar(`Seção ${x.p.secao} · ${x.v["Posto Trabalho"]} (${x.v.Cargo}): AEP ${x.aep ? "atualizada" : "criada"}, ${x.p.imagens.length} foto(s) lidas.`);
      }
      // laudo antigo no historico
      if (est.guardarLaudo && empresaId && est.arquivo) {
        try {
          const r = await BI.DB.enviarArquivo("laudo", empresaId, new File([est.arquivo], est.arquivo.name.replace(/[^\w .-]+/g, "_"), { type: "application/pdf" }));
          const jaTem = (BI.dados.laudo || []).some((l) => l.Cliente === est.cliente && l["Arquivo Original Laudo Anterior"] === est.arquivo.name && l["Tamanho Laudo Anterior"] === est.arquivo.size);
          if (!jaTem) await BI.DB.salvar("laudo", null, { EmpresaId: empresaId, Cliente: est.cliente, Unidade: est.unidade, Tipo: "Laudo", Origem: "AEP", Abrangencia: "Unidade", "Abrangencia Descricao": `Unidade: ${est.unidade} (laudo do sistema anterior)`, "Emitido Em": (plano.map((x) => x.p.dados["Data Avaliacao"]).filter(Boolean).sort().pop()) || new Date().toISOString().slice(0, 10), "Emitido Por": "Sistema anterior", Revisao: "", Texto: "Laudo da AEP do sistema anterior, migrado para o S.I.G.E.", "Arquivo Url": [{ chave: r.chave, nomeArquivo: r.nomeArquivo || est.arquivo.name, tamanho: r.tamanho || est.arquivo.size, tipoConteudo: "application/pdf" }], "Arquivo Original Laudo Anterior": est.arquivo.name, "Tamanho Laudo Anterior": est.arquivo.size });
          registrar("Laudo antigo guardado em AEP › Laudos.");
        } catch (e) { registrar("O PDF do laudo antigo não foi guardado: " + (e && e.message ? e.message : e)); }
      }
      est.msg = `Migração concluída: ${nAep} AEP(s), ${nFot} foto(s) nova(s), ${nFat} fator(es) criado(s), ${nFatComp} completado(s) e ${nAc} ação(ões) levada(s) ao Plano de Ação.`;
    } catch (e) { console.error("migrar laudo", e); est.msg = "A migração parou: " + (e && e.message ? e.message : e) + ". O que já foi gravado fica; rode de novo para continuar (nada é duplicado)."; est.erro = true; }
    est.ocupado = false; montar(el);
  }

  BI.AEPLaudoImport = { montar, lerPdf, interpretar };
})(window);
