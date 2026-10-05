/* ==========================================================================
   S.I.G.E. - ElevaLife
   PAGINA DE AJUDA (V 1.0): manual de uso por modulo, fluxos em BPMN
   (desenhados em SVG a partir de dados - ver FLUXOS) e o dicionario de
   indicadores (vem de js/indicadores.js). Nada aqui le/grava dados do
   cliente: e' conteudo estatico, igual para todos os usuarios.
   ========================================================================== */
(function (global) {
  "use strict";

  const BI = (global.BI = global.BI || {});

  // ------------------------------------------------------------------
  // MANUAL DE USO
  // ------------------------------------------------------------------
  const MANUAL = [
    {
      titulo: "Primeiro acesso e navegação",
      passos: [
        "Quem cria o seu acesso (Administrador ou Consultor) cadastra o seu e-mail em Usuários. Você recebe um e-mail com o link de primeiro acesso: abra, defina a sua senha e entre.",
        "Nos próximos acessos, entre com e-mail e senha. A sessão dura 7 dias; \"Sair\" fica no rodapé do menu.",
        "O menu lateral leva às telas: Gestão de Risco, Gestão de Absenteísmo, Gestão de Restritos, Riscos Psicossociais, Registro, Cadastro, Usuários (só Administrador) e Ajuda. A seta no fim do menu recolhe/abre o menu.",
        "No topo: Filtros (abre o painel de filtros), o sino de avisos do Plano de Ação, Atualizar, PDF e Excel.",
      ],
    },
    {
      titulo: "Ler os dashboards (Risco, Absenteísmo, Restritos)",
      passos: [
        "Use Filtros para recortar por Cliente, Unidade, Setor, Posto, Cargo, Atividade, Ano e Mês. O número no botão mostra quantos filtros estão ativos; \"Limpar filtros\" volta a tudo.",
        "Clique em um número, barra ou fatia para abrir a lista dos registros por trás dele (detalhamento).",
        "O botão \"i\" ao lado do título de cada card explica o que o indicador mostra, de onde vem o dado e como é calculado. A lista completa está em Ajuda › Indicadores.",
        "PDF exporta os cards da tela atual; Excel exporta os dados brutos filtrados. Ambos respeitam os filtros ativos.",
      ],
    },
    {
      titulo: "Cadastro: montar a estrutura do cliente",
      passos: [
        "Cadastre na ordem: Cliente › Unidade › Setor › Posto de Trabalho › Cargo › Atividade. Cada nível só aceita valores do nível anterior (listas em cascata).",
        "No Cliente, informe a Matriz de Risco (3x3, 4x4 ou 5x5): ela define a graduação do Inventário de Riscos. O logotipo do cliente colore a identidade da tela quando só aquele cliente está filtrado.",
        "Só depois de cadastrar a estrutura é possível lançar registros.",
      ],
    },
    {
      titulo: "Registro: o dia a dia",
      passos: [
        "Em Registro ficam as tabelas operacionais: Mapa de Risco, Plano de Ação, Absenteísmo, HHT / Dias Úteis, Compatíveis, Avaliação Ergonômica (AEP), Inventário de Riscos (AEP), Laudos e AET.",
        "Cada linha é um registro. Use \"+ Novo registro\" para lançar e os botões Editar e Excluir de cada linha.",
        "Campos calculados (Risco Global, Status da ação, Graduação do risco) são preenchidos pelo sistema: não são digitados.",
        "Datas são digitadas como DD/MM/AAAA (a barra entra sozinha) ou escolhidas no ícone de calendário. Os filtros Ano e Mês só trazem registros que têm a data lançada: sem data, o registro não aparece quando Ano/Mês está selecionado.",
        "Botão \"Mais detalhes\" em cada linha: mostra quem criou e quem editou por último (com data e hora, gravadas pelo servidor) e, campo a campo, o valor atual e o que mudou. Fica escondido até o clique e vale para todos que enxergam o registro.",
        "Excluir um registro apaga também as fotos e arquivos ligados a ele no armazenamento.",
      ],
    },
    {
      titulo: "Avaliação em campo (AEP), inclusive sem internet",
      passos: [
        "Abra o S.I.G.E no celular ou tablet e use \"Adicionar à tela inicial\" para instalar o app. Faça o primeiro acesso com internet: os dados do cliente ficam guardados no aparelho.",
        "Sem sinal, a Avaliação Ergonômica continua funcionando: preencha, tire as fotos e salve. Aparece a faixa \"sem internet · N a enviar\" no canto da tela.",
        "Ao voltar a conexão, o envio é automático (a cada 30 segundos). Toque na faixa para ver os \"Envios pendentes\": Enviar agora, Descartar, Tentar de novo ou, em caso de conflito, Enviar minha versão.",
        "Excluir também funciona sem internet: a exclusão fica na fila e é feita quando a conexão voltar (dá para Cancelar exclusão antes).",
        "Não saia da conta com envios pendentes: o sistema avisa e pede confirmação.",
      ],
    },
    {
      titulo: "Inventário de Riscos e Mapa de Risco",
      passos: [
        "Em Registro › Avaliação Ergonômica (AEP), use o botão \"Inventário de Riscos\" da linha do posto para abrir o checklist de fatores (ISO TS-20646), marque os fatores existentes e escolha Probabilidade e Gravidade de cada um. A graduação sai da matriz do cliente. Cada fator marcado abre Fonte Geradora, Consequência, Medidas de Controle Existentes, Ação para Eliminação e Ação Organizacional, além da classificação atual e do risco após a melhoria (graduação calculada pela mesma matriz).",
        "No Mapa de Risco, dê a nota de 1 a 4 para cada uma das 12 dimensões (regiões do corpo, Psicossocial/Cognitivo e Ambiental). O Risco Global do posto é calculado pela média.",
      ],
    },
    {
      titulo: "Plano de Ação e avisos",
      passos: [
        "Em Registro › Plano de Ação, lance uma ação por posto com Ação Recomendada, Responsável e Dt Programada. Ao salvar, o responsável recebe um e-mail.",
        "Preencha a Dt Conclusão quando a ação terminar: o status passa a Concluída (ou Concluída com atraso).",
        "O sino no topo lista as ações que vencem em até 30 dias e as atrasadas. O responsável também recebe lembretes por e-mail antes do prazo, no vencimento e quando atrasa.",
      ],
    },
    {
      titulo: "Laudos e Certificados de Calibração",
      passos: [
        "O Modelo de Laudo (Editor de Texto) e os Certificados de Calibração são bibliotecas compartilhadas por todos os clientes.",
        "Em Registro › Laudos, clique em \"+ Novo registro\", escolha cliente, setor e posto e clique em \"Gerar Laudo (PDF)\". O PDF é montado a partir da Avaliação Ergonômica e do Inventário de Riscos e anexado ao registro; confirme em Salvar.",
      ],
    },
    {
      titulo: "AET (Análise Ergonômica do Trabalho)",
      passos: [
        "A AET é feita fora do sistema (Excel/PDF) e anexada aqui em Registro › AET.",
        "O sistema lê o conteúdo do arquivo e sugere a classificação (Mapa de Risco, Plano de Ação, análise em texto). O ergonomista confirma ou corrige antes de salvar.",
      ],
    },
    {
      titulo: "Usuários e papéis",
      passos: [
        "Administrador vê tudo e gerencia usuários. Consultor vê as empresas vinculadas e pode convidar pessoas. Usuário Cliente consulta apenas as empresas vinculadas a ele.",
        "Para dar acesso: Usuários › Novo usuário, informe e-mail, papel e empresas. O convite sai por e-mail.",
      ],
    },
    {
      titulo: "Riscos Psicossociais",
      passos: [
        "Tela em construção. A gestão dos riscos psicossociais (NR-01) será incluída aqui nas próximas versões.",
      ],
    },
  ];

  // ------------------------------------------------------------------
  // FLUXOS (BPMN). tipo: inicio | fim | tarefa | decisao
  // lane = indice da raia; col = coluna (esquerda -> direita).
  // ------------------------------------------------------------------
  const FLUXOS = [
    {
      titulo: "Implantação de um cliente",
      resumo: "Do convite dos usuários até a estrutura do cliente pronta para receber registros.",
      lanes: ["Admin / Consultor", "Usuário", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Novo cliente" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Cadastra os usuários e define o papel" },
        { id: "c", tipo: "tarefa", lane: 2, col: 2, texto: "Envia o convite por e-mail" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Abre o link, define a senha e entra" },
        { id: "e", tipo: "tarefa", lane: 0, col: 4, texto: "Cadastra o Cliente (matriz de risco, logo)" },
        { id: "f", tipo: "tarefa", lane: 0, col: 5, texto: "Cadastra Unidade, Setor, Posto, Cargo e Atividade" },
        { id: "g", tipo: "fim", lane: 0, col: 6, texto: "Estrutura pronta" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"], ["f", "g"]],
    },
    {
      titulo: "Avaliação em campo (AEP) e Mapa de Risco",
      resumo: "Da visita ao posto até o Risco Global calculado, com ou sem internet.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Visita ao posto" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Abre a Avaliação Ergonômica do posto" },
        { id: "c", tipo: "decisao", lane: 0, col: 2, texto: "Tem internet?" },
        { id: "d", tipo: "tarefa", lane: 0, col: 3, texto: "Preenche, fotografa e salva" },
        { id: "e", tipo: "tarefa", lane: 1, col: 3, texto: "Guarda na fila do aparelho" },
        { id: "f", tipo: "tarefa", lane: 1, col: 4, texto: "Envia sozinho quando a conexão volta" },
        { id: "g", tipo: "tarefa", lane: 0, col: 5, texto: "Marca os fatores de risco e Probabilidade × Gravidade" },
        { id: "h", tipo: "tarefa", lane: 1, col: 6, texto: "Calcula a graduação pela matriz do cliente" },
        { id: "i", tipo: "tarefa", lane: 0, col: 7, texto: "Dá as 12 notas no Mapa de Risco" },
        { id: "j", tipo: "tarefa", lane: 1, col: 8, texto: "Calcula o Risco Global (média das notas)" },
        { id: "k", tipo: "fim", lane: 1, col: 9, texto: "Posto no Mapa de Risco" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d", "Sim"], ["c", "e", "Não"], ["d", "g"], ["e", "f"], ["f", "g"],
        ["g", "h"], ["h", "i"], ["i", "j"], ["j", "k"]],
    },
    {
      titulo: "Do risco ao Plano de Ação",
      resumo: "Como um posto crítico vira ação, aviso, execução e indicador.",
      lanes: ["Ergonomista", "Responsável", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Risco Global do posto" },
        { id: "b", tipo: "decisao", lane: 0, col: 1, texto: "Alto ou Muito Alto?" },
        { id: "c", tipo: "fim", lane: 1, col: 2, texto: "Monitoramento de rotina" },
        { id: "d", tipo: "tarefa", lane: 0, col: 2, texto: "Lança a ação (responsável e Dt Programada)" },
        { id: "e", tipo: "tarefa", lane: 2, col: 3, texto: "E-mail ao responsável e lembretes de prazo" },
        { id: "f", tipo: "tarefa", lane: 1, col: 4, texto: "Executa a ação" },
        { id: "g", tipo: "tarefa", lane: 1, col: 5, texto: "Informa a Dt Conclusão" },
        { id: "h", tipo: "tarefa", lane: 2, col: 6, texto: "Calcula o status e atualiza os indicadores" },
        { id: "i", tipo: "fim", lane: 2, col: 7, texto: "Acompanhar em Gestão de Risco" },
      ],
      fluxo: [["a", "b"], ["b", "c", "Não"], ["b", "d", "Sim"], ["d", "e"], ["e", "f"], ["f", "g"], ["g", "h"], ["h", "i"]],
    },
    {
      titulo: "Emissão de Laudo",
      resumo: "Da avaliação concluída ao PDF do laudo guardado no sistema.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Avaliação concluída" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Em Registro › Laudos, escolhe cliente, setor e posto" },
        { id: "c", tipo: "tarefa", lane: 0, col: 2, texto: "Clica em Gerar Laudo (PDF)" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Monta o PDF (modelo, matriz, fatores, fotos)" },
        { id: "e", tipo: "tarefa", lane: 0, col: 4, texto: "Confere e salva o registro" },
        { id: "f", tipo: "fim", lane: 0, col: 5, texto: "Laudo emitido" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"]],
    },
    {
      titulo: "AET anexada",
      resumo: "Como uma AET feita fora do sistema entra e vira indicador.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "AET pronta (Excel/PDF)" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Anexa o arquivo em Registro › AET" },
        { id: "c", tipo: "tarefa", lane: 1, col: 2, texto: "Lê o conteúdo e sugere a classificação" },
        { id: "d", tipo: "tarefa", lane: 0, col: 3, texto: "Confirma ou corrige a classificação" },
        { id: "e", tipo: "tarefa", lane: 1, col: 4, texto: "Guarda o arquivo e atualiza o indicador AET" },
        { id: "f", tipo: "fim", lane: 1, col: 5, texto: "AET registrada" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"]],
    },
    {
      titulo: "Absenteísmo e Taxa de Frequência",
      resumo: "Como afastamentos e horas trabalhadas viram a Taxa de Frequência.",
      lanes: ["Consultor", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Afastamento de colaborador" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Registra em Absenteísmo (região, dias)" },
        { id: "c", tipo: "tarefa", lane: 0, col: 2, texto: "Lança HHT / Dias Úteis do mês" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Calcula a Taxa de Frequência (NBR 14280)" },
        { id: "e", tipo: "fim", lane: 1, col: 4, texto: "Acompanhar em Gestão de Absenteísmo" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"]],
    },
    {
      titulo: "Restrição médica e recolocação",
      resumo: "Do retorno com restrição até a atividade compatível.",
      lanes: ["Consultor", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Retorno com restrição médica" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Registra em Compatíveis (segmento corporal)" },
        { id: "c", tipo: "decisao", lane: 0, col: 2, texto: "Há atividade compatível?" },
        { id: "d", tipo: "tarefa", lane: 0, col: 3, texto: "Atividade Compatível = Sim" },
        { id: "e", tipo: "tarefa", lane: 1, col: 3, texto: "Status Em Avaliação ou Ativa" },
        { id: "f", tipo: "fim", lane: 1, col: 4, texto: "Acompanhar em Gestão de Restritos" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d", "Sim"], ["c", "e", "Não"], ["d", "f"], ["e", "f"]],
    },
  ];

  const HISTORICO = [
    {
      versao: "1.2", data: "05/10/2026",
      itens: [
        "Inventário de Riscos: cada fator passa a ter uma lista de ações (no lugar de \"Ação para Eliminação\" e \"Ação Organizacional\" em texto aberto). Cada ação tem tipo, descrição (com sugestões), segmento corporal, \"reduz o risco de X para Y\", complexidade, responsável, prazo e status.",
        "O risco após a melhoria agora é calculado: por segmento corporal vale a ação que leva ao menor nível; o fator fica no maior nível entre os segmentos. Mostra o previsto (todas as ações) e o realizado (só as concluídas).",
        "Tipos de ação (Eliminação, Engenharia / Adequação, Organizacional) com nomes editáveis pelo Administrador em Configurações, valendo para todos os clientes.",
        "O responsável recebe e-mail ao ser designado (só na criação da ação ou ao trocar o e-mail do responsável — sem reenvio a cada gravação).",
        "Evidência obrigatória (foto ou PDF) para concluir uma ação, conferida no servidor. O Administrador pode concluir sem evidência informando justificativa e data-limite; ele e o responsável são lembrados até a evidência entrar.",
        "Registros anteriores continuam como estavam; os textos antigos podem virar ações com um clique, e ações já concluídas continuam editáveis sem evidência.",
        "Correção: o histórico não mostra mais alteração falsa quando só muda o tipo do valor (9 e \"9\").",
      ],
    },
    {
      versao: "1.1", data: "05/10/2026",
      itens: [
        "Filtros Ano e Mês passam a vir só das datas lançadas e só trazem registros com data (Mapa de Risco, Avaliação, Inventário e Restritos ganharam campo de data).",
        "Datas em DD/MM/AAAA em todo o sistema, com calendário no campo e máscara automática; Excel e histórico também saem em DD/MM/AAAA.",
        "Histórico de cada registro: quem criou e quem editou, com data e hora gravadas pelo servidor, visível em \"Mais detalhes\" (campo a campo, com o valor anterior).",
        "Checklist do Inventário de Riscos: Fonte Geradora, Consequência, Medidas de Controle Existentes, Ação para Eliminação, Ação Organizacional e risco após a melhoria (graduação calculada).",
        "Menos campos abertos: SLA virou lista; e-mail do responsável validado e preenchido automaticamente; CNPJ, CEP e telefone com máscara; sugestões em Queixa Principal, Restrição Médica, Atividade Compatível e Emitido por.",
      ],
    },
    {
      versao: "1.0", data: "04/10/2026",
      itens: [
        "Primeira versão numerada do S.I.G.E, fechando o pacote de melhorias de 04/10/2026.",
        "Coleta offline da Avaliação Ergonômica (AEP) com fotos, fila de envios e resolução de conflitos.",
        "Exclusão de dados com ou sem internet; fotos e arquivos são apagados junto com o registro.",
        "Endereço oficial sige-ergo.elevalife.com.br.",
        "Visual limpo: textos de apoio dos cards foram para o botão \"i\" e para esta Ajuda.",
        "Dicionário de indicadores de Gestão de Risco, Absenteísmo e Restritos (botão \"i\" e Ajuda › Indicadores).",
        "Correção: a graduação do Inventário de Riscos passou a contar os níveis \"Moderado\", \"Muito Baixo\" e \"Altíssimo\" das matrizes.",
        "Correção: fatores marcados \"Não\" no checklist não entram mais nos indicadores do Inventário.",
        "Correção: o card de Prazos do Inventário considera só fatores em aberto.",
        "Nova tela Riscos Psicossociais (em construção).",
        "Nova página de Ajuda com manual, fluxos BPMN, indicadores e histórico de versões.",
      ],
    },
  ];

  // ------------------------------------------------------------------
  // Desenho do BPMN em SVG
  // ------------------------------------------------------------------
  const NS = "http://www.w3.org/2000/svg";
  const LARG_RAIA = 120, LARG_COL = 150, ALT_RAIA = 112, MARGEM = 14;
  const TAREFA = { w: 128, h: 66 }, DECISAO = 50, EVENTO = 15;

  function el(nome, attrs, pai) {
    const e = document.createElementNS(NS, nome);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (pai) pai.appendChild(e);
    return e;
  }

  function quebrar(texto, max) {
    const palavras = String(texto).split(" ");
    const linhas = [];
    let atual = "";
    palavras.forEach((p) => {
      if ((atual + " " + p).trim().length > max && atual) { linhas.push(atual); atual = p; }
      else atual = (atual + " " + p).trim();
    });
    if (atual) linhas.push(atual);
    return linhas;
  }

  function escreverTexto(pai, linhas, cx, cy, classe) {
    const t = el("text", { x: cx, y: cy - ((linhas.length - 1) * 6.5), "text-anchor": "middle", class: classe }, pai);
    linhas.forEach((l, i) => {
      const ts = el("tspan", { x: cx, dy: i === 0 ? 4 : 13 }, t);
      ts.textContent = l;
    });
  }

  function desenharBPMN(fluxo) {
    const cols = Math.max.apply(null, fluxo.nos.map((n) => n.col)) + 1;
    const largura = LARG_RAIA + cols * LARG_COL + MARGEM;
    const altura = fluxo.lanes.length * ALT_RAIA;
    const svg = el("svg", { viewBox: `0 0 ${largura} ${altura}`, width: largura, height: altura, class: "bpmn-svg", role: "img", "aria-label": fluxo.titulo });

    const defs = el("defs", {}, svg);
    const marcador = el("marker", { id: "seta-" + fluxo.id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0L10 5L0 10z", class: "bpmn-seta" }, marcador);

    fluxo.lanes.forEach((nome, i) => {
      const y = i * ALT_RAIA;
      el("rect", { x: 0, y, width: largura, height: ALT_RAIA, class: "bpmn-raia" }, svg);
      el("rect", { x: 0, y, width: 28, height: ALT_RAIA, class: "bpmn-raia-rotulo" }, svg);
      const t = el("text", { x: 14, y: y + ALT_RAIA / 2, "text-anchor": "middle", class: "bpmn-raia-texto", transform: `rotate(-90 14 ${y + ALT_RAIA / 2})` }, svg);
      t.textContent = nome;
    });

    const porId = {};
    fluxo.nos.forEach((n) => {
      n.x = LARG_RAIA + n.col * LARG_COL + LARG_COL / 2;
      n.y = n.lane * ALT_RAIA + ALT_RAIA / 2;
      porId[n.id] = n;
      if (n.tipo === "tarefa") { n.mw = TAREFA.w / 2; n.mh = TAREFA.h / 2; }
      else if (n.tipo === "decisao") { n.mw = DECISAO / 2 + 6; n.mh = DECISAO / 2 + 6; }
      else { n.mw = EVENTO; n.mh = EVENTO; }
    });

    const gArestas = el("g", {}, svg);
    fluxo.fluxo.forEach(([de, para, rotulo]) => {
      const a = porId[de], b = porId[para];
      let pts, pos;
      if (b.col > a.col && a.tipo === "decisao" && a.lane !== b.lane) {
        // saida alternativa do losango: desce/sobe pela ponta e entra de lado
        const descendo = b.y > a.y;
        pts = [[a.x, a.y + (descendo ? a.mh : -a.mh)], [a.x, b.y], [b.x - b.mw, b.y]];
        pos = { x: a.x + 6, y: (pts[0][1] + b.y) / 2 + 4, ancora: "start" };
      } else if (b.col > a.col) {
        const x1 = a.x + a.mw, y1 = a.y, x2 = b.x - b.mw, y2 = b.y;
        if (y1 === y2) { pts = [[x1, y1], [x2, y2]]; pos = { x: x1 + 6, y: y1 - 6, ancora: "start" }; }
        else {
          const xm = x2 - 22;
          pts = [[x1, y1], [xm, y1], [xm, y2], [x2, y2]];
          pos = { x: xm - 5, y: (y1 + y2) / 2 + 4, ancora: "end" };
        }
      } else {
        const descendo = b.y > a.y;
        pts = [[a.x, a.y + (descendo ? a.mh : -a.mh)], [b.x, b.y + (descendo ? -b.mh : b.mh)]];
        pos = { x: a.x + 6, y: (pts[0][1] + pts[1][1]) / 2, ancora: "start" };
      }
      el("polyline", { points: pts.map((p) => p.join(",")).join(" "), class: "bpmn-aresta", "marker-end": `url(#seta-${fluxo.id})` }, gArestas);
      if (rotulo) {
        const t = el("text", { x: pos.x, y: pos.y, "text-anchor": pos.ancora, class: "bpmn-rotulo-aresta" }, gArestas);
        t.textContent = rotulo;
      }
    });

    fluxo.nos.forEach((n) => {
      const g = el("g", { class: "bpmn-no bpmn-" + n.tipo }, svg);
      if (n.tipo === "tarefa") {
        el("rect", { x: n.x - TAREFA.w / 2, y: n.y - TAREFA.h / 2, width: TAREFA.w, height: TAREFA.h, rx: 8 }, g);
        escreverTexto(g, quebrar(n.texto, 20), n.x, n.y, "bpmn-texto");
      } else if (n.tipo === "decisao") {
        const d = DECISAO / 2 + 6;
        el("polygon", { points: `${n.x},${n.y - d} ${n.x + d},${n.y} ${n.x},${n.y + d} ${n.x - d},${n.y}` }, g);
        const x = el("text", { x: n.x, y: n.y + 5, "text-anchor": "middle", class: "bpmn-texto bpmn-x" }, g);
        x.textContent = "?";
        escreverTexto(g, quebrar(n.texto, 18), n.x, n.y - d - 14 - (quebrar(n.texto, 18).length - 1) * 6.5 + 6, "bpmn-texto bpmn-legenda");
      } else {
        el("circle", { cx: n.x, cy: n.y, r: EVENTO }, g);
        escreverTexto(g, quebrar(n.texto, 18), n.x, n.y + EVENTO + 14, "bpmn-texto bpmn-legenda");
      }
    });

    return svg;
  }

  // ------------------------------------------------------------------
  // Montagem da pagina
  // ------------------------------------------------------------------
  function criar(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function painelManual() {
    const raiz = criar("div", "ajuda-painel");
    MANUAL.forEach((sec, i) => {
      const d = criar("details", "ajuda-secao");
      if (i === 0) d.open = true;
      d.appendChild(criar("summary", "", sec.titulo));
      const ol = criar("ol", "ajuda-passos");
      sec.passos.forEach((p) => ol.appendChild(criar("li", "", p)));
      d.appendChild(ol);
      raiz.appendChild(d);
    });
    return raiz;
  }

  function painelFluxos() {
    const raiz = criar("div", "ajuda-painel");
    FLUXOS.forEach((f, i) => {
      f.id = "f" + i;
      const bloco = criar("section", "ajuda-fluxo cartao");
      bloco.appendChild(criar("div", "cartao-titulo", f.titulo));
      bloco.appendChild(criar("p", "ajuda-fluxo-resumo", f.resumo));
      const rolagem = criar("div", "bpmn-rolagem");
      rolagem.appendChild(desenharBPMN(f));
      bloco.appendChild(rolagem);
      raiz.appendChild(bloco);
    });
    return raiz;
  }

  function painelIndicadores() {
    const raiz = criar("div", "ajuda-painel");
    const lista = (BI.Indicadores && BI.Indicadores.LISTA) || [];
    const abas = (BI.Indicadores && BI.Indicadores.ABAS) || {};
    Object.keys(abas).forEach((aba) => {
      raiz.appendChild(criar("h3", "ajuda-h3", abas[aba]));
      let grupoAtual = null;
      lista.filter((i) => i.aba === aba).forEach((item) => {
        if (item.grupo !== grupoAtual) {
          grupoAtual = item.grupo;
          raiz.appendChild(criar("div", "ajuda-grupo", grupoAtual));
        }
        const d = criar("details", "ajuda-secao");
        d.appendChild(criar("summary", "", item.titulo));
        const corpo = criar("div", "ajuda-indicador");
        [["O que mostra", item.mostra], ["De onde vem", item.fonte], ["Como é calculado", item.calculo],
          ["Filtros que valem", item.filtros], ["Atenção", item.cuidado]].forEach(([r, t]) => {
          if (!t) return;
          const p = criar("p");
          p.appendChild(criar("strong", "", r + ": "));
          p.appendChild(document.createTextNode(t));
          corpo.appendChild(p);
        });
        d.appendChild(corpo);
        raiz.appendChild(d);
      });
    });
    return raiz;
  }

  function painelVersao() {
    const raiz = criar("div", "ajuda-painel");
    HISTORICO.forEach((h) => {
      const bloco = criar("section", "ajuda-fluxo cartao");
      bloco.appendChild(criar("div", "cartao-titulo", `V ${h.versao} · ${h.data}`));
      const ul = criar("ul", "ajuda-passos");
      h.itens.forEach((i) => ul.appendChild(criar("li", "", i)));
      bloco.appendChild(ul);
      raiz.appendChild(bloco);
    });
    return raiz;
  }

  const ABAS_AJUDA = [
    { chave: "manual", rotulo: "Como usar", montar: painelManual },
    { chave: "fluxos", rotulo: "Fluxos (BPMN)", montar: painelFluxos },
    { chave: "indicadores", rotulo: "Indicadores", montar: painelIndicadores },
    { chave: "versao", rotulo: "Versão", montar: painelVersao },
  ];

  function montar() {
    const secao = document.getElementById("aba-ajuda");
    if (!secao || secao.dataset.montada) return;
    secao.dataset.montada = "1";
    const barra = criar("nav", "subnav-cadastro ajuda-abas");
    const area = criar("div", "ajuda-area");
    const botoes = {};

    function mostrar(chave) {
      ABAS_AJUDA.forEach((a) => botoes[a.chave].classList.toggle("ativa", a.chave === chave));
      const aba = ABAS_AJUDA.find((a) => a.chave === chave);
      area.innerHTML = "";
      area.appendChild(aba.montar());
    }

    ABAS_AJUDA.forEach((a) => {
      const b = criar("button", "subnav-cadastro-item", a.rotulo);
      b.type = "button";
      b.addEventListener("click", () => mostrar(a.chave));
      botoes[a.chave] = b;
      barra.appendChild(b);
    });
    secao.appendChild(barra);
    secao.appendChild(area);
    mostrar("manual");
  }

  BI.Ajuda = { montar, MANUAL, FLUXOS, HISTORICO };
})(window);
