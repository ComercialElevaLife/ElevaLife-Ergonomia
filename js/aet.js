/* ==========================================================================
   S.I.G.E - ElevaLife · V 1.34
   Modulo AET (Analise Ergonomica do Trabalho), modelo AET ElevaLife 2026.

   Uma AET e feita por posto de trabalho (Cliente > Unidade > Setor/GHE >
   Posto > Cargo/funcao) e tem varias ATIVIDADES. Em cada atividade o
   ergonomista descreve a tarefa, anexa fotos, identifica os fatores de risco
   (lista ISO/TS 20646 + "Outro"), aplica uma ou mais ferramentas ergonomicas
   (js/ferramentas.js) e propoe as acoes.

   Graduacao do fator (pedido do Alexandre, 08/10/2026):
     - ferramenta cuja metrica JA considera o tempo de exposicao: o resultado
       da ferramenta define o risco (graduacao equivalente na matriz do cliente);
     - ferramenta SEM tempo de exposicao: o resultado vira a severidade e e
       cruzado na matriz do cliente com a probabilidade (categoria de exposicao
       do modelo: % do limite de exposicao ocupacional na jornada);
     - sem ferramenta: severidade e probabilidade escolhidas pelo ergonomista.
     Com varias ferramentas, vale a maior graduacao.

   Gravacao: o documento da AET fica na colecao "aet" ("Tipo Registro" = "AET");
   cada fator vira uma linha do Inventario de Riscos (fatorRisco, Origem "AET",
   com a Atividade) e as acoes vao para o Plano de Acao (Origem "AET"). Depois
   de gravado, o risco vigente e o do Inventario (as reavaliacoes feitas ao
   concluir acoes valem); se as entradas do fator nao mudarem, a AET nao
   sobrescreve a graduacao reavaliada.
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const Calc = () => BI.Calc;
  const F = () => BI.Ferramentas;
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const clone = (o) => JSON.parse(JSON.stringify(o == null ? null : o));
  const T = (t) => (BI.Rotulos && BI.Rotulos.texto ? BI.Rotulos.texto(t) : t);
  const hojeISO = () => new Date().toISOString().slice(0, 10);
  const dataBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : iso || "");

  // Categorias de exposicao (probabilidade) por matriz - modelo AET ElevaLife 2026 (% do limite de exposicao
  // ocupacional - LEO - na jornada). Gerdau: tabela de indice de probabilidade do cliente (% do tempo amostral).
  const EXPOSICAO = {
    "Matriz 5x5": ["Muito baixa – exposições de 0% a 3% do LEO", "Baixa – exposições de 3% a 10% do LEO", "Moderada – exposições de 10% a 50% do LEO", "Alta – exposições de 50% a 70% do LEO", "Muito alta – exposições de 70% a 100% do LEO"],
    "Matriz 5x5 Gerdau": ["Muito baixa – menos de 10% do tempo amostral", "Baixa – entre 11% e 40% do tempo amostral", "Média – entre 41% e 70% do tempo amostral", "Alta – entre 71% e 80% do tempo amostral", "Muito alta – acima de 81% do tempo amostral"],
    "Matriz 4x4": ["Exposição a níveis muito baixos – menos de 10% do LEO", "Exposição baixa – de 10% a 50% do LEO", "Exposição moderada – de 50% a 70% do LEO", "Exposição excessiva – de 70% a 100% do LEO"],
    "Matriz 3x3": ["Baixa – menos de 10% do LEO", "Média – de 10% a 50% do LEO", "Alta – acima de 50% do LEO"],
  };
  const exposicaoDe = (mz) => EXPOSICAO[mz] || EXPOSICAO["Matriz 5x5"];

  const DEMANDAS = [
    ["estresse", "Estresse", "Não foram observadas situações de estresse no desenvolvimento das atividades."],
    ["sobrecarga", "Sobrecarga mental", "Não foram observadas nem relatadas situações que possam causar sobrecarga mental."],
    ["concentracao", "Nível de concentração, memória e atenção", "Os níveis de concentração, memória e atenção são adequados."],
    ["conflitos", "Conflitos hierárquicos", "Não foram observadas nem relatadas situações de conflitos."],
    ["comunicacao", "Comunicação", "Os meios de comunicação utilizados são adequados."],
    ["divergentes", "Demandas divergentes", "Não foram observadas nem relatadas demandas divergentes."],
    ["multiplas", "Múltiplas tarefas (alta demanda cognitiva)", "Não foram observadas situações de múltiplas tarefas."],
    ["autonomia", "Autonomia no trabalho", "Possui autonomia adequada para o desenvolvimento do trabalho."],
    ["insatisfacao", "Insatisfação no trabalho", "Não houve relatos de insatisfação no trabalho."],
  ];
  const ORGANIZACAO = [
    ["Jornada", "Jornada de trabalho", "Ex.: de segunda a sexta-feira, das 08h00 às 17h00."],
    ["Ritmo", "Ritmo de trabalho", "Ex.: ritmo ditado pela máquina, lento."],
    ["Rodizio", "Rotatividade de atividades", "Ex.: não há rodízio pré-estabelecido."],
    ["Necessidades", "Necessidades fisiológicas", "Ex.: pausa livre; bebedouro e banheiro próximos."],
    ["Pausas", "Micropausas e pausas", "Ex.: micropausas livres; cadeiras para alternância postural."],
  ];
  const AMBIENTE = [["Descricao Ambiente", "Descrição do ambiente"], ["Iluminacao", "Iluminação"], ["Ruido", "Ruído"], ["Temperatura", "Temperatura"]];

  function aetsNativas() { return (BI.dados.aet || []).filter((a) => a["Tipo Registro"] === "AET"); }
  function matrizDe(cliente) { return Calc().matrizDoCliente(BI.dados.cliente || [], cliente); }
  // graduacao da matriz mais proxima de um nivel 0-4 da ferramenta (empate: a maior)
  function nivelNaMatriz(mz, nivel) {
    const ns = Calc().niveisDaMatriz(mz); let melhor = ns[0], dist = 99;
    ns.forEach((n) => { const d = Math.abs(Calc().ordemNivel(n) - nivel); if (d < dist || (d === dist && Calc().ordemNivel(n) > Calc().ordemNivel(melhor))) { dist = d; melhor = n; } });
    return melhor;
  }
  function severidadeDeNivel(mz, nivel) { const esc = Calc().escalaDaMatriz(mz); return esc[Math.max(0, Math.min(esc.length - 1, Math.round(nivel * (esc.length - 1) / 4)))]; }
  function nivelDaFerramenta(item) {
    const def = F().porId(item.id); if (!def) return null;
    const r = F().calcular(item.id, item.valores || {});
    if (r.nivel != null && r.ok) return r.nivel;
    return item.nivelManual != null && item.nivelManual !== "" ? Number(item.nivelManual) : null;
  }
  const comExposicao = (item) => { const def = F().porId(item.id); return item.exposicao != null ? !!item.exposicao : !!(def && def.exposicao); };

  // Graduacao do fator a partir das ferramentas / escolhas do ergonomista.
  function avaliarFator(fa, mz) {
    const C = Calc(); const esc = C.escalaDaMatriz(mz);
    const itens = (fa.ferramentas || []).map((it) => ({ it, nivel: nivelDaFerramenta(it), exp: comExposicao(it) })).filter((x) => x.nivel != null);
    const comExp = itens.filter((x) => x.exp), semExp = itens.filter((x) => !x.exp);
    const cand = []; let crit = null, prob = null, pont = null; const partes = [];
    if (comExp.length) { const n = Math.max(...comExp.map((x) => x.nivel)); const gr = nivelNaMatriz(mz, n); cand.push(gr); partes.push(`ferramenta com tempo de exposição (${comExp.map((x) => F().porId(x.it.id).sigla).join(", ")}): ${gr}`); }
    if (semExp.length || !itens.length) {
      const pIdx = fa.exposicao != null && fa.exposicao !== "" ? Number(fa.exposicao) : null;
      prob = pIdx != null ? esc[pIdx] || null : null;
      crit = semExp.length ? severidadeDeNivel(mz, Math.max(...semExp.map((x) => x.nivel))) : (fa.severidade || null);
      if (crit && prob) { const gr = C.nivelDaMatriz(mz, prob, crit); pont = C.pontuacaoDaMatriz(mz, prob, crit); cand.push(gr); partes.push(semExp.length ? `${semExp.map((x) => F().porId(x.it.id).sigla).join(", ")} (severidade ${C.rotuloEscala(mz, crit, "severidade")}) × exposição ${C.rotuloEscala(mz, prob)}: ${gr}` : `severidade ${C.rotuloEscala(mz, crit, "severidade")} × probabilidade ${C.rotuloEscala(mz, prob)}: ${gr}`); }
    }
    const graduacao = cand.sort((a, b) => C.ordemNivel(b) - C.ordemNivel(a))[0] || "";
    const pendente = !graduacao ? (itens.length ? (semExp.length || !comExp.length ? "informe a probabilidade (exposição)" : "") : "informe a severidade e a probabilidade (exposição) ou aplique uma ferramenta") : "";
    return { graduacao, criticidade: crit, probabilidade: prob, pontuacao: pont, metodo: comExp.length && !semExp.length ? "ferramenta" : itens.length ? "ferramenta x exposicao" : "matriz", detalhe: partes.join(" · "), pendente };
  }
  const assinaturaFator = (fa) => JSON.stringify([fa.ferramentas || [], fa.exposicao == null ? "" : fa.exposicao, fa.severidade || ""]);
  const idFatorRow = (aetId, fa) => "aet-" + aetId + "-" + fa.uid;

  // ------------------------------------------------------------------ painel da aba AET
  function podeEditar() { const i = BI.DB && BI.DB.estado.identidade; return !(i && i.papel === "UsuarioCliente") && !(BI.DB && BI.DB.estado.somenteLeitura); }
  function riscoDaAET(a) {
    const fs = (BI.dados.fatorRisco || []).filter((f) => f["AET Id"] === (a._id || a.id) && Calc().riscoAtivo(f));
    return fs.map((f) => f["Graduacao Risco"]).filter(Boolean).sort((x, y) => Calc().ordemNivel(y) - Calc().ordemNivel(x))[0] || "";
  }
  function renderPainel() {
    const raiz = document.getElementById("aet-modulo"); if (!raiz) return;
    raiz.innerHTML = "";
    const cartao = h("div", "cartao col-12 aet-painel");
    const cab = h("div", "cadastro-cabecalho");
    const tit = h("div", "cartao-titulo", "Análises Ergonômicas do Trabalho (AET)"); cab.appendChild(tit);
    const lista = Calc().filtrar(aetsNativas(), BI.filtros, ["Data Analise"]).sort((a, b) => String(b["Data Analise"] || "").localeCompare(String(a["Data Analise"] || "")));
    tit.appendChild(h("span", "contagem-tabela", ` (${lista.length})`));
    const barra = h("div", "aet-botoes");
    if (podeEditar()) { const bn = h("button", "btn-novo-registro", "+ Nova AET"); bn.type = "button"; bn.addEventListener("click", () => abrirEditor(null)); barra.appendChild(bn); }
    const bl = h("button", "btn-cad-secundario", "📄 Emitir laudo da AET"); bl.type = "button";
    const cli = (BI.filtros && BI.filtros.Cliente) || [];
    bl.disabled = cli.length !== 1 || !lista.length || !podeEditar(); bl.title = cli.length !== 1 ? "Escolha um único cliente no filtro geral" : "Laudo da AET conforme o filtro (empresa toda, setor/GHE, cargo ou posto)";
    bl.addEventListener("click", () => BI.LaudoAET && BI.LaudoAET.abrirEmissao(cli[0]));
    barra.appendChild(bl); cab.appendChild(barra); cartao.appendChild(cab);
    cartao.appendChild(h("p", "aet-ajuda", "A AET é feita por posto de trabalho e cargo. Em cada atividade, descreva a tarefa, anexe as fotos, identifique os fatores de risco, aplique as ferramentas ergonômicas e proponha as ações. Os riscos vão para o Inventário de Riscos e as ações para o Plano de Ação, com a origem AET."));
    if (!lista.length) { cartao.appendChild(h("div", "plano-vazio", "Nenhuma AET para o filtro atual." + (podeEditar() ? " Clique em “+ Nova AET”." : ""))); raiz.appendChild(cartao); return; }
    const wrap = h("div", "tabela-scroll"); const tb = h("table", "tabela-dados");
    const trh = h("tr"); ["Nº", "Cliente", "Setor / GHE", "Posto", "Cargo", "Data", "Atividades", "Risco do posto", ""].forEach((c) => trh.appendChild(h("th", null, c)));
    const th = h("thead"); th.appendChild(trh); tb.appendChild(th); const tbody = h("tbody");
    lista.forEach((a) => {
      const tr = h("tr");
      [a["Nr AET"] ? "AET-" + String(a["Nr AET"]).padStart(3, "0") : "-", a.Cliente, a.Setor, a["Posto Trabalho"], a.Cargo, dataBR(a["Data Analise"]), String((a.Atividades || []).length)].forEach((x) => tr.appendChild(h("td", null, x || "-")));
      const r = riscoDaAET(a); const tdR = h("td"); if (r) { const p = h("span", "plano-pilula", r); const hx = Calc().corRiscoHex(r); if (hx) { p.style.background = "#" + hx; p.style.color = "#" + Calc().textoSobreHex(hx); } tdR.appendChild(p); } else tdR.textContent = "-"; tr.appendChild(tdR);
      const tdA = h("td", "aet-acoes-linha");
      const bA = h("button", "btn-cad-secundario", podeEditar() ? "Abrir" : "Ver"); bA.type = "button"; bA.addEventListener("click", () => abrirEditor(a)); tdA.appendChild(bA);
      if (podeEditar()) { const bX = h("button", "btn-excluir", "Excluir"); bX.type = "button"; bX.addEventListener("click", () => excluirAET(a)); tdA.appendChild(bX); }
      tr.appendChild(tdA); tbody.appendChild(tr);
    });
    tb.appendChild(tbody); wrap.appendChild(tb); cartao.appendChild(wrap); raiz.appendChild(cartao);
  }

  async function excluirAET(a) {
    if (!window.confirm(`Excluir a AET de ${a["Posto Trabalho"] || ""} (${a.Cargo || ""})? Os fatores de risco dela saem do Inventário; as ações já trabalhadas no Plano de Ação ficam como histórico.`)) return;
    const id = a._id || a.id;
    try {
      for (const f of (BI.dados.fatorRisco || []).filter((x) => x["AET Id"] === id)) {
        for (const ac of (BI.dados.planoAcao || []).filter((p) => p["Fator Risco Id"] === f._id)) { if (acaoIntocada(ac)) await BI.DB.excluir("planoAcao", ac._id); }
        await BI.DB.excluir("fatorRisco", f._id);
      }
      await BI.DB.excluir("aet", id);
      if (BI.recarregar) await BI.recarregar(); renderPainel();
    } catch (e) { window.alert("Não foi possível excluir: " + (e && e.message ? e.message : e)); }
  }
  const acaoIntocada = (r) => !r["Responsavel Acao"] && !r["E-mail Responsavel"] && !r["Dt Programada"] && !r["Dt Conclusao"] && (!r["Status Execucao"] || r["Status Execucao"] === "Nao iniciada") && !(Array.isArray(r.Evidencias) && r.Evidencias.length);

  // ------------------------------------------------------------------ editor
  function novaAET() {
    const f = BI.filtros || {}; const um = (d) => (f[d] && f[d].length === 1 ? f[d][0] : "");
    const i = BI.DB && BI.DB.estado.identidade; const erg = (BI.dados.ergonomista || []).find((e) => i && e.Email && e.Email.toLowerCase() === String(i.email || "").toLowerCase());
    const d = { "Tipo Registro": "AET", Cliente: um("Cliente"), Unidade: um("Unidade"), Setor: um("Setor"), "Posto Trabalho": um("Posto Trabalho"), Cargo: um("Cargo"), "Data Analise": hojeISO(), Ergonomista: erg ? erg.Nome : "", Demandas: {}, Medicoes: [], Ciclos: [], Cargas: [], Atividades: [], "Foto Geral": [] };
    DEMANDAS.forEach(([k, , t]) => { d.Demandas[k] = t; });
    d.Medicoes = [{ fator: "Iluminação", medicao: "", parametro: "300 lux (NHO-11)", condicao: "" }, { fator: "Ruído", medicao: "", parametro: "até 65 dB(A)", condicao: "" }, { fator: "Temperatura", medicao: "", parametro: "Entre 18 °C e 25 °C", condicao: "" }];
    return d;
  }
  function novaAtividade(n) { return { uid: uid(), nome: "Atividade " + String(n).padStart(2, "0"), descricao: "", fotos: [], fatores: [], recomendacoes: "" }; }
  function novoFator() { return { uid: uid(), grupo: "", fator: "", outro: "", consequencia: "", segmento: "", fonte: "", ferramentas: [], exposicao: "", severidade: "" }; }

  function abrirEditor(aet) {
    const editar = podeEditar();
    const st = aet ? clone(Object.assign({}, aet)) : novaAET();
    const idAET = aet ? (aet._id || aet.id) : null;
    ["Demandas"].forEach((k) => { st[k] = st[k] || {}; }); ["Medicoes", "Ciclos", "Cargas", "Atividades", "Foto Geral"].forEach((k) => { st[k] = Array.isArray(st[k]) ? st[k] : []; });
    const editores = new Map(); // uid do fator -> editor de acoes
    let sujo = false; const marcar = () => { sujo = true; };

    const fundo = h("div", "aet-overlay"); const caixa = h("div", "aet-editor"); fundo.appendChild(caixa);
    const topo = h("div", "aet-topo"); const titulo = h("div", "aet-topo-titulo"); topo.appendChild(titulo);
    const acoesTopo = h("div", "aet-topo-acoes"); const msg = h("div", "aet-msg"); msg.hidden = true;
    const bFechar = h("button", "btn-cad-secundario", "Fechar"); bFechar.type = "button";
    const bSalvar = h("button", "btn-cad-primario", "Salvar AET"); bSalvar.type = "button"; bSalvar.hidden = !editar;
    acoesTopo.appendChild(bFechar); acoesTopo.appendChild(bSalvar); topo.appendChild(acoesTopo);
    caixa.appendChild(topo); caixa.appendChild(msg);
    const corpo = h("div", "aet-corpo"); const nav = h("nav", "aet-nav"); const area = h("div", "aet-area"); corpo.appendChild(nav); corpo.appendChild(area); caixa.appendChild(corpo);
    document.body.appendChild(fundo); document.body.classList.add("aet-aberta");
    const fechar = () => { if (sujo && editar && !window.confirm("Há alterações não salvas na AET. Fechar mesmo assim?")) return; fundo.remove(); document.body.classList.remove("aet-aberta"); };
    bFechar.addEventListener("click", fechar);
    const atualizarTitulo = () => { titulo.textContent = `AET${st["Nr AET"] ? " " + String(st["Nr AET"]).padStart(3, "0") : " (nova)"} · ${[st.Setor, st["Posto Trabalho"], st.Cargo].filter(Boolean).join(" › ") || "posto não definido"}`; };

    // -------- helpers de campo
    const campoTexto = (obj, chave, rot, opc) => {
      opc = opc || {}; const d = h("label", "aet-campo" + (opc.largo ? " aet-campo--largo" : "")); d.appendChild(h("span", "aet-rot", rot));
      const el = opc.linhas ? h("textarea") : h("input"); if (opc.linhas) el.rows = opc.linhas; else el.type = opc.tipo || "text";
      el.value = obj[chave] != null ? obj[chave] : ""; if (opc.ph) el.placeholder = opc.ph; el.disabled = !editar;
      el.addEventListener("input", () => { obj[chave] = el.type === "number" ? (el.value === "" ? null : Number(el.value)) : el.value; marcar(); if (opc.aoMudar) opc.aoMudar(); });
      d.appendChild(el); return d;
    };
    const campoSelect = (obj, chave, rot, opcoes, aoMudar, opc) => {
      opc = opc || {}; const d = h("label", "aet-campo" + (opc.largo ? " aet-campo--largo" : "")); d.appendChild(h("span", "aet-rot", rot));
      const s = h("select"); const o0 = h("option", null, opc.vazio || "-"); o0.value = ""; s.appendChild(o0);
      opcoes.forEach((o) => { const op = h("option", null, Array.isArray(o) ? o[1] : o); op.value = Array.isArray(o) ? o[0] : o; s.appendChild(op); });
      s.value = obj[chave] != null ? String(obj[chave]) : ""; if (s.value !== String(obj[chave] == null ? "" : obj[chave]) && obj[chave]) { const op = h("option", null, obj[chave]); op.value = obj[chave]; s.appendChild(op); s.value = obj[chave]; }
      s.disabled = !editar || !!opc.desabilitado;
      s.addEventListener("change", () => { obj[chave] = s.value; marcar(); if (aoMudar) aoMudar(s.value); });
      d.appendChild(s); return d;
    };
    const secao = (id, rot) => { const s = h("section", "aet-secao"); s.id = "aet-sec-" + id; s.appendChild(h("h3", "aet-secao-titulo", rot)); const b = h("a", null, rot); b.href = "#"; b.addEventListener("click", (ev) => { ev.preventDefault(); s.scrollIntoView({ behavior: "smooth", block: "start" }); }); nav.appendChild(b); area.appendChild(s); return s; };
    const grade = (pai) => { const gr = h("div", "aet-grade"); pai.appendChild(gr); return gr; };
    async function enviarFotos(lista, input, depois) {
      const emp = (BI.dados.cliente || []).find((c) => c.Cliente === st.Cliente); const empresaId = emp ? (emp.id || emp._id) : null;
      if (!empresaId) { window.alert("Escolha o cliente antes de anexar fotos."); return; }
      for (const arq of Array.from(input.files || [])) {
        if (!/^image\/(jpeg|png)$/.test(arq.type)) { window.alert(`${arq.name}: use JPG ou PNG.`); continue; }
        try { const r = await BI.DB.enviarArquivo("aet", empresaId, arq); lista.push({ chave: r.chave, nomeArquivo: r.nomeArquivo || arq.name }); marcar(); } catch (e) { window.alert(`Não foi possível enviar ${arq.name}: ${e && e.message ? e.message : e}`); }
      }
      input.value = ""; depois();
    }
    const blocoFotos = (lista, max, rot) => {
      const d = h("div", "aet-fotos"); d.appendChild(h("span", "aet-rot", rot));
      const linha = h("div", "aet-fotos-linha"); d.appendChild(linha);
      const desenhar = () => {
        linha.innerHTML = "";
        lista.forEach((f, i) => { const c = h("div", "aet-foto"); const img = h("img"); img.src = BI.DB.urlArquivo(f.chave); img.alt = f.nomeArquivo || "foto"; c.appendChild(img); const leg = h("input"); leg.type = "text"; leg.placeholder = "Legenda (opcional)"; leg.value = f.legenda || ""; leg.disabled = !editar; leg.addEventListener("input", () => { f.legenda = leg.value; marcar(); }); c.appendChild(leg);
          if (editar) { const x = h("button", "aet-foto-x", "×"); x.type = "button"; x.title = "Remover"; x.addEventListener("click", () => { lista.splice(i, 1); marcar(); desenhar(); }); c.appendChild(x); } linha.appendChild(c); });
        if (editar && lista.length < max) { const lb = h("label", "aet-foto-add"); lb.appendChild(h("span", null, "+ Foto")); const inp = h("input"); inp.type = "file"; inp.accept = "image/jpeg,image/png"; inp.multiple = true; inp.addEventListener("change", () => enviarFotos(lista, inp, desenhar)); lb.appendChild(inp); linha.appendChild(lb); }
      };
      desenhar(); return d;
    };
    const tabelaEditavel = (lista, cols, rot, novo) => {
      const d = h("div", "aet-tabela"); if (rot) d.appendChild(h("div", "aet-subtitulo", rot));
      const tb = h("table", "tabela-dados aet-tab"); d.appendChild(tb);
      const desenhar = () => {
        tb.innerHTML = ""; const tr0 = h("tr"); cols.forEach(([, r]) => tr0.appendChild(h("th", null, r))); if (editar) tr0.appendChild(h("th", null, "")); const th = h("thead"); th.appendChild(tr0); tb.appendChild(th);
        const tbody = h("tbody");
        lista.forEach((row, i) => { const tr = h("tr"); cols.forEach(([k]) => { const td = h("td"); const inp = h("input"); inp.type = "text"; inp.value = row[k] || ""; inp.disabled = !editar; inp.addEventListener("input", () => { row[k] = inp.value; marcar(); }); td.appendChild(inp); tr.appendChild(td); });
          if (editar) { const td = h("td"); const x = h("button", "btn-excluir", "Excluir"); x.type = "button"; x.addEventListener("click", () => { lista.splice(i, 1); marcar(); desenhar(); }); td.appendChild(x); tr.appendChild(td); } tbody.appendChild(tr); });
        tb.appendChild(tbody);
      };
      desenhar();
      if (editar) { const b = h("button", "btn-cad-secundario aet-add", "+ Linha"); b.type = "button"; b.addEventListener("click", () => { lista.push(novo()); marcar(); desenhar(); }); d.appendChild(b); }
      return d;
    };

    // -------- desenho completo
    function desenhar() {
      nav.innerHTML = ""; area.innerHTML = ""; atualizarTitulo();
      const C = Calc(); const mz = matrizDe(st.Cliente);
      // 1. Identificacao
      const s1 = secao("id", "1. Identificação"); const g1 = grade(s1);
      const cargos = (BI.dados.cargo || []);
      const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
      const clientes = uniq((BI.dados.cliente || []).map((c) => c.Cliente));
      const filtroC = (d) => cargos.filter((c) => (!st.Cliente || c.Cliente === st.Cliente) && (d < 1 || !st.Unidade || c.Unidade === st.Unidade) && (d < 2 || !st.Setor || c.Setor === st.Setor) && (d < 3 || !st["Posto Trabalho"] || c["Posto Trabalho"] === st["Posto Trabalho"]));
      const casc = (k, nivel) => () => { ["Unidade", "Setor", "Posto Trabalho", "Cargo"].slice(nivel).forEach((x) => { st[x] = ""; }); desenhar(); };
      g1.appendChild(campoSelect(st, "Cliente", "Cliente *", clientes, casc("Cliente", 0), { desabilitado: !!idAET }));
      g1.appendChild(campoSelect(st, "Unidade", "Unidade *", uniq(filtroC(0).map((c) => c.Unidade)), casc("Unidade", 1)));
      g1.appendChild(campoSelect(st, "Setor", "Setor / GHE *", uniq(filtroC(1).map((c) => c.Setor)), casc("Setor", 2)));
      g1.appendChild(campoSelect(st, "Posto Trabalho", "Posto de trabalho *", uniq(filtroC(2).map((c) => c["Posto Trabalho"])), casc("Posto Trabalho", 3)));
      g1.appendChild(campoSelect(st, "Cargo", "Cargo / função *", uniq(filtroC(3).map((c) => c.Cargo)), atualizarTitulo));
      g1.appendChild(campoTexto(st, "Data Analise", "Data da análise *", { tipo: "date" }));
      g1.appendChild(campoSelect(st, "Ergonomista", "Ergonomista responsável pela análise", uniq((BI.dados.ergonomista || []).map((e) => e.Nome))));
      s1.appendChild(h("p", "aet-nota", `Matriz de risco do cliente: ${mz}. O cadastro de unidade, setor/GHE, posto e cargo é o do Cadastro Cliente.`));
      // 2. Setor e populacao
      const s2 = secao("setor", "2. Setor, população e cargo"); const g2 = grade(s2);
      g2.appendChild(campoTexto(st, "Descricao Setor", "Descrição do setor", { linhas: 4, largo: true }));
      g2.appendChild(campoTexto(st, "Populacao Total", "População (colaboradores)", { tipo: "number" }));
      g2.appendChild(campoTexto(st, "Populacao Masculina", "Sexo masculino", { tipo: "number" }));
      g2.appendChild(campoTexto(st, "Populacao Feminina", "Sexo feminino", { tipo: "number" }));
      g2.appendChild(campoTexto(st, "Descricao Cargo", "Descrição do cargo / atividades (uma por linha)", { linhas: 4, largo: true }));
      // 3. Organizacao
      const s3 = secao("org", "3. Análise da organização do trabalho"); const g3 = grade(s3);
      ORGANIZACAO.forEach(([k, r, ph]) => g3.appendChild(campoTexto(st, k, r, { linhas: 2, ph, largo: true })));
      // 4. Demandas cognitivas
      const s4 = secao("cog", "4. Demandas cognitivas e psicossociais"); const g4 = grade(s4);
      DEMANDAS.forEach(([k, r]) => g4.appendChild(campoTexto(st.Demandas, k, r, { linhas: 2, largo: true })));
      // 5. Posto
      const s5 = secao("posto", "5. Análise do posto de trabalho"); const g5 = grade(s5);
      g5.appendChild(campoTexto(st, "Descricao Posto", "Posto de trabalho (equipamentos, cargas e pesos, dimensões)", { linhas: 4, largo: true }));
      s5.appendChild(blocoFotos(st["Foto Geral"], 2, "Visão geral do posto de trabalho (foto geral)"));
      // 6. Ambiente
      const s6 = secao("amb", "6. Análise do ambiente (conforto)"); const g6 = grade(s6);
      AMBIENTE.forEach(([k, r]) => g6.appendChild(campoTexto(st, k, r, { linhas: 2, largo: true })));
      s6.appendChild(tabelaEditavel(st.Medicoes, [["fator", "Fator"], ["local", "Local / medição"], ["medicao", "Medição"], ["parametro", "Parâmetro"], ["condicao", "Condição"]], "Medições ambientais (NR-17, item 17.8, e NHO 11)", () => ({ fator: "", local: "", medicao: "", parametro: "", condicao: "" })));
      const g6b = grade(s6); g6b.appendChild(campoTexto(st, "Consideracoes Ambiente", "Considerações técnicas e observações (ex.: avaliação qualitativa do ruído)", { linhas: 3, largo: true }));
      // 7. Manifestacoes, ciclo e cargas
      const s7 = secao("manif", "7. Manifestações, ciclo de trabalho e cargas"); const g7 = grade(s7);
      g7.appendChild(campoTexto(st, "Manifestacoes", "Manifestações dos trabalhadores", { linhas: 3, largo: true }));
      s7.appendChild(tabelaEditavel(st.Ciclos, [["atividade", "Atividade"], ["tempo", "Tempo do ciclo"], ["ciclos", "Nº de ciclos por turno"]], "Ciclo de trabalho", () => ({ atividade: "", tempo: "", ciclos: "" })));
      s7.appendChild(tabelaEditavel(st.Cargas, [["carga", "Carga movimentada"], ["peso", "Peso da carga"], ["padrao", "Padrão da movimentação"], ["vezes", "Nº de movimentações na jornada"]], "Movimentação manual de carga", () => ({ carga: "", peso: "", padrao: "", vezes: "" })));
      // 8. Atividades
      const s8 = secao("ativ", "8. Atividades – análise sistemática dos fatores de risco");
      s8.appendChild(h("p", "aet-nota", "Cadastre cada atividade do posto: descrição detalhada (processo, pesos, alturas, distâncias, tempos de exposição), fotos, fatores de risco com as ferramentas ergonômicas e as ações. Depois passe para a próxima atividade."));
      st.Atividades.forEach((at, ai) => s8.appendChild(cartaoAtividade(at, ai, mz)));
      if (editar) { const b = h("button", "btn-cad-primario aet-add", "+ Adicionar atividade"); b.type = "button"; b.addEventListener("click", () => { st.Atividades.push(novaAtividade(st.Atividades.length + 1)); marcar(); desenhar(); const ult = area.querySelector(".aet-atividade:last-of-type"); if (ult) ult.scrollIntoView({ behavior: "smooth" }); }); s8.appendChild(b); }
      // 9. Diagnostico
      const s9 = secao("diag", "9. Diagnóstico global"); const g9 = grade(s9);
      const cDiag = campoTexto(st, "Diagnostico Global", "Diagnóstico global do posto", { linhas: 4, largo: true }); g9.appendChild(cDiag);
      if (editar) { const b = h("button", "btn-cad-secundario", "Sugerir texto a partir das atividades"); b.type = "button"; b.addEventListener("click", () => { st["Diagnostico Global"] = sugerirDiagnostico(st, mz); cDiag.querySelector("textarea").value = st["Diagnostico Global"]; marcar(); }); s9.appendChild(b); }
    }

    function cartaoAtividade(at, ai, mz) {
      const C = Calc(); const card = h("div", "aet-atividade");
      const cab = h("div", "aet-ativ-cab"); cab.appendChild(h("strong", null, `Atividade ${String(ai + 1).padStart(2, "0")}`));
      if (editar) { const x = h("button", "btn-excluir", "Excluir atividade"); x.type = "button"; x.addEventListener("click", () => { if (!window.confirm(`Excluir a atividade “${at.nome}” e os seus fatores?`)) return; st.Atividades.splice(ai, 1); marcar(); desenhar(); }); cab.appendChild(x); }
      card.appendChild(cab);
      const gA = grade(card); gA.appendChild(campoTexto(at, "nome", "Nome da atividade *", { aoMudar: () => {} }));
      gA.appendChild(campoTexto(at, "descricao", "Descrição detalhada da atividade (processo, pesos, alturas, distâncias, tempos de exposição, duração)", { linhas: 5, largo: true }));
      card.appendChild(blocoFotos(at.fotos, 4, "Registro fotográfico da atividade (até 4 fotos)"));
      card.appendChild(h("div", "aet-subtitulo", "Fatores de risco da atividade"));
      at.fatores.forEach((fa, fi) => card.appendChild(cartaoFator(at, fa, fi, mz)));
      if (editar) { const b = h("button", "btn-cad-secundario aet-add", "+ Fator de risco"); b.type = "button"; b.addEventListener("click", () => { at.fatores.push(novoFator()); marcar(); desenhar(); }); card.appendChild(b); }
      const gR = grade(card); gR.appendChild(campoTexto(at, "recomendacoes", "Recomendações específicas (texto complementar às ações)", { linhas: 3, largo: true }));
      return card;
    }

    function cartaoFator(at, fa, fi, mz) {
      const C = Calc(); const card = h("div", "aet-fator");
      const cab = h("div", "aet-fator-cab"); const tit = h("strong", null, `Fator ${fi + 1}`); cab.appendChild(tit);
      const pill = h("span", "plano-pilula aet-grau"); cab.appendChild(pill);
      if (editar) { const x = h("button", "btn-excluir", "Excluir fator"); x.type = "button"; x.addEventListener("click", () => { if (!window.confirm("Excluir este fator de risco (e as ações dele ainda não trabalhadas)?")) return; at.fatores.splice(fi, 1); editores.delete(fa.uid); marcar(); desenhar(); }); cab.appendChild(x); }
      card.appendChild(cab);
      const detalhe = h("div", "aet-grau-detalhe");
      const pintar = () => {
        const r = avaliarFator(fa, mz); fa._av = r;
        pill.textContent = r.graduacao || "sem graduação"; const hx = r.graduacao ? C.corRiscoHex(r.graduacao) : null; pill.style.background = hx ? "#" + hx : ""; pill.style.color = hx ? "#" + C.textoSobreHex(hx) : "";
        detalhe.textContent = r.graduacao ? `Risco do fator: ${r.graduacao}${r.pontuacao != null ? " (pontuação " + r.pontuacao + ")" : ""} · ${r.detalhe}` : "Pendente: " + r.pendente;
        const ed = editores.get(fa.uid); if (ed) ed.atualizarNivel();
        tit.textContent = `Fator ${fi + 1}${fa.fator ? " · " + (fa.fator === "__outro" ? fa.outro || "outro" : fa.fator) : ""}`;
      };
      const g = grade(card);
      const grupos = C.GRUPOS_FATOR_RISCO || [];
      g.appendChild(campoSelect(fa, "grupo", "Grupo de fatores (ISO/TS 20646) *", grupos, () => { fa.fator = ""; desenhar(); }));
      const lista = fa.grupo ? C.fatoresDoGrupo(fa.grupo) : [];
      g.appendChild(campoSelect(fa, "fator", "Fator de risco *", lista.map((x) => [x, x]).concat([["__outro", "Outro (digitar)"]]), () => desenhar()));
      if (fa.fator === "__outro") g.appendChild(campoTexto(fa, "outro", "Qual fator? *", { aoMudar: pintar }));
      const conseq = fa.fator && fa.fator !== "__outro" ? C.consequenciasDoFator(fa.fator) : [];
      const cC = campoTexto(fa, "consequencia", "Consequência (ex.: biomecânica – coluna lombar) *", { largo: true }); g.appendChild(cC);
      if (conseq.length && editar) { const s = h("select", "aet-sugestao"); const o0 = h("option", null, "Sugestões da lista padrão…"); o0.value = ""; s.appendChild(o0); conseq.forEach((c) => { const o = h("option", null, c); o.value = c; s.appendChild(o); }); s.addEventListener("change", () => { if (!s.value) return; const inp = cC.querySelector("input"); inp.value = inp.value ? inp.value + "; " + s.value : s.value; fa.consequencia = inp.value; s.value = ""; marcar(); }); cC.appendChild(s); }
      g.appendChild(campoSelect(fa, "segmento", "Segmento acometido *", (BI.Acoes ? BI.Acoes.segmentosDisponiveis() : [])));
      g.appendChild(campoTexto(fa, "fonte", "Fonte geradora / observação", { largo: true }));
      // ferramentas
      const blocoF = h("div", "aet-ferramentas"); blocoF.appendChild(h("div", "aet-subtitulo", "Ferramentas ergonômicas (metodologia de estudo)"));
      const listaF = h("div", "aet-ferr-lista"); blocoF.appendChild(listaF);
      const desenharFerr = () => {
        listaF.innerHTML = "";
        if (!fa.ferramentas.length) listaF.appendChild(h("div", "aet-nota", "Nenhuma ferramenta aplicada: informe a severidade e a probabilidade abaixo."));
        fa.ferramentas.forEach((it, ii) => {
          const def = F().porId(it.id); const r = F().calcular(it.id, it.valores || {}); const linha = h("div", "aet-ferr-item");
          linha.appendChild(h("strong", null, def ? def.sigla : it.id));
          const nv = r.ok && r.nivel != null ? r.nivel : (it.nivelManual !== "" && it.nivelManual != null ? Number(it.nivelManual) : null);
          linha.appendChild(h("span", "aet-ferr-res", r.ok ? `${r.pontuacao} · ${r.classe}${nv != null ? " → nível " + F().NIVEIS[nv].toLowerCase() : ""}` : r.classe));
          linha.appendChild(h("span", "aet-ferr-exp", comExposicao(it) ? "define o risco (considera exposição)" : "cruza com a exposição"));
          const bE = h("button", "btn-cad-secundario", editar ? "Preencher" : "Ver"); bE.type = "button"; bE.addEventListener("click", () => abrirFerramenta(it, () => { marcar(); desenharFerr(); pintar(); desenharExp(); })); linha.appendChild(bE);
          if (editar) { const x = h("button", "btn-excluir", "Remover"); x.type = "button"; x.addEventListener("click", () => { fa.ferramentas.splice(ii, 1); marcar(); desenharFerr(); pintar(); desenharExp(); }); linha.appendChild(x); }
          listaF.appendChild(linha);
        });
        if (editar) {
          const add = h("div", "aet-ferr-add"); const s = h("select"); const o0 = h("option", null, "+ Aplicar ferramenta…"); o0.value = ""; s.appendChild(o0);
          F().LISTA.forEach((d) => { const o = h("option", null, d.nome); o.value = d.id; s.appendChild(o); });
          s.addEventListener("change", () => { if (!s.value) return; const it = { id: s.value, valores: {}, exposicao: null, nivelManual: "" }; fa.ferramentas.push(it); s.value = ""; marcar(); desenharFerr(); pintar(); desenharExp(); abrirFerramenta(it, () => { marcar(); desenharFerr(); pintar(); desenharExp(); }); });
          add.appendChild(s); listaF.appendChild(add);
        }
      };
      card.appendChild(blocoF);
      // severidade / exposicao (quando necessario)
      const blocoExp = h("div", "aet-grade"); card.appendChild(blocoExp);
      const desenharExp = () => {
        blocoExp.innerHTML = "";
        const itens = fa.ferramentas.filter((it) => nivelDaFerramenta(it) != null);
        const precisaProb = !itens.length || itens.some((it) => !comExposicao(it));
        if (!itens.length) blocoExp.appendChild(campoSelect(fa, "severidade", "Severidade *", C.escalaDaMatriz(mz).map((v) => [v, C.rotuloEscala(mz, v, "severidade")]), pintar));
        if (precisaProb) blocoExp.appendChild(campoSelect(fa, "exposicao", "Probabilidade – exposição na jornada *", exposicaoDe(mz).map((t, i) => [String(i), t]), pintar, { largo: true }));
      };
      desenharFerr(); desenharExp();
      card.appendChild(detalhe);
      // acoes
      card.appendChild(h("div", "aet-subtitulo", "Ações / recomendações para o fator"));
      let ed = editores.get(fa.uid);
      if (!ed && BI.Acoes) {
        const rowId = idAET ? idFatorRow(idAET, fa) : null;
        ed = BI.Acoes.criarEditor({
          fatorId: rowId, podeEditar: editar, origem: "AET",
          contexto: () => ({ Cliente: st.Cliente, Unidade: st.Unidade, Setor: st.Setor, Cargo: st.Cargo, "Posto Trabalho": st["Posto Trabalho"], Atividade: at.nome }),
          nivelAtual: () => (fa._av && fa._av.graduacao) || "", matriz: () => matrizDe(st.Cliente),
          nomeFator: () => (fa.fator === "__outro" ? fa.outro : fa.fator) || "", segmento: () => fa.segmento,
          aoMudar: marcar,
        });
        editores.set(fa.uid, ed);
      }
      if (ed) card.appendChild(ed.el);
      pintar();
      return card;
    }

    function abrirFerramenta(it, depois) {
      const def = F().porId(it.id); if (!def) return;
      const fundo2 = h("div", "aet-modal-fundo"); const cx = h("div", "aet-modal");
      cx.appendChild(h("div", "aet-modal-titulo", def.nome)); cx.appendChild(h("div", "aet-nota", def.ref));
      let valores = clone(it.valores || {});
      const resBox = h("div", "aet-ferr-resultado");
      const mostrar = () => { const r = F().calcular(it.id, valores); resBox.innerHTML = ""; resBox.appendChild(h("strong", null, r.ok ? `${r.pontuacao} – ${r.classe}` : r.classe)); (r.memorial || []).forEach(([k, v]) => { const l = h("div"); l.appendChild(h("span", "aet-rot", k + ": ")); l.appendChild(document.createTextNode(v)); resBox.appendChild(l); }); manual.hidden = !(def.manual || (r.ok && r.nivel == null)); };
      const form = F().formulario(it.id, valores, (v) => { valores = v; mostrar(); }, !editar);
      cx.appendChild(form);
      const opc = h("div", "aet-grade");
      const exp = h("label", "aet-check"); const cb = h("input"); cb.type = "checkbox"; cb.checked = comExposicao(it); cb.disabled = !editar; exp.appendChild(cb); exp.appendChild(document.createTextNode(" A métrica desta ferramenta já considera o tempo de exposição (o resultado define o risco)")); opc.appendChild(exp);
      const manual = h("label", "aet-campo"); manual.appendChild(h("span", "aet-rot", "Nível atribuído pelo ergonomista (a ferramenta não classifica)")); const sm = h("select"); [["", "-"]].concat(F().NIVEIS.map((n, i) => [String(i), n])).forEach(([v, t]) => { const o = h("option", null, t); o.value = v; sm.appendChild(o); }); sm.value = it.nivelManual != null ? String(it.nivelManual) : ""; sm.disabled = !editar; manual.appendChild(sm); opc.appendChild(manual);
      cx.appendChild(opc); cx.appendChild(resBox);
      const barra = h("div", "reav-barra"); const bC = h("button", "btn-cad-secundario", editar ? "Cancelar" : "Fechar"); bC.type = "button"; const bO = h("button", "btn-cad-primario", "Aplicar"); bO.type = "button"; bO.hidden = !editar; barra.appendChild(bC); barra.appendChild(bO); cx.appendChild(barra);
      bC.addEventListener("click", () => fundo2.remove());
      bO.addEventListener("click", () => { it.valores = valores; it.exposicao = cb.checked === !!def.exposicao ? null : cb.checked; it.nivelManual = sm.value; fundo2.remove(); depois(); });
      fundo2.appendChild(cx); document.body.appendChild(fundo2); mostrar();
    }

    function validar() {
      const falta = ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Data Analise"].filter((k) => !st[k]);
      if (falta.length) return "Identificação: preencha " + falta.map((k) => T(k).replace("Posto Trabalho", "Posto de trabalho").replace("Data Analise", "Data da análise")).join(", ") + ".";
      if (!st.Atividades.length) return "Cadastre ao menos uma atividade.";
      const mz = matrizDe(st.Cliente);
      for (const at of st.Atividades) {
        if (!String(at.nome || "").trim()) return "Há atividade sem nome.";
        for (const fa of at.fatores) {
          const nome = fa.fator === "__outro" ? fa.outro : fa.fator;
          if (!nome) return `Atividade “${at.nome}”: escolha o fator de risco.`;
          if (!fa.consequencia) return `Atividade “${at.nome}”, fator “${nome}”: informe a consequência.`;
          if (!fa.segmento) return `Atividade “${at.nome}”, fator “${nome}”: informe o segmento acometido.`;
          const r = avaliarFator(fa, mz); if (!r.graduacao) return `Atividade “${at.nome}”, fator “${nome}”: ${r.pendente}.`;
          const ed = editores.get(fa.uid); const e = ed && ed.validar(); if (e) return `Atividade “${at.nome}”, fator “${nome}”: ${e}`;
        }
      }
      return null;
    }

    async function salvar() {
      const erro = validar(); if (erro) { msg.hidden = false; msg.className = "aet-msg erro"; msg.textContent = erro; msg.scrollIntoView({ block: "nearest" }); return; }
      bSalvar.disabled = true; msg.hidden = false; msg.className = "aet-msg"; msg.textContent = "Salvando a AET…";
      try {
        const novo = !idAET; const id = idAET || (g.crypto && g.crypto.randomUUID ? g.crypto.randomUUID() : "aet" + uid());
        if (!st["Nr AET"]) { const nrs = aetsNativas().filter((a) => a.Cliente === st.Cliente).map((a) => Number(a["Nr AET"]) || 0); st["Nr AET"] = (nrs.length ? Math.max(...nrs) : 0) + 1; }
        const emp = (BI.dados.cliente || []).find((c) => c.Cliente === st.Cliente);
        const doc = {}; Object.keys(st).forEach((k) => { if (k[0] !== "_" && k !== "id") doc[k] = st[k]; });
        doc.EmpresaId = emp ? (emp.id || emp._id) : doc.EmpresaId; doc["Tipo Registro"] = "AET";
        const mz = matrizDe(st.Cliente);
        doc.Atividades = st.Atividades.map((at) => Object.assign({}, at, { fatores: at.fatores.map((fa) => { const o = Object.assign({}, fa); delete o._av; return o; }) }));
        doc["Ultima Atualizacao Em"] = new Date().toISOString();
        await BI.DB.salvar("aet", id, doc, novo);
        // Inventario de riscos
        const existentes = (BI.dados.fatorRisco || []).filter((f) => f["AET Id"] === id); const vistos = new Set();
        for (const at of st.Atividades) {
          for (const fa of at.fatores) {
            const rid = idFatorRow(id, fa); vistos.add(rid); const r = avaliarFator(fa, mz); const ex = existentes.find((f) => f._id === rid);
            const nome = fa.fator === "__outro" ? fa.outro : fa.fator; const sig = assinaturaFator(fa);
            const base = { Cliente: st.Cliente, EmpresaId: doc.EmpresaId, Unidade: st.Unidade, Setor: st.Setor, "Posto Trabalho": st["Posto Trabalho"], Cargo: st.Cargo, Atividade: at.nome, Origem: "AET", "AET Id": id, "AET Fator": fa.uid,
              Grupo: fa.grupo || "Outros", Fator: nome, "Existe Fator Risco": "Sim", Consequencia: fa.consequencia, "Circunstancia Geradora": fa.fonte || at.nome, "Segmento Corporal": fa.segmento,
              "Metodologia AET": (fa.ferramentas || []).map((it) => (F().porId(it.id) || {}).sigla).filter(Boolean).join(", ") || "Matriz de risco", Matriz: mz, "Dt Identificacao": st["Data Analise"], "Assinatura AET": sig };
            let dados;
            if (ex) {
              dados = {}; Object.keys(ex).forEach((k) => { if (k[0] !== "_" && k !== "id") dados[k] = ex[k]; }); Object.assign(dados, base);
              if (ex["Assinatura AET"] !== sig) { // entradas mudaram: a AET recalcula o risco (e registra no historico)
                if (ex["Graduacao Risco"] && (ex["Graduacao Risco"] !== r.graduacao || ex["Risco Eliminado"] === "Sim")) dados["Historico Risco"] = (ex["Historico Risco"] || []).concat([{ data: hojeISO(), de: ex["Risco Eliminado"] === "Sim" ? "Eliminado" : ex["Graduacao Risco"], para: r.graduacao, probabilidade: r.probabilidade, severidade: r.criticidade, motivo: "Reavaliação na AET" }]);
                Object.assign(dados, { Criticidade: r.criticidade, Probabilidade: r.probabilidade, "Graduacao Risco": r.graduacao, "Pontuacao Risco": r.pontuacao, "Risco Eliminado": null, "Eliminado Em": null });
              }
            } else {
              dados = Object.assign({}, base, { Criticidade: r.criticidade, Probabilidade: r.probabilidade, "Graduacao Risco": r.graduacao, "Graduacao Inicial": r.graduacao, "Pontuacao Risco": r.pontuacao, Status: "Em andamento" });
            }
            await BI.DB.salvar("fatorRisco", rid, dados, !ex);
            const ed = editores.get(fa.uid); if (ed) await ed.salvar(rid);
          }
        }
        for (const f of existentes) {
          if (vistos.has(f._id)) continue;
          for (const ac of (BI.dados.planoAcao || []).filter((p) => p["Fator Risco Id"] === f._id)) { if (acaoIntocada(ac)) await BI.DB.excluir("planoAcao", ac._id); }
          await BI.DB.excluir("fatorRisco", f._id);
        }
        sujo = false;
        if (BI.recarregar) await BI.recarregar();
        fundo.remove(); document.body.classList.remove("aet-aberta"); renderPainel();
        if (BI.avisar) BI.avisar("AET salva. Riscos no Inventário e ações no Plano de Ação (origem AET).");
      } catch (e) {
        console.error("AET", e); msg.className = "aet-msg erro"; msg.textContent = "Não foi possível salvar: " + (e && e.message ? e.message : e);
      } finally { bSalvar.disabled = false; }
    }
    bSalvar.addEventListener("click", salvar);
    desenhar();
  }

  function sugerirDiagnostico(st, mz) {
    const C = Calc(); const linhas = [];
    const porAt = st.Atividades.map((at) => { const gs = at.fatores.map((fa) => avaliarFator(fa, mz).graduacao).filter(Boolean).sort((a, b) => C.ordemNivel(b) - C.ordemNivel(a)); return { at, g: gs[0] || "", fat: at.fatores.filter((fa) => avaliarFator(fa, mz).graduacao === gs[0]).map((fa) => (fa.fator === "__outro" ? fa.outro : fa.fator).toLowerCase()) }; });
    const maior = porAt.map((x) => x.g).filter(Boolean).sort((a, b) => C.ordemNivel(b) - C.ordemNivel(a))[0];
    if (!maior) return "";
    const crit = porAt.filter((x) => x.g && C.ordemNivel(x.g) === C.ordemNivel(maior));
    linhas.push(`A função de ${st.Cargo || "—"} (${st["Posto Trabalho"] || "—"}) apresenta risco ergonômico ${maior.toLowerCase()}, principalmente ${crit.length === 1 ? "na atividade" : "nas atividades"} ${crit.map((x) => `“${x.at.nome}”`).join(", ")}, devido a ${Array.from(new Set(crit.flatMap((x) => x.fat))).join(", ") || "fatores de risco identificados"}.`);
    const outras = porAt.filter((x) => x.g && C.ordemNivel(x.g) < C.ordemNivel(maior));
    if (outras.length) linhas.push(`Nas demais atividades, o risco é ${Array.from(new Set(outras.map((x) => x.g.toLowerCase()))).join(" ou ")}.`);
    return linhas.join(" ");
  }

  BI.AET = { renderPainel, abrirEditor, avaliarFator, EXPOSICAO, exposicaoDe, aetsNativas, matrizDe, nivelNaMatriz, comExposicao, nivelDaFerramenta, DEMANDAS, ORGANIZACAO, AMBIENTE, dataBR };
})(window);
