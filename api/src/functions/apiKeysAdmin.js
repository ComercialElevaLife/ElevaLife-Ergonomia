/* ==========================================================================
   BI Ergonomia - ElevaLife
   Gestao de chaves da API publica - somente Administrador, pela API interna
   (login Azure AD), igual usuarios.js. Nao ha tela no frontend para isso
   ainda (mesma situacao de "usuarios" hoje) - Administrador pede e essa rota
   e chamada diretamente.

   GET    /api/apiKeys          -> lista todas as chaves (nunca devolve a
                                    chave em texto puro, so Prefixo/Sufixo)
   POST   /api/apiKeys          -> cria uma chave nova, devolve a chave em
                                    texto puro UMA UNICA VEZ nesta resposta
                                    { Nome, EmpresaId?, Escopos?, LimiteRequisicoesPorMinuto? }
   PUT    /api/apiKeys/{id}     -> so para revogar: { RevogadoEm: true }
   DELETE /api/apiKeys/{id}     -> remove o registro definitivamente
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { obterContainer } = require("../shared/cosmos");
const { resolverIdentidade, PAPEIS } = require("../shared/tenant");
const { gerarChaveTextoPuro, hashChave, sufixoParaExibicao } = require("../shared/apiKeys");

function paraExibicao(doc) {
  // Nunca devolve HashChave (nem serviria pra nada no frontend, mas por
  // principio de menor exposicao - so o hash de uma chave revogada ainda
  // assim nao deveria circular).
  const { HashChave, ...resto } = doc;
  return resto;
}

async function tratar(request, context) {
  let identidade;
  try {
    identidade = await resolverIdentidade(request);
  } catch (erro) {
    context.error("Falha ao resolver identidade em /api/apiKeys", erro);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissões." } };
  }
  if (!identidade) return { status: 401, jsonBody: { erro: "Não autenticado." } };
  if (identidade.papel !== PAPEIS.ADMIN) {
    return { status: 403, jsonBody: { erro: "Só Administrador pode gerenciar chaves de API." } };
  }

  const container = obterContainer("apiKeys");
  const id = request.params.id;

  try {
    switch (request.method) {
      case "GET": {
        const { resources } = await container.items.query("SELECT * FROM c").fetchAll();
        return { jsonBody: resources.map(paraExibicao) };
      }

      case "POST": {
        const corpo = await request.json();
        const nome = String(corpo.Nome || "").trim();
        if (!nome) return { status: 400, jsonBody: { erro: "Nome é obrigatório (ex.: “Integração SOC – Cliente X”)." } };

        const chaveTextoPuro = gerarChaveTextoPuro();
        const doc = {
          id: crypto.randomUUID(),
          Nome: nome,
          EmpresaId: corpo.EmpresaId || null, // null = chave admin (enxerga todas as empresas)
          Escopos: {
            leitura: corpo.Escopos && corpo.Escopos.leitura === false ? false : true,
            escrita: !!(corpo.Escopos && corpo.Escopos.escrita),
            colecoes: Array.isArray(corpo.Escopos && corpo.Escopos.colecoes) ? corpo.Escopos.colecoes : null,
          },
          LimiteRequisicoesPorMinuto: Number(corpo.LimiteRequisicoesPorMinuto) || 60,
          HashChave: hashChave(chaveTextoPuro),
          SufixoExibicao: sufixoParaExibicao(chaveTextoPuro),
          CriadoPor: identidade.email,
          CriadoEm: new Date().toISOString(),
          RevogadoEm: null,
          JanelaAtual: null,
          ContadorJanela: 0,
          UltimoUsoEm: null,
        };
        const { resource } = await container.items.upsert(doc);
        return {
          status: 201,
          jsonBody: Object.assign(paraExibicao(resource), {
            Chave: chaveTextoPuro,
            aviso: "Guarde esta chave agora - ela nao sera mostrada novamente. Se for perdida, revogue e gere outra.",
          }),
        };
      }

      case "PUT": {
        if (!id) return { status: 400, jsonBody: { erro: "Id é obrigatório." } };
        const { resource: existente } = await container.item(id, id).read().catch(() => ({ resource: null }));
        if (!existente) return { status: 404, jsonBody: { erro: "Não encontrado." } };
        const corpo = await request.json();
        const doc = Object.assign({}, existente, {
          RevogadoEm: corpo.RevogadoEm ? new Date().toISOString() : existente.RevogadoEm,
        });
        const { resource } = await container.item(id, id).replace(doc);
        return { jsonBody: paraExibicao(resource) };
      }

      case "DELETE": {
        if (!id) return { status: 400, jsonBody: { erro: "Id é obrigatório." } };
        await container.item(id, id).delete().catch(() => null);
        return { status: 204 };
      }

      default:
        return { status: 405, jsonBody: { erro: "Método não suportado." } };
    }
  } catch (erro) {
    context.error("Erro em /api/apiKeys", erro);
    return { status: 500, jsonBody: { erro: "Erro interno." } };
  }
}

module.exports = { tratar };
