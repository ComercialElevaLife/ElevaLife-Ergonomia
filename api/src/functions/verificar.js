/* ==========================================================================
   S.I.G.E. - ElevaLife
   GET /api/verificar/{codigo} - V 1.3: verificacao PUBLICA (sem login) de um
   laudo pelo codigo impresso no documento (e no QR Code da ultima pagina).

   Devolve so o que confirma a autoria/integridade do documento: tipo, cliente,
   data de emissao, revisao, ergonomistas (nome e registro) e a impressao
   digital (SHA-256) do arquivo emitido. A pagina /verificar compara essa
   impressao com a do arquivo que a pessoa tiver em maos (calculada no proprio
   navegador - o arquivo nao e enviado a lugar nenhum).

   Despachada por entidades.js/ROTAS_ESPECIAIS (antes da checagem de login).
   ========================================================================== */

"use strict";

const { obterContainer } = require("../shared/cosmos");

const FORMATO_CODIGO = /^ELV-[A-Z]{2,5}-\d{4}-[A-Z0-9]{6}$/;

async function tratar(request, context) {
  if (request.method !== "GET") return { status: 405, jsonBody: { erro: "Método não permitido." } };
  const codigo = String(request.params.id || request.query.get("codigo") || "").trim().toUpperCase();
  if (!FORMATO_CODIGO.test(codigo)) {
    return { status: 400, jsonBody: { encontrado: false, erro: "Código de verificação em formato inválido." } };
  }
  try {
    const { resources } = await obterContainer("laudo").items
      .query({
        query: 'SELECT c["Codigo Verificacao"] AS codigo, c.Tipo AS tipo, c.Cliente AS cliente, c["Emitido Em"] AS emitidoEm, c.Revisao AS revisao, c["Responsavel Tecnico"] AS responsavelTecnico, c["Ergonomista Executor"] AS ergonomistaExecutor, c["Registro Responsavel"] AS registroResponsavel, c["Registro Executor"] AS registroExecutor, c["Hash Documento"] AS hash FROM c WHERE c["Codigo Verificacao"] = @codigo',
        parameters: [{ name: "@codigo", value: codigo }],
      })
      .fetchAll();
    if (!resources.length) return { status: 404, jsonBody: { encontrado: false } };
    const l = resources[0];
    return {
      status: 200,
      headers: { "Cache-Control": "no-store" },
      jsonBody: {
        encontrado: true,
        codigo: l.codigo,
        tipo: l.tipo || "Laudo",
        cliente: l.cliente || "",
        emitidoEm: l.emitidoEm || "",
        revisao: l.revisao || "00",
        responsavelTecnico: l.responsavelTecnico || "",
        registroResponsavel: l.registroResponsavel || "",
        ergonomistaExecutor: l.ergonomistaExecutor || "",
        registroExecutor: l.registroExecutor || "",
        hash: l.hash || "",
      },
    };
  } catch (erro) {
    context.error("Falha ao verificar laudo", erro);
    return { status: 500, jsonBody: { erro: "Falha ao consultar o código. Tente novamente." } };
  }
}

module.exports = { tratar };
