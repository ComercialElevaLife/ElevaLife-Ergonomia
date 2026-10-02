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

   Lista CID continua estatica em todos os modos - e tabela de referencia,
   oculta, so para consulta. Dias Uteis (HHT) deixou de ser estatica em
   28/09/2026: virou colecao por EmpresaId como as demais (ver "diasUteis"
   acima) porque uma tabela de referencia fixa so cobria as empresas
   fictícias originais - qualquer empresa nova ficava sem Taxa de
   Frequencia (Med Ocup) ate alguem editar o JSON e commitar de novo.
   ========================================================================== */

(function (global) {
  "use strict";

  const COLECOES = [
    "mapaRisco", "planoAcao", "absenteismo", "compativeis",
    "cliente", "unidade", "setor", "cargo", "posto", "atividade",
    // Pacote "Sistema de Gestao Integrada" (ver docs/bi-ergonomia-manual.md).
    "avaliacaoErgonomica", "fatorRisco", "laudo",
    // AET (Analise Ergonomica do Trabalho) - upload de Excel/PDF com
    // classificacao automatica por conteudo (ver js/calc.js/classificarTextoAET
    // e js/app.js/camposAET).
    "aet",
    // HHT/Dias Uteis - por EmpresaId, igual as demais (ver comentario em
    // api/src/functions/entidades.js/COLECOES). Deixou de ser tabela de
    // referencia estatica em 28/09/2026.
    "diasUteis",
    // Laudos (Emissor/Editor de Texto/Certificado de Calibracao - ver
    // js/app.js/gerarLaudoPDF): "certificadoCalibracao" e "modeloLaudo" sao
    // GLOBAIS (compartilhados entre todas as empresas), gravados com
    // EmpresaId="GLOBAL" - ver api/src/functions/entidades.js/COLECOES_GLOBAIS.
    "certificadoCalibracao", "modeloLaudo",
  ];

  const estado = {
    disponivel: false,
    somenteLeitura: true,
    modoApi: false,
    db: null,
    identidade: null, // { email, papel, empresasVinculadas, acessoLiberado } quando modoApi
    mensagemAcesso: null, // preenchido quando autenticado mas sem papel liberado
    // Preenchido em iniciar() quando o app precisa mostrar a tela de acesso
    // (ver #tela-acesso em index.html/configurarTelaAcesso em app.js), em vez
    // de operar normalmente: "login" (ainda nao autenticado - precisa clicar
    // em "Entrar com Microsoft") ou "bloqueado" (autenticado mas sem papel
    // liberado em /api/usuarios ainda). null = opera normalmente.
    telaAcesso: null,
    colecoes: {
      mapaRisco: [], planoAcao: [], absenteismo: [], compativeis: [],
      cliente: [], unidade: [], setor: [], cargo: [], posto: [], atividade: [],
      avaliacaoErgonomica: [], fatorRisco: [], laudo: [], aet: [], diasUteis: [],
      certificadoCalibracao: [], modeloLaudo: [],
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

  // /api/me devolve 401 (JSON simples, nao redireciona mais - desde
  // 29/09/2026 o login e por e-mail/senha, nao Azure AD, ver
  // api/src/functions/auth.js) quando nao ha sessao valida (cookie
  // "sige_sessao" ausente/expirado/invalido) - isso e o que distingue
  // "API nao existe aqui" (Cowork/preview) de "API existe mas precisa
  // logar" (producao, usuario ainda sem sessao).
  async function detectarApi() {
    try {
      const resp = await fetch("/api/me", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (resp.status === 401) {
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

  async function corpoJsonOuErro(resp) {
    let corpo = null;
    try { corpo = await resp.json(); } catch (e) { /* resposta sem corpo (ex.: 204) */ }
    if (!resp.ok) throw new Error((corpo && corpo.erro) || `Falha na API (${resp.status}).`);
    return corpo;
  }

  async function chamarAuth(acao, dados) {
    const resp = await fetch("/api/auth/" + encodeURIComponent(acao), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados || {}),
    });
    return corpoJsonOuErro(resp);
  }

  // Login por e-mail/senha (substitui o antigo "Entrar com Microsoft" -
  // pedido do Leo, 28-29/09/2026). Devolve a identidade em caso de sucesso;
  // quem chama (configurarTelaAcesso em app.js) decide recarregar a pagina.
  async function fazerLogin(email, senha) {
    return chamarAuth("login", { Email: email, Senha: senha });
  }

  // Conclui um convite (primeiro acesso) OU uma redefinicao de senha - as
  // duas telas usam o mesmo formulario (e-mail + token vem da URL, so a
  // pessoa digita a nova senha), so muda a acao chamada.
  async function concluirPrimeiroAcesso(email, token, novaSenha) {
    return chamarAuth("primeiro-acesso", { Email: email, Token: token, NovaSenha: novaSenha });
  }
  async function concluirRedefinicaoSenha(email, token, novaSenha) {
    return chamarAuth("redefinir-senha", { Email: email, Token: token, NovaSenha: novaSenha });
  }
  async function pedirRecuperacaoSenha(email) {
    return chamarAuth("esqueci-senha", { Email: email });
  }

  // Encerra a sessao atual (usado no botao "Trocar de conta"/"Sair" da tela
  // de acesso) - limpa o cookie no servidor e recarrega a pagina, que volta
  // a detectar (sem sessao) e mostra a tela de login de novo.
  async function sairDaConta() {
    try { await chamarAuth("logout", {}); } catch (e) { /* mesmo se falhar, recarrega */ }
    global.location.href = global.location.pathname;
  }

  // Criar um usuario (POST /api/usuarios) sempre dispara um convite por
  // e-mail agora (ver api/src/functions/usuarios.js) - ao contrario de
  // salvar()/generico, aqui devolvemos a resposta INTEIRA (nao so o id),
  // porque a tela de Usuarios (app.js) precisa mostrar o link de convite e
  // um eventual aviso de falha no envio do e-mail (ver renderizarListaUsuarios/
  // abrirFormNovoUsuario em app.js).
  async function criarUsuario(dados) {
    const resp = await fetch("/api/usuarios", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    return corpoJsonOuErro(resp);
  }

  // Administrador/Consultor reenviando um convite (usuario ainda nao
  // concluiu o primeiro acesso) - ver botao "Reenviar convite" na tela de
  // Usuarios.
  async function reenviarConvite(email) {
    return chamarAuth("reenviar-convite", { Email: email });
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
      estado.telaAcesso = "bloqueado";
      console.warn("BI Ergonomia - " + estado.mensagemAcesso);
    }

    // API existe mas o usuario ainda nao esta autenticado (401/redirect) -
    // so prepara o estado; quem decide mostrar a tela de login (e so
    // redirecionar pro Azure AD quando o usuario clicar em "Entrar com
    // Microsoft") e configurarTelaAcesso() em app.js.
    if (deteccao.existe && deteccao.precisaLogin) {
      estado.telaAcesso = "login";
    }

    estado.disponivel = false;
    estado.somenteLeitura = true;
    estado.modoApi = false;
    estado.db = null;
    return false;
  }

  // A API exige "EmpresaId" em toda colecao, exceto "cliente" (a propria
  // empresa - o servidor gera o EmpresaId dela sozinho). O formulario so
  // pede o NOME do cliente (campo "Cliente", igual nas 9 outras colecoes);
  // aqui resolvemos esse nome pro id do cadastro de Cliente correspondente
  // (ja carregado em estado.colecoes.cliente), do mesmo jeito que a
  // migracao inicial dos dados fez.
  function anexarEmpresaId(colecaoChave, dados) {
    if (colecaoChave === "cliente" || dados.EmpresaId) return dados;
    const clienteDoc = (estado.colecoes.cliente || []).find((c) => c.Cliente === dados.Cliente);
    if (!clienteDoc) return dados;
    return Object.assign({}, dados, { EmpresaId: clienteDoc.id || clienteDoc._id });
  }

  async function salvar(colecaoChave, id, dados) {
    if (estado.modoApi) {
      const corpo = anexarEmpresaId(colecaoChave, dados);
      const rota = "/api/" + encodeURIComponent(colecaoChave) + (id ? "/" + encodeURIComponent(id) : "");
      const resp = await fetch(rota, {
        method: id ? "PUT" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? corpo : Object.assign({ id }, corpo)),
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

  // --------------------------------------------------------------------
  // Upload de arquivo (Fotos da Avaliacao Ergonomica, Arquivo do Laudo -
  // ver docs/bi-ergonomia-manual.md). So existe no modo 2 (API + Azure Blob
  // Storage) - nos outros modos nao ha onde guardar o arquivo de verdade,
  // entao o campo correspondente no formulario fica desabilitado (ver
  // construirCampoArquivo() em app.js).
  // --------------------------------------------------------------------

  function lerArquivoComoBase64(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new global.FileReader();
      leitor.onload = () => {
        const resultado = String(leitor.result || "");
        const virgula = resultado.indexOf(",");
        resolve(virgula >= 0 ? resultado.slice(virgula + 1) : resultado);
      };
      leitor.onerror = () => reject(leitor.error || new Error("Falha ao ler o arquivo."));
      leitor.readAsDataURL(arquivo);
    });
  }

  async function enviarArquivo(colecaoChave, empresaId, arquivo) {
    if (!estado.modoApi) {
      throw new Error("Upload de arquivo so esta disponivel na versao publicada (producao).");
    }
    if (!empresaId) {
      throw new Error("Selecione o Cliente antes de anexar um arquivo.");
    }
    const conteudoBase64 = await lerArquivoComoBase64(arquivo);
    const resp = await fetch("/api/arquivos", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        EmpresaId: empresaId,
        Colecao: colecaoChave,
        NomeArquivo: arquivo.name,
        TipoConteudo: arquivo.type,
        ConteudoBase64: conteudoBase64,
      }),
    });
    if (!resp.ok) throw new Error(await corpoDeErro(resp));
    return resp.json(); // { chave, nomeArquivo, tamanho }
  }

  // Monta a URL de leitura de um arquivo ja enviado (ver GET /api/arquivos
  // em api/src/functions/arquivos.js) - o navegador manda sozinho o cookie
  // de autenticacao do Static Web Apps num <img src>/<a href> normal, sem
  // precisar buscar o arquivo manualmente por fetch.
  function urlArquivo(chave) {
    return "/api/arquivos?chave=" + encodeURIComponent(chave);
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
    enviarArquivo,
    urlArquivo,
    fazerLogin,
    concluirPrimeiroAcesso,
    concluirRedefinicaoSenha,
    pedirRecuperacaoSenha,
    sairDaConta,
    criarUsuario,
    reenviarConvite,
  };
})(window);
