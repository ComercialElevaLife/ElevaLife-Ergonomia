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
    ],
  };
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

  const MATRIZES_RISCO = {
    "Matriz 3x3": {
      escala: ["Baixa", "Media", "Alta"],
      niveis: ["Baixo", "Moderado", "Alto"],
    },
    "Matriz 4x4": {
      escala: ["Baixa", "Media", "Alta", "Muito Alta"],
      niveis: ["Baixo", "Moderado", "Alto", "Muito Alto"],
    },
    "Matriz 5x5": {
      escala: ["Muito Baixa", "Baixa", "Media", "Alta", "Muito Alta"],
      niveis: ["Muito Baixo", "Baixo", "Moderado", "Alto", "Altíssimo"],
    },
    // Exemplo de variante propria de um cliente (mesmo formato 5x5, so
    // ilustrando que a matriz e configuravel por empresa).
    "Matriz 5x5 Gerdau": {
      escala: ["Muito Baixa", "Baixa", "Media", "Alta", "Muito Alta"],
      niveis: ["Muito Baixo", "Baixo", "Moderado", "Alto", "Altíssimo"],
    },
  };
  Object.keys(MATRIZES_RISCO).forEach((nome) => {
    MATRIZES_RISCO[nome].grade = construirGradeSimetrica(MATRIZES_RISCO[nome].niveis.length);
  });
  const NOMES_MATRIZ_RISCO = Object.keys(MATRIZES_RISCO);

  function matrizPorNome(nomeMatriz) { return MATRIZES_RISCO[nomeMatriz] || MATRIZES_RISCO[MATRIZ_PADRAO]; }
  function escalaDaMatriz(nomeMatriz) { return matrizPorNome(nomeMatriz).escala; }
  function celulaDaMatriz(nomeMatriz, probabilidade, gravidade) {
    const m = matrizPorNome(nomeMatriz);
    const p = m.escala.indexOf(probabilidade);
    const g = m.escala.indexOf(gravidade);
    if (p < 0 || g < 0) return null;
    return Object.assign({ nivel: m.niveis[m.grade[p][g].nivelIdx] }, m.grade[p][g]);
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
    "Cancelado": "var(--acao-atrasada)",

    // Graduacao do Risco calculada pela Matriz de Risco (Inventario de
    // Riscos) - "Moderado"/"Altíssimo"/"Muito Baixo" sao os rotulos que a
    // propria matriz ja grava (ver MATRIZES_RISCO acima), por isso entram
    // aqui como chaves adicionais (nunca uma paleta nova: reaproveita as
    // mesmas 4 cores de risco; "Muito Baixo" ganha um tom mais claro).
    "Moderado": "var(--risco-moderado)",
    "Altíssimo": "var(--risco-muitoalto)",
    "Muito Baixo": "var(--risco-muitobaixo)",
  };

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

  function calcularStatusAcao(dtProgramadaStr, dtConclusaoStr, hoje) {
    const prog = paraData(dtProgramadaStr);
    const concl = paraData(dtConclusaoStr);
    if (!prog && !concl) return "Nao Iniciado";
    if (!prog && concl) return "Concluida";
    if (!concl && prog < hoje) return "Atrasada";
    if (!concl && prog <= hoje) return "Em Andamento";
    if (!concl) return "Nao Iniciado"; // programada no futuro, ainda nao iniciada
    if (concl > prog) return "Concluida com atraso";
    return "Concluida";
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

  // Opcoes de cada dropdown, em cascata: calculadas a partir do Mapa Risco
  // (tabela mestre de postos) aplicando todos os OUTROS filtros selecionados.
  function opcoesDeFiltro(mapaRisco, filtros) {
    const resultado = {};
    for (const dim of DIMENSOES) {
      const filtrosSemEssaDim = Object.assign({}, filtros, { [dim]: [] });
      const linhas = filtrar(mapaRisco, filtrosSemEssaDim, []);
      const valores = Array.from(new Set(linhas.map((l) => l[dim]))).sort((a, b) => a.localeCompare(b, "pt-BR"));
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
      const st = calcularStatusAcao(a["Dt Programada"], a["Dt Conclusao"], hoje);
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
      const st = calcularStatusAcao(a["Dt Programada"], a["Dt Conclusao"], hoje);
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
        const st = calcularStatusAcao(l["Dt Programada"], l["Dt Conclusao"], hoje);
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
  function distribuicaoPorNivelRisco(linhas, campo) {
    const total = linhas.length;
    const porNivel = {};
    NIVEIS_RISCO.forEach((n) => (porNivel[n] = 0));
    linhas.forEach((l) => { if (l[campo] in porNivel) porNivel[l[campo]] += 1; });
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
  function coberturaAvaliacao(avaliacoesF, mapaRiscoF) {
    const chaveDe = (l) => DIMENSOES.map((d) => l[d]).join("||");
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
  function somaDiasPorRegiao(absenteismoF, regioes) {
    const mapa = {};
    regioes.forEach((r) => (mapa[r] = 0));
    absenteismoF.forEach((l) => { if (l["Regiao Corporal"] in mapa) mapa[l["Regiao Corporal"]] += Number(l["Qtd Dias"]) || 0; });
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
  function contagemPorRegiao(compativeisF, regioes) {
    const mapa = {};
    regioes.forEach((r) => (mapa[r] = 0));
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
    DIMENSOES,
    DIMENSOES_RISCO,
    NIVEIS_RISCO,
    GRUPOS_FATOR_RISCO,
    fatoresDoGrupo,
    NOMES_MATRIZ_RISCO,
    MATRIZ_PADRAO,
    escalaDaMatriz,
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
    calcularRiscoGlobal,
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
