/* ==========================================================================
   BI Ergonomia - ElevaLife
   Envio de e-mail (convite de primeiro acesso / redefinicao de senha) via
   Microsoft Graph, usando a caixa compartilhada sige@elevalife.com.br
   (gratuita dentro do plano Microsoft 365 que a ElevaLife ja tem - nao
   precisa de licenca propria - ver docs/login-email-senha.md).

   Fluxo (OAuth2 "client credentials", app-only - nunca usa senha de
   ninguem): pega um token do Azure AD com o Client Id/Secret do aplicativo
   registrado, e chama /users/{caixa}/sendMail com esse token.

   Variaveis de ambiente obrigatorias (Azure Portal > Static Web App >
   Configuracao > Configuracoes do aplicativo - ver docs/login-email-senha.md
   para o passo a passo completo de onde tirar cada uma):
     GRAPH_TENANT_ID      - Id do tenant (diretorio) do Microsoft 365.
     GRAPH_CLIENT_ID      - Id do aplicativo registrado no Azure AD.
     GRAPH_CLIENT_SECRET  - segredo do aplicativo (gerado no registro).
     GRAPH_CAIXA_ENVIO    - endereco da caixa compartilhada que envia
                            (ex.: sige@elevalife.com.br).

   Se qualquer uma faltar, enviarEmail() lanca erro - quem chama (auth.js)
   trata isso como "best effort": o convite/link continua sendo devolvido
   na resposta da API mesmo se o e-mail nao sair, pra nunca travar o
   Administrador so por causa de uma configuracao de e-mail incompleta.
   ========================================================================== */

"use strict";

let tokenCache = { valor: null, expiraEm: 0 };

function variaveisObrigatorias() {
  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;
  const caixaEnvio = process.env.GRAPH_CAIXA_ENVIO;
  const faltando = [];
  if (!tenantId) faltando.push("GRAPH_TENANT_ID");
  if (!clientId) faltando.push("GRAPH_CLIENT_ID");
  if (!clientSecret) faltando.push("GRAPH_CLIENT_SECRET");
  if (!caixaEnvio) faltando.push("GRAPH_CAIXA_ENVIO");
  if (faltando.length) {
    throw new Error(`Envio de e-mail não configurado: falta(m) ${faltando.join(", ")} nas Configurações do aplicativo.`);
  }
  return { tenantId, clientId, clientSecret, caixaEnvio };
}

async function obterTokenGraph() {
  const { tenantId, clientId, clientSecret } = variaveisObrigatorias();

  if (tokenCache.valor && Date.now() < tokenCache.expiraEm - 30000) {
    return tokenCache.valor;
  }

  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const corpo = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo.toString(),
  });
  if (!resp.ok) {
    const texto = await resp.text().catch(() => "");
    throw new Error(`Falha ao autenticar no Microsoft Graph (HTTP ${resp.status}): ${texto.slice(0, 300)}`);
  }
  const dados = await resp.json();
  tokenCache = {
    valor: dados.access_token,
    expiraEm: Date.now() + (Number(dados.expires_in) || 3600) * 1000,
  };
  return tokenCache.valor;
}

// { para, assunto, htmlCorpo } -> envia via /users/{caixa}/sendMail.
// V 1.37: "anexos" opcional - [{ nome, tipo, conteudo (Buffer), cid }]; com cid o anexo vai INLINE
// (a imagem aparece no corpo do e-mail via <img src="cid:...">), como a foto da atividade da AET.
async function enviarEmail({ para, assunto, htmlCorpo, anexos }) {
  const { caixaEnvio } = variaveisObrigatorias();
  const token = await obterTokenGraph();

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(caixaEnvio)}/sendMail`;
  const payload = {
    message: {
      subject: assunto,
      body: { contentType: "HTML", content: htmlCorpo },
      toRecipients: [{ emailAddress: { address: para } }],
    },
    saveToSentItems: true,
  };
  if (Array.isArray(anexos) && anexos.length) {
    payload.message.attachments = anexos.map((a) => Object.assign({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.nome, contentType: a.tipo || "application/octet-stream",
      contentBytes: Buffer.from(a.conteudo).toString("base64"),
    }, a.cid ? { isInline: true, contentId: a.cid } : {}));
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const texto = await resp.text().catch(() => "");
    throw new Error(`Falha ao enviar e-mail via Microsoft Graph (HTTP ${resp.status}): ${texto.slice(0, 300)}`);
  }
}

// V 1.27: logotipo oficial (versão branca) no cabeçalho vinho dos e-mails. Usa a URL pública do
// SIGE (variável URL_PUBLICA); sem ela, o e-mail sai só com o texto, como antes.
function logoEmailHtml() {
  const base = (process.env.URL_PUBLICA || "").replace(/\/+$/, "");
  return base ? `<img src="${base}/img/logo-elevalife-branco.png" alt="ElevaLife" height="30" style="display:block;height:30px;width:auto;margin:0 0 10px;border:0">` : "";
}

function modeloConvite({ nomeApp, link }) {
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#2a1a1a">
      <div style="background:#5c1a2b;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
        ${logoEmailHtml()}
        <div style="font-weight:700;font-size:18px">${nomeApp}</div>
        <div style="font-size:12px;opacity:.85">ElevaLife · 15 anos elevando pessoas e resultados</div>
      </div>
      <div style="border:1px solid #e5d9d9;border-top:none;border-radius:0 0 10px 10px;padding:24px">
        <p style="font-size:14.5px;line-height:1.6">Você foi convidado(a) para acessar o ${nomeApp}, o sistema de gestão de ergonomia e absenteísmo da ElevaLife.</p>
        <p style="font-size:14.5px;line-height:1.6">Clique no botão abaixo para criar sua senha e fazer o primeiro acesso:</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${link}" style="background:#5c1a2b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14.5px;display:inline-block">Criar minha senha</a>
        </p>
        <p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Se o botão não funcionar, copie e cole este link no navegador:<br>${link}</p>
        <p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Este link expira em 7 dias. Se você não esperava este e-mail, pode ignorá-lo.</p>
      </div>
    </div>`;
}

function modeloRedefinicao({ nomeApp, link }) {
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#2a1a1a">
      <div style="background:#5c1a2b;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
        ${logoEmailHtml()}
        <div style="font-weight:700;font-size:18px">${nomeApp}</div>
        <div style="font-size:12px;opacity:.85">ElevaLife · 15 anos elevando pessoas e resultados</div>
      </div>
      <div style="border:1px solid #e5d9d9;border-top:none;border-radius:0 0 10px 10px;padding:24px">
        <p style="font-size:14.5px;line-height:1.6">Recebemos um pedido para redefinir sua senha no ${nomeApp}.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${link}" style="background:#5c1a2b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14.5px;display:inline-block">Redefinir minha senha</a>
        </p>
        <p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Se o botão não funcionar, copie e cole este link no navegador:<br>${link}</p>
        <p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Este link expira em 2 horas. Se você não pediu essa redefinição, pode ignorar este e-mail; sua senha continua a mesma.</p>
      </div>
    </div>`;
}

// --------------------------------------------------------------------------
// Notificacoes do Plano de Acao (pedido do Leo 02/10/2026): alem do convite
// de acesso, o Plano de Acao agora avisa por e-mail quem e Responsavel por
// uma acao, nos seguintes momentos (ver api/src/functions/lembretesPlanoAcao.js
// para o agendamento/disparo de cada estagio):
//   1. "atribuida"  - assim que a acao e cadastrada com um Responsavel/e-mail
//      (disparado direto em entidades.js, no POST de planoAcao).
//   2. "antes30"    - quando faltam ate 30 dias para a Dt Programada.
//   3. "vencimento" - no dia da Dt Programada.
//   4. "atraso"     - assim que passa da Dt Programada sem Dt Conclusao.
//   5. "atraso30"   - 30 dias de atraso.
//   6. "semanal"    - repete semanalmente enquanto continuar atrasada (a
//      partir do 30o dia de atraso).
// As 4 ultimas (vencimento/atraso/atraso30/semanal... na pratica so as "em
// atraso": atraso/atraso30/semanal) tambem vao, em copia, para os
// Administradores (paraAdmin=true monta um aviso ligeiramente diferente,
// deixando claro que e uma copia de gestao).
function formatarDataBR(isoOuData) {
  if (!isoOuData) return "-";
  const s = String(isoOuData).slice(0, 10);
  const [ano, mes, dia] = s.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : s;
}

const ESTAGIOS_PLANO_ACAO = {
  atribuida: {
    cor: "#5c1a2b",
    assunto: (a) => `Nova ação sob sua responsabilidade – ${a.Cliente}`,
    titulo: "Nova ação do Plano de Ação atribuída a você",
    mensagem: (a) => `Você foi definido(a) como responsável por uma nova ação no Plano de Ação de <strong>${a.Cliente}</strong>.`,
  },
  antes30: {
    cor: "#8a6d1a",
    assunto: (a) => `Lembrete: ação vence em breve – ${a.Cliente}`,
    titulo: "Uma ação sob sua responsabilidade vence em até 30 dias",
    mensagem: (a) => `A ação abaixo, do Plano de Ação de <strong>${a.Cliente}</strong>, tem prazo programado para <strong>${formatarDataBR(a["Dt Programada"])}</strong>.`,
  },
  vencimento: {
    cor: "#8a6d1a",
    assunto: (a) => `Vence hoje: ação do Plano de Ação – ${a.Cliente}`,
    titulo: "Uma ação sob sua responsabilidade vence hoje",
    mensagem: (a) => `A data programada da ação abaixo, do Plano de Ação de <strong>${a.Cliente}</strong>, é <strong>hoje (${formatarDataBR(a["Dt Programada"])})</strong>.`,
  },
  atraso: {
    cor: "#a32020",
    assunto: (a) => `Ação em atraso – ${a.Cliente}`,
    titulo: "Uma ação sob sua responsabilidade está em atraso",
    mensagem: (a) => `A ação abaixo, do Plano de Ação de <strong>${a.Cliente}</strong>, passou da data programada (${formatarDataBR(a["Dt Programada"])}) sem data de conclusão registrada.`,
  },
  atraso30: {
    cor: "#a32020",
    assunto: (a) => `Ação com 30 dias de atraso – ${a.Cliente}`,
    titulo: "Uma ação sob sua responsabilidade está há 30 dias em atraso",
    mensagem: (a) => `A ação abaixo, do Plano de Ação de <strong>${a.Cliente}</strong>, completou 30 dias de atraso (data programada: ${formatarDataBR(a["Dt Programada"])}).`,
  },
  semanal: {
    cor: "#a32020",
    assunto: (a) => `[Lembrete semanal] Ação em atraso – ${a.Cliente}`,
    titulo: "Lembrete semanal: ação continua em atraso",
    mensagem: (a) => `A ação abaixo, do Plano de Ação de <strong>${a.Cliente}</strong>, continua em atraso (data programada: ${formatarDataBR(a["Dt Programada"])}).`,
  },
  // V 1.2 - ação concluída por um Administrador SEM evidência: cobra o anexo
  // (foto ou PDF) até "Prazo Evidencia".
  evidDispensa: {
    cor: "#8a6d1a",
    assunto: (a) => `Ação concluída sem evidência – anexe até ${formatarDataBR(a["Prazo Evidencia"])} – ${a.Cliente}`,
    titulo: "Ação concluída sem evidência: falta anexar o comprovante",
    mensagem: (a) => `A ação abaixo, do Plano de Ação de <strong>${a.Cliente}</strong>, foi concluída por um Administrador sem evidência anexada. O comprovante (foto ou PDF) precisa ser anexado até <strong>${formatarDataBR(a["Prazo Evidencia"])}</strong>.`,
    extra: (a) => [["Justificativa", a["Justificativa Sem Evidencia"] || "-"], ["Prazo para anexar a evidência", formatarDataBR(a["Prazo Evidencia"])]],
  },
  evidAntes: {
    cor: "#8a6d1a",
    assunto: (a) => `Lembrete: evidência pendente vence em breve – ${a.Cliente}`,
    titulo: "A evidência de uma ação concluída vence em até 3 dias",
    mensagem: (a) => `A ação abaixo, do Plano de Ação de <strong>${a.Cliente}</strong>, está concluída sem evidência. O prazo para anexar o comprovante é <strong>${formatarDataBR(a["Prazo Evidencia"])}</strong>.`,
    extra: (a) => [["Prazo para anexar a evidência", formatarDataBR(a["Prazo Evidencia"])]],
  },
  evidVence: {
    cor: "#8a6d1a",
    assunto: (a) => `Vence hoje: anexar evidência da ação – ${a.Cliente}`,
    titulo: "Hoje é o último dia para anexar a evidência",
    mensagem: (a) => `O prazo para anexar o comprovante da ação abaixo, do Plano de Ação de <strong>${a.Cliente}</strong>, é <strong>hoje (${formatarDataBR(a["Prazo Evidencia"])})</strong>.`,
    extra: (a) => [["Prazo para anexar a evidência", formatarDataBR(a["Prazo Evidencia"])]],
  },
  evidAtraso: {
    cor: "#a32020",
    assunto: (a) => `Evidência em atraso – ${a.Cliente}`,
    titulo: "O prazo para anexar a evidência de uma ação foi ultrapassado",
    mensagem: (a) => `A ação abaixo, do Plano de Ação de <strong>${a.Cliente}</strong>, continua sem evidência e o prazo (${formatarDataBR(a["Prazo Evidencia"])}) já passou.`,
    extra: (a) => [["Prazo para anexar a evidência", formatarDataBR(a["Prazo Evidencia"])]],
  },
};

// V 1.37: fotos = [{ cid, legenda }] (anexos inline) - foto(s) da atividade nas acoes da AET.
function blocoFotosEmail(fotos, semFoto) {
  const lista = Array.isArray(fotos) ? fotos : [];
  if (!lista.length) return semFoto ? `<p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">${semFoto}</p>` : "";
  return `<p style="font-size:13.5px;font-weight:600;margin:16px 0 6px">Registro fotográfico da atividade</p>
        <div>${lista.map((f) => `<div style="margin:0 0 10px"><img src="cid:${f.cid}" alt="Foto da atividade" style="display:block;max-width:100%;width:512px;height:auto;border-radius:8px;border:1px solid #e5d9d9">${f.legenda ? `<div style="font-size:12px;color:#7a6a6a;margin-top:3px">${escHtml(f.legenda)}</div>` : ""}</div>`).join("")}</div>`;
}
const escHtml = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function modeloPlanoAcao({ nomeApp, estagio, acao, paraAdmin, fotos, semFoto }) {
  const cfg = ESTAGIOS_PLANO_ACAO[estagio];
  const linhaAdmin = paraAdmin
    ? `<p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Cópia enviada a você como Administrador do ${nomeApp}, ${estagio.indexOf("evid") === 0 ? "porque a evidência desta ação está pendente." : "porque esta ação está em atraso."}</p>`
    : "";
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2a1a1a">
      <div style="background:${cfg.cor};color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
        ${logoEmailHtml()}
        <div style="font-weight:700;font-size:18px">${nomeApp}</div>
        <div style="font-size:12px;opacity:.85">ElevaLife · 15 anos elevando pessoas e resultados</div>
      </div>
      <div style="border:1px solid #e5d9d9;border-top:none;border-radius:0 0 10px 10px;padding:24px">
        <p style="font-size:15.5px;font-weight:600;margin:0 0 8px">${cfg.titulo}</p>
        <p style="font-size:14.5px;line-height:1.6">${cfg.mensagem(acao)}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13.5px">
          <tr><td style="padding:4px 0;color:#7a6a6a">Cliente</td><td style="padding:4px 0">${acao.Cliente || "-"}</td></tr>
          <tr><td style="padding:4px 0;color:#7a6a6a">Setor / Posto</td><td style="padding:4px 0">${acao.Setor || "-"} / ${acao["Posto Trabalho"] || "-"}</td></tr>
          ${acao.Atividade ? `<tr><td style="padding:4px 0;color:#7a6a6a">Atividade</td><td style="padding:4px 0">${escHtml(acao.Atividade)}</td></tr>` : ""}
          ${acao["Fator Risco Nome"] ? `<tr><td style="padding:4px 0;color:#7a6a6a">Fator de risco</td><td style="padding:4px 0">${escHtml(acao["Fator Risco Nome"])}</td></tr>` : ""}
          <tr><td style="padding:4px 0;color:#7a6a6a">Ação recomendada</td><td style="padding:4px 0">${acao["Acao Recomendada"] || "-"}</td></tr>
          <tr><td style="padding:4px 0;color:#7a6a6a">Responsável</td><td style="padding:4px 0">${acao["Responsavel Acao"] || "-"}</td></tr>
          <tr><td style="padding:4px 0;color:#7a6a6a">Data programada</td><td style="padding:4px 0">${formatarDataBR(acao["Dt Programada"])}</td></tr>
          ${(cfg.extra ? cfg.extra(acao) : []).map(([r, v]) => `<tr><td style="padding:4px 0;color:#7a6a6a">${r}</td><td style="padding:4px 0">${v}</td></tr>`).join("")}
        </table>
        ${blocoFotosEmail(fotos, semFoto)}
        ${linhaAdmin}
        <p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Acesse o ${nomeApp} (aba Registro &gt; Plano de Ação) para ver o histórico completo e registrar a data de conclusão quando a ação for concluída.</p>
      </div>
    </div>`;
}

module.exports = {
  logoEmailHtml, enviarEmail, modeloConvite, modeloRedefinicao, modeloPlanoAcao, formatarDataBR, ESTAGIOS_PLANO_ACAO };
