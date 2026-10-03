/* ==========================================================================
   BI Ergonomia - ElevaLife
   Login por e-mail e senha, convite de primeiro acesso e redefinicao de
   senha - substitui o "Entrar com Microsoft" (Azure AD Easy Auth).

   Despachada de dentro de entidades.js (ROTAS_ESPECIAIS.auth), igual a
   "me"/"usuarios" - o {colecao} da rota generica "{colecao}/{id?}" vira
   "auth" e o {id} vira a acao (ex.: POST /api/auth/login -> id="login").
   Todas as acoes sao POST.

   POST /api/auth/login              { Email, Senha }
   POST /api/auth/logout              (sem corpo)
   POST /api/auth/convidar           { Email, Papel, EmpresasVinculadas }  - Administrador/Consultor
   POST /api/auth/reenviar-convite   { Email }                             - Administrador/Consultor
   POST /api/auth/primeiro-acesso    { Email, Token, NovaSenha }
   POST /api/auth/esqueci-senha      { Email }                             - publica (sempre responde OK)
   POST /api/auth/redefinir-senha    { Email, Token, NovaSenha }
   POST /api/auth/bootstrap          { Email, SegredoConfiguracao }        - so 1a vez, ver docs/login-email-senha.md
   ========================================================================== */

"use strict";

const { obterContainer } = require("../shared/cosmos");
const { resolverIdentidade, PAPEIS } = require("../shared/tenant");
const {
  gerarHashSenha,
  conferirSenha,
  senhaValida,
  gerarConvite,
  gerarReset,
  hashToken,
  tokensIguais,
  tokenExpirado,
  cookieDeSessao,
  cookieDeLogout,
} = require("../shared/auth");
const { enviarEmail, modeloConvite, modeloRedefinicao } = require("../shared/email");

const NOME_APP = "S.I.G.E";
const PAPEIS_VALIDOS = new Set(Object.values(PAPEIS));

function normalizarEmail(v) {
  return String(v || "").trim().toLowerCase();
}

async function buscarUsuarioPorEmail(container, email) {
  const consulta = {
    query: "SELECT * FROM c WHERE LOWER(c.Email) = @email",
    parameters: [{ name: "@email", value: email }],
  };
  const { resources } = await container.items.query(consulta).fetchAll();
  return resources[0] || null;
}

// Monta o link que vai no e-mail (e que a resposta da API tambem devolve,
// pro Administrador poder copiar/colar na mao se o e-mail nao chegar - ver
// docs/login-email-senha.md).
//
// IMPORTANTE: request.url NAO traz o dominio publico em producao, e o
// cabecalho "x-forwarded-host" (que seria o jeito padrao de descobrir)
// tambem NAO vem preenchido nas chamadas /api/* do Azure Static Web Apps
// (Managed Functions) - confirmado na pratica em 02/10/2026, testando o
// bootstrap duas vezes em producao: nos dois casos o link saiu apontando
// pro host interno da Function App (tipo "xxxxxxxx.azurewebsites.net",
// que nao serve o index.html/front-end), nunca pro dominio publico
// (witty-sea-....azurestaticapps.net) que o navegador realmente usou.
// Solucao: a URL publica fica fixa na Application Setting URL_PUBLICA
// (nunca muda depois de configurada - e' o dominio do Static Web App).
// Mantemos x-forwarded-host e request.url como fallback, nessa ordem,
// soh pra nao quebrar em dev local (func start) caso URL_PUBLICA nao
// esteja definida.
function montarLink(request, tipo, email, tokenBruto) {
  const hostPublico = request.headers.get("x-forwarded-host");
  const origem =
    (process.env.URL_PUBLICA && process.env.URL_PUBLICA.replace(/\/+$/, "")) ||
    (hostPublico && `${request.headers.get("x-forwarded-proto") || "https"}://${hostPublico}`) ||
    new URL(request.url).origin;
  const parametros = new URLSearchParams({ tela: tipo, email, token: tokenBruto });
  return `${origem}/index.html?${parametros.toString()}`;
}

async function enviarConvite(request, container, doc, { reenvio }) {
  const convite = gerarConvite();
  doc.StatusConta = "Convidado";
  doc.TokenConviteHash = convite.tokenHash;
  doc.TokenConviteExpira = convite.expiraEm;
  await container.items.upsert(doc);

  const link = montarLink(request, "primeiro-acesso", doc.Email, convite.tokenBruto);
  let avisoEmail = null;
  try {
    await enviarEmail({
      para: doc.Email,
      assunto: reenvio ? `Convite para o ${NOME_APP} (reenviado)` : `Convite para o ${NOME_APP}`,
      htmlCorpo: modeloConvite({ nomeApp: NOME_APP, link }),
    });
  } catch (erro) {
    avisoEmail = `Não foi possível enviar o e-mail automaticamente (${erro.message}). Copie o link abaixo e envie manualmente para ${doc.Email}.`;
  }
  return { link, avisoEmail };
}

// Reaproveitada por usuarios.js (POST /api/usuarios) - criar um usuario
// SEMPRE dispara um convite por e-mail agora, nao existe mais "criar sem
// convidar" (pedido do Leo: toda pessoa nova tem que receber o convite).
// Faz upsert pelo e-mail (nunca cria um segundo documento pro mesmo e-mail).
async function criarOuConvidarUsuario(request, container, { Email, Papel, EmpresasVinculadas, id }) {
  const crypto = require("crypto");
  const email = normalizarEmail(Email);
  if (!email) return { erro: { status: 400, jsonBody: { erro: "E-mail é obrigatório." } } };
  if (!PAPEIS_VALIDOS.has(Papel)) {
    return { erro: { status: 400, jsonBody: { erro: `Papel inválido. Use um de: ${Array.from(PAPEIS_VALIDOS).join(", ")}.` } } };
  }
  const existente = await buscarUsuarioPorEmail(container, email);
  const doc = existente || { id: id || crypto.randomUUID(), Email: email };
  doc.Papel = Papel;
  doc.EmpresasVinculadas = Array.isArray(EmpresasVinculadas) ? EmpresasVinculadas : [];

  const { link, avisoEmail } = await enviarConvite(request, container, doc, { reenvio: Boolean(existente) });
  return { doc, link, avisoEmail };
}

async function tratar(request, context) {
  const acao = request.params.id;
  const container = obterContainer("usuarios");

  try {
    switch (acao) {
      // --------------------------------------------------------------
      case "login": {
        const corpo = await request.json();
        const email = normalizarEmail(corpo.Email);
        const senha = String(corpo.Senha || "");
        if (!email || !senha) return { status: 400, jsonBody: { erro: "Informe e-mail e senha." } };

        const doc = await buscarUsuarioPorEmail(container, email);
        // Mensagem generica (nao revela se o e-mail existe) - so muda entre
        // "sem conta"/"senha errada" internamente pros logs, nunca na resposta.
        const erroGenerico = { status: 401, jsonBody: { erro: "E-mail ou senha inválidos." } };
        if (!doc || !doc.SenhaHash) return erroGenerico;
        if (doc.StatusConta && doc.StatusConta !== "Ativo") {
          return { status: 403, jsonBody: { erro: "Sua conta ainda não concluiu o primeiro acesso. Verifique o e-mail de convite." } };
        }
        const ok = await conferirSenha(senha, doc.SenhaHash);
        if (!ok) return erroGenerico;

        return {
          status: 200,
          headers: { "Set-Cookie": cookieDeSessao(email) },
          jsonBody: { email, papel: doc.Papel || null, empresasVinculadas: doc.EmpresasVinculadas || [], acessoLiberado: Boolean(doc.Papel) },
        };
      }

      // --------------------------------------------------------------
      case "logout": {
        return { status: 200, headers: { "Set-Cookie": cookieDeLogout() }, jsonBody: { ok: true } };
      }

      // --------------------------------------------------------------
      // Administrador OU Consultor cria/convida um usuario (pedido do Leo:
      // "eu crio o usuario... com o e-mail da pessoa e a empresa, ou o
      // administrador, ou o consultor"). So Administrador pode alterar
      // Papel/EmpresasVinculadas de alguem depois (ver usuarios.js).
      case "convidar": {
        const identidade = await resolverIdentidade(request);
        if (!identidade) return { status: 401, jsonBody: { erro: "Não autenticado." } };
        if (identidade.papel !== PAPEIS.ADMIN && identidade.papel !== PAPEIS.CONSULTOR) {
          return { status: 403, jsonBody: { erro: "Só Administradores ou Consultores podem convidar usuários." } };
        }
        const corpo = await request.json();
        const resultado = await criarOuConvidarUsuario(request, container, corpo);
        if (resultado.erro) return resultado.erro;
        const { doc, link, avisoEmail } = resultado;
        return { status: 201, jsonBody: { id: doc.id, Email: doc.Email, Papel: doc.Papel, EmpresasVinculadas: doc.EmpresasVinculadas, StatusConta: doc.StatusConta, linkConvite: link, avisoEmail } };
      }

      // --------------------------------------------------------------
      case "reenviar-convite": {
        const identidade = await resolverIdentidade(request);
        if (!identidade) return { status: 401, jsonBody: { erro: "Não autenticado." } };
        if (identidade.papel !== PAPEIS.ADMIN && identidade.papel !== PAPEIS.CONSULTOR) {
          return { status: 403, jsonBody: { erro: "Só Administradores ou Consultores podem reenviar convites." } };
        }
        const corpo = await request.json();
        const email = normalizarEmail(corpo.Email);
        const doc = await buscarUsuarioPorEmail(container, email);
        if (!doc) return { status: 404, jsonBody: { erro: "Usuário não encontrado." } };
        if (doc.StatusConta === "Ativo") {
          return { status: 400, jsonBody: { erro: "Este usuário já concluiu o primeiro acesso. Use “Esqueci minha senha” na tela de login em vez de reenviar convite." } };
        }
        const { link, avisoEmail } = await enviarConvite(request, container, doc, { reenvio: true });
        return { status: 200, jsonBody: { linkConvite: link, avisoEmail } };
      }

      // --------------------------------------------------------------
      case "primeiro-acesso": {
        const corpo = await request.json();
        const email = normalizarEmail(corpo.Email);
        const tokenBruto = String(corpo.Token || "");
        const novaSenha = String(corpo.NovaSenha || "");
        if (!email || !tokenBruto) return { status: 400, jsonBody: { erro: "Link inválido." } };
        if (!senhaValida(novaSenha)) return { status: 400, jsonBody: { erro: "A senha precisa ter pelo menos 8 caracteres." } };

        const doc = await buscarUsuarioPorEmail(container, email);
        if (!doc || !doc.TokenConviteHash) return { status: 400, jsonBody: { erro: "Link inválido ou já utilizado." } };
        if (tokenExpirado(doc.TokenConviteExpira)) return { status: 400, jsonBody: { erro: "Este link expirou. Peça a um Administrador para reenviar o convite." } };
        if (!tokensIguais(hashToken(tokenBruto), doc.TokenConviteHash)) return { status: 400, jsonBody: { erro: "Link inválido ou já utilizado." } };

        doc.SenhaHash = await gerarHashSenha(novaSenha);
        doc.StatusConta = "Ativo";
        delete doc.TokenConviteHash;
        delete doc.TokenConviteExpira;
        await container.items.upsert(doc);

        return {
          status: 200,
          headers: { "Set-Cookie": cookieDeSessao(email) },
          jsonBody: { email, papel: doc.Papel || null, empresasVinculadas: doc.EmpresasVinculadas || [], acessoLiberado: Boolean(doc.Papel) },
        };
      }

      // --------------------------------------------------------------
      // Autosservico, publica de proposito - sempre responde "OK" (nunca
      // revela se o e-mail existe ou nao, pra nao dar pista pra quem estiver
      // testando e-mails aleatorios).
      case "esqueci-senha": {
        const corpo = await request.json();
        const email = normalizarEmail(corpo.Email);
        const respostaGenerica = { status: 200, jsonBody: { ok: true, mensagem: "Se este e-mail estiver cadastrado, você vai receber um link para redefinir a senha." } };
        if (!email) return respostaGenerica;

        const doc = await buscarUsuarioPorEmail(container, email);
        if (!doc || doc.StatusConta !== "Ativo") return respostaGenerica;

        const reset = gerarReset();
        doc.TokenResetHash = reset.tokenHash;
        doc.TokenResetExpira = reset.expiraEm;
        await container.items.upsert(doc);

        const link = montarLink(request, "redefinir-senha", doc.Email, reset.tokenBruto);
        try {
          await enviarEmail({ para: doc.Email, assunto: `Redefinição de senha – ${NOME_APP}`, htmlCorpo: modeloRedefinicao({ nomeApp: NOME_APP, link }) });
        } catch (erro) {
          context.error("Falha ao enviar e-mail de redefinicao de senha", erro);
        }
        return respostaGenerica;
      }

      // --------------------------------------------------------------
      case "redefinir-senha": {
        const corpo = await request.json();
        const email = normalizarEmail(corpo.Email);
        const tokenBruto = String(corpo.Token || "");
        const novaSenha = String(corpo.NovaSenha || "");
        if (!email || !tokenBruto) return { status: 400, jsonBody: { erro: "Link inválido." } };
        if (!senhaValida(novaSenha)) return { status: 400, jsonBody: { erro: "A senha precisa ter pelo menos 8 caracteres." } };

        const doc = await buscarUsuarioPorEmail(container, email);
        if (!doc || !doc.TokenResetHash) return { status: 400, jsonBody: { erro: "Link inválido ou já utilizado." } };
        if (tokenExpirado(doc.TokenResetExpira)) return { status: 400, jsonBody: { erro: "Este link expirou. Peça um novo em “Esqueci minha senha”." } };
        if (!tokensIguais(hashToken(tokenBruto), doc.TokenResetHash)) return { status: 400, jsonBody: { erro: "Link inválido ou já utilizado." } };

        doc.SenhaHash = await gerarHashSenha(novaSenha);
        delete doc.TokenResetHash;
        delete doc.TokenResetExpira;
        await container.items.upsert(doc);

        return {
          status: 200,
          headers: { "Set-Cookie": cookieDeSessao(email) },
          jsonBody: { email, papel: doc.Papel || null, empresasVinculadas: doc.EmpresasVinculadas || [], acessoLiberado: Boolean(doc.Papel) },
        };
      }

      // --------------------------------------------------------------
      // Bootstrap - so pra destravar o(s) Administrador(es) existente(s) na
      // primeira vez que este login substitui o "Entrar com Microsoft" (sem
      // isso ninguem consegue logar pra usar a tela de Usuarios e se
      // convidar). Protegido por SETUP_SECRET (Configuracoes do aplicativo),
      // nunca pelo papel do usuario - ver docs/login-email-senha.md, passo 7.
      // So funciona em quem AINDA NAO tem SenhaHash (nao serve pra "roubar"
      // uma conta ja ativa).
      case "bootstrap": {
        const segredoEsperado = process.env.SETUP_SECRET;
        if (!segredoEsperado) {
          return { status: 500, jsonBody: { erro: "SETUP_SECRET não configurado nas Configurações do aplicativo." } };
        }
        const corpo = await request.json();
        const email = normalizarEmail(corpo.Email);
        const segredoRecebido = String(corpo.SegredoConfiguracao || "");
        if (!tokensIguais(hashToken(segredoRecebido), hashToken(segredoEsperado))) {
          return { status: 403, jsonBody: { erro: "Segredo de configuração inválido." } };
        }
        const doc = await buscarUsuarioPorEmail(container, email);
        if (!doc) return { status: 404, jsonBody: { erro: `Nenhum usuário com o e-mail ${email} encontrado na coleção “usuarios”. Cadastre-o primeiro (Cosmos DB) ou peça ajuda ao Claude.` } };
        if (doc.SenhaHash) {
          return { status: 400, jsonBody: { erro: "Este usuário já tem senha definida. Use “Esqueci minha senha” na tela de login em vez do bootstrap." } };
        }
        const { link, avisoEmail } = await enviarConvite(request, container, doc, { reenvio: false });
        return { status: 200, jsonBody: { linkConvite: link, avisoEmail } };
      }

      default:
        return { status: 404, jsonBody: { erro: `Ação de autenticação desconhecida: ${acao}` } };
    }
  } catch (erro) {
    context.error(`Erro em /api/auth/${acao}`, erro);
    return { status: 500, jsonBody: { erro: "Erro interno." } };
  }
}

module.exports = { tratar, criarOuConvidarUsuario, buscarUsuarioPorEmail };
