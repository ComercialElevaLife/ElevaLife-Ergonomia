/* ==========================================================================
   BI Ergonomia - ElevaLife
   CAMADA DE APRESENTACAO (filtros, graficos, tooltips, cadastros reais).
   Le window.BI.dados (mock estatico + colecoes do banco via js/db.js) e usa
   as funcoes puras de window.BI.Calc (js/calc.js) - nunca acessa o mock
   diretamente dentro das funcoes de calculo.
   ========================================================================== */

(function () {
  "use strict";

  const ORDEM_FILTROS = ["Ano", "Mes", "Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade"];
  const LABELS_FILTRO = {
    "Ano": "Ano", "Mes": "Mes", "Cliente": "Cliente", "Unidade": "Unidade", "Setor": "Setor",
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
    const dataPoints = tooltip.dataPoints || [];
    // Detalhamento maior no hover: numa pizza/rosca (um unico valor por
    // fatia), mostra % do total da rosca; num grafico com varias series na
    // mesma categoria (barra empilhada, por ex.), soma e mostra o Total.
    const ehFatiaUnica = dataPoints.length === 1 && ["pie", "doughnut"].includes(dataPoints[0].chart.config.type);
    const totalFatias = ehFatiaUnica
      ? (dataPoints[0].dataset.data || []).reduce((soma, v) => soma + (Number(v) || 0), 0)
      : 0;
    const totalSerie = dataPoints.reduce((soma, dp) => soma + (Number(dp.raw) || 0), 0);

    dataPoints.forEach((dp) => {
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
      if (ehFatiaUnica && totalFatias > 0) {
        valor.textContent += ` (${((Number(dp.raw) / totalFatias) * 100).toFixed(1)}%)`;
      }

      linha.appendChild(chave);
      linha.appendChild(rotulo);
      linha.appendChild(valor);
      el.appendChild(linha);
    });

    if (dataPoints.length > 1) {
      const linhaTotal = document.createElement("div");
      linhaTotal.className = "tt-linha tt-linha-total";
      const rotuloTotal = document.createElement("span");
      rotuloTotal.textContent = "Total";
      const valorTotal = document.createElement("span");
      valorTotal.className = "tt-valor";
      valorTotal.textContent = totalSerie.toLocaleString("pt-BR");
      linhaTotal.appendChild(rotuloTotal);
      linhaTotal.appendChild(valorTotal);
      el.appendChild(linhaTotal);
    }

    const rect = chart.canvas.getBoundingClientRect();
    el.style.display = "block";
    let left = rect.left + window.scrollX + tooltip.caretX;
    left = Math.min(Math.max(left, 120), window.innerWidth - 120);
    el.style.left = left + "px";
    el.style.top = rect.top + window.scrollY + tooltip.caretY + "px";
  }

  function configurarChartDefaults() {
    Chart.defaults.font.family = "'Montserrat', system-ui, -apple-system, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = corTextoSecundario();
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.enabled = false;
    Chart.defaults.plugins.tooltip.external = tooltipExterno;
    Chart.defaults.interaction.mode = "index";
    Chart.defaults.interaction.intersect = false;

    // Rotulos de dados sempre visiveis nos graficos (pedido do Leo: nao so
    // no hover). Registrado globalmente e ligado por padrao so em barra e
    // pizza/rosca - grafico de linha (serie temporal com muitos pontos)
    // continua so no hover pelo tooltip customizado, senao vira poluicao
    // visual (numero em cima de numero).
    if (window.ChartDataLabels) {
      Chart.register(window.ChartDataLabels);
      Chart.defaults.plugins.datalabels = { display: false };

      // Chart.overrides["bar"]/["doughnut"]/etc so ganham a chave "plugins"
      // se algum plugin/config ja tiver mexido nelas antes - por padrao nao
      // existe, entao criamos aqui pra nao quebrar com "Cannot set
      // properties of undefined (setting 'datalabels')".
      ["bar", "doughnut", "pie", "line"].forEach((tipo) => {
        if (!Chart.overrides[tipo]) Chart.overrides[tipo] = {};
        if (!Chart.overrides[tipo].plugins) Chart.overrides[tipo].plugins = {};
      });

      Chart.overrides.bar.plugins.datalabels = {
        display: true,
        clip: false,
        font: { size: 11, weight: "600" },
        // Barra simples (1 serie): rotulo fora, no fim da barra.
        // Barra empilhada (stack definido): rotulo dentro de cada segmento.
        anchor: (ctx) => (ctx.dataset.stack ? "center" : "end"),
        align: (ctx) => (ctx.dataset.stack ? "center" : "end"),
        color: (ctx) => (ctx.dataset.stack ? "#fff" : corTextoSecundario()),
        formatter: (valor, ctx) => {
          const n = Number(valor);
          if (!n) return "";
          if (ctx.dataset.stack) {
            // Esconde rotulo de segmento minusculo (nao caberia legivel de
            // qualquer forma e so poluiria a barra empilhada).
            const total = (ctx.chart.data.datasets || []).reduce((soma, ds) => soma + (Number(ds.data[ctx.dataIndex]) || 0), 0);
            if (total > 0 && n / total < 0.08) return "";
          }
          return n.toLocaleString("pt-BR");
        },
      };

      const rotuloFatia = {
        display: true,
        color: "#fff",
        anchor: "center",
        align: "center",
        font: { size: 11, weight: "600" },
        formatter: (valor, ctx) => {
          const n = Number(valor);
          const total = (ctx.dataset.data || []).reduce((soma, v) => soma + (Number(v) || 0), 0);
          if (!n || !total) return "";
          const pct = (n / total) * 100;
          return pct < 6 ? "" : `${pct.toFixed(0)}%`;
        },
      };
      Chart.overrides.doughnut.plugins.datalabels = rotuloFatia;
      Chart.overrides.pie.plugins.datalabels = rotuloFatia;
      Chart.overrides.line.plugins.datalabels = { display: false };
    }
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
  // Drill-down: clicar em qualquer grafico (fatia, barra, ponto) abre um
  // painel flutuante com o detalhamento das linhas brutas por tras
  // daquele numero - reaproveita as MESMAS colunas ja definidas em
  // CADASTROS_CONFIG (chave "mapaRisco"/"planoAcao"/"absenteismo"/
  // "compativeis") para nao duplicar a forma de exibir cada tabela.
  // ------------------------------------------------------------------
  let elDrillDown = null;

  function obterPainelDrillDown() {
    if (elDrillDown) return elDrillDown;
    const painel = document.createElement("div");
    painel.className = "drilldown-painel";
    painel.id = "drilldown-painel";
    painel.hidden = true;
    const cab = document.createElement("div");
    cab.className = "drilldown-cabecalho";
    const titulos = document.createElement("div");
    titulos.className = "drilldown-titulos";
    const titulo = document.createElement("div");
    titulo.className = "titulo";
    titulo.id = "drilldown-titulo";
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.id = "drilldown-sub";
    titulos.appendChild(titulo);
    titulos.appendChild(sub);
    const btnFechar = document.createElement("button");
    btnFechar.type = "button";
    btnFechar.className = "drilldown-fechar";
    btnFechar.setAttribute("aria-label", "Fechar detalhamento");
    btnFechar.textContent = "×";
    btnFechar.addEventListener("click", fecharDrillDown);
    cab.appendChild(titulos);
    cab.appendChild(btnFechar);
    const corpo = document.createElement("div");
    corpo.className = "drilldown-corpo";
    corpo.id = "drilldown-corpo";
    painel.appendChild(cab);
    painel.appendChild(corpo);
    document.body.appendChild(painel);
    elDrillDown = painel;
    return painel;
  }

  function fecharDrillDown() {
    if (elDrillDown) elDrillDown.hidden = true;
  }

  document.addEventListener("click", (ev) => {
    if (!elDrillDown || elDrillDown.hidden) return;
    if (ev.target.closest(".drilldown-painel") || ev.target.closest("canvas") || ev.target.closest(".figura-diagrama")) return;
    fecharDrillDown();
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") fecharDrillDown(); });

  // colunas de exibicao por tabela de origem (mesma forma das listas de
  // Cadastros - ver CADASTROS_CONFIG mais abaixo neste arquivo)
  function colunasDrillDown(chave) {
    const cfg = CADASTROS_CONFIG[chave];
    const extra = chave === "planoAcao" ? ["Status Acao"] : [];
    return { colunas: cfg.colunasTabela.concat(extra), colunasData: cfg.colunasData || [] };
  }

  function celulaFormatada(col, linha, colunasData) {
    let v = linha[col];
    if (colunasData.includes(col)) v = formatarDataBR(v);
    else if (col === "Risco Global" && v) v = window.BI.Calc.rotuloNivel(v);
    return v === null || v === undefined || v === "" ? "-" : String(v);
  }

  const LIMITE_LINHAS_DRILLDOWN = 30;

  function abrirDrillDown(campoOuTitulo, subtitulo, chave, linhas, evt) {
    const painel = obterPainelDrillDown();
    document.getElementById("drilldown-titulo").textContent = campoOuTitulo;
    document.getElementById("drilldown-sub").textContent = subtitulo;

    const corpo = document.getElementById("drilldown-corpo");
    corpo.innerHTML = "";

    if (!linhas.length) {
      const vazio = document.createElement("div");
      vazio.className = "drilldown-vazio";
      vazio.textContent = "Nenhum registro para esta selecao.";
      corpo.appendChild(vazio);
    } else {
      const { colunas, colunasData } = colunasDrillDown(chave);
      const hoje = hojeMeiaNoite();
      const scroll = document.createElement("div");
      scroll.className = "tabela-scroll";
      const tabela = document.createElement("table");
      tabela.className = "tabela-dados";
      const thead = document.createElement("thead");
      const trHead = document.createElement("tr");
      colunas.forEach((c) => { const th = document.createElement("th"); th.textContent = c; trHead.appendChild(th); });
      thead.appendChild(trHead);
      const tbody = document.createElement("tbody");
      linhas.slice(0, LIMITE_LINHAS_DRILLDOWN).forEach((linha) => {
        const tr = document.createElement("tr");
        colunas.forEach((c) => {
          const td = document.createElement("td");
          if (c === "Status Acao") td.textContent = window.BI.Calc.calcularStatusAcao(linha["Dt Programada"], linha["Dt Conclusao"], hoje);
          else td.textContent = celulaFormatada(c, linha, colunasData);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tabela.appendChild(thead);
      tabela.appendChild(tbody);
      scroll.appendChild(tabela);
      corpo.appendChild(scroll);
      if (linhas.length > LIMITE_LINHAS_DRILLDOWN) {
        const nota = document.createElement("div");
        nota.className = "drilldown-nota";
        nota.textContent = `Mostrando ${LIMITE_LINHAS_DRILLDOWN} de ${linhas.length} registros.`;
        corpo.appendChild(nota);
      }
    }

    painel.hidden = false;
    // Posiciona proximo ao clique, sem sair da tela.
    const W = 460, margem = 12;
    let x = (evt && evt.clientX != null ? evt.clientX : window.innerWidth / 2) + 14;
    let y = evt && evt.clientY != null ? evt.clientY : window.innerHeight / 2;
    if (x + W + margem > window.innerWidth) x = window.innerWidth - W - margem;
    if (x < margem) x = margem;
    const alturaEstimada = Math.min(400, window.innerHeight * 0.7);
    if (y + alturaEstimada + margem > window.innerHeight) y = Math.max(margem, window.innerHeight - alturaEstimada - margem);
    painel.style.left = x + "px";
    painel.style.top = y + "px";
  }

  // Resolve o elemento REALMENTE sob o cursor (independente do modo de
  // interacao do tooltip, que usa "index"/intersect:false) - clique deve
  // sempre mirar o segmento/barra visualmente clicado.
  function elementoClicado(chart, evt) {
    const els = chart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, false);
    return els && els.length ? els[0] : null;
  }

  // Diagramas corporais (SVG) tambem sao clicaveis: cada rotulo de regiao
  // (js/diagramas.js) recebe um data-regiao - aqui so ligamos o clique
  // apos cada renderizacao (o SVG e recriado via innerHTML a cada vez).
  function ligarCliqueDiagrama(containerId, linhasFonte, campoRegiao, chave) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.querySelectorAll("[data-regiao]").forEach((g) => {
      const regiao = g.getAttribute("data-regiao");
      const abrir = (ev) => {
        abrirDrillDown(
          `Regiao corporal - ${regiao}`, "Registros desta regiao", chave,
          linhasFonte.filter((l) => l[campoRegiao] === regiao), ev
        );
      };
      g.addEventListener("click", abrir);
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(ev); } });
    });
  }

  // Anexa onClick + onHover (cursor) a um objeto de opcoes do Chart.js.
  // `resolver(el, chart)` recebe o elemento clicado e devolve
  // {titulo, subtitulo, chave, linhas} (ou null/undefined para ignorar).
  function comCliqueDrillDown(opcoes, resolver) {
    return Object.assign({}, opcoes, {
      onHover(evt, elements) { evt.native.target.style.cursor = elements.length ? "pointer" : "default"; },
      onClick(evt, elements, chart) {
        const el = (elements && elements[0]) || elementoClicado(chart, evt);
        if (!el) return;
        const res = resolver(el, chart);
        if (!res) return;
        abrirDrillDown(res.titulo, res.subtitulo, res.chave, res.linhas, evt.native || evt);
      },
    });
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
  // Componente generico: dropdown multi-selecao com caixas de selecao
  // embutidas (usado na barra de filtros globais e nos filtros de pagina).
  // Cada campo guarda um ARRAY de valores selecionados em `estado[campo]`
  // (array vazio = "Todos") - varios valores marcados no mesmo campo
  // trazem a UNIAO das variacoes (OR); campos diferentes se combinam em E.
  // ------------------------------------------------------------------
  const paineisMultiSelectAbertos = new Set();

  function fecharPaineisMultiSelect(exceto) {
    paineisMultiSelectAbertos.forEach((campoId) => {
      if (campoId === exceto) return;
      const painel = document.getElementById("painel-" + campoId);
      const botao = document.getElementById("botao-" + campoId);
      if (painel) painel.hidden = true;
      if (botao) botao.setAttribute("aria-expanded", "false");
      paineisMultiSelectAbertos.delete(campoId);
    });
  }
  document.addEventListener("click", (ev) => {
    if (ev.target.closest(".multi-select")) return;
    fecharPaineisMultiSelect(null);
  });

  // Cria (uma unica vez) a estrutura DOM de um filtro multi-selecao.
  // `aoMudar` e chamado apos qualquer alteracao no array `estado[campo]`.
  function criarMultiSelect(campoId, rotuloCampo, estado, campo, aoMudar) {
    const div = document.createElement("div");
    div.className = "campo-filtro campo-filtro-multi";

    const label = document.createElement("label");
    label.textContent = rotuloCampo;
    label.setAttribute("for", "botao-" + campoId);
    div.appendChild(label);

    const wrap = document.createElement("div");
    wrap.className = "multi-select";
    wrap.dataset.campo = campoId;

    const botao = document.createElement("button");
    botao.type = "button";
    botao.id = "botao-" + campoId;
    botao.className = "multi-select-botao";
    botao.setAttribute("aria-haspopup", "listbox");
    botao.setAttribute("aria-expanded", "false");
    const textoBotao = document.createElement("span");
    textoBotao.className = "multi-select-texto";
    textoBotao.textContent = "Todos";
    const seta = document.createElement("span");
    seta.className = "multi-select-seta";
    seta.setAttribute("aria-hidden", "true");
    seta.textContent = "▾";
    botao.appendChild(textoBotao);
    botao.appendChild(seta);
    botao.addEventListener("click", () => {
      const estaAberto = !painel.hidden;
      fecharPaineisMultiSelect(estaAberto ? null : campoId);
      painel.hidden = estaAberto;
      botao.setAttribute("aria-expanded", String(!estaAberto));
      if (!estaAberto) paineisMultiSelectAbertos.add(campoId); else paineisMultiSelectAbertos.delete(campoId);
    });

    const painel = document.createElement("div");
    painel.id = "painel-" + campoId;
    painel.className = "multi-select-painel";
    painel.hidden = true;
    painel.setAttribute("role", "listbox");

    const topo = document.createElement("div");
    topo.className = "multi-select-topo";
    const btnTodos = document.createElement("button");
    btnTodos.type = "button";
    btnTodos.textContent = "Marcar todos";
    btnTodos.addEventListener("click", () => {
      const cbs = painel.querySelectorAll('input[type="checkbox"]');
      estado[campo] = Array.from(cbs).map((cb) => cb.value);
      cbs.forEach((cb) => { cb.checked = true; });
      aoMudar();
    });
    const btnNenhum = document.createElement("button");
    btnNenhum.type = "button";
    btnNenhum.textContent = "Limpar";
    btnNenhum.addEventListener("click", () => {
      estado[campo] = [];
      painel.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
      aoMudar();
    });
    topo.appendChild(btnTodos);
    topo.appendChild(btnNenhum);

    const lista = document.createElement("div");
    lista.className = "multi-select-lista";

    painel.appendChild(topo);
    painel.appendChild(lista);
    wrap.appendChild(botao);
    wrap.appendChild(painel);
    div.appendChild(wrap);

    div._refs = { botao, textoBotao, painel, lista };
    return div;
  }

  // Reconcilia as opcoes disponiveis (cascata) e o texto do botao de um
  // multi-select ja criado, SEM recriar a estrutura - preserva o painel
  // aberto/fechado enquanto o usuario marca varias caixas em sequencia.
  function atualizarMultiSelect(div, estado, campo, opcoesValor, formatarOpcao) {
    const { textoBotao, lista } = div._refs;
    const selecionadosValidos = (estado[campo] || []).filter((v) => opcoesValor.includes(v));
    estado[campo] = selecionadosValidos;

    lista.innerHTML = "";
    opcoesValor.forEach((v) => {
      const item = document.createElement("label");
      item.className = "multi-select-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = v;
      cb.checked = selecionadosValidos.includes(v);
      cb.addEventListener("change", () => {
        const arr = estado[campo].slice();
        if (cb.checked) { if (!arr.includes(v)) arr.push(v); }
        else { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); }
        estado[campo] = arr;
        div._aoMudar();
      });
      const texto = document.createElement("span");
      texto.textContent = formatarOpcao ? formatarOpcao(v) : v;
      item.appendChild(cb);
      item.appendChild(texto);
      lista.appendChild(item);
    });

    if (!selecionadosValidos.length) textoBotao.textContent = "Todos";
    else if (selecionadosValidos.length === 1) textoBotao.textContent = formatarOpcao ? formatarOpcao(selecionadosValidos[0]) : selecionadosValidos[0];
    else textoBotao.textContent = `${selecionadosValidos.length} selecionados`;
  }

  // ------------------------------------------------------------------
  // Filtros globais (UI) - valem para TODAS as telas (Ergo/Med Ocup/
  // Compativeis leem o mesmo window.BI.filtros a cada renderizacao).
  // ------------------------------------------------------------------
  const multiSelectsGlobais = {};

  function montarBarraFiltros() {
    const container = document.getElementById("barra-filtros");
    container.innerHTML = "";
    ORDEM_FILTROS.forEach((campo) => {
      const campoId = "filtro-" + slug(campo);
      const div = criarMultiSelect(campoId, LABELS_FILTRO[campo], window.BI.filtros, campo, () => {
        atualizarOpcoesFiltros();
        renderizarTudo();
      });
      div._aoMudar = () => { atualizarOpcoesFiltros(); renderizarTudo(); };
      multiSelectsGlobais[campo] = div;
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
    const meta = window.BI.dados._meta;
    const anos = window.BI.Calc.anosDisponiveis(meta.meses);
    const meses = window.BI.Calc.mesesDisponiveis(meta.meses);
    ORDEM_FILTROS.forEach((campo) => {
      const div = multiSelectsGlobais[campo];
      if (!div) return;
      if (campo === "Ano") {
        atualizarMultiSelect(div, window.BI.filtros, campo, anos);
      } else if (campo === "Mes") {
        atualizarMultiSelect(div, window.BI.filtros, campo, meses, (mm) => window.BI.Calc.rotuloMes(mm));
      } else {
        atualizarMultiSelect(div, window.BI.filtros, campo, opcoes[campo]);
      }
    });
  }

  function limparFiltros() {
    ORDEM_FILTROS.forEach((c) => { window.BI.filtros[c] = []; });
    atualizarOpcoesFiltros();
    renderizarTudo();
  }

  // ------------------------------------------------------------------
  // Renderizadores - Dashboard "Ergo"
  // ------------------------------------------------------------------

  function renderTilesRiscoGlobal(niveis, mapaRiscoF) {
    const cont = document.getElementById("tiles-risco-global");
    cont.innerHTML = "";
    niveis.forEach((n) => {
      const cor = window.BI.Calc.corStatus(n.nivel);
      const tile = document.createElement("div");
      tile.className = "tile-status tile-clicavel";
      tile.style.borderLeftColor = cor;
      tile.addEventListener("click", (ev) => {
        ev.stopPropagation();
        abrirDrillDown(
          `Mapa de Risco Global - ${window.BI.Calc.rotuloNivel(n.nivel)}`,
          `${n.qtd} posto(s) de trabalho`, "mapaRisco",
          mapaRiscoF.filter((l) => l["Risco Global"] === n.nivel), ev
        );
      });

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

  function renderTopSetores(lista, mapaRiscoF) {
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
      options: comCliqueDrillDown({
        indexAxis: "y",
        scales: {
          x: { beginAtZero: true, max: 100, grid: { color: corGrid() }, border: { display: false }, ticks: { callback: (v) => v + "%" } },
          y: { grid: { display: false }, border: { display: false } },
        },
      }, (el) => {
        const setor = labels[el.index];
        return { titulo: `Top Setores criticos - ${setor}`, subtitulo: "Postos deste setor", chave: "mapaRisco", linhas: mapaRiscoF.filter((l) => l.Setor === setor) };
      }),
    });
  }

  function renderDonutStatus(canvasId, legendaId, dadosStatus, linhasFonte, hoje) {
    const labels = dadosStatus.map((d) => d.status);
    const valores = dadosStatus.map((d) => d.qtd);
    const cores = labels.map((s) => window.BI.Calc.corStatus(s));
    criarOuAtualizarGrafico(canvasId, {
      type: "doughnut",
      data: { labels, datasets: [{ data: valores, backgroundColor: cores, borderColor: corSurfaceCard(), borderWidth: 2 }] },
      options: comCliqueDrillDown({
        cutout: "62%",
        interaction: { mode: "nearest", intersect: true },
        plugins: { tooltip: { enabled: false, external: tooltipExterno } },
      }, (el) => {
        const status = labels[el.index];
        return {
          titulo: `Plano de Acao - ${status}`, subtitulo: `${valores[el.index]} acao(oes)`, chave: "planoAcao",
          linhas: linhasFonte.filter((l) => window.BI.Calc.calcularStatusAcao(l["Dt Programada"], l["Dt Conclusao"], hoje) === status),
        };
      }),
    });
    const total = valores.reduce((a, b) => a + b, 0);
    renderizarLegenda(legendaId, labels.map((l, i) => ({ label: `${l} (${valores[i]}${total ? ", " + ((valores[i] / total) * 100).toFixed(0) + "%" : ""})`, cor: cores[i] })));
  }

  function renderLinhaMensal(canvasId, serie, nomeSerie, cor, linhasFonte, campoData) {
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
      options: comCliqueDrillDown({
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, grid: { color: corGrid() }, border: { display: false }, ticks: { precision: 0 } },
        },
      }, (el) => {
        const mes = serie[el.index].mes;
        return {
          titulo: `${nomeSerie} - ${window.BI.Calc.formatarMesLabel(mes)}`, subtitulo: `${valores[el.index]} registro(s)`, chave: "planoAcao",
          linhas: linhasFonte.filter((l) => l[campoData] && String(l[campoData]).slice(0, 7) === mes),
        };
      }),
    });
  }

  function renderPorResponsavel(linhas, planoAcaoF, hoje) {
    const labels = linhas.map((l) => l.responsavel);
    const datasets = window.BI.Calc.STATUS_ACAO_ORDEM.map((status) => ({
      label: status,
      data: linhas.map((l) => l[status] || 0),
      backgroundColor: window.BI.Calc.corStatus(status),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 20, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-por-responsavel", {
      type: "bar", data: { labels, datasets },
      options: comCliqueDrillDown(opcoesBarraHorizontalEmpilhada(), (el) => {
        const responsavel = labels[el.index];
        const status = window.BI.Calc.STATUS_ACAO_ORDEM[el.datasetIndex];
        return {
          titulo: `${responsavel} - ${status}`, subtitulo: "Acoes do Plano de Acao", chave: "planoAcao",
          linhas: planoAcaoF.filter((l) => l["Responsavel Acao"] === responsavel && window.BI.Calc.calcularStatusAcao(l["Dt Programada"], l["Dt Conclusao"], hoje) === status),
        };
      }),
    });
    renderizarLegenda("legenda-por-responsavel", window.BI.Calc.STATUS_ACAO_ORDEM.map((s) => ({ label: s, cor: window.BI.Calc.corStatus(s) })));
  }

  function renderStatusPorSetor(linhas, planoAcaoF, hoje) {
    const labels = linhas.map((l) => l.setor);
    const datasets = window.BI.Calc.STATUS_ACAO_ORDEM.map((status) => ({
      label: status,
      data: linhas.map((l) => l[status] || 0),
      backgroundColor: window.BI.Calc.corStatus(status),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 20, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-status-por-setor", {
      type: "bar", data: { labels, datasets },
      options: comCliqueDrillDown(opcoesBarraHorizontalEmpilhada(), (el) => {
        const setor = labels[el.index];
        const status = window.BI.Calc.STATUS_ACAO_ORDEM[el.datasetIndex];
        return {
          titulo: `${setor} - ${status}`, subtitulo: "Acoes do Plano de Acao", chave: "planoAcao",
          linhas: planoAcaoF.filter((l) => l.Setor === setor && window.BI.Calc.calcularStatusAcao(l["Dt Programada"], l["Dt Conclusao"], hoje) === status),
        };
      }),
    });
    renderizarLegenda("legenda-status-por-setor", window.BI.Calc.STATUS_ACAO_ORDEM.map((s) => ({ label: s, cor: window.BI.Calc.corStatus(s) })));
  }

  function renderRiscoPorSetor(linhas, mapaRiscoF) {
    const labels = linhas.map((l) => l.setor);
    const datasets = window.BI.Calc.NIVEIS_RISCO.map((nivel) => ({
      label: window.BI.Calc.rotuloNivel(nivel),
      data: linhas.map((l) => l[nivel] || 0),
      backgroundColor: window.BI.Calc.corStatus(nivel),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 22, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-risco-por-setor", {
      type: "bar", data: { labels, datasets },
      options: comCliqueDrillDown(opcoesBarraHorizontalEmpilhada(), (el) => {
        const setor = labels[el.index];
        const nivel = window.BI.Calc.NIVEIS_RISCO[el.datasetIndex];
        return {
          titulo: `${setor} - Risco ${window.BI.Calc.rotuloNivel(nivel)}`, subtitulo: "Postos de trabalho", chave: "mapaRisco",
          linhas: mapaRiscoF.filter((l) => l.Setor === setor && l["Risco Global"] === nivel),
        };
      }),
    });
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
  function renderEvolucaoTaxa(serie, absenteismoF) {
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
      options: comCliqueDrillDown({
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, grid: { color: corGrid() }, border: { display: false } },
          y1: { display: false, beginAtZero: true },
        },
      }, (el) => {
        const mes = serie[el.index].mes;
        return {
          titulo: `Absenteismo - ${window.BI.Calc.formatarMesLabel(mes)}`, subtitulo: "Registros de afastamento no mes", chave: "absenteismo",
          linhas: absenteismoF.filter((l) => l["Dt Afastamento"] && String(l["Dt Afastamento"]).slice(0, 7) === mes),
        };
      }),
    });
  }

  function renderTaxaPorSetor(lista, absenteismoF) {
    const mapaCores = window.BI.Calc.construirMapaCores(lista.map((s) => s.setor));
    const labels = lista.map((s) => s.setor);
    const valores = lista.map((s) => Number(s.taxaFrequencia.toFixed(2)));
    criarOuAtualizarGrafico("chart-taxa-por-setor", {
      type: "bar",
      data: {
        labels,
        datasets: [{ data: valores, backgroundColor: labels.map((l) => mapaCores[l]), maxBarThickness: 26, borderRadius: 4, borderSkipped: false }],
      },
      options: comCliqueDrillDown({
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, grid: { color: corGrid() }, border: { display: false } },
        },
      }, (el) => {
        const setor = labels[el.index];
        return { titulo: `Absenteismo - ${setor}`, subtitulo: "Registros de afastamento", chave: "absenteismo", linhas: absenteismoF.filter((l) => l.Setor === setor) };
      }),
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
    ligarCliqueDiagrama("diagrama-medocup-frente", absenteismoF, "Regiao Corporal", "absenteismo");
    ligarCliqueDiagrama("diagrama-medocup-costas", absenteismoF, "Regiao Corporal", "absenteismo");
  }

  // ------------------------------------------------------------------
  // Filtros de pagina (so na aba "Compativeis") - Status Restricao e
  // Turno Trabalho, conforme RD. Independentes dos filtros globais do
  // topo; aplicados so aos 8 indicadores desta aba.
  // ------------------------------------------------------------------
  const multiSelectsPagina = {};

  function montarFiltrosPagina() {
    const container = document.getElementById("barra-filtros-compativeis");
    if (!container) return;
    container.innerHTML = "";
    const campos = [
      { campo: "Status Restricao", opcoes: STATUS_RESTRICAO_POOL },
      { campo: "Turno Trabalho", opcoes: TURNOS_POOL },
    ];
    campos.forEach((cfg) => {
      const campoId = "filtro-pagina-" + slug(cfg.campo);
      const div = criarMultiSelect(campoId, cfg.campo, window.BI.filtrosPagina, cfg.campo, () => renderizarTudo());
      div._aoMudar = () => renderizarTudo();
      multiSelectsPagina[cfg.campo] = div;
      atualizarMultiSelect(div, window.BI.filtrosPagina, cfg.campo, cfg.opcoes);
      container.appendChild(div);
    });

    const btnLimpar = document.createElement("button");
    btnLimpar.type = "button";
    btnLimpar.className = "btn-limpar-filtros";
    btnLimpar.textContent = "Limpar filtros da pagina";
    btnLimpar.addEventListener("click", limparFiltrosPagina);
    container.appendChild(btnLimpar);
  }

  function limparFiltrosPagina() {
    window.BI.filtrosPagina["Status Restricao"] = [];
    window.BI.filtrosPagina["Turno Trabalho"] = [];
    Object.keys(multiSelectsPagina).forEach((campo) => {
      atualizarMultiSelect(multiSelectsPagina[campo], window.BI.filtrosPagina, campo,
        campo === "Status Restricao" ? STATUS_RESTRICAO_POOL : TURNOS_POOL);
    });
    renderizarTudo();
  }

  function aplicarFiltrosPagina(linhas) {
    const fp = window.BI.filtrosPagina;
    const statusOk = (l) => !fp["Status Restricao"].length || fp["Status Restricao"].includes(l["Status Restricao"]);
    const turnoOk = (l) => !fp["Turno Trabalho"].length || fp["Turno Trabalho"].includes(l["Turno Trabalho"]);
    return linhas.filter((l) => statusOk(l) && turnoOk(l));
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
  function renderDonutGenerico(canvasId, legendaId, labels, valores, cores, aoClicar) {
    criarOuAtualizarGrafico(canvasId, {
      type: "doughnut",
      data: { labels, datasets: [{ data: valores, backgroundColor: cores, borderColor: corSurfaceCard(), borderWidth: 2 }] },
      options: comCliqueDrillDown({
        cutout: "62%",
        interaction: { mode: "nearest", intersect: true },
        plugins: { tooltip: { enabled: false, external: tooltipExterno } },
      }, aoClicar ? (el) => aoClicar(labels[el.index], valores[el.index]) : () => null),
    });
    const total = valores.reduce((a, b) => a + b, 0);
    renderizarLegenda(legendaId, labels.map((l, i) => ({ label: `${l} (${valores[i]}${total ? ", " + ((valores[i] / total) * 100).toFixed(0) + "%" : ""})`, cor: cores[i] })));
  }

  function renderCompatGenero(compativeisF) {
    const itens = contagemOrdenada(window.BI.Calc.contagemPorCampo(compativeisF, "Genero"), GENEROS_POOL);
    const labels = itens.map((i) => i.chave);
    const valores = itens.map((i) => i.qtd);
    const mapaCores = window.BI.Calc.construirMapaCores(labels);
    renderDonutGenerico("chart-compat-genero", "legenda-compat-genero", labels, valores, labels.map((l) => mapaCores[l]), (genero) => ({
      titulo: `Genero - ${genero}`, subtitulo: "Colaboradores em restricao/acompanhamento", chave: "compativeis",
      linhas: compativeisF.filter((l) => l.Genero === genero),
    }));
  }

  function renderCompatIdade(distribuicao, compativeisF) {
    const labels = distribuicao.map((d) => d.label);
    const valores = distribuicao.map((d) => d.qtd);
    const faixas = window.BI.Calc.FAIXAS_IDADE;
    criarOuAtualizarGrafico("chart-compat-idade", {
      type: "bar",
      data: { labels, datasets: [{ data: valores, backgroundColor: window.BI.Calc.resolverCorCSS("var(--teal)"), maxBarThickness: 40, borderRadius: 4, borderSkipped: false }] },
      options: comCliqueDrillDown({
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, grid: { color: corGrid() }, border: { display: false }, ticks: { precision: 0 } },
        },
      }, (el) => {
        const faixa = faixas[el.index];
        return {
          titulo: `Idade - ${faixa.label}`, subtitulo: "Colaboradores nesta faixa etaria", chave: "compativeis",
          linhas: compativeisF.filter((l) => { const idade = Number(l.Idade) || 0; return idade >= faixa.min && idade <= faixa.max; }),
        };
      }),
    });
  }

  function renderCompatAtividade(compativeisF) {
    const itens = contagemOrdenada(window.BI.Calc.contagemPorCampo(compativeisF, "Atividade Compativel"), SIM_NAO);
    const labels = itens.map((i) => i.chave);
    const valores = itens.map((i) => i.qtd);
    const cores = labels.map((l) => window.BI.Calc.resolverCorCSS(l === "Sim" ? "var(--status-good)" : "var(--status-critical)"));
    renderDonutGenerico("chart-compat-atividade", "legenda-compat-atividade", labels, valores, cores, (valor) => ({
      titulo: `Em Atividade Compativel - ${valor}`, subtitulo: "Colaboradores em restricao/acompanhamento", chave: "compativeis",
      linhas: compativeisF.filter((l) => l["Atividade Compativel"] === valor),
    }));
  }

  function renderCompatStatusPorSetor(linhas, compativeisF) {
    const labels = linhas.map((l) => l.setor);
    const datasets = window.BI.Calc.STATUS_RESTRICAO_ORDEM.map((status) => ({
      label: status,
      data: linhas.map((l) => l[status] || 0),
      backgroundColor: window.BI.Calc.corStatus(status),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 20, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-compat-status-setor", {
      type: "bar", data: { labels, datasets },
      options: comCliqueDrillDown(opcoesBarraHorizontalEmpilhada(), (el) => {
        const setor = labels[el.index];
        const status = window.BI.Calc.STATUS_RESTRICAO_ORDEM[el.datasetIndex];
        return {
          titulo: `${setor} - ${status}`, subtitulo: "Restricoes medicas", chave: "compativeis",
          linhas: compativeisF.filter((l) => l.Setor === setor && l["Status Restricao"] === status),
        };
      }),
    });
    renderizarLegenda("legenda-compat-status-setor", window.BI.Calc.STATUS_RESTRICAO_ORDEM.map((s) => ({ label: s, cor: window.BI.Calc.corStatus(s) })));
  }

  function renderCompatRestricaoPorTurno(linhas, compativeisF) {
    const labels = linhas.map((l) => l.turno);
    const datasets = window.BI.Calc.STATUS_RESTRICAO_ORDEM.map((status) => ({
      label: status,
      data: linhas.map((l) => l[status] || 0),
      backgroundColor: window.BI.Calc.corStatus(status),
      borderColor: corSurfaceCard(), borderWidth: 2,
      maxBarThickness: 20, borderRadius: 3, borderSkipped: false,
      stack: "st",
    }));
    criarOuAtualizarGrafico("chart-compat-restricao-turno", {
      type: "bar", data: { labels, datasets },
      options: comCliqueDrillDown(opcoesBarraHorizontalEmpilhada(), (el) => {
        const turno = labels[el.index];
        const status = window.BI.Calc.STATUS_RESTRICAO_ORDEM[el.datasetIndex];
        return {
          titulo: `${turno} - ${status}`, subtitulo: "Restricoes medicas", chave: "compativeis",
          linhas: compativeisF.filter((l) => l["Turno Trabalho"] === turno && l["Status Restricao"] === status),
        };
      }),
    });
    renderizarLegenda("legenda-compat-restricao-turno", window.BI.Calc.STATUS_RESTRICAO_ORDEM.map((s) => ({ label: s, cor: window.BI.Calc.corStatus(s) })));
  }

  function renderCompatCompativelPorSetor(lista, compativeisF) {
    const mapaCores = window.BI.Calc.construirMapaCores(lista.map((s) => s.setor));
    const labels = lista.map((s) => s.setor);
    const valores = lista.map((s) => s.qtd);
    criarOuAtualizarGrafico("chart-compat-compativel-setor", {
      type: "bar",
      data: { labels, datasets: [{ data: valores, backgroundColor: labels.map((l) => mapaCores[l]), maxBarThickness: 26, borderRadius: 4, borderSkipped: false }] },
      options: comCliqueDrillDown({
        indexAxis: "y",
        scales: {
          x: { beginAtZero: true, grid: { color: corGrid() }, border: { display: false }, ticks: { precision: 0 } },
          y: { grid: { display: false }, border: { display: false } },
        },
      }, (el) => {
        const setor = labels[el.index];
        return {
          titulo: `Compativel por Setor - ${setor}`, subtitulo: 'Atividade Compativel = "Sim"', chave: "compativeis",
          linhas: compativeisF.filter((l) => l.Setor === setor && l["Atividade Compativel"] === "Sim"),
        };
      }),
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
    ligarCliqueDiagrama("diagrama-compat-frente", compativeisF, "Segmento Corporal", "compativeis");
    ligarCliqueDiagrama("diagrama-compat-costas", compativeisF, "Segmento Corporal", "compativeis");
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
  // Abas "Cadastro" (setup) e "Registro" (input) - CRUD real (grava no
  // banco do artifact via js/db.js)
  // ------------------------------------------------------------------
  // Campos-chave (hierarquia Cliente > Unidade > Setor > Cargo > Posto de
  // Trabalho > Atividade) usados nos 4 registros operacionais. Sao SEMPRE
  // selects em cascata (tipo "cascata"), validados contra as 6 tabelas do
  // cadastro-mestre (aba Cadastro) - nunca texto livre. Ver
  // ligarCascataHierarquia() mais abaixo.
  function camposChave() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Unidade", tipo: "cascata", obrigatorio: true },
      { campo: "Setor", rotulo: "Setor", tipo: "cascata", obrigatorio: true },
      { campo: "Cargo", rotulo: "Cargo", tipo: "cascata", obrigatorio: true },
      { campo: "Posto Trabalho", rotulo: "Posto de Trabalho", tipo: "cascata", obrigatorio: true },
      { campo: "Atividade", rotulo: "Atividade", tipo: "cascata", obrigatorio: true },
    ];
  }

  // Campos proprios de cada tela do cadastro-mestre (fonte unica de
  // verdade): aqui sim se cadastra um valor NOVO para aquele nivel - o
  // proprio nivel e sempre texto livre (ou o pool fixo, no caso de Setor);
  // os niveis ANCESTRAIS sao sempre selects em cascata (tipo "cascata"),
  // apontando para um registro ja cadastrado na tela do nivel anterior -
  // nunca texto livre, para nao criar uma Unidade "orfa" sem Cliente, etc.
  function camposCadastroCliente() {
    return [{ campo: "Cliente", rotulo: "Nome do Cliente (Empresa)", tipo: "texto", obrigatorio: true }];
  }
  function camposCadastroUnidade() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Nome da Unidade", tipo: "texto", obrigatorio: true },
    ];
  }
  function camposCadastroSetor() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Unidade", tipo: "cascata", obrigatorio: true },
      { campo: "Setor", rotulo: "Nome do Setor", tipo: "select", obrigatorio: true, opcoes: SETORES_POOL },
    ];
  }
  function camposCadastroCargo() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Unidade", tipo: "cascata", obrigatorio: true },
      { campo: "Setor", rotulo: "Setor", tipo: "cascata", obrigatorio: true },
      { campo: "Cargo", rotulo: "Nome do Cargo", tipo: "texto", obrigatorio: true },
    ];
  }
  function camposCadastroPosto() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Unidade", tipo: "cascata", obrigatorio: true },
      { campo: "Setor", rotulo: "Setor", tipo: "cascata", obrigatorio: true },
      { campo: "Posto Trabalho", rotulo: "Nome do Posto de Trabalho", tipo: "texto", obrigatorio: true },
    ];
  }
  function camposCadastroAtividade() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Unidade", tipo: "cascata", obrigatorio: true },
      { campo: "Setor", rotulo: "Setor", tipo: "cascata", obrigatorio: true },
      { campo: "Posto Trabalho", rotulo: "Posto de Trabalho", tipo: "cascata", obrigatorio: true },
      { campo: "Atividade", rotulo: "Nome da Atividade", tipo: "texto", obrigatorio: true },
    ];
  }

  function sugestoes(campo) {
    const chaves = ["mapaRisco", "planoAcao", "absenteismo", "compativeis"];
    const set = new Set();
    chaves.forEach((c) => (window.BI.dados[c] || []).forEach((l) => { if (l[campo]) set.add(l[campo]); }));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
  }

  // ------------------------------------------------------------------
  // Cadastro-mestre - fonte unica de verdade de Cliente > Unidade > Setor >
  // {Cargo, Posto de Trabalho > Atividade}, normalizada em 6 tabelas (uma
  // tela de cadastro por entidade - ver aba "Cadastro"). Os 4 cadastros
  // operacionais (Mapa Risco, Plano Acao, Absenteismo, Compativeis) usam
  // selects em cascata validados contra elas - nunca texto livre.
  // Cargo e Posto de Trabalho sao IRMAOS dentro do Setor (nao se
  // referenciam entre si - um cargo pode ocupar mais de um posto e
  // vice-versa; essa combinacao so existe de fato numa linha operacional).
  // Atividade e filha do Posto de Trabalho.
  // ------------------------------------------------------------------
  const NIVEIS_HIERARQUIA = ["Cliente", "Unidade", "Setor", "Cargo", "Posto Trabalho", "Atividade"];

  // Colecao do cadastro-mestre que guarda cada nivel, e os campos
  // ancestrais que identificam um registro daquele nivel (usados para
  // filtrar em cascata). Cargo e Posto Trabalho tem os MESMOS ancestrais
  // (Cliente/Unidade/Setor) e nao aparecem um na lista do outro.
  const COLECAO_DO_NIVEL = { Cliente: "cliente", Unidade: "unidade", Setor: "setor", Cargo: "cargo", "Posto Trabalho": "posto", Atividade: "atividade" };
  const ANCESTRAIS_DO_NIVEL = {
    Cliente: [],
    Unidade: ["Cliente"],
    Setor: ["Cliente", "Unidade"],
    Cargo: ["Cliente", "Unidade", "Setor"],
    "Posto Trabalho": ["Cliente", "Unidade", "Setor"],
    Atividade: ["Cliente", "Unidade", "Setor", "Posto Trabalho"],
  };

  function linhasCadastroMestre(nivel) {
    return (window.BI.dados[COLECAO_DO_NIVEL[nivel]] || []);
  }

  // Opcoes validas para `nivel`, dado o que ja foi escolhido nos niveis
  // ANCESTRAIS (valoresAtuais) - lidas diretamente da tabela do
  // cadastro-mestre daquele nivel (nao mais de uma unica tabela plana).
  function opcoesHierarquia(nivel, valoresAtuais) {
    const ancestrais = ANCESTRAIS_DO_NIVEL[nivel] || [];
    const linhas = linhasCadastroMestre(nivel);
    const filtradas = linhas.filter((l) => ancestrais.every((c) => !valoresAtuais[c] || l[c] === valoresAtuais[c]));
    const set = new Set(filtradas.map((l) => l[nivel]).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
  }

  function repopularSelectCascata(el, opcoes, valorDesejado) {
    const atual = valorDesejado != null ? valorDesejado : el.value;
    el.innerHTML = "";
    const optBranco = document.createElement("option");
    optBranco.value = "";
    optBranco.textContent = opcoes.length ? "-" : "(selecione o nivel anterior)";
    el.appendChild(optBranco);
    opcoes.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    });
    el.value = opcoes.includes(atual) ? atual : "";
  }

  function valoresAtuaisHierarquia(form) {
    const v = {};
    NIVEIS_HIERARQUIA.forEach((n) => { if (form._campos[n]) v[n] = form._campos[n].value; });
    return v;
  }

  // Recalcula as opcoes de todo nivel estritamente posterior a
  // `nivelAlterado` (na ordem de NIVEIS_HIERARQUIA). Cargo e Posto de
  // Trabalho tem o mesmo indice "logico" (ambos so dependem de Setor), mas
  // como Posto de Trabalho vem depois de Cargo em NIVEIS_HIERARQUIA, mudar
  // Cargo tambem recalcula Posto de Trabalho (e Atividade, em cascata) -
  // inofensivo, porque opcoesHierarquia("Posto Trabalho", ...) nao depende
  // de Cargo, entao o resultado e o mesmo; so evita duplicar a lista aqui.
  function atualizarCascataDeNivel(form, nivelAlterado) {
    const idxAlterado = NIVEIS_HIERARQUIA.indexOf(nivelAlterado);
    const v = valoresAtuaisHierarquia(form);
    NIVEIS_HIERARQUIA.forEach((nivel, idx) => {
      if (idx <= idxAlterado) return;
      const el = form._campos[nivel];
      if (!el) return;
      const opcoes = opcoesHierarquia(nivel, v);
      repopularSelectCascata(el, opcoes, el.value);
      v[nivel] = el.value;
    });
  }

  // Popula os 6 selects em cascata na abertura do formulario, respeitando
  // valoresIniciais (edicao de um registro existente). Se um registro
  // legado tiver uma combinacao que nao existe mais no Cadastro de
  // Hierarquia, o valor original ainda aparece (para nao "sumir" o dado),
  // mas o proximo nivel so mostra o que realmente casa com a hierarquia.
  function ligarCascataHierarquia(form, valoresIniciais) {
    const v = {};
    NIVEIS_HIERARQUIA.forEach((nivel) => {
      const el = form._campos[nivel];
      if (!el) return;
      const opcoes = opcoesHierarquia(nivel, v);
      const desejado = valoresIniciais && valoresIniciais[nivel] != null ? valoresIniciais[nivel] : "";
      const opcoesComInicial = desejado && !opcoes.includes(desejado) ? opcoes.concat([desejado]) : opcoes;
      repopularSelectCascata(el, opcoesComInicial, desejado);
      v[nivel] = el.value;
    });
    NIVEIS_HIERARQUIA.forEach((nivel) => {
      const el = form._campos[nivel];
      if (!el) return;
      el.addEventListener("change", () => atualizarCascataDeNivel(form, nivel));
    });
  }

  // Combina a ligacao da cascata de hierarquia (sempre) com a logica
  // especifica de cada cadastro operacional (ex.: calculo de Risco Global).
  function comCascata(extra) {
    return function (form, valoresIniciais) {
      ligarCascataHierarquia(form, valoresIniciais);
      if (extra) extra(form, valoresIniciais);
    };
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

  // grupo "mestre" = aba Cadastro (setup: estrutura organizacional valida);
  // grupo "registro" = aba Registro (input operacional do dia a dia).
  const CADASTROS_CONFIG = {
    cliente: {
      grupo: "mestre", icone: "🏢", tituloMenu: "Cliente",
      titulo: "Cadastro de Cliente (Empresa)",
      colunasTabela: ["Cliente"],
      colunasData: [], camposData: [],
      campos: camposCadastroCliente(),
    },
    unidade: {
      grupo: "mestre", icone: "🏭", tituloMenu: "Unidade",
      titulo: "Cadastro de Unidade",
      colunasTabela: ["Cliente", "Unidade"],
      colunasData: [], camposData: [],
      campos: camposCadastroUnidade(),
      aoConstruir: comCascata(null),
    },
    setor: {
      grupo: "mestre", icone: "🗂️", tituloMenu: "Setor",
      titulo: "Cadastro de Setor",
      colunasTabela: ["Cliente", "Unidade", "Setor"],
      colunasData: [], camposData: [],
      campos: camposCadastroSetor(),
      aoConstruir: comCascata(null),
    },
    cargo: {
      grupo: "mestre", icone: "💼", tituloMenu: "Cargo",
      titulo: "Cadastro de Cargo",
      colunasTabela: ["Cliente", "Unidade", "Setor", "Cargo"],
      colunasData: [], camposData: [],
      campos: camposCadastroCargo(),
      aoConstruir: comCascata(null),
    },
    posto: {
      grupo: "mestre", icone: "📍", tituloMenu: "Posto de Trabalho",
      titulo: "Cadastro de Posto de Trabalho",
      colunasTabela: ["Cliente", "Unidade", "Setor", "Posto Trabalho"],
      colunasData: [], camposData: [],
      campos: camposCadastroPosto(),
      aoConstruir: comCascata(null),
    },
    atividade: {
      grupo: "mestre", icone: "🏷️", tituloMenu: "Atividade",
      titulo: "Cadastro de Atividade",
      colunasTabela: ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Atividade"],
      colunasData: [], camposData: [],
      campos: camposCadastroAtividade(),
      aoConstruir: comCascata(null),
    },
    mapaRisco: {
      grupo: "registro", icone: "⚠️", tituloMenu: "Mapa de Risco",
      titulo: "Mapa de Risco (1 registro por posto de trabalho)",
      colunasTabela: ["Cliente", "Setor", "Posto Trabalho", "Cargo", "Risco Global"],
      colunasData: [],
      camposData: [],
      campos: camposChave().concat(
        window.BI.Calc ? window.BI.Calc.DIMENSOES_RISCO.map((d) => ({ campo: d, rotulo: d, tipo: "numero", obrigatorio: true, min: 1, max: 4 })) : [],
        [{ campo: "Risco Global", rotulo: "Risco Global (calculado)", tipo: "calculado" }]
      ),
      aoConstruir: comCascata(ligarCalculoRiscoGlobal),
    },
    planoAcao: {
      grupo: "registro", icone: "🛠️", tituloMenu: "Plano de Ação",
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
      aoConstruir: comCascata(ligarPlanoAcao),
    },
    absenteismo: {
      grupo: "registro", icone: "🩺", tituloMenu: "Absenteísmo",
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
      aoConstruir: comCascata(null),
    },
    compativeis: {
      grupo: "registro", icone: "🔄", tituloMenu: "Compatíveis",
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
      aoConstruir: comCascata(null),
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
      } else if (def.tipo === "cascata") {
        // Select em cascata da hierarquia Cliente>Unidade>Setor>Cargo>Posto>
        // Atividade - as opcoes sao preenchidas depois por
        // ligarCascataHierarquia() (chamada em cfg.aoConstruir), que tambem
        // conhece os valores ja escolhidos nos niveis anteriores.
        el = document.createElement("select");
        const optBranco = document.createElement("option");
        optBranco.value = ""; optBranco.textContent = "-";
        el.appendChild(optBranco);
        el.className = "select-cascata";
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
        const listaSugestoes = def.sugestoesFn ? def.sugestoesFn() : (def.sugestoesDe ? sugestoes(def.sugestoesDe) : def.sugestoesLista);
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

  // Dois grupos de cadastro, cada um com sua propria grade e sub-menu de
  // abas (mesmo padrao da aba Cadastro do Cockpit Comercial: um sub-item
  // por entidade, so um bloco visivel por vez):
  //  - "mestre"   -> aba Cadastro (setup): Cliente/Unidade/Setor/Cargo/
  //                  Posto de Trabalho/Atividade
  //  - "registro" -> aba Registro (input do dia a dia): Mapa Risco/Plano
  //                  Acao/Absenteismo/Compativeis
  const GRUPOS_CADASTRO = {
    mestre: { grade: "grade-cadastro-mestre", subnav: "subnav-cadastro-mestre" },
    registro: { grade: "grade-registro", subnav: "subnav-registro" },
  };
  const estadoSubAbaCadastro = {};

  function chavesDoGrupo(grupo) {
    return Object.keys(CADASTROS_CONFIG).filter((c) => CADASTROS_CONFIG[c].grupo === grupo);
  }

  function selecionarSubAbaCadastro(grupo, chave) {
    estadoSubAbaCadastro[grupo] = chave;
    const nav = document.getElementById(GRUPOS_CADASTRO[grupo].subnav);
    if (nav) {
      Array.from(nav.children).forEach((btn) => btn.classList.toggle("ativa", btn.dataset.chave === chave));
    }
    // Mantem a arvore do menu lateral (Cadastro/Registro) em sincronia com
    // a sub-aba escolhida, tanto por um clique la dentro quanto por um
    // clique direto no item da arvore do menu.
    const navLateral = document.getElementById("sidebar-sub-" + ABA_DO_GRUPO[grupo]);
    if (navLateral) {
      Array.from(navLateral.children).forEach((btn) => btn.classList.toggle("ativa", btn.dataset.chave === chave));
    }
    chavesDoGrupo(grupo).forEach((c) => {
      const bloco = document.getElementById("bloco-cadastro-" + c);
      if (bloco) bloco.hidden = c !== chave;
    });
  }

  // Mapeamento entre o "grupo" usado no CADASTROS_CONFIG (mestre/registro)
  // e a aba correspondente no nav principal (cadastro/registro) - os nomes
  // divergem porque a aba "Cadastro" contem os dados MESTRE.
  const ABA_DO_GRUPO = { mestre: "cadastro", registro: "registro" };
  const GRUPO_DA_ABA = { cadastro: "mestre", registro: "registro" };

  // Constroi, dentro do proprio menu lateral, a arvore retratil de
  // sub-itens de "Cadastro" (6 entidades) e "Registro" (4 tabelas) - mesmo
  // padrao de menu em arvore do Cockpit Comercial (ex.: "Comercial" abre e
  // revela "Cadastro", que abre e revela "Empresa/Contato/Oportunidade").
  // Sem caixa de selecao aqui: e so navegacao, um bloco visivel por vez -
  // a multi-selecao ja existe nos dropdowns de filtro.
  function montarSidebarSubnav() {
    Object.keys(ABA_DO_GRUPO).forEach((grupo) => {
      const aba = ABA_DO_GRUPO[grupo];
      const nav = document.getElementById("sidebar-sub-" + aba);
      if (!nav) return;
      nav.innerHTML = "";
      chavesDoGrupo(grupo).forEach((chave) => {
        const cfg = CADASTROS_CONFIG[chave];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.chave = chave;
        const icone = document.createElement("span");
        icone.className = "icone";
        icone.textContent = cfg.icone || "";
        const rotulo = document.createElement("span");
        rotulo.className = "rotulo";
        rotulo.textContent = cfg.tituloMenu || cfg.titulo;
        btn.appendChild(icone);
        btn.appendChild(rotulo);
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          ativarAba(aba);
          selecionarSubAbaCadastro(grupo, chave);
          fecharSidebarMobile();
        });
        nav.appendChild(btn);
      });
      // montarCadastros() ja rodou e escolheu a 1a sub-aba de cada grupo
      // antes deste menu lateral existir - sincroniza o estado "ativa" aqui.
      const chaveAtual = estadoSubAbaCadastro[grupo];
      if (chaveAtual) {
        Array.from(nav.children).forEach((btn) => btn.classList.toggle("ativa", btn.dataset.chave === chaveAtual));
      }
    });
  }

  // Expande/recolhe a arvore de um grupo (cadastro/registro) no menu
  // lateral. So um grupo fica aberto por vez (accordion), como no Cockpit.
  function expandirGrupoSidebar(aba, forcarAberto) {
    document.querySelectorAll(".sidebar-nav-grupo").forEach((grupoEl) => {
      const ehEsteGrupo = grupoEl.dataset.grupoNav === aba;
      const abrir = ehEsteGrupo && (forcarAberto !== false);
      grupoEl.classList.toggle("expandido", ehEsteGrupo ? abrir : false);
      // O atributo "hidden" (usado no HTML para nao piscar a lista antes do
      // JS carregar) tem prioridade sobre display:flex por classe no CSS
      // padrao do navegador - por isso precisa ser removido/reposto aqui
      // tambem, em vez de confiar so na classe "expandido".
      const sub = grupoEl.querySelector(".sidebar-subnav-lateral");
      if (sub) sub.hidden = !abrir;
    });
  }

  function montarSubNavCadastro(grupo) {
    const nav = document.getElementById(GRUPOS_CADASTRO[grupo].subnav);
    if (!nav) return;
    nav.innerHTML = "";
    chavesDoGrupo(grupo).forEach((chave) => {
      const cfg = CADASTROS_CONFIG[chave];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "subnav-cadastro-item";
      btn.dataset.chave = chave;
      const icone = document.createElement("span");
      icone.className = "icone";
      icone.textContent = cfg.icone || "";
      const rotulo = document.createElement("span");
      rotulo.className = "rotulo";
      rotulo.textContent = cfg.tituloMenu || cfg.titulo;
      btn.appendChild(icone);
      btn.appendChild(rotulo);
      btn.addEventListener("click", () => selecionarSubAbaCadastro(grupo, chave));
      nav.appendChild(btn);
    });
  }

  function montarCadastros() {
    Object.keys(GRUPOS_CADASTRO).forEach((grupo) => {
      const grade = document.getElementById(GRUPOS_CADASTRO[grupo].grade);
      if (grade) grade.innerHTML = "";
    });

    Object.keys(CADASTROS_CONFIG).forEach((chave) => {
      estadoCadastro[chave] = estadoCadastro[chave] || { formAberto: false, editandoId: null, busca: "", pagina: 1, valoresForm: null };
      const cfg = CADASTROS_CONFIG[chave];
      const grade = document.getElementById(GRUPOS_CADASTRO[cfg.grupo].grade);
      if (!grade) return;

      const cartao = document.createElement("div");
      cartao.className = "cartao col-12 bloco-cadastro";
      cartao.id = "bloco-cadastro-" + chave;

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

    Object.keys(GRUPOS_CADASTRO).forEach((grupo) => {
      montarSubNavCadastro(grupo);
      const primeira = estadoSubAbaCadastro[grupo] || chavesDoGrupo(grupo)[0];
      if (primeira) selecionarSubAbaCadastro(grupo, primeira);
    });

    atualizarBotoesSomenteLeitura();
  }

  function atualizarBotoesSomenteLeitura() {
    const disponivel = window.BI.DB.estado.disponivel;
    ["aviso-somente-leitura-cadastro", "aviso-somente-leitura-registro"].forEach((id) => {
      const aviso = document.getElementById(id);
      if (aviso) aviso.hidden = disponivel;
    });
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
    window.BI.Calc.DIMENSOES.forEach((d) => { if (filtros[d] && filtros[d].length === 1) prefill[d] = filtros[d][0]; });
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
        // mapaRisco e as 6 tabelas do cadastro-mestre tem id derivado dos
        // proprios campos (chave composta) - editar um campo-chave "renomeia"
        // o registro (salva no novo id, exclui o antigo). Os demais
        // cadastros (planoAcao/absenteismo/compativeis) mantem o id gerado
        // automaticamente na criacao.
        const geradorId = chave === "mapaRisco" ? window.BI.DB.idMapaRisco : window.BI.DB.idCadastroMestre[chave];
        if (geradorId) {
          const novoId = geradorId(dados);
          await window.BI.DB.salvar(chave, novoId, dados);
          if (idAtual && idAtual !== novoId) await window.BI.DB.excluir(chave, idAtual);
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
  // Menu lateral (retratil): no desktop recolhe para so-icones (preferencia
  // lembrada por viewer via localStorage - conveniencia local, nao afeta
  // outros usuarios nem e lida de volta pelo Claude); em telas estreitas
  // vira uma gaveta deslizante com overlay, aberta pelo botao de hamburguer.
  // ------------------------------------------------------------------
  function lerPreferenciaSidebarRecolhida() {
    try {
      return localStorage.getItem("bi-ergonomia-sidebar-recolhida") === "1";
    } catch (e) {
      return false;
    }
  }
  function salvarPreferenciaSidebarRecolhida(recolhida) {
    try {
      localStorage.setItem("bi-ergonomia-sidebar-recolhida", recolhida ? "1" : "0");
    } catch (e) {
      // localStorage indisponivel nesta visualizacao - segue sem lembrar a preferencia
    }
  }

  function fecharSidebarMobile() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (sidebar) sidebar.classList.remove("aberto-mobile");
    if (overlay) overlay.hidden = true;
  }

  function configurarSidebar() {
    const sidebar = document.getElementById("sidebar");
    const btnRecolher = document.getElementById("btn-recolher-sidebar");
    const btnAbrirMobile = document.getElementById("btn-abrir-sidebar-mobile");
    const btnFecharMobile = document.getElementById("btn-fechar-sidebar-mobile");
    const overlay = document.getElementById("sidebar-overlay");
    if (!sidebar) return;

    function aplicarEstadoRecolhido(recolhida) {
      sidebar.classList.toggle("recolhido", recolhida);
      if (btnRecolher) {
        btnRecolher.setAttribute("aria-expanded", String(!recolhida));
        // So um icone (setinha) - sem texto visivel (pedido do Leo), mas
        // aria-label/title continuam descritivos pra acessibilidade/tooltip.
        const texto = recolhida ? "Expandir menu" : "Recolher menu";
        btnRecolher.setAttribute("aria-label", texto);
        btnRecolher.setAttribute("title", texto);
      }
    }

    aplicarEstadoRecolhido(lerPreferenciaSidebarRecolhida());

    if (btnRecolher) {
      btnRecolher.addEventListener("click", () => {
        const agoraRecolhida = !sidebar.classList.contains("recolhido");
        aplicarEstadoRecolhido(agoraRecolhida);
        salvarPreferenciaSidebarRecolhida(agoraRecolhida);
      });
    }
    if (btnAbrirMobile) {
      btnAbrirMobile.addEventListener("click", () => {
        sidebar.classList.add("aberto-mobile");
        if (overlay) overlay.hidden = false;
      });
    }
    if (btnFecharMobile) btnFecharMobile.addEventListener("click", fecharSidebarMobile);
    if (overlay) overlay.addEventListener("click", fecharSidebarMobile);
  }

  // ------------------------------------------------------------------
  // Navegacao entre abas (Ergo / Cadastros / Med Ocup / Compativeis) e o
  // link do rodape que abre/fecha o painel de Referencia (fora do nav)
  // ------------------------------------------------------------------
  let abaVisivelAntesDeReferencia = "aba-ergo";

  // Ativa uma aba principal (ergo/medocup/compativeis/cadastro/registro) -
  // extraido do handler de clique do nav para poder ser chamado tambem
  // pelos itens da arvore do menu lateral (Cadastro > Setor, por ex.),
  // que precisam trocar de aba e escolher a sub-aba num so passo. Ao
  // trocar de fato de aba, a arvore retratil correspondente (Cadastro/
  // Registro) abre sozinha e a outra recolhe - navegar para Ergo/Med
  // Ocup/Compativeis recolhe as duas.
  function ativarAba(aba) {
    const nav = document.getElementById("nav-abas");
    const botoes = Array.from(nav.querySelectorAll("button[data-aba]"));
    const btn = botoes.find((b) => b.dataset.aba === aba);
    if (!btn || btn.disabled) return;
    botoes.forEach((b) => b.classList.toggle("ativa", b === btn));
    const alvo = "aba-" + aba;
    document.querySelectorAll('main > section[id^="aba-"]').forEach((sec) => {
      sec.hidden = sec.id !== alvo;
    });
    const btnRef = document.getElementById("btn-toggle-referencia");
    if (btnRef) btnRef.textContent = "Ver tabelas de referencia";
    atualizarEstadoExportacao();
    expandirGrupoSidebar(GRUPO_DA_ABA[aba] ? aba : null);
  }

  function configurarAbas() {
    const nav = document.getElementById("nav-abas");
    const botoes = Array.from(nav.querySelectorAll("button[data-aba]"));
    botoes.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const aba = btn.dataset.aba;
        const jaAtiva = btn.classList.contains("ativa");
        const grupoNav = btn.closest(".sidebar-nav-grupo");
        if (grupoNav && jaAtiva) {
          // Clicar de novo no mesmo item que ja tem arvore (Cadastro/
          // Registro) so alterna abrir/fechar a arvore - o gesto
          // "reclinavel" do Cockpit - sem mexer na aba, que ja esta ativa.
          expandirGrupoSidebar(aba, !grupoNav.classList.contains("expandido"));
        } else {
          ativarAba(aba);
        }
        fecharSidebarMobile();
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
      atualizarEstadoExportacao();
    });
  }

  // ------------------------------------------------------------------
  // Exportar relatorio (PDF/Excel) da TELA ATUAL, respeitando os filtros
  // ativos (globais e, quando houver, os de pagina). PDF = KPIs + graficos
  // da aba aberta; Excel = tabela(s) de dados brutos filtrados dessa aba.
  // So disponivel nas 3 abas de dashboard (Ergo / Med Ocup / Compativeis).
  // ------------------------------------------------------------------
  const TITULOS_ABA = { ergo: "Dashboard Ergo", medocup: "Dashboard Med Ocup", compativeis: "Dashboard Compativeis" };
  const TABELAS_POR_ABA = { ergo: ["mapaRisco", "planoAcao"], medocup: ["absenteismo"], compativeis: ["compativeis"] };
  const NOMES_PLANILHA = { mapaRisco: "Mapa Risco", planoAcao: "Plano Acao", absenteismo: "Absenteismo", compativeis: "Compativeis" };

  function abaAtualChave() {
    const btn = document.querySelector('#nav-abas button[data-aba].ativa');
    return btn ? btn.dataset.aba : null;
  }

  function resumoFiltrosAtivos() {
    const partes = [];
    ORDEM_FILTROS.forEach((campo) => {
      const vals = (window.BI.filtros || {})[campo];
      if (vals && vals.length) partes.push(`${LABELS_FILTRO[campo] || campo}: ${vals.join(", ")}`);
    });
    const fp = window.BI.filtrosPagina || {};
    Object.keys(fp).forEach((campo) => {
      if (fp[campo] && fp[campo].length) partes.push(`${campo}: ${fp[campo].join(", ")}`);
    });
    return partes.length ? partes.join("  |  ") : "Nenhum filtro ativo (todos os dados)";
  }

  function atualizarEstadoExportacao() {
    const referenciaEl = document.getElementById("aba-referencia");
    const referenciaAberta = referenciaEl ? !referenciaEl.hidden : false;
    const chave = abaAtualChave();
    const habilitado = !referenciaAberta && !!TITULOS_ABA[chave];
    ["btn-exportar-pdf", "btn-exportar-excel"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !habilitado;
    });
  }

  // Linhas de dados filtradas de um cadastro, aplicando os mesmos filtros
  // globais (e, no caso de Compativeis, os filtros de pagina) usados pelos
  // graficos - garante que a exportacao reflita exatamente o que esta na
  // tela.
  function linhasFiltradasParaExportar(chaveTabela) {
    const cfg = CADASTROS_CONFIG[chaveTabela];
    let linhas = window.BI.Calc.filtrar(window.BI.dados[chaveTabela] || [], window.BI.filtros, cfg.camposData);
    if (chaveTabela === "compativeis") linhas = aplicarFiltrosPagina(linhas);
    return linhas;
  }

  function exportarExcel() {
    const chave = abaAtualChave();
    const chavesTabela = TABELAS_POR_ABA[chave];
    if (!chavesTabela) return;
    if (typeof XLSX === "undefined") {
      mostrarErro("A biblioteca de exportacao Excel nao carregou (script externo bloqueado ou indisponivel).");
      return;
    }
    const wb = XLSX.utils.book_new();
    chavesTabela.forEach((chaveTabela) => {
      const linhas = linhasFiltradasParaExportar(chaveTabela).map((l) => {
        const copia = Object.assign({}, l);
        delete copia._id;
        return copia;
      });
      const ws = XLSX.utils.json_to_sheet(linhas);
      XLSX.utils.book_append_sheet(wb, ws, NOMES_PLANILHA[chaveTabela] || chaveTabela);
    });
    const dataArquivo = hojeMeiaNoite().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `bi-ergonomia-${chave}-${dataArquivo}.xlsx`);
  }

  // Reamostra um canvas (grafico Chart.js ja renderizado, ou diagrama SVG
  // rasterizado) para uma LARGURA FIXA em pixels antes de exportar como PNG
  // - o canvas de origem pode estar em qualquer resolucao (varia com a
  // largura da tela do usuario / devicePixelRatio), e sem esse teto o PDF
  // fica com dezenas de MB. 700px de largura e nitido o suficiente para
  // impressao no tamanho em que a imagem entra na pagina.
  function reamostrarCanvas(canvasOrigem, larguraMaximaPx, formato, qualidade) {
    // Nunca amplia (deixaria a imagem borrada e MAIOR em bytes) - so limita
    // o teto quando a origem for maior que o alvo.
    const larguraAlvoPx = Math.min(larguraMaximaPx, canvasOrigem.width);
    const escala = larguraAlvoPx / canvasOrigem.width;
    const alturaAlvoPx = Math.max(1, Math.round(canvasOrigem.height * escala));
    const tmp = document.createElement("canvas");
    tmp.width = larguraAlvoPx;
    tmp.height = alturaAlvoPx;
    const ctx = tmp.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvasOrigem, 0, 0, tmp.width, tmp.height);
    return tmp.toDataURL(formato || "image/jpeg", qualidade);
  }

  // Graficos (Chart.js) exportam como JPEG - fundo solido, formas simples,
  // bem mais leve que PNG sem perda perceptivel de qualidade.
  function reamostrarCanvasParaJpeg(canvasOrigem, larguraMaximaPx) {
    return reamostrarCanvas(canvasOrigem, larguraMaximaPx, "image/jpeg", 0.88);
  }

  // Rasteriza um <svg> autocontido (diagrama corporal) para PNG, resolvendo
  // "currentColor" para uma cor fixa antes de serializar - fora do DOM da
  // pagina o navegador nao teria de onde herdar essa cor. Usa PNG (nao
  // JPEG) porque os diagramas tem texto pequeno em caixas solidas - JPEG
  // borraria esses rotulos a ponto de ficarem ilegiveis no PDF.
  function svgParaPngDataUrl(svgEl, larguraAlvoPx) {
    return new Promise((resolve, reject) => {
      try {
        const vb = svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.width
          ? svgEl.viewBox.baseVal
          : { width: svgEl.clientWidth || 300, height: svgEl.clientHeight || 400 };
        const clone = svgEl.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.style.color = window.BI.Calc.resolverCorCSS("var(--texto-principal)") || "#222222";
        const svgStr = new XMLSerializer().serializeToString(clone);
        const svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
        const img = new Image();
        img.onload = () => {
          const larguraOrigem = Math.max(1, Math.round(vb.width * 2.4));
          const alturaOrigem = Math.max(1, Math.round(vb.height * 2.4));
          const origem = document.createElement("canvas");
          origem.width = larguraOrigem;
          origem.height = alturaOrigem;
          const ctxOrigem = origem.getContext("2d");
          ctxOrigem.fillStyle = "#ffffff";
          ctxOrigem.fillRect(0, 0, larguraOrigem, alturaOrigem);
          ctxOrigem.drawImage(img, 0, 0, larguraOrigem, alturaOrigem);
          resolve(reamostrarCanvas(origem, Math.min(larguraAlvoPx || 600, larguraOrigem), "image/png"));
        };
        img.onerror = () => reject(new Error("Falha ao carregar SVG para rasterizacao"));
        img.src = svgDataUrl;
      } catch (e) {
        reject(e);
      }
    });
  }

  // Extrai um texto simples e legivel dos "tiles" de KPI (grade-status /
  // grade-totais), linha a linha, para reproduzir esses numeros no PDF sem
  // reimplementar o layout visual.
  function extrairTextoTiles(tilesEl) {
    return (tilesEl.innerText || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  async function exportarPDF() {
    const chave = abaAtualChave();
    if (!TITULOS_ABA[chave]) return;
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) {
      mostrarErro("A biblioteca de exportacao PDF nao carregou (script externo bloqueado ou indisponivel).");
      return;
    }
    const secao = document.getElementById("aba-" + chave);
    if (!secao) return;

    const doc = new jsPDFCtor({ unit: "pt", format: "a4" });
    const margem = 36;
    const larguraPagina = doc.internal.pageSize.getWidth();
    const alturaPagina = doc.internal.pageSize.getHeight();
    const larguraUtil = larguraPagina - margem * 2;
    let y = margem;

    function novaPagina() { doc.addPage(); y = margem; }
    function garantirEspaco(altura) { if (y + altura > alturaPagina - margem) novaPagina(); }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(46, 95, 98);
    doc.text("BI Ergonomia - ElevaLife", margem, y);
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(TITULOS_ABA[chave], margem, y);
    y += 14;
    doc.text("Gerado em " + new Date().toLocaleString("pt-BR"), margem, y);
    y += 14;
    doc.setFontSize(9);
    const linhasFiltro = doc.splitTextToSize("Filtros ativos: " + resumoFiltrosAtivos(), larguraUtil);
    doc.text(linhasFiltro, margem, y);
    y += linhasFiltro.length * 11 + 6;
    doc.setDrawColor(220, 220, 220);
    doc.line(margem, y, margem + larguraUtil, y);
    y += 16;

    const cartoes = Array.from(secao.querySelectorAll(".cartao"));
    for (const cartao of cartoes) {
      const tituloEl = cartao.querySelector(".cartao-titulo");
      const subEl = cartao.querySelector(".cartao-sub");
      const titulo = tituloEl ? tituloEl.textContent.trim() : "";
      const sub = subEl ? subEl.textContent.trim() : "";

      garantirEspaco(50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text(titulo, margem, y);
      y += 14;
      if (sub) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(sub, margem, y);
        y += 12;
      }

      const tilesEl = cartao.querySelector(".grade-status, .grade-totais");
      if (tilesEl) {
        const linhasTexto = extrairTextoTiles(tilesEl);
        garantirEspaco(linhasTexto.length * 12 + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        linhasTexto.forEach((linha) => { doc.text(linha, margem + 8, y); y += 12; });
      }

      const canvas = cartao.querySelector("canvas");
      if (canvas && registroGraficos[canvas.id]) {
        const imgData = reamostrarCanvasParaJpeg(canvas, 700);
        const larguraImg = Math.min(larguraUtil, 380);
        const alturaImg = larguraImg * (canvas.height / canvas.width || 0.6);
        garantirEspaco(alturaImg + 10);
        doc.addImage(imgData, "JPEG", margem, y, larguraImg, alturaImg);
        y += alturaImg + 8;
        const legendaEl = cartao.querySelector(".legenda");
        if (legendaEl && legendaEl.textContent.trim()) {
          const linhasLeg = doc.splitTextToSize(legendaEl.textContent.trim().replace(/\s+/g, "  "), larguraUtil);
          garantirEspaco(linhasLeg.length * 11 + 4);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(90, 90, 90);
          doc.text(linhasLeg, margem, y);
          y += linhasLeg.length * 11 + 4;
        }
      }

      const svgsDiagrama = Array.from(cartao.querySelectorAll(".figura-diagrama svg"));
      for (const svg of svgsDiagrama) {
        try {
          const imgData = await svgParaPngDataUrl(svg, 600);
          const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : { width: 300, height: 420 };
          const larguraImg = Math.min(larguraUtil, 260);
          const alturaImg = larguraImg * (vb.height / vb.width);
          garantirEspaco(alturaImg + 8);
          doc.addImage(imgData, "PNG", margem, y, larguraImg, alturaImg);
          y += alturaImg + 8;
        } catch (e) {
          console.warn("BI Ergonomia - falha ao rasterizar diagrama para o PDF:", e);
        }
      }

      y += 10;
    }

    const dataArquivo = hojeMeiaNoite().toISOString().slice(0, 10);
    doc.save(`bi-ergonomia-${chave}-${dataArquivo}.pdf`);
  }

  function configurarExportacao() {
    const btnPdf = document.getElementById("btn-exportar-pdf");
    const btnExcel = document.getElementById("btn-exportar-excel");
    if (btnPdf) {
      btnPdf.addEventListener("click", () => {
        exportarPDF().catch((e) => mostrarErro("Erro ao gerar PDF: " + (e && e.message ? e.message : String(e))));
      });
    }
    if (btnExcel) {
      btnExcel.addEventListener("click", () => {
        try { exportarExcel(); } catch (e) { mostrarErro("Erro ao gerar Excel: " + (e && e.message ? e.message : String(e))); }
      });
    }
    atualizarEstadoExportacao();
  }

  // Botao funil "Filtros" (recolhe/expande a barra de filtros, igual ao
  // botao "Filtros" do menu do Cockpit Comercial) e botao "Atualizar"
  // (re-renderiza tudo com os dados/filtros atuais) na barra superior.
  function configurarBarraSuperior() {
    const btnFiltros = document.getElementById("btn-toggle-filtros");
    const barraFiltros = document.getElementById("barra-filtros");
    if (btnFiltros && barraFiltros) {
      btnFiltros.addEventListener("click", () => {
        const agoraAberta = barraFiltros.classList.toggle("recolhida") === false;
        btnFiltros.setAttribute("aria-expanded", String(agoraAberta));
      });
    }
    const btnAtualizar = document.getElementById("btn-atualizar");
    if (btnAtualizar) {
      btnAtualizar.addEventListener("click", () => {
        try { renderizarTudo(); } catch (e) { mostrarErro("Erro ao atualizar: " + (e && e.message ? e.message : String(e))); }
      });
    }
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

    const planoAcaoFCriticos = planoAcaoF.filter((a) => a["Risco Global"] === "Alto" || a["Risco Global"] === "Muito Alto");

    renderTilesRiscoGlobal(Calc.mapaRiscoGlobal(mapaRiscoF), mapaRiscoF);
    renderTopSetores(Calc.topSetores(mapaRiscoF, 3), mapaRiscoF);
    renderDonutStatus("chart-plano-global", "legenda-plano-global", Calc.statusPlanoAcao(planoAcaoF, hoje), planoAcaoF, hoje);
    renderDonutStatus("chart-plano-criticos", "legenda-plano-criticos", Calc.planoAcaoPostosCriticos(planoAcaoF, hoje), planoAcaoFCriticos, hoje);
    renderLinhaMensal("chart-acoes-previstas", Calc.serieMensal(planoAcaoFPrevistas, "Dt Programada"), "Acoes previstas", Calc.resolverCorCSS("var(--teal)"), planoAcaoFPrevistas, "Dt Programada");
    renderLinhaMensal("chart-acoes-concluidas", Calc.serieMensal(planoAcaoFConcluidas, "Dt Conclusao"), "Acoes concluidas", Calc.resolverCorCSS("var(--vinho-medio)"), planoAcaoFConcluidas, "Dt Conclusao");
    renderPorResponsavel(Calc.planoAcaoPorResponsavel(planoAcaoF, hoje), planoAcaoF, hoje);
    renderStatusPorSetor(Calc.statusPlanoAcaoPorSetor(planoAcaoF, hoje), planoAcaoF, hoje);
    renderRiscoPorSetor(Calc.mapaRiscoPorSetor(mapaRiscoF), mapaRiscoF);

    const diasUteisF = Calc.filtrar(window.BI.dados.diasUteis, filtros, ["Ano/Mes Uteis"]);
    const absenteismoF = Calc.filtrar(window.BI.dados.absenteismo, filtros, ["Dt Afastamento"]);
    renderTotaisMedOcup(Calc.totaisMedOcup(absenteismoF, diasUteisF));
    renderEvolucaoTaxa(Calc.evolucaoTaxaFrequencia(absenteismoF, diasUteisF), absenteismoF);
    renderTaxaPorSetor(Calc.taxaFrequenciaPorSetor(absenteismoF, diasUteisF), absenteismoF);
    renderDiagramasMedOcup(absenteismoF);

    const compativeisGlobalF = Calc.filtrar(window.BI.dados.compativeis, filtros, []);
    const compativeisF = aplicarFiltrosPagina(compativeisGlobalF);
    renderCompatGenero(compativeisF);
    renderCompatIdade(Calc.distribuicaoIdade(compativeisF), compativeisF);
    renderCompatStatusPorSetor(Calc.statusRestricaoPorSetor(compativeisF), compativeisF);
    renderCompatRestricaoPorTurno(Calc.statusRestricaoPorTurno(compativeisF), compativeisF);
    renderDiagramasCompativeis(compativeisF);
    renderCompatAtividade(compativeisF);
    renderCompatCompativelPorSetor(Calc.compativelPorSetor(compativeisF), compativeisF);

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
      // Cada campo guarda um ARRAY de valores selecionados (multi-selecao);
      // array vazio = "Todos". Este objeto e compartilhado por Ergo/Med
      // Ocup/Compativeis - o filtro selecionado vale para todas as telas.
      window.BI.filtros = {
        Cliente: [], Unidade: [], Setor: [],
        "Posto Trabalho": [], Cargo: [], Atividade: [], Ano: [], Mes: [],
      };
      window.BI.filtrosPagina = { "Status Restricao": [], "Turno Trabalho": [] };

      const spanData = document.getElementById("data-geracao");
      if (spanData) spanData.textContent = formatarDataBR(dados._meta.gerado_em) + ` (referencia de calculo: ${formatarDataBR(hojeMeiaNoite().toISOString().slice(0, 10))})`;

      configurarChartDefaults();
      montarBarraFiltros();
      atualizarOpcoesFiltros();
      montarFiltrosPagina();
      montarAbaReferencia();
      montarCadastros();
      montarSidebarSubnav();
      configurarSidebar();
      configurarAbas();
      configurarToggleReferencia();
      configurarExportacao();
      configurarBarraSuperior();
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
