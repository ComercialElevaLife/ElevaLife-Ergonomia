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
  BI.VERSAO = "1.38"; // versao do sistema - exibida no rodape e em Ajuda > Versao (ver docs/CHANGELOG.md)

  const FILTROS_GLOBAIS = "Cliente, Unidade, Setor / GHE, Posto, Cargo, Atividade e Origem (AEP, AET ou Psicossocial, quando o registro tem origem)";
  // Ano/Mes filtra pela data lancada no proprio registro; registro sem essa
  // data fica de fora quando Ano/Mes esta selecionado (V 1.1).
  const POR_DATA = (campo) => FILTROS_GLOBAIS + ". Ano/Mês filtra pela " + campo + " (registro sem essa data fica de fora quando Ano/Mês está selecionado).";
  const COM_ANO_MES = FILTROS_GLOBAIS + ". Ano/Mês também filtra (ver Cálculo). Na Gestão do Plano de Ação, depois do filtro geral vale o filtro de origem do topo da aba.";

  const ABAS = {
    ergo: "Gestão de Riscos",
    registro: "Gestão do Plano de Ação",
    medocup: "Gestão de Absenteísmo",
    compativeis: "Gestão de Restritos",
  };

  const STATUS_ACAO =
    "O status é calculado no momento da consulta, com a data atual: sem prazo (Dt Programada) e sem conclusão = Não iniciado; com prazo, sem conclusão e prazo não vencido = Em andamento; " +
    "sem conclusão e prazo antes de hoje = Atrasada; com conclusão depois do prazo = Concluída com atraso; senão Concluída.";

  const LISTA = [
    // ------------------------------------------------------------------
    // GESTAO DE RISCO - risco dos postos (Inventario) + Plano de Acao
    // ------------------------------------------------------------------
    {
      id: "chart-risco-global", aba: "ergo", grupo: "Risco dos postos (AEP, AET e Psicossocial)", titulo: "Risco Global dos Postos",
      mostra: "Rosca com a distribuição dos postos de trabalho por nível de risco global (Baixo, Moderado, Alto e Muito Alto); no centro, o total de postos.",
      fonte: "AEP › Inventário de Riscos (fatores da AEP, da AET e do Psicossocial). 1 posto = Cliente + Unidade + Setor + Posto + Cargo + Origem; no Psicossocial, o setor/GHE.",
      calculo: "O risco de cada posto é a MAIOR graduação entre os seus fatores de risco existentes (ex.: um fator Baixo e outro Alto = posto Alto). Os níveis das matrizes são agrupados nos quatro do painel (Muito Baixo = Baixo; Moderado; Alto; Altíssimo = Muito Alto). Clique em uma fatia para ver os postos.",
      filtros: POR_DATA("data da AEP do posto (ou da identificação do fator)") + " Depois do filtro geral, vale o filtro de origem do topo da aba (Todas, AEP, AET ou Psicossocial).",
      cuidado: "Fatores marcados \"Não\" ou sem graduação não entram. O antigo Mapa de Risco (12 notas por posto) não é mais usado nos indicadores.",
    },
    {
      id: "chart-top-setores", aba: "ergo", grupo: "Risco dos postos (AEP, AET e Psicossocial)", titulo: "Top 3 Setores críticos",
      mostra: "Os três setores com maior número de postos em risco Alto ou Muito Alto.",
      fonte: "Risco dos postos (maior graduação dos fatores do Inventário).",
      calculo: "Por setor: postos críticos (Alto e Muito Alto) ÷ total de postos do setor. A barra apresenta esse percentual; a ordenação dos três setores considera a quantidade de postos críticos, com desempate pelo percentual.",
      filtros: POR_DATA("data da AEP do posto"),
      cuidado: "Um setor com 1 posto (100% crítico) pode aparecer abaixo de um setor com 5 postos críticos em 10 (50%), pois a ordenação é por quantidade e a barra, em percentual.",
    },
    {
      id: "chart-risco-por-setor", aba: "ergo", grupo: "Risco dos postos (AEP, AET e Psicossocial)", titulo: "Risco dos Postos por Setor / GHE",
      mostra: "Quantidade de postos por nível de risco, detalhada por setor.",
      fonte: "Risco dos postos (maior graduação dos fatores do Inventário).",
      calculo: "Mesmo risco do card \"Risco Global dos Postos\", desdobrado por setor/GHE.",
      filtros: POR_DATA("data da AEP do posto"),
      cuidado: "A soma das barras equivale ao total de postos do card Risco Global dos Postos.",
    },

    // ------------------------------------------------------------------
    // GESTAO DE RISCO - trilha AEP
    // ------------------------------------------------------------------
    {
      id: "chart-fatorrisco-graduacao", aba: "ergo", grupo: "Inventário de Riscos (AEP, AET e Psicossocial)", titulo: "Inventário de Riscos - Graduação",
      mostra: "Rosca com os fatores de risco encontrados nas avaliações (ISO/TS 20646, AET e HSE-IT) por graduação atual; no centro, o total de fatores. Ao lado, a tabela com todos os fatores (origem, local, fator, segmento, risco atual e evolução), com busca.",
      fonte: "AEP › Inventário de Riscos (AEP): 1 linha = 1 fator marcado \"Existe fator de risco: Sim\" em um posto. Os Riscos Psicossociais entram com 1 linha por fator do HSE-IT em cada setor/GHE (grupo \"Fatores psicossociais (HSE-IT)\"), cada uma contando 1.",
      calculo: "A graduação decorre da matriz de risco configurada no cliente (Probabilidade × Severidade; 3x3, 4x4 ou 5x5). Vale a graduação mais atual (após as reavaliações); fatores com risco eliminado não entram. Para adequação aos quatro níveis do painel: Muito Baixo e Baixo = Baixo; Moderado = Moderado; Alto = Alto; Altíssimo = Muito Alto. Fatores marcados \"Não\" não entram.",
      filtros: POR_DATA("data da identificação do fator"),
      cuidado: "Em clientes com matriz 5x5, os níveis são agrupados em quatro neste painel. O nível exato de cada fator permanece na tabela do Inventário.",
    },
    {
      id: "chart-evolucao-riscos", aba: "ergo", grupo: "Inventário de Riscos (AEP, AET e Psicossocial)", titulo: "Evolução mensal dos riscos",
      mostra: "Mês a mês, quantos fatores de risco existiam em cada graduação, quantos foram eliminados (acumulado) e quantos foram reduzidos no mês.",
      fonte: "AEP › Inventário de Riscos (AEP, Psicossocial e AET): graduação inicial, data de identificação e histórico do risco de cada fator (reavaliações ao concluir ações redutoras no Plano de Ação, alterações no checklist e reaplicações do psicossocial).",
      calculo: "Para cada mês dos últimos 24, a graduação de cada fator é a vigente no último dia do mês (graduação inicial + eventos do histórico até a data). Barras empilhadas: fatores ativos por graduação, com o total do mês em cima da barra. Linha Eliminados: total acumulado de fatores com risco eliminado. Linha Reduzidos: fatores abaixo da graduação inicial. Clique num mês para ver o que compõe cada parte: os fatores de cada graduação, os reduzidos (de qual graduação para qual) e os eliminados.",
      filtros: "Filtros globais (Cliente, Unidade, Setor / GHE, Cargo, Posto e Origem) e, depois deles, o filtro de origem do topo da aba. O período é sempre os últimos 24 meses.",
      cuidado: "Fatores cadastrados antes da V 1.31 não têm histórico: aparecem com a graduação atual desde a data de identificação.",
    },
    {
      id: "tiles-avaliacao-cobertura", aba: "ergo", grupo: "Avaliações realizadas (AEP e AET)", titulo: "Avaliação Ergonômica - Cobertura",
      mostra: "Proporção dos postos/cargos cadastrados que já possuem Avaliação Ergonômica (AEP).",
      fonte: "AEP › Avaliações (AEP) comparada com Cadastro Empresa › Cargo (cada cargo de cada posto).",
      calculo: "Avaliações registradas: total de AEPs filtradas. Postos cobertos: combinações Cliente + Unidade + Setor + Posto + Cargo cadastradas que têm AEP. Cobertura: postos cobertos ÷ postos/cargos cadastrados.",
      filtros: POR_DATA("data da avaliação"),
      cuidado: "A AEP é por posto e cargo (sem atividade). Uma AEP de posto/cargo que não está no cadastro conta em \"registradas\", mas não em \"cobertos\".",
    },
    {
      id: "chart-aep-mensal", aba: "ergo", grupo: "Avaliações realizadas (AEP e AET)", titulo: "AEPs realizadas mês a mês",
      mostra: "Quantidade de Avaliações Ergonômicas Preliminares realizadas em cada mês.",
      fonte: "AEP › Avaliações (AEP), campo Data da avaliação.",
      calculo: "Contagem de AEPs por mês da data da avaliação, do primeiro ao último mês com avaliação. Clique num ponto para ver as AEPs do mês.",
      filtros: POR_DATA("data da avaliação"),
      cuidado: "Cada AEP conta uma vez (posto e cargo); a atualização de uma AEP existente não conta como nova avaliação.",
    },
    {
      id: "chart-aet-mensal", aba: "ergo", grupo: "Avaliações realizadas (AEP e AET)", titulo: "AETs realizadas mês a mês",
      mostra: "Quantidade de Análises Ergonômicas do Trabalho realizadas em cada mês.",
      fonte: "AET (AETs do sistema e anexadas, campo Data da Análise).",
      calculo: "Contagem de AETs por mês da data da análise. Clique num ponto para ver as AETs do mês.",
      filtros: POR_DATA("data da análise"),
      cuidado: "Conta as AETs feitas no sistema (aba AET) e as anexadas (arquivos de análises feitas fora do sistema), pela data da análise.",
    },

    // ------------------------------------------------------------------
    // GESTAO DE ABSENTEISMO
    // ------------------------------------------------------------------
    {
      id: "chart-plano-global", aba: "registro", grupo: "Plano de Ação (AEP, AET e Psicossocial)", titulo: "Plano de Ação - Todas as ações",
      mostra: "Todas as ações existentes no Plano de Ação, por status.",
      fonte: "Plano de Ação.",
      calculo: STATUS_ACAO + " Com filtro de Ano/Mês, a ação é considerada se a Dt Programada ou a Dt Conclusão estiver no período.",
      filtros: COM_ANO_MES,
      cuidado: "Inclui as ações de todas as origens (AEP, AET e Psicossocial). Responde ao filtro geral, ao filtro de origem do topo da aba e aos filtros da lista (Unidade, Setor / GHE, Status e Buscar). Cada ação conta como 1.",
    },
    {
      id: "chart-plano-criticos", aba: "registro", grupo: "Plano de Ação (AEP, AET e Psicossocial)", titulo: "Plano de Ação - Postos Críticos",
      mostra: "Status das ações, conforme o card Todas as ações, restrito aos postos de risco Alto ou Muito Alto (mesmos filtros).",
      fonte: "Plano de Ação, cruzado com o risco atual do posto (maior graduação dos fatores).",
      calculo: "Seleciona as ações de postos com risco atual Alto ou Muito Alto e calcula o status pela mesma regra do card Global.",
      filtros: COM_ANO_MES,
      cuidado: "O risco considerado é o atual do posto: se o posto for reavaliado no Inventário, a ação entra ou sai deste card. Ações de posto sem fator graduado usam o risco gravado na própria ação.",
    },
    {
      id: "chart-acoes-previstas", aba: "registro", grupo: "Plano de Ação (AEP, AET e Psicossocial)", titulo: "Ações previstas no período",
      mostra: "Quantidade de ações programadas por mês.",
      fonte: "Plano de Ação (campo Dt Programada).",
      calculo: "Contabiliza as ações por mês da Dt Programada (concluídas ou não), em eixo contínuo do primeiro ao último mês (meses sem ação = 0). O filtro Ano/Mês considera a Dt Programada.",
      filtros: COM_ANO_MES,
      cuidado: "Ações sem Dt Programada não são exibidas neste gráfico.",
    },
    {
      id: "chart-acoes-concluidas", aba: "registro", grupo: "Plano de Ação (AEP, AET e Psicossocial)", titulo: "Ações concluídas no período",
      mostra: "Quantidade de ações concluídas por mês.",
      fonte: "Plano de Ação (campo Dt Conclusão).",
      calculo: "Contabiliza as ações com Dt Conclusão, por mês dessa data. O filtro Ano/Mês considera a Dt Conclusão.",
      filtros: COM_ANO_MES,
      cuidado: "Inclui as ações concluídas no prazo e com atraso.",
    },
    {
      id: "chart-por-responsavel", aba: "registro", grupo: "Plano de Ação (AEP, AET e Psicossocial)", titulo: "Plano de Ação por Responsável",
      mostra: "Volume e situação das ações por responsável.",
      fonte: "Plano de Ação (campo Responsável Ação).",
      calculo: "Barras empilhadas por status (mesma regra do card Global), ordenadas pelo total de ações do responsável. Ações sem responsável são agrupadas em \"Sem responsavel\".",
      filtros: COM_ANO_MES,
      cuidado: "Corresponde à base dos avisos por e-mail: cada responsável recebe lembretes das ações sob sua responsabilidade.",
    },
    {
      id: "chart-status-por-setor", aba: "registro", grupo: "Plano de Ação (AEP, AET e Psicossocial)", titulo: "Status do Plano de Ação por Setor",
      mostra: "Situação das ações por setor.",
      fonte: "Plano de Ação.",
      calculo: "Barras empilhadas por status (mesma regra do card Global), uma barra por setor.",
      filtros: COM_ANO_MES,
      cuidado: "",
    },
    {
      id: "tiles-totais-medocup", aba: "medocup", grupo: "Absenteísmo", titulo: "Totais do período filtrado",
      mostra: "Número de colaboradores, dias perdidos e Taxa de Frequência do período.",
      fonte: "Cadastro Cliente › Absenteísmo e Cadastro Cliente › HHT / Taxa de frequência.",
      calculo: "Qtd Dias Perdidos: soma de \"Qtd Dias\" dos afastamentos. Taxa de Frequência: nº de afastamentos ÷ HHT × 1.000.000, sendo HHT a soma de (Colaboradores × Dias Úteis × 8 h) de cada linha de HHT / Dias Úteis (NBR 14280). Qtd Colaboradores: média da coluna Colaboradores das linhas de HHT / Dias Úteis do filtro.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês (afastamento pela Dt Afastamento; HHT pelo Ano/Mês Úteis).",
      cuidado: "Sem linhas de HHT / Dias Úteis lançadas, a Taxa de Frequência é 0. A Qtd Colaboradores é a média das linhas (setor × mês), e não a soma dos setores.",
    },
    {
      id: "chart-evolucao-taxa", aba: "medocup", grupo: "Absenteísmo", titulo: "Evolução da Taxa de Frequência",
      mostra: "Evolução mensal da Taxa de Frequência; atestados e dias perdidos são exibidos no detalhe do gráfico (ao passar o cursor).",
      fonte: "Cadastro Cliente › Absenteísmo e Cadastro Cliente › HHT / Taxa de frequência.",
      calculo: "Mesma fórmula do card Totais, calculada para cada mês (afastamentos do mês ÷ HHT do mês × 1.000.000).",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "Mês com afastamento e sem HHT lançado é exibido com taxa 0.",
    },
    {
      id: "chart-taxa-por-setor", aba: "medocup", grupo: "Absenteísmo", titulo: "Taxa de Frequência por Setor",
      mostra: "Casos de afastamento por milhão de horas trabalhadas, por setor.",
      fonte: "Cadastro Cliente › Absenteísmo e Cadastro Cliente › HHT / Taxa de frequência.",
      calculo: "Mesma fórmula do card Totais, por setor. Os setores listados são os que têm linha em HHT / Dias Úteis.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "Setor com afastamentos e sem HHT lançado não é exibido.",
    },
    {
      id: "diagrama-medocup-frente", aba: "medocup", grupo: "Absenteísmo", titulo: "Dias perdidos por segmento (frente)",
      mostra: "Dias perdidos por região do corpo, vista frontal.",
      fonte: "Cadastro Cliente › Absenteísmo (Segmento corporal e Qtd Dias).",
      calculo: "Soma de \"Qtd Dias\" por segmento corporal geral (sem direito/esquerdo; registros antigos com lado entram no segmento geral). Cada segmento aparece uma vez na imagem. \"Psicossocial\" (ícone de cérebro) e \"Não identificado\" aparecem em cartões ao lado da figura.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "",
    },
    {
      id: "diagrama-medocup-costas", aba: "medocup", grupo: "Absenteísmo", titulo: "Dias perdidos por segmento (costas)",
      mostra: "Dias perdidos por região do corpo, vista posterior.",
      fonte: "Cadastro Cliente › Absenteísmo (Segmento corporal e Qtd Dias).",
      calculo: "Soma de \"Qtd Dias\" por segmento corporal geral (sem direito/esquerdo; registros antigos com lado entram no segmento geral). Cada segmento aparece uma vez na imagem.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "",
    },

    // ------------------------------------------------------------------
    // GESTAO DE RESTRITOS
    // ------------------------------------------------------------------
    {
      id: "chart-compat-genero", aba: "compativeis", grupo: "Restritos", titulo: "Gênero",
      mostra: "Distribuição por gênero dos colaboradores com restrição médica registrada.",
      fonte: "Cadastro Cliente › Restritos.",
      calculo: "Contagem de registros por gênero.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página: Status Restrição e Turno de Trabalho.",
      cuidado: "Contabiliza registros de restrição: um colaborador com duas restrições é contado duas vezes.",
    },
    {
      id: "chart-compat-idade", aba: "compativeis", grupo: "Restritos", titulo: "Idade",
      mostra: "Distribuição por faixa etária.",
      fonte: "Cadastro Cliente › Restritos (campo Idade).",
      calculo: "Contagem de registros nas faixas: até 24, 25-34, 35-44, 45-54 e 55+.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "Registros sem idade não são alocados em nenhuma faixa.",
    },
    {
      id: "chart-compat-atividade", aba: "compativeis", grupo: "Restritos", titulo: "Em Atividade Compatível",
      mostra: "Quantidade de colaboradores recolocados em atividade compatível, em comparação com os não recolocados.",
      fonte: "Cadastro Cliente › Restritos (campo Atividade Compatível).",
      calculo: "Contagem de registros por valor de Atividade Compatível (Sim/Não).",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "chart-compat-status-setor", aba: "compativeis", grupo: "Restritos", titulo: "Status por Setor",
      mostra: "Situação das restrições por setor.",
      fonte: "Cadastro Cliente › Restritos (Status Restrição: Ativa, Em Avaliação, Encerrada).",
      calculo: "Barras empilhadas: contagem de registros por status, por setor.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "chart-compat-restricao-turno", aba: "compativeis", grupo: "Restritos", titulo: "Restrição por Turno",
      mostra: "Situação das restrições por turno de trabalho.",
      fonte: "Cadastro Cliente › Restritos (Turno Trabalho).",
      calculo: "Barras empilhadas: contagem de registros por status, por turno.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "chart-compat-compativel-setor", aba: "compativeis", grupo: "Restritos", titulo: "Compatível por Setor",
      mostra: "Quantidade de colaboradores em atividade compatível, por setor.",
      fonte: "Cadastro Cliente › Restritos.",
      calculo: "Contagem de registros com Atividade Compatível = Sim, por setor.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "diagrama-compat-frente", aba: "compativeis", grupo: "Restritos", titulo: "Restrições por região (frente)",
      mostra: "Quantidade de restrições por região do corpo, vista frontal.",
      fonte: "Cadastro Cliente › Restritos (Segmento Corporal).",
      calculo: "Contagem de restrições por Segmento Corporal. Na vista frontal, o lado direito da pessoa corresponde ao lado esquerdo da imagem. \"Psicossocial\" (ícone de cérebro) e \"Não identificado\" aparecem em cartões ao lado da figura.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "diagrama-compat-costas", aba: "compativeis", grupo: "Restritos", titulo: "Restrições por região (costas)",
      mostra: "Quantidade de restrições por região do corpo, vista posterior.",
      fonte: "Cadastro Cliente › Restritos (Segmento Corporal).",
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
