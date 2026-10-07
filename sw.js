/* ==========================================================================
   S.I.G.E. – ElevaLife
   Service worker do app instalável (PWA), passo 1 (04/10/2026).

   O que ele faz:
   - Deixa o S.I.G.E. instalável ("Adicionar à tela inicial" no Chrome do
     celular/tablet) e abrindo em tela cheia, com ícone próprio.
   - Arquivos do próprio site (HTML, JS, CSS, imagens): sempre busca a versão
     NOVA na rede primeiro (cada deploy chega na hora, sem cache velho) e só
     usa a cópia guardada se estiver sem internet.
   - Bibliotecas externas (Chart.js, jsPDF, xlsx, pdf.js, fontes): guarda uma
     cópia e atualiza em segundo plano.
   - /api/* (dados, login): NUNCA passa pelo cache do service worker - vai direto para a rede.
     A coleta offline da AEP (passo 2) é feita em js/offline.js + js/db.js,
     com armazenamento próprio (IndexedDB), não por este cache.

   Para forçar todos os aparelhos a descartarem o cache antigo, basta trocar
   VERSAO abaixo.
   ========================================================================== */

"use strict";

const VERSAO = "sige-v30";
const CACHE_SITE = `${VERSAO}-site`;
const CACHE_EXTERNO = `${VERSAO}-externo`;

const ARQUIVOS_BASE = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/rotulos.js",
  "/js/datas.js",
  "/js/historico.js",
  "/js/calc.js",
  "/js/offline.js",
  "/js/db.js",
  "/js/acoes.js",
  "/js/indicadores.js",
  "/js/ajuda.js",
  "/js/diagramas.js",
  "/js/pdf-fonts.js",
  "/js/laudo-textos.js",
  "/js/laudo-docx.js",
  "/js/laudo.js",
  "/js/importador.js",
  "/js/app.js",
  "/img/logo-icone-branco.png",
  "/img/logo-icone-bordo.png",
  "/img/pwa/icone-192.png",
  "/manifest.webmanifest",
];

const HOSTS_EXTERNOS = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_SITE)
      .then((cache) => cache.addAll(ARQUIVOS_BASE))
      .catch(() => { /* sem rede na instalação: segue, o cache enche no uso */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => !n.startsWith(VERSAO)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

async function redePrimeiro(requisicao) {
  const cache = await caches.open(CACHE_SITE);
  try {
    const resposta = await fetch(requisicao);
    if (resposta && resposta.ok) cache.put(requisicao, resposta.clone());
    return resposta;
  } catch (erro) {
    const guardada = await cache.match(requisicao, { ignoreSearch: true });
    if (guardada) return guardada;
    if (requisicao.mode === "navigate") {
      const inicio = await cache.match("/index.html");
      if (inicio) return inicio;
    }
    throw erro;
  }
}

async function cacheEAtualiza(requisicao) {
  const cache = await caches.open(CACHE_EXTERNO);
  const guardada = await cache.match(requisicao);
  const daRede = fetch(requisicao)
    .then((resposta) => {
      if (resposta && (resposta.ok || resposta.type === "opaque")) cache.put(requisicao, resposta.clone());
      return resposta;
    })
    .catch(() => guardada);
  return guardada || daRede;
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.auth/")) return;
    evento.respondWith(redePrimeiro(req));
    return;
  }
  if (HOSTS_EXTERNOS.includes(url.hostname)) {
    evento.respondWith(cacheEAtualiza(req));
  }
});
