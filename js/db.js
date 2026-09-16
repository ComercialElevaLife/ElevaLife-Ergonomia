/* ==========================================================================
   BI Ergonomia - ElevaLife
   CAMADA DE PERSISTENCIA - detecta automaticamente onde esta rodando e
   escolhe a fonte de dados, sem exigir nenhuma mudanca em app.js/calc.js/
   diagramas.js (todos falam só com window.BI.DB):

   1) Dentro do Cowork (Artifact) -> capacidade "db" do proprio artefato
      (tempo real, onSnapshot). Cadastros feitos aqui ficam salvos de
      verdade, para quem abrir este link.
   2) Publicado no Azure Static Web App, com a API multi-tenant (pasta
      /api do repo) respondendo -> consome /api/{colecao} via fetch. Sem
      tempo real entre abas: recarrega a colecao apos cada gravacao/exclusao.
   3) Nenhum dos dois disponivel (preview sem sessao, index.html aberto
      direto, ou usuario autenticado mas ainda sem papel liberado em
      /api/usuarios) -> modo somente-leitura com o mock estatico
      (data/mock_data.json), como fallback.

   Lista CID e Dias Uteis continuam estaticas em todos os modos - sao
   tabelas de referencia, ocultas, so para consulta.
   ========================================================================== */

(function (global) {
  "use strict";

  const COLECOES = [
    "mapaRisco", "planoAcao", "absenteismo", "compativeis",
    "cliente", "unidade", "setor", "cargo", "posto", "atividade",
  ];

  const estado = {
    disponivel: false,
    somenteLeitura: true,
    modoApi: false,
    db: null,
    identidade: null, // { email, papel, empresasVinculadas, acessoLiberado } quando modoApi
    mensagemAcesso: null, // preenchido quando autenticado mas sem papel liberado
    colecoes: {
      mapaRisco: [], planoAcao: [], absenteismo: [], compativeis: [],
      cliente: [], unidade: [], setor: [], cargo: [], posto: [], atividade: [],
    },
    inscricoes: [],
  };

  let callbackAtualizacao = null;

  function slugify(partes) {
    let s = partes.join("|").toLowerCase();
    s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s.slice(0, 180) || "registro";
  }

  // Gera o id de um documento a partir da chave composta (lista de nomes de
  // campo, na ordem da hierarquia) - usado tanto pelas 4 tabelas
  // operacionais quanto pelas 6 tabelas do cadastro-mestre (Cliente >
  // Unidade > Setor > {Cargo, Posto Trabalho > Atividade}). Continua igual
  // nos 3 modos: o id e sempre calculado no cliente antes de chamar salvar().
  function idPorCampos(dados, campos) {
    return slugify(campos.map((c) => dados[c]));
  }

  function idMapaRisco(dados) {
    return idPorCampos(dados, ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade"]);
  }

  const idCliente = (dados) => idPorCampos(dados, ["Cliente"]);
  const idUnidade = (dados) => idPorCampos(dados, ["Cliente", "Unidade"]);
  const idSetor = (dados) => idPorCampos(dados, ["Cliente", "Unidade", "Setor"]);
  const idCargo = (dados) => idPorCampos(dados, ["Cliente", "Unidade", "Setor", "Cargo"]);
  const idPosto = (dados) => idPorCampos(dados, ["Cliente", "Unidade", "Setor", "Posto Trabalho"]);
  const idAtividade = (dados) => idPorCampos(dados, ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Atividade"]);

  // Id de cada tabela do cadastro-mestre, indexado pelo mesmo nome de
  // colecao usado em COLECOES/CADASTROS_CONFIG - evita um switch/if grande
  // em app.js sempre que uma dessas 6 tabelas precisa "renomear" um
  // registro (editar um campo-chave = excluir o id antigo, salvar no novo).
  const idCadastroMestre = { cliente: idCliente, unidade: idUnidade, setor: idSetor, cargo: idCargo, posto: idPosto, atividade: idAtividade };

  function docParaLinha(doc) {
    const dados = doc.data() || {};
    return Object.assign({ _id: doc.id }, dados);
  }

  // --------------------------------------------------------------------
  // Modo 2: API multi-tenant (Azure Static Web App + Functions em /api)
  // --------------------------------------------------------------------

  // redirect:"manual" evita que o fetch siga sozinho o 302 configurado em
  // staticwebapp.config.json (401 em /api/* -> /.auth/login/aad) e caia
  // sem querer na pagina de login como se fosse uma resposta normal - assim
  // conseguimos distinguir "API nao existe aqui" (Cowork/preview) de
  // "API existe mas precisa logar" (producao, usuario ainda nao autenticado).
  async function detectarApi() {
    try {
      const resp = await fetch("/api/me", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        redirect: "manual",
      });
      if (resp.type === "opaqueredirect" || resp.status === 0 || resp.status === 401) {
        return { existe: true, identidade: null, precisaLogin: true };
      }
      if (!resp.ok) return { existe: false, identidade: null };
      const tipo = resp.headers.get("content-type") || "";
      if (tipo.indexOf("application/json") === -1) return { existe: false, identidade: null };
      const identidade = await resp.json();
      return { existe: true, identidade };
    } catch (e) {
      return { existe: false, identidade: null };
    }
  }

  // So redireciona uma vez por sessao de aba - evita loop se o login falhar,
  // for cancelado, ou o usuario nao tiver conta autorizada.
  function tentarRedirecionarParaLogin() {
    try {
      if (global.sessionStorage.getItem("bi-ergonomia-tentou-login")) return false;
      global.sessionStorage.setItem("bi-ergonomia-tentou-login", "1");
    } catch (e) {
      // sessionStorage indisponivel (raro) - segue sem travar, so nao evita loop.
    }
    const destino = global.location.pathname + global.location.search;
    global.location.href = "/.auth/login/aad?post_login_redirect_uri=" + encodeURIComponent(destino);
    return true;
  }

  async function recarregarColecaoApi(chave) {
    try {
      const resp = await fetch("/api/" + encodeURIComponent(chave), { credentials: "same-origin" });
      if (!resp.ok) {
        console.error("BI Ergonomia - erro ao carregar " + chave + " da API:", resp.status);
        return;
      }
      const documentos = await resp.json();
      // app.js identifica cada linha pelo campo "_id" (convencao herdada do
      // modo Cowork/db, onde docParaLinha() o preenche a partir do doc.id).
      // Os documentos que voltam da API usam "id" (minusculo, nativo do
      // Cosmos DB) - sem normalizar aqui, linha._id fica undefined e os
      // botoes Editar/Excluir ficam sempre desabilitados em producao.
      estado.colecoes[chave] = documentos.map((doc) => Object.assign({ _id: doc.id }, doc));
      if (callbackAtualizacao) callbackAtualizacao(chave);
    } catch (erro) {
      console.error("BI Ergonomia - falha de rede ao carregar " + chave + ":", erro);
    }
  }

  async function corpoDeErro(resp) {
    try {
      const corpo = await resp.json();
      return corpo && corpo.erro ? corpo.erro : "Falha na API (" + resp.status + ").";
    } catch (e) {
      return "Falha na API (" + resp.status + ").";
    }
  }

  // --------------------------------------------------------------------
  // Escolha de modo
  // --------------------------------------------------------------------

  async function iniciar(aoAtualizar) {
    callbackAtualizacao = aoAtualizar;

    let db = null;
    try {
      if (global.claude && typeof global.claude.use === "function") {
        db = await global.claude.use("db");
      }
    } catch (e) {
      db = null;
    }

    if (db) {
      estado.disponivel = true;
      estado.somenteLeitura = false;
      estado.modoApi = false;
      estado.db = db;

      COLECOES.forEach((chave) => {
        const unsub = db.collection(chave).onSnapshot(
          (snap) => {
            estado.colecoes[chave] = snap.docs.map(docParaLinha);
            aoAtualizar(chave);
          },
          (erro) => {
            console.error("BI Ergonomia - erro no snapshot de " + chave + ":", erro);
          }
        );
        estado.inscricoes.push(unsub);
      });

      return true;
    }

    const deteccao = await detectarApi();
    if (deteccao.existe && deteccao.identidade && deteccao.identidade.acessoLiberado) {
      estado.disponivel = true;
      estado.somenteLeitura = false;
      estado.modoApi = true;
      estado.db = null;
      estado.identidade = deteccao.identidade;
      estado.mensagemAcesso = null;
      await Promise.all(COLECOES.map((chave) => recarregarColecaoApi(chave)));
      return true;
    }

    if (deteccao.existe && deteccao.identidade && !deteccao.identidade.acessoLiberado) {
      estado.identidade = deteccao.identidade;
      estado.mensagemAcesso = "Seu acesso ainda nao foi liberado. Peca a um Administrador para te vincular a uma empresa.";
      console.warn("BI Ergonomia - " + estado.mensagemAcesso);
    }

    // API existe mas o usuario ainda nao esta autenticado (401/redirect) -
    // manda ele para o login do Azure AD em vez de mostrar o mock estatico
    // silenciosamente. So dispara uma vez por aba (ver tentarRedirecionarParaLogin).
    if (deteccao.existe && deteccao.precisaLogin) {
      tentarRedirecionarParaLogin();
    }

    estado.disponivel = false;
    estado.somenteLeitura = true;
    estado.modoApi = false;
    estado.db = null;
    return false;
  }

  async function salvar(colecaoChave, id, dados) {
    if (estado.modoApi) {
      const rota = "/api/" + encodeURIComponent(colecaoChave) + (id ? "/" + encodeURIComponent(id) : "");
      const resp = await fetch(rota, {
        method: id ? "PUT" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? dados : Object.assign({ id }, dados)),
      });
      if (!resp.ok) throw new Error(await corpoDeErro(resp));
      const salvo = await resp.json();
      await recarregarColecaoApi(colecaoChave);
      return salvo.id;
    }

    if (!estado.db) throw new Error("Banco de dados indisponivel nesta visualizacao.");
    const colecao = estado.db.collection(colecaoChave);
    if (id) {
      await colecao.doc(id).set(dados);
      return id;
    }
    const ref = await colecao.add(dados);
    return ref.id;
  }

  async function excluir(colecaoChave, id) {
    if (estado.modoApi) {
      const resp = await fetch("/api/" + encodeURIComponent(colecaoChave) + "/" + encodeURIComponent(id), {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!resp.ok && resp.status !== 204) throw new Error(await corpoDeErro(resp));
      await recarregarColecaoApi(colecaoChave);
      return;
    }

    if (!estado.db) throw new Error("Banco de dados indisponivel nesta visualizacao.");
    await estado.db.collection(colecaoChave).doc(id).delete();
  }

  global.BI = global.BI || {};
  global.BI.DB = {
    estado,
    COLECOES,
    slugify,
    idMapaRisco,
    idCliente,
    idUnidade,
    idSetor,
    idCargo,
    idPosto,
    idAtividade,
    idCadastroMestre,
    iniciar,
    salvar,
    excluir,
  };
})(window);
