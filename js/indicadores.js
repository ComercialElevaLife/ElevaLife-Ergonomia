/* ==========================================================================
   S.I.G.E. - ElevaLife
   DICIONARIO DE INDICADORES (V 1.0).

   Fonte unica de verdade sobre "o que cada indicador puxa". Usado em 2
   lugares: (1) o botao (i) ao lado do titulo de cada card dos dashboards
   (ver BI.Indicadores.instalarBotoesInfo) e (2) a pagina Ajuda > Indicadores.

   Cada item: id = id de um elemento DENTRO do card (canvas, tile, etc.);
   a (i) e' ligada ao card (.cartao) que contem esse id. Os textos sao de
   exibicao (com acento). Se mudar uma regra em js/calc.js, mude aqui junto.
   ========================================================================== */
(function (global) {
  "use strict";

  const BI = (global.BI = global.BI || {});
  BI.VERSAO = "1.10"; // versao do sistema - exibida no rodape e em Ajuda > Versao (ver docs/CHANGELOG.md)

  const FILTROS_GLOBAIS = "Cliente, Unidade, Setor, Posto, Cargo e Atividade";
  // Ano/Mes filtra pela data lancada no proprio registro; registro sem essa
  // data fica de fora quando Ano/Mes esta selecionado (V 1.1).
  const POR_DATA = (campo) => FILTROS_GLOBAIS + ". Ano/Mês filtra pela " + campo + " (registro sem essa data fica de fora quando Ano/Mês está selecionado).";
  const COM_ANO_MES = FILTROS_GLOBAIS + ". Ano/Mês também filtra (ver Cálculo).";

  const ABAS = {
    ergo: "Gestão de Risco",
    medocup: "Gestão de Absenteísmo",
    compativeis: "Gestão de Restritos",
  };

  const STATUS_ACAO =
    "O status é calculado no momento da consulta, com a data atual: sem Dt Programada e sem Dt Conclusão = Não iniciado; apenas com Dt Conclusão = Concluída; " +
    "sem conclusão e programada antes de hoje = Atrasada; sem conclusão e programada para hoje = Em andamento; sem conclusão e programada no futuro = Não iniciado; " +
    "com conclusão depois da programada = Concluída com atraso; senão Concluída.";

  const LISTA = [
    // ------------------------------------------------------------------
    // GESTAO DE RISCO - trilha do Mapa de Risco + Plano de Acao
    // ------------------------------------------------------------------
    {
      id: "tiles-risco-global", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Mapa de Risco Global",
      mostra: "Distribuição dos postos de trabalho por nível de risco global (Baixo, Moderado, Alto e Muito Alto).",
      fonte: "Registro › Mapa de Risco (1 linha = 1 posto/atividade avaliado).",
      calculo: "O Risco Global de cada posto corresponde à média das 12 notas (1 a 4) atribuídas no Mapa de Risco: Col. Cervical, Tronco, Ombros, Cotovelos, Punhos, Mãos/Dedos, Joelhos, Pernas, Tornozelos, Pés/Dedos, Psicossocial/Cognitivo e Ambiental. Média ≥ 2,70 = Muito Alto; ≥ 2,15 = Alto; ≥ 1,55 = Moderado; abaixo = Baixo. O card contabiliza os postos por nível; o percentual é a quantidade dividida pelo total de postos filtrados.",
      filtros: POR_DATA("data da avaliação do Mapa de Risco"),
      cuidado: "A metodologia difere da do Inventário de Riscos, que utiliza a matriz de risco do cliente. Os dois indicadores não devem ser comparados diretamente, pois medem universos distintos (postos e fatores). Ao selecionar o número, o sistema lista os postos.",
    },
    {
      id: "chart-top-setores", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Top 3 Setores críticos",
      mostra: "Os três setores com maior número de postos em risco Alto ou Muito Alto.",
      fonte: "Registro › Mapa de Risco.",
      calculo: "Por setor: postos críticos (Alto e Muito Alto) ÷ total de postos do setor. A barra apresenta esse percentual; a ordenação dos três setores considera a quantidade de postos críticos, com desempate pelo percentual.",
      filtros: POR_DATA("data da avaliação do Mapa de Risco"),
      cuidado: "Um setor com 1 posto (100% crítico) pode aparecer abaixo de um setor com 5 postos críticos em 10 (50%), pois a ordenação é por quantidade e a barra, em percentual.",
    },
    {
      id: "chart-plano-global", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Plano de Ação - Global",
      mostra: "Distribuição de todas as ações do Plano de Ação por status.",
      fonte: "Registro › Plano de Ação.",
      calculo: STATUS_ACAO + " Com filtro de Ano/Mês, a ação é considerada se a Dt Programada ou a Dt Conclusão estiver no período.",
      filtros: COM_ANO_MES,
      cuidado: "Pela regra vigente, o status \"Em andamento\" ocorre apenas na data exata do prazo: ação com prazo futuro permanece \"Não iniciado\" e, vencido o prazo sem conclusão, passa a \"Atrasada\".",
    },
    {
      id: "chart-plano-criticos", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Plano de Ação - Postos Críticos",
      mostra: "Status das ações, conforme o card Global, restrito aos postos de risco Alto ou Muito Alto.",
      fonte: "Registro › Plano de Ação (campo Risco Global gravado na própria ação).",
      calculo: "Seleciona as ações cujo Risco Global é Alto ou Muito Alto e calcula o status pela mesma regra do card Global.",
      filtros: COM_ANO_MES,
      cuidado: "O Risco Global é copiado do posto no momento do lançamento da ação. Se o posto for reavaliado posteriormente, a ação mantém o valor original.",
    },
    {
      id: "chart-acoes-previstas", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Ações previstas no período",
      mostra: "Quantidade de ações programadas por mês.",
      fonte: "Registro › Plano de Ação (campo Dt Programada).",
      calculo: "Contabiliza as ações por mês da Dt Programada (concluídas ou não), em eixo contínuo do primeiro ao último mês (meses sem ação = 0). O filtro Ano/Mês considera a Dt Programada.",
      filtros: COM_ANO_MES,
      cuidado: "Ações sem Dt Programada não são exibidas neste gráfico.",
    },
    {
      id: "chart-acoes-concluidas", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Ações concluídas no período",
      mostra: "Quantidade de ações concluídas por mês.",
      fonte: "Registro › Plano de Ação (campo Dt Conclusão).",
      calculo: "Contabiliza as ações com Dt Conclusão, por mês dessa data. O filtro Ano/Mês considera a Dt Conclusão.",
      filtros: COM_ANO_MES,
      cuidado: "Inclui as ações concluídas no prazo e com atraso.",
    },
    {
      id: "chart-por-responsavel", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Plano de Ação por Responsável",
      mostra: "Volume e situação das ações por responsável.",
      fonte: "Registro › Plano de Ação (campo Responsável Ação).",
      calculo: "Barras empilhadas por status (mesma regra do card Global), ordenadas pelo total de ações do responsável. Ações sem responsável são agrupadas em \"Sem responsavel\".",
      filtros: COM_ANO_MES,
      cuidado: "Corresponde à base dos avisos por e-mail: cada responsável recebe lembretes das ações sob sua responsabilidade.",
    },
    {
      id: "chart-status-por-setor", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Status do Plano de Ação por Setor",
      mostra: "Situação das ações por setor.",
      fonte: "Registro › Plano de Ação.",
      calculo: "Barras empilhadas por status (mesma regra do card Global), uma barra por setor.",
      filtros: COM_ANO_MES,
      cuidado: "",
    },
    {
      id: "chart-risco-por-setor", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Mapa de Risco por Setor",
      mostra: "Quantidade de postos por nível de risco, detalhada por setor.",
      fonte: "Registro › Mapa de Risco.",
      calculo: "Mesmo Risco Global do card \"Mapa de Risco Global\", desdobrado por setor.",
      filtros: POR_DATA("data da avaliação do Mapa de Risco"),
      cuidado: "A soma das barras equivale ao total de postos do card Mapa de Risco Global.",
    },

    // ------------------------------------------------------------------
    // GESTAO DE RISCO - trilha AEP
    // ------------------------------------------------------------------
    {
      id: "tiles-fatorrisco-graduacao", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Inventário de Riscos - Graduação do Risco",
      mostra: "Distribuição dos fatores de risco (ISO/TS 20646) por nível de graduação.",
      fonte: "Registro › Inventário de Riscos (AEP): 1 linha = 1 fator marcado \"Existe fator de risco: Sim\" em um posto.",
      calculo: "A graduação decorre da matriz de risco configurada no cliente (Probabilidade × Gravidade; 3x3, 4x4 ou 5x5). Para adequação aos quatro níveis do painel: Muito Baixo e Baixo = Baixo; Moderado = Moderado; Alto = Alto; Altíssimo = Muito Alto. Fatores marcados \"Não\" não entram.",
      filtros: POR_DATA("data da identificação do fator"),
      cuidado: "Em clientes com matriz 5x5, os níveis são agrupados em quatro neste painel. O nível exato de cada fator permanece na tabela do Inventário.",
    },
    {
      id: "tiles-avaliacao-cobertura", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Avaliação Ergonômica - Cobertura",
      mostra: "Proporção de postos do Mapa de Risco que já possuem Avaliação Ergonômica (AEP).",
      fonte: "Registro › Avaliação Ergonômica (AEP) comparada com Registro › Mapa de Risco.",
      calculo: "Avaliações registradas: total de avaliações filtradas. Postos cobertos: postos do Mapa de Risco (chave Cliente + Unidade + Setor + Posto + Cargo + Atividade) com ao menos uma avaliação. Cobertura: postos cobertos ÷ postos do Mapa de Risco.",
      filtros: POR_DATA("data da avaliação (Avaliação Ergonômica e Mapa de Risco)"),
      cuidado: "A avaliação de um posto ausente do Mapa de Risco compõe \"registradas\", mas não \"cobertos\". Sem postos no Mapa de Risco, a cobertura é exibida como 0%.",
    },
    {
      id: "chart-fatorrisco-status", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Inventário de Riscos - Status",
      mostra: "Etapa de tratativa dos fatores de risco (A validar, Em andamento, Concluído e Cancelado).",
      fonte: "Registro › Inventário de Riscos (AEP), campo Status.",
      calculo: "Contagem de fatores marcados como existentes (\"Sim\") por status; percentual sobre o total de fatores filtrados.",
      filtros: POR_DATA("data da identificação do fator"),
      cuidado: "Todo fator novo é criado com o status \"A validar\".",
    },
    {
      id: "tiles-fatorrisco-prazos", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Inventário de Riscos - Prazos",
      mostra: "Situação do prazo de validade (\"Válido Até\") dos fatores de risco em aberto.",
      fonte: "Registro › Inventário de Riscos (AEP), campo Válido Até.",
      calculo: "Consideram-se apenas fatores em aberto (A validar ou Em andamento). Vencido: Válido Até anterior à data atual; Vencendo: vencimento em até 30 dias; Em dia: vencimento em mais de 30 dias.",
      filtros: POR_DATA("data da identificação do fator"),
      cuidado: "Fatores sem Válido Até, Concluídos ou Cancelados não compõem estes três valores.",
    },
    {
      id: "chart-fatorrisco-top-setores", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Top Setores - Riscos em Aberto",
      mostra: "Os cinco setores com maior número de fatores de risco em aberto.",
      fonte: "Registro › Inventário de Riscos (AEP).",
      calculo: "Por setor: fatores com status A validar ou Em andamento ÷ total de fatores do setor. A barra apresenta o percentual; a ordenação considera a quantidade de fatores em aberto.",
      filtros: POR_DATA("data da identificação do fator"),
      cuidado: "Mesma lógica do Top 3 Setores críticos: ordenação por quantidade e barra em percentual.",
    },
    {
      id: "chart-laudos-tipo", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Laudos e Certificados - Por Tipo",
      mostra: "Quantidade de laudos e certificados de calibração emitidos.",
      fonte: "Registro › Laudos (campo Tipo).",
      calculo: "Contagem de registros de Laudos por Tipo (Laudo ou Certificado de Calibração).",
      filtros: POR_DATA("data de emissão do laudo"),
      cuidado: "Contabiliza o registro emitido, e não o número de páginas ou de arquivos.",
    },
    {
      id: "tiles-aet-classificacao", aba: "ergo", grupo: "AET - Análise Ergonômica do Trabalho", titulo: "AET - Arquivos Anexados por Classificação",
      mostra: "Quantidade de arquivos de AET (Excel/PDF) anexados, por tipo de conteúdo.",
      fonte: "Registro › AET (campo Arquivos AET).",
      calculo: "Contabiliza arquivos (um registro pode conter vários). Prevalece a classificação confirmada pelo ergonomista; na ausência de confirmação, utiliza-se a classificação automática, obtida da leitura do arquivo. Classificações sem arquivos não são exibidas.",
      filtros: POR_DATA("data da análise"),
      cuidado: "O valor corresponde a arquivos, e não a postos ou a análises.",
    },

    // ------------------------------------------------------------------
    // GESTAO DE ABSENTEISMO
    // ------------------------------------------------------------------
    {
      id: "tiles-totais-medocup", aba: "medocup", grupo: "Absenteísmo", titulo: "Totais do período filtrado",
      mostra: "Número de colaboradores, dias perdidos e Taxa de Frequência do período.",
      fonte: "Registro › Absenteísmo e Registro › HHT / Dias Úteis.",
      calculo: "Qtd Dias Perdidos: soma de \"Qtd Dias\" dos afastamentos. Taxa de Frequência: nº de afastamentos ÷ HHT × 1.000.000, sendo HHT a soma de (Colaboradores × Dias Úteis × 8 h) de cada linha de HHT / Dias Úteis (NBR 14280). Qtd Colaboradores: média da coluna Colaboradores das linhas de HHT / Dias Úteis do filtro.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês (afastamento pela Dt Afastamento; HHT pelo Ano/Mês Úteis).",
      cuidado: "Sem linhas de HHT / Dias Úteis lançadas, a Taxa de Frequência é 0. A Qtd Colaboradores é a média das linhas (setor × mês), e não a soma dos setores.",
    },
    {
      id: "chart-evolucao-taxa", aba: "medocup", grupo: "Absenteísmo", titulo: "Evolução da Taxa de Frequência",
      mostra: "Evolução mensal da Taxa de Frequência; atestados e dias perdidos são exibidos no detalhe do gráfico (ao passar o cursor).",
      fonte: "Registro › Absenteísmo e Registro › HHT / Dias Úteis.",
      calculo: "Mesma fórmula do card Totais, calculada para cada mês (afastamentos do mês ÷ HHT do mês × 1.000.000).",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "Mês com afastamento e sem HHT lançado é exibido com taxa 0.",
    },
    {
      id: "chart-taxa-por-setor", aba: "medocup", grupo: "Absenteísmo", titulo: "Taxa de Frequência por Setor",
      mostra: "Casos de afastamento por milhão de horas trabalhadas, por setor.",
      fonte: "Registro › Absenteísmo e Registro › HHT / Dias Úteis.",
      calculo: "Mesma fórmula do card Totais, por setor. Os setores listados são os que têm linha em HHT / Dias Úteis.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "Setor com afastamentos e sem HHT lançado não é exibido.",
    },
    {
      id: "diagrama-medocup-frente", aba: "medocup", grupo: "Absenteísmo", titulo: "Dias perdidos por região (frente)",
      mostra: "Dias perdidos por região do corpo, vista frontal.",
      fonte: "Registro › Absenteísmo (Região Corporal e Qtd Dias).",
      calculo: "Soma de \"Qtd Dias\" por Região Corporal. Na vista frontal, o lado direito da pessoa corresponde ao lado esquerdo da imagem.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "",
    },
    {
      id: "diagrama-medocup-costas", aba: "medocup", grupo: "Absenteísmo", titulo: "Dias perdidos por região (costas)",
      mostra: "Dias perdidos por região do corpo, vista posterior.",
      fonte: "Registro › Absenteísmo (Região Corporal e Qtd Dias).",
      calculo: "Soma de \"Qtd Dias\" por Região Corporal. Na vista posterior, o lado direito da pessoa corresponde ao lado direito da imagem.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "",
    },

    // ------------------------------------------------------------------
    // GESTAO DE RESTRITOS
    // ------------------------------------------------------------------
    {
      id: "chart-compat-genero", aba: "compativeis", grupo: "Restritos", titulo: "Gênero",
      mostra: "Distribuição por gênero dos colaboradores com restrição médica registrada.",
      fonte: "Registro › Restritos (Compatíveis).",
      calculo: "Contagem de registros por gênero.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página: Status Restrição e Turno de Trabalho.",
      cuidado: "Contabiliza registros de restrição: um colaborador com duas restrições é contado duas vezes.",
    },
    {
      id: "chart-compat-idade", aba: "compativeis", grupo: "Restritos", titulo: "Idade",
      mostra: "Distribuição por faixa etária.",
      fonte: "Registro › Restritos (Compatíveis) (campo Idade).",
      calculo: "Contagem de registros nas faixas: até 24, 25-34, 35-44, 45-54 e 55+.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "Registros sem idade não são alocados em nenhuma faixa.",
    },
    {
      id: "chart-compat-atividade", aba: "compativeis", grupo: "Restritos", titulo: "Em Atividade Compatível",
      mostra: "Quantidade de colaboradores recolocados em atividade compatível, em comparação com os não recolocados.",
      fonte: "Registro › Restritos (Compatíveis) (campo Atividade Compatível).",
      calculo: "Contagem de registros por valor de Atividade Compatível (Sim/Não).",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "chart-compat-status-setor", aba: "compativeis", grupo: "Restritos", titulo: "Status por Setor",
      mostra: "Situação das restrições por setor.",
      fonte: "Registro › Restritos (Compatíveis) (Status Restrição: Ativa, Em Avaliação, Encerrada).",
      calculo: "Barras empilhadas: contagem de registros por status, por setor.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "chart-compat-restricao-turno", aba: "compativeis", grupo: "Restritos", titulo: "Restrição por Turno",
      mostra: "Situação das restrições por turno de trabalho.",
      fonte: "Registro › Restritos (Compatíveis) (Turno Trabalho).",
      calculo: "Barras empilhadas: contagem de registros por status, por turno.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "chart-compat-compativel-setor", aba: "compativeis", grupo: "Restritos", titulo: "Compatível por Setor",
      mostra: "Quantidade de colaboradores em atividade compatível, por setor.",
      fonte: "Registro › Restritos (Compatíveis).",
      calculo: "Contagem de registros com Atividade Compatível = Sim, por setor.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "diagrama-compat-frente", aba: "compativeis", grupo: "Restritos", titulo: "Restrições por região (frente)",
      mostra: "Quantidade de restrições por região do corpo, vista frontal.",
      fonte: "Registro › Restritos (Compatíveis) (Segmento Corporal).",
      calculo: "Contagem de restrições por Segmento Corporal. Na vista frontal, o lado direito da pessoa corresponde ao lado esquerdo da imagem.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "diagrama-compat-costas", aba: "compativeis", grupo: "Restritos", titulo: "Restrições por região (costas)",
      mostra: "Quantidade de restrições por região do corpo, vista posterior.",
      fonte: "Registro › Restritos (Compatíveis) (Segmento Corporal).",
      calculo: "Contagem de restrições por Segmento Corporal. Na vista posterior, o lado direito da pessoa corresponde ao lado direito da imagem.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
  ];

  // ------------------------------------------------------------------
  // Botao (i) ao lado do titulo de cada card + popover com o dicionario.
  // ------------------------------------------------------------------
  let popover = null;

  function fecharPopover() {
    if (popover) { popover.remove(); popover = null; }
  }

  function linha(rotulo, texto) {
    if (!texto) return null;
    const p = document.createElement("p");
    const b = document.createElement("strong");
    b.textContent = rotulo + " ";
    p.appendChild(b);
    p.appendChild(document.createTextNode(texto));
    return p;
  }

  function abrirPopover(botao, item) {
    fecharPopover();
    popover = document.createElement("div");
    popover.className = "info-popover";
    popover.setAttribute("role", "dialog");
    const h = document.createElement("div");
    h.className = "info-popover-titulo";
    h.textContent = item.titulo;
    popover.appendChild(h);
    [["O que mostra:", item.mostra], ["De onde vem:", item.fonte], ["Como é calculado:", item.calculo],
      ["Filtros:", item.filtros], ["Atenção:", item.cuidado]].forEach(([r, t]) => {
      const el = linha(r, t);
      if (el) popover.appendChild(el);
    });
    document.body.appendChild(popover);
    const rect = botao.getBoundingClientRect();
    const largura = Math.min(380, window.innerWidth - 24);
    popover.style.width = largura + "px";
    let esquerda = rect.left + window.scrollX;
    if (esquerda + largura > window.scrollX + window.innerWidth - 12) esquerda = window.scrollX + window.innerWidth - largura - 12;
    popover.style.left = Math.max(12, esquerda) + "px";
    popover.style.top = (rect.bottom + window.scrollY + 6) + "px";
  }

  function criarBotao(item) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-info";
    b.setAttribute("aria-label", "Como este indicador é calculado: " + item.titulo);
    b.title = "Como este indicador é calculado";
    b.textContent = "i";
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (popover && popover.dataset.id === item.id) { fecharPopover(); return; }
      abrirPopover(b, item);
      if (popover) popover.dataset.id = item.id;
    });
    return b;
  }

  function instalarBotoesInfo() {
    LISTA.forEach((item) => {
      const alvo = document.getElementById(item.id);
      const cartao = alvo && alvo.closest(".cartao");
      const titulo = cartao && cartao.querySelector(".cartao-titulo");
      if (!titulo || titulo.querySelector(".btn-info")) return;
      titulo.appendChild(criarBotao(item));
    });
    document.addEventListener("click", (ev) => {
      if (popover && !popover.contains(ev.target)) fecharPopover();
    });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") fecharPopover(); });
  }

  BI.Indicadores = { LISTA, ABAS, instalarBotoesInfo, fecharPopover };
})(window);
