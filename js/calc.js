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

  // As 12 dimensoes do Mapa de Risco (conforme RD) - usadas para calcular
  // "Risco Global" automaticamente na tela de cadastro (nunca digitado a mao).
  const DIMENSOES_RISCO = [
    "Col. Cervical", "Tronco", "Ombros", "Cotovelos", "Punhos", "Maos/Dedos",
    "Joelhos", "Pernas", "Tornozelos", "Pes/Dedos", "Psicossocial/Cognitivo", "Ambiental",
  ];

  const STATUS_RESTRICAO_ORDEM = ["Ativa", "Em Avaliacao", "Encerrada"];

  // ------------------------------------------------------------------
  // Fatores de Risco (Inventario de Riscos) - lista fixa e padronizada,
  // baseada na ISO TS-20646 (mesma referencia do sistema de gestao atual
  // da ElevaLife, visto na tela "Editor do texto" do Laudo). "Grupo" e
  // "Fator" deixam de ser texto livre: o ergonomista percorre esta
  // checklist posto a posto e so os itens marcados "Existe Fator Risco:
  // Sim" entram pontuados no inventario.
  // ------------------------------------------------------------------
  const FATORES_RISCO_ISO20646 = {
    "Jornada de trabalho e concentração no trabalho": [
      "Jornada longa de trabalho de mais de 8h por dia",
      "Longas e frequentes horas extras de trabalho (>2h/dia e >2x na semana)",
      "Longo tempo de operação contínua (>4h)",
      "Intervalo de descanso insuficiente (<1h/dia)",
      "Dias de descanso insuficientes (1x semana)",
      "Concentrações desequilibradas de trabalho em um dia, semana, mês ou ano",
      "Concentrações desequilibradas de trabalho entre trabalhadores",
      "Descanso insuficiente entre turnos (menos de 11h)",
    ],
    "Tipo de trabalho": [
      "Levantar e carregar objetos pesados",
      "Trabalho requer grande força",
      "Forças acentuadas para empurrar e puxar",
      "Trabalho repetitivo (ciclos idênticos, menores que 30 seg)",
      "Trabalho requer movimentos frequentes de dedo, mão ou braço",
      "Trabalho intensivo com um teclado ou outros dispositivos de entrada de dados",
      "Trabalho de precisão",
      "Elevados requisitos visuais",
    ],
    "Posturas e movimentos": [
      "Posturas e movimentos desconfortáveis",
      "Mudança contínua e/ou altamente frequente nas articulações",
      "Longa duração de posição restritiva",
      "Caminhada de longa duração e/ou longa distância (horizontal bem como numa superfície inclinada)",
      "Subida de escada frequente",
      "Trabalho prolongado em posição sentada/de pé",
    ],
    "Influência do espaço de trabalho e fatores da tarefa": [
      "Espaço de trabalho inadequado que force uma postura desconfortável ou movimento restritivo",
      "Layout da estação de trabalho que force movimento excessivo ou posturas desconfortáveis",
      "Altura e dimensões inadequadas da superfície de trabalho",
      "Manuseio de objetos de trabalho acima do ombro ou abaixo do joelho",
      "Espaço de trabalho que force o trabalhador a manter a mesma postura de trabalho",
      "Espaço de trabalho que seja pesado e/ou requeira grande força física",
      "Objetos de trabalho difíceis de manusear ou escorregadios",
      "Ambiente de trabalho e/ou objetos manuseados que sejam quentes/frios",
      "Tensão de contato alta ou pressão local que age no corpo",
    ],
    "Influência do fator psicossocial": [
      "Sobrecarga ou subcarga mental",
      "Pressão de tempo e altas demandas",
      "Estresse relacionado ao trabalho",
      "Baixa satisfação no trabalho",
      "Falta de autonomia (baixa influência, controle baixo)",
      "Apoio Social",
    ],
    "Influência de fatores do meio ambiente": [
      "Piso escorregadio e/ou irregular",
      "Vibração em todo o corpo ou vibração na mão e braço",
      "Ambiente de trabalho extremamente quente ou frio",
      "Condições visuais precárias (iluminação insuficiente)",
      // V 1.28: fator incluido pela ElevaLife
      "Ruído inadequado",
    ],
  };
  // V 1.28: consequencias padrao de cada fator (sem citar doencas: desconforto, fadiga,
  // rendimento, seguranca). O ergonomista escolhe uma ou mais e pode completar o texto.
  const CONSEQUENCIAS_FATOR = {
    "Jornada longa de trabalho de mais de 8h por dia": ["Fadiga física e mental ao longo da jornada", "Redução da atenção e do rendimento no fim do turno", "Tempo de recuperação insuficiente entre as jornadas", "Aumento da probabilidade de erros e incidentes"],
    "Longas e frequentes horas extras de trabalho (>2h/dia e >2x na semana)": ["Fadiga acumulada ao longo da semana", "Recuperação insuficiente entre as jornadas", "Queda de concentração e de produtividade", "Aumento da probabilidade de erros e incidentes"],
    "Longo tempo de operação contínua (>4h)": ["Fadiga muscular localizada", "Desconforto por falta de variação de postura", "Redução da atenção na tarefa", "Queda de rendimento"],
    "Intervalo de descanso insuficiente (<1h/dia)": ["Recuperação física insuficiente durante a jornada", "Fadiga acumulada", "Cansaço e desconforto no segundo período", "Redução da atenção"],
    "Dias de descanso insuficientes (1x semana)": ["Fadiga acumulada ao longo das semanas", "Recuperação física e mental insuficiente", "Desgaste e desmotivação", "Redução do rendimento"],
    "Concentrações desequilibradas de trabalho em um dia, semana, mês ou ano": ["Picos de sobrecarga física e mental", "Fadiga nos períodos de pico", "Pressão de tempo e aumento de erros", "Desconforto pelo ritmo intenso"],
    "Concentrações desequilibradas de trabalho entre trabalhadores": ["Sobrecarga de parte da equipe", "Fadiga desigual entre os trabalhadores", "Insatisfação e conflitos na equipe", "Queda de rendimento"],
    "Descanso insuficiente entre turnos (menos de 11h)": ["Sono e recuperação insuficientes", "Fadiga no início da jornada seguinte", "Redução do estado de alerta", "Aumento da probabilidade de erros e incidentes"],
    "Levantar e carregar objetos pesados": ["Sobrecarga na coluna lombar", "Fadiga muscular de membros superiores e tronco", "Desconforto e dor nas costas", "Risco de entorses e acidentes no manuseio"],
    "Trabalho requer grande força": ["Sobrecarga musculoesquelética", "Fadiga muscular localizada", "Desconforto em mãos, punhos e ombros", "Redução do rendimento ao longo da jornada"],
    "Forças acentuadas para empurrar e puxar": ["Sobrecarga em ombros, coluna e membros inferiores", "Fadiga muscular", "Desconforto nas costas e nos ombros", "Risco de escorregões e quedas durante o esforço"],
    "Trabalho repetitivo (ciclos idênticos, menores que 30 seg)": ["Fadiga muscular localizada em membros superiores", "Desconforto em mãos, punhos e cotovelos", "Monotonia e queda da atenção", "Redução do rendimento"],
    "Trabalho requer movimentos frequentes de dedo, mão ou braço": ["Fadiga de mãos, punhos e antebraços", "Desconforto e formigamento nas mãos", "Sobrecarga de tendões e articulações", "Redução da precisão ao longo da jornada"],
    "Trabalho intensivo com um teclado ou outros dispositivos de entrada de dados": ["Fadiga em dedos, punhos e antebraços", "Desconforto em ombros e pescoço", "Tensão muscular por postura estática", "Fadiga visual"],
    "Trabalho de precisão": ["Fadiga visual", "Tensão muscular em pescoço e ombros", "Esforço de concentração e cansaço mental", "Desconforto por postura estática"],
    "Elevados requisitos visuais": ["Fadiga visual (olhos cansados e ardor)", "Dor de cabeça e desconforto", "Tensão em pescoço e ombros ao aproximar o rosto da tarefa", "Queda de atenção e da qualidade"],
    "Posturas e movimentos desconfortáveis": ["Desconforto e dor em coluna, ombros e pescoço", "Fadiga muscular", "Sobrecarga das articulações", "Queda de rendimento"],
    "Mudança contínua e/ou altamente frequente nas articulações": ["Sobrecarga das articulações envolvidas", "Fadiga muscular", "Desconforto articular", "Redução do rendimento"],
    "Longa duração de posição restritiva": ["Fadiga por contração muscular estática", "Desconforto e rigidez muscular", "Redução da circulação nos membros", "Queda de rendimento"],
    "Caminhada de longa duração e/ou longa distância (horizontal bem como numa superfície inclinada)": ["Fadiga de membros inferiores", "Desconforto em pés, joelhos e quadris", "Cansaço geral", "Risco de tropeços e quedas"],
    "Subida de escada frequente": ["Fadiga de membros inferiores", "Sobrecarga nos joelhos", "Cansaço cardiorrespiratório", "Risco de quedas"],
    "Trabalho prolongado em posição sentada/de pé": ["Desconforto nas costas e nos membros inferiores", "Sensação de pernas pesadas e inchaço", "Fadiga postural", "Redução da circulação"],
    "Espaço de trabalho inadequado que force uma postura desconfortável ou movimento restritivo": ["Posturas forçadas e desconfortáveis", "Fadiga muscular", "Desconforto em coluna e ombros", "Risco de batidas e acidentes no espaço restrito"],
    "Layout da estação de trabalho que force movimento excessivo ou posturas desconfortáveis": ["Movimentos excessivos e desnecessários", "Fadiga muscular", "Desconforto em ombros e coluna", "Perda de produtividade"],
    "Altura e dimensões inadequadas da superfície de trabalho": ["Flexão ou elevação excessiva de tronco e braços", "Desconforto em pescoço, ombros e lombar", "Fadiga postural", "Queda de rendimento"],
    "Manuseio de objetos de trabalho acima do ombro ou abaixo do joelho": ["Sobrecarga em ombros e coluna lombar", "Fadiga muscular", "Desconforto ao alcançar ou abaixar", "Risco de queda de objetos"],
    "Espaço de trabalho que force o trabalhador a manter a mesma postura de trabalho": ["Fadiga por postura estática", "Desconforto e rigidez muscular", "Redução da circulação", "Queda de rendimento"],
    "Espaço de trabalho que seja pesado e/ou requeira grande força física": ["Sobrecarga física", "Fadiga muscular", "Desconforto em coluna e membros", "Risco de acidentes por esforço"],
    "Objetos de trabalho difíceis de manusear ou escorregadios": ["Aumento da força de preensão", "Fadiga de mãos e antebraços", "Risco de queda do objeto e de cortes", "Desconforto nas mãos"],
    "Ambiente de trabalho e/ou objetos manuseados que sejam quentes/frios": ["Desconforto térmico nas mãos", "Redução da destreza e da sensibilidade", "Risco de queimaduras leves por contato", "Fadiga"],
    "Tensão de contato alta ou pressão local que age no corpo": ["Desconforto e dor no ponto de contato", "Compressão dos tecidos", "Formigamento e dormência", "Redução da circulação local"],
    "Sobrecarga ou subcarga mental": ["Cansaço mental", "Redução da atenção e da concentração", "Desmotivação", "Aumento de erros"],
    "Pressão de tempo e altas demandas": ["Tensão e cansaço mental", "Aceleração do ritmo e posturas inadequadas", "Aumento de erros e retrabalho", "Insatisfação"],
    "Estresse relacionado ao trabalho": ["Tensão e irritabilidade", "Cansaço mental", "Queda de rendimento", "Conflitos interpessoais"],
    "Baixa satisfação no trabalho": ["Desmotivação", "Queda de engajamento e produtividade", "Aumento de faltas", "Rotatividade"],
    "Falta de autonomia (baixa influência, controle baixo)": ["Desmotivação", "Sensação de pouca influência sobre o próprio trabalho", "Tensão e cansaço mental", "Queda de engajamento"],
    "Apoio Social": ["Sensação de isolamento", "Sobrecarga por falta de ajuda", "Desmotivação", "Conflitos na equipe"],
    "Piso escorregadio e/ou irregular": ["Risco de escorregões, tropeços e quedas", "Esforço adicional para manter o equilíbrio", "Desconforto ao caminhar", "Insegurança na movimentação"],
    "Vibração em todo o corpo ou vibração na mão e braço": ["Desconforto e fadiga", "Formigamento e dormência nas mãos", "Redução da precisão dos movimentos", "Desconforto na coluna"],
    "Ambiente de trabalho extremamente quente ou frio": ["Desconforto térmico", "Fadiga e cansaço", "Redução da atenção e do rendimento", "Redução da destreza manual (frio)"],
    "Condições visuais precárias (iluminação insuficiente)": ["Fadiga visual", "Posturas forçadas para enxergar a tarefa", "Aumento de erros", "Risco de acidentes por baixa visibilidade"],
    "Ruído inadequado": ["Desconforto auditivo", "Dificuldade de comunicação e de concentração", "Irritabilidade e cansaço", "Aumento de erros e queda de rendimento"],
  };
  function consequenciasDoFator(fator) { return CONSEQUENCIAS_FATOR[fator] || []; }
  const GRUPOS_FATOR_RISCO = Object.keys(FATORES_RISCO_ISO20646);
  function fatoresDoGrupo(grupo) { return FATORES_RISCO_ISO20646[grupo] || []; }

  // ------------------------------------------------------------------
  // Matriz de Risco (Gravidade x Probabilidade, conforme NR-01) -
  // configuravel por empresa (campo "Matriz Risco" no Cadastro de
  // Cliente), em vez de uma formula unica fixa. Cada empresa/cliente
  // pode usar uma matriz de tamanho diferente (3x3, 4x4, 5x5, ou uma
  // variante propria como a "Matriz 5x5 Gerdau"), e o numero de niveis
  // de risco resultante depende do tamanho da matriz escolhida.
  // ------------------------------------------------------------------
  const MATRIZ_PADRAO = "Matriz 5x5";

  // pontuacao = (probIdx+1) * (gravIdx+1) (escala classica de matriz de
  // risco); nivelIdx = faixa da pontuacao normalizada em N niveis iguais.
  function construirGradeSimetrica(qtdNiveis) {
    const grade = [];
    const maxPontuacao = qtdNiveis * qtdNiveis;
    for (let p = 0; p < qtdNiveis; p++) {
      const linha = [];
      for (let g = 0; g < qtdNiveis; g++) {
        const pontuacao = (p + 1) * (g + 1);
        const nivelIdx = Math.min(qtdNiveis - 1, Math.floor(((pontuacao - 1) / maxPontuacao) * qtdNiveis));
        linha.push({ pontuacao, nivelIdx });
      }
      grade.push(linha);
    }
    return grade;
  }

  // V 1.27: matrizes modelo ElevaLife (enviadas pelo Alexandre em 06/10/2026 e 07/10/2026). A graduacao
  // de cada celula vem da matriz modelo (cores: azul-claro muito baixo, verde baixo, amarelo moderado,
  // vermelho alto, roxo muito alto/altissimo) - nao de uma faixa generica de pontuacao, porque a mesma
  // pontuacao pode ter graduacoes diferentes (ex.: na 5x5, 2x2 = 4 e Baixo, mas 1x4 = 4 e Moderado).
  // grade[probabilidade][gravidade] = indice em "niveis"; pontuacao = probabilidade x gravidade.
  // Os valores gravados da escala continuam os mesmos ("Baixa", "Media"...); "rotulos" e so exibicao.
  const MATRIZES_RISCO = {
    "Matriz 3x3": {
      escala: ["Baixa", "Media", "Alta"],
      niveis: ["Baixo", "Moderado", "Alto"],
      rotulos: { Baixa: "Leve", Media: "Média", Alta: "Alta" },
      modelo: [[0, 0, 1], [0, 1, 2], [1, 2, 2]],
    },
    "Matriz 4x4": {
      escala: ["Baixa", "Media", "Alta", "Muito Alta"],
      niveis: ["Muito Baixo", "Baixo", "Moderado", "Alto", "Muito Alto"],
      rotulos: { Baixa: "Leve", Media: "Média", Alta: "Alta", "Muito Alta": "Muito Alta" },
      modelo: [[0, 1, 1, 2], [1, 1, 2, 3], [1, 2, 2, 3], [2, 3, 3, 4]],
    },
    "Matriz 5x5": {
      escala: ["Muito Baixa", "Baixa", "Media", "Alta", "Muito Alta"],
      niveis: ["Muito Baixo", "Baixo", "Moderado", "Alto", "Altíssimo"],
      rotulos: { "Muito Baixa": "Muito Baixa", Baixa: "Baixa", Media: "Moderada", Alta: "Alta", "Muito Alta": "Muito Alta" },
      modelo: [[0, 1, 1, 2, 2], [1, 1, 2, 2, 3], [1, 2, 2, 3, 4], [2, 2, 3, 4, 4], [2, 3, 4, 4, 4]],
    },
    // V 1.32: matriz da Gerdau (3.1.3 Matriz de Riscos, enviada pelo Alexandre em 08/10/2026). A grade de
    // graduacao e a mesma da 5x5 ElevaLife; mudam os nomes. Probabilidade (indice pelo % do tempo amostral):
    // Muito Baixa, Baixa, Media, Alta, Muito Alta. Severidade (lesao/afastamento): Brando, Moderado, Serio,
    // Critico, Muito Critico. Graduacoes: Irrelevante, Toleravel, Moderado, Alto, Intoleravel.
    // Os valores gravados continuam os da escala ("Muito Baixa"..."Muito Alta"); os nomes da severidade
    // sao so exibicao (rotulosSeveridade).
    "Matriz 5x5 Gerdau": {
      escala: ["Muito Baixa", "Baixa", "Media", "Alta", "Muito Alta"],
      niveis: ["Irrelevante", "Tolerável", "Moderado", "Alto", "Intolerável"],
      rotulos: { "Muito Baixa": "Muito Baixa", Baixa: "Baixa", Media: "Média", Alta: "Alta", "Muito Alta": "Muito Alta" },
      rotulosSeveridade: { "Muito Baixa": "Brando", Baixa: "Moderado", Media: "Sério", Alta: "Crítico", "Muito Alta": "Muito Crítico" },
      modelo: [[0, 1, 1, 2, 2], [1, 1, 2, 2, 3], [1, 2, 2, 3, 4], [2, 2, 3, 4, 4], [2, 3, 4, 4, 4]],
    },
  };
  Object.keys(MATRIZES_RISCO).forEach((nome) => {
    const m = MATRIZES_RISCO[nome];
    m.grade = construirGradeSimetrica(m.escala.length);
    if (m.modelo) m.grade.forEach((linha, p) => linha.forEach((c, g) => { c.nivelIdx = m.modelo[p][g]; }));
  });
  const NOMES_MATRIZ_RISCO = Object.keys(MATRIZES_RISCO);

  function matrizPorNome(nomeMatriz) { return MATRIZES_RISCO[nomeMatriz] || MATRIZES_RISCO[MATRIZ_PADRAO]; }
  function escalaDaMatriz(nomeMatriz) { return matrizPorNome(nomeMatriz).escala; }
  // Rotulo de exibicao de um valor da escala (ex.: na 3x3, "Baixa" aparece como "Leve").
  // V 1.32: eixo "severidade" usa os nomes proprios da severidade quando a matriz os tem (ex.: Gerdau).
  function rotuloEscala(nomeMatriz, valor, eixo) {
    const m = matrizPorNome(nomeMatriz);
    const r = (eixo === "severidade" && m.rotulosSeveridade) || m.rotulos;
    return (r && r[valor]) || (valor === "Media" ? "Média" : valor);
  }
  function celulaDaMatriz(nomeMatriz, probabilidade, gravidade) {
    const m = matrizPorNome(nomeMatriz);
    const p = m.escala.indexOf(probabilidade);
    const g = m.escala.indexOf(gravidade);
    if (p < 0 || g < 0) return null;
    return Object.assign({ nivel: m.niveis[m.grade[p][g].nivelIdx] }, m.grade[p][g]);
  }
  // V 1.32: graduacoes da matriz (da menor para a maior) e posicao de qualquer graduacao numa escala
  // unica de 0 a 4 (muito baixo/trivial/irrelevante ... muito alto/altissimo/intoleravel), para comparar
  // niveis de matrizes diferentes e os niveis gerais do painel.
  function niveisDaMatriz(nomeMatriz) { return matrizPorNome(nomeMatriz).niveis.slice(); }
  function ordemNivel(nivel) {
    const t = String(nivel || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (!t || t === "-") return -1;
    if (/muito baix|trivial|irrelev|desprez/.test(t)) return 0;
    if (/intoler|muito alt|altissim/.test(t)) return 4;
    if (/^baix|^leve|^toler/.test(t)) return 1;
    if (/moder|^medi/.test(t)) return 2;
    if (/^alt/.test(t)) return 3;
    return -1;
  }
  function nivelDaMatriz(nomeMatriz, probabilidade, gravidade) {
    const celula = celulaDaMatriz(nomeMatriz, probabilidade, gravidade);
    return celula ? celula.nivel : "";
  }
  function pontuacaoDaMatriz(nomeMatriz, probabilidade, gravidade) {
    const celula = celulaDaMatriz(nomeMatriz, probabilidade, gravidade);
    return celula ? celula.pontuacao : null;
  }
  // Matriz configurada para uma empresa (le "Matriz Risco" no cadastro do
  // Cliente; cai no padrao 5x5 se a empresa ainda nao tiver o campo).
  function matrizDoCliente(linhasCliente, nomeCliente) {
    const doc = (linhasCliente || []).find((c) => c.Cliente === nomeCliente);
    return (doc && doc["Matriz Risco"]) || MATRIZ_PADRAO;
  }

  // ------------------------------------------------------------------
  // AET (Analise Ergonomica do Trabalho) - classificacao de arquivo por
  // CONTEUDO, nunca por extensao/tipo (pedido explicito do Leo: "nao rotule
  // o excel como analise e o PDF como inventario de riscos... ele precisa
  // ler excel e pdf e com base na leitura entender o que e cada"). O mesmo
  // classificador serve tanto pra um Excel (texto = nomes das abas +
  // cabecalhos/primeiras linhas, montado em app.js via SheetJS) quanto pra
  // um PDF (texto = texto extraido das paginas via pdf.js) - o classificador
  // em si so enxerga texto, nunca sabe de onde ele veio. O resultado e
  // sempre uma pre-classificacao (autopreenchida no formulario) que o
  // ergonomista confirma ou corrige manualmente antes de salvar.
  // ------------------------------------------------------------------
  const PALAVRAS_CHAVE_AET = {
    "Mapa de Risco Ergonômico": [
      "mapa de risco", "matriz de risco", "gravidade", "probabilidade",
      "criticidade", "graduacao do risco", "graduação do risco", "nivel de risco",
      "nível de risco", "fator de risco", "inventario de riscos", "inventário de riscos",
    ],
    "Plano de Ação": [
      "plano de acao", "plano de ação", "acao recomendada", "ação recomendada",
      "responsavel", "responsável", "prazo", "status da acao", "status da ação",
      "data de conclusao", "data de conclusão", "acao corretiva", "ação corretiva",
    ],
    "Análise Ergonômica do Trabalho (texto)": [
      "analise ergonomica do trabalho", "análise ergonômica do trabalho", " aet ",
      "metodologia", "introducao", "introdução", "conclusao", "conclusão",
      "recomendacoes e sugestoes", "recomendações e sugestões", "nr-17", "nr 17",
    ],
  };
  const NOMES_CLASSIFICACAO_AET = [
    "Mapa de Risco Ergonômico",
    "Plano de Ação",
    "Mapa de Risco + Plano de Ação",
    "Análise Ergonômica do Trabalho (texto)",
    "Não identificado",
  ];

  function normalizarTextoClassificacao(texto) {
    return " " + String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      + " ";
  }

  // Conta, por categoria, quantos termos-chave aparecem no texto (mesmo
  // termo normalizado sem acento, pra casar tanto "ação" quanto "acao" nos
  // dois lados - lista de palavras-chave e texto de entrada).
  function pontuarClassificacaoAET(texto) {
    const alvo = normalizarTextoClassificacao(texto);
    const pontos = {};
    Object.keys(PALAVRAS_CHAVE_AET).forEach((categoria) => {
      pontos[categoria] = PALAVRAS_CHAVE_AET[categoria].reduce((soma, termo) => {
        return soma + (alvo.indexOf(normalizarTextoClassificacao(termo).trim()) >= 0 ? 1 : 0);
      }, 0);
    });
    return pontos;
  }

  // Classifica um texto (de um Excel ou de um PDF - ver comentario acima)
  // num dos 5 rotulos fixos de NOMES_CLASSIFICACAO_AET, sempre a MELHOR
  // estimativa por contagem de palavras-chave - nunca 100% garantida, por
  // isso o formulario sempre pede confirmacao do ergonomista.
  function classificarTextoAET(texto) {
    const pontos = pontuarClassificacaoAET(texto);
    const temMapa = pontos["Mapa de Risco Ergonômico"] > 0;
    const temPlano = pontos["Plano de Ação"] > 0;
    const temAnalise = pontos["Análise Ergonômica do Trabalho (texto)"] > 0;
    if (temMapa && temPlano) return "Mapa de Risco + Plano de Ação";
    if (temMapa) return "Mapa de Risco Ergonômico";
    if (temPlano) return "Plano de Ação";
    if (temAnalise) return "Análise Ergonômica do Trabalho (texto)";
    return "Não identificado";
  }

  // Duas paletas fixas e distintas (nunca misturadas): Mapa de Risco
  // (Baixo=verde, Moderado=amarelo, Alto=vermelho, Muito Alto=roxo) e
  // Plano de Acao / Status (Nao Iniciado=cinza, Em Andamento=azul,
  // Concluida=verde-agua, Concluida com atraso=laranja, Atrasada=vermelho).
  // Status Restricao (aba Compativeis) reaproveita semanticamente a
  // paleta de acao: Ativa~andamento, Em Avaliacao~nao iniciado,
  // Encerrada~concluida.
  const COR_STATUS = {
    "Baixo": "var(--risco-baixo)",
    "Medio": "var(--risco-moderado)",
    "Alto": "var(--risco-alto)",
    "Muito Alto": "var(--risco-muitoalto)",
    "Nao Iniciado": "var(--acao-nao-iniciado)",
    "Em Andamento": "var(--acao-andamento)",
    "Atrasada": "var(--acao-atrasada)",
    "Concluida com atraso": "var(--acao-atraso)",
    "Concluida": "var(--acao-concluida)",
    "Ativa": "var(--acao-andamento)",
    "Em Avaliacao": "var(--acao-nao-iniciado)",
    "Encerrada": "var(--acao-concluida)",

    // Status do Inventario de Riscos (fatorRisco, pacote "Sistema de Gestao
    // Integrada") - reaproveita semanticamente a paleta de acao, mesmo
    // padrao de Status Restricao acima (nunca uma paleta nova).
    "A validar": "var(--acao-nao-iniciado)",
    "Em andamento": "var(--acao-andamento)",
    "Concluido": "var(--acao-concluida)",
    "Cancelado": "var(--status-neutral)",

    // Graduacao do Risco calculada pela Matriz de Risco (Inventario de
    // Riscos) - "Moderado"/"Altíssimo"/"Muito Baixo" sao os rotulos que a
    // propria matriz ja grava (ver MATRIZES_RISCO acima), por isso entram
    // aqui como chaves adicionais (nunca uma paleta nova: reaproveita as
    // mesmas 4 cores de risco; "Muito Baixo" ganha um tom mais claro).
    "Moderado": "var(--risco-moderado)",
    "Altíssimo": "var(--risco-muitoalto)",
    "Muito Baixo": "var(--risco-muitobaixo)",
    "Trivial": "var(--risco-muitobaixo)",
    // V 1.32: graduacoes da matriz Gerdau
    "Irrelevante": "var(--risco-muitobaixo)",
    "Tolerável": "var(--risco-baixo)",
    "Intolerável": "var(--risco-muitoalto)",
  };
  // V 1.30 - PADRAO ElevaLife de cores (hex fixo, usado nos laudos, nas planilhas e no modulo
  // Psicossocial; a tela usa as mesmas cores pelas variaveis CSS --risco-* e --acao-*).
  const CORES_RISCO_HEX = { muitoBaixo: "8CCBEB", baixo: "2E8B57", moderado: "F2C230", alto: "C62828", muitoAlto: "6A3D9A" };
  const CORES_STATUS_HEX = { naoIniciada: "E8833A", andamento: "F2C230", atrasada: "C62828", concluida: "2E8B57", concluidaAtraso: "1E6B44" };
  const CORES_CLARAS_HEX = ["8CCBEB", "F2C230"]; // fundos claros: texto escuro por cima
  function semAcentoMin(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
  // Cor de uma graduacao de risco (qualquer matriz: Trivial, Muito Baixo, Baixo, Leve, Moderado, Medio, Alto, Muito Alto, Altissimo, Critico).
  function corRiscoHex(nivel) {
    const n = semAcentoMin(nivel);
    if (!n || n === "-") return null;
    if (/muito baix|trivial|desprez|irrelev/.test(n)) return CORES_RISCO_HEX.muitoBaixo;
    if (/muito alt|altissim|critic|intoler/.test(n)) return CORES_RISCO_HEX.muitoAlto;
    if (/^alt/.test(n)) return CORES_RISCO_HEX.alto;
    if (/moder|^medi/.test(n)) return CORES_RISCO_HEX.moderado;
    if (/^baix|^leve|^toler/.test(n)) return CORES_RISCO_HEX.baixo;
    return null;
  }
  // Cor de um status de acao (aceita as chaves internas e os rotulos exibidos).
  function corStatusAcaoHex(st) {
    const n = semAcentoMin(st);
    if (/com atraso|c\/ atraso/.test(n)) return CORES_STATUS_HEX.concluidaAtraso;
    if (/conclu/.test(n)) return CORES_STATUS_HEX.concluida;
    if (/atrasad/.test(n)) return CORES_STATUS_HEX.atrasada;
    if (/andamento/.test(n)) return CORES_STATUS_HEX.andamento;
    if (/nao inici|pendente/.test(n)) return CORES_STATUS_HEX.naoIniciada;
    return null;
  }
  const textoSobreHex = (h) => (CORES_CLARAS_HEX.includes(String(h || "").toUpperCase()) ? "3A2A2E" : "FFFFFF");
  const hexParaRGB = (h) => { const x = String(h || "").replace("#", ""); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; };

  // Uma chave "tem cor definida" quando existe de verdade em COR_STATUS -
  // usado pela UI (tabelas de Cadastro/Registro e detalhamento) pra saber
  // se deve desenhar uma "pill" colorida ou so o texto puro, sem precisar
  // listar os nomes das colunas de classificacao/status em nenhum lugar.
  function temCorStatus(chave) {
    return Object.prototype.hasOwnProperty.call(COR_STATUS, chave);
  }

  // Rotulo de exibicao por nivel de risco - "Medio" (chave interna, usada
  // nos dados e nas comparacoes) e mostrado ao usuario como "Moderado".
  // Nunca trocar a chave interna: so o texto exibido muda.
  const ROTULO_NIVEL = { "Medio": "Moderado" };
  function rotuloNivel(chave) { return ROTULO_NIVEL[chave] || chave; }

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

  // V 1.27: formacao/cargo do profissional nos laudos. Texto gravado todo em maiusculas
  // ("FISIOTERAPEUTA ERGONOMISTA") vira "Fisioterapeuta Ergonomista", mantendo siglas
  // conhecidas (ABERGO, CREFITO, NR...) e preposicoes em minusculas. Texto ja com
  // minusculas fica como foi digitado.
  const SIGLAS_CARGO = ["ABERGO", "CREFITO", "CREA", "CRM", "CRP", "COREN", "CRF", "CRN", "CREF", "CFT", "NR", "NR-17", "NR-01", "ISO", "SESMT", "SST", "MBA", "PHD", "AET", "AEP", "CPE", "CBO", "RT", "TST", "II", "III", "IV", "UFMG", "PUC", "USP", "MG", "SP", "RJ"];
  const MINUSCULAS_CARGO = ["de", "da", "do", "das", "dos", "e", "em", "com", "para", "a", "o", "na", "no", "nas", "nos", "pela", "pelo"];
  function formatarCargo(t) {
    const s = String(t || "").trim();
    if (!s || /[a-zà-ÿ]/.test(s)) return s;
    return s.toLowerCase().replace(/[a-zà-ÿ0-9]+(?:-[a-zà-ÿ0-9]+)*/g, (w, pos) => {
      const up = w.toUpperCase();
      if (SIGLAS_CARGO.includes(up)) return up;
      if (pos > 0 && MINUSCULAS_CARGO.includes(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
  }

  function calcularStatusAcao(dtProgramadaStr, dtConclusaoStr, hoje) {
    const prog = paraData(dtProgramadaStr);
    const concl = paraData(dtConclusaoStr);
    if (!prog && !concl) return "Nao Iniciado";
    if (!prog && concl) return "Concluida";
    if (!concl && prog < hoje) return "Atrasada";
    // V 1.27: acao com prazo definido ja esta em andamento (pedido da diretoria ElevaLife)
    if (!concl) return "Em Andamento";
    if (concl > prog) return "Concluida com atraso";
    return "Concluida";
  }

  // V 1.2: o status exibido leva em conta a "Status Execucao" informada pela
  // pessoa (Nao iniciada / Em andamento / Concluida). "Em andamento" marcado
  // antes do prazo aparece como Em Andamento; prazo vencido continua Atrasada.
  function statusDaLinhaAcao(linha, hoje) {
    const base = calcularStatusAcao(linha["Dt Programada"], linha["Dt Conclusao"], hoje);
    // V 1.29: com prazo definido (e nao concluida, nao vencida) a acao esta Em andamento.
    if (base === "Nao Iniciado" && (linha["Status Execucao"] === "Em andamento" || linha["Dt Programada"])) return "Em Andamento";
    return base;
  }

  // ------------------------------------------------------------------
  // Risco Global - calculado a partir da MEDIA das 12 dimensoes (nunca do
  // maximo), mesma regra usada na geracao dos dados ficticios.
  // ------------------------------------------------------------------
  function calcularRiscoGlobal(scores) {
    const valores = DIMENSOES_RISCO.map((d) => Number(scores[d]) || 0);
    const media = valores.reduce((a, b) => a + b, 0) / (valores.length || 1);
    if (media >= 2.7) return "Muito Alto";
    if (media >= 2.15) return "Alto";
    if (media >= 1.55) return "Medio";
    return "Baixo";
  }

  function nivelReduzido(nivel) {
    const idx = NIVEIS_RISCO.indexOf(nivel);
    if (idx <= 0) return NIVEIS_RISCO[0];
    return NIVEIS_RISCO[idx - 1];
  }

  // Busca a linha cuja chave composta (Cliente+Unidade+Setor+Posto+Cargo+
  // Atividade) bate com chaveObj - usada para "puxar" o Risco Global atual
  // do posto ao lancar um registro em Plano Acao/Absenteismo/Compativeis.
  function buscarPorChave(linhas, chaveObj) {
    return linhas.find((l) => DIMENSOES.every((d) => l[d] === chaveObj[d])) || null;
  }

  // ------------------------------------------------------------------
  // Filtros globais - MULTI-SELECAO: cada campo guarda um ARRAY de valores
  // selecionados (nunca uma string); array vazio = "Todos" (sem restricao).
  // Varios valores no mesmo campo = OR ("traz variacoes": Setor A OU Setor
  // B); campos diferentes = AND (Setor... E Cargo...), como de costume em
  // filtros de BI.
  // ------------------------------------------------------------------
  function vazio(v) { return !v || (Array.isArray(v) && v.length === 0); }

  function linhaPassaFiltros(linha, filtros, camposData) {
    for (const dim of DIMENSOES) {
      const v = filtros[dim];
      if (!vazio(v) && dim in linha && !v.includes(linha[dim])) return false;
    }
    // V 1.29: filtro Origem (AEP/AET/Psicossocial) so vale para registros que tem origem
    // (o app marca _origem em fatores, acoes, avaliacoes, laudos, AET e risco dos postos).
    const origens = filtros["Origem"];
    if (!vazio(origens) && linha && "_origem" in linha && !origens.includes(linha._origem)) return false;
    const anos = filtros["Ano"];
    const meses = filtros["Mes"];
    if ((!vazio(anos) || !vazio(meses)) && camposData && camposData.length) {
      const ok = camposData.some((c) => {
        const val = linha[c];
        if (!val) return false;
        const ano = String(val).slice(0, 4);
        const mes = String(val).slice(5, 7);
        if (!vazio(anos) && !anos.includes(ano)) return false;
        if (!vazio(meses) && !meses.includes(mes)) return false;
        return true;
      });
      if (!ok) return false;
    }
    return true;
  }

  function filtrar(linhas, filtros, camposData) {
    return linhas.filter((l) => linhaPassaFiltros(l, filtros, camposData || []));
  }

  // Opcoes de cada dropdown (Cliente/Unidade/Setor/Posto Trabalho/Cargo/
  // Atividade), em cascata. CADA dimensao busca seus valores na SUA PROPRIA
  // tabela do cadastro-mestre (dadosPorNivel[dim] - ver CADASTROS_CONFIG em
  // js/app.js: cliente/unidade/setor/posto/cargo/atividade), aplicando as
  // OUTRAS dimensoes ja selecionadas como filtro (linhaPassaFiltros ja ignora
  // sozinho qualquer dimensao que nao exista como coluna naquela tabela -
  // ex.: a tabela "cliente" nao tem coluna "Setor").
  //
  // Bug critico relatado pelo Leo 02/10/2026 ("cliente cadastrado nao
  // aparece no filtro"): ANTES, as 6 dimensoes eram todas calculadas a
  // partir do Mapa de Risco (tabela de REGISTRO/operacional) - um Cliente
  // (ou Unidade/Setor/etc.) recem-cadastrado no Cadastro-mestre so aparecia
  // no filtro depois de ja ter pelo menos 1 posto de trabalho lancado no
  // Mapa de Risco. Agora cada nivel aparece no filtro assim que e
  // CADASTRADO, independente de ja ter registro operacional ou nao.
  function opcoesDeFiltro(dadosPorNivel, filtros) {
    const resultado = {};
    for (const dim of DIMENSOES) {
      const tabela = (dadosPorNivel && dadosPorNivel[dim]) || [];
      const filtrosSemEssaDim = Object.assign({}, filtros, { [dim]: [] });
      const linhas = filtrar(tabela, filtrosSemEssaDim, []);
      const valores = Array.from(new Set(linhas.map((l) => l[dim]))).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
      resultado[dim] = valores;
    }
    return resultado;
  }

  const NOMES_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // Anos/meses disponiveis para os filtros separados Ano/Mes - derivados de
  // _meta.meses ("YYYY-MM"), nunca hardcoded (acompanha o periodo real dos
  // dados, ficticios ou reais).
  function anosDisponiveis(meses) {
    return Array.from(new Set((meses || []).map((m) => m.slice(0, 4)))).sort();
  }
  function mesesDisponiveis(meses) {
    return Array.from(new Set((meses || []).map((m) => m.slice(5, 7)))).sort();
  }
  function rotuloMes(mm) { return NOMES_MES[Number(mm) - 1] || mm; }

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
      const st = statusDaLinhaAcao(a, hoje);
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
      const st = statusDaLinhaAcao(a, hoje);
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
        const st = statusDaLinhaAcao(l, hoje);
        linha[st] += 1;
      });
      return linha;
    });
  }

  // ------------------------------------------------------------------
  // Indicadores - Inventario de Riscos / Avaliacao Ergonomica / Laudos
  // (pacote "Sistema de Gestao Integrada", ver docs/bi-ergonomia-manual.md).
  // Generalizacoes das mesmas funcoes do Mapa de Risco acima, parametrizadas
  // por nome de campo - nunca uma funcao nova por colecao.
  // ------------------------------------------------------------------

  // Generaliza mapaRiscoGlobal() para qualquer campo de nivel de risco (usa
  // sempre os mesmos 4 NIVEIS_RISCO/cores). mapaRiscoGlobal continua existindo
  // como um atalho pro caso historico (campo fixo "Risco Global").
  // As matrizes do Inventario gravam rotulos proprios ("Moderado", "Muito
  // Baixo", "Altissimo" - ver MATRIZES_RISCO); o painel usa sempre os 4
  // NIVEIS_RISCO. Sem este agrupamento, esses fatores eram silenciosamente
  // ignorados nas contagens (bug achado na calibracao dos indicadores, V 1.0).
  const NIVEL_CANONICO = { "Muito Baixo": "Baixo", "Moderado": "Medio", "Altíssimo": "Muito Alto", "Irrelevante": "Baixo", "Tolerável": "Baixo", "Intolerável": "Muito Alto" };
  function nivelCanonico(nivel) { return NIVEL_CANONICO[nivel] || nivel; }

  // ------------------------------------------------------------------
  // V 1.29 - Origem de cada registro (AEP, AET ou Psicossocial) e risco do
  // posto calculado pelo Inventario (substitui o Mapa de Risco manual).
  // ------------------------------------------------------------------
  const ORIGENS = ["AEP", "AET", "Psicossocial"];
  // ------------------------------------------------------------------
  // V 1.31 - evolucao do risco. Cada fator guarda "Historico Risco":
  //   [{ data, de, para ("Eliminado" quando o risco deixou de existir), probabilidade, severidade, motivo, acaoId, nrAcao }]
  // gravado ao concluir uma acao que reduz/elimina o risco (reavaliacao no Plano de Acao), ao
  // reclassificar o fator no inventario e na reaplicacao do Psicossocial. O risco vigente e sempre
  // o mais recente; um risco eliminado ("Risco Eliminado" = Sim) sai das contagens e do laudo vigente.
  // ------------------------------------------------------------------
  const riscoAtivo = (f) => !!f && f["Existe Fator Risco"] !== "Nao" && f["Risco Eliminado"] !== "Sim";
  const dataInicioRisco = (f) => (f && (f["Dt Identificacao"] || String(f._criadoEm || "").slice(0, 10))) || "";
  function eventosRisco(f) { return ((f && f["Historico Risco"]) || []).filter((e) => e && e.data).slice().sort((a, b) => String(a.data).localeCompare(String(b.data))); }
  function graduacaoInicial(f) { const ev = eventosRisco(f); return f["Graduacao Inicial"] || (ev.length ? ev[0].de : f["Graduacao Risco"]) || ""; }
  // Graduacao do fator numa data (AAAA-MM-DD): null se ainda nao existia; "Eliminado" se ja foi eliminado.
  function graduacaoNaData(f, dataISO) {
    if (!f || f["Existe Fator Risco"] === "Nao") return null;
    const ini = dataInicioRisco(f);
    if (!ini || String(dataISO) < ini) return null;
    let n = graduacaoInicial(f);
    eventosRisco(f).forEach((e) => { if (String(e.data) <= String(dataISO)) n = e.para; });
    return n || null;
  }
  // Texto da evolucao: "Iniciou Alto · 10/11/2026 – Ação A-03 concluída: Baixo · 02/12/2026 – ...: risco eliminado"
  function textoEvolucaoRisco(f) {
    const ev = eventosRisco(f);
    if (!ev.length) return "";
    const br = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : d; };
    return [`Iniciou ${rotuloNivel(graduacaoInicial(f))}`].concat(ev.map((e) => `${br(e.data)} – ${e.motivo || "Reavaliação"}: ${e.para === "Eliminado" ? "risco eliminado" : rotuloNivel(e.para)}`)).join(" · ");
  }
  // Evolucao mensal (ultimos "nMeses" meses ate "ate"): por mes, quantos fatores em cada nivel (4 niveis do
  // painel), quantos eliminados e quantos reduzidos (nivel abaixo do inicial) ate o fim do mes.
  function evolucaoMensalRiscos(fatores, ate, nMeses) {
    const lista = (fatores || []).filter((f) => f && f["Existe Fator Risco"] !== "Nao" && dataInicioRisco(f));
    if (!lista.length) return [];
    const fim = new Date(ate || new Date()); const ini0 = lista.map(dataInicioRisco).sort()[0];
    const meses = []; let a = Number(ini0.slice(0, 4)); let m = Number(ini0.slice(5, 7));
    while (a < fim.getFullYear() || (a === fim.getFullYear() && m <= fim.getMonth() + 1)) { meses.push(`${a}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; a++; } }
    const ult = meses.slice(-(nMeses || 24));
    return ult.map((mes) => {
      const [aa, mm] = mes.split("-").map(Number); const fimMes = new Date(aa, mm, 0); const dia = `${mes}-${String(fimMes.getDate()).padStart(2, "0")}`;
      const porNivel = {}; NIVEIS_RISCO.forEach((n) => (porNivel[n] = 0)); let eliminados = 0; let reduzidos = 0; const linhas = {};
      lista.forEach((f) => {
        const g = graduacaoNaData(f, dia); if (!g) return;
        if (g === "Eliminado") { eliminados++; (linhas.Eliminado = linhas.Eliminado || []).push(f); return; }
        const c = nivelCanonico(g); if (!(c in porNivel)) return;
        porNivel[c]++; (linhas[c] = linhas[c] || []).push(f);
        if (NIVEIS_RISCO.indexOf(c) < NIVEIS_RISCO.indexOf(nivelCanonico(graduacaoInicial(f)))) { reduzidos++; (linhas.Reduzidos = linhas.Reduzidos || []).push(f); }
      });
      return { mes, porNivel, eliminados, reduzidos, linhas };
    });
  }
  function origemDe(l) {
    const o = String((l && l.Origem) || "");
    if (/psicoss/i.test(o)) return "Psicossocial";
    if (/\baet\b/i.test(o)) return "AET";
    return "AEP";
  }
  // O risco do posto e SEMPRE a maior graduacao entre os fatores existentes
  // do posto (ex.: um fator Baixo e outro Alto -> posto Alto). Um "posto" =
  // Cliente + Unidade + Setor + Posto + Cargo + Origem (no Psicossocial, o
  // setor/GHE). Fator marcado "Nao" ou sem graduacao nao entra.
  function riscoDosPostos(fatores, avaliacoes) {
    const grupos = {};
    const dataAval = {};
    (avaliacoes || []).forEach((a) => {
      const k = [a.Cliente, a.Unidade, a.Setor, a["Posto Trabalho"], a.Cargo].join("||");
      const d = a["Data Avaliacao"] || String(a._criadoEm || "").slice(0, 10);
      if (d && (!dataAval[k] || d > dataAval[k])) dataAval[k] = d;
    });
    (fatores || []).forEach((f) => {
      if (!riscoAtivo(f)) return;
      const nivel = nivelCanonico(f["Graduacao Risco"]);
      const idx = NIVEIS_RISCO.indexOf(nivel);
      if (idx < 0) return;
      const origem = origemDe(f);
      const k = [f.Cliente, f.Unidade, f.Setor, f["Posto Trabalho"] || "", f.Cargo || "", origem].join("||");
      let g = grupos[k];
      if (!g) {
        const kAval = [f.Cliente, f.Unidade, f.Setor, f["Posto Trabalho"], f.Cargo].join("||");
        g = grupos[k] = {
          Cliente: f.Cliente, Unidade: f.Unidade, Setor: f.Setor, "Posto Trabalho": f["Posto Trabalho"] || "", Cargo: f.Cargo || "",
          Origem: origem, _origem: origem, "Risco Global": nivel, "Graduacao Maxima": f["Graduacao Risco"],
          "Fator Mais Grave": f.Fator || "", Fatores: 0, _idx: idx,
          "Dt Avaliacao": dataAval[kAval] || f["Dt Identificacao"] || String(f._criadoEm || "").slice(0, 10) || null,
        };
      }
      g.Fatores += 1;
      if (idx > g._idx) { g._idx = idx; g["Risco Global"] = nivel; g["Graduacao Maxima"] = f["Graduacao Risco"]; g["Fator Mais Grave"] = f.Fator || ""; }
    });
    return Object.values(grupos).map((g) => { delete g._idx; return g; });
  }

  function distribuicaoPorNivelRisco(linhas, campo) {
    const total = linhas.length;
    const porNivel = {};
    NIVEIS_RISCO.forEach((n) => (porNivel[n] = 0));
    linhas.forEach((l) => { const n = nivelCanonico(l[campo]); if (n in porNivel) porNivel[n] += 1; });
    return NIVEIS_RISCO.map((n) => ({
      nivel: n,
      qtd: porNivel[n],
      pct: total ? (porNivel[n] / total) * 100 : 0,
    }));
  }

  // Contagem por um campo de status livre (ja gravado na linha, ao contrario
  // de Status Acao que e sempre calculado), na ordem informada.
  function distribuicaoPorStatus(linhas, campo, ordem) {
    const mapa = contagemPorCampoRaw(linhas, campo);
    return ordem.map((s) => ({ status: s, qtd: mapa[s] || 0 }));
  }

  // (definida aqui em cima de contagemPorCampo, que so aparece mais abaixo -
  // ver nota la: mesma logica, sem "Nao informado" pra nao poluir a ordem).
  function contagemPorCampoRaw(linhas, campo) {
    const mapa = {};
    linhas.forEach((l) => { const v = l[campo]; if (v) mapa[v] = (mapa[v] || 0) + 1; });
    return mapa;
  }

  // Prazos (campo tipo "Valido Ate"): classifica cada linha em vencido /
  // vencendo (dentro de diasAlerta) / em-dia / sem-prazo (campo vazio).
  function statusVencimento(dataStr, hoje, diasAlerta) {
    if (!dataStr) return "sem-prazo";
    const d = paraData(dataStr);
    if (!d) return "sem-prazo";
    const diffDias = Math.round((d - hoje) / 86400000);
    if (diffDias < 0) return "vencido";
    if (diffDias <= (diasAlerta || 30)) return "vencendo";
    return "em-dia";
  }

  function distribuicaoVencimento(linhas, campoData, hoje, diasAlerta) {
    const cont = { vencido: 0, vencendo: 0, "em-dia": 0, "sem-prazo": 0 };
    linhas.forEach((l) => { cont[statusVencimento(l[campoData], hoje, diasAlerta)] += 1; });
    return cont;
  }

  // Generaliza topSetores() (Mapa de Risco) para qualquer colecao/campo -
  // "criticos" = linhas cujo valor do campo esta na lista fornecida (ex.:
  // Graduacao Risco em ["Alto", "Muito Alto"], ou Status fora de
  // ["Concluido", "Cancelado"]).
  function topSetoresPorCampo(linhas, campo, valoresCriticos, n) {
    const porSetor = {};
    linhas.forEach((l) => {
      porSetor[l.Setor] = porSetor[l.Setor] || { setor: l.Setor, total: 0, criticos: 0 };
      porSetor[l.Setor].total += 1;
      if (valoresCriticos.includes(l[campo])) porSetor[l.Setor].criticos += 1;
    });
    return Object.values(porSetor)
      .map((s) => ({ ...s, pct: s.total ? (s.criticos / s.total) * 100 : 0 }))
      .sort((a, b) => b.criticos - a.criticos || b.pct - a.pct)
      .slice(0, n || 3);
  }

  // Cobertura de Avaliacao Ergonomica: quantos postos (chave composta das 6
  // dimensoes) do universo do Mapa de Risco ja tem pelo menos 1 avaliacao
  // registrada.
  // V 1.29: AEP por posto e cargo (sem atividade); o universo e o cadastro de cargos por posto.
  function coberturaAvaliacao(avaliacoesF, mapaRiscoF) {
    const chaveDe = (l) => ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo"].map((d) => l[d]).join("||");
    const postosComAvaliacao = new Set(avaliacoesF.map(chaveDe));
    const universo = new Set(mapaRiscoF.map(chaveDe));
    const cobertos = Array.from(universo).filter((k) => postosComAvaliacao.has(k)).length;
    return {
      total: avaliacoesF.length,
      postosCobertos: cobertos,
      universoPostos: universo.size,
      pct: universo.size ? (cobertos / universo.size) * 100 : 0,
    };
  }

  // Indicador da trilha AET (Analise Ergonomica do Trabalho - upload externo,
  // ver docs/bi-ergonomia-manual.md secao AET) para o dashboard "Ergo": ate
  // este pedido do Leo (28/09/2026, "gestao visual" AEP x AET) a AET nao
  // aparecia em NENHUM indicador do dashboard - so existia como tela de
  // cadastro/tabela. Conta os arquivos anexados em cada registro AET
  // (campo "Arquivos AET", 1 registro pode ter varios arquivos) por
  // classificacao final (classificacaoConfirmada quando o ergonomista
  // revisou, senao a classificacao automatica - mesma prioridade usada na
  // tela de cadastro, ver js/app.js linha ~2978).
  function distribuicaoClassificacaoAET(aetF) {
    const contagem = {};
    NOMES_CLASSIFICACAO_AET.forEach((n) => (contagem[n] = 0));
    let totalArquivos = 0;
    aetF.forEach((registro) => {
      (registro["Arquivos AET"] || []).forEach((item) => {
        const classificacao = item.classificacaoConfirmada || item.classificacao || "Não identificado";
        if (!(classificacao in contagem)) contagem[classificacao] = 0;
        contagem[classificacao] += 1;
        totalArquivos += 1;
      });
    });
    return {
      totalRegistros: aetF.length,
      totalArquivos,
      labels: NOMES_CLASSIFICACAO_AET,
      valores: NOMES_CLASSIFICACAO_AET.map((n) => contagem[n] || 0),
    };
  }

  // ------------------------------------------------------------------
  // Indicadores - Dashboard "Med Ocup"
  // Taxa de Frequencia = (nr de casos de afastamento / HHT) x 1.000.000,
  // onde HHT (Homens-Hora Trabalhados) = Qtd Colaboradores x Qtd Dias Uteis x 8h,
  // somado linha a linha de Dias Uteis (metodologia padrao de SST/CIPA - NBR 14280).
  // ------------------------------------------------------------------
  function hhtDaLinha(linha) {
    return (Number(linha["Qtd Colaboradores"]) || 0) * (Number(linha["Qtd Dias Uteis"]) || 0) * 8;
  }

  function calcularTaxaFrequencia(absenteismoF, diasUteisF) {
    const hht = diasUteisF.reduce((acc, l) => acc + hhtDaLinha(l), 0);
    return hht ? (absenteismoF.length / hht) * 1000000 : 0;
  }

  function totaisMedOcup(absenteismoF, diasUteisF) {
    const qtdColaboradores = diasUteisF.length
      ? Math.round(diasUteisF.reduce((a, l) => a + (Number(l["Qtd Colaboradores"]) || 0), 0) / diasUteisF.length)
      : 0;
    const qtdDiasPerdidos = absenteismoF.reduce((a, l) => a + (Number(l["Qtd Dias"]) || 0), 0);
    return { qtdColaboradores, qtdDiasPerdidos, taxaFrequencia: calcularTaxaFrequencia(absenteismoF, diasUteisF) };
  }

  function evolucaoTaxaFrequencia(absenteismoF, diasUteisF) {
    const meses = new Set();
    absenteismoF.forEach((l) => { if (l["Dt Afastamento"]) meses.add(String(l["Dt Afastamento"]).slice(0, 7)); });
    diasUteisF.forEach((l) => { if (l["Ano/Mes Uteis"]) meses.add(l["Ano/Mes Uteis"]); });
    return Array.from(meses).sort().map((m) => {
      const absMes = absenteismoF.filter((l) => String(l["Dt Afastamento"]).slice(0, 7) === m);
      const duMes = diasUteisF.filter((l) => l["Ano/Mes Uteis"] === m);
      return {
        mes: m,
        qtdAtestados: absMes.length,
        qtdDiasPerdidos: absMes.reduce((a, l) => a + (Number(l["Qtd Dias"]) || 0), 0),
        taxaFrequencia: calcularTaxaFrequencia(absMes, duMes),
      };
    });
  }

  function taxaFrequenciaPorSetor(absenteismoF, diasUteisF) {
    const setores = Array.from(new Set(diasUteisF.map((l) => l.Setor))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return setores.map((setor) => ({
      setor,
      taxaFrequencia: calcularTaxaFrequencia(absenteismoF.filter((l) => l.Setor === setor), diasUteisF.filter((l) => l.Setor === setor)),
    }));
  }

  // Soma "Qtd Dias" de Absenteismo por regiao corporal - usado nos diagramas
  // de Med Ocup (frente/costas). Parametrizada por lista de regioes (nunca
  // uma funcao por regiao).
  // V 1.29: no Absenteismo o segmento e geral (sem direito/esquerdo); registros antigos
  // com lado entram no segmento geral ("Ombro Direito" -> "Ombro").
  function regiaoSemLado(r) { return String(r || "").replace(/\s+(Direit[oa]|Esquerd[oa])$/, ""); }
  function regioesSemLado(regioes) { return Array.from(new Set((regioes || []).map(regiaoSemLado))); }
  function somaDiasPorRegiao(absenteismoF, regioes, semLado) {
    const mapa = {};
    const norm = semLado ? regiaoSemLado : (r) => r;
    (semLado ? regioesSemLado(regioes) : regioes).concat(SEGMENTOS_GERAIS).forEach((r) => (mapa[r] = 0));
    absenteismoF.forEach((l) => { const r = norm(l["Regiao Corporal"]); if (r in mapa) mapa[r] += Number(l["Qtd Dias"]) || 0; });
    return mapa;
  }

  // ------------------------------------------------------------------
  // Indicadores - Dashboard "Compativeis"
  // ------------------------------------------------------------------
  function contagemPorCampo(linhas, campo) {
    const mapa = {};
    linhas.forEach((l) => { const v = l[campo] || "Nao informado"; mapa[v] = (mapa[v] || 0) + 1; });
    return mapa;
  }

  const FAIXAS_IDADE = [
    { min: 0, max: 24, label: "Ate 24" }, { min: 25, max: 34, label: "25-34" },
    { min: 35, max: 44, label: "35-44" }, { min: 45, max: 54, label: "45-54" },
    { min: 55, max: 200, label: "55+" },
  ];

  function distribuicaoIdade(compativeisF) {
    const faixas = FAIXAS_IDADE;
    const contagem = faixas.map((f) => ({ label: f.label, qtd: 0 }));
    compativeisF.forEach((l) => {
      const idade = Number(l.Idade) || 0;
      const idx = faixas.findIndex((f) => idade >= f.min && idade <= f.max);
      if (idx >= 0) contagem[idx].qtd += 1;
    });
    return contagem;
  }

  function statusRestricaoPorSetor(compativeisF) {
    const setores = Array.from(new Set(compativeisF.map((l) => l.Setor))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return setores.map((setor) => {
      const linha = { setor };
      STATUS_RESTRICAO_ORDEM.forEach((s) => (linha[s] = 0));
      compativeisF.filter((l) => l.Setor === setor).forEach((l) => { linha[l["Status Restricao"]] = (linha[l["Status Restricao"]] || 0) + 1; });
      return linha;
    });
  }

  function statusRestricaoPorTurno(compativeisF) {
    const turnos = Array.from(new Set(compativeisF.map((l) => l["Turno Trabalho"]))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return turnos.map((turno) => {
      const linha = { turno };
      STATUS_RESTRICAO_ORDEM.forEach((s) => (linha[s] = 0));
      compativeisF.filter((l) => l["Turno Trabalho"] === turno).forEach((l) => { linha[l["Status Restricao"]] = (linha[l["Status Restricao"]] || 0) + 1; });
      return linha;
    });
  }

  function compativelPorSetor(compativeisF) {
    const compat = compativeisF.filter((l) => l["Atividade Compativel"] === "Sim");
    const setores = Array.from(new Set(compat.map((l) => l.Setor))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return setores.map((setor) => ({ setor, qtd: compat.filter((l) => l.Setor === setor).length }));
  }

  // Conta restricoes (linhas) por regiao corporal (Segmento Corporal) - mesma
  // logica dos diagramas de Med Ocup, mas contando ocorrencias, nao dias.
  // V 1.31: segmentos fora do corpo, em todas as listas de segmento e nos graficos
  const SEGMENTOS_GERAIS = ["Psicossocial", "Não identificado"];
  function contagemPorRegiao(compativeisF, regioes) {
    const mapa = {};
    regioes.concat(SEGMENTOS_GERAIS).forEach((r) => (mapa[r] = 0));
    compativeisF.forEach((l) => { if (l["Segmento Corporal"] in mapa) mapa[l["Segmento Corporal"]] += 1; });
    return mapa;
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
    CORES_RISCO_HEX,
    CORES_STATUS_HEX,
    corRiscoHex,
    corStatusAcaoHex,
    textoSobreHex,
    hexParaRGB,
    ORIGENS,
    origemDe,
    riscoAtivo,
    eventosRisco,
    graduacaoInicial,
    graduacaoNaData,
    textoEvolucaoRisco,
    evolucaoMensalRiscos,
    regiaoSemLado,
    regioesSemLado,
    SEGMENTOS_GERAIS,
    riscoDosPostos,
    DIMENSOES,
    DIMENSOES_RISCO,
    NIVEIS_RISCO,
    GRUPOS_FATOR_RISCO,
    fatoresDoGrupo,
    consequenciasDoFator,
    NOMES_MATRIZ_RISCO,
    MATRIZ_PADRAO,
    NOMES_CLASSIFICACAO_AET,
    classificarTextoAET,
    escalaDaMatriz, rotuloEscala, niveisDaMatriz, ordemNivel,
    TODOS_NIVEIS: Array.from(new Set(NIVEIS_RISCO.concat(...Object.values(MATRIZES_RISCO).map((m) => m.niveis)))),
    nivelDaMatriz,
    pontuacaoDaMatriz,
    matrizDoCliente,
    STATUS_ACAO_ORDEM,
    STATUS_RESTRICAO_ORDEM,
    resolverCorCSS,
    corStatus,
    temCorStatus,
    rotuloNivel,
    construirMapaCores,
    calcularStatusAcao,
    formatarCargo,
    statusDaLinhaAcao,
    calcularRiscoGlobal,
    nivelCanonico,
    nivelReduzido,
    buscarPorChave,
    filtrar,
    opcoesDeFiltro,
    anosDisponiveis,
    mesesDisponiveis,
    rotuloMes,
    FAIXAS_IDADE,
    mapaRiscoGlobal,
    topSetores,
    distribuicaoPorNivelRisco,
    distribuicaoPorStatus,
    statusVencimento,
    distribuicaoVencimento,
    topSetoresPorCampo,
    coberturaAvaliacao,
    distribuicaoClassificacaoAET,
    statusPlanoAcao,
    planoAcaoPostosCriticos,
    planoAcaoPorResponsavel,
    serieMensal,
    mapaRiscoPorSetor,
    statusPlanoAcaoPorSetor,
    calcularTaxaFrequencia,
    totaisMedOcup,
    evolucaoTaxaFrequencia,
    taxaFrequenciaPorSetor,
    somaDiasPorRegiao,
    contagemPorCampo,
    distribuicaoIdade,
    statusRestricaoPorSetor,
    statusRestricaoPorTurno,
    compativelPorSetor,
    contagemPorRegiao,
    formatarMesLabel,
    formatarStatusLabel,
  };
})(window);
