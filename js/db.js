/* ==========================================================================
   BI Ergonomia - ElevaLife
   CAMADA DE PERSISTENCIA REAL (capacidade "db" do Artifact).
   As 4 tabelas operacionais (Mapa Risco, Plano Acao, Absenteismo,
   Compativeis) moram no banco do proprio artifact - cadastros feitos aqui
   ficam salvos de verdade, para quem abrir este link. Lista CID e Dias
   Uteis continuam estaticas (data/mock_data.json) - sao tabelas de
   referencia, ocultas, so para consulta.
   Se a capacidade "db" nao estiver disponivel nesta visualizacao (preview,
   navegador sem sessao, etc.), cai em modo somente-leitura usando o mock
   estatico como nos dados de exemplo.
   ========================================================================== */

(function (global) {
  "use strict";

  const COLECOES = ["mapaRisco", "planoAcao", "absenteismo", "compativeis"];

  const estado = {
    disponivel: false,
    somenteLeitura: true,
    db: null,
    colecoes: { mapaRisco: [], planoAcao: [], absenteismo: [], compativeis: [] },
    inscricoes: [],
  };

  function slugify(partes) {
    let s = partes.join("|").toLowerCase();
    s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s.slice(0, 180) || "registro";
  }

  function idMapaRisco(dados) {
    return slugify([dados.Cliente, dados.Unidade, dados.Setor, dados["Posto Trabalho"], dados.Cargo, dados.Atividade]);
  }

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
    iniciar,
    salvar,
    excluir,
  };
})(window);
