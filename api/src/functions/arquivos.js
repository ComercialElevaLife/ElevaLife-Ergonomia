/* ==========================================================================
   BI Ergonomia - ElevaLife
   Upload/download de arquivo (fotos da Avaliacao Ergonomica, arquivo do
   Laudo/Certificado - ver docs/bi-ergonomia-manual.md). Despachada a partir
   de entidades.js (ROTAS_ESPECIAIS["arquivos"]), igual "me" e "usuarios" -
   nao tem app.http() proprio porque a rota generica "{colecao}/{id?}"
   sempre "ganha" dela em producao (mesmo motivo documentado em me.js).

   POST /api/arquivos  { EmpresaId, Colecao, NomeArquivo, TipoConteudo,
                         ConteudoBase64 }
        -> valida identidade/permissao/tipo/tamanho, grava no Blob Storage
           e devolve { chave, nomeArquivo, tamanho }. O "chave" (nunca uma
           URL publica - os containers sao privados) e o que o frontend
           guarda no documento (campo "Fotos" ou "Arquivo Url").

   GET  /api/arquivos?chave=...
        -> confere que o EmpresaId embutido no inicio da chave e visivel
           pra identidade atual, e devolve o conteudo do arquivo (o
           navegador ja manda o cookie de autenticacao do Static Web Apps
           sozinho num <img>/<a> normal, sem precisar de fetch manual).

   DELETE /api/arquivos?chave=...
        -> apaga o arquivo do Blob Storage (mesma permissao de ver o arquivo).
           Alem desta rota, a API apaga os arquivos sozinha quando o registro
           e excluido ou salvo sem eles (ver shared/blob.js).
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { resolverIdentidade, podeVerEmpresa } = require("../shared/tenant");
const { obterContainerCliente, excluirArquivo, chaveArquivoValida } = require("../shared/blob");

// Mesma constante de src/functions/entidades.js (EMPRESA_GLOBAL) - o arquivo
// do Certificado de Calibracao e gravado com esse EmpresaId fixo (biblioteca
// global, nao presa a uma empresa-cliente), entao qualquer identidade com
// papel liberado pode ler/gravar nele.
const EMPRESA_GLOBAL = "GLOBAL";
function podeAcessarEmpresaOuGlobal(identidade, empresaId) {
  return empresaId === EMPRESA_GLOBAL || podeVerEmpresa(identidade, empresaId);
}

// Tipo/tamanho aceitos por colecao - mesmos limites do sistema legado (ate 5
// fotos de 5MB na Avaliacao; Laudo sem limite documentado no legado, 15MB e
// uma folga confortavel pra PDF/imagem escaneada).
const REGRAS_POR_COLECAO = {
  avaliacaoErgonomica: {
    tiposAceitos: ["image/jpeg", "image/png"],
    tamanhoMaximoBytes: 5 * 1024 * 1024,
  },
  laudo: {
    // V 1.9: o laudo tambem e guardado em Word (.docx)
    tiposAceitos: ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    tamanhoMaximoBytes: 15 * 1024 * 1024,
  },
  // AET (Analise Ergonomica do Trabalho): Excel (Mapa de Risco/Plano de Acao)
  // e/ou PDF (analise narrativa) - o conteudo e lido e classificado no
  // navegador (ver js/app.js/extrairTextoParaClassificacaoAET), nunca por
  // esta lista de tipos aceitos, que so controla o que pode ser gravado.
  aet: {
    tiposAceitos: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/pdf",
    ],
    tamanhoMaximoBytes: 20 * 1024 * 1024,
  },
  // Foto do Certificado de Calibracao (biblioteca global de instrumentos -
  // ver docs/bi-ergonomia-manual.md, secao Laudos).
  certificadoCalibracao: {
    tiposAceitos: ["image/jpeg", "image/png"],
    tamanhoMaximoBytes: 5 * 1024 * 1024,
  },
  // Logotipo do cadastro ampliado de empresa (ver js/app.js/camposCadastroCliente) -
  // gravado com o proprio EmpresaId do Cliente (nao e global), do mesmo jeito
  // que avaliacaoErgonomica/laudo/aet.
  cliente: {
    tiposAceitos: ["image/jpeg", "image/png"],
    tamanhoMaximoBytes: 2 * 1024 * 1024,
  },
  // V 1.2: evidencia de conclusao de acao do Plano de Acao (foto ou PDF).
  planoAcao: {
    tiposAceitos: ["application/pdf", "image/jpeg", "image/png"],
    tamanhoMaximoBytes: 15 * 1024 * 1024,
  },
  // V 1.3: imagem da assinatura do ergonomista (cadastro global, gravada com
  // EmpresaId "GLOBAL").
  ergonomista: {
    tiposAceitos: ["image/jpeg", "image/png"],
    tamanhoMaximoBytes: 2 * 1024 * 1024,
  },
};

// V 1.7: so a equipe ElevaLife grava arquivo destas colecoes (mesma lista de
// COLECOES_SO_EQUIPE_GRAVA em entidades.js, restrita as que tem upload).
const UPLOAD_SO_EQUIPE = ["laudo", "cliente", "ergonomista", "certificadoCalibracao"];

// V 1.7: confere os primeiros bytes - o TipoConteudo vem do cliente e nao
// prova nada. (Excel antigo / .xls fica sem checagem: navegadores rotulam ate
// .csv assim.)
function assinaturaConfere(tipo, buf) {
  const inicio = (n) => buf.subarray(0, n);
  if (tipo === "image/jpeg") return inicio(3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (tipo === "image/png") return inicio(8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (tipo === "application/pdf") return buf.subarray(0, 1024).includes("%PDF-");
  if (tipo === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || tipo === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return inicio(2).equals(Buffer.from([0x50, 0x4b]));
  return true;
}

function sanitizarNomeArquivo(nome) {
  const base = String(nome || "arquivo")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_");
  return base.slice(-120) || "arquivo";
}

function streamParaBuffer(stream) {
  return new Promise((resolve, reject) => {
    const pedacos = [];
    stream.on("data", (d) => pedacos.push(d));
    stream.on("end", () => resolve(Buffer.concat(pedacos)));
    stream.on("error", reject);
  });
}

async function tratarUpload(request, identidade) {
  const corpo = await request.json();
  const { EmpresaId, Colecao, NomeArquivo, TipoConteudo, ConteudoBase64 } = corpo || {};

  const regra = REGRAS_POR_COLECAO[Colecao];
  if (!regra) {
    return { status: 400, jsonBody: { erro: `Coleção sem upload de arquivo: ${Colecao}` } };
  }
  if (!EmpresaId || typeof EmpresaId !== "string" || !chaveArquivoValida(`${EmpresaId}/${Colecao}/x`) || !podeAcessarEmpresaOuGlobal(identidade, EmpresaId)) {
    return { status: 403, jsonBody: { erro: "Sem permissão para gravar arquivo nesta empresa." } };
  }
  if (identidade.papel === "UsuarioCliente" && UPLOAD_SO_EQUIPE.includes(Colecao)) {
    return { status: 403, jsonBody: { erro: "Só a equipe ElevaLife (Administrador ou Consultor) envia arquivos deste tipo." } };
  }
  if (!ConteudoBase64) {
    return { status: 400, jsonBody: { erro: "ConteudoBase64 é obrigatório." } };
  }
  if (!regra.tiposAceitos.includes(TipoConteudo)) {
    return { status: 400, jsonBody: { erro: `Tipo de arquivo não aceito para esta coleção: ${TipoConteudo}` } };
  }

  let buffer;
  try {
    buffer = Buffer.from(ConteudoBase64, "base64");
  } catch (erro) {
    return { status: 400, jsonBody: { erro: "ConteudoBase64 inválido." } };
  }
  if (buffer.length === 0) {
    return { status: 400, jsonBody: { erro: "Arquivo vazio." } };
  }
  if (buffer.length > regra.tamanhoMaximoBytes) {
    const limiteMB = (regra.tamanhoMaximoBytes / (1024 * 1024)).toFixed(0);
    return { status: 413, jsonBody: { erro: `Arquivo maior que o limite de ${limiteMB} MB.` } };
  }

  if (!assinaturaConfere(TipoConteudo, buffer)) {
    return { status: 400, jsonBody: { erro: "O conteúdo do arquivo não corresponde ao tipo informado." } };
  }

  const nomeSeguro = sanitizarNomeArquivo(NomeArquivo);
  const chave = `${EmpresaId}/${Colecao}/${crypto.randomUUID()}-${nomeSeguro}`;

  const containerCliente = obterContainerCliente(Colecao);
  if (Colecao === "planoAcao" || Colecao === "ergonomista") await containerCliente.createIfNotExists(); // containers novos (V 1.2 / V 1.3)
  const blocoCliente = containerCliente.getBlockBlobClient(chave);
  await blocoCliente.uploadData(buffer, { blobHTTPHeaders: { blobContentType: TipoConteudo } });

  return { status: 201, jsonBody: { chave, nomeArquivo: nomeSeguro, tamanho: buffer.length } };
}

async function tratarDownload(request, identidade) {
  const chave = request.query.get("chave");
  if (!chave) return { status: 400, jsonBody: { erro: "Parâmetro “chave” é obrigatório." } };
  if (!chaveArquivoValida(chave)) return { status: 404, jsonBody: { erro: "Arquivo não encontrado." } };

  const partes = chave.split("/");
  const empresaId = partes[0];
  const colecao = partes[1];
  const regra = REGRAS_POR_COLECAO[colecao];
  if (!empresaId || !regra) return { status: 404, jsonBody: { erro: "Arquivo não encontrado." } };
  if (!podeAcessarEmpresaOuGlobal(identidade, empresaId)) {
    return { status: 403, jsonBody: { erro: "Sem permissão para ver este arquivo." } };
  }

  const containerCliente = obterContainerCliente(colecao);
  const blocoCliente = containerCliente.getBlockBlobClient(chave);
  const existe = await blocoCliente.exists();
  if (!existe) return { status: 404, jsonBody: { erro: "Arquivo não encontrado." } };

  const download = await blocoCliente.download();
  const buffer = await streamParaBuffer(download.readableStreamBody);
  return {
    status: 200,
    body: buffer,
    headers: {
      "Content-Type": download.contentType || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  };
}

async function tratarExclusao(request, identidade) {
  const chave = request.query.get("chave");
  if (!chave) return { status: 400, jsonBody: { erro: "Parâmetro “chave” é obrigatório." } };
  if (!chaveArquivoValida(chave)) return { status: 204 };
  const partes = chave.split("/");
  const empresaId = partes[0];
  if (!empresaId || !REGRAS_POR_COLECAO[partes[1]]) return { status: 204 };
  if (identidade.papel === "UsuarioCliente" && UPLOAD_SO_EQUIPE.includes(partes[1])) {
    return { status: 403, jsonBody: { erro: "Sem permissão para excluir este arquivo." } };
  }
  if (!podeAcessarEmpresaOuGlobal(identidade, empresaId)) {
    return { status: 403, jsonBody: { erro: "Sem permissão para excluir este arquivo." } };
  }
  await excluirArquivo(chave);
  return { status: 204 };
}

async function tratar(request, context) {
  let identidade;
  try {
    identidade = await resolverIdentidade(request);
  } catch (erro) {
    context.error("Falha ao resolver identidade", erro);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissões." } };
  }
  if (!identidade) return { status: 401, jsonBody: { erro: "Não autenticado." } };
  if (!identidade.papel) {
    return {
      status: 403,
      jsonBody: { erro: "Seu acesso ainda não foi liberado. Peça a um Administrador para vincular você a uma empresa." },
    };
  }

  // V 1.27: o Usuario Cliente so consulta e baixa arquivos (sem enviar nem apagar).
  if (identidade.papel === "UsuarioCliente" && request.method !== "GET") {
    return { status: 403, jsonBody: { erro: "Seu perfil permite apenas consultar e baixar os arquivos." } };
  }
  try {
    if (request.method === "POST") return await tratarUpload(request, identidade);
    if (request.method === "GET") return await tratarDownload(request, identidade);
    if (request.method === "DELETE") return await tratarExclusao(request, identidade);
    return { status: 405, jsonBody: { erro: "Método não suportado." } };
  } catch (erro) {
    context.error("Erro em /api/arquivos", erro);
    return { status: 500, jsonBody: { erro: "Erro interno." } };
  }
}

module.exports = { tratar, REGRAS_POR_COLECAO };
