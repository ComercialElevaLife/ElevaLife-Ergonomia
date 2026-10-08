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
    // V 1.2: configuracoes do sistema (so Administrador grava; GLOBAL) - hoje
    // guarda os nomes dos tipos de acao do Plano de Acao (ver js/acoes.js).
    "configuracao",
    // V 1.3: cadastro global de ergonomistas (assinatura do laudo).
    "ergonomista",
    // V 1.27: colaboradores (matricula/nome por setor ou GHE) - questionario
    // HSE-IT dos Riscos Psicossociais.
    "colaborador",
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
    // Coleta offline (passo 2 do app - ver js/offline.js e o bloco "Coleta
    // offline" abaixo). offlineAgora = o app esta rodando sem internet (com a
    // copia local dos dados); pendentes/problemas = itens na fila de envio.
    offlineAgora: false,
    sincronizando: false,
    sessaoExpirada: false,
    pendentes: 0,
    problemas: 0,
    cacheEm: null,
    colecoes: {
      mapaRisco: [], planoAcao: [], absenteismo: [], compativeis: [],
      cliente: [], unidade: [], setor: [], cargo: [], posto: [], atividade: [],
      avaliacaoErgonomica: [], fatorRisco: [], laudo: [], aet: [], diasUteis: [],
      certificadoCalibracao: [], modeloLaudo: [], configuracao: [], ergonomista: [], colaborador: [],
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

  // Hierarquia (02/10/2026, pedido do Leo): Cliente > Unidade > Setor >
  // Posto de Trabalho > Cargo > Atividade - Posto de Trabalho vem ANTES de
  // Cargo (um Cargo pertence a um Posto de Trabalho especifico, nao e mais
  // irmao dele). idCargo/idAtividade passam a incluir os ancestrais novos
  // na chave composta (evita 2 Cargos de mesmo nome em Postos diferentes do
  // mesmo Setor colidirem no mesmo id, por exemplo).
  const idCliente = (dados) => idPorCampos(dados, ["Cliente"]);
  const idUnidade = (dados) => idPorCampos(dados, ["Cliente", "Unidade"]);
  const idSetor = (dados) => idPorCampos(dados, ["Cliente", "Unidade", "Setor"]);
  const idPosto = (dados) => idPorCampos(dados, ["Cliente", "Unidade", "Setor", "Posto Trabalho"]);
  const idCargo = (dados) => idPorCampos(dados, ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo"]);
  const idAtividade = (dados) => idPorCampos(dados, ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade"]);

  // Id de cada tabela do cadastro-mestre, indexado pelo mesmo nome de
  // colecao usado em COLECOES/CADASTROS_CONFIG - evita um switch/if grande
  // em app.js sempre que uma dessas 6 tabelas precisa "renomear" um
  // registro (editar um campo-chave = excluir o id antigo, salvar no novo).
  // V 1.27: colaborador = Cliente + Matricula (a mesma matricula nunca duplica na empresa).
  const idColaborador = (dados) => idPorCampos(dados, ["Cliente", "Matricula"]);
  const idCadastroMestre = { cliente: idCliente, unidade: idUnidade, setor: idSetor, cargo: idCargo, posto: idPosto, atividade: idAtividade, colaborador: idColaborador };

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
      // Limite de 15 s: sinal ruim em campo nao pode deixar a tela de
      // carregamento girando para sempre - estourou, trata como sem conexao.
      const controle = typeof AbortController !== "undefined" ? new AbortController() : null;
      const relogio = controle ? setTimeout(() => controle.abort(), 15000) : null;
      let resp;
      try {
        resp = await fetch("/api/me", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controle ? controle.signal : undefined,
        });
      } finally {
        if (relogio) clearTimeout(relogio);
      }
      if (resp.status === 401) {
        return { existe: true, identidade: null, precisaLogin: true };
      }
      if (!resp.ok) return { existe: false, identidade: null };
      const tipo = resp.headers.get("content-type") || "";
      if (tipo.indexOf("application/json") === -1) return { existe: false, identidade: null };
      const identidade = await resp.json();
      return { existe: true, identidade };
    } catch (e) {
      // Falha de REDE (sem internet / sinal ruim em campo): no app publicado
      // isso nunca pode cair nos dados ficticios de exemplo - vira a tela
      // "Sem conexao" (ver configurarTelaAcesso em app.js). Fora da producao
      // (preview/arquivo local) continua o comportamento antigo.
      const producao = /azurestaticapps\.net$|elevalife/i.test(global.location ? global.location.hostname : "");
      const semRede = global.navigator && global.navigator.onLine === false;
      return { existe: false, identidade: null, offline: producao || semRede };
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
    if (filaCache.length && !global.confirm(
      "Há " + filaCache.length + (filaCache.length === 1 ? " item" : " itens") +
      " ainda não enviado(s) para o servidor. Eles continuam guardados neste aparelho e serão enviados quando você entrar de novo. Sair mesmo assim?"
    )) return;
    await limparCopiaLocal();
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
        // Erro HTTP (ex.: 500 numa colecao) NAO e falta de internet: so falha
        // de rede (catch abaixo) devolve false e leva o app para o modo offline.
        return null;
      }
      const documentos = await resp.json();
      // app.js identifica cada linha pelo campo "_id" (convencao herdada do
      // modo Cowork/db, onde docParaLinha() o preenche a partir do doc.id).
      // Os documentos que voltam da API usam "id" (minusculo, nativo do
      // Cosmos DB) - sem normalizar aqui, linha._id fica undefined e os
      // botoes Editar/Excluir ficam sempre desabilitados em producao.
      estado.colecoes[chave] = sobreporPendentes(chave, documentos.map((doc) => Object.assign({ _id: doc.id }, doc)));
      guardarCopiaLocal(chave, documentos);
      if (callbackAtualizacao) callbackAtualizacao(chave);
      return true;
    } catch (erro) {
      console.error("BI Ergonomia - falha de rede ao carregar " + chave + ":", erro);
      return false;
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
  // Coleta offline (passo 2 do app Android/PWA - 04/10/2026)
  //
  // Objetivo: o tecnico coleta a AEP no tablet, em campo, SEM sinal.
  //  - Copia local: toda vez que uma colecao e carregada da API, ela e
  //    guardada no aparelho (IndexedDB - ver js/offline.js). Sem internet o
  //    app abre com essa copia (inclusive o cadastro-mestre, que alimenta as
  //    listas Cliente > Unidade > Setor > ...).
  //  - Fila de envio: so a AEP (avaliacaoErgonomica + fatorRisco) grava sem
  //    internet. O registro vai para a fila (com id gerado no aparelho) e
  //    aparece na lista na hora, marcado "_pendente". Fotos anexadas offline
  //    ficam no aparelho ("local:<id>") e sobem junto.
  //  - Envio: automatico quando a internet volta (evento "online", a cada
  //    30 s, ao abrir o app, botao "Enviar agora"), sempre na ordem em que
  //    foi gravado. POST e idempotente (upsert por id) - reenviar nao duplica.
  //  - Conflito (edicao de registro que ja existia): se o registro mudou no
  //    servidor depois da copia que o aparelho tinha (_ts maior), NAO
  //    sobrescreve sozinho: fica "conflito" e quem usa decide ("Enviar minha
  //    versao" ou "Descartar"). Registro novo nunca tem conflito.
  //  - EXCLUSAO funciona offline em TODAS as telas de dados (pedido do Leo,
  //    04/10/2026): vai para a mesma fila ("excluir"), some da lista na hora e
  //    e apagada no servidor (com as fotos/arquivos dela) quando o sinal volta.
  //  - O resto (criar/editar cadastros, laudos, Plano de Acao etc.) continua
  //    exigindo internet e avisa com mensagem clara.
  // --------------------------------------------------------------------

  // V 1.2: planoAcao entra porque as acoes do risco sao criadas no Inventario
  // (e a evidencia pode ser uma foto tirada no campo, sem sinal).
  const OFFLINE_COLECOES = ["avaliacaoErgonomica", "fatorRisco", "planoAcao"];
  const MSG_PRECISA_INTERNET = "Sem conexão com a internet. Esta ação só funciona online — a Avaliação Ergonômica (AEP) e o Inventário de Riscos (com suas ações) podem ser preenchidos sem internet.";

  let filaCache = []; // espelho em memoria da fila (a verdade fica no IndexedDB)
  const ouvintesFila = [];
  const urlsLocais = new Map(); // id da foto local -> URL temporaria para exibir
  let monitorIniciado = false;
  let temporizadorSync = null;
  let sincronizandoAgora = false;

  function avisarFila() {
    ouvintesFila.forEach((fn) => { try { fn(); } catch (e) { /* ouvinte nao pode derrubar o resto */ } });
  }

  function atualizarContagens() {
    estado.pendentes = filaCache.length;
    estado.problemas = filaCache.filter((e) => e.estado === "conflito" || e.estado === "erro").length;
    avisarFila();
  }

  const offlineDisponivel = () => !!(global.BI && global.BI.Offline && global.BI.Offline.disponivel());

  function semInternetAgora() {
    return !!estado.offlineAgora || !!(global.navigator && global.navigator.onLine === false);
  }

  // fetch() so rejeita (TypeError) quando nao ha rede; erro HTTP nao conta.
  function ehErroDeRede(erro) {
    return !!erro && (erro instanceof TypeError || erro.name === "AbortError");
  }

  async function carregarFila() {
    filaCache = [];
    if (!offlineDisponivel()) return;
    try {
      filaCache = await global.BI.Offline.fila.listar();
      const arquivos = await global.BI.Offline.todos("arquivos");
      const emUso = new Set();
      filaCache.forEach((e) => coletarArquivosLocais(e.dados).forEach((i) => emUso.add(i.chave.slice(6))));
      const seteDias = 7 * 24 * 60 * 60 * 1000;
      for (const reg of arquivos || []) {
        if (!reg || !reg.id) continue;
        // Foto que foi anexada mas nunca entrou num registro salvo (usuario
        // desistiu/removeu): limpa do aparelho depois de 7 dias.
        if (!emUso.has(reg.id) && reg.criadoEm && Date.now() - reg.criadoEm > seteDias) { await apagarArquivoLocal(reg.id); continue; }
        if (reg.blob && !urlsLocais.has(reg.id)) urlsLocais.set(reg.id, URL.createObjectURL(reg.blob));
      }
      global.BI.Offline.pedirPersistencia();
    } catch (e) {
      console.warn("S.I.G.E. - armazenamento local indisponível:", e);
      filaCache = [];
    }
    atualizarContagens();
  }

  // Mostra por cima da lista da colecao os registros que ainda estao na fila.
  function sobreporPendentes(chave, lista) {
    const pend = filaCache.filter((e) => e.colecao === chave);
    if (!pend.length) return lista;
    let res = lista.slice();
    pend.forEach((e) => {
      if (e.tipo === "excluir") { res = res.filter((l) => l._id !== e.id); return; }
      const linha = Object.assign({}, e.dados, { id: e.id, _id: e.id, _pendente: true });
      const i = res.findIndex((l) => l._id === e.id);
      if (i >= 0) res[i] = Object.assign({}, res[i], linha);
      else res.push(linha);
    });
    return res;
  }

  function guardarCopiaLocal(chave, documentos) {
    if (!offlineDisponivel() || !estado.identidade || !estado.identidade.email) return;
    global.BI.Offline.gravar("cache", estado.identidade.email + "|" + chave, { ts: Date.now(), docs: documentos }).catch(() => {});
  }

  function guardarIdentidadeLocal(identidade) {
    if (!offlineDisponivel()) return;
    global.BI.Offline.gravar("meta", "identidade", identidade).catch(() => {});
  }

  async function limparCopiaLocal() {
    if (!offlineDisponivel()) return;
    try {
      await global.BI.Offline.limpar("cache");
      await global.BI.Offline.apagar("meta", "identidade");
    } catch (e) { /* tudo bem */ }
  }

  // Carrega todas as colecoes da API. Sinal que caiu NO MEIO do carregamento
  // (a internet de campo oscila) nao pode deixar listas vazias na tela: as
  // que falharam vem da copia guardada no aparelho e o app passa a "sem
  // internet" ate a proxima sincronizacao bem-sucedida.
  async function carregarTudoOuCopia() {
    const resultados = await Promise.all(COLECOES.map((chave) => recarregarColecaoApi(chave)));
    const falharam = COLECOES.filter((chave, i) => resultados[i] === false);
    if (falharam.length) {
      estado.offlineAgora = true;
      for (const chave of falharam) await reconstruirDaCopia(chave);
      avisarFila();
      agendarSincronizacao(15000);
    }
  }

  // Abre o app SEM internet usando a copia guardada da ultima vez que o
  // aparelho esteve online e logado. Devolve false se nao houver copia.
  async function abrirOfflineComCopia() {
    if (!offlineDisponivel()) return false;
    try {
      const identidade = await global.BI.Offline.ler("meta", "identidade");
      if (!identidade || !identidade.acessoLiberado || !identidade.email) return false;
      const copias = {};
      let achou = false;
      let maisAntiga = null;
      for (const chave of COLECOES) {
        const c = await global.BI.Offline.ler("cache", identidade.email + "|" + chave);
        if (c && Array.isArray(c.docs)) {
          copias[chave] = c.docs;
          achou = true;
          maisAntiga = maisAntiga === null ? c.ts : Math.min(maisAntiga, c.ts);
        }
      }
      if (!achou) return false;
      estado.disponivel = true;
      estado.somenteLeitura = false;
      estado.modoApi = true;
      estado.db = null;
      estado.identidade = identidade;
      estado.mensagemAcesso = null;
      estado.offlineAgora = true;
      estado.cacheEm = maisAntiga;
      COLECOES.forEach((chave) => {
        const docs = (copias[chave] || []).map((doc) => Object.assign({ _id: doc.id }, doc));
        estado.colecoes[chave] = sobreporPendentes(chave, docs);
        if (callbackAtualizacao) callbackAtualizacao(chave);
      });
      atualizarContagens();
      return true;
    } catch (e) {
      console.warn("S.I.G.E. - não foi possível abrir com a cópia local:", e);
      return false;
    }
  }

  // ---- fotos/arquivos guardados no aparelho ----

  function novoIdLocal() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") return global.crypto.randomUUID();
    return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  async function guardarArquivoLocal(colecaoChave, empresaId, arquivo) {
    if (!offlineDisponivel()) throw new Error(MSG_PRECISA_INTERNET);
    const idLocal = novoIdLocal();
    try {
      await global.BI.Offline.gravar("arquivos", idLocal, {
        id: idLocal, blob: arquivo, nome: arquivo.name, tipo: arquivo.type, colecao: colecaoChave, empresaId, criadoEm: Date.now(),
      });
    } catch (e) {
      throw new Error("Não foi possível guardar a foto neste aparelho (sem espaço?). Libere espaço e tente de novo.");
    }
    urlsLocais.set(idLocal, URL.createObjectURL(arquivo));
    return { chave: "local:" + idLocal, nomeArquivo: arquivo.name, tamanho: arquivo.size };
  }

  function coletarArquivosLocais(no, saida) {
    saida = saida || [];
    if (Array.isArray(no)) no.forEach((x) => coletarArquivosLocais(x, saida));
    else if (no && typeof no === "object") {
      if (typeof no.chave === "string" && no.chave.indexOf("local:") === 0) saida.push(no);
      Object.keys(no).forEach((k) => { if (k !== "chave") coletarArquivosLocais(no[k], saida); });
    }
    return saida;
  }

  async function apagarArquivoLocal(idLocal) {
    try { await global.BI.Offline.apagar("arquivos", idLocal); } catch (e) { /* ok */ }
    const url = urlsLocais.get(idLocal);
    if (url) { try { URL.revokeObjectURL(url); } catch (e) { /* ok */ } urlsLocais.delete(idLocal); }
  }

  // ---- fila ----

  async function enfileirar(colecaoChave, id, dados, forcarCriacao) {
    if (!offlineDisponivel()) throw new Error(MSG_PRECISA_INTERNET);
    const corpo = Object.assign({}, anexarEmpresaId(colecaoChave, dados));
    delete corpo._id; delete corpo._pendente;
    const criar = !!(forcarCriacao || !id);
    const idFinal = id || novoIdLocal();
    const existente = filaCache.find((e) => e.colecao === colecaoChave && e.id === idFinal);
    try {
      if (existente) {
        // Editou de novo antes de enviar: so vale a ultima versao. Foto local
        // que saiu do registro e apagada do aparelho.
        const aindaUsadas = new Set(coletarArquivosLocais(corpo).map((i) => i.chave));
        coletarArquivosLocais(existente.dados).forEach((i) => { if (!aindaUsadas.has(i.chave)) apagarArquivoLocal(i.chave.slice(6)); });
        existente.dados = corpo;
        existente.estado = "pendente";
        existente.mensagem = null;
        existente.forcar = false;
        await global.BI.Offline.fila.atualizar(existente);
      } else {
        const linha = (estado.colecoes[colecaoChave] || []).find((l) => l._id === idFinal);
        const nova = {
          colecao: colecaoChave, id: idFinal, dados: corpo, criar,
          baseTs: criar ? null : (linha && linha._ts) || null,
          estado: "pendente", tentativas: 0, criadoEm: Date.now(),
        };
        nova.seq = await global.BI.Offline.fila.adicionar(nova);
        filaCache.push(nova);
      }
    } catch (e) {
      throw new Error("Não foi possível guardar neste aparelho (sem espaço?). Libere espaço e tente de novo.");
    }
    estado.colecoes[colecaoChave] = sobreporPendentes(colecaoChave, estado.colecoes[colecaoChave] || []);
    if (callbackAtualizacao) callbackAtualizacao(colecaoChave);
    atualizarContagens();
    agendarSincronizacao(estado.offlineAgora ? 30000 : 2000);
    return idFinal;
  }

  // Exclusao offline (ou com sinal ruim): some da lista agora, apaga no
  // servidor depois. Registro criado offline e ainda nao enviado nunca
  // existiu no servidor - basta tirar da fila.
  async function enfileirarExclusao(colecaoChave, id) {
    if (!offlineDisponivel()) throw new Error(MSG_PRECISA_INTERNET);
    const linha = (estado.colecoes[colecaoChave] || []).find((l) => l._id === id) || {};
    const pendente = filaCache.find((e) => e.colecao === colecaoChave && e.id === id);
    if (pendente) {
      if (pendente.tipo === "excluir") return; // ja esta na fila para excluir
      if (pendente.criar) { await descartarEntrada(pendente); return; } // nunca chegou ao servidor
      await descartarEntrada(pendente, true); // havia uma edicao pendente: some, a exclusao vale
    }
    const resumo = {};
    ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade", "Nome", "Fator Risco", "Fator"].forEach((c) => { if (linha[c]) resumo[c] = linha[c]; });
    try {
      const nova = { colecao: colecaoChave, id, tipo: "excluir", dados: resumo, criar: false, estado: "pendente", tentativas: 0, criadoEm: Date.now() };
      nova.seq = await global.BI.Offline.fila.adicionar(nova);
      filaCache.push(nova);
    } catch (e) {
      throw new Error("Não foi possível guardar a exclusão neste aparelho (sem espaço?). Libere espaço e tente de novo.");
    }
    estado.colecoes[colecaoChave] = sobreporPendentes(colecaoChave, estado.colecoes[colecaoChave] || []);
    if (callbackAtualizacao) callbackAtualizacao(colecaoChave);
    atualizarContagens();
    agendarSincronizacao(estado.offlineAgora ? 30000 : 2000);
  }

  // Refaz a lista de uma colecao a partir da copia guardada no aparelho (usado
  // quando se descarta uma exclusao pendente estando sem internet).
  async function reconstruirDaCopia(chave) {
    try {
      const c = estado.identidade && await global.BI.Offline.ler("cache", estado.identidade.email + "|" + chave);
      if (!c || !Array.isArray(c.docs)) return;
      estado.colecoes[chave] = sobreporPendentes(chave, c.docs.map((doc) => Object.assign({ _id: doc.id }, doc)));
      if (callbackAtualizacao) callbackAtualizacao(chave);
    } catch (e) { /* mantem a lista como esta */ }
  }

  async function descartarEntrada(entrada, silencioso) {
    if (!entrada) return;
    try {
      coletarArquivosLocais(entrada.dados).forEach((item) => apagarArquivoLocal(item.chave.slice(6)));
      await global.BI.Offline.fila.remover(entrada.seq);
    } catch (e) { /* segue */ }
    filaCache = filaCache.filter((e) => e.seq !== entrada.seq);
    if (silencioso) { atualizarContagens(); return; } // quem chamou ja cuida da lista
    if (entrada.criar && entrada.tipo !== "excluir") {
      estado.colecoes[entrada.colecao] = (estado.colecoes[entrada.colecao] || []).filter((l) => !(l._pendente && l._id === entrada.id));
      if (callbackAtualizacao) callbackAtualizacao(entrada.colecao);
    } else if (!semInternetAgora()) {
      await recarregarColecaoApi(entrada.colecao);
    } else {
      await reconstruirDaCopia(entrada.colecao);
    }
    atualizarContagens();
  }

  async function reenviarEntrada(seq, forcar) {
    const entrada = filaCache.find((e) => e.seq === seq);
    if (!entrada) return;
    entrada.estado = "pendente";
    entrada.mensagem = null;
    entrada.forcar = !!forcar;
    try { await global.BI.Offline.fila.atualizar(entrada); } catch (e) { /* segue */ }
    atualizarContagens();
    await sincronizar(true);
  }

  function agendarSincronizacao(ms) {
    if (temporizadorSync) clearTimeout(temporizadorSync);
    temporizadorSync = setTimeout(() => { temporizadorSync = null; sincronizar(false); }, ms == null ? 3000 : ms);
  }

  // Envia UMA entrada da fila. Devolve "ok", "problema" (segue para a
  // proxima) ou "parar" (sem rede/sessao/servidor fora - tenta depois).
  async function enviarEntrada(entrada) {
    const O = global.BI.Offline;
    const salvarEntrada = () => O.fila.atualizar(entrada).catch(() => {});
    try {
      if (entrada.tipo === "excluir") {
        const respDel = await fetch("/api/" + encodeURIComponent(entrada.colecao) + "/" + encodeURIComponent(entrada.id), {
          method: "DELETE", credentials: "same-origin",
        });
        if (respDel.ok || respDel.status === 204 || respDel.status === 404) { // 404 = ja nao existe, objetivo cumprido
          await O.fila.remover(entrada.seq);
          filaCache = filaCache.filter((e) => e.seq !== entrada.seq);
          return "ok";
        }
        if (respDel.status === 401) { estado.sessaoExpirada = true; return "parar"; }
        if (respDel.status >= 500) { entrada.tentativas = (entrada.tentativas || 0) + 1; await salvarEntrada(); return "parar"; }
        entrada.estado = "erro";
        entrada.mensagem = await corpoDeErro(respDel);
        await salvarEntrada();
        return "problema";
      }

      // 1) Fotos feitas offline sobem primeiro e trocam "local:..." pela chave real.
      for (const item of coletarArquivosLocais(entrada.dados)) {
        const idLocal = item.chave.slice(6);
        const reg = await O.ler("arquivos", idLocal);
        if (!reg) {
          entrada.estado = "erro";
          entrada.mensagem = "uma foto guardada neste aparelho não foi encontrada. Remova a foto do registro e anexe de novo.";
          await salvarEntrada();
          return "problema";
        }
        const empresaId = entrada.dados.EmpresaId || reg.empresaId;
        const r = await enviarArquivoRede(reg.colecao, empresaId, reg.blob, reg.nome, reg.tipo);
        item.chave = r.chave;
        if (r.tamanho) item.tamanho = r.tamanho;
        await salvarEntrada(); // nao sobe a mesma foto duas vezes se cair depois
        await apagarArquivoLocal(idLocal);
      }

      // 2) Conflito: registro existente alterado no servidor depois da copia do aparelho.
      const rota = "/api/" + encodeURIComponent(entrada.colecao) + "/" + encodeURIComponent(entrada.id);
      if (!entrada.criar && !entrada.forcar && entrada.baseTs) {
        const rg = await fetch(rota, { credentials: "same-origin", headers: { Accept: "application/json" } });
        if (rg.status === 401) { estado.sessaoExpirada = true; return "parar"; }
        if (rg.status === 404) {
          entrada.estado = "conflito";
          entrada.mensagem = "este registro foi excluído no servidor enquanto você estava sem internet.";
          await salvarEntrada();
          return "problema";
        }
        if (rg.ok) {
          const servidor = await rg.json();
          if (servidor && servidor._ts && servidor._ts > entrada.baseTs) {
            entrada.estado = "conflito";
            entrada.mensagem = "este registro foi alterado por outra pessoa em " + new Date(servidor._ts * 1000).toLocaleString("pt-BR") + ", depois da cópia que este aparelho tinha.";
            await salvarEntrada();
            return "problema";
          }
        } else if (rg.status >= 500) { return "parar"; }
      }

      // 3) Envio (POST = upsert por id; PUT atualiza um id existente).
      const corpo = anexarEmpresaId(entrada.colecao, entrada.dados);
      const rotaBase = "/api/" + encodeURIComponent(entrada.colecao);
      const enviar = (metodo) => fetch(metodo === "POST" ? rotaBase : rota, {
        method: metodo,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metodo === "POST" ? Object.assign({ id: entrada.id }, corpo) : corpo),
      });
      let resp = await enviar(entrada.criar ? "POST" : "PUT");
      if (resp.status === 404 && !entrada.criar && entrada.forcar) resp = await enviar("POST");

      if (resp.ok) {
        await O.fila.remover(entrada.seq);
        filaCache = filaCache.filter((e) => e.seq !== entrada.seq);
        return "ok";
      }
      if (resp.status === 401) { estado.sessaoExpirada = true; return "parar"; }
      if (resp.status >= 500) {
        entrada.tentativas = (entrada.tentativas || 0) + 1;
        await salvarEntrada();
        return "parar";
      }
      entrada.estado = "erro";
      entrada.mensagem = await corpoDeErro(resp);
      await salvarEntrada();
      return "problema";
    } catch (erro) {
      if (ehErroDeRede(erro)) { estado.offlineAgora = true; return "parar"; }
      entrada.estado = "erro";
      entrada.mensagem = (erro && erro.message) || "falha inesperada ao enviar.";
      await salvarEntrada();
      return "problema";
    }
  }

  // Confere se a internet voltou e envia a fila; depois atualiza as telas.
  async function sincronizar(manual) {
    if (sincronizandoAgora || !estado.modoApi || !offlineDisponivel()) return;
    if (!estado.offlineAgora && !filaCache.length) return;
    sincronizandoAgora = true;
    estado.sincronizando = true;
    avisarFila();
    try {
      const det = await detectarApi();
      if (det.existe && det.precisaLogin) { estado.sessaoExpirada = true; return; }
      if (!det.existe || !det.identidade || !det.identidade.acessoLiberado) return; // ainda sem conexao
      estado.sessaoExpirada = false;
      guardarIdentidadeLocal(det.identidade);
      const estavaOffline = estado.offlineAgora;
      estado.offlineAgora = false;

      const tocadas = new Set();
      for (const entrada of filaCache.slice()) {
        if (entrada.estado === "conflito" || entrada.estado === "erro") continue;
        const r = await enviarEntrada(entrada);
        tocadas.add(entrada.colecao);
        if (r === "parar") break;
      }
      atualizarContagens();

      if (estavaOffline && !estado.offlineAgora) {
        await carregarTudoOuCopia();
        if (!estado.offlineAgora) estado.cacheEm = null;
      } else {
        await Promise.all(Array.from(tocadas).map((chave) => recarregarColecaoApi(chave)));
      }
    } catch (erro) {
      console.warn("S.I.G.E. - sincronização falhou:", erro);
    } finally {
      sincronizandoAgora = false;
      estado.sincronizando = false;
      atualizarContagens();
      if (filaCache.some((e) => e.estado === "pendente")) agendarSincronizacao(30000);
    }
  }

  function iniciarMonitorOffline() {
    if (monitorIniciado) return;
    monitorIniciado = true;
    global.addEventListener("online", () => agendarSincronizacao(1500));
    global.addEventListener("offline", () => { estado.offlineAgora = true; avisarFila(); });
    if (global.document) {
      global.document.addEventListener("visibilitychange", () => {
        if (global.document.visibilityState === "visible") agendarSincronizacao(1000);
      });
    }
    // Rede de seguranca: enquanto estiver "offline" ou com fila, tenta a cada 30 s.
    setInterval(() => {
      if (estado.offlineAgora || filaCache.some((e) => e.estado === "pendente")) sincronizar(false);
    }, 30000);
    global.BI = global.BI || {};
    if (global.BI.Offline && global.document) {
      const montar = () => global.BI.Offline.montarIndicador(global.BI.DB);
      if (global.document.body) montar(); else global.document.addEventListener("DOMContentLoaded", montar);
    }
  }

  // --------------------------------------------------------------------
  // Escolha de modo
  // --------------------------------------------------------------------

  async function iniciar(aoAtualizar) {
    callbackAtualizacao = aoAtualizar;
    await carregarFila();

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
      guardarIdentidadeLocal(deteccao.identidade);
      await carregarTudoOuCopia();
      iniciarMonitorOffline();
      if (filaCache.length) agendarSincronizacao(1500);
      return true;
    }

    if (deteccao.existe && deteccao.identidade && !deteccao.identidade.acessoLiberado) {
      estado.identidade = deteccao.identidade;
      estado.mensagemAcesso = "Seu acesso ainda não foi liberado. Peça a um Administrador para vincular você a uma empresa.";
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

    if (deteccao.offline) {
      // Sem internet: se este aparelho ja abriu o sistema antes (tem a copia
      // dos dados e a identidade guardadas), abre mesmo assim para a coleta
      // da AEP em campo. Senao, tela "Sem conexao".
      if (await abrirOfflineComCopia()) {
        iniciarMonitorOffline();
        return true;
      }
      estado.telaAcesso = "offline";
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

  // "forcarCriacao": usado pelas 6 tabelas do cadastro-mestre + mapaRisco
  // (ver js/app.js/idCadastroMestre/idMapaRisco) - elas calculam o id do
  // documento no cliente (chave composta) ANTES de chamar salvar(), mesmo
  // quando o registro e novo. Sem esse parametro, "id" vinha sempre
  // preenchido e a chamada virava PUT mesmo criando um registro do zero -
  // e o PUT da API (api/src/functions/entidades.js) so atualiza um id que
  // ja existe, devolvendo 404 "Nao encontrado" caso contrario (bug
  // reportado pelo Leo 02/10/2026 ao cadastrar uma empresa-cliente nova).
  // "forcarCriacao=true" manda criar (POST) mesmo com um id definido,
  // incluindo esse id no corpo - o servidor usa o id enviado em vez de
  // gerar um aleatorio (ver POST em entidades.js: "corpo.id || crypto.randomUUID()").
  async function salvar(colecaoChave, id, dados, forcarCriacao) {
    // V 1.29: _origem e marcacao so de tela (filtro Origem) - nunca vai para o banco.
    if (dados && typeof dados === "object" && "_origem" in dados) { dados = Object.assign({}, dados); delete dados._origem; }
    if (estado.modoApi) {
      const corpo = anexarEmpresaId(colecaoChave, dados);
      const criar = forcarCriacao || !id;
      const capaz = OFFLINE_COLECOES.indexOf(colecaoChave) !== -1;
      // AEP (avaliacao + inventario de riscos) grava no aparelho quando nao
      // ha internet e envia depois (fila - ver bloco "Coleta offline").
      if (capaz && semInternetAgora()) return enfileirar(colecaoChave, id, dados, forcarCriacao);
      if (!capaz && semInternetAgora()) throw new Error(MSG_PRECISA_INTERNET);
      const rota = "/api/" + encodeURIComponent(colecaoChave) + (criar ? "" : "/" + encodeURIComponent(id));
      let resp;
      try {
        resp = await fetch(rota, {
          method: criar ? "POST" : "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(criar ? Object.assign({ id }, corpo) : corpo),
        });
      } catch (erroRede) {
        if (!ehErroDeRede(erroRede)) throw erroRede;
        estado.offlineAgora = true;
        avisarFila();
        if (capaz) return enfileirar(colecaoChave, id, dados, forcarCriacao);
        throw new Error(MSG_PRECISA_INTERNET);
      }
      if (resp.status === 401 && capaz) {
        estado.sessaoExpirada = true;
        return enfileirar(colecaoChave, id, dados, forcarCriacao);
      }
      if (!resp.ok) throw new Error(await corpoDeErro(resp));
      const salvo = await resp.json();
      await recarregarColecaoApi(colecaoChave);
      return salvo.id;
    }

    if (!estado.db) throw new Error("Banco de dados indisponível nesta visualização.");
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

  async function enviarArquivoRede(colecaoChave, empresaId, arquivo, nome, tipo) {
    const conteudoBase64 = await lerArquivoComoBase64(arquivo);
    const resp = await fetch("/api/arquivos", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        EmpresaId: empresaId,
        Colecao: colecaoChave,
        NomeArquivo: nome || arquivo.name,
        TipoConteudo: tipo || arquivo.type,
        ConteudoBase64: conteudoBase64,
      }),
    });
    if (resp.status === 401) { estado.sessaoExpirada = true; }
    if (!resp.ok) throw new Error(await corpoDeErro(resp));
    return resp.json(); // { chave, nomeArquivo, tamanho }
  }

  async function enviarArquivo(colecaoChave, empresaId, arquivo) {
    if (!estado.modoApi) {
      throw new Error("Upload de arquivo só está disponível na versão publicada (produção).");
    }
    if (!empresaId) {
      throw new Error("Selecione o Cliente antes de anexar um arquivo.");
    }
    const capaz = OFFLINE_COLECOES.indexOf(colecaoChave) !== -1;
    // Foto da AEP sem internet: fica guardada no aparelho (chave "local:...")
    // e sobe sozinha junto com o registro quando o sinal voltar.
    if (capaz && semInternetAgora()) return guardarArquivoLocal(colecaoChave, empresaId, arquivo);
    if (!capaz && semInternetAgora()) throw new Error(MSG_PRECISA_INTERNET);
    try {
      return await enviarArquivoRede(colecaoChave, empresaId, arquivo);
    } catch (erro) {
      if (!ehErroDeRede(erro)) throw erro;
      estado.offlineAgora = true;
      avisarFila();
      if (capaz) return guardarArquivoLocal(colecaoChave, empresaId, arquivo);
      throw new Error(MSG_PRECISA_INTERNET);
    }
  }

  // Monta a URL de leitura de um arquivo ja enviado (ver GET /api/arquivos
  // em api/src/functions/arquivos.js) - o navegador manda sozinho o cookie
  // de autenticacao do Static Web Apps num <img src>/<a href> normal, sem
  // precisar buscar o arquivo manualmente por fetch.
  function urlArquivo(chave) {
    if (String(chave).indexOf("local:") === 0) return urlsLocais.get(String(chave).slice(6)) || "";
    return "/api/arquivos?chave=" + encodeURIComponent(chave);
  }

  async function excluir(colecaoChave, id) {
    if (estado.modoApi) {
      // Registro criado offline e ainda nao enviado: basta tirar da fila.
      const pendente = filaCache.find((e) => e.colecao === colecaoChave && e.id === id);
      if (pendente && pendente.criar) { await descartarEntrada(pendente); return; }
      const podeFila = colecaoChave !== "usuarios";
      // Sem internet: a exclusao entra na fila e some da lista na hora.
      if (podeFila && semInternetAgora()) { await enfileirarExclusao(colecaoChave, id); return; }
      if (!podeFila && semInternetAgora()) throw new Error(MSG_PRECISA_INTERNET);
      let resp;
      try {
        resp = await fetch("/api/" + encodeURIComponent(colecaoChave) + "/" + encodeURIComponent(id), {
          method: "DELETE",
          credentials: "same-origin",
        });
      } catch (erroRede) {
        if (!ehErroDeRede(erroRede)) throw erroRede;
        estado.offlineAgora = true;
        avisarFila();
        if (podeFila) { await enfileirarExclusao(colecaoChave, id); return; }
        throw new Error(MSG_PRECISA_INTERNET);
      }
      if (resp.status === 401 && podeFila) { estado.sessaoExpirada = true; await enfileirarExclusao(colecaoChave, id); return; }
      if (!resp.ok && resp.status !== 204) throw new Error(await corpoDeErro(resp));
      await recarregarColecaoApi(colecaoChave);
      return;
    }

    if (!estado.db) throw new Error("Banco de dados indisponível nesta visualização.");
    await estado.db.collection(colecaoChave).doc(id).delete();
  }

  // Exclusao em lote (checkboxes + "Excluir selecionados" - pedido do Leo
  // 02/10/2026: "estou levando muito tempo para excluir informacoes do
  // sistema"). Dispara todos os DELETE em paralelo e so recarrega a colecao
  // UMA vez no final (excluir() sozinho recarregaria uma vez POR item, o
  // que ficaria lento justamente pra quem esta excluindo varios registros).
  async function excluirEmLote(colecaoChave, ids) {
    if (!ids || !ids.length) return { total: 0, falhas: 0 };

    if (estado.modoApi) {
      if (colecaoChave !== "usuarios" && semInternetAgora()) {
        for (const id of ids) await excluir(colecaoChave, id);
        return { total: ids.length, falhas: 0 };
      }
      if (semInternetAgora()) throw new Error(MSG_PRECISA_INTERNET);
      const resultados = await Promise.allSettled(ids.map((id) =>
        fetch("/api/" + encodeURIComponent(colecaoChave) + "/" + encodeURIComponent(id), {
          method: "DELETE",
          credentials: "same-origin",
        }).then(async (resp) => {
          if (!resp.ok && resp.status !== 204) throw new Error(await corpoDeErro(resp));
        })
      ));
      await recarregarColecaoApi(colecaoChave);
      return { total: ids.length, falhas: resultados.filter((r) => r.status === "rejected").length };
    }

    if (!estado.db) throw new Error("Banco de dados indisponível nesta visualização.");
    const colecao = estado.db.collection(colecaoChave);
    const resultados = await Promise.allSettled(ids.map((id) => colecao.doc(id).delete()));
    return { total: ids.length, falhas: resultados.filter((r) => r.status === "rejected").length };
  }

  // V 1.6 - gravacao em lote (importacao de planilhas Excel - ver
  // js/importador.js). Cada item: { id, dados, criar } - criar=true faz POST
  // (com o id, quando houver), criar=false faz PUT no id existente. Usa as
  // MESMAS rotas e regras de empresa/permissao de salvar(); roda poucas
  // requisicoes em paralelo e recarrega a colecao UMA vez no final (salvar()
  // sozinho recarregaria uma vez por item). Falha de um item nao interrompe
  // os demais: devolve { falhas: [{ indice, erro }] }.
  async function salvarEmLote(colecaoChave, itens, aoProgredir) {
    const falhas = [];
    let feitos = 0;
    const avancar = () => { feitos++; if (aoProgredir) aoProgredir(feitos); };

    if (estado.modoApi) {
      if (semInternetAgora()) throw new Error(MSG_PRECISA_INTERNET);
      const pendentes = itens.map((item, indice) => ({ item, indice }));
      async function trabalhador() {
        while (pendentes.length) {
          const { item, indice } = pendentes.shift();
          try {
            const dadosItem = Object.assign({}, item.dados); delete dadosItem._origem;
          const corpo = anexarEmpresaId(colecaoChave, dadosItem);
            const rota = "/api/" + encodeURIComponent(colecaoChave) + (item.criar ? "" : "/" + encodeURIComponent(item.id));
            const resp = await fetch(rota, {
              method: item.criar ? "POST" : "PUT",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item.criar && item.id ? Object.assign({ id: item.id }, corpo) : corpo),
            });
            if (!resp.ok) throw new Error(await corpoDeErro(resp));
          } catch (erro) {
            falhas.push({ indice, erro: erro && erro.message ? erro.message : String(erro) });
          }
          avancar();
        }
      }
      await Promise.all([trabalhador(), trabalhador(), trabalhador(), trabalhador()]);
      await recarregarColecaoApi(colecaoChave);
      falhas.sort((a, b) => a.indice - b.indice);
      return { falhas };
    }

    if (!estado.db) throw new Error("Banco de dados indisponível nesta visualização.");
    const colecao = estado.db.collection(colecaoChave);
    for (let indice = 0; indice < itens.length; indice++) {
      const item = itens[indice];
      try {
        if (item.id) await colecao.doc(item.id).set(item.dados);
        else await colecao.add(item.dados);
      } catch (erro) {
        falhas.push({ indice, erro: erro && erro.message ? erro.message : String(erro) });
      }
      avancar();
    }
    return { falhas };
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
    salvarEmLote,
    excluir,
    excluirEmLote,
    enviarArquivo,
    urlArquivo,
    fazerLogin,
    concluirPrimeiroAcesso,
    concluirRedefinicaoSenha,
    pedirRecuperacaoSenha,
    sairDaConta,
    criarUsuario,
    reenviarConvite,
    // V 1.27: recarrega colecoes da API (ex.: o modulo Riscos Psicossociais
    // atualizou Mapa de Risco, Inventario e Plano de Acao).
    recarregar: (chaves) => (estado.modoApi ? Promise.all((chaves || []).map((c) => recarregarColecaoApi(c))) : Promise.resolve([])),
    fila: {
      listar: () => (global.BI.Offline ? global.BI.Offline.fila.listar() : Promise.resolve([])),
      descartar: (seq) => descartarEntrada(filaCache.find((e) => e.seq === seq)),
      reenviar: reenviarEntrada,
      sincronizar,
      aoMudar: (fn) => { ouvintesFila.push(fn); },
    },
    montarIndicadorOffline: () => { if (global.BI.Offline) global.BI.Offline.montarIndicador(global.BI.DB); },
  };
})(window);
