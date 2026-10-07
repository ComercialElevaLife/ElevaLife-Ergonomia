/* ==========================================================================
   BI Ergonomia - ElevaLife
   Gestao de usuarios/papeis. Nao faz parte das 10 colecoes de negocio
   (entidades.js) de proposito: aqui a regra de acesso e fixa, nao depende
   de EmpresaId.

   Desde 29/09/2026 (login por e-mail/senha, ver api/src/functions/auth.js):
   Administrador OU Consultor podem listar/criar (convidar) - pedido do Leo
   ("eu crio o usuario... ou o administrador, ou o consultor"); so
   Administrador pode mudar o papel/empresas de alguem ou excluir o acesso
   (evita um Consultor se promover a Administrador).

   GET    /api/usuarios              -> lista todos os usuarios cadastrados
   POST   /api/usuarios              -> cria/convida { Email, Papel, EmpresasVinculadas }
                                         (sempre envia e-mail de convite - ver auth.js)
   PUT    /api/usuarios/{id}         -> atualiza papel/empresas vinculadas (so Administrador)
   DELETE /api/usuarios/{id}         -> remove o acesso de um usuario (so Administrador)
   ========================================================================== */

"use strict";

const { obterContainer } = require("../shared/cosmos");
const { resolverIdentidade, PAPEIS, vinculosDoDoc, vinculosDoCorpo } = require("../shared/tenant");
const { criarOuConvidarUsuario } = require("./auth");

const PAPEIS_VALIDOS = new Set(Object.values(PAPEIS));

async function tratar(request, context) {
  let identidade;
  try {
    identidade = await resolverIdentidade(request);
  } catch (erro) {
    context.error("Falha ao resolver identidade em /api/usuarios", erro);
    return { status: 500, jsonBody: { erro: "Falha ao verificar identidade/permissões." } };
  }
  if (!identidade) return { status: 401, jsonBody: { erro: "Não autenticado." } };
  const podeGerenciar = identidade.papel === PAPEIS.ADMIN || identidade.papel === PAPEIS.CONSULTOR;
  if (!podeGerenciar) {
    return { status: 403, jsonBody: { erro: "Só Administradores ou Consultores podem gerenciar usuários." } };
  }

  const container = obterContainer("usuarios");
  const id = request.params.id;

  try {
    switch (request.method) {
      case "GET": {
        const { resources } = await container.items.query("SELECT * FROM c").fetchAll();
        // Nunca devolver os hashes/tokens pro frontend - so o necessario pra
        // tela de Usuarios (e-mail, papel, empresas, status da conta).
        const semSegredos = resources.map((u) => {
          const v = vinculosDoDoc(u);
          return {
            id: u.id, Email: u.Email, Papel: u.Papel, EmpresasVinculadas: v.sigeVinculo === "nenhuma" ? [] : (u.EmpresasVinculadas || []),
            SigeVinculo: v.sigeVinculo, PsicoVinculo: v.psicoVinculo, EmpresasPsico: v.empresasPsico,
            StatusConta: u.StatusConta || (u.SenhaHash ? "Ativo" : "Convidado"),
          };
        });
        return { jsonBody: semSegredos };
      }

      case "POST": {
        const corpo = await request.json();
        const resultado = await criarOuConvidarUsuario(request, container, corpo, identidade);
        if (resultado.erro) return resultado.erro;
        const { doc, link, avisoEmail } = resultado;
        return { status: 201, jsonBody: { id: doc.id, Email: doc.Email, Papel: doc.Papel, EmpresasVinculadas: doc.EmpresasVinculadas, SigeVinculo: doc.SigeVinculo, PsicoVinculo: doc.PsicoVinculo, EmpresasPsico: doc.EmpresasPsico, StatusConta: doc.StatusConta, linkConvite: link, avisoEmail } };
      }

      case "PUT": {
        if (identidade.papel !== PAPEIS.ADMIN) {
          return { status: 403, jsonBody: { erro: "Só Administrador pode alterar papel/empresas de um usuário." } };
        }
        if (!id) return { status: 400, jsonBody: { erro: "Id é obrigatório para atualizar." } };
        const corpo = await request.json();
        if (corpo.Papel && !PAPEIS_VALIDOS.has(corpo.Papel)) {
          return { status: 400, jsonBody: { erro: `Papel inválido. Use um de: ${Array.from(PAPEIS_VALIDOS).join(", ")}.` } };
        }
        const { resource: existente } = await container.item(id, id).read();
        if (!existente) return { status: 404, jsonBody: { erro: "Não encontrado." } };
        // Nunca deixar o corpo da requisicao sobrescrever SenhaHash/tokens -
        // essa rota so mexe em Papel/EmpresasVinculadas.
        const papelNovo = corpo.Papel || existente.Papel;
        const doc = Object.assign({}, existente, { Papel: papelNovo, EmpresasVinculadas: Array.isArray(corpo.EmpresasVinculadas) ? corpo.EmpresasVinculadas : existente.EmpresasVinculadas, id });
        // V 1.26: vinculos por modulo (SIGE / Riscos Psicossociais). So mexe
        // se a tela mandou os campos (chamadas antigas continuam valendo).
        if ("SigeVinculo" in corpo || "PsicoVinculo" in corpo || "EmpresasPsico" in corpo) {
          Object.assign(doc, vinculosDoCorpo(Object.assign({ SigeVinculo: existente.SigeVinculo, PsicoVinculo: existente.PsicoVinculo, EmpresasPsico: existente.EmpresasPsico }, corpo), papelNovo));
          if (doc.SigeVinculo === "nenhuma") doc.EmpresasVinculadas = [];
        }
        const { resource } = await container.item(id, id).replace(doc);
        return { jsonBody: { id: resource.id, Email: resource.Email, Papel: resource.Papel, EmpresasVinculadas: resource.EmpresasVinculadas, SigeVinculo: resource.SigeVinculo, PsicoVinculo: resource.PsicoVinculo, EmpresasPsico: resource.EmpresasPsico, StatusConta: resource.StatusConta } };
      }

      case "DELETE": {
        if (identidade.papel !== PAPEIS.ADMIN) {
          return { status: 403, jsonBody: { erro: "Só Administrador pode excluir o acesso de um usuário." } };
        }
        if (!id) return { status: 400, jsonBody: { erro: "Id é obrigatório para excluir." } };
        await container.item(id, id).delete().catch(() => null);
        return { status: 204 };
      }

      default:
        return { status: 405, jsonBody: { erro: "Método não suportado." } };
    }
  } catch (erro) {
    context.error("Erro em /api/usuarios", erro);
    return { status: 500, jsonBody: { erro: "Erro interno." } };
  }
}

// Exportado (nao registrado com app.http aqui) - ver comentario em me.js:
// o dispatcher unico em entidades.js chama isso diretamente pra /api/usuarios.
module.exports = { tratar };
