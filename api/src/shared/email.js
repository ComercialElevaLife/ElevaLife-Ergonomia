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
    throw new Error(`Envio de e-mail nao configurado - falta(m) ${faltando.join(", ")} nas Configuracoes do aplicativo.`);
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
async function enviarEmail({ para, assunto, htmlCorpo }) {
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

function modeloConvite({ nomeApp, link }) {
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#2a1a1a">
      <div style="background:#5c1a2b;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
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
        <div style="font-weight:700;font-size:18px">${nomeApp}</div>
        <div style="font-size:12px;opacity:.85">ElevaLife · 15 anos elevando pessoas e resultados</div>
      </div>
      <div style="border:1px solid #e5d9d9;border-top:none;border-radius:0 0 10px 10px;padding:24px">
        <p style="font-size:14.5px;line-height:1.6">Recebemos um pedido para redefinir sua senha no ${nomeApp}.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${link}" style="background:#5c1a2b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14.5px;display:inline-block">Redefinir minha senha</a>
        </p>
        <p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Se o botão não funcionar, copie e cole este link no navegador:<br>${link}</p>
        <p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Este link expira em 2 horas. Se você não pediu essa redefinição, pode ignorar este e-mail - sua senha continua a mesma.</p>
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
    assunto: (a) => `Nova acao sob sua responsabilidade - ${a.Cliente}`,
    titulo: "Nova acao do Plano de Acao atribuida a voce",
    mensagem: (a) => `Voce foi definido(a) como responsavel por uma nova acao no Plano de Acao de <strong>${a.Cliente}</strong>.`,
  },
  antes30: {
    cor: "#8a6d1a",
    assunto: (a) => `Lembrete: acao vence em breve - ${a.Cliente}`,
    titulo: "Uma acao sob sua responsabilidade vence em ate 30 dias",
    mensagem: (a) => `A acao abaixo, do Plano de Acao de <strong>${a.Cliente}</strong>, tem prazo programado para <strong>${formatarDataBR(a["Dt Programada"])}</strong>.`,
  },
  vencimento: {
    cor: "#8a6d1a",
    assunto: (a) => `Vence hoje: acao do Plano de Acao - ${a.Cliente}`,
    titulo: "Uma acao sob sua responsabilidade vence hoje",
    mensagem: (a) => `A Dt Programada da acao abaixo, do Plano de Acao de <strong>${a.Cliente}</strong>, e <strong>hoje (${formatarDataBR(a["Dt Programada"])})</strong>.`,
  },
  atraso: {
    cor: "#a32020",
    assunto: (a) => `Acao em atraso - ${a.Cliente}`,
    titulo: "Uma acao sob sua responsabilidade esta em atraso",
    mensagem: (a) => `A acao abaixo, do Plano de Acao de <strong>${a.Cliente}</strong>, passou da Dt Programada (${formatarDataBR(a["Dt Programada"])}) sem Dt Conclusao registrada.`,
  },
  atraso30: {
    cor: "#a32020",
    assunto: (a) => `Acao com 30 dias de atraso - ${a.Cliente}`,
    titulo: "Uma acao sob sua responsabilidade esta ha 30 dias em atraso",
    mensagem: (a) => `A acao abaixo, do Plano de Acao de <strong>${a.Cliente}</strong>, completou 30 dias de atraso (Dt Programada: ${formatarDataBR(a["Dt Programada"])}).`,
  },
  semanal: {
    cor: "#a32020",
    assunto: (a) => `[Lembrete semanal] Acao em atraso - ${a.Cliente}`,
    titulo: "Lembrete semanal: acao continua em atraso",
    mensagem: (a) => `A acao abaixo, do Plano de Acao de <strong>${a.Cliente}</strong>, continua em atraso (Dt Programada: ${formatarDataBR(a["Dt Programada"])}).`,
  },
};

function modeloPlanoAcao({ nomeApp, estagio, acao, paraAdmin }) {
  const cfg = ESTAGIOS_PLANO_ACAO[estagio];
  const linhaAdmin = paraAdmin
    ? `<p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Copia enviada a voce como Administrador do ${nomeApp}, porque esta acao esta em atraso.</p>`
    : "";
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2a1a1a">
      <div style="background:${cfg.cor};color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
        <div style="font-weight:700;font-size:18px">${nomeApp}</div>
        <div style="font-size:12px;opacity:.85">ElevaLife · 15 anos elevando pessoas e resultados</div>
      </div>
      <div style="border:1px solid #e5d9d9;border-top:none;border-radius:0 0 10px 10px;padding:24px">
        <p style="font-size:15.5px;font-weight:600;margin:0 0 8px">${cfg.titulo}</p>
        <p style="font-size:14.5px;line-height:1.6">${cfg.mensagem(acao)}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13.5px">
          <tr><td style="padding:4px 0;color:#7a6a6a">Cliente</td><td style="padding:4px 0">${acao.Cliente || "-"}</td></tr>
          <tr><td style="padding:4px 0;color:#7a6a6a">Setor / Posto</td><td style="padding:4px 0">${acao.Setor || "-"} / ${acao["Posto Trabalho"] || "-"}</td></tr>
          <tr><td style="padding:4px 0;color:#7a6a6a">Acao Recomendada</td><td style="padding:4px 0">${acao["Acao Recomendada"] || "-"}</td></tr>
          <tr><td style="padding:4px 0;color:#7a6a6a">Responsavel</td><td style="padding:4px 0">${acao["Responsavel Acao"] || "-"}</td></tr>
          <tr><td style="padding:4px 0;color:#7a6a6a">Dt Programada</td><td style="padding:4px 0">${formatarDataBR(acao["Dt Programada"])}</td></tr>
        </table>
        ${linhaAdmin}
        <p style="font-size:12.5px;color:#7a6a6a;line-height:1.6">Acesse o ${nomeApp} (aba Registro &gt; Plano de Acao) para ver o historico completo e marcar a Dt Conclusao quando a acao for concluida.</p>
      </div>
    </div>`;
}

module.exports = { enviarEmail, modeloConvite, modeloRedefinicao, modeloPlanoAcao, formatarDataBR, ESTAGIOS_PLANO_ACAO };
