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
  // Logotipo do cadastro ampliado de empresa (ver js/app.js/camposCadastroCliente).
  cliente: "clientes-logos",
  // V 1.2: evidencias (foto ou PDF) de conclusao das acoes do Plano de Acao.
  // O container e criado sob demanda no primeiro upload (ver arquivos.js).
  planoAcao: "planoacao-evidencias",
  // V 1.3: imagem da assinatura do ergonomista (cadastro global).
  ergonomista: "ergonomistas-assinaturas",
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

// ---- Exclusao de arquivos (pedido do Leo, 04/10/2026: "o sistema precisa ter a
// possibilidade de exclusao de dados sem impeditivo off e on") ----
//
// Antes, excluir um registro (ou tirar uma foto dele) so apagava a referencia
// no Cosmos DB e o arquivo ficava orfao, ocupando espaco no Storage para
// sempre. Agora a API apaga o arquivo junto: ao EXCLUIR o registro, ao
// SALVAR um registro sem uma foto/arquivo que ele tinha, e pelo
// DELETE /api/arquivos?chave=... (ver functions/arquivos.js).

// Acha todas as "chave" de arquivo guardadas num documento (Fotos[],
// Arquivo Url, Logotipo, Arquivo Imagem, ...). Uma chave de arquivo tem o
// formato "<EmpresaId>/<colecao>/<uuid>-<nome>" e a colecao tem que ser uma
// das que tem container de arquivos.
function coletarChavesArquivo(no, saida) {
  saida = saida || new Set();
  if (Array.isArray(no)) no.forEach((x) => coletarChavesArquivo(x, saida));
  else if (no && typeof no === "object") {
    if (typeof no.chave === "string") {
      const partes = no.chave.split("/");
      if (partes.length >= 3 && CONTAINER_POR_COLECAO[partes[1]]) saida.add(no.chave);
    }
    Object.keys(no).forEach((k) => { if (k !== "chave") coletarChavesArquivo(no[k], saida); });
  }
  return saida;
}

async function excluirArquivo(chave) {
  const partes = String(chave).split("/");
  if (partes.length < 3 || !CONTAINER_POR_COLECAO[partes[1]]) return false;
  await obterContainerCliente(partes[1]).getBlockBlobClient(chave).deleteIfExists();
  return true;
}

// Apaga os arquivos que existiam no documento antigo e nao existem mais no
// novo (docNovo = null => documento excluido, apaga todos). So apaga chave
// que comeca com o EmpresaId do proprio documento (ou GLOBAL nas colecoes
// globais): ninguem consegue apagar arquivo de outra empresa colocando uma
// chave alheia dentro de um registro. Nunca derruba a operacao principal:
// falha de Storage so vai para o log.
async function excluirArquivosRemovidos(docAntigo, docNovo, empresaIdPermitido, context) {
  let apagados = 0;
  try {
    const antes = coletarChavesArquivo(docAntigo);
    const depois = coletarChavesArquivo(docNovo || {});
    for (const chave of antes) {
      if (depois.has(chave)) continue;
      if (chave.split("/")[0] !== empresaIdPermitido) continue;
      try {
        if (await excluirArquivo(chave)) apagados++;
      } catch (erro) {
        if (context && context.error) context.error("Falha ao excluir arquivo do Storage: " + chave, erro);
      }
    }
  } catch (erro) {
    if (context && context.error) context.error("Falha ao conferir arquivos removidos", erro);
  }
  return apagados;
}

module.exports = {
  obterCliente, obterContainerCliente, CONTAINER_POR_COLECAO,
  coletarChavesArquivo, excluirArquivo, excluirArquivosRemovidos,
};
