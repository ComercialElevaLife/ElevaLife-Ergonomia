/* ==========================================================================
   S.I.G.E. - ElevaLife
   REGRAS DO PLANO DE ACAO (V 1.2) - tudo calculado no SERVIDOR (o navegador
   so mostra a regra, nunca e quem a garante):

   1. Status da acao: "Nao iniciada" | "Em andamento" | "Concluida".
      Concluida <=> "Dt Conclusao" preenchida (os dois andam juntos; o
      servidor completa o que faltar).
   2. EVIDENCIA OBRIGATORIA para concluir: ao passar para Concluida a acao
      precisa de pelo menos 1 arquivo (foto ou PDF) em "Evidencias".
   3. EXCECAO DO ADMINISTRADOR: so o papel Administrador pode concluir sem
      evidencia - informando "Justificativa Sem Evidencia" (minimo 10
      caracteres) e "Prazo Evidencia" (data futura, ate 180 dias). O servidor
      grava a dispensa em "_dispensa" (quem, quando, justificativa, prazo) e
      os lembretes passam a cobrar a evidencia ate o prazo (ver
      functions/lembretesPlanoAcao.js).
   4. Nao se tira a ultima evidencia de uma acao concluida (so reabrindo, ou
      pela excecao do Administrador).
   5. Acoes ja concluidas ANTES da V 1.2 (sem evidencia) continuam editaveis
      normalmente - a regra vale para quem passa a concluida agora.
   ========================================================================== */

"use strict";

const PAPEL_ADMIN = "Administrador";
const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const MIN_JUSTIFICATIVA = 10;
const MAX_DIAS_PRAZO_EVIDENCIA = 180;
const STATUS = { NAO_INICIADA: "Nao iniciada", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluida" };

function preenchido(v) { return v !== undefined && v !== null && String(v).trim() !== ""; }

function dataValida(s) {
  if (!ISO_DATA.test(String(s || ""))) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Data de hoje no fuso de Brasilia (UTC-3), em AAAA-MM-DD.
function hojeBR(agora) {
  const d = new Date((agora || new Date()).getTime() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function somaDias(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function estaConcluida(doc) {
  return !!doc && (preenchido(doc["Dt Conclusao"]) || doc["Status Execucao"] === STATUS.CONCLUIDA);
}

// So conta arquivo no formato "<EmpresaId>/planoAcao/<uuid>-<nome>" da
// propria empresa do registro (ou arquivo local ainda nao enviado nao chega
// aqui: a fila envia os arquivos antes do registro).
function evidenciasValidas(doc) {
  if (!doc || !Array.isArray(doc.Evidencias)) return [];
  return doc.Evidencias.filter((e) => {
    if (!e || typeof e.chave !== "string") return false;
    const p = e.chave.split("/");
    return p.length >= 3 && p[1] === "planoAcao" && (!doc.EmpresaId || p[0] === doc.EmpresaId);
  });
}

function temEvidencia(doc) { return evidenciasValidas(doc).length > 0; }

// Avalia e normaliza o documento do Plano de Acao ANTES de gravar.
//   existente : documento atual no banco (null se for criacao)
//   novo      : documento ja mesclado (existente + corpo) que sera gravado
// Devolve { ok:true, doc } ou { ok:false, status, codigo, erro }.
function avaliarPlanoAcao({ existente, novo, papel, email, agora }) {
  const quando = (agora || new Date()).toISOString();
  const hoje = hojeBR(agora);
  const doc = Object.assign({}, novo);
  delete doc._dispensa; // so o servidor escreve isto

  // 1) Status e data de conclusao andam juntos.
  if (preenchido(doc["Dt Conclusao"])) {
    doc["Status Execucao"] = STATUS.CONCLUIDA;
  } else if (doc["Status Execucao"] === STATUS.CONCLUIDA) {
    doc["Dt Conclusao"] = hoje;
  } else if (!doc["Status Execucao"]) {
    doc["Status Execucao"] = STATUS.NAO_INICIADA;
  }
  if (!estaConcluida(doc)) {
    // Acao reaberta: a dispensa deixa de valer (o historico fica em _historico).
    return { ok: true, doc: limparDispensaSeReaberta(doc, existente) };
  }

  const eraConcluida = estaConcluida(existente);
  const tinhaEvidencia = temEvidencia(existente);
  const temAgora = temEvidencia(doc);
  const virouConcluida = !eraConcluida;
  const perdeuEvidencia = eraConcluida && tinhaEvidencia && !temAgora;

  if (temAgora) {
    // Evidencia anexada: se havia dispensa pendente, registra a regularizacao.
    if (existente && existente._dispensa) {
      doc._dispensa = Object.assign({}, existente._dispensa);
      if (!doc._dispensa.regularizadaEm) {
        doc._dispensa.regularizadaEm = quando;
        doc._dispensa.regularizadaPor = email || "sistema";
      }
    }
    return { ok: true, doc };
  }

  // Sem evidencia. Acao concluida antes da V 1.2 (legado) segue como esta.
  const legado = eraConcluida && !tinhaEvidencia && !(existente && existente._dispensa) && !virouConcluida;
  if (legado) return { ok: true, doc };

  // Dispensa ja concedida e ainda vigente: mantem, a menos que o Administrador mude.
  if (!virouConcluida && !perdeuEvidencia && existente && existente._dispensa && !existente._dispensa.regularizadaEm) {
    const mudouPrazo = doc["Prazo Evidencia"] !== existente._dispensa.prazo;
    const mudouJust = String(doc["Justificativa Sem Evidencia"] || "").trim() !== existente._dispensa.justificativa;
    if (!mudouPrazo && !mudouJust) {
      doc._dispensa = existente._dispensa;
      return { ok: true, doc };
    }
  }

  if (papel !== PAPEL_ADMIN) {
    return {
      ok: false, status: 422, codigo: "EVIDENCIA_OBRIGATORIA",
      erro: "Para concluir a ação é obrigatório anexar a evidência (foto ou PDF). Apenas um Administrador pode concluir sem evidência, informando justificativa e prazo.",
    };
  }
  const justificativa = String(doc["Justificativa Sem Evidencia"] || "").trim();
  const prazo = doc["Prazo Evidencia"];
  if (justificativa.length < MIN_JUSTIFICATIVA) {
    return {
      ok: false, status: 422, codigo: "JUSTIFICATIVA_OBRIGATORIA",
      erro: `Para concluir sem evidência, informe a justificativa (mínimo de ${MIN_JUSTIFICATIVA} caracteres).`,
    };
  }
  if (!dataValida(prazo) || prazo < hoje || prazo > somaDias(hoje, MAX_DIAS_PRAZO_EVIDENCIA)) {
    return {
      ok: false, status: 422, codigo: "PRAZO_EVIDENCIA_INVALIDO",
      erro: `Para concluir sem evidência, informe a data-limite para anexá-la (de hoje até ${MAX_DIAS_PRAZO_EVIDENCIA} dias).`,
    };
  }
  doc["Justificativa Sem Evidencia"] = justificativa;
  doc._dispensa = { por: email || "sistema", em: quando, justificativa, prazo };
  doc._notifEv = {}; // nova dispensa -> recomeca os lembretes
  return { ok: true, doc };
}

function limparDispensaSeReaberta(doc, existente) {
  if (existente && existente._dispensa) doc._dispensaAnterior = existente._dispensa;
  delete doc._notifEv;
  return doc;
}

// Deve avisar o responsavel de que a acao foi atribuida a ele?
// (criacao, ou troca do e-mail do responsavel - nunca a cada gravacao)
function precisaNotificarAtribuicao(existente, doc) {
  const email = String((doc && doc["E-mail Responsavel"]) || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return false;
  if (estaConcluida(doc)) return false;
  if (!existente) return true;
  return String(existente["E-mail Responsavel"] || "").trim().toLowerCase() !== email;
}

module.exports = {
  STATUS, PAPEL_ADMIN, MIN_JUSTIFICATIVA, MAX_DIAS_PRAZO_EVIDENCIA,
  avaliarPlanoAcao, precisaNotificarAtribuicao, estaConcluida, temEvidencia, evidenciasValidas, hojeBR, somaDias, dataValida,
};
