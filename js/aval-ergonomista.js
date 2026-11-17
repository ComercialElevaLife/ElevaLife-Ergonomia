/* ==========================================================================
   S.I.G.E - ElevaLife
   V 1.94 (Alexandre): Avaliação de Desempenho dos Ergonomistas.
   Sub-aba de Coordenação. Catálogo baseado no "Checklist de Avaliação do
   Ergonomista v1.2" (Bloco A = entregas técnicas 70%, Bloco B = DNA 2.0 30%).
   O Administrador (coordenador) avalia; o ergonomista avaliado vê a própria
   avaliação (somente leitura). Coleção global "avaliacaoErgonomista".
   ========================================================================== */
(function (global) {
  "use strict";
  const BI = (global.BI = global.BI || {});
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  // ----------------------------------------------------------------- catálogo
  const VERSAO_CATALOGO = "v1.2";
  // Escala ancorada: o avaliador escolhe o nível, o sistema converte em pontos.
  const ESCALA = [
    { nivel: "Referência", pontos: 100, ancora: "Entrega modelo, sem retrabalho, agrega além do escopo contratado." },
    { nivel: "Acima", pontos: 85, ancora: "Entrega autônoma e completa, sem necessidade de correção." },
    { nivel: "Esperado", pontos: 70, ancora: "Cumpre o padrão técnico da função, com ajustes pontuais." },
    { nivel: "Em desenvolvimento", pontos: 45, ancora: "Precisa de revisão ou suporte recorrente para concluir." },
    { nivel: "Insuficiente", pontos: 20, ancora: "Retrabalho, atraso ou falha metodológica relevante." },
    { nivel: "N/A", pontos: null, ancora: "Não houve atividade deste tipo no período avaliado." },
  ];
  const pontosDoNivel = (nivel) => { const e = ESCALA.find((x) => x.nivel === nivel); return e ? e.pontos : null; };
  const CICLOS = ["Baseline — Out/2026", "2ª aplicação — Jan/2027", "Trimestral", "Semestral", "Anual", "Avulsa"];
  const COBERTURA_MIN = 0.5; // eixo com < 50% dos itens avaliados é descartado
  const BLOCOS = {
    A: { nome: "Entregas técnicas", peso: 0.70 },
    B: { nome: "DNA 2.0 — competências comportamentais", peso: 0.30 },
  };
  // Eixos e itens (um "num" sequencial por item, usado como chave das respostas).
  const EIXOS = [
    { cod: "A1", bloco: "A", nome: "Análises ergonômicas", peso: 0.22, itens: [
      [1, "Aderência metodológica (NR-17, AET/AEP, ferramentas de avaliação de risco)"],
      [2, "Qualidade técnica do diagnóstico e consistência das recomendações"],
      [3, "Cumprimento do prazo de entrega da análise"] ] },
    { cod: "A2", bloco: "A", nome: "Validação das análises ergonômicas", peso: 0.14, itens: [
      [4, "Realiza revisão crítica da análise antes de validar com o gestor"],
      [5, "Realiza a validação da análise ergonômica com o gestor"],
      [6, "Revisa a análise após a validação"],
      [7, "Valida novamente com o gestor"] ] },
    { cod: "A3", bloco: "A", nome: "Comitê de ergonomia", peso: 0.13, itens: [
      [8, "Preparação e qualidade do material apresentado"],
      [9, "Condução / participação técnica e clareza na comunicação"],
      [10, "Ata, encaminhamentos e follow-up das deliberações"] ] },
    { cod: "A4", bloco: "A", nome: "Gestão do plano de ação", peso: 0.18, itens: [
      [11, "Atualização e rastreabilidade do plano de ação"],
      [12, "Cobrança ativa e articulação com as áreas do cliente"],
      [13, "Taxa de conclusão das ações dentro do prazo"] ] },
    { cod: "A5", bloco: "A", nome: "Gestão de restritos", peso: 0.13, itens: [
      [14, "Acompanhamento individual dos casos e atualização dos registros"],
      [15, "Interface com SESMT, RH e serviço médico"],
      [16, "Reavaliações e retorno ao trabalho dentro do prazo"] ] },
    { cod: "A6", bloco: "A", nome: "Demandas específicas do cliente", peso: 0.10, itens: [
      [17, "Prazo de atendimento das demandas"],
      [18, "Aderência ao escopo contratado"],
      [19, "Comunicação e relacionamento com o cliente"] ] },
    { cod: "A7", bloco: "A", nome: "Indicadores e rotina de gestão", peso: 0.10, itens: [
      [20, "Preenchimento dos indicadores"],
      [21, "Participação na reunião semanal com o coordenador"],
      [22, "Apresentação / envio dos indicadores para o cliente"] ] },
    { cod: "B1", bloco: "B", nome: "01 Resultado é compromisso", peso: 0.35, itens: [
      [23, "Comunica desvios e riscos cedo, sem esperar o problema estourar no cliente"],
      [24, "Assume responsabilidade pelo resultado final, mesmo quando parte depende de outras áreas ou do cliente"],
      [25, "Entrega com padrão completo — não dá a demanda por encerrada enquanto o impacto esperado não é atingido"] ] },
    { cod: "B2", bloco: "B", nome: "02 Evoluir é obrigatório", peso: 0.20, itens: [
      [26, "Busca feedback ativamente e age sobre os pontos levantados, com mudança observável"],
      [27, "Trata erro como dado — analisa, extrai aprendizado e registra para não repetir"],
      [28, "Estuda e se atualiza tecnicamente por conta própria e compartilha aprendizados com o time"] ] },
    { cod: "B3", bloco: "B", nome: "03 Respeito é inegociável", peso: 0.20, itens: [
      [29, "Nomeia problemas de clima e comportamento diretamente com quem está envolvido, sem triangular"],
      [30, "Mantém o mesmo padrão de trato independente de hierarquia, pressão ou cliente em jogo"],
      [31, "Discorda com argumento, reconhece contribuição alheia e age com integridade sem depender de plateia"] ] },
    { cod: "B4", bloco: "B", nome: "04 Ritmo é estratégia", peso: 0.15, itens: [
      [32, "Planeja a semana e protege o foco — não opera em urgência permanente por falta de organização"],
      [33, "Comunica sobrecarga antes de quebrar, renegociando prazo em vez de entregar com falha"] ] },
    { cod: "B5", bloco: "B", nome: "05 Processos inteligentes, impacto real", peso: 0.10, itens: [
      [34, "Propõe melhoria chegando com solução ou hipótese, não apenas com o problema"],
      [35, "Documenta o que funciona — o conhecimento fica no processo, não na cabeça de uma pessoa"] ] },
  ];
  const TOTAL_ITENS = EIXOS.reduce((s, e) => s + e.itens.length, 0);
  const EIXO_RESPEITO = "B3";

  // ----------------------------------------------------------------- cálculo
  // itens: { "<num>": { nivel, evidencia } }. Regras do checklist v1.2:
  //  - N/A sai do cálculo; eixo com cobertura < 50% é descartado e seu peso
  //    é redistribuído entre os eixos válidos do MESMO bloco;
  //  - nota do bloco = média ponderada dos eixos válidos; nota final = A*0.7 + B*0.3
  //    (se um bloco ficar sem eixo válido, seu peso vai para o outro bloco).
  function calcular(respostas) {
    respostas = respostas || {};
    const eixos = EIXOS.map((e) => {
      const avaliados = e.itens.filter(([n]) => { const r = respostas[n]; return r && r.nivel && r.nivel !== "N/A" && pontosDoNivel(r.nivel) != null; });
      const cobertura = e.itens.length ? avaliados.length / e.itens.length : 0;
      const media = avaliados.length ? avaliados.reduce((s, [n]) => s + pontosDoNivel(respostas[n].nivel), 0) / avaliados.length : null;
      const valido = cobertura >= COBERTURA_MIN && media != null;
      return { cod: e.cod, bloco: e.bloco, nome: e.nome, peso: e.peso, nItens: e.itens.length, nAvaliados: avaliados.length, cobertura, media, valido };
    });
    const notaBloco = {};
    ["A", "B"].forEach((bl) => {
      const vs = eixos.filter((x) => x.bloco === bl && x.valido);
      const somaPeso = vs.reduce((s, x) => s + x.peso, 0);
      notaBloco[bl] = { valido: vs.length > 0, nota: somaPeso ? vs.reduce((s, x) => s + x.media * (x.peso / somaPeso), 0) : null, nEixosValidos: vs.length };
    });
    // nota final: pondera os blocos com conteúdo válido, renormalizando os pesos
    let somaPesoBloco = 0, acc = 0;
    ["A", "B"].forEach((bl) => { if (notaBloco[bl].valido) { somaPesoBloco += BLOCOS[bl].peso; acc += notaBloco[bl].nota * BLOCOS[bl].peso; } });
    const notaFinal = somaPesoBloco ? acc / somaPesoBloco : null;
    const nAvaliados = eixos.reduce((s, x) => s + x.nAvaliados, 0);
    const respeito = eixos.find((x) => x.cod === EIXO_RESPEITO);
    const travaRespeito = respeito && respeito.valido && respeito.media != null && respeito.media < 60;
    const dimsAbaixo60 = eixos.filter((x) => x.valido && x.media != null && x.media < 60).map((x) => x.cod);
    return { eixos, notaBloco, notaFinal, nAvaliados, totalItens: TOTAL_ITENS, cobertura: TOTAL_ITENS ? nAvaliados / TOTAL_ITENS : 0, travaRespeito, dimsAbaixo60 };
  }

  const num1 = (v) => (v == null ? "—" : (Math.round(v * 10) / 10).toLocaleString("pt-BR"));
  const pct0 = (v) => (v == null ? "—" : Math.round(v * 100) + "%");
  // cor por faixa de nota (0-100): <60 vermelho, 60-69 laranja, 70-84 amarelo-esverdeado, 85+ verde
  function corNota(v) { if (v == null) return "#8a7a78"; if (v < 60) return "#C62828"; if (v < 70) return "#E8731A"; if (v < 85) return "#2E7D5B"; return "#1E6B44"; }

  BI.AvalErgo = { VERSAO_CATALOGO, ESCALA, pontosDoNivel, CICLOS, EIXOS, BLOCOS, TOTAL_ITENS, calcular, corNota, num1, pct0,
    // render é instalado por aval-ergonomista-ui (abaixo, mesmo arquivo)
    render: null };

  // ------------------------------------------------------------------ UI
  const Calc = () => BI.Calc;
  const ehAdmin = () => { const i = BI.DB && BI.DB.estado && BI.DB.estado.identidade; return !!(i && i.papel === "Administrador"); };
  const meuEmail = () => { const i = BI.DB && BI.DB.estado && BI.DB.estado.identidade; return String((i && i.email) || "").toLowerCase(); };

  function avaliacoes() { return (BI.dados && BI.dados.avaliacaoErgonomista) || []; }
  // pessoas avaliáveis: ergonomistas cadastrados (têm e-mail) + usuários Consultor carregados
  function pessoasAvaliaveis(usuarios) {
    const mapa = new Map();
    (BI.dados.ergonomista || []).forEach((e) => { const em = String(e.Email || "").toLowerCase(); if (em) mapa.set(em, { nome: e.Nome || e.Email, email: e.Email }); });
    (usuarios || []).forEach((u) => { if (u.Papel === "Consultor" || u.Papel === "Administrador") { const em = String(u.Email || "").toLowerCase(); if (em && !mapa.has(em)) mapa.set(em, { nome: u.Email, email: u.Email }); } });
    return Array.from(mapa.values()).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }

  let estado = { modo: "lista", editando: null, usuarios: null };

  function render(area) {
    area.innerHTML = "";
    if (estado.modo === "editor") { renderEditor(area); return; }
    renderLista(area);
  }

  function renderLista(area) {
    const admin = ehAdmin();
    const box = h("div", "cartao col-12");
    const cab = h("div", "cadastro-cabecalho");
    cab.appendChild(h("div", "cartao-titulo", admin ? "Avaliação de Ergonomistas" : "Minha avaliação de desempenho"));
    if (admin) { const b = h("button", "btn-novo-registro", "+ Nova avaliação"); b.type = "button"; b.addEventListener("click", () => { estado.editando = null; abrir(area); }); cab.appendChild(b); }
    box.appendChild(cab);
    box.appendChild(h("p", "aet-nota", admin
      ? "Avalie o desempenho de cada ergonomista pelo checklist v1.2 (Bloco A — entregas técnicas 70% · Bloco B — DNA 2.0 30%). O ergonomista vê a própria avaliação ao acessar com o usuário dele."
      : "Estas são as suas avaliações de desempenho, preenchidas pela coordenação. Somente leitura."));
    const lista = admin ? avaliacoes() : avaliacoes().filter((a) => String(a.EmailErgonomista || "").toLowerCase() === meuEmail());
    if (!lista.length) { box.appendChild(h("div", "coord-vazio", admin ? "Nenhuma avaliação cadastrada. Clique em “+ Nova avaliação”." : "Você ainda não tem avaliações registradas.")); area.appendChild(box); return; }
    const wrap = h("div", "tabela-scroll"); const tb = h("table", "tabela-dados");
    const trh = h("tr"); ["Ergonomista", "Ciclo", "Data", "Nota final", "Avaliador", ""].forEach((c) => trh.appendChild(h("th", null, c)));
    const thead = h("thead"); thead.appendChild(trh); tb.appendChild(thead);
    const tbody = h("tbody");
    lista.slice().sort((a, b) => String(b["Data Avaliacao"] || "").localeCompare(String(a["Data Avaliacao"] || ""))).forEach((a) => {
      const tr = h("tr");
      const r = calcular(a.Itens || {});
      [a.Ergonomista || a.EmailErgonomista || "-", a.Ciclo || "-", dataBR(a["Data Avaliacao"]) || "-"].forEach((x) => tr.appendChild(h("td", null, x)));
      const tdN = h("td"); const pil = h("span", "plano-pilula", r.notaFinal == null ? "—" : num1(r.notaFinal)); pil.style.background = corNota(r.notaFinal); pil.style.color = "#fff"; tdN.appendChild(pil); tr.appendChild(tdN);
      tr.appendChild(h("td", null, a.Avaliador || "-"));
      const tdA = h("td", "aet-acoes-linha");
      const bAbrir = h("button", "btn-cad-secundario", admin ? "Abrir" : "Ver"); bAbrir.type = "button"; bAbrir.addEventListener("click", () => { estado.modo = "editor"; estado.editando = a._id || a.id; abrir(area); }); tdA.appendChild(bAbrir);
      if (admin) { const bX = h("button", "btn-excluir", "Excluir"); bX.type = "button"; bX.addEventListener("click", () => excluir(a, area)); tdA.appendChild(bX); }
      tr.appendChild(tdA); tbody.appendChild(tr);
    });
    tb.appendChild(tbody); wrap.appendChild(tb); box.appendChild(wrap); area.appendChild(box);
  }

  async function excluir(a, area) {
    if (!window.confirm(`Excluir a avaliação de ${a.Ergonomista || a.EmailErgonomista || ""} (${a.Ciclo || ""})?`)) return;
    try { await BI.DB.excluir("avaliacaoErgonomista", a._id || a.id); estado.modo = "lista"; estado.editando = null; await BI.DB.recarregar(["avaliacaoErgonomista"]); if (BI.Coordenacao && BI.Coordenacao.render) BI.Coordenacao.render(); else render(area); }
    catch (e) { window.alert("Não foi possível excluir: " + (e && e.message ? e.message : e)); }
  }

  function dataBR(iso) { try { return BI.Datas && BI.Datas.formatarData ? BI.Datas.formatarData(iso) : (iso ? String(iso).split("-").reverse().join("/") : ""); } catch (e) { return iso || ""; } }
  function hojeISO() { return new Date().toISOString().slice(0, 10); }

  // garante a lista de usuários (para montar as pessoas avaliáveis) - só Administrador
  async function garantirUsuarios() {
    if (estado.usuarios || !ehAdmin()) return;
    try { const r = await fetch("/api/usuarios", { credentials: "same-origin" }); estado.usuarios = r.ok ? await r.json() : []; }
    catch (e) { estado.usuarios = []; }
  }

  async function abrir(area) {
    await garantirUsuarios();
    estado.modo = "editor";
    render(area);
  }

  function renderEditor(area) {
    const admin = ehAdmin();
    const existente = estado.editando ? avaliacoes().find((a) => (a._id || a.id) === estado.editando) : null;
    // modelo de trabalho (cópia)
    const st = existente ? JSON.parse(JSON.stringify(existente)) : { Ciclo: BI.AvalErgo.CICLOS[0], "Data Avaliacao": hojeISO(), Versao: VERSAO_CATALOGO, Itens: {} };
    st.Itens = st.Itens || {};
    const podeEditar = admin;

    const box = h("div", "cartao col-12");
    const topo = h("div", "cadastro-cabecalho");
    topo.appendChild(h("div", "cartao-titulo", podeEditar ? (existente ? "Editar avaliação" : "Nova avaliação de ergonomista") : "Avaliação de desempenho"));
    const bVoltar = h("button", "btn-cad-secundario", "← Voltar"); bVoltar.type = "button"; bVoltar.addEventListener("click", () => { estado.modo = "lista"; estado.editando = null; render(area); });
    topo.appendChild(bVoltar);
    box.appendChild(topo);

    // ---- cabeçalho (ergonomista, ciclo, data, avaliador)
    const grade = h("div", "aet-grade");
    const pessoas = pessoasAvaliaveis(estado.usuarios);
    if (podeEditar) {
      const campoErg = h("label", "aet-campo aet-campo--largo"); campoErg.appendChild(h("span", "aet-rot", "Ergonomista avaliado *"));
      const sel = h("select"); const o0 = h("option", null, "Selecione o ergonomista…"); o0.value = ""; sel.appendChild(o0);
      pessoas.forEach((p) => { const o = h("option", null, p.nome + (p.email && p.nome !== p.email ? " (" + p.email + ")" : "")); o.value = p.email; sel.appendChild(o); });
      if (st.EmailErgonomista && !pessoas.some((p) => String(p.email).toLowerCase() === String(st.EmailErgonomista).toLowerCase())) { const o = h("option", null, (st.Ergonomista || st.EmailErgonomista)); o.value = st.EmailErgonomista; sel.appendChild(o); }
      sel.value = st.EmailErgonomista || "";
      sel.addEventListener("change", () => { st.EmailErgonomista = sel.value; const p = pessoas.find((x) => x.email === sel.value); st.Ergonomista = p ? p.nome : sel.value; });
      campoErg.appendChild(sel); grade.appendChild(campoErg);
      if (!pessoas.length) grade.appendChild(h("p", "aet-nota", "Cadastre os ergonomistas com e-mail em Cadastro Interno › Ergonomistas (ou crie o usuário deles) para poder avaliá-los."));
    } else {
      grade.appendChild(kvCampo("Ergonomista", st.Ergonomista || st.EmailErgonomista || "-"));
    }
    // ciclo
    const campoCiclo = h("label", "aet-campo"); campoCiclo.appendChild(h("span", "aet-rot", "Ciclo de avaliação *"));
    const selC = h("select"); BI.AvalErgo.CICLOS.forEach((c) => { const o = h("option", null, c); o.value = c; selC.appendChild(o); });
    if (st.Ciclo && !BI.AvalErgo.CICLOS.includes(st.Ciclo)) { const o = h("option", null, st.Ciclo); o.value = st.Ciclo; selC.appendChild(o); }
    selC.value = st.Ciclo || BI.AvalErgo.CICLOS[0]; selC.disabled = !podeEditar; selC.addEventListener("change", () => { st.Ciclo = selC.value; }); campoCiclo.appendChild(selC); grade.appendChild(campoCiclo);
    // data
    const campoData = h("label", "aet-campo"); campoData.appendChild(h("span", "aet-rot", "Data da avaliação *"));
    const inpD = h("input"); inpD.type = "date"; inpD.value = st["Data Avaliacao"] || hojeISO(); inpD.disabled = !podeEditar; inpD.addEventListener("input", () => { st["Data Avaliacao"] = inpD.value; }); campoData.appendChild(inpD); grade.appendChild(campoData);
    box.appendChild(grade);

    // ---- painel de nota (atualiza ao preencher)
    const painel = h("div", "aval-erg-resumo"); painel.style.cssText = "margin:12px 0;padding:12px 14px;border:1px solid var(--linha,#e5d8d8);border-radius:10px;background:var(--fundo-suave,#f5efea)";
    box.appendChild(painel);

    // ---- escala (legenda)
    const legenda = h("p", "aet-nota", "Escala: " + ESCALA.filter((e) => e.pontos != null).map((e) => `${e.nivel} = ${e.pontos}`).join(" · ") + " · N/A (fora do cálculo). Item com nota ≤ 45 pede evidência escrita.");
    box.appendChild(legenda);

    // ---- itens por eixo
    const refsEvid = {};
    function atualizarPainel() {
      const r = calcular(st.Itens);
      painel.innerHTML = "";
      const linha = h("div"); linha.style.cssText = "display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center";
      const notaBox = h("div"); notaBox.style.cssText = "display:flex;align-items:baseline;gap:8px";
      const nn = h("strong", null, r.notaFinal == null ? "—" : num1(r.notaFinal)); nn.style.cssText = "font-size:30px;color:" + corNota(r.notaFinal);
      notaBox.appendChild(nn); notaBox.appendChild(h("span", "aet-rot", "Nota final (0–100)")); linha.appendChild(notaBox);
      const addKpi = (rot, val, cor) => { const d = h("div"); d.style.cssText = "display:flex;flex-direction:column"; const v = h("strong", null, val); if (cor) v.style.color = cor; d.appendChild(v); d.appendChild(h("span", "aet-rot", rot)); linha.appendChild(d); };
      addKpi("Bloco A (70%)", r.notaBloco.A.nota == null ? "—" : num1(r.notaBloco.A.nota), corNota(r.notaBloco.A.nota));
      addKpi("Bloco B (30%)", r.notaBloco.B.nota == null ? "—" : num1(r.notaBloco.B.nota), corNota(r.notaBloco.B.nota));
      addKpi("Cobertura", pct0(r.cobertura) + " (" + r.nAvaliados + "/" + r.totalItens + ")");
      painel.appendChild(linha);
      if (r.travaRespeito) painel.appendChild(avisoLinha("⛔ Respeito é inegociável abaixo de 60 — trava promoção (regra DNA 2.0).", "#C62828"));
      if (r.dimsAbaixo60.length) painel.appendChild(avisoLinha("⚠️ Dimensões abaixo de 60 (exigem plano de correção): " + r.dimsAbaixo60.join(", "), "#E8731A"));
    }
    function avisoLinha(txt, cor) { const d = h("div", null, txt); d.style.cssText = "margin-top:8px;font-weight:600;color:" + cor; return d; }

    EIXOS.forEach((e) => {
      const sec = h("div", "aval-erg-eixo"); sec.style.cssText = "margin-top:14px";
      const tit = h("div", "aet-subtitulo", `${e.cod} · ${e.nome}`);
      const pesoTag = h("span", "aet-rot", ` (peso ${Math.round(e.peso * 100)}% do Bloco ${e.bloco})`); pesoTag.style.fontWeight = "400"; tit.appendChild(pesoTag);
      sec.appendChild(tit);
      e.itens.forEach(([num, texto]) => {
        if (!st.Itens[num]) st.Itens[num] = { nivel: "", evidencia: "" };
        const linha = h("div", "aval-erg-item"); linha.style.cssText = "display:grid;grid-template-columns:1fr 210px;gap:8px 12px;align-items:start;padding:8px 0;border-bottom:1px solid var(--linha,#eee)";
        const esq = h("div");
        esq.appendChild(h("div", null, `${num}. ${texto}`));
        const ev = h("textarea"); ev.rows = 1; ev.placeholder = "Evidência / comentário"; ev.value = st.Itens[num].evidencia || ""; ev.disabled = !podeEditar;
        ev.style.cssText = "width:100%;margin-top:6px;padding:6px 8px;border:1px solid var(--linha,#e5d8d8);border-radius:6px;font:inherit;font-size:12.5px;resize:vertical";
        ev.addEventListener("input", () => { st.Itens[num].evidencia = ev.value; });
        esq.appendChild(ev); refsEvid[num] = ev;
        linha.appendChild(esq);
        const dir = h("div");
        const selN = h("select"); selN.style.cssText = "width:100%"; const on = h("option", null, "—"); on.value = ""; selN.appendChild(on);
        ESCALA.forEach((x) => { const o = h("option", null, x.nivel + (x.pontos != null ? " (" + x.pontos + ")" : "")); o.value = x.nivel; selN.appendChild(o); });
        selN.value = st.Itens[num].nivel || ""; selN.disabled = !podeEditar;
        const marcarEvid = () => { const p = pontosDoNivel(st.Itens[num].nivel); ev.style.borderColor = (p != null && p <= 45) ? "#C62828" : "var(--linha,#e5d8d8)"; };
        selN.addEventListener("change", () => { st.Itens[num].nivel = selN.value; marcarEvid(); atualizarPainel(); });
        dir.appendChild(selN); linha.appendChild(dir);
        marcarEvid();
        sec.appendChild(linha);
      });
      box.appendChild(sec);
    });

    // ---- salvar
    if (podeEditar) {
      const rodape = h("div"); rodape.style.cssText = "margin-top:16px;display:flex;gap:10px;align-items:center";
      const msg = h("span", "aet-nota"); msg.style.margin = "0";
      const bSalvar = h("button", "btn-cad-primario", existente ? "Salvar alterações" : "Salvar avaliação"); bSalvar.type = "button";
      bSalvar.addEventListener("click", async () => {
        if (!st.EmailErgonomista) { msg.textContent = "Escolha o ergonomista avaliado."; msg.style.color = "#C62828"; return; }
        // exige evidência nos itens com nota ≤ 45
        const faltaEvid = EIXOS.flatMap((e) => e.itens).find(([num]) => { const it = st.Itens[num]; const p = it && pontosDoNivel(it.nivel); return p != null && p <= 45 && !String(it.evidencia || "").trim(); });
        if (faltaEvid) { msg.textContent = `O item ${faltaEvid[0]} tem nota ≤ 45 e precisa de evidência escrita.`; msg.style.color = "#C62828"; if (refsEvid[faltaEvid[0]]) refsEvid[faltaEvid[0]].focus(); return; }
        bSalvar.disabled = true; msg.textContent = "Salvando…"; msg.style.color = "";
        try {
          const r = calcular(st.Itens);
          const ident = BI.DB.estado.identidade;
          const doc = {
            EmpresaId: "GLOBAL", EmailErgonomista: String(st.EmailErgonomista).toLowerCase(), Ergonomista: st.Ergonomista || st.EmailErgonomista,
            Ciclo: st.Ciclo, "Data Avaliacao": st["Data Avaliacao"], Versao: VERSAO_CATALOGO,
            Avaliador: (ident && (ident.nome || ident.email)) || "", Itens: st.Itens,
            "Nota Final": r.notaFinal, "Nota Bloco A": r.notaBloco.A.nota, "Nota Bloco B": r.notaBloco.B.nota, Cobertura: r.cobertura,
          };
          const id = existente ? (existente._id || existente.id) : null;
          await BI.DB.salvar("avaliacaoErgonomista", id, doc, !existente);
          // volta para a lista ANTES de recarregar: o recarregar dispara o
          // callback do banco (renderizarTudo → Coordenacao.render), que remonta
          // a área; com o modo já em "lista" ele reabre a lista, não o editor.
          estado.modo = "lista"; estado.editando = null;
          await BI.DB.recarregar(["avaliacaoErgonomista"]);
          if (BI.Coordenacao && BI.Coordenacao.render) BI.Coordenacao.render(); else render(area);
        } catch (e) { msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e); msg.style.color = "#C62828"; bSalvar.disabled = false; }
      });
      rodape.appendChild(bSalvar); rodape.appendChild(msg); box.appendChild(rodape);
    }

    area.appendChild(box);
    atualizarPainel();
  }

  function kvCampo(rot, val) { const d = h("label", "aet-campo"); d.appendChild(h("span", "aet-rot", rot)); const s = h("div"); s.style.cssText = "padding:8px 10px;background:var(--fundo-suave,#f5efea);border-radius:8px;font-size:13.5px"; s.textContent = val; d.appendChild(s); return d; }

  BI.AvalErgo.render = render;
  BI.AvalErgo.temAcesso = () => { const i = BI.DB && BI.DB.estado && BI.DB.estado.identidade; return !!(i && (i.papel === "Administrador" || i.papel === "Consultor")); };
})(typeof window !== "undefined" ? window : this);
