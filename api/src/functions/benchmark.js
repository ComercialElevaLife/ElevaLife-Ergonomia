/* ==========================================================================
   S.I.G.E. - ElevaLife
   V 2.50 (Alexandre - solicitação 2): GET /api/benchmark

   Compara os indicadores da empresa-cliente com a base (todas as empresas e
   unidades), SEM expor dados de ninguém: a distribuição é anônima (média,
   mediana, percentis, N, com N mínimo). O ranking identificado respeita o
   escopo do papel — Administrador vê todas, Consultor as empresas da carteira
   dele, UsuarioCliente só a própria (e suas unidades). Todos recebem a régua
   anônima contra a base inteira.

   Despachada pelo dispatcher único de entidades.js (ROTAS_ESPECIAIS.benchmark).
   ========================================================================== */

"use strict";

const { obterContainer } = require("../shared/cosmos");
const { resolverIdentidade, empresasVisiveis, podeVerUnidadeDoc } = require("../shared/tenant");
const { calcularBenchmark } = require("../shared/benchmark");

const COLECOES_BENCH = ["cliente", "cargo", "avaliacaoErgonomica", "aet", "fatorRisco", "planoAcao", "absenteismo", "compativeis", "colaborador", "setor"];

async function carregarTudo(col) {
  const { resources } = await obterContainer(col).items.query("SELECT * FROM c").fetchAll();
  return resources || [];
}

async function tratar(request, context) {
  let identidade;
  try { identidade = await resolverIdentidade(request); } catch (e) {
    context.error("Falha ao resolver identidade em /api/benchmark", e);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissões." } };
  }
  if (!identidade) return { status: 401, jsonBody: { erro: "Não autenticado." } };
  if (!identidade.papel) return { status: 403, jsonBody: { erro: "Sem acesso." } };
  if (request.method !== "GET") return { status: 405, jsonBody: { erro: "Use GET." } };

  try {
    const dados = {};
    await Promise.all(COLECOES_BENCH.map(async (col) => { dados[col] = await carregarTudo(col); }));

    // V 2.50 (Alexandre): o benchmark NÃO conta a Empresa Demonstrativa nem empresas excluídas
    // (lixeira). A rota lê tudo com SELECT *, então aqui removemos esses EmpresaIds de todas as
    // coleções (o GET normal do app já esconde essas empresas, mas o benchmark lia o cru).
    const DEMO_ID = "empresa-demo";
    const foraSet = new Set([DEMO_ID]);
    (dados.cliente || []).forEach((c) => { const eid = c.id || c._id; if (c.Excluida || eid === DEMO_ID) foraSet.add(eid); });
    dados.cliente = (dados.cliente || []).filter((c) => !foraSet.has(c.id || c._id));
    COLECOES_BENCH.filter((col) => col !== "cliente").forEach((col) => { dados[col] = (dados[col] || []).filter((r) => !foraSet.has(r.EmpresaId)); });

    const resultado = calcularBenchmark(dados, {
      empresasVisiveis: empresasVisiveis(identidade), // null = Administrador (vê todas)
      podeVerUnidade: (empresaId, unidade) => podeVerUnidadeDoc(identidade, "unidade", { EmpresaId: empresaId, Unidade: unidade }),
    });
    // Identificação do papel para o front decidir o que mostrar (ranking x só a régua).
    resultado.papel = identidade.papel;
    return { jsonBody: resultado };
  } catch (erro) {
    context.error("Falha ao calcular benchmark", erro);
    return { status: 500, jsonBody: { erro: "Falha ao calcular o benchmark." } };
  }
}

module.exports = { tratar };
