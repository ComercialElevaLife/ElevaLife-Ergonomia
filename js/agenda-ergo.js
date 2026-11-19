/* ==========================================================================
   S.I.G.E - ElevaLife
   V 2.01 (Alexandre): Aba Ergonomista — visão pessoal de cada ergonomista e
   a agenda diária. Quatro sub-abas (filtradas por perfil):
     - "Minha avaliação"  (equipe)        : resultado da própria avaliação (BI.AvalErgo)
     - "Minha agenda"     (equipe)        : agenda do dia (atividade + horário + quantidade),
                                            com puxada automática do que foi feito no SIGE
     - "Montar agendas"   (Administrador) : horas por dia da semana de cada ergonomista
                                            + cadastro dos tipos de atividade
     - "Painel da agenda" (Administrador) : acompanhamento corporativo (geral e por ergo)

   Dados GLOBAIS no banco:
     - agendaErgo   : 1 doc por ergonomista/dia (id "ag-<slug>-<AAAA-MM-DD>")
                      { EmailErgonomista, Nome, Data, Itens:[{atividade,horaInicio,horaFim,quantidade,obs,auto}] }
                      Cada ergonomista grava a PRÓPRIA; o coordenador vê todas.
     - agendaConfig : horas por dia da semana de cada ergonomista (id "agcfg-<slug>")
                      { EmailErgonomista, Nome, horasPorDia:[dom..sab] } — só o coordenador monta.
   Tipos de atividade ficam em configuracao (doc "agendaAtividades").
   A agenda começa em dezembro/2026.
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const INICIO_AGENDA = "2026-12-01"; // a agenda passa a valer em dezembro/2026

  // Atividades padronizadas (o coordenador pode cadastrar outras). "sige" marca as
  // que têm abastecimento automático a partir do que o ergonomista faz no sistema.
  const ATIVIDADES_PADRAO = [
    { nome: "Montar AEP (SIGE)", sige: "AEP" },
    { nome: "Montar AET (SIGE)", sige: "AET" },
    { nome: "Coleta de dados para AEP" },
    { nome: "Coleta de dados para AET" },
    { nome: "Gemba" },
    { nome: "Visita a restrito" },
    { nome: "COERGO" },
    { nome: "Validação de análise" },
    { nome: "Parecer técnico" },
    { nome: "Auditoria de ação implementada" },
    { nome: "Jurídico" },
    { nome: "Reunião" },
    { nome: "Lançamento de absenteísmo" },
    { nome: "Outras demandas" },
    { nome: "Almoço" },
  ];

  const DB = () => BI.DB;
  const n0 = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
  function ident() { const d = DB(); return (d && d.estado && d.estado.identidade) || null; }
  function papelAtual() { const i = ident(); return i ? i.papel : "Administrador"; }
  const ehAdmin = () => papelAtual() === "Administrador";
  function emailAtual() { const i = ident(); return i ? String(i.email || "").toLowerCase() : ""; }
  function podeGravar() { const e = DB() && DB().estado; return !!(e && e.disponivel && !e.somenteLeitura && e.modoApi); }
  function slug(email) { return String(email || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  // V 2.10 (Alexandre): cache dos usuários (contas de login) para vincular à agenda.
  let _usuariosCache = null;
  async function carregarUsuarios() {
    if (_usuariosCache) return _usuariosCache;
    try {
      const r = await fetch("/api/usuarios", { credentials: "same-origin", cache: "no-store" });
      _usuariosCache = r.ok ? await r.json() : [];
    } catch (e) { _usuariosCache = []; }
    return _usuariosCache;
  }
  function usuarioPorEmail(email) {
    const e = String(email || "").toLowerCase();
    return (_usuariosCache || []).find((u) => String(u.Email || "").trim().toLowerCase() === e);
  }
  function nomeDe(email) {
    const e = String(email || "").toLowerCase();
    // V 2.10: prioriza o Nome do usuário (login); depois a config da agenda; depois o ergonomista.
    const u = usuarioPorEmail(e); if (u && u.Nome) return u.Nome;
    const cfg = docsConfig().find((c) => String(c.EmailErgonomista || "").toLowerCase() === e);
    if (cfg && cfg.Nome) return cfg.Nome;
    const erg = (BI.dados && BI.dados.ergonomista || []).find((x) => String(x.Email || "").trim().toLowerCase() === e);
    return (erg && erg.Nome) || email || "—";
  }
  // Ergonomistas da equipe (com e-mail). Usado para montar agendas e no painel.
  function ergonomistas() {
    return (BI.dados && BI.dados.ergonomista || [])
      .filter((x) => x.Email)
      .map((x) => ({ email: String(x.Email).toLowerCase(), nome: x.Nome || x.Email }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }
  // V 2.10 (Alexandre): donos de agenda — quem realmente TEM agenda no sistema. As agendas
  // (agendaErgo/agendaConfig) são gravadas pela conta de LOGIN (o backend força isso), então o
  // painel/seletores do ADM listam os donos a partir das configs salvas, unidos aos ergonomistas.
  function donosAgenda() {
    const mapa = {};
    ergonomistas().forEach((e) => { mapa[e.email] = { email: e.email, nome: e.nome }; });
    docsConfig().forEach((c) => {
      const em = String(c.EmailErgonomista || "").toLowerCase(); if (!em) return;
      mapa[em] = { email: em, nome: c.Nome || nomeDe(em) };
    });
    return Object.keys(mapa).map((k) => mapa[k]).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }
  // Config da agenda correspondente a uma linha de ergonomista do Cadastro Interno.
  // Reconhece tanto o formato novo (ErgoRef = e-mail do ergonomista) quanto o antigo (chave pelo e-mail).
  function cfgDoErgo(ergoEmail) {
    const e = String(ergoEmail || "").toLowerCase();
    return docsConfig().find((c) => String(c.ErgoRef || "").toLowerCase() === e)
      || docsConfig().find((c) => (c._id || c.id) === idCfg(e));
  }

  // --------------------------------------------------- datas / horário
  function hojeISO() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dataInicial() { const hoje = hojeISO(); return hoje >= INICIO_AGENDA ? hoje : INICIO_AGENDA; }
  function dataBR(iso) { if (!iso) return "—"; const [a, m, d] = String(iso).split("-"); return d + "/" + m + "/" + a; }
  function diaDaSemana(iso) { const [a, m, d] = String(iso).split("-").map(Number); return new Date(a, m - 1, d).getDay(); }
  // "HH:MM" -> minutos; duração em minutos entre início e fim (0 se inválido/negativo).
  function minDe(hhmm) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim()); if (!m) return null; return n0(m[1]) * 60 + n0(m[2]); }
  function duracaoMin(ini, fim) { const a = minDe(ini), b = minDe(fim); if (a == null || b == null) return 0; return Math.max(0, b - a); }
  function fmtHoras(min) { min = Math.max(0, Math.round(min)); const hh = Math.floor(min / 60), mm = min % 60; if (!hh) return mm + "min"; return hh + "h" + (mm ? " " + String(mm).padStart(2, "0") : ""); }

  // --------------------------------------------------- acesso aos dados
  function docsAgenda() { return (BI.dados && BI.dados.agendaErgo) || []; }
  function docsConfig() { return (BI.dados && BI.dados.agendaConfig) || []; }
  function idAgenda(email, data) { return "ag-" + slug(email) + "-" + data; }
  function idCfg(email) { return "agcfg-" + slug(email); }
  function acharAgenda(email, data) { const k = idAgenda(email, data); return docsAgenda().find((d) => (d._id || d.id) === k); }
  function acharCfg(email) { const k = idCfg(email); return docsConfig().find((d) => (d._id || d.id) === k); }
  function horasPorDiaDe(email) { const c = acharCfg(email); const arr = (c && c.horasPorDia) || []; return [0, 1, 2, 3, 4, 5, 6].map((i) => n0(arr[i])); }

  // Tipos de atividade cadastrados (configuracao › agendaAtividades) ou o padrão.
  function docAtividades() { return (BI.dados && BI.dados.configuracao || []).find((d) => (d._id || d.id) === "agendaAtividades"); }
  function tiposAtividade() {
    const doc = docAtividades();
    if (doc && Array.isArray(doc.tipos) && doc.tipos.length) {
      return doc.tipos.map((t) => (typeof t === "string" ? { nome: t } : t)).filter((t) => t && t.nome);
    }
    return ATIVIDADES_PADRAO.slice();
  }
  function sigeDaAtividade(nome) { const t = tiposAtividade().find((x) => x.nome === nome); return t && t.sige; }

  async function recarregar(chaves) { try { await DB().recarregar(chaves || ["agendaErgo", "agendaConfig", "configuracao"]); } catch (e) { console.error(e); } }

  // --------------------------------------------------- abastecimento automático
  // A partir de tempoTrabalho (registros do que o ergonomista fez no SIGE), monta
  // itens automáticos de montagem de AEP/AET no dia escolhido: horário (menor
  // abertura → maior salvamento) e quantidade (postos/análises distintos no dia).
  function autoItens(email, data) {
    const e = String(email || "").toLowerCase();
    const regs = (BI.dados && BI.dados.tempoTrabalho || []).filter((r) => {
      if (String(r.Por || "").toLowerCase() !== e) return false;
      const ref = r.SalvoEm || r.AberturaEm; if (!ref) return false;
      return String(ref).slice(0, 10) === data;
    });
    const tipos = tiposAtividade();
    const porCat = {}; // Categoria -> agregado
    regs.forEach((r) => {
      const cat = r.Categoria; if (cat !== "AEP" && cat !== "AET") return;
      const a = porCat[cat] || (porCat[cat] = { refs: new Set(), ini: null, fim: null });
      if (r.RefId) a.refs.add(r.RefId);
      const ab = r.AberturaEm ? String(r.AberturaEm).slice(11, 16) : null;
      const sv = r.SalvoEm ? String(r.SalvoEm).slice(11, 16) : null;
      if (ab && (!a.ini || ab < a.ini)) a.ini = ab;
      if (sv && (!a.fim || sv > a.fim)) a.fim = sv;
    });
    const itens = [];
    Object.keys(porCat).forEach((cat) => {
      const t = tipos.find((x) => x.sige === cat); if (!t) return;
      const a = porCat[cat];
      itens.push({ atividade: t.nome, horaInicio: a.ini || "", horaFim: a.fim || "", quantidade: a.refs.size, obs: "", auto: true });
    });
    return itens;
  }

  // --------------------------------------------------- UI utilitária
  function cartao(titulo, sub, conteudo) {
    const c = h("div", "cartao col-12");
    if (titulo) c.appendChild(h("div", "cartao-titulo", titulo));
    if (sub) c.appendChild(h("div", "coord-sub", sub));
    if (conteudo) c.appendChild(conteudo);
    return c;
  }

  // --------------------------------------------------- sub-abas
  let subAtiva = "minhaagenda";
  let dataAgenda = dataInicial();
  let agendaAlvoEmail = null; // V 2.03: ergonomista cuja agenda o ADM está vendo (coordenador vê todas)
  let mesPainel = (hojeISO() >= INICIO_AGENDA) ? (new Date().getMonth()) : 11;
  let anoPainel = (hojeISO() >= INICIO_AGENDA) ? (new Date().getFullYear()) : 2026;
  let ergoPainel = "__todos__";

  const SUBABAS = [
    { chave: "minhaaval", rotulo: "Minha avaliação", montar: renderMinhaAval, papeis: ["Administrador", "Consultor"] },
    { chave: "minhaagenda", rotulo: "Minha agenda", montar: renderMinhaAgenda, papeis: ["Administrador", "Consultor"] },
    { chave: "montaragendas", rotulo: "Montar agendas", montar: renderMontarAgendas, papeis: ["Administrador"] },
    { chave: "painel", rotulo: "Painel da agenda", montar: renderPainel, papeis: ["Administrador"] },
    // V 2.16 (Alexandre): Cronogramas (avaliações/validação/blitz) — módulo próprio (js/cronogramas.js).
    { chave: "cronogramas", rotulo: "Cronogramas", montar: (area) => { if (BI.Cronogramas) BI.Cronogramas.render(area); }, papeis: ["Administrador", "Consultor"] },
  ];
  function subabasVisiveis() { const p = papelAtual(); return SUBABAS.filter((s) => s.papeis.indexOf(p) !== -1); }

  function render() {
    const grade = document.getElementById("grade-ergonomista");
    if (!grade) return;
    // V 2.10 (Alexandre): o ADM usa os nomes dos usuários (login) nos seletores/painel.
    if (_usuariosCache === null && ehAdmin()) { carregarUsuarios().then(() => { try { render(); } catch (e) {} }); }
    grade.innerHTML = "";
    const visiveis = subabasVisiveis();
    if (!visiveis.length) { grade.appendChild(cartao("Ergonomista", null, h("div", "coord-vazio", "Área restrita à equipe ElevaLife."))); return; }
    if (!visiveis.some((s) => s.chave === subAtiva)) subAtiva = visiveis[0].chave;

    if (visiveis.length > 1) {
      const nav = h("nav", "subnav-cadastro coord-subnav");
      visiveis.forEach((s) => {
        const b = h("button", "subnav-cadastro-item" + (s.chave === subAtiva ? " ativa" : ""), s.rotulo);
        b.type = "button";
        b.addEventListener("click", () => { subAtiva = s.chave; render(); });
        nav.appendChild(b);
      });
      grade.appendChild(nav);
    }
    const area = h("div", "coord-area");
    grade.appendChild(area);
    (visiveis.find((s) => s.chave === subAtiva) || visiveis[0]).montar(area);
  }

  // =================================================== Minha avaliação
  function renderMinhaAval(area) {
    if (BI.AvalErgo && BI.AvalErgo.render) BI.AvalErgo.render(area);
    else area.appendChild(cartao("Minha avaliação", null, h("div", "coord-vazio", "Módulo de avaliação indisponível.")));
  }

  // =================================================== Minha agenda (editor do dia)
  function renderMinhaagendaFallbackEmail() {
    // O coordenador também tem agenda própria; os demais usam o próprio login.
    return emailAtual();
  }

  function renderMinhaAgenda(area) {
    const meu = emailAtual();
    // V 2.03 (Alexandre): o coordenador (ADM) vê a agenda de QUALQUER ergonomista. Os demais
    // veem apenas a própria. Ao ver a de outro, a tela fica somente leitura (visualização).
    if (ehAdmin() && !agendaAlvoEmail) agendaAlvoEmail = meu;
    const email = ehAdmin() ? agendaAlvoEmail : meu;
    if (!email) { area.appendChild(cartao("Minha agenda", null, h("div", "coord-vazio", "Não foi possível identificar o seu login."))); return; }
    const soVista = ehAdmin() && email !== meu;

    const card = h("div", "cartao col-12");
    const cab = h("div", "coord-cab");
    cab.appendChild(h("div", "cartao-titulo", soVista ? ("Agenda de " + nomeDe(email)) : "Minha agenda do dia"));
    card.appendChild(cab);
    card.appendChild(h("div", "coord-sub", soVista ? ("Visualização da agenda de " + nomeDe(email) + " (coordenação). Para editar, cada ergonomista preenche a própria agenda.") : "Registre o que foi feito no dia, com horário (início e fim) e a quantidade. As atividades feitas no SIGE (montagem de AEP/AET) podem ser puxadas automaticamente — confira e ajuste. A agenda vale a partir de dezembro/2026."));

    // Linha de seleção de data + navegação.
    const barra = h("div", "agenda-barra");
    // Seletor de ergonomista — só para o coordenador (vê a de todos, inclusive a própria).
    if (ehAdmin()) {
      const selErg = h("select", "agenda-inp");
      const lista = [{ email: meu, nome: nomeDe(meu) + " (eu)" }].concat(donosAgenda().filter((e) => e.email !== meu));
      lista.forEach((e) => { const o = h("option", null, e.nome); o.value = e.email; if (e.email === email) o.selected = true; selErg.appendChild(o); });
      selErg.addEventListener("change", () => { agendaAlvoEmail = selErg.value; renderMinhaAgenda(area); });
      const lbl = h("label", "agenda-dia-sem"); lbl.style.fontWeight = "600"; lbl.textContent = "Ergonomista:"; lbl.appendChild(selErg); lbl.style.display = "inline-flex"; lbl.style.gap = "6px"; lbl.style.alignItems = "center";
      barra.appendChild(lbl);
    }
    const bAnt = h("button", "btn-cad-secundario", "‹ Dia anterior"); bAnt.type = "button";
    const inpData = h("input"); inpData.type = "date"; inpData.className = "agenda-data"; inpData.value = dataAgenda; inpData.min = INICIO_AGENDA;
    const bProx = h("button", "btn-cad-secundario", "Próximo dia ›"); bProx.type = "button";
    const lblDia = h("span", "agenda-dia-sem");
    function atualizarLbl() { lblDia.textContent = DIAS_SEMANA[diaDaSemana(dataAgenda)] + ", " + dataBR(dataAgenda); }
    atualizarLbl();
    function irPara(iso) { if (iso < INICIO_AGENDA) iso = INICIO_AGENDA; dataAgenda = iso; renderMinhaAgenda(area2 || area); }
    function somaDias(iso, d) { const [a, m, dd] = iso.split("-").map(Number); const dt = new Date(a, m - 1, dd + d); return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"); }
    bAnt.addEventListener("click", () => irPara(somaDias(dataAgenda, -1)));
    bProx.addEventListener("click", () => irPara(somaDias(dataAgenda, 1)));
    inpData.addEventListener("change", () => irPara(inpData.value || dataAgenda));
    // V 2.10 (Alexandre): a carga horária por dia da semana é fixa (previsto), mas o ergonomista
    // precisa INFORMAR a data real em que fez as atividades. Rótulo explícito deixa isso claro.
    const lblData = h("label", "agenda-dia-sem"); lblData.style.cssText = "display:inline-flex;gap:6px;align-items:center;font-weight:600";
    lblData.appendChild(h("span", null, "Data das atividades:")); lblData.appendChild(inpData);
    barra.appendChild(bAnt); barra.appendChild(lblData); barra.appendChild(bProx); barra.appendChild(lblDia);
    card.appendChild(barra);
    const area2 = area; // referência estável para re-render

    // Estado dos itens do dia: começa do que está salvo; se não há nada salvo,
    // já sugere os itens automáticos do SIGE.
    const docSalvo = acharAgenda(email, dataAgenda);
    let itens = docSalvo && Array.isArray(docSalvo.Itens)
      ? docSalvo.Itens.map((it) => Object.assign({}, it))
      : autoItens(email, dataAgenda);

    const tipos = tiposAtividade();

    // Tabela editável
    const wrap = h("div", "coord-tabela-wrap");
    const t = h("table", "coord-tabela agenda-tabela");
    const thead = h("thead"); const trh = h("tr");
    ["Atividade", "Início", "Fim", "Duração", "Qtd.", "Observação", ""].forEach((c, i) => { const th = h("th", (i === 3 || i === 4) ? "num" : null, c); trh.appendChild(th); });
    thead.appendChild(trh); t.appendChild(thead);
    const tb = h("tbody");
    t.appendChild(tb);

    const rodape = h("div", "agenda-rodape");
    const totalEl = h("span", "agenda-total");
    function recalcTotal() {
      const min = itens.reduce((s, it) => s + duracaoMin(it.horaInicio, it.horaFim), 0);
      const cfg = horasPorDiaDe(email); const esp = cfg[diaDaSemana(dataAgenda)] * 60;
      totalEl.textContent = "Total lançado: " + fmtHoras(min) + (esp ? " de " + fmtHoras(esp) + " previstas" : "");
    }

    function desenharLinhas() {
      tb.innerHTML = "";
      itens.forEach((it, idx) => {
        const tr = h("tr", it.auto ? "agenda-auto" : null);
        // Atividade (select dos tipos; mantém valor atual mesmo se não cadastrado)
        const tdAt = h("td");
        const sel = h("select", "agenda-inp");
        const nomes = tipos.map((x) => x.nome);
        if (it.atividade && nomes.indexOf(it.atividade) === -1) nomes.unshift(it.atividade);
        nomes.forEach((nm) => { const o = h("option", null, nm); o.value = nm; if (nm === it.atividade) o.selected = true; sel.appendChild(o); });
        sel.addEventListener("change", () => { it.atividade = sel.value; }); sel.disabled = soVista;
        tdAt.appendChild(sel);
        if (it.auto) tdAt.appendChild(h("span", "agenda-badge", "automático"));
        tr.appendChild(tdAt);
        // Início / Fim
        const mkHora = (campo) => { const i = h("input", "agenda-inp agenda-hora"); i.type = "time"; i.value = it[campo] || ""; i.disabled = soVista; i.addEventListener("change", () => { it[campo] = i.value; tdDur.textContent = fmtHoras(duracaoMin(it.horaInicio, it.horaFim)); recalcTotal(); }); return i; };
        const tdIni = h("td"); tdIni.appendChild(mkHora("horaInicio")); tr.appendChild(tdIni);
        const tdFim = h("td"); tdFim.appendChild(mkHora("horaFim")); tr.appendChild(tdFim);
        // Duração (calculada)
        const tdDur = h("td", "num", fmtHoras(duracaoMin(it.horaInicio, it.horaFim))); tr.appendChild(tdDur);
        // Quantidade
        const tdQ = h("td", "num"); const iQ = h("input", "agenda-inp agenda-qtd"); iQ.type = "number"; iQ.min = "0"; iQ.value = (it.quantidade != null ? it.quantidade : ""); iQ.disabled = soVista; iQ.addEventListener("change", () => { it.quantidade = n0(iQ.value); }); tdQ.appendChild(iQ); tr.appendChild(tdQ);
        // Observação
        const tdO = h("td"); const iO = h("input", "agenda-inp agenda-obs"); iO.type = "text"; iO.value = it.obs || ""; iO.placeholder = "opcional"; iO.disabled = soVista; iO.addEventListener("change", () => { it.obs = iO.value; }); tdO.appendChild(iO); tr.appendChild(tdO);
        // Remover (escondido na visualização do coordenador)
        const tdX = h("td"); if (!soVista) { const bx = h("button", "btn-excluir", "×"); bx.type = "button"; bx.title = "Remover atividade"; bx.addEventListener("click", () => { itens.splice(idx, 1); desenharLinhas(); recalcTotal(); }); tdX.appendChild(bx); } tr.appendChild(tdX);
        tb.appendChild(tr);
      });
      if (!itens.length) { const tr = h("tr"); const td = h("td"); td.colSpan = 7; td.appendChild(h("div", "coord-vazio", "Nenhuma atividade lançada neste dia. Adicione uma ou puxe do SIGE.")); tr.appendChild(td); tb.appendChild(tr); }
    }
    desenharLinhas(); recalcTotal();
    wrap.appendChild(t); card.appendChild(wrap);

    // Botões de ação
    const acoes = h("div", "agenda-acoes");
    const bAdd = h("button", "btn-cad-secundario", "+ Atividade"); bAdd.type = "button";
    bAdd.addEventListener("click", () => { itens.push({ atividade: (tipos[0] && tipos[0].nome) || "", horaInicio: "", horaFim: "", quantidade: 0, obs: "", auto: false }); desenharLinhas(); recalcTotal(); });
    const bPuxar = h("button", "btn-cad-secundario", "↻ Puxar do SIGE"); bPuxar.type = "button";
    bPuxar.title = "Adiciona as montagens de AEP/AET feitas no SIGE neste dia que ainda não estão na agenda.";
    bPuxar.addEventListener("click", () => {
      const autos = autoItens(email, dataAgenda);
      let add = 0;
      autos.forEach((a) => { if (!itens.some((it) => it.atividade === a.atividade)) { itens.push(a); add++; } });
      desenharLinhas(); recalcTotal();
      if (BI.avisar) BI.avisar(add ? (add + " atividade(s) puxada(s) do SIGE.") : "Nada novo no SIGE para este dia.");
    });
    const bSalvar = h("button", "btn-cad-principal", "Salvar o dia"); bSalvar.type = "button";
    const msg = h("span", "agenda-msg");
    bSalvar.addEventListener("click", async () => {
      if (!podeGravar()) { msg.textContent = "Banco indisponível nesta visualização."; msg.style.color = "#C62828"; return; }
      const limpos = itens.filter((it) => it.atividade);
      bSalvar.disabled = true; msg.style.color = "#1E6B44"; msg.textContent = "Salvando…";
      try {
        const ex = acharAgenda(email, dataAgenda);
        const doc = { EmpresaId: "GLOBAL", EmailErgonomista: email, Nome: nomeDe(email), Data: dataAgenda, Itens: limpos };
        await DB().salvar("agendaErgo", ex ? (ex._id || ex.id) : idAgenda(email, dataAgenda), doc, !ex);
        await recarregar(["agendaErgo"]);
        if (BI.avisar) BI.avisar("Agenda de " + dataBR(dataAgenda) + " salva.");
        renderMinhaAgenda(area2);
      } catch (e) { console.error("agenda salvar", e); msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    // Na visualização do coordenador (outro ergonomista), só mostra o total — sem editar.
    if (soVista) { acoes.appendChild(totalEl); }
    else { acoes.appendChild(bAdd); acoes.appendChild(bPuxar); acoes.appendChild(bSalvar); acoes.appendChild(totalEl); }
    card.appendChild(acoes);
    const rod = h("div", "agenda-rodape"); rod.appendChild(msg); card.appendChild(rod);

    area.innerHTML = "";
    area.appendChild(card);
  }

  // =================================================== Montar agendas (coordenador)
  function renderMontarAgendas(area) {
    area.innerHTML = "";
    if (!ehAdmin()) { area.appendChild(cartao("Montar agendas", null, h("div", "coord-vazio", "Área restrita ao coordenador."))); return; }

    // ---- Horas por dia da semana de cada ergonomista
    const ergos = ergonomistas();
    const card = h("div", "cartao col-12");
    card.appendChild(h("div", "cartao-titulo", "Horas por dia da semana"));
    card.appendChild(h("div", "coord-sub", "Defina quantas horas cada ergonomista atua em cada dia da semana (0 = dia que não atua) e vincule cada agenda ao usuário (login) que vai preenchê-la. O usuário vinculado passa a ver e editar essa agenda em “Minha agenda”. Essas horas são a referência (previsto) do Painel da agenda."));

    if (!ergos.length) { card.appendChild(h("div", "coord-vazio", "Cadastre os ergonomistas (com e-mail) em Cadastro Interno › Ergonomistas para montar as agendas.")); area.appendChild(card); return; }

    // V 2.10 (Alexandre): precisamos da lista de usuários (logins) para o vínculo. Se ainda
    // não carregou, dispara a busca e re-renderiza quando chegar.
    if (_usuariosCache === null) { carregarUsuarios().then(() => renderMontarAgendas(area)); }
    const usuarios = (_usuariosCache || []).slice().filter((u) => u && u.Email).sort((a, b) => String(a.Nome || a.Email).localeCompare(String(b.Nome || b.Email)));

    const wrap = h("div", "coord-tabela-wrap");
    const t = h("table", "coord-tabela agenda-cfg-tabela");
    const thead = h("thead"); const trh = h("tr");
    const cols = ["Ergonomista", "Usuário (login)"].concat(DIAS_CURTO).concat(["Semana"]);
    cols.forEach((c, i) => { const th = h("th", i > 1 ? "num" : null, c); trh.appendChild(th); });
    thead.appendChild(trh); t.appendChild(thead);
    const tb = h("tbody");
    const estado = {}; // ergoEmail -> [7]
    const vinculo = {}; // ergoEmail -> login escolhido
    ergos.forEach((e) => {
      const cfg = cfgDoErgo(e.email);
      estado[e.email] = (cfg && Array.isArray(cfg.horasPorDia)) ? [0, 1, 2, 3, 4, 5, 6].map((i) => n0(cfg.horasPorDia[i])) : horasPorDiaDe(e.email);
      // Vínculo atual: EmailUsuario salvo; se não houver, sugere o usuário com o mesmo e-mail do ergonomista.
      let loginAtual = (cfg && cfg.EmailUsuario) ? String(cfg.EmailUsuario).toLowerCase() : "";
      if (!loginAtual && usuarioPorEmail(e.email)) loginAtual = e.email;
      vinculo[e.email] = loginAtual;
      const tr = h("tr");
      tr.appendChild(h("td", null, e.nome));
      // Seletor de usuário (login) — define de quem é essa agenda.
      const tdU = h("td");
      const sel = h("select", "agenda-inp");
      const o0 = h("option", null, "— não vinculado —"); o0.value = ""; sel.appendChild(o0);
      usuarios.forEach((u) => { const em = String(u.Email || "").toLowerCase(); if (!em) return; const o = h("option", null, (u.Nome ? u.Nome + " — " : "") + em); o.value = em; if (em === loginAtual) o.selected = true; sel.appendChild(o); });
      sel.addEventListener("change", () => { vinculo[e.email] = String(sel.value || "").toLowerCase(); });
      tdU.appendChild(sel); tr.appendChild(tdU);
      const tdSemana = h("td", "num", "");
      function recalcSemana() { tdSemana.textContent = fmtHoras(estado[e.email].reduce((s, x) => s + x, 0) * 60); }
      for (let d = 0; d < 7; d++) {
        const td = h("td", "num");
        const i = h("input", "agenda-inp agenda-cfg-hora"); i.type = "number"; i.min = "0"; i.max = "24"; i.step = "0.5"; i.value = estado[e.email][d] || 0;
        i.addEventListener("change", () => { estado[e.email][d] = n0(i.value); recalcSemana(); });
        td.appendChild(i); tr.appendChild(td);
      }
      tr.appendChild(tdSemana); recalcSemana();
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); card.appendChild(wrap);

    const acoes = h("div", "agenda-acoes");
    const bSalvar = h("button", "btn-cad-principal", "Salvar horas"); bSalvar.type = "button";
    const msg = h("span", "agenda-msg");
    bSalvar.addEventListener("click", async () => {
      if (!podeGravar()) { msg.textContent = "Banco indisponível nesta visualização."; msg.style.color = "#C62828"; return; }
      bSalvar.disabled = true; msg.style.color = "#1E6B44"; msg.textContent = "Salvando…";
      try {
        for (const e of ergos) {
          // V 2.10 (Alexandre): a agenda é gravada pela conta de LOGIN vinculada (o backend
          // força EmailErgonomista = login de quem grava), então a config fica na chave do login.
          const login = vinculo[e.email] || "";
          const donoEmail = login || e.email; // sem vínculo, mantém a chave pelo e-mail do ergonomista
          const cfgAnt = cfgDoErgo(e.email);
          const doc = { EmpresaId: "GLOBAL", EmailErgonomista: donoEmail, EmailUsuario: login, ErgoRef: e.email, Nome: e.nome, horasPorDia: estado[e.email] };
          const alvo = acharCfg(donoEmail);
          await DB().salvar("agendaConfig", alvo ? (alvo._id || alvo.id) : idCfg(donoEmail), doc, !alvo);
          // Se o dono mudou, remove a config antiga (evita horas/agenda em duas chaves).
          if (cfgAnt && (cfgAnt._id || cfgAnt.id) !== idCfg(donoEmail)) {
            try { await DB().excluir("agendaConfig", cfgAnt._id || cfgAnt.id); } catch (e2) { console.error("limpar cfg antiga", e2); }
          }
        }
        await recarregar(["agendaConfig"]);
        if (BI.avisar) BI.avisar("Horas e vínculos das agendas salvos.");
        msg.textContent = "Salvo."; bSalvar.disabled = false;
        renderMontarAgendas(area);
      } catch (e) { console.error("cfg salvar", e); msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    acoes.appendChild(bSalvar); acoes.appendChild(msg);
    card.appendChild(acoes);
    area.appendChild(card);

    // ---- Tipos de atividade
    area.appendChild(renderCfgAtividades(area));
  }

  function renderCfgAtividades(area) {
    const card = h("div", "cartao col-12");
    card.appendChild(h("div", "cartao-titulo", "Tipos de atividade"));
    card.appendChild(h("div", "coord-sub", "Atividades que aparecem para o ergonomista escolher na agenda do dia. As marcadas como “SIGE” têm abastecimento automático (montagem de AEP/AET)."));
    let lista = tiposAtividade().map((x) => Object.assign({}, x));
    const wrap = h("div", "coord-tabela-wrap");
    const t = h("table", "coord-tabela"); const tb = h("tbody");
    const thead = h("thead"); const trh = h("tr"); ["Atividade", "Automático (SIGE)", ""].forEach((c) => trh.appendChild(h("th", null, c))); thead.appendChild(trh); t.appendChild(thead);
    function desenhar() {
      tb.innerHTML = "";
      lista.forEach((it, idx) => {
        const tr = h("tr");
        const tdN = h("td"); const iN = h("input", "agenda-inp"); iN.type = "text"; iN.value = it.nome || ""; iN.addEventListener("change", () => { it.nome = iN.value; }); tdN.appendChild(iN); tr.appendChild(tdN);
        const tdS = h("td", null, it.sige ? ("Sim (" + it.sige + ")") : "—"); tr.appendChild(tdS);
        const tdX = h("td"); const bx = h("button", "btn-excluir", "×"); bx.type = "button"; bx.addEventListener("click", () => { lista.splice(idx, 1); desenhar(); }); tdX.appendChild(bx); tr.appendChild(tdX);
        tb.appendChild(tr);
      });
    }
    desenhar(); t.appendChild(tb); wrap.appendChild(t); card.appendChild(wrap);
    const acoes = h("div", "agenda-acoes");
    const bAdd = h("button", "btn-cad-secundario", "+ Atividade"); bAdd.type = "button"; bAdd.addEventListener("click", () => { lista.push({ nome: "" }); desenhar(); });
    const bSalvar = h("button", "btn-cad-principal", "Salvar atividades"); bSalvar.type = "button";
    const msg = h("span", "agenda-msg");
    bSalvar.addEventListener("click", async () => {
      if (!podeGravar()) { msg.textContent = "Banco indisponível nesta visualização."; msg.style.color = "#C62828"; return; }
      const tipos = lista.filter((x) => x.nome && x.nome.trim()).map((x) => (x.sige ? { nome: x.nome.trim(), sige: x.sige } : { nome: x.nome.trim() }));
      bSalvar.disabled = true; msg.style.color = "#1E6B44"; msg.textContent = "Salvando…";
      try {
        const ex = docAtividades();
        await DB().salvar("configuracao", ex ? (ex._id || ex.id) : "agendaAtividades", { id: "agendaAtividades", EmpresaId: "GLOBAL", tipos: tipos }, !ex);
        await recarregar(["configuracao"]);
        if (BI.avisar) BI.avisar("Tipos de atividade salvos.");
        msg.textContent = "Salvo."; bSalvar.disabled = false;
      } catch (e) { console.error("atividades salvar", e); msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
    });
    acoes.appendChild(bAdd); acoes.appendChild(bSalvar); acoes.appendChild(msg);
    card.appendChild(acoes);
    return card;
  }

  // =================================================== Painel da agenda (coordenador)
  const graficos = {};
  function grafico(id, cfg) {
    if (typeof Chart === "undefined") return;
    const cv = document.getElementById(id); if (!cv) return;
    if (graficos[id]) { try { graficos[id].destroy(); } catch (e) {} }
    try { graficos[id] = new Chart(cv.getContext("2d"), cfg); requestAnimationFrame(() => { try { graficos[id] && graficos[id].resize(); } catch (e) {} }); } catch (e) { console.error("agenda grafico", e); }
  }

  // Horas previstas no mês para um ergonomista (soma das horas de cada dia da
  // semana em que ele atua, contando os dias do mês).
  function horasPrevistasMes(email, ano, mes) {
    const cfg = horasPorDiaDe(email);
    const dias = new Date(ano, mes + 1, 0).getDate();
    let h = 0;
    for (let d = 1; d <= dias; d++) { const wd = new Date(ano, mes, d).getDay(); h += cfg[wd]; }
    return h * 60; // minutos
  }
  // Agenda de um ergonomista num mês.
  function agendasDoMes(email, ano, mes) {
    const pref = "ag-" + slug(email) + "-" + ano + "-" + String(mes + 1).padStart(2, "0");
    return docsAgenda().filter((d) => String(d._id || d.id || "").indexOf(pref) === 0);
  }
  function minutosLancados(docs) { return docs.reduce((s, d) => s + (d.Itens || []).reduce((ss, it) => ss + duracaoMin(it.horaInicio, it.horaFim), 0), 0); }

  function renderPainel(area) {
    area.innerHTML = "";
    if (!ehAdmin()) { area.appendChild(cartao("Painel da agenda", null, h("div", "coord-vazio", "Área restrita ao coordenador."))); return; }
    if (_usuariosCache === null) { carregarUsuarios().then(() => renderPainel(area)); }
    const ergos = donosAgenda();

    // Barra de filtros (mês/ano + ergonomista)
    const card = h("div", "cartao col-12");
    const cab = h("div", "coord-cab"); cab.appendChild(h("div", "cartao-titulo", "Painel da agenda")); card.appendChild(cab);
    card.appendChild(h("div", "coord-sub", "Acompanhamento das agendas: horas previstas × lançadas, aderência e distribuição por atividade. Filtre por mês e por ergonomista."));
    const barra = h("div", "agenda-barra");
    const selMes = h("select", "agenda-inp"); MESES.forEach((m, i) => { const o = h("option", null, m); o.value = i; if (i === mesPainel) o.selected = true; selMes.appendChild(o); });
    const selAno = h("select", "agenda-inp"); const anos = new Set([2026, 2027, new Date().getFullYear(), anoPainel]); Array.from(anos).sort().forEach((a) => { const o = h("option", null, a); o.value = a; if (a === anoPainel) o.selected = true; selAno.appendChild(o); });
    const selErgo = h("select", "agenda-inp"); const oT = h("option", null, "Todos os ergonomistas"); oT.value = "__todos__"; selErgo.appendChild(oT); ergos.forEach((e) => { const o = h("option", null, e.nome); o.value = e.email; if (e.email === ergoPainel) o.selected = true; selErgo.appendChild(o); });
    selMes.addEventListener("change", () => { mesPainel = n0(selMes.value); render(); });
    selAno.addEventListener("change", () => { anoPainel = n0(selAno.value); render(); });
    selErgo.addEventListener("change", () => { ergoPainel = selErgo.value; render(); });
    barra.appendChild(selMes); barra.appendChild(selAno); barra.appendChild(selErgo);
    card.appendChild(barra);
    area.appendChild(card);

    const alvo = ergoPainel === "__todos__" ? ergos : ergos.filter((e) => e.email === ergoPainel);
    if (!alvo.length) { area.appendChild(cartao(null, null, h("div", "coord-vazio", "Cadastre os ergonomistas para acompanhar as agendas."))); return; }

    // Resumo por ergonomista
    const linhas = alvo.map((e) => {
      const docs = agendasDoMes(e.email, anoPainel, mesPainel);
      const lanc = minutosLancados(docs);
      const prev = horasPrevistasMes(e.email, anoPainel, mesPainel);
      const ader = prev > 0 ? lanc / prev : null;
      const dias = new Set(docs.map((d) => d.Data)).size;
      return { email: e.email, nome: e.nome, lanc, prev, ader, dias };
    });

    // KPIs gerais
    const totLanc = linhas.reduce((s, l) => s + l.lanc, 0);
    const totPrev = linhas.reduce((s, l) => s + l.prev, 0);
    const kcard = h("div", "cartao col-12");
    const kg = h("div", "coord-kpis");
    const kpi = (v, r) => { const d = h("div", "coord-kpi"); d.appendChild(h("div", "coord-kpi-valor", v)); d.appendChild(h("div", "coord-kpi-rot", r)); return d; };
    kg.appendChild(kpi(fmtHoras(totLanc), "Horas lançadas no mês"));
    kg.appendChild(kpi(fmtHoras(totPrev), "Horas previstas no mês"));
    kg.appendChild(kpi(totPrev > 0 ? Math.round(totLanc / totPrev * 100) + "%" : "—", "Aderência"));
    kg.appendChild(kpi(String(linhas.reduce((s, l) => s + l.dias, 0)), "Dias com lançamento"));
    kcard.appendChild(kg);
    area.appendChild(kcard);

    // Gráfico: previsto × lançado por ergonomista
    const gc = h("div", "cartao col-12");
    gc.appendChild(h("div", "cartao-titulo", "Previsto × lançado por ergonomista (horas)"));
    const box1 = h("div", "agenda-grafico-box"); const cv1 = h("canvas"); cv1.id = "agenda-prev-lanc"; box1.appendChild(cv1); gc.appendChild(box1);
    area.appendChild(gc);

    // Gráfico: distribuição por atividade
    const gc2 = h("div", "cartao col-12");
    gc2.appendChild(h("div", "cartao-titulo", "Distribuição por atividade (horas)"));
    const box2 = h("div", "agenda-grafico-box agenda-grafico-doughnut"); const cv2 = h("canvas"); cv2.id = "agenda-distrib"; box2.appendChild(cv2); gc2.appendChild(box2);
    area.appendChild(gc2);

    // Tabela de resumo
    const tcard = h("div", "cartao col-12");
    tcard.appendChild(h("div", "cartao-titulo", "Resumo por ergonomista"));
    const wrap = h("div", "coord-tabela-wrap"); const t = h("table", "coord-tabela");
    const thead = h("thead"); const trh = h("tr"); ["Ergonomista", "Dias", "Previsto", "Lançado", "Aderência"].forEach((c, i) => trh.appendChild(h("th", i > 0 ? "num" : null, c))); thead.appendChild(trh); t.appendChild(thead);
    const tb = h("tbody");
    linhas.sort((a, b) => b.lanc - a.lanc).forEach((l) => {
      const tr = h("tr");
      tr.appendChild(h("td", null, l.nome));
      tr.appendChild(h("td", "num", String(l.dias)));
      tr.appendChild(h("td", "num", fmtHoras(l.prev)));
      tr.appendChild(h("td", "num", fmtHoras(l.lanc)));
      const tdA = h("td", "num", l.ader == null ? "—" : Math.round(l.ader * 100) + "%");
      tdA.style.color = l.ader == null ? "#8a7a78" : (l.ader >= 0.95 ? "#1E6B44" : l.ader >= 0.75 ? "#E8731A" : "#C62828");
      tr.appendChild(tdA);
      tb.appendChild(tr);
    });
    if (!linhas.length) { const tr = h("tr"); const td = h("td"); td.colSpan = 5; td.appendChild(h("div", "coord-vazio", "Sem lançamentos no período.")); tr.appendChild(td); tb.appendChild(tr); }
    t.appendChild(tb); wrap.appendChild(t); tcard.appendChild(wrap);
    area.appendChild(tcard);

    // Desenha gráficos (no quadro seguinte, após o layout assentar)
    const CORES = ["#8E1B3A", "#1E6B44", "#2E5A88", "#E8731A", "#6A4C93", "#0E7C86", "#B23A48", "#4C956C", "#C9A227", "#5C6BC0", "#8D6E63", "#26A69A"];
    grafico("agenda-prev-lanc", {
      type: "bar",
      data: {
        labels: linhas.map((l) => l.nome),
        datasets: [
          { label: "Previsto", data: linhas.map((l) => Math.round(l.prev / 60 * 10) / 10), backgroundColor: "#cdbfc0" },
          { label: "Lançado", data: linhas.map((l) => Math.round(l.lanc / 60 * 10) / 10), backgroundColor: "#8E1B3A" },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: "horas" } } } },
    });

    // Distribuição por atividade (soma de durações no período, em todos os alvos)
    const porAtiv = {};
    alvo.forEach((e) => { agendasDoMes(e.email, anoPainel, mesPainel).forEach((d) => (d.Itens || []).forEach((it) => { const m = duracaoMin(it.horaInicio, it.horaFim); if (m > 0) porAtiv[it.atividade || "—"] = (porAtiv[it.atividade || "—"] || 0) + m; })); });
    const ativLabels = Object.keys(porAtiv).sort((a, b) => porAtiv[b] - porAtiv[a]);
    const ativTotal = ativLabels.reduce((s, k) => s + porAtiv[k], 0);
    grafico("agenda-distrib", {
      type: "doughnut",
      data: { labels: ativLabels, datasets: [{ data: ativLabels.map((k) => Math.round(porAtiv[k] / 60 * 10) / 10), backgroundColor: ativLabels.map((_, i) => CORES[i % CORES.length]) }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { generateLabels: (ch) => { const ds = ch.data.datasets[0]; return ch.data.labels.map((lb, i) => { const v = ds.data[i]; const p = ativTotal ? Math.round(porAtiv[lb] / ativTotal * 100) : 0; return { text: lb + " — " + v + "h (" + p + "%)", fillStyle: ds.backgroundColor[i], strokeStyle: ds.backgroundColor[i], index: i }; }); } } },
          datalabels: { display: (c) => { const ds = c.dataset.data; const tot = ds.reduce((s, x) => s + x, 0); return tot && (ds[c.dataIndex] / tot) >= 0.06; }, color: "#fff", formatter: (v) => { const p = ativTotal ? Math.round(v * 60 / ativTotal * 100) : 0; return p + "%"; }, font: { weight: "bold" } },
        },
      },
    });
  }

  // --------------------------------------------------- API pública
  BI.AgendaErgo = {
    render,
    subabas: () => subabasVisiveis().map((s) => ({ chave: s.chave, rotulo: s.rotulo })),
    subAtiva: () => subAtiva,
    abrir: (chave) => { const vis = subabasVisiveis(); if (vis.some((s) => s.chave === chave)) subAtiva = chave; render(); },
  };
})(window);
