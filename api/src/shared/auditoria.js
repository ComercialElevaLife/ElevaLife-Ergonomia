/* ==========================================================================
   S.I.G.E. - ElevaLife
   AUDITORIA DE REGISTROS (V 1.1): quem criou/editou cada registro, quando, e
   o que mudou campo a campo. Calculado SEMPRE no servidor (o navegador nunca
   decide usuario nem data) e gravado no proprio documento:

     _criadoEm / _criadoPor     - quando e quem criou (nunca muda)
     _editadoEm / _editadoPor   - ultima edicao real (so muda se algum campo mudou)
     _historico                 - lista (mais antiga primeiro, ate 100 itens) de
                                  { em, por, acao: "criou"|"editou",
                                    alteracoes: [{ campo, de, para }] }

   Datas em ISO UTC (a tela mostra em DD/MM/AAAA HH:MM no fuso do usuario).
   Campos que comecam com "_" (internos) e id/EmpresaId nao entram no diff.
   ========================================================================== */

"use strict";

const MAX_HISTORICO = 100;
const MAX_ALTERACOES = 60;
const MAX_TEXTO = 240;

function vazio(v) { return v === undefined || v === null || v === ""; }

// Valor "legivel" para o historico (arquivos viram nome/contagem, texto e' truncado).
function resumir(v) {
  if (vazio(v)) return "";
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === "object") return v.length + " arquivo(s)";
    return v.join(", ").slice(0, MAX_TEXTO);
  }
  if (typeof v === "object") return (v.nomeArquivo || JSON.stringify(v)).slice(0, MAX_TEXTO);
  return String(v).slice(0, MAX_TEXTO);
}

function igual(a, b) {
  if (vazio(a) && vazio(b)) return true;
  // 9 e "9" sao o mesmo valor (o formulario devolve texto): nao e alteracao.
  const simples = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);
  if (simples(a) && simples(b)) return String(a) === String(b);
  return JSON.stringify(a) === JSON.stringify(b);
}

function diferencas(antigo, novo) {
  const campos = new Set([].concat(Object.keys(antigo || {}), Object.keys(novo || {})));
  const lista = [];
  campos.forEach((c) => {
    if (c.startsWith("_") || c === "id" || c === "EmpresaId") return;
    const de = antigo ? antigo[c] : undefined;
    const para = novo ? novo[c] : undefined;
    if (!igual(de, para)) lista.push({ campo: c, de: resumir(de), para: resumir(para) });
  });
  return lista.slice(0, MAX_ALTERACOES);
}

// Devolve o documento a gravar: `novo` + metadados de auditoria. `existente`
// e' o documento que ja esta no banco (null se for criacao).
function aplicarAuditoria(existente, novo, email, agora) {
  const doc = Object.assign({}, novo);
  ["_criadoEm", "_criadoPor", "_editadoEm", "_editadoPor", "_historico"].forEach((k) => delete doc[k]);
  const por = email || "sistema";
  const quando = (agora || new Date()).toISOString();

  if (!existente) {
    doc._criadoEm = quando; doc._criadoPor = por;
    doc._editadoEm = quando; doc._editadoPor = por;
    doc._historico = [{ em: quando, por, acao: "criou", alteracoes: [] }];
    return doc;
  }

  const criadoEm = existente._criadoEm || (existente._ts ? new Date(existente._ts * 1000).toISOString() : quando);
  doc._criadoEm = criadoEm;
  doc._criadoPor = existente._criadoPor || null; // registros anteriores ao historico: autor desconhecido
  const historico = Array.isArray(existente._historico) ? existente._historico.slice() : [];
  const alteracoes = diferencas(existente, doc);
  if (!alteracoes.length) {
    doc._editadoEm = existente._editadoEm || criadoEm;
    doc._editadoPor = existente._editadoPor || doc._criadoPor;
    doc._historico = historico;
    return doc;
  }
  historico.push({ em: quando, por, acao: "editou", alteracoes });
  doc._editadoEm = quando; doc._editadoPor = por;
  doc._historico = historico.slice(-MAX_HISTORICO);
  return doc;
}

module.exports = { aplicarAuditoria, diferencas };
