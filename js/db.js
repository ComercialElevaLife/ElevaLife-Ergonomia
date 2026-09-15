/* ==========================================================================
   BI Ergonomia - ElevaLife
   CAMADA DE PERSISTENCIA REAL (capacidade "db" do Artifact).
   As 4 tabelas operacionais (Mapa Risco, Plano Acao, Absenteismo,
   Compativeis) e as 6 tabelas do cadastro-mestre (Cliente, Unidade, Setor,
   Cargo, Posto Trabalho, Atividade) moram no banco do proprio artifact -
   cadastros feitos aqui ficam salvos de verdade, para quem abrir este link.
   Lista CID e Dias Uteis continuam estaticas (data/mock_data.json) - sao
   tabelas de referencia, ocultas, so para consulta.
   Se a capacidade "db" nao estiver disponivel nesta visualizacao (preview,
   navegador sem sessao, etc.), cai em modo somente-leitura usando o mock
   estatico como nos dados de exemplo.
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
    db: null,
    colecoes: {
      mapaRisco: [], planoAcao: [], absenteismo: [], compativeis: [],
      cliente: [], unidade: [], setor: [], cargo: [], posto: [], atividade: [],
    },
    inscricoes: [],
  };

  function slugify(partes) {
    let s = partes.join("|").toLowerCase();
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s.slice(0, 180) || "registro";
  }

  // Gera o id de um documento a partir da chave composta (lista de nomes de
  // campo, na ordem da hierarquia) - usado tanto pelas 4 tabelas
  // operacionais quanto pelas 6 tabelas do cadastro-mestre (Cliente >
  // Unidade > Setor > {Cargo, Posto Trabalho > Atividade}).
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

  async function iniciar(aoAtualizar) {
    let db = null;
    try {
      if (global.claude && typeof global.claude.use === "function") {
        db = await global.claude.use("db");
      }
    } catch (e) {
      db = null;
    }

    if (!db) {
      estado.disponivel = false;
      estado.somenteLeitura = true;
      estado.db = null;
      return false;
    }

    estado.disponivel = true;
    estado.somenteLeitura = false;
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

  async function salvar(colecaoChave, id, dados) {
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
