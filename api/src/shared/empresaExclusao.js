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
// V 1.41: empresas ATIVAS (não na lixeira). Usado para esconder os dados das
// empresas na lixeira (semEmpresaExcluida) - a empresa continua cadastrada, mas
// os dados dela somem das telas até ser restaurada ou expurgada.
async function empresasCadastradas() {
  const c = await containerDe("cliente");
  const { resources } = await c.items.query("SELECT c.id, c.EmpresaId, c.Excluida FROM c").fetchAll();
  const s = new Set();
  (resources || []).forEach((x) => { if (x.Excluida) return; if (x.id) s.add(x.id); if (x.EmpresaId) s.add(x.EmpresaId); });
  return s;
}

// Todos os ids com cadastro de cliente (inclusive os da lixeira) - para o
// levantamento de órfãos não confundir empresa na lixeira com dado sem dono.
async function empresasComCadastro() {
  const c = await containerDe("cliente");
  const { resources } = await c.items.query("SELECT c.id, c.EmpresaId FROM c").fetchAll();
  const s = new Set();
  (resources || []).forEach((x) => { if (x.id) s.add(x.id); if (x.EmpresaId) s.add(x.EmpresaId); });
  return s;
}

// Empresas na lixeira (excluídas, restauráveis) - docs completos do cliente.
async function empresasNaLixeira() {
  const c = await containerDe("cliente");
  const { resources } = await c.items.query("SELECT * FROM c WHERE c.Excluida = true").fetchAll();
  return (resources || []).sort((a, b) => String(b.ExcluidaEm || "").localeCompare(String(a.ExcluidaEm || "")));
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
  const existentes = await empresasComCadastro();
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

// V 1.41: expurgo automático da lixeira - apaga de vez as empresas excluídas há
// mais de `diasLimite` dias (padrão 30). Rodado pelo job diário. Respeita um
// limite de tempo; o que faltar fica para o próximo dia (nada é perdido).
const COLECOES_EMPRESA_PADRAO = ["mapaRisco", "planoAcao", "absenteismo", "compativeis", "unidade", "setor", "cargo", "posto", "atividade", "avaliacaoErgonomica", "fatorRisco", "laudo", "aet", "diasUteis", "colaborador", "tempoTrabalho"];
async function expurgarLixeiraVencida(diasLimite, colecoes, context, limiteMs = 30000) {
  colecoes = colecoes && colecoes.length ? colecoes : COLECOES_EMPRESA_PADRAO;
  const limite = Date.now() - (diasLimite || 30) * 86400000;
  const naLixeira = await empresasNaLixeira();
  const vencidas = naLixeira.filter((c) => c.ExcluidaEm && new Date(c.ExcluidaEm).getTime() <= limite);
  let apagadas = 0; const ini = Date.now();
  for (const emp of vencidas) {
    if (Date.now() - ini >= limiteMs) break;
    const ids = Array.from(new Set([emp.EmpresaId, emp.id].filter(Boolean)));
    let restante = false;
    for (const eid of ids) {
      const r = await excluirDadosEmpresa(eid, colecoes, context, Math.max(5000, limiteMs - (Date.now() - ini)));
      if (r.restante) { restante = true; break; }
    }
    if (restante) break; // continua no próximo dia
    try { const c = await containerDe("cliente"); await c.item(emp.id, emp.EmpresaId || emp.id).delete(); apagadas++; }
    catch (e) { if (context && context.error) context.error("Expurgo: falha ao apagar o cadastro de " + emp.id, e); }
  }
  return { apagadas, vencidas: vencidas.length };
}

module.exports = { excluirDadosEmpresa, empresasOrfas, empresasCadastradas, empresasComCadastro, empresasNaLixeira, expurgarLixeiraVencida };
