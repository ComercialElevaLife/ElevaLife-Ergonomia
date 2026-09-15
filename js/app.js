/* ==========================================================================
   BI Ergonomia - ElevaLife
   CAMADA DE APRESENTACAO (filtros, graficos, tooltips, cadastros reais).
   Le window.BI.dados (mock estatico + colecoes do banco via js/db.js) e usa
   as funcoes puras de window.BI.Calc (js/calc.js) - nunca acessa o mock
   diretamente dentro das funcoes de calculo.
   ========================================================================== */

(function () {
  "use strict";

  const ORDEM_FILTROS = ["Ano/Mes", "Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade"];
  const LABELS_FILTRO = {
    "Ano/Mes": "Ano/Mes", "Cliente": "Cliente", "Unidade": "Unidade", "Setor": "Setor",
    "Posto Trabalho": "Posto de Trabalho", "Cargo": "Cargo", "Atividade": "Atividade",
  };

  const registroGraficos = {};

  // ------------------------------------------------------------------
  // Listas fixas / enums (mesmo pool usado na geracao dos dados ficticios,
  // mantido aqui so para as telas de cadastro - nao e regra de calculo)
  // ------------------------------------------------------------------
  const SETORES_POOL = ["Producao", "Manutencao", "Logistica/Expedicao", "Qualidade", "Almoxarifado", "Administrativo"];
  const SIM_NAO = ["Sim", "Nao"];
  const TURNOS_POOL = ["1o Turno", "2o Turno", "3o Turno"];
  const STATUS_RESTRICAO_POOL = ["Ativa", "Em Avaliacao", "Encerrada"];
  const CATEGORIAS_ACAO_POOL = ["Administrativa", "Engenharia", "Treinamento", "EPI"];
  const GESTAO_ACAO_POOL = ["ElevaLife", "Cliente"];
  const GENEROS_POOL = ["Masculino", "Feminino"];
  const ACOES_CATEGORIA_MAP = {
    "Rodizio de atividades entre colaboradores": "Administrativa",
    "Pausa ergonomica programada": "Administrativa",
    "Ajuste de altura de bancada/posto": "Engenharia",
    "Treinamento em postura e manuseio de cargas": "Treinamento",
    "Fornecimento de apoio ergonomico (EPI/acessorio)": "EPI",
    "Redesenho de layout do posto de trabalho": "Engenharia",
    "Aquisicao de equipamento auxiliar de movimentacao": "Engenharia",
    "Revisao de metas de producao/ritmo de trabalho": "Administrativa",
  };

  // Tabelas de referencia (estaticas, so consulta) - Lista CID e Dias Uteis
  const TABELAS_REFERENCIA = [
    { chave: "listaCID", titulo: "Lista CID", camposData: [] },
    { chave: "diasUteis", titulo: "Dias Uteis", camposData: ["Ano/Mes Uteis"] },
  ];
  const estadoTabelasRef = {};

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

  function hojeMeiaNoite() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatarDataBR(iso) {
    if (!iso) return "-";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function hexParaRgba(hex, alpha) {
    if (!hex) return `rgba(150,150,150,${alpha})`;
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function corSurfaceCard() { return window.BI.Calc.resolverCorCSS("var(--card)"); }
  function corGrid() { return window.BI.Calc.resolverCorCSS("var(--grid)"); }
  function corTextoSecundario() { return window.BI.Calc.resolverCorCSS("var(--texto-secundario)"); }

  // ------------------------------------------------------------------
  // Tooltip customizado (unico, reaproveitado por todos os graficos)
  // ------------------------------------------------------------------
  function tooltipExterno(context) {
    const { chart, tooltip } = context;
    const el = document.getElementById("tooltip-flutuante");
    if (tooltip.opacity === 0) { el.style.display = "none"; return; }

    el.innerHTML = "";
    if (tooltip.title && tooltip.title.length) {
      const t = document.createElement("div");
      t.className = "tt-titulo";
      t.textContent = tooltip.title.join(" ");
      el.appendChild(t);
    }
    (tooltip.dataPoints || []).forEach((dp) => {
      const linha = document.createElement("div");
      linha.className = "tt-linha";

      const chave = document.createElement("span");
      chave.className = "tt-chave";
      const bg = dp.dataset ? dp.dataset.backgroundColor : null;
      const corChave = Array.isArray(bg) ? bg[dp.dataIndex] : (bg || (dp.dataset && dp.dataset.borderColor) || "#999");
      chave.style.background = corChave;

      const nomeSerie = dp.dataset && dp.dataset.label ? dp.dataset.label : (dp.label || "");
      const rotulo = document.createElement("span");
      rotulo.textContent = nomeSerie;

      const valor = document.createElement("span");
      valor.className = "tt-valor";
      valor.textContent = dp.formattedValue;

      linha.appendChild(chave);
      linha.appendChild(rotulo);
      linha.appendChild(valor);
      el.appendChild(linha);
    });

    const rect = chart.canvas.getBoundingClientRect();
    el.style.display = "block";
    let left = rect.left + window.scrollX + tooltip.caretX;
    left = Math.min(Math.max(left, 120), window.innerWidth - 120);
    el.style.left = left + "px";
    el.style.top = rect.top + window.scrollY + tooltip.caretY + "px";
  }

  function configurarChartDefaults() {
    Chart.defaults.font.family = "'Montserrat', system-ui, -apple-system, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = corTextoSecundario();
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.enabled = false;
    Chart.defaults.plugins.tooltip.external = tooltipExterno;
    Chart.defaults.interaction.mode = "index";
    Chart.defaults.interaction.intersect = false;
  }

  function criarOuAtualizarGrafico(id, config) {
    if (registroGraficos[id]) registroGraficos[id].destroy();
    const canvas = document.getElementById(id);
    registroGraficos[id] = new Chart(canvas.getContext("2d"), config);
  }

  function opcoesBarraHorizontalEmpilhada() {
    return {
      indexAxis: "y",
      scales: {
        x: { stacked: true, beginAtZero: true, grid: { color: corGrid(), drawTicks: false }, border: { display: false }, ticks: { precision: 0 } },
        y: { stacked: true, grid: { display: false }, border: { display: false } },
      },
    };
  }

  // ------------------------------------------------------------------
  // Legendas customizadas (HTML) - substituem a legenda nativa do Chart.js
  // ------------------------------------------------------------------
  function renderizarLegenda(containerId, itens) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = "";
    itens.forEach((it) => {
      const item = document.createElement("div");
      item.className = "item";
      const marca = document.createElement("span");
      marca.className = it.tipo === "linha" ? "marca-linha" : "marca-cor";
      marca.style.background = it.cor;
      const texto = document.createElement("span");
      texto.textContent = it.label;
      item.appendChild(marca);
      item.appendChild(texto);
      el.appendChild(item);
    });
  }

  // ------------------------------------------------------------------
  // Filtros globais (UI)
  // ------------------------------------------------------------------
  function montarBarraFiltros() {
    const container = document.getElementById("barra-filtros");
    container.innerHTML = "";
    ORDEM_FILTROS.forEach((campo) => {
      const div = document.createElement("div");
      div.className = "campo-filtro";
      const label = document.createElement("label");
      label.textContent = LABELS_FILTRO[campo];
      label.setAttribute("for", "filtro-" + slug(campo));
      const select = document.createElement("select");
      select.id = "filtro-" + slug(campo);
      select.dataset.campo = campo;
      select.addEventListener("change", aoMudarFiltro);
      div.appendChild(label);
      div.appendChild(select);
      container.appendChild(div);
    });

    const btnLimpar = document.createElement("button");
    btnLimpar.type = "button";
    btnLimpar.className = "btn-limpar-filtros";
    btnLimpar.textContent = "Limpar filtros";
    btnLimpar.addEventListener("click", limparFiltros);
    container.appendChild(btnLimpar);

    const chip = document.createElement("div");
    chip.className = "chip-contagem";
    chip.id = "chip-contagem-postos";
    container.appendChild(chip);
  }

  function atualizarOpcoesFiltros() {
    const opcoes = window.BI.Calc.opcoesDeFiltro(window.BI.dados.mapaRisco, window.BI.filtros);
    ORDEM_FILTROS.forEach((campo) => {
      const select = document.getElementById("filtro-" + slug(campo));
      let lista;
      if (campo === "Ano/Mes") {
        lista = window.BI.dados._meta.meses.slice();
      } else {
        lista = opcoes[campo];
      }
      if (window.BI.filtros[campo] !== "Todos" && !lista.includes(window.BI.filtros[campo])) {
        window.BI.filtros[campo] = "Todos";
      }
      select.innerHTML = "";
      const optTodos = document.createElement("option");
      optTodos.value = "Todos";
      optTodos.textContent = "Todos";
      select.appendChild(optTodos);
      lista.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = campo === "Ano/Mes" ? window.BI.Calc.formatarMesLabel(v) : v;
        select.appendChild(opt);
      });
      select.value = window.BI.filtros[campo];
    });
  }

  function aoMudarFiltro(ev) {
    const campo = ev.target.dataset.campo;
    window.BI.filtros[campo] = ev.target.value;
    atualizarOpcoesFiltros();
    renderizarTudo();
  }

  function limparFiltros() {
    ORDEM_FILTROS.forEach((c) => { window.BI.filtros[c] = "Todos"; });
    atualizarOpcoesFiltros();
    renderizarTudo();
  }

  // ------------------------------------------------------------------
  // Renderizadores - Dashboard "Ergo"
  // ------------------------------------------------------------------

  function renderTilesRiscoGlobal(niveis) {
    const cont = document.getElementById("tiles-risco-global");
    cont.innerHTML = "";
    niveis.forEach((n) => {
      const cor = window.BI.Calc.corStatus(n.nivel);
      const tile = document.createElement("div");
      tile.className = "tile-status";
      tile.style.borderLeftColor = cor;

      const rotulo = document.createElement("div");
      rotulo.className = "rotulo";
      const ponto = document.createElement("span");
      ponto.className = "ponto";
      ponto.style.background = cor;
      rotulo.appendChild(ponto);
      rotulo.appendChild(document.createTextNode(window.BI.Calc.rotuloNivel(n.nivel)));

      const valor = document.createElement("div");
      valor.className = "valor";
      valor.textContent = String(n.qtd);

      const pct = document.createElement("div");
      pct.className = "pct";
      pct.textContent = n.pct.toFixed(1) + "% dos postos";

      tile.appendChild(rotulo);
      tile.appendChild(valor);
      tile.appendChild(pct);
      cont.appendChild(tile);
    });
  }

  function renderTopSetores(lista) {
    const mapaCores = window.BI.Calc.construirMapaCores(window.BI.dados.mapaRisco.map((l) => l.Setor));
    const labels = lista.map((s) => s.setor);
    const valores = lista.map((s) => Number(s.pct.toFixed(1)));
    criarOuAtualizarGrafico("chart-top-setores", {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: valores,
          backgroundColor: labels.map((l) => mapaCores[l]),
          maxBarThickness: 26, borderRadius: 4, borderSkipped: false,
        }],
      },
      options: {
        indexAxis: "y",
        scales: {
          x: { beginAtZero: true, max: 100, grid: { color: corGrid() }, border: { display: false }, ticks: { callback: (v) => v + "%" } },
          y: { grid: { display: false }, border: { display: false } },
        },
      },
    });
  }

  function renderDonutStatus(canvasId, legendaId, dadosStatus) {
    const labels = dadosStatus.map((d) => d.status);
    const valores = dadosStatus.map((d) => d.qtd);
    const cores = labels.map((s) => window.BI.Calc.corStatus(s));
    criarOuAtualizarGrafico(canvasId, {
      type: "doughnut",
      data: { labels, datasets: [{ data: valores, backgroundColor: cores, borderColor: corSurfaceCard(), borderWidth: 2 }] },
      options: {
        cutout: "62%",
        interaction: { mode: "nearest", intersect: true },
        plugins: { tooltip: { enabled: false, external: tooltipExterno } },
      },
    });
    const total = valores.reduce((a, b) => a + b, 0);
    renderizarLegenda(legendaId, labels.map((l, i) => ({ label: `${l} (${valores[i]}${total ? ", " + ((valores[i] / total) * 100).toFixed(0) + "%" : ""})`, cor: cores[i] })));
  }

  function renderLinhaMensal(canvasId, serie, nomeSerie, cor) {
    const labels = serie.map((s) => window.BI.Calc.formatarMesLabel(s.mes));
    const valores = serie.map((s) => s.qtd);
    criarOuAtualizarGrafico(canvasId, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: nomeSerie, data: valores,
          borderColor: cor, backgroundColor: hexParaRgba(cor, 0.12), fill: true,
          borderWidth: 2, tension: 0.25,
          pointRadius: 3, pointHoverRadius: 5,
          pointBackgroundColor: cor, pointBorderColor: corSurfaceCard(), pointBorderWidth: 2,
        }],
      },
      options: {
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, grid: { color: corGrid() }, border: { display: false }, ticks: { precision: 0 } },
        },
      },
    });
  }

  function renderPorResponsavel(linhas) {
    const labels = linhas.map((l) => l.responsavel);
    const datasets = window.BI.Calc.STATUS_ACAO_ORDEM.map((status) => ({
      label: status,
      data: linhas.map((l) => l[status] || 0),
      backgroundColor: window.BI.Calc.corStatus(status),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 20, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-por-responsavel", { type: "bar", data: { labels, datasets }, options: opcoesBarraHorizontalEmpilhada() });
    renderizarLegenda("legenda-por-responsavel", window.BI.Calc.STATUS_ACAO_ORDEM.map((s) => ({ label: s, cor: window.BI.Calc.corStatus(s) })));
  }

  function renderStatusPorSetor(linhas) {
    const labels = linhas.map((l) => l.setor);
    const datasets = window.BI.Calc.STATUS_ACAO_ORDEM.map((status) => ({
      label: status,
      data: linhas.map((l) => l[status] || 0),
      backgroundColor: window.BI.Calc.corStatus(status),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 20, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-status-por-setor", { type: "bar", data: { labels, datasets }, options: opcoesBarraHorizontalEmpilhada() });
    renderizarLegenda("legenda-status-por-setor", window.BI.Calc.STATUS_ACAO_ORDEM.map((s) => ({ label: s, cor: window.BI.Calc.corStatus(s) })));
  }

  function renderRiscoPorSetor(linhas) {
    const labels = linhas.map((l) => l.setor);
    const datasets = window.BI.Calc.NIVEIS_RISCO.map((nivel) => ({
      label: window.BI.Calc.rotuloNivel(nivel),
      data: linhas.map((l) => l[nivel] || 0),
      backgroundColor: window.BI.Calc.corStatus(nivel),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 22, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-risco-por-setor", { type: "bar", data: { labels, datasets }, options: opcoesBarraHorizontalEmpilhada() });
    renderizarLegenda("legenda-risco-por-setor", window.BI.Calc.NIVEIS_RISCO.map((n) => ({ label: window.BI.Calc.rotuloNivel(n), cor: window.BI.Calc.corStatus(n) })));
  }

  // ------------------------------------------------------------------
  // Renderizadores - Dashboard "Med Ocup"
  // ------------------------------------------------------------------

  function renderTotaisMedOcup(totais) {
    const cont = document.getElementById("tiles-totais-medocup");
    if (!cont) return;
    cont.innerHTML = "";
    const itens = [
      { rotulo: "Qtd Colaboradores", valor: String(totais.qtdColaboradores), sub: "media do periodo filtrado" },
      { rotulo: "Qtd Dias Perdidos", valor: String(totais.qtdDiasPerdidos), sub: "soma de dias de afastamento" },
      { rotulo: "Taxa de Frequencia", valor: totais.taxaFrequencia.toFixed(2), sub: "casos por milhao de HHT (NBR 14280)" },
    ];
    itens.forEach((it) => {
      const tile = document.createElement("div");
      tile.className = "tile-total";
      const rotulo = document.createElement("div");
      rotulo.className = "rotulo";
      rotulo.textContent = it.rotulo;
      const valor = document.createElement("div");
      valor.className = "valor";
      valor.textContent = it.valor;
      const sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = it.sub;
      tile.appendChild(rotulo);
      tile.appendChild(valor);
      tile.appendChild(sub);
      cont.appendChild(tile);
    });
  }

  // Linha "Taxa de Frequencia" visivel + 2 series auxiliares invisiveis
  // (eixo proprio, sem exibicao) so para aparecerem no tooltip ao passar o
  // mouse, conforme pedido no RD ("tooltip mostrando Evolucao de Atestados e
  // Evolucao de Dias Perdidos").
  function renderEvolucaoTaxa(serie) {
    const labels = serie.map((s) => window.BI.Calc.formatarMesLabel(s.mes));
    const corTaxa = window.BI.Calc.resolverCorCSS("var(--teal)");
    const corAtestados = window.BI.Calc.resolverCorCSS("var(--cat-2)");
    const corDiasPerdidos = window.BI.Calc.resolverCorCSS("var(--cat-1)");
    criarOuAtualizarGrafico("chart-evolucao-taxa", {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Taxa de Frequencia", data: serie.map((s) => Number(s.taxaFrequencia.toFixed(2))),
            yAxisID: "y", borderColor: corTaxa, backgroundColor: hexParaRgba(corTaxa, 0.12),
            fill: true, borderWidth: 2, tension: 0.25,
            pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: corTaxa, pointBorderColor: corSurfaceCard(), pointBorderWidth: 2,
          },
          {
            label: "Evolucao de Atestados", data: serie.map((s) => s.qtdAtestados),
            yAxisID: "y1", borderColor: corAtestados, backgroundColor: corAtestados,
            borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, fill: false,
          },
          {
            label: "Evolucao de Dias Perdidos", data: serie.map((s) => s.qtdDiasPerdidos),
            yAxisID: "y1", borderColor: corDiasPerdidos, backgroundColor: corDiasPerdidos,
            borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, fill: false,
          },
        ],
      },
      options: {
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, grid: { color: corGrid() }, border: { display: false } },
          y1: { display: false, beginAtZero: true },
        },
      },
    });
  }

  function renderTaxaPorSetor(lista) {
    const mapaCores = window.BI.Calc.construirMapaCores(lista.map((s) => s.setor));
    const labels = lista.map((s) => s.setor);
    const valores = lista.map((s) => Number(s.taxaFrequencia.toFixed(2)));
    criarOuAtualizarGrafico("chart-taxa-por-setor", {
      type: "bar",
      data: {
        labels,
        datasets: [{ data: valores, backgroundColor: labels.map((l) => mapaCores[l]), maxBarThickness: 26, borderRadius: 4, borderSkipped: false }],
      },
      options: {
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, grid: { color: corGrid() }, border: { display: false } },
        },
      },
    });
  }

  function renderDiagramasMedOcup(absenteismoF) {
    const meta = window.BI.dados._meta;
    window.BI.Diagramas.renderizar(
      "diagrama-medocup-frente", "frente",
      window.BI.Calc.somaDiasPorRegiao(absenteismoF, meta.regioes_frente),
      { formatarValor: (v) => `${v} dia${v === 1 ? "" : "s"}`, titulo: "Dias perdidos por regiao - vista frontal" }
    );
    window.BI.Diagramas.renderizar(
      "diagrama-medocup-costas", "costas",
      window.BI.Calc.somaDiasPorRegiao(absenteismoF, meta.regioes_tras),
      { formatarValor: (v) => `${v} dia${v === 1 ? "" : "s"}`, titulo: "Dias perdidos por regiao - vista posterior" }
    );
  }

  // ------------------------------------------------------------------
  // Filtros de pagina (so na aba "Compativeis") - Status Restricao e
  // Turno Trabalho, conforme RD. Independentes dos filtros globais do
  // topo; aplicados so aos 8 indicadores desta aba.
  // ------------------------------------------------------------------
  function montarFiltrosPagina() {
    const container = document.getElementById("barra-filtros-compativeis");
    if (!container) return;
    container.innerHTML = "";
    const campos = [
      { campo: "Status Restricao", opcoes: STATUS_RESTRICAO_POOL },
      { campo: "Turno Trabalho", opcoes: TURNOS_POOL },
    ];
    campos.forEach((cfg) => {
      const div = document.createElement("div");
      div.className = "campo-filtro";
      const label = document.createElement("label");
      label.textContent = cfg.campo;
      label.setAttribute("for", "filtro-pagina-" + slug(cfg.campo));
      const select = document.createElement("select");
      select.id = "filtro-pagina-" + slug(cfg.campo);
      select.dataset.campo = cfg.campo;
      select.addEventListener("change", aoMudarFiltroPagina);
      const optTodos = document.createElement("option");
      optTodos.value = "Todos";
      optTodos.textContent = "Todos";
      select.appendChild(optTodos);
      cfg.opcoes.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
      });
      select.value = window.BI.filtrosPagina[cfg.campo];
      div.appendChild(label);
      div.appendChild(select);
      container.appendChild(div);
    });

    const btnLimpar = document.createElement("button");
    btnLimpar.type = "button";
    btnLimpar.className = "btn-limpar-filtros";
    btnLimpar.textContent = "Limpar filtros da pagina";
    btnLimpar.addEventListener("click", limparFiltrosPagina);
    container.appendChild(btnLimpar);
  }

  function aoMudarFiltroPagina(ev) {
    window.BI.filtrosPagina[ev.target.dataset.campo] = ev.target.value;
    renderizarTudo();
  }

  function limparFiltrosPagina() {
    window.BI.filtrosPagina["Status Restricao"] = "Todos";
    window.BI.filtrosPagina["Turno Trabalho"] = "Todos";
    montarFiltrosPagina();
    renderizarTudo();
  }

  function aplicarFiltrosPagina(linhas) {
    const fp = window.BI.filtrosPagina;
    return linhas.filter((l) =>
      (fp["Status Restricao"] === "Todos" || l["Status Restricao"] === fp["Status Restricao"]) &&
      (fp["Turno Trabalho"] === "Todos" || l["Turno Trabalho"] === fp["Turno Trabalho"])
    );
  }

  // Converte um mapa {chave: qtd} (saida de Calc.contagemPorCampo) numa lista
  // ordenada - usa a ordem preferida (enum fixo) quando informada, senao
  // ordem alfabetica; chaves novas fora do enum aparecem no final.
  function contagemOrdenada(mapa, ordemPreferida) {
    const chaves = ordemPreferida
      ? ordemPreferida.filter((k) => k in mapa).concat(Object.keys(mapa).filter((k) => !ordemPreferida.includes(k)))
      : Object.keys(mapa).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return chaves.map((k) => ({ chave: k, qtd: mapa[k] }));
  }

  // ------------------------------------------------------------------
  // Renderizadores - Dashboard "Compativeis"
  // ------------------------------------------------------------------
  function renderDonutGenerico(canvasId, legendaId, labels, valores, cores) {
    criarOuAtualizarGrafico(canvasId, {
      type: "doughnut",
      data: { labels, datasets: [{ data: valores, backgroundColor: cores, borderColor: corSurfaceCard(), borderWidth: 2 }] },
      options: {
        cutout: "62%",
        interaction: { mode: "nearest", intersect: true },
        plugins: { tooltip: { enabled: false, external: tooltipExterno } },
      },
    });
    const total = valores.reduce((a, b) => a + b, 0);
    renderizarLegenda(legendaId, labels.map((l, i) => ({ label: `${l} (${valores[i]}${total ? ", " + ((valores[i] / total) * 100).toFixed(0) + "%" : ""})`, cor: cores[i] })));
  }

  function renderCompatGenero(compativeisF) {
    const itens = contagemOrdenada(window.BI.Calc.contagemPorCampo(compativeisF, "Genero"), GENEROS_POOL);
    const labels = itens.map((i) => i.chave);
    const valores = itens.map((i) => i.qtd);
    const mapaCores = window.BI.Calc.construirMapaCores(labels);
    renderDonutGenerico("chart-compat-genero", "legenda-compat-genero", labels, valores, labels.map((l) => mapaCores[l]));
  }

  function renderCompatIdade(distribuicao) {
    const labels = distribuicao.map((d) => d.label);
    const valores = distribuicao.map((d) => d.qtd);
    criarOuAtualizarGrafico("chart-compat-idade", {
      type: "bar",
      data: { labels, datasets: [{ data: valores, backgroundColor: window.BI.Calc.resolverCorCSS("var(--teal)"), maxBarThickness: 40, borderRadius: 4, borderSkipped: false }] },
      options: {
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, grid: { color: corGrid() }, border: { display: false }, ticks: { precision: 0 } },
        },
      },
    });
  }

  function renderCompatAtividade(compativeisF) {
    const itens = contagemOrdenada(window.BI.Calc.contagemPorCampo(compativeisF, "Atividade Compativel"), SIM_NAO);
    const labels = itens.map((i) => i.chave);
    const valores = itens.map((i) => i.qtd);
    const cores = labels.map((l) => window.BI.Calc.resolverCorCSS(l === "Sim" ? "var(--status-good)" : "var(--status-critical)"));
    renderDonutGenerico("chart-compat-atividade", "legenda-compat-atividade", labels, valores, cores);
  }

  function renderCompatStatusPorSetor(linhas) {
    const labels = linhas.map((l) => l.setor);
    const datasets = window.BI.Calc.STATUS_RESTRICAO_ORDEM.map((status) => ({
      label: status,
      data: linhas.map((l) => l[status] || 0),
      backgroundColor: window.BI.Calc.corStatus(status),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 20, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-compat-status-setor", { type: "bar", data: { labels, datasets }, options: opcoesBarraHorizontalEmpilhada() });
    renderizarLegenda("legenda-compat-status-setor", window.BI.Calc.STATUS_RESTRICAO_ORDEM.map((s) => ({ label: s, cor: window.BI.Calc.corStatus(s) })));
  }

  function renderCompatRestricaoPorTurno(linhas) {
    const labels = linhas.map((l) => l.turno);
    const datasets = window.BI.Calc.STATUS_RESTRICAO_ORDEM.map((status) => ({
      label: status,
      data: linhas.map((l) => l[status] || 0),
      backgroundColor: window.BI.Calc.corStatus(status),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 20, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-compat-restricao-turno", { type: "bar", data: { labels, datasets }, options: opcoesBarraHorizontalEmpilhada() });
    renderizarLegenda("legenda-compat-restricao-turno", window.BI.Calc.STATUS_RESTRICAO_ORDEM.map((s) => ({ label: s, cor: window.BI.Calc.corStatus(s) })));
  }

  function renderCompatCompativelPorSetor(lista) {
    const mapaCores = window.BI.Calc.construirMapaCores(lista.map((s) => s.setor));
    const labels = lista.map((s) => s.setor);
    const valores = lista.map((s) => s.qtd);
    criarOuAtualizarGrafico("chart-compat-compativel-setor", {
      type: "bar",
      data: { labels, datasets: [{ data: valores, backgroundColor: labels.map((l) => mapaCores[l]), maxBarThickness: 26, borderRadius: 4, borderSkipped: false }] },
      options: {
        indexAxis: "y",
        scales: {
          x: { beginAtZero: true, grid: { color: corGrid() }, border: { display: false }, ticks: { precision: 0 } },
          y: { grid: { display: false }, border: { display: false } },
        },
      },
    });
  }

  function renderDiagramasCompativeis(compativeisF) {
    const meta = window.BI.dados._meta;
    window.BI.Diagramas.renderizar(
      "diagrama-compat-frente", "frente",
      window.BI.Calc.contagemPorRegiao(compativeisF, meta.regioes_frente),
      { formatarValor: (v) => `${v} restr.`, titulo: "Restricoes por regiao - vista frontal" }
    );
    window.BI.Diagramas.renderizar(
      "diagrama-compat-costas", "costas",
      window.BI.Calc.contagemPorRegiao(compativeisF, meta.regioes_tras),
      { formatarValor: (v) => `${v} restr.`, titulo: "Restricoes por regiao - vista posterior" }
    );
  }

  // ------------------------------------------------------------------
  // Aba "Referencia" - Lista CID + Dias Uteis (estaticas, so consulta,
  // escondidas atras do link no rodape - nunca um botao de navegacao)
  // ------------------------------------------------------------------
  function montarAbaReferencia() {
    const grade = document.getElementById("grade-referencia");
    grade.innerHTML = "";
    TABELAS_REFERENCIA.forEach((cfg) => {
      estadoTabelasRef[cfg.chave] = estadoTabelasRef[cfg.chave] || { busca: "", ordCampo: null, ordDir: 1, pagina: 1 };

      const cartao = document.createElement("div");
      cartao.className = "cartao col-12 bloco-tabela";

      const titulo = document.createElement("div");
      titulo.className = "cartao-titulo";
      titulo.appendChild(document.createTextNode(cfg.titulo + " "));
      const contagem = document.createElement("span");
      contagem.className = "contagem-tabela";
      contagem.id = "contagem-ref-" + cfg.chave;
      titulo.appendChild(contagem);

      const controles = document.createElement("div");
      controles.className = "tabela-controles";
      const busca = document.createElement("input");
      busca.type = "search";
      busca.placeholder = "Buscar em " + cfg.titulo + "...";
      busca.addEventListener("input", (ev) => {
        estadoTabelasRef[cfg.chave].busca = ev.target.value;
        estadoTabelasRef[cfg.chave].pagina = 1;
        renderizarTabelaReferencia(cfg);
      });
      controles.appendChild(busca);

      const scroll = document.createElement("div");
      scroll.className = "tabela-scroll";
      const tabela = document.createElement("table");
      tabela.className = "tabela-dados";
      tabela.id = "tabela-ref-" + cfg.chave;
      tabela.appendChild(document.createElement("thead"));
      tabela.appendChild(document.createElement("tbody"));
      scroll.appendChild(tabela);

      const paginacao = document.createElement("div");
      paginacao.className = "tabela-paginacao";
      paginacao.id = "paginacao-ref-" + cfg.chave;

      cartao.appendChild(titulo);
      cartao.appendChild(controles);
      cartao.appendChild(scroll);
      cartao.appendChild(paginacao);
      grade.appendChild(cartao);
    });
  }

  function renderizarTabelaReferencia(cfg) {
    const Calc = window.BI.Calc;
    const estado = estadoTabelasRef[cfg.chave];
    const linhasBrutas = window.BI.dados[cfg.chave] || [];

    let linhas = Calc.filtrar(linhasBrutas, window.BI.filtros, cfg.camposData);
    const totalFiltrado = linhas.length;

    if (estado.busca) {
      const termo = estado.busca.toLowerCase();
      linhas = linhas.filter((l) => Object.values(l).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(termo)));
    }

    const colunas = linhasBrutas.length ? Object.keys(linhasBrutas[0]) : [];

    if (estado.ordCampo) {
      const campo = estado.ordCampo, dir = estado.ordDir;
      linhas = linhas.slice().sort((a, b) => {
        const va = a[campo], vb = b[campo];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va).localeCompare(String(vb), "pt-BR") * dir;
      });
    }

    const porPagina = 12;
    const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
    if (estado.pagina > totalPaginas) estado.pagina = totalPaginas;
    const inicio = (estado.pagina - 1) * porPagina;
    const paginaAtual = linhas.slice(inicio, inicio + porPagina);

    const tabela = document.getElementById("tabela-ref-" + cfg.chave);
    if (!tabela) return;

    const thead = tabela.querySelector("thead");
    thead.innerHTML = "";
    const trHead = document.createElement("tr");
    colunas.forEach((col) => {
      const th = document.createElement("th");
      th.appendChild(document.createTextNode(col));
      if (estado.ordCampo === col) {
        const seta = document.createElement("span");
        seta.className = "seta";
        seta.textContent = estado.ordDir === 1 ? "▲" : "▼";
        th.appendChild(seta);
      }
      th.addEventListener("click", () => {
        if (estado.ordCampo === col) estado.ordDir *= -1;
        else { estado.ordCampo = col; estado.ordDir = 1; }
        renderizarTabelaReferencia(cfg);
      });
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    const tbody = tabela.querySelector("tbody");
    tbody.innerHTML = "";
    if (!paginaAtual.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = colunas.length || 1;
      td.className = "sem-dados";
      td.textContent = "Nenhuma linha para os filtros/busca atuais.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      paginaAtual.forEach((linha) => {
        const tr = document.createElement("tr");
        colunas.forEach((col) => {
          const td = document.createElement("td");
          const v = linha[col];
          td.textContent = v === null || v === undefined || v === "" ? "-" : String(v);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    const contagemEl = document.getElementById("contagem-ref-" + cfg.chave);
    if (contagemEl) {
      const sufixoFiltro = totalFiltrado !== linhasBrutas.length ? ` (filtros: ${totalFiltrado} de ${linhasBrutas.length})` : ` (${linhasBrutas.length})`;
      contagemEl.textContent = sufixoFiltro;
    }

    const pagCont = document.getElementById("paginacao-ref-" + cfg.chave);
    pagCont.innerHTML = "";
    const info = document.createElement("span");
    info.textContent = linhas.length ? `Mostrando ${inicio + 1}-${Math.min(inicio + porPagina, linhas.length)} de ${linhas.length}` : "Sem resultados";
    const btnAnt = document.createElement("button");
    btnAnt.type = "button"; btnAnt.textContent = "< Anterior"; btnAnt.disabled = estado.pagina <= 1;
    btnAnt.addEventListener("click", () => { estado.pagina -= 1; renderizarTabelaReferencia(cfg); });
    const btnProx = document.createElement("button");
    btnProx.type = "button"; btnProx.textContent = "Proxima >"; btnProx.disabled = estado.pagina >= totalPaginas;
    btnProx.addEventListener("click", () => { estado.pagina += 1; renderizarTabelaReferencia(cfg); });
    pagCont.appendChild(info);
    pagCont.appendChild(btnAnt);
    pagCont.appendChild(btnProx);
  }

  function renderizarAbaReferencia() {
    TABELAS_REFERENCIA.forEach(renderizarTabelaReferencia);
  }

  // ------------------------------------------------------------------
  // Aba "Cadastros" - CRUD real (grava no banco do artifact via js/db.js)
  // ------------------------------------------------------------------
  function camposChave() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "texto", obrigatorio: true, sugestoesDe: "Cliente" },
      { campo: "Unidade", rotulo: "Unidade", tipo: "texto", obrigatorio: true, sugestoesDe: "Unidade" },
      { campo: "Setor", rotulo: "Setor", tipo: "select", obrigatorio: true, opcoes: SETORES_POOL },
      { campo: "Posto Trabalho", rotulo: "Posto de Trabalho", tipo: "texto", obrigatorio: true, sugestoesDe: "Posto Trabalho" },
      { campo: "Cargo", rotulo: "Cargo", tipo: "texto", obrigatorio: true, sugestoesDe: "Cargo" },
      { campo: "Atividade", rotulo: "Atividade", tipo: "texto", obrigatorio: true, sugestoesDe: "Atividade" },
    ];
  }

  function sugestoes(campo) {
    const chaves = ["mapaRisco", "planoAcao", "absenteismo", "compativeis"];
    const set = new Set();
    chaves.forEach((c) => (window.BI.dados[c] || []).forEach((l) => { if (l[campo]) set.add(l[campo]); }));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
  }

  function regioesCorporais() {
    const m = window.BI.dados._meta || {};
    return [].concat(m.regioes_frente || [], m.regioes_tras || []);
  }

  function opcoesCID() {
    return (window.BI.dados.listaCID || []).map((l) => ({ valor: l["Cod CID"], label: `${l["Cod CID"]} - ${l["CID Abrev"]}` }));
  }

  function ligarCalculoRiscoGlobal(form) {
    const Calc = window.BI.Calc;
    function recalcular() {
      const scores = {};
      Calc.DIMENSOES_RISCO.forEach((d) => { scores[d] = form._campos[d].value; });
      const nivel = Calc.calcularRiscoGlobal(scores);
      const el = form._campos["Risco Global"];
      el.textContent = Calc.rotuloNivel(nivel);
      el.dataset.valorReal = nivel;
      el.style.color = Calc.corStatus(nivel) || "";
      el.style.fontWeight = "700";
    }
    Calc.DIMENSOES_RISCO.forEach((d) => { form._campos[d].addEventListener("input", recalcular); });
    recalcular();
  }

  function ligarPlanoAcao(form) {
    const Calc = window.BI.Calc;
    function atualizarRiscoDoPosto() {
      const chaveObj = {};
      Calc.DIMENSOES.forEach((c) => { chaveObj[c] = form._campos[c].value; });
      if (Calc.DIMENSOES.every((c) => chaveObj[c])) {
        const achado = Calc.buscarPorChave(window.BI.dados.mapaRisco, chaveObj);
        if (achado) form._campos["Risco Global"].value = achado["Risco Global"];
      }
    }
    Calc.DIMENSOES.forEach((c) => form._campos[c].addEventListener("blur", atualizarRiscoDoPosto));
    atualizarRiscoDoPosto();

    function atualizarEstadoFatorPosAcao() {
      const temConclusao = !!form._campos["Dt Conclusao"].value;
      form._campos["Fator Risco pos Acao"].disabled = !temConclusao;
      if (!temConclusao) form._campos["Fator Risco pos Acao"].value = "";
    }
    form._campos["Dt Conclusao"].addEventListener("change", atualizarEstadoFatorPosAcao);
    atualizarEstadoFatorPosAcao();

    form._campos["Acao Recomendada"].addEventListener("change", () => {
      const cat = ACOES_CATEGORIA_MAP[form._campos["Acao Recomendada"].value];
      if (cat) form._campos["Categoria Acao"].value = cat;
    });
  }

  const CADASTROS_CONFIG = {
    mapaRisco: {
      titulo: "Mapa de Risco (1 registro por posto de trabalho)",
      colunasTabela: ["Cliente", "Setor", "Posto Trabalho", "Cargo", "Risco Global"],
      colunasData: [],
      camposData: [],
      campos: camposChave().concat(
        window.BI.Calc ? window.BI.Calc.DIMENSOES_RISCO.map((d) => ({ campo: d, rotulo: d, tipo: "numero", obrigatorio: true, min: 1, max: 4 })) : [],
        [{ campo: "Risco Global", rotulo: "Risco Global (calculado)", tipo: "calculado" }]
      ),
      aoConstruir: ligarCalculoRiscoGlobal,
    },
    planoAcao: {
      titulo: "Plano de Acao",
      colunasTabela: ["Cliente", "Setor", "Posto Trabalho", "Acao Recomendada", "Responsavel Acao", "Dt Programada", "Dt Conclusao"],
      colunasData: ["Dt Programada", "Dt Conclusao"],
      camposData: ["Dt Programada", "Dt Conclusao"],
      campos: camposChave().concat([
        { campo: "Nr Acao", rotulo: "Nr Acao", tipo: "numero", obrigatorio: true, min: 1 },
        { campo: "Acao Recomendada", rotulo: "Acao Recomendada", tipo: "texto", obrigatorio: true, sugestoesLista: Object.keys(ACOES_CATEGORIA_MAP) },
        { campo: "Categoria Acao", rotulo: "Categoria Acao", tipo: "select", obrigatorio: true, opcoes: CATEGORIAS_ACAO_POOL },
        { campo: "Gestao Acao", rotulo: "Gestao Acao", tipo: "select", obrigatorio: true, opcoes: GESTAO_ACAO_POOL },
        { campo: "Responsavel Acao", rotulo: "Responsavel Acao", tipo: "texto", obrigatorio: true, sugestoesDe: "Responsavel Acao" },
        { campo: "E-mail Responsavel", rotulo: "E-mail Responsavel", tipo: "texto" },
        { campo: "Dt Programada", rotulo: "Dt Programada", tipo: "data", obrigatorio: true },
        { campo: "Dt Conclusao", rotulo: "Dt Conclusao", tipo: "data" },
        { campo: "Auditoria Ergonomista", rotulo: "Auditoria Ergonomista", tipo: "select", opcoes: SIM_NAO },
        { campo: "Dt Auditoria", rotulo: "Dt Auditoria", tipo: "data" },
        { campo: "Medida Controle ADM", rotulo: "Medida Controle ADM", tipo: "select", opcoes: SIM_NAO },
        { campo: "Risco Global", rotulo: "Risco Global (do posto)", tipo: "select", opcoes: window.BI.Calc ? window.BI.Calc.NIVEIS_RISCO : [] },
        { campo: "Fator Risco pos Acao", rotulo: "Fator Risco pos Acao", tipo: "select", opcoes: window.BI.Calc ? window.BI.Calc.NIVEIS_RISCO : [] },
      ]),
      aoConstruir: ligarPlanoAcao,
    },
    absenteismo: {
      titulo: "Absenteismo",
      colunasTabela: ["Cliente", "Setor", "Posto Trabalho", "Cod CID", "Dt Afastamento", "Qtd Dias", "Regiao Corporal"],
      colunasData: ["Dt Afastamento"],
      camposData: ["Dt Afastamento"],
      campos: camposChave().concat([
        { campo: "Cod CID", rotulo: "Cod CID", tipo: "select", obrigatorio: true, opcoes: () => opcoesCID() },
        { campo: "Dt Afastamento", rotulo: "Dt Afastamento", tipo: "data", obrigatorio: true },
        { campo: "Qtd Dias", rotulo: "Qtd Dias", tipo: "numero", obrigatorio: true, min: 1 },
        { campo: "Regiao Corporal", rotulo: "Regiao Corporal", tipo: "select", obrigatorio: true, opcoes: () => regioesCorporais() },
        { campo: "Dt Retorno", rotulo: "Dt Retorno", tipo: "data" },
      ]),
    },
    compativeis: {
      titulo: "Compativeis (restricoes medicas)",
      colunasTabela: ["Cliente", "Setor", "Funcionario", "Status Restricao", "Turno Trabalho", "Segmento Corporal", "Inicio Restricao"],
      colunasData: ["Inicio Restricao"],
      camposData: ["Inicio Restricao"],
      campos: camposChave().concat([
        { campo: "Status Restricao", rotulo: "Status Restricao", tipo: "select", obrigatorio: true, opcoes: STATUS_RESTRICAO_POOL },
        { campo: "Matricula", rotulo: "Matricula", tipo: "texto", obrigatorio: true },
        { campo: "Funcionario", rotulo: "Funcionario", tipo: "texto", obrigatorio: true },
        { campo: "Turno Trabalho", rotulo: "Turno Trabalho", tipo: "select", obrigatorio: true, opcoes: TURNOS_POOL },
        { campo: "Genero", rotulo: "Genero", tipo: "select", opcoes: GENEROS_POOL },
        { campo: "Idade", rotulo: "Idade", tipo: "numero", min: 14, max: 90 },
        { campo: "Tempo Empresa (meses)", rotulo: "Tempo Empresa (meses)", tipo: "numero", min: 0 },
        { campo: "Responsavel Area", rotulo: "Responsavel Area", tipo: "texto", sugestoesDe: "Responsavel Area" },
        { campo: "Medico Avaliador", rotulo: "Medico Avaliador", tipo: "texto", sugestoesDe: "Medico Avaliador" },
        { campo: "Queixa Principal", rotulo: "Queixa Principal", tipo: "texto" },
        { campo: "Segmento Corporal", rotulo: "Segmento Corporal", tipo: "select", opcoes: () => regioesCorporais() },
        { campo: "Restricao Medica", rotulo: "Restricao Medica", tipo: "texto" },
        { campo: "Inicio Restricao", rotulo: "Inicio Restricao", tipo: "data", obrigatorio: true },
        { campo: "Fim Restricao", rotulo: "Fim Restricao", tipo: "data" },
        { campo: "Historico Restricao", rotulo: "Historico Restricao", tipo: "select", opcoes: SIM_NAO },
        { campo: "Doc Atividade Compativel", rotulo: "Doc Atividade Compativel", tipo: "select", opcoes: SIM_NAO },
        { campo: "Retorno Medico", rotulo: "Retorno Medico", tipo: "data" },
        { campo: "Atividade Compativel (recomendada)", rotulo: "Atividade Compativel (recomendada)", tipo: "texto" },
        { campo: "Atividade Compativel", rotulo: "Atividade Compativel", tipo: "select", opcoes: SIM_NAO },
      ]),
    },
  };

  const estadoCadastro = {};

  function montarFormulario(cfg, chave, valoresIniciais) {
    const form = document.createElement("form");
    form.className = "form-cadastro";
    form._campos = {};

    const titulo = document.createElement("div");
    titulo.className = "form-titulo";
    titulo.textContent = valoresIniciais && valoresIniciais._id ? "Editar registro" : "Novo registro";
    form.appendChild(titulo);

    const grade = document.createElement("div");
    grade.className = "form-cadastro-grade";

    cfg.campos.forEach((def) => {
      const campoDiv = document.createElement("div");
      campoDiv.className = "campo-form";
      const label = document.createElement("label");
      label.textContent = def.rotulo || def.campo;
      campoDiv.appendChild(label);

      let el;
      const valorInicial = valoresIniciais ? valoresIniciais[def.campo] : undefined;

      if (def.tipo === "calculado") {
        el = document.createElement("div");
        el.className = "valor-calculado";
        el.textContent = valorInicial ? window.BI.Calc.rotuloNivel(valorInicial) : "-";
        if (valorInicial) el.dataset.valorReal = valorInicial;
      } else if (def.tipo === "select") {
        el = document.createElement("select");
        const opcoes = typeof def.opcoes === "function" ? def.opcoes() : (def.opcoes || []);
        const optBranco = document.createElement("option");
        optBranco.value = ""; optBranco.textContent = "-";
        el.appendChild(optBranco);
        opcoes.forEach((op) => {
          const opt = document.createElement("option");
          if (op && typeof op === "object") { opt.value = op.valor; opt.textContent = op.label; }
          else { opt.value = op; opt.textContent = window.BI.Calc.rotuloNivel(op); }
          el.appendChild(opt);
        });
        el.value = valorInicial != null ? valorInicial : "";
      } else if (def.tipo === "data") {
        el = document.createElement("input");
        el.type = "date";
        el.value = valorInicial || "";
      } else if (def.tipo === "numero") {
        el = document.createElement("input");
        el.type = "number";
        if (def.min != null) el.min = def.min;
        if (def.max != null) el.max = def.max;
        el.value = valorInicial != null ? valorInicial : "";
      } else {
        el = document.createElement("input");
        el.type = "text";
        el.value = valorInicial != null ? valorInicial : "";
        const listaSugestoes = def.sugestoesDe ? sugestoes(def.sugestoesDe) : def.sugestoesLista;
        if (listaSugestoes && listaSugestoes.length) {
          const listId = "dl-" + slug(chave + "-" + def.campo);
          el.setAttribute("list", listId);
          let dl = document.getElementById(listId);
          if (!dl) {
            dl = document.createElement("datalist");
            dl.id = listId;
            document.body.appendChild(dl);
          }
          dl.innerHTML = "";
          listaSugestoes.forEach((v) => {
            const opt = document.createElement("option");
            opt.value = v;
            dl.appendChild(opt);
          });
        }
      }
      el.dataset.campo = def.campo;
      if (def.obrigatorio && def.tipo !== "calculado") el.required = true;
      campoDiv.appendChild(el);
      form._campos[def.campo] = el;
      grade.appendChild(campoDiv);
    });

    form.appendChild(grade);

    const erro = document.createElement("div");
    erro.className = "form-cadastro-erro";
    erro.hidden = true;
    form.appendChild(erro);
    form._erroEl = erro;

    const acoes = document.createElement("div");
    acoes.className = "form-cadastro-acoes";
    const btnCancelar = document.createElement("button");
    btnCancelar.type = "button"; btnCancelar.className = "btn-cad-secundario"; btnCancelar.textContent = "Cancelar";
    const btnSalvar = document.createElement("button");
    btnSalvar.type = "submit"; btnSalvar.className = "btn-cad-primario"; btnSalvar.textContent = "Salvar";
    acoes.appendChild(btnCancelar);
    acoes.appendChild(btnSalvar);
    form.appendChild(acoes);
    form._btnCancelar = btnCancelar;

    if (cfg.aoConstruir) cfg.aoConstruir(form, valoresIniciais || {});

    return form;
  }

  function lerValoresFormulario(cfg, form) {
    const dados = {};
    let erro = null;
    cfg.campos.forEach((def) => {
      const el = form._campos[def.campo];
      let valor;
      if (def.tipo === "calculado") {
        valor = el.dataset.valorReal || null;
      } else if (def.tipo === "numero") {
        valor = el.value === "" ? null : Number(el.value);
      } else {
        valor = el.value === "" ? null : el.value;
      }
      if (def.obrigatorio && (valor === null || valor === "")) {
        erro = `Preencha o campo "${def.rotulo || def.campo}".`;
      }
      dados[def.campo] = valor;
    });
    return { dados, erro };
  }

  function montarCadastros() {
    const grade = document.getElementById("grade-cadastros");
    grade.innerHTML = "";
    Object.keys(CADASTROS_CONFIG).forEach((chave) => {
      estadoCadastro[chave] = estadoCadastro[chave] || { formAberto: false, editandoId: null, busca: "", pagina: 1, valoresForm: null };
      const cfg = CADASTROS_CONFIG[chave];

      const cartao = document.createElement("div");
      cartao.className = "cartao col-12 bloco-cadastro";

      const cab = document.createElement("div");
      cab.className = "cadastro-cabecalho";
      const titulo = document.createElement("div");
      titulo.className = "cartao-titulo";
      titulo.appendChild(document.createTextNode(cfg.titulo + " "));
      const contagem = document.createElement("span");
      contagem.className = "contagem-tabela";
      contagem.id = "contagem-cad-" + chave;
      titulo.appendChild(contagem);
      const btnNovo = document.createElement("button");
      btnNovo.type = "button"; btnNovo.className = "btn-novo-registro"; btnNovo.id = "btn-novo-" + chave;
      btnNovo.textContent = "+ Novo registro";
      btnNovo.addEventListener("click", () => abrirFormNovo(chave));
      cab.appendChild(titulo);
      cab.appendChild(btnNovo);

      const formContainer = document.createElement("div");
      formContainer.id = "form-container-" + chave;

      const controles = document.createElement("div");
      controles.className = "tabela-controles";
      const busca = document.createElement("input");
      busca.type = "search";
      busca.placeholder = "Buscar em " + cfg.titulo + "...";
      busca.addEventListener("input", (ev) => {
        estadoCadastro[chave].busca = ev.target.value;
        estadoCadastro[chave].pagina = 1;
        renderizarListaCadastro(chave);
      });
      controles.appendChild(busca);

      const scroll = document.createElement("div");
      scroll.className = "tabela-scroll";
      const tabela = document.createElement("table");
      tabela.className = "tabela-dados";
      tabela.id = "tabela-cad-" + chave;
      tabela.appendChild(document.createElement("thead"));
      tabela.appendChild(document.createElement("tbody"));
      scroll.appendChild(tabela);

      const paginacao = document.createElement("div");
      paginacao.className = "tabela-paginacao";
      paginacao.id = "paginacao-cad-" + chave;

      cartao.appendChild(cab);
      cartao.appendChild(formContainer);
      cartao.appendChild(controles);
      cartao.appendChild(scroll);
      cartao.appendChild(paginacao);
      grade.appendChild(cartao);
    });
    atualizarBotoesSomenteLeitura();
  }

  function atualizarBotoesSomenteLeitura() {
    const disponivel = window.BI.DB.estado.disponivel;
    const aviso = document.getElementById("aviso-somente-leitura");
    if (aviso) aviso.hidden = disponivel;
    Object.keys(CADASTROS_CONFIG).forEach((chave) => {
      const btn = document.getElementById("btn-novo-" + chave);
      if (btn) btn.disabled = !disponivel;
    });
  }

  function abrirFormNovo(chave) {
    const estado = estadoCadastro[chave];
    estado.editandoId = null;
    estado.formAberto = true;
    const filtros = window.BI.filtros;
    const prefill = {};
    window.BI.Calc.DIMENSOES.forEach((d) => { if (filtros[d] && filtros[d] !== "Todos") prefill[d] = filtros[d]; });
    estado.valoresForm = prefill;
    renderizarFormCadastro(chave);
  }

  function abrirFormEditar(chave, id) {
    const linha = (window.BI.dados[chave] || []).find((l) => l._id === id);
    if (!linha) return;
    const estado = estadoCadastro[chave];
    estado.editandoId = id;
    estado.formAberto = true;
    estado.valoresForm = linha;
    renderizarFormCadastro(chave);
  }

  function fecharFormCadastro(chave) {
    estadoCadastro[chave].formAberto = false;
    estadoCadastro[chave].editandoId = null;
    renderizarFormCadastro(chave);
  }

  function renderizarFormCadastro(chave) {
    const container = document.getElementById("form-container-" + chave);
    if (!container) return;
    container.innerHTML = "";
    const estado = estadoCadastro[chave];
    if (!estado.formAberto) return;
    const cfg = CADASTROS_CONFIG[chave];
    const form = montarFormulario(cfg, chave, estado.valoresForm || {});
    form._btnCancelar.addEventListener("click", () => fecharFormCadastro(chave));
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!window.BI.DB.estado.disponivel) {
        form._erroEl.hidden = false;
        form._erroEl.textContent = "Banco de dados indisponivel nesta visualizacao - nao e possivel salvar agora.";
        return;
      }
      const { dados, erro } = lerValoresFormulario(cfg, form);
      if (erro) {
        form._erroEl.hidden = false;
        form._erroEl.textContent = erro;
        return;
      }
      try {
        const idAtual = estado.editandoId;
        if (chave === "mapaRisco") {
          const novoId = window.BI.DB.idMapaRisco(dados);
          await window.BI.DB.salvar("mapaRisco", novoId, dados);
          if (idAtual && idAtual !== novoId) await window.BI.DB.excluir("mapaRisco", idAtual);
        } else {
          await window.BI.DB.salvar(chave, idAtual, dados);
        }
        fecharFormCadastro(chave);
      } catch (e) {
        form._erroEl.hidden = false;
        form._erroEl.textContent = "Erro ao salvar: " + (e && e.message ? e.message : String(e));
      }
    });
    container.appendChild(form);
  }

  function excluirRegistro(chave, id) {
    if (!window.BI.DB.estado.disponivel) return;
    if (!window.confirm("Excluir este registro definitivamente? Essa acao nao pode ser desfeita.")) return;
    window.BI.DB.excluir(chave, id).catch((e) => {
      mostrarErro("Erro ao excluir registro: " + (e && e.message ? e.message : String(e)));
    });
  }

  function renderizarListaCadastro(chave) {
    const Calc = window.BI.Calc;
    const cfg = CADASTROS_CONFIG[chave];
    const estado = estadoCadastro[chave];
    const hoje = hojeMeiaNoite();
    const linhasBrutas = window.BI.dados[chave] || [];
    let linhas = Calc.filtrar(linhasBrutas, window.BI.filtros, cfg.camposData);
    const totalFiltrado = linhas.length;
    if (estado.busca) {
      const termo = estado.busca.toLowerCase();
      linhas = linhas.filter((l) => cfg.colunasTabela.some((c) => String(l[c] || "").toLowerCase().includes(termo)));
    }

    const porPagina = 10;
    const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
    if (estado.pagina > totalPaginas) estado.pagina = totalPaginas;
    const inicio = (estado.pagina - 1) * porPagina;
    const paginaAtual = linhas.slice(inicio, inicio + porPagina);

    const tabela = document.getElementById("tabela-cad-" + chave);
    if (!tabela) return;

    const colunasExtra = chave === "planoAcao" ? ["Status Acao"] : [];
    const colunas = cfg.colunasTabela.concat(colunasExtra);

    const thead = tabela.querySelector("thead");
    thead.innerHTML = "";
    const trHead = document.createElement("tr");
    colunas.forEach((c) => { const th = document.createElement("th"); th.textContent = c; trHead.appendChild(th); });
    const thAcoes = document.createElement("th"); thAcoes.textContent = "Acoes"; trHead.appendChild(thAcoes);
    thead.appendChild(trHead);

    const tbody = tabela.querySelector("tbody");
    tbody.innerHTML = "";
    if (!paginaAtual.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = colunas.length + 1;
      td.className = "sem-dados";
      td.textContent = "Nenhum registro para os filtros/busca atuais.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      paginaAtual.forEach((linha) => {
        const tr = document.createElement("tr");
        cfg.colunasTabela.forEach((c) => {
          const td = document.createElement("td");
          let v = linha[c];
          if (cfg.colunasData && cfg.colunasData.includes(c)) v = formatarDataBR(v);
          else if (c === "Risco Global" && v) v = window.BI.Calc.rotuloNivel(v);
          td.textContent = v === null || v === undefined || v === "" ? "-" : String(v);
          tr.appendChild(td);
        });
        if (chave === "planoAcao") {
          const td = document.createElement("td");
          td.textContent = Calc.calcularStatusAcao(linha["Dt Programada"], linha["Dt Conclusao"], hoje);
          tr.appendChild(td);
        }
        const tdAcoes = document.createElement("td");
        const podeEditar = window.BI.DB.estado.disponivel && !!linha._id;
        const btnEditar = document.createElement("button");
        btnEditar.type = "button"; btnEditar.className = "btn-acao-linha"; btnEditar.textContent = "Editar";
        btnEditar.disabled = !podeEditar;
        btnEditar.addEventListener("click", () => abrirFormEditar(chave, linha._id));
        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button"; btnExcluir.className = "btn-acao-linha excluir"; btnExcluir.textContent = "Excluir";
        btnExcluir.disabled = !podeEditar;
        btnExcluir.addEventListener("click", () => excluirRegistro(chave, linha._id));
        tdAcoes.appendChild(btnEditar);
        tdAcoes.appendChild(btnExcluir);
        tr.appendChild(tdAcoes);
        tbody.appendChild(tr);
      });
    }

    const contagemEl = document.getElementById("contagem-cad-" + chave);
    if (contagemEl) {
      contagemEl.textContent = totalFiltrado !== linhasBrutas.length ? ` (filtros: ${totalFiltrado} de ${linhasBrutas.length})` : ` (${linhasBrutas.length})`;
    }

    const pagCont = document.getElementById("paginacao-cad-" + chave);
    pagCont.innerHTML = "";
    const info = document.createElement("span");
    info.textContent = linhas.length ? `Mostrando ${inicio + 1}-${Math.min(inicio + porPagina, linhas.length)} de ${linhas.length}` : "Sem resultados";
    const btnAnt = document.createElement("button");
    btnAnt.type = "button"; btnAnt.textContent = "< Anterior"; btnAnt.disabled = estado.pagina <= 1;
    btnAnt.addEventListener("click", () => { estado.pagina -= 1; renderizarListaCadastro(chave); });
    const btnProx = document.createElement("button");
    btnProx.type = "button"; btnProx.textContent = "Proxima >"; btnProx.disabled = estado.pagina >= totalPaginas;
    btnProx.addEventListener("click", () => { estado.pagina += 1; renderizarListaCadastro(chave); });
    pagCont.appendChild(info);
    pagCont.appendChild(btnAnt);
    pagCont.appendChild(btnProx);
  }

  function renderizarTodosCadastros() {
    Object.keys(CADASTROS_CONFIG).forEach(renderizarListaCadastro);
  }

  // ------------------------------------------------------------------
  // Navegacao entre abas (Ergo / Cadastros / Med Ocup / Compativeis) e o
  // link do rodape que abre/fecha o painel de Referencia (fora do nav)
  // ------------------------------------------------------------------
  let abaVisivelAntesDeReferencia = "aba-ergo";

  function configurarAbas() {
    const nav = document.getElementById("nav-abas");
    const botoes = Array.from(nav.querySelectorAll("button[data-aba]"));
    botoes.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        botoes.forEach((b) => b.classList.toggle("ativa", b === btn));
        const alvo = "aba-" + btn.dataset.aba;
        document.querySelectorAll('main > section[id^="aba-"]').forEach((sec) => {
          sec.hidden = sec.id !== alvo;
        });
        const btnRef = document.getElementById("btn-toggle-referencia");
        if (btnRef) btnRef.textContent = "Ver tabelas de referencia";
      });
    });
  }

  function configurarToggleReferencia() {
    const btn = document.getElementById("btn-toggle-referencia");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const secReferencia = document.getElementById("aba-referencia");
      const estaAberta = !secReferencia.hidden;
      if (estaAberta) {
        secReferencia.hidden = true;
        btn.textContent = "Ver tabelas de referencia";
        document.querySelectorAll('main > section[id^="aba-"]').forEach((sec) => {
          sec.hidden = sec.id !== abaVisivelAntesDeReferencia;
        });
      } else {
        const visivelAtual = Array.from(document.querySelectorAll('main > section[id^="aba-"]')).find((s) => !s.hidden && s.id !== "aba-referencia");
        abaVisivelAntesDeReferencia = visivelAtual ? visivelAtual.id : "aba-ergo";
        document.querySelectorAll('main > section[id^="aba-"]').forEach((sec) => {
          sec.hidden = sec.id !== "aba-referencia";
        });
        btn.textContent = "Fechar tabelas de referencia";
        renderizarAbaReferencia();
      }
    });
  }

  // ------------------------------------------------------------------
  // Erros visiveis (em vez de pagina em branco silenciosa)
  // ------------------------------------------------------------------
  function mostrarErro(mensagem) {
    let el = document.getElementById("aviso-erro");
    if (!el) {
      el = document.createElement("div");
      el.id = "aviso-erro";
      el.className = "aviso-erro";
      const main = document.querySelector("main");
      main.parentNode.insertBefore(el, main);
    }
    el.innerHTML = "";
    const forte = document.createElement("strong");
    forte.textContent = "Nao foi possivel carregar o BI Ergonomia:";
    const texto = document.createElement("span");
    texto.textContent = mensagem;
    el.appendChild(forte);
    el.appendChild(texto);
  }

  // ------------------------------------------------------------------
  // Orquestracao
  // ------------------------------------------------------------------
  function renderizarTudo() {
    try {
      renderizarTudoInterno();
    } catch (erro) {
      console.error("BI Ergonomia - erro ao renderizar:", erro);
      mostrarErro(erro && erro.message ? erro.message : String(erro));
    }
  }

  function renderizarTudoInterno() {
    const hoje = hojeMeiaNoite();
    const filtros = window.BI.filtros;
    const Calc = window.BI.Calc;

    const mapaRiscoF = Calc.filtrar(window.BI.dados.mapaRisco, filtros, []);
    const planoAcaoF = Calc.filtrar(window.BI.dados.planoAcao, filtros, ["Dt Programada", "Dt Conclusao"]);
    const planoAcaoFPrevistas = Calc.filtrar(window.BI.dados.planoAcao, filtros, ["Dt Programada"]);
    const planoAcaoFConcluidas = Calc.filtrar(window.BI.dados.planoAcao, filtros, ["Dt Conclusao"]).filter((a) => a["Dt Conclusao"]);

    const chip = document.getElementById("chip-contagem-postos");
    if (chip) chip.innerHTML = `<strong>${mapaRiscoF.length}</strong> de ${window.BI.dados.mapaRisco.length} postos`;

    renderTilesRiscoGlobal(Calc.mapaRiscoGlobal(mapaRiscoF));
    renderTopSetores(Calc.topSetores(mapaRiscoF, 3));
    renderDonutStatus("chart-plano-global", "legenda-plano-global", Calc.statusPlanoAcao(planoAcaoF, hoje));
    renderDonutStatus("chart-plano-criticos", "legenda-plano-criticos", Calc.planoAcaoPostosCriticos(planoAcaoF, hoje));
    renderLinhaMensal("chart-acoes-previstas", Calc.serieMensal(planoAcaoFPrevistas, "Dt Programada"), "Acoes previstas", Calc.resolverCorCSS("var(--teal)"));
    renderLinhaMensal("chart-acoes-concluidas", Calc.serieMensal(planoAcaoFConcluidas, "Dt Conclusao"), "Acoes concluidas", Calc.resolverCorCSS("var(--vinho-medio)"));
    renderPorResponsavel(Calc.planoAcaoPorResponsavel(planoAcaoF, hoje));
    renderStatusPorSetor(Calc.statusPlanoAcaoPorSetor(planoAcaoF, hoje));
    renderRiscoPorSetor(Calc.mapaRiscoPorSetor(mapaRiscoF));

    const diasUteisF = Calc.filtrar(window.BI.dados.diasUteis, filtros, ["Ano/Mes Uteis"]);
    const absenteismoF = Calc.filtrar(window.BI.dados.absenteismo, filtros, ["Dt Afastamento"]);
    renderTotaisMedOcup(Calc.totaisMedOcup(absenteismoF, diasUteisF));
    renderEvolucaoTaxa(Calc.evolucaoTaxaFrequencia(absenteismoF, diasUteisF));
    renderTaxaPorSetor(Calc.taxaFrequenciaPorSetor(absenteismoF, diasUteisF));
    renderDiagramasMedOcup(absenteismoF);

    const compativeisGlobalF = Calc.filtrar(window.BI.dados.compativeis, filtros, []);
    const compativeisF = aplicarFiltrosPagina(compativeisGlobalF);
    renderCompatGenero(compativeisF);
    renderCompatIdade(Calc.distribuicaoIdade(compativeisF));
    renderCompatStatusPorSetor(Calc.statusRestricaoPorSetor(compativeisF));
    renderCompatRestricaoPorTurno(Calc.statusRestricaoPorTurno(compativeisF));
    renderDiagramasCompativeis(compativeisF);
    renderCompatAtividade(compativeisF);
    renderCompatCompativelPorSetor(Calc.compativelPorSetor(compativeisF));

    renderizarTodosCadastros();
    renderizarAbaReferencia();
  }

  // ------------------------------------------------------------------
  // Banco de dados (js/db.js) - callback chamado a cada snapshot de uma
  // colecao (mapaRisco/planoAcao/absenteismo/compativeis)
  // ------------------------------------------------------------------
  function aoAtualizarColecaoDB(chave) {
    window.BI.dados[chave] = window.BI.DB.estado.colecoes[chave];
    atualizarOpcoesFiltros();
    renderizarTudo();
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  async function iniciar() {
    try {
      if (typeof Chart === "undefined") {
        throw new Error("A biblioteca Chart.js nao carregou (script externo bloqueado ou indisponivel).");
      }

      const resp = await fetch("data/mock_data.json");
      if (!resp.ok) throw new Error(`Falha ao buscar data/mock_data.json (HTTP ${resp.status}).`);
      const dados = await resp.json();

      window.BI.dados = dados;
      window.BI.filtros = {
        Cliente: "Todos", Unidade: "Todos", Setor: "Todos",
        "Posto Trabalho": "Todos", Cargo: "Todos", Atividade: "Todos", "Ano/Mes": "Todos",
      };
      window.BI.filtrosPagina = { "Status Restricao": "Todos", "Turno Trabalho": "Todos" };

      const spanData = document.getElementById("data-geracao");
      if (spanData) spanData.textContent = formatarDataBR(dados._meta.gerado_em) + ` (referencia de calculo: ${formatarDataBR(hojeMeiaNoite().toISOString().slice(0, 10))})`;

      configurarChartDefaults();
      montarBarraFiltros();
      atualizarOpcoesFiltros();
      montarFiltrosPagina();
      montarAbaReferencia();
      montarCadastros();
      configurarAbas();
      configurarToggleReferencia();
      renderizarTudo();

      const disponivel = await window.BI.DB.iniciar(aoAtualizarColecaoDB);
      atualizarBotoesSomenteLeitura();
      if (!disponivel) {
        console.warn("BI Ergonomia - capacidade 'db' indisponivel nesta visualizacao; cadastros em modo somente leitura (dados ficticios de exemplo).");
      }
    } catch (erro) {
      console.error("BI Ergonomia - erro na inicializacao:", erro);
      mostrarErro(erro && erro.message ? erro.message : String(erro));
    }
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();
