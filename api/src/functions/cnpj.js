/* ==========================================================================
   BI Ergonomia - ElevaLife
   GET /api/cnpj/{numero} - consulta publica de CNPJ (preenchimento automatico
   do Cadastro de Cliente) - pedido do Leo 02/10/2026: "eu digitei o CNPJ da
   empresa e ele nao fez a busca automatica com a validacao e auto
   preenchimento das informacoes". Usa a BrasilAPI (publica, gratuita, sem
   chave/cadastro - espelha o cadastro da Receita Federal/CNPJ.ws).

   So devolve dados PUBLICOS e federais do CNPJ (razao social, endereco,
   telefone, CNAE). Fica de fora, de proposito:
   - Inscricao Estadual: e um registro ESTADUAL (SEFAZ de cada UF), a Receita
     Federal nao tem esse dado - continua so preenchimento manual.
   - Grau de Risco (NR-4): e uma classificacao de Seguranca do Trabalho por
     CNAE (Quadro I do Anexo da NR-4), nao algo que a consulta de CNPJ
     devolve - continua so preenchimento manual.

   Despachado por entidades.js/ROTAS_ESPECIAIS (mesmo mecanismo de "me"/
   "usuarios"/"auth" - ver comentario la: um unico app.http() generico, nunca
   functions HTTP separadas por rota, por causa da limitacao do SWA Free).
   ========================================================================== */

"use strict";

const { resolverIdentidade } = require("../shared/tenant");

const BRASILAPI_URL = "https://brasilapi.com.br/api/cnpj/v1/";
const TEMPO_LIMITE_MS = 8000;

async function consultarBrasilApi(numero) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);
  try {
    return await fetch(BRASILAPI_URL + encodeURIComponent(numero), { signal: controlador.signal });
  } finally {
    clearTimeout(timer);
  }
}

// "descricao_tipo_de_logradouro" (ex.: "Rua", "Avenida") + "logradouro" -
// a BrasilAPI devolve os dois separados; o formulario tem um unico campo
// "Logradouro" (ver camposCadastroCliente em js/app.js).
function montarLogradouro(dados) {
  return [dados.descricao_tipo_de_logradouro, dados.logradouro].filter(Boolean).join(" ").trim() || null;
}

async function tratar(request, context) {
  let identidade;
  try {
    identidade = await resolverIdentidade(request);
  } catch (erro) {
    context.error("Falha ao resolver identidade em /api/cnpj", erro);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissoes." } };
  }
  if (!identidade) {
    return { status: 401, jsonBody: { erro: "Nao autenticado." } };
  }
  if (!identidade.papel) {
    return {
      status: 403,
      jsonBody: { erro: "Seu acesso ainda nao foi liberado. Peca a um Administrador para te vincular a uma empresa." },
    };
  }

  const numero = String(request.params.id || "").replace(/\D/g, "");
  if (numero.length !== 14) {
    return { status: 400, jsonBody: { erro: "CNPJ invalido - precisa ter 14 digitos." } };
  }

  let resp;
  try {
    resp = await consultarBrasilApi(numero);
  } catch (erro) {
    context.error("Falha ao consultar BrasilAPI (CNPJ)", erro);
    return { status: 502, jsonBody: { erro: "Falha ao consultar o CNPJ - tente novamente em instantes." } };
  }

  if (resp.status === 404) {
    return { status: 404, jsonBody: { erro: "CNPJ nao encontrado na Receita Federal." } };
  }
  if (!resp.ok) {
    const texto = await resp.text().catch(() => "");
    context.error(`BrasilAPI respondeu HTTP ${resp.status} para CNPJ ${numero}: ${texto.slice(0, 300)}`);
    return { status: 502, jsonBody: { erro: `Falha ao consultar o CNPJ (HTTP ${resp.status}).` } };
  }

  const dados = await resp.json();
  const cnae = dados.cnae_fiscal
    ? `${dados.cnae_fiscal}${dados.cnae_fiscal_descricao ? " - " + dados.cnae_fiscal_descricao : ""}`
    : null;
  const situacaoAtiva = !dados.descricao_situacao_cadastral || /ATIVA/i.test(dados.descricao_situacao_cadastral);

  return {
    jsonBody: {
      RazaoSocial: dados.razao_social || null,
      NomeFantasia: dados.nome_fantasia || null,
      CNAE: cnae,
      Telefone: dados.ddd_telefone_1 || null,
      CEP: dados.cep || null,
      Logradouro: montarLogradouro(dados),
      Numero: dados.numero || null,
      Complemento: dados.complemento || null,
      Bairro: dados.bairro || null,
      Cidade: dados.municipio || null,
      Estado: dados.uf || null,
      SituacaoCadastral: dados.descricao_situacao_cadastral || null,
      situacaoAtiva,
    },
  };
}

module.exports = { tratar };
