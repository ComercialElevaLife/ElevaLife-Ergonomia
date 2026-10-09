/* ==========================================================================
   BI Ergonomia - ElevaLife
   Job diario de notificacoes do Plano de Acao. Pedido do
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

   COMO E DISPARADO (correcao 03/10/2026): a versao anterior usava
   app.timer(), mas as Functions GERENCIADAS do Static Web App so aceitam
   gatilho HTTP (doc. Microsoft "API support in Azure Static Web Apps with
   Azure Functions" > Constraints) - o deploy passava, mas o timer nunca
   rodava. Agora o job e uma rota HTTP, despachada por entidades.js/
   ROTAS_ESPECIAIS (mesmo mecanismo de "me"/"cnpj" - um unico app.http()):

     POST /api/jobs/lembretes-plano-acao
     cabecalho  x-job-key: <valor da Application Setting LEMBRETES_JOB_KEY>

   e quem chama 1x por dia (08:00 Brasilia) e o workflow agendado do GitHub
   Actions .github/workflows/lembretes-plano-acao.yml (segredo do repo com o
   mesmo nome, LEMBRETES_JOB_KEY). Sem a Application Setting configurada a
   rota responde 503; chave errada/ausente responde 401. Rodar 2x no mesmo
   dia nao duplica e-mail: cada estagio fica marcado em "_notif".

   MODO TESTE (03/10/2026): POST .../lembretes-plano-acao?teste=1 com corpo
   {"para": ["fulano@elevalife.com.br", ...]} (mesma chave x-job-key) envia
   os 7 modelos de e-mail (atribuida, antes30, vencimento, atraso, atraso30,
   semanal + copia de Administrador) com uma acao FICTICIA, so para esses
   enderecos - nao le nem grava nada no banco e nao toca nos responsaveis
   reais. Aceita no maximo 5 enderecos, todos @elevalife.com.br. Tambem
   envia os outros 2 e-mails automaticos do sistema (convite de primeiro
   acesso e redefinicao de senha), com link ficticio.

   MODO SIMULACAO: ?simular=1&dias=N - ver executarSimulacao().
   ========================================================================== */

"use strict";

const crypto = require("crypto");
const { obterContainer } = require("../shared/cosmos");
const { enviarEmail, modeloPlanoAcao, modeloConvite, modeloRedefinicao, ESTAGIOS_PLANO_ACAO, logoEmailHtml, formatarDataBR } = require("../shared/email");

const { fotosDaAcaoAET } = require("../shared/fotosAET");
const NOME_APP = "S.I.G.E";
const EMAIL_VALIDO_JOB = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
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
    // V 1.37: acao da AET leva a foto da atividade
    const fx = await fotosDaAcaoAET(acao, null);
    envios.push(
      enviarEmail({
        para: paraResponsavel,
        assunto: ESTAGIOS_PLANO_ACAO[estagio].assunto(acao),
        htmlCorpo: modeloPlanoAcao({ nomeApp: NOME_APP, estagio, acao, paraAdmin: false, fotos: fx ? fx.fotos : null, semFoto: fx ? fx.semFoto : "" }),
        anexos: fx ? fx.anexos : undefined,
      })
    );
  }
  if (ehEstagioDeAtraso) {
    emailsAdmin.forEach((email) => {
      envios.push(
        enviarEmail({
          para: email,
          assunto: `[Admin] ${ESTAGIOS_PLANO_ACAO[estagio].assunto(acao)}`,
          htmlCorpo: modeloPlanoAcao({ nomeApp: NOME_APP, estagio, acao, paraAdmin: true }),
        })
      );
    });
  }
  // Promise.allSettled: um e-mail que falhar (ex.: endereco invalido) nunca
  // deve impedir os outros de saírem nem travar a atualizacao do _notif.
  await Promise.allSettled(envios);
}

// opcoes.enviar: troca o envio real (usado pela simulacao, que so registra);
// opcoes.gravar=false: nao grava "_notif" no banco - o estado fica so em
// memoria, no proprio objeto "acao" (a simulacao trabalha numa copia).
async function processarAcao(container, acao, hojeMs, emailsAdmin, context, opcoes = {}) {
  const enviar = opcoes.enviar || enviarEstagio;
  const gravar = opcoes.gravar !== false;
  const dtProgramadaMs = paraDataUTC(acao["Dt Programada"]);
  if (dtProgramadaMs === null) return false;

  const diffDias = diasEntre(dtProgramadaMs, hojeMs);
  const notif = Object.assign({}, acao._notif);
  const paraResponsavel = acao["E-mail Responsavel"] || null;
  const atraso30JaEnviadoAntes = !!notif.atraso30;
  let mudou = false;

  if (diffDias <= -1 && diffDias >= -30 && !notif.antes30) {
    await enviar({ estagio: "antes30", acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso: false });
    notif.antes30 = true;
    mudou = true;
  }
  if (diffDias === 0 && !notif.vencimento) {
    await enviar({ estagio: "vencimento", acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso: false });
    notif.vencimento = true;
    mudou = true;
  }
  if (diffDias >= 1 && !notif.atraso) {
    await enviar({ estagio: "atraso", acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso: true });
    notif.atraso = true;
    mudou = true;
  }
  if (diffDias >= 30 && !notif.atraso30) {
    await enviar({ estagio: "atraso30", acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso: true });
    notif.atraso30 = true;
    notif.semanalUltimoEnvio = new Date(hojeMs).toISOString().slice(0, 10);
    mudou = true;
  } else if (diffDias > 30 && atraso30JaEnviadoAntes) {
    const ultimoMs = paraDataUTC(notif.semanalUltimoEnvio) ?? dtProgramadaMs;
    if (diasEntre(ultimoMs, hojeMs) >= 7) {
      await enviar({ estagio: "semanal", acao, paraResponsavel, emailsAdmin, ehEstagioDeAtraso: true });
      notif.semanalUltimoEnvio = new Date(hojeMs).toISOString().slice(0, 10);
      mudou = true;
    }
  }

  if (mudou && !gravar) acao._notif = notif;
  if (mudou && gravar) {
    const doc = Object.assign({}, acao, { _notif: notif });
    try {
      await container.item(acao.id, acao.EmpresaId).replace(doc);
    } catch (erro) {
      context.error(`Falha ao gravar _notif do Plano de Acao ${acao.id}`, erro);
    }
  }
  return mudou;
}

// ---- V 1.2: evidencia pendente (acao concluida por Administrador sem evidencia)
// Avisos: 3 dias antes do "Prazo Evidencia", no dia, no dia seguinte e a cada
// 7 dias enquanto continuar sem evidencia. Vao para o responsavel da acao e
// para o Administrador que concedeu a dispensa (em atraso, todos os
// Administradores em copia). Estado em "_notifEv" (nunca no formulario).
async function buscarDispensasPendentes(container) {
  const consulta = {
    query: "SELECT * FROM c WHERE IS_DEFINED(c._dispensa) AND NOT IS_DEFINED(c._dispensa.regularizadaEm)",
  };
  const { resources } = await container.items.query(consulta).fetchAll();
  return resources;
}

async function processarEvidencia(container, acao, hojeMs, emailsAdmin, context, opcoes = {}) {
  const enviar = opcoes.enviar || enviarEstagio;
  const d = acao._dispensa;
  const prazoMs = paraDataUTC(d && d.prazo);
  if (prazoMs === null) return false;
  const doc = Object.assign({}, acao, { "Prazo Evidencia": d.prazo, "Justificativa Sem Evidencia": d.justificativa });
  const diff = diasEntre(prazoMs, hojeMs);
  const notif = Object.assign({}, acao._notifEv);
  const responsavel = acao["E-mail Responsavel"] || null;
  const quemDispensou = d.por && EMAIL_VALIDO_JOB.test(d.por) ? d.por : null;
  const hojeISO = new Date(hojeMs).toISOString().slice(0, 10);
  let mudou = false;

  async function aviso(estagio, emAtraso) {
    if (opcoes.enviar) {
      await opcoes.enviar({ estagio, acao: doc, paraResponsavel: responsavel, emailsAdmin, ehEstagioDeAtraso: emAtraso });
      return;
    }
    const destinos = Array.from(new Set([responsavel, quemDispensou].filter(Boolean)));
    const envios = destinos.map((para) => enviarEmail({
      para,
      assunto: ESTAGIOS_PLANO_ACAO[estagio].assunto(doc),
      htmlCorpo: modeloPlanoAcao({ nomeApp: NOME_APP, estagio, acao: doc, paraAdmin: para === quemDispensou }),
    }));
    if (emAtraso) {
      emailsAdmin.filter((e) => !destinos.includes(e)).forEach((para) => envios.push(enviarEmail({
        para,
        assunto: `[Admin] ${ESTAGIOS_PLANO_ACAO[estagio].assunto(doc)}`,
        htmlCorpo: modeloPlanoAcao({ nomeApp: NOME_APP, estagio, acao: doc, paraAdmin: true }),
      })));
    }
    await Promise.allSettled(envios);
  }

  if (diff >= -3 && diff <= -1 && !notif.antes) { await aviso("evidAntes", false); notif.antes = true; mudou = true; }
  if (diff === 0 && !notif.vence) { await aviso("evidVence", false); notif.vence = true; mudou = true; }
  if (diff >= 1 && !notif.atraso) { await aviso("evidAtraso", true); notif.atraso = true; notif.ultimoSemanal = hojeISO; mudou = true; }
  else if (diff > 1 && notif.atraso) {
    const ultimoMs = paraDataUTC(notif.ultimoSemanal) ?? prazoMs;
    if (diasEntre(ultimoMs, hojeMs) >= 7) { await aviso("evidAtraso", true); notif.ultimoSemanal = hojeISO; mudou = true; }
  }

  if (mudou && opcoes.gravar !== false) {
    try {
      await container.item(acao.id, acao.EmpresaId).replace(Object.assign({}, acao, { _notifEv: notif }));
    } catch (erro) {
      context.error(`Falha ao gravar _notifEv do Plano de Acao ${acao.id}`, erro);
    }
  }
  return mudou;
}

async function executarLembretes(context) {
  const container = obterContainer("planoAcao");
  const hojeMs = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());

  const [acoes, emailsAdmin] = await Promise.all([buscarAcoesAbertas(container), buscarEmailsAdmin()]);
  context.log(`Lembretes Plano de Acao: ${acoes.length} acao(oes) em aberto, ${emailsAdmin.length} administrador(es) ativo(s).`);

  const resumo = { data: new Date(hojeMs).toISOString().slice(0, 10), acoesEmAberto: acoes.length, administradores: emailsAdmin.length, acoesNotificadas: 0, falhas: 0 };
  for (const acao of acoes) {
    try {
      if (await processarAcao(container, acao, hojeMs, emailsAdmin, context)) resumo.acoesNotificadas += 1;
    } catch (erro) {
      resumo.falhas += 1;
      context.error(`Falha ao processar lembretes do Plano de Acao ${acao.id}`, erro);
    }
  }
  // V 1.2: evidencias pendentes (conclusao por Administrador sem comprovante).
  resumo.evidenciasPendentes = 0;
  resumo.evidenciasNotificadas = 0;
  try {
    const pendentes = await buscarDispensasPendentes(container);
    resumo.evidenciasPendentes = pendentes.length;
    for (const acao of pendentes) {
      try {
        if (await processarEvidencia(container, acao, hojeMs, emailsAdmin, context)) resumo.evidenciasNotificadas += 1;
      } catch (erro) {
        resumo.falhas += 1;
        context.error(`Falha ao processar evidencia pendente ${acao.id}`, erro);
      }
    }
  } catch (erro) {
    context.error("Falha ao consultar evidencias pendentes", erro);
  }
  // V 1.35: certificados de calibracao - aviso aos Administradores 30 dias antes de vencer (e no vencimento).
  try {
    Object.assign(resumo, await executarCertificados(hojeMs, emailsAdmin, context));
  } catch (erro) {
    context.error("Falha ao verificar certificados de calibracao", erro);
  }
  return resumo;
}

// V 1.35: certificados de calibracao (colecao global). Cada certificado guarda em "_notifVenc" a validade
// avisada e os estagios enviados ("antes30", "vencido"); trocando a validade (certificado renovado), os avisos
// recomecam. Rodar 2x no dia nao duplica e-mail.
async function executarCertificados(hojeMs, emailsAdmin, context, opcoes = {}) {
  const container = obterContainer("certificadoCalibracao");
  const { resources } = await container.items.query("SELECT * FROM c").fetchAll();
  const out = { certificados: resources.length, certificadosAvisados: 0 };
  for (const cert of resources) {
    const venceMs = paraDataUTC(cert.Validade); if (venceMs === null) continue;
    const dias = Math.round((venceMs - hojeMs) / UM_DIA_MS);
    const notif = cert._notifVenc && cert._notifVenc.validade === cert.Validade ? Object.assign({}, cert._notifVenc) : { validade: cert.Validade };
    let estagio = null;
    if (dias <= 0 && !notif.vencido) estagio = "vencido";
    else if (dias > 0 && dias <= 30 && !notif.antes30) estagio = "antes30";
    if (!estagio) continue;
    if (emailsAdmin.length) {
      const html = modeloCertificado({ nomeApp: NOME_APP, cert, dias, estagio });
      const assunto = estagio === "vencido" ? `Certificado de calibração vencido – ${cert.Nome || "instrumento"}` : `Certificado de calibração vence em ${dias} dia(s) – ${cert.Nome || "instrumento"}`;
      const enviar = opcoes.enviar || ((para) => enviarEmail({ para, assunto, htmlCorpo: html }));
      await Promise.allSettled(emailsAdmin.map((para) => enviar(para, assunto, html)));
    }
    notif[estagio] = new Date().toISOString();
    if (estagio === "vencido") notif.antes30 = notif.antes30 || notif.vencido;
    out.certificadosAvisados += 1;
    if (opcoes.gravar === false) continue;
    try { await container.item(cert.id, cert.EmpresaId || "GLOBAL").replace(Object.assign({}, cert, { _notifVenc: notif })); }
    catch (erro) { context.error(`Falha ao gravar _notifVenc do certificado ${cert.id}`, erro); }
  }
  return out;
}

function modeloCertificado({ nomeApp, cert, dias, estagio }) {
  const vencido = estagio === "vencido";
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2a1a1a">
      <div style="background:${vencido ? "#a32020" : "#8a6d1a"};color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
        ${logoEmailHtml()}
        <div style="font-weight:700;font-size:18px">${nomeApp}</div>
        <div style="font-size:12px;opacity:.85">ElevaLife · 15 anos elevando pessoas e resultados</div>
      </div>
      <div style="border:1px solid #e5d9d9;border-top:none;border-radius:0 0 10px 10px;padding:24px">
        <p style="font-size:15.5px;font-weight:600;margin:0 0 8px">${vencido ? "Um certificado de calibração venceu" : "Um certificado de calibração está próximo de vencer"}</p>
        <p style="font-size:14.5px;line-height:1.6">${vencido ? `O certificado de calibração do instrumento <strong>${cert.Nome || "-"}</strong> venceu em ${formatarDataBR(cert.Validade)}.` : `O certificado de calibração do instrumento <strong>${cert.Nome || "-"}</strong> vence em ${formatarDataBR(cert.Validade)} (daqui a ${dias} dia(s)).`} Providencie a nova calibração e atualize o certificado no ${nomeApp} (Cadastro Interno › Certificado Calibração) para que os próximos laudos saiam com o certificado válido.</p>
        <p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Aviso enviado aos Administradores do ${nomeApp}.</p>
      </div>
    </div>`;
}

// Comparacao em tempo constante (hash dos dois lados -> mesmo tamanho).
function chaveConfere(recebida, esperada) {
  const a = crypto.createHash("sha256").update(String(recebida || "")).digest();
  const b = crypto.createHash("sha256").update(String(esperada)).digest();
  return crypto.timingSafeEqual(a, b);
}

const DOMINIO_TESTE = "@elevalife.com.br";
const ESTAGIOS_TESTE = ["atribuida", "antes30", "vencimento", "atraso", "atraso30", "semanal"];

function acaoFicticia() {
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    Cliente: "Cliente Teste (fictício)",
    Setor: "Setor Teste",
    "Posto Trabalho": "Posto Teste",
    "Acao Recomendada": "Ação fictícia para teste dos e-mails do S.I.G.E.",
    "Responsavel Acao": "Responsável Teste",
    "Dt Programada": hoje,
  };
}

async function executarTeste(destinatarios, context) {
  const acao = acaoFicticia();
  const envios = [];
  for (const para of destinatarios) {
    for (const estagio of ESTAGIOS_TESTE) {
      envios.push({ para, estagio, paraAdmin: false });
    }
    envios.push({ para, estagio: "atraso", paraAdmin: true });
  }
  // Os outros 2 e-mails automaticos do sistema (fora do Plano de Acao):
  // convite de primeiro acesso e redefinicao de senha - mesmo modelo/assunto
  // de api/src/functions/auth.js, com link ficticio (nao cria token nenhum).
  const base = (process.env.URL_PUBLICA || "").replace(/\/+$/, "") || "https://exemplo.invalid";
  const linkFicticio = `${base}/#teste-link-ficticio`;
  for (const para of destinatarios) {
    envios.push({ para, especial: "convite" });
    envios.push({ para, especial: "redefinicao" });
  }
  const resultados = [];
  for (const e of envios) {
    if (e.especial) {
      const assunto = e.especial === "convite" ? `[TESTE] Convite para o ${NOME_APP}` : `[TESTE] Redefinição de senha – ${NOME_APP}`;
      const htmlCorpo = e.especial === "convite"
        ? modeloConvite({ nomeApp: NOME_APP, link: linkFicticio })
        : modeloRedefinicao({ nomeApp: NOME_APP, link: linkFicticio });
      try {
        await enviarEmail({ para: e.para, assunto, htmlCorpo });
        resultados.push({ para: e.para, assunto, ok: true });
      } catch (erro) {
        context.error(`Falha no envio de teste para ${e.para} (${e.especial})`, erro);
        resultados.push({ para: e.para, assunto, ok: false, erro: String(erro.message || erro).slice(0, 200) });
      }
      continue;
    }
    const assuntoBase = ESTAGIOS_PLANO_ACAO[e.estagio].assunto(acao);
    const assunto = `[TESTE] ${e.paraAdmin ? "[Admin] " : ""}${assuntoBase}`;
    try {
      await enviarEmail({
        para: e.para,
        assunto,
        htmlCorpo: modeloPlanoAcao({ nomeApp: NOME_APP, estagio: e.estagio, acao, paraAdmin: e.paraAdmin }),
      });
      resultados.push({ para: e.para, assunto, ok: true });
    } catch (erro) {
      context.error(`Falha no envio de teste para ${e.para} (${e.estagio})`, erro);
      resultados.push({ para: e.para, assunto, ok: false, erro: String(erro.message || erro).slice(0, 200) });
    }
  }
  return { modo: "teste", enviados: resultados.filter((r) => r.ok).length, falhas: resultados.filter((r) => !r.ok).length, resultados };
}

async function lerDestinatariosTeste(request) {
  let corpo = {};
  try {
    corpo = await request.json();
  } catch (_) {
    corpo = {};
  }
  const lista = Array.isArray(corpo.para) ? corpo.para : [];
  const limpos = [...new Set(lista.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean))];
  if (limpos.length === 0 || limpos.length > 5) return { erro: "Informe de 1 a 5 endereços em \"para\"." };
  const invalidos = limpos.filter((x) => !/^[^@\s]+@elevalife\.com\.br$/.test(x));
  if (invalidos.length) return { erro: `Só endereços ${DOMINIO_TESTE} são aceitos no modo teste: ${invalidos.join(", ")}` };
  return { lista: limpos };
}

// SIMULACAO (03/10/2026): POST .../lembretes-plano-acao?simular=1&dias=N
// roda a mesma regra do job dia a dia, de hoje ate hoje+N (max 365), sobre
// as acoes REAIS em aberto - sem enviar nenhum e-mail e sem gravar nada
// (estado "_notif" so em memoria, numa copia). Pressupoe que nenhuma acao
// seja concluida no periodo. Devolve o calendario de quem receberia o que.
const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function executarSimulacao(dias, context) {
  const container = obterContainer("planoAcao");
  const [acoesReais, emailsAdmin] = await Promise.all([buscarAcoesAbertas(container), buscarEmailsAdmin()]);
  const acoes = acoesReais.map((a) => JSON.parse(JSON.stringify(a)));
  const hoje = new Date();
  const inicioMs = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const eventos = [];

  for (let d = 0; d <= dias; d++) {
    const diaMs = inicioMs + d * UM_DIA_MS;
    const data = new Date(diaMs).toISOString().slice(0, 10);
    for (const acao of acoes) {
      const registrar = async ({ estagio, acao: a, paraResponsavel, emailsAdmin: adms, ehEstagioDeAtraso }) => {
        eventos.push({
          data,
          estagio,
          assunto: ESTAGIOS_PLANO_ACAO[estagio].assunto(a),
          acaoId: a.id,
          cliente: a.Cliente || "",
          unidade: a.Unidade || "",
          setor: a.Setor || "",
          posto: a["Posto Trabalho"] || "",
          acaoRecomendada: a["Acao Recomendada"] || "",
          dtProgramada: String(a["Dt Programada"] || "").slice(0, 10),
          responsavel: a["Responsavel Acao"] || "",
          emailResponsavel: paraResponsavel || "",
          emailResponsavelValido: !!(paraResponsavel && EMAIL_VALIDO.test(paraResponsavel)),
          copiaAdmins: ehEstagioDeAtraso ? adms : [],
        });
      };
      await processarAcao(null, acao, diaMs, emailsAdmin, context, { enviar: registrar, gravar: false });
    }
  }

  const porEstagio = {};
  eventos.forEach((e) => { porEstagio[e.estagio] = (porEstagio[e.estagio] || 0) + 1; });
  const totalEmails = eventos.reduce((n, e) => n + (e.emailResponsavel ? 1 : 0) + e.copiaAdmins.length, 0);
  const semEmail = acoesReais.filter((a) => !a["E-mail Responsavel"]).map((a) => ({ acaoId: a.id, cliente: a.Cliente || "", responsavel: a["Responsavel Acao"] || "" }));
  return {
    modo: "simulacao",
    periodo: { de: new Date(inicioMs).toISOString().slice(0, 10), ate: new Date(inicioMs + dias * UM_DIA_MS).toISOString().slice(0, 10), dias },
    acoesEmAberto: acoesReais.length,
    administradores: emailsAdmin,
    totalNotificacoes: eventos.length,
    totalEmails,
    porEstagio,
    acoesSemEmailResponsavel: semEmail,
    eventos,
  };
}

// POST /api/jobs/lembretes-plano-acao (despachado por entidades.js).
async function tratar(request, context) {
  if (request.params.id !== "lembretes-plano-acao") {
    return { status: 404, jsonBody: { erro: "Job desconhecido." } };
  }
  if (request.method !== "POST") {
    return { status: 405, jsonBody: { erro: "Use POST." } };
  }
  const esperada = process.env.LEMBRETES_JOB_KEY;
  if (!esperada) {
    return { status: 503, jsonBody: { erro: "LEMBRETES_JOB_KEY não configurada no Static Web App." } };
  }
  if (!chaveConfere(request.headers.get("x-job-key"), esperada)) {
    return { status: 401, jsonBody: { erro: "Chave do job inválida." } };
  }
  if (request.query && request.query.get("simular") === "1") {
    const dias = Math.min(Math.max(parseInt(request.query.get("dias"), 10) || 90, 0), 365);
    try {
      return { status: 200, jsonBody: await executarSimulacao(dias, context) };
    } catch (erro) {
      context.error("Falha na simulacao de lembretes", erro);
      return { status: 500, jsonBody: { erro: "Falha na simulação." } };
    }
  }
  if (request.query && request.query.get("teste") === "1") {
    const { lista, erro } = await lerDestinatariosTeste(request);
    if (erro) return { status: 400, jsonBody: { erro } };
    const resumoTeste = await executarTeste(lista, context);
    return { status: resumoTeste.falhas ? 502 : 200, jsonBody: resumoTeste };
  }
  try {
    const resumo = await executarLembretes(context);
    return { status: 200, jsonBody: resumo };
  } catch (erro) {
    context.error("Falha ao executar lembretes do Plano de Acao", erro);
    return { status: 500, jsonBody: { erro: "Falha ao executar lembretes." } };
  }
}

module.exports = {
  processarEvidencia, tratar, executarLembretes, executarSimulacao, executarCertificados };
