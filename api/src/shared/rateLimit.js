/* ==========================================================================
   S.I.G.E. - ElevaLife · V 1.39 (revisão de segurança)
   Limite de requisições (rate limit) em memória para os endpoints PÚBLICOS
   (sem login): verificação de laudo (/api/verificar) e as telas do QR Code do
   HSE-IT (/api/psicopub/*). Objetivo: impedir varredura/enumeração em massa
   (ex.: iterar matrículas para mapear a força de trabalho, ou raspar os
   códigos de laudo e os registros dos ergonomistas).

   É uma janela deslizante por chave (ex.: IP, ou IP+empresa), guardada num
   Map em memória do processo da Function. O Azure reaproveita o processo entre
   as chamadas, então o limite vale de verdade por instância; com várias
   instâncias o teto efetivo é multiplicado pelo nº de instâncias - é uma
   defesa em profundidade, não um limite global exato (um limite global
   exigiria um store, ex.: Cosmos/Redis - fica para quando houver necessidade).
   ========================================================================== */
"use strict";

const baldes = new Map(); // chave -> number[] (timestamps, ms)
let ultimaLimpeza = 0;

// IP do cliente a partir dos cabeçalhos do Static Web App / Functions.
function ipDaRequisicao(request) {
  const h = (n) => { try { return request.headers.get(n) || ""; } catch (e) { return ""; } };
  const xff = h("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim().replace(/:\d+$/, "");
  return h("x-azure-clientip") || h("x-client-ip") || "desconhecido";
}

// Devolve { ok, restante, retryApos } para a chave, dentro da janela.
function limitar(chave, limite, janelaMs) {
  const agora = Date.now();
  if (agora - ultimaLimpeza > 60000) { // poda periódica para não crescer sem fim
    for (const [k, ts] of baldes) { if (!ts.length || agora - ts[ts.length - 1] > janelaMs) baldes.delete(k); }
    ultimaLimpeza = agora;
  }
  const corte = agora - janelaMs;
  const ts = (baldes.get(chave) || []).filter((t) => t > corte);
  if (ts.length >= limite) {
    baldes.set(chave, ts);
    return { ok: false, restante: 0, retryApos: Math.ceil((ts[0] + janelaMs - agora) / 1000) };
  }
  ts.push(agora); baldes.set(chave, ts);
  return { ok: true, restante: limite - ts.length, retryApos: 0 };
}

// Resposta 429 padronizada.
function resposta429(retryApos) {
  return { status: 429, headers: { "Retry-After": String(retryApos || 60), "Cache-Control": "no-store" }, jsonBody: { code: "rate_limited", erro: "Muitas solicitações em pouco tempo. Aguarde um instante e tente de novo." } };
}

module.exports = { ipDaRequisicao, limitar, resposta429 };
