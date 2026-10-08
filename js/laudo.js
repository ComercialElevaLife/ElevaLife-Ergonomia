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

  // V 1.30: paleta, cores de risco/status, capa, cabecalho/rodape e fechamento vem do PADRAO
  // de laudo ElevaLife (js/laudo-padrao.js), o mesmo do laudo de Riscos Psicossociais.
  const LP = BI.LaudoPadrao;
  const PAL = LP.PAL;
  const URL_VERIFICACAO = LP.URL_VERIFICACAO;
  const M = LP.M; // margem lateral
  const TOPO = LP.TOPO;
  const BASE = LP.BASE;

  // ---- helpers puros ------------------------------------------------------
  function semAcento(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  const corNivel = LP.corNivel;
  function dataBR(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "-");
  }
  function hojeISO() { return new Date().toISOString().slice(0, 10); }
  function substituir(texto, vars) {
    return String(texto || "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  }
  const novoCodigo = LP.novoCodigo;

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

    // V 1.28: abrangencia do laudo - empresa toda, unidade, setor, cargo ou posto de trabalho.
    // Cada avaliacao leva o numero (AEP-001) e a data da ultima atualizacao (a que sai no laudo).
    const ultimaAtualizacao = (a) => [a._editadoEm, a._criadoEm].filter(Boolean).map((d) => String(d).slice(0, 10)).sort().pop() || a["Data Avaliacao"] || "";
    const avaliacoes = (dados.avaliacaoErgonomica || []).filter((a) => {
      if (a.Cliente !== opcoes.nomeCliente) return false;
      if (opcoes.unidade && a.Unidade !== opcoes.unidade) return false;
      if (opcoes.setor && a.Setor !== opcoes.setor) return false;
      if (opcoes.cargo && a.Cargo !== opcoes.cargo) return false;
      if (opcoes.postoTrabalho && a["Posto Trabalho"] !== opcoes.postoTrabalho) return false;
      return true;
    }).map((a) => Object.assign({}, a, {
      _nrTexto: Number(a["Nr Avaliacao"]) ? "AEP-" + String(Number(a["Nr Avaliacao"])).padStart(3, "0") : "",
      _atualizadaEm: ultimaAtualizacao(a),
    })).sort((a, b) => (a.Unidade || "").localeCompare(b.Unidade || "", "pt-BR") || (a.Setor || "").localeCompare(b.Setor || "", "pt-BR") || (a.Cargo || "").localeCompare(b.Cargo || "", "pt-BR") || (a["Posto Trabalho"] || "").localeCompare(b["Posto Trabalho"] || "", "pt-BR"));
    if (!avaliacoes.length) {
      throw new Error("Nenhuma Avaliação Ergonômica (AEP) cadastrada para a abrangência escolhida - cadastre a avaliação antes de emitir o laudo.");
    }

    // V 1.28: a AEP e por posto e cargo (sem atividade)
    // V 1.31: o laudo traz sempre o risco mais atual - riscos eliminados saem do inventario vigente e
    // aparecem em "Riscos eliminados" do posto e na evolucao dos riscos (secao 10).
    const doPosto = (av) => (dados.fatorRisco || []).filter((f) =>
      f.Cliente === av.Cliente && f.Unidade === av.Unidade && f.Setor === av.Setor && f.Cargo === av.Cargo &&
      f["Posto Trabalho"] === av["Posto Trabalho"] && f["Existe Fator Risco"] === "Sim");
    const fatoresDoPosto = (av) => doPosto(av).filter((f) => f["Risco Eliminado"] !== "Sim");
    const eliminadosDoPosto = (av) => doPosto(av).filter((f) => f["Risco Eliminado"] === "Sim");
    const grau = (fr) => fr["Graduacao Risco"] || Calc.nivelDaMatriz(nomeMatriz, fr.Probabilidade, fr.Criticidade) || "";
    const pontos = (fr) => (fr["Pontuacao Risco"] != null ? fr["Pontuacao Risco"] : Calc.pontuacaoDaMatriz(nomeMatriz, fr.Probabilidade, fr.Criticidade));
    const rotCanon = (n) => (n ? Calc.rotuloNivel(n) : "-");
    // V 1.29: o risco do posto e a maior graduacao entre os seus fatores.
    const riscoDoPosto = (av) => fatoresDoPosto(av).map(grau).filter(Boolean)
      .sort((a, b) => Calc.NIVEIS_RISCO.indexOf(Calc.nivelCanonico(b)) - Calc.NIVEIS_RISCO.indexOf(Calc.nivelCanonico(a)))[0] || "";
    // V 1.30: pontuacoes (probabilidade x gravidade) de cada graduacao, como lista - a graduacao vem
    // da celula da matriz modelo, e a mesma pontuacao pode aparecer em duas graduacoes vizinhas.
    const pontuacoesDoNivel = (n) => { const ps = []; escala.forEach((p) => escala.forEach((g) => { if (Calc.nivelDaMatriz(nomeMatriz, p, g) === n) { const v = Calc.pontuacaoDaMatriz(nomeMatriz, p, g); if (!ps.includes(v)) ps.push(v); } })); return ps.sort((a, b) => a - b).join(", "); };
    const NOTA_MATRIZ = "A graduação de cada fator é a da célula da matriz (cruzamento da probabilidade com a severidade), conforme a matriz de risco cadastrada para o cliente. A pontuação (probabilidade × severidade) é informativa: a mesma pontuação pode aparecer em graduações vizinhas, conforme a posição na matriz.";
    // V 1.30: numeros do plano por status, nas cores padrao (nao iniciada, em andamento, atrasada, concluida).
    const contagemStatus = (lista, ref) => {
      const c = { n: 0, e: 0, a: 0, c: 0 };
      lista.forEach(({ a }) => { const s = Calc.statusDaLinhaAcao ? Calc.statusDaLinhaAcao(a, ref) : ""; if (Acoes.estaConcluida(a) || /^Concluida/.test(s)) c.c++; else if (s === "Atrasada") c.a++; else if (s === "Em Andamento") c.e++; else c.n++; });
      return [{ n: lista.length, rot: "Ações no plano", cor: PAL.vinhoE }, { n: c.n, rot: "Não iniciadas", cor: LP.corStatus("Não iniciada") }, { n: c.e, rot: "Em andamento", cor: LP.corStatus("Em andamento") }, { n: c.a, rot: "Atrasadas", cor: LP.corStatus("Atrasada") }, { n: c.c, rot: "Concluídas", cor: LP.corStatus("Concluída") }];
    };
    // V 1.30 (melhoria trazida do laudo psicossocial): quadro-resumo dos postos e contagem de
    // fatores por graduacao em cada grupo da ISO/TS 20646, para a conclusao.
    const resumoConclusao = () => {
      const postos = avaliacoes.map((av) => { const fs = fatoresDoPosto(av); const r = maiorGrau(fs); return { av, risco: r, determinantes: fs.filter((f) => r && ordemNivel(grau(f)) === ordemNivel(r)).map((f) => f.Fator).filter(Boolean) }; });
      const grupos = (Calc.GRUPOS_FATOR_RISCO || []).map((g) => { const fs = todosFatores.filter((x) => x.fr.Grupo === g).map((x) => x.fr); const c = contaNivelMz(fs); return { grupo: g, cont: niveisMz.map((n) => c[n]), total: fs.length, criticos: fs.filter((f) => ordemNivel(grau(f)) >= 2).length }; });
      const total = niveisMz.map((n, i) => grupos.reduce((t, g) => t + g.cont[i], 0));
      const freq = grupos.filter((g) => g.criticos).sort((a, b) => b.criticos - a.criticos).slice(0, 3);
      const lista = (a) => (a.length > 1 ? a.slice(0, -1).join(", ") + " e " + a[a.length - 1] : a[0] || "");
      const frase = freq.length ? `Os grupos de fatores com mais ocorrências de risco moderado ou superior são ${lista(freq.map((g) => `${g.grupo.toLowerCase()} (${g.criticos} fator${g.criticos === 1 ? "" : "es"})`))}. É nesses pontos que as ações devem se concentrar primeiro.` : "";
      const dist = niveisMz.map((n) => [n, postos.filter((p) => p.risco && ordemNivel(p.risco) === ordemNivel(n)).length]).filter(([, q]) => q).map(([n, q]) => `${q} com risco ${n.toLowerCase()}`);
      const fraseP = postos.length ? `Dos ${postos.length} posto${postos.length === 1 ? "" : "s"} avaliado${postos.length === 1 ? "" : "s"}${dist.length ? ", " + lista(dist) : ""}${postos.some((p) => !p.risco) ? `; ${postos.filter((p) => !p.risco).length} sem fator de risco identificado` : ""}. O risco de cada posto é a maior graduação entre os seus fatores. O quadro a seguir resume cada posto e os fatores que determinaram a graduação:` : "";
      return { postos, grupos, total, frase, fraseP };
    };
    const TXT_RISCO_POSTO = "Risco do posto de trabalho: o risco de cada posto (por cargo) é sempre a maior graduação entre os seus fatores de risco. Por exemplo, um posto com um fator de risco baixo e outro alto tem risco alto. É essa graduação que alimenta a Gestão de Risco do S.I.G.E.";
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
    // V 1.27: logotipos oficiais da ElevaLife (branco para fundo vinho, bordô para fundo claro)
    async function imagemUrl(url) {
      try {
        const resp = await fetch(url, { credentials: "same-origin" }); if (!resp.ok) return null;
        const blob = await resp.blob();
        return await new Promise((res) => { const l = new FileReader(); l.onload = () => res(String(l.result || "") || null); l.onerror = () => res(null); l.readAsDataURL(blob); });
      } catch (e) { return null; }
    }
    const logoEleva = await imagemUrl("img/logo-elevalife-branco.png"), logoElevaCor = await imagemUrl("img/logo-elevalife.png");
    for (const av of avaliacoes) for (const f of av.Fotos || []) await imagem(f && f.chave);
    for (const e of assinantes) e._assinatura = await imagem(chaveDe(e.Assinatura));

    // ---- metricas gerais -------------------------------------------------------
    const todosFatores = [];
    avaliacoes.forEach((av) => fatoresDoPosto(av).forEach((fr) => todosFatores.push({ av, fr })));
    // V 1.31: o plano traz tambem as acoes dos riscos ja eliminados (historico)
    const todosComEliminados = [];
    avaliacoes.forEach((av) => doPosto(av).forEach((fr) => todosComEliminados.push({ av, fr })));
    const todasAcoes = [];
    todosComEliminados.forEach(({ av, fr }) => acoesDe(fr).forEach((a) => todasAcoes.push({ av, fr, a })));
    const concluidas = todasAcoes.filter((x) => Acoes.estaConcluida(x.a)).length;
    const contaNivel = (lista) => {
      const c = { Baixo: 0, Medio: 0, Alto: 0, "Muito Alto": 0 };
      lista.forEach((fr) => { const n = Calc.nivelCanonico(grau(fr)); if (n in c) c[n]++; });
      return c;
    };
    const NIVEIS4 = [["Baixo", "Baixo"], ["Medio", "Moderado"], ["Alto", "Alto"], ["Muito Alto", "Muito Alto"]];
    // V 1.30: a metodologia segue a matriz do cliente - o panorama, o diagnostico por grupo e os
    // resumos usam as graduacoes da propria matriz (ex.: 5x5 com Muito Baixo e Altissimo).
    const ordemNivel = (n) => Calc.ordemNivel(n); // V 1.32: escala unica (inclui Irrelevante/Toleravel/Intoleravel da Gerdau)
    const niveisMz = (() => { const out = []; escala.forEach((p) => escala.forEach((g) => { const n = Calc.nivelDaMatriz(nomeMatriz, p, g); if (n && !out.includes(n)) out.push(n); })); return out.sort((a, b) => ordemNivel(a) - ordemNivel(b)); })();
    const contaNivelMz = (lista) => { const c = {}; niveisMz.forEach((n) => { c[n] = 0; }); lista.forEach((fr) => { const g = grau(fr); const k = niveisMz.find((n) => ordemNivel(n) === ordemNivel(g)); if (k) c[k]++; }); return c; };
    const maiorGrau = (lista) => lista.map(grau).filter(Boolean).sort((a, b) => ordemNivel(b) - ordemNivel(a))[0] || "";
    const resumoNiveis = (() => {
      const c = contaNivelMz(todosFatores.map((x) => x.fr));
      const partes = niveisMz.filter((k) => c[k]).map((k) => `${c[k]} com graduação ${k}`);
      return partes.length ? `, dos quais ${partes.join(", ").replace(/, ([^,]*)$/, " e $1")}` : "";
    })();
    const setoresAv = Array.from(new Set(avaliacoes.map((a) => a.Setor)));
    const unidadesAv = Array.from(new Set(avaliacoes.map((a) => a.Unidade)));
    const datas = avaliacoes.map((a) => a._atualizadaEm).filter(Boolean).sort();
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
      matriz: nomeMatriz.replace(/^Matriz/, "matriz"), dataBase: dataBR(hojeISO()), emissao, codigo, revisao,
      nomes: assinantes.map((a) => a.Nome).join(" e ") || "o responsável técnico",
    };
    // V 1.32: o mesmo texto que o Editor de Texto mostra; Severidade, Probabilidade e Graduação usam a versão
    // da matriz do cliente quando ela tem textos próprios (ex.: Matriz 5x5 Gerdau).
    const texto = (campo) => substituir(T.textoEfetivo(modelo, T.campoDaMatriz(campo, nomeMatriz)), vars);
    const linhasDe = (campo) => texto(campo).split(/\n+/).map((s) => s.trim()).filter(Boolean);
    // V 1.9: tabelas e listas editaveis - uma linha por registro, colunas separadas por "|".
    const celulas = (campo) => texto(campo).split("\n").map((l) => l.split("|").map((c) => c.trim())).filter((r) => r.some(Boolean));
    const mapaDe = (campo) => { const o = {}; celulas(campo).forEach((r) => { if (r[0]) o[r[0]] = r.slice(1).join(" | "); }); return o; };
    const titulosMapa = mapaDe("Titulos");
    // V 1.31: titulos antigos gravados no Editor de Texto passam aos nomes novos (evolucao do risco).
    const TITULOS_NOVOS = T.TITULOS_NOVOS || {};
    const titDe = (chave, padrao) => { const t = titulosMapa[chave] || padrao; return TITULOS_NOVOS[t] || t; };

    // dados de saida p/ o formulario (registro p/ verificacao)
    opcoes.saida = {
      codigo, revisao, acoes: todasAcoes.map((x) => x.a._id).filter(Boolean),
      registroResponsavel: responsavel ? responsavel.Registro || "" : "",
      registroExecutor: executor ? executor.Registro || "" : "",
    };
    // V 1.9: dados de uma acao do plano - usados pelo PDF e pelo Word.
    const statusAcaoInfo = (a) => {
      const st = Calc.statusDaLinhaAcao ? Calc.statusDaLinhaAcao(a, hoje) : (Acoes.estaConcluida(a) ? "Concluida" : "Nao Iniciado");
      const ROT = { "Concluida": "Concluída", "Concluida com atraso": "Concluída c/ atraso", "Em Andamento": "Em andamento", "Atrasada": "Atrasada", "Nao Iniciado": "Não iniciada" };
      const rot = ROT[st] || "Não iniciada"; return { rotulo: rot, cor: LP.corStatus(rot) };
    };
    const dadosAcao = (a, grauFator) => {
      const atual = a["Risco Atual Segmento"] || Calc.nivelCanonico(grauFator);
      // V 1.28: acao que nao reduz a graduacao e informada como organizacional / de controle
      const NV = Calc.NIVEIS_RISCO || [];
      const reduzMesmo = a["Risco Apos Acao"] && NV.indexOf(a["Risco Apos Acao"]) >= 0 && NV.indexOf(a["Risco Apos Acao"]) < NV.indexOf(Calc.nivelCanonico(atual));
      // V 1.31: efeito marcado pelo ergonomista (reduz para / elimina) e, depois de concluida, o resultado da reavaliacao
      const marcou = Acoes.reduzRisco ? Acoes.reduzRisco(a) : !!a["Risco Apos Acao"];
      const elimina = a["Risco Apos Acao"] === "Eliminado";
      const rv = a["Reavaliacao Risco"];
      const resultado = rv ? ` · reavaliado em ${dataBR(rv.data)}: ${rv.eliminado ? "risco eliminado" : rv.graduacao}` : "";
      const efeito = (marcou ? (elimina ? "Elimina o risco" : reduzMesmo ? `Reduz de ${rotCanon(atual)} para ${rotCanon(a["Risco Apos Acao"])}` : "Reduz o risco") : "Organizacional / de controle (não reduz a graduação)") + resultado;
      const reduz = efeito;
      return {
        nr: a["Nr Acao"] != null ? "A-" + String(a["Nr Acao"]).padStart(2, "0") : "-",
        tipo: Acoes.rotuloTipo(a["Tipo Acao"]) || a["Categoria Acao"] || "",
        descricao: a["Acao Recomendada"] || "",
        evidencia: (a.Evidencias || []).length ? `Evidência anexada (${a.Evidencias.length})` : "",
        segmentoRisco: `${a["Segmento Corporal"] || "Geral"}: ${reduz}`,
        efeito,
        responsavel: a["Responsavel Acao"] || "-",
        prazo: a["Dt Programada"] ? dataBR(a["Dt Programada"]) : "-",
        status: statusAcaoInfo(a),
      };
    };
    return {
      statusAcaoInfo, dadosAcao, corNivel, dataBR, hojeISO, PAL, ROTULO_ESCALA, URL_VERIFICACAO,
      Calc, Acoes, dados, T, modelo, nomeMatriz, escala, docCliente, hoje, avaliacoes, fatoresDoPosto, eliminadosDoPosto, doPosto, todosComEliminados, riscoDoPosto, TXT_RISCO_POSTO, resumoConclusao, pontuacoesDoNivel, NOTA_MATRIZ, contagemStatus, grau, pontos, rotCanon, acoesDe, responsavel, executor, assinantes, cacheImg, logoCliente, logoEleva, logoElevaCor, todosFatores, todasAcoes, concluidas, contaNivel, NIVEIS4, niveisMz, ordemNivel, contaNivelMz, maiorGrau, resumoNiveis, setoresAv, unidadesAv, periodo, emissao, codigo, revisao, vars, texto, linhasDe, celulas, mapaDe, titDe,
    };
  }

  async function gerar(opcoes) {
    const jsPDFCtor = global.jspdf && global.jspdf.jsPDF;
    if (!jsPDFCtor) throw new Error("A biblioteca de geração de PDF não carregou (script externo bloqueado ou indisponível).");
    const { statusAcaoInfo, dadosAcao, Calc, Acoes, dados, T, modelo, nomeMatriz, escala, docCliente, hoje, avaliacoes, fatoresDoPosto, eliminadosDoPosto, doPosto, todosComEliminados, riscoDoPosto, TXT_RISCO_POSTO, resumoConclusao, pontuacoesDoNivel, NOTA_MATRIZ, contagemStatus, grau, pontos, rotCanon, acoesDe, responsavel, executor, assinantes, cacheImg, logoCliente, logoEleva, logoElevaCor, todosFatores, todasAcoes, concluidas, contaNivel, NIVEIS4, niveisMz, ordemNivel, contaNivelMz, maiorGrau, resumoNiveis, setoresAv, unidadesAv, periodo, emissao, codigo, revisao, vars, texto, linhasDe, celulas, mapaDe, titDe } = await preparar(opcoes);

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
        cor(LP.textoSobre(c)); doc.text(txt, x + 5, yBase);
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
          cor(LP.textoSobre(it.cor)); fonte("bold", 18); doc.text(String(it.n), x + w / 2, y + 22, { align: "center" });
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
              cor(LP.textoSobre(m.cel.pilula)); doc.text(String(m.cel.t), x + pad + 5, y + (h - 12) / 2 + 8.6);
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
        doc.setTextColor(255, 255, 255); doc.text("SEVERIDADE", x0 + lab + eixo + (cw * n) / 2, y0 + 11, { align: "center" });
        escala.forEach((g, i) => { preencher(PAL.vinhoM); doc.rect(x0 + lab + eixo + i * cw, y0 + ch * 0.8, cw, ch * 0.8, "F"); doc.setTextColor(255, 255, 255); fonte("bold", 7); doc.text(Calc.rotuloEscala(nomeMatriz, g, "severidade"), x0 + lab + eixo + i * cw + cw / 2, y0 + ch * 0.8 + 10.5, { align: "center" }); });
        const yl = y0 + ch * 1.6;
        preencher(PAL.vinho); doc.rect(x0, yl, lab, ch * n, "F");
        doc.setTextColor(255, 255, 255); fonte("bold", 7); doc.text("PROBABILIDADE", x0 + 9.5, yl + (ch * n) / 2 + 28, { angle: 90 });
        for (let r = 0; r < n; r++) {
          const prob = escala[n - 1 - r]; const yy = yl + r * ch;
          preencher(PAL.creme); doc.rect(x0 + lab, yy, eixo, ch, "F"); cor(PAL.texto); fonte("bold", 7); doc.text(Calc.rotuloEscala(nomeMatriz, prob), x0 + lab + eixo - 4, yy + ch / 2 + 2.5, { align: "right" });
          escala.forEach((g, i) => {
            const nivel = Calc.nivelDaMatriz(nomeMatriz, prob, g);
            preencher(corNivel(nivel)); doc.rect(x0 + lab + eixo + i * cw, yy, cw, ch, "F");
            traco(PAL.branco, 0.8); doc.rect(x0 + lab + eixo + i * cw, yy, cw, ch);
            cor(LP.textoSobre(corNivel(nivel))); fonte("bold", 9); doc.text(String(Calc.pontuacaoDaMatriz(nomeMatriz, prob, g)), x0 + lab + eixo + i * cw + cw / 2, yy + ch / 2 + 3.2, { align: "center" });
          });
        }
        y = yl + ch * n + 12;
      }

      // ============================ CAPA ==========================================
      registrar("capa", "Capa", 0);
      LP.capa(doc, {
        logoEleva, lema: texto("Capa Lema"), logoCliente, nomeCliente: opcoes.nomeCliente,
        titulo: linhasDe("Capa Titulo"), subtitulo: texto("Capa Subtitulo"),
        infos: [
          ["Empresa avaliada", opcoes.nomeCliente, true],
          ["Unidade", unidadesAv.join(" · ")], ["Setores avaliados", setoresAv.join(" · ")],
          ["Período da avaliação", periodo], ["Data de emissão", emissao],
          ["Responsável técnico", responsavel ? responsavel.Nome : "-"], ["Documento / revisão", `${codigo} · Rev. ${revisao}`],
        ],
        numeros: [[avaliacoes.length, "postos de trabalho avaliados"], [todosFatores.length, "fatores de risco identificados"], [todasAcoes.length, `ações no plano${concluidas ? ", " + concluidas + " já concluídas" : ""}`]],
      });

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
          doc.text(doc.splitTextToSize([p && Calc.formatarCargo(p.Titulo), p && p.Registro].filter(Boolean).join("\n") || " ", w - 18), x + 9, y + 38);
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
          ["Telefone", docCliente.Telefone], ["Abrangência do laudo", opcoes.abrangenciaDescricao && opcoes.abrangenciaDescricao !== "Empresa toda" ? opcoes.abrangenciaDescricao : ""], ["Postos avaliados", `${avaliacoes.length} posto(s) de trabalho`], ["Período da avaliação", periodo],
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
      h2("s81", "8.1 Severidade e probabilidade");
      tabela(["Severidade", "Efeitos"], escala.map((g, i) => [{ t: `${Calc.rotuloEscala(nomeMatriz, g, "severidade")} (${i + 1})`, negrito: true }, defGravidade[Calc.rotuloEscala(nomeMatriz, g, "severidade")] || defGravidade[g] || ""]), [26, 74]);
      tabela(["Probabilidade", "Perfil de exposição qualitativa"], escala.map((g, i) => [{ t: `${Calc.rotuloEscala(nomeMatriz, g)} (${i + 1})`, negrito: true }, defProbabilidade[Calc.rotuloEscala(nomeMatriz, g)] || defProbabilidade[g] || ""]), [26, 74]);
      h2("s82", "8.2 Matriz de risco e graduação");
      paragrafos("Matriz Intro");
      desenharMatriz();
      {
        const niveis = []; escala.forEach((p) => escala.forEach((g) => { const n = Calc.nivelDaMatriz(nomeMatriz, p, g); if (n && !niveis.includes(n)) niveis.push(n); }));
        tabela(["Pontuações (P × S)", "Graduação", "Descrição do risco e conduta"], niveis.sort((a, b) => ordemNivel(a) - ordemNivel(b)).map((n) => [pontuacoesDoNivel(n), { t: n, pilula: corNivel(n) }, defNivel[n] || ""]), [16, 18, 66]);
        legenda(NOTA_MATRIZ);
      }
      paragrafo(TXT_RISCO_POSTO, {});
      h2("s83", "8.3 Medidas de controle e evolução do risco");
      paragrafos("Medidas Intro");
      tabela(null, (Acoes ? Acoes.tipos() : []).map((t, i) => [{ t: t.rotulo, pilula: [PAL.vinhoE, PAL.tealE, PAL.vinhoM][i % 3] }, (linhasDe("Medidas Tipos")[i % (linhasDe("Medidas Tipos").length || 1)] || "")]), [22, 78]);
      {
        const txt = texto("Residual Caixa");
        const q = txt.split("\n").map((p) => quebrar(palavras(p), L - 24, 8.2)); const h = 26 + q.reduce((s, x) => s + x.linhas.length * 11.6 + 3, 0);
        garantir(h + 8); caixa(M, y, L, h, PAL.creme); preencher(PAL.vinho); doc.rect(M, y, 3, h, "F");
        fonte("bold", 8.5); cor(PAL.vinhoE); doc.text(titDe("caixa-residual", "Como a evolução do risco é registrada"), M + 12, y + 14);
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
        registrar(chavePosto, `9.${i + 1} ${av.Setor} – ${av["Posto Trabalho"]} (${av.Cargo})`, 2);
        preencher(PAL.vinhoE); doc.roundedRect(M, y, L, 26, 4, 4, "F");
        doc.setFont("MontserratAlternates", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
        doc.text(doc.splitTextToSize(`9.${i + 1} ${av.Setor} – ${av["Posto Trabalho"]} (${av.Cargo})`, L - 20)[0], M + 10, y + 17); y += 36;
        // grade de identificacao
        const campos = [["Avaliação", [av._nrTexto, av._atualizadaEm ? "última atualização em " + dataBR(av._atualizadaEm) : ""].filter(Boolean).join(" · ")], ["Unidade", av.Unidade], ["Setor", av.Setor], ["Cargo", av.Cargo], ["Posto de trabalho", av["Posto Trabalho"]], ["Risco do posto", riscoDoPosto(av) ? riscoDoPosto(av) + " (maior graduação dos fatores)" : ""], ["Jornada", av["Jornada de Trabalho"]], ["Pausas", av.Pausas], ["Rodízio", av.Rodizio], ["Histórico de acidentes e doenças", av["Historico Acidentes"]]].filter((c) => c[1]);
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
        const cnt = contaNivelMz(fatores);
        azulejos(niveisMz.map((k) => ({ n: cnt[k], rot: k, cor: corNivel(k) })));
        // grupos
        tabela(["Grupo", "Grupo de fatores (ISO/TS 20646)", "Avaliados", "Com risco", "Diagnóstico"], Calc.GRUPOS_FATOR_RISCO.map((g, gi) => {
          const doGrupo = fatores.filter((f) => f.Grupo === g);
          const maior = maiorGrau(doGrupo);
          return [{ t: String(gi + 1), alinhar: "centro" }, g, { t: String(Calc.fatoresDoGrupo(g).length), alinhar: "centro" }, { t: String(doGrupo.length), alinhar: "centro" }, maior ? { t: maior, pilula: corNivel(maior) } : { t: "Sem risco identificado", cor: PAL.cinza }];
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
          const cols = [["Fonte geradora", fr["Circunstancia Geradora"]], ["Consequência", fr.Consequencia], ["Medida de controle existente", fr["Medida Controle Existente"] || "Nenhuma medida de controle existente."]];
          const ls = cols.map((c) => doc.splitTextToSize(String(c[1] || "-"), cwc));
          const hc = 12 + Math.max.apply(null, ls.map((l) => l.length)) * 10; garantir(hc + 40);
          cols.forEach((c, j) => { const x = M + j * (cwc + 8); fonte("bold", 6.3); cor(PAL.cinza); doc.text(c[0].toUpperCase(), x, y); fonte("normal", 7.8); cor(PAL.texto); ls[j].forEach((t, n) => doc.text(t, x, y + 11 + n * 10)); });
          y += hc + 6;
          // V 1.31: risco do fator, probabilidade, severidade e segmento acometido (+ evolucao, se houve reavaliacao)
          {
            const itens = [["Risco do fator", null], ["Probabilidade", Calc.rotuloEscala(nomeMatriz, fr.Probabilidade) || "-"], ["Severidade", Calc.rotuloEscala(nomeMatriz, fr.Criticidade, "severidade") || "-"], ["Segmento acometido", fr["Segmento Corporal"] || "Não identificado"]];
            const cw4 = (L - 18) / 4; garantir(30);
            itens.forEach((it, j) => {
              const x = M + j * (cw4 + 6); fonte("bold", 6.3); cor(PAL.cinza); doc.text(it[0].toUpperCase(), x, y + 6);
              if (it[1] == null) pilula(g, corNivel(g), x, y + 19); else { fonte("bold", 8.4); cor(PAL.texto); doc.text(doc.splitTextToSize(String(it[1]), cw4)[0], x, y + 18); }
            });
            y += 26;
            fonte("normal", 7.2); cor(PAL.cinza);
            doc.text(`Probabilidade ${Calc.rotuloEscala(nomeMatriz, fr.Probabilidade) || "-"}  ×  Severidade ${Calc.rotuloEscala(nomeMatriz, fr.Criticidade, "severidade") || "-"}  =  Pontuação ${p != null ? p : "-"} · graduação pela matriz do cliente`, M, y + 4); y += 12;
            const ev = Calc.textoEvolucaoRisco ? Calc.textoEvolucaoRisco(fr) : "";
            if (ev) paragrafo(`**Evolução do risco:** ${ev}`, { tam: 7.6, justificar: false, depois: 4 });
          }
          const acoesF = acoesDe(fr);
          if (acoesF.length) {
            const sorted = acoesF.slice().sort((a, b) => (Number(a["Nr Acao"]) || 0) - (Number(b["Nr Acao"]) || 0));
            tabela(["Ação", "Tipo", "Descrição", "Efeito no risco"], sorted.map((a) => { const d = dadosAcao(a, g); return [{ t: d.nr, negrito: true }, d.tipo || "-", { t: d.descricao || "-", extra: d.evidencia }, d.efeito]; }), [9, 17, 44, 30], { tam: 7.2 });
          } else { fonte("normal", 7.5); cor(PAL.cinza); garantir(14); doc.text("Sem ação proposta para este fator.", M, y + 6); y += 14; }
          y += 4;
        });
        const elim = eliminadosDoPosto(av);
        if (elim.length) {
          h3(titDe("p-eliminados", "Riscos eliminados neste posto"));
          tabela(["Fator de risco", "Segmento", "Eliminado em", "Evolução"], elim.map((f) => [f.Fator || "-", f["Segmento Corporal"] || "-", dataBR(f["Eliminado Em"]), Calc.textoEvolucaoRisco(f) || "-"]), [30, 16, 12, 42], { tam: 7.2 });
        }
      });

      function statusAcao(a) { const m = statusAcaoInfo(a); return { t: m.rotulo, pilula: m.cor }; }
      function linhaAcao(a, grauFator, comSetor) {
        const d = dadosAcao(a, grauFator);
        return [{ t: d.nr, negrito: true }, { t: `${d.tipo ? d.tipo + " – " : ""}${d.descricao}`, extra: d.evidencia }, d.segmentoRisco, d.responsavel, d.prazo, statusAcao(a)];
      }

      // ============================ 10 ==================================================
      h1("s10", "10. Plano de ação e evolução dos riscos", true);
      paragrafos("Recomendacoes");
      {
        azulejos(contagemStatus(todasAcoes, hoje));
      }
      if (todasAcoes.length) {
        const ord = todasAcoes.slice().sort((x, z) => (x.av.Setor + x.av["Posto Trabalho"]).localeCompare(z.av.Setor + z.av["Posto Trabalho"], "pt-BR") || (Number(x.a["Nr Acao"]) || 0) - (Number(z.a["Nr Acao"]) || 0));
        tabela(["Ação", "Setor · fator", "Tipo", "Descrição", "Responsável", "Prazo", "Situação"], ord.map(({ av, fr, a }) => {
          const l = linhaAcao(a, grau(fr), true);
          return [l[0], `${av.Setor} · ${fr.Fator || ""}`, { t: Acoes.rotuloTipo(a["Tipo Acao"]) || a["Categoria Acao"] || "-" }, { t: a["Acao Recomendada"] || "-", extra: l[1].extra }, l[3], l[4], l[5]];
        }), [7, 21, 13, 24, 12, 9, 14], { tam: 7 });
      } else paragrafo("Nenhuma ação cadastrada para os fatores deste documento.", { cor: PAL.cinza });
      // V 1.31: evolucao de cada risco (inicial -> atual), com as reavaliacoes feitas ao concluir as acoes
      h3(titDe("residual", "Evolução dos riscos"));
      tabela(["Setor · posto", "Fator de risco", "Segmento", "Risco inicial", "Risco atual", "Evolução"], todosComEliminados.map(({ av, fr }) => {
        const ini = Calc.graduacaoInicial(fr) || grau(fr); const elim = fr["Risco Eliminado"] === "Sim";
        return [`${av.Setor} · ${av["Posto Trabalho"]}`, fr.Fator || "", fr["Segmento Corporal"] || "-", { t: ini, pilula: corNivel(ini) }, elim ? { t: "Eliminado", cor: PAL.tealE, negrito: true } : { t: grau(fr), pilula: corNivel(grau(fr)) }, Calc.textoEvolucaoRisco(fr) || "Sem reavaliação"];
      }), [16, 24, 12, 12, 12, 24], { tam: 7 });
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
        const rc = resumoConclusao();
        if (rc.postos.length) {
          paragrafo(rc.fraseP);
          tabela(["Unidade", "Setor", "Posto (cargo)", "Fatores determinantes", "Risco do posto"], rc.postos.map((p) => [p.av.Unidade || "-", p.av.Setor || "-", `${p.av["Posto Trabalho"] || "-"}${p.av.Cargo ? ` (${p.av.Cargo})` : ""}`, p.determinantes.join("; ") || "Sem fator de risco identificado", p.risco ? { t: p.risco, pilula: corNivel(p.risco) } : { t: "–", cor: PAL.cinza }]), [16, 15, 20, 33, 16], { tam: 7.4 });
          if (todosFatores.length) {
            paragrafo("Quantidade de fatores por graduação em cada grupo de fatores da ISO/TS 20646, somando todos os postos deste documento:");
            tabela(["Grupo de fatores"].concat(niveisMz), rc.grupos.map((g) => [g.grupo].concat(g.cont.map((q) => ({ t: String(q), alinhar: "centro", negrito: q > 0, cor: q ? PAL.texto : PAL.cinza })))).concat([[{ t: "Total", negrito: true }].concat(rc.total.map((q) => ({ t: String(q), alinhar: "centro", negrito: true })))]), [40].concat(niveisMz.map(() => 60 / niveisMz.length)), { tam: 7.4 });
            if (rc.frase) paragrafo(rc.frase);
          }
        }
      }
      y = LP.fechamento(doc, y, {
        assinantes: assinantes.map((p) => ({ nome: p.Nome, cargo: [Calc.formatarCargo(p.Titulo), p.Registro].filter(Boolean).join(" · "), assinatura: p._assinatura })),
        cliente: opcoes.nomeCliente, tituloCliente: titDe("cliente-assinatura", `Cliente – ${opcoes.nomeCliente}`),
        codigo, tituloValidacao: titDe("validacao", "Validação do documento"), textoValidacao: texto("Validacao Texto"),
      }, (yy, h) => { y = yy; garantir(h); return y; });
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
      if (final) LP.cabecalhoRodape(doc, { logoCor: logoElevaCor, titulo: titDe("cabecalho", "ElevaLife · Avaliação Ergonômica Preliminar (AEP)"), codigo, revisao, rodape: `${opcoes.nomeCliente} – ${unidadesAv.join(" · ")}` });
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
