/* ==========================================================================
   BI Ergonomia - ElevaLife
   GET /api/cnpj/{numero} - consulta publica de CNPJ (preenchimento automatico
   do Cadastro de Cliente) - pedido do Leo 02/10/2026: "eu digitei o CNPJ da
   empresa e ele nao fez a busca automatica com a validacao e auto
   preenchimento das informacoes". Usa a BrasilAPI (publica, gratuita, sem
   chave/cadastro - espelha o cadastro da Receita Federal/CNPJ.ws).

   Devolve dados PUBLICOS e federais do CNPJ (razao social, endereco,
   telefone, CNAE) + uma APROXIMACAO do Grau de Risco (NR-4) por Divisao do
   CNAE (ver GRAU_RISCO_POR_DIVISAO abaixo - pedido do Leo 02/10/2026, ciente
   de que nao e a tabela oficial). Fica de fora, de proposito:
   - Inscricao Estadual: e um registro ESTADUAL (SEFAZ de cada UF), a Receita
     Federal nao tem esse dado - continua so preenchimento manual (decisao
     do Leo 02/10/2026: nao automatizar via provedor pago por enquanto).
   - Inscricao Municipal: nao existe nenhuma base nacional (cada municipio
     tem o proprio sistema, sem padrao) - inviavel de automatizar de forma
     generica, continua so preenchimento manual.

   Despachado por entidades.js/ROTAS_ESPECIAIS (mesmo mecanismo de "me"/
   "usuarios"/"auth" - ver comentario la: um unico app.http() generico, nunca
   functions HTTP separadas por rota, por causa da limitacao do SWA Free).
   ========================================================================== */

"use strict";

const { resolverIdentidade } = require("../shared/tenant");

const BRASILAPI_URL = "https://brasilapi.com.br/api/cnpj/v1/";
const TEMPO_LIMITE_MS = 8000;

// BrasilAPI respondeu HTTP 403 sem esses cabecalhos (confirmado em producao
// 02/10/2026, testado pelo Leo) - o fetch nativo do Node/Azure Functions
// manda um User-Agent generico (ou nenhum), que a protecao
// anti-bot/anti-scraping na frente da BrasilAPI (Cloudflare/Vercel) barra.
// Um User-Agent "de navegador" + Accept explicito resolve (mesmo tipo de
// ajuste documentado em varias integracoes server-to-server com essa API).
async function consultarBrasilApi(numero) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);
  try {
    return await fetch(BRASILAPI_URL + encodeURIComponent(numero), {
      signal: controlador.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; SIGE-ElevaLife/1.0; +https://witty-sea-0b1e5c110.6.azurestaticapps.net)",
      },
    });
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

// Grau de Risco (NR-4) POR APROXIMACAO - pedido do Leo 02/10/2026, ciente de
// que isso NAO e a tabela oficial do Quadro I (Anexo da NR-4): a oficial
// classifica por Classe/Subclasse do CNAE (milhares de linhas), essa aqui e
// uma simplificacao por DIVISAO (2 primeiros digitos do CNAE Fiscal),
// montada a partir do conhecimento geral de como cada setor costuma ser
// enquadrado - serve de ponto de partida, nunca de fonte oficial. Por isso:
// 1) so cobre as divisoes onde ha razoavel confianca no enquadramento tipico
//    (o resto fica sem sugestao - preenchimento manual, sem chute); 2) o
//    frontend SEMPRE marca visualmente o campo como "confirme antes de
//    salvar" quando vem desta tabela (ver preencherGrauRiscoAproximado em
//    js/app.js/ligarConsultaCNPJ). Se algum dia alguem conseguir a tabela
//    oficial completa (Quadro I, por Classe/Subclasse), e so trocar isto
//    aqui por uma busca mais precisa.
const GRAU_RISCO_POR_DIVISAO = {
  "01": "3", "02": "3", "03": "3", // Agropecuaria, producao florestal, pesca
  "05": "4", "06": "4", "07": "4", "08": "4", "09": "4", // Industrias extrativas/mineracao
  "10": "2", "11": "2", "12": "2", // Alimentos, bebidas, fumo
  "13": "2", "14": "2", "15": "2", // Textil, vestuario, couro/calcados
  "16": "3", // Produtos de madeira
  "17": "3", "18": "3", // Papel/celulose, impressao
  "19": "4", // Coque, derivados de petroleo, biocombustiveis
  "20": "3", "21": "3", // Quimicos, farmoquimicos/farmaceuticos
  "22": "3", // Borracha e plastico
  "23": "4", // Minerais nao metalicos (cimento, vidro, ceramica)
  "24": "3", "25": "3", // Metalurgia, produtos de metal
  "26": "2", "27": "2", // Eletronicos, equipamentos eletricos
  "28": "3", // Maquinas e equipamentos
  "29": "3", "30": "3", // Veiculos automotores, outros equip. de transporte
  "31": "3", "32": "3", "33": "3", // Moveis, outras industrias, manutencao/instalacao de maquinas
  "35": "3", // Eletricidade e gas
  "36": "3", "37": "3", "38": "3", "39": "3", // Agua, esgoto, residuos, descontaminacao
  "41": "4", "42": "4", "43": "4", // Construcao
  "45": "2", "46": "2", "47": "2", // Comercio (veiculos, atacado, varejo)
  "49": "3", "50": "3", "51": "3", "52": "3", "53": "3", // Transporte, armazenagem, correio
  "55": "2", "56": "2", // Alojamento e alimentacao
  "58": "1", "59": "1", "60": "1", "61": "1", "62": "1", "63": "1", // Informacao/comunicacao, TI
  "64": "1", "65": "1", "66": "1", // Financeiro, seguros
  "68": "1", // Atividades imobiliarias
  "69": "1", "70": "1", "71": "1", "72": "1", "73": "1", "74": "1", "75": "1", // Profissionais/cientificas/tecnicas
  "77": "2", "78": "2", "79": "2", "80": "2", "81": "2", "82": "2", // Administrativas/servicos complementares
  "84": "1", // Administracao publica
  "85": "1", // Educacao
  "86": "3", "87": "3", "88": "3", // Saude humana e servicos sociais
  "90": "2", "91": "2", "92": "2", "93": "2", // Artes, cultura, esporte, recreacao
  "94": "2", "95": "2", "96": "2", // Outras atividades de servicos
  "97": "1", "99": "1", // Servicos domesticos, organismos internacionais
};

function grauRiscoAproximado(cnaeFiscal) {
  if (!cnaeFiscal) return null;
  const divisao = String(cnaeFiscal).replace(/\D/g, "").slice(0, 2);
  return GRAU_RISCO_POR_DIVISAO[divisao] || null;
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
      // Aproximado por Divisao do CNAE - ver GRAU_RISCO_POR_DIVISAO acima.
      // null quando a divisao nao esta na tabela (fica manual, sem chute).
      GrauRiscoNR4: grauRiscoAproximado(dados.cnae_fiscal),
    },
  };
}

module.exports = { tratar };
