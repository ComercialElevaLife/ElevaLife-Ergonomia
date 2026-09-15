/* ==========================================================================
   BI Ergonomia - ElevaLife
   CAMADA DE APRESENTACAO (filtros, graficos, tooltips).
   Le window.BI.dados (injetado a partir de data/mock_data.json) e usa as
   funcoes puras de window.BI.Calc (js/calc.js) - nunca acessa o mock
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

  // Tabelas da aba "Dados" (camada de input, para inspecao/teste) - cada uma
  // le da mesma window.BI.dados e respeita os mesmos filtros globais do Ergo.
  const TABELAS_DADOS = [
    { chave: "listaCID", titulo: "Lista CID", camposData: [] },
    { chave: "diasUteis", titulo: "Dias Uteis", camposData: ["Ano/Mes Uteis"] },
    { chave: "mapaRisco", titulo: "Mapa Risco", camposData: [] },
    { chave: "planoAcao", titulo: "Plano Acao", camposData: ["Dt Programada", "Dt Conclusao"] },
    { chave: "absenteismo", titulo: "Absenteismo", camposData: ["Dt Afastamento"] },
    { chave: "compativeis", titulo: "Compativeis", camposData: ["Inicio Restricao"] },
  ];
  const estadoTabelas = {};

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
      rotulo.appendChild(document.createTextNode(n.nivel));

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
      label: nivel,
      data: linhas.map((l) => l[nivel] || 0),
      backgroundColor: window.BI.Calc.corStatus(nivel),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 22, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-risco-por-setor", { type: "bar", data: { labels, datasets }, options: opcoesBarraHorizontalEmpilhada() });
    renderizarLegenda("legenda-risco-por-setor", window.BI.Calc.NIVEIS_RISCO.map((n) => ({ label: n, cor: window.BI.Calc.corStatus(n) })));
  }

  // ------------------------------------------------------------------
  // Aba "Dados" - tabelas de input, para inspecao e teste
  // ------------------------------------------------------------------
  function montarAbaDados() {
    const grade = document.getElementById("grade-dados");
    grade.innerHTML = "";
    TABELAS_DADOS.forEach((cfg) => {
      estadoTabelas[cfg.chave] = estadoTabelas[cfg.chave] || { busca: "", ordCampo: null, ordDir: 1, pagina: 1 };

      const cartao = document.createElement("div");
      cartao.className = "cartao col-12 bloco-tabela";

      const titulo = document.createElement("div");
      titulo.className = "cartao-titulo";
      titulo.appendChild(document.createTextNode(cfg.titulo + " "));
      const contagem = document.createElement("span");
      contagem.className = "contagem-tabela";
      contagem.id = "contagem-" + cfg.chave;
      titulo.appendChild(contagem);

      const controles = document.createElement("div");
      controles.className = "tabela-controles";
      const busca = document.createElement("input");
      busca.type = "search";
      busca.placeholder = "Buscar em " + cfg.titulo + "...";
      busca.addEventListener("input", (ev) => {
        estadoTabelas[cfg.chave].busca = ev.target.value;
        estadoTabelas[cfg.chave].pagina = 1;
        renderizarTabelaDados(cfg);
      });
      controles.appendChild(busca);

      const scroll = document.createElement("div");
      scroll.className = "tabela-scroll";
      const tabela = document.createElement("table");
      tabela.className = "tabela-dados";
      tabela.id = "tabela-" + cfg.chave;
      tabela.appendChild(document.createElement("thead"));
      tabela.appendChild(document.createElement("tbody"));
      scroll.appendChild(tabela);

      const paginacao = document.createElement("div");
      paginacao.className = "tabela-paginacao";
      paginacao.id = "paginacao-" + cfg.chave;

      cartao.appendChild(titulo);
      cartao.appendChild(controles);
      cartao.appendChild(scroll);
      cartao.appendChild(paginacao);
      grade.appendChild(cartao);
    });
  }

  function renderizarTabelaDados(cfg) {
    const Calc = window.BI.Calc;
    const estado = estadoTabelas[cfg.chave];
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

    const tabela = document.getElementById("tabela-" + cfg.chave);
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
        renderizarTabelaDados(cfg);
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

    const contagemEl = document.getElementById("contagem-" + cfg.chave);
    if (contagemEl) {
      const sufixoFiltro = totalFiltrado !== linhasBrutas.length ? ` (filtros: ${totalFiltrado} de ${linhasBrutas.length})` : ` (${linhasBrutas.length})`;
      contagemEl.textContent = sufixoFiltro;
    }

    const pagCont = document.getElementById("paginacao-" + cfg.chave);
    pagCont.innerHTML = "";
    const info = document.createElement("span");
    info.textContent = linhas.length ? `Mostrando ${inicio + 1}-${Math.min(inicio + porPagina, linhas.length)} de ${linhas.length}` : "Sem resultados";
    const btnAnt = document.createElement("button");
    btnAnt.type = "button"; btnAnt.textContent = "< Anterior"; btnAnt.disabled = estado.pagina <= 1;
    btnAnt.addEventListener("click", () => { estado.pagina -= 1; renderizarTabelaDados(cfg); });
    const btnProx = document.createElement("button");
    btnProx.type = "button"; btnProx.textContent = "Proxima >"; btnProx.disabled = estado.pagina >= totalPaginas;
    btnProx.addEventListener("click", () => { estado.pagina += 1; renderizarTabelaDados(cfg); });
    pagCont.appendChild(info);
    pagCont.appendChild(btnAnt);
    pagCont.appendChild(btnProx);
  }

  function renderizarAbaDados() {
    TABELAS_DADOS.forEach(renderizarTabelaDados);
  }

  // ------------------------------------------------------------------
  // Navegacao entre abas (Ergo / Dados / Med Ocup / Compativeis)
  // ------------------------------------------------------------------
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
      });
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

    renderizarAbaDados();
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

      const spanData = document.getElementById("data-geracao");
      if (spanData) spanData.textContent = formatarDataBR(dados._meta.gerado_em) + ` (referencia de calculo: ${formatarDataBR(hojeMeiaNoite().toISOString().slice(0, 10))})`;

      configurarChartDefaults();
      montarBarraFiltros();
      atualizarOpcoesFiltros();
      montarAbaDados();
      configurarAbas();
      renderizarTudo();
    } catch (erro) {
      console.error("BI Ergonomia - erro na inicializacao:", erro);
      mostrarErro(erro && erro.message ? erro.message : String(erro));
    }
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();
