/* ==========================================================================
   BI Ergonomia - ElevaLife
   CAMADA DE CALCULO (medidas / regras de negocio).
   Nao contem dados - so funcoes puras que operam sobre as 6 tabelas
   carregadas de data/mock_data.json. Trocar o mock por dados reais
   (MedSafe / Sistema de Gestao Integrada) no futuro nao exige tocar aqui,
   desde que a forma das linhas (mesmos campos/chaves) seja preservada.
   ========================================================================== */

(function (global) {
  "use strict";

  const DIMENSOES = ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade"];

  const NIVEIS_RISCO = ["Baixo", "Medio", "Alto", "Muito Alto"];
  const STATUS_ACAO_ORDEM = ["Nao Iniciado", "Em Andamento", "Atrasada", "Concluida com atraso", "Concluida"];

  // As 12 dimensoes do Mapa de Risco (conforme RD) - usadas para calcular
  // "Risco Global" automaticamente na tela de cadastro (nunca digitado a mao).
  const DIMENSOES_RISCO = [
    "Col. Cervical", "Tronco", "Ombros", "Cotovelos", "Punhos", "Maos/Dedos",
    "Joelhos", "Pernas", "Tornozelos", "Pes/Dedos", "Psicossocial/Cognitivo", "Ambiental",
  ];

  const STATUS_RESTRICAO_ORDEM = ["Ativa", "Em Avaliacao", "Encerrada"];

  const COR_STATUS = {
    "Baixo": "var(--status-good)",
    "Medio": "var(--status-warning)",
    "Alto": "var(--status-serious)",
    "Muito Alto": "var(--status-critical)",
    "Nao Iniciado": "var(--status-neutral)",
    "Em Andamento": "var(--status-warning)",
    "Atrasada": "var(--status-critical)",
    "Concluida com atraso": "var(--status-serious)",
    "Concluida": "var(--status-good)",
    "Ativa": "var(--status-warning)",
    "Em Avaliacao": "var(--status-neutral)",
    "Encerrada": "var(--status-good)",
  };

  // Resolve uma custom property CSS para hex/rgb utilizavel pelo Chart.js
  function resolverCorCSS(tokenCSS) {
    if (!tokenCSS.startsWith("var(")) return tokenCSS;
    const nomeVar = tokenCSS.slice(4, -1).trim();
    return getComputedStyle(document.documentElement).getPropertyValue(nomeVar).trim() || "#999";
  }

  function corStatus(chave) {
    return resolverCorCSS(COR_STATUS[chave] || "var(--status-neutral)");
  }

  const PALETA_CATEGORICA = [
    "var(--cat-1)", "var(--cat-2)", "var(--cat-3)",
    "var(--cat-4)", "var(--cat-5)", "var(--cat-6)",
  ].map(resolverCorCSS);

  // Atribui cor fixa por entidade (ordem alfabetica), nunca por rank/posicao
  // no grafico - filtrar nao "repinta" quem sobra.
  function construirMapaCores(listaCompleta) {
    const ordenado = Array.from(new Set(listaCompleta)).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const mapa = {};
    ordenado.forEach((nome, i) => { mapa[nome] = PALETA_CATEGORICA[i % PALETA_CATEGORICA.length]; });
    return mapa;
  }

  // ------------------------------------------------------------------
  // Status Acao - calculado em runtime (nao vem gravado no mock)
  // ------------------------------------------------------------------
  function paraData(str) {
    if (!str) return null;
    return new Date(str + "T00:00:00");
  }

  function calcularStatusAcao(dtProgramadaStr, dtConclusaoStr, hoje) {
    const prog = paraData(dtProgramadaStr);
    const concl = paraData(dtConclusaoStr);
    if (!prog && !concl) return "Nao Iniciado";
    if (!prog && concl) return "Concluida";
    if (!concl && prog < hoje) return "Atrasada";
    if (!concl && prog <= hoje) return "Em Andamento";
    if (!concl) return "Nao Iniciado"; // programada no futuro, ainda nao iniciada
    if (concl > prog) return "Concluida com atraso";
    return "Concluida";
  }

  // ------------------------------------------------------------------
  // Risco Global - calculado a partir da MEDIA das 12 dimensoes (nunca do
  // maximo), mesma regra usada na geracao dos dados ficticios.
  // ------------------------------------------------------------------
  function calcularRiscoGlobal(scores) {
    const valores = DIMENSOES_RISCO.map((d) => Number(scores[d]) || 0);
    const media = valores.reduce((a, b) => a + b, 0) / (valores.length || 1);
    if (media >= 2.7) return "Muito Alto";
    if (media >= 2.15) return "Alto";
    if (media >= 1.55) return "Medio";
    return "Baixo";
  }

  function nivelReduzido(nivel) {
    const idx = NIVEIS_RISCO.indexOf(nivel);
    if (idx <= 0) return NIVEIS_RISCO[0];
    return NIVEIS_RISCO[idx - 1];
  }

  // Busca a linha cuja chave composta (Cliente+Unidade+Setor+Posto+Cargo+
  // Atividade) bate com chaveObj - usada para "puxar" o Risco Global atual
  // do posto ao lancar um registro em Plano Acao/Absenteismo/Compativeis.
  function buscarPorChave(linhas, chaveObj) {
    return linhas.find((l) => DIMENSOES.every((d) => l[d] === chaveObj[d])) || null;
  }

  // ------------------------------------------------------------------
  // Filtros globais
  // ------------------------------------------------------------------
  function linhaPassaFiltros(linha, filtros, camposData) {
    for (const dim of DIMENSOES) {
      const v = filtros[dim];
      if (v && v !== "Todos" && dim in linha && linha[dim] !== v) return false;
    }
    const am = filtros["Ano/Mes"];
    if (am && am !== "Todos" && camposData && camposData.length) {
      const ok = camposData.some((c) => linha[c] && String(linha[c]).slice(0, 7) === am);
      if (!ok) return false;
    }
    return true;
  }

  function filtrar(linhas, filtros, camposData) {
    return linhas.filter((l) => linhaPassaFiltros(l, filtros, camposData || []));
  }

  // Opcoes de cada dropdown, em cascata: calculadas a partir do Mapa Risco
  // (tabela mestre de postos) aplicando todos os OUTROS filtros selecionados.
  function opcoesDeFiltro(mapaRisco, filtros) {
    const resultado = {};
    for (const dim of DIMENSOES) {
      const filtrosSemEssaDim = Object.assign({}, filtros, { [dim]: "Todos" });
      const linhas = filtrar(mapaRisco, filtrosSemEssaDim, []);
      const valores = Array.from(new Set(linhas.map((l) => l[dim]))).sort((a, b) => a.localeCompare(b, "pt-BR"));
      resultado[dim] = valores;
    }
    return resultado;
  }

  // ------------------------------------------------------------------
  // Indicadores - Dashboard "Ergo"
  // ------------------------------------------------------------------

  function mapaRiscoGlobal(mapaRiscoF) {
    const total = mapaRiscoF.length;
    const porNivel = {};
    NIVEIS_RISCO.forEach((n) => (porNivel[n] = 0));
    mapaRiscoF.forEach((l) => { porNivel[l["Risco Global"]] = (porNivel[l["Risco Global"]] || 0) + 1; });
    return NIVEIS_RISCO.map((n) => ({
      nivel: n,
      qtd: porNivel[n],
      pct: total ? (porNivel[n] / total) * 100 : 0,
    }));
  }

  function topSetores(mapaRiscoF, n) {
    const porSetor = {};
    mapaRiscoF.forEach((l) => {
      porSetor[l.Setor] = porSetor[l.Setor] || { setor: l.Setor, total: 0, criticos: 0 };
      porSetor[l.Setor].total += 1;
      if (l["Risco Global"] === "Alto" || l["Risco Global"] === "Muito Alto") porSetor[l.Setor].criticos += 1;
    });
    return Object.values(porSetor)
      .map((s) => ({ ...s, pct: s.total ? (s.criticos / s.total) * 100 : 0 }))
      .sort((a, b) => b.criticos - a.criticos || b.pct - a.pct)
      .slice(0, n || 3);
  }

  function statusPlanoAcao(planoAcaoF, hoje) {
    const contagem = {};
    STATUS_ACAO_ORDEM.forEach((s) => (contagem[s] = 0));
    planoAcaoF.forEach((a) => {
      const st = calcularStatusAcao(a["Dt Programada"], a["Dt Conclusao"], hoje);
      contagem[st] = (contagem[st] || 0) + 1;
    });
    return STATUS_ACAO_ORDEM.map((s) => ({ status: s, qtd: contagem[s] }));
  }

  function planoAcaoPostosCriticos(planoAcaoF, hoje) {
    const criticos = planoAcaoF.filter((a) => a["Risco Global"] === "Alto" || a["Risco Global"] === "Muito Alto");
    return statusPlanoAcao(criticos, hoje);
  }

  function planoAcaoPorResponsavel(planoAcaoF, hoje) {
    const porResp = {};
    planoAcaoF.forEach((a) => {
      const resp = a["Responsavel Acao"] || "Sem responsavel";
      const st = calcularStatusAcao(a["Dt Programada"], a["Dt Conclusao"], hoje);
      porResp[resp] = porResp[resp] || { responsavel: resp, total: 0 };
      STATUS_ACAO_ORDEM.forEach((s) => { if (!(s in porResp[resp])) porResp[resp][s] = 0; });
      porResp[resp][st] += 1;
      porResp[resp].total += 1;
    });
    return Object.values(porResp).sort((a, b) => b.total - a.total);
  }

  // Serie mensal generica com zero-fill entre o mes minimo e maximo encontrados
  function serieMensal(linhas, campoData) {
    const meses = linhas.map((l) => l[campoData]).filter(Boolean).map((d) => String(d).slice(0, 7));
    if (!meses.length) return [];
    const min = meses.reduce((a, b) => (a < b ? a : b));
    const max = meses.reduce((a, b) => (a > b ? a : b));
    const eixo = [];
    let [ay, am] = min.split("-").map(Number);
    const [by, bm] = max.split("-").map(Number);
    while (ay < by || (ay === by && am <= bm)) {
      eixo.push(`${String(ay).padStart(4, "0")}-${String(am).padStart(2, "0")}`);
      am += 1;
      if (am > 12) { am = 1; ay += 1; }
    }
    const contagem = {};
    eixo.forEach((m) => (contagem[m] = 0));
    meses.forEach((m) => { contagem[m] = (contagem[m] || 0) + 1; });
    return eixo.map((m) => ({ mes: m, qtd: contagem[m] }));
  }

  function mapaRiscoPorSetor(mapaRiscoF) {
    const setores = Array.from(new Set(mapaRiscoF.map((l) => l.Setor))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return setores.map((setor) => {
      const linha = { setor };
      NIVEIS_RISCO.forEach((n) => (linha[n] = 0));
      mapaRiscoF.filter((l) => l.Setor === setor).forEach((l) => { linha[l["Risco Global"]] += 1; });
      return linha;
    });
  }

  function statusPlanoAcaoPorSetor(planoAcaoF, hoje) {
    const setores = Array.from(new Set(planoAcaoF.map((l) => l.Setor))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return setores.map((setor) => {
      const linha = { setor };
      STATUS_ACAO_ORDEM.forEach((s) => (linha[s] = 0));
      planoAcaoF.filter((l) => l.Setor === setor).forEach((l) => {
        const st = calcularStatusAcao(l["Dt Programada"], l["Dt Conclusao"], hoje);
        linha[st] += 1;
      });
      return linha;
    });
  }

  // ------------------------------------------------------------------
  // Indicadores - Dashboard "Med Ocup"
  // Taxa de Frequencia = (nr de casos de afastamento / HHT) x 1.000.000,
  // onde HHT (Homens-Hora Trabalhados) = Qtd Colaboradores x Qtd Dias Uteis x 8h,
  // somado linha a linha de Dias Uteis (metodologia padrao de SST/CIPA - NBR 14280).
  // ------------------------------------------------------------------
  function hhtDaLinha(linha) {
    return (Number(linha["Qtd Colaboradores"]) || 0) * (Number(linha["Qtd Dias Uteis"]) || 0) * 8;
  }

  function calcularTaxaFrequencia(absenteismoF, diasUteisF) {
    const hht = diasUteisF.reduce((acc, l) => acc + hhtDaLinha(l), 0);
    return hht ? (absenteismoF.length / hht) * 1000000 : 0;
  }

  function totaisMedOcup(absenteismoF, diasUteisF) {
    const qtdColaboradores = diasUteisF.length
      ? Math.round(diasUteisF.reduce((a, l) => a + (Number(l["Qtd Colaboradores"]) || 0), 0) / diasUteisF.length)
      : 0;
    const qtdDiasPerdidos = absenteismoF.reduce((a, l) => a + (Number(l["Qtd Dias"]) || 0), 0);
    return { qtdColaboradores, qtdDiasPerdidos, taxaFrequencia: calcularTaxaFrequencia(absenteismoF, diasUteisF) };
  }

  function evolucaoTaxaFrequencia(absenteismoF, diasUteisF) {
    const meses = new Set();
    absenteismoF.forEach((l) => { if (l["Dt Afastamento"]) meses.add(String(l["Dt Afastamento"]).slice(0, 7)); });
    diasUteisF.forEach((l) => { if (l["Ano/Mes Uteis"]) meses.add(l["Ano/Mes Uteis"]); });
    return Array.from(meses).sort().map((m) => {
      const absMes = absenteismoF.filter((l) => String(l["Dt Afastamento"]).slice(0, 7) === m);
      const duMes = diasUteisF.filter((l) => l["Ano/Mes Uteis"] === m);
      return {
        mes: m,
        qtdAtestados: absMes.length,
        qtdDiasPerdidos: absMes.reduce((a, l) => a + (Number(l["Qtd Dias"]) || 0), 0),
        taxaFrequencia: calcularTaxaFrequencia(absMes, duMes),
      };
    });
  }

  function taxaFrequenciaPorSetor(absenteismoF, diasUteisF) {
    const setores = Array.from(new Set(diasUteisF.map((l) => l.Setor))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return setores.map((setor) => ({
      setor,
      taxaFrequencia: calcularTaxaFrequencia(absenteismoF.filter((l) => l.Setor === setor), diasUteisF.filter((l) => l.Setor === setor)),
    }));
  }

  // Soma "Qtd Dias" de Absenteismo por regiao corporal - usado nos diagramas
  // de Med Ocup (frente/costas). Parametrizada por lista de regioes (nunca
  // uma funcao por regiao).
  function somaDiasPorRegiao(absenteismoF, regioes) {
    const mapa = {};
    regioes.forEach((r) => (mapa[r] = 0));
    absenteismoF.forEach((l) => { if (l["Regiao Corporal"] in mapa) mapa[l["Regiao Corporal"]] += Number(l["Qtd Dias"]) || 0; });
    return mapa;
  }

  // ------------------------------------------------------------------
  // Indicadores - Dashboard "Compativeis"
  // ------------------------------------------------------------------
  function contagemPorCampo(linhas, campo) {
    const mapa = {};
    linhas.forEach((l) => { const v = l[campo] || "Nao informado"; mapa[v] = (mapa[v] || 0) + 1; });
    return mapa;
  }

  function distribuicaoIdade(compativeisF) {
    const faixas = [
      { min: 0, max: 24, label: "Ate 24" }, { min: 25, max: 34, label: "25-34" },
      { min: 35, max: 44, label: "35-44" }, { min: 45, max: 54, label: "45-54" },
      { min: 55, max: 200, label: "55+" },
    ];
    const contagem = faixas.map((f) => ({ label: f.label, qtd: 0 }));
    compativeisF.forEach((l) => {
      const idade = Number(l.Idade) || 0;
      const idx = faixas.findIndex((f) => idade >= f.min && idade <= f.max);
      if (idx >= 0) contagem[idx].qtd += 1;
    });
    return contagem;
  }

  function statusRestricaoPorSetor(compativeisF) {
    const setores = Array.from(new Set(compativeisF.map((l) => l.Setor))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return setores.map((setor) => {
      const linha = { setor };
      STATUS_RESTRICAO_ORDEM.forEach((s) => (linha[s] = 0));
      compativeisF.filter((l) => l.Setor === setor).forEach((l) => { linha[l["Status Restricao"]] = (linha[l["Status Restricao"]] || 0) + 1; });
      return linha;
    });
  }

  function statusRestricaoPorTurno(compativeisF) {
    const turnos = Array.from(new Set(compativeisF.map((l) => l["Turno Trabalho"]))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return turnos.map((turno) => {
      const linha = { turno };
      STATUS_RESTRICAO_ORDEM.forEach((s) => (linha[s] = 0));
      compativeisF.filter((l) => l["Turno Trabalho"] === turno).forEach((l) => { linha[l["Status Restricao"]] = (linha[l["Status Restricao"]] || 0) + 1; });
      return linha;
    });
  }

  function compativelPorSetor(compativeisF) {
    const compat = compativeisF.filter((l) => l["Atividade Compativel"] === "Sim");
    const setores = Array.from(new Set(compat.map((l) => l.Setor))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return setores.map((setor) => ({ setor, qtd: compat.filter((l) => l.Setor === setor).length }));
  }

  // Conta restricoes (linhas) por regiao corporal (Segmento Corporal) - mesma
  // logica dos diagramas de Med Ocup, mas contando ocorrencias, nao dias.
  function contagemPorRegiao(compativeisF, regioes) {
    const mapa = {};
    regioes.forEach((r) => (mapa[r] = 0));
    compativeisF.forEach((l) => { if (l["Segmento Corporal"] in mapa) mapa[l["Segmento Corporal"]] += 1; });
    return mapa;
  }

  // ------------------------------------------------------------------
  // Formatacao
  // ------------------------------------------------------------------
  function formatarMesLabel(am) {
    const [y, m] = am.split("-").map(Number);
    const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${nomes[m - 1]}/${String(y).slice(2)}`;
  }

  function formatarStatusLabel(s) {
    return s; // ja em portugues, mantido 1:1 com a chave usada nos calculos
  }

  global.BI = global.BI || {};
  global.BI.Calc = {
    DIMENSOES,
    DIMENSOES_RISCO,
    NIVEIS_RISCO,
    STATUS_ACAO_ORDEM,
    STATUS_RESTRICAO_ORDEM,
    resolverCorCSS,
    corStatus,
    construirMapaCores,
    calcularStatusAcao,
    calcularRiscoGlobal,
    nivelReduzido,
    buscarPorChave,
    filtrar,
    opcoesDeFiltro,
    mapaRiscoGlobal,
    topSetores,
    statusPlanoAcao,
    planoAcaoPostosCriticos,
    planoAcaoPorResponsavel,
    serieMensal,
    mapaRiscoPorSetor,
    statusPlanoAcaoPorSetor,
    calcularTaxaFrequencia,
    totaisMedOcup,
    evolucaoTaxaFrequencia,
    taxaFrequenciaPorSetor,
    somaDiasPorRegiao,
    contagemPorCampo,
    distribuicaoIdade,
    statusRestricaoPorSetor,
    statusRestricaoPorTurno,
    compativelPorSetor,
    contagemPorRegiao,
    formatarMesLabel,
    formatarStatusLabel,
  };
})(window);
