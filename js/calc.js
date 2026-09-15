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
    NIVEIS_RISCO,
    STATUS_ACAO_ORDEM,
    resolverCorCSS,
    corStatus,
    construirMapaCores,
    calcularStatusAcao,
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
    formatarMesLabel,
    formatarStatusLabel,
  };
})(window);
