/* ==========================================================================
   S.I.G.E. - ElevaLife · V 1.37
   Exclusao COMPLETA de uma empresa-cliente (pedido do Alexandre, 09/10/2026:
   "Exclui duas empresas e os dados delas ainda estao disponiveis").

   Ate a V 1.36, DELETE /api/cliente/{id} apagava so o cadastro da empresa:
   unidades, setores, cargos, AEP, AET, Inventario de Riscos, Plano de Acao,
   laudos, colaboradores, absenteismo... continuavam no banco e apareciam nas
   telas (o Administrador ve todas as empresas). Agora:
     - excluirDadosEmpresa(empresaId) apaga, em lotes e com limite de tempo,
       todos os documentos da empresa em todas as colecoes por empresa (com as
       fotos/arquivos no Storage), os dados do modulo Riscos Psicossociais
       (particao "e_sige-<id>" e o documento raiz da empresa) e tira a empresa
       das "EmpresasVinculadas" dos usuarios;
     - empresasOrfas() lista os EmpresaId que ainda tem dados mas nao tem mais
       cadastro (empresas excluidas antes desta versao), para o Administrador
       limpar pela tela Cadastro Cliente.
   ========================================================================== */
"use strict";

const { obterContainer, garantirContainer } = require("./cosmos");
const { excluirArquivosRemovidos } = require("./blob");

const EID_SIGE = "e_sige-";
const CONTAINERS_SOB_DEMANDA = ["configuracao", "ergonomista", "colaborador"];

async function containerDe(nome) {
  return CONTAINERS_SOB_DEMANDA.includes(nome) ? garantirContainer(nome) : obterContainer(nome);
}

// Ids (e EmpresaId) de todas as empresas cadastradas.
async function empresasCadastradas() {
  const c = await containerDe("cliente");
  const { resources } = await c.items.query("SELECT c.id, c.EmpresaId FROM c").fetchAll();
  const s = new Set();
  (resources || []).forEach((x) => { if (x.id) s.add(x.id); if (x.EmpresaId) s.add(x.EmpresaId); });
  return s;
}

// Apaga em lotes os documentos da empresa em cada colecao. Devolve
// { restante, apagados, porColecao } - "restante: true" = o tempo acabou, chamar de novo.
async function excluirDadosEmpresa(empresaId, colecoes, context, limiteMs = 20000) {
  const ini = Date.now(); let apagados = 0; const porColecao = {};
  const acabouTempo = () => Date.now() - ini >= limiteMs;
  for (const nome of colecoes) {
    let c;
    try { c = await containerDe(nome); } catch (e) { continue; }
    for (;;) {
      if (acabouTempo()) return { restante: true, apagados, porColecao };
      let docs = [];
      try {
        const r = await c.items.query({ query: "SELECT * FROM c WHERE c.EmpresaId = @e", parameters: [{ name: "@e", value: empresaId }] }, { partitionKey: empresaId, maxItemCount: 100 }).fetchNext();
        docs = r.resources || [];
      } catch (e) {
        if (e && e.code === 404) break; // container ainda nao existe
        throw e;
      }
      if (!docs.length) break;
      for (const d of docs) {
        try { await c.item(d.id, empresaId).delete(); } catch (e) { if (!e || e.code !== 404) throw e; }
        await excluirArquivosRemovidos(d, null, empresaId, context);
        apagados++; porColecao[nome] = (porColecao[nome] || 0) + 1;
        if (acabouTempo()) return { restante: true, apagados, porColecao };
      }
    }
  }
  // Riscos Psicossociais: coleta, respostas, ISO 45003 e analise ficam na particao "e_sige-<id>".
  try {
    const psico = require("../functions/psicossocial");
    if (psico.excluirEmpresaLote) {
      const r = await psico.excluirEmpresaLote(EID_SIGE + empresaId, Math.max(1000, limiteMs - (Date.now() - ini)));
      apagados += r.apagados || 0; if (r.apagados) porColecao.psicossocial = (porColecao.psicossocial || 0) + r.apagados;
      if (r.restante) return { restante: true, apagados, porColecao };
      if (psico.excluirRaizEmpresa) await psico.excluirRaizEmpresa(EID_SIGE + empresaId);
    }
  } catch (e) { if (context && context.error) context.error("Falha ao excluir os dados psicossociais da empresa " + empresaId, e); }
  // Usuarios: a empresa sai das empresas vinculadas.
  try {
    const cu = await containerDe("usuarios");
    const { resources } = await cu.items.query({ query: "SELECT * FROM c WHERE ARRAY_CONTAINS(c.EmpresasVinculadas, @e)", parameters: [{ name: "@e", value: empresaId }] }).fetchAll();
    for (const u of resources || []) {
      const novo = Object.assign({}, u, { EmpresasVinculadas: (u.EmpresasVinculadas || []).filter((x) => x !== empresaId) });
      await cu.items.upsert(novo);
    }
  } catch (e) { if (context && context.error) context.error("Falha ao desvincular usuarios da empresa " + empresaId, e); }
  return { restante: false, apagados, porColecao };
}

// Empresas excluidas que ainda tem dados: [{ EmpresaId, Cliente, total, porColecao }].
async function empresasOrfas(colecoes) {
  const existentes = await empresasCadastradas();
  const mapa = new Map();
  for (const nome of colecoes) {
    let c;
    try { c = await containerDe(nome); } catch (e) { continue; }
    let docs = [];
    try { ({ resources: docs } = await c.items.query("SELECT c.EmpresaId, c.Cliente FROM c").fetchAll()); } catch (e) { continue; }
    (docs || []).forEach((d) => {
      const eid = d.EmpresaId; if (!eid || existentes.has(eid) || eid === "GLOBAL") return;
      const o = mapa.get(eid) || { EmpresaId: eid, Cliente: "", total: 0, porColecao: {} };
      if (!o.Cliente && d.Cliente) o.Cliente = d.Cliente;
      o.total++; o.porColecao[nome] = (o.porColecao[nome] || 0) + 1; mapa.set(eid, o);
    });
  }
  return Array.from(mapa.values()).sort((a, b) => String(a.Cliente).localeCompare(String(b.Cliente), "pt-BR"));
}

module.exports = { excluirDadosEmpresa, empresasOrfas, empresasCadastradas };
