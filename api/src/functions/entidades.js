/* ==========================================================================
   BI Ergonomia - ElevaLife
   Rotas REST genericas para as 13 colecoes de negocio (6 do cadastro-mestre +
   4 operacionais + 3 do pacote "Sistema de Gestao Integrada" - avaliacoes,
   fatores de risco e laudos, ver docs/bi-ergonomia-manual.md). Uma unica
   function cobre todas porque o CRUD e identico - so muda o nome da colecao
   e, no caso de "cliente", duas regras extras (so Administrador cria/exclui
   uma empresa-cliente nova).

   GET    /api/{colecao}          -> lista, ja filtrada por EmpresaId/papel
   GET    /api/{colecao}/{id}     -> um registro (404 se fora do escopo)
   POST   /api/{colecao}          -> cria (corpo deve trazer EmpresaId, exceto
                                      em "cliente", onde o EmpresaId e gerado)
   PUT    /api/{colecao}/{id}     -> atualiza
   DELETE /api/{colecao}/{id}     -> exclui
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { app } = require("@azure/functions");
const { obterContainer, garantirContainer } = require("../shared/cosmos");
const { resolverIdentidade, empresasVisiveis, podeVerEmpresa, podeVerDocumento, empresaIdDoDocumento } = require("../shared/tenant");
const rotaMe = require("./me");
const rotaUsuarios = require("./usuarios");
const rotaArquivos = require("./arquivos");
const rotaApiKeysAdmin = require("./apiKeysAdmin");
const rotaAuth = require("./auth");
const rotaCnpj = require("./cnpj");
const rotaJobs = require("./lembretesPlanoAcao");
const rotaVerificar = require("./verificar");
const rotaPsicossocial = require("./psicossocial");
const { excluirArquivosRemovidos } = require("../shared/blob");
const { aplicarAuditoria } = require("../shared/auditoria");
const { enviarEmail, modeloPlanoAcao, ESTAGIOS_PLANO_ACAO } = require("../shared/email");
const { avaliarPlanoAcao, precisaNotificarAtribuicao, evidenciasValidas } = require("../shared/planoAcaoRegras");
const { obterContainerCliente } = require("../shared/blob");

const NOME_APP = "S.I.G.E";

const COLECOES = [
  "cliente", "unidade", "setor", "cargo", "posto", "atividade",
  "mapaRisco", "planoAcao", "absenteismo", "compativeis",
  "avaliacaoErgonomica", "fatorRisco", "laudo",
  "aet",
  // HHT/Dias Uteis (base de calculo da Taxa de Frequencia, NBR 14280) -
  // ate 28/09/2026 era uma "tabela de referencia" ESTATICA (data/mock_data.json),
  // igual a Lista CID, e por isso so existiam linhas pras 3 empresas
  // fictícias originais - qualquer empresa nova ficava com Taxa de
  // Frequencia zerada ate alguem commitar um novo JSON (pedido do Leo
  // 28/09/2026: "isso nao pode ficar so pra essas 3 empresas... toda vez
  // que subir empresa nova eu tenho que ficar commitando, ai nao faz
  // sentido"). Virou uma colecao normal, por EmpresaId, como todas as
  // outras - ver tela "HHT / Dias Uteis" em js/app.js/CADASTROS_CONFIG.
  "diasUteis",
  // Certificados de Calibracao e o Modelo de texto do Laudo (Emissor/Editor
  // de Texto - ver docs/bi-ergonomia-manual.md, secao Laudos) sao GLOBAIS -
  // compartilhados entre todas as empresas-cliente (a ElevaLife tem 1 so
  // conjunto de certificados de instrumento e 1 modelo de texto reaproveitado
  // em todo laudo que gera), nunca filtrados por EmpresaId - ver
  // COLECOES_GLOBAIS abaixo.
  "certificadoCalibracao", "modeloLaudo",
  // V 1.2: configuracoes do sistema editaveis pelo Administrador (ex.: nomes
  // dos tipos de acao do Plano de Acao) - GLOBAL, so Administrador grava.
  "configuracao",
  // V 1.3: cadastro GLOBAL de ergonomistas (nome, registro profissional,
  // certificacao e imagem da assinatura) usado no Laudo (responsavel tecnico
  // e ergonomista executor). Container criado sob demanda.
  "ergonomista",
  // V 1.27: colaboradores (Cliente, Unidade, Setor/GHE, Matricula, Nome) -
  // base do questionario HSE-IT dos Riscos Psicossociais. Container criado
  // sob demanda (particao /EmpresaId).
  "colaborador",
];

// Colecoes sem dono (nenhuma amarrada a uma empresa-cliente especifica) -
// todo usuario autenticado com papel liberado ve e edita, independente de
// quais empresas estao vinculadas a ele. Gravadas sempre com
// EmpresaId=EMPRESA_GLOBAL (constante fixa, nunca uma empresa real).
const COLECOES_GLOBAIS = ["certificadoCalibracao", "modeloLaudo", "configuracao", "ergonomista"];
// Colecoes em que so o Administrador grava/exclui (todos podem ler).
const COLECOES_SO_ADMIN_GRAVA = ["configuracao"];
const EMPRESA_GLOBAL = "GLOBAL";
// V 1.7 (revisao de seguranca): colecoes que o UsuarioCliente le mas NAO grava.
// Laudo (documento emitido e seu codigo de verificacao publico), cadastro da
// empresa e as 3 bibliotecas globais (assinatura/registro do ergonomista,
// modelo de texto do laudo, certificados de calibracao) alimentam documentos
// de todas as empresas - antes qualquer usuario-cliente podia altera-las.
const COLECOES_SO_EQUIPE_GRAVA = ["laudo", "cliente", "ergonomista", "modeloLaudo", "certificadoCalibracao"];

// "me" e "usuarios" sao despachadas aqui dentro (em vez de cada uma ter seu
// proprio app.http()) porque em producao a rota generica "{colecao}/{id?}"
// sempre "ganhava" delas - ver comentario em src/functions/me.js.
const ROTAS_ESPECIAIS = {
  me: rotaMe.tratar,
  usuarios: rotaUsuarios.tratar,
  arquivos: rotaArquivos.tratar,
  apiKeys: rotaApiKeysAdmin.tratar,
  auth: rotaAuth.tratar,
  // GET /api/cnpj/{numero} - consulta publica (BrasilAPI) usada pelo
  // Cadastro de Cliente pra auto-preencher Razao Social/endereco/CNAE/
  // telefone a partir do CNPJ (ver api/src/functions/cnpj.js).
  cnpj: rotaCnpj.tratar,
  // POST /api/jobs/lembretes-plano-acao - job diario de lembretes do Plano
  // de Acao, chamado pelo GitHub Actions com cabecalho x-job-key (ver
  // api/src/functions/lembretesPlanoAcao.js).
  jobs: rotaJobs.tratar,
  // GET /api/verificar/{codigo} - V 1.3: verificacao PUBLICA (sem login) de um
  // laudo pelo codigo impresso no documento / QR Code (ver verificar.js).
  verificar: rotaVerificar.tratar,
  // V 1.14: modulo Riscos Psicossociais (psicossocial.html). "psico" e da
  // equipe (sessao + papel Administrador/Consultor); "psicopub" e publico,
  // usado pelas telas do QR code (HSE-IT e checklist ISO 45003) - ver
  // api/src/functions/psicossocial.js.
  psico: rotaPsicossocial.tratarEquipe,
  psicopub: rotaPsicossocial.tratarPublico,
};

async function lerPorId(container, id) {
  const consulta = {
    query: "SELECT * FROM c WHERE c.id = @id",
    parameters: [{ name: "@id", value: id }],
  };
  const { resources } = await container.items.query(consulta).fetchAll();
  return resources[0] || null;
}

// V 1.7: o "Codigo Verificacao" do laudo e publico (QR Code / pagina
// /verificar) - tem que ser unico, senao um registro poderia "copiar" o codigo
// de outro laudo e se passar por ele.
async function codigoVerificacaoEmUso(container, codigo, idAtual) {
  if (!codigo) return false;
  const { resources } = await container.items
    .query({
      query: 'SELECT c.id FROM c WHERE c["Codigo Verificacao"] = @codigo AND c.id != @id',
      parameters: [{ name: "@codigo", value: String(codigo) }, { name: "@id", value: String(idAtual || "") }],
    })
    .fetchAll();
  return resources.length > 0;
}

// V 1.28: proximo numero de AEP da empresa (maior + 1).
async function proximoNrAvaliacao(container, empresaId) {
  const { resources } = await container.items.query({
    query: 'SELECT VALUE MAX(c["Nr Avaliacao"]) FROM c WHERE c.EmpresaId = @e',
    parameters: [{ name: "@e", value: empresaId }],
  }).fetchAll();
  return (Number(resources && resources[0]) || 0) + 1;
}

async function listarComFiltro(container, colecao, identidade) {
  if (COLECOES_GLOBAIS.includes(colecao)) {
    const { resources } = await container.items.query("SELECT * FROM c").fetchAll();
    return resources;
  }
  const empresas = empresasVisiveis(identidade);
  if (empresas === null) {
    const { resources } = await container.items.query("SELECT * FROM c").fetchAll();
    return resources;
  }
  if (empresas.length === 0) return [];
  const campo = colecao === "cliente" ? "c.id" : "c.EmpresaId";
  const consulta = {
    query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@empresas, ${campo})`,
    parameters: [{ name: "@empresas", value: empresas }],
  };
  const { resources } = await container.items.query(consulta).fetchAll();
  return resources;
}

// V 1.2 - Plano de Acao: aplica as regras de status/evidencia (ver
// shared/planoAcaoRegras.js) e confere no Storage que os arquivos de
// evidencia novos existem de verdade (nao basta o nome no corpo da requisicao).
async function avaliarPlanoAcaoComArquivos(existente, novo, identidade, context) {
  const avaliacao = avaliarPlanoAcao({
    existente, novo, papel: identidade.papel, email: identidade.email,
  });
  if (!avaliacao.ok) return avaliacao;
  const jaConhecidas = new Set(evidenciasValidas(existente).map((e) => e.chave));
  const novas = evidenciasValidas(avaliacao.doc).filter((e) => !jaConhecidas.has(e.chave));
  for (const e of novas) {
    let existe = false;
    try {
      existe = await obterContainerCliente("planoAcao").getBlockBlobClient(e.chave).exists();
    } catch (erro) {
      context.error("Falha ao conferir evidencia no Storage: " + e.chave, erro);
      existe = true; // falha de infraestrutura nao deve travar o usuario
    }
    if (!existe) {
      return { ok: false, status: 422, codigo: "EVIDENCIA_NAO_ENCONTRADA", erro: "Um dos arquivos de evidência não foi encontrado. Anexe novamente." };
    }
  }
  return avaliacao;
}

// Notificacoes do Plano de Acao disparadas na gravacao (best-effort - nunca
// derrubam o registro): "atribuida" (so na criacao ou troca do e-mail do
// responsavel) e "evidDispensa" (Administrador concluiu sem evidencia).
// V 1.27: acao com origem "Riscos Psicossociais" usa o e-mail proprio do
// modulo (texto pedido pelo Alexandre) e so sai com responsavel, e-mail e
// prazo preenchidos; reenvia quando um dos tres muda (ou a pedido: _reenviarPsico).
async function notificarAcaoPsico(context, container, resource, reenviar) {
  try {
    const email = String(resource["E-mail Responsavel"] || "").trim();
    // V 1.33: sai com e-mail e previsao de conclusao (o nome do responsavel deixou de ser obrigatorio)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !resource["Dt Programada"]) return resource;
    if (resource["Dt Conclusao"] || resource["Status Execucao"] === "Concluida") return resource;
    const assinatura = [resource["Responsavel Acao"], email.toLowerCase(), resource["Dt Programada"]].join("|");
    if (!reenviar && resource._notifPsico && resource._notifPsico.assinatura === assinatura) return resource;
    await enviarEmail({
      para: email,
      assunto: `Ação sob sua responsabilidade · Riscos psicossociais · ${resource.Cliente || ""}`,
      htmlCorpo: rotaPsicossocial.emailAcaoPsico(resource),
    });
    const atualizado = Object.assign({}, resource, { _notifPsico: { assinatura, em: new Date().toISOString() } });
    const { resource: salvo } = await container.items.upsert(atualizado);
    return salvo || atualizado;
  } catch (erro) {
    context.error("Falha ao enviar e-mail de acao psicossocial (Plano de Acao)", erro);
    return resource;
  }
}

async function notificarPlanoAcao(context, existente, resource, container, reenviar) {
  try {
    if (resource.Origem !== "Riscos Psicossociais" && (precisaNotificarAtribuicao(existente, resource) || (reenviar && precisaNotificarAtribuicao(null, resource)))) {
      await enviarEmail({
        para: resource["E-mail Responsavel"],
        assunto: ESTAGIOS_PLANO_ACAO.atribuida.assunto(resource),
        htmlCorpo: modeloPlanoAcao({ nomeApp: NOME_APP, estagio: "atribuida", acao: resource }),
      });
      // V 1.33: registra o envio (a tela mostra "e-mail enviado em ...")
      if (container) {
        const atualizado = Object.assign({}, resource, { _notifAtrib: { para: String(resource["E-mail Responsavel"]).trim().toLowerCase(), em: new Date().toISOString() } });
        try { const { resource: salvo } = await container.items.upsert(atualizado); resource = salvo || atualizado; } catch (e) { context.error("registro do envio", e); }
      }
    }
  } catch (erro) {
    context.error("Falha ao enviar e-mail de acao atribuida (Plano de Acao)", erro);
  }
  try {
    const d = resource._dispensa;
    const jaAvisou = existente && existente._dispensa && existente._dispensa.em === (d && d.em);
    if (d && !d.regularizadaEm && !jaAvisou) {
      const destinos = Array.from(new Set([d.por, resource["E-mail Responsavel"]].filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(x || "")))));
      for (const para of destinos) {
        await enviarEmail({
          para,
          assunto: ESTAGIOS_PLANO_ACAO.evidDispensa.assunto(resource),
          htmlCorpo: modeloPlanoAcao({ nomeApp: NOME_APP, estagio: "evidDispensa", acao: resource, paraAdmin: para === d.por }),
        });
      }
    }
  } catch (erro) {
    context.error("Falha ao enviar e-mail de dispensa de evidencia (Plano de Acao)", erro);
  }
  return resource;
}

async function tratar(request, context) {
  const colecao = request.params.colecao;

  if (Object.prototype.hasOwnProperty.call(ROTAS_ESPECIAIS, colecao)) {
    return ROTAS_ESPECIAIS[colecao](request, context);
  }

  if (!COLECOES.includes(colecao)) {
    return { status: 404, jsonBody: { erro: `Coleção desconhecida: ${colecao}` } };
  }

  let identidade;
  try {
    identidade = await resolverIdentidade(request);
  } catch (erro) {
    context.error("Falha ao resolver identidade", erro);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissões." } };
  }
  if (!identidade) {
    return { status: 401, jsonBody: { erro: "Não autenticado." } };
  }
  if (!identidade.papel) {
    return {
      status: 403,
      jsonBody: { erro: "Seu acesso ainda não foi liberado. Peça a um Administrador para vincular você a uma empresa." },
    };
  }

  const container = ["configuracao", "ergonomista", "colaborador"].includes(colecao) ? await garantirContainer(colecao) : obterContainer(colecao);
  const id = request.params.id;
  if (COLECOES_SO_ADMIN_GRAVA.includes(colecao) && request.method !== "GET" && identidade.papel !== "Administrador") {
    return { status: 403, jsonBody: { erro: "Só Administrador pode alterar as configurações do sistema." } };
  }

  // V 1.27: o Usuario Cliente so consulta (Cadastro e Registro); quem grava e a equipe ElevaLife.
  if (request.method !== "GET" && identidade.papel === "UsuarioCliente") {
    return { status: 403, jsonBody: { erro: "Seu perfil permite apenas consultar e baixar os dados. Alterações são feitas pela equipe ElevaLife." } };
  }

  try {
    switch (request.method) {
      case "GET": {
        if (id) {
          const item = await lerPorId(container, id);
          const visivel = item && (COLECOES_GLOBAIS.includes(colecao) || podeVerDocumento(identidade, colecao, item));
          if (!visivel) {
            return { status: 404, jsonBody: { erro: "Não encontrado." } };
          }
          return { jsonBody: item };
        }
        // V 1.27: ?empresa=<EmpresaId> restringe a lista a uma empresa (so
        // estreita o que o papel ja permite ver - usado pelos Riscos Psicossociais).
        const soEmpresa = request.query && request.query.get ? request.query.get("empresa") : null;
        if (soEmpresa && !COLECOES_GLOBAIS.includes(colecao)) {
          if (!podeVerEmpresa(identidade, soEmpresa)) return { jsonBody: [] };
          const campo = colecao === "cliente" ? "c.id" : "c.EmpresaId";
          const { resources } = await container.items.query({ query: `SELECT * FROM c WHERE ${campo} = @e`, parameters: [{ name: "@e", value: soEmpresa }] }).fetchAll();
          return { jsonBody: resources };
        }
        return { jsonBody: await listarComFiltro(container, colecao, identidade) };
      }

      case "POST": {
        const corpo = await request.json();
        if (colecao === "cliente" && identidade.papel !== "Administrador") {
          return { status: 403, jsonBody: { erro: "Só Administrador pode cadastrar uma nova empresa-cliente." } };
        }
        const empresaId = colecao === "cliente"
          ? corpo.EmpresaId || crypto.randomUUID()
          : COLECOES_GLOBAIS.includes(colecao) ? EMPRESA_GLOBAL : corpo.EmpresaId;
        if (!empresaId) {
          return { status: 400, jsonBody: { erro: "EmpresaId é obrigatório." } };
        }
        if (!COLECOES_GLOBAIS.includes(colecao) && !podeVerEmpresa(identidade, empresaId)) {
          return { status: 403, jsonBody: { erro: "Sem permissão para gravar nesta empresa." } };
        }
        const novo = Object.assign({}, corpo, { id: corpo.id || crypto.randomUUID(), EmpresaId: empresaId });
        // POST e' upsert (a fila offline reenvia o mesmo registro) - se o id ja
        // existe, o historico continua de onde parou em vez de recomecar.
        const jaExistia = corpo.id ? await lerPorId(container, novo.id) : null;
        if (jaExistia && !COLECOES_GLOBAIS.includes(colecao) && !podeVerDocumento(identidade, colecao, jaExistia)) {
          return { status: 403, jsonBody: { erro: "Sem permissão." } };
        }
        if (colecao === "laudo" && await codigoVerificacaoEmUso(container, novo["Codigo Verificacao"], novo.id)) {
          return { status: 409, jsonBody: { erro: "Já existe um laudo com este código de verificação." } };
        }
        let paraGravar = novo;
        // V 1.28: numero da AEP (sequencial por empresa), atribuido pelo servidor na criacao e mantido depois.
        if (colecao === "avaliacaoErgonomica") {
          if (jaExistia && jaExistia["Nr Avaliacao"]) paraGravar = Object.assign({}, paraGravar, { "Nr Avaliacao": jaExistia["Nr Avaliacao"] });
          else if (!paraGravar["Nr Avaliacao"]) paraGravar = Object.assign({}, paraGravar, { "Nr Avaliacao": await proximoNrAvaliacao(container, empresaId) });
        }
        if (colecao === "planoAcao") {
          const avaliacao = await avaliarPlanoAcaoComArquivos(jaExistia, novo, identidade, context);
          if (!avaliacao.ok) return { status: avaliacao.status, jsonBody: { erro: avaliacao.erro, codigo: avaliacao.codigo } };
          paraGravar = avaliacao.doc;
        }
        const doc = aplicarAuditoria(jaExistia, paraGravar, identidade.email);
        const reenviarPsico = colecao === "planoAcao" && !!(doc._reenviarPsico || doc._reenviarAcao);
        if (colecao === "planoAcao") { delete doc._reenviarPsico; delete doc._reenviarAcao; }
        let { resource } = await container.items.upsert(doc);
        if (colecao === "planoAcao") {
          resource = await notificarPlanoAcao(context, jaExistia, resource, container, reenviarPsico);
          if (resource.Origem === "Riscos Psicossociais") resource = await notificarAcaoPsico(context, container, resource, reenviarPsico);
        }
        return { status: 201, jsonBody: resource };
      }

      case "PUT": {
        if (!id) return { status: 400, jsonBody: { erro: "Id é obrigatório para atualizar." } };
        const existente = await lerPorId(container, id);
        if (!existente) return { status: 404, jsonBody: { erro: "Não encontrado." } };
        if (!COLECOES_GLOBAIS.includes(colecao) && !podeVerDocumento(identidade, colecao, existente)) {
          return { status: 403, jsonBody: { erro: "Sem permissão." } };
        }
        const corpo = await request.json();
        const empresaIdFinal = colecao === "cliente"
          ? empresaIdDoDocumento(colecao, existente)
          : COLECOES_GLOBAIS.includes(colecao) ? EMPRESA_GLOBAL : corpo.EmpresaId || existente.EmpresaId;
        if (!COLECOES_GLOBAIS.includes(colecao) && !podeVerEmpresa(identidade, empresaIdFinal)) {
          return { status: 403, jsonBody: { erro: "Sem permissão para gravar nesta empresa." } };
        }
        let mesclado = Object.assign({}, existente, corpo, { id, EmpresaId: empresaIdFinal });
        if (colecao === "avaliacaoErgonomica" && existente["Nr Avaliacao"]) mesclado["Nr Avaliacao"] = existente["Nr Avaliacao"];
        if (colecao === "laudo" && await codigoVerificacaoEmUso(container, mesclado["Codigo Verificacao"], id)) {
          return { status: 409, jsonBody: { erro: "Já existe um laudo com este código de verificação." } };
        }
        if (colecao === "planoAcao") {
          const avaliacao = await avaliarPlanoAcaoComArquivos(existente, mesclado, identidade, context);
          if (!avaliacao.ok) return { status: avaliacao.status, jsonBody: { erro: avaliacao.erro, codigo: avaliacao.codigo } };
          mesclado = avaliacao.doc;
        }
        const doc = aplicarAuditoria(existente, mesclado, identidade.email);
        const reenviarPsico = colecao === "planoAcao" && !!(doc._reenviarPsico || doc._reenviarAcao);
        if (colecao === "planoAcao") { delete doc._reenviarPsico; delete doc._reenviarAcao; }
        let { resource } = await container.item(id, empresaIdDoDocumento(colecao, doc)).replace(doc);
        if (colecao === "planoAcao") {
          resource = await notificarPlanoAcao(context, existente, resource, container, reenviarPsico);
          if (resource.Origem === "Riscos Psicossociais") resource = await notificarAcaoPsico(context, container, resource, reenviarPsico);
        }
        // Tirou uma foto/arquivo do registro: apaga o arquivo do Storage tambem.
        await excluirArquivosRemovidos(existente, resource, empresaIdFinal, context);
        return { jsonBody: resource };
      }

      case "DELETE": {
        if (!id) return { status: 400, jsonBody: { erro: "Id é obrigatório para excluir." } };
        const existente = await lerPorId(container, id);
        if (!existente) return { status: 204 };
        if (!COLECOES_GLOBAIS.includes(colecao) && !podeVerDocumento(identidade, colecao, existente)) {
          return { status: 403, jsonBody: { erro: "Sem permissão." } };
        }
        if (colecao === "cliente" && identidade.papel !== "Administrador") {
          return { status: 403, jsonBody: { erro: "Só Administrador pode excluir uma empresa-cliente." } };
        }
        await container.item(id, empresaIdDoDocumento(colecao, existente)).delete();
        // Excluiu o registro: apaga as fotos/arquivos dele do Storage tambem.
        await excluirArquivosRemovidos(existente, null, COLECOES_GLOBAIS.includes(colecao) ? EMPRESA_GLOBAL : empresaIdDoDocumento(colecao, existente), context);
        return { status: 204 };
      }

      default:
        return { status: 405, jsonBody: { erro: "Método não suportado." } };
    }
  } catch (erro) {
    context.error(`Erro em /api/${colecao}`, erro);
    return { status: 500, jsonBody: { erro: "Erro interno." } };
  }
}

app.http("entidades", {
  route: "{colecao}/{id?}",
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: tratar,
});

module.exports = { COLECOES, COLECOES_GLOBAIS, COLECOES_SO_EQUIPE_GRAVA, listarComFiltro, lerPorId };
