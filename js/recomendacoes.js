/* ==========================================================================
   S.I.G.E - ElevaLife · V 1.37
   Biblioteca de RECOMENDACOES por fator de risco (lista ISO/TS 20646 usada no
   checklist da AEP e nos fatores da AET) - pedido do Alexandre, 09/10/2026:
     1) "Sistema recomendar qual ferramenta utilizar de acordo com o fator de risco";
     2) "Recomendacoes padronizadas de AEP e AET de acordo com o risco e fator
        (manter campo de outras acoes, para o ergonomista poder digitar a acao)".

   Base tecnica: NR-17 (Portaria MTP 423/2021) e Manual de Aplicacao da NR-17;
   NR-01 (GRO/PGR - hierarquia das medidas de prevencao); ISO 11228-1/-2/-3
   (levantamento/transporte, empurrar/puxar, movimentos repetitivos);
   ISO 11226 (posturas estaticas); ISO/TS 20646 (guia de reducao de esforco);
   ISO 9241 / NR-17 Anexo II (trabalho com computador e teleatendimento);
   ISO 10075 e ISO 45003 (carga mental e riscos psicossociais); NHO-11
   (iluminacao), NHO-09/10 (vibracao) e NHO-06 (calor) da Fundacentro;
   e a pratica de campo da ElevaLife.

   FERRAMENTAS: ids de js/ferramentas.js, na ordem de preferencia (a 1a e a
   mais indicada para o fator). "obs" orienta avaliacoes quantitativas que
   ficam fora do SIGE (medicoes ambientais).

   ACOES: [tipo, texto, complexidade, nivelMinimo]
     tipo         = codigo do tipo de acao (Eliminacao | Engenharia | Organizacional)
     complexidade = Baixa | Media | Alta
     nivelMinimo  = a partir de qual risco a acao e indicada (5o item opcional:
                    nivelMaximo, ate qual risco), na escala unica
                    de Calc.ordemNivel (0 muito baixo/irrelevante, 1 baixo,
                    2 moderado, 3 alto, 4 muito alto/altissimo/intoleravel).
   Logica (NR-01, 1.5.5.1.2 - prioridade): risco baixo -> manter e monitorar
   (acoes administrativas simples); moderado -> adequacoes de engenharia e
   organizacao; alto ou acima -> eliminar/substituir a exigencia e adequar o
   posto, com as organizacionais como complemento.
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const E = "Eliminacao", G = "Engenharia", O = "Organizacional";
  const B = "Baixa", M = "Media", A = "Alta";

  // Acoes comuns reaproveitadas
  const PAUSAS = [O, "Instituir pausas de recuperação programadas (ex.: 10 min a cada 50 min de atividade contínua), registradas na rotina do setor", B, 2];
  const RODIZIO = [O, "Implantar rodízio entre atividades com exigências físicas diferentes (grupos musculares distintos), com escala definida", M, 2];
  const TREINO_POSTURA = [O, "Orientar os trabalhadores sobre postura, ajuste do posto e técnicas de trabalho (treinamento com registro de presença)", B, 0];
  const GINASTICA = [O, "Ginástica laboral / alongamentos orientados por profissional habilitado, como complemento às demais medidas", B, 1];
  const MONITORAR = [O, "Manter as condições atuais e reavaliar na próxima AEP ou quando houver mudança no processo, no posto ou queixas", B, 0, 1];
  const PARTICIPACAO = [O, "Ouvir os trabalhadores (queixas e sugestões) e registrar as percepções no acompanhamento ergonômico", B, 0];

  const R = {
    // ------------------------------------------------ Jornada de trabalho e concentracao
    "Jornada longa de trabalho de mais de 8h por dia": {
      ferramentas: ["nasa", "ergos", "nr17"],
      acoes: [MONITORAR, [O, "Revisar o dimensionamento da equipe para manter a jornada dentro de 8 h diárias", M, 2], [O, "Limitar a prorrogação da jornada e controlar as horas extras por trabalhador", B, 2], PAUSAS, [O, "Programar as tarefas de maior exigência física e mental no início do turno", B, 1], [E, "Reorganizar escalas/turnos para eliminar jornadas acima de 8 h nas atividades de maior exigência", A, 3]],
    },
    "Longas e frequentes horas extras de trabalho (>2h/dia e >2x na semana)": {
      ferramentas: ["nasa", "ergos", "nr17"],
      acoes: [MONITORAR, [O, "Controlar o banco de horas e limitar as horas extras a no máximo 2 h por dia (CLT, art. 59)", B, 1], [O, "Redistribuir a demanda entre a equipe ou contratar reforço temporário nos picos", M, 2], [O, "Planejar a produção para evitar picos recorrentes que gerem horas extras frequentes", M, 2], [E, "Dimensionar o quadro de pessoal para a demanda real, eliminando horas extras habituais", A, 3]],
    },
    "Longo tempo de operação contínua (>4h)": {
      ferramentas: ["ocra", "rodgers", "nasa"],
      acoes: [MONITORAR, PAUSAS, RODIZIO, [O, "Intercalar a operação contínua com tarefas de outra natureza (abastecimento, inspeção, registros)", B, 2], [G, "Disponibilizar assento/apoio para alternância postural durante a operação", B, 2], [E, "Automatizar ou dividir a operação contínua para que nenhum trabalhador a execute por mais de 4 h seguidas", A, 3]],
    },
    "Intervalo de descanso insuficiente (<1h/dia)": {
      ferramentas: ["nr17", "nasa"],
      acoes: [MONITORAR, [O, "Garantir o intervalo intrajornada de no mínimo 1 h (jornadas acima de 6 h), com controle de ponto", B, 1], [O, "Instituir pausas curtas adicionais nas atividades de maior exigência", B, 2], [G, "Disponibilizar local adequado de descanso, refeição e hidratação próximo ao posto", M, 2]],
    },
    "Dias de descanso insuficientes (1x semana)": {
      ferramentas: ["nr17", "ergos", "nasa"],
      acoes: [MONITORAR, [O, "Garantir o descanso semanal remunerado de 24 h consecutivas e revisar a escala", B, 1], [O, "Rever a escala de folgas para evitar sequências longas de trabalho sem descanso", M, 2], [O, "Acompanhar indicadores de fadiga e afastamentos nas equipes com escalas extensas", B, 2]],
    },
    "Concentrações desequilibradas de trabalho em um dia, semana, mês ou ano": {
      ferramentas: ["nasa", "ergos"],
      acoes: [MONITORAR, [O, "Planejar a produção e o cronograma para distribuir a carga ao longo do período (nivelamento)", M, 2], [O, "Antecipar tarefas que podem ser feitas fora dos picos (preparação, estoque intermediário)", B, 2], [O, "Prever reforço de equipe nos períodos de pico conhecidos", M, 2], PAUSAS],
    },
    "Concentrações desequilibradas de trabalho entre trabalhadores": {
      ferramentas: ["nasa", "ergos"],
      acoes: [MONITORAR, [O, "Revisar a distribuição de tarefas e metas entre os trabalhadores da equipe", B, 1], RODIZIO, [O, "Capacitar mais trabalhadores para as tarefas concentradas (polivalência)", M, 2], [O, "Balancear a linha / o fluxo de trabalho para equalizar a carga entre os postos", M, 3]],
    },
    "Descanso insuficiente entre turnos (menos de 11h)": {
      ferramentas: ["nr17", "nasa"],
      acoes: [MONITORAR, [O, "Garantir o intervalo mínimo de 11 h entre jornadas (CLT, art. 66) na elaboração das escalas", B, 1], [O, "Evitar dobras de turno e trocas de turno sem o descanso mínimo", B, 2], [O, "Revisar o sentido de rotação dos turnos (manhã → tarde → noite)", M, 2]],
    },
    // ------------------------------------------------ Tipo de trabalho
    "Levantar e carregar objetos pesados": {
      ferramentas: ["niosh", "kimLhc", "reba"],
      obs: "NIOSH para levantamento/abaixamento; KIM-LHC quando também há transporte ou sustentação da carga.",
      acoes: [MONITORAR, [O, "Treinar os trabalhadores em técnicas de manuseio de cargas (carga próxima ao corpo, sem torção do tronco)", B, 0], [O, "Sinalizar o peso das embalagens e fazer o manuseio em dupla quando a carga exceder o limite recomendado", B, 1], [G, "Posicionar as cargas entre a altura dos joelhos e dos ombros (estantes, paletes elevados, mesas niveladoras)", M, 2], [G, "Fornecer carrinhos, paleteiras ou plataformas para o transporte horizontal das cargas", M, 2], [G, "Reduzir o peso unitário das embalagens junto ao fornecedor ou fracionar a carga", M, 2], [G, "Instalar dispositivos de auxílio à elevação (talha, manipulador pneumático, mesa elevatória, ventosa a vácuo)", A, 3], [E, "Eliminar o levantamento manual com mecanização/automação da movimentação (esteira, elevador, empilhadeira)", A, 3], RODIZIO],
    },
    "Trabalho requer grande força": {
      ferramentas: ["strain", "rodgers", "hal", "rula"],
      obs: "Strain Index e HAL quando a força é de mãos/punhos; Rodgers para fadiga por esforço em diferentes segmentos.",
      acoes: [MONITORAR, [O, "Manter ferramentas e equipamentos em bom estado (afiação, lubrificação, regulagem) para reduzir a força exigida", B, 1], [G, "Substituir ferramentas manuais por ferramentas elétricas/pneumáticas com reação de torque controlada", M, 2], [G, "Adequar pegas e cabos (diâmetro, material antiderrapante, formato anatômico) para reduzir a força de preensão", B, 2], [G, "Instalar gabaritos, morsas ou dispositivos de fixação para que as mãos não precisem segurar a peça", M, 2], [G, "Utilizar braços articulados/balanceadores para sustentar ferramentas pesadas", M, 3], [E, "Automatizar a etapa que exige grande força ou redesenhar o processo para eliminá-la", A, 3], RODIZIO, PAUSAS],
    },
    "Forças acentuadas para empurrar e puxar": {
      ferramentas: ["kimPp", "liberty", "reba"],
      obs: "Medir a força inicial e a de sustentação com dinamômetro e comparar com as tabelas Liberty Mutual (Snook & Ciriello).",
      acoes: [MONITORAR, [O, "Fazer manutenção periódica de rodízios, rolamentos e trilhos dos carrinhos/equipamentos", B, 1], [O, "Orientar a empurrar em vez de puxar, com o corpo atrás da carga e as mãos na altura entre cintura e ombros", B, 0], [G, "Substituir rodízios por modelos de maior diâmetro e baixo atrito, adequados ao piso", B, 2], [G, "Regularizar o piso (desníveis, buracos, rampas) nas rotas de movimentação", M, 2], [G, "Instalar pegadores verticais na altura adequada nos carrinhos", B, 2], [G, "Reduzir a carga por viagem (limite de peso por carrinho)", B, 2], [E, "Utilizar equipamentos motorizados (rebocador, paleteira elétrica) ou esteiras para eliminar o esforço manual", A, 3]],
    },
    "Trabalho repetitivo (ciclos idênticos, menores que 30 seg)": {
      ferramentas: ["ocra", "ocraTrad", "strain", "hal", "rula"],
      obs: "Checklist OCRA (ISO 11228-3) como método principal; Strain Index ou HAL para detalhar mãos e punhos.",
      acoes: [MONITORAR, PAUSAS, RODIZIO, [O, "Enriquecer a tarefa: incluir operações de outra natureza no ciclo (preparação, inspeção, abastecimento)", M, 2], [O, "Revisar metas de produção e o ritmo da linha com base no estudo de tempos (sem ritmo imposto excessivo)", M, 2], [G, "Reorganizar o posto para reduzir o número de ações técnicas por ciclo (alimentação por gravidade, dispositivos)", M, 2], [G, "Adequar o posto para manter punhos e ombros em postura neutra durante o ciclo", M, 2], [E, "Automatizar as operações de maior frequência do ciclo", A, 3], TREINO_POSTURA, GINASTICA],
    },
    "Trabalho requer movimentos frequentes de dedo, mão ou braço": {
      ferramentas: ["hal", "ocra", "strain", "rula"],
      acoes: [MONITORAR, PAUSAS, RODIZIO, [G, "Utilizar ferramentas com gatilho longo (vários dedos) ou acionamento automático em vez de gatilho de um dedo", B, 2], [G, "Instalar dispositivos de alimentação/posicionamento de peças para reduzir alcances e manipulações", M, 2], [O, "Rever o método de trabalho para reduzir movimentos desnecessários (estudo de métodos)", M, 2], [E, "Automatizar as operações manuais de alta frequência (parafusamento, encaixe, separação)", A, 3], GINASTICA],
    },
    "Trabalho intensivo com um teclado ou outros dispositivos de entrada de dados": {
      ferramentas: ["rosa", "rula", "nr17"],
      obs: "ROSA para o posto de computador; conferir o Anexo II da NR-17 em teleatendimento.",
      acoes: [MONITORAR, [O, "Orientar o ajuste do posto: cadeira, monitor no nível dos olhos, teclado e mouse próximos e cotovelos a 90°", B, 0], [G, "Fornecer teclado e mouse independentes, com apoio de punho, para quem usa notebook", B, 1], [G, "Fornecer suporte para notebook ou monitor externo com regulagem de altura", B, 1], [G, "Adequar a cadeira (regulagem de altura, assento, encosto lombar e braços)", M, 2], [G, "Disponibilizar apoio para os pés quando os pés não apoiarem no piso", B, 1], [O, "Instituir pausas de 10 min a cada 50 min de digitação contínua (NR-17, item 17.4.3.1)", B, 2], [O, "Alternar a entrada de dados com outras tarefas sem digitação", B, 2], [G, "Utilizar recursos de automação/leitura (código de barras, preenchimento automático, voz) para reduzir a digitação", A, 3]],
    },
    "Trabalho de precisão": {
      ferramentas: ["rula", "nasa", "nr17", "plibel"],
      acoes: [MONITORAR, [G, "Elevar a superfície de trabalho para a altura adequada à tarefa de precisão (acima da altura do cotovelo)", M, 2], [G, "Disponibilizar apoio para antebraços e punhos durante a tarefa", B, 1], [G, "Melhorar a iluminação localizada (luminária de tarefa) e utilizar lentes de aumento/lupas", B, 2], [G, "Instalar dispositivos de fixação/posicionamento da peça", M, 2], PAUSAS, RODIZIO],
    },
    "Elevados requisitos visuais": {
      ferramentas: ["nr17", "ice", "nasa"],
      obs: "Medir a iluminância conforme NHO-11 (Fundacentro) e comparar com os níveis para a tarefa.",
      acoes: [MONITORAR, [G, "Adequar a iluminação geral e localizada aos níveis da NHO-11, sem ofuscamento e reflexos", M, 2], [G, "Utilizar recursos de ampliação (lupas, câmeras, monitores maiores) e aumentar o contraste da tarefa", M, 2], [G, "Posicionar a tarefa na distância e no ângulo de visão adequados, evitando flexão do pescoço", B, 2], [O, "Instituir pausas visuais (olhar ao longe) durante a tarefa", B, 1], [O, "Encaminhar para avaliação oftalmológica periódica (PCMSO)", B, 1], RODIZIO],
    },
    // ------------------------------------------------ Posturas e movimentos
    "Posturas e movimentos desconfortáveis": {
      ferramentas: ["reba", "rula", "qec", "rodgers"],
      obs: "REBA para o corpo inteiro; RULA quando predominam membros superiores, pescoço e tronco.",
      acoes: [MONITORAR, TREINO_POSTURA, [G, "Ajustar a altura de bancadas, máquinas e alcances para manter o tronco ereto e os braços abaixo dos ombros", M, 2], [G, "Reposicionar materiais, comandos e ferramentas na zona de alcance confortável", B, 2], [G, "Instalar dispositivos que inclinem ou girem a peça (mesa giratória, basculante) para evitar torção e flexão", M, 2], [E, "Redesenhar o posto ou o processo para eliminar a postura extrema (ex.: acesso por cima/lado, plataformas)", A, 3], RODIZIO, PAUSAS, GINASTICA],
    },
    "Mudança contínua e/ou altamente frequente nas articulações": {
      ferramentas: ["ocra", "rula", "qec", "hal"],
      acoes: [MONITORAR, [G, "Reorganizar o posto para reduzir desvios de punho, cotovelo e ombro (alturas, alcances, orientação da peça)", M, 2], [G, "Utilizar ferramentas com pega adequada (ex.: cabo em pistola ou reto conforme o plano de trabalho)", B, 2], RODIZIO, PAUSAS, [E, "Automatizar os movimentos de maior amplitude e frequência", A, 3], GINASTICA],
    },
    "Longa duração de posição restritiva": {
      ferramentas: ["rula", "reba", "rodgers", "qec"],
      obs: "Verificar os tempos de manutenção de postura estática (ISO 11226).",
      acoes: [MONITORAR, [G, "Disponibilizar assento, apoio semi-sentado ou apoios corporais para alternância postural", B, 1], [G, "Ampliar o espaço do posto para permitir mudanças de posição", M, 2], [O, "Instituir micropausas para mudança de postura e alongamento", B, 1], RODIZIO, [E, "Redesenhar o acesso/posto para eliminar a permanência em posição restrita (ex.: ajoelhado, agachado, deitado)", A, 3]],
    },
    "Caminhada de longa duração e/ou longa distância (horizontal bem como numa superfície inclinada)": {
      ferramentas: ["plibel", "nr17", "reba"],
      acoes: [MONITORAR, [O, "Reorganizar o layout/fluxo para reduzir os deslocamentos (materiais e equipamentos próximos ao ponto de uso)", M, 2], [G, "Disponibilizar meios de transporte interno (bicicleta, carro elétrico, esteira) para longas distâncias", A, 3], [G, "Manter as rotas regulares, sinalizadas e com corrimão nas rampas", M, 2], [O, "Fornecer calçado de segurança adequado e confortável para longas caminhadas", B, 1], PAUSAS],
    },
    "Subida de escada frequente": {
      ferramentas: ["plibel", "nr17"],
      acoes: [MONITORAR, [O, "Planejar as tarefas para reduzir o número de subidas (agrupar atividades por nível)", B, 1], [G, "Adequar as escadas (corrimão dos dois lados, degraus regulares e antiderrapantes) conforme NR-12/NR-08", M, 2], [G, "Instalar elevador, monta-carga ou sistema de içamento para materiais", A, 3], [E, "Reposicionar comandos/pontos de inspeção no nível do piso para eliminar a subida", A, 3], RODIZIO],
    },
    "Trabalho prolongado em posição sentada/de pé": {
      ferramentas: ["rosa", "reba", "plibel", "nr17"],
      obs: "ROSA para posto sentado com computador; REBA/PLIBEL para trabalho em pé.",
      acoes: [MONITORAR, [G, "Disponibilizar assento para descanso nos postos em pé (NR-17, item 17.6.7) ou posto que permita alternar sentado/em pé", B, 1], [G, "Fornecer tapete antifadiga nos postos em pé", B, 1], [G, "Adequar a cadeira (regulagens) e disponibilizar apoio para os pés nos postos sentados", M, 2], [O, "Instituir pausas para alternância postural e movimentação", B, 1], RODIZIO, [G, "Adotar mesa com regulagem elétrica de altura (sit-stand)", M, 3]],
    },
    // ------------------------------------------------ Espaco de trabalho e fatores da tarefa
    "Espaço de trabalho inadequado que force uma postura desconfortável ou movimento restritivo": {
      ferramentas: ["reba", "plibel", "qec", "nr17"],
      acoes: [MONITORAR, [G, "Ampliar ou reorganizar o espaço do posto (remover obstáculos, liberar área para pernas e pés)", M, 2], [G, "Reposicionar equipamentos e materiais para permitir postura neutra", M, 2], [E, "Redesenhar o posto/acesso conforme as dimensões antropométricas da população (NR-17, item 17.6)", A, 3], PAUSAS],
    },
    "Layout da estação de trabalho que force movimento excessivo ou posturas desconfortáveis": {
      ferramentas: ["reba", "rula", "plibel", "nr17"],
      acoes: [MONITORAR, [G, "Reorganizar o layout: itens de uso frequente na zona de alcance primária, à frente do trabalhador", B, 2], [G, "Utilizar suportes, caixas inclinadas e alimentação por gravidade", B, 2], [O, "Padronizar a organização do posto (5S) com demarcação dos locais de cada item", B, 1], [E, "Redesenhar a estação conforme o fluxo da tarefa para eliminar deslocamentos e torções", A, 3]],
    },
    "Altura e dimensões inadequadas da superfície de trabalho": {
      ferramentas: ["rula", "reba", "rosa", "nr17"],
      acoes: [MONITORAR, [G, "Ajustar a altura da superfície conforme a tarefa (precisão: acima do cotovelo; leve: no cotovelo; pesada: abaixo do cotovelo)", M, 2], [G, "Instalar bancadas com regulagem de altura ou plataformas/estrados ajustáveis", M, 2], [G, "Garantir espaço livre para pernas e joelhos sob a superfície", B, 2], [G, "Disponibilizar apoio para os pés quando a altura não puder ser ajustada", B, 1]],
    },
    "Manuseio de objetos de trabalho acima do ombro ou abaixo do joelho": {
      ferramentas: ["reba", "niosh", "rula", "kimLhc"],
      acoes: [MONITORAR, [O, "Armazenar os itens mais pesados e mais usados entre a altura dos joelhos e dos ombros", B, 1], [G, "Utilizar paleteiras pantográficas, mesas elevatórias ou estantes com prateleiras ajustáveis", M, 2], [G, "Disponibilizar plataformas/escadas seguras para acesso a níveis altos", B, 2], [E, "Redesenhar a armazenagem/alimentação para eliminar o manuseio fora da faixa ombro–joelho", A, 3]],
    },
    "Espaço de trabalho que force o trabalhador a manter a mesma postura de trabalho": {
      ferramentas: ["rula", "rodgers", "reba"],
      acoes: [MONITORAR, [G, "Adequar o posto para permitir alternância postural (assento, apoio, área livre)", M, 2], [O, "Instituir micropausas para mudança de posição", B, 1], RODIZIO, GINASTICA],
    },
    "Espaço de trabalho que seja pesado e/ou requeira grande força física": {
      ferramentas: ["rodgers", "strain", "kimLhc", "reba"],
      acoes: [MONITORAR, [G, "Instalar dispositivos auxiliares (talhas, manipuladores, balanceadores) para as tarefas de maior esforço", A, 3], [G, "Substituir equipamentos manuais pesados por versões leves ou acionadas", M, 2], RODIZIO, PAUSAS, [E, "Mecanizar a tarefa de maior exigência física", A, 3]],
    },
    "Objetos de trabalho difíceis de manusear ou escorregadios": {
      ferramentas: ["strain", "reba", "ocra", "plibel"],
      acoes: [MONITORAR, [G, "Adotar embalagens com pegas/alças adequadas e superfícies antiderrapantes", B, 2], [O, "Fornecer luvas com boa aderência e no tamanho correto", B, 1], [G, "Utilizar dispositivos de pega (ventosas, garras, pinças) para objetos lisos ou de formato irregular", M, 2], [O, "Manter peças e mãos limpas e secas (controle de óleo/umidade na origem)", B, 1]],
    },
    "Ambiente de trabalho e/ou objetos manuseados que sejam quentes/frios": {
      ferramentas: ["nr17", "ice", "plibel"],
      obs: "Avaliação quantitativa do calor conforme NR-15 Anexo 3 / NHO-06 quando aplicável.",
      acoes: [MONITORAR, [O, "Fornecer luvas com isolamento térmico adequado e que preservem a destreza", B, 1], [G, "Isolar termicamente pegas, cabos e superfícies de contato", M, 2], [G, "Utilizar dispositivos para manusear peças quentes/frias sem contato direto", M, 2], [O, "Instituir pausas de recuperação térmica e hidratação", B, 2]],
    },
    "Tensão de contato alta ou pressão local que age no corpo": {
      ferramentas: ["plibel", "ocra", "qec"],
      acoes: [MONITORAR, [G, "Arredondar e acolchoar bordas, quinas e superfícies de apoio (punhos, antebraços, coxas, joelhos)", B, 2], [G, "Adequar ferramentas para não comprimir a palma da mão (cabo mais longo e largo)", B, 2], [O, "Fornecer joelheiras/protetores quando o apoio de joelhos for inevitável", B, 1], [E, "Eliminar o uso da mão/joelho como ferramenta de impacto ou apoio (dispositivo/ferramenta específica)", M, 3]],
    },
    // ------------------------------------------------ Fatores psicossociais
    "Sobrecarga ou subcarga mental": {
      ferramentas: ["nasa", "ergos"],
      obs: "Complementar com o questionário HSE-IT do módulo Riscos Psicossociais (ISO 45003).",
      acoes: [MONITORAR, PARTICIPACAO, [O, "Rever a distribuição de tarefas e prioridades com a liderança (clareza de demandas)", B, 1], [O, "Disponibilizar procedimentos, checklists e apoio à decisão para reduzir a carga de memória", B, 2], [O, "Enriquecer o conteúdo das tarefas monótonas (subcarga) com rodízio e participação", M, 2], PAUSAS, [O, "Capacitar os trabalhadores e as lideranças para a tarefa e a gestão da carga de trabalho", M, 2]],
    },
    "Pressão de tempo e altas demandas": {
      ferramentas: ["nasa", "ergos"],
      obs: "Complementar com o questionário HSE-IT (dimensão Demandas).",
      acoes: [MONITORAR, PARTICIPACAO, [O, "Revisar metas, prazos e ritmo de produção com base em estudo de tempos e na capacidade da equipe", M, 2], [O, "Planejar a demanda para evitar urgências recorrentes e definir prioridades com clareza", M, 2], [O, "Dimensionar a equipe conforme a demanda real", A, 3], PAUSAS],
    },
    "Estresse relacionado ao trabalho": {
      ferramentas: ["ergos", "nasa"],
      obs: "Avaliar com o HSE-IT do módulo Riscos Psicossociais e tratar no plano de ação psicossocial.",
      acoes: [MONITORAR, PARTICIPACAO, [O, "Aplicar a avaliação psicossocial (HSE-IT / ISO 45003) no setor e tratar os fatores identificados", M, 2], [O, "Capacitar as lideranças em gestão de pessoas, comunicação e prevenção de assédio", M, 2], [O, "Disponibilizar canal de escuta e programa de apoio ao trabalhador", M, 2], [O, "Rever a organização do trabalho nas fontes de estresse identificadas (metas, conflitos, recursos)", M, 3]],
    },
    "Baixa satisfação no trabalho": {
      ferramentas: ["ergos", "nasa"],
      acoes: [MONITORAR, PARTICIPACAO, [O, "Realizar pesquisa de clima e devolutiva aos trabalhadores", B, 1], [O, "Implantar reconhecimento e feedback periódico", B, 2], [O, "Oferecer capacitação e perspectivas de desenvolvimento", M, 2]],
    },
    "Falta de autonomia (baixa influência, controle baixo)": {
      ferramentas: ["ergos", "nasa"],
      acoes: [MONITORAR, PARTICIPACAO, [O, "Permitir que o trabalhador participe da organização do próprio trabalho (ordem das tarefas, pausas, métodos)", B, 2], [O, "Incluir os trabalhadores nas decisões de mudança do posto/processo (ergonomia participativa)", M, 2], [O, "Rever regras rígidas de ritmo e controle que não sejam necessárias ao processo", M, 3]],
    },
    "Apoio Social": {
      ferramentas: ["ergos", "nasa"],
      acoes: [MONITORAR, PARTICIPACAO, [O, "Promover reuniões de equipe periódicas e canais de comunicação com a liderança", B, 1], [O, "Definir quem apoia cada função nas dificuldades (referência técnica, padrinho para novatos)", B, 2], [O, "Capacitar as lideranças para apoio e acompanhamento da equipe", M, 2]],
    },
    // ------------------------------------------------ Fatores do meio ambiente
    "Piso escorregadio e/ou irregular": {
      ferramentas: ["nr17", "plibel"],
      acoes: [MONITORAR, [O, "Manter rotina de limpeza e contenção de vazamentos (óleo, água) com sinalização de piso molhado", B, 1], [G, "Corrigir desníveis, buracos e emendas do piso", M, 2], [G, "Aplicar revestimento ou faixas antiderrapantes nas áreas críticas", M, 2], [O, "Fornecer calçado com solado antiderrapante", B, 1]],
    },
    "Vibração em todo o corpo ou vibração na mão e braço": {
      ferramentas: ["plibel", "ocra", "nr17"],
      obs: "Avaliação quantitativa conforme NHO-09 (corpo inteiro) e NHO-10 (mãos e braços) / NR-15 Anexo 8.",
      acoes: [MONITORAR, [O, "Fazer manutenção preventiva de máquinas, ferramentas e veículos para reduzir a vibração", B, 1], [G, "Substituir ferramentas por modelos de baixa vibração e utilizar empunhaduras antivibratórias", M, 2], [G, "Instalar assentos com suspensão/amortecimento em veículos e máquinas", M, 2], [O, "Limitar o tempo de exposição por meio de rodízio", B, 2], [E, "Substituir o processo vibratório por outro método (ex.: corte/acabamento automatizado)", A, 3]],
    },
    "Ambiente de trabalho extremamente quente ou frio": {
      ferramentas: ["nr17", "ice"],
      obs: "Conforto térmico conforme NR-17 (item 17.8.4); sobrecarga térmica pela NR-15 Anexo 3 / NHO-06.",
      acoes: [MONITORAR, [O, "Garantir água potável fresca e pausas de hidratação/recuperação térmica", B, 1], [G, "Adequar a climatização/ventilação do ambiente (exaustão, ventiladores, ar-condicionado, barreiras radiantes)", M, 2], [O, "Fornecer vestimentas adequadas à temperatura (frio/calor)", B, 1], [O, "Programar as tarefas mais pesadas para os horários de menor temperatura", B, 2], [G, "Isolar fontes de calor e criar áreas de descanso climatizadas", A, 3]],
    },
    "Condições visuais precárias (iluminação insuficiente)": {
      ferramentas: ["nr17", "ice"],
      obs: "Medir a iluminância conforme NHO-11 (Fundacentro), exigida pela NR-17.",
      acoes: [MONITORAR, [O, "Fazer manutenção e limpeza periódica das luminárias e troca de lâmpadas queimadas", B, 1], [G, "Adequar o projeto de iluminação aos níveis da NHO-11 para a tarefa", M, 2], [G, "Instalar iluminação localizada na tarefa e eliminar ofuscamentos e reflexos (cortinas, difusores)", B, 2], [O, "Medir novamente a iluminância após as adequações", B, 2]],
    },
    "Ruído inadequado": {
      ferramentas: ["nr17", "ice"],
      obs: "Conforto acústico conforme NR-17 (item 17.8.4.1): até 65 dB(A) em atividades que exigem atenção; exposição ocupacional pela NR-15 Anexo 1 / NHO-01.",
      acoes: [MONITORAR, [O, "Fazer manutenção de máquinas e equipamentos ruidosos", B, 1], [G, "Enclausurar ou isolar as fontes de ruído e aplicar tratamento acústico no ambiente", A, 2], [G, "Separar fisicamente as atividades que exigem concentração das áreas ruidosas", M, 2], [O, "Fornecer protetor auricular quando houver exposição ocupacional, com treinamento de uso", B, 1]],
    },
  };

  // Fator "Outro" (digitado) e fatores fora da lista: recomendacoes gerais.
  const GERAL = {
    ferramentas: ["reba", "rula", "plibel", "nr17"],
    acoes: [MONITORAR, PARTICIPACAO, TREINO_POSTURA, [G, "Adequar o posto de trabalho às características da tarefa e dos trabalhadores (NR-17, item 17.3)", M, 2], RODIZIO, PAUSAS, [E, "Eliminar a exigência na origem por meio de mudança de processo, equipamento ou método", A, 3]],
  };

  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const PORNORM = new Map(Object.keys(R).map((k) => [norm(k), k]));
  function registro(fator) {
    if (!fator) return null;
    if (R[fator]) return R[fator];
    const k = PORNORM.get(norm(fator)); return k ? R[k] : null;
  }
  // Ferramentas recomendadas para o fator: [{ id, sigla, nome, principal }]
  function ferramentasDoFator(fator) {
    const r = registro(fator) || (fator ? GERAL : null); if (!r) return [];
    const F = BI.Ferramentas;
    return r.ferramentas.map((id, i) => { const d = F && F.porId ? F.porId(id) : null; return d ? { id, sigla: d.sigla, nome: d.nome, principal: i === 0 } : null; }).filter(Boolean);
  }
  function observacaoDoFator(fator) { const r = registro(fator); return (r && r.obs) || ""; }
  // Acoes padronizadas: [{ tipo, texto, complexidade, nivelMinimo }] (ordem: hierarquia -> eliminacao, engenharia, organizacional)
  const ORDEM_TIPO = { Eliminacao: 0, Engenharia: 1, Organizacional: 2 };
  function acoesDoFator(fator) {
    const r = registro(fator) || (fator ? GERAL : null); if (!r) return [];
    const vistos = new Set();
    return r.acoes.map(([tipo, texto, complexidade, nivelMinimo, nivelMaximo]) => ({ tipo, texto, complexidade, nivelMinimo, nivelMaximo: nivelMaximo == null ? 4 : nivelMaximo }))
      .filter((a) => (vistos.has(a.texto) ? false : (vistos.add(a.texto), true)))
      .sort((a, b) => ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo]);
  }
  // Recomendadas para o nivel de risco (ordemNivel 0..4): as indicadas ate esse nivel.
  // Risco muito baixo/baixo: so as de manutencao/monitoramento (nivelMinimo <= nivel).
  function acoesParaNivel(fator, ordem) {
    const n = ordem == null || ordem < 0 ? 4 : ordem;
    return acoesDoFator(fator).filter((a) => a.nivelMinimo <= n && a.nivelMaximo >= n);
  }

  BI.Recomendacoes = { FATORES: R, GERAL, ferramentasDoFator, observacaoDoFator, acoesDoFator, acoesParaNivel, norm };
})(window);
