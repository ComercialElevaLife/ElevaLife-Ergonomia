/* ==========================================================================
   BI Ergonomia - ElevaLife
   CAMADA DE APRESENTACAO (filtros, graficos, tooltips, cadastros reais).
   Le window.BI.dados (mock estatico + colecoes do banco via js/db.js) e usa
   as funcoes puras de window.BI.Calc (js/calc.js) - nunca acessa o mock
   diretamente dentro das funcoes de calculo.
   ========================================================================== */

(function () {
  "use strict";

  // Texto de EXIBICAO com acentuacao correta (ver js/rotulos.js). Nunca usar
  // em chave de dado (nome de campo/valor gravado) - so no que vai pra tela.
  const T = (s) => (window.BI && window.BI.Rotulos ? window.BI.Rotulos.texto(s) : s);

  const ORDEM_FILTROS = ["Ano", "Mes", "Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade"];
  const LABELS_FILTRO = {
    "Ano": "Ano", "Mes": "Mês", "Cliente": "Cliente", "Unidade": "Unidade", "Setor": "Setor",
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
  const STATUS_EXECUCAO_POOL = [
    { valor: "Nao iniciada", label: "Não iniciada" },
    { valor: "Em andamento", label: "Em andamento" },
    { valor: "Concluida", label: "Concluída" },
  ];
  const GENEROS_POOL = ["Masculino", "Feminino"];
  // UFs do Brasil (cadastro ampliado de empresa - ver camposCadastroCliente)
  // e os 4 graus de risco da NR-4 (Quadro I), usado tambem pra dimensionar
  // CIPA/PPRA no sistema de gestao atual da ElevaLife.
  const ESTADOS_BR = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
  const GRAUS_RISCO_NR4 = ["1", "2", "3", "4"];
  // Pools do pacote "Sistema de Gestao Integrada" (Avaliacao Ergonomica,
  // Inventario de Riscos, Laudos - ver docs/bi-ergonomia-manual.md). Status
  // e Tipo de Laudo seguem o vocabulario visto no sistema legado.
  const STATUS_FATOR_RISCO_POOL = ["A validar", "Em andamento", "Concluido", "Cancelado"];
  const SLA_POOL = ["24 horas", "48 horas", "7 dias", "15 dias", "30 dias", "60 dias", "90 dias"];
  const TIPOS_LAUDO_POOL = ["Laudo", "Certificado de Calibracao"];
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

  // Tabelas de referencia (estaticas, so consulta) - so Lista CID (Dias
  // Uteis/HHT virou colecao de Registro normal em 28/09/2026 - ver
  // CADASTROS_CONFIG.diasUteis abaixo - porque uma tabela de referencia
  // fixa so cobria as empresas ficticias originais).
  const TABELAS_REFERENCIA = [
    { chave: "listaCID", titulo: "Lista CID", camposData: [] },
  ];
  const estadoTabelasRef = {};

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

  function hojeMeiaNoite() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Comparador usado na ordenacao das tabelas de Registro (clicar no
  // cabecalho da coluna) - datas em formato ISO (yyyy-mm-dd) comparam
  // certinho so com < / > (texto), numeros comparam como numero, e o
  // resto cai pro alfabetico (pt-BR, sem diferenciar maiusc./minusc.).
  function compararValoresTabela(a, b, ehData) {
    if (ehData) {
      const av = a || "", bv = b || "";
      return av < bv ? -1 : av > bv ? 1 : 0;
    }
    const an = Number(a), bn = Number(b);
    const ambosNumericos = a !== "" && a !== null && a !== undefined && b !== "" && b !== null && b !== undefined && !Number.isNaN(an) && !Number.isNaN(bn);
    if (ambosNumericos) return an - bn;
    return String(a === null || a === undefined ? "" : a).localeCompare(String(b === null || b === undefined ? "" : b), "pt-BR", { sensitivity: "base" });
  }

  function formatarDataBR(iso) {
    if (!iso) return "-";
    return BI.Datas ? BI.Datas.isoParaBR(iso) : String(iso);
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
      t.textContent = T(tooltip.title.join(" "));
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
      rotulo.textContent = T(nomeSerie);

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
    // Rotulos dos eixos com acentuacao (so exibicao; os dados continuam
    // com as chaves originais, usadas no clique/drill-down).
    if (Chart.defaults.scales && Chart.defaults.scales.category) {
      Chart.defaults.scales.category.ticks = Chart.defaults.scales.category.ticks || {};
      Chart.defaults.scales.category.ticks.callback = function (valor) {
        const rotulo = this.getLabelForValue(valor);
        return Array.isArray(rotulo) ? rotulo.map(T) : T(rotulo);
      };
    }

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
  // painel com o detalhamento das linhas brutas por tras daquele numero -
  // reaproveita as MESMAS colunas ja definidas em CADASTROS_CONFIG (chave
  // "mapaRisco"/"planoAcao"/"absenteismo"/"compativeis") para nao duplicar
  // a forma de exibir cada tabela. Pedido do Leo: em vez do popover pequeno
  // que abria colado no clique, um painel maior deslizando da direita pra
  // esquerda (mesmo padrao visual/interacao do painel de Filtros - overlay
  // escurecido atras, ESC ou clique fora fecha).
  // ------------------------------------------------------------------
  let elDrillDown = null;
  let elOverlayDrillDown = null;

  function obterPainelDrillDown() {
    if (elDrillDown) return elDrillDown;

    const overlay = document.createElement("div");
    overlay.className = "overlay-drilldown";
    overlay.id = "overlay-drilldown";
    overlay.hidden = true;
    document.body.appendChild(overlay);
    elOverlayDrillDown = overlay;

    const painel = document.createElement("aside");
    painel.className = "drilldown-painel";
    painel.id = "drilldown-painel";
    painel.setAttribute("aria-hidden", "true");
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
    // Botao "tela cheia" (pedido do Leo 28/09/2026: a area de visualizacao
    // do drill-down fica ruim, cheia de scroll - alterna so a largura do
    // painel entre 640px e 100vw, pra tabelas/graficos largos precisarem
    // de bem menos scroll horizontal).
    const btnExpandir = document.createElement("button");
    btnExpandir.type = "button";
    btnExpandir.className = "drilldown-expandir";
    btnExpandir.setAttribute("aria-label", "Expandir para tela cheia");
    btnExpandir.title = "Tela cheia";
    btnExpandir.textContent = "⛶";
    btnExpandir.addEventListener("click", () => {
      const cheia = painel.classList.toggle("tela-cheia");
      btnExpandir.setAttribute("aria-label", cheia ? "Sair da tela cheia" : "Expandir para tela cheia");
      btnExpandir.title = cheia ? "Sair da tela cheia" : "Tela cheia";
      btnExpandir.textContent = cheia ? "⤡" : "⛶";
    });
    const btnFechar = document.createElement("button");
    btnFechar.type = "button";
    btnFechar.className = "drilldown-fechar";
    btnFechar.setAttribute("aria-label", "Fechar detalhamento");
    btnFechar.textContent = "×";
    btnFechar.addEventListener("click", fecharDrillDown);
    const acoes = document.createElement("div");
    acoes.className = "drilldown-acoes";
    acoes.appendChild(btnExpandir);
    acoes.appendChild(btnFechar);
    cab.appendChild(titulos);
    cab.appendChild(acoes);
    const corpo = document.createElement("div");
    corpo.className = "drilldown-corpo";
    corpo.id = "drilldown-corpo";
    painel.appendChild(cab);
    painel.appendChild(corpo);
    document.body.appendChild(painel);
    elDrillDown = painel;
    return painel;
  }

  function drillDownAberto() {
    return !!elDrillDown && elDrillDown.classList.contains("aberto");
  }

  function fecharDrillDown() {
    if (elDrillDown) { elDrillDown.classList.remove("aberto"); elDrillDown.setAttribute("aria-hidden", "true"); }
    if (elOverlayDrillDown) elOverlayDrillDown.hidden = true;
  }

  document.addEventListener("click", (ev) => {
    if (!drillDownAberto()) return;
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
    else if ((col === "Risco Global" || col === "Graduacao Risco") && v) v = window.BI.Calc.rotuloNivel(v);
    return v === null || v === undefined || v === "" ? "-" : T(String(v));
  }

  // Mesma celula de cima, mas devolvendo um NO pronto pra por na tabela: se o
  // valor bruto da coluna tem cor definida em Calc.COR_STATUS (Risco Global,
  // Graduacao Risco, Status do Inventario de Riscos, Status Restricao etc.),
  // desenha uma "pill" com pontinho colorido - a MESMA cor usada nos graficos
  // do dashboard, pra classificacao ficar visualmente conectada em qualquer
  // tela (pedido do Leo). Sem lista de nomes de coluna aqui: quem decide e
  // Calc.temCorStatus, olhando o valor bruto.
  function noCelula(col, linha, colunasData) {
    const bruto = linha[col];
    const texto = celulaFormatada(col, linha, colunasData);
    if (texto !== "-" && bruto && window.BI.Calc.temCorStatus(bruto)) {
      const span = document.createElement("span");
      span.className = "celula-status";
      const ponto = document.createElement("span");
      ponto.className = "ponto";
      ponto.style.background = window.BI.Calc.corStatus(bruto);
      span.appendChild(ponto);
      span.appendChild(document.createTextNode(texto));
      return span;
    }
    return document.createTextNode(texto);
  }

  // Idem, mas pro valor de "Status Acao" (Plano de Acao) - calculado em
  // runtime, nao existe direto na linha (por isso nao passa por noCelula).
  function noCelulaStatusAcao(statusCalculado) {
    const span = document.createElement("span");
    span.className = "celula-status";
    const ponto = document.createElement("span");
    ponto.className = "ponto";
    ponto.style.background = window.BI.Calc.corStatus(statusCalculado);
    span.appendChild(ponto);
    span.appendChild(document.createTextNode(T(statusCalculado)));
    return span;
  }

  const LIMITE_LINHAS_DRILLDOWN = 50;

  function abrirDrillDown(campoOuTitulo, subtitulo, chave, linhas) {
    const painel = obterPainelDrillDown();
    document.getElementById("drilldown-titulo").textContent = T(campoOuTitulo);
    document.getElementById("drilldown-sub").textContent = subtitulo;

    const corpo = document.getElementById("drilldown-corpo");
    corpo.innerHTML = "";

    if (!linhas.length) {
      const vazio = document.createElement("div");
      vazio.className = "drilldown-vazio";
      vazio.textContent = "Nenhum registro para esta seleção.";
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
      colunas.forEach((c) => { const th = document.createElement("th"); th.textContent = T(c); trHead.appendChild(th); });
      thead.appendChild(trHead);
      const tbody = document.createElement("tbody");
      linhas.slice(0, LIMITE_LINHAS_DRILLDOWN).forEach((linha) => {
        const tr = document.createElement("tr");
        colunas.forEach((c) => {
          const td = document.createElement("td");
          if (c === "Status Acao") td.appendChild(noCelulaStatusAcao(window.BI.Calc.statusDaLinhaAcao(linha, hoje)));
          else td.appendChild(noCelula(c, linha, colunasData));
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

    painel.classList.add("aberto");
    painel.setAttribute("aria-hidden", "false");
    if (elOverlayDrillDown) elOverlayDrillDown.hidden = false;
    corpo.scrollTop = 0;
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
          `Região corporal - ${regiao}`, "Registros desta região", chave,
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
      texto.textContent = T(it.label);
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
    label.textContent = T(rotuloCampo);
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
      texto.textContent = T(formatarOpcao ? formatarOpcao(v) : v);
      item.appendChild(cb);
      item.appendChild(texto);
      lista.appendChild(item);
    });

    if (!selecionadosValidos.length) textoBotao.textContent = "Todos";
    else if (selecionadosValidos.length === 1) textoBotao.textContent = T(formatarOpcao ? formatarOpcao(selecionadosValidos[0]) : selecionadosValidos[0]);
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

  // Tabela do cadastro-mestre que alimenta cada dimensao do filtro (ver
  // opcoesDeFiltro em js/calc.js) - cada nivel aparece no filtro assim que e
  // cadastrado, mesmo sem nenhum registro operacional (Mapa de Risco/
  // Avaliacao) lancado ainda. Bug critico relatado pelo Leo 02/10/2026.
  function dadosCadastroPorNivelFiltro() {
    return {
      Cliente: window.BI.dados.cliente,
      Unidade: window.BI.dados.unidade,
      Setor: window.BI.dados.setor,
      "Posto Trabalho": window.BI.dados.posto,
      Cargo: window.BI.dados.cargo,
      Atividade: window.BI.dados.atividade,
    };
  }

  // Campos de data que alimentam o filtro Ano/Mes, por colecao.
  const DATAS_FILTRO = {
    mapaRisco: ["Dt Avaliacao"], planoAcao: ["Dt Programada", "Dt Conclusao"], absenteismo: ["Dt Afastamento"],
    diasUteis: ["Ano/Mes Uteis"], compativeis: ["Inicio Restricao"], avaliacaoErgonomica: ["Data Avaliacao"],
    fatorRisco: ["Dt Identificacao"], laudo: ["Emitido Em"], aet: ["Data Analise"],
  };
  function mesesComDados() {
    const set = new Set();
    Object.keys(DATAS_FILTRO).forEach((colecao) => {
      (window.BI.dados[colecao] || []).forEach((linha) => {
        DATAS_FILTRO[colecao].forEach((campo) => {
          const v = linha[campo];
          if (v && /^\d{4}-\d{2}/.test(String(v))) set.add(String(v).slice(0, 7));
        });
      });
    });
    return Array.from(set).sort();
  }

  function atualizarOpcoesFiltros() {
    const opcoes = window.BI.Calc.opcoesDeFiltro(dadosCadastroPorNivelFiltro(), window.BI.filtros);
    // V 1.1: Ano/Mes vem das datas realmente lancadas nos registros (nunca
    // mais de uma lista fixa). Meses: so os dos anos selecionados.
    const todosMeses = mesesComDados();
    const anos = window.BI.Calc.anosDisponiveis(todosMeses);
    const anosSel = window.BI.filtros["Ano"] || [];
    const meses = window.BI.Calc.mesesDisponiveis(anosSel.length ? todosMeses.filter((m) => anosSel.includes(m.slice(0, 4))) : todosMeses);
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
    atualizarBadgeFiltros();
    // Protegido com try/catch: tema por Cliente e cosmetico (logo + cor da
    // borda) - um erro inesperado aqui (ex.: formato de Logotipo que ainda
    // nao previ) NUNCA pode impedir o resto dos filtros de funcionar.
    // Bug critico relatado pelo Leo 02/10/2026: selecionar um Cliente
    // "travava" o filtro - causa raiz ainda em investigacao, mas esse
    // try/catch garante que o filtro em si nunca quebra de novo por causa
    // desta funcao, mesmo que a causa raiz nao tenha sido 100% replicada.
    try {
      atualizarTemaCliente();
    } catch (e) {
      console.error("Tema por cliente falhou (filtros continuam funcionando normalmente):", e);
    }
  }

  // ------------------------------------------------------------------
  // Tema visual por Cliente filtrado: quando o usuario filtra exatamente 1
  // Cliente (ver filtro "Cliente" em ORDEM_FILTROS) e esse cliente tem
  // Logotipo cadastrado (camposCadastroCliente/Logotipo), mostra o
  // logotipo na barra superior e tematiza a borda dos cartoes (var CSS
  // --cor-cliente-ativa) com a cor dominante lida do proprio logotipo -
  // pedido do Leo 02/10/2026. Com 0 ou 2+ clientes filtrados, volta ao
  // tema padrao (--linha / sem logo).
  // ------------------------------------------------------------------
  function corDominanteDeImagem(img) {
    try {
      const w = 48, h = 48; // reduz a imagem antes de ler - mais rapido e
      // suaviza ruido de anti-aliasing nas bordas do desenho.
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      // Quantiza cada pixel em um "balde" (passos de 24 por canal) e acha o
      // balde mais frequente - mais robusto que uma media simples, que
      // tende a enlamear logotipos com mais de uma cor. Ignora pixels quase
      // transparentes (fundo do PNG) e quase branco/quase preto (fundo
      // solido ou contorno, raramente a cor "de marca" do cliente).
      const passo = 24;
      const baldes = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 40) continue;
        if (r > 240 && g > 240 && b > 240) continue;
        if (r < 15 && g < 15 && b < 15) continue;
        const chave = (r / passo | 0) + "," + (g / passo | 0) + "," + (b / passo | 0);
        const atual = baldes.get(chave);
        if (atual) { atual.r += r; atual.g += g; atual.b += b; atual.n += 1; }
        else baldes.set(chave, { r, g, b, n: 1 });
      }
      let melhor = null;
      baldes.forEach((v) => { if (!melhor || v.n > melhor.n) melhor = v; });
      if (!melhor) return null;
      return "rgb(" + Math.round(melhor.r / melhor.n) + ", " + Math.round(melhor.g / melhor.n) + ", " + Math.round(melhor.b / melhor.n) + ")";
    } catch (e) {
      // Nao deveria acontecer (arquivo servido pela nossa propria API,
      // mesma origem - canvas nunca fica "tainted"), mas protege mesmo
      // assim: sem cor lida, so nao tematiza, nao quebra a tela.
      console.warn("Não foi possível ler a cor do logotipo do cliente:", e);
      return null;
    }
  }

  function aplicarTemaCliente(cor) {
    if (cor) document.documentElement.style.setProperty("--cor-cliente-ativa", cor);
    else document.documentElement.style.removeProperty("--cor-cliente-ativa");
  }

  function atualizarTemaCliente() {
    const badge = document.getElementById("logo-cliente-ativo");
    const img = document.getElementById("logo-cliente-ativo-img");
    if (!badge || !img) return;

    const selecionados = window.BI.filtros.Cliente || [];
    if (selecionados.length !== 1) {
      badge.hidden = true;
      img.removeAttribute("src");
      delete img.dataset.chaveAtual;
      aplicarTemaCliente(null);
      return;
    }

    const doc = (window.BI.dados.cliente || []).find((c) => c.Cliente === selecionados[0]);
    const logo = doc && doc.Logotipo;
    if (!logo || !logo.chave) {
      badge.hidden = true;
      img.removeAttribute("src");
      delete img.dataset.chaveAtual;
      aplicarTemaCliente(null);
      return;
    }

    badge.hidden = false;
    badge.title = "Cliente filtrado: " + selecionados[0];
    img.alt = "Logo de " + selecionados[0];
    if (img.dataset.chaveAtual !== logo.chave) {
      img.dataset.chaveAtual = logo.chave;
      img.onload = () => aplicarTemaCliente(corDominanteDeImagem(img));
      img.onerror = () => aplicarTemaCliente(null);
      img.src = window.BI.DB.urlArquivo(logo.chave);
    }
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
        return { titulo: `Top Setores críticos - ${setor}`, subtitulo: "Postos deste setor", chave: "mapaRisco", linhas: mapaRiscoF.filter((l) => l.Setor === setor) };
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
          titulo: `Plano de Ação - ${status}`, subtitulo: `${valores[el.index]} ${valores[el.index] === 1 ? "ação" : "ações"}`, chave: "planoAcao",
          linhas: linhasFonte.filter((l) => window.BI.Calc.statusDaLinhaAcao(l, hoje) === status),
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
          titulo: `${responsavel} - ${status}`, subtitulo: "Ações do Plano de Ação", chave: "planoAcao",
          linhas: planoAcaoF.filter((l) => l["Responsavel Acao"] === responsavel && window.BI.Calc.statusDaLinhaAcao(l, hoje) === status),
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
          titulo: `${setor} - ${status}`, subtitulo: "Ações do Plano de Ação", chave: "planoAcao",
          linhas: planoAcaoF.filter((l) => l.Setor === setor && window.BI.Calc.statusDaLinhaAcao(l, hoje) === status),
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
  // Renderizadores - Inventario de Riscos / Avaliacao Ergonomica / Laudos
  // (pacote "Sistema de Gestao Integrada") - mesmos filtros globais e mesmo
  // padrao visual/de drill-down do Mapa de Risco acima.
  // ------------------------------------------------------------------

  function renderTilesFatorRiscoGraduacao(niveis, fatorRiscoF) {
    const cont = document.getElementById("tiles-fatorrisco-graduacao");
    if (!cont) return;
    cont.innerHTML = "";
    niveis.forEach((n) => {
      const cor = window.BI.Calc.corStatus(n.nivel);
      const tile = document.createElement("div");
      tile.className = "tile-status tile-clicavel";
      tile.style.borderLeftColor = cor;
      tile.addEventListener("click", (ev) => {
        ev.stopPropagation();
        abrirDrillDown(
          `Inventário de Riscos - ${window.BI.Calc.rotuloNivel(n.nivel)}`,
          `${n.qtd} fator(es) de risco`, "fatorRisco",
          fatorRiscoF.filter((l) => window.BI.Calc.nivelCanonico(l["Graduacao Risco"]) === n.nivel), ev
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
      pct.textContent = n.pct.toFixed(1) + "% dos fatores";
      tile.appendChild(rotulo);
      tile.appendChild(valor);
      tile.appendChild(pct);
      cont.appendChild(tile);
    });
  }

  function renderDonutFatorRiscoStatus(dadosStatus, fatorRiscoF) {
    const labels = dadosStatus.map((d) => d.status);
    const valores = dadosStatus.map((d) => d.qtd);
    const cores = labels.map((s) => window.BI.Calc.corStatus(s));
    criarOuAtualizarGrafico("chart-fatorrisco-status", {
      type: "doughnut",
      data: { labels, datasets: [{ data: valores, backgroundColor: cores, borderColor: corSurfaceCard(), borderWidth: 2 }] },
      options: comCliqueDrillDown({
        cutout: "62%",
        interaction: { mode: "nearest", intersect: true },
        plugins: { tooltip: { enabled: false, external: tooltipExterno } },
      }, (el) => {
        const status = labels[el.index];
        return {
          titulo: `Inventário de Riscos - ${status}`, subtitulo: `${valores[el.index]} fator(es)`, chave: "fatorRisco",
          linhas: fatorRiscoF.filter((l) => l.Status === status),
        };
      }),
    });
    const total = valores.reduce((a, b) => a + b, 0);
    renderizarLegenda("legenda-fatorrisco-status", labels.map((l, i) => ({ label: `${l} (${valores[i]}${total ? ", " + ((valores[i] / total) * 100).toFixed(0) + "%" : ""})`, cor: cores[i] })));
  }

  function renderTilesFatorRiscoPrazos(dist, fatorRiscoF, hoje, diasAlerta) {
    const cont = document.getElementById("tiles-fatorrisco-prazos");
    if (!cont) return;
    cont.innerHTML = "";
    const grupos = [
      { chave: "vencido", rotulo: "Vencidos", cor: "var(--acao-atrasada)" },
      { chave: "vencendo", rotulo: `Vencendo em ${diasAlerta} dias`, cor: "var(--acao-atraso)" },
      { chave: "em-dia", rotulo: "Em dia", cor: "var(--acao-concluida)" },
    ];
    grupos.forEach((g) => {
      const cor = window.BI.Calc.resolverCorCSS(g.cor);
      const tile = document.createElement("div");
      tile.className = "tile-status tile-clicavel";
      tile.style.borderLeftColor = cor;
      tile.addEventListener("click", (ev) => {
        ev.stopPropagation();
        abrirDrillDown(
          `Inventário de Riscos - ${g.rotulo}`, `${dist[g.chave]} fator(es) de risco`, "fatorRisco",
          fatorRiscoF.filter((l) => window.BI.Calc.statusVencimento(l["Valido Ate"], hoje, diasAlerta) === g.chave), ev
        );
      });
      const rotulo = document.createElement("div");
      rotulo.className = "rotulo";
      const ponto = document.createElement("span");
      ponto.className = "ponto";
      ponto.style.background = cor;
      rotulo.appendChild(ponto);
      rotulo.appendChild(document.createTextNode(g.rotulo));
      const valor = document.createElement("div");
      valor.className = "valor";
      valor.textContent = String(dist[g.chave] || 0);
      tile.appendChild(rotulo);
      tile.appendChild(valor);
      cont.appendChild(tile);
    });
  }

  function renderTopSetoresFatorRisco(lista, fatorRiscoF) {
    const mapaCores = window.BI.Calc.construirMapaCores(fatorRiscoF.map((l) => l.Setor));
    const labels = lista.map((s) => s.setor);
    const valores = lista.map((s) => Number(s.pct.toFixed(1)));
    criarOuAtualizarGrafico("chart-fatorrisco-top-setores", {
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
        return {
          titulo: `Riscos em Aberto - ${setor}`, subtitulo: "Fatores de risco deste setor", chave: "fatorRisco",
          linhas: fatorRiscoF.filter((l) => l.Setor === setor && ["A validar", "Em andamento"].includes(l.Status)),
        };
      }),
    });
  }

  function renderTilesAvaliacaoCobertura(cob) {
    const cont = document.getElementById("tiles-avaliacao-cobertura");
    if (!cont) return;
    cont.innerHTML = "";
    const itens = [
      { rotulo: "Avaliações registradas", valor: cob.total, sub: "Total de registros" },
      { rotulo: "Postos cobertos", valor: cob.postosCobertos, sub: `de ${cob.universoPostos} no Mapa de Risco` },
      { rotulo: "Cobertura", valor: cob.pct.toFixed(1) + "%", sub: "dos postos avaliados" },
    ];
    itens.forEach((it) => {
      const tile = document.createElement("div");
      tile.className = "tile-total";
      const rotulo = document.createElement("div");
      rotulo.className = "rotulo"; rotulo.textContent = it.rotulo;
      const valor = document.createElement("div");
      valor.className = "valor"; valor.textContent = String(it.valor);
      const sub = document.createElement("div");
      sub.className = "sub"; sub.textContent = it.sub;
      tile.appendChild(rotulo); tile.appendChild(valor); tile.appendChild(sub);
      cont.appendChild(tile);
    });
  }

  function renderDonutLaudosTipo(laudoF) {
    const tipos = TIPOS_LAUDO_POOL;
    const mapaCores = window.BI.Calc.construirMapaCores(tipos);
    const contagem = {};
    tipos.forEach((t) => (contagem[t] = 0));
    laudoF.forEach((l) => { if (l.Tipo in contagem) contagem[l.Tipo] += 1; });
    const labels = tipos;
    const valores = tipos.map((t) => contagem[t]);
    const cores = tipos.map((t) => mapaCores[t]);
    criarOuAtualizarGrafico("chart-laudos-tipo", {
      type: "doughnut",
      data: { labels, datasets: [{ data: valores, backgroundColor: cores, borderColor: corSurfaceCard(), borderWidth: 2 }] },
      options: comCliqueDrillDown({
        cutout: "62%",
        interaction: { mode: "nearest", intersect: true },
        plugins: { tooltip: { enabled: false, external: tooltipExterno } },
      }, (el) => {
        const tipo = labels[el.index];
        return {
          titulo: `Laudos - ${tipo}`, subtitulo: `${valores[el.index]} emitido(s)`, chave: "laudo",
          linhas: laudoF.filter((l) => l.Tipo === tipo),
        };
      }),
    });
    const total = valores.reduce((a, b) => a + b, 0);
    renderizarLegenda("legenda-laudos-tipo", labels.map((l, i) => ({ label: `${l} (${valores[i]}${total ? ", " + ((valores[i] / total) * 100).toFixed(0) + "%" : ""})`, cor: cores[i] })));
  }

  // Indicador da trilha AET (pedido do Leo 28/09/2026: "gestao visual" pra
  // nao confundir o que e AEP com o que e AET no dashboard - ate aqui a AET
  // nao tinha NENHUM indicador, so a tela de cadastro). Mostra o total de
  // arquivos anexados (um registro AET pode ter varios) e a distribuicao por
  // classificacao de conteudo (ver js/calc.js/distribuicaoClassificacaoAET).
  function renderTilesAET(dist, aetF) {
    const cont = document.getElementById("tiles-aet-classificacao");
    if (!cont) return;
    cont.innerHTML = "";
    const mapaCores = window.BI.Calc.construirMapaCores(dist.labels);
    dist.labels.forEach((rotulo, i) => {
      const valor = dist.valores[i];
      if (!valor) return; // esconde classificacoes sem nenhum arquivo, pra nao poluir com zeros
      const cor = mapaCores[rotulo];
      const tile = document.createElement("div");
      tile.className = "tile-status tile-clicavel";
      tile.style.borderLeftColor = cor;
      tile.addEventListener("click", (ev) => {
        ev.stopPropagation();
        abrirDrillDown(
          `AET - ${rotulo}`, `${valor} arquivo(s)`, "aet",
          aetF.filter((l) => (l["Arquivos AET"] || []).some((it) => (it.classificacaoConfirmada || it.classificacao || "Não identificado") === rotulo)),
          ev
        );
      });
      const rotuloEl = document.createElement("div");
      rotuloEl.className = "rotulo";
      const ponto = document.createElement("span");
      ponto.className = "ponto";
      ponto.style.background = cor;
      rotuloEl.appendChild(ponto);
      rotuloEl.appendChild(document.createTextNode(rotulo));
      const valorEl = document.createElement("div");
      valorEl.className = "valor";
      valorEl.textContent = String(valor);
      tile.appendChild(rotuloEl);
      tile.appendChild(valorEl);
      cont.appendChild(tile);
    });
    const resumoEl = document.getElementById("tiles-aet-resumo");
    if (resumoEl) {
      resumoEl.textContent = dist.totalRegistros
        ? `${dist.totalRegistros} registro(s) de AET · ${dist.totalArquivos} arquivo(s) anexado(s)`
        : "Nenhuma AET anexada ainda para este filtro.";
    }
  }

  // ------------------------------------------------------------------
  // Renderizadores - Dashboard "Med Ocup"
  // ------------------------------------------------------------------

  function renderTotaisMedOcup(totais) {
    const cont = document.getElementById("tiles-totais-medocup");
    if (!cont) return;
    cont.innerHTML = "";
    const itens = [
      { rotulo: "Qtd Colaboradores", valor: String(totais.qtdColaboradores), sub: "média do período filtrado" },
      { rotulo: "Qtd Dias Perdidos", valor: String(totais.qtdDiasPerdidos), sub: "soma de dias de afastamento" },
      { rotulo: "Taxa de Frequência", valor: totais.taxaFrequencia.toFixed(2), sub: "casos por milhão de HHT (NBR 14280)" },
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
            label: "Taxa de Frequência", data: serie.map((s) => Number(s.taxaFrequencia.toFixed(2))),
            yAxisID: "y", borderColor: corTaxa, backgroundColor: hexParaRgba(corTaxa, 0.12),
            fill: true, borderWidth: 2, tension: 0.25,
            pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: corTaxa, pointBorderColor: corSurfaceCard(), pointBorderWidth: 2,
          },
          {
            label: "Evolução de Atestados", data: serie.map((s) => s.qtdAtestados),
            yAxisID: "y1", borderColor: corAtestados, backgroundColor: corAtestados,
            borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, fill: false,
          },
          {
            label: "Evolução de Dias Perdidos", data: serie.map((s) => s.qtdDiasPerdidos),
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
          titulo: `Absenteísmo - ${window.BI.Calc.formatarMesLabel(mes)}`, subtitulo: "Registros de afastamento no mês", chave: "absenteismo",
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
        return { titulo: `Absenteísmo - ${setor}`, subtitulo: "Registros de afastamento", chave: "absenteismo", linhas: absenteismoF.filter((l) => l.Setor === setor) };
      }),
    });
  }

  function renderDiagramasMedOcup(absenteismoF) {
    const meta = window.BI.dados._meta;
    window.BI.Diagramas.renderizar(
      "diagrama-medocup-frente", "frente",
      window.BI.Calc.somaDiasPorRegiao(absenteismoF, meta.regioes_frente),
      { formatarValor: (v) => `${v} dia${v === 1 ? "" : "s"}`, titulo: "Dias perdidos por região - vista frontal" }
    );
    window.BI.Diagramas.renderizar(
      "diagrama-medocup-costas", "costas",
      window.BI.Calc.somaDiasPorRegiao(absenteismoF, meta.regioes_tras),
      { formatarValor: (v) => `${v} dia${v === 1 ? "" : "s"}`, titulo: "Dias perdidos por região - vista posterior" }
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
    btnLimpar.textContent = "Limpar filtros da página";
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
      titulo: `Gênero - ${genero}`, subtitulo: "Colaboradores em restrição/acompanhamento", chave: "compativeis",
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
          titulo: `Idade - ${faixa.label}`, subtitulo: "Colaboradores nesta faixa etária", chave: "compativeis",
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
      titulo: `Em Atividade Compatível - ${valor}`, subtitulo: "Colaboradores em restrição/acompanhamento", chave: "compativeis",
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
          titulo: `${setor} - ${status}`, subtitulo: "Restrições médicas", chave: "compativeis",
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
          titulo: `${turno} - ${status}`, subtitulo: "Restrições médicas", chave: "compativeis",
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
          titulo: `Compatível por Setor - ${setor}`, subtitulo: 'Atividade Compatível = "Sim"', chave: "compativeis",
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
      { formatarValor: (v) => `${v} restr.`, titulo: "Restrições por região - vista frontal" }
    );
    window.BI.Diagramas.renderizar(
      "diagrama-compat-costas", "costas",
      window.BI.Calc.contagemPorRegiao(compativeisF, meta.regioes_tras),
      { formatarValor: (v) => `${v} restr.`, titulo: "Restrições por região - vista posterior" }
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
      th.appendChild(document.createTextNode(T(col)));
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
    btnProx.type = "button"; btnProx.textContent = "Próxima >"; btnProx.disabled = estado.pagina >= totalPaginas;
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
      { campo: "Posto Trabalho", rotulo: "Posto de Trabalho", tipo: "cascata", obrigatorio: true },
      { campo: "Cargo", rotulo: "Cargo", tipo: "cascata", obrigatorio: true },
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
    const Calc = window.BI.Calc;
    return [
      ...comSecao([
        { campo: "Cliente", rotulo: "Nome do Cliente (Empresa)", tipo: "texto", obrigatorio: true },
        // Matriz de Risco (NR-01) usada no Inventario de Riscos (fatorRisco)
        // desse cliente - ver ligarCascataFatorRisco/Calc.matrizDoCliente.
        // Cada cliente pode ter uma matriz de tamanho diferente (3x3/4x4/5x5
        // ou uma variante propria), reproduzindo o campo "Matriz para
        // Avaliacao" do sistema de gestao atual da ElevaLife.
        { campo: "Matriz Risco", rotulo: "Matriz de Risco (NR-01)", tipo: "select", obrigatorio: true, opcoes: Calc ? Calc.NOMES_MATRIZ_RISCO : [] },
      ], "Identificação"),
      // Cadastro ampliado de empresa (pedido do Leo) - todos opcionais pra
      // nao quebrar/obrigar preencher de novo os clientes ja cadastrados
      // antes desta tela existir (Cosmos DB nao exige schema - registros
      // antigos simplesmente nao tem esses campos ate serem editados).
      ...comSecao([
        { campo: "CNPJ", rotulo: "CNPJ", tipo: "texto", mascara: "cnpj" },
        { campo: "Inscricao Estadual", rotulo: "Inscrição Estadual", tipo: "texto" },
        { campo: "CNAE", rotulo: "CNAE (atividade principal)", tipo: "texto" },
        { campo: "Grau Risco NR4", rotulo: "Grau de Risco (NR-4)", tipo: "select", opcoes: GRAUS_RISCO_NR4 },
      ], "Dados Fiscais"),
      ...comSecao([
        { campo: "Telefone", rotulo: "Telefone", tipo: "texto", mascara: "telefone" },
        { campo: "CEP", rotulo: "CEP", tipo: "texto", mascara: "cep" },
        { campo: "Logradouro", rotulo: "Endereço (logradouro)", tipo: "texto" },
        { campo: "Numero", rotulo: "Número", tipo: "texto" },
        { campo: "Complemento", rotulo: "Complemento", tipo: "texto" },
        { campo: "Bairro", rotulo: "Bairro", tipo: "texto" },
        { campo: "Cidade", rotulo: "Cidade", tipo: "texto" },
        { campo: "Estado", rotulo: "Estado (UF)", tipo: "select", opcoes: ESTADOS_BR },
      ], "Contato e Endereço"),
      // Logotipo: mesmo padrao de upload das demais telas (construirCampoArquivo/
      // anexarArquivos), so que "auto-referenciado" - o EmpresaId de destino e
      // o proprio Cliente sendo cadastrado/editado neste form, resolvido pelo
      // nome digitado mesmo antes de salvar (ver resolverEmpresaIdDoForm, que
      // cai no calculo deterministico window.BI.DB.idCliente quando ainda nao
      // existe um registro salvo com esse nome).
      ...comSecao([
        { campo: "Logotipo", rotulo: "Logotipo (JPG/PNG, até 2MB)", tipo: "arquivo", multiplo: false, colecaoArquivo: "cliente", aceitaTipos: "image/jpeg,image/png" },
      ], "Logotipo"),
    ];
  }
  function camposCadastroUnidade() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Nome da Unidade", tipo: "texto", obrigatorio: true },
    ];
  }
  // Setor/Posto de Trabalho/Cargo/Atividade: o proprio nivel sendo
  // cadastrado e sempre texto (nunca mais um <select> fixo/desabilitado) -
  // com "sugestoesDinamicas: true" pra oferecer, via <datalist>, tanto um
  // valor ja existente (dentre o que ja foi cadastrado para os ancestrais
  // escolhidos) quanto digitar um nome novo (pedido do Leo 02/10/2026: "ele
  // tem que me dar a opção ou de selecionar um já existente ou incluir
  // novo" - ver ligarSugestoesNivelProprio, ligado via aoConstruir em
  // CADASTROS_CONFIG).
  function camposCadastroSetor() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Unidade", tipo: "cascata", obrigatorio: true },
      { campo: "Setor", rotulo: "Nome do Setor", tipo: "texto", obrigatorio: true, sugestoesLista: SETORES_POOL, sugestoesDinamicas: true },
    ];
  }
  function camposCadastroPosto() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Unidade", tipo: "cascata", obrigatorio: true },
      { campo: "Setor", rotulo: "Setor", tipo: "cascata", obrigatorio: true },
      { campo: "Posto Trabalho", rotulo: "Nome do Posto de Trabalho", tipo: "texto", obrigatorio: true, sugestoesDinamicas: true },
    ];
  }
  function camposCadastroCargo() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Unidade", tipo: "cascata", obrigatorio: true },
      { campo: "Setor", rotulo: "Setor", tipo: "cascata", obrigatorio: true },
      { campo: "Posto Trabalho", rotulo: "Posto de Trabalho", tipo: "cascata", obrigatorio: true },
      { campo: "Cargo", rotulo: "Nome do Cargo", tipo: "texto", obrigatorio: true, sugestoesDinamicas: true },
    ];
  }
  function camposCadastroAtividade() {
    return [
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Unidade", rotulo: "Unidade", tipo: "cascata", obrigatorio: true },
      { campo: "Setor", rotulo: "Setor", tipo: "cascata", obrigatorio: true },
      { campo: "Posto Trabalho", rotulo: "Posto de Trabalho", tipo: "cascata", obrigatorio: true },
      { campo: "Cargo", rotulo: "Cargo", tipo: "cascata", obrigatorio: true },
      { campo: "Atividade", rotulo: "Nome da Atividade", tipo: "texto", obrigatorio: true, sugestoesDinamicas: true },
    ];
  }

  // Campos das 3 telas novas do pacote "Sistema de Gestao Integrada"
  // (Avaliacao Ergonomica, Inventario de Riscos/Fatores de Risco e Laudos -
  // ver docs/bi-ergonomia-manual.md, secao "Reproducao do Sistema de Gestao
  // Integrada"). Avaliacao Ergonomica e Fatores de Risco usam a mesma chave
  // composta (camposChave) dos demais registros operacionais - cada um
  // descreve uma Atividade especifica do cadastro-mestre. Laudo e mais
  // simples: so precisa saber de qual Cliente (empresa) e o laudo.
  // Marca um grupo de campos com uma "secao" (icone + titulo) pro
  // montarFormulario() organizar o formulario em blocos, em vez de uma unica
  // grade longa - so usado nos 3 cadastros do pacote "Sistema de Gestao
  // Integrada" abaixo (pedido do Leo: telas mais modernas/organizadas). Os
  // outros cadastros (Cliente/Unidade/.../Mapa de Risco/Plano de Acao/...)
  // nao usam "secao" e continuam exatamente como antes.
  function comSecao(campos, secao) {
    return campos.map((c) => Object.assign({}, c, { secao }));
  }

  function camposAvaliacaoErgonomica() {
    return comSecao(camposChave().concat([
      { campo: "Data Avaliacao", rotulo: "Data da avaliação", tipo: "data", obrigatorio: true, padraoHoje: true },
    ]), "🧭 Identificação do Posto").concat(
      comSecao([
        { campo: "Jornada de Trabalho", rotulo: "Jornada de Trabalho", tipo: "textarea", obrigatorio: true },
        { campo: "Pausas", rotulo: "Pausas", tipo: "textarea", obrigatorio: true },
        { campo: "Rodizio", rotulo: "Rodízio", tipo: "textarea", obrigatorio: true },
      ], "🗓️ Rotina de Trabalho"),
      comSecao([
        { campo: "Descricao Setor", rotulo: "Descrição do Setor", tipo: "textarea" },
        { campo: "Descricao Atividade Observada", rotulo: "Descrição da Atividade (Tarefa Real Observada)", tipo: "textarea" },
        { campo: "Caracteristicas Trabalhadores", rotulo: "Características dos Trabalhadores", tipo: "textarea" },
        { campo: "Historico Acidentes", rotulo: "Histórico de Acidentes", tipo: "textarea" },
        {
          campo: "Fotos", rotulo: "Fotos (JPG/PNG, até 5MB cada)", tipo: "arquivo", multiplo: true,
          colecaoArquivo: "avaliacaoErgonomica", aceitaTipos: "image/jpeg,image/png",
          tamanhoMaximoBytes: 5 * 1024 * 1024,
        },
      ], "📝 Observações da Avaliação")
    );
  }

  function camposFatorRisco() {
    const Calc = window.BI.Calc;
    return comSecao(camposChave(), "🧭 Identificação do Posto").concat(
      comSecao([
        // Grupo/Fator vem de uma checklist fixa (ISO TS-20646, mesma
        // referencia do sistema de gestao atual da ElevaLife) - nunca mais
        // texto livre. "Fator" e uma cascata: as opcoes dependem do Grupo
        // escolhido (ver ligarCascataFatorRisco).
        { campo: "Grupo", rotulo: "Grupo", tipo: "select", obrigatorio: true, opcoes: Calc ? Calc.GRUPOS_FATOR_RISCO : [] },
        { campo: "Fator", rotulo: "Fator de Risco", tipo: "select", obrigatorio: true, opcoes: [] },
        { campo: "Existe Fator Risco", rotulo: "Existe Fator de Risco?", tipo: "select", obrigatorio: true, opcoes: SIM_NAO },
        { campo: "Circunstancia Geradora", rotulo: "Fonte Geradora", tipo: "textarea" },
        { campo: "Consequencia", rotulo: "Consequência", tipo: "textarea" },
        { campo: "Medida Controle Existente", rotulo: "Medidas de Controle Existentes", tipo: "textarea" },
      ], "⚠️ Descrição do Risco"),
      // Criticidade/Probabilidade/Pontuacao/Graduacao seguem a Matriz de
      // Risco configurada para a empresa (Cadastro de Cliente > "Matriz
      // Risco") - a escala de opcoes e o calculo de Pontuacao/Graduacao
      // sao montados em runtime por ligarCascataFatorRisco, de acordo com
      // a matriz da empresa escolhida acima em "Identificação do Posto".
      comSecao([
        { campo: "Criticidade", rotulo: "Criticidade (Gravidade)", tipo: "select", obrigatorio: true, opcoes: [] },
        { campo: "Probabilidade", rotulo: "Probabilidade", tipo: "select", obrigatorio: true, opcoes: [] },
        { campo: "Pontuacao Risco", rotulo: "Pontuação de Risco (calculada)", tipo: "calculado" },
        { campo: "Graduacao Risco", rotulo: "Graduação do Risco (calculada)", tipo: "calculado" },
        { campo: "Matriz", rotulo: "Matriz de Risco em uso", tipo: "calculado" },
      ], "🎯 Classificação do Risco"),
      // V 1.2: no lugar de "Ação para Eliminação"/"Ação Organizacional" (texto
      // aberto) e do risco "após a melhoria" digitado, o fator tem uma LISTA de
      // ações (registros do Plano de Acao ligados ao fator) e o risco residual
      // e CALCULADO a partir delas (ver js/acoes.js). Registros antigos
      // mantem os textos e podem ser convertidos em ação com um clique.
      comSecao([
        {
          campo: "__acoes", rotulo: "Ações para reduzir o risco", tipo: "personalizado",
          construir: (form, iniciais) => construirEditorAcoesDoFator(form, iniciais),
        },
      ], "🛠️ Ações para reduzir o risco"),
      comSecao([
        { campo: "Dt Identificacao", rotulo: "Data da identificação", tipo: "data", obrigatorio: true, padraoHoje: true },
        { campo: "Status", rotulo: "Status", tipo: "select", obrigatorio: true, opcoes: STATUS_FATOR_RISCO_POOL },
        { campo: "SLA", rotulo: "SLA (prazo para tratar)", tipo: "select", opcoes: SLA_POOL },
        { campo: "Observacao", rotulo: "Observação", tipo: "textarea" },
        { campo: "Valido Ate", rotulo: "Válido até", tipo: "data" },
      ], "📌 Status e Acompanhamento")
    );
  }

  // V 1.4: formulario enxuto. Campos que o sistema preenche sozinho (Texto, Emitido Por,
  // impressao digital e registros profissionais) continuam gravados no registro, mas ficam
  // ocultos (ver ligarGeracaoLaudo). O botao "Gerar Laudo" fica no rodape do formulario.
  function camposLaudo() {
    return comSecao([
      { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
      { campo: "Tipo", rotulo: "Tipo", tipo: "select", obrigatorio: true, opcoes: TIPOS_LAUDO_POOL },
      // Setor/Posto sao OPCIONAIS (fora de camposChave): so restringem os Postos que entram
      // no laudo gerado. Em branco, o laudo cobre todos os Postos com Avaliacao Ergonomica.
      { campo: "Setor", rotulo: "Setor (opcional)", tipo: "cascata" },
      { campo: "Posto Trabalho", rotulo: "Posto de Trabalho (opcional)", tipo: "cascata" },
    ], "🏢 Identificação").concat(
      comSecao([
        { campo: "Responsavel Tecnico", rotulo: "Responsável técnico", tipo: "select", opcoes: () => (window.BI.dados.ergonomista || []).map((e) => e.Nome) },
        { campo: "Ergonomista Executor", rotulo: "Ergonomista executor (opcional)", tipo: "select", opcoes: () => (window.BI.dados.ergonomista || []).map((e) => e.Nome) },
        { campo: "Emitido Em", rotulo: "Emitido em", tipo: "data", padraoHoje: true },
        { campo: "Revisao", rotulo: "Revisão", tipo: "texto" },
      ], "✍️ Emissão"),
      comSecao([
        { campo: "Apenas Paginas Avaliacao", rotulo: "Somente as páginas de avaliação (sem capa e metodologia)", tipo: "select", opcoes: SIM_NAO },
        { campo: "Incluir Certificado Calibracao", rotulo: "Incluir certificado de calibração?", tipo: "select", opcoes: SIM_NAO },
        { campo: "Certificado Calibracao", rotulo: "Certificado de calibração", tipo: "select", opcoes: () => (window.BI.dados.certificadoCalibracao || []).map((c) => c.Nome) },
      ], "⚙️ Opções do documento"),
      comSecao([
        { campo: "Codigo Verificacao", rotulo: "Código de verificação", tipo: "calculado" },
        {
          campo: "Arquivo Url", rotulo: "Arquivo do Laudo (gerado automaticamente; envio manual de PDF ou imagem, até 15MB)", tipo: "arquivo", multiplo: false,
          colecaoArquivo: "laudo", aceitaTipos: "application/pdf,image/jpeg,image/png",
          tamanhoMaximoBytes: 15 * 1024 * 1024,
        },
        // Ocultos: preenchidos pelo gerador.
        { campo: "Texto", rotulo: "Texto do Laudo", tipo: "textarea" },
        { campo: "Emitido Por", rotulo: "Emitido por", tipo: "texto", sugestoesFn: () => Array.from(new Set((window.BI.dados.laudo || []).map((l) => l["Emitido Por"]).filter(Boolean))).sort() },
        { campo: "Hash Documento", rotulo: "Impressão digital SHA-256 do arquivo", tipo: "calculado" },
        { campo: "Registro Responsavel", rotulo: "Registro do responsável", tipo: "calculado" },
        { campo: "Registro Executor", rotulo: "Registro do executor", tipo: "calculado" },
      ], "📄 Documento gerado")
    );
  }

  // Biblioteca GLOBAL de Certificados de Calibracao dos instrumentos usados
  // nas medicoes (ex.: decibelimetro, luximetro, termohigrometro) -
  // compartilhada por todas as empresas-cliente, nao presa a uma delas (ver
  // COLECOES_GLOBAIS no backend e resolverEmpresaIdDoForm acima). Um laudo
  // pode anexar o certificado de um instrumento (campo "Certificado
  // Calibracao" em camposLaudo).
  function camposCertificadoCalibracao() {
    return [
      { campo: "Nome", rotulo: "Nome do Instrumento", tipo: "texto", obrigatorio: true },
      { campo: "Validade", rotulo: "Validade da Calibração", tipo: "data" },
      {
        campo: "Arquivo Imagem", rotulo: "Imagem do Certificado (JPG/PNG, até 5MB)", tipo: "arquivo", multiplo: false,
        colecaoArquivo: "certificadoCalibracao", aceitaTipos: "image/jpeg,image/png",
        tamanhoMaximoBytes: 5 * 1024 * 1024,
      },
    ];
  }

  // "Editor de Texto" do Laudo (tela "Emissor" do sistema legado) - o texto
  // padrao (Apresentacao/Metodologia/Recomendacoes/Conclusao) reaproveitado
  // em TODO laudo gerado, tambem GLOBAL (1 unico modelo da ElevaLife, nao um
  // por empresa-cliente - ver comentario acima em camposCertificadoCalibracao).
  // Nunca inclui nome/registro profissional de um ergonomista especifico -
  // isso vem do campo "Emitido Por" de cada Laudo (ver camposLaudo).
  // V 1.3: cada trecho de texto do laudo (AEP) pode ser editado pela area
  // tecnica; campo vazio = usa o texto padrao ElevaLife (js/laudo-textos.js).
  // Paragrafos separados por linha em branco, **negrito** com asteriscos duplos.
  // Marcadores: {cliente} {unidade} {setores} {nPostos} {nFatores} {nAcoes} {resumoNiveis}.
  function camposModeloLaudo() {
    const T = window.BI.LaudoTextos;
    return [{ campo: "Nome", rotulo: "Nome do Modelo", tipo: "texto", obrigatorio: true }].concat(
      (T ? T.CAMPOS_EDITAVEIS : []).map(([campo, rotulo]) => ({ campo, rotulo: rotulo + " (vazio = texto padrão ElevaLife)", tipo: "textarea" }))
    );
  }

  // Botao do Editor de Texto: preenche com o texto padrao os campos ainda vazios,
  // para a area tecnica partir do texto ElevaLife e editar so o que precisar.
  function ligarTextoPadraoModelo(form) {
    const T = window.BI.LaudoTextos;
    if (!T) return;
    const corpo = form.querySelector(".form-cadastro-corpo") || form;
    const wrap = document.createElement("div");
    wrap.className = "campo-form campo-form-largo";
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn-cad-secundario"; btn.textContent = "📝 Preencher campos vazios com o texto padrão ElevaLife";
    btn.addEventListener("click", () => {
      T.CAMPOS_EDITAVEIS.forEach(([campo]) => { const el = form._campos[campo]; if (el && !el.value) el.value = T.PADRAO[campo] || ""; });
    });
    wrap.appendChild(btn);
    corpo.insertBefore(wrap, corpo.firstChild);
  }

  // V 1.3: cadastro GLOBAL de ergonomistas (responsavel tecnico e executor do laudo).
  function camposErgonomista() {
    return [
      { campo: "Nome", rotulo: "Nome completo", tipo: "texto", obrigatorio: true },
      { campo: "Titulo", rotulo: "Formação e certificações (ex.: Fisioterapeuta · Ergonomista certificado ABERGO)", tipo: "texto" },
      { campo: "Registro", rotulo: "Registro profissional (ex.: CREFITO-3 000000-F)", tipo: "texto" },
      {
        campo: "Assinatura", rotulo: "Imagem da assinatura (PNG com fundo transparente ou JPG, até 2MB)", tipo: "arquivo", multiplo: false,
        colecaoArquivo: "ergonomista", aceitaTipos: "image/jpeg,image/png", tamanhoMaximoBytes: 2 * 1024 * 1024,
      },
    ];
  }

  // ------------------------------------------------------------------
  // AET (Analise Ergonomica do Trabalho) - upload de Excel e/ou PDF com
  // classificacao automatica por CONTEUDO (nunca por extensao/nome de
  // arquivo - pedido explicito do Leo: o sistema precisa ler o Excel e o
  // PDF e, com base na leitura, entender o que e cada um). As duas funcoes
  // abaixo so leem os BYTES do arquivo pra conseguir extrair o texto (isso
  // e inevitavel - um .xlsx e um .pdf sao formatos binarios diferentes);
  // qual das 5 classificacoes fixas (ver js/calc.js/NOMES_CLASSIFICACAO_AET)
  // o conteudo representa e decidido so depois, por classificarTextoAET,
  // olhando o texto extraido - nao o formato do arquivo.
  // ------------------------------------------------------------------
  async function extrairTextoExcel(arquivo) {
    const buffer = await arquivo.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const partes = [];
    workbook.SheetNames.forEach((nomeAba) => {
      partes.push("Aba: " + nomeAba);
      const folha = workbook.Sheets[nomeAba];
      partes.push(window.XLSX.utils.sheet_to_csv(folha, { blankrows: false }));
    });
    // Limite generoso (~40 mil caracteres) so pra nao travar em planilhas
    // gigantes - o inicio de cada aba (titulos/cabecalhos) ja e suficiente
    // pra classificar o conteudo.
    return partes.join("\n").slice(0, 40000);
  }

  async function extrairTextoPDF(arquivo) {
    const buffer = await arquivo.arrayBuffer();
    // isEvalSupported:false - V 1.7: pdf.js 3.11.174 tem a falha CVE-2024-4367 (PDF malicioso executa JS); aqui so lemos texto.
    const pdf = await window.pdfjsLib.getDocument({ data: buffer, isEvalSupported: false }).promise;
    const partes = [];
    // Poucas paginas (inicio do documento) ja bastam pra identificar o
    // conteudo (titulo, introducao, cabecalhos de tabela) sem demorar em
    // PDFs longos.
    const maxPaginas = Math.min(pdf.numPages, 8);
    for (let i = 1; i <= maxPaginas; i++) {
      const pagina = await pdf.getPage(i);
      const conteudo = await pagina.getTextContent();
      partes.push(conteudo.items.map((it) => it.str).join(" "));
    }
    return partes.join("\n").slice(0, 40000);
  }

  // Unico ponto de entrada usado pelo campo de upload da AET (ver
  // camposAET abaixo) - decide so COMO ler os bytes (Excel x PDF), nunca o
  // QUE o conteudo significa (isso e sempre classificarTextoAET).
  async function extrairTextoParaClassificacaoAET(arquivo) {
    const nome = (arquivo.name || "").toLowerCase();
    const tipo = arquivo.type || "";
    const ehExcel = /spreadsheet|ms-excel/.test(tipo) || /\.(xlsx|xls)$/.test(nome);
    return ehExcel ? extrairTextoExcel(arquivo) : extrairTextoPDF(arquivo);
  }

  function camposAET() {
    return comSecao(camposChave(), "🧭 Identificação do Posto").concat(
      comSecao([
        { campo: "Data Analise", rotulo: "Data da Análise", tipo: "data", obrigatorio: true },
        { campo: "Ergonomista Responsavel", rotulo: "Ergonomista Responsável", tipo: "texto", obrigatorio: true, sugestoesDe: "Ergonomista Responsavel" },
        { campo: "Observacoes", rotulo: "Observações Gerais", tipo: "textarea" },
      ], "🧑‍⚕️ Responsável e Data"),
      comSecao([
        {
          campo: "Arquivos AET",
          rotulo: "Arquivos da AET (Excel e/ou PDF, até 20MB cada) - o sistema lê o conteúdo de cada arquivo e sugere a classificação automaticamente",
          tipo: "arquivo", multiplo: true,
          colecaoArquivo: "aet",
          aceitaTipos: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf",
          tamanhoMaximoBytes: 20 * 1024 * 1024,
          extrairTextoParaClassificacao: extrairTextoParaClassificacaoAET,
        },
      ], "📎 Documentos da AET")
    );
  }

  // ------------------------------------------------------------------
  // Geracao do Laudo em PDF (replica as sub-telas "Emissor"/"Editor de
  // Texto"/"Certificado de Calibracao" do sistema legado - ver
  // docs/bi-ergonomia-manual.md, secao Laudos). Estrutura preservada
  // (capa, sumario, apresentacao/demanda, metodologia, taxonomia de fatores
  // de risco, matriz de severidade/probabilidade/risco, recomendacoes, um
  // bloco por Posto de Trabalho com um sub-bloco por fator de risco
  // identificado, conclusao com NR-17/Portaria MTB 3.214/MTP 4.219 e
  // assinatura) - so o LAYOUT e novo (paginas em branco, boa hierarquia
  // tipografica, badges coloridos de nivel de risco, tabelas de verdade em
  // vez de imagem estatica). O "Emitido Por" de cada Laudo e quem assina -
  // NUNCA um nome/registro profissional fixo no template (o layout e
  // generico, reaproveitado por qualquer ergonomista da ElevaLife).
  //
  // Renderiza em 2 passadas com o MESMO conteudo (documento "seco" primeiro,
  // so pra descobrir em que pagina cada secao comeca) porque o Sumario
  // precisa citar o numero de pagina de secoes que so existem MAIS ADIANTE
  // no PDF - jsPDF nao permite "voltar" e reescrever uma pagina ja
  // finalizada. As 2 passadas produzem o mesmo numero de paginas porque
  // usam exatamente o mesmo conteudo/entradas.
  async function gerarLaudoPDF(opcoes) {
    // V 1.3: o laudo (AEP) e gerado por js/laudo.js; o codigo abaixo e o
    // gerador anterior (V 1.2), mantido so como reserva.
    if (window.BI.Laudo && window.BI.Laudo.gerar) return window.BI.Laudo.gerar(opcoes);
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) {
      throw new Error("A biblioteca de geração de PDF não carregou (script externo bloqueado ou indisponível).");
    }
    const Calc = window.BI.Calc;
    const dados = window.BI.dados;
    const modelo = (dados.modeloLaudo || [])[0] || {};
    const nomeMatriz = Calc.matrizDoCliente(dados.cliente, opcoes.nomeCliente);
    const escala = Calc.escalaDaMatriz(nomeMatriz);
    const docCliente = (dados.cliente || []).find((c) => c.Cliente === opcoes.nomeCliente) || {};

    const avaliacoes = (dados.avaliacaoErgonomica || []).filter((a) => {
      if (a.Cliente !== opcoes.nomeCliente) return false;
      if (opcoes.setor && a.Setor !== opcoes.setor) return false;
      if (opcoes.postoTrabalho && a["Posto Trabalho"] !== opcoes.postoTrabalho) return false;
      return true;
    });
    if (!avaliacoes.length) {
      throw new Error("Nenhuma Avaliação Ergonômica cadastrada para esse Cliente/Setor/Posto - cadastre a Avaliação Ergonômica antes de gerar o laudo.");
    }

    function fatoresDoPosto(av) {
      return (dados.fatorRisco || []).filter((f) =>
        f.Cliente === av.Cliente && f.Unidade === av.Unidade && f.Setor === av.Setor &&
        f.Cargo === av.Cargo && f["Posto Trabalho"] === av["Posto Trabalho"] && f.Atividade === av.Atividade &&
        f["Existe Fator Risco"] === "Sim"
      );
    }
    const certificado = opcoes.incluirCertificado && opcoes.nomeCertificado
      ? (dados.certificadoCalibracao || []).find((c) => c.Nome === opcoes.nomeCertificado)
      : null;

    // Pedido do Leo (28/09/2026): o Laudo em PDF estava "generico", com cores
    // e fonte sem nenhuma relacao com os 15 anos da ElevaLife - o proprio
    // site (css/style.css) ja segue a paleta oficial (vinho + creme +
    // Montserrat); o PDF (jsPDF, sem acesso a CSS) tinha ficado com a fonte
    // padrao (helvetica) e um teal generico. Usa exatamente os mesmos tons
    // (RGB) das variaveis --vinho-escuro/--vinho/--vinho-medio/--creme/
    // --texto/--cinza-quente/--teal do CSS, pra ficar visualmente o MESMO
    // sistema, nunca uma versao a parte.
    const PALETA = {
      vinhoEscuro: [94, 42, 48], vinho: [139, 58, 66], vinhoMedio: [163, 78, 86],
      vinhoSuave: [216, 183, 187], vinhoSuave2: [201, 154, 160],
      creme: [245, 239, 234], texto: [61, 46, 48], cinzaQuente: [138, 122, 120],
      teal: [62, 123, 126], tealEscuro: [46, 95, 98],
      branco: [255, 255, 255],
    };
    // Mesmas 4 cores da Graduacao do Risco usadas no dashboard (Mapa de
    // Risco: Baixo verde, Moderado amarelo, Alto vermelho, Muito Alto roxo -
    // ver --risco-* em css/style.css) - o Laudo tinha uma paleta de risco
    // PROPRIA e diferente da do dashboard; agora e a mesma em qualquer lugar
    // que o usuario ve uma Graduacao de Risco.
    function corDoNivel(nivel) {
      const n = String(nivel || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      if (n.includes("muito alto") || n.includes("altissimo")) return [124, 58, 237];
      if (n.includes("alto")) return [217, 54, 54];
      if (n.includes("moder") || n.includes("medio") || n.includes("toler")) return [201, 150, 12];
      return [26, 156, 75]; // baixo / muito baixo
    }
    function rotuloSimNao(v) { return v === "Nao" ? "Não" : v === "Sim" ? "Sim" : v || "-"; }

    // Baixa (uma unica vez, antes das 2 passadas de construirDocumento) o
    // conteudo de cada foto da Avaliacao Ergonomica e converte pra data URL -
    // jsPDF.addImage precisa dos bytes da imagem, nao so da URL. Feito UMA
    // vez fora do loop de paginacao (nao a cada passada) pra nao baixar cada
    // foto 2x; getImageProperties (usado depois pra medir altura) e sincrono
    // uma vez que a data URL ja esta em memoria.
    async function coletarFotosDataUrl(avals) {
      const mapa = {};
      for (const av of avals) {
        for (const item of av.Fotos || []) {
          if (!item || !item.chave || mapa[item.chave] !== undefined) continue;
          try {
            const resp = await fetch(window.BI.DB.urlArquivo(item.chave), { credentials: "same-origin" });
            if (!resp.ok) { mapa[item.chave] = null; continue; }
            const blob = await resp.blob();
            mapa[item.chave] = await new Promise((resolve) => {
              const leitor = new FileReader();
              leitor.onload = () => resolve(String(leitor.result || "") || null);
              leitor.onerror = () => resolve(null);
              leitor.readAsDataURL(blob);
            });
          } catch (e) {
            mapa[item.chave] = null;
          }
        }
      }
      return mapa;
    }
    const mapaFotos = await coletarFotosDataUrl(avaliacoes);

    // Constroi o documento inteiro (capa -> sumario -> corpo -> conclusao).
    // gravando=true: so mede, registrando em mapaPaginas em que pagina cada
    // secao top-level comecou (nao produz o PDF final). gravando=false: usa
    // o mapaPaginas ja preenchido pra escrever os numeros certos no Sumario.
    function construirDocumento(doc, mapaPaginas, gravando) {
      const margem = 42;
      const larguraPagina = doc.internal.pageSize.getWidth();
      const alturaPagina = doc.internal.pageSize.getHeight();
      const larguraUtil = larguraPagina - margem * 2;
      let y = margem;
      let pagina = 1;

      function novaPagina() { doc.addPage(); pagina++; y = margem; }
      function garantirEspaco(altura) { if (y + altura > alturaPagina - margem) novaPagina(); }
      function registrar(chaveSecao) { if (gravando) mapaPaginas[chaveSecao] = pagina; }

      function tituloSecao(texto) {
        garantirEspaco(38);
        doc.setFont("MontserratAlternates", "bold");
        doc.setFontSize(14);
        doc.setTextColor.apply(doc, PALETA.vinho);
        doc.text(texto, margem, y);
        y += 8;
        doc.setDrawColor.apply(doc, PALETA.vinho);
        doc.setLineWidth(1.2);
        doc.line(margem, y, margem + larguraUtil, y);
        doc.setLineWidth(0.5);
        y += 18;
      }
      function subtitulo(texto) {
        garantirEspaco(20);
        doc.setFont("Montserrat", "bold");
        doc.setFontSize(11);
        doc.setTextColor.apply(doc, PALETA.vinhoMedio);
        doc.text(texto, margem, y);
        y += 16;
      }
      function paragrafo(texto, opts) {
        opts = opts || {};
        doc.setFont("Montserrat", opts.negrito ? "bold" : "normal");
        doc.setFontSize(opts.tamanho || 10);
        doc.setTextColor.apply(doc, opts.cor || PALETA.texto);
        const linhas = doc.splitTextToSize(String(texto || "-"), larguraUtil - (opts.recuo || 0));
        garantirEspaco(linhas.length * (opts.altura || 13) + 4);
        doc.text(linhas, margem + (opts.recuo || 0), y);
        y += linhas.length * (opts.altura || 13) + (opts.espacoDepois != null ? opts.espacoDepois : 8);
      }
      function campoValor(rotulo, valor) {
        doc.setFont("Montserrat", "bold");
        doc.setFontSize(9.5);
        const larguraRotulo = doc.getTextWidth(rotulo + ":  ");
        const linhas = doc.splitTextToSize(String(valor == null || valor === "" ? "-" : valor), larguraUtil - larguraRotulo);
        garantirEspaco(linhas.length * 12 + 4);
        doc.setTextColor.apply(doc, PALETA.cinzaQuente);
        doc.text(rotulo + ":", margem, y);
        doc.setFont("Montserrat", "normal");
        doc.setTextColor.apply(doc, PALETA.texto);
        doc.text(linhas, margem + larguraRotulo, y);
        y += Math.max(linhas.length, 1) * 12 + 3;
      }
      function badge(texto, cor) {
        doc.setFont("Montserrat", "bold");
        doc.setFontSize(9);
        const largura = doc.getTextWidth(texto) + 14;
        garantirEspaco(18);
        doc.setFillColor.apply(doc, cor);
        doc.roundedRect(margem, y - 10, largura, 15, 3, 3, "F");
        doc.setTextColor.apply(doc, PALETA.branco);
        doc.text(texto, margem + 7, y);
        doc.setTextColor.apply(doc, PALETA.texto);
        y += 20;
      }
      // Tabela generica (cabecalho colorido + linhas zebradas). Cada celula
      // de "linhas" e um texto simples OU { texto, cor: [r,g,b] } pra pintar
      // o fundo da celula (usado na Matriz de Risco e nas graduacoes).
      function tabela(cabecalhos, linhas, larguras) {
        const altura = 18;
        garantirEspaco(altura * (linhas.length + 1) + 6);
        let x = margem;
        doc.setFillColor.apply(doc, PALETA.vinho);
        doc.rect(margem, y, larguraUtil, altura, "F");
        doc.setFont("Montserrat", "bold");
        doc.setFontSize(9);
        doc.setTextColor.apply(doc, PALETA.branco);
        cabecalhos.forEach((c, i) => { doc.text(String(c), x + 5, y + altura - 6); x += larguras[i]; });
        y += altura;
        doc.setFont("Montserrat", "normal");
        doc.setFontSize(9);
        linhas.forEach((linha, idx) => {
          garantirEspaco(altura);
          if (idx % 2 === 1) { doc.setFillColor(249, 245, 242); doc.rect(margem, y, larguraUtil, altura, "F"); }
          x = margem;
          linha.forEach((celula, i) => {
            if (celula && typeof celula === "object") {
              doc.setFillColor.apply(doc, celula.cor);
              doc.rect(x + 1, y + 1, larguras[i] - 2, altura - 2, "F");
              doc.setTextColor.apply(doc, PALETA.branco);
              doc.text(String(celula.texto), x + 5, y + altura - 6);
              doc.setTextColor.apply(doc, PALETA.texto);
            } else {
              doc.setTextColor.apply(doc, PALETA.texto);
              doc.text(String(celula == null ? "-" : celula), x + 5, y + altura - 6);
            }
            x += larguras[i];
          });
          y += altura;
        });
        doc.setDrawColor.apply(doc, PALETA.vinhoSuave);
        doc.rect(margem, y - altura * (linhas.length + 1), larguraUtil, altura * (linhas.length + 1));
        y += 12;
      }

      const apenasAvaliacao = opcoes.apenasPaginasAvaliacao === "Sim";

      // ---------------- Capa ----------------
      if (!apenasAvaliacao) {
        registrar("capa");
        // Faixa vinho em gradiente (aprox. #5E2A30 -> #8B3A42), igual a
        // identidade dos 15 anos da ElevaLife usada no site (css/style.css).
        const alturaFaixa = 130;
        const passos = 40;
        for (let p = 0; p < passos; p++) {
          const t = p / (passos - 1);
          const r = Math.round(PALETA.vinhoEscuro[0] + (PALETA.vinho[0] - PALETA.vinhoEscuro[0]) * t);
          const g = Math.round(PALETA.vinhoEscuro[1] + (PALETA.vinho[1] - PALETA.vinhoEscuro[1]) * t);
          const b = Math.round(PALETA.vinhoEscuro[2] + (PALETA.vinho[2] - PALETA.vinhoEscuro[2]) * t);
          doc.setFillColor(r, g, b);
          doc.rect((larguraPagina / passos) * p, 0, larguraPagina / passos + 1, alturaFaixa, "F");
        }
        doc.setFont("MontserratAlternates", "bold");
        doc.setFontSize(24);
        doc.setTextColor.apply(doc, PALETA.branco);
        doc.text("ElevaLife", margem, 55);
        doc.setFontSize(10.5);
        doc.setFont("Montserrat", "normal");
        doc.setTextColor(232, 214, 216);
        doc.text("15 anos elevando pessoas e resultados", margem, 73);
        doc.setFontSize(11.5);
        doc.setFont("Montserrat", "bold");
        doc.setTextColor.apply(doc, PALETA.branco);
        doc.text("S.I.G.E - Sistema Integrado de Gestão ElevaLife", margem, 98);
        y = 190;
        doc.setFont("MontserratAlternates", "bold");
        doc.setFontSize(24);
        doc.setTextColor.apply(doc, PALETA.vinhoEscuro);
        const linhasTitulo = doc.splitTextToSize("Laudo de Análise Ergonômica do Trabalho", larguraUtil);
        doc.text(linhasTitulo, margem, y);
        y += linhasTitulo.length * 28 + 20;
        doc.setDrawColor.apply(doc, PALETA.vinho);
        doc.setLineWidth(1.5);
        doc.line(margem, y, margem + larguraUtil, y);
        doc.setLineWidth(0.5);
        y += 30;
        campoValor("Cliente", opcoes.nomeCliente);
        campoValor("Tipo", opcoes.tipo || "Laudo");
        if (opcoes.setor) campoValor("Setor", opcoes.setor);
        if (opcoes.postoTrabalho) campoValor("Posto de Trabalho", opcoes.postoTrabalho);
        campoValor("Data de Emissão", opcoes.emitidoEm ? new Date(opcoes.emitidoEm + "T00:00:00").toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR"));
        campoValor("Emitido por", opcoes.emitidoPor || "Responsável Técnico ElevaLife");
        campoValor("Norma de Referência", "NR-17 (Ergonomia) - Ministério do Trabalho e Emprego");

        // ---------------- Sumario ----------------
        novaPagina();
        registrar("sumario");
        tituloSecao("Sumário");
        const itensSumario = [
          ["1. Apresentação e Demanda do Trabalho", "apresentacao"],
          ["2. Métodos e Metodologia Utilizada", "metodologia"],
          ["3. Fatores de Risco Avaliados (ISO TS-20646)", "taxonomia"],
          ["4. Matriz de Severidade, Probabilidade e Risco", "matrizes"],
          ["5. Recomendações e Sugestões", "recomendacoes"],
        ];
        avaliacoes.forEach((av, i) => {
          itensSumario.push([`6.${i + 1} ${av.Setor} - ${av["Posto Trabalho"]}`, "posto-" + i]);
        });
        itensSumario.push(["7. Conclusão", "conclusao"]);
        doc.setFontSize(10);
        itensSumario.forEach(([rotulo, chaveSecao]) => {
          garantirEspaco(18);
          const numeroPag = mapaPaginas[chaveSecao] != null ? String(mapaPaginas[chaveSecao]) : "-";
          doc.setFont("Montserrat", chaveSecao.indexOf("posto-") === 0 ? "normal" : "bold");
          doc.setFontSize(chaveSecao.indexOf("posto-") === 0 ? 9.5 : 10.5);
          doc.setTextColor.apply(doc, PALETA.texto);
          const larguraNumero = doc.getTextWidth(numeroPag);
          const larguraTitulo = doc.getTextWidth(rotulo);
          doc.text(rotulo, margem, y);
          const larguraPontos = larguraUtil - larguraTitulo - larguraNumero - 10;
          if (larguraPontos > 0) {
            const larguraPonto = doc.getTextWidth(".");
            const qtdPontos = Math.max(0, Math.floor(larguraPontos / larguraPonto));
            doc.setTextColor.apply(doc, PALETA.vinhoSuave2);
            doc.text(".".repeat(qtdPontos), margem + larguraTitulo + 4, y);
          }
          doc.setTextColor.apply(doc, PALETA.texto);
          doc.text(numeroPag, margem + larguraUtil - larguraNumero, y);
          // Sumario clicavel (pedido do Leo 28/09/2026: "clicou la na
          // linha, ja e, desprende para a pagina") - link interno do PDF
          // pra pagina da secao (funciona no Adobe Reader e no viewer do
          // Chrome/Edge; so na passada final, ja com mapaPaginas completo -
          // na passada "seca" o documento inteiro e descartado mesmo).
          if (!gravando && mapaPaginas[chaveSecao] != null) {
            doc.link(margem, y - 12, larguraUtil, 16, { pageNumber: mapaPaginas[chaveSecao] });
          }
          y += 18;
        });

        // ---------------- Apresentacao / Demanda ----------------
        novaPagina();
        registrar("apresentacao");
        tituloSecao("1. Apresentação e Demanda do Trabalho");
        paragrafo(
          modelo.Apresentacao ||
            `A ElevaLife foi contratada pela empresa ${opcoes.nomeCliente} para realizar a Análise Ergonômica do Trabalho (AET), em atendimento à Norma Regulamentadora NR-17 (Ergonomia), com o objetivo de identificar, avaliar e propor medidas de controle para os fatores de risco ergonômico presentes nos postos de trabalho analisados.`
        );

        // ---------------- Metodologia ----------------
        novaPagina();
        registrar("metodologia");
        tituloSecao("2. Métodos e Metodologia Utilizada");
        paragrafo(
          modelo.Metodologia ||
            "A avaliação seguiu método observacional e entrevistas com os trabalhadores, com base na ISO TS-20646 (Ergonomics - Ergonomics checkpoints for the design of good workstations) e na NR-17, contemplando: entrevista com trabalhadores e lideranças, observação e registro fotográfico das atividades, e identificação sistemática de fatores de risco por posto de trabalho conforme checklist padronizado."
        );

        // ---------------- Taxonomia dos fatores de risco ----------------
        novaPagina();
        registrar("taxonomia");
        tituloSecao("3. Fatores de Risco Avaliados (ISO TS-20646)");
        paragrafo("Cada Posto de Trabalho foi avaliado quanto à presença dos seguintes grupos de fatores de risco ergonômico, conforme referência ISO TS-20646 e NR-01:", { espacoDepois: 10 });
        (Calc.GRUPOS_FATOR_RISCO || []).forEach((grupo) => {
          garantirEspaco(16);
          doc.setFont("Montserrat", "bold");
          doc.setFontSize(10);
          doc.setTextColor.apply(doc, PALETA.tealEscuro);
          doc.text("• " + grupo, margem, y);
          y += 14;
          (Calc.fatoresDoGrupo ? Calc.fatoresDoGrupo(grupo) : []).forEach((item) => {
            paragrafo(item, { recuo: 14, tamanho: 9, cor: PALETA.cinzaQuente, altura: 11, espacoDepois: 3 });
          });
          y += 4;
        });

        // ---------------- Matrizes ----------------
        novaPagina();
        registrar("matrizes");
        tituloSecao("4. Matriz de Severidade, Probabilidade e Risco");
        paragrafo(`Matriz de Risco em uso para ${opcoes.nomeCliente}: ${nomeMatriz} (conforme NR-01 - Gerenciamento de Riscos Ocupacionais).`, { espacoDepois: 10 });
        subtitulo("Matriz de Risco (Probabilidade × Gravidade)");
        const larguraColMatriz = larguraUtil / (escala.length + 1);
        const cabecalhoMatriz = ["Prob. \\ Gravidade"].concat(escala);
        const linhasMatriz = escala.map((probabilidade) => {
          const linha = [probabilidade];
          escala.forEach((gravidade) => {
            const nivel = Calc.nivelDaMatriz(nomeMatriz, probabilidade, gravidade);
            const pontos = Calc.pontuacaoDaMatriz(nomeMatriz, probabilidade, gravidade);
            linha.push({ texto: `${pontos} - ${nivel}`, cor: corDoNivel(nivel) });
          });
          return linha;
        });
        tabela(cabecalhoMatriz, linhasMatriz, [larguraColMatriz].concat(escala.map(() => larguraColMatriz)));

        // ---------------- Recomendacoes (intro) ----------------
        novaPagina();
        registrar("recomendacoes");
        tituloSecao("5. Recomendações e Sugestões");
        paragrafo(
          modelo.Recomendacoes ||
            "As medidas de controle e ações recomendadas a seguir devem ser priorizadas conforme a graduação de risco identificada em cada Posto de Trabalho, buscando eliminar ou reduzir a exposição aos fatores de risco ergonômico apontados nesta análise."
        );
        if (certificado) {
          novaPagina();
          subtitulo("Certificado de Calibração do Instrumento Utilizado");
          campoValor("Instrumento", certificado.Nome);
          if (certificado.Validade) campoValor("Validade da Calibração", new Date(certificado.Validade + "T00:00:00").toLocaleDateString("pt-BR"));
          if (certificado["Arquivo Imagem"] && certificado["Arquivo Imagem"].chave) {
            paragrafo("(imagem do certificado anexada ao cadastro do instrumento - ver Certificados de Calibração)", { tamanho: 8.5, cor: [120, 120, 120] });
          }
        }
      }

      // ---------------- Um bloco por Posto de Trabalho ----------------
      avaliacoes.forEach((av, i) => {
        novaPagina();
        registrar("posto-" + i);
        tituloSecao(`6.${i + 1} ${av.Setor} - ${av["Posto Trabalho"]}`);
        campoValor("Unidade", av.Unidade);
        campoValor("Cargo", av.Cargo);
        campoValor("Atividade", av.Atividade);
        campoValor("Jornada de Trabalho", av["Jornada de Trabalho"]);
        campoValor("Pausas", av.Pausas);
        campoValor("Rodízio", av.Rodizio);
        if (av["Historico Acidentes"]) campoValor("Histórico de Acidentes", av["Historico Acidentes"]);
        y += 4;
        if (av["Descricao Setor"]) {
          subtitulo("Descrição do Setor");
          paragrafo(av["Descricao Setor"]);
        }
        if (av["Descricao Atividade Observada"]) {
          subtitulo("Descrição da Atividade (Tarefa Real Observada)");
          paragrafo(av["Descricao Atividade Observada"]);
        }
        if (av["Caracteristicas Trabalhadores"]) {
          subtitulo("Características dos Trabalhadores");
          paragrafo(av["Caracteristicas Trabalhadores"]);
        }

        // Registro fotografico do posto (fotos anexadas em "Fotos" na
        // Avaliacao Ergonomica) - grade de 2 colunas com legenda pelo nome
        // do arquivo. Os data URLs ja foram coletados uma unica vez em
        // mapaFotos (coletarFotosDataUrl), antes das duas passadas de
        // construirDocumento, para nao buscar o arquivo em duplicidade.
        const fotosDoPosto = (av.Fotos || []).filter((item) => item && item.chave && mapaFotos[item.chave]);
        if (fotosDoPosto.length) {
          subtitulo("Registro Fotográfico");
          const colunasFoto = 2;
          const gapFoto = 10;
          const larguraCelula = (larguraUtil - gapFoto * (colunasFoto - 1)) / colunasFoto;
          const alturaCelula = 150;
          for (let f = 0; f < fotosDoPosto.length; f += colunasFoto) {
            garantirEspaco(alturaCelula + 22);
            const linhaFotos = fotosDoPosto.slice(f, f + colunasFoto);
            const yLinha = y;
            linhaFotos.forEach((item, idx) => {
              const xCelula = margem + idx * (larguraCelula + gapFoto);
              const dataUrl = mapaFotos[item.chave];
              doc.setDrawColor.apply(doc, PALETA.vinhoSuave);
              doc.setFillColor.apply(doc, PALETA.creme);
              doc.roundedRect(xCelula, yLinha, larguraCelula, alturaCelula, 4, 4, "FD");
              try {
                const props = doc.getImageProperties(dataUrl);
                const proporcao = props.height / props.width;
                let larguraImg = larguraCelula - 12;
                let alturaImg = larguraImg * proporcao;
                const alturaMaxImg = alturaCelula - 24;
                if (alturaImg > alturaMaxImg) {
                  alturaImg = alturaMaxImg;
                  larguraImg = alturaImg / proporcao;
                }
                const xImg = xCelula + (larguraCelula - larguraImg) / 2;
                const yImg = yLinha + 6;
                doc.addImage(dataUrl, props.fileType, xImg, yImg, larguraImg, alturaImg);
                doc.setFont("Montserrat", "normal");
                doc.setFontSize(7.5);
                doc.setTextColor.apply(doc, PALETA.cinzaQuente);
                const legenda = doc.splitTextToSize(item.nomeArquivo || "", larguraCelula - 12)[0] || "";
                doc.text(legenda, xCelula + 6, yLinha + alturaCelula - 8);
              } catch (e) {
                doc.setFont("Montserrat", "normal");
                doc.setFontSize(8);
                doc.setTextColor.apply(doc, PALETA.cinzaQuente);
                doc.text("(não foi possível carregar a imagem)", xCelula + 8, yLinha + alturaCelula / 2);
              }
            });
            y = yLinha + alturaCelula + 12;
          }
          y += 4;
        }

        const fatores = fatoresDoPosto(av);
        if (!fatores.length) {
          paragrafo("Nenhum fator de risco com \"Existe Fator de Risco: Sim\" cadastrado para este Posto de Trabalho.", { cor: [140, 140, 140], tamanho: 9 });
        }
        fatores.forEach((fr, j) => {
          garantirEspaco(30);
          subtitulo(`6.${i + 1}.${j + 1} ${fr.Grupo} - ${fr.Fator}`);
          if (fr["Circunstancia Geradora"]) campoValor("Circunstância Geradora", fr["Circunstancia Geradora"]);
          if (fr.Consequencia) campoValor("Consequência", fr.Consequencia);
          if (fr["Medida Controle Existente"]) campoValor("Medida de Controle Existente", fr["Medida Controle Existente"]);
          const pontos = fr["Pontuacao Risco"] != null ? fr["Pontuacao Risco"] : Calc.pontuacaoDaMatriz(nomeMatriz, fr.Probabilidade, fr.Criticidade);
          const graduacao = fr["Graduacao Risco"] || Calc.nivelDaMatriz(nomeMatriz, fr.Probabilidade, fr.Criticidade);
          campoValor("Criticidade (Gravidade)", fr.Criticidade);
          campoValor("Probabilidade", fr.Probabilidade);
          campoValor("Pontuação de Risco", pontos != null ? String(pontos) : "-");
          if (graduacao) badge(graduacao, corDoNivel(graduacao));
          // V 1.2: acoes do fator (Plano de Acao) e risco residual calculado.
          const acoesDoFator = window.BI.Acoes ? window.BI.Acoes.acoesDoFator(fr._id) : [];
          if (acoesDoFator.length) {
            const AC = window.BI.Acoes;
            acoesDoFator.forEach((a, k) => {
              garantirEspaco(30);
              const reduz = a["Risco Apos Acao"] ? `${Calc.rotuloNivel(a["Risco Atual Segmento"] || graduacao)} para ${Calc.rotuloNivel(a["Risco Apos Acao"])}` : "";
              const partes = [
                a["Acao Recomendada"],
                a["Segmento Corporal"] ? `Segmento: ${a["Segmento Corporal"]}${reduz ? " (" + reduz + ")" : ""}` : "",
                a["Responsavel Acao"] ? `Responsável: ${a["Responsavel Acao"]}` : "",
                a["Dt Programada"] ? `Prazo: ${window.BI.Datas.isoParaBR(a["Dt Programada"])}` : "",
                AC.estaConcluida(a) ? "Concluída" : "",
              ].filter(Boolean);
              campoValor(`Ação ${k + 1} - ${AC.rotuloTipo(a["Tipo Acao"]) || a["Categoria Acao"] || ""}`, partes.join("; "));
            });
            const r = AC.resumoRisco(graduacao, acoesDoFator);
            if (r) {
              campoValor("Risco previsto após as ações", Calc.rotuloNivel(r.previsto));
              campoValor("Risco realizado (ações concluídas)", Calc.rotuloNivel(r.realizado));
            }
          } else {
            if (fr["Propor Acao"]) campoValor("Propor Ação?", rotuloSimNao(fr["Propor Acao"]));
            if (fr["Acao Eliminacao"]) campoValor("Ação para Eliminação", fr["Acao Eliminacao"]);
            if (fr["Controles Administrativos"]) campoValor("Controles Administrativos e Organizacionais", fr["Controles Administrativos"]);
          }
          y += 6;
        });
      });

      // ---------------- Conclusao ----------------
      novaPagina();
      registrar("conclusao");
      tituloSecao("7. Conclusão");
      paragrafo(
        modelo.Conclusao ||
          "Com base na análise realizada, recomenda-se a adoção das medidas de controle sugeridas neste laudo, priorizadas conforme a graduação de risco de cada Posto de Trabalho, em atendimento à NR-17 (Ergonomia) e à Portaria MTb nº 3.214/1978 e à Portaria MTP nº 4.219 (Gerenciamento de Riscos Ocupacionais)."
      );
      y += 30;
      garantirEspaco(60);
      doc.setDrawColor.apply(doc, PALETA.vinhoSuave2);
      doc.line(margem, y, margem + 220, y);
      y += 14;
      doc.setFont("Montserrat", "bold");
      doc.setFontSize(10);
      doc.setTextColor.apply(doc, PALETA.texto);
      doc.text(opcoes.emitidoPor || "Responsável Técnico ElevaLife", margem, y);
      y += 13;
      doc.setFont("Montserrat", "normal");
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, PALETA.cinzaQuente);
      doc.text("S.I.G.E - Sistema Integrado de Gestão ElevaLife", margem, y);

      // ---------------- Rodape (so na passada final) ----------------
      if (!gravando) {
        const totalPaginas = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPaginas; p++) {
          doc.setPage(p);
          if (p === 1 && !apenasAvaliacao) continue; // capa sem rodape
          doc.setFont("Montserrat", "normal");
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(`${opcoes.nomeCliente} - Laudo Ergonômico`, margem, alturaPagina - 20);
          doc.text(`Página ${p} de ${totalPaginas}`, margem + larguraUtil - doc.getTextWidth(`Página ${p} de ${totalPaginas}`), alturaPagina - 20);
        }
      }
      return pagina;
    }

    const docSeco = new jsPDFCtor({ unit: "pt", format: "a4" });
    if (window.BI && window.BI.registrarFontesPDF) window.BI.registrarFontesPDF(docSeco);
    const mapaPaginas = {};
    construirDocumento(docSeco, mapaPaginas, true);

    const doc = new jsPDFCtor({ unit: "pt", format: "a4" });
    if (window.BI && window.BI.registrarFontesPDF) window.BI.registrarFontesPDF(doc);
    construirDocumento(doc, mapaPaginas, false);
    // "arraybuffer" (nunca "blob"): os bytes puros funcionam em qualquer
    // contexto que monte o File/Blob final (ver ligarGeracaoLaudo) - um
    // Blob construido aqui dentro do jsPDF podia acabar de um "realm"
    // diferente do File criado logo depois, o que corrompe silenciosamente
    // o conteudo (virava um arquivo de poucos bytes).
    return doc.output("arraybuffer");
  }

  // Injeta o botao "Gerar Laudo (PDF)" na tela de Laudos - combinado com a
  // cascata Cliente/Setor/Posto (ver comCascata(ligarGeracaoLaudo) em
  // CADASTROS_CONFIG.laudo). Ao clicar: monta o PDF com gerarLaudoPDF() a
  // partir dos dados ja cadastrados (Avaliacao Ergonomica + Fatores de
  // Risco) e anexa o resultado no campo "Arquivo Url" do proprio formulario
  // - reaproveitando o MESMO caminho de upload usado pelo <input
  // type="file"> manual (ver campoFake.anexarArquivos em
  // construirCampoArquivo), sem duplicar a logica de envio.
  function ligarGeracaoLaudo(form, valoresIniciais) {
    const novoRegistro = !(valoresIniciais && valoresIniciais._id);
    // V 1.4: campos que o gerador preenche sozinho ficam ocultos (continuam no registro).
    ["Texto", "Emitido Por", "Hash Documento", "Registro Responsavel", "Registro Executor"].forEach((nome) => {
      const el = form._campos[nome];
      const caixa = el && el.closest ? el.closest(".campo-form") : null;
      if (caixa) caixa.hidden = true;
    });
    if (novoRegistro && form._campos["Revisao"] && !form._campos["Revisao"].value) form._campos["Revisao"].value = "00";
    if (novoRegistro && form._campos["Tipo"] && !form._campos["Tipo"].value) form._campos["Tipo"].value = "Laudo";
    // Certificado de calibracao so aparece quando "Incluir" = Sim.
    const selIncluir = form._campos["Incluir Certificado Calibracao"];
    const caixaCert = form._campos["Certificado Calibracao"] && form._campos["Certificado Calibracao"].closest(".campo-form");
    const atualizarCert = () => { if (caixaCert && selIncluir) caixaCert.hidden = selIncluir.value !== "Sim"; };
    if (selIncluir) { selIncluir.addEventListener("change", atualizarCert); atualizarCert(); }

    // Rodape: Cancelar | Salvar sem gerar | Gerar Laudo (acao principal: gera, anexa e registra).
    const acoes = form.querySelector(".form-cadastro-acoes");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-cad-primario";
    btn.textContent = "📄 Gerar Laudo";
    const btnSalvar = acoes ? acoes.querySelector("button[type=submit]") : null;
    if (btnSalvar) { btnSalvar.className = "btn-cad-secundario"; btnSalvar.textContent = "Salvar sem gerar"; }
    if (acoes) acoes.appendChild(btn);
    const avisoEl = document.createElement("div");
    avisoEl.className = "campo-arquivo-aviso";
    avisoEl.hidden = true;
    if (acoes) acoes.parentNode.insertBefore(avisoEl, acoes);

    function mostrarAviso(msg, ehErro) {
      avisoEl.textContent = msg || "";
      avisoEl.hidden = !msg;
      avisoEl.style.color = ehErro ? "var(--vinho)" : "";
    }

    btn.addEventListener("click", async () => {
      const elCliente = form._campos["Cliente"];
      const nomeCliente = elCliente ? elCliente.value : "";
      if (!nomeCliente) {
        mostrarAviso("Selecione o Cliente antes de gerar o laudo.", true);
        return;
      }
      if (form._campos["Responsavel Tecnico"] && !form._campos["Responsavel Tecnico"].value) {
        mostrarAviso("Selecione o Responsável técnico. Se a lista estiver vazia, cadastre o ergonomista em Cadastro › Ergonomistas.", true);
        return;
      }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const empresaId = resolverEmpresaIdDoForm(form);
      const opcoes = {
        empresaId,
        nomeCliente,
        tipo: form._campos["Tipo"] ? form._campos["Tipo"].value : "Laudo",
        setor: form._campos["Setor"] ? form._campos["Setor"].value : "",
        postoTrabalho: form._campos["Posto Trabalho"] ? form._campos["Posto Trabalho"].value : "",
        apenasPaginasAvaliacao: form._campos["Apenas Paginas Avaliacao"] ? form._campos["Apenas Paginas Avaliacao"].value : "",
        incluirCertificado: form._campos["Incluir Certificado Calibracao"] ? form._campos["Incluir Certificado Calibracao"].value === "Sim" : false,
        nomeCertificado: form._campos["Certificado Calibracao"] ? form._campos["Certificado Calibracao"].value : "",
        emitidoPor: form._campos["Emitido Por"] ? form._campos["Emitido Por"].value : "",
        emitidoEm: form._campos["Emitido Em"] ? form._campos["Emitido Em"].value : "",
        responsavelTecnico: form._campos["Responsavel Tecnico"] ? form._campos["Responsavel Tecnico"].value : "",
        ergonomistaExecutor: form._campos["Ergonomista Executor"] ? form._campos["Ergonomista Executor"].value : "",
        revisao: (form._campos["Revisao"] && form._campos["Revisao"].value) || "00",
        codigo: (form._campos["Codigo Verificacao"] && form._campos["Codigo Verificacao"].dataset.valorReal) || "",
      };
      if (!opcoes.codigo && window.BI.Laudo) {
        opcoes.codigo = window.BI.Laudo.novoCodigo((window.BI.dados.laudo || []).map((l) => l["Codigo Verificacao"]), "AEP");
      }

      btn.disabled = true;
      let geradoEAnexado = false;
      mostrarAviso("Gerando laudo...");
      try {
        const bufferPDF = await gerarLaudoPDF(opcoes);
        // V 1.3: registra no formulario o codigo de verificacao, a impressao digital
        // (SHA-256) do arquivo e os registros profissionais; a pagina publica
        // /verificar consulta esses campos depois que o Laudo for SALVO.
        const definirCalculado = (campo, valor) => {
          const el = form._campos[campo];
          if (!el) return;
          el.dataset.valorReal = valor || "";
          el.textContent = valor || "-";
        };
        try {
          const dig = await window.crypto.subtle.digest("SHA-256", bufferPDF);
          definirCalculado("Hash Documento", Array.from(new Uint8Array(dig)).map((b) => b.toString(16).padStart(2, "0")).join(""));
        } catch (e) { definirCalculado("Hash Documento", ""); }
        const saida = opcoes.saida || {};
        definirCalculado("Codigo Verificacao", saida.codigo || opcoes.codigo);
        definirCalculado("Registro Responsavel", saida.registroResponsavel);
        definirCalculado("Registro Executor", saida.registroExecutor);
        if (form._campos["Revisao"] && !form._campos["Revisao"].value) form._campos["Revisao"].value = saida.revisao || "00";
        if (form._campos["Emitido Por"] && !form._campos["Emitido Por"].value && opcoes.responsavelTecnico) form._campos["Emitido Por"].value = opcoes.responsavelTecnico;
        const dataArquivo = hojeMeiaNoite().toISOString().slice(0, 10);
        const nomeArquivo = `laudo-${slug(nomeCliente)}-${dataArquivo}.pdf`;
        const arquivoGerado = new File([bufferPDF], nomeArquivo, { type: "application/pdf" });

        const campoArquivo = form._campos["Arquivo Url"];
        if (campoArquivo && campoArquivo.anexarArquivos) {
          if (!window.BI.DB.estado.modoApi) {
            mostrarAviso("Laudo gerado. O upload automático só funciona na versão publicada (produção). Baixando o PDF...");
            const url = URL.createObjectURL(new Blob([bufferPDF], { type: "application/pdf" }));
            const link = document.createElement("a");
            link.href = url; link.download = nomeArquivo;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } else {
            await campoArquivo.anexarArquivos([arquivoGerado], empresaId || "GLOBAL");
            geradoEAnexado = true;
          }
        }
        if (form._campos["Emitido Em"] && !form._campos["Emitido Em"].value) {
          form._campos["Emitido Em"].value = hojeMeiaNoite().toISOString().slice(0, 10);
        }
        // "Texto do Laudo" nao e mais obrigatorio (ver camposLaudo), mas
        // preenche sozinho um resumo pra quem quiser ver algo no campo/na
        // lista - nunca obriga o usuario a digitar nada so pra conseguir
        // salvar o registro depois de gerar o PDF.
        if (form._campos["Texto"] && !form._campos["Texto"].value) {
          form._campos["Texto"].value = `Laudo gerado automaticamente pela plataforma S.I.G.E (Sistema Integrado de Gestão ElevaLife) em ${hojeMeiaNoite().toLocaleDateString("pt-BR")}, a partir das Avaliações Ergonômicas e do Inventário de Riscos já registrados para ${nomeCliente}. Ver arquivo PDF anexado.`;
        }
        // Registra o laudo na mesma acao (o submit do formulario grava o registro com o
        // codigo de verificacao e o arquivo); a lista passa a oferecer Baixar/Imprimir.
        if (geradoEAnexado) {
          mostrarAviso("Laudo gerado. Registrando...");
          form.requestSubmit();
        }
      } catch (erro) {
        mostrarAviso(erro && erro.message ? erro.message : "Falha ao gerar o laudo.", true);
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Mascaras de digitacao (campos que tem formato fixo). Guarda o texto ja
  // formatado - os leitores existentes (CNPJ etc.) so olham os digitos.
  const MASCARAS = {
    cnpj(t) {
      const n = t.replace(/\D/g, "").slice(0, 14);
      return n.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
    },
    cep(t) { const n = t.replace(/\D/g, "").slice(0, 8); return n.length > 5 ? n.slice(0, 5) + "-" + n.slice(5) : n; },
    telefone(t) {
      const n = t.replace(/\D/g, "").slice(0, 11);
      if (n.length <= 2) return n;
      if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
      if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
      return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    },
  };

  function sugestoes(campo) {
    const chaves = ["mapaRisco", "planoAcao", "absenteismo", "compativeis", "aet"];
    const set = new Set();
    chaves.forEach((c) => (window.BI.dados[c] || []).forEach((l) => { if (l[campo]) set.add(l[campo]); }));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
  }

  // ------------------------------------------------------------------
  // Cadastro-mestre - fonte unica de verdade de Cliente > Unidade > Setor >
  // Posto de Trabalho > Cargo > Atividade, normalizada em 6 tabelas (uma
  // tela de cadastro por entidade - ver aba "Cadastro"). Os 4 cadastros
  // operacionais (Mapa Risco, Plano Acao, Absenteismo, Compativeis) usam
  // selects em cascata validados contra elas - nunca texto livre.
  // Hierarquia revista 02/10/2026 (pedido do Leo: "o campo posto de
  // trabalho vem antes de cargo... EMPRESA > UNIDADE > SETOR > POSTO DE
  // TRABALHO > CARGO > ATIVIDADE AVALIADA") - Posto de Trabalho deixou de
  // ser irmao de Cargo dentro do Setor: agora um Cargo pertence a um Posto
  // de Trabalho especifico (Posto e ancestral de Cargo), e Atividade
  // continua filha do par Posto de Trabalho + Cargo. Isso ja refletia o
  // lado operacional (ver Calc.DIMENSOES em js/calc.js e idMapaRisco em
  // js/db.js, que ja usavam essa ordem) - so o cadastro-mestre ainda
  // estava com a ordem antiga.
  // ------------------------------------------------------------------
  const NIVEIS_HIERARQUIA = ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade"];

  // Colecao do cadastro-mestre que guarda cada nivel, e os campos
  // ancestrais que identificam um registro daquele nivel (usados para
  // filtrar em cascata).
  const COLECAO_DO_NIVEL = { Cliente: "cliente", Unidade: "unidade", Setor: "setor", "Posto Trabalho": "posto", Cargo: "cargo", Atividade: "atividade" };
  const ANCESTRAIS_DO_NIVEL = {
    Cliente: [],
    Unidade: ["Cliente"],
    Setor: ["Cliente", "Unidade"],
    "Posto Trabalho": ["Cliente", "Unidade", "Setor"],
    Cargo: ["Cliente", "Unidade", "Setor", "Posto Trabalho"],
    Atividade: ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo"],
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
    optBranco.textContent = opcoes.length ? "-" : "(selecione o nível anterior)";
    el.appendChild(optBranco);
    opcoes.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = T(v);
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
  // `nivelAlterado` (na ordem de NIVEIS_HIERARQUIA) - ex.: mudar Setor
  // recalcula Posto de Trabalho, Cargo e Atividade em cascata.
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

  // "Selecionar um ja existente OU incluir novo" para o PROPRIO nivel de
  // cada tela do cadastro-mestre (pedido do Leo 02/10/2026: o campo do
  // nivel sendo cadastrado - Setor/Posto de Trabalho/Cargo/Atividade - nao
  // pode ser um <select> fixo/desabilitado; tem que aceitar tanto escolher
  // um valor que ja existe (dentre os ancestrais escolhidos) quanto
  // digitar um nome novo). Usa o mesmo mecanismo de <input type="text"
  // list="..."> + <datalist> ja usado por sugestoesDe/sugestoesLista em
  // montarFormulario, so que recalculado dinamicamente a cada mudanca de
  // um campo ancestral (cascata) - por isso o campo precisa ser declarado
  // com `sugestoesDinamicas: true` (forca a criacao do <datalist> mesmo
  // sem uma sugestoesLista inicial - ver montarFormulario).
  function ligarSugestoesNivelProprio(nivelProprio, chaveCadastro, poolBase) {
    return function (form) {
      const campoProprio = form._campos[nivelProprio];
      if (!campoProprio) return;
      const ancestrais = ANCESTRAIS_DO_NIVEL[nivelProprio] || [];
      const listId = "dl-" + slug(chaveCadastro + "-" + nivelProprio);

      function atualizarSugestoes() {
        const dl = document.getElementById(listId);
        if (!dl) return;
        const valoresAtuais = {};
        ancestrais.forEach((a) => { valoresAtuais[a] = form._campos[a] ? form._campos[a].value : ""; });
        const existentes = linhasCadastroMestre(nivelProprio)
          .filter((l) => ancestrais.every((a) => !valoresAtuais[a] || l[a] === valoresAtuais[a]))
          .map((l) => l[nivelProprio])
          .filter(Boolean);
        const todas = Array.from(new Set((poolBase || []).concat(existentes))).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
        dl.innerHTML = "";
        todas.forEach((v) => {
          const opt = document.createElement("option");
          opt.value = v;
          dl.appendChild(opt);
        });
      }

      ancestrais.forEach((a) => {
        if (form._campos[a]) form._campos[a].addEventListener("change", atualizarSugestoes);
      });
      atualizarSugestoes();
    };
  }

  function regioesCorporais() {
    const m = window.BI.dados._meta || {};
    return [].concat(m.regioes_frente || [], m.regioes_tras || []);
  }

  // Seletor hierarquico de CID (Capitulo > Grupo > Categoria), restrito aos
  // capitulos que respondem pela quase totalidade do absenteismo ergonomico
  // - M (osteomuscular), S (lesoes/traumatismos), F (transtornos
  // mentais/stress) - pedido do Leo pra facilitar achar o codigo certo em
  // vez de rolar uma lista unica e desordenada. G (nervos/raizes/plexos)
  // entrou depois, como excecao: restrito ao bloco G50-G59 (mononeuropatias
  // do membro superior - tunel do carpo, nervo ulnar/radial etc.), que sao
  // as doencas neurologicas mais associadas a ergonomia/LER-DORT - pedido
  // do Leo em 24/09/2026 ("abra excecao para as doencas mais relacionadas a
  // Ergonomia e deixe-as disponiveis"). Cada "listaCID[i].Grupo" ja vem
  // pronto (ex.: "M50-M54 - Outras dorsopatias") direto da tabela de
  // referencia, entao a arvore e so um agrupamento em cima dela - nenhuma
  // duplicacao de dado.
  const CAPITULOS_CID = {
    M: "M - Doenças do sistema osteomuscular e do tecido conjuntivo",
    S: "S - Lesões, envenenamentos e outras consequências de causas externas",
    F: "F - Transtornos mentais e comportamentais",
    G: "G - Doenças do sistema nervoso",
  };
  const ORDEM_CAPITULOS_CID = ["M", "S", "F", "G"];

  function hierarquiaCID() {
    const arvore = {};
    (window.BI.dados.listaCID || []).forEach((l) => {
      const cap = l.Capitulo;
      if (!CAPITULOS_CID[cap]) return; // fora do escopo M/S/F/G
      arvore[cap] = arvore[cap] || {};
      const grupo = l.Grupo || "Outros";
      arvore[cap][grupo] = arvore[cap][grupo] || [];
      arvore[cap][grupo].push({ codigo: l["Cod CID"], cid: l["CID"], abrev: l["CID Abrev"] });
    });
    return arvore;
  }

  // Acha em qual Capitulo/Grupo um codigo ja salvo se encaixa (usado ao
  // editar um registro existente, pra pre-selecionar os 3 niveis certos).
  function localizarCID(codigo) {
    if (!codigo) return null;
    const linha = (window.BI.dados.listaCID || []).find((l) => l["Cod CID"] === codigo);
    // So retorna se o capitulo cair dentro de M/S/F/G (a arvore nova nao tem
    // ramo pra nenhum outro capitulo) - um codigo legado fora desse escopo
    // cai no fallback "Outro (codigo legado)" em vez de tentar (e falhar)
    // achar um grupo que nao existe na arvore.
    if (!linha || !CAPITULOS_CID[linha.Capitulo]) return null;
    return { capitulo: linha.Capitulo, grupo: linha.Grupo };
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

  function ligarPlanoAcao(form, valoresIniciaisPlano) {
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

    // E-mail do responsavel: se ja foi informado em outra acao do mesmo
    // responsavel, preenche sozinho (so quando o campo esta vazio).
    form._campos["Responsavel Acao"].addEventListener("change", () => {
      const campoEmail = form._campos["E-mail Responsavel"];
      if (!campoEmail || campoEmail.value) return;
      const nome = form._campos["Responsavel Acao"].value;
      const anterior = (window.BI.dados.planoAcao || []).find((a) => a["Responsavel Acao"] === nome && a["E-mail Responsavel"]);
      if (anterior) campoEmail.value = anterior["E-mail Responsavel"];
    });
    form._campos["Acao Recomendada"].addEventListener("change", () => {
      const cat = ACOES_CATEGORIA_MAP[form._campos["Acao Recomendada"].value];
      if (cat) form._campos["Categoria Acao"].value = cat;
    });
    ligarPlanoAcaoV12(form, valoresIniciaisPlano);
  }

  // V 1.2 - Plano de Acao: ligacao com o Inventario, "reduz o risco para",
  // situacao x data de conclusao, evidencia obrigatoria e excecao do
  // Administrador (justificativa + prazo). A regra de verdade esta no servidor
  // (api/src/shared/planoAcaoRegras.js); aqui so se orienta a pessoa antes.
  function ligarPlanoAcaoV12(form, ini) {
    ini = ini || {};
    const Calc = window.BI.Calc;
    const C = form._campos;
    const papel = (window.BI.DB.estado.identidade && window.BI.DB.estado.identidade.papel) || "";
    const ehAdmin = papel === "Administrador";
    const caixa = (nome) => {
      if (nome === "Evidencias") { const w = form.querySelector(".campo-arquivo"); return w ? w.closest(".campo-form") : null; }
      return C[nome] && C[nome].closest ? C[nome].closest(".campo-form") : null;
    };

    // Fator vinculado: so leitura (quem liga e o Inventario).
    if (C["Fator Risco Nome"]) { C["Fator Risco Nome"].readOnly = true; C["Fator Risco Nome"].title = "Definido pelo Inventário de Riscos"; }
    if (!ini["Fator Risco Id"] && caixa("Fator Risco Nome")) caixa("Fator Risco Nome").hidden = true;

    // Tipo -> categoria (mantem a categoria antiga coerente).
    if (C["Tipo Acao"]) C["Tipo Acao"].addEventListener("change", () => {
      if (C["Tipo Acao"].value && window.BI.Acoes) C["Categoria Acao"].value = window.BI.Acoes.categoriaDoTipo(C["Tipo Acao"].value);
    });

    // "Reduz o risco para" so oferece niveis abaixo do atual do segmento.
    function atualizarAlvo() {
      const alvo = C["Risco Apos Acao"]; if (!alvo) return;
      const permitidos = window.BI.Acoes ? window.BI.Acoes.niveisAbaixo(C["Risco Atual Segmento"].value) : [];
      const atual = alvo.value;
      Array.from(alvo.options).forEach((o) => { o.hidden = !!o.value && !permitidos.includes(o.value); o.disabled = o.hidden; });
      if (atual && !permitidos.includes(atual)) alvo.value = "";
    }
    if (C["Risco Atual Segmento"]) { C["Risco Atual Segmento"].addEventListener("change", atualizarAlvo); atualizarAlvo(); }

    // Situacao <-> data de conclusao.
    const st = C["Status Execucao"], dc = C["Dt Conclusao"];
    if (st && dc) {
      if (dc.value && st.value !== "Concluida") st.value = "Concluida";
      if (!st.value) st.value = "Nao iniciada";
      st.addEventListener("change", () => {
        if (st.value === "Concluida") { if (!dc.value) dc.value = BI.Datas.hojeISO(); } else if (dc.value) dc.value = "";
        dc.dispatchEvent(new Event("change"));
      });
      const aoMudarData = () => {
        if (dc.value) st.value = "Concluida";
        else if (st.value === "Concluida") st.value = "Em andamento";
        atualizarEvidencia();
      };
      dc.addEventListener("input", aoMudarData);
      dc.addEventListener("change", aoMudarData);
    }

    // Bloco da excecao do Administrador.
    const concluida = () => !!(dc && dc.value);
    const temEvidencia = () => !!(C["Evidencias"] && Array.isArray(C["Evidencias"].value) && C["Evidencias"].value.length);
    const dispensaVigente = ini._dispensa && !ini._dispensa.regularizadaEm;
    const eraConcluida = !!(ini["Dt Conclusao"] || ini["Status Execucao"] === "Concluida");
    const tinhaEvidencia = (ini.Evidencias || []).length > 0;
    function atualizarEvidencia() {
      const mostrar = ehAdmin && concluida() && !temEvidencia();
      ["Justificativa Sem Evidencia", "Prazo Evidencia"].forEach((n) => { const c = caixa(n); if (c) c.hidden = !mostrar; });
      let aviso = form.querySelector(".aviso-evidencia");
      if (concluida() && !temEvidencia()) {
        if (!aviso) {
          aviso = document.createElement("div"); aviso.className = "aviso-evidencia";
          const cx = caixa("Evidencias"); if (cx) cx.appendChild(aviso);
        }
        if (aviso) {
          const legado = eraConcluida && !tinhaEvidencia && !dispensaVigente;
          aviso.textContent = dispensaVigente
            ? `Evidência pendente até ${BI.Datas.isoParaBR(ini._dispensa.prazo)} (concluída sem evidência por ${ini._dispensa.por}). Anexe a foto ou o PDF aqui.`
            : legado ? "Ação concluída antes da exigência de evidência. Você pode anexar a evidência quando tiver."
            : ehAdmin ? "Anexe a evidência (foto ou PDF). Como Administrador, você pode concluir sem evidência informando a justificativa e a data-limite abaixo."
            : "Para concluir é obrigatório anexar a evidência (foto ou PDF). Somente um Administrador pode concluir sem evidência.";
        }
      } else if (aviso) aviso.remove();
    }
    const lista = form.querySelector(".campo-arquivo-lista");
    if (lista && window.MutationObserver) new MutationObserver(atualizarEvidencia).observe(lista, { childList: true });
    atualizarEvidencia();

    form._validarEvidencia = () => {
      if (!concluida() || temEvidencia()) return null;
      if (eraConcluida && !tinhaEvidencia) return null; // legado ou dispensa ja concedida: o servidor mantem
      if (!ehAdmin) return "Para concluir a ação é obrigatório anexar a evidência (foto ou PDF). Somente um Administrador pode concluir sem evidência.";
      if (String(C["Justificativa Sem Evidencia"].value || "").trim().length < 10) return "Para concluir sem evidência, informe a justificativa (mínimo de 10 caracteres).";
      if (!C["Prazo Evidencia"].value) return "Para concluir sem evidência, informe a data-limite para anexá-la.";
      return null;
    };
  }

  // Consulta automatica de CNPJ no Cadastro de Cliente (pedido do Leo
  // 02/10/2026: "eu digitei o CNPJ da empresa e ele nao fez a busca
  // automatica com a validacao e auto preenchimento das informacoes").
  // Ao sair do campo CNPJ (blur) com os 14 digitos, busca na BrasilAPI (via
  // api/src/functions/cnpj.js, que espelha o cadastro da Receita Federal) e
  // preenche Razao Social/CNAE/telefone/endereco sozinho - so em campos
  // ainda VAZIOS, nunca sobrescrevendo algo ja digitado (nem num cliente
  // existente sendo editado, nem se a pessoa mudar o CNPJ na mao depois).
  // Inscricao Estadual (registro ESTADUAL - a Receita Federal nao tem esse
  // dado) e Grau de Risco NR-4 (classificacao de Seg. do Trabalho por CNAE,
  // nao algo que a consulta devolve) continuam so preenchimento manual.
  function ligarConsultaCNPJ(form) {
    const campoCNPJ = form._campos["CNPJ"];
    if (!campoCNPJ) return;

    function preencherSeVazio(nomeCampo, valor) {
      const el = form._campos[nomeCampo];
      if (el && valor && !el.value) { el.value = valor; el.dispatchEvent(new Event("input")); }
    }

    // Grau de Risco (NR-4): a API so devolve uma APROXIMACAO (por Divisao do
    // CNAE, ver GRAU_RISCO_POR_DIVISAO em api/src/functions/cnpj.js - nao e
    // a tabela oficial do Quadro I, que e por Classe/Subclasse) - pedido do
    // Leo 02/10/2026, ciente do risco ("monta uma tabela e marca pra
    // conferencia"). Por isso, alem de preencher, marca visualmente o campo
    // (contorno laranja + title) ate alguem tocar nele confirmando/corrigindo.
    function preencherGrauRiscoAproximado(valor) {
      const el = form._campos["Grau Risco NR4"];
      if (!el || !valor || el.value) return false;
      el.value = valor;
      el.style.outline = "2px solid #c77700";
      el.title = "Preenchido automaticamente por aproximação (pela Divisão do CNAE) - confirme o grau correto antes de salvar.";
      el.addEventListener("change", () => { el.style.outline = ""; el.title = ""; }, { once: true });
      return true;
    }

    async function buscarCNPJ() {
      const numero = String(campoCNPJ.value || "").replace(/\D/g, "");
      if (numero.length !== 14) return;
      form._erroEl.hidden = true;
      campoCNPJ.disabled = true;
      const avisos = [];
      try {
        const resp = await fetch("/api/cnpj/" + numero, { credentials: "same-origin" });
        const corpo = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          form._erroEl.hidden = false;
          form._erroEl.textContent = (corpo && corpo.erro) || "Falha ao consultar o CNPJ.";
          return;
        }
        if (corpo.RazaoSocial) preencherSeVazio("Cliente", corpo.RazaoSocial);
        preencherSeVazio("CNAE", corpo.CNAE);
        preencherSeVazio("Telefone", corpo.Telefone);
        preencherSeVazio("CEP", corpo.CEP);
        preencherSeVazio("Logradouro", corpo.Logradouro);
        preencherSeVazio("Numero", corpo.Numero);
        preencherSeVazio("Complemento", corpo.Complemento);
        preencherSeVazio("Bairro", corpo.Bairro);
        preencherSeVazio("Cidade", corpo.Cidade);
        preencherSeVazio("Estado", corpo.Estado);
        if (preencherGrauRiscoAproximado(corpo.GrauRiscoNR4)) {
          avisos.push('Grau de Risco (NR-4) preenchido por aproximação, pela Divisão do CNAE – não é a classificação oficial do Quadro I (essa é por Classe/Subclasse). Confirme o grau correto antes de salvar.');
        }
        if (corpo.situacaoAtiva === false) {
          avisos.push(`Atenção: este CNPJ consta como "${corpo.SituacaoCadastral}" na Receita Federal (dados preenchidos mesmo assim - confira antes de salvar).`);
        }
        if (avisos.length) {
          form._erroEl.hidden = false;
          form._erroEl.textContent = avisos.join(" ");
        }
      } catch (e) {
        form._erroEl.hidden = false;
        form._erroEl.textContent = "Falha ao consultar o CNPJ: " + (e && e.message ? e.message : String(e));
      } finally {
        campoCNPJ.disabled = false;
      }
    }

    campoCNPJ.addEventListener("blur", buscarCNPJ);
  }

  function novoIdRegistro() {
    return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  // V 1.2 - editor das acoes de um fator (ver js/acoes.js). Guarda o editor
  // em form._editorAcoes; o id do fator novo e gerado ANTES de salvar, para as
  // acoes ja nascerem ligadas a ele ("Fator Risco Id").
  function construirEditorAcoesDoFator(form, iniciais) {
    const lerCampo = (n) => (form._campos[n] && form._campos[n].value) || "";
    const idExistente = iniciais && iniciais._id;
    const editor = window.BI.Acoes.criarEditor({
      fatorId: idExistente || null,
      podeEditar: !window.BI.DB.estado.somenteLeitura,
      contexto: () => {
        const c = {};
        window.BI.Calc.DIMENSOES.forEach((d) => { c[d] = lerCampo(d); });
        return c;
      },
      nivelAtual: () => {
        const el = form._campos["Graduacao Risco"];
        return (el && el.dataset && el.dataset.valorReal) || "";
      },
      nomeFator: () => lerCampo("Fator"),
      legado: { eliminacao: iniciais && iniciais["Acao Eliminacao"], organizacional: iniciais && iniciais["Controles Administrativos"] },
      aoAbrirNoPlano: (acao) => {
        if (editor.temAlteracoes() && !window.confirm("Há alterações nas ações que ainda não foram salvas. Sair do Inventário sem salvar?")) return;
        ativarAba("registro");
        selecionarSubAbaCadastro("registro", "planoAcao");
        abrirFormEditar("planoAcao", acao._id);
      },
    });
    form._editorAcoes = editor;
    return editor.el;
  }

  // Liga o Inventario de Riscos (Fator de Risco) as duas fontes de opcoes
  // dinamicas que nao vem mais fixas na declaracao de camposFatorRisco():
  // 1) Fator depende do Grupo escolhido (checklist ISO TS-20646 - ver
  //    Calc.fatoresDoGrupo); 2) Criticidade/Probabilidade (e o calculo de
  //    Pontuacao/Graduacao) dependem da Matriz de Risco configurada para o
  //    Cliente escolhido (Cadastro de Cliente > "Matriz Risco" - ver
  //    Calc.matrizDoCliente/escalaDaMatriz/nivelDaMatriz/pontuacaoDaMatriz).
  // Mesmo padrao visual de ligarCalculoRiscoGlobal para campos "calculado"
  // (textContent = rotulo exibido, dataset.valorReal = valor gravado).
  function ligarCascataFatorRisco(form, valoresIniciais) {
    const Calc = window.BI.Calc;
    const iniciais = valoresIniciais || {};

    function nomeMatrizAtual() {
      const nomeCliente = form._campos["Cliente"] ? form._campos["Cliente"].value : "";
      return Calc.matrizDoCliente(window.BI.dados.cliente, nomeCliente);
    }

    function atualizarFator(valorDesejado) {
      const grupo = form._campos["Grupo"].value;
      repopularSelectCascata(form._campos["Fator"], Calc.fatoresDoGrupo(grupo), valorDesejado);
    }

    function recalcularPontuacao() {
      const nomeMatriz = nomeMatrizAtual();
      const criticidade = form._campos["Criticidade"].value;
      const probabilidade = form._campos["Probabilidade"].value;
      const elPontuacao = form._campos["Pontuacao Risco"];
      const elGraduacao = form._campos["Graduacao Risco"];
      const temAmbos = !!(criticidade && probabilidade);
      const pontuacao = temAmbos ? Calc.pontuacaoDaMatriz(nomeMatriz, probabilidade, criticidade) : null;
      const nivel = temAmbos ? Calc.nivelDaMatriz(nomeMatriz, probabilidade, criticidade) : "";
      elPontuacao.textContent = pontuacao != null ? String(pontuacao) : "-";
      elPontuacao.dataset.valorReal = pontuacao != null ? pontuacao : "";
      elGraduacao.textContent = nivel || "-";
      elGraduacao.dataset.valorReal = nivel || "";
      elGraduacao.style.color = nivel ? (Calc.corStatus(nivel) || "") : "";
      elGraduacao.style.fontWeight = "700";
      if (form._editorAcoes) form._editorAcoes.atualizarNivel(); // V 1.2: acoes acompanham o nivel do fator
    }

    function atualizarMatriz(valorDesejadoCriticidade, valorDesejadoProbabilidade) {
      const nomeMatriz = nomeMatrizAtual();
      const escala = Calc.escalaDaMatriz(nomeMatriz);
      repopularSelectCascata(form._campos["Criticidade"], escala, valorDesejadoCriticidade);
      repopularSelectCascata(form._campos["Probabilidade"], escala, valorDesejadoProbabilidade);
      const elMatriz = form._campos["Matriz"];
      elMatriz.textContent = nomeMatriz;
      elMatriz.dataset.valorReal = nomeMatriz;
      recalcularPontuacao();
    }

    // Estado inicial (novo registro ou edicao) - usa os valores gravados
    // (iniciais), nunca form._campos[...].value, porque os selects "Fator"/
    // "Criticidade"/"Probabilidade" comecam com opcoes vazias (a lista real
    // so existe depois de saber o Grupo/a Matriz) e perderiam o valor
    // gravado se a gente tentasse ler o value antes de repopular as opcoes.
    atualizarFator(iniciais["Fator"] || "");
    atualizarMatriz(iniciais["Criticidade"] || "", iniciais["Probabilidade"] || "");

    form._campos["Grupo"].addEventListener("change", () => atualizarFator());
    form._campos["Cliente"].addEventListener("change", () => atualizarMatriz());
    form._campos["Criticidade"].addEventListener("change", recalcularPontuacao);
    form._campos["Probabilidade"].addEventListener("change", recalcularPontuacao);
  }

  // ------------------------------------------------------------------
  // Checklist de Inventario de Riscos (pedido do Leo 28/09/2026: "criou a
  // avaliacao, vai registrar o inventario de risco daquela avaliacao. Abre
  // uma tela com caixas de selecao... nao queria uma copia do outro
  // sistema, queria que voce se baseasse na estrutura do sistema, na
  // logica, e fizesse um novo"). Substitui, so pra este fluxo (a partir de
  // uma linha ja existente de Avaliacao Ergonomica), o caminho antigo de
  // abrir "Novo Registro" em Inventario de Riscos e escolher Grupo/Fator um
  // a um: aqui os 41 fatores da ISO TS-20646 (Calc.GRUPOS_FATOR_RISCO/
  // fatoresDoGrupo - mesma fonte unica do cadastro antigo) aparecem todos
  // de uma vez, agrupados, cada um com uma caixa de selecao. O cadastro
  // antigo (tela "Inventário de Riscos (AEP)") continua existindo do lado -
  // util pra buscar/editar/excluir um fator especifico depois.
  // ------------------------------------------------------------------
  let elChecklistPainel = null;
  let elOverlayChecklist = null;

  function obterPainelChecklist() {
    if (elChecklistPainel) return elChecklistPainel;

    const overlay = document.createElement("div");
    overlay.className = "overlay-drilldown overlay-checklist";
    overlay.id = "overlay-checklist";
    overlay.hidden = true;
    document.body.appendChild(overlay);
    elOverlayChecklist = overlay;

    const painel = document.createElement("aside");
    painel.className = "drilldown-painel checklist-painel";
    painel.id = "checklist-painel";
    painel.setAttribute("aria-hidden", "true");

    const cab = document.createElement("div");
    cab.className = "drilldown-cabecalho";
    const titulos = document.createElement("div");
    titulos.className = "drilldown-titulos";
    const titulo = document.createElement("div");
    titulo.className = "titulo";
    titulo.id = "checklist-titulo";
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.id = "checklist-sub";
    titulos.appendChild(titulo);
    titulos.appendChild(sub);
    const btnFechar = document.createElement("button");
    btnFechar.type = "button";
    btnFechar.className = "drilldown-fechar";
    btnFechar.setAttribute("aria-label", "Fechar checklist de inventário de riscos");
    btnFechar.textContent = "×";
    btnFechar.addEventListener("click", fecharPainelChecklist);
    cab.appendChild(titulos);
    cab.appendChild(btnFechar);

    const corpo = document.createElement("div");
    corpo.className = "drilldown-corpo checklist-corpo";
    corpo.id = "checklist-corpo";

    const erro = document.createElement("div");
    erro.className = "form-cadastro-erro checklist-erro";
    erro.hidden = true;
    erro.id = "checklist-erro";

    const rodape = document.createElement("div");
    rodape.className = "checklist-rodape";
    const btnCancelar = document.createElement("button");
    btnCancelar.type = "button"; btnCancelar.className = "btn-cad-secundario"; btnCancelar.textContent = "Cancelar";
    btnCancelar.addEventListener("click", fecharPainelChecklist);
    const btnSalvar = document.createElement("button");
    btnSalvar.type = "button"; btnSalvar.className = "btn-cad-primario"; btnSalvar.textContent = "Salvar Inventário de Riscos";
    rodape.appendChild(btnCancelar);
    rodape.appendChild(btnSalvar);
    painel.rodapeBotaoSalvar = btnSalvar;

    painel.appendChild(cab);
    painel.appendChild(corpo);
    painel.appendChild(erro);
    painel.appendChild(rodape);
    document.body.appendChild(painel);

    elChecklistPainel = painel;
    return painel;
  }

  function fecharPainelChecklist() {
    if (elChecklistPainel) { elChecklistPainel.classList.remove("aberto"); elChecklistPainel.setAttribute("aria-hidden", "true"); }
    if (elOverlayChecklist) elOverlayChecklist.hidden = true;
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && elChecklistPainel && elChecklistPainel.classList.contains("aberto")) fecharPainelChecklist();
  });
  document.addEventListener("click", (ev) => {
    if (!elChecklistPainel || !elChecklistPainel.classList.contains("aberto")) return;
    // Exclui o proprio botao que ABRE o painel (linha da tabela de Avaliacao
    // Ergonomica) - senao o clique que abre o painel borbulha ate aqui no
    // MESMO evento (o listener do botao ja rodou e marcou ".aberto" antes de
    // este listener no document ser alcancado) e fecha o painel na hora,
    // igual ao workaround ja existente pro drill-down com canvas/clique-que-abre.
    if (ev.target.closest(".checklist-painel") || ev.target.closest(".btn-acao-linha-checklist")) return;
    fecharPainelChecklist();
  });

  // Acha o registro de fatorRisco ja cadastrado (se algum) para esta
  // combinacao exata de posto (chave completa da Avaliacao) + Grupo/Fator.
  function fatorRiscoExistente(linhaAval, grupo, fator) {
    return (window.BI.dados.fatorRisco || []).find((f) =>
      f.Cliente === linhaAval.Cliente && f.Unidade === linhaAval.Unidade && f.Setor === linhaAval.Setor &&
      f.Cargo === linhaAval.Cargo && f["Posto Trabalho"] === linhaAval["Posto Trabalho"] && f.Atividade === linhaAval.Atividade &&
      f.Grupo === grupo && f.Fator === fator
    );
  }

  function abrirInventarioChecklist(linhaAval) {
    const Calc = window.BI.Calc;
    const painel = obterPainelChecklist();
    const podeEditar = window.BI.DB.estado.disponivel;

    document.getElementById("checklist-titulo").textContent = "Inventário de Riscos - " + (linhaAval["Posto Trabalho"] || "");
    document.getElementById("checklist-sub").textContent =
      [linhaAval.Cliente, linhaAval.Unidade, linhaAval.Setor, linhaAval.Cargo, linhaAval.Atividade].filter(Boolean).join(" › ");

    const corpo = document.getElementById("checklist-corpo");
    corpo.innerHTML = "";
    const erroEl = document.getElementById("checklist-erro");
    erroEl.hidden = true;
    erroEl.textContent = "";

    const nomeMatriz = Calc.matrizDoCliente(window.BI.dados.cliente, linhaAval.Cliente);
    const escala = Calc.escalaDaMatriz(nomeMatriz);

    const aviso = document.createElement("div");
    aviso.className = "checklist-aviso-matriz";
    aviso.textContent = "Matriz de Risco em uso: " + nomeMatriz + " (definida no Cadastro de Cliente).";
    corpo.appendChild(aviso);

    // Uma "linha" por fator (41 no total) - guarda tudo que o Salvar precisa
    // pra decidir se cria/atualiza/marca "Nao" cada uma.
    const linhasChecklist = [];

    Calc.GRUPOS_FATOR_RISCO.forEach((grupo) => {
      const tituloGrupo = document.createElement("div");
      tituloGrupo.className = "checklist-grupo-titulo";
      tituloGrupo.textContent = grupo;
      corpo.appendChild(tituloGrupo);

      Calc.fatoresDoGrupo(grupo).forEach((fator) => {
        const registroExistente = fatorRiscoExistente(linhaAval, grupo, fator);
        const marcadoInicialmente = !!registroExistente && registroExistente["Existe Fator Risco"] === "Sim";

        const linha = document.createElement("div");
        linha.className = "checklist-fator-linha";

        const cabecalhoLinha = document.createElement("label");
        cabecalhoLinha.className = "checklist-fator-cabecalho";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = marcadoInicialmente;
        checkbox.disabled = !podeEditar;
        const textoFator = document.createElement("span");
        textoFator.textContent = fator;
        cabecalhoLinha.appendChild(checkbox);
        cabecalhoLinha.appendChild(textoFator);
        linha.appendChild(cabecalhoLinha);

        const detalhes = document.createElement("div");
        detalhes.className = "checklist-fator-detalhes";
        detalhes.hidden = !marcadoInicialmente;

        function campoDetalhe(rotulo) {
          const div = document.createElement("div");
          div.className = "campo-form";
          const lbl = document.createElement("label");
          lbl.textContent = rotulo;
          div.appendChild(lbl);
          return div;
        }

        const reg = registroExistente || {};
        function selecaoEscala(valorAtual) {
          const sel = document.createElement("select");
          sel.appendChild(document.createElement("option"));
          escala.forEach((v) => { const o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o); });
          sel.value = valorAtual || "";
          if (!podeEditar) sel.disabled = true;
          return sel;
        }
        function areaTexto(rotulo, chave, dica) {
          const div = campoDetalhe(rotulo);
          div.className += " campo-form-largo";
          const ta = document.createElement("textarea");
          ta.rows = 2;
          ta.value = reg[chave] || "";
          if (dica) ta.placeholder = dica;
          if (!podeEditar) ta.disabled = true;
          div.appendChild(ta);
          return { div, el: ta };
        }
        function badgeDe(rotulo) {
          const div = campoDetalhe(rotulo);
          const b = document.createElement("span");
          b.className = "checklist-badge-graduacao";
          div.appendChild(b);
          return { div, el: b };
        }
        function titulinho(texto) {
          const t = document.createElement("div");
          t.className = "checklist-sub-titulo";
          t.textContent = texto;
          return t;
        }
        function pintar(elBadge, criticidade, probabilidade) {
          const nivel = criticidade && probabilidade ? Calc.nivelDaMatriz(nomeMatriz, probabilidade, criticidade) : "";
          elBadge.textContent = nivel || "-";
          elBadge.style.color = nivel ? (Calc.corStatus(nivel) || "") : "";
        }

        // --- Descrição do risco
        detalhes.appendChild(titulinho("Descrição do risco"));
        const tFonte = areaTexto("Fonte Geradora", "Circunstancia Geradora", "O que gera este risco no posto");
        const tConseq = areaTexto("Consequência", "Consequencia", "Dano possível à saúde do trabalhador");
        const tMedida = areaTexto("Medidas de Controle Existentes", "Medida Controle Existente", "O que já é feito hoje para controlar");
        detalhes.appendChild(tFonte.div);
        detalhes.appendChild(tConseq.div);
        detalhes.appendChild(tMedida.div);

        // --- Classificação atual
        detalhes.appendChild(titulinho("Classificação atual"));
        const selCriticidade = selecaoEscala(reg.Criticidade);
        const selProbabilidade = selecaoEscala(reg.Probabilidade);
        const divCriticidade = campoDetalhe("Criticidade (Gravidade)"); divCriticidade.appendChild(selCriticidade);
        const divProbabilidade = campoDetalhe("Probabilidade"); divProbabilidade.appendChild(selProbabilidade);
        const bGrad = badgeDe("Graduação (calculada)");
        detalhes.appendChild(divCriticidade);
        detalhes.appendChild(divProbabilidade);
        detalhes.appendChild(bGrad.div);
        const recalcularGraduacao = () => pintar(bGrad.el, selCriticidade.value, selProbabilidade.value);
        recalcularGraduacao();
        selCriticidade.addEventListener("change", recalcularGraduacao);
        selProbabilidade.addEventListener("change", recalcularGraduacao);

        // --- Ações (V 1.2): lista de acoes por fator, cada uma com tipo, segmento
        // corporal, "reduz o risco para...", responsavel, prazo e evidencias.
        // O risco apos a melhoria e CALCULADO a partir delas (js/acoes.js).
        detalhes.appendChild(titulinho("Ações para reduzir o risco"));
        const idFator = registroExistente ? registroExistente._id : novoIdRegistro();
        const slotEditor = document.createElement("div");
        slotEditor.className = "campo-form-largo";
        detalhes.appendChild(slotEditor);
        let editorAcoes = null;
        const nivelDoFator = () => (selCriticidade.value && selProbabilidade.value
          ? Calc.nivelDaMatriz(nomeMatriz, selProbabilidade.value, selCriticidade.value) : "");
        function garantirEditor() {
          if (editorAcoes) return editorAcoes;
          editorAcoes = window.BI.Acoes.criarEditor({
            fatorId: registroExistente ? registroExistente._id : null,
            podeEditar,
            contexto: () => ({
              Cliente: linhaAval.Cliente, Unidade: linhaAval.Unidade, Setor: linhaAval.Setor,
              Cargo: linhaAval.Cargo, "Posto Trabalho": linhaAval["Posto Trabalho"], Atividade: linhaAval.Atividade,
            }),
            nivelAtual: nivelDoFator,
            nomeFator: () => fator,
            legado: { eliminacao: reg["Acao Eliminacao"], organizacional: reg["Controles Administrativos"] },
          });
          slotEditor.appendChild(editorAcoes.el);
          return editorAcoes;
        }
        if (registroExistente && registroExistente["Existe Fator Risco"] === "Sim") garantirEditor();
        const reaplicarNivel = () => { if (editorAcoes) editorAcoes.atualizarNivel(); };
        selCriticidade.addEventListener("change", reaplicarNivel);
        selProbabilidade.addEventListener("change", reaplicarNivel);
        linha.appendChild(detalhes);
        corpo.appendChild(linha);

        checkbox.addEventListener("change", () => {
          detalhes.hidden = !checkbox.checked;
          if (checkbox.checked) garantirEditor();
        });

        linhasChecklist.push({
          grupo, fator, registroExistente, checkbox, selCriticidade, selProbabilidade, linha, idFator,
          getEditor: () => editorAcoes,
          // chave gravada -> elemento (texto/selects da tela)
          campos: {
            "Circunstancia Geradora": tFonte.el, Consequencia: tConseq.el, "Medida Controle Existente": tMedida.el,
          },
        });
      });
    });

    const btnSalvar = painel.rodapeBotaoSalvar;
    btnSalvar.disabled = !podeEditar;
    btnSalvar.onclick = async () => {
      erroEl.hidden = true;
      linhasChecklist.forEach((l) => l.linha.classList.remove("checklist-fator-com-erro"));

      // Valida ANTES de salvar qualquer coisa: todo fator marcado precisa de
      // Criticidade + Probabilidade (mesma exigencia do cadastro antigo,
      // camposFatorRisco) - senao a Graduacao nao tem como ser calculada.
      const semClassificacao = linhasChecklist.find((l) => l.checkbox.checked && (!l.selCriticidade.value || !l.selProbabilidade.value));
      if (semClassificacao) {
        erroEl.hidden = false;
        erroEl.textContent = `Preencha Criticidade e Probabilidade do fator "${semClassificacao.fator}" (marcado, mas sem classificação).`;
        semClassificacao.linha.classList.add("checklist-fator-com-erro");
        if (typeof semClassificacao.linha.scrollIntoView === "function") {
          semClassificacao.linha.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        return;
      }

      for (const l of linhasChecklist) {
        const ed = l.checkbox.checked && l.getEditor();
        const erroAcao = ed ? ed.validar() : null;
        if (erroAcao) {
          erroEl.hidden = false;
          erroEl.textContent = `Fator "${l.fator}": ${erroAcao}`;
          l.linha.classList.add("checklist-fator-com-erro");
          return;
        }
      }

      const paraSalvar = linhasChecklist.filter((l) => {
        const jaEraSim = l.registroExistente && l.registroExistente["Existe Fator Risco"] === "Sim";
        if (l.checkbox.checked) {
          // Novo, ou existente mas com Criticidade/Probabilidade alteradas.
          if (!jaEraSim) return true;
          if (l.registroExistente.Criticidade !== l.selCriticidade.value || l.registroExistente.Probabilidade !== l.selProbabilidade.value) return true;
          if (l.getEditor() && l.getEditor().temAlteracoes()) return true;
          return Object.keys(l.campos).some((k) => (l.registroExistente[k] || "") !== (l.campos[k].value || ""));
        }
        // Desmarcado: so precisa salvar se antes estava "Sim" (senao nao ha nada pra mudar).
        return jaEraSim;
      });

      if (!paraSalvar.length) { fecharPainelChecklist(); return; }

      btnSalvar.disabled = true;
      const textoOriginal = btnSalvar.textContent;
      try {
        for (let i = 0; i < paraSalvar.length; i++) {
          const l = paraSalvar[i];
          btnSalvar.textContent = `Salvando (${i + 1}/${paraSalvar.length})...`;
          const marcado = l.checkbox.checked;
          const nivel = marcado ? Calc.nivelDaMatriz(nomeMatriz, l.selProbabilidade.value, l.selCriticidade.value) : "";
          const pontuacao = marcado ? Calc.pontuacaoDaMatriz(nomeMatriz, l.selProbabilidade.value, l.selCriticidade.value) : null;
          const dados = Object.assign(
            {
              Cliente: linhaAval.Cliente, Unidade: linhaAval.Unidade, Setor: linhaAval.Setor,
              Cargo: linhaAval.Cargo, "Posto Trabalho": linhaAval["Posto Trabalho"], Atividade: linhaAval.Atividade,
              Grupo: l.grupo, Fator: l.fator,
              "Existe Fator Risco": marcado ? "Sim" : "Nao",
              Criticidade: marcado ? l.selCriticidade.value : null,
              Probabilidade: marcado ? l.selProbabilidade.value : null,
              "Pontuacao Risco": pontuacao,
              "Graduacao Risco": nivel || null,
              Matriz: marcado ? nomeMatriz : null,
              // Campos de acompanhamento que nao estao nesta tela
              // (SLA, Observacao, Valido Ate) - preserva o que ja existia
              // ou entra nulo num registro novo.
              "Circunstancia Geradora": null, Consequencia: null, "Medida Controle Existente": null,
              SLA: null, Observacao: null, "Valido Ate": null,
              Status: STATUS_FATOR_RISCO_POOL[0],
            },
            l.registroExistente || {}
          );
          // Object.assign acima usa o registro existente como "base" de
          // campos livres (preserva o que o ergonomista ja tinha escrito no
          // cadastro antigo), mas os campos calculados/da checklist (Existe
          // Fator Risco/Criticidade/Probabilidade/Pontuacao/Graduacao/
          // Matriz) tem que vir sempre do que foi decidido AGORA na tela -
          // reaplica por cima.
          Object.assign(dados, {
            "Existe Fator Risco": marcado ? "Sim" : "Nao",
            Criticidade: marcado ? l.selCriticidade.value : null,
            Probabilidade: marcado ? l.selProbabilidade.value : null,
            "Pontuacao Risco": pontuacao,
            "Graduacao Risco": nivel || null,
            Matriz: marcado ? nomeMatriz : null,
          });
          if (marcado) {
            Object.keys(l.campos).forEach((k) => { dados[k] = l.campos[k].value || null; });
            if (l.getEditor() && l.getEditor().total() > 0) dados["Propor Acao"] = "Sim";
            if (!dados["Dt Identificacao"]) dados["Dt Identificacao"] = BI.Datas.hojeISO();
          }
          delete dados._id;
          if (l.registroExistente) await window.BI.DB.salvar("fatorRisco", l.registroExistente._id, dados);
          else await window.BI.DB.salvar("fatorRisco", l.idFator, dados, true); // id escolhido aqui: as acoes nascem ligadas a ele
          const ed = marcado ? l.getEditor() : null;
          if (ed && ed.temAlteracoes()) await ed.salvar(l.idFator);
        }
        fecharPainelChecklist();
      } catch (e) {
        erroEl.hidden = false;
        erroEl.textContent = "Erro ao salvar o inventário de riscos: " + (e && e.message ? e.message : String(e));
      } finally {
        btnSalvar.disabled = !podeEditar;
        btnSalvar.textContent = textoOriginal;
      }
    };

    painel.classList.add("aberto");
    painel.setAttribute("aria-hidden", "false");
    if (elOverlayChecklist) elOverlayChecklist.hidden = false;
    corpo.scrollTop = 0;
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
      aoConstruir: ligarConsultaCNPJ,
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
      aoConstruir: comCascata(ligarSugestoesNivelProprio("Setor", "setor", SETORES_POOL)),
    },
    posto: {
      grupo: "mestre", icone: "📍", tituloMenu: "Posto de Trabalho",
      titulo: "Cadastro de Posto de Trabalho",
      colunasTabela: ["Cliente", "Unidade", "Setor", "Posto Trabalho"],
      colunasData: [], camposData: [],
      campos: camposCadastroPosto(),
      aoConstruir: comCascata(ligarSugestoesNivelProprio("Posto Trabalho", "posto", [])),
    },
    cargo: {
      grupo: "mestre", icone: "💼", tituloMenu: "Cargo",
      titulo: "Cadastro de Cargo",
      colunasTabela: ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo"],
      colunasData: [], camposData: [],
      campos: camposCadastroCargo(),
      aoConstruir: comCascata(ligarSugestoesNivelProprio("Cargo", "cargo", [])),
    },
    atividade: {
      grupo: "mestre", icone: "🏷️", tituloMenu: "Atividade",
      titulo: "Cadastro de Atividade",
      colunasTabela: ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade"],
      colunasData: [], camposData: [],
      campos: camposCadastroAtividade(),
      aoConstruir: comCascata(ligarSugestoesNivelProprio("Atividade", "atividade", [])),
    },
    mapaRisco: {
      grupo: "registro", icone: "⚠️", tituloMenu: "Mapa de Risco",
      titulo: "Mapa de Risco",
      colunasTabela: ["Cliente", "Setor", "Posto Trabalho", "Cargo", "Dt Avaliacao", "Risco Global"],
      colunasData: ["Dt Avaliacao"],
      camposData: ["Dt Avaliacao"],
      campos: camposChave().concat(
        [{ campo: "Dt Avaliacao", rotulo: "Data da avaliação", tipo: "data", obrigatorio: true, padraoHoje: true }],
        window.BI.Calc ? window.BI.Calc.DIMENSOES_RISCO.map((d) => ({ campo: d, rotulo: d, tipo: "numero", obrigatorio: true, min: 1, max: 4 })) : [],
        [{ campo: "Risco Global", rotulo: "Risco Global (calculado)", tipo: "calculado" }]
      ),
      aoConstruir: comCascata(ligarCalculoRiscoGlobal),
    },
    planoAcao: {
      grupo: "registro", icone: "🛠️", tituloMenu: "Plano de Ação",
      titulo: "Plano de Ação",
      colunasTabela: ["Cliente", "Setor", "Posto Trabalho", "Acao Recomendada", "Responsavel Acao", "Dt Programada", "Dt Conclusao"],
      colunasData: ["Dt Programada", "Dt Conclusao"],
      camposData: ["Dt Programada", "Dt Conclusao"],
      campos: camposChave().concat([
        { campo: "Nr Acao", rotulo: "Nr Acao", tipo: "numero", obrigatorio: true, min: 1 },
        { campo: "Acao Recomendada", rotulo: "Acao Recomendada", tipo: "texto", obrigatorio: true, sugestoesLista: Object.keys(ACOES_CATEGORIA_MAP) },
        { campo: "Categoria Acao", rotulo: "Categoria Acao", tipo: "select", obrigatorio: true, opcoes: CATEGORIAS_ACAO_POOL },
        { campo: "Gestao Acao", rotulo: "Gestao Acao", tipo: "select", obrigatorio: true, opcoes: GESTAO_ACAO_POOL },
        { campo: "Responsavel Acao", rotulo: "Responsavel Acao", tipo: "texto", obrigatorio: true, sugestoesDe: "Responsavel Acao" },
        { campo: "E-mail Responsavel", rotulo: "E-mail do Responsável", tipo: "texto", inputType: "email" },
        { campo: "Dt Programada", rotulo: "Dt Programada", tipo: "data", obrigatorio: true },
        { campo: "Dt Conclusao", rotulo: "Dt Conclusao", tipo: "data" },
        { campo: "Auditoria Ergonomista", rotulo: "Auditoria Ergonomista", tipo: "select", opcoes: SIM_NAO },
        { campo: "Dt Auditoria", rotulo: "Dt Auditoria", tipo: "data" },
        { campo: "Medida Controle ADM", rotulo: "Medida Controle ADM", tipo: "select", opcoes: SIM_NAO },
        { campo: "Risco Global", rotulo: "Risco Global (do posto)", tipo: "select", opcoes: window.BI.Calc ? window.BI.Calc.NIVEIS_RISCO : [] },
        { campo: "Fator Risco pos Acao", rotulo: "Fator Risco pos Acao", tipo: "select", opcoes: window.BI.Calc ? window.BI.Calc.NIVEIS_RISCO : [] },
        // V 1.2 - ligacao com o Inventario de Riscos, execucao e evidencias.
        { campo: "Fator Risco Nome", rotulo: "Fator de risco vinculado (Inventário)", tipo: "texto" },
        { campo: "Tipo Acao", rotulo: "Tipo da ação", tipo: "select", opcoes: () => (window.BI.Acoes ? window.BI.Acoes.tipos().map((t) => ({ valor: t.codigo, label: t.rotulo })) : []) },
        { campo: "Complexidade", rotulo: "Complexidade de execução", tipo: "select", opcoes: () => (window.BI.Acoes ? window.BI.Acoes.COMPLEXIDADES : []) },
        { campo: "Segmento Corporal", rotulo: "Segmento corporal atingido", tipo: "select", opcoes: () => (window.BI.Acoes ? window.BI.Acoes.segmentosDisponiveis() : []) },
        { campo: "Risco Atual Segmento", rotulo: "Risco atual do segmento", tipo: "select", opcoes: window.BI.Calc ? window.BI.Calc.NIVEIS_RISCO : [] },
        { campo: "Risco Apos Acao", rotulo: "Esta ação reduz o risco para", tipo: "select", opcoes: window.BI.Calc ? window.BI.Calc.NIVEIS_RISCO : [] },
        { campo: "Status Execucao", rotulo: "Situação da execução", tipo: "select", opcoes: STATUS_EXECUCAO_POOL },
        {
          campo: "Evidencias", rotulo: "Evidências da conclusão (foto ou PDF, até 15MB cada)", tipo: "arquivo", multiplo: true,
          colecaoArquivo: "planoAcao", aceitaTipos: "image/jpeg,image/png,application/pdf",
          tamanhoMaximoBytes: 15 * 1024 * 1024,
        },
        { campo: "Justificativa Sem Evidencia", rotulo: "Justificativa para concluir sem evidência (só Administrador)", tipo: "textarea" },
        { campo: "Prazo Evidencia", rotulo: "Data-limite para anexar a evidência", tipo: "data" },
      ]),
      aoConstruir: comCascata(ligarPlanoAcao),
      aoValidar: (form) => (form._validarEvidencia ? form._validarEvidencia() : null),
      // Excecao do Administrador so vale na hora em que ele conclui: nos demais
      // casos os dois campos seguem como estavam (sem apagar a dispensa).
      aoPrepararDados: (form, dados) => {
        const papel = (window.BI.DB.estado.identidade && window.BI.DB.estado.identidade.papel) || "";
        if (papel !== "Administrador") {
          const ini = estadoCadastro.planoAcao.valoresForm || {};
          dados["Justificativa Sem Evidencia"] = ini["Justificativa Sem Evidencia"] || null;
          dados["Prazo Evidencia"] = ini["Prazo Evidencia"] || null;
        }
      },
    },
    absenteismo: {
      grupo: "registro", icone: "🩺", tituloMenu: "Absenteísmo",
      titulo: "Absenteísmo",
      colunasTabela: ["Cliente", "Setor", "Posto Trabalho", "Cod CID", "Dt Afastamento", "Qtd Dias", "Regiao Corporal"],
      colunasData: ["Dt Afastamento"],
      camposData: ["Dt Afastamento"],
      campos: camposChave().concat([
        { campo: "Cod CID", rotulo: "Cod CID", tipo: "cid-hierarquico", obrigatorio: true },
        { campo: "Dt Afastamento", rotulo: "Dt Afastamento", tipo: "data", obrigatorio: true },
        { campo: "Qtd Dias", rotulo: "Qtd Dias", tipo: "numero", obrigatorio: true, min: 1 },
        { campo: "Regiao Corporal", rotulo: "Regiao Corporal", tipo: "select", obrigatorio: true, opcoes: () => regioesCorporais() },
        { campo: "Dt Retorno", rotulo: "Dt Retorno", tipo: "data" },
      ]),
      aoConstruir: comCascata(null),
    },
    // HHT/Dias Uteis - base de calculo da Taxa de Frequencia (NBR 14280,
    // ver js/calc.js/hhtDaLinha e calcularTaxaFrequencia) no dashboard Med
    // Ocup. Ate 28/09/2026 era uma tabela de referencia ESTATICA
    // (data/mock_data.json) com linhas so pras 3 empresas ficticias
    // originais - qualquer empresa nova cadastrada ficava com Taxa de
    // Frequencia zerada (sem HHT nenhum) ate alguem editar o JSON a mao e
    // commitar de novo. Pedido do Leo (28/09/2026): "isso nao pode ficar so
    // pra essas 3 empresas... toda vez que subir empresa nova eu tenho que
    // ficar commitando, ai nao faz sentido - precisa ficar pronto e
    // estavel pra qualquer nova empresa". Virou colecao normal por
    // EmpresaId (ver "diasUteis" em api/src/functions/entidades.js/
    // COLECOES) - um Administrador/Consultor so preenche esta tela pra
    // cada Cliente/Unidade/Setor novo, sem depender de nenhum deploy.
    // Nivel Setor/mes (nao por Posto/Cargo/Atividade) porque e assim que
    // taxaFrequenciaPorSetor consome ("Qtd Colaboradores" = media de
    // colaboradores do setor naquele mes; "Qtd Dias Uteis" = dias uteis
    // trabalhados no mes) - ver js/calc.js.
    diasUteis: {
      grupo: "registro", icone: "🕒", tituloMenu: "HHT / Dias Úteis",
      titulo: "HHT / Dias Úteis",
      colunasTabela: ["Cliente", "Unidade", "Setor", "Ano/Mes Uteis", "Qtd Colaboradores", "Qtd Dias Uteis"],
      colunasData: ["Ano/Mes Uteis"],
      camposData: ["Ano/Mes Uteis"],
      campos: [
        { campo: "Cliente", rotulo: "Cliente", tipo: "cascata", obrigatorio: true },
        { campo: "Unidade", rotulo: "Unidade", tipo: "cascata", obrigatorio: true },
        { campo: "Setor", rotulo: "Setor", tipo: "cascata", obrigatorio: true },
        { campo: "Ano/Mes Uteis", rotulo: "Ano/Mês", tipo: "mes", obrigatorio: true },
        { campo: "Qtd Colaboradores", rotulo: "Qtd Colaboradores (média do mês, no setor)", tipo: "numero", obrigatorio: true, min: 0 },
        { campo: "Qtd Dias Uteis", rotulo: "Qtd Dias Úteis no mês", tipo: "numero", obrigatorio: true, min: 0, max: 31 },
      ],
      aoConstruir: comCascata(null),
      // V 1.6: um unico lancamento por Cliente + Unidade + Setor + Mes (duas
      // linhas iguais somariam o HHT em dobro na Taxa de Frequencia) e
      // importacao por planilha Excel (modelo + previa + confirmacao).
      aoValidar: (form, dados) => erroDuplicidade("diasUteis", dados, "Já existe lançamento de HHT / Dias Úteis para este Cliente, Unidade, Setor e mês. Edite o registro existente."),
      importacao: {
        chaveNatural: ["Cliente", "Unidade", "Setor", "Ano/Mes Uteis"],
        arquivo: "hht-dias-uteis",
        nomePlanilha: "Dados",
        colunasPrevia: ["Cliente", "Unidade", "Setor", "Ano/Mes Uteis", "Qtd Colaboradores", "Qtd Dias Uteis"],
        exemplo: { "Ano/Mes Uteis": "10/2026", "Qtd Colaboradores": 120, "Qtd Dias Uteis": 21 },
        descricao: "Importe de uma só vez a quantidade de colaboradores e de dias úteis por Cliente, Unidade, Setor e mês. Lançamentos que já existem para o mesmo Setor e mês são atualizados, nunca duplicados.",
      },
    },
    compativeis: {
      grupo: "registro", icone: "🔄", tituloMenu: "Restritos (Compatíveis)",
      titulo: "Compatíveis",
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
        { campo: "Queixa Principal", rotulo: "Queixa Principal", tipo: "texto", sugestoesDe: "Queixa Principal" },
        { campo: "Segmento Corporal", rotulo: "Segmento Corporal", tipo: "select", opcoes: () => regioesCorporais() },
        { campo: "Restricao Medica", rotulo: "Restricao Medica", tipo: "texto", sugestoesDe: "Restricao Medica" },
        { campo: "Inicio Restricao", rotulo: "Inicio Restricao", tipo: "data", obrigatorio: true },
        { campo: "Fim Restricao", rotulo: "Fim Restricao", tipo: "data" },
        { campo: "Historico Restricao", rotulo: "Historico Restricao", tipo: "select", opcoes: SIM_NAO },
        { campo: "Doc Atividade Compativel", rotulo: "Doc Atividade Compativel", tipo: "select", opcoes: SIM_NAO },
        { campo: "Retorno Medico", rotulo: "Retorno Medico", tipo: "data" },
        { campo: "Atividade Compativel (recomendada)", rotulo: "Atividade Compativel (recomendada)", tipo: "texto", sugestoesDe: "Atividade Compativel (recomendada)" },
        { campo: "Atividade Compativel", rotulo: "Atividade Compativel", tipo: "select", opcoes: SIM_NAO },
      ]),
      aoConstruir: comCascata(null),
      // V 1.6: importacao por planilha Excel. Um mesmo colaborador (Cliente +
      // Matricula) pode ter varias restricoes ao longo do tempo; a chave de
      // atualizacao inclui o inicio da restricao.
      importacao: {
        chaveNatural: ["Cliente", "Matricula", "Inicio Restricao"],
        arquivo: "restritos-compativeis",
        nomePlanilha: "Dados",
        colunasPrevia: ["Cliente", "Setor", "Matricula", "Funcionario", "Status Restricao", "Inicio Restricao"],
        exemplo: { Matricula: "12345", Funcionario: "Nome do colaborador", "Inicio Restricao": "01/10/2026" },
        descricao: "Importe várias restrições médicas de uma só vez. Restrições que já existem (mesmo Cliente, Matrícula e início da restrição) são atualizadas, nunca duplicadas.",
      },
    },
    // As 3 telas abaixo sao o pacote "Sistema de Gestao Integrada" (ver
    // docs/bi-ergonomia-manual.md) - reproduzem, dentro do proprio BI
    // Ergonomia, os cadastros de Avaliacao Ergonomica, Inventario de Riscos
    // e Laudos do sistema legado da ElevaLife.
    //
    // Avaliacao Ergonomica + Inventario de Riscos SAO o modulo AEP (Analise
    // Ergonomica Preliminar), feito nativamente aqui dentro do sistema -
    // combinado com o Leo em 28/09: risco por posto se divide em 2 trilhas
    // paralelas, AEP (aqui, nativo) e AET (ver "aet" abaixo, upload externo
    // de Excel/PDF). Rotulo "(AEP)" no tituloMenu/titulo so pra deixar isso
    // visivel no menu, ja que antes so "AET" aparecia com sigla propria.
    avaliacaoErgonomica: {
      grupo: "registro", icone: "📋", tituloMenu: "Avaliação Ergonômica (AEP)",
      titulo: "Cadastro de Avaliação Ergonômica (AEP)",
      colunasTabela: ["Cliente", "Setor", "Posto Trabalho", "Cargo", "Atividade", "Data Avaliacao"],
      colunasData: ["Data Avaliacao"], camposData: ["Data Avaliacao"],
      campos: camposAvaliacaoErgonomica(),
      aoConstruir: comCascata(null),
      // Pedido do Leo (28/09/2026): "achei muito longa a tela, tem que
      // ficar rolando a tela... faz varias abas" - as 3 secoes do form (ver
      // camposAvaliacaoErgonomica) viram abas clicaveis em vez de ficarem
      // empilhadas (ver montarFormulario/emAbas). Nao e um redesign do
      // sistema legado - e a propria estrutura/logica do BI Ergonomia
      // (secoes ja existentes), so apresentada em abas.
      emAbas: true,
      // Pedido do Leo: depois de criada a Avaliacao, registrar o Inventario
      // de Riscos dela nao deve parecer "criar um novo registro" formulario
      // a formulario - abre uma tela de checklist com caixas de selecao (ver
      // abrirInventarioChecklist), 1 por fator da ISO TS-20646, agrupados
      // por Grupo. Substitui, pra este fluxo, o antigo caminho de abrir
      // "Novo Registro" em Inventario de Riscos e escolher Grupo/Fator um a
      // um - o cadastro antigo continua existindo (util pra buscar/editar/
      // excluir um fator especifico depois).
      temInventarioChecklist: true,
    },
    fatorRisco: {
      grupo: "registro", icone: "🧩", tituloMenu: "Inventário de Riscos (AEP)",
      titulo: "Inventário de Riscos (AEP)",
      colunasTabela: ["Cliente", "Setor", "Posto Trabalho", "Cargo", "Fator", "Graduacao Risco", "Dt Identificacao", "Status"],
      colunasData: ["Dt Identificacao", "Valido Ate"], camposData: ["Dt Identificacao"],
      campos: camposFatorRisco(),
      aoConstruir: comCascata(ligarCascataFatorRisco),
      // V 1.2 - ganchos do editor de acoes (ver renderizarFormCadastro).
      aoValidar: (form) => (form._editorAcoes ? form._editorAcoes.validar() : null),
      gerarIdNovo: true,
      aoPrepararDados: (form, dados) => {
        if (form._editorAcoes && form._editorAcoes.total() > 0) dados["Propor Acao"] = "Sim";
      },
      aoSalvarDepois: async (form, idFator) => {
        if (form._editorAcoes && form._editorAcoes.temAlteracoes()) await form._editorAcoes.salvar(idFator);
      },
    },
    laudo: {
      grupo: "registro", icone: "📄", tituloMenu: "Laudos",
      titulo: "Laudos e Certificados",
      colunasTabela: ["Cliente", "Tipo", "Emitido Em", "Emitido Por", "Codigo Verificacao"],
      colunasData: ["Emitido Em"], camposData: ["Emitido Em"],
      campos: camposLaudo(),
      // Alem da cascata Cliente/Setor/Posto (comCascata), injeta o botao
      // "Gerar Laudo (PDF)" - ver ligarGeracaoLaudo.
      aoConstruir: comCascata(ligarGeracaoLaudo),
      // Pedido do Leo (28/09/2026): "laudo nao e novo registro, ja esta
      // registrado - so tem que dar a opcao das analises lancadas e
      // imprimir ou baixar". Ate aqui, um Laudo ja gerado so tinha o PDF
      // acessivel reabrindo o form inteiro em "Editar" - agora a tabela
      // (ver renderizarListaCadastro) ganha um botao "Baixar/Imprimir"
      // direto na linha quando ja existe um arquivo anexado.
      campoArquivoPrincipal: "Arquivo Url",
    },
    // AET (Analise Ergonomica do Trabalho) - hoje feita fora do sistema
    // (Excel/PDF) e so anexada aqui; o cadastro le e classifica o conteudo
    // de cada arquivo automaticamente (ver camposAET/extrairTextoParaClassificacaoAET
    // acima e docs/bi-ergonomia-manual.md, secao AET).
    aet: {
      grupo: "registro", icone: "📊", tituloMenu: "AET",
      titulo: "Análise Ergonômica do Trabalho (AET)",
      colunasTabela: ["Cliente", "Setor", "Posto Trabalho", "Cargo", "Data Analise"],
      colunasData: ["Data Analise"], camposData: ["Data Analise"],
      campos: camposAET(),
      aoConstruir: comCascata(null),
    },
    // Certificado de Calibracao e Editor de Texto do Laudo (telas "Emissor" /
    // sub-telas do Laudo do sistema legado) - bibliotecas GLOBAIS (nao
    // presas a uma empresa-cliente, ver COLECOES_GLOBAIS no backend e
    // camposCertificadoCalibracao/camposModeloLaudo acima). Por isso, sem
    // "aoConstruir": nao ha cascata Cliente/Unidade/... nenhuma aqui.
    certificadoCalibracao: {
      grupo: "mestre", icone: "📐", tituloMenu: "Certificado Calibração",
      titulo: "Certificados de Calibração",
      colunasTabela: ["Nome", "Validade"],
      colunasData: ["Validade"], camposData: ["Validade"],
      campos: camposCertificadoCalibracao(),
    },
    modeloLaudo: {
      grupo: "mestre", icone: "📝", tituloMenu: "Editor de Texto",
      titulo: "Editor de Texto do Laudo",
      colunasTabela: ["Nome"],
      colunasData: [], camposData: [],
      campos: camposModeloLaudo(),
      aoConstruir: ligarTextoPadraoModelo,
    },
    // V 1.3: ergonomistas (global) - assinatura e registro usados no laudo.
    ergonomista: {
      grupo: "mestre", icone: "🧑‍⚕️", tituloMenu: "Ergonomistas",
      titulo: "Ergonomistas (responsável técnico do laudo)",
      colunasTabela: ["Nome", "Registro", "Titulo"],
      colunasData: [], camposData: [],
      campos: camposErgonomista(),
    },
  };

  const estadoCadastro = {};

  // Resolve o EmpresaId do Cliente ja escolhido no proprio formulario (campo
  // "Cliente", select em cascata - ver ligarCascataHierarquia) - usado pelo
  // campo de upload de arquivo pra saber em qual empresa gravar, do mesmo
  // jeito que db.js/anexarEmpresaId() resolve na hora de salvar o registro.
  function resolverEmpresaIdDoForm(form) {
    const elCliente = form._campos["Cliente"];
    // Cadastros GLOBAIS (Certificado de Calibracao, Modelo de Laudo - ver
    // js/db.js/COLECOES e docs/bi-ergonomia-manual.md, secao Laudos) nao tem
    // campo "Cliente" nenhum: sao uma biblioteca unica compartilhada por
    // todas as empresas-cliente, entao sempre gravam com o EmpresaId fixo
    // "GLOBAL" (mesmo sentinel do backend, ver api/src/functions/entidades.js
    // EMPRESA_GLOBAL).
    if (!elCliente) return "GLOBAL";
    const nomeCliente = elCliente.value;
    if (!nomeCliente) return null;
    const doc = (window.BI.DB.estado.colecoes.cliente || []).find((c) => c.Cliente === nomeCliente);
    if (doc) return doc.id || doc._id;
    // Cadastro de Cliente propriamente dito (campo "Cliente" e texto livre,
    // nao uma cascata pra um registro ja existente - ver
    // camposCadastroCliente/Logotipo): o id e sempre derivado do proprio
    // nome (idCliente/idCadastroMestre em js/db.js - o MESMO calculo usado
    // ao salvar o registro), entao da pra resolver o EmpresaId de destino do
    // upload mesmo antes de o Cliente novo ter sido salvo pela 1a vez.
    return window.BI.DB.idCliente({ Cliente: nomeCliente });
  }

  // Campo de upload de arquivo (Fotos da Avaliacao Ergonomica, Arquivo do
  // Laudo - ver docs/bi-ergonomia-manual.md e js/db.js/enviarArquivo). So
  // funciona de verdade na versao publicada em producao (BI.DB.estado.
  // modoApi) - e onde existe um Blob Storage de verdade pra guardar o
  // arquivo; nas demais visualizacoes (Cowork, preview local, somente
  // leitura) mostra so um aviso, sem tentar enviar nada.
  function construirCampoArquivo(def, campoFake, form) {
    const wrap = document.createElement("div");
    wrap.className = "campo-arquivo";

    const listaEl = document.createElement("div");
    listaEl.className = "campo-arquivo-lista";
    wrap.appendChild(listaEl);

    const avisoEl = document.createElement("div");
    avisoEl.className = "campo-arquivo-aviso";
    avisoEl.hidden = true;
    wrap.appendChild(avisoEl);

    function mostrarAviso(msg) {
      avisoEl.textContent = msg || "";
      avisoEl.hidden = !msg;
    }

    // Normaliza pra sempre trabalhar com uma lista, mesmo no campo unico
    // (Laudo) - onde so o 1o (e unico) item importa.
    function itensAtuais() {
      if (def.multiplo) return Array.isArray(campoFake.value) ? campoFake.value : [];
      return campoFake.value ? [campoFake.value] : [];
    }

    function renderizarLista() {
      listaEl.innerHTML = "";
      itensAtuais().forEach((item, idx) => {
        const chip = document.createElement("div");
        chip.className = "campo-arquivo-chip";

        const ehImagem = /^image\//.test(item.tipoConteudo || "") || /\.(jpe?g|png)$/i.test(item.nomeArquivo || "");
        if (ehImagem) {
          const img = document.createElement("img");
          img.src = window.BI.DB.urlArquivo(item.chave);
          img.alt = item.nomeArquivo || "";
          chip.appendChild(img);
        } else {
          const link = document.createElement("a");
          link.href = window.BI.DB.urlArquivo(item.chave);
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = "📎 " + (item.nomeArquivo || "arquivo");
          chip.appendChild(link);
        }

        // Classificacao por CONTEUDO (so nos campos que declaram
        // extrairTextoParaClassificacao - hoje, so a AET; ver
        // js/calc.js/classificarTextoAET e docs/bi-ergonomia-manual.md,
        // secao AET). Mostra o rotulo detectado automaticamente ao ler o
        // arquivo e deixa o usuario confirmar ou corrigir - nunca assume o
        // tipo por extensao, e a escolha final de quem confirma e o que
        // fica gravado (item.classificacaoConfirmada).
        if (def.extrairTextoParaClassificacao && item.classificacao !== undefined) {
          const selClassificacao = document.createElement("select");
          selClassificacao.className = "campo-arquivo-classificacao";
          selClassificacao.title = "Classificação do conteúdo deste arquivo (detectada automaticamente pela leitura do Excel/PDF - confira e corrija se necessário)";
          (window.BI.Calc.NOMES_CLASSIFICACAO_AET || []).forEach((rotulo) => {
            const opt = document.createElement("option");
            opt.value = rotulo;
            opt.textContent = T(rotulo);
            selClassificacao.appendChild(opt);
          });
          selClassificacao.value = item.classificacaoConfirmada || item.classificacao || "Não identificado";
          selClassificacao.addEventListener("change", () => {
            item.classificacaoConfirmada = selClassificacao.value;
          });
          chip.appendChild(selClassificacao);
        }

        const btnRemover = document.createElement("button");
        btnRemover.type = "button";
        btnRemover.className = "campo-arquivo-remover";
        btnRemover.textContent = "×";
        btnRemover.title = "Remover";
        // So tira a referencia do registro - o arquivo em si fica no Blob
        // Storage (orfao). Suficiente pro volume desta fase; uma limpeza
        // periodica de orfaos fica pro backlog (ver docs/bi-ergonomia-manual.md).
        btnRemover.addEventListener("click", () => {
          if (def.multiplo) {
            const atual = itensAtuais().slice();
            atual.splice(idx, 1);
            campoFake.value = atual;
          } else {
            campoFake.value = null;
          }
          renderizarLista();
        });
        chip.appendChild(btnRemover);

        listaEl.appendChild(chip);
      });
    }
    renderizarLista();

    // Envia uma lista de arquivos (validar tamanho -> classificar por
    // conteudo se aplicavel -> gravar no Blob -> anexar ao campo -> atualizar
    // a lista visivel). Extraido do listener do <input type="file"> abaixo
    // pra poder ser chamado tambem programaticamente - ex.: o botao "Gerar
    // Laudo (PDF)" (ver ligarGeracaoLaudo) usa o mesmo caminho de upload pra
    // anexar o PDF gerado no campo "Arquivo Url", sem duplicar essa logica.
    // empresaIdForcado permite chamar isso fora do fluxo normal do form (ex.:
    // geracao de laudo, que ja sabe o EmpresaId sem depender do campo
    // "Cliente" estar preenchido nesse form especifico).
    async function anexarArquivos(arquivos, empresaIdForcado) {
      arquivos = Array.from(arquivos || []);
      if (!arquivos.length) return;

      const empresaId = empresaIdForcado || resolverEmpresaIdDoForm(form);
      if (!empresaId) {
        mostrarAviso("Selecione o Cliente antes de anexar arquivo.");
        throw new Error("Selecione o Cliente antes de anexar arquivo.");
      }
      if (!def.multiplo && arquivos.length > 1) {
        mostrarAviso("So e permitido 1 arquivo aqui.");
        throw new Error("So e permitido 1 arquivo aqui.");
      }

      mostrarAviso("Enviando...");
      try {
        for (const arquivo of arquivos) {
          if (def.tamanhoMaximoBytes && arquivo.size > def.tamanhoMaximoBytes) {
            throw new Error(`"${arquivo.name}" e maior que o limite de ${(def.tamanhoMaximoBytes / (1024 * 1024)).toFixed(0)} MB.`);
          }
          // Classificacao por CONTEUDO (nunca por extensao/tipo - ver
          // js/calc.js/classificarTextoAET e docs/bi-ergonomia-manual.md,
          // secao AET). So o campo que declara "extrairTextoParaClassificacao"
          // passa por aqui (hoje: o upload da AET) - os demais cadastros
          // (Fotos da Avaliacao, Arquivo do Laudo) nao usam isso e seguem
          // exatamente como antes. Falha ao extrair/classificar nao impede o
          // upload em si - so fica sem pre-classificacao automatica (usuario
          // classifica manualmente no select que aparece no chip do arquivo).
          let classificacaoDetectada;
          if (def.extrairTextoParaClassificacao) {
            try {
              const texto = await def.extrairTextoParaClassificacao(arquivo);
              classificacaoDetectada = window.BI.Calc.classificarTextoAET(texto);
            } catch (erroClassificacao) {
              classificacaoDetectada = "Não identificado";
            }
            if (campoFake.aoClassificar) campoFake.aoClassificar(classificacaoDetectada);
          }
          const resultado = await window.BI.DB.enviarArquivo(def.colecaoArquivo, empresaId, arquivo);
          const item = {
            chave: resultado.chave,
            nomeArquivo: resultado.nomeArquivo,
            tamanho: resultado.tamanho,
            tipoConteudo: arquivo.type,
          };
          if (def.extrairTextoParaClassificacao) {
            item.classificacao = classificacaoDetectada;
            item.classificacaoConfirmada = classificacaoDetectada;
          }
          campoFake.value = def.multiplo ? itensAtuais().concat([item]) : item;
        }
        mostrarAviso(null);
      } finally {
        renderizarLista();
      }
    }
    // Ponto de entrada programatico (ver comentario acima) - usado pelo
    // gerador de Laudo pra anexar o PDF/imagem gerado sem passar pelo
    // <input type="file"> manual.
    campoFake.anexarArquivos = anexarArquivos;

    if (!window.BI.DB.estado.modoApi) {
      mostrarAviso("Upload de arquivo disponível só na versão publicada (produção).");
      return wrap;
    }

    const input = document.createElement("input");
    input.type = "file";
    if (def.aceitaTipos) input.accept = def.aceitaTipos;
    if (def.multiplo) input.multiple = true;

    input.addEventListener("change", async () => {
      const arquivos = Array.from(input.files || []);
      input.value = "";
      if (!arquivos.length) return;

      input.disabled = true;
      try {
        await anexarArquivos(arquivos);
      } catch (erro) {
        mostrarAviso(erro.message || "Falha ao enviar arquivo.");
      } finally {
        input.disabled = false;
        renderizarLista();
      }
    });

    wrap.appendChild(input);
    return wrap;
  }

  function montarFormulario(cfg, chave, valoresIniciais) {
    const form = document.createElement("form");
    form.className = "form-cadastro";
    // A validacao "required" nativa do navegador bloqueia o submit
    // silenciosamente quando o campo invalido esta escondido (display:none) -
    // e o caso de um campo obrigatorio numa aba que nao e a ativa (ver
    // cfg.emAbas): o navegador nao consegue rolar/focar um campo escondido
    // pra avisar o usuario, entao o clique em "Salvar" simplesmente nao faz
    // nada, sem nenhuma mensagem. lerValoresFormulario ja faz a mesma
    // checagem (obrigatorio + vazio) e mostra a mensagem certa, alem de
    // pular pra aba certa - entao desliga a validacao nativa e usa so a
    // nossa, que funciona igual em formularios com ou sem abas.
    form.noValidate = true;
    form._campos = {};

    const titulo = document.createElement("div");
    titulo.className = "form-titulo";
    titulo.textContent = valoresIniciais && valoresIniciais._id ? "Editar registro" : "Novo registro";
    form.appendChild(titulo);

    // Corpo do formulario: por padrao uma unica grade de campos (comportamento
    // historico, inalterado). Quando ALGUM campo declara "secao" (string com
    // icone+titulo, ex.: "Descricao do Risco"), o corpo vira uma serie de
    // blocos - um titulo de secao + sua propria grade - toda vez que o texto
    // da secao muda de um campo pro proximo (pedido do Leo: telas do pacote
    // "Sistema de Gestao Integrada" mais organizadas/modernas). Cadastros que
    // nao usam "secao" continuam com a grade unica de sempre.
    const corpo = document.createElement("div");
    corpo.className = "form-cadastro-corpo";
    const usandoSecoes = cfg.campos.some((d) => d.secao);
    // Modo "abas" (pedido do Leo, 28/09/2026: a tela de Avaliacao Ergonomica
    // "ficava rolando", queria varias abas em vez de 1 grade longa) - so
    // ativado por cfg.emAbas (hoje so avaliacaoErgonomica). Em vez de
    // empilhar titulo+grade de cada secao um embaixo do outro, cada secao
    // vira uma aba clicavel (form-cadastro-abas-nav) e so a grade da aba
    // ativa fica visivel por vez - reaproveita a MESMA leitura/gravacao de
    // campos de sempre (lerValoresFormulario nao muda nada), so a
    // apresentacao visual e diferente.
    const emAbas = !!cfg.emAbas && usandoSecoes;
    let abasNav = null;
    const secoesAbas = []; // [{ titulo, grade }] na ordem de aparicao
    function trocarAba(indice) {
      secoesAbas.forEach((s, i) => {
        s.grade.hidden = i !== indice;
        s.botao.classList.toggle("ativa", i === indice);
      });
    }
    form._trocarAba = trocarAba; // exposto pra "Preencha o campo X" poder pular pra aba certa (ver renderizarFormCadastro)
    form._secoesAbas = secoesAbas;
    form._abaDoCampo = {}; // { "Jornada de Trabalho": 1, ... } - preenchido abaixo, usado pelo mesmo motivo
    let abaIndiceAtual = -1;
    let grade = null;
    let secaoAtual;
    function novaGrade() {
      const g = document.createElement("div");
      g.className = "form-cadastro-grade";
      corpo.appendChild(g);
      return g;
    }
    if (!usandoSecoes) grade = novaGrade();
    if (emAbas) {
      abasNav = document.createElement("div");
      abasNav.className = "form-cadastro-abas-nav";
      corpo.appendChild(abasNav);
    }

    cfg.campos.forEach((def) => {
      if (usandoSecoes && def.secao !== secaoAtual) {
        secaoAtual = def.secao;
        if (secaoAtual && !emAbas) {
          const tituloSecao = document.createElement("div");
          tituloSecao.className = "form-cadastro-secao-titulo";
          tituloSecao.textContent = secaoAtual;
          corpo.appendChild(tituloSecao);
        }
        grade = novaGrade();
        if (emAbas && secaoAtual) {
          const indice = secoesAbas.length;
          abaIndiceAtual = indice;
          const botaoAba = document.createElement("button");
          botaoAba.type = "button";
          botaoAba.className = "form-cadastro-aba-botao";
          botaoAba.textContent = secaoAtual;
          botaoAba.addEventListener("click", () => trocarAba(indice));
          abasNav.appendChild(botaoAba);
          secoesAbas.push({ titulo: secaoAtual, grade, botao: botaoAba });
        }
      }
      if (emAbas) form._abaDoCampo[def.campo] = abaIndiceAtual;

      const campoDiv = document.createElement("div");
      campoDiv.className = "campo-form";
      const label = document.createElement("label");
      label.textContent = T(def.rotulo || def.campo);
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
          if (op && typeof op === "object") { opt.value = op.valor; opt.textContent = T(op.label); }
          else { opt.value = op; opt.textContent = T(window.BI.Calc.rotuloNivel(op)); }
          el.appendChild(opt);
        });
        // Valor antigo que nao esta mais na lista (ex.: campo que era texto
        // livre e virou lista): mantem como opcao pra nao perder o dado.
        if (valorInicial && opcoes.length && !Array.from(el.options).some((o) => o.value === String(valorInicial))) {
          const optAntigo = document.createElement("option");
          optAntigo.value = valorInicial; optAntigo.textContent = String(valorInicial);
          el.appendChild(optAntigo);
        }
        el.value = valorInicial != null ? valorInicial : "";
      } else if (def.tipo === "multiselect") {
        // Select multiplo nativo (ex.: "Empresas Vinculadas" no cadastro de
        // Usuarios - ver camposUsuario) - mais simples que o multi-select
        // com checkboxes usado nos filtros (criarMultiSelect), suficiente
        // pra um campo de formulario. form._campos[def.campo] guarda o
        // <select multiple> em si; lerValoresFormulario le
        // Array.from(el.selectedOptions).
        el = document.createElement("select");
        el.multiple = true;
        el.size = Math.min(6, Math.max(3, (typeof def.opcoes === "function" ? def.opcoes() : (def.opcoes || [])).length));
        const opcoesMulti = typeof def.opcoes === "function" ? def.opcoes() : (def.opcoes || []);
        const selecionados = Array.isArray(valorInicial) ? valorInicial : [];
        opcoesMulti.forEach((op) => {
          const opt = document.createElement("option");
          if (op && typeof op === "object") { opt.value = op.valor; opt.textContent = T(op.label); }
          else { opt.value = op; opt.textContent = T(op); }
          opt.selected = selecionados.includes(opt.value);
          el.appendChild(opt);
        });
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
      } else if (def.tipo === "cid-hierarquico") {
        // 3 selects em cascata (Capitulo > Grupo > Categoria) que, juntos,
        // escolhem UM codigo CID de 4 caracteres - so a 3a select (Categoria)
        // e "oficial" pro formulario (form._campos[def.campo]), as outras 2
        // sao so navegacao visual. Autocontido: ao contrario do "cascata" de
        // Cliente/Unidade/Setor, nao depende de outros campos do form nem de
        // aoConstruir, entao ja monta e popula tudo aqui mesmo.
        const wrap = document.createElement("div");
        wrap.className = "campo-cid-cascata";
        const selCapitulo = document.createElement("select");
        const selGrupo = document.createElement("select");
        const selCategoria = document.createElement("select");
        selCategoria.dataset.campo = def.campo;

        const arvore = hierarquiaCID();
        function popularCapitulos() {
          selCapitulo.innerHTML = "";
          const optBranco2 = document.createElement("option");
          optBranco2.value = ""; optBranco2.textContent = "Capitulo...";
          selCapitulo.appendChild(optBranco2);
          ORDEM_CAPITULOS_CID.forEach((cap) => {
            if (!arvore[cap]) return;
            const opt = document.createElement("option");
            opt.value = cap; opt.textContent = CAPITULOS_CID[cap];
            selCapitulo.appendChild(opt);
          });
        }
        function popularGrupos(cap, grupoDesejado) {
          selGrupo.innerHTML = "";
          const optBranco2 = document.createElement("option");
          optBranco2.value = ""; optBranco2.textContent = "Grupo...";
          selGrupo.appendChild(optBranco2);
          selGrupo.disabled = !cap;
          if (!cap) return;
          Object.keys(arvore[cap]).sort().forEach((grupo) => {
            const opt = document.createElement("option");
            opt.value = grupo; opt.textContent = grupo;
            selGrupo.appendChild(opt);
          });
          if (grupoDesejado) selGrupo.value = grupoDesejado;
        }
        function popularCategorias(cap, grupo, codigoDesejado) {
          selCategoria.innerHTML = "";
          const optBranco2 = document.createElement("option");
          optBranco2.value = ""; optBranco2.textContent = "Código CID...";
          selCategoria.appendChild(optBranco2);
          selCategoria.disabled = !cap || !grupo;
          if (!cap || !grupo || !arvore[cap][grupo]) return;
          arvore[cap][grupo].forEach((c) => {
            const opt = document.createElement("option");
            opt.value = c.codigo; opt.textContent = `${c.codigo} - ${c.cid}`;
            selCategoria.appendChild(opt);
          });
          if (codigoDesejado) selCategoria.value = codigoDesejado;
        }

        popularCapitulos();
        popularGrupos(null);
        popularCategorias(null, null);

        // Pre-seleciona os 3 niveis se ja existe um codigo salvo (edicao).
        const localizacao = localizarCID(valorInicial);
        if (localizacao) {
          selCapitulo.value = localizacao.capitulo;
          popularGrupos(localizacao.capitulo, localizacao.grupo);
          popularCategorias(localizacao.capitulo, localizacao.grupo, valorInicial);
        } else if (valorInicial) {
          // Codigo legado fora de M/S/F/G (ex.: um antigo codigo de outro
          // capitulo que tenha ficado gravado num registro) - mantem
          // visivel num "Outro" pra nao sumir/quebrar ao abrir um registro
          // antigo pra editar, mesmo sem aparecer na arvore nova.
          const optOutroCap = document.createElement("option");
          optOutroCap.value = "_legado"; optOutroCap.textContent = "Outro (código legado)";
          selCapitulo.appendChild(optOutroCap);
          selCapitulo.value = "_legado";
          selGrupo.innerHTML = "";
          selGrupo.disabled = true;
          const optOutroCod = document.createElement("option");
          optOutroCod.value = valorInicial; optOutroCod.textContent = valorInicial;
          selCategoria.innerHTML = "";
          selCategoria.appendChild(optOutroCod);
          selCategoria.value = valorInicial;
        }

        selCapitulo.addEventListener("change", () => {
          popularGrupos(selCapitulo.value || null);
          popularCategorias(null, null);
        });
        selGrupo.addEventListener("change", () => {
          popularCategorias(selCapitulo.value || null, selGrupo.value || null);
        });

        wrap.appendChild(selCapitulo);
        wrap.appendChild(selGrupo);
        wrap.appendChild(selCategoria);
        el = wrap;
        form._campos[def.campo] = selCategoria;
        if (def.obrigatorio) selCategoria.required = true;
        campoDiv.appendChild(el);
        grade.appendChild(campoDiv);
        return; // ja registrou form._campos, anexou o campo e o campoDiv na grade - pula o trecho comum abaixo
      } else if (def.tipo === "personalizado") {
        // V 1.2: bloco montado por quem declara o campo (def.construir) - ex.:
        // o editor de acoes do Inventario. Nao entra nos dados do registro
        // (ver lerValoresFormulario); quem usa cuida de ler/gravar por conta
        // propria via os ganchos aoValidar/aoSalvarDepois da tela.
        campoDiv.className += " campo-form-largo";
        const fake = { value: null, personalizado: true };
        form._campos[def.campo] = fake;
        campoDiv.appendChild(def.construir(form, valoresIniciais || {}, fake));
        grade.appendChild(campoDiv);
        return;
      } else if (def.tipo === "arquivo") {
        // Upload de arquivo (Fotos da Avaliacao Ergonomica, Arquivo do
        // Laudo - ver construirCampoArquivo acima). Guarda o(s) "chave(s)"
        // do Blob Storage num objeto "fake" (nao e um elemento do DOM) so
        // pra reaproveitar o mesmo mecanismo generico de leitura de
        // lerValoresFormulario(), que le "el.value" de cada campo.
        const campoFake = {
          value: def.multiplo ? (Array.isArray(valorInicial) ? valorInicial.slice() : []) : valorInicial || null,
        };
        form._campos[def.campo] = campoFake;
        campoDiv.appendChild(construirCampoArquivo(def, campoFake, form));
        grade.appendChild(campoDiv);
        return; // ja registrou form._campos, anexou o campo e o campoDiv na grade - pula o trecho comum abaixo
      } else if (def.tipo === "textarea") {
        // Texto longo (Jornada de Trabalho, Circunstancia Geradora etc. -
        // campos do pacote "Sistema de Gestao Integrada", ver
        // docs/bi-ergonomia-manual.md) - mesmo campoDiv.className "largo"
        // usado pra ocupar a grade inteira, texto puro (sem editor rico).
        el = document.createElement("textarea");
        el.rows = 3;
        el.value = valorInicial != null ? valorInicial : "";
        campoDiv.className += " campo-form-largo";
      } else if (def.tipo === "data" || def.tipo === "mes") {
        // V 1.1: texto com mascara DD/MM/AAAA (MM/AAAA no mes) + calendario
        // (js/datas.js). O .value continua no formato interno AAAA-MM-DD /
        // AAAA-MM, entao o resto do sistema nao muda. `padraoHoje` preenche
        // com a data de hoje so em registro novo.
        const novo = !(valoresIniciais && valoresIniciais._id);
        let inicial = valorInicial || "";
        if (!inicial && novo && def.padraoHoje) inicial = def.tipo === "mes" ? BI.Datas.hojeISO().slice(0, 7) : BI.Datas.hojeISO();
        el = BI.Datas.criarCampo(def.tipo, inicial);
      } else if (def.tipo === "numero") {
        el = document.createElement("input");
        el.type = "number";
        if (def.min != null) el.min = def.min;
        if (def.max != null) el.max = def.max;
        el.value = valorInicial != null ? valorInicial : "";
      } else {
        el = document.createElement("input");
        el.type = def.inputType || "text";
        el.value = valorInicial != null ? valorInicial : "";
        if (def.mascara && MASCARAS[def.mascara]) {
          const mascarar = () => { const m = MASCARAS[def.mascara](el.value); if (m !== el.value) el.value = m; };
          el.inputMode = "numeric";
          el.addEventListener("input", mascarar);
          mascarar();
        }
        const listaSugestoes = def.sugestoesFn ? def.sugestoesFn() : (def.sugestoesDe ? sugestoes(def.sugestoesDe) : def.sugestoesLista);
        // `sugestoesDinamicas: true` forca a criacao do <datalist> mesmo
        // sem itens ainda (ex.: Cargo/Atividade no cadastro-mestre, cuja
        // lista so e conhecida depois de escolher os ancestrais) - quem
        // populares os <option> depois e o aoConstruir da tela (ver
        // ligarSugestoesNivelProprio).
        if ((listaSugestoes && listaSugestoes.length) || def.sugestoesDinamicas) {
          const listId = "dl-" + slug(chave + "-" + def.campo);
          el.setAttribute("list", listId);
          let dl = document.getElementById(listId);
          if (!dl) {
            dl = document.createElement("datalist");
            dl.id = listId;
            document.body.appendChild(dl);
          }
          dl.innerHTML = "";
          (listaSugestoes || []).forEach((v) => {
            const opt = document.createElement("option");
            opt.value = v;
            dl.appendChild(opt);
          });
        }
      }
      el.dataset.campo = def.campo;
      if (def.obrigatorio && def.tipo !== "calculado") el.required = true;
      campoDiv.appendChild(el.elementoDOM || el);
      form._campos[def.campo] = el;
      grade.appendChild(campoDiv);
    });

    if (emAbas && secoesAbas.length) trocarAba(0);

    form.appendChild(corpo);

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
    let campoComErro = null;
    cfg.campos.forEach((def) => {
      if (def.tipo === "personalizado") return;
      const el = form._campos[def.campo];
      let valor;
      if (def.tipo === "calculado") {
        valor = el.dataset.valorReal || null;
      } else if (def.tipo === "numero") {
        valor = el.value === "" ? null : Number(el.value);
      } else if (def.tipo === "multiselect") {
        valor = Array.from(el.selectedOptions || []).map((o) => o.value);
      } else {
        valor = el.value === "" ? null : el.value;
      }
      const vazio = def.tipo === "multiselect" ? valor.length === 0 : (valor === null || valor === "");
      if ((def.tipo === "data" || def.tipo === "mes") && el.validationMessage && !erro) {
        erro = `${T(def.rotulo || def.campo)}: ${el.validationMessage}`;
        campoComErro = def.campo;
      }
      if (def.obrigatorio && vazio && !erro) {
        erro = `Preencha o campo “${T(def.rotulo || def.campo)}”.`;
        campoComErro = def.campo;
      }
      dados[def.campo] = valor;
    });
    return { dados, erro, campoComErro };
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
        rotulo.textContent = T(cfg.tituloMenu || cfg.titulo);
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
      rotulo.textContent = T(cfg.tituloMenu || cfg.titulo);
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
      // "selecionados": Set de _id marcados via checkbox (ver renderizarListaCadastro/
      // excluirSelecionados) - pedido do Leo 02/10/2026: "estou levando muito
      // tempo para excluir informacoes do sistema" - exclusao em bloco.
      estadoCadastro[chave] = estadoCadastro[chave] || { formAberto: false, editandoId: null, busca: "", pagina: 1, valoresForm: null, ordenarCampo: null, ordenarAsc: true, selecionados: new Set() };
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
      if (cfg.importacao) {
        const btnImportar = document.createElement("button");
        btnImportar.type = "button"; btnImportar.className = "btn-cad-secundario btn-importar-excel"; btnImportar.id = "btn-importar-" + chave;
        btnImportar.textContent = "⬆ Importar Excel";
        btnImportar.addEventListener("click", () => abrirImportacao(chave));
        cab.appendChild(btnImportar);
      }
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
        // Uma busca nova muda o conjunto filtrado - limpa a selecao pra nao
        // deixar marcado (e sujeito a exclusao) algo que nem aparece mais.
        estadoCadastro[chave].selecionados.clear();
        renderizarListaCadastro(chave);
      });
      controles.appendChild(busca);

      // Barra de selecao em bloco (pedido do Leo 02/10/2026 - ver comentario
      // acima em estadoCadastro). Escondida (via CSS .barra-selecao:empty ou
      // disabled) quando nada esta selecionado - atualizarBarraSelecao()
      // decide o que mostrar a cada render.
      const barraSelecao = document.createElement("div");
      barraSelecao.className = "barra-selecao";
      barraSelecao.id = "barra-selecao-" + chave;
      barraSelecao.hidden = true;
      const contagemSelecao = document.createElement("span");
      contagemSelecao.className = "barra-selecao-contagem";
      contagemSelecao.id = "barra-selecao-contagem-" + chave;
      const btnSelecionarFiltrados = document.createElement("button");
      btnSelecionarFiltrados.type = "button";
      btnSelecionarFiltrados.className = "btn-cad-secundario";
      btnSelecionarFiltrados.id = "btn-selecionar-filtrados-" + chave;
      btnSelecionarFiltrados.hidden = true;
      btnSelecionarFiltrados.addEventListener("click", () => selecionarTodosFiltrados(chave));
      const btnLimparSelecao = document.createElement("button");
      btnLimparSelecao.type = "button";
      btnLimparSelecao.className = "btn-cad-secundario";
      btnLimparSelecao.textContent = "Limpar seleção";
      btnLimparSelecao.addEventListener("click", () => {
        estadoCadastro[chave].selecionados.clear();
        renderizarListaCadastro(chave);
      });
      const btnExcluirSelecionados = document.createElement("button");
      btnExcluirSelecionados.type = "button";
      btnExcluirSelecionados.className = "btn-cad-primario btn-excluir-selecionados";
      btnExcluirSelecionados.id = "btn-excluir-selecionados-" + chave;
      btnExcluirSelecionados.addEventListener("click", () => excluirSelecionados(chave));
      barraSelecao.appendChild(contagemSelecao);
      barraSelecao.appendChild(btnSelecionarFiltrados);
      barraSelecao.appendChild(btnLimparSelecao);
      barraSelecao.appendChild(btnExcluirSelecionados);
      controles.appendChild(barraSelecao);

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
      const btnImp = document.getElementById("btn-importar-" + chave);
      if (btnImp) btnImp.disabled = !disponivel;
    });
  }

  // ------------------------------------------------------------------
  // V 1.6 - Importacao por Excel (ver js/importador.js). Cada cadastro que
  // declara "importacao" em CADASTROS_CONFIG ganha o botao "Importar Excel".
  // ------------------------------------------------------------------
  function chaveNaturalDe(valores, campos) {
    const Imp = window.BI.Importador;
    return campos.map((k) => Imp.norm(valores[k] == null ? "" : valores[k])).join("|");
  }

  // Mensagem de erro (ou null) se ja existe OUTRO registro com a mesma chave
  // natural - usado pelo formulario manual para nao duplicar lancamentos.
  function erroDuplicidade(chave, dados, mensagem) {
    const cfg = CADASTROS_CONFIG[chave];
    const campos = cfg.importacao.chaveNatural;
    const k = chaveNaturalDe(dados, campos);
    const idAtual = estadoCadastro[chave] ? estadoCadastro[chave].editandoId : null;
    const outro = (window.BI.dados[chave] || []).find((l) => l._id !== idAtual && chaveNaturalDe(l, campos) === k);
    return outro ? mensagem : null;
  }

  function abrirImportacao(chave) {
    const cfg = CADASTROS_CONFIG[chave];
    if (!cfg || !cfg.importacao) return;
    if (!window.BI.Importador) { mostrarErro("O módulo de importação não carregou. Recarregue a página."); return; }
    if (!window.BI.DB.estado.disponivel) { mostrarErro("Banco de dados indisponível nesta visualização. Não é possível importar agora."); return; }
    const imp = cfg.importacao;
    const niveisNoCadastro = NIVEIS_HIERARQUIA.filter((n) => cfg.campos.some((c) => c.campo === n && c.tipo === "cascata"));
    const def = {
      colecao: chave,
      titulo: cfg.titulo,
      campos: cfg.campos,
      chaveNatural: imp.chaveNatural,
      arquivo: imp.arquivo,
      nomePlanilha: imp.nomePlanilha,
      colunasPrevia: imp.colunasPrevia,
      descricao: imp.descricao,
      rotulo: (c) => T(c.rotulo || c.campo),
    };
    const ctx = {
      existentes: () => window.BI.dados[chave] || [],
      opcoesCascata: (campo, atuais) => opcoesHierarquia(campo, atuais),
      gerarId: () => novoIdRegistro(),
      // Aba "Referências" do modelo: combinacoes da hierarquia ja cadastradas
      // (somente as que o usuario enxerga), ate o nivel mais profundo do cadastro.
      referencias: () => {
        if (!niveisNoCadastro.length) return [];
        const fundo = niveisNoCadastro[niveisNoCadastro.length - 1];
        const colunas = NIVEIS_HIERARQUIA.slice(0, NIVEIS_HIERARQUIA.indexOf(fundo) + 1);
        const linhas = linhasCadastroMestre(fundo)
          .map((l) => colunas.map((c) => l[c] || ""))
          .sort((a, b) => a.join("|").localeCompare(b.join("|"), "pt-BR"));
        return [{ nome: "Referências", colunas: colunas.map((c) => T(c)), linhas }];
      },
      exemplos: () => {
        const fundo = niveisNoCadastro[niveisNoCadastro.length - 1];
        const base = fundo ? linhasCadastroMestre(fundo).slice(0, 2) : [{}];
        return base.map((l) => Object.assign({}, l, imp.exemplo || {}));
      },
    };
    window.BI.Importador.abrir(def, ctx);
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
        form._erroEl.textContent = "Banco de dados indisponível nesta visualização. Não é possível salvar agora.";
        return;
      }
      const { dados, erro, campoComErro } = lerValoresFormulario(cfg, form);
      if (erro) {
        form._erroEl.hidden = false;
        form._erroEl.textContent = erro;
        // Modo "abas" (ver montarFormulario): o campo com erro pode estar
        // numa aba que nao e a ativa no momento - pula pra ela sozinho, senao
        // a mensagem de erro fica "sem explicacao" pro usuario (ele nao ve o
        // campo citado na tela).
        if (form._trocarAba && campoComErro != null && form._abaDoCampo[campoComErro] != null) {
          form._trocarAba(form._abaDoCampo[campoComErro]);
        }
        return;
      }
      if (cfg.aoValidar) {
        const erroGancho = cfg.aoValidar(form, dados);
        if (erroGancho) { form._erroEl.hidden = false; form._erroEl.textContent = erroGancho; return; }
      }
      if (cfg.aoPrepararDados) cfg.aoPrepararDados(form, dados);
      try {
        const idAtual = estado.editandoId;
        let idSalvo = idAtual;
        // mapaRisco e as 6 tabelas do cadastro-mestre tem id derivado dos
        // proprios campos (chave composta) - editar um campo-chave "renomeia"
        // o registro (salva no novo id, exclui o antigo). Os demais
        // cadastros (planoAcao/absenteismo/compativeis) mantem o id gerado
        // automaticamente na criacao.
        const geradorId = chave === "mapaRisco" ? window.BI.DB.idMapaRisco : window.BI.DB.idCadastroMestre[chave];
        if (geradorId) {
          const novoId = geradorId(dados);
          // Registro novo OU edicao que mudou campo-chave (ex.: renomeou o
          // Cliente) - o id calculado ainda nao existe no banco, entao tem
          // que CRIAR (POST), nunca atualizar (PUT) um id inexistente (ver
          // comentario em js/db.js/salvar - bug "Erro ao salvar: Nao
          // encontrado" reportado pelo Leo 02/10/2026 ao cadastrar empresa nova).
          const ehRegistroNovo = !idAtual || idAtual !== novoId;
          await window.BI.DB.salvar(chave, novoId, dados, ehRegistroNovo);
          if (idAtual && idAtual !== novoId) await window.BI.DB.excluir(chave, idAtual);
          idSalvo = novoId;
        } else if (cfg.gerarIdNovo && !idAtual) {
          // Registro novo com id escolhido AQUI (um so por formulario, mesmo se
          // o salvamento for repetido): as acoes ligadas ja nascem apontando
          // para ele e um segundo "Salvar" nao cria outro registro.
          if (!form._idNovo) form._idNovo = novoIdRegistro();
          await window.BI.DB.salvar(chave, form._idNovo, dados, true);
          idSalvo = form._idNovo;
        } else {
          await window.BI.DB.salvar(chave, idAtual, dados);
        }
        if (cfg.aoSalvarDepois) await cfg.aoSalvarDepois(form, idSalvo, dados);
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
    if (!window.confirm("Excluir este registro definitivamente? Essa ação não pode ser desfeita.")) return;
    window.BI.DB.excluir(chave, id).catch((e) => {
      mostrarErro("Erro ao excluir registro: " + (e && e.message ? e.message : String(e)));
    });
  }

  // Linhas de `chave` depois dos filtros globais do topo + a busca local da
  // tela de cadastro - fatorado pra fora de renderizarListaCadastro porque
  // selecionarTodosFiltrados() (selecao em bloco) precisa do MESMO conjunto
  // (nao so a pagina atual de 10) sem duplicar a logica de filtro/busca.
  function linhasFiltradasCadastro(chave) {
    const cfg = CADASTROS_CONFIG[chave];
    const estado = estadoCadastro[chave];
    const linhasBrutas = window.BI.dados[chave] || [];
    let linhas = window.BI.Calc.filtrar(linhasBrutas, window.BI.filtros, cfg.camposData);
    const totalFiltrado = linhas.length;
    if (estado.busca) {
      const termo = estado.busca.toLowerCase();
      linhas = linhas.filter((l) => cfg.colunasTabela.some((c) => String(l[c] || "").toLowerCase().includes(termo)));
    }
    return { linhasBrutas, linhas, totalFiltrado };
  }

  // V 1.2 - situacao da evidencia de uma acao do Plano de Acao.
  function textoEvidenciaAcao(linha) {
    const n = (linha.Evidencias || []).length;
    const concluida = !!(linha["Dt Conclusao"] || linha["Status Execucao"] === "Concluida");
    if (n) return `Anexada (${n})`;
    if (!concluida) return "-";
    const d = linha._dispensa;
    if (d && !d.regularizadaEm) return `Pendente até ${window.BI.Datas.isoParaBR(d.prazo)}`;
    return "Sem evidência";
  }

  function renderizarListaCadastro(chave) {
    const Calc = window.BI.Calc;
    const cfg = CADASTROS_CONFIG[chave];
    const estado = estadoCadastro[chave];
    const hoje = hojeMeiaNoite();
    const filtradas = linhasFiltradasCadastro(chave);
    const linhasBrutas = filtradas.linhasBrutas;
    const totalFiltrado = filtradas.totalFiltrado;
    let linhas = filtradas.linhas;

    // Ordenacao por coluna (clicar no cabecalho) - pedido do Leo: A-Z/Z-A
    // pra texto, mais antigo->mais novo pra data. "Status Acao" e coluna
    // calculada (nao existe direto na linha), entao calcula na hora de
    // comparar.
    if (estado.ordenarCampo) {
      const campoOrdenar = estado.ordenarCampo;
      const ehData = !!(cfg.colunasData && cfg.colunasData.includes(campoOrdenar));
      const ehStatusAcao = campoOrdenar === "Status Acao";
      const valorOrdenavel = (linha) => ehStatusAcao
        ? Calc.statusDaLinhaAcao(linha, hoje)
        : (campoOrdenar === "Evidencia" ? textoEvidenciaAcao(linha) : linha[campoOrdenar]);
      linhas = linhas.slice().sort((a, b) => {
        const r = compararValoresTabela(valorOrdenavel(a), valorOrdenavel(b), ehData);
        return estado.ordenarAsc ? r : -r;
      });
    }

    const porPagina = 10;
    const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
    if (estado.pagina > totalPaginas) estado.pagina = totalPaginas;
    const inicio = (estado.pagina - 1) * porPagina;
    const paginaAtual = linhas.slice(inicio, inicio + porPagina);

    const tabela = document.getElementById("tabela-cad-" + chave);
    if (!tabela) return;

    const colunasExtra = chave === "planoAcao" ? ["Status Acao", "Evidencia"] : [];
    const colunas = cfg.colunasTabela.concat(colunasExtra);

    const thead = tabela.querySelector("thead");
    thead.innerHTML = "";
    const trHead = document.createElement("tr");

    // Coluna de selecao em bloco (pedido do Leo 02/10/2026) - checkbox no
    // cabecalho marca/desmarca todos os _id da PAGINA atual de uma vez
    // (selecionarTodosFiltrados, abaixo, cobre os filtrados fora da
    // pagina). Indeterminado quando so parte da pagina esta marcada.
    const thSelecao = document.createElement("th");
    thSelecao.className = "col-selecao";
    const idsPaginaSelecionaveis = paginaAtual.filter((l) => !!l._id).map((l) => l._id);
    const cbSelecionarPagina = document.createElement("input");
    cbSelecionarPagina.type = "checkbox";
    cbSelecionarPagina.title = "Selecionar todos desta página";
    cbSelecionarPagina.disabled = !window.BI.DB.estado.disponivel || idsPaginaSelecionaveis.length === 0;
    const todaPaginaMarcada = idsPaginaSelecionaveis.length > 0 && idsPaginaSelecionaveis.every((id) => estado.selecionados.has(id));
    cbSelecionarPagina.checked = todaPaginaMarcada;
    cbSelecionarPagina.indeterminate = !todaPaginaMarcada && idsPaginaSelecionaveis.some((id) => estado.selecionados.has(id));
    cbSelecionarPagina.addEventListener("change", () => {
      if (cbSelecionarPagina.checked) idsPaginaSelecionaveis.forEach((id) => estado.selecionados.add(id));
      else idsPaginaSelecionaveis.forEach((id) => estado.selecionados.delete(id));
      renderizarListaCadastro(chave);
    });
    thSelecao.appendChild(cbSelecionarPagina);
    trHead.appendChild(thSelecao);

    colunas.forEach((c) => {
      const th = document.createElement("th");
      th.textContent = T(c);
      th.title = "Clique para ordenar";
      if (estado.ordenarCampo === c) {
        th.classList.add("ordenada-por");
        const seta = document.createElement("span");
        seta.className = "seta";
        seta.textContent = estado.ordenarAsc ? "▲" : "▼";
        th.appendChild(seta);
      }
      th.addEventListener("click", () => {
        if (estado.ordenarCampo === c) estado.ordenarAsc = !estado.ordenarAsc;
        else { estado.ordenarCampo = c; estado.ordenarAsc = true; }
        renderizarListaCadastro(chave);
      });
      trHead.appendChild(th);
    });
    const thAcoes = document.createElement("th");
    thAcoes.textContent = "Ações";
    thAcoes.className = "col-acoes";
    trHead.appendChild(thAcoes);
    thead.appendChild(trHead);

    const tbody = tabela.querySelector("tbody");
    tbody.innerHTML = "";
    if (!paginaAtual.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = colunas.length + 2;
      td.className = "sem-dados";
      td.textContent = "Nenhum registro para os filtros/busca atuais.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      paginaAtual.forEach((linha) => {
        const tr = document.createElement("tr");
        const tdSelecao = document.createElement("td");
        tdSelecao.className = "col-selecao";
        const podeSelecionar = window.BI.DB.estado.disponivel && !!linha._id;
        const cbLinha = document.createElement("input");
        cbLinha.type = "checkbox";
        cbLinha.disabled = !podeSelecionar;
        cbLinha.checked = podeSelecionar && estado.selecionados.has(linha._id);
        cbLinha.addEventListener("change", () => {
          if (cbLinha.checked) estado.selecionados.add(linha._id);
          else estado.selecionados.delete(linha._id);
          renderizarListaCadastro(chave);
        });
        tdSelecao.appendChild(cbLinha);
        tr.appendChild(tdSelecao);
        cfg.colunasTabela.forEach((c) => {
          const td = document.createElement("td");
          td.appendChild(noCelula(c, linha, cfg.colunasData || []));
          tr.appendChild(td);
        });
        if (chave === "planoAcao") {
          const td = document.createElement("td");
          td.appendChild(noCelulaStatusAcao(Calc.statusDaLinhaAcao(linha, hoje)));
          tr.appendChild(td);
          const tdEv = document.createElement("td");
          tdEv.textContent = textoEvidenciaAcao(linha);
          if (/^Pendente/.test(tdEv.textContent)) tdEv.style.color = "#b45309";
          tr.appendChild(tdEv);
        }
        const tdAcoes = document.createElement("td");
        tdAcoes.className = "col-acoes";
        const podeEditar = window.BI.DB.estado.disponivel && !!linha._id;
        // "Baixar/Imprimir" direto na linha, quando este cadastro tem um
        // campo de arquivo principal (hoje so Laudo - ver campoArquivoPrincipal
        // em CADASTROS_CONFIG.laudo) e o registro ja tem arquivo anexado. Fica
        // ANTES de Editar/Excluir - e a acao mais comum pra um laudo ja
        // gerado (o usuario nao precisa reabrir o formulario inteiro so pra
        // baixar/imprimir de novo).
        if (cfg.campoArquivoPrincipal) {
          const itemArquivo = linha[cfg.campoArquivoPrincipal];
          const btnBaixar = document.createElement("button");
          btnBaixar.type = "button";
          btnBaixar.className = "btn-acao-linha btn-acao-linha-baixar";
          btnBaixar.textContent = "⬇ Baixar/Imprimir";
          btnBaixar.disabled = !(itemArquivo && itemArquivo.chave);
          if (!btnBaixar.disabled) {
            btnBaixar.title = "Abre o arquivo numa nova aba - de lá dá para imprimir ou salvar (Ctrl+P / Ctrl+S)";
            btnBaixar.addEventListener("click", () => {
              window.open(window.BI.DB.urlArquivo(itemArquivo.chave), "_blank", "noopener");
            });
          } else {
            btnBaixar.title = "Este registro ainda não tem um arquivo gerado/anexado - use Editar e o botão \"Gerar Laudo (PDF)\"";
          }
          tdAcoes.appendChild(btnBaixar);
        }
        // "Inventário de Riscos" direto na linha de Avaliacao Ergonomica
        // (pedido do Leo 28/09/2026 - ver abrirInventarioChecklist) - abre a
        // tela de checklist com os 41 fatores da ISO TS-20646 ja filtrados
        // pro posto desta linha, em vez do usuario ter que ir na tela
        // separada de Inventario de Riscos e montar um registro por vez.
        if (cfg.temInventarioChecklist) {
          const btnChecklist = document.createElement("button");
          btnChecklist.type = "button";
          btnChecklist.className = "btn-acao-linha btn-acao-linha-checklist";
          btnChecklist.textContent = "📋 Inventário de Riscos";
          btnChecklist.title = "Abre a checklist de fatores de risco (ISO TS-20646) para este posto";
          btnChecklist.addEventListener("click", () => abrirInventarioChecklist(linha));
          tdAcoes.appendChild(btnChecklist);
        }
        const btnEditar = document.createElement("button");
        btnEditar.type = "button"; btnEditar.className = "btn-acao-linha"; btnEditar.textContent = "Editar";
        btnEditar.disabled = !podeEditar;
        btnEditar.addEventListener("click", () => abrirFormEditar(chave, linha._id));
        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button"; btnExcluir.className = "btn-acao-linha excluir"; btnExcluir.textContent = "Excluir";
        btnExcluir.disabled = !podeEditar;
        btnExcluir.addEventListener("click", () => excluirRegistro(chave, linha._id));
        const btnDetalhes = document.createElement("button");
        btnDetalhes.type = "button"; btnDetalhes.className = "btn-acao-linha btn-acao-linha-detalhes"; btnDetalhes.textContent = "Mais detalhes";
        btnDetalhes.title = "Quem criou/editou este registro, quando, e o histórico campo a campo";
        btnDetalhes.addEventListener("click", () => BI.Historico.abrir(cfg, linha));
        tdAcoes.appendChild(btnDetalhes);
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
    btnProx.type = "button"; btnProx.textContent = "Próxima >"; btnProx.disabled = estado.pagina >= totalPaginas;
    btnProx.addEventListener("click", () => { estado.pagina += 1; renderizarListaCadastro(chave); });
    pagCont.appendChild(info);
    pagCont.appendChild(btnAnt);
    pagCont.appendChild(btnProx);

    atualizarBarraSelecao(chave, linhas, paginaAtual);
  }

  function renderizarTodosCadastros() {
    Object.keys(CADASTROS_CONFIG).forEach(renderizarListaCadastro);
  }

  // Sincroniza a barra de selecao em bloco (contador, botao "Excluir
  // selecionados" e o botao "Selecionar todos os N filtrados") com
  // estadoCadastro[chave].selecionados - chamada ao final de todo
  // renderizarListaCadastro. `linhasFiltradas` e o conjunto completo (todas
  // as paginas) depois de filtros+busca; `linhasPagina` e so a pagina atual.
  function atualizarBarraSelecao(chave, linhasFiltradas, linhasPagina) {
    const estado = estadoCadastro[chave];

    // Poda ids que nao fazem mais parte do conjunto filtrado atual (ex.: o
    // usuario trocou um filtro global do topo, nao so a busca local desta
    // tela, ou o registro foi excluido por outra via) - evita contar/excluir
    // algo que nem aparece mais na tela.
    const idsFiltrados = new Set(linhasFiltradas.map((l) => l._id).filter(Boolean));
    Array.from(estado.selecionados).forEach((id) => {
      if (!idsFiltrados.has(id)) estado.selecionados.delete(id);
    });

    const barra = document.getElementById("barra-selecao-" + chave);
    const contagemEl = document.getElementById("barra-selecao-contagem-" + chave);
    const btnSelFiltrados = document.getElementById("btn-selecionar-filtrados-" + chave);
    const btnExcluir = document.getElementById("btn-excluir-selecionados-" + chave);
    if (!barra || !contagemEl || !btnSelFiltrados || !btnExcluir) return;

    const qtd = estado.selecionados.size;
    barra.hidden = qtd === 0;
    if (qtd === 0) return;

    contagemEl.textContent = qtd === 1 ? "1 selecionado" : `${qtd} selecionados`;
    btnExcluir.textContent = qtd === 1 ? "🗑 Excluir selecionado" : `🗑 Excluir ${qtd} selecionados`;

    // So oferece "selecionar todos os filtrados" quando a pagina atual ja
    // esta 100% marcada e existe mais coisa fora dela (senao o botao nao
    // faria nada diferente do que ja esta marcado).
    const idsPagina = linhasPagina.map((l) => l._id).filter(Boolean);
    const paginaToda = idsPagina.length > 0 && idsPagina.every((id) => estado.selecionados.has(id));
    btnSelFiltrados.hidden = !(paginaToda && qtd < idsFiltrados.size);
    if (!btnSelFiltrados.hidden) {
      btnSelFiltrados.textContent = `Selecionar todos os ${idsFiltrados.size} filtrados`;
    }
  }

  // Marca TODOS os registros do conjunto filtrado atual (nao so a pagina) -
  // ligado ao botao "Selecionar todos os N filtrados" da barra de selecao.
  function selecionarTodosFiltrados(chave) {
    const estado = estadoCadastro[chave];
    const { linhas } = linhasFiltradasCadastro(chave);
    linhas.forEach((l) => { if (l._id) estado.selecionados.add(l._id); });
    renderizarListaCadastro(chave);
  }

  // Exclusao em bloco (pedido do Leo 02/10/2026: "Inclua caixas de selecao
  // e a opcao de excluir dados em bloco... estou levando muito tempo para
  // excluir informacoes do sistema"). Confirma uma unica vez com a
  // contagem, chama window.BI.DB.excluirEmLote (ver js/db.js) e reporta
  // falhas parciais em vez de um erro generico - uma falha isolada (rede,
  // permissao) nao deve mascarar que o resto foi excluido com sucesso.
  async function excluirSelecionados(chave) {
    const estado = estadoCadastro[chave];
    const ids = Array.from(estado.selecionados);
    if (!ids.length || !window.BI.DB.estado.disponivel) return;
    const cfg = CADASTROS_CONFIG[chave];
    const mensagem = ids.length === 1
      ? `Excluir o registro selecionado de "${cfg.titulo}"? Essa ação não pode ser desfeita.`
      : `Excluir os ${ids.length} registros selecionados de "${cfg.titulo}"? Essa ação não pode ser desfeita.`;
    if (!window.confirm(mensagem)) return;

    const btnExcluir = document.getElementById("btn-excluir-selecionados-" + chave);
    if (btnExcluir) btnExcluir.disabled = true;
    try {
      const resultado = await window.BI.DB.excluirEmLote(chave, ids);
      estado.selecionados.clear();
      if (resultado && resultado.falhas) {
        mostrarErro(`Excluídos ${resultado.total - resultado.falhas} de ${resultado.total} registros selecionados - ${resultado.falhas} falharam (tente novamente ou exclua um por um).`);
      }
      renderizarListaCadastro(chave);
    } catch (e) {
      mostrarErro("Erro ao excluir em lote: " + (e && e.message ? e.message : String(e)));
    } finally {
      if (btnExcluir) btnExcluir.disabled = false;
    }
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
    if (btnRef) btnRef.textContent = "Ver tabelas de referência";
    if (window.BI.Indicadores) window.BI.Indicadores.fecharPopover();
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
        btn.textContent = "Ver tabelas de referência";
        document.querySelectorAll('main > section[id^="aba-"]').forEach((sec) => {
          sec.hidden = sec.id !== abaVisivelAntesDeReferencia;
        });
      } else {
        const visivelAtual = Array.from(document.querySelectorAll('main > section[id^="aba-"]')).find((s) => !s.hidden && s.id !== "aba-referencia");
        abaVisivelAntesDeReferencia = visivelAtual ? visivelAtual.id : "aba-ergo";
        document.querySelectorAll('main > section[id^="aba-"]').forEach((sec) => {
          sec.hidden = sec.id !== "aba-referencia";
        });
        btn.textContent = "Fechar tabelas de referência";
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
  const TITULOS_ABA = { ergo: "Dashboard Ergo", medocup: "Dashboard Med Ocup", compativeis: "Dashboard Compatíveis" };
  const TABELAS_POR_ABA = { ergo: ["mapaRisco", "planoAcao"], medocup: ["absenteismo", "diasUteis"], compativeis: ["compativeis"] };
  const NOMES_PLANILHA = { mapaRisco: "Mapa Risco", planoAcao: "Plano Ação", absenteismo: "Absenteísmo", compativeis: "Compatíveis", diasUteis: "HHT Dias Úteis" };

  function abaAtualChave() {
    const btn = document.querySelector('#nav-abas button[data-aba].ativa');
    return btn ? btn.dataset.aba : null;
  }

  function resumoFiltrosAtivos() {
    const partes = [];
    ORDEM_FILTROS.forEach((campo) => {
      const vals = (window.BI.filtros || {})[campo];
      if (vals && vals.length) partes.push(`${T(LABELS_FILTRO[campo] || campo)}: ${vals.map(T).join(", ")}`);
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
      mostrarErro("A biblioteca de exportação Excel não carregou (script externo bloqueado ou indisponível).");
      return;
    }
    const wb = XLSX.utils.book_new();
    chavesTabela.forEach((chaveTabela) => {
      const linhas = linhasFiltradasParaExportar(chaveTabela).map((l) => {
        const copia = {};
        const ROT_AUDIT = { _criadoEm: "Criado em", _criadoPor: "Criado por", _editadoEm: "Última edição em", _editadoPor: "Última edição por" };
        Object.keys(l).forEach((k) => {
          if (k === "_id" || k === "_notif" || k === "_historico") return;
          let v = l[k];
          if (ROT_AUDIT[k]) { copia[ROT_AUDIT[k]] = k.endsWith("Em") ? BI.Datas.dataHoraBR(v) : v; return; }
          if (typeof v === "string" && (/^\d{4}-\d{2}-\d{2}$/.test(v) || (k === "Ano/Mes Uteis" && /^\d{4}-\d{2}$/.test(v)))) v = BI.Datas.isoParaBR(v);
          copia[T(k)] = v;
        });
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
      mostrarErro("A biblioteca de exportação PDF não carregou (script externo bloqueado ou indisponível).");
      return;
    }
    const secao = document.getElementById("aba-" + chave);
    if (!secao) return;

    const doc = new jsPDFCtor({ unit: "pt", format: "a4" });
    if (window.BI && window.BI.registrarFontesPDF) window.BI.registrarFontesPDF(doc);
    const margem = 36;
    const larguraPagina = doc.internal.pageSize.getWidth();
    const alturaPagina = doc.internal.pageSize.getHeight();
    const larguraUtil = larguraPagina - margem * 2;
    let y = margem;

    function novaPagina() { doc.addPage(); y = margem; }
    function garantirEspaco(altura) { if (y + altura > alturaPagina - margem) novaPagina(); }

    doc.setFont("Montserrat", "bold");
    doc.setFontSize(16);
    doc.setTextColor(94, 42, 48);
    doc.text("S.I.G.E - ElevaLife", margem, y);
    y += 20;
    doc.setFont("Montserrat", "normal");
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
      doc.setFont("Montserrat", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text(titulo, margem, y);
      y += 14;
      if (sub) {
        doc.setFont("Montserrat", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(sub, margem, y);
        y += 12;
      }

      const tilesEl = cartao.querySelector(".grade-status, .grade-totais");
      if (tilesEl) {
        const linhasTexto = extrairTextoTiles(tilesEl);
        garantirEspaco(linhasTexto.length * 12 + 6);
        doc.setFont("Montserrat", "normal");
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
          doc.setFont("Montserrat", "normal");
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

  // Botao "Atualizar" (re-renderiza tudo com os dados/filtros atuais) na
  // barra superior. O botao "Filtros" saiu daqui - agora mora no menu
  // lateral e abre o painel de filtros (ver configurarPainelFiltros).
  function configurarBarraSuperior() {
    const btnAtualizar = document.getElementById("btn-atualizar");
    if (btnAtualizar) {
      btnAtualizar.addEventListener("click", () => {
        try { renderizarTudo(); } catch (e) { mostrarErro("Erro ao atualizar: " + (e && e.message ? e.message : String(e))); }
      });
    }
  }

  // Sino de notificacoes do Plano de Acao (pedido do Leo 02/10/2026):
  // calcula, ao vivo e a partir de window.BI.dados.planoAcao (TODAS as
  // empresas visiveis, independente do filtro global atual - e um aviso
  // persistente, nao algo que devia sumir so porque o usuario filtrou por
  // outro cliente), quais acoes vencem em ate 30 dias ou ja estao em
  // atraso (sem Dt Conclusao). So leitura/visualizacao - sem estado de
  // lido/nao lido por enquanto. O envio por e-mail dos mesmos avisos e
  // feito pela API (ver api/src/functions/lembretesPlanoAcao.js).
  function atualizarSinoNotificacoes() {
    const badge = document.getElementById("badge-sino-notificacoes");
    const lista = document.getElementById("painel-sino-lista");
    if (!badge || !lista) return;
    try {
      const planos = window.BI.dados.planoAcao || [];
      const hoje = new Date();
      const hojeMs = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

      const itens = planos
        .filter((p) => p["Dt Programada"] && !p["Dt Conclusao"])
        .map((p) => {
          const partes = String(p["Dt Programada"]).slice(0, 10).split("-").map(Number);
          if (partes.length !== 3 || partes.some((n) => Number.isNaN(n))) return null;
          const dtMs = Date.UTC(partes[0], partes[1] - 1, partes[2]);
          const diffDias = Math.round((hojeMs - dtMs) / 86400000);
          if (diffDias < -30) return null; // falta mais de 30 dias - ainda nao e um aviso
          return { plano: p, diffDias, atrasada: diffDias >= 1 };
        })
        .filter(Boolean)
        .sort((a, b) => b.diffDias - a.diffDias);

      badge.hidden = itens.length === 0;
      badge.textContent = itens.length > 99 ? "99+" : String(itens.length);

      lista.innerHTML = "";
      if (itens.length === 0) {
        const vazio = document.createElement("div");
        vazio.className = "painel-sino-vazio";
        vazio.textContent = "Nenhuma ação vencendo em breve ou atrasada.";
        lista.appendChild(vazio);
        return;
      }
      itens.forEach(({ plano, diffDias, atrasada }) => {
        const item = document.createElement("div");
        item.className = "painel-sino-item" + (atrasada ? " painel-sino-item--atraso" : "");

        const acao = document.createElement("div");
        acao.className = "painel-sino-item-acao";
        acao.textContent = plano["Acao Recomendada"] || "Ação";

        const meta = document.createElement("div");
        meta.className = "painel-sino-item-meta";
        meta.textContent = [plano.Cliente, plano.Setor, plano["Responsavel Acao"] || "sem responsável"].filter(Boolean).join(" · ");

        const prazo = document.createElement("div");
        prazo.className = "painel-sino-item-prazo";
        prazo.textContent = atrasada
          ? (diffDias === 1 ? "Atrasada há 1 dia" : `Atrasada há ${diffDias} dias`)
          : (diffDias === 0 ? "Vence hoje" : `Vence em ${-diffDias} ${-diffDias === 1 ? "dia" : "dias"}`);

        item.appendChild(acao);
        item.appendChild(meta);
        item.appendChild(prazo);
        lista.appendChild(item);
      });
    } catch (e) {
      console.error("Sino de notificações (Plano de Ação) falhou:", e);
    }
  }

  function configurarSinoNotificacoes() {
    const btn = document.getElementById("btn-sino-notificacoes");
    const painel = document.getElementById("painel-sino-notificacoes");
    if (!btn || !painel) return;

    function abrir() {
      painel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    }
    function fechar() {
      painel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (painel.hidden) abrir(); else fechar();
    });
    painel.addEventListener("click", (ev) => ev.stopPropagation());
    document.addEventListener("click", () => { if (!painel.hidden) fechar(); });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !painel.hidden) fechar(); });

    atualizarSinoNotificacoes();
  }

  // Painel de Filtros: aberto pelo botao "Filtros" do menu lateral (pedido
  // do Leo, igual ao padrao mais novo do menu do Cockpit Comercial) - um
  // overlay escurece o resto da tela pra focar a atencao no painel, em vez
  // da barra fixa/recolhivel de antes.
  function configurarPainelFiltros() {
    const btnAbrir = document.getElementById("btn-abrir-filtros");
    const btnFechar = document.getElementById("btn-fechar-filtros");
    const overlay = document.getElementById("overlay-filtros");
    const painel = document.getElementById("painel-filtros");
    if (!painel) return;

    function abrirPainelFiltros() {
      painel.classList.add("aberto");
      painel.setAttribute("aria-hidden", "false");
      if (overlay) overlay.hidden = false;
      if (btnAbrir) btnAbrir.setAttribute("aria-expanded", "true");
    }
    function fecharPainelFiltros() {
      painel.classList.remove("aberto");
      painel.setAttribute("aria-hidden", "true");
      if (overlay) overlay.hidden = true;
      if (btnAbrir) btnAbrir.setAttribute("aria-expanded", "false");
    }
    if (btnAbrir) btnAbrir.addEventListener("click", abrirPainelFiltros);
    if (btnFechar) btnFechar.addEventListener("click", fecharPainelFiltros);
    if (overlay) overlay.addEventListener("click", fecharPainelFiltros);
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && painel.classList.contains("aberto")) fecharPainelFiltros();
    });
  }

  // Numero de filtros globais com alguma selecao ativa (!= "Todos") -
  // mostrado como badge no botao "Filtros" do menu, ja que os campos
  // ficam escondidos dentro do painel agora.
  function contarFiltrosAtivos() {
    return ORDEM_FILTROS.filter((campo) => (window.BI.filtros[campo] || []).length > 0).length;
  }
  function atualizarBadgeFiltros() {
    const badge = document.getElementById("badge-filtros");
    if (!badge) return;
    const n = contarFiltrosAtivos();
    badge.textContent = String(n);
    badge.hidden = n === 0;
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
    forte.textContent = "Não foi possível carregar o S.I.G.E:";
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

    const mapaRiscoF = Calc.filtrar(window.BI.dados.mapaRisco, filtros, ["Dt Avaliacao"]);
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
    renderLinhaMensal("chart-acoes-previstas", Calc.serieMensal(planoAcaoFPrevistas, "Dt Programada"), "Ações previstas", Calc.resolverCorCSS("var(--teal)"), planoAcaoFPrevistas, "Dt Programada");
    renderLinhaMensal("chart-acoes-concluidas", Calc.serieMensal(planoAcaoFConcluidas, "Dt Conclusao"), "Ações concluídas", Calc.resolverCorCSS("var(--vinho-medio)"), planoAcaoFConcluidas, "Dt Conclusao");
    renderPorResponsavel(Calc.planoAcaoPorResponsavel(planoAcaoF, hoje), planoAcaoF, hoje);
    renderStatusPorSetor(Calc.statusPlanoAcaoPorSetor(planoAcaoF, hoje), planoAcaoF, hoje);
    renderRiscoPorSetor(Calc.mapaRiscoPorSetor(mapaRiscoF), mapaRiscoF);

    // Sistema de Gestao Integrada: mesmos filtros globais. Ano/Mes so traz
    // registro que tem a data lancada (V 1.1).
    const avaliacaoF = Calc.filtrar(window.BI.dados.avaliacaoErgonomica || [], filtros, ["Data Avaliacao"]);
    // Fator marcado "Nao" no checklist nao e' risco: fica fora de todas as contagens.
    const fatorRiscoF = Calc.filtrar(window.BI.dados.fatorRisco || [], filtros, ["Dt Identificacao"]).filter((l) => l["Existe Fator Risco"] !== "Nao");
    const fatorRiscoAbertoF = fatorRiscoF.filter((l) => ["A validar", "Em andamento"].includes(l.Status));
    const laudoF = Calc.filtrar(window.BI.dados.laudo || [], filtros, ["Emitido Em"]);
    const aetF = Calc.filtrar(window.BI.dados.aet || [], filtros, ["Data Analise"]);
    const DIAS_ALERTA_PRAZO = 30;

    // Trilha AEP (nativa) - ver titulo-secao-grade "AEP" no index.html.
    renderTilesFatorRiscoGraduacao(Calc.distribuicaoPorNivelRisco(fatorRiscoF, "Graduacao Risco"), fatorRiscoF);
    renderDonutFatorRiscoStatus(Calc.distribuicaoPorStatus(fatorRiscoF, "Status", STATUS_FATOR_RISCO_POOL), fatorRiscoF);
    renderTilesAvaliacaoCobertura(Calc.coberturaAvaliacao(avaliacaoF, mapaRiscoF));
    renderTilesFatorRiscoPrazos(Calc.distribuicaoVencimento(fatorRiscoAbertoF, "Valido Ate", hoje, DIAS_ALERTA_PRAZO), fatorRiscoAbertoF, hoje, DIAS_ALERTA_PRAZO);
    renderTopSetoresFatorRisco(Calc.topSetoresPorCampo(fatorRiscoF, "Status", ["A validar", "Em andamento"], 5), fatorRiscoF);
    renderDonutLaudosTipo(laudoF);

    // Trilha AET (upload externo) - ver titulo-secao-grade "AET" no index.html.
    renderTilesAET(Calc.distribuicaoClassificacaoAET(aetF), aetF);

    const diasUteisF = Calc.filtrar(window.BI.dados.diasUteis, filtros, ["Ano/Mes Uteis"]);
    const absenteismoF = Calc.filtrar(window.BI.dados.absenteismo, filtros, ["Dt Afastamento"]);
    renderTotaisMedOcup(Calc.totaisMedOcup(absenteismoF, diasUteisF));
    renderEvolucaoTaxa(Calc.evolucaoTaxaFrequencia(absenteismoF, diasUteisF), absenteismoF);
    renderTaxaPorSetor(Calc.taxaFrequenciaPorSetor(absenteismoF, diasUteisF), absenteismoF);
    renderDiagramasMedOcup(absenteismoF);

    const compativeisGlobalF = Calc.filtrar(window.BI.dados.compativeis, filtros, ["Inicio Restricao"]);
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
  // Usuarios (quem tem acesso ao BI e a quais empresas-cliente esta
  // vinculado) - Administrador e Consultor veem essa aba e podem convidar
  // gente nova; so Administrador pode editar papel/empresas ou excluir o
  // acesso de alguem (pedido do Leo, 28-29/09/2026: "eu crio o usuario...
  // ou o administrador, ou o consultor" - ver api/src/functions/usuarios.js,
  // que aplica essa mesma regra no backend; o frontend so espelha pra nao
  // mostrar botao que ia dar 403). Desde 29/09/2026 nao existe mais "criar
  // usuario sem senha" - toda criacao dispara um convite por e-mail com
  // link de primeiro acesso (ver api/src/functions/auth.js).
  // Tela separada do sistema generico de Cadastro (CADASTROS_CONFIG/
  // estado.colecoes) porque "usuarios" tem sua propria rota dedicada (nao e
  // uma das colecoes de negocio por EmpresaId, ver js/db.js/COLECOES) - mas
  // reaproveita montarFormulario/lerValoresFormulario (que so precisam de
  // um "cfg" com "campos", sem exigir que a colecao esteja em
  // CADASTROS_CONFIG).
  // ------------------------------------------------------------------
  const PAPEIS_USUARIO = ["Administrador", "Consultor", "UsuarioCliente"];
  const estadoUsuarios = { lista: [], formAberto: false, editandoId: null, valoresForm: null, carregando: false };

  function souAdministrador() {
    const identidade = window.BI.DB.estado.identidade;
    return !!(identidade && identidade.papel === "Administrador");
  }

  function limparAvisoConvite() {
    const el = document.getElementById("aviso-convite-usuario");
    if (el) { el.hidden = true; el.innerHTML = ""; }
  }

  // Mostra o link de convite/primeiro-acesso depois de criar um usuario ou
  // reenviar um convite - sempre (nao so quando o e-mail falha), pra dar ao
  // Administrador/Consultor um jeito manual de repassar o acesso mesmo se o
  // envio automatico (Microsoft Graph) ainda nao estiver 100% configurado.
  function mostrarAvisoConvite({ email, linkConvite, avisoEmail }) {
    const el = document.getElementById("aviso-convite-usuario");
    if (!el) return;
    el.innerHTML = "";
    el.hidden = false;
    const titulo = document.createElement("strong");
    titulo.textContent = avisoEmail
      ? `Convite criado para ${email}, mas o e-mail automático falhou:`
      : `Convite enviado por e-mail para ${email}. Link de primeiro acesso (caso precise repassar manualmente):`;
    el.appendChild(titulo);
    if (avisoEmail) {
      const pAviso = document.createElement("p");
      pAviso.className = "aviso-convite-erro";
      pAviso.textContent = avisoEmail;
      el.appendChild(pAviso);
    }
    const pLink = document.createElement("p");
    const link = document.createElement("a");
    link.href = linkConvite; link.textContent = linkConvite; link.target = "_blank"; link.rel = "noopener";
    pLink.appendChild(link);
    el.appendChild(pLink);
    const btnFechar = document.createElement("button");
    btnFechar.type = "button"; btnFechar.className = "btn-fechar-aviso-convite"; btnFechar.textContent = "Fechar";
    btnFechar.addEventListener("click", limparAvisoConvite);
    el.appendChild(btnFechar);
  }

  function camposUsuario() {
    return [
      { campo: "Email", rotulo: "E-mail", tipo: "texto", obrigatorio: true },
      { campo: "Papel", rotulo: "Papel", tipo: "select", obrigatorio: true, opcoes: PAPEIS_USUARIO },
      {
        campo: "EmpresasVinculadas",
        rotulo: "Empresas Vinculadas (Ctrl/Cmd + clique para marcar mais de uma - Administrador vê todas, independente desta lista)",
        tipo: "multiselect",
        opcoes: () => (window.BI.dados.cliente || []).map((c) => ({ valor: c.id || c._id, label: c.Cliente })),
      },
    ];
  }
  const CFG_USUARIOS = { campos: camposUsuario() };

  async function carregarUsuarios() {
    estadoUsuarios.carregando = true;
    renderizarListaUsuarios();
    try {
      const resp = await fetch("/api/usuarios", { credentials: "same-origin" });
      if (!resp.ok) throw new Error("Falha ao carregar usuários (HTTP " + resp.status + ").");
      estadoUsuarios.lista = await resp.json();
    } catch (e) {
      // Sem internet (coleta offline em campo) não é erro do sistema: a
      // lista de usuários só existe online e o indicador na tela já avisa.
      const semRede = window.BI.DB.estado.offlineAgora || (navigator && navigator.onLine === false) || e instanceof TypeError;
      if (!semRede) mostrarErro("Erro ao carregar usuários: " + (e && e.message ? e.message : String(e)));
      estadoUsuarios.lista = [];
    } finally {
      estadoUsuarios.carregando = false;
      renderizarListaUsuarios();
    }
  }

  function nomesClientesPorId(ids) {
    const mapa = {};
    (window.BI.dados.cliente || []).forEach((c) => { mapa[c.id || c._id] = c.Cliente; });
    return (ids || []).map((id) => mapa[id] || id).join(", ");
  }

  function abrirFormNovoUsuario() {
    limparAvisoConvite();
    estadoUsuarios.editandoId = null;
    estadoUsuarios.formAberto = true;
    estadoUsuarios.valoresForm = {};
    renderizarFormUsuario();
  }
  function abrirFormEditarUsuario(id) {
    const linha = estadoUsuarios.lista.find((u) => u.id === id);
    if (!linha) return;
    estadoUsuarios.editandoId = id;
    estadoUsuarios.formAberto = true;
    estadoUsuarios.valoresForm = linha;
    renderizarFormUsuario();
  }
  function fecharFormUsuario() {
    estadoUsuarios.formAberto = false;
    estadoUsuarios.editandoId = null;
    renderizarFormUsuario();
  }

  function renderizarFormUsuario() {
    const container = document.getElementById("form-container-usuarios");
    if (!container) return;
    container.innerHTML = "";
    if (!estadoUsuarios.formAberto) return;
    const form = montarFormulario(CFG_USUARIOS, "usuarios", estadoUsuarios.valoresForm || {});
    // E-mail e a chave de login (identifica a sessao) - so pode ser
    // definido na criacao (convite); editar um usuario existente nunca
    // muda o e-mail (o backend ignora esse campo no PUT, ver usuarios.js).
    if (estadoUsuarios.editandoId && form._campos && form._campos["Email"]) {
      form._campos["Email"].disabled = true;
    }
    form._btnCancelar.addEventListener("click", () => fecharFormUsuario());
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const { dados, erro } = lerValoresFormulario(CFG_USUARIOS, form);
      if (erro) {
        form._erroEl.hidden = false;
        form._erroEl.textContent = erro;
        return;
      }
      dados.Email = String(dados.Email || "").trim().toLowerCase();
      try {
        if (estadoUsuarios.editandoId) {
          await window.BI.DB.salvar("usuarios", estadoUsuarios.editandoId, dados);
          fecharFormUsuario();
        } else {
          // Criar (POST) sempre dispara o convite por e-mail - ver
          // js/db.js/criarUsuario e api/src/functions/usuarios.js.
          const resultado = await window.BI.DB.criarUsuario(dados);
          fecharFormUsuario();
          mostrarAvisoConvite({ email: resultado.Email, linkConvite: resultado.linkConvite, avisoEmail: resultado.avisoEmail });
        }
        await carregarUsuarios();
      } catch (e) {
        form._erroEl.hidden = false;
        form._erroEl.textContent = "Erro ao salvar: " + (e && e.message ? e.message : String(e));
      }
    });
    container.appendChild(form);
  }

  function excluirUsuario(id, email) {
    if (!window.confirm(`Remover o acesso de "${email}" ao S.I.G.E? Essa ação não pode ser desfeita.`)) return;
    window.BI.DB.excluir("usuarios", id).then(() => carregarUsuarios()).catch((e) => {
      mostrarErro("Erro ao excluir usuário: " + (e && e.message ? e.message : String(e)));
    });
  }

  function reenviarConviteUsuario(email, botao) {
    botao.disabled = true;
    botao.textContent = "Reenviando...";
    window.BI.DB.reenviarConvite(email).then((resultado) => {
      mostrarAvisoConvite({ email, linkConvite: resultado.linkConvite, avisoEmail: resultado.avisoEmail });
    }).catch((e) => {
      mostrarErro("Erro ao reenviar convite: " + (e && e.message ? e.message : String(e)));
    }).finally(() => {
      botao.disabled = false;
      botao.textContent = "Reenviar convite";
    });
  }

  function renderizarListaUsuarios() {
    const tabela = document.getElementById("tabela-usuarios");
    if (!tabela) return;
    const ehAdmin = souAdministrador();
    const thead = tabela.querySelector("thead");
    const tbody = tabela.querySelector("tbody");
    thead.innerHTML = "";
    tbody.innerHTML = "";
    const trHead = document.createElement("tr");
    ["E-mail", "Papel", "Empresas Vinculadas", "Status", "Ações"].forEach((c) => {
      const th = document.createElement("th");
      th.textContent = c;
      if (c === "Ações") th.className = "col-acoes";
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    const contagemEl = document.getElementById("contagem-usuarios");
    if (contagemEl) contagemEl.textContent = estadoUsuarios.lista.length ? ` (${estadoUsuarios.lista.length})` : "";

    if (estadoUsuarios.carregando) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5; td.className = "sem-dados"; td.textContent = "Carregando...";
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }
    if (!estadoUsuarios.lista.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5; td.className = "sem-dados"; td.textContent = "Nenhum usuário cadastrado ainda.";
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }
    estadoUsuarios.lista.forEach((u) => {
      const tr = document.createElement("tr");
      const tdEmail = document.createElement("td"); tdEmail.textContent = u.Email || "-";
      const tdPapel = document.createElement("td"); tdPapel.textContent = u.Papel || "-";
      const tdEmpresas = document.createElement("td"); tdEmpresas.textContent = nomesClientesPorId(u.EmpresasVinculadas) || "-";
      const statusConta = u.StatusConta || "Convidado";
      const tdStatus = document.createElement("td");
      const badgeStatus = document.createElement("span");
      badgeStatus.className = "badge-status-conta " + (statusConta === "Ativo" ? "badge-status-ativo" : "badge-status-convidado");
      badgeStatus.textContent = statusConta === "Ativo" ? "Ativo" : "Convite pendente";
      tdStatus.appendChild(badgeStatus);
      const tdAcoes = document.createElement("td"); tdAcoes.className = "col-acoes";
      if (statusConta !== "Ativo") {
        const btnReenviar = document.createElement("button");
        btnReenviar.type = "button"; btnReenviar.className = "btn-acao-linha"; btnReenviar.textContent = "Reenviar convite";
        btnReenviar.addEventListener("click", () => reenviarConviteUsuario(u.Email, btnReenviar));
        tdAcoes.appendChild(btnReenviar);
      }
      if (ehAdmin) {
        const btnEditar = document.createElement("button");
        btnEditar.type = "button"; btnEditar.className = "btn-acao-linha"; btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => abrirFormEditarUsuario(u.id));
        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button"; btnExcluir.className = "btn-acao-linha excluir"; btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", () => excluirUsuario(u.id, u.Email));
        tdAcoes.appendChild(btnEditar); tdAcoes.appendChild(btnExcluir);
      }
      tr.appendChild(tdEmail); tr.appendChild(tdPapel); tr.appendChild(tdEmpresas); tr.appendChild(tdStatus); tr.appendChild(tdAcoes);
      tbody.appendChild(tr);
    });
  }

  // Helpers de DOM compartilhados pelas 3 telas abaixo (login, primeiro
  // acesso/redefinicao de senha, bloqueado).
  function criarBotaoAcesso(id, texto, classe, aoClicar) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = id;
    btn.className = classe;
    btn.textContent = texto;
    btn.addEventListener("click", aoClicar);
    return btn;
  }

  function criarCampoAcesso(id, rotulo, tipo) {
    const wrap = document.createElement("div");
    wrap.className = "campo-acesso";
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = rotulo;
    const input = document.createElement("input");
    input.type = tipo;
    input.id = id;
    input.name = id;
    input.required = true;
    input.autocomplete = tipo === "password" ? "new-password" : tipo === "email" ? "email" : "off";
    wrap.append(label, input);
    return { wrap, input };
  }

  function criarErroAcesso() {
    const p = document.createElement("p");
    p.className = "erro-acesso";
    p.hidden = true;
    return p;
  }

  function mostrarErroAcesso(elErro, mensagem) {
    elErro.textContent = mensagem;
    elErro.hidden = false;
  }

  // Formulario de login (e-mail + senha) - substitui o antigo "Entrar com
  // Microsoft" (pedido do Leo, 28-29/09/2026: "nao sei se o cliente usa
  // Microsoft... e login e senha, tem que ter"). Inclui o link "Esqueci
  // minha senha", que troca pra um mini-formulario de recuperacao no lugar.
  function renderizarFormLogin(conteudo) {
    const h2 = document.createElement("h2");
    h2.textContent = "Bem-vindo(a)";
    const p = document.createElement("p");
    p.textContent = "Entre com seu e-mail e senha para acessar o S.I.G.E.";

    const form = document.createElement("form");
    form.className = "form-acesso";
    form.noValidate = true;
    const campoEmail = criarCampoAcesso("login-email", "E-mail", "email");
    const campoSenha = criarCampoAcesso("login-senha", "Senha", "password");
    const erro = criarErroAcesso();
    const btnEntrar = document.createElement("button");
    btnEntrar.type = "submit";
    btnEntrar.className = "btn-entrar-microsoft";
    btnEntrar.textContent = "Entrar";
    form.append(campoEmail.wrap, campoSenha.wrap, erro, btnEntrar);

    const btnEsqueci = criarBotaoAcesso("btn-esqueci-senha", "Esqueci minha senha", "link-esqueci-senha", () => {
      conteudo.innerHTML = "";
      renderizarFormRecuperacao(conteudo);
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      erro.hidden = true;
      btnEntrar.disabled = true;
      btnEntrar.textContent = "Entrando...";
      try {
        await window.BI.DB.fazerLogin(campoEmail.input.value.trim(), campoSenha.input.value);
        window.location.reload();
      } catch (e) {
        mostrarErroAcesso(erro, (e && e.message) || "Falha ao entrar.");
        btnEntrar.disabled = false;
        btnEntrar.textContent = "Entrar";
      }
    });

    conteudo.append(h2, p, form, btnEsqueci);
  }

  // Mini-formulario "Esqueci minha senha" - sempre responde com a mesma
  // mensagem de confirmacao (o backend nunca revela se o e-mail existe ou
  // nao, ver api/src/functions/auth.js/esqueci-senha).
  function renderizarFormRecuperacao(conteudo) {
    const h2 = document.createElement("h2");
    h2.textContent = "Esqueci minha senha";
    const p = document.createElement("p");
    p.textContent = "Informe seu e-mail. Se ele estiver cadastrado, você vai receber um link para redefinir a senha.";

    const form = document.createElement("form");
    form.className = "form-acesso";
    form.noValidate = true;
    const campoEmail = criarCampoAcesso("recuperar-email", "E-mail", "email");
    const erro = criarErroAcesso();
    const btnEnviar = document.createElement("button");
    btnEnviar.type = "submit";
    btnEnviar.className = "btn-entrar-microsoft";
    btnEnviar.textContent = "Enviar link";
    form.append(campoEmail.wrap, erro, btnEnviar);

    const btnVoltar = criarBotaoAcesso("btn-voltar-login", "Voltar para o login", "btn-trocar-conta", () => {
      conteudo.innerHTML = "";
      renderizarFormLogin(conteudo);
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      erro.hidden = true;
      btnEnviar.disabled = true;
      btnEnviar.textContent = "Enviando...";
      try {
        await window.BI.DB.pedirRecuperacaoSenha(campoEmail.input.value.trim());
        conteudo.innerHTML = "";
        const h2ok = document.createElement("h2");
        h2ok.textContent = "Verifique seu e-mail";
        const pok = document.createElement("p");
        pok.textContent = "Se o e-mail informado estiver cadastrado, um link para redefinir a senha foi enviado.";
        conteudo.append(h2ok, pok, criarBotaoAcesso("btn-voltar-login-2", "Voltar para o login", "btn-trocar-conta", () => {
          conteudo.innerHTML = "";
          renderizarFormLogin(conteudo);
        }));
      } catch (e) {
        mostrarErroAcesso(erro, (e && e.message) || "Falha ao enviar o link.");
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Enviar link";
      }
    });

    conteudo.append(h2, p, form, btnVoltar);
  }

  // Tela de "primeiro acesso" (link do e-mail de convite) ou "redefinir
  // senha" (link do e-mail de recuperacao) - mesmo formulario (nova senha +
  // confirmacao), so muda o titulo/texto e qual acao da API e chamada.
  function renderizarFormDefinirSenha(conteudo, { tipo, email, token }) {
    const ehPrimeiroAcesso = tipo === "primeiro-acesso";
    const h2 = document.createElement("h2");
    h2.textContent = ehPrimeiroAcesso ? "Defina sua senha" : "Redefinir senha";
    const p = document.createElement("p");
    p.appendChild(document.createTextNode(ehPrimeiroAcesso ? "Crie uma senha para acessar o S.I.G.E. com o e-mail " : "Crie uma nova senha para o e-mail "));
    const spanEmail = document.createElement("span");
    spanEmail.className = "tela-acesso-email";
    spanEmail.textContent = email;
    p.appendChild(spanEmail);
    p.appendChild(document.createTextNode("."));

    const form = document.createElement("form");
    form.className = "form-acesso";
    form.noValidate = true;
    const campoSenha = criarCampoAcesso("nova-senha", "Nova senha (mínimo 8 caracteres)", "password");
    const campoConfirma = criarCampoAcesso("confirma-senha", "Confirmar senha", "password");
    const erro = criarErroAcesso();
    const btnSalvar = document.createElement("button");
    btnSalvar.type = "submit";
    btnSalvar.className = "btn-entrar-microsoft";
    btnSalvar.textContent = ehPrimeiroAcesso ? "Criar senha e entrar" : "Redefinir senha e entrar";
    form.append(campoSenha.wrap, campoConfirma.wrap, erro, btnSalvar);

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      erro.hidden = true;
      if (campoSenha.input.value.length < 8) {
        mostrarErroAcesso(erro, "A senha precisa ter pelo menos 8 caracteres.");
        return;
      }
      if (campoSenha.input.value !== campoConfirma.input.value) {
        mostrarErroAcesso(erro, "As senhas não conferem.");
        return;
      }
      btnSalvar.disabled = true;
      btnSalvar.textContent = "Salvando...";
      try {
        if (ehPrimeiroAcesso) {
          await window.BI.DB.concluirPrimeiroAcesso(email, token, campoSenha.input.value);
        } else {
          await window.BI.DB.concluirRedefinicaoSenha(email, token, campoSenha.input.value);
        }
        // Limpa o token da URL antes de recarregar - o link do e-mail so
        // deve funcionar uma vez, e nao queremos deixar o token visivel no
        // historico do navegador depois de usado.
        window.location.href = window.location.pathname;
      } catch (e) {
        mostrarErroAcesso(erro, (e && e.message) || "Falha ao salvar a senha.");
        btnSalvar.disabled = false;
        btnSalvar.textContent = ehPrimeiroAcesso ? "Criar senha e entrar" : "Redefinir senha e entrar";
      }
    });

    const btnVoltar = criarBotaoAcesso("btn-voltar-login-3", "Link inválido ou expirado? Voltar para o login", "btn-trocar-conta", () => {
      window.location.href = window.location.pathname;
    });

    conteudo.append(h2, p, form, btnVoltar);
  }

  // So chamado depois de window.BI.DB.iniciar() resolver - mostra a tela de
  // acesso (login, primeiro acesso/redefinicao de senha, ou aviso de acesso
  // ainda nao liberado) no lugar do app inteiro, conforme
  // window.BI.DB.estado.telaAcesso ("login" / "bloqueado" / null) e a
  // querystring da URL (link de convite/recuperacao clicado no e-mail). So
  // acontece na versao publicada (producao); no preview/mock (Cowork ou
  // index.html aberto direto) telaAcesso fica null e a querystring nunca
  // traz "token", entao esta funcao nao faz nada.
  function configurarTelaAcesso() {
    const tela = document.getElementById("tela-acesso");
    const shell = document.getElementById("app-shell");
    const conteudo = document.getElementById("tela-acesso-conteudo");
    if (!tela || !shell || !conteudo) return;

    // Link de e-mail (primeiro acesso / redefinicao de senha) tem
    // prioridade sobre qualquer outro estado - a pessoa pode estar clicando
    // o link sem nenhuma sessao (ou com uma sessao antiga de outra conta).
    const parametros = new URLSearchParams(window.location.search);
    const telaParam = parametros.get("tela");
    const emailParam = parametros.get("email");
    const tokenParam = parametros.get("token");
    if ((telaParam === "primeiro-acesso" || telaParam === "redefinir-senha") && emailParam && tokenParam) {
      shell.hidden = true;
      tela.hidden = false;
      conteudo.innerHTML = "";
      renderizarFormDefinirSenha(conteudo, { tipo: telaParam, email: emailParam, token: tokenParam });
      return;
    }

    const modo = window.BI.DB.estado.telaAcesso;
    if (!modo) {
      tela.hidden = true;
      shell.hidden = false;
      return;
    }

    shell.hidden = true;
    tela.hidden = false;
    conteudo.innerHTML = "";

    if (modo === "login") {
      renderizarFormLogin(conteudo);
      return;
    }

    // Sem internet (ex.: tablet em campo sem sinal). O app abre (PWA, ver
    // sw.js), mas os dados vêm da API - então avisa em vez de mostrar dados
    // de exemplo. Coleta offline de verdade é o passo 2 do app.
    if (modo === "offline") {
      const h2 = document.createElement("h2");
      h2.textContent = "Sem conexão com a internet";
      const p = document.createElement("p");
      p.textContent = "O S.I.G.E. precisa de internet para carregar e salvar os dados. Verifique o Wi-Fi ou os dados móveis e tente novamente.";
      const btnNovamente = criarBotaoAcesso("btn-tentar-novamente-conexao", "Tentar novamente", "btn-entrar-microsoft", () => window.location.reload());
      conteudo.append(h2, p, btnNovamente);
      window.addEventListener("online", () => window.location.reload(), { once: true });
      return;
    }

    if (modo === "bloqueado") {
      const identidade = window.BI.DB.estado.identidade;
      const email = (identidade && identidade.email) || "";
      const h2 = document.createElement("h2");
      h2.textContent = "Acesso ainda não liberado";
      const p = document.createElement("p");
      p.appendChild(document.createTextNode("Você entrou como "));
      const spanEmail = document.createElement("span");
      spanEmail.className = "tela-acesso-email";
      spanEmail.textContent = email;
      p.appendChild(spanEmail);
      p.appendChild(document.createTextNode(", mas ainda não foi vinculado a nenhuma empresa. Peça a um Administrador do S.I.G.E para liberar o seu acesso."));
      const btnNovamente = criarBotaoAcesso("btn-tentar-novamente-acesso", "Já fui liberado, tentar novamente", "btn-entrar-microsoft", () => window.location.reload());
      const btnTrocar = criarBotaoAcesso("btn-trocar-conta", "Trocar de conta", "btn-trocar-conta", () => window.BI.DB.sairDaConta());
      conteudo.append(h2, p, btnNovamente, btnTrocar);
    }
  }

  // So chamado depois de window.BI.DB.iniciar() resolver (e so entao
  // estado.identidade existe de verdade) - mostra o item de menu
  // "Usuarios" so pra quem e Administrador, e carrega a lista se for o
  // caso.
  function configurarUsuarios() {
    const identidade = window.BI.DB.estado.identidade;
    // Administrador e Consultor podem convidar gente nova (ver comentario
    // no topo desta secao); so Administrador ve Editar/Excluir por linha
    // (renderizarListaUsuarios/souAdministrador).
    const podeGerenciar = !!(identidade && (identidade.papel === "Administrador" || identidade.papel === "Consultor"));
    const btnNav = document.getElementById("nav-btn-usuarios");
    if (btnNav) btnNav.hidden = !podeGerenciar;
    if (!podeGerenciar) return;

    const btnNovo = document.getElementById("btn-novo-usuario");
    if (btnNovo && !btnNovo._ligado) {
      btnNovo._ligado = true;
      btnNovo.addEventListener("click", abrirFormNovoUsuario);
    }
    carregarUsuarios();
  }

  // V 1.2 - Configuracoes do sistema (so Administrador): nomes dos tipos de
  // acao do Plano de Acao. Ver js/acoes.js/montarTelaConfiguracoes.
  function configurarConfiguracoes() {
    const identidade = window.BI.DB.estado.identidade;
    const ehAdmin = !!(identidade && identidade.papel === "Administrador");
    const btnNav = document.getElementById("nav-btn-configuracoes");
    if (btnNav) btnNav.hidden = !ehAdmin;
    const raiz = document.getElementById("conteudo-configuracoes");
    if (!ehAdmin || !raiz || !window.BI.Acoes) return;
    const montar = () => window.BI.Acoes.montarTelaConfiguracoes(raiz, { aoSalvar: () => { try { renderizarTudo(); } catch (_) { /* tela ainda nao pronta */ } } });
    montar();
    if (btnNav && !btnNav._ligadoConfig) {
      btnNav._ligadoConfig = true;
      btnNav.addEventListener("click", montar); // sempre mostra os nomes atuais
    }
  }

  // Botao "Sair" do menu lateral - so aparece em producao (modoApi), depois
  // de confirmado que ha sessao de verdade (login por e-mail/senha, ver
  // js/db.js/sairDaConta). Antes disso o sistema so tinha "Trocar de
  // conta" na tela de bloqueio; agora que login e senha sao de verdade,
  // faz sentido ter um jeito explicito de encerrar a sessao no app inteiro.
  function configurarBotaoSair() {
    const btn = document.getElementById("btn-sair");
    if (!btn) return;
    const ativo = !!(window.BI.DB.estado.modoApi && window.BI.DB.estado.identidade);
    btn.hidden = !ativo;
    if (ativo && !btn._ligado) {
      btn._ligado = true;
      btn.addEventListener("click", () => window.BI.DB.sairDaConta());
    }
  }

  // ------------------------------------------------------------------
  // Banco de dados (js/db.js) - callback chamado a cada snapshot de uma
  // colecao (mapaRisco/planoAcao/absenteismo/compativeis)
  // ------------------------------------------------------------------
  function aoAtualizarColecaoDB(chave) {
    window.BI.dados[chave] = window.BI.DB.estado.colecoes[chave];
    atualizarOpcoesFiltros();
    renderizarTudo();
    if (chave === "planoAcao") {
      try { atualizarSinoNotificacoes(); } catch (e) { console.error("Sino de notificações (Plano de Ação) falhou:", e); }
    }
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  // Esconde a tela de carregamento (splash) - chamada no fim de iniciar(),
  // tanto no caminho de sucesso quanto no catch de erro, pra nunca deixar o
  // usuario preso nela. Ver comentario em index.html/.carregando-app no CSS.
  function esconderCarregamento() {
    const carregando = document.getElementById("carregando-app");
    if (carregando) carregando.hidden = true;
  }

  async function iniciar() {
    try {
      if (typeof Chart === "undefined") {
        throw new Error("A biblioteca Chart.js não carregou (script externo bloqueado ou indisponível).");
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
      if (spanData) spanData.textContent = formatarDataBR(dados._meta.gerado_em) + ` (referência de calculo: ${formatarDataBR(hojeMeiaNoite().toISOString().slice(0, 10))})`;

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
      if (window.BI.Indicadores) window.BI.Indicadores.instalarBotoesInfo();
      if (window.BI.Ajuda) window.BI.Ajuda.montar();
      const spanVersao = document.getElementById("versao-sistema");
      if (spanVersao && window.BI.VERSAO) spanVersao.textContent = "V " + window.BI.VERSAO;
      configurarExportacao();
      configurarBarraSuperior();
      configurarPainelFiltros();
      configurarSinoNotificacoes();
      renderizarTudo();

      const disponivel = await window.BI.DB.iniciar(aoAtualizarColecaoDB);
      atualizarBotoesSomenteLeitura();
      if (!disponivel) {
        console.warn("BI Ergonomia - capacidade 'db' indisponível nesta visualização; cadastros em modo somente leitura (dados fictícios de exemplo).");
      }
      // So depois do iniciar() acima e que window.BI.DB.estado.identidade/
      // telaAcesso existem de verdade (preenchidos so no modo API - ver
      // js/db.js) - decide aqui se mostra a tela de login/bloqueio (cobrindo
      // o app inteiro) e/ou o item de menu "Usuarios".
      configurarTelaAcesso();
      configurarUsuarios();
      configurarConfiguracoes();
      configurarBotaoSair();
      esconderCarregamento();
    } catch (erro) {
      console.error("BI Ergonomia - erro na inicialização:", erro);
      mostrarErro(erro && erro.message ? erro.message : String(erro));
      esconderCarregamento();
    }
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();
