/* ==========================================================================
   S.I.G.E - ElevaLife · V 1.34
   Laudo da AET (modelo AET ElevaLife 2026) no padrao de laudo ElevaLife
   (mesma capa, sumario, cabecalho/rodape, cores, assinaturas e QR Code dos
   demais laudos). PDF por BI.LaudoBlocos e Word por BI.LaudoDocx.deBlocos.

   Abrangencia pelo filtro geral (empresa toda, unidade, setor/GHE, cargo ou
   posto): uma secao "Setor – Posto – Cargo" por AET, com foto geral e fotos de
   cada atividade, fatores (risco atual do Inventario), ferramentas (memorial
   de calculo), recomendacoes e diagnostico global. Os textos fixos ficam no
   Editor de Texto (campos "AET ...").
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const Calc = () => BI.Calc;

  // ------------------------------------------------------------------ textos padrao (Editor de Texto)
  const PADRAO = {
    "AET Apresentacao": "Este documento foi desenvolvido pela ElevaLife, devido à necessidade de um estudo das condições ergonômicas do trabalho das atividades desenvolvidas na empresa **{cliente}** – {unidade}, contemplando {escopo}.",
    "AET Fundamentacao": "O termo ergonomia, formado pelas palavras do grego ergon (trabalho) e nomos (regras, leis), foi proposto em 1857 pelo naturalista polonês Wojciech Jastrzebowski, usado pela primeira vez em 1949 pelo inglês Murrell e adotado oficialmente nesse mesmo ano pela Ergonomics Research Society, da Inglaterra.\n\nA Análise Ergonômica do Trabalho (AET) orienta modificações ou adaptações que possam garantir o exercício do trabalho em condições de conforto e qualidade, sem comprometimento da saúde e da segurança do trabalhador.\n\nDentro do contexto, é importante saber que a intervenção ergonômica depende da problemática a ser estudada, ou seja, ela é orientada pelos fatores de risco existentes nos postos de trabalho. Citamos aqui alguns dos aspectos que a ergonomia engloba enquanto intervenção:",
    "AET Aspectos": "Posturas e movimentos\nAntropometria\nDispositivos, equipamentos, controles e mostradores\nLevantamento e carregamento de peso\nDistúrbios osteomusculares relacionados ao trabalho (DORT)\nArranjo físico (layout)\nOrganização do trabalho\nFatores de exposições ambientais\nTrabalho em turnos e noturno",
    "AET Fatores Intro": "Devemos considerar os fatores e as características que podem interferir para que a atividade desempenhada num determinado posto de trabalho provoque maior ou menor intensidade de desgaste ao trabalhador, em função das cargas exigidas por aquela atividade: a organização do trabalho, o posto de trabalho, a população trabalhadora e o ambiente físico.",
    "AET Demanda": "Este documento, intitulado Análise Ergonômica do Trabalho, tem por finalidade não só atender às exigências legais (NR-17), como também identificar as condições de trabalho nas dependências da **{cliente}** de modo a estabelecer parâmetros que permitam a adaptação dessas condições às características psicofisiológicas dos trabalhadores, proporcionando o máximo de conforto, segurança e desempenho eficiente.\n\nAs condições de trabalho incluem aspectos relacionados ao levantamento, transporte e descarga de materiais, aos movimentos repetitivos, ao mobiliário, aos equipamentos e às condições ambientais dos postos de trabalho e à própria organização do trabalho.\n\nPortanto, este documento está embasado, principalmente, na Norma Regulamentadora NR-17 – Ergonomia.",
    "AET Demanda Topicos": "Atender ao prescrito pela Norma Regulamentadora 17 (NR-17 – Ergonomia), atualizada pela Portaria MTP nº 423, de 7 de outubro de 2021, que no item 17.1 preconiza: “Esta Norma Regulamentadora visa estabelecer as diretrizes e os requisitos que permitam a adaptação das condições de trabalho às características psicofisiológicas dos trabalhadores, de modo a proporcionar conforto, segurança, saúde e desempenho eficiente no trabalho”.\nIdentificar possíveis fatores de risco para a saúde dos trabalhadores, buscando melhorar a qualidade de vida, o conforto e a eficiência dos trabalhadores e diminuir a possibilidade de adoecimento.",
    "AET Metodos Intro": "O trabalho foi realizado por {executor}{executorDados}{responsavelTxt}.\n\nAbaixo são relatados os métodos e as metodologias utilizados para a Análise Ergonômica do Trabalho das atividades desenvolvidas, enfatizando os quatro focos da ergonomia: organização do trabalho, posto de trabalho, população trabalhadora e ambiente físico.",
    "AET Organizacao": "**Métodos utilizados:** entrevista formal e informal e observação.\n\n**Metodologia:** a análise da organização do trabalho teve como objetivo conhecer o sistema de funcionamento, a jornada de trabalho das funções, o ritmo de trabalho, as pausas utilizadas, as necessidades fisiológicas, o enriquecimento da tarefa e as necessidades referidas pelos empregados. Entrevistas informais foram realizadas junto aos trabalhadores, que relataram o funcionamento da sua atividade e seus relatos pessoais e específicos quanto às atividades em análise.",
    "AET Posto": "**Métodos utilizados:** observação, medições, entrevista informal, fotos e filmagens.\n\n**Metodologia:** a análise do posto de trabalho foi realizada estudando as ferramentas de trabalho, o mobiliário, as dimensões e o posicionamento do trabalhador frente ao posto de trabalho ou à atividade realizada.",
    "AET Populacao": "**Métodos utilizados:** entrevista informal, questionário, observação, consulta dos dados de saúde, motivos de afastamento e absenteísmo, fotos, filmagens, avaliação biomecânica e aplicação de metodologias reconhecidas internacionalmente em ergonomia.\n\n**Metodologia:** a análise da população trabalhadora foi realizada por meio de uma avaliação biomecânica que considera os grupos musculares utilizados, o ângulo dos movimentos realizados e a repetitividade das tarefas; o ciclo de trabalho foi verificado, assim como o uso de força muscular durante as atividades. As ferramentas aplicadas apresentam o resultado em pontuação, identificando os riscos analisados.",
    "AET Ambiente": "**Métodos utilizados:** observação, medições ambientais e entrevista informal.\n\n**Metodologia:** a análise do ambiente físico foi realizada de modo qualitativo e quantitativo, observando a disposição e o tipo de iluminação, o tipo de piso e paredes, a higienização, a ventilação, as cores e as medições ambientais por uso de aparelhos.",
    "AET Iluminacao": "17.8.1 Em todos os locais e situações de trabalho deve haver iluminação, natural ou artificial, geral ou suplementar, apropriada à natureza da atividade.\n17.8.2 A iluminação deve ser projetada e instalada de forma a evitar ofuscamento, reflexos incômodos, sombras e contrastes excessivos.\n17.8.3 Em todos os locais e situações de trabalho internos, deve haver iluminação em conformidade com os níveis mínimos de iluminamento estabelecidos na Norma de Higiene Ocupacional nº 11 (NHO 11) da Fundacentro – Avaliação dos Níveis de Iluminamento em Ambientes Internos de Trabalho, versão 2018.",
    "AET Acustico": "17.8.4 Nos locais de trabalho em ambientes internos onde são executadas atividades que exijam manutenção da solicitação intelectual e atenção constantes, devem ser adotadas medidas de conforto acústico e de conforto térmico.\n17.8.4.1 A organização deve adotar medidas de controle do ruído nos ambientes internos com a finalidade de proporcionar conforto acústico nas situações de trabalho.\n17.8.4.1.2 Para os demais casos, o nível de ruído de fundo aceitável para efeito de conforto acústico será de até 65 dB(A), nível de pressão sonora contínuo equivalente ponderado em A e no circuito de resposta Slow (S).",
    "AET Termico": "17.8.4.2 A organização deve adotar medidas de controle da temperatura, da velocidade do ar e da umidade com a finalidade de proporcionar conforto térmico nas situações de trabalho, observando-se o parâmetro de faixa de temperatura do ar entre 18 e 25 °C para ambientes climatizados.\n17.8.4.2.1 Devem ser adotadas medidas de controle da ventilação ambiental para minimizar a ocorrência de correntes de ar aplicadas diretamente sobre os trabalhadores.",
    "AET Ambiente Fecho": "Os resultados obtidos nas medições encontram-se no item “Análise do ambiente” de cada análise; os parâmetros seguidos estão em conformidade com a NR-17, item 17.8, e com a NHO 11. Os certificados de calibração dos instrumentos estão em anexo ao término do presente documento.",
    "AET Risco Intro": "Ao final da análise de cada função ou grupo homogêneo é estabelecido o risco de cada atividade por meio da aplicação de metodologias específicas para as características das atividades (descritas no item “Métodos aplicados”). A classificação do risco leva em consideração os parâmetros estabelecidos na legislação e nas metodologias de análise de risco ergonômico; nas situações em que não for aplicável a metodologia em sua integralidade, são usados parâmetros isolados como referência para a estimativa do risco.\n\nAlém da classificação pelas metodologias, são utilizados parâmetros de exposição aos fatores ergonômicos para determinar o risco final, com base na AIHA (2015) e na ISO 45001. Quando a métrica da ferramenta já considera o tempo de exposição, o resultado da ferramenta define o risco; quando não considera, o resultado da ferramenta define a severidade, que é cruzada com a probabilidade (categoria de exposição) na matriz de risco do cliente ({matriz}).",
    "AET Recomendacoes": "Ao final da análise de cada função ou grupo homogêneo, as recomendações e sugestões são apontadas com o objetivo de melhorias para a prevenção à saúde do trabalhador, buscando alcançar o conforto, a segurança e a eficiência. As recomendações específicas de cada atividade estão no Plano de Ação do S.I.G.E, onde são definidos o responsável, o prazo e a situação de cada uma.",
    "AET Conduta": "Trivial | Nenhuma ação é requerida e nenhum registro documental precisa ser mantido.\nBaixo | Pode-se estudar a implantação de ações preventivas e o monitoramento do risco para assegurar que os controles sejam mantidos.\nModerado | Devem ser feitos estudos sistemáticos para reduzir o risco e as ações devem ser implantadas em médio prazo, definido pela empresa. Caso apareçam queixas ou ocorrências deste risco, o prazo deve ser reduzido.\nAlto | Além do estudo sistemático da atividade, deve haver um plano de melhoria de curto prazo aprovado pela alta direção da empresa, para eliminar ou minimizar o risco. A execução do plano deve ser monitorada e avaliada até a eliminação ou minimização do risco.\nAltíssimo | Além do estudo sistemático da atividade, deve haver um plano de melhoria, de prazo imediato, aprovado pela alta direção da empresa, para eliminar o risco. A execução do plano deve ser monitorada e avaliada até a eliminação ou minimização do risco.",
    "AET Conclusao": "As condições de trabalho fornecidas nos locais de trabalho analisados neste laudo possibilitam mudanças posturais, pausas curtas, autonomia e responsabilidades; essas qualidades são fundamentais para que o trabalho seja adequado às características psicofisiológicas do ser humano.\n\nAlguns pontos de melhoria foram observados e, sendo possíveis, devem ser realizadas as adequações conforme as recomendações.",
    "AET Encerramento": "O principal objetivo desta análise foi fornecer dados sobre as condições de trabalho a que estão sujeitos os trabalhadores da empresa, devendo, contudo, ser dada atenção especial ao atendimento das recomendações contidas no corpo do presente documento, com o objetivo de manter e assegurar as boas condições durante o desenvolvimento de suas atividades laborais.\n\nA empresa deve organizar cronograma para estudos e atendimento às recomendações contidas nesta AET (Análise Ergonômica do Trabalho).\n\nA análise foi realizada em {mesAno}, contendo {totalPaginas} folhas, sendo todas as páginas preenchidas no seu anverso, não contendo nada no verso.",
  };
  const CAMPOS = [
    ["AET Apresentacao", "AET · 1. Apresentação (marcadores {cliente}, {unidade}, {escopo})"],
    ["AET Fundamentacao", "AET · 2. Fundamentação"], ["AET Aspectos", "AET · 2. Aspectos da intervenção ergonômica (um por linha)"], ["AET Fatores Intro", "AET · 2. Fatores que interferem no desgaste"],
    ["AET Demanda", "AET · 3. Demanda do trabalho (marcador {cliente})"], ["AET Demanda Topicos", "AET · 3. Demanda do trabalho em tópicos (um por linha)"],
    ["AET Metodos Intro", "AET · 5. Métodos – abertura (marcadores {executor}, {executorDados}, {responsavelTxt})"],
    ["AET Organizacao", "AET · 5.1 Análise da organização do trabalho"], ["AET Posto", "AET · 5.2 Análise do posto de trabalho"], ["AET Populacao", "AET · 5.3 Análise da população trabalhadora"],
    ["AET Ambiente", "AET · 5.4 Análise do ambiente"], ["AET Iluminacao", "AET · 5.4.1 Iluminação (itens da NR-17, um por linha)"], ["AET Acustico", "AET · 5.4.2 Conforto acústico (um por linha)"], ["AET Termico", "AET · 5.4.3 Conforto térmico (um por linha)"], ["AET Ambiente Fecho", "AET · 5.4 Fecho"],
    ["AET Risco Intro", "AET · 5.5 Análise de risco (marcador {matriz})"], ["AET Recomendacoes", "AET · 6. Recomendações e sugestões"],
    ["AET Conduta", "AET · 6.1 Conduta administrativa (uma por linha: graduação | conduta; Trivial, Baixo, Moderado, Alto, Altíssimo)"],
    ["AET Conclusao", "AET · Conclusão"], ["AET Encerramento", "AET · Encerramento (marcadores {mesAno} e {totalPaginas})"],
  ];
  if (BI.LaudoTextos) { Object.assign(BI.LaudoTextos.PADRAO, PADRAO); CAMPOS.forEach((c) => { if (!BI.LaudoTextos.CAMPOS_EDITAVEIS.some((x) => x[0] === c[0])) BI.LaudoTextos.CAMPOS_EDITAVEIS.push(c); }); }

  // ------------------------------------------------------------------ util
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const dataBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : iso || "");
  const hex = (h) => String(h || "").replace("#", "");
  function runsDe(txt, base) { const out = []; String(txt || "").split(/(\*\*[^*]+\*\*)/).forEach((p) => { if (!p) return; if (/^\*\*[^*]+\*\*$/.test(p)) out.push(Object.assign({ x: p.slice(2, -2), b: true }, base || {})); else out.push(Object.assign({ x: p }, base || {})); }); return out; }
  async function dataUrl(url) { try { const r = await fetch(url, { credentials: "same-origin" }); if (!r.ok) return null; const b = await r.blob(); if (!/^image\/(png|jpe?g)/.test(b.type)) return null; return await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result || "") || null); f.onerror = () => ok(null); f.readAsDataURL(b); }); } catch (e) { return null; } }
  const cacheImg = {};
  async function imagem(chave) { if (!chave) return null; if (cacheImg[chave] !== undefined) return cacheImg[chave]; cacheImg[chave] = await dataUrl(BI.DB.urlArquivo(chave)); return cacheImg[chave]; }
  async function sha256(blob) { const d = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()); return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
  function baixar(blob, nome) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }

  // ------------------------------------------------------------------ montagem dos blocos
  async function montar(op) {
    const C = Calc(); const LB = BI.LaudoBlocos; const COR = LB.COR; const CW = LB.CW;
    const modelo = (BI.dados.modeloLaudo || [])[0] || {};
    const T = BI.LaudoTextos; const mz = op.matriz;
    const texto = (campo) => T.textoEfetivo(modelo, T.campoDaMatriz ? T.campoDaMatriz(campo, mz) : campo);
    const subst = (t, vars) => String(t || "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    const vars = op.vars;
    const blocos = []; const TOC = []; const tocN = [0, 0, 0];
    const H = (t, l, o) => { l = l || 0; tocN[l]++; for (let k = l + 1; k < 3; k++) tocN[k] = 0; const x = `${tocN.slice(0, l + 1).join(".")}${l === 0 ? "." : ""} ${t}`; if (l <= 1) TOC.push({ title: x, level: l + 1 }); blocos.push({ t: "h", l, x, toc: l <= 1, pb: !!(o && o.pb) }); };
    const P = (txt, o) => { o = o || {}; blocos.push({ t: "p", runs: Array.isArray(txt) ? txt : runsDe(subst(txt, vars)), al: o.al || "j", s: o.s, sa: o.sa, sb: o.sb, keep: !!o.keep, ind: o.ind, mark: o.mark, markW: o.markW, lh: o.lh }); };
    const paras = (campo) => String(subst(texto(campo), vars)).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).forEach((x) => P(x));
    const bullets = (campo) => String(subst(texto(campo), vars)).split("\n").map((x) => x.trim()).filter(Boolean).forEach((x) => P(x, { ind: 16, mark: "•", markW: 11, sa: 3 }));
    const cell = (t, o) => { o = o || {}; return { p: [{ runs: Array.isArray(t) ? t : runsDe(String(t == null ? "" : t), o.bold ? { b: true } : null), s: o.size || 8.5, al: o.align || "l", c: o.color }], f: o.fill, span: o.span, c: o.color }; };
    const hdr = (labels, fill) => labels.map((l) => cell(l, { fill: fill || COR.wine, bold: true, color: "FFFFFF" }));
    const table = (rows, w, o) => { o = o || {}; blocos.push({ t: "tb", w, rows, hdr: o.header !== false, keep: !!o.keep, va: o.va, zebra: o.zebra }); blocos.push({ t: "esp", h: 4 }); };
    const kv = (pares, w) => table(pares.filter((p) => p[1] != null && String(p[1]).trim() !== "").map(([k, v]) => [cell(k, { fill: COR.tint, bold: true, color: COR.deep }), cell(v)]), w || [2700, 6654], { header: false, va: "t" });
    const pill = (n) => { const hx = n ? C.corRiscoHex(n) : null; return cell(n || "-", { fill: hx || undefined, bold: true, align: "c", color: hx ? C.textoSobreHex(hx) : COR.ink }); };
    const corNivel = (n) => C.corRiscoHex(n) || "EADDE0";

    blocos.push({ t: "toc" }); blocos.push({ t: "pb" });
    // 1-4
    H("Apresentação"); paras("AET Apresentacao");
    H("Fundamentação"); paras("AET Fundamentacao"); bullets("AET Aspectos"); paras("AET Fatores Intro");
    H("Demanda do trabalho"); paras("AET Demanda"); P("**Demanda do trabalho em tópicos:**", { keep: true }); bullets("AET Demanda Topicos");
    H("Informações cadastrais");
    const dc = op.docCliente;
    const end = [dc.Logradouro, dc.Numero, dc.Complemento, dc.Bairro, dc.Cidade && dc.Estado ? `${dc.Cidade}/${dc.Estado}` : dc.Cidade, dc.CEP ? "CEP " + dc.CEP : ""].filter(Boolean).join(", ");
    kv([["Nome do cliente", op.cliente], ["Endereço", end || "-"], ["CNPJ", dc.CNPJ || "-"], ["CNAE", dc.CNAE || "-"], ["Grau de risco (NR-4)", dc["Grau Risco NR4"] || "-"], ["Abrangência", op.abrangenciaTxt]]);
    // 5 metodos
    H("Métodos e metodologia utilizada", 0, { pb: true }); paras("AET Metodos Intro");
    H("Análise da organização do trabalho", 1); paras("AET Organizacao");
    H("Análise do posto de trabalho", 1); paras("AET Posto");
    H("Análise da população trabalhadora", 1); paras("AET Populacao");
    H("Análise do ambiente – condições de conforto no ambiente de trabalho", 1); paras("AET Ambiente");
    const inst = op.instrumentos.map((c) => c.Nome).join("; ");
    H("Iluminação", 2); bullets("AET Iluminacao"); if (inst) P(`**Aparelhos de medição:** ${inst}.`);
    H("Conforto acústico", 2); bullets("AET Acustico");
    H("Conforto térmico", 2); bullets("AET Termico"); paras("AET Ambiente Fecho");
    H("Análise de risco", 1); paras("AET Risco Intro");
    const ferrUsadas = op.ferramentasUsadas;
    if (ferrUsadas.length) { P("Metodologias aplicadas nas atividades analisadas:", { keep: true }); ferrUsadas.forEach((f) => P([{ x: f.nome + ": ", b: true }, { x: (f.descricao || "").split(". ")[0] + "." }], { ind: 16, mark: "•", markW: 11, sa: 3 })); }
    // severidade / probabilidade / matriz
    const esc = C.escalaDaMatriz(mz); const n = esc.length;
    const defS = {}, defP = {}; T.textoEfetivo(modelo, T.campoDaMatriz ? T.campoDaMatriz("Gravidade", mz) : "Gravidade").split("\n").forEach((l) => { const [k, ...r] = l.split("|"); if (k && r.length) defS[k.trim()] = r.join("|").trim(); });
    P(`**Severidade** (consequência da exposição) – escala da ${mz}:`, { keep: true });
    table([hdr(["Severidade", "Descrição"])].concat(esc.map((v, i) => [cell(`${C.rotuloEscala(mz, v, "severidade")} (${i + 1})`, { bold: true }), cell(defS[C.rotuloEscala(mz, v, "severidade")] || defS[v] || "")])), [2600, 6754], { keep: true });
    P("**Probabilidade** (categoria de exposição efetiva na jornada):", { keep: true });
    const expo = BI.AET.exposicaoDe(mz);
    table([hdr(["Probabilidade", "Categoria de exposição"])].concat(esc.map((v, i) => [cell(`${C.rotuloEscala(mz, v)} (${i + 1})`, { bold: true }), cell(expo[i] || "")])), [2600, 6754], { keep: true });
    P(`**Matriz de risco (${mz})** – severidade × probabilidade; em cada célula, a pontuação e a cor da graduação:`, { keep: true });
    const linhasM = [[cell("Probabilidade \\ Severidade", { fill: COR.wine, bold: true, color: "FFFFFF", size: 7.5 })].concat(esc.map((v) => cell(C.rotuloEscala(mz, v, "severidade"), { fill: COR.wine, bold: true, color: "FFFFFF", align: "c", size: 7.5 })))];
    esc.slice().reverse().forEach((p) => linhasM.push([cell(C.rotuloEscala(mz, p), { bold: true, fill: COR.tint, color: COR.deep, size: 7.5 })].concat(esc.map((s) => { const nv = C.nivelDaMatriz(mz, p, s); const hx = corNivel(nv); return cell(`${C.pontuacaoDaMatriz(mz, p, s)} · ${nv}`, { fill: hx, bold: true, align: "c", color: C.textoSobreHex(hx), size: 7.5 }); }))));
    table(linhasM, [1900].concat(esc.map(() => Math.floor(7454 / n))), { keep: true, header: false });
    // 6 recomendacoes e conduta
    H("Recomendações e sugestões", 0, { pb: true }); paras("AET Recomendacoes");
    H("Conduta administrativa para a gestão dos riscos ergonômicos", 1);
    const cond = {}; texto("AET Conduta").split("\n").forEach((l) => { const [k, ...r] = l.split("|"); if (k && r.length) cond[C.ordemNivel(k.trim())] = r.join("|").trim(); });
    const niveis = C.niveisDaMatriz(mz).slice().sort((a, b) => C.ordemNivel(a) - C.ordemNivel(b));
    table([hdr(["Graduação", "Conduta administrativa"])].concat(niveis.map((nv) => [pill(nv), cell(cond[C.ordemNivel(nv)] || "")])), [2200, 7154], { keep: true });

    // 7 analises por posto
    const aets = op.aets; let nFig = 0;
    for (const a of aets) {
      H(`${a.Setor || "-"} – ${a["Posto Trabalho"] || "-"} – ${a.Cargo || "-"}`, 0, { pb: true });
      kv([["AET", a["Nr AET"] ? "AET-" + String(a["Nr AET"]).padStart(3, "0") : "-"], ["Unidade", a.Unidade], ["Setor / GHE", a.Setor], ["Posto de trabalho", a["Posto Trabalho"]], ["Função / cargo", a.Cargo], ["Data da análise", dataBR(a["Data Analise"])], ["Ergonomista", a.Ergonomista], ["Risco do posto (maior graduação dos fatores)", op.riscoPosto(a) || "-"]]);
      if (a["Descricao Setor"]) { H("Descrição do setor", 2); P(a["Descricao Setor"]); }
      const pop = [a["Populacao Total"] ? `População de ${a["Populacao Total"]} colaboradores` : "", a["Populacao Masculina"] != null && a["Populacao Masculina"] !== "" ? `${a["Populacao Masculina"]} do sexo masculino` : "", a["Populacao Feminina"] != null && a["Populacao Feminina"] !== "" ? `${a["Populacao Feminina"]} do sexo feminino` : ""].filter(Boolean);
      if (pop.length) { H("Descrição da população trabalhadora", 2); P(pop.join("; ") + "."); }
      if (a["Descricao Cargo"]) { H("Descrição do cargo / atividades", 2); String(a["Descricao Cargo"]).split("\n").map((x) => x.replace(/^[-•\s]+/, "").trim()).filter(Boolean).forEach((x) => P(x, { ind: 16, mark: "•", markW: 11, sa: 3 })); }
      const org = BI.AET.ORGANIZACAO.filter(([k]) => a[k]);
      if (org.length) { H("Análise da organização do trabalho", 2); table([hdr(["Item", "Descrição"])].concat(org.map(([k, r]) => [cell(r, { bold: true }), cell(a[k])])), [2700, 6654]); }
      const dm = BI.AET.DEMANDAS.filter(([k]) => a.Demandas && a.Demandas[k]);
      if (dm.length) { H("Demandas cognitivas e psicossociais", 2); table([hdr(["Item", "Descrição"])].concat(dm.map(([k, r]) => [cell(r, { bold: true }), cell(a.Demandas[k])])), [2700, 6654]); }
      H("Análise do posto de trabalho", 2);
      if (a["Descricao Posto"]) P(a["Descricao Posto"]);
      const fg = []; for (const f of a["Foto Geral"] || []) { const d = await imagem(f.chave); if (d) fg.push({ d, leg: `Figura ${++nFig} – ${f.legenda || "visão geral do posto de trabalho"}` }); }
      if (fg.length) blocos.push({ t: "fotos", itens: fg, alt: 170 });
      const amb = BI.AET.AMBIENTE.filter(([k]) => a[k]);
      if (amb.length || (a.Medicoes || []).some((m) => m.medicao || m.condicao)) {
        H("Análise do ambiente", 2);
        if (amb.length) table([hdr(["Item", "Descrição"])].concat(amb.map(([k, r]) => [cell(r, { bold: true }), cell(a[k])])), [2700, 6654]);
        const med = (a.Medicoes || []).filter((m) => m.medicao || m.condicao || m.local);
        if (med.length) table([hdr(["Fator", "Local / medição", "Medição", "Parâmetro", "Condição"])].concat(med.map((m) => [cell(m.fator, { bold: true }), cell(m.local || "-"), cell(m.medicao || "-"), cell(m.parametro || "-"), cell(m.condicao || "-", { bold: /n[aã]o conforme/i.test(m.condicao || ""), color: /n[aã]o conforme/i.test(m.condicao || "") ? "C62828" : undefined })])), [1500, 2300, 1600, 2200, 1754]);
        if (a["Consideracoes Ambiente"]) P(a["Consideracoes Ambiente"]);
      }
      if (a.Manifestacoes) { H("Manifestações dos trabalhadores", 2); P(a.Manifestacoes); }
      const ciclos = (a.Ciclos || []).filter((c) => c.atividade || c.tempo);
      if (ciclos.length) { H("Ciclo de trabalho", 2); table([hdr(["Atividade", "Tempo do ciclo", "Nº de ciclos por turno"])].concat(ciclos.map((c) => [cell(c.atividade), cell(c.tempo), cell(c.ciclos)])), [4000, 2600, 2754]); }
      const cargas = (a.Cargas || []).filter((c) => c.carga || c.peso);
      if (cargas.length) { H("Movimentação manual de carga", 2); table([hdr(["Carga movimentada", "Peso da carga", "Padrão da movimentação", "Nº na jornada"])].concat(cargas.map((c) => [cell(c.carga), cell(c.peso), cell(c.padrao), cell(c.vezes)])), [2800, 1900, 2800, 1854]); }
      // atividades
      H("Análise sistemática – fatores de riscos ergonômicos", 1);
      for (let ai = 0; ai < (a.Atividades || []).length; ai++) {
        const at = a.Atividades[ai];
        H(`Atividade ${String(ai + 1).padStart(2, "0")}: ${at.nome}`, 2);
        if (at.descricao) { P("**Descrição da atividade:**", { keep: true, sa: 2 }); String(at.descricao).split(/\n\s*\n/).forEach((x) => P(x)); }
        const fts = []; for (const f of at.fotos || []) { const d = await imagem(f.chave); if (d) fts.push({ d, leg: `Figura ${++nFig} – ${f.legenda || at.nome}` }); }
        if (fts.length) { P("**Registro fotográfico**", { keep: true, sa: 3 }); blocos.push({ t: "fotos", itens: fts, alt: 140 }); }
        const linhasF = (at.fatores || []).map((fa) => ({ fa, row: op.linhaFator(a, fa) }));
        if (linhasF.length) {
          table([hdr(["Fator de risco", "Consequência", "Segmento", "Metodologia de estudo", "Severidade", "Probabilidade", "Grau de risco"])].concat(linhasF.map(({ fa, row }) => {
            const nome = (row && row.Fator) || (fa.fator === "__outro" ? fa.outro : fa.fator);
            const sev = row && row.Criticidade ? `${C.rotuloEscala(mz, row.Criticidade, "severidade")} (${esc.indexOf(row.Criticidade) + 1})` : row && row["Graduacao Risco"] ? "Pela ferramenta" : "—";
            const prob = row && row.Probabilidade ? `${C.rotuloEscala(mz, row.Probabilidade)} (${esc.indexOf(row.Probabilidade) + 1})` : row && row["Graduacao Risco"] ? "Pela ferramenta" : "—";
            const gr = row ? (row["Risco Eliminado"] === "Sim" ? "Eliminado" : row["Graduacao Risco"]) : "";
            return [cell(nome, { bold: true, size: 7.8 }), cell(fa.consequencia || "-", { size: 7.8 }), cell(fa.segmento || "-", { size: 7.8 }), cell((row && row["Metodologia AET"]) || "-", { size: 7.8 }), cell(sev, { size: 7.8, align: "c" }), cell(prob, { size: 7.8, align: "c" }), pill(gr)];
          })), [1700, 1500, 1150, 1500, 1150, 1150, 1204], { va: "t" });
          // evolucao (quando houve reavaliacao)
          linhasF.forEach(({ row }) => { if (row && Array.isArray(row["Historico Risco"]) && row["Historico Risco"].length) P(`**Evolução – ${row.Fator}:** ${C.textoEvolucaoRisco(row)}`, { s: 8 }); });
        }
        // recomendacoes
        const acoes = linhasF.flatMap(({ row }) => (row ? (BI.dados.planoAcao || []).filter((p) => p["Fator Risco Id"] === row._id) : []));
        if (acoes.length || at.recomendacoes) {
          P("**Recomendações específicas**", { keep: true, sa: 3, sb: 4 });
          if (acoes.length) table([hdr(["Ação", "Tipo", "Recomendação", "Efeito no risco"])].concat(acoes.map((ac) => [cell(ac["Nr Acao"] != null ? "A-" + String(ac["Nr Acao"]).padStart(2, "0") : "-", { bold: true }), cell(BI.Acoes ? BI.Acoes.rotuloTipo(ac["Tipo Acao"]) : ac["Tipo Acao"] || "-"), cell(ac["Acao Recomendada"] || "-"), cell(ac["Reduz Risco"] === "Sim" || ac["Risco Apos Acao"] ? (ac["Risco Apos Acao"] === "Eliminado" ? "Elimina o risco" : "Reduz para " + C.rotuloNivel(ac["Risco Apos Acao"])) : "Organizacional / de controle")])), [900, 1800, 4654, 2000], { va: "t" });
          if (at.recomendacoes) P(at.recomendacoes);
        }
        // memorial de calculo
        const usos = (at.fatores || []).flatMap((fa) => (fa.ferramentas || []).map((it) => ({ fa, it })));
        if (usos.length) {
          P("**Memorial de cálculo**", { keep: true, sa: 3, sb: 4 });
          usos.forEach(({ fa, it }) => {
            const def = BI.Ferramentas.porId(it.id); if (!def) return; const r = BI.Ferramentas.calcular(it.id, it.valores || {});
            const nv = r.ok && r.nivel != null ? r.nivel : (it.nivelManual !== "" && it.nivelManual != null ? Number(it.nivelManual) : null);
            const linhas = [[cell(`${def.nome} – ${(fa.fator === "__outro" ? fa.outro : fa.fator) || ""}`, { fill: COR.tint, bold: true, color: COR.deep, span: 2 })]];
            // V 1.37: dados preenchidos na ferramenta (entradas), depois o calculo (memorial) e o resultado
            const ent = BI.Ferramentas.entradas ? BI.Ferramentas.entradas(it.id, it.valores || {}) : [];
            if (ent.length) {
              linhas.push([cell("Dados preenchidos na ferramenta", { bold: true, size: 7.8, color: COR.deep, fill: "F6EEEF", span: 2 })]);
              let sec = null;
              ent.forEach(([k, v, sc]) => { if (sc && sc !== sec) { sec = sc; linhas.push([cell(sc, { bold: true, size: 7.4, color: COR.mut, span: 2 })]); } linhas.push([cell(k, { size: 7.6 }), cell(v, { size: 7.6 })]); });
            } else linhas.push([cell("Dados preenchidos na ferramenta", { bold: true, size: 7.8 }), cell("Ferramenta aplicada sem dados de entrada preenchidos.", { size: 7.8 })]);
            if ((r.memorial || []).length) linhas.push([cell("Cálculo", { bold: true, size: 7.8, color: COR.deep, fill: "F6EEEF", span: 2 })]);
            (r.memorial || []).forEach(([k, v]) => linhas.push([cell(k, { bold: true, size: 7.8 }), cell(v, { size: 7.8 })]));
            linhas.push([cell("Resultado", { bold: true, size: 7.8 }), cell(`${r.ok ? r.pontuacao + " – " : ""}${r.classe}${nv != null ? " (nível " + BI.Ferramentas.NIVEIS[nv].toLowerCase() + ")" : ""} · ${BI.AET.comExposicao(it) ? "considera o tempo de exposição: define o risco" : "cruzado com a probabilidade (exposição)"}`, { size: 7.8 })]);
            table(linhas, [4300, 5054], { header: false, va: "t", keep: linhas.length <= 24 });
          });
        }
      }
      if (a["Diagnostico Global"]) { H("Diagnóstico global", 1); P(a["Diagnostico Global"]); }
    }
    // conclusao e encerramento
    H("Conclusão", 0, { pb: true }); paras("AET Conclusao");
    H("Encerramento e validação do documento", 0); paras("AET Encerramento");
    blocos.push({ t: "fech", assinantes: op.assinantes, cliente: op.cliente, tituloCliente: `Cliente – ${op.cliente}`, codigo: op.codigo, tituloValidacao: "Validação do documento", textoValidacao: BI.LaudoPadrao.TEXTO_VALIDACAO.replace("{nomes}", op.assinantes.map((a) => a.nome).join(" e ") || "o responsável técnico").replace("{emissao}", dataBR(op.emissao)).replace("{codigo}", op.codigo).replace("{revisao}", op.revisao) });
    // certificados
    if (op.instrumentos.length) {
      H("Certificados de calibração dos instrumentos", 0, { pb: true });
      for (let i = 0; i < op.instrumentos.length; i++) {
        const c = op.instrumentos[i]; H(`${c.Nome}${c.Validade ? " (validade " + dataBR(c.Validade) + ")" : ""}`, 1);
        const arq = Array.isArray(c["Arquivo Imagem"]) ? c["Arquivo Imagem"][0] : c["Arquivo Imagem"];
        const pags = arq && arq.chave ? await BI.LaudoPadrao.paginasDoArquivo(arq.chave) : []; // V 1.35: imagem ou PDF (uma pagina cada)
        for (let k = 0; k < pags.length; k++) { const d = pags[k]; if (k > 0) blocos.push({ t: "pb" }); const im = await new Promise((ok) => { const i2 = new Image(); i2.onload = () => ok([i2.naturalWidth, i2.naturalHeight]); i2.onerror = () => ok([1000, 1414]); i2.src = d; }); const w = 480, hh = Math.min(640, w * im[1] / im[0]); blocos.push({ t: "img", d, w: hh < 640 ? w : 640 * im[0] / im[1], h: hh }); }
        if (!pags.length) P("Certificado cadastrado sem arquivo (imagem ou PDF) no Cadastro Interno › Certificado de calibração.");
      }
    }
    // metodos aplicados
    if (ferrUsadas.length) {
      H("Métodos aplicados (ferramentas ergonômicas) – descritivo", 0, { pb: true });
      ferrUsadas.forEach((f) => { H(f.nome, 1); P(f.descricao); P([{ x: "Referência: ", b: true }, { x: f.ref }], { s: 8 }); P([{ x: "Graduação no laudo: ", b: true }, { x: f.exposicao ? "a métrica considera o tempo de exposição; o resultado define o risco do fator na matriz do cliente." : "a métrica não considera o tempo de exposição; o resultado define a severidade, cruzada com a probabilidade (exposição) na matriz do cliente." }], { s: 8 }); });
    }
    return { blocos, TOC };
  }

  // ------------------------------------------------------------------ V 1.35: sub-aba AET › Laudos
  // Emissao pelo recorte em cascata (sem unidade = empresa toda; unidade; unidade + setor; ... posto) e historico
  // dos laudos da AET ja emitidos (filtro geral de Cliente).
  const hEl = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const NIVEIS_RECORTE = [["Unidade", "Unidade", "Todas as unidades (empresa toda)"], ["Setor", "Setor / GHE", "Todos os setores / GHE"], ["Cargo", "Cargo", "Todos os cargos"], ["Posto Trabalho", "Posto de trabalho", "Todos os postos"]];
  const estadoAba = { cliente: "", recorte: {}, executor: "", rt: "", certs: new Set(), msg: "", erro: false, gerando: false };
  function descreverRecorte(r) {
    const partes = NIVEIS_RECORTE.filter(([k]) => r[k]).map(([k, rot]) => `${rot}: ${r[k]}`);
    return partes.length ? partes.join(" › ") : "Empresa toda";
  }
  function podeEmitir() { const i = BI.DB && BI.DB.estado.identidade; return !(i && i.papel === "UsuarioCliente") && !(BI.DB && BI.DB.estado.somenteLeitura); }
  function arqDe(v) { return Array.isArray(v) ? v[0] : v; }
  function renderAba(el) {
    if (!el) return;
    el.innerHTML = "";
    const clientesFiltro = (BI.filtros && BI.filtros.Cliente) || [];
    const todas = BI.AET.aetsNativas();
    const clientes = Array.from(new Set(todas.map((a) => a.Cliente).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (clientesFiltro.length === 1) estadoAba.cliente = clientesFiltro[0];
    if (!clientes.includes(estadoAba.cliente)) estadoAba.cliente = clientes.length === 1 ? clientes[0] : (clientes.includes(estadoAba.cliente) ? estadoAba.cliente : "");
    // ---- emissao
    if (podeEmitir()) {
      const card = hEl("div", "cartao bloco-cadastro aet-laudo-emissao"); el.appendChild(card);
      const cab = hEl("div", "cadastro-cabecalho"); cab.appendChild(hEl("div", "cartao-titulo", "Emitir laudo da AET")); card.appendChild(cab);
      card.appendChild(hEl("p", "aet-ajuda", "Escolha o recorte: sem unidade, sai o laudo da empresa toda; só a unidade, a unidade toda; unidade e setor, todas as análises daquele setor; e assim por diante (cargo e posto). O laudo usa sempre o risco atual do Inventário de Riscos."));
      const gr = hEl("div", "aet-grade"); card.appendChild(gr);
      const sel = (rot, opcs, valor, aoMudar, larga) => { const l = hEl("label", "aet-campo" + (larga ? " aet-campo--largo" : "")); l.appendChild(hEl("span", "aet-rot", rot)); const s = hEl("select"); opcs.forEach(([v, t]) => { const o = hEl("option", null, t); o.value = v; s.appendChild(o); }); s.value = valor || ""; s.addEventListener("change", () => aoMudar(s.value)); l.appendChild(s); gr.appendChild(l); return s; };
      sel("Cliente *", [["", clientes.length ? "Escolha o cliente…" : "Nenhum cliente com AET"]].concat(clientes.map((c) => [c, c])), estadoAba.cliente, (v) => { estadoAba.cliente = v; estadoAba.recorte = {}; renderAba(el); });
      const daEmpresa = todas.filter((a) => a.Cliente === estadoAba.cliente);
      NIVEIS_RECORTE.forEach(([k, rot, todosTxt], idx) => {
        const anteriores = NIVEIS_RECORTE.slice(0, idx).map(([x]) => x);
        const base = daEmpresa.filter((a) => anteriores.every((x) => !estadoAba.recorte[x] || a[x] === estadoAba.recorte[x]));
        const valores = Array.from(new Set(base.map((a) => a[k]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
        if (estadoAba.recorte[k] && !valores.includes(estadoAba.recorte[k])) delete estadoAba.recorte[k];
        const s = sel(rot, [["", todosTxt]].concat(valores.map((v) => [v, v])), estadoAba.recorte[k] || "", (v) => { if (v) estadoAba.recorte[k] = v; else delete estadoAba.recorte[k]; NIVEIS_RECORTE.slice(idx + 1).forEach(([x]) => delete estadoAba.recorte[x]); renderAba(el); });
        s.disabled = !estadoAba.cliente;
      });
      const ergs = (BI.dados.ergonomista || []).map((e) => [e._id, e.Nome]);
      const selecionadas = daEmpresa.filter((a) => NIVEIS_RECORTE.every(([k]) => !estadoAba.recorte[k] || a[k] === estadoAba.recorte[k]));
      if (!estadoAba.executor) { const n = selecionadas.map((a) => a.Ergonomista).find(Boolean); const e = (BI.dados.ergonomista || []).find((x) => x.Nome === n); if (e) estadoAba.executor = e._id; }
      sel("Ergonomista executor", [["", "-"]].concat(ergs), estadoAba.executor, (v) => { estadoAba.executor = v; });
      sel("Responsável técnico", [["", "-"]].concat(ergs), estadoAba.rt, (v) => { estadoAba.rt = v; });
      card.appendChild(hEl("div", "aet-subtitulo", "Certificados de calibração dos instrumentos (saem no final do laudo)"));
      const certs = BI.dados.certificadoCalibracao || []; const lista = hEl("div", "ferr-multi"); card.appendChild(lista);
      if (!certs.length) lista.appendChild(hEl("span", "aet-nota", "Nenhum certificado em Cadastro Interno › Certificado Calibração."));
      certs.forEach((c) => { const l = hEl("label"); const cb = hEl("input"); cb.type = "checkbox"; cb.checked = estadoAba.certs.has(c._id); cb.addEventListener("change", () => { if (cb.checked) estadoAba.certs.add(c._id); else estadoAba.certs.delete(c._id); }); l.appendChild(cb); l.appendChild(document.createTextNode(` ${c.Nome}${c.Validade ? " (validade " + dataBR(c.Validade) + ")" : ""}`)); lista.appendChild(l); });
      const resumo = hEl("p", "aet-nota", estadoAba.cliente ? `Recorte: ${descreverRecorte(estadoAba.recorte)} · ${selecionadas.length} AET(s) · ${selecionadas.reduce((s, a) => s + (a.Atividades || []).length, 0)} atividade(s).` : "Escolha o cliente."); card.appendChild(resumo);
      const msg = hEl("div", "aet-msg" + (estadoAba.erro ? " erro" : ""), estadoAba.msg); msg.hidden = !estadoAba.msg; card.appendChild(msg);
      const barra = hEl("div", "reav-barra"); const bO = hEl("button", "btn-cad-primario", estadoAba.gerando ? "Gerando…" : "📄 Gerar laudo (PDF e Word)"); bO.type = "button"; bO.disabled = estadoAba.gerando || !selecionadas.length; barra.appendChild(bO); card.appendChild(barra);
      bO.addEventListener("click", async () => {
        if (!estadoAba.executor && !estadoAba.rt) { estadoAba.msg = "Escolha o ergonomista executor ou o responsável técnico."; estadoAba.erro = true; renderAba(el); return; }
        estadoAba.gerando = true; estadoAba.erro = false; estadoAba.msg = "Gerando o laudo… (fotos e certificados podem levar alguns segundos)"; renderAba(el);
        try {
          const r = await gerar({ cliente: estadoAba.cliente, aets: selecionadas, recorte: Object.assign({}, estadoAba.recorte), executor: (BI.dados.ergonomista || []).find((e) => e._id === estadoAba.executor), responsavel: (BI.dados.ergonomista || []).find((e) => e._id === estadoAba.rt), instrumentos: certs.filter((c) => estadoAba.certs.has(c._id)) });
          estadoAba.msg = r.registrado ? `Laudo ${r.codigo} (Rev. ${r.revisao}) gerado e registrado no histórico abaixo.${r.aviso ? " " + r.aviso : ""}` : `Laudo ${r.codigo} gerado. ${r.aviso || ""}`; estadoAba.erro = false;
        } catch (e) { console.error("laudo AET", e); estadoAba.msg = "Não foi possível gerar o laudo: " + (e && e.message ? e.message : e); estadoAba.erro = true; }
        estadoAba.gerando = false; renderAba(el);
      });
    }
    // ---- historico
    const card2 = hEl("div", "cartao bloco-cadastro"); el.appendChild(card2);
    const laudos = Calc().filtrar((BI.dados.laudo || []).filter((l) => /AET/i.test(String(l.Tipo || "") + " " + String(l.Origem || ""))), BI.filtros, ["Emitido Em"]).sort((a, b) => String(b["Emitido Em"] || "").localeCompare(String(a["Emitido Em"] || "")));
    const cab2 = hEl("div", "cadastro-cabecalho"); const t2 = hEl("div", "cartao-titulo", "Laudos da AET emitidos"); t2.appendChild(hEl("span", "contagem-tabela", ` (${laudos.length})`)); cab2.appendChild(t2); card2.appendChild(cab2);
    if (!laudos.length) { card2.appendChild(hEl("div", "plano-vazio", "Nenhum laudo da AET emitido para o filtro atual.")); return; }
    const wrap = hEl("div", "tabela-scroll"); const tb = hEl("table", "tabela-dados"); const tr0 = hEl("tr");
    ["Emitido em", "Cliente", "Abrangência", "Revisão", "Código", "Emitido por", ""].forEach((c) => tr0.appendChild(hEl("th", null, c)));
    const th = hEl("thead"); th.appendChild(tr0); tb.appendChild(th); const tbody = hEl("tbody");
    laudos.forEach((l) => {
      const tr = hEl("tr");
      [dataBR(l["Emitido Em"]), l.Cliente, l["Abrangencia Descricao"] || "Empresa toda", l.Revisao, l["Codigo Verificacao"], l["Emitido Por"]].forEach((x) => tr.appendChild(hEl("td", null, x || "-")));
      const td = hEl("td", "aet-acoes-linha");
      [["Arquivo Url", "⬇ PDF"], ["Arquivo Word", "⬇ Word"]].forEach(([campo, rot]) => { const a = arqDe(l[campo]); if (!a || !a.chave) return; const b = hEl("button", "btn-cad-secundario", rot); b.type = "button"; b.addEventListener("click", () => { const x = document.createElement("a"); x.href = BI.DB.urlArquivo(a.chave); x.download = a.nomeArquivo || ""; document.body.appendChild(x); x.click(); x.remove(); }); td.appendChild(b); });
      if (podeEmitir()) { const bx = hEl("button", "btn-excluir", "Excluir"); bx.type = "button"; bx.addEventListener("click", async () => { if (!window.confirm(`Excluir do histórico o laudo ${l["Codigo Verificacao"] || ""}? O código de validação deixa de ser reconhecido.`)) return; try { await BI.DB.excluir("laudo", l._id); if (BI.recarregar) await BI.recarregar(); renderAba(el); } catch (e) { window.alert("Não foi possível excluir: " + (e && e.message ? e.message : e)); } }); td.appendChild(bx); }
      tr.appendChild(td); tbody.appendChild(tr);
    });
    tb.appendChild(tbody); wrap.appendChild(tb); card2.appendChild(wrap);
  }

  // ------------------------------------------------------------------ V 1.35: sub-aba AET › Editor de texto
  // Mostra exatamente o texto que sai no laudo da AET (o gravado ou o padrao), com "alterado" e "Restaurar padrão".
  function renderEditorTexto(el) {
    if (!el) return;
    const LT = BI.LaudoTextos; el.innerHTML = "";
    const card = hEl("div", "cartao bloco-cadastro"); el.appendChild(card);
    const cab = hEl("div", "cadastro-cabecalho"); cab.appendChild(hEl("div", "cartao-titulo", "Editor de Texto do Laudo da AET")); card.appendChild(cab);
    card.appendChild(hEl("p", "aet-ajuda", "Cada campo mostra o texto que sai no laudo da AET. Marcadores entre chaves ({cliente}, {unidade}, {escopo}, {executor}, {matriz}...) são trocados na emissão. O texto igual ao padrão acompanha as atualizações do padrão ElevaLife."));
    const modelo = (BI.dados.modeloLaudo || [])[0] || null;
    const editar = podeEmitir();
    const campos = CAMPOS.map(([c, r]) => [c, r]);
    const els = {};
    campos.forEach(([campo, rot]) => {
      const box = hEl("div", "campo-form campo-form-largo aet-editor-campo");
      const lb = hEl("label", null, rot); const tag = hEl("span", "editor-texto-alterado", "alterado"); const bt = hEl("button", "btn-cad-secundario editor-texto-restaurar", "Restaurar padrão"); bt.type = "button";
      lb.appendChild(tag); lb.appendChild(bt); box.appendChild(lb);
      const ta = hEl("textarea"); ta.value = LT ? LT.textoEfetivo(modelo || {}, campo) : (PADRAO[campo] || ""); ta.rows = Math.min(16, Math.max(3, Math.ceil(ta.value.length / 110) + ta.value.split("\n").length)); ta.disabled = !editar;
      const pintar = () => { const alt = ta.value.trim() !== String(PADRAO[campo] || "").trim(); tag.hidden = !alt; bt.hidden = !alt || !editar; };
      bt.addEventListener("click", () => { ta.value = PADRAO[campo] || ""; pintar(); }); ta.addEventListener("input", pintar); pintar();
      box.appendChild(ta); card.appendChild(box); els[campo] = ta;
    });
    if (!editar) return;
    const msg = hEl("div", "aet-msg"); msg.hidden = true; card.appendChild(msg);
    const barra = hEl("div", "reav-barra"); const bS = hEl("button", "btn-cad-primario", "Salvar textos da AET"); bS.type = "button"; barra.appendChild(bS); card.appendChild(barra);
    bS.addEventListener("click", async () => {
      bS.disabled = true; msg.hidden = false; msg.className = "aet-msg"; msg.textContent = "Salvando…";
      try {
        const atual = (BI.dados.modeloLaudo || [])[0] || null;
        const dados = {}; if (atual) Object.keys(atual).forEach((k) => { if (k[0] !== "_" && k !== "id") dados[k] = atual[k]; });
        if (!dados.Nome) dados.Nome = "Modelo ElevaLife";
        campos.forEach(([campo]) => { const v = els[campo].value; dados[campo] = v.trim() === String(PADRAO[campo] || "").trim() ? "" : v; });
        dados.EmpresaId = dados.EmpresaId || "GLOBAL";
        await BI.DB.salvar("modeloLaudo", atual ? atual._id : null, dados, !atual);
        if (BI.recarregar) await BI.recarregar();
        msg.textContent = "Textos da AET salvos. Valem para os próximos laudos.";
      } catch (e) { msg.className = "aet-msg erro"; msg.textContent = "Não foi possível salvar: " + (e && e.message ? e.message : e); }
      bS.disabled = false;
    });
  }

  async function gerar(o) {
    const C = Calc(); const cliente = o.cliente; const mz = BI.AET.matrizDe(cliente);
    const docCliente = (BI.dados.cliente || []).find((c) => c.Cliente === cliente) || {};
    const laudos = (BI.dados.laudo || []).filter((l) => l.Cliente === cliente);
    const codigo = BI.LaudoPadrao.novoCodigo((BI.dados.laudo || []).map((l) => l["Codigo Verificacao"]), "AET");
    const revisao = String(laudos.filter((l) => /AET/i.test(l.Tipo || "")).length).padStart(2, "0");
    const emissao = new Date().toISOString().slice(0, 10); const dt = new Date();
    const fatores = BI.dados.fatorRisco || [];
    const linhaFator = (a, fa) => fatores.find((f) => f._id === "aet-" + (a._id || a.id) + "-" + fa.uid);
    const riscoPosto = (a) => fatores.filter((f) => f["AET Id"] === (a._id || a.id) && C.riscoAtivo(f)).map((f) => f["Graduacao Risco"]).filter(Boolean).sort((x, y) => C.ordemNivel(y) - C.ordemNivel(x))[0] || "";
    const usados = new Map(); o.aets.forEach((a) => (a.Atividades || []).forEach((at) => (at.fatores || []).forEach((fa) => (fa.ferramentas || []).forEach((it) => { const d = BI.Ferramentas.porId(it.id); if (d) usados.set(d.id, d); }))));
    const assinantes = []; for (const e of [o.executor, o.responsavel].filter(Boolean)) { if (assinantes.some((x) => x.nome === e.Nome)) continue; const arq = Array.isArray(e.Assinatura) ? e.Assinatura[0] : e.Assinatura; assinantes.push({ nome: e.Nome, cargo: [e.Titulo, e.Registro].filter(Boolean).join(" · "), assinatura: arq && arq.chave ? await imagem(arq.chave) : null }); }
    const unidades = Array.from(new Set(o.aets.map((a) => a.Unidade).filter(Boolean)));
    // V 1.35: recorte em cascata (Unidade > Setor > Cargo > Posto); sem recorte, a empresa toda
    const recorte = o.recorte || (o.abrangencia ? { [o.abrangencia.campo]: o.abrangencia.valor } : {});
    const abrTxt = descreverRecorte(recorte);
    const nivelAbr = ["Posto Trabalho", "Cargo", "Setor", "Unidade"].find((k) => recorte[k]);
    const ex = o.executor, rt = o.responsavel;
    const vars = {
      cliente, unidade: unidades.length === 1 ? (/^unidade\b/i.test(unidades[0]) ? unidades[0] : "Unidade " + unidades[0]) : "unidades " + unidades.join(", "),
      escopo: o.aets.length === 1 ? `o posto ${o.aets[0]["Posto Trabalho"]} (${o.aets[0].Cargo})` : `${o.aets.length} postos de trabalho analisados`,
      executor: ex ? ex.Nome : (rt ? rt.Nome : "a equipe ElevaLife"), executorDados: ex && (ex.Titulo || ex.Registro) ? `, ${[ex.Titulo, ex.Registro].filter(Boolean).join(", ")}` : "",
      responsavelTxt: rt && (!ex || rt.Nome !== ex.Nome) ? `, sob a responsabilidade técnica de ${rt.Nome}${rt.Titulo || rt.Registro ? " (" + [rt.Titulo, rt.Registro].filter(Boolean).join(", ") + ")" : ""}` : "",
      matriz: mz, mesAno: `${MESES[dt.getMonth()]} de ${dt.getFullYear()}`, totalPaginas: "{totalPaginas}",
    };
    const { blocos, TOC } = await montar({ cliente, docCliente, matriz: mz, aets: o.aets, vars, abrangenciaTxt: abrTxt, instrumentos: o.instrumentos, ferramentasUsadas: Array.from(usados.values()), linhaFator, riscoPosto, assinantes, codigo, revisao, emissao });
    const logoBranco = await dataUrl("img/logo-elevalife-branco.png"), logoCor = await dataUrl("img/logo-elevalife.png");
    const arqLogo = Array.isArray(docCliente.Logotipo) ? docCliente.Logotipo[0] : docCliente.Logotipo; const logoCli = arqLogo && arqLogo.chave ? await imagem(arqLogo.chave) : null;
    const nAt = o.aets.reduce((s, a) => s + (a.Atividades || []).length, 0);
    const nFat = o.aets.reduce((s, a) => s + (a.Atividades || []).reduce((t, at) => t + (at.fatores || []).length, 0), 0);
    const nAc = (BI.dados.planoAcao || []).filter((p) => o.aets.some((a) => fatores.some((f) => f["AET Id"] === (a._id || a.id) && f._id === p["Fator Risco Id"]))).length;
    const capa = { logoEleva: logoBranco, lema: "15 anos elevando pessoas e resultados", logoCliente: logoCli, nomeCliente: cliente, titulo: ["Análise Ergonômica", "do Trabalho"], subtitulo: "AET conforme NR-17, com ferramentas ergonômicas e matriz de risco do cliente",
      infos: [["Empresa avaliada", cliente, true], ["Unidades", unidades.join(" · ") || "-"], ["Abrangência", abrTxt], ["Data de emissão", dataBR(emissao)], ["Responsável técnico", rt ? rt.Nome : ex ? ex.Nome : "-"], ["Documento / revisão", `${codigo} · Rev. ${revisao}`]],
      numeros: [[o.aets.length, "postos analisados"], [nAt, "atividades"], [nFat, "fatores de risco"], [nAc, "ações no plano"]] };
    const cabecalho = "ElevaLife · Análise Ergonômica do Trabalho (AET)"; const rodape = `${cliente}${unidades.length ? " – " + unidades.join(" · ") : ""}`;
    const blob = BI.LaudoBlocos.renderPDF(blocos, { toc: TOC, logo: logoCor, rodape, cabecalho, codigo, revisao, capa });
    const nPag = String(blob.totalPaginas || "");
    const trocarPag = (x) => (typeof x === "string" ? x.replace(/\{totalPaginas\}/g, nPag) : Array.isArray(x) ? x.map(trocarPag) : x && typeof x === "object" && !(x instanceof Blob) && !(x instanceof ArrayBuffer) && !ArrayBuffer.isView(x) ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, trocarPag(v)])) : x);
    let blobWord = null; try { const ab = await BI.LaudoDocx.deBlocos(trocarPag(blocos), { capa, cabecalho, codigo, revisao, rodape, titulo: "Análise Ergonômica do Trabalho – " + cliente, palavras: "NR-17, AET, ergonomia" }); blobWord = ab instanceof Blob ? ab : new Blob([ab], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }); } catch (e) { console.error("Word AET", e); }
    const nomeBase = `Laudo AET - ${cliente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\\/:*?"<>|]/g, "").slice(0, 50)} - ${codigo}`;
    baixar(blob, nomeBase + ".pdf"); if (blobWord) baixar(blobWord, nomeBase + ".docx");
    // registro no historico de laudos do cliente
    let registrado = false, aviso = "";
    try {
      const emp = docCliente.id || docCliente._id; const hash = await sha256(blob);
      let arqPdf = null, arqDoc = null;
      try { arqPdf = await BI.DB.enviarArquivo("laudo", emp, new File([blob], nomeBase.replace(/[^\w .-]+/g, "_") + ".pdf", { type: "application/pdf" })); } catch (e) { aviso = "O PDF não foi anexado (" + (e && e.message ? e.message : e) + ")."; }
      if (blobWord) { try { arqDoc = await BI.DB.enviarArquivo("laudo", emp, new File([blobWord], nomeBase.replace(/[^\w .-]+/g, "_") + ".docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })); } catch (e) { /* Word opcional */ } }
      const pr = (e) => (e ? e.Registro || "" : "");
      await BI.DB.salvar("laudo", null, { EmpresaId: emp, Cliente: cliente, Tipo: "Laudo AET", Origem: "AET", Abrangencia: nivelAbr ? { "Posto Trabalho": "Posto de trabalho" }[nivelAbr] || nivelAbr : "Empresa toda", "Abrangencia Descricao": abrTxt,
        Unidade: recorte.Unidade || undefined, Setor: recorte.Setor || undefined, Cargo: recorte.Cargo || undefined, "Posto Trabalho": recorte["Posto Trabalho"] || undefined,
        "Emitido Em": emissao, "Emitido Por": ex ? ex.Nome : rt ? rt.Nome : "", "Responsavel Tecnico": rt ? rt.Nome : "", "Ergonomista Executor": ex ? ex.Nome : "", "Registro Responsavel": pr(rt), "Registro Executor": pr(ex),
        Revisao: revisao, "Codigo Verificacao": codigo, "Hash Documento": hash, "Arquivo Url": arqPdf ? { chave: arqPdf.chave, nomeArquivo: arqPdf.nomeArquivo, tamanho: arqPdf.tamanho, tipoConteudo: "application/pdf" } : null,
        "Arquivo Word": arqDoc ? { chave: arqDoc.chave, nomeArquivo: arqDoc.nomeArquivo, tamanho: arqDoc.tamanho, tipoConteudo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } : null,
        "AET Ids": o.aets.map((a) => a._id || a.id), Texto: `Laudo de AET emitido pelo S.I.G.E em ${dataBR(emissao)} (${abrTxt}).` });
      registrado = true;
      // as acoes ainda sem revisao passam a pertencer a esta revisao do laudo
      const ids = (BI.dados.planoAcao || []).filter((p) => fatores.some((f) => f._id === p["Fator Risco Id"] && o.aets.some((a) => f["AET Id"] === (a._id || a.id)))).map((p) => p._id);
      if (BI.carimbarRevisaoAcoes) await BI.carimbarRevisaoAcoes(ids, revisao);
    } catch (e) { console.error("registro laudo AET", e); aviso = "Não foi possível registrar no histórico de laudos agora."; }
    return { codigo, revisao, registrado, aviso, blob, blobWord };
  }

  BI.LaudoAET = { renderAba, renderEditorTexto, gerar, montar, PADRAO, CAMPOS };
})(window);
