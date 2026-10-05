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
  BI.VERSAO = "1.2"; // versao do sistema - exibida no rodape e em Ajuda > Versao (ver docs/CHANGELOG.md)

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
    "Status calculado na hora, com a data de hoje: sem Dt Programada e sem Dt Conclusão = Não iniciado; só com Dt Conclusão = Concluída; " +
    "sem conclusão e programada antes de hoje = Atrasada; sem conclusão e programada para hoje = Em andamento; sem conclusão e programada no futuro = Não iniciado; " +
    "com conclusão depois da programada = Concluída com atraso; senão Concluída.";

  const LISTA = [
    // ------------------------------------------------------------------
    // GESTAO DE RISCO - trilha do Mapa de Risco + Plano de Acao
    // ------------------------------------------------------------------
    {
      id: "tiles-risco-global", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Mapa de Risco Global",
      mostra: "Quantos postos de trabalho estão em cada nível de risco (Baixo, Moderado, Alto, Muito Alto).",
      fonte: "Registro › Mapa de Risco (1 linha = 1 posto/atividade avaliado).",
      calculo: "O Risco Global de cada posto é a MÉDIA das 12 notas (1 a 4) digitadas no Mapa de Risco: Col. Cervical, Tronco, Ombros, Cotovelos, Punhos, Mãos/Dedos, Joelhos, Pernas, Tornozelos, Pés/Dedos, Psicossocial/Cognitivo e Ambiental. Média ≥ 2,70 = Muito Alto; ≥ 2,15 = Alto; ≥ 1,55 = Moderado; abaixo = Baixo. O card conta postos por nível; o % é a quantidade ÷ total de postos filtrados.",
      filtros: POR_DATA("data da avaliação do Mapa de Risco"),
      cuidado: "Método diferente do Inventário de Riscos (que usa a matriz de risco do cliente): os dois cards NÃO precisam bater, pois medem universos distintos (postos × fatores). Clique no número para listar os postos.",
    },
    {
      id: "chart-top-setores", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Top 3 Setores críticos",
      mostra: "Os 3 setores com mais postos em risco Alto ou Muito Alto.",
      fonte: "Registro › Mapa de Risco.",
      calculo: "Por setor: postos críticos (Alto + Muito Alto) ÷ total de postos do setor. A barra mostra esse %; a ORDEM dos 3 setores é pela quantidade de postos críticos (desempate pelo %).",
      filtros: POR_DATA("data da avaliação do Mapa de Risco"),
      cuidado: "Um setor com 1 posto 100% crítico pode aparecer abaixo de um setor com 5 de 10 críticos (50%): a ordem é por quantidade, a barra é em %.",
    },
    {
      id: "chart-plano-global", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Plano de Ação - Global",
      mostra: "Distribuição de todas as ações do Plano de Ação por status.",
      fonte: "Registro › Plano de Ação.",
      calculo: STATUS_ACAO + " Com filtro de Ano/Mês, a ação entra se a Dt Programada OU a Dt Conclusão cair no período.",
      filtros: COM_ANO_MES,
      cuidado: "\"Em andamento\" só aparece no dia exato do prazo (regra atual): ação com prazo futuro é \"Não iniciado\" e, passado o prazo sem conclusão, \"Atrasada\".",
    },
    {
      id: "chart-plano-criticos", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Plano de Ação - Postos Críticos",
      mostra: "O mesmo status do card Global, só para ações de postos Alto ou Muito Alto.",
      fonte: "Registro › Plano de Ação (campo Risco Global gravado na própria ação).",
      calculo: "Filtra as ações do Plano cujo Risco Global é Alto ou Muito Alto e calcula o status como no card Global.",
      filtros: COM_ANO_MES,
      cuidado: "O Risco Global é COPIADO do posto no momento em que a ação é lançada. Se o posto for reavaliado depois, a ação continua com o valor antigo.",
    },
    {
      id: "chart-acoes-previstas", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Ações previstas no período",
      mostra: "Quantas ações estão programadas em cada mês.",
      fonte: "Registro › Plano de Ação (campo Dt Programada).",
      calculo: "Conta as ações por mês da Dt Programada (concluídas ou não), com eixo contínuo do primeiro ao último mês (meses sem ação = 0). Ano/Mês filtra pela Dt Programada.",
      filtros: COM_ANO_MES,
      cuidado: "Ações sem Dt Programada não aparecem neste gráfico.",
    },
    {
      id: "chart-acoes-concluidas", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Ações concluídas no período",
      mostra: "Quantas ações foram concluídas em cada mês.",
      fonte: "Registro › Plano de Ação (campo Dt Conclusão).",
      calculo: "Conta as ações que têm Dt Conclusão, por mês dessa data. Ano/Mês filtra pela Dt Conclusão.",
      filtros: COM_ANO_MES,
      cuidado: "Inclui concluídas no prazo e com atraso.",
    },
    {
      id: "chart-por-responsavel", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Plano de Ação por Responsável",
      mostra: "Carga e situação das ações de cada responsável.",
      fonte: "Registro › Plano de Ação (campo Responsável Ação).",
      calculo: "Barras empilhadas por status (mesma regra do card Global), ordenadas pelo total de ações do responsável. Ação sem responsável aparece como \"Sem responsavel\".",
      filtros: COM_ANO_MES,
      cuidado: "É a base dos avisos por e-mail: o responsável recebe lembretes das ações dele.",
    },
    {
      id: "chart-status-por-setor", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Status do Plano de Ação por Setor",
      mostra: "Situação das ações em cada setor.",
      fonte: "Registro › Plano de Ação.",
      calculo: "Barras empilhadas por status (mesma regra do card Global), uma barra por setor.",
      filtros: COM_ANO_MES,
      cuidado: "",
    },
    {
      id: "chart-risco-por-setor", aba: "ergo", grupo: "Mapa de Risco e Plano de Ação", titulo: "Mapa de Risco por Setor",
      mostra: "Quantidade de postos por nível de risco dentro de cada setor.",
      fonte: "Registro › Mapa de Risco.",
      calculo: "Mesmo Risco Global do card \"Mapa de Risco Global\", aberto por setor.",
      filtros: POR_DATA("data da avaliação do Mapa de Risco"),
      cuidado: "A soma de todas as barras é igual ao total de postos do card Mapa de Risco Global.",
    },

    // ------------------------------------------------------------------
    // GESTAO DE RISCO - trilha AEP
    // ------------------------------------------------------------------
    {
      id: "tiles-fatorrisco-graduacao", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Inventário de Riscos - Graduação do Risco",
      mostra: "Quantos fatores de risco (ISO TS-20646) existem em cada nível de graduação.",
      fonte: "Registro › Inventário de Riscos (AEP): 1 linha = 1 fator marcado \"Existe fator de risco: Sim\" em um posto.",
      calculo: "A graduação vem da matriz de risco configurada no cliente (Probabilidade × Gravidade; 3x3, 4x4 ou 5x5). Para caber nos 4 níveis do painel: Muito Baixo e Baixo = Baixo; Moderado = Moderado; Alto = Alto; Altíssimo = Muito Alto. Fatores marcados \"Não\" não entram.",
      filtros: POR_DATA("data da identificação do fator"),
      cuidado: "Cliente com matriz 5x5 mostra aqui 4 níveis (agrupados). O nível exato de cada fator continua na tabela do Inventário.",
    },
    {
      id: "tiles-avaliacao-cobertura", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Avaliação Ergonômica - Cobertura",
      mostra: "Quantos postos do Mapa de Risco já têm Avaliação Ergonômica (AEP).",
      fonte: "Registro › Avaliação Ergonômica (AEP) comparada com Registro › Mapa de Risco.",
      calculo: "Avaliações registradas = total de avaliações filtradas. Postos cobertos = postos do Mapa de Risco (chave Cliente+Unidade+Setor+Posto+Cargo+Atividade) que têm pelo menos 1 avaliação. Cobertura = cobertos ÷ postos do Mapa de Risco.",
      filtros: POR_DATA("data da avaliação (Avaliação Ergonômica e Mapa de Risco)"),
      cuidado: "Avaliação de um posto que não está no Mapa de Risco entra em \"registradas\" mas não em \"cobertos\". Sem postos no Mapa, a cobertura mostra 0%.",
    },
    {
      id: "chart-fatorrisco-status", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Inventário de Riscos - Status",
      mostra: "Em que etapa de tratativa estão os fatores de risco (A validar, Em andamento, Concluído, Cancelado).",
      fonte: "Registro › Inventário de Riscos (AEP), campo Status.",
      calculo: "Contagem de fatores (marcados \"Sim\") por status; % sobre o total de fatores filtrados.",
      filtros: POR_DATA("data da identificação do fator"),
      cuidado: "Todo fator novo nasce como \"A validar\".",
    },
    {
      id: "tiles-fatorrisco-prazos", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Inventário de Riscos - Prazos",
      mostra: "Situação do prazo \"Válido Até\" dos fatores de risco ainda abertos.",
      fonte: "Registro › Inventário de Riscos (AEP), campo Válido Até.",
      calculo: "Só fatores em aberto (A validar ou Em andamento). Vencido = Válido Até antes de hoje; Vencendo = vence em até 30 dias; Em dia = vence daqui a mais de 30 dias.",
      filtros: POR_DATA("data da identificação do fator"),
      cuidado: "Fatores sem Válido Até, Concluídos ou Cancelados não entram nestes 3 números.",
    },
    {
      id: "chart-fatorrisco-top-setores", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Top Setores - Riscos em Aberto",
      mostra: "Os 5 setores com mais fatores de risco ainda em aberto.",
      fonte: "Registro › Inventário de Riscos (AEP).",
      calculo: "Por setor: fatores com status A validar ou Em andamento ÷ total de fatores do setor. A barra mostra o %; a ordem é pela quantidade de fatores em aberto.",
      filtros: POR_DATA("data da identificação do fator"),
      cuidado: "Mesma lógica do Top 3 Setores críticos: ordem por quantidade, barra em %.",
    },
    {
      id: "chart-laudos-tipo", aba: "ergo", grupo: "AEP - Avaliação Ergonômica e Inventário de Riscos", titulo: "Laudos e Certificados - Por Tipo",
      mostra: "Quantos laudos e certificados de calibração foram emitidos.",
      fonte: "Registro › Laudos (campo Tipo).",
      calculo: "Contagem de registros de Laudos por Tipo (Laudo ou Certificado de Calibração).",
      filtros: POR_DATA("data de emissão do laudo"),
      cuidado: "Conta o registro emitido, não o número de páginas ou arquivos.",
    },
    {
      id: "tiles-aet-classificacao", aba: "ergo", grupo: "AET - Análise Ergonômica do Trabalho", titulo: "AET - Arquivos Anexados por Classificação",
      mostra: "Quantos arquivos de AET (Excel/PDF) foram anexados e de que tipo de conteúdo são.",
      fonte: "Registro › AET (campo Arquivos AET).",
      calculo: "Conta ARQUIVOS (um registro pode ter vários). A classificação é a confirmada pelo ergonomista; se ele não confirmou, vale a automática, lida do conteúdo do arquivo. Classificações sem arquivos ficam ocultas.",
      filtros: POR_DATA("data da análise"),
      cuidado: "É contagem de arquivos, não de postos nem de análises.",
    },

    // ------------------------------------------------------------------
    // GESTAO DE ABSENTEISMO
    // ------------------------------------------------------------------
    {
      id: "tiles-totais-medocup", aba: "medocup", grupo: "Absenteísmo", titulo: "Totais do período filtrado",
      mostra: "Colaboradores, dias perdidos e Taxa de Frequência do período.",
      fonte: "Registro › Absenteísmo e Registro › HHT / Dias Úteis.",
      calculo: "Qtd Dias Perdidos = soma de \"Qtd Dias\" dos afastamentos. Taxa de Frequência = nº de afastamentos ÷ HHT × 1.000.000, com HHT = soma de (Colaboradores × Dias Úteis × 8 h) de cada linha de HHT / Dias Úteis (NBR 14280). Qtd Colaboradores = média da coluna Colaboradores das linhas de HHT / Dias Úteis do filtro.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês (afastamento pela Dt Afastamento; HHT pelo Ano/Mês Úteis).",
      cuidado: "Sem linhas de HHT / Dias Úteis lançadas, a Taxa de Frequência fica 0. A Qtd Colaboradores é a MÉDIA das linhas (setor × mês), não a soma dos setores.",
    },
    {
      id: "chart-evolucao-taxa", aba: "medocup", grupo: "Absenteísmo", titulo: "Evolução da Taxa de Frequência",
      mostra: "A Taxa de Frequência mês a mês, com atestados e dias perdidos no balão.",
      fonte: "Registro › Absenteísmo e Registro › HHT / Dias Úteis.",
      calculo: "Mesma fórmula do card Totais, calculada para cada mês (afastamentos do mês ÷ HHT do mês × 1.000.000).",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "Mês com afastamento mas sem HHT lançado aparece com taxa 0.",
    },
    {
      id: "chart-taxa-por-setor", aba: "medocup", grupo: "Absenteísmo", titulo: "Taxa de Frequência por Setor",
      mostra: "Casos de afastamento por milhão de horas trabalhadas, por setor.",
      fonte: "Registro › Absenteísmo e Registro › HHT / Dias Úteis.",
      calculo: "Mesma fórmula do card Totais, por setor. Os setores listados são os que têm linha em HHT / Dias Úteis.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "Setor com afastamentos mas sem HHT lançado não aparece.",
    },
    {
      id: "diagrama-medocup-frente", aba: "medocup", grupo: "Absenteísmo", titulo: "Dias perdidos por região (frente)",
      mostra: "Dias perdidos por região do corpo, vista frontal.",
      fonte: "Registro › Absenteísmo (Região Corporal e Qtd Dias).",
      calculo: "Soma de \"Qtd Dias\" por Região Corporal. A silhueta é vista de frente: o lado Direito da pessoa aparece à esquerda da imagem.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "",
    },
    {
      id: "diagrama-medocup-costas", aba: "medocup", grupo: "Absenteísmo", titulo: "Dias perdidos por região (costas)",
      mostra: "Dias perdidos por região do corpo, vista posterior.",
      fonte: "Registro › Absenteísmo (Região Corporal e Qtd Dias).",
      calculo: "Soma de \"Qtd Dias\" por Região Corporal. A silhueta é vista de costas: o lado Direito da pessoa aparece à direita da imagem.",
      filtros: "Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.",
      cuidado: "",
    },

    // ------------------------------------------------------------------
    // GESTAO DE RESTRITOS
    // ------------------------------------------------------------------
    {
      id: "chart-compat-genero", aba: "compativeis", grupo: "Restritos", titulo: "Gênero",
      mostra: "Gênero dos colaboradores em restrição ou acompanhamento.",
      fonte: "Registro › Compatíveis.",
      calculo: "Contagem de registros por gênero.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página: Status Restrição e Turno de Trabalho.",
      cuidado: "Conta registros de restrição; um colaborador com duas restrições conta duas vezes.",
    },
    {
      id: "chart-compat-idade", aba: "compativeis", grupo: "Restritos", titulo: "Idade",
      mostra: "Distribuição por faixa etária.",
      fonte: "Registro › Compatíveis (campo Idade).",
      calculo: "Contagem de registros nas faixas: até 24, 25-34, 35-44, 45-54 e 55+.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "Idade vazia não entra em nenhuma faixa.",
    },
    {
      id: "chart-compat-atividade", aba: "compativeis", grupo: "Restritos", titulo: "Em Atividade Compatível",
      mostra: "Quantos colaboradores já foram recolocados em atividade compatível.",
      fonte: "Registro › Compatíveis (campo Atividade Compatível).",
      calculo: "Contagem de registros por valor de Atividade Compatível (Sim/Não).",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "chart-compat-status-setor", aba: "compativeis", grupo: "Restritos", titulo: "Status por Setor",
      mostra: "Situação das restrições em cada setor.",
      fonte: "Registro › Compatíveis (Status Restrição: Ativa, Em Avaliação, Encerrada).",
      calculo: "Barras empilhadas: contagem de registros por status, por setor.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "chart-compat-restricao-turno", aba: "compativeis", grupo: "Restritos", titulo: "Restrição por Turno",
      mostra: "Situação das restrições em cada turno de trabalho.",
      fonte: "Registro › Compatíveis (Turno Trabalho).",
      calculo: "Barras empilhadas: contagem de registros por status, por turno.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "chart-compat-compativel-setor", aba: "compativeis", grupo: "Restritos", titulo: "Compatível por Setor",
      mostra: "Quantos colaboradores em atividade compatível existem em cada setor.",
      fonte: "Registro › Compatíveis.",
      calculo: "Contagem de registros com Atividade Compatível = Sim, por setor.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "diagrama-compat-frente", aba: "compativeis", grupo: "Restritos", titulo: "Restrições por região (frente)",
      mostra: "Quantidade de restrições por região do corpo, vista frontal.",
      fonte: "Registro › Compatíveis (Segmento Corporal).",
      calculo: "Contagem de restrições por Segmento Corporal. Silhueta de frente: lado Direito da pessoa à esquerda da imagem.",
      filtros: "Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.",
      cuidado: "",
    },
    {
      id: "diagrama-compat-costas", aba: "compativeis", grupo: "Restritos", titulo: "Restrições por região (costas)",
      mostra: "Quantidade de restrições por região do corpo, vista posterior.",
      fonte: "Registro › Compatíveis (Segmento Corporal).",
      calculo: "Contagem de restrições por Segmento Corporal. Silhueta de costas: lado Direito da pessoa à direita da imagem.",
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
