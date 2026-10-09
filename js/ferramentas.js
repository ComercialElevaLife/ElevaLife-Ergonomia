/* ==========================================================================
   S.I.G.E - ElevaLife · V 1.34
   Ferramentas ergonomicas da AET (planilha FERRAMENTAS_ERGONOMIA_GERAL 2025).

   Cada ferramenta tem:
     id, nome, ref (referencia), descricao (texto do laudo, item "Metodos
     aplicados"), exposicao (true quando a metrica ja considera o tempo de
     exposicao - nesse caso o resultado define o risco; senao, o resultado e
     cruzado com a probabilidade/exposicao na matriz do cliente), campos
     (formulario) e calcular(valores) -> { ok, pontuacao, classe, nivel, memorial }.

   nivel: 0 muito baixo · 1 baixo · 2 moderado · 3 alto · 4 muito alto
          (null quando a ferramenta nao classifica e o ergonomista informa o nivel).
   Campos "lados" guardam <id>_e (esquerdo) e <id>_d (direito).
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const D = () => BI.FerramentasDados || {};
  const NIVEIS = ["Muito baixo", "Baixo", "Moderado", "Alto", "Muito alto"];
  const num = (x) => { if (x === "" || x == null) return null; const n = Number(String(x).replace(",", ".")); return isFinite(n) ? n : null; };
  const fmt = (n, c) => (n == null || !isFinite(n) ? "-" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: c == null ? 0 : c, maximumFractionDigits: c == null ? 2 : c }));
  const ops = (lista) => lista.map((x) => (Array.isArray(x) ? { v: String(x[0]), t: x[1] } : { v: String(x), t: String(x) }));
  const pegar = (v, id) => (v && v[id] != null && v[id] !== "" ? v[id] : null);
  const ambos = (v, id) => [pegar(v, id + "_e"), pegar(v, id + "_d")];
  const temLado = (v, id) => pegar(v, id + "_e") != null || pegar(v, id + "_d") != null;
  const res = (ok, pontuacao, classe, nivel, memorial, extra) => Object.assign({ ok, pontuacao, classe, nivel, memorial: memorial || [] }, extra || {});
  const incompleto = (memorial) => res(false, "", "Preencha os campos da ferramenta", null, memorial || []);
  const SN = ops([["Sim", "Sim"], ["Não", "Não"]]);

  // ------------------------------------------------------------------ RULA
  const RULA_A = [
    [[1, 2, 2, 2, 2, 3, 3, 3], [2, 2, 2, 2, 3, 3, 3, 3], [2, 3, 3, 3, 3, 3, 4, 4]],
    [[2, 3, 3, 3, 3, 4, 4, 4], [3, 3, 3, 3, 3, 4, 4, 4], [3, 4, 4, 4, 4, 4, 5, 5]],
    [[3, 3, 4, 4, 4, 4, 5, 5], [3, 4, 4, 4, 4, 4, 5, 5], [4, 4, 4, 4, 4, 5, 5, 5]],
    [[4, 4, 4, 4, 4, 5, 5, 5], [4, 4, 4, 4, 4, 5, 5, 5], [4, 4, 4, 5, 5, 5, 6, 6]],
    [[5, 5, 5, 5, 5, 6, 6, 7], [5, 6, 6, 6, 6, 7, 7, 7], [6, 6, 6, 7, 7, 7, 7, 8]],
    [[7, 7, 7, 7, 7, 8, 8, 9], [8, 8, 8, 8, 8, 9, 9, 9], [9, 9, 9, 9, 9, 9, 9, 9]],
  ];
  const RULA_B = [
    [1, 3, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7], [2, 3, 2, 3, 4, 5, 5, 5, 6, 7, 7, 7], [3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7],
    [5, 5, 5, 6, 6, 7, 7, 7, 7, 7, 8, 8], [7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8], [8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9],
  ];
  const RULA_C = [[1, 2, 3, 3, 4, 5, 5], [2, 2, 3, 4, 4, 5, 5], [3, 3, 3, 4, 4, 5, 6], [3, 3, 3, 4, 5, 6, 6], [4, 4, 4, 5, 6, 7, 7], [4, 4, 5, 6, 6, 7, 7], [5, 5, 6, 6, 7, 7, 7], [5, 5, 6, 7, 7, 7, 7]];
  // ------------------------------------------------------------------ REBA
  const REBA_A = [
    [[1, 2, 3, 4], [1, 2, 3, 4], [3, 3, 5, 6]], [[2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7]], [[2, 4, 5, 6], [4, 5, 6, 7], [5, 6, 7, 8]],
    [[3, 5, 6, 7], [5, 6, 7, 8], [6, 7, 8, 9]], [[4, 6, 7, 8], [6, 7, 8, 9], [7, 8, 9, 9]],
  ];
  const REBA_B = [[[1, 2, 2], [1, 2, 3]], [[1, 2, 3], [2, 3, 4]], [[3, 4, 5], [4, 5, 5]], [[4, 5, 5], [5, 6, 7]], [[6, 7, 8], [7, 8, 8]], [[7, 8, 8], [8, 9, 9]]];
  const REBA_C = [
    [1, 1, 1, 2, 3, 3, 4, 5, 6, 7, 7, 7], [1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 7, 8], [2, 3, 3, 3, 4, 5, 6, 7, 7, 8, 8, 8], [3, 4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9],
    [4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9, 9], [6, 6, 6, 7, 8, 8, 9, 9, 10, 10, 10, 10], [7, 7, 7, 8, 9, 9, 9, 10, 10, 11, 11, 11], [8, 8, 8, 9, 10, 10, 10, 10, 10, 11, 11, 11],
    [9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12], [10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12], [11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12], [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
  ];
  // ------------------------------------------------------------------ ROSA
  const ROSA_A = { 2: [2, 2, 3, 4, 5, 6, 7, 8], 3: [2, 2, 3, 4, 5, 6, 7, 8], 4: [3, 3, 3, 4, 5, 6, 7, 8], 5: [4, 4, 4, 4, 5, 6, 7, 8], 6: [5, 5, 5, 5, 6, 7, 8, 9], 7: [6, 6, 6, 7, 7, 8, 8, 9], 8: [7, 7, 7, 8, 8, 9, 9, 9] }; // [altura+prof][braços+costas 2..9]
  const ROSA_B = [[1, 1, 1, 2, 3, 4, 5, 6], [1, 1, 2, 2, 3, 4, 5, 6], [1, 2, 2, 3, 3, 4, 6, 7], [2, 2, 3, 3, 4, 5, 6, 8], [3, 3, 4, 4, 5, 6, 7, 8], [4, 4, 5, 5, 6, 7, 8, 9], [5, 5, 6, 7, 8, 8, 9, 9]]; // [telefone 0..6][monitor 0..7]
  const ROSA_C = [[1, 1, 1, 2, 3, 4, 5, 6], [1, 1, 2, 3, 4, 5, 6, 7], [1, 2, 2, 3, 4, 5, 6, 7], [2, 3, 3, 3, 5, 6, 7, 8], [3, 4, 4, 5, 5, 6, 7, 8], [4, 5, 5, 6, 6, 7, 8, 9], [5, 6, 6, 7, 7, 8, 8, 9], [6, 7, 7, 8, 8, 9, 9, 9]]; // [mouse 0..7][teclado 0..7]
  const ROSA_MP = (b, c) => Math.max(b, c); // tabela monitor/telefone x mouse/teclado (1..9): vale o maior
  const ROSA_F = (a, mp) => Math.max(a, mp); // tabela cadeira x monitor e perifericos (1..10): vale o maior
  const DURACAO = ops([["-1", "Menos de 30 min contínuos ou menos de 1 h/dia (−1)"], ["0", "30 min a 1 h contínuos ou 1 a 4 h/dia (0)"], ["1", "Mais de 1 h contínua ou mais de 4 h/dia (+1)"]]);
  // ------------------------------------------------------------------ NIOSH (frequencia)
  const NIOSH_FREQ = [[0.2, [1, 1, 0.95, 0.95, 0.85, 0.85]], [0.5, [0.97, 0.97, 0.92, 0.92, 0.81, 0.81]], [1, [0.94, 0.94, 0.88, 0.88, 0.75, 0.75]], [2, [0.91, 0.91, 0.84, 0.84, 0.65, 0.65]], [3, [0.88, 0.88, 0.79, 0.79, 0.55, 0.55]], [4, [0.84, 0.84, 0.72, 0.72, 0.45, 0.45]], [5, [0.8, 0.8, 0.6, 0.6, 0.35, 0.35]], [6, [0.75, 0.75, 0.5, 0.5, 0.27, 0.27]], [7, [0.7, 0.7, 0.42, 0.42, 0.22, 0.22]], [8, [0.6, 0.6, 0.35, 0.35, 0.18, 0.18]], [9, [0.52, 0.52, 0.3, 0.3, 0, 0.15]], [10, [0.45, 0.45, 0.26, 0.26, 0, 0.13]], [11, [0.41, 0.41, 0, 0.23, 0, 0]], [12, [0.37, 0.37, 0, 0.21, 0, 0]], [13, [0, 0.34, 0, 0, 0, 0]], [14, [0, 0.31, 0, 0, 0, 0]], [15, [0, 0.28, 0, 0, 0, 0]], [999, [0, 0, 0, 0, 0, 0]]];
  // ------------------------------------------------------------------ OCRA
  const OCRA_REC = [1, 1.025, 1.05, 1.086, 1.12, 1.16, 1.2, 1.265, 1.33, 1.4, 1.48, 1.58, 1.7, 1.83, 2, 2.25, 2.5];
  const ocraDuracao = (min) => (min == null ? null : min < 60 ? 0.5 : min <= 120 ? 0.5 : min <= 180 ? 0.65 : min <= 240 ? 0.75 : min <= 300 ? 0.85 : min <= 360 ? 0.925 : min <= 420 ? 0.95 : min <= 480 ? 1 : 1.5);
  const ocraClasse = (p) => (p <= 7.5 ? ["Aceitável (verde)", 0] : p <= 11 ? ["Risco muito leve (amarelo)", 1] : p <= 14 ? ["Risco leve (vermelho leve)", 2] : p <= 22.5 ? ["Risco médio (vermelho médio)", 3] : ["Risco elevado (violeta)", 4]);
  const OCRA_FREQ_AC = [[2.5, 0], [7.5, 0], [12.5, 0], [17.5, 0], [20, 0], [22.5, 0.5], [27.5, 1], [30, 1], [32.5, 2], [35, 2], [37.5, 3], [40, 3], [42.5, 4], [45, 4], [47.5, 5], [50, 5], [52.5, 6], [55, 6], [57.5, 7], [60, 7], [62.5, 8], [65, 8], [67.5, 9], [70, 9], [72.5, 9]];
  const ocraFreqPorAcoes = (apm, semInterrupcao) => { let p = 0; OCRA_FREQ_AC.forEach(([lim, s]) => { if (apm >= lim) p = s; }); if (semInterrupcao && p >= 3) p += 1; if (apm >= 72.5) p = semInterrupcao ? 10 : 9; return p; };

  // ------------------------------------------------------------------ definicoes
  const FERRAMENTAS = [
    {
      id: "strain", nome: "Strain Index (Moore & Garg)", sigla: "Strain Index",
      ref: "Moore, J. S.; Garg, A. The Strain Index: a proposed method to analyze jobs for risk of distal upper extremity disorders. AIHA Journal, 1995.",
      descricao: "Avalia o risco de distúrbios da extremidade distal dos membros superiores (mão, punho, antebraço e cotovelo) pela multiplicação de seis fatores: intensidade, duração e frequência do esforço, postura de mão e punho, ritmo de trabalho e duração da tarefa no dia. Índice menor que 3: trabalho seguro; de 3 a 7: pode apresentar risco; acima de 7: trabalho perigoso.",
      exposicao: true,
      campos: [
        { id: "ie", rot: "Intensidade do esforço (escala de Borg)", tipo: "sel", lados: true, ops: ops([["1", "Leve – relaxado (Borg 0-2)"], ["3", "Médio – algum esforço (Borg 3)"], ["6", "Pesado – esforço nítido, sem expressão facial (Borg 4-5)"], ["9", "Muito pesado – muda a expressão facial (Borg 6-7)"], ["13", "Próximo ao máximo – usa tronco e membros (Borg 8-10)"]]) },
        { id: "de", rot: "Duração do esforço (% do ciclo)", tipo: "sel", lados: true, ops: ops([["0.5", "< 10%"], ["1", "10-29%"], ["1.5", "30-49%"], ["2", "50-79%"], ["3", "≥ 80%"]]) },
        { id: "fe", rot: "Frequência do esforço (por minuto)", tipo: "sel", lados: true, ops: ops([["0.5", "< 4"], ["1", "4 a 8"], ["1.5", "9 a 14"], ["2", "15 a 19"], ["3", "≥ 20"]]) },
        { id: "pm", rot: "Postura de mão e punho", tipo: "sel", lados: true, ops: ops([["1", "Muito boa – neutra"], ["1.0", "Boa – próxima do neutro"], ["1.5", "Razoável – não neutra"], ["2", "Ruim – desvio nítido"], ["3", "Muito ruim – desvio próximo do máximo"]]) },
        { id: "rt", rot: "Ritmo de trabalho", tipo: "sel", lados: true, ops: ops([["1", "Muito lento (< 80%)"], ["1.0", "Lento (81-90%)"], ["1.00", "Razoável (91-100%)"], ["1.5", "Rápido (101-115%)"], ["2", "Muito rápido (> 115%)"]]) },
        { id: "dd", rot: "Duração da tarefa por dia (horas)", tipo: "sel", lados: true, ops: ops([["0.25", "< 1 h"], ["0.5", "1 a 2 h"], ["0.75", "2 a 4 h"], ["1", "4 a 8 h"], ["1.5", "> 8 h"]]) },
      ],
      calcular(v) {
        const ks = ["ie", "de", "fe", "pm", "rt", "dd"];
        const lado = (s) => { if (!ks.every((k) => pegar(v, k + s) != null)) return null; return ks.reduce((p, k) => p * num(pegar(v, k + s)), 1); };
        const e = lado("_e"), d = lado("_d");
        if (e == null && d == null) return incompleto();
        const cl = (si) => (si < 3 ? ["Trabalho seguro", 1] : si <= 7 ? ["Trabalho pode apresentar riscos para membros superiores", 2] : ["Trabalho perigoso – apresenta riscos", 3]);
        const pior = Math.max(e || 0, d || 0); const [classe, nivel] = cl(pior);
        return res(true, `IS esquerdo ${fmt(e, 2)} · IS direito ${fmt(d, 2)}`, classe, nivel, [["Índice (IS) – esquerdo", e == null ? "-" : `${fmt(e, 2)} – ${cl(e)[0]}`], ["Índice (IS) – direito", d == null ? "-" : `${fmt(d, 2)} – ${cl(d)[0]}`]]);
      },
    },
    {
      id: "rula", nome: "RULA (Rapid Upper Limb Assessment)", sigla: "RULA",
      ref: "McAtamney, L.; Corlett, E. N. RULA: a survey method for the investigation of work-related upper limb disorders. Applied Ergonomics, 24(2), 91-99, 1993.",
      descricao: "Avaliação postural rápida dos membros superiores, pescoço, tronco e pernas. As posturas de braço, antebraço, punho e giro do punho (grupo A) e de pescoço, tronco e pernas (grupo B) recebem pontuações, acrescidas do uso muscular e da força, e a tabela final indica o nível de ação: 1-2 aceitável; 3-4 investigar; 5-6 investigar e mudar em breve; 7 investigar e mudar imediatamente.",
      exposicao: false,
      campos: [
        { tipo: "titulo", rot: "Grupo A – membros superiores" },
        { id: "br", rot: "Braço (1: 20° ext. a 20° flex. … 4: > 90°; +1 ombro elevado/abduzido; −1 apoiado)", tipo: "sel", lados: true, ops: ops(["1", "2", "3", "4", "5", "6"]) },
        { id: "ab", rot: "Antebraço (1: 60-100° flexão; 2: < 60° ou > 100°; +1 cruzando a linha média ou para fora)", tipo: "sel", lados: true, ops: ops(["1", "2", "3"]) },
        { id: "pu", rot: "Punho (1 neutro; 2: 0-15°; 3: > 15°; +1 desvio radial/ulnar)", tipo: "sel", lados: true, ops: ops(["1", "2", "3", "4"]) },
        { id: "gp", rot: "Giro do punho (1 médio; 2 no fim da amplitude)", tipo: "sel", lados: true, ops: ops(["1", "2"]) },
        { id: "mA", rot: "Uso muscular – membros superiores (+1 estático > 1 min ou ≥ 4×/min)", tipo: "sel", lados: true, ops: ops(["0", "1"]) },
        { id: "fA", rot: "Força/carga – membros superiores (0 < 2 kg intermitente … 3 > 10 kg ou repetida/choque)", tipo: "sel", lados: true, ops: ops(["0", "1", "2", "3"]) },
        { tipo: "titulo", rot: "Grupo B – pescoço, tronco e pernas" },
        { id: "pe", rot: "Pescoço (1: 0-10°; 2: 10-20°; 3: > 20°; 4: extensão; +1 rotação ou inclinação)", tipo: "sel", ops: ops(["1", "2", "3", "4", "5", "6"]) },
        { id: "tr", rot: "Tronco (1 sentado apoiado; 2: 0-20°; 3: 20-60°; 4: > 60°; +1 rotação ou inclinação)", tipo: "sel", ops: ops(["1", "2", "3", "4", "5", "6"]) },
        { id: "pn", rot: "Pernas (1 apoiadas e equilibradas; 2 não)", tipo: "sel", ops: ops(["1", "2"]) },
        { id: "mB", rot: "Uso muscular – pescoço, tronco e pernas", tipo: "sel", ops: ops(["0", "1"]) },
        { id: "fB", rot: "Força/carga – pescoço, tronco e pernas", tipo: "sel", ops: ops(["0", "1", "2", "3"]) },
      ],
      calcular(v) {
        const B = ["pe", "tr", "pn", "mB", "fB"].map((k) => num(pegar(v, k)));
        if (B.some((x) => x == null)) return incompleto();
        const D_ = RULA_B[B[0] - 1][(B[1] - 1) * 2 + (B[2] - 1)] + B[3] + B[4];
        const lado = (s) => {
          const a = ["br", "ab", "pu", "gp", "mA", "fA"].map((k) => num(pegar(v, k + s)));
          if (a.some((x) => x == null)) return null;
          const A = RULA_A[a[0] - 1][a[1] - 1][(a[2] - 1) * 2 + (a[3] - 1)]; const C = A + a[4] + a[5];
          return { A, C, final: RULA_C[Math.min(C, 8) - 1][Math.min(D_, 7) - 1] };
        };
        const e = lado("_e"), d = lado("_d");
        if (!e && !d) return incompleto();
        const cl = (s) => (s <= 2 ? ["Nível de ação 1 – postura aceitável", 1] : s <= 4 ? ["Nível de ação 2 – investigar; mudanças podem ser necessárias", 2] : s <= 6 ? ["Nível de ação 3 – investigar e mudar em breve", 3] : ["Nível de ação 4 – investigar e mudar imediatamente", 4]);
        const pior = Math.max(e ? e.final : 0, d ? d.final : 0); const [classe, nivel] = cl(pior);
        return res(true, `Escore final: esq. ${e ? e.final : "-"} · dir. ${d ? d.final : "-"}`, classe, nivel, [
          ["Escore C (membros superiores) – esq./dir.", `${e ? e.C : "-"} / ${d ? d.C : "-"}`], ["Escore D (pescoço, tronco, pernas)", String(D_)],
          ["Escore final – esquerdo", e ? `${e.final} – ${cl(e.final)[0]}` : "-"], ["Escore final – direito", d ? `${d.final} – ${cl(d.final)[0]}` : "-"]]);
      },
    },
    {
      id: "reba", nome: "REBA (Rapid Entire Body Assessment)", sigla: "REBA",
      ref: "Hignett, S.; McAtamney, L. Rapid Entire Body Assessment (REBA). Applied Ergonomics, 31, 201-205, 2000.",
      descricao: "Avaliação postural do corpo inteiro: tronco, pescoço e pernas (tabela A, somada à carga/força) e braço, antebraço e punho (tabela B, somada à pega); a tabela C e a atividade geram a pontuação final. 1 insignificante; 2-3 baixo; 4-7 médio; 8-10 alto; 11 ou mais muito alto.",
      exposicao: false,
      campos: [
        { id: "tr", rot: "Tronco (1 ereto; 2: 0-20°; 3: 20-60°; 4: > 60°; +1 rotação ou inclinação)", tipo: "sel", ops: ops(["1", "2", "3", "4", "5"]) },
        { id: "pe", rot: "Pescoço (1: 0-20°; 2: > 20° ou extensão; +1 rotação ou inclinação)", tipo: "sel", ops: ops(["1", "2", "3"]) },
        { id: "pn", rot: "Pernas (1 apoio bilateral; 2 unilateral; +1 joelhos 30-60°; +2 > 60°)", tipo: "sel", ops: ops(["1", "2", "3", "4"]) },
        { id: "cg", rot: "Carga/força (0 < 5 kg; 1: 5-10 kg; 2 > 10 kg; +1 choque ou aumento rápido)", tipo: "sel", ops: ops(["0", "1", "2", "3"]) },
        { id: "br", rot: "Braço (1: 20° ext. a 20° flex.; 2: > 20° ext. ou 20-45°; 3: 45-90°; 4: > 90°; +1 abdução/rotação; +1 ombro elevado; −1 apoiado)", tipo: "sel", lados: true, ops: ops(["1", "2", "3", "4", "5", "6"]) },
        { id: "ab", rot: "Antebraço (1: 60-100°; 2: < 60° ou > 100°)", tipo: "sel", lados: true, ops: ops(["1", "2"]) },
        { id: "pu", rot: "Punho (1: 0-15°; 2: > 15°; +1 desvio ou torção)", tipo: "sel", lados: true, ops: ops(["1", "2", "3"]) },
        { id: "pg", rot: "Pega (0 boa; 1 razoável; 2 ruim; 3 inaceitável)", tipo: "sel", ops: ops(["0", "1", "2", "3"]) },
        { id: "at", rot: "Atividade (+1 estática > 1 min; +1 repetição > 4×/min; +1 mudanças rápidas de postura)", tipo: "sel", ops: ops(["0", "1", "2", "3"]) },
      ],
      calcular(v) {
        const c = ["tr", "pe", "pn", "cg", "pg", "at"].map((k) => num(pegar(v, k)));
        if (c.some((x) => x == null)) return incompleto();
        const A = REBA_A[c[0] - 1][c[1] - 1][c[2] - 1] + c[3];
        const lado = (s) => { const b = ["br", "ab", "pu"].map((k) => num(pegar(v, k + s))); if (b.some((x) => x == null)) return null; const B = REBA_B[b[0] - 1][b[1] - 1][b[2] - 1] + c[4]; return { B, final: REBA_C[Math.min(A, 12) - 1][Math.min(B, 12) - 1] + c[5] }; };
        const e = lado("_e"), d = lado("_d"); if (!e && !d) return incompleto();
        const cl = (s) => (s <= 1 ? ["Risco insignificante – ação não necessária", 0] : s <= 3 ? ["Risco baixo – ação pode ser necessária", 1] : s <= 7 ? ["Risco médio – ação necessária", 2] : s <= 10 ? ["Risco alto – ação necessária em breve", 3] : ["Risco muito alto – ação necessária imediatamente", 4]);
        const pior = Math.max(e ? e.final : 0, d ? d.final : 0); const [classe, nivel] = cl(pior);
        return res(true, `Pontuação REBA: esq. ${e ? e.final : "-"} · dir. ${d ? d.final : "-"}`, classe, nivel, [["Pontuação A (tronco, pescoço, pernas + carga)", String(A)], ["Pontuação B – esq./dir.", `${e ? e.B : "-"} / ${d ? d.B : "-"}`], ["REBA final – esquerdo", e ? `${e.final} – ${cl(e.final)[0]}` : "-"], ["REBA final – direito", d ? `${d.final} – ${cl(d.final)[0]}` : "-"]]);
      },
    },
    {
      id: "hal", nome: "HAL – Nível de Atividade da Mão (ACGIH TLV)", sigla: "HAL",
      ref: "Latko, W. A. et al. Development and evaluation of an observational method for assessing repetition in hand tasks. AIHA Journal, 1997. ACGIH TLV for Hand Activity.",
      descricao: "Relaciona o nível de atividade da mão (0 a 10) com o pico de força normalizado (escala de Borg CR-10). A razão pico de força ÷ (10 − HAL) abaixo de 0,56 está abaixo do limite de ação; entre 0,56 e 0,78 está entre o limite de ação e o TLV; acima de 0,78 está acima do TLV.",
      exposicao: false,
      campos: [
        { id: "hal", rot: "Nível de atividade da mão", tipo: "sel", lados: true, ops: ops([["0", "0 – mãos ociosas a maior parte do tempo"], ["2", "2 – movimentos muito lentos ou pausas longas"], ["4", "4 – movimentos lentos, pausas frequentes"], ["6", "6 – movimentos constantes, pausas menos frequentes"], ["8", "8 – movimentos rápidos, sem pausas regulares"], ["10", "10 – rápidos com dificuldade de acompanhar"]]) },
        { id: "pf", rot: "Pico de força (Borg CR-10)", tipo: "sel", lados: true, ops: ops([["0", "0 – ausente"], ["0.5", "0,5 – extremamente leve"], ["1", "1 – muito leve"], ["2", "2 – leve"], ["3", "3 – moderado"], ["4", "4 – moderado"], ["5", "5 – forte"], ["6", "6 – forte +"], ["7", "7 – muito forte"], ["8", "8 – muito forte +"], ["9", "9 – muito forte ++"], ["10", "10 – extremamente forte"]]) },
      ],
      calcular(v) {
        const lado = (s) => { const h = num(pegar(v, "hal" + s)), p = num(pegar(v, "pf" + s)); if (h == null || p == null) return null; return p / (10.1 - h); };
        const e = lado("_e"), d = lado("_d"); if (e == null && d == null) return incompleto();
        const cl = (r) => (r < 0.56 ? ["Abaixo do limite de ação – sem risco", 1] : r <= 0.78 ? ["Entre o limite de ação e o TLV – risco significativo", 2] : ["Acima do TLV – risco elevado", 3]);
        const [classe, nivel] = cl(Math.max(e || 0, d || 0));
        return res(true, `Razão esq. ${fmt(e, 2)} · dir. ${fmt(d, 2)}`, classe, nivel, [["Esquerdo (pico ÷ (10 − HAL))", e == null ? "-" : `${fmt(e, 2)} – ${cl(e)[0]}`], ["Direito (pico ÷ (10 − HAL))", d == null ? "-" : `${fmt(d, 2)} – ${cl(d)[0]}`]]);
      },
    },
    {
      id: "qec", nome: "QEC (Quick Exposure Check)", sigla: "QEC",
      ref: "David, G. et al. The development of the Quick Exposure Check (QEC). Applied Ergonomics, 39(1), 57-69, 2008. Comper, M. L. C. et al. QEC: adaptação transcultural para o português do Brasil. Work, 2012.",
      descricao: "Combina a avaliação do observador (coluna, ombro/braço, punho/mão e pescoço) com a do trabalhador (peso, duração, força, demanda visual, direção de veículos, vibração, ritmo e estresse). As pontuações de exposição de cada região são classificadas em risco baixo, moderado, alto ou muito alto.",
      exposicao: true,
      campos: [
        { tipo: "titulo", rot: "Avaliação do observador" },
        { id: "A", rot: "A – coluna ao executar a tarefa", tipo: "sel", ops: ops([["1", "A1 – quase neutra"], ["2", "A2 – flexão, rotação ou inclinação moderada"], ["3", "A3 – flexão, rotação ou inclinação excessiva"]]) },
        { id: "Btipo", rot: "B – tipo de tarefa para a coluna", tipo: "sel", ops: ops([["est", "Sentado ou em pé parado (estática)"], ["din", "Levantar, empurrar/puxar ou carregar (dinâmica)"]]) },
        { id: "Best", rot: "B (estática) – a coluna permanece estática a maior parte do tempo?", tipo: "sel", ops: ops([["1", "B1 – não"], ["2", "B2 – sim"]]), se: (v) => v.Btipo === "est" },
        { id: "Bdin", rot: "B (dinâmica) – frequência do movimento da coluna", tipo: "sel", ops: ops([["1", "B3 – infrequente (≤ 3×/min)"], ["2", "B4 – frequente (~8×/min)"], ["3", "B5 – muito frequente (≥ 12×/min)"]]), se: (v) => v.Btipo === "din" },
        { id: "C", rot: "C – altura das mãos", tipo: "sel", ops: ops([["1", "C1 – cintura ou abaixo"], ["2", "C2 – quase no tórax"], ["3", "C3 – ombro ou acima"]]) },
        { id: "Dq", rot: "D – movimento do ombro/braço", tipo: "sel", ops: ops([["1", "D1 – infrequente"], ["2", "D2 – frequente"], ["3", "D3 – muito frequente"]]) },
        { id: "E", rot: "E – punho", tipo: "sel", ops: ops([["1", "E1 – próximo do neutro"], ["2", "E2 – em desvio ou flexão/extensão"]]) },
        { id: "F", rot: "F – repetição de movimentos similares", tipo: "sel", ops: ops([["1", "F1 – ≤ 10×/min"], ["2", "F2 – 11 a 20×/min"], ["3", "F3 – > 20×/min"]]) },
        { id: "G", rot: "G – cabeça/pescoço flexionado ou em rotação", tipo: "sel", ops: ops([["1", "G1 – não"], ["2", "G2 – ocasionalmente"], ["3", "G3 – continuamente"]]) },
        { tipo: "titulo", rot: "Avaliação do trabalhador" },
        { id: "H", rot: "H – peso máximo transportado", tipo: "sel", ops: ops([["1", "H1 – leve (≤ 5 kg)"], ["2", "H2 – moderado (6 a 10 kg)"], ["3", "H3 – pesado (11 a 20 kg)"], ["4", "H4 – muito pesado (> 20 kg)"]]) },
        { id: "J", rot: "J – tempo por dia na tarefa", tipo: "sel", ops: ops([["1", "J1 – < 2 h"], ["2", "J2 – 2 a 4 h"], ["3", "J3 – > 4 h"]]) },
        { id: "K", rot: "K – força máxima com uma mão", tipo: "sel", ops: ops([["1", "K1 – baixa (< 1 kg)"], ["2", "K2 – média (1 a 4 kg)"], ["3", "K3 – alta (> 4 kg)"]]) },
        { id: "L", rot: "L – demanda visual", tipo: "sel", ops: ops([["1", "L1 – baixa"], ["2", "L2 – alta (pequenos detalhes)"]]) },
        { id: "M", rot: "M – direção de veículo", tipo: "sel", ops: ops([["1", "M1 – < 1 h/dia ou nunca"], ["2", "M2 – 1 a 4 h/dia"], ["3", "M3 – > 4 h/dia"]]) },
        { id: "N", rot: "N – ferramentas vibratórias", tipo: "sel", ops: ops([["1", "N1 – < 1 h/dia ou nunca"], ["2", "N2 – 1 a 4 h/dia"], ["3", "N3 – > 4 h/dia"]]) },
        { id: "P", rot: "P – dificuldade de manter o ritmo", tipo: "sel", ops: ops([["1", "P1 – nunca"], ["2", "P2 – às vezes"], ["3", "P3 – com frequência"]]) },
        { id: "Q", rot: "Q – estresse no trabalho", tipo: "sel", ops: ops([["1", "Q1 – pouco"], ["2", "Q2 – levemente"], ["3", "Q3 – moderadamente"], ["4", "Q4 – muito estressante"]]) },
      ],
      calcular(v) {
        const g_ = (k) => num(pegar(v, k)); const t = (i, j) => 2 * (i + j - 1);
        const req = ["A", "C", "Dq", "E", "F", "G", "H", "J", "K", "L"]; if (req.some((k) => g_(k) == null) || !v.Btipo || (v.Btipo === "est" ? g_("Best") == null : g_("Bdin") == null)) return incompleto();
        const A = g_("A"), C = g_("C"), Dq = g_("Dq"), E = g_("E"), F = g_("F"), G = g_("G"), H = g_("H"), J = g_("J"), K = g_("K"), L = g_("L");
        let coluna = t(A, H) + t(A, J) + t(J, H);
        coluna += v.Btipo === "est" ? t(g_("Best"), J) : t(g_("Bdin"), H) + (g_("Bdin") === 3 ? 2 * (J + 2) : 0);
        const ombro = t(C, H) + t(C, J) + t(J, H) + t(Dq, H) + t(Dq, J);
        const punho = t(F, K) + t(F, J) + t(J, K) + t(E, K) + t(E, J);
        const pescoco = t(G, J) + t(L, J);
        const faixa = (x, lim) => (x <= lim[0] ? ["Baixo", 1] : x <= lim[1] ? ["Moderado", 2] : x <= lim[2] ? ["Alto", 3] : ["Muito alto", 4]);
        const r = {
          coluna: faixa(coluna, v.Btipo === "est" ? [15, 22, 29] : [20, 30, 40]), ombro: faixa(ombro, [20, 30, 40]), punho: faixa(punho, [20, 30, 40]), pescoco: faixa(pescoco, [6, 10, 14]),
        };
        const nivel = Math.max(r.coluna[1], r.ombro[1], r.punho[1], r.pescoco[1]);
        const extra = [["Direção de veículos (M)", ["", "Baixo", "Moderado", "Alto"][g_("M") || 0] || "-"], ["Vibração (N)", ["", "Baixo", "Moderado", "Alto"][g_("N") || 0] || "-"], ["Ritmo de trabalho (P)", ["", "Baixo", "Moderado", "Alto"][g_("P") || 0] || "-"], ["Estresse (Q)", ["", "Baixo", "Moderado", "Alto", "Muito alto"][g_("Q") || 0] || "-"]];
        return res(true, `Coluna ${coluna} · ombro/braço ${ombro} · punho/mão ${punho} · pescoço ${pescoco}`, `Risco ${NIVEIS[nivel].toLowerCase()} (pior região)`, nivel,
          [["Coluna (" + (v.Btipo === "est" ? "estática" : "dinâmica") + ")", `${coluna} – risco ${r.coluna[0].toLowerCase()}`], ["Ombro/braço", `${ombro} – risco ${r.ombro[0].toLowerCase()}`], ["Punho/mão", `${punho} – risco ${r.punho[0].toLowerCase()}`], ["Pescoço", `${pescoco} – risco ${r.pescoco[0].toLowerCase()}`]].concat(extra));
      },
    },
    {
      id: "rodgers", nome: "Suzanne Rodgers (Muscle Fatigue Analysis)", sigla: "Suzanne Rodgers",
      ref: "Rodgers, S. H. A functional job evaluation technique. Occupational Medicine: State of the Art Reviews, 7(4), 679-711, 1992.",
      descricao: "Avalia a fadiga muscular por região do corpo combinando o nível de esforço (baixo, moderado, pesado), a duração contínua do esforço e a frequência do esforço; a combinação define a prioridade de mudança (baixa, moderada, alta ou muito alta).",
      exposicao: true,
      campos: () => {
        const rs = D().rodgersRegioes || []; const out = [];
        rs.forEach((r, i) => {
          out.push({ tipo: "titulo", rot: r.regiao, nota: `1 baixo: ${r.desc[0]} · 2 moderado: ${r.desc[1]} · 3 pesado: ${r.desc[2]}` });
          const lados = r.lados && r.lados.length;
          out.push({ id: "n" + i, rot: "Nível do esforço", tipo: "sel", lados, ops: ops([["1", "1 – baixo"], ["2", "2 – moderado"], ["3", "3 – pesado"]]) });
          out.push({ id: "d" + i, rot: "Duração do esforço", tipo: "sel", lados, ops: ops([["1", "1 – < 6 s"], ["2", "2 – 6 a 20 s"], ["3", "3 – 20 a 30 s"], ["4", "4 – > 30 s"]]) });
          out.push({ id: "f" + i, rot: "Frequência do esforço", tipo: "sel", lados, ops: ops([["1", "1 – < 1/min"], ["2", "2 – 1 a 5/min"], ["3", "3 – > 5 a 15/min"], ["4", "4 – > 15/min"]]) });
        });
        return out;
      },
      calcular(v) {
        const rs = D().rodgersRegioes || [], M = D().rodgers || {}; const mem = []; let nivel = -1, algum = false, invalido = false;
        const mapa = { Baixo: 1, Moderado: 2, Alto: 3, "Muito alto": 4 };
        rs.forEach((r, i) => {
          const sufs = r.lados && r.lados.length ? [["_e", " esq."], ["_d", " dir."]] : [["", ""]];
          sufs.forEach(([s, rot]) => {
            const n = pegar(v, "n" + i + s), d = pegar(v, "d" + i + s), f = pegar(v, "f" + i + s);
            if (n == null || d == null || f == null) return; algum = true;
            const cod = `${n}${d}${f}`, cl = M[cod] || "N/A";
            if (cl === "N/A") invalido = true; else nivel = Math.max(nivel, mapa[cl] || 0);
            mem.push([r.regiao + rot, `${cod} – ${cl === "N/A" ? "combinação não aplicável" : "prioridade " + cl.toLowerCase()}`]);
          });
        });
        if (!algum) return incompleto();
        if (nivel < 0) return res(false, "", "Combinação de duração e frequência não aplicável", null, mem);
        return res(true, `${mem.length} região(ões) avaliada(s)`, `Prioridade ${NIVEIS[nivel].toLowerCase()} (pior região)` + (invalido ? " · há combinação não aplicável" : ""), nivel, mem);
      },
    },
    {
      id: "plibel", nome: "PLIBEL", sigla: "PLIBEL",
      ref: "Kemmlert, K. A method assigned for the identification of ergonomic hazards – PLIBEL. Applied Ergonomics, 26, 199-211, 1995.",
      descricao: "Checklist de identificação de perigos ergonômicos por região do corpo (pescoço/ombros/costas superior; cotovelo/antebraço/mãos; pés; quadril e joelhos; costas inferior) e de fatores organizacionais e ambientais. O resultado é o número e o percentual de itens assinalados em cada região; o método não define faixas de risco, por isso o nível é atribuído pelo ergonomista.",
      exposicao: false, manual: true,
      campos: () => {
        const REG = ["Pescoço, ombros, costas superior", "Cotovelo, antebraço e mãos", "Pés", "Quadril e joelhos", "Costas inferior"];
        const out = [{ tipo: "nota", rot: "Marque as regiões do corpo em que cada fator de risco está presente." }];
        (D().plibel || []).forEach((q, i) => {
          if (q.cab) { out.push({ tipo: "titulo", rot: q.t }); return; }
          if (q.org) { out.push({ id: "o" + i, rot: q.t, tipo: "sel", ops: SN, grupo: "Riscos organizacionais e ambientais" }); return; }
          out.push({ id: "q" + i, rot: q.t, tipo: "multi", ops: q.ap.map((k) => ({ v: String(k), t: REG[k] })) });
        });
        return out;
      },
      calcular(v) {
        const REG = ["Pescoço, ombros, costas superior", "Cotovelo, antebraço e mãos", "Pés", "Quadril e joelhos", "Costas inferior"], TOT = [26, 11, 8, 8, 21];
        const cont = [0, 0, 0, 0, 0]; let org = 0, nOrg = 0;
        (D().plibel || []).forEach((q, i) => {
          if (q.cab) return;
          if (q.org) { nOrg++; if (pegar(v, "o" + i) === "Sim") org++; return; }
          (Array.isArray(v["q" + i]) ? v["q" + i] : []).forEach((k) => { cont[Number(k)]++; });
        });
        const mem = REG.map((r, k) => [r, `${cont[k]} de ${TOT[k]} (${fmt(cont[k] / TOT[k] * 100, 0)}%)`]).concat([["Riscos organizacionais e ambientais", `${org} de ${nOrg} (${fmt(nOrg ? org / nOrg * 100 : 0, 0)}%)`]]);
        return res(true, `Itens assinalados: ${cont.reduce((a, b) => a + b, 0)} (osteomuscular) · ${org} (organizacional)`, "Nível atribuído pelo ergonomista", null, mem);
      },
    },
    {
      id: "niosh", nome: "Equação de NIOSH (ISO 11228-1)", sigla: "NIOSH",
      ref: "Waters, T. R. et al. Applications manual for the revised NIOSH lifting equation. NIOSH, 1994. ISO/TR 12295:2014. ABNT NBR ISO 11228-1:2017.",
      descricao: "Calcula o Limite de Peso Recomendado (LPR = LC × HM × VM × DM × AM × FM × CM × OM × PM) para o levantamento manual e o Índice de Levantamento (IL = peso real ÷ LPR). IL ≤ 1,0 aceitável; 1,0 a 2,0 risco moderado; 2,0 a 3,0 risco alto; acima de 3,0 risco muito alto.",
      exposicao: true,
      campos: [
        { id: "lc", rot: "Constante de carga (LC) – sexo e idade", tipo: "sel", ops: ops([["25", "Homens 18-45 anos (25 kg)"], ["20", "Homens < 18 ou > 45 anos / mulheres 18-45 (20 kg)"], ["15", "Mulheres < 18 ou > 45 anos (15 kg)"]]) },
        { id: "h", rot: "H – distância horizontal mãos–corpo (cm, 25 a 63)", tipo: "num" },
        { id: "vv", rot: "V – altura das mãos no início do levantamento (cm, 0 a 175)", tipo: "num" },
        { id: "dd", rot: "D – deslocamento vertical origem–destino (cm, 25 a 175)", tipo: "num" },
        { id: "a", rot: "A – ângulo de assimetria (graus, 0 a 135)", tipo: "num" },
        { id: "fr", rot: "Frequência de levantamentos (por minuto)", tipo: "num" },
        { id: "du", rot: "Duração do trabalho de levantamento", tipo: "sel", ops: ops([["1", "≤ 1 hora"], ["2", "> 1 e ≤ 2 horas"], ["3", "> 2 e ≤ 8 horas"]]) },
        { id: "pg", rot: "Qualidade da pega", tipo: "sel", ops: ops([["boa", "Boa"], ["media", "Média"], ["pobre", "Pobre"]]) },
        { id: "om", rot: "Levantamento com uma só mão", tipo: "sel", ops: ops([["1", "Não"], ["0.6", "Sim (× 0,6)"]]) },
        { id: "pm", rot: "Levantamento em equipe", tipo: "sel", ops: ops([["1", "Não (1 trabalhador)"], ["0.67", "2 trabalhadores (× 0,67)"], ["0.5", "3 trabalhadores (× 0,5)"]]) },
        { id: "peso", rot: "Peso real da carga (kg)", tipo: "num" },
      ],
      calcular(v) {
        const [LC, H, V, Dd, A, F, du, P] = ["lc", "h", "vv", "dd", "a", "fr", "du", "peso"].map((k) => num(pegar(v, k)));
        if ([LC, H, V, Dd, A, F, du, P].some((x) => x == null) || !v.pg) return incompleto();
        const HM = H <= 25 ? 1 : H > 63 ? 0 : 25 / H; const VM = V > 175 ? 0 : 1 - 0.003 * Math.abs(V - 75); const DM = Dd < 25 ? 1 : Dd > 175 ? 0 : 0.82 + 4.5 / Dd; const AM = A > 135 ? 0 : 1 - 0.0032 * A;
        const linha = NIOSH_FREQ.find((x) => F <= x[0]) || NIOSH_FREQ[NIOSH_FREQ.length - 1]; const FM = linha[1][(du - 1) * 2 + (V >= 75 ? 1 : 0)];
        const CM = v.pg === "boa" ? 1 : v.pg === "media" ? (V < 75 ? 0.95 : 1) : 0.9; const OM = num(v.om) || 1, PM = num(v.pm) || 1;
        const LPR = LC * HM * VM * DM * AM * FM * CM * OM * PM; const IL = LPR > 0 ? P / LPR : Infinity;
        const cl = IL <= 1 ? ["Aceitável", 1] : IL <= 2 ? ["Risco moderado", 2] : IL <= 3 ? ["Risco alto", 3] : ["Risco muito alto", 4];
        return res(true, `LPR ${fmt(LPR, 2)} kg · IL ${isFinite(IL) ? fmt(IL, 2) : "∞"}`, cl[0], cl[1], [["Multiplicadores", `HM ${fmt(HM, 3)} · VM ${fmt(VM, 3)} · DM ${fmt(DM, 3)} · AM ${fmt(AM, 3)} · FM ${fmt(FM, 2)} · CM ${fmt(CM, 2)} · OM ${fmt(OM, 2)} · PM ${fmt(PM, 2)}`], ["Limite de peso recomendado (LPR)", `${fmt(LPR, 2)} kg (LC ${LC} kg)`], ["Peso real da carga", `${fmt(P, 1)} kg`], ["Índice de levantamento (IL)", `${isFinite(IL) ? fmt(IL, 2) : "∞"} – ${cl[0]}`]]);
      },
    },
    {
      id: "ocra", nome: "Checklist OCRA", sigla: "OCRA",
      ref: "Colombini, D. Método OCRA para análise e prevenção do risco por movimentos repetitivos. São Paulo: LTr, 2008. Colombini, D. et al. Atualização Checklist OCRA. EPM, 2013.",
      descricao: "Avalia o risco por movimentos repetitivos dos membros superiores somando os fatores frequência, força, postura (com estereotipia) e complementares, multiplicados pelo fator de recuperação e corrigidos pelo tempo líquido de trabalho repetitivo. Até 7,5 aceitável; 7,6 a 11 muito leve; 11,1 a 14 leve; 14,1 a 22,5 médio; 22,6 ou mais elevado.",
      exposicao: true,
      campos: [
        { tipo: "titulo", rot: "Duração e ciclo" },
        { id: "t_ef", rot: "Duração efetiva do turno (min)", tipo: "num" },
        { id: "t_pa", rot: "Pausas efetivas (min, exceto refeição)", tipo: "num" },
        { id: "t_re", rot: "Refeição dentro do turno (min)", tipo: "num" },
        { id: "t_nr", rot: "Trabalhos não repetitivos (min)", tipo: "num" },
        { tipo: "titulo", rot: "Fator frequência" },
        { id: "fd", rot: "Ações técnicas dinâmicas", tipo: "sel", lados: true, ops: ops([["0", "0 – lentos, interrupções frequentes (20 ações/min)"], ["1", "1 – não muito velozes (30/min), breves interrupções"], ["3", "3 – mais rápidos (40/min), breves interrupções"], ["4", "4 – bastante rápidos (40/min), interrupções escassas"], ["6", "6 – rápidos e constantes (50/min)"], ["8", "8 – muito rápidos (60/min)"], ["10", "10 – frequências elevadíssimas (≥ 70/min)"]]) },
        { id: "fs", rot: "Ações técnicas estáticas", tipo: "sel", lados: true, ops: ops([["0", "0 – preensão estática < 50% do ciclo"], ["2.5", "2,5 – ≥ 5 s ocupando 2/3 do ciclo"], ["4.5", "4,5 – ≥ 5 s ocupando 3/3 do ciclo"]]) },
        { tipo: "titulo", rot: "Fator recuperação e força" },
        { id: "hr", rot: "Horas sem recuperação adequada", tipo: "sel", ops: ops(["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5", "8"]) },
        { id: "fo", rot: "Força (Borg CR-10 – maior pontuação aplicável)", tipo: "sel", lados: true, ops: ops([["0", "Sem força relevante"], ["2", "Moderada (Borg 3-4) – 1/3 do tempo"], ["4", "Moderada – metade do tempo / forte 2 s a cada 10 min"], ["6", "Moderada – mais da metade do tempo / quase máxima 2 s a cada 10 min"], ["8", "Moderada – quase todo o tempo / forte 1% do tempo"], ["12", "Quase máxima – 1% do tempo"], ["16", "Forte – 5% do tempo"], ["24", "Forte > 10% / quase máxima 5% do tempo"], ["32", "Quase máxima > 10% do tempo"]]) },
        { tipo: "titulo", rot: "Fator postura" },
        { id: "po", rot: "Ombro", tipo: "sel", lados: true, ops: ops([["0", "0"], ["1", "1 – braços levantados ≥ metade do tempo"], ["2", "2 – quase na altura do ombro ~10% do tempo"], ["6", "6 – ~1/3 do tempo"], ["12", "12 – mais da metade do tempo"], ["24", "24 – quase o tempo todo"]]) },
        { id: "pc", rot: "Cotovelo", tipo: "sel", lados: true, ops: ops([["0", "0"], ["2", "2 – amplos movimentos ~1/3 do tempo"], ["4", "4 – mais da metade do tempo"], ["8", "8 – o tempo inteiro"]]) },
        { id: "pp", rot: "Punho", tipo: "sel", lados: true, ops: ops([["0", "0"], ["2", "2 – desvios extremos ≥ 1/3 do tempo"], ["4", "4 – mais da metade do tempo"], ["8", "8 – quase o tempo todo"]]) },
        { id: "pd", rot: "Mãos e dedos (pinça, preensão palmar, gancho)", tipo: "sel", lados: true, ops: ops([["0", "0"], ["2", "2 – ~1/3 do tempo"], ["4", "4 – mais da metade do tempo"], ["8", "8 – quase o tempo inteiro"]]) },
        { id: "es", rot: "Estereotipia", tipo: "sel", ops: ops([["0", "Ausente"], ["1.5", "Moderada (1,5)"], ["3", "Elevada (3)"]]) },
        { tipo: "titulo", rot: "Fatores complementares" },
        { id: "cf", rot: "Fatores físicos", tipo: "sel", ops: ops([["0", "Ausentes"], ["2", "2 – algum fator > metade do tempo"], ["3", "3 – um ou mais fatores quase o tempo todo"], ["4", "4 – ferramentas de alta vibração ≥ 1/3 do tempo"]]) },
        { id: "co", rot: "Fatores organizacionais", tipo: "sel", ops: ops([["0", "Ritmo não determinado pela máquina"], ["1", "1 – ritmo da máquina com 'pulmão'"], ["2", "2 – ritmo totalmente determinado pela máquina"]]) },
      ],
      calcular(v) {
        const [ef, pa, re, nr] = ["t_ef", "t_pa", "t_re", "t_nr"].map((k) => num(pegar(v, k)) || 0);
        const liq = ef - pa - re - nr; if (!ef) return incompleto([["Tempo líquido de trabalho repetitivo", "-"]]);
        const hr = num(pegar(v, "hr")); if (hr == null) return incompleto();
        const rec = OCRA_REC[Math.round(hr * 2)] || 1, cor = ocraDuracao(liq), comp = (num(v.cf) || 0) + (num(v.co) || 0), est = num(v.es) || 0;
        const lado = (s) => {
          const f1 = num(pegar(v, "fd" + s)), f2 = num(pegar(v, "fs" + s)); if (f1 == null && f2 == null) return null;
          const freq = Math.max(f1 || 0, f2 || 0), forca = num(pegar(v, "fo" + s)) || 0, post = Math.max(...["po", "pc", "pp", "pd"].map((k) => num(pegar(v, k + s)) || 0)) + est;
          const intr = (freq + forca + post + comp) * rec; return { freq, forca, post, intr, final: intr * cor };
        };
        const e = lado("_e"), d = lado("_d"); if (!e && !d) return incompleto();
        const pior = Math.max(e ? e.final : 0, d ? d.final : 0); const [classe, nivel] = ocraClasse(pior);
        const det = (x) => (x ? `${fmt(x.final, 1)} (freq. ${fmt(x.freq, 1)} + força ${x.forca} + postura ${fmt(x.post, 1)} + compl. ${comp}) × rec. ${rec} × dur. ${cor}` : "-");
        return res(true, `Esq. ${e ? fmt(e.final, 1) : "-"} · dir. ${d ? fmt(d.final, 1) : "-"}`, classe, nivel, [["Tempo líquido de trabalho repetitivo", `${fmt(liq, 0)} min (fator ${cor})`], ["Multiplicador de recuperação", `${rec} (${fmt(hr, 1)} h sem recuperação)`], ["Lado esquerdo", det(e)], ["Lado direito", det(d)], ["Classificação", classe]]);
      },
    },
    {
      id: "ocraTrad", nome: "Checklist OCRA – modelo tradicional (frequência por ações técnicas)", sigla: "OCRA tradicional",
      ref: "Colombini, D.; Occhipinti, E.; Cerbai, M.; Santino, E.; Facci, R. Checklist OCRA – modelo tradicional. EPM, Milão, 2011.",
      descricao: "Mesma lógica do Checklist OCRA, com a frequência calculada a partir do número de ações técnicas contadas no ciclo e do tempo de ciclo (ações por minuto), considerando se há possibilidade de breves interrupções.",
      exposicao: true,
      campos: [
        { tipo: "titulo", rot: "Duração e ciclo" },
        { id: "t_ef", rot: "Duração efetiva do turno (min)", tipo: "num" },
        { id: "t_pa", rot: "Pausas efetivas (min, exceto refeição)", tipo: "num" },
        { id: "t_re", rot: "Refeição dentro do turno (min)", tipo: "num" },
        { id: "t_nr", rot: "Trabalhos não repetitivos (min)", tipo: "num" },
        { id: "ciclo", rot: "Tempo de ciclo (s)", tipo: "num" },
        { tipo: "titulo", rot: "Frequência" },
        { id: "na", rot: "Nº de ações técnicas no ciclo", tipo: "num", lados: true },
        { id: "int", rot: "São possíveis breves interrupções?", tipo: "sel", ops: SN },
        { id: "fs", rot: "Ações estáticas", tipo: "sel", lados: true, ops: ops([["0", "0 – < 2/3 do ciclo"], ["2.5", "2,5 – ≥ 5 s em 2/3 do ciclo"], ["4.5", "4,5 – ≥ 5 s em 3/3 do ciclo"]]) },
        { tipo: "titulo", rot: "Recuperação, força, postura e complementares" },
        { id: "hr", rot: "Horas sem recuperação adequada", tipo: "sel", ops: ops(["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5", "8"]) },
        { id: "fo", rot: "Força (pontuação do checklist)", tipo: "sel", lados: true, ops: ops(["0", "2", "4", "6", "8", "12", "16", "24", "32"]) },
        { id: "po", rot: "Postura – maior pontuação entre ombro, cotovelo, punho e mão", tipo: "sel", lados: true, ops: ops(["0", "1", "2", "4", "6", "8", "12", "24"]) },
        { id: "es", rot: "Estereotipia", tipo: "sel", ops: ops([["0", "Ausente"], ["1.5", "Moderada (1,5)"], ["3", "Elevada (3)"]]) },
        { id: "cf", rot: "Fatores complementares (físicos + organizacionais)", tipo: "sel", ops: ops(["0", "1", "2", "3", "4", "5", "6"]) },
      ],
      calcular(v) {
        const [ef, pa, re, nr, ciclo] = ["t_ef", "t_pa", "t_re", "t_nr", "ciclo"].map((k) => num(pegar(v, k)) || 0);
        const liq = ef - pa - re - nr; const hr = num(pegar(v, "hr")); if (!ef || !ciclo || hr == null || !v.int) return incompleto();
        const rec = OCRA_REC[Math.round(hr * 2)] || 1, cor = ocraDuracao(liq), comp = num(v.cf) || 0, est = num(v.es) || 0;
        const lado = (s) => { const n = num(pegar(v, "na" + s)); if (n == null) return null; const apm = n * 60 / ciclo; const freq = Math.max(ocraFreqPorAcoes(apm, v.int === "Não"), num(pegar(v, "fs" + s)) || 0); const intr = (freq + (num(pegar(v, "fo" + s)) || 0) + (num(pegar(v, "po" + s)) || 0) + est + comp) * rec; return { apm, freq, final: intr * cor }; };
        const e = lado("_e"), d = lado("_d"); if (!e && !d) return incompleto();
        const [classe, nivel] = ocraClasse(Math.max(e ? e.final : 0, d ? d.final : 0));
        return res(true, `Esq. ${e ? fmt(e.final, 1) : "-"} · dir. ${d ? fmt(d.final, 1) : "-"}`, classe, nivel, [["Tempo líquido / fator de duração", `${fmt(liq, 0)} min / ${cor}`], ["Multiplicador de recuperação", String(rec)], ["Esquerdo", e ? `${fmt(e.apm, 1)} ações/min (freq. ${e.freq}) → ${fmt(e.final, 1)}` : "-"], ["Direito", d ? `${fmt(d.apm, 1)} ações/min (freq. ${d.freq}) → ${fmt(d.final, 1)}` : "-"], ["Classificação", classe]]);
      },
    },
    {
      id: "rosa", nome: "ROSA (Rapid Office Strain Assessment)", sigla: "ROSA",
      ref: "Sonne, M.; Villalta, D. L.; Andrews, D. M. Development and evaluation of an office ergonomic risk checklist: ROSA. Applied Ergonomics, 43(1), 98-108, 2012.",
      descricao: "Avaliação de postos de escritório: cadeira (altura e profundidade do assento, apoio dos braços e das costas), monitor e telefone, mouse e teclado, cada item com a duração de uso. 1 a 3 aceitável; 4 a 6 moderado (avaliação mais aprofundada); 7 a 10 alto (avaliação o mais rápido possível).",
      exposicao: true,
      campos: [
        { tipo: "titulo", rot: "Seção A – cadeira" },
        { id: "alt", rot: "Altura do assento", tipo: "sel", ops: ops([["1", "1 – joelhos a 90°"], ["2", "2 – muito baixa ou muito alta"], ["3", "3 – pés sem contato com o chão"]]) },
        { id: "altx", rot: "Altura: adicionais", tipo: "multi", ops: ops([["1", "+1 espaço insuficiente para as pernas"], ["1b", "+1 não é ajustável"]]) },
        { id: "prof", rot: "Profundidade do assento", tipo: "sel", ops: ops([["1", "1 – cerca de 3 cm entre joelhos e borda"], ["2", "2 – menos ou mais de 3 cm"]]) },
        { id: "profx", rot: "Profundidade: adicionais", tipo: "multi", ops: ops([["1", "+1 não é ajustável"]]) },
        { id: "bra", rot: "Apoio dos braços", tipo: "sel", ops: ops([["1", "1 – cotovelos apoiados, ombros relaxados"], ["2", "2 – muito alto ou muito baixo"]]) },
        { id: "brax", rot: "Apoio dos braços: adicionais", tipo: "multi", ops: ops([["1", "+1 superfície danificada/desconfortável"], ["1b", "+1 muito afastado"], ["1c", "+1 não é ajustável"]]) },
        { id: "cos", rot: "Apoio das costas", tipo: "sel", ops: ops([["1", "1 – suporte lombar adequado, 95-110°"], ["2", "2 – sem suporte lombar, inclinação inadequada ou sem apoio"]]) },
        { id: "cosx", rot: "Apoio das costas: adicionais", tipo: "multi", ops: ops([["1", "+1 superfície de trabalho muito alta"], ["1b", "+1 não é ajustável"]]) },
        { id: "durA", rot: "Duração – cadeira", tipo: "sel", ops: DURACAO },
        { tipo: "titulo", rot: "Seção B – monitor e telefone" },
        { id: "mon", rot: "Monitor", tipo: "sel", ops: ops([["1", "1 – 40 a 75 cm, altura adequada"], ["2", "2 – muito baixo (flexão > 30°)"], ["3", "3 – muito alto (extensão)"]]) },
        { id: "monx", rot: "Monitor: adicionais", tipo: "multi", ops: ops([["1", "+1 muito distante"], ["1b", "+1 rotação do pescoço > 30°"], ["1c", "+1 reflexo na tela"], ["1d", "+1 documentos sem suporte"]]) },
        { id: "durM", rot: "Duração – monitor", tipo: "sel", ops: DURACAO },
        { id: "tel", rot: "Telefone", tipo: "sel", ops: ops([["0", "Não usa"], ["1", "1 – headset ou uma mão, pescoço neutro"], ["2", "2 – muito distante (> 30 cm)"]]) },
        { id: "telx", rot: "Telefone: adicionais", tipo: "multi", ops: ops([["2", "+2 segura o fone entre pescoço e ombro"], ["1", "+1 sem opção de mãos livres"]]) },
        { id: "durT", rot: "Duração – telefone", tipo: "sel", ops: DURACAO },
        { tipo: "titulo", rot: "Seção C – mouse e teclado" },
        { id: "mou", rot: "Mouse", tipo: "sel", ops: ops([["1", "1 – alinhado com o ombro"], ["2", "2 – distante, fora da área de alcance"]]) },
        { id: "moux", rot: "Mouse: adicionais", tipo: "multi", ops: ops([["2", "+2 mouse e teclado em superfícies diferentes"], ["1", "+1 pega em pinça/mouse pequeno"], ["1b", "+1 apoio de punho inadequado"]]) },
        { id: "durMo", rot: "Duração – mouse", tipo: "sel", ops: DURACAO },
        { id: "tec", rot: "Teclado", tipo: "sel", ops: ops([["1", "1 – punho neutro, ombros relaxados"], ["2", "2 – inclinado, punho em extensão > 15°"]]) },
        { id: "tecx", rot: "Teclado: adicionais", tipo: "multi", ops: ops([["1", "+1 desvio radial/ulnar"], ["1b", "+1 muito alto"], ["1c", "+1 itens acima da cabeça"], ["1d", "+1 bancada não ajustável"]]) },
        { id: "durTe", rot: "Duração – teclado", tipo: "sel", ops: DURACAO },
      ],
      calcular(v) {
        const base = (k) => num(pegar(v, k)); const adic = (k) => (Array.isArray(v[k]) ? v[k] : []).reduce((s, x) => s + (parseInt(x, 10) || 0), 0);
        const req = ["alt", "prof", "bra", "cos", "durA", "mon", "durM", "tel", "mou", "durMo", "tec", "durTe"]; if (req.some((k) => base(k) == null)) return incompleto();
        const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
        const ap = clamp(base("alt") + adic("altx") + base("prof") + adic("profx"), 2, 8), bc = clamp(base("bra") + adic("brax") + base("cos") + adic("cosx"), 2, 9);
        const cadeira = clamp(ROSA_A[ap][bc - 2] + base("durA"), 1, 10);
        const monitor = clamp(base("mon") + adic("monx") + base("durM"), 0, 7), telefone = base("tel") ? clamp(base("tel") + adic("telx") + (base("durT") || 0), 0, 6) : 0;
        const mouse = clamp(base("mou") + adic("moux") + base("durMo"), 0, 7), teclado = clamp(base("tec") + adic("tecx") + base("durTe"), 0, 7);
        const B = ROSA_B[telefone][monitor], C = ROSA_C[mouse][teclado], MP = ROSA_MP(B, C), final = ROSA_F(cadeira, MP);
        const cl = final <= 3 ? ["Aceitável – ação não necessária", 1] : final <= 6 ? ["Moderado – avaliação mais aprofundada, não imediata", 2] : ["Alto – avaliação mais aprofundada o mais rápido possível", 3];
        return res(true, `ROSA final ${final}`, cl[0], cl[1], [["Cadeira (seção A)", String(cadeira)], ["Monitor e telefone (seção B)", String(B)], ["Mouse e teclado (seção C)", String(C)], ["Monitor e periféricos", String(MP)], ["Pontuação final", `${final} – ${cl[0]}`]]);
      },
    },
    {
      id: "kimLhc", nome: "KIM – Movimentação manual de cargas (levantar, segurar, carregar)", sigla: "KIM-LHC",
      ref: "BAuA/LASI. Avaliação das operações de movimentação manual baseada em indicadores-chave (KIM), 2001.",
      descricao: "Multiplica a pontuação do tempo (quantidade, duração ou distância no dia) pela soma das pontuações de carga efetiva, postura e condições de trabalho. Abaixo de 10 sobrecarga leve; 10 a 25 moderada; 25 a 50 alta; 50 ou mais muito elevada.",
      exposicao: true,
      campos: [
        { id: "tempo", rot: "Pontuação do tempo (quantidade, duração ou distância no dia)", tipo: "sel", ops: ops([["1", "1 – < 10 vezes / < 5 min / < 300 m"], ["2", "2 – 10 a < 40 / 5 a 15 min / 300 m a < 1 km"], ["4", "4 – 40 a < 200 / 15 min a < 1 h / 1 a < 4 km"], ["6", "6 – 200 a < 500 / 1 a < 2 h / 4 a < 8 km"], ["8", "8 – 500 a < 1000 / 2 a < 4 h / 8 a < 16 km"], ["10", "10 – ≥ 1000 / ≥ 4 h / ≥ 16 km"]]) },
        { id: "carga", rot: "Carga efetiva", tipo: "sel", ops: ops([["1", "1 – H < 10 kg / M < 5 kg"], ["2", "2 – H 10 a < 20 / M 5 a < 10 kg"], ["4", "4 – H 20 a < 30 / M 10 a < 15 kg"], ["7", "7 – H 30 a < 40 / M 15 a < 25 kg"], ["25", "25 – H ≥ 40 / M ≥ 25 kg"]]) },
        { id: "post", rot: "Postura e posição da carga", tipo: "sel", ops: ops([["1", "1 – tronco ereto, carga próxima"], ["2", "2 – leve flexão ou rotação, carga um pouco distante"], ["4", "4 – flexão e rotação, carga distante ou acima do ombro"], ["8", "8 – flexão e rotação simultâneas, agachado/ajoelhado"]]) },
        { id: "cond", rot: "Condições de trabalho", tipo: "sel", ops: ops([["0", "0 – boas"], ["1", "1 – espaço restrito, condições desfavoráveis"], ["2", "2 – espaço muito limitado, carga instável"]]) },
      ],
      calcular(v) {
        const [t, c, p, k] = ["tempo", "carga", "post", "cond"].map((x) => num(pegar(v, x))); if ([t, c, p, k].some((x) => x == null)) return incompleto();
        const total = (c + p + k) * t; const cl = total < 10 ? ["Sobrecarga leve (nível 1)", 1] : total < 25 ? ["Sobrecarga moderada (nível 2)", 2] : total < 50 ? ["Sobrecarga alta (nível 3)", 3] : ["Sobrecarga muito elevada (nível 4)", 4];
        return res(true, `Pontuação ${total}`, cl[0], cl[1], [["(Carga + postura + condições) × tempo", `(${c} + ${p} + ${k}) × ${t} = ${total}`], ["Nível de risco", cl[0]]]);
      },
    },
    {
      id: "kimPp", nome: "KIM – Empurrar e puxar", sigla: "KIM-PP",
      ref: "BAuA/LASI. Avaliação das operações de empurrar e puxar baseada em indicadores-chave (KIM), 2001.",
      descricao: "Multiplica a pontuação do tempo pela soma das pontuações de massa e equipamento, precisão/velocidade, postura e condições de trabalho (× 1,3 para mulheres). Abaixo de 10 sobrecarga leve; 10 a 25 moderada; 25 a 50 alta; 50 ou mais muito elevada.",
      exposicao: true,
      campos: () => {
        const R = D().kimRolar || { equip: [], faixas: [] }, S = D().kimDeslizar || { faixas: [] };
        return [
          { id: "tempo", rot: "Pontuação do tempo", tipo: "sel", ops: ops([["1", "1 – < 10 vezes / < 300 m"], ["2", "2 – 10 a < 40 / 300 m a < 1 km"], ["4", "4 – 40 a < 200 / 1 a < 4 km"], ["6", "6 – 200 a < 500 / 4 a < 8 km"], ["8", "8 – 500 a < 1000 / 8 a < 16 km"], ["10", "10 – ≥ 1000 / ≥ 16 km"]]) },
          { id: "modo", rot: "Tipo de movimentação", tipo: "sel", ops: ops([["rolar", "Rolamento (com rodas)"], ["deslizar", "Deslizamento"]]) },
          { id: "equip", rot: "Equipamento de transporte", tipo: "sel", ops: R.equip.map((t, i) => ({ v: String(i), t })), se: (v) => v.modo === "rolar" },
          { id: "massaR", rot: "Massa a mover (rolamento)", tipo: "sel", ops: R.faixas.map((t, i) => ({ v: String(i), t })), se: (v) => v.modo === "rolar" },
          { id: "massaD", rot: "Massa a mover (deslizamento)", tipo: "sel", ops: S.faixas.map((t, i) => ({ v: String(i), t })), se: (v) => v.modo === "deslizar" },
          { id: "prec", rot: "Precisão do posicionamento e velocidade", tipo: "sel", ops: ops([["1", "1 – precisão baixa, lenta (< 0,8 m/s)"], ["2", "2 – precisão baixa e rápida, ou alta e lenta"], ["4", "4 – precisão alta e rápida (0,8 a 1,3 m/s)"]]) },
          { id: "post", rot: "Postura", tipo: "sel", ops: ops([["1", "1 – tronco ereto"], ["2", "2 – ligeira flexão ou rotação"], ["4", "4 – corpo baixo, inclinado, ajoelhado"], ["8", "8 – flexão e rotação combinadas"]]) },
          { id: "cond", rot: "Condições de trabalho", tipo: "sel", ops: ops([["0", "0 – boas"], ["2", "2 – restritas"], ["4", "4 – difíceis"], ["8", "8 – complicadas (degraus, inclinação > 5°)"]]) },
          { id: "sexo", rot: "Sexo predominante", tipo: "sel", ops: ops([["M", "Homens"], ["F", "Mulheres (× 1,3)"]]) },
        ];
      },
      calcular(v) {
        const R = D().kimRolar || { v: [] }, S = D().kimDeslizar || { v: [] };
        const [t, pr, po, co] = ["tempo", "prec", "post", "cond"].map((x) => num(pegar(v, x))); if ([t, pr, po, co].some((x) => x == null) || !v.modo || !v.sexo) return incompleto();
        let massa = null;
        if (v.modo === "rolar") { if (v.equip == null || v.massaR == null) return incompleto(); massa = (R.v[Number(v.massaR)] || [])[Number(v.equip)]; } else { if (v.massaD == null) return incompleto(); massa = S.v[Number(v.massaD)]; }
        if (massa == null) return res(true, "Combinação a evitar", "Massa e equipamento em área crítica – deve ser evitada", 4, [["Massa/equipamento", "Combinação crítica ou a evitar (sem pontuação na tabela)"]]);
        const soma = massa + pr + po + co; const total = soma * t * (v.sexo === "F" ? 1.3 : 1);
        const cl = total < 10 ? ["Sobrecarga leve (nível 1)", 1] : total < 25 ? ["Sobrecarga moderada (nível 2)", 2] : total < 50 ? ["Sobrecarga alta (nível 3)", 3] : ["Sobrecarga muito elevada (nível 4)", 4];
        return res(true, `Pontuação ${fmt(total, 1)}`, cl[0], cl[1], [["(Massa + precisão + postura + condições) × tempo", `(${massa} + ${pr} + ${po} + ${co}) × ${t}${v.sexo === "F" ? " × 1,3" : ""} = ${fmt(total, 1)}`], ["Nível de risco", cl[0]]]);
      },
    },
    {
      id: "liberty", nome: "Tabelas psicofísicas Liberty Mutual (Snook & Ciriello) – empurrar e puxar", sigla: "Liberty Mutual",
      ref: "ABNT NBR ISO 11228-2:2017. Snook, S. H.; Ciriello, V. M. The design of manual handling tasks: revised tables of maximum acceptable weights and forces. Ergonomics, 1991.",
      descricao: "Compara as forças inicial e de manutenção medidas por dinamometria com as forças máximas aceitáveis (percentil 90) das tabelas psicofísicas de Snook & Ciriello, conforme sexo, altura da pega, distância percorrida e frequência. Força medida até o limite: aceitável; acima: risco.",
      exposicao: true,
      campos: () => {
        const L = D().liberty || { puxar: { cols: [] } }; const cols = L.puxar.cols || [];
        const dists = Array.from(new Set(cols.map((c) => c[0])));
        return [
          { id: "acao", rot: "Ação", tipo: "sel", ops: ops([["puxar", "Puxar"], ["empurrar", "Empurrar"]]) },
          { id: "sexo", rot: "Sexo", tipo: "sel", ops: ops([["M", "Masculino"], ["F", "Feminino"]]) },
          { id: "alt", rot: "Altura da pega", tipo: "sel", ops: (v) => ((v && v.sexo) === "F" ? ops([["135", "135 cm"], ["90", "90 cm"], ["60", "60 cm"]]) : ops([["145", "145 cm"], ["95", "95 cm"], ["65", "65 cm"]])) },
          { id: "dist", rot: "Distância percorrida", tipo: "sel", ops: ops(dists.map((d) => [String(d), d + " m"])) },
          { id: "freq", rot: "Uma ação a cada", tipo: "sel", ops: (v) => ops(cols.map((c, i) => [String(i), c[1].replace("s", " s").replace("m", " min").replace("h", " h")]).filter((o, i) => String(cols[i][0]) === String(v && v.dist))) },
          { id: "fi", rot: "Força inicial medida (kgf)", tipo: "num" },
          { id: "fm", rot: "Força de manutenção medida (kgf)", tipo: "num" },
        ];
      },
      calcular(v) {
        const L = D().liberty; if (!L || !v.acao || !v.sexo || !v.alt || v.freq == null) return incompleto();
        const tab = L[v.acao]; const ci = Number(v.freq); const linha = (tipo) => tab.rows.find((r) => r.sexo === v.sexo && String(r.alt) === String(v.alt) && r.tipo === tipo);
        const li = linha("FI"), lm = linha("FM"); if (!li || !lm) return incompleto();
        const limI = li.v[ci], limM = lm.v[ci], fi = num(v.fi), fm = num(v.fm); if (fi == null && fm == null) return incompleto();
        const rI = fi == null ? 0 : fi / limI, rM = fm == null ? 0 : fm / limM, pior = Math.max(rI, rM);
        const cl = pior <= 1 ? ["Aceitável – forças dentro do limite (P90)", 1] : ["Risco – força acima do limite aceitável (P90)", 3];
        const col = tab.cols[ci] || [];
        return res(true, `Inicial ${fmt(fi, 1)}/${limI} kgf · manutenção ${fmt(fm, 1)}/${limM} kgf`, cl[0], cl[1], [["Situação", `${v.acao === "puxar" ? "Puxar" : "Empurrar"} · ${v.sexo === "F" ? "feminino" : "masculino"} · pega ${v.alt} cm · ${col[0]} m · uma ação a cada ${col[1]}`], ["Força inicial", `${fi == null ? "-" : fmt(fi, 1)} kgf (limite ${limI} kgf) – ${fi == null ? "-" : rI <= 1 ? "aceitável" : "risco"}`], ["Força de manutenção", `${fm == null ? "-" : fmt(fm, 1)} kgf (limite ${limM} kgf) – ${fm == null ? "-" : rM <= 1 ? "aceitável" : "risco"}`]]);
      },
    },
    {
      id: "ergos", nome: "ERGOS – Carga mental", sigla: "ERGOS",
      ref: "ENSIDESA. La valoración de la carga mental según el método ERGOS. Empresa Nacional de Siderurgia, 1989.",
      descricao: "Avalia os fatores cognitivos da carga mental (pressão de tempo, atenção, complexidade, monotonia, raciocínio, iniciativa, isolamento, horários, relacionamentos e demandas gerais). Pontuação total = 0,83 × (A + B): 0 a 30 satisfatório; 31 a 60 aceitável; 61 a 100 deve melhorar.",
      exposicao: false,
      campos: () => { const out = []; let sec = null; (D().ergos || []).forEach((q, i) => { if (q.sec !== sec) { sec = q.sec; out.push({ tipo: "titulo", rot: sec }); } out.push({ id: "q" + i, rot: q.q, tipo: "sel", ops: q.ops.map((o, k) => ({ v: String(k), t: `${o[0]} (${o[1]})` })) }); }); return out; },
      calcular(v) {
        const qs = D().ergos || []; let soma = 0, n = 0; qs.forEach((q, i) => { const k = pegar(v, "q" + i); if (k == null) return; n++; soma += Number((q.ops[Number(k)] || [])[1]) || 0; });
        if (n < qs.length) return incompleto([["Questões respondidas", `${n} de ${qs.length}`]]);
        const total = soma * 0.83; const cl = total <= 30 ? ["Satisfatório", 1] : total <= 60 ? ["Aceitável – manter controle sistemático", 2] : ["Deve melhorar – medidas corretivas necessárias", 3];
        return res(true, `Carga mental ${fmt(total, 1)}`, cl[0], cl[1], [["Soma das questões (A + B)", String(soma)], ["Pontuação total (0,83 × (A + B))", `${fmt(total, 1)} – ${cl[0]}`]]);
      },
    },
    {
      id: "nasa", nome: "NASA-TLX (Task Load Index)", sigla: "NASA-TLX",
      ref: "Hart, S. G.; Staveland, L. E. Development of NASA-TLX: results of empirical and theoretical research. In: Hancock, P. A.; Meshkati, N. Human Mental Workload, 1988.",
      descricao: "Índice de carga de trabalho percebida pelo trabalhador, ponderando seis demandas (mental, física, temporal, performance, esforço e frustração) pela comparação par a par (15 pares) e pela classificação de 0 a 100 de cada uma. Os autores não propõem classificação final: quanto maior a pontuação, maior a carga percebida; o nível é atribuído pelo ergonomista.",
      exposicao: false, manual: true,
      campos: () => {
        const P = [["Mental", "Física"], ["Temporal", "Física"], ["Temporal", "Frustração"], ["Temporal", "Mental"], ["Performance", "Física"], ["Temporal", "Esforço"], ["Performance", "Mental"], ["Frustração", "Física"], ["Performance", "Frustração"], ["Frustração", "Mental"], ["Esforço", "Física"], ["Performance", "Esforço"], ["Esforço", "Mental"], ["Temporal", "Performance"], ["Esforço", "Frustração"]];
        const out = [{ tipo: "titulo", rot: "1. Comparação par a par: exigência predominante" }];
        P.forEach((p, i) => out.push({ id: "p" + i, rot: `${i + 1}. ${p[0]} × ${p[1]}`, tipo: "sel", ops: ops(p) }));
        out.push({ tipo: "titulo", rot: "2. Classificação de 0 a 100" });
        [["Mental", "Demanda mental"], ["Física", "Demanda física"], ["Temporal", "Demanda temporal"], ["Performance", "Performance (0 excelente, 100 ruim)"], ["Esforço", "Esforço/empenho"], ["Frustração", "Frustração"]].forEach(([k, r]) => out.push({ id: "r" + k, rot: r, tipo: "sel", ops: ops(["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"]) }));
        return out;
      },
      calcular(v) {
        const dims = ["Mental", "Física", "Temporal", "Performance", "Esforço", "Frustração"]; const peso = {}; dims.forEach((d) => (peso[d] = 0));
        for (let i = 0; i < 15; i++) { const x = pegar(v, "p" + i); if (x == null) return incompleto(); peso[x]++; }
        if (dims.some((d) => pegar(v, "r" + d) == null)) return incompleto();
        const total = dims.reduce((s, d) => s + peso[d] * num(v["r" + d]), 0) / 15;
        return res(true, `Índice global ${fmt(total, 1)}`, "Nível atribuído pelo ergonomista (o método não define faixas)", null, dims.map((d) => [d, `peso ${peso[d]} × taxa ${v["r" + d]} = ${peso[d] * num(v["r" + d])}`]).concat([["Carga de trabalho percebida – índice global", fmt(total, 1)]]));
      },
    },
    {
      id: "ice", nome: "ICE – Índice de Conforto Ergonômico", sigla: "ICE",
      ref: "Couto, H. A. Ergonomia do corpo e do cérebro: os princípios e a aplicação prática. Belo Horizonte: Ergo, 2014.",
      descricao: "Índice de conforto ergonômico da tarefa: a coluna A (postura, dispêndio energético e ambiente) desconta de 100 o maior valor; a coluna B (repetitividade, força, peso movimentado, postura em desvio, esforço estático, carga mental, graus de dificuldade, menos os mecanismos de regulação) desconta de 95; vale o menor. ≥ 87 boa; 77-86 razoável; 67-76 intensa; 57-66 muito intensa; < 57 crítica. Itens de desqualificação caracterizam exigência crítica.",
      exposicao: true,
      campos: () => {
        const d = D(); const out = [{ tipo: "titulo", rot: "Passo 1 – itens de desqualificação" }];
        (d.iceDesq || []).forEach((t, i) => out.push({ id: "dq" + i, rot: t, tipo: "sel", ops: SN }));
        out.push({ tipo: "titulo", rot: "Coluna A – postura, dispêndio energético e ambiente" });
        out.push({ id: "A1", rot: "A1 – postura do corpo", tipo: "sel", ops: ops([["0", "Alternado sentado e de pé (0)"], ["3", "De pé com apoio de nádegas e tapete (3)"], ["5", "De pé com banco de apoio / andando sem carga (5)"], ["4", "Sentado – bem sentado (4)"], ["8", "Parado com refeição e tapete (8)"], ["9", "Parado sem refeição, com tapete (9)"], ["10", "Parado com refeição sem tapete / mal sentado (10)"], ["11", "Parado sem refeição e sem tapete (11)"], ["14", "Andando com impedimento ou carga (14)"], ["20", "Tronco predominantemente encurvado (20) – exigência crítica"]]) });
        out.push({ id: "A2", rot: "A2 – dispêndio energético", tipo: "sel", ops: ops([["0", "Leve (0)"], ["10", "De pé fazendo força (10)"], ["30", "Cargas até 23 kg frequentes (30)"], ["50", "Pesado/pesadíssimo (50)"]]) });
        out.push({ id: "A3", rot: "A3 – calor", tipo: "sel", ops: ops(["0", "3", "4", "5", "8", "9", "10", "11", "12", "14", "20", "25", "30", "50", "75"].map((x) => [x, x])) });
        out.push({ id: "A4", rot: "A4 – frio", tipo: "sel", ops: ops([["0", "0"], ["12", "Ambiente externo ou salas muito frias (12)"]]) });
        out.push({ id: "A5", rot: "A5 – frigoríficos e câmaras frias", tipo: "sel", ops: ops([["0", "0"], ["25", "Antecâmaras, salas de corte (25)"], ["75", "Câmaras de resfriamento (75)"], ["87", "Túneis de congelamento (87)"]]) });
        out.push({ id: "A6", rot: "A6 – vibração segmentar", tipo: "sel", ops: ops([["0", "0"], ["20", "Média vibração, intermitente (20)"], ["50", "Média vibração, constante (50)"], ["70", "Alta vibração, intermitente (70)"], ["90", "Alta vibração, constante (90)"]]) });
        out.push({ id: "A7", rot: "A7 – vibração de corpo inteiro", tipo: "sel", ops: ops([["0", "0"], ["25", "Equipamento moderno, parado (25)"], ["50", "Equipamento moderno, em movimento (50)"], ["75", "Equipamento ruim, parado (75)"], ["88", "Equipamento ruim, em movimento (88)"]]) });
        out.push({ id: "A8", rot: "A8 – outros fatores", tipo: "sel", ops: ops([["0", "0"], ["5", "Ruído industrial típico (5)"], ["9", "Iluminação inadequada (9)"], ["15", "Ruído muito alto, EPI constritivo, confinado (15)"]]) });
        out.push({ tipo: "titulo", rot: "Coluna B – variáveis da tarefa" });
        out.push({ id: "B1", rot: "B1 – repetitividade", tipo: "sel", ops: ops(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]), nota: "9 ou 10 = exigência crítica" });
        out.push({ id: "B2", rot: "B2 – força", tipo: "sel", ops: ops(["0", "2", "3", "5", "7", "8", "10", "15", "20", "25"]) });
        out.push({ id: "B3", rot: "B3 – peso movimentado (kg × m × n por hora → pontuação)", tipo: "sel", ops: ops(["0", "2", "3", "4", "5", "7", "8", "10", "12", "14"]) });
        out.push({ id: "B4", rot: "B4 – postura em desvio (maior FPD)", tipo: "num" });
        out.push({ id: "B5", rot: "B5 – esforço estático (maior FEE)", tipo: "sel", ops: ops(["0", "1", "2", "3", "4", "5", "7", "10", "14", "20"]) });
        out.push({ id: "B6", rot: "B6 – carga mental (itens presentes, máx. 5)", tipo: "multi", ops: (d.iceB6 || []).map((t, i) => ({ v: String(i), t })) });
        out.push({ id: "B7", rot: "B7 – graus de dificuldade (máx. 5)", tipo: "multi", ops: (d.iceB7 || []).map((t, i) => ({ v: String(i), t })) });
        out.push({ id: "B8", rot: "B8 – mecanismos de regulação (máx. 5)", tipo: "multi", ops: (d.iceB8 || []).map((t, i) => ({ v: String(i), t })) });
        return out;
      },
      calcular(v) {
        const A = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"].map((k) => num(pegar(v, k))); if (A.some((x) => x == null)) return incompleto();
        const B = ["B1", "B2", "B3", "B4", "B5"].map((k) => num(pegar(v, k)) || 0);
        const cnt = (k) => Math.min(5, Array.isArray(v[k]) ? v[k].length : 0);
        const colA = 100 - Math.max(...A), colB = 95 - (B.reduce((a, b) => a + b, 0) + cnt("B6") + cnt("B7")) + cnt("B8"), ice = Math.min(colA, colB);
        const desq = (D().iceDesq || []).some((t, i) => v["dq" + i] === "Sim") || num(v.A1) === 20 || num(v.B1) >= 9;
        let cl = ice >= 87 ? ["Condição ergonômica boa", 1] : ice >= 77 ? ["Condição razoável; exigência ergonômica moderada", 2] : ice >= 67 ? ["Exigência ergonômica intensa; condição ruim", 3] : ice >= 57 ? ["Exigência ergonômica muito intensa; condição muito ruim", 4] : ["Exigência ergonômica crítica", 4];
        if (desq) cl = ["Exigência ergonômica crítica (item de desqualificação)", 4];
        return res(true, `ICE ${fmt(ice, 1)}`, cl[0], cl[1], [["Coluna A (100 − maior valor)", fmt(colA, 1)], ["Coluna B (95 − B1…B7 + B8)", fmt(colB, 1)], ["Índice de conforto ergonômico", `${fmt(ice, 1)} – ${cl[0]}`]].concat(desq ? [["Desqualificação", "Há item de desqualificação: exigência crítica"]] : []));
      },
    },
    {
      id: "nr17", nome: "Checklist NR-17", sigla: "Checklist NR-17",
      ref: "Norma Regulamentadora nº 17 – Ergonomia (checklist ElevaLife).",
      descricao: "Verificação do atendimento aos itens da NR-17 (levantamento e transporte de materiais, mobiliário, equipamentos, condições ambientais e organização do trabalho). O resultado é o número e o percentual de itens atendidos e não atendidos; o nível é atribuído pelo ergonomista.",
      exposicao: false, manual: true,
      campos: () => { const out = []; let sec = null; (D().nr17 || []).forEach((q, i) => { if (q.sec !== sec) { sec = q.sec; out.push({ tipo: "titulo", rot: sec }); } if (q.resp) out.push({ id: "q" + i, rot: `${q.item || ""} ${q.t}`.trim(), tipo: "sel", ops: ops([["Sim", "Sim"], ["Não", "Não"], ["NA", "Não se aplica"]]) }); else out.push({ tipo: "nota", rot: `${q.item || ""} ${q.t}`.trim() }); }); return out; },
      calcular(v) {
        const qs = D().nr17 || []; let s = 0, n = 0, na = 0; const porSec = {};
        qs.forEach((q, i) => { if (!q.resp) return; const r = pegar(v, "q" + i); if (r === "Sim") s++; else if (r === "Não") { n++; porSec[q.sec] = (porSec[q.sec] || 0) + 1; } else if (r === "NA") na++; });
        if (!s && !n) return incompleto();
        const tot = s + n;
        return res(true, `Atende ${s} · não atende ${n} · NA ${na}`, "Nível atribuído pelo ergonomista", null, [["Itens atendidos", `${s} (${fmt(tot ? s / tot * 100 : 0, 0)}%)`], ["Itens não atendidos", `${n} (${fmt(tot ? n / tot * 100 : 0, 0)}%)`]].concat(Object.keys(porSec).map((k) => ["Não atende – " + k, String(porSec[k])])));
      },
    },
  ];
  const porId = (id) => FERRAMENTAS.find((f) => f.id === id);
  const camposDe = (f) => (typeof f.campos === "function" ? f.campos() : f.campos);

  function calcular(id, valores) {
    const f = porId(id); if (!f) return res(false, "", "Ferramenta desconhecida", null);
    try { return f.calcular(valores || {}); } catch (e) { console.error("ferramenta " + id, e); return res(false, "", "Não foi possível calcular", null); }
  }

  // Formulario da ferramenta (DOM). aoMudar(valores) a cada alteracao.
  function formulario(id, valores, aoMudar, somenteLeitura) {
    const f = porId(id); const v = Object.assign({}, valores || {});
    const raiz = document.createElement("div"); raiz.className = "ferr-form";
    const desenhar = () => {
      raiz.innerHTML = "";
      camposDe(f).forEach((c) => {
        if (c.se && !c.se(v)) return;
        if (c.tipo === "titulo") { const h = document.createElement("div"); h.className = "ferr-titulo"; h.textContent = c.rot; raiz.appendChild(h); if (c.nota) { const n = document.createElement("div"); n.className = "ferr-nota"; n.textContent = c.nota; raiz.appendChild(n); } return; }
        if (c.tipo === "nota") { const n = document.createElement("div"); n.className = "ferr-nota"; n.textContent = c.rot; raiz.appendChild(n); return; }
        const linha = document.createElement("div"); linha.className = "ferr-campo" + (c.tipo === "multi" ? " ferr-campo--multi" : "");
        const rot = document.createElement("div"); rot.className = "ferr-rot"; rot.textContent = c.rot + (c.nota ? ` (${c.nota})` : ""); linha.appendChild(rot);
        // V 1.35: imagens de referencia da planilha de ferramentas, junto do campo
        const imgs = BI.FerramentasImagens && BI.FerramentasImagens[f.id] && BI.FerramentasImagens[f.id][c.id];
        if (imgs && imgs.length) {
          const tira = document.createElement("div"); tira.className = "ferr-imgs";
          imgs.forEach(([arq, leg]) => { const fig = document.createElement("figure"); const im = document.createElement("img"); im.src = "img/ferramentas/" + arq; im.alt = leg; im.loading = "lazy"; im.title = leg; fig.appendChild(im); const cap = document.createElement("figcaption"); cap.textContent = leg; fig.appendChild(cap); fig.addEventListener("click", () => fig.classList.toggle("ampliada")); tira.appendChild(fig); });
          linha.classList.add("ferr-campo--com-imgs"); linha.appendChild(tira);
        }
        const caixa = document.createElement("div"); caixa.className = "ferr-entradas";
        const sufixos = c.lados ? [["_e", "Esq."], ["_d", "Dir."]] : [["", ""]];
        sufixos.forEach(([s, r]) => {
          const chave = c.id + s; const opcs = typeof c.ops === "function" ? c.ops(v) : c.ops;
          let el;
          if (c.tipo === "sel") {
            el = document.createElement("select"); const o0 = document.createElement("option"); o0.value = ""; o0.textContent = r ? r + " –" : "-"; el.appendChild(o0);
            opcs.forEach((o) => { const op = document.createElement("option"); op.value = o.v; op.textContent = (r ? r + " " : "") + o.t; el.appendChild(op); });
            el.value = v[chave] != null ? String(v[chave]) : "";
            el.addEventListener("change", () => { v[chave] = el.value === "" ? null : el.value; aoMudar(Object.assign({}, v)); if (camposDe(f).some((x) => x.se || typeof x.ops === "function")) desenhar(); });
          } else if (c.tipo === "num") {
            el = document.createElement("input"); el.type = "text"; el.inputMode = "decimal"; el.placeholder = r || "valor"; el.value = v[chave] != null ? String(v[chave]).replace(".", ",") : "";
            el.addEventListener("change", () => { const n = num(el.value); v[chave] = n; el.value = n == null ? "" : String(n).replace(".", ","); aoMudar(Object.assign({}, v)); });
          } else if (c.tipo === "multi") {
            el = document.createElement("div"); el.className = "ferr-multi"; const sel = new Set(Array.isArray(v[chave]) ? v[chave].map(String) : []);
            opcs.forEach((o) => { const l = document.createElement("label"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = sel.has(o.v); cb.disabled = !!somenteLeitura;
              cb.addEventListener("change", () => { if (cb.checked) sel.add(o.v); else sel.delete(o.v); v[chave] = Array.from(sel); aoMudar(Object.assign({}, v)); });
              l.appendChild(cb); l.appendChild(document.createTextNode(" " + o.t)); el.appendChild(l); });
          }
          if (el && el.tagName !== "DIV") el.disabled = !!somenteLeitura;
          if (el) caixa.appendChild(el);
        });
        linha.appendChild(caixa); raiz.appendChild(linha);
      });
    };
    desenhar();
    return raiz;
  }

  BI.Ferramentas = { LISTA: FERRAMENTAS, NIVEIS, porId, camposDe, calcular, formulario };
})(window);
