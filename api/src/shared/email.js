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

module.exports = { enviarEmail, modeloConvite, modeloRedefinicao };
