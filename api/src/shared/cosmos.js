/* ==========================================================================
   BI Ergonomia - ElevaLife
   Cliente Cosmos DB (singleton por instancia da Function App).
   Todas as colecoes de negocio usam chave de particao "/EmpresaId" - inclusive
   "cliente" (cada registro de cliente guarda o proprio EmpresaId em si mesmo,
   ver src/shared/tenant.js). "usuarios" e "listaCID" sao excecao: nao tem
   tenant, particionadas por "/id".
   ========================================================================== */

"use strict";

const { CosmosClient } = require("@azure/cosmos");

const PARTICAO_POR_ID = new Set(["usuarios", "listaCID"]);

let clienteCosmos = null;
let bancoCosmos = null;

function obterCliente() {
  if (!clienteCosmos) {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error(
        "COSMOS_CONNECTION_STRING nao configurada nas Application Settings do Static Web App / local.settings.json."
      );
    }
    clienteCosmos = new CosmosClient(connectionString);
  }
  return clienteCosmos;
}

function obterBanco() {
  if (!bancoCosmos) {
    const databaseId = process.env.COSMOS_DATABASE_ID || "bi-ergonomia";
    bancoCosmos = obterCliente().database(databaseId);
  }
  return bancoCosmos;
}

function obterContainer(nome) {
  return obterBanco().container(nome);
}

// Caminho da chave de particao usado por cada colecao - usado ao montar o
// definidor de containers em scripts de provisionamento (ver docs/azure-setup.md).
function caminhoParticao(nome) {
  return PARTICAO_POR_ID.has(nome) ? "/id" : "/EmpresaId";
}

module.exports = { obterCliente, obterBanco, obterContainer, caminhoParticao, PARTICAO_POR_ID };
