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

// V 1.7 (revisao de seguranca): limite de tentativas de login por conta.
// 5 senhas erradas seguidas bloqueiam a conta por 15 minutos (resposta 429);
// acertar a senha zera o contador. Tambem espaca os pedidos de "Esqueci
// minha senha" (1 por minuto por conta) para ninguem encher a caixa de
// e-mail de outra pessoa.
const MAX_FALHAS_LOGIN = 5;
const BLOQUEIO_LOGIN_MS = 15 * 60 * 1000;
const INTERVALO_MIN_RESET_MS = 60 * 1000;
const VALIDADE_RESET_MS_ESPELHO = 2 * 60 * 60 * 1000; // mesmo valor de shared/auth.js (gerarReset)
// Hash bcrypt valido de uma senha qualquer: usado so pra gastar o mesmo tempo
// quando o e-mail nao existe (evita descobrir e-mails pelo tempo da resposta).
const HASH_FALSO = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.4Qm0o2dQ3GqQy1bq3zZ7yJmJcZ0u";
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
async function criarOuConvidarUsuario(request, container, { Email, Papel, EmpresasVinculadas, id }, identidade) {
  const crypto = require("crypto");
  const email = normalizarEmail(Email);
  if (!email) return { erro: { status: 400, jsonBody: { erro: "E-mail é obrigatório." } } };
  if (!PAPEIS_VALIDOS.has(Papel)) {
    return { erro: { status: 400, jsonBody: { erro: `Papel inválido. Use um de: ${Array.from(PAPEIS_VALIDOS).join(", ")}.` } } };
  }
  const empresas = Array.isArray(EmpresasVinculadas) ? EmpresasVinculadas.filter((e) => typeof e === "string" && e) : [];

  // V 1.7 (revisao de seguranca): so o Administrador define papeis altos e
  // vincula empresas livremente. Um Consultor so convida UsuarioCliente e
  // so para empresas as quais ele mesmo esta vinculado - antes ele podia
  // convidar qualquer papel/empresa (inclusive se promover a Administrador).
  const ehAdmin = identidade && identidade.papel === PAPEIS.ADMIN;
  if (!ehAdmin) {
    if (Papel !== PAPEIS.CLIENTE) {
      return { erro: { status: 403, jsonBody: { erro: "Consultores só podem convidar usuários do tipo UsuarioCliente. Peça a um Administrador para os demais papéis." } } };
    }
    const minhas = (identidade && identidade.empresasVinculadas) || [];
    if (empresas.some((e) => !minhas.includes(e))) {
      return { erro: { status: 403, jsonBody: { erro: "Você só pode vincular o usuário a empresas às quais você mesmo está vinculado." } } };
    }
  }

  const existente = await buscarUsuarioPorEmail(container, email);
  if (existente) {
    // Convidar um e-mail que ja existe NUNCA pode zerar a senha/tokens de uma
    // conta ativa (era assim: gerava um novo link de primeiro acesso, que
    // trocava a senha de qualquer usuario - inclusive Administrador).
    if (existente.StatusConta === "Ativo" || existente.SenhaHash) {
      return { erro: { status: 409, jsonBody: { erro: "Este e-mail já tem conta ativa. Para mudar papel ou empresas use a edição do usuário (Administrador); para acesso perdido, “Esqueci minha senha” na tela de login." } } };
    }
    if (!ehAdmin && existente.Papel && existente.Papel !== PAPEIS.CLIENTE) {
      return { erro: { status: 403, jsonBody: { erro: "Sem permissão para alterar o convite deste usuário." } } };
    }
  }
  const doc = existente || { id: id || crypto.randomUUID(), Email: email };
  doc.Papel = Papel;
  doc.EmpresasVinculadas = empresas;

  const { link, avisoEmail } = await enviarConvite(request, container, doc, { reenvio: Boolean(existente) });
  return { doc, link, avisoEmail };
}

async function tratar(request, context) {
  const acao = request.params.id;
  if (request.method !== "POST") return { status: 405, jsonBody: { erro: "Use POST." } };
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
        if (!doc || !doc.SenhaHash) {
          await conferirSenha(senha, HASH_FALSO); // mesmo custo de tempo de uma conta real
          return erroGenerico;
        }
        if (doc.BloqueadoAte && Date.parse(doc.BloqueadoAte) > Date.now()) {
          return { status: 429, headers: { "Retry-After": "900" }, jsonBody: { erro: "Muitas tentativas de login. Aguarde alguns minutos e tente de novo, ou use “Esqueci minha senha”." } };
        }
        if (doc.StatusConta && doc.StatusConta !== "Ativo") {
          return { status: 403, jsonBody: { erro: "Sua conta ainda não concluiu o primeiro acesso. Verifique o e-mail de convite." } };
        }
        const ok = await conferirSenha(senha, doc.SenhaHash);
        if (!ok) {
          try {
            doc.FalhasLogin = (doc.FalhasLogin || 0) + 1;
            if (doc.FalhasLogin >= MAX_FALHAS_LOGIN) {
              doc.BloqueadoAte = new Date(Date.now() + BLOQUEIO_LOGIN_MS).toISOString();
              doc.FalhasLogin = 0;
            }
            await container.items.upsert(doc);
          } catch (erroContador) {
            context.error("Falha ao registrar tentativa de login", erroContador);
          }
          return erroGenerico;
        }
        if (doc.FalhasLogin || doc.BloqueadoAte) {
          try {
            delete doc.FalhasLogin;
            delete doc.BloqueadoAte;
            await container.items.upsert(doc);
          } catch (erroContador) {
            context.error("Falha ao zerar contador de login", erroContador);
          }
        }

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
        const resultado = await criarOuConvidarUsuario(request, container, corpo, identidade);
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
        if (identidade.papel !== PAPEIS.ADMIN && doc.Papel && doc.Papel !== PAPEIS.CLIENTE) {
          return { status: 403, jsonBody: { erro: "Sem permissão para reenviar o convite deste usuário." } };
        }
        if (doc.StatusConta === "Ativo" || doc.SenhaHash) {
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
        // Ja emitiu um link ha menos de 1 minuto: nao envia outro (anti spam de e-mail).
        if (doc.TokenResetExpira) {
          const emitidoEm = Date.parse(doc.TokenResetExpira) - VALIDADE_RESET_MS_ESPELHO;
          if (Number.isFinite(emitidoEm) && Date.now() - emitidoEm < INTERVALO_MIN_RESET_MS) return respostaGenerica;
        }

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
