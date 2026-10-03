/* ==========================================================================
   BI Ergonomia - ElevaLife
   Job diario (timer trigger) de notificacoes do Plano de Acao. Pedido do
   Leo 02/10/2026: alem do e-mail de "acao atribuida" (disparado na hora,
   ver entidades.js), o Plano de Acao precisa de lembretes periodicos:

     1. "atribuida"  - ja tratado em entidades.js (POST de planoAcao).
     2. "antes30"    - ate 30 dias para a Dt Programada (dispara 1x, assim
                       que a acao entra nesse prazo - cobre tanto o aviso
                       no dia exato quanto o caso de a acao ja nascer com
                       menos de 30 dias de prazo).
     3. "vencimento" - no dia da Dt Programada (1x).
     4. "atraso"     - assim que passa da Dt Programada sem Dt Conclusao (1x).
     5. "atraso30"   - 30 dias de atraso (1x).
     6. "semanal"    - repete a cada 7 dias enquanto continuar atrasada,
                       comecando 7 dias depois do aviso de 30 dias de atraso.

   Os estagios 4/5/6 ("em atraso") tambem avisam os Administradores, em
   copia (pedido do Leo: "tanto para o responsavel... quanto avisando no
   sistema que aquela acao esta em atraso"). O "aviso no sistema" (sininho)
   e so leitura/calculado no front (ver js/app.js/renderizarSinoNotificacoes) -
   este job cuida so do e-mail.

   Cada Plano de Acao guarda o controle de quais estagios ja foram
   enviados no proprio campo "_notif" (nunca aparece no formulario -
   CADASTROS_CONFIG.planoAcao.campos nao lista "_notif", entao o form
   generico simplesmente ignora/preserva esse campo ao salvar).
   Acao concluida (Dt Conclusao preenchida) para de receber qualquer
   lembrete - ver filtro da query abaixo.
   ========================================================================== */

"use strict";

const { app } = require("@azure/functions");
const { obterContainer } = require("../shared/cosmos");
const { enviarEmail, modeloPlanoAcao } = require("../shared/email");

const NOME_APP = "S.I.G.E";
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function paraDataUTC(isoYYYYMMDD) {
  const s = String(isoYYYYMMDD || "").slice(0, 10);
  const partes = s.split("-").map(Number);
  if (partes.length !== 3 || partes.some((n) => Number.isNaN(n))) return null;
  return Date.UTC(partes[0], partes[1] - 1, partes[2]);
}

function diasEntre(msAntigo, msHoje) {
  return Math.round((msHoje - msAntigo) / UM_DIA_MS);
}

async function buscarAcoesAbertas(container) {
  const consulta = {
    query: `SELECT * FROM c WHERE IS_DEFINED(c["Dt Programada"]) AND c["Dt Programada"] != ""
            AND (NOT IS_DEFINED(c["Dt Conclusao"]) OR c["Dt Conclusao"] = null OR c["Dt Conclusao"] = "")`,
  };
  const { resources } = await container.items.query(consulta).fetchAll();
  return resources;
}

async function buscarEmailsAdmin() {
  const container = obterContainer("usuarios");
  const { resources } = await container.items.query("SELECT * FROM c WHERE c.Papel = 'Administrador'").fetchAll();
  return resources
    .filter((u) => (u.StatusConta || (u.SenhaHash ? "Ativo" : "Convidado")) === "Ativo")
    .map((u) => u.Email)
    .filter(Boolean);
}

async function enviarEstagio({ estagio, acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso }) {
  const envios = [];
  if (paraResponsavel) {
    envios.push(
      enviarEmail({
        para: paraResponsavel,
        assunto: `${acao.Cliente || ""} - ${estagio}`.trim(),
        htmlCorpo: modeloPlanoAcao({ nomeApp: NOME_APP, estagio, acao, paraAdmin: false }),
      })
    );
  }
  if (ehEstagioDeAtraso) {
    emailsAdmin.forEach((email) => {
      envios.push(
        enviarEmail({
          para: email,
          assunto: `[Admin] ${acao.Cliente || ""} - acao em atraso`,
          htmlCorpo: modeloPlanoAcao({ nomeApp: NOME_APP, estagio, acao, paraAdmin: true }),
        })
      );
    });
  }
  // Promise.allSettled: um e-mail que falhar (ex.: endereco invalido) nunca
  // deve impedir os outros de saírem nem travar a atualizacao do _notif.
  await Promise.allSettled(envios);
}

async function processarAcao(container, acao, hojeMs, emailsAdmin, context) {
  const dtProgramadaMs = paraDataUTC(acao["Dt Programada"]);
  if (dtProgramadaMs === null) return;

  const diffDias = diasEntre(dtProgramadaMs, hojeMs);
  const notif = Object.assign({}, acao._notif);
  const paraResponsavel = acao["E-mail Responsavel"] || null;
  const atraso30JaEnviadoAntes = !!notif.atraso30;
  let mudou = false;

  if (diffDias <= -1 && diffDias >= -30 && !notif.antes30) {
    await enviarEstagio({ estagio: "antes30", acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso: false });
    notif.antes30 = true;
    mudou = true;
  }
  if (diffDias === 0 && !notif.vencimento) {
    await enviarEstagio({ estagio: "vencimento", acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso: false });
    notif.vencimento = true;
    mudou = true;
  }
  if (diffDias >= 1 && !notif.atraso) {
    await enviarEstagio({ estagio: "atraso", acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso: true });
    notif.atraso = true;
    mudou = true;
  }
  if (diffDias >= 30 && !notif.atraso30) {
    await enviarEstagio({ estagio: "atraso30", acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso: true });
    notif.atraso30 = true;
    notif.semanalUltimoEnvio = new Date(hojeMs).toISOString().slice(0, 10);
    mudou = true;
  } else if (diffDias > 30 && atraso30JaEnviadoAntes) {
    const ultimoMs = paraDataUTC(notif.semanalUltimoEnvio) ?? dtProgramadaMs;
    if (diasEntre(ultimoMs, hojeMs) >= 7) {
      await enviarEstagio({ estagio: "semanal", acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso: true });
      notif.semanalUltimoEnvio = new Date(hojeMs).toISOString().slice(0, 10);
      mudou = true;
    }
  }

  if (mudou) {
    const doc = Object.assign({}, acao, { _notif: notif });
    try {
      await container.item(acao.id, acao.EmpresaId).replace(doc);
    } catch (erro) {
      context.error(`Falha ao gravar _notif do Plano de Acao ${acao.id}`, erro);
    }
  }
}

async function tratar(myTimer, context) {
  const container = obterContainer("planoAcao");
  const hojeMs = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());

  let acoes = [];
  let emailsAdmin = [];
  try {
    [acoes, emailsAdmin] = await Promise.all([buscarAcoesAbertas(container), buscarEmailsAdmin()]);
  } catch (erro) {
    context.error("Falha ao buscar Plano de Acao/Administradores para lembretes", erro);
    return;
  }

  context.log(`Lembretes Plano de Acao: ${acoes.length} acao(oes) em aberto, ${emailsAdmin.length} administrador(es) ativo(s).`);

  for (const acao of acoes) {
    try {
      await processarAcao(container, acao, hojeMs, emailsAdmin, context);
    } catch (erro) {
      context.error(`Falha ao processar lembretes do Plano de Acao ${acao.id}`, erro);
    }
  }
}

// Agendamento NCRONTAB (6 campos: segundo minuto hora dia mes dia-semana) -
// roda 1x por dia, 11:00 UTC = 08:00 (Brasilia, sem horario de verao desde
// 2019). Horario comercial, antes do inicio do expediente.
app.timer("lembretesPlanoAcao", {
  schedule: "0 0 11 * * *",
  handler: tratar,
});

module.exports = { tratar };
