/* ==========================================================================
   BI Ergonomia - ElevaLife
   Cliente Azure Blob Storage (singleton por instancia da Function App) -
   guarda os arquivos do pacote "Sistema de Gestao Integrada": fotos da
   Avaliacao Ergonomica e o arquivo do Laudo/Certificado (ver
   docs/bi-ergonomia-manual.md). Segue o mesmo padrao do cliente Cosmos DB
   (src/shared/cosmos.js): conexao lida de uma Application Setting, nunca de
   valor fixo no codigo.

   Os containers sao PRIVADOS (sem acesso anonimo) - todo acesso passa pela
   API, que confere identidade/EmpresaId antes de gravar ou servir um
   arquivo (ver src/functions/arquivos.js), do mesmo jeito que qualquer
   outra colecao do Cosmos DB.
   ========================================================================== */

"use strict";

const { BlobServiceClient } = require("@azure/storage-blob");

// Container Blob de cada colecao que tem upload de arquivo - so essas 2 tem,
// as demais (Inventario de Riscos, Mapa de Risco etc.) nao guardam arquivo.
const CONTAINER_POR_COLECAO = {
  avaliacaoErgonomica: "avaliacao-fotos",
  laudo: "laudos-arquivos",
  aet: "aet-arquivos",
  certificadoCalibracao: "certificados-calibracao",
};

let clienteBlob = null;

function obterCliente() {
  if (!clienteBlob) {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error(
        "STORAGE_CONNECTION_STRING nao configurada nas Application Settings do Static Web App / local.settings.json."
      );
    }
    clienteBlob = BlobServiceClient.fromConnectionString(connectionString);
  }
  return clienteBlob;
}

function obterContainerCliente(colecao) {
  const nomeContainer = CONTAINER_POR_COLECAO[colecao];
  if (!nomeContainer) {
    throw new Error(`Colecao sem container de arquivos: ${colecao}`);
  }
  return obterCliente().getContainerClient(nomeContainer);
}

module.exports = { obterCliente, obterContainerCliente, CONTAINER_POR_COLECAO };
