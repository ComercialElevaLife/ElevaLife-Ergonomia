/* ==========================================================================
   S.I.G.E. - ElevaLife
   V 2.50 (Alexandre - solicitação 2): cálculo do BENCHMARK entre clientes.

   Calcula um conjunto de indicadores NORMALIZADOS (percentuais/taxas, para que
   empresas de tamanhos diferentes sejam comparáveis) por empresa e por unidade,
   sobre TODA a base. Devolve:
     - base / baseUnidades: distribuição ANÔNIMA (média, mediana, percentis, N)
       de cada indicador — nunca nome nem número cru de outra empresa.
     - função de percentil para posicionar um valor na régua ("melhor que X%").

   O módulo é PURO (não acessa banco) para poder ser testado isoladamente. A
   rota (api/src/functions/benchmark.js) carrega os dados e aplica o escopo do
   papel (o ranking identificado respeita empresasVisiveis/podeVerUnidade).
   ========================================================================== */

"use strict";

const MIN_N = 4; // N mínimo para divulgar a distribuição de um indicador (anonimato).

// unidade: "%", "dias" (1 casa), "num" (inteiro bruto), "num2" (2 casas), "/100" (1 casa).
// noScore: não entra na nota geral (régua geral) — vale para os níveis de risco separados
//   (evita contar o mesmo sinal 5x) e para os números BRUTOS (dependem do tamanho da empresa).
// bruto: número absoluto (não normalizado) — comparação de volume entre empresas.
const INDICADORES = [
  { chave: "cobertura", rotulo: "Cobertura de avaliações", unidade: "%", melhorEhMenor: false, grupo: "Cobertura" },
  { chave: "coberturaPsico", rotulo: "Cobertura psicossocial", unidade: "%", melhorEhMenor: false, grupo: "Cobertura" },

  { chave: "riscoSevero", rotulo: "Riscos altos + altíssimos (total)", unidade: "%", melhorEhMenor: true, grupo: "Riscos (fatores de risco)" },
  { chave: "nivelMuitoAlto", rotulo: "Riscos muito altos / altíssimos", unidade: "%", melhorEhMenor: true, grupo: "Riscos (fatores de risco)", noScore: true },
  { chave: "nivelAlto", rotulo: "Riscos altos", unidade: "%", melhorEhMenor: true, grupo: "Riscos (fatores de risco)", noScore: true },
  { chave: "nivelModerado", rotulo: "Riscos moderados", unidade: "%", melhorEhMenor: true, grupo: "Riscos (fatores de risco)", noScore: true },
  { chave: "nivelBaixo", rotulo: "Riscos baixos", unidade: "%", melhorEhMenor: false, grupo: "Riscos (fatores de risco)", noScore: true },
  { chave: "nivelTrivial", rotulo: "Riscos triviais", unidade: "%", melhorEhMenor: false, grupo: "Riscos (fatores de risco)", noScore: true },

  { chave: "acoesConcluidas", rotulo: "Ações concluídas", unidade: "%", melhorEhMenor: false, grupo: "Plano de ação" },
  { chave: "acoesAtraso", rotulo: "Ações em atraso", unidade: "%", melhorEhMenor: true, grupo: "Plano de ação" },
  { chave: "acoesNaoIniciadas", rotulo: "Ações não iniciadas", unidade: "%", melhorEhMenor: true, grupo: "Plano de ação" },

  { chave: "absDiasColab", rotulo: "Dias perdidos por colaborador", unidade: "dias", melhorEhMenor: true, grupo: "Absenteísmo" },
  { chave: "absDiasTotal", rotulo: "Dias perdidos (total)", unidade: "num", melhorEhMenor: true, grupo: "Absenteísmo", noScore: true, bruto: true },
  { chave: "atestadosColab", rotulo: "Atestados por colaborador", unidade: "num2", melhorEhMenor: true, grupo: "Absenteísmo" },
  { chave: "atestadosTotal", rotulo: "Atestados (total)", unidade: "num", melhorEhMenor: true, grupo: "Absenteísmo", noScore: true, bruto: true },

  { chave: "restritosPor100", rotulo: "Restritos por 100 colaboradores", unidade: "/100", melhorEhMenor: true, grupo: "Restritos" },
  { chave: "restritosBruto", rotulo: "Restritos (quantidade)", unidade: "num", melhorEhMenor: true, grupo: "Restritos", noScore: true, bruto: true },
];

function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
const chavePosto = (l) => ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo"].map((d) => l[d] || "").join("||");
const chaveGHE = (l) => ["Cliente", "Unidade", "Setor"].map((d) => l[d] || "").join("||");

// Nível de risco 1..5 a partir do nome da graduação (compatível com as matrizes
// padrão "Muito Baixo..Altíssimo" e com rótulos da Gerdau "Brando..Muito Crítico").
function nivelRank(g) {
  const s = norm(g);
  if (!s) return 0;
  if (/muito baix|trivial/.test(s)) return 1;
  if (/muito alto|altissim|muito critic/.test(s)) return 5;
  if (/\balto\b|critic|serio|s[ée]rio/.test(s)) return 4;
  if (/modera|medio|m[ée]dio/.test(s)) return 3;
  if (/baix|brando/.test(s)) return 2;
  return 0;
}
function fatorAtivo(f) {
  return String(f["Existe Fator Risco"] || "") === "Sim"
    && String(f["Risco Eliminado"] || "") !== "Sim"
    && String(f.Status || "") !== "Eliminado";
}
function temGraduacao(f) { return !!String(f["Graduacao Risco"] || "").trim(); }
function venceu(dtProgramada, hojeMs) {
  const s = String(dtProgramada || "").slice(0, 10).split("-").map(Number);
  if (s.length !== 3 || s.some(Number.isNaN)) return false;
  return Date.UTC(s[0], s[1] - 1, s[2]) < hojeMs;
}

// Calcula os indicadores de um recorte (uma empresa, ou uma empresa+unidade).
function metricasDoRecorte(d, hojeMs) {
  // 1) Cobertura de avaliações: % postos (cargo) com AEP ou AET.
  const universo = new Set((d.cargo || []).map(chavePosto));
  const avaliados = new Set();
  (d.avaliacaoErgonomica || []).forEach((a) => avaliados.add(chavePosto(a)));
  (d.aet || []).forEach((a) => { if (!a["Tipo Registro"] || a["Tipo Registro"] === "AET") avaliados.add(chavePosto(a)); });
  let cobertos = 0; universo.forEach((k) => { if (avaliados.has(k)) cobertos += 1; });
  const cobertura = universo.size ? (cobertos / universo.size) * 100 : null;

  // 2) Cobertura psicossocial: % setores GHE com algum fator Origem "Psicossocial".
  const universoGHE = new Set((d.setor || []).filter((s) => String(s.Tipo || "") === "GHE").map(chaveGHE));
  const comPsico = new Set((d.fatorRisco || []).filter((f) => norm(f.Origem) === "psicossocial").map(chaveGHE));
  let ghePsico = 0; universoGHE.forEach((k) => { if (comPsico.has(k)) ghePsico += 1; });
  const coberturaPsico = universoGHE.size ? (ghePsico / universoGHE.size) * 100 : null;

  // 3) Riscos por nível, a partir dos fatores ativos graduados (inventário de riscos).
  // Separado por nível (muito alto, alto, moderado, baixo, trivial) + o total alto/altíssimo.
  const fativos = (d.fatorRisco || []).filter((f) => fatorAtivo(f) && temGraduacao(f));
  const porRank = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  fativos.forEach((f) => { const r = nivelRank(f["Graduacao Risco"]); if (r) porRank[r] += 1; });
  const nf = fativos.length;
  const pctN = (c) => (nf ? (c / nf) * 100 : null);
  const riscoSevero = pctN(porRank[5] + porRank[4]);
  const nivelMuitoAlto = pctN(porRank[5]);
  const nivelAlto = pctN(porRank[4]);
  const nivelModerado = pctN(porRank[3]);
  const nivelBaixo = pctN(porRank[2]);
  const nivelTrivial = pctN(porRank[1]);

  // 4) Ações: concluídas / em atraso / não iniciadas.
  const acoes = d.planoAcao || [];
  const concl = acoes.filter((a) => String(a["Dt Conclusao"] || "").trim()).length;
  const acoesConcluidas = acoes.length ? (concl / acoes.length) * 100 : null;
  const emAtraso = acoes.filter((a) => !String(a["Dt Conclusao"] || "").trim() && venceu(a["Dt Programada"], hojeMs)).length;
  const acoesAtraso = acoes.length ? (emAtraso / acoes.length) * 100 : null;
  const naoIni = acoes.filter((a) => norm(a["Status Execucao"]) === "nao iniciada").length;
  const acoesNaoIniciadas = acoes.length ? (naoIni / acoes.length) * 100 : null;

  // 5) Absenteísmo: dias perdidos (por colaborador e total) e atestados (por colaborador e total).
  const nColab = (d.colaborador || []).length || null;
  const diasPerdidos = (d.absenteismo || []).reduce((s, a) => s + (Number(a["Qtd Dias"]) || 0), 0);
  const nAtestados = (d.absenteismo || []).length;
  const absDiasColab = nColab ? diasPerdidos / nColab : null;
  const absDiasTotal = diasPerdidos;
  const atestadosColab = nColab ? nAtestados / nColab : null;
  const atestadosTotal = nAtestados;

  // 6) Restritos: por 100 colaboradores e quantidade bruta.
  const restritosBruto = (d.compativeis || []).length;
  const restritosPor100 = nColab ? (restritosBruto / nColab) * 100 : null;

  return {
    cobertura, coberturaPsico,
    riscoSevero, nivelMuitoAlto, nivelAlto, nivelModerado, nivelBaixo, nivelTrivial,
    acoesConcluidas, acoesAtraso, acoesNaoIniciadas,
    absDiasColab, absDiasTotal, atestadosColab, atestadosTotal,
    restritosPor100, restritosBruto,
  };
}

// Agrupa linhas por uma chave (EmpresaId, ou EmpresaId::Unidade).
function agrupar(linhas, chaveFn) {
  const mapa = {};
  (linhas || []).forEach((l) => { const k = chaveFn(l); if (!k) return; (mapa[k] = mapa[k] || []).push(l); });
  return mapa;
}

function estatisticas(valores) {
  const v = valores.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  const n = v.length;
  if (!n) return { n: 0 };
  const q = (p) => { const i = (n - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };
  const soma = v.reduce((a, b) => a + b, 0);
  return { n, media: soma / n, mediana: q(0.5), p25: q(0.25), p75: q(0.75), min: v[0], max: v[n - 1] };
}

// "Melhor que X% dos clientes" para o valor v de um indicador, dado o conjunto
// de valores de todos (direção ajustada por melhorEhMenor).
function percentilMelhor(v, valores, melhorEhMenor) {
  const outros = valores.filter((x) => x != null && !Number.isNaN(x));
  const n = outros.length;
  if (v == null || Number.isNaN(v) || n <= 1) return null;
  let piores = 0, iguais = 0;
  outros.forEach((x) => {
    if (x === v) { iguais += 1; return; }
    const melhor = melhorEhMenor ? v < x : v > x;
    if (melhor) piores += 1;
  });
  return Math.round((piores / (n - 1)) * 100);
}

// dados: { cliente, cargo, avaliacaoErgonomica, aet, fatorRisco, planoAcao, absenteismo, compativeis, colaborador, setor, psicoLaudo }
// opcoes: { empresasVisiveis: null|string[], podeVerUnidade: (empresaId, unidade)=>bool, hojeMs }
function calcularBenchmark(dados, opcoes = {}) {
  const hojeMs = opcoes.hojeMs || Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const colecoes = ["cargo", "avaliacaoErgonomica", "aet", "fatorRisco", "planoAcao", "absenteismo", "compativeis", "colaborador", "setor"];
  const empresas = dados.cliente || [];
  const nomePorId = {}; empresas.forEach((c) => { nomePorId[c.id || c._id] = c.Cliente || c.id; });

  // Índices por empresa e por empresa::unidade (um pass por coleção).
  const porEmpresa = {}; const porUnidade = {};
  colecoes.forEach((col) => {
    const g = agrupar(dados[col], (l) => l.EmpresaId);
    Object.keys(g).forEach((eid) => { (porEmpresa[eid] = porEmpresa[eid] || {})[col] = g[eid]; });
    const gu = agrupar(dados[col], (l) => (l.EmpresaId && l.Unidade) ? l.EmpresaId + "::" + l.Unidade : "");
    Object.keys(gu).forEach((k) => { (porUnidade[k] = porUnidade[k] || {})[col] = gu[k]; });
  });

  // Métricas por empresa (toda a base).
  const metEmpresa = {};
  empresas.forEach((c) => { const eid = c.id || c._id; metEmpresa[eid] = metricasDoRecorte(porEmpresa[eid] || {}, hojeMs); });
  // Também empresas que têm dados mas não um doc "cliente" (defensivo).
  Object.keys(porEmpresa).forEach((eid) => { if (!metEmpresa[eid]) metEmpresa[eid] = metricasDoRecorte(porEmpresa[eid], hojeMs); });

  // Métricas por unidade (toda a base).
  const metUnidade = {};
  Object.keys(porUnidade).forEach((k) => { metUnidade[k] = metricasDoRecorte(porUnidade[k], hojeMs); });

  // Distribuições anônimas (base).
  const valoresEmpresa = {}; const valoresUnidade = {};
  INDICADORES.forEach((ind) => {
    valoresEmpresa[ind.chave] = Object.values(metEmpresa).map((m) => m[ind.chave]);
    valoresUnidade[ind.chave] = Object.values(metUnidade).map((m) => m[ind.chave]);
  });
  const montarBase = (valores, totalN) => {
    const base = {};
    INDICADORES.forEach((ind) => {
      const st = estatisticas(valores[ind.chave]);
      base[ind.chave] = Object.assign({ melhorEhMenor: ind.melhorEhMenor, suficiente: st.n >= MIN_N }, st);
    });
    return { totalN, indicadores: base };
  };

  // Escopo do papel para o ranking identificado.
  const visiveis = opcoes.empresasVisiveis; // null = todas
  const podeEmp = (eid) => visiveis == null || visiveis.indexOf(eid) !== -1;
  const podeUni = opcoes.podeVerUnidade || (() => true);

  const empresasOut = [];
  Object.keys(metEmpresa).forEach((eid) => {
    if (!podeEmp(eid)) return;
    const m = metEmpresa[eid];
    const percentis = {};
    INDICADORES.forEach((ind) => { percentis[ind.chave] = percentilMelhor(m[ind.chave], valoresEmpresa[ind.chave], ind.melhorEhMenor); });
    const ps = INDICADORES.filter((i) => !i.noScore).map((i) => percentis[i.chave]).filter((x) => x != null);
    empresasOut.push({ empresaId: eid, nome: nomePorId[eid] || eid, valores: m, percentis, scoreGeral: ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length) : null });
  });
  empresasOut.sort((a, b) => (b.scoreGeral || -1) - (a.scoreGeral || -1));

  const unidadesOut = [];
  Object.keys(metUnidade).forEach((k) => {
    const [eid, uni] = k.split("::");
    if (!podeEmp(eid) || !podeUni(eid, uni)) return;
    const m = metUnidade[k];
    const percentis = {};
    INDICADORES.forEach((ind) => { percentis[ind.chave] = percentilMelhor(m[ind.chave], valoresUnidade[ind.chave], ind.melhorEhMenor); });
    const ps = INDICADORES.filter((i) => !i.noScore).map((i) => percentis[i.chave]).filter((x) => x != null);
    unidadesOut.push({ empresaId: eid, nome: nomePorId[eid] || eid, unidade: uni, valores: m, percentis, scoreGeral: ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length) : null });
  });
  unidadesOut.sort((a, b) => (b.scoreGeral || -1) - (a.scoreGeral || -1));

  // V 2.50 (Alexandre): cenário TOTAL da ElevaLife — os mesmos indicadores calculados sobre
  // TODAS as empresas somadas (já sem a demo e sem as excluídas, que a rota removeu). É o retrato
  // agregado da base; não tem percentil (ele É a base).
  const total = {
    valores: metricasDoRecorte(dados, hojeMs),
    nEmpresas: Object.keys(metEmpresa).length,
    nUnidades: Object.keys(metUnidade).length,
  };

  return {
    indicadores: INDICADORES,
    minN: MIN_N,
    base: montarBase(valoresEmpresa, Object.keys(metEmpresa).length),
    baseUnidades: montarBase(valoresUnidade, Object.keys(metUnidade).length),
    empresas: empresasOut,
    unidades: unidadesOut,
    total,
  };
}

module.exports = { calcularBenchmark, INDICADORES, metricasDoRecorte, percentilMelhor, estatisticas, nivelRank, MIN_N };
