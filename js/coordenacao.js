/* ==========================================================================
   S.I.G.E - ElevaLife · V 1.40
   Aba Coordenacao (so Administrador) - contabilidade de tempo.

   Le a colecao "tempoTrabalho" (gravada por js/tempo.js) e mostra, por login:
     - quanto tempo cada ergonomista levou para cadastrar as entidades
       (empresa, colaboradores, setores, etc.) e nas AEP/AET;
     - o ciclo de vida de cada AEP/AET: do inicio (primeira abertura) ate a
       finalizacao (ultimo salvamento) - relogio de parede - e o tempo ATIVO
       de edicao somado no periodo.

   Cada ergonomista tem (ou tera) o seu proprio login, entao o detalhamento e
   por "Por" (e-mail do login) e por categoria (Cadastro / AEP / AET).
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  // ms -> "1h 05m", "7m 12s", "42s"
  function fmtDur(ms) {
    ms = Math.max(0, Math.round(Number(ms) || 0));
    const s = Math.round(ms / 1000);
    if (s < 60) return s + "s";
    const m = Math.floor(s / 60), rs = s % 60;
    if (m < 60) return m + "m" + (rs ? " " + String(rs).padStart(2, "0") + "s" : "");
    const hh = Math.floor(m / 60), rm = m % 60;
    return hh + "h" + (rm ? " " + String(rm).padStart(2, "0") + "m" : "");
  }
  function fmtData(iso) {
    if (!iso) return "—";
    const d = new Date(iso); if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const ROT_CAT = { Cadastro: "Cadastro", AEP: "AEP", AET: "AET" };
  const ROT_TIPO = {
    cliente: "Empresa (cliente)", unidade: "Unidade", setor: "Setor / GHE", cargo: "Cargo", posto: "Posto de trabalho",
    atividade: "Atividade", colaborador: "Colaborador", ergonomista: "Ergonomista", certificadoCalibracao: "Certificado de calibração",
    diasUteis: "HHT / Dias úteis", mapaRisco: "Mapa de risco", planoAcao: "Plano de ação", absenteismo: "Absenteísmo",
    compativeis: "Restritos / compatíveis", avaliacaoErgonomica: "AEP (inventário)", aet: "AET", modeloLaudo: "Modelo de laudo", laudo: "Laudo",
  };
  const rotTipo = (t) => ROT_TIPO[t] || t || "—";

  // Respeita o filtro global de Cliente (se houver), para o Administrador
  // focar numa empresa. Os demais filtros nao se aplicam a tempo de trabalho.
  function registros() {
    const todos = (BI.dados && BI.dados.tempoTrabalho) || [];
    const f = (BI.filtros && BI.filtros.Cliente) || [];
    if (f.length) return todos.filter((r) => f.indexOf(r.Cliente) !== -1);
    return todos.slice();
  }

  function nomeDe(r) { return r.PorNome || r.Por || "—"; }

  function tabela(colunas, linhas, vazioTxt) {
    const wrap = h("div", "coord-tabela-wrap");
    if (!linhas.length) { wrap.appendChild(h("div", "coord-vazio", vazioTxt || "Sem dados ainda.")); return wrap; }
    const t = h("table", "coord-tabela");
    const thead = h("thead"); const trh = h("tr");
    colunas.forEach((c) => { const th = h("th", c.num ? "num" : null, c.rot); trh.appendChild(th); });
    thead.appendChild(trh); t.appendChild(thead);
    const tb = h("tbody");
    linhas.forEach((ln) => {
      const tr = h("tr");
      colunas.forEach((c) => { const td = h("td", c.num ? "num" : null); const v = c.val(ln); if (v instanceof Node) td.appendChild(v); else td.textContent = v == null ? "" : v; tr.appendChild(td); });
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); return wrap;
  }

  function cartao(titulo, sub, conteudo) {
    const c = h("div", "cartao col-12");
    c.appendChild(h("div", "cartao-titulo", titulo));
    if (sub) c.appendChild(h("div", "coord-sub", sub));
    c.appendChild(conteudo);
    return c;
  }

  function ehAlexandre() {
    const i = BI.DB && BI.DB.estado && BI.DB.estado.identidade;
    return !!(i && String(i.email || "").toLowerCase() === "alexandre.berloffa@elevalife.com.br");
  }

  // Sub-abas da Coordenação (hoje só a Contabilidade de tempo; estrutura pronta p/ crescer).
  let subAtiva = "tempo";
  const SUBABAS = [{ chave: "tempo", rotulo: "Contabilidade de tempo", montar: renderContabilidade }];

  function render() {
    const grade = document.getElementById("grade-coordenacao");
    if (!grade) return;
    grade.innerHTML = "";

    const DB = BI.DB;
    if (DB && DB.estado && DB.estado.identidade && DB.estado.identidade.papel !== "Administrador") {
      grade.appendChild(cartao("Coordenação", null, h("div", "coord-vazio", "Área restrita ao Administrador.")));
      return;
    }

    const nav = h("nav", "subnav-cadastro coord-subnav");
    const area = h("div", "coord-area");
    SUBABAS.forEach((s) => {
      const b = h("button", "subnav-cadastro-item" + (s.chave === subAtiva ? " ativa" : ""), s.rotulo);
      b.type = "button";
      b.addEventListener("click", () => { subAtiva = s.chave; render(); });
      nav.appendChild(b);
    });
    grade.appendChild(nav);
    grade.appendChild(area);
    (SUBABAS.find((s) => s.chave === subAtiva) || SUBABAS[0]).montar(area);
  }

  function renderContabilidade(grade) {
    const regs = registros();

    // ---- KPIs
    const totalAtivo = regs.reduce((s, r) => s + (Number(r.AtivoMs) || 0), 0);
    const porLogin = {}; // Por -> agregado
    regs.forEach((r) => {
      const k = r.Por || "—";
      const a = porLogin[k] || (porLogin[k] = { Por: k, nome: nomeDe(r), ativo: 0, nCad: 0, nAEP: new Set(), nAET: new Set(), ativoCad: 0, ativoAEP: 0, ativoAET: 0 });
      a.nome = nomeDe(r);
      const ms = Number(r.AtivoMs) || 0; a.ativo += ms;
      if (r.Categoria === "AEP") { a.ativoAEP += ms; if (r.RefId) a.nAEP.add(r.RefId); }
      else if (r.Categoria === "AET") { a.ativoAET += ms; if (r.RefId) a.nAET.add(r.RefId); }
      else { a.ativoCad += ms; a.nCad += 1; }
    });
    const logins = Object.values(porLogin).sort((x, y) => y.ativo - x.ativo);

    const kpis = h("div", "cartao col-12");
    const kg = h("div", "coord-kpis");
    const kpi = (valor, rot) => { const d = h("div", "coord-kpi"); d.appendChild(h("div", "coord-kpi-valor", valor)); d.appendChild(h("div", "coord-kpi-rot", rot)); return d; };
    kg.appendChild(kpi(String(regs.length), "Sessões de trabalho registradas"));
    kg.appendChild(kpi(String(logins.length), "Logins (ergonomistas)"));
    kg.appendChild(kpi(fmtDur(totalAtivo), "Tempo ativo total"));
    kg.appendChild(kpi(fmtDur(regs.length ? totalAtivo / regs.length : 0), "Tempo ativo médio por sessão"));
    const cab = h("div", "coord-cab");
    cab.appendChild(h("div", "cartao-titulo", "Contabilidade de tempo"));
    // "Gerar tempos" - dados de exemplo para apresentação (só para o Alexandre).
    if (ehAlexandre()) {
      const bGerar = h("button", "btn-cad-secundario", "⏱ Gerar tempos (exemplo)");
      bGerar.type = "button";
      bGerar.title = "Cria registros de tempo de exemplo (apresentação). Visível só para você.";
      bGerar.addEventListener("click", () => gerarTemposExemplo(bGerar));
      cab.appendChild(bGerar);
    }
    kpis.appendChild(cab);
    kpis.appendChild(h("div", "coord-sub", "Tempo que cada ergonomista levou para cadastrar e avaliar. “Ativo” conta só enquanto a tela estava em uso; o ciclo de vida das AEP/AET mede do início (primeira abertura) à finalização (último salvamento)." + ((BI.filtros && BI.filtros.Cliente && BI.filtros.Cliente.length) ? " Filtrado por: " + BI.filtros.Cliente.join(", ") + "." : "")));
    kpis.appendChild(kg);
    grade.appendChild(kpis);

    // ---- Por login
    grade.appendChild(cartao("Por login", "Tempo ativo e volume de trabalho de cada ergonomista.", tabela([
      { rot: "Ergonomista", val: (l) => l.nome },
      { rot: "Login", val: (l) => l.Por },
      { rot: "Cadastros", num: true, val: (l) => String(l.nCad) },
      { rot: "AEPs", num: true, val: (l) => String(l.nAEP.size) },
      { rot: "AETs", num: true, val: (l) => String(l.nAET.size) },
      { rot: "Ativo cadastro", num: true, val: (l) => fmtDur(l.ativoCad) },
      { rot: "Ativo AEP", num: true, val: (l) => fmtDur(l.ativoAEP) },
      { rot: "Ativo AET", num: true, val: (l) => fmtDur(l.ativoAET) },
      { rot: "Ativo total", num: true, val: (l) => fmtDur(l.ativo) },
    ], logins, "Nenhum tempo registrado ainda. Assim que a equipe cadastrar ou avaliar com o sistema, o tempo aparece aqui.")));

    // ---- Por tipo de cadastro
    const porTipo = {};
    regs.filter((r) => r.Categoria === "Cadastro").forEach((r) => {
      const k = r.Tipo || "—"; const a = porTipo[k] || (porTipo[k] = { tipo: k, n: 0, ativo: 0 });
      a.n += 1; a.ativo += Number(r.AtivoMs) || 0;
    });
    const tipos = Object.values(porTipo).sort((x, y) => y.ativo - x.ativo);
    grade.appendChild(cartao("Por tipo de cadastro", "Quanto tempo cada tipo de entidade levou para ser cadastrado.", tabela([
      { rot: "Tipo", val: (t) => rotTipo(t.tipo) },
      { rot: "Qtd.", num: true, val: (t) => String(t.n) },
      { rot: "Ativo total", num: true, val: (t) => fmtDur(t.ativo) },
      { rot: "Ativo médio", num: true, val: (t) => fmtDur(t.n ? t.ativo / t.n : 0) },
    ], tipos, "Nenhum cadastro cronometrado ainda.")));

    // ---- Ciclo de vida AEP / AET (inicio -> finalizacao)
    const ciclos = {}; // Categoria|RefId -> agregado
    regs.filter((r) => (r.Categoria === "AEP" || r.Categoria === "AET") && r.RefId).forEach((r) => {
      const k = r.Categoria + "|" + r.RefId;
      const c = ciclos[k] || (ciclos[k] = { cat: r.Categoria, refId: r.RefId, nome: "", ab: null, sv: null, ativo: 0, nSess: 0, logins: new Set(), cliente: r.Cliente || "" });
      if (r.RefNome) c.nome = r.RefNome;
      if (!c.cliente && r.Cliente) c.cliente = r.Cliente;
      if (r.AberturaEm && (!c.ab || r.AberturaEm < c.ab)) c.ab = r.AberturaEm;
      if (r.SalvoEm && (!c.sv || r.SalvoEm > c.sv)) c.sv = r.SalvoEm;
      c.ativo += Number(r.AtivoMs) || 0; c.nSess += 1;
      if (r.Por) c.logins.add(r.PorNome || r.Por);
    });
    const listaCiclos = Object.values(ciclos).map((c) => {
      const wall = (c.ab && c.sv) ? (new Date(c.sv).getTime() - new Date(c.ab).getTime()) : 0;
      return Object.assign(c, { wall: Math.max(0, wall) });
    }).sort((x, y) => (y.sv || "").localeCompare(x.sv || ""));

    grade.appendChild(cartao("Ciclo de vida das AEP / AET", "Do início (primeira abertura) à finalização (último salvamento), com o tempo ativo somado.", tabela([
      { rot: "Tipo", val: (c) => ROT_CAT[c.cat] || c.cat },
      { rot: "Posto / referência", val: (c) => c.nome || c.refId },
      { rot: "Empresa", val: (c) => c.cliente || "—" },
      { rot: "Quem", val: (c) => Array.from(c.logins).join(", ") || "—" },
      { rot: "Início", val: (c) => fmtData(c.ab) },
      { rot: "Finalização", val: (c) => fmtData(c.sv) },
      { rot: "Duração total", num: true, val: (c) => fmtDur(c.wall) },
      { rot: "Tempo ativo", num: true, val: (c) => fmtDur(c.ativo) },
      { rot: "Sessões", num: true, val: (c) => String(c.nSess) },
    ], listaCiclos, "Nenhuma AEP/AET cronometrada ainda.")));
  }

  // ------------------------------------------------------------------ Gerar tempos de exemplo (apresentação)
  // Só para alexandre.berloffa@elevalife.com.br. Cria registros em tempoTrabalho
  // para uma empresa (a filtrada, ou a primeira cadastrada), com vários logins.
  async function gerarTemposExemplo(botao) {
    if (!ehAlexandre()) return;
    const DB = BI.DB;
    if (!DB || !DB.estado || !DB.estado.disponivel || DB.estado.somenteLeitura || !DB.estado.modoApi) {
      window.alert("Banco indisponível nesta visualização — não dá para gerar tempos de exemplo agora.");
      return;
    }
    const filtro = (BI.filtros && BI.filtros.Cliente) || [];
    const clientes = BI.dados.cliente || [];
    const alvo = (filtro.length && clientes.find((c) => c.Cliente === filtro[0])) || clientes[0];
    if (!alvo) { window.alert("Cadastre (ou gere) uma empresa antes de gerar tempos de exemplo."); return; }
    const EmpresaId = alvo.id || alvo._id;
    const cliente = alvo.Cliente;
    if (!window.confirm(`Gerar registros de tempo de EXEMPLO para a empresa “${cliente}”? (para apresentação)`)) return;

    const ergs = (BI.dados.ergonomista || []).filter((e) => e.Email);
    const logins = ergs.length ? ergs.slice(0, 3).map((e) => ({ email: e.Email, nome: e.Nome })) : [
      { email: "felipe.alves@elevalife.com.br", nome: "Felipe Alves da Silva" },
      { email: "alexandre.berloffa@elevalife.com.br", nome: "Alexandre Berloffa" },
      { email: "mariana.costa@elevalife.com.br", nome: "Mariana Costa" },
    ];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const min = 60000, hora = 3600000, dia = 86400000;
    const agora = Date.now();
    const setores = ["Produção", "Expedição", "Administrativo", "Manutenção", "Montagem"];
    const cargos = ["Operador", "Auxiliar", "Analista", "Montador", "Técnico"];
    const tiposCad = [["cliente", "Empresa (cliente)"], ["unidade", "Unidade"], ["setor", "Setor / GHE"], ["colaborador", "Colaborador"], ["cargo", "Cargo"]];
    const docs = [];
    const novoDoc = (o) => {
      const login = o.login;
      docs.push(Object.assign({
        Categoria: "Cadastro", Tipo: "", RefId: "", RefNome: "", Acao: "criar",
        Por: login.email, PorNome: login.nome, AtivoMs: 0, AberturaEm: "", SalvoEm: "",
        Cliente: cliente, Unidade: "", Setor: "", "Posto Trabalho": "", Cargo: "", EmpresaId,
      }, o.d));
    };
    // cadastros
    for (let i = 0; i < 8; i++) {
      const login = logins[i % logins.length];
      const [tipo, nome] = tiposCad[i % tiposCad.length];
      const ativo = Math.round(rnd(1.5, 9) * min);
      const ab = agora - Math.round(rnd(3, 25) * dia) - ativo - Math.round(rnd(0, 20) * min);
      novoDoc({ login, d: { Tipo: tipo, RefId: "exemplo-" + tipo + "-" + i, RefNome: nome + " " + (i + 1), AtivoMs: ativo, AberturaEm: new Date(ab).toISOString(), SalvoEm: new Date(ab + ativo + Math.round(rnd(0, 20) * min)).toISOString() } });
    }
    // AEP: 3 postos, 2 sessões cada (ciclo de vida de dias)
    for (let p = 0; p < 3; p++) {
      const login = logins[p % logins.length];
      const setor = setores[p % setores.length], cargo = cargos[p % cargos.length];
      const refId = "exemplo-aep-" + p, refNome = `${setor} › Posto ${p + 1} › ${cargo}`;
      let ab = agora - Math.round(rnd(10, 30) * dia);
      for (let s = 0; s < 2; s++) {
        const ativo = Math.round(rnd(12, 40) * min);
        docs.push({ Categoria: "AEP", Tipo: "avaliacaoErgonomica", RefId: refId, RefNome: refNome, Acao: s === 0 ? "criar" : "editar", Por: login.email, PorNome: login.nome, AtivoMs: ativo, AberturaEm: new Date(ab).toISOString(), SalvoEm: new Date(ab + ativo + Math.round(rnd(0, 30) * min)).toISOString(), Cliente: cliente, Unidade: "Unidade 1", Setor: setor, "Posto Trabalho": "Posto " + (p + 1), Cargo: cargo, EmpresaId });
        ab += Math.round(rnd(2, 6) * dia);
      }
    }
    // AET: 2 postos, 3 sessões cada (ciclo de vida mais longo, tempo ativo em horas)
    for (let p = 0; p < 2; p++) {
      const login = logins[(p + 1) % logins.length];
      const setor = setores[(p + 2) % setores.length], cargo = cargos[(p + 1) % cargos.length];
      const refId = "exemplo-aet-" + p, refNome = `${setor} › Posto ${p + 1} › ${cargo}`;
      let ab = agora - Math.round(rnd(20, 45) * dia);
      for (let s = 0; s < 3; s++) {
        const ativo = Math.round(rnd(25, 70) * min);
        docs.push({ Categoria: "AET", Tipo: "aet", RefId: refId, RefNome: refNome, Acao: s === 0 ? "criar" : "editar", Por: login.email, PorNome: login.nome, AtivoMs: ativo, AberturaEm: new Date(ab).toISOString(), SalvoEm: new Date(ab + ativo + Math.round(rnd(0, 45) * min)).toISOString(), Cliente: cliente, Unidade: "Unidade 1", Setor: setor, "Posto Trabalho": "Posto " + (p + 1), Cargo: cargo, EmpresaId });
        ab += Math.round(rnd(3, 9) * dia);
      }
    }

    if (botao) { botao.disabled = true; botao.textContent = "Gerando…"; }
    let n = 0;
    try {
      for (const d of docs) {
        const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : "tmp" + Date.now() + Math.random().toString(36).slice(2, 8);
        await DB.salvar("tempoTrabalho", id, d, true);
        n++;
      }
      if (DB.recarregar) await DB.recarregar(["tempoTrabalho"]);
      BI.dados.tempoTrabalho = DB.estado.colecoes.tempoTrabalho;
      if (BI.avisar) BI.avisar(`${n} registros de tempo de exemplo gerados para ${cliente}.`);
    } catch (e) {
      console.error("gerarTempos", e); window.alert("Não foi possível gerar todos os tempos: " + (e && e.message ? e.message : e));
    }
    render();
  }

  BI.Coordenacao = { render };
})(window);
