/* ==========================================================================
   S.I.G.E - ElevaLife · V 1.40
   Contabilidade de tempo (BI.Tempo) - alimenta a aba Coordenacao.

   Pedido do Alexandre (V 1.40): saber quanto tempo o usuario levou para
   cadastrar cada entidade (empresa, colaboradores, etc.) e quanto tempo levou
   do inicio ao fim de uma AEP/AET. Medimos OS DOIS:
     - tempo ATIVO de edicao (so conta enquanto a aba esta visivel, com foco e
       com interacao recente - nao conta janela aberta e esquecida);
     - marco de ABERTURA e de SALVAMENTO (relogio de parede) de cada sessao -
       a aba Coordenacao usa a primeira abertura e o ultimo salvamento de um
       mesmo registro como "inicio -> finalizacao".

   Cada SESSAO de trabalho salva gera UM documento na colecao "tempoTrabalho"
   (por EmpresaId). A agregacao por login/categoria e por ciclo de vida fica em
   js/coordenacao.js. Se o registro de tempo falhar, o trabalho do usuario NAO
   e afetado (gravacao best-effort, em segundo plano).
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});

  const IDLE_MS = 60 * 1000; // sem interacao por 60s = ocioso (nao conta como ativo)
  const sessoes = new Map(); // chaveSessao -> { aberturaEm, ativoMs, meta }
  let relogio = null;        // instante do ultimo "tick" enquanto ativo (ou null)
  let ultimaInteracao = Date.now();

  const agoraIso = () => new Date().toISOString();
  const temFoco = () => (typeof document.hasFocus === "function" ? document.hasFocus() : true);
  const estaAtivo = () => document.visibilityState !== "hidden" && temFoco() && (Date.now() - ultimaInteracao) < IDLE_MS;

  // Distribui o tempo decorrido (desde o ultimo tick) para todas as sessoes
  // abertas, se estava ativo; depois religa/desliga o relogio conforme o estado.
  function tick() {
    const now = Date.now();
    if (relogio != null) {
      const dt = now - relogio;
      if (dt > 0 && sessoes.size) sessoes.forEach((s) => { s.ativoMs += dt; });
    }
    relogio = estaAtivo() && sessoes.size ? now : null;
  }

  function marcarInteracao() {
    const reativando = (Date.now() - ultimaInteracao) >= IDLE_MS;
    ultimaInteracao = Date.now();
    if (reativando) tick(); // saiu do ocioso: religa o relogio sem contar o tempo parado
    else if (relogio == null && sessoes.size && estaAtivo()) relogio = Date.now();
  }

  let ligado = false;
  function ligarOuvintes() {
    if (ligado) return; ligado = true;
    document.addEventListener("visibilitychange", tick, { passive: true });
    g.addEventListener("blur", tick, { passive: true });
    g.addEventListener("focus", () => { marcarInteracao(); }, { passive: true });
    ["pointerdown", "keydown", "input", "wheel", "touchstart"].forEach((ev) =>
      document.addEventListener(ev, marcarInteracao, { passive: true, capture: true }));
    // Tick periodico: captura a transicao para ocioso mesmo sem novos eventos.
    setInterval(tick, 5000);
  }

  function identidade() {
    const i = BI.DB && BI.DB.estado && BI.DB.estado.identidade;
    const email = (i && i.email) || "";
    let nome = email;
    const erg = (BI.dados && BI.dados.ergonomista || []).find((e) => e.Email && email && e.Email.toLowerCase() === email.toLowerCase());
    if (erg && erg.Nome) nome = erg.Nome;
    return { email, nome };
  }

  // Inicia (ou reinicia) uma sessao. chave identifica a sessao aberta (ex.:
  // "cad:colaborador", "aet:editor"); meta traz Categoria/Tipo/Ref/posto.
  function iniciar(chave, meta) {
    ligarOuvintes();
    tick();
    sessoes.set(chave, { aberturaEm: agoraIso(), ativoMs: 0, meta: meta || {} });
    if (relogio == null && estaAtivo()) relogio = Date.now();
  }

  // Atualiza os metadados de uma sessao ja aberta (ex.: ao salvar pela 1a vez
  // descobrimos o RefId definitivo). Mantem o tempo ja acumulado.
  function anotar(chave, meta) {
    const s = sessoes.get(chave);
    if (s) s.meta = Object.assign({}, s.meta, meta || {});
  }

  function temSessao(chave) { return sessoes.has(chave); }

  // Finaliza uma sessao e grava o documento de tempo (best-effort). `extra`
  // sobrescreve/completa os metadados. Nao lanca erro para o chamador.
  function salvar(chave, extra) {
    tick();
    const s = sessoes.get(chave);
    sessoes.delete(chave);
    if (relogio != null && !sessoes.size) relogio = null;
    if (!s) return;
    const meta = Object.assign({}, s.meta, extra || {});
    const quem = identidade();
    const doc = {
      Categoria: meta.Categoria || "Cadastro",
      Tipo: meta.Tipo || "",
      RefId: meta.RefId != null ? String(meta.RefId) : "",
      RefNome: meta.RefNome || "",
      Acao: meta.Acao || "editar",
      Por: quem.email,
      PorNome: quem.nome,
      AtivoMs: Math.max(0, Math.round(s.ativoMs)),
      AberturaEm: s.aberturaEm,
      SalvoEm: agoraIso(),
      Cliente: meta.Cliente || "",
      Unidade: meta.Unidade || "",
      Setor: meta.Setor || "",
      "Posto Trabalho": meta["Posto Trabalho"] || "",
      Cargo: meta.Cargo || "",
      EmpresaId: meta.EmpresaId || "",
    };
    try {
      const DB = BI.DB;
      if (!DB || !DB.estado || !DB.estado.disponivel || DB.estado.somenteLeitura || !DB.estado.modoApi) return;
      if (!doc.Por) return; // sem login identificado nao ha o que contabilizar
      if (!doc.EmpresaId) { // tenta resolver pela empresa-cliente
        const emp = (BI.dados.cliente || []).find((c) => c.Cliente === doc.Cliente);
        doc.EmpresaId = emp ? (emp.id || emp._id) : "";
      }
      if (!doc.EmpresaId) return; // tempoTrabalho e por EmpresaId - sem ela, nao grava
      const id = (g.crypto && g.crypto.randomUUID) ? g.crypto.randomUUID() : "tmp" + Date.now() + Math.random().toString(36).slice(2, 8);
      Promise.resolve(DB.salvar("tempoTrabalho", id, doc, true)).catch((e) => console.warn("tempoTrabalho", e && e.message));
    } catch (e) { console.warn("tempoTrabalho", e && e.message); }
  }

  function descartar(chave) {
    tick();
    sessoes.delete(chave);
    if (relogio != null && !sessoes.size) relogio = null;
  }

  BI.Tempo = { iniciar, anotar, salvar, descartar, temSessao };
})(window);
