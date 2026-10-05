/* ==========================================================================
   S.I.G.E. – ElevaLife
   Coleta offline (passo 2 do app Android/PWA, 04/10/2026).

   Este arquivo tem duas partes:
   1) Armazenamento local (IndexedDB) - guarda NO APARELHO: cópia dos dados
      (para a AEP abrir e funcionar sem sinal), a fila de gravações feitas
      sem internet e as fotos ainda não enviadas.
   2) Indicador na tela ("Sem internet", "3 a enviar", "1 com problema") e a
      janela com a lista de envios pendentes (reenviar / descartar).

   A lógica de QUANDO guardar e QUANDO enviar fica em js/db.js - este
   arquivo só guarda e mostra. Se o IndexedDB não existir (navegador muito
   antigo, aba privada), tudo aqui falha em silêncio e o sistema volta a
   funcionar como antes (só online).
   ========================================================================== */

(function (global) {
  "use strict";

  const NOME_BD = "sige-offline";
  const VERSAO_BD = 1;
  let promessaBd = null;

  function disponivel() {
    try { return !!global.indexedDB; } catch (e) { return false; }
  }

  function abrir() {
    if (promessaBd) return promessaBd;
    promessaBd = new Promise((resolve, reject) => {
      if (!disponivel()) { reject(new Error("IndexedDB indisponível.")); return; }
      const req = global.indexedDB.open(NOME_BD, VERSAO_BD);
      req.onupgradeneeded = () => {
        const bd = req.result;
        // Cópia dos dados por usuário: chave "email|colecao".
        if (!bd.objectStoreNames.contains("cache")) bd.createObjectStore("cache");
        // Identidade da última sessão válida (para abrir offline).
        if (!bd.objectStoreNames.contains("meta")) bd.createObjectStore("meta");
        // Fotos/arquivos anexados offline, aguardando envio.
        if (!bd.objectStoreNames.contains("arquivos")) bd.createObjectStore("arquivos");
        // Fila de gravações, na ordem em que foram feitas.
        if (!bd.objectStoreNames.contains("fila")) bd.createObjectStore("fila", { keyPath: "seq", autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Falha ao abrir o armazenamento local."));
    });
    promessaBd.catch(() => { promessaBd = null; });
    return promessaBd;
  }

  function operar(loja, modo, fn) {
    return abrir().then((bd) => new Promise((resolve, reject) => {
      const t = bd.transaction(loja, modo);
      const armazem = t.objectStore(loja);
      let resultado;
      try { resultado = fn(armazem); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(resultado && "result" in resultado ? resultado.result : undefined);
      t.onerror = () => reject(t.error || new Error("Falha no armazenamento local."));
      t.onabort = () => reject(t.error || new Error("Armazenamento local cheio ou bloqueado."));
    }));
  }

  const ler = (loja, chave) => operar(loja, "readonly", (a) => a.get(chave));
  const gravar = (loja, chave, valor) => operar(loja, "readwrite", (a) => a.put(valor, chave));
  const apagar = (loja, chave) => operar(loja, "readwrite", (a) => a.delete(chave));
  const limpar = (loja) => operar(loja, "readwrite", (a) => a.clear());
  const todos = (loja) => operar(loja, "readonly", (a) => a.getAll());

  // Fila (chave automática "seq").
  const fila = {
    adicionar: (entrada) => operar("fila", "readwrite", (a) => a.add(entrada)),
    atualizar: (entrada) => operar("fila", "readwrite", (a) => a.put(entrada)),
    remover: (seq) => operar("fila", "readwrite", (a) => a.delete(seq)),
    listar: () => todos("fila").then((l) => (l || []).sort((x, y) => x.seq - y.seq)),
  };

  // Pede ao navegador para NÃO apagar estes dados sozinho quando o aparelho
  // estiver com pouco espaço (o padrão é apagar o que não é "persistente").
  function pedirPersistencia() {
    try {
      if (global.navigator && global.navigator.storage && global.navigator.storage.persist) {
        global.navigator.storage.persist().catch(() => {});
      }
    } catch (e) { /* ignora */ }
  }

  // ------------------------------------------------------------------
  // Indicador na tela + janela de pendências
  // ------------------------------------------------------------------

  const ROTULO_COLECAO = {
    avaliacaoErgonomica: "Avaliação Ergonômica",
    fatorRisco: "Inventário de Riscos",
    mapaRisco: "Mapa de Risco",
    planoAcao: "Plano de Ação",
    absenteismo: "Absenteísmo",
    compativeis: "Compatíveis",
    cliente: "Empresa (Cliente)",
    unidade: "Unidade",
    setor: "Setor",
    posto: "Posto de Trabalho",
    cargo: "Cargo",
    atividade: "Atividade",
    laudo: "Laudo",
    aet: "AET",
    diasUteis: "HHT / Dias Úteis",
    certificadoCalibracao: "Certificado de Calibração",
    modeloLaudo: "Modelo de Laudo",
  };

  function injetarEstilo() {
    if (document.getElementById("estilo-offline")) return;
    const st = document.createElement("style");
    st.id = "estilo-offline";
    st.textContent = `
      .ind-offline { position: fixed; right: 14px; bottom: 14px; z-index: 9000; max-width: calc(100vw - 28px);
        display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 999px; border: 1px solid transparent;
        font: 600 13px/1.2 "Montserrat", system-ui, sans-serif; color: #fff; background: var(--teal-escuro, #2E5F62);
        box-shadow: 0 4px 14px rgba(0,0,0,.25); cursor: pointer; }
      .ind-offline[hidden] { display: none; }
      .ind-offline.ind-sem-rede { background: var(--vinho-escuro, #5E2A30); }
      .ind-offline.ind-problema { background: var(--status-critical, #d03b3b); }
      .ind-offline-fundo { position: fixed; inset: 0; z-index: 9100; background: rgba(0,0,0,.45);
        display: flex; align-items: center; justify-content: center; padding: 16px; }
      .ind-offline-fundo[hidden] { display: none; }
      .ind-offline-janela { background: var(--card, #fff); color: var(--texto, #3D2E30); width: min(640px, 100%); max-height: 86vh;
        overflow: auto; border-radius: 12px; padding: 18px 20px; box-shadow: 0 10px 40px rgba(0,0,0,.35);
        font-family: "Montserrat", system-ui, sans-serif; }
      .ind-offline-janela h2 { margin: 0 0 4px; font-size: 18px; }
      .ind-offline-janela p.sub { margin: 0 0 12px; font-size: 13px; color: var(--texto-secundario, #6E5C5C); }
      .ind-item { border: 1px solid var(--linha, #E7DED9); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
      .ind-item.ind-item-problema { border-color: var(--status-critical, #d03b3b); }
      .ind-item b { display: block; font-size: 13px; }
      .ind-item .resumo { font-size: 13px; margin: 2px 0; word-break: break-word; }
      .ind-item .estado { font-size: 12px; color: var(--texto-secundario, #6E5C5C); }
      .ind-item.ind-item-problema .estado { color: var(--status-critical, #d03b3b); }
      .ind-acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      .ind-acoes button, .ind-rodape button { font: 600 13px "Montserrat", system-ui, sans-serif; padding: 9px 14px; min-height: 40px;
        border-radius: 8px; border: 1px solid var(--vinho, #8B3A42); background: #fff; color: var(--vinho, #8B3A42); cursor: pointer; }
      .ind-acoes button.primario, .ind-rodape button.primario { background: var(--vinho, #8B3A42); color: #fff; }
      .ind-rodape { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; flex-wrap: wrap; }
    `;
    document.head.appendChild(st);
  }

  function resumoDe(entrada) {
    const d = entrada.dados || {};
    const partes = ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade"].map((c) => d[c]).filter(Boolean);
    const extra = d["Fator Risco"] || d["Fator"] || "";
    const texto = (d.Nome && !partes.length ? d.Nome : partes.join(" › ")) + (extra ? " – " + extra : "");
    return texto || "(sem identificação)";
  }

  function textoEstado(entrada) {
    if (entrada.estado === "conflito") {
      return "Conflito: " + (entrada.mensagem || "este registro foi alterado por outra pessoa enquanto você estava sem internet.");
    }
    if (entrada.estado === "erro") return "Não foi enviado: " + (entrada.mensagem || "erro desconhecido.");
    return entrada.tentativas ? "Aguardando envio (tentou " + entrada.tentativas + "x)" : "Aguardando envio";
  }

  function montarIndicador(dbApi) {
    if (!dbApi || document.getElementById("indicador-offline")) return;
    injetarEstilo();

    const pilula = document.createElement("button");
    pilula.type = "button";
    pilula.id = "indicador-offline";
    pilula.className = "ind-offline";
    pilula.hidden = true;
    document.body.appendChild(pilula);

    const fundo = document.createElement("div");
    fundo.className = "ind-offline-fundo";
    fundo.hidden = true;
    document.body.appendChild(fundo);

    function atualizarPilula() {
      const e = dbApi.estado;
      const semRede = !!e.offlineAgora || (global.navigator && global.navigator.onLine === false);
      const pend = e.pendentes || 0;
      const prob = e.problemas || 0;
      let texto = "";
      let classe = "ind-offline";
      if (e.sessaoExpirada && pend > 0) {
        texto = "⚠ Sessão expirada – entre de novo para enviar " + pend + (pend === 1 ? " item" : " itens");
        classe += " ind-problema";
      } else if (prob > 0) {
        texto = "⚠ " + prob + (prob === 1 ? " item com problema" : " itens com problema") + " – toque para ver";
        classe += " ind-problema";
      } else if (semRede) {
        texto = "Sem internet" + (pend ? " · " + pend + " a enviar" : " · dados salvos neste aparelho");
        classe += " ind-sem-rede";
      } else if (e.sincronizando && pend) {
        texto = "Enviando " + pend + (pend === 1 ? " item…" : " itens…");
      } else if (pend) {
        texto = pend + (pend === 1 ? " item a enviar" : " itens a enviar");
      }
      pilula.className = classe;
      pilula.textContent = texto;
      pilula.hidden = !texto;
    }

    async function renderizarJanela() {
      const lista = await dbApi.fila.listar();
      fundo.innerHTML = "";
      const janela = document.createElement("div");
      janela.className = "ind-offline-janela";
      const h = document.createElement("h2");
      h.textContent = "Envios pendentes";
      const sub = document.createElement("p");
      sub.className = "sub";
      sub.textContent = lista.length
        ? "Estas operações (registros e exclusões) foram feitas sem internet e estão guardadas neste aparelho. Elas são enviadas sozinhas quando o sinal voltar."
        : "Nada pendente. Tudo o que foi feito já está no servidor.";
      janela.append(h, sub);

      lista.forEach((entrada) => {
        const item = document.createElement("div");
        item.className = "ind-item" + (entrada.estado === "conflito" || entrada.estado === "erro" ? " ind-item-problema" : "");
        const titulo = document.createElement("b");
        titulo.textContent = (ROTULO_COLECAO[entrada.colecao] || entrada.colecao) +
          (entrada.tipo === "excluir" ? " (exclusão)" : entrada.criar ? " (novo)" : " (alteração)");
        const resumo = document.createElement("div");
        resumo.className = "resumo";
        resumo.textContent = resumoDe(entrada);
        const est = document.createElement("div");
        est.className = "estado";
        est.textContent = textoEstado(entrada);
        item.append(titulo, resumo, est);

        const acoes = document.createElement("div");
        acoes.className = "ind-acoes";
        if (entrada.estado === "conflito") {
          const b = document.createElement("button");
          b.type = "button"; b.className = "primario"; b.textContent = "Enviar minha versão";
          b.addEventListener("click", async () => { await dbApi.fila.reenviar(entrada.seq, true); renderizarJanela(); });
          acoes.appendChild(b);
        } else if (entrada.estado === "erro") {
          const b = document.createElement("button");
          b.type = "button"; b.className = "primario"; b.textContent = "Tentar de novo";
          b.addEventListener("click", async () => { await dbApi.fila.reenviar(entrada.seq, false); renderizarJanela(); });
          acoes.appendChild(b);
        }
        const d = document.createElement("button");
        d.type = "button"; d.textContent = entrada.tipo === "excluir" ? "Cancelar exclusão" : "Descartar";
        d.addEventListener("click", async () => {
          if (!global.confirm(entrada.tipo === "excluir"
            ? "Cancelar esta exclusão? O registro continua no sistema."
            : "Descartar este registro? Ele será perdido e não será enviado.")) return;
          await dbApi.fila.descartar(entrada.seq);
          renderizarJanela();
        });
        acoes.appendChild(d);
        item.appendChild(acoes);
        janela.appendChild(item);
      });

      const rodape = document.createElement("div");
      rodape.className = "ind-rodape";
      const bEnviar = document.createElement("button");
      bEnviar.type = "button"; bEnviar.className = "primario"; bEnviar.textContent = "Enviar agora";
      bEnviar.addEventListener("click", async () => { await dbApi.fila.sincronizar(true); renderizarJanela(); });
      const bFechar = document.createElement("button");
      bFechar.type = "button"; bFechar.textContent = "Fechar";
      bFechar.addEventListener("click", () => { fundo.hidden = true; });
      if (lista.length) rodape.appendChild(bEnviar);
      rodape.appendChild(bFechar);
      janela.appendChild(rodape);
      fundo.appendChild(janela);
    }

    pilula.addEventListener("click", async () => {
      try { await renderizarJanela(); fundo.hidden = false; } catch (e) { /* sem armazenamento: nada a mostrar */ }
    });
    fundo.addEventListener("click", (ev) => { if (ev.target === fundo) fundo.hidden = true; });

    dbApi.fila.aoMudar(() => {
      atualizarPilula();
      if (!fundo.hidden) renderizarJanela().catch(() => {});
    });
    global.addEventListener("online", atualizarPilula);
    global.addEventListener("offline", atualizarPilula);
    atualizarPilula();
  }

  global.BI = global.BI || {};
  global.BI.Offline = { disponivel, ler, gravar, apagar, limpar, todos, fila, pedirPersistencia, montarIndicador, ROTULO_COLECAO };
})(window);
