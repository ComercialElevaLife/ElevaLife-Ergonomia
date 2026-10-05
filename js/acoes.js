/* ==========================================================================
   S.I.G.E. - ElevaLife
   ACOES DO RISCO (V 1.2): cada fator do Inventario de Riscos passa a ter uma
   LISTA de acoes (no lugar dos dois campos abertos "Acao para Eliminacao" e
   "Acao Organizacional" + risco unico "apos a melhoria"). Cada acao e um
   registro do Plano de Acao, ligado ao fator ("Fator Risco Id"), com:
   tipo, descricao, segmento corporal, "reduz o risco do segmento de X para
   Y", complexidade, responsavel (nome + e-mail), prazo, status e evidencias.

   O risco "apos a melhoria" deixa de ser digitado: e CALCULADO.
     - por segmento corporal: previsto = menor nivel prometido pelas acoes
       daquele segmento; realizado = idem, so com acoes CONCLUIDAS;
     - do fator: o MAIOR entre os segmentos (enquanto sobrar um segmento
       alto, o fator continua alto).

   Nomes dos tipos de acao sao editaveis pelo Administrador (Configuracoes);
   o codigo interno nunca muda, entao registros antigos acompanham o nome novo.
   ========================================================================== */
(function (global) {
  "use strict";

  const BI = (global.BI = global.BI || {});
  const T = (s) => (BI.Rotulos && BI.Rotulos.texto ? BI.Rotulos.texto(s) : s);
  const Calc = () => BI.Calc;

  // ---- Tipos de acao (codigo fixo; rotulo editavel em Configuracoes) --------
  const TIPOS_PADRAO = [
    { codigo: "Eliminacao", rotulo: "Eliminação", categoria: "Engenharia" },
    { codigo: "Engenharia", rotulo: "Engenharia / Adequação", categoria: "Engenharia" },
    { codigo: "Organizacional", rotulo: "Organizacional", categoria: "Administrativa" },
  ];
  const COMPLEXIDADES = [
    { valor: "Baixa", label: "Baixa" },
    { valor: "Media", label: "Média" },
    { valor: "Alta", label: "Alta" },
  ];
  const GESTAO = ["ElevaLife", "Cliente"];
  const SEGMENTOS_EXTRA = ["Membros Superiores", "Membros Inferiores", "Corpo Todo"];

  const SUGESTOES = {
    Eliminacao: [
      "Disponibilizar suporte de elevação para o notebook",
      "Eliminar o transporte manual de carga (carrinho, talha ou paleteira)",
      "Retirar do posto o material que obriga a postura inadequada",
      "Automatizar a tarefa repetitiva",
    ],
    Engenharia: [
      "Adequar ou substituir a cadeira (altura, profundidade e encosto)",
      "Disponibilizar apoio para os pés",
      "Ajustar a altura da bancada / do posto de trabalho",
      "Redesenhar o layout do posto de trabalho",
      "Posicionar o monitor na altura dos olhos",
      "Fornecer mouse e teclado ergonômicos",
      "Adquirir equipamento auxiliar de movimentação",
    ],
    Organizacional: [
      "Pausa ergonômica programada",
      "Rodízio de atividades entre colaboradores",
      "Treinamento em postura e manuseio de cargas",
      "Revisão de metas de produção / ritmo de trabalho",
      "Ginástica laboral",
    ],
  };

  function mapaRotulosConfigurados() {
    const doc = ((BI.dados && BI.dados.configuracao) || []).find((c) => c.id === "tiposAcao");
    const mapa = {};
    ((doc && doc.Itens) || []).forEach((i) => {
      if (i && i.codigo && String(i.rotulo || "").trim()) mapa[i.codigo] = String(i.rotulo).trim();
    });
    return mapa;
  }
  function tipos() {
    const m = mapaRotulosConfigurados();
    return TIPOS_PADRAO.map((t) => ({ codigo: t.codigo, rotulo: m[t.codigo] || t.rotulo, categoria: t.categoria }));
  }
  function rotuloTipo(codigo) {
    const t = tipos().find((x) => x.codigo === codigo);
    return t ? t.rotulo : codigo || "";
  }
  function categoriaDoTipo(codigo) {
    const t = TIPOS_PADRAO.find((x) => x.codigo === codigo);
    return t ? t.categoria : "Administrativa";
  }

  // ---- Niveis de risco -------------------------------------------------------
  const niveis = () => Calc().NIVEIS_RISCO;
  const idx = (n) => niveis().indexOf(n);
  function niveisAbaixo(nivel) {
    const i = idx(nivel);
    return i <= 0 ? [] : niveis().slice(0, i);
  }
  const maisAlto = (lista) => lista.filter((n) => idx(n) >= 0).sort((a, b) => idx(b) - idx(a))[0] || null;
  const maisBaixo = (lista) => lista.filter((n) => idx(n) >= 0).sort((a, b) => idx(a) - idx(b))[0] || null;
  const rotuloNivel = (n) => (n ? Calc().rotuloNivel(n) : "-");

  function estaConcluida(a) { return !!(a && (a["Dt Conclusao"] || a["Status Execucao"] === "Concluida")); }
  function acoesDoFator(fatorId) {
    if (!fatorId) return [];
    return ((BI.dados && BI.dados.planoAcao) || []).filter((a) => a["Fator Risco Id"] === fatorId);
  }

  // Resumo de risco de um fator a partir das suas acoes.
  //   nivelAtualFator : nivel da matriz (Criticidade x Probabilidade) do fator
  //   acoes           : registros do Plano de Acao (ou rascunhos com os mesmos campos)
  function resumoRisco(nivelAtualFator, acoes) {
    const porSeg = {};
    (acoes || []).forEach((a) => {
      const seg = a["Segmento Corporal"] || "Geral";
      const atual = a["Risco Atual Segmento"] || nivelAtualFator;
      if (!atual || idx(atual) < 0) return;
      (porSeg[seg] = porSeg[seg] || { segmento: seg, itens: [] }).itens.push({ atual, alvo: a["Risco Apos Acao"], concluida: estaConcluida(a) });
    });
    const segmentos = Object.values(porSeg).map((s) => {
      const atual = maisAlto(s.itens.map((i) => i.atual));
      const valido = (i) => i.alvo && idx(i.alvo) >= 0 && idx(i.alvo) < idx(atual);
      return {
        segmento: s.segmento,
        atual,
        previsto: maisBaixo([atual].concat(s.itens.filter(valido).map((i) => i.alvo))),
        realizado: maisBaixo([atual].concat(s.itens.filter((i) => i.concluida && valido(i)).map((i) => i.alvo))),
        total: s.itens.length,
        concluidas: s.itens.filter((i) => i.concluida).length,
      };
    });
    if (!segmentos.length) return null;
    return {
      segmentos,
      atual: maisAlto(segmentos.map((s) => s.atual)),
      previsto: maisAlto(segmentos.map((s) => s.previsto)),
      realizado: maisAlto(segmentos.map((s) => s.realizado)),
    };
  }

  // ---- Utilitarios de DOM -----------------------------------------------------
  function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function campo(rotulo, controle, largo) {
    const d = el("div", "acao-campo" + (largo ? " acao-campo-largo" : ""));
    d.appendChild(el("label", null, rotulo));
    d.appendChild(controle);
    return d;
  }
  function select(opcoes, valor, comBranco) {
    const s = document.createElement("select");
    if (comBranco !== false) { const o = document.createElement("option"); o.value = ""; o.textContent = "-"; s.appendChild(o); }
    opcoes.forEach((op) => {
      const o = document.createElement("option");
      if (op && typeof op === "object") { o.value = op.valor; o.textContent = T(op.label); }
      else { o.value = op; o.textContent = T(rotuloNivel(op)); }
      s.appendChild(o);
    });
    if (valor != null && valor !== "" && !Array.from(s.options).some((o) => o.value === String(valor))) {
      const o = document.createElement("option"); o.value = valor; o.textContent = T(String(valor)); s.appendChild(o);
    }
    s.value = valor != null ? valor : "";
    return s;
  }
  function pilulaNivel(nivel) {
    const p = el("span", "acao-pilula", rotuloNivel(nivel));
    const cor = nivel && Calc().corStatus ? Calc().corStatus(nivel) : "";
    if (cor) { p.style.color = cor; p.style.borderColor = cor; }
    return p;
  }
  function segmentosDisponiveis() {
    const m = (BI.dados && BI.dados._meta) || {};
    return [].concat(m.regioes_frente || [], m.regioes_tras || [], SEGMENTOS_EXTRA);
  }
  const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // ---- Editor de acoes de um fator -------------------------------------------
  //   opts.contexto()      -> { Cliente, Unidade, Setor, Cargo, "Posto Trabalho", Atividade }
  //   opts.nivelAtual()    -> nivel de risco atual do fator ("" se ainda nao classificado)
  //   opts.nomeFator()     -> texto do fator (para gravar junto da acao)
  //   opts.fatorId         -> id do fator (se ja existe) para listar as acoes ligadas
  //   opts.podeEditar      -> false deixa tudo somente leitura
  //   opts.legado          -> { eliminacao, organizacional } textos antigos (opcional)
  //   opts.aoAbrirNoPlano(acao) -> navega para a acao no Plano de Acao
  function criarEditor(opts) {
    const raiz = el("div", "acoes-editor");
    const lista = el("div", "acoes-lista");
    const aviso = el("div", "acoes-aviso");
    const resumoEl = el("div", "acoes-resumo");
    const legadoEl = el("div", "acoes-legado");
    const barra = el("div", "acoes-barra");
    const btnAdd = el("button", "btn-cad-secundario acoes-add", "+ Adicionar ação");
    btnAdd.type = "button";
    barra.appendChild(btnAdd);
    raiz.appendChild(resumoEl);
    raiz.appendChild(lista);
    raiz.appendChild(aviso);
    raiz.appendChild(barra);
    raiz.appendChild(legadoEl);

    const cards = [];
    const podeEditar = opts.podeEditar !== false;
    if (!podeEditar) btnAdd.disabled = true;

    function lerCard(c) {
      return {
        tipo: c.f.tipo.value,
        descricao: c.f.descricao.value.trim(),
        segmento: c.f.segmento.value,
        atual: c.f.atual.value,
        alvo: c.f.alvo.value,
        complexidade: c.f.complexidade.value,
        gestao: c.f.gestao.value,
        responsavel: c.f.responsavel.value.trim(),
        email: c.f.email.value.trim(),
        prazo: c.f.prazo.value,
      };
    }

    function rascunhoParaResumo() {
      return cards.filter((c) => !c.removida).map((c) => {
        if (c.existente && estaConcluida(c.existente)) return c.existente;
        const v = lerCard(c);
        return { "Segmento Corporal": v.segmento, "Risco Atual Segmento": v.atual, "Risco Apos Acao": v.alvo, "Dt Conclusao": c.existente ? c.existente["Dt Conclusao"] : null, "Status Execucao": c.existente ? c.existente["Status Execucao"] : null };
      });
    }

    function atualizarResumo() {
      resumoEl.innerHTML = "";
      const nivel = opts.nivelAtual();
      const r = resumoRisco(nivel, rascunhoParaResumo());
      btnAdd.disabled = !podeEditar || !nivel;
      aviso.textContent = !nivel ? "Defina Criticidade e Probabilidade do fator para poder propor ações." : "";
      aviso.hidden = !!nivel;
      if (!r) {
        if (nivel) resumoEl.appendChild(el("div", "acoes-resumo-vazio", "Nenhuma ação proposta para este fator. Sem ação, o risco após a melhoria não se aplica."));
        return;
      }
      const linha = el("div", "acoes-resumo-linha");
      [["Risco atual", nivel || r.atual], ["Previsto após as ações", r.previsto], ["Realizado (ações concluídas)", r.realizado]].forEach(([rot, n]) => {
        const b = el("div", "acoes-resumo-item");
        b.appendChild(el("span", "acoes-resumo-rot", rot));
        b.appendChild(pilulaNivel(n));
        linha.appendChild(b);
      });
      resumoEl.appendChild(linha);
      const tab = el("div", "acoes-resumo-segs");
      r.segmentos.forEach((s) => {
        const l = el("div", "acoes-resumo-seg");
        l.appendChild(el("span", "acoes-resumo-segnome", T(s.segmento)));
        l.appendChild(el("span", "acoes-resumo-segtxt", `${rotuloNivel(s.atual)} → ${rotuloNivel(s.previsto)} previsto · realizado: ${rotuloNivel(s.realizado)} (${s.concluidas}/${s.total} ações concluídas)`));
        tab.appendChild(l);
      });
      resumoEl.appendChild(tab);
    }

    function repopularAlvo(c) {
      const abaixo = niveisAbaixo(c.f.atual.value);
      const valorAtual = c.f.alvo.value;
      c.f.alvo.innerHTML = "";
      const branco = document.createElement("option"); branco.value = ""; branco.textContent = abaixo.length ? "-" : "já está no menor nível";
      c.f.alvo.appendChild(branco);
      abaixo.forEach((n) => { const o = document.createElement("option"); o.value = n; o.textContent = rotuloNivel(n); c.f.alvo.appendChild(o); });
      c.f.alvo.value = abaixo.includes(valorAtual) ? valorAtual : "";
      c.f.alvo.disabled = !abaixo.length || c.travada;
    }

    function atualizarSugestoes(c) {
      c.dl.innerHTML = "";
      (SUGESTOES[c.f.tipo.value] || []).forEach((s) => { const o = document.createElement("option"); o.value = s; c.dl.appendChild(o); });
    }

    function statusTexto(a) {
      const st = Calc().statusDaLinhaAcao ? Calc().statusDaLinhaAcao(a, new Date(new Date().toDateString())) : "";
      let ev = "";
      if (estaConcluida(a)) {
        const n = (a.Evidencias || []).length;
        if (n) ev = ` · evidência anexada (${n})`;
        else if (a._dispensa && !a._dispensa.regularizadaEm) ev = ` · evidência pendente até ${BI.Datas.isoParaBR(a._dispensa.prazo)}`;
        else ev = " · sem evidência";
      }
      return `${T(st)}${ev}`;
    }

    function adicionarCard(existente, preenchido) {
      const c = { existente: existente || null, removida: false, f: {}, travada: !!(existente && estaConcluida(existente)) };
      const base = existente || preenchido || {};
      const nivelFator = opts.nivelAtual();
      c.raiz = el("div", "acao-card" + (c.travada ? " acao-card-concluida" : ""));
      c.dl = document.createElement("datalist");
      c.dl.id = "dl-acao-" + Math.random().toString(36).slice(2);

      const cab = el("div", "acao-card-cab");
      c.titulo = el("div", "acao-card-titulo");
      cab.appendChild(c.titulo);
      const botoes = el("div", "acao-card-botoes");
      if (existente && opts.aoAbrirNoPlano) {
        const b = el("button", "btn-cad-secundario", "Abrir no Plano de Ação"); b.type = "button";
        b.addEventListener("click", () => opts.aoAbrirNoPlano(existente));
        botoes.appendChild(b);
      }
      if (podeEditar && !c.travada) {
        const r = el("button", "btn-cad-secundario acao-remover", "Remover"); r.type = "button";
        r.addEventListener("click", () => {
          if (c.existente && !global.confirm("Remover esta ação do Plano de Ação? Ela será excluída ao salvar o fator.")) return;
          c.removida = true; c.raiz.hidden = true; atualizarResumo(); notificar();
        });
        botoes.appendChild(r);
      }
      cab.appendChild(botoes);
      c.raiz.appendChild(cab);
      if (existente) c.raiz.appendChild(el("div", "acao-card-status", statusTexto(existente)));

      c.f.tipo = select(tipos().map((t) => ({ valor: t.codigo, label: t.rotulo })), base["Tipo Acao"] || "");
      c.f.complexidade = select(COMPLEXIDADES, base.Complexidade || "");
      c.f.gestao = select(GESTAO, base["Gestao Acao"] || "ElevaLife", false);
      c.f.descricao = document.createElement("input"); c.f.descricao.type = "text"; c.f.descricao.value = base["Acao Recomendada"] || base.descricao || "";
      c.f.descricao.setAttribute("list", c.dl.id); c.f.descricao.placeholder = "Escolha uma sugestão ou descreva a ação";
      c.f.segmento = select(segmentosDisponiveis().map((s) => ({ valor: s, label: s })), base["Segmento Corporal"] || "");
      c.f.atual = select(niveis(), base["Risco Atual Segmento"] || nivelFator || "");
      c.f.alvo = document.createElement("select");
      c.f.responsavel = document.createElement("input"); c.f.responsavel.type = "text"; c.f.responsavel.value = base["Responsavel Acao"] || "";
      c.f.responsavel.setAttribute("list", "dl-acao-responsaveis");
      c.f.email = document.createElement("input"); c.f.email.type = "email"; c.f.email.value = base["E-mail Responsavel"] || "";
      c.f.prazo = BI.Datas.criarCampo("data", base["Dt Programada"] || "");

      const grade = el("div", "acao-grade");
      grade.appendChild(campo("Tipo da ação", c.f.tipo));
      grade.appendChild(campo("Complexidade de execução", c.f.complexidade));
      grade.appendChild(campo("Gestão da ação", c.f.gestao));
      const d = campo("Ação", c.f.descricao, true); d.appendChild(c.dl); grade.appendChild(d);
      grade.appendChild(campo("Segmento corporal atingido", c.f.segmento));
      grade.appendChild(campo("Risco atual do segmento", c.f.atual));
      grade.appendChild(campo("Esta ação reduz o risco para", c.f.alvo));
      grade.appendChild(campo("Responsável", c.f.responsavel));
      grade.appendChild(campo("E-mail do responsável", c.f.email));
      grade.appendChild(campo("Prazo (data programada)", c.f.prazo.elementoDOM || c.f.prazo));
      c.raiz.appendChild(grade);
      const msg = el("div", "acao-card-erro"); msg.hidden = true; c.msg = msg; c.raiz.appendChild(msg);

      repopularAlvo(c);
      if (base["Risco Apos Acao"]) { c.f.alvo.value = base["Risco Apos Acao"]; if (c.f.alvo.value !== base["Risco Apos Acao"]) c.f.alvo.value = ""; }
      atualizarSugestoes(c);
      if (c.travada || !podeEditar) Object.values(c.f).forEach((x) => { try { x.disabled = true; } catch (_) { /* campo composto */ } });
      if (c.travada || !podeEditar) { const dt = c.f.prazo.elementoDOM || c.f.prazo; if (dt.querySelectorAll) dt.querySelectorAll("input,button").forEach((i) => { i.disabled = true; }); }

      function renumerar() { c.titulo.textContent = `Ação ${cards.filter((x) => !x.removida).indexOf(c) + 1}${c.f.tipo.value ? " · " + rotuloTipo(c.f.tipo.value) : ""}`; }
      c.renumerar = renumerar;
      c.f.tipo.addEventListener("change", () => { atualizarSugestoes(c); renumerar(); notificar(); });
      c.f.atual.addEventListener("change", () => { repopularAlvo(c); atualizarResumo(); notificar(); c.tocouAtual = true; });
      [c.f.alvo, c.f.segmento, c.f.complexidade, c.f.gestao].forEach((x) => x.addEventListener("change", () => { atualizarResumo(); notificar(); }));
      [c.f.descricao, c.f.email, c.f.prazo].forEach((x) => x.addEventListener("input", notificar));
      c.f.responsavel.addEventListener("change", () => {
        if (c.f.email.value) return;
        const anterior = ((BI.dados && BI.dados.planoAcao) || []).find((a) => a["Responsavel Acao"] === c.f.responsavel.value && a["E-mail Responsavel"]);
        if (anterior) c.f.email.value = anterior["E-mail Responsavel"];
      });
      if (!c.f.prazo.addEventListener) { /* elemento composto */ }

      cards.push(c);
      lista.appendChild(c.raiz);
      lista.appendChild(c.dl);
      cards.forEach((x) => x.renumerar && x.renumerar());
      atualizarResumo();
      return c;
    }

    function notificar() { if (opts.aoMudar) opts.aoMudar(); }

    // Lista de nomes ja usados como responsaveis (autocompletar).
    (function garantirListaResponsaveis() {
      let dl = document.getElementById("dl-acao-responsaveis");
      if (!dl) { dl = document.createElement("datalist"); dl.id = "dl-acao-responsaveis"; document.body.appendChild(dl); }
      dl.innerHTML = "";
      Array.from(new Set(((BI.dados && BI.dados.planoAcao) || []).map((a) => a["Responsavel Acao"]).filter(Boolean))).sort().forEach((n) => {
        const o = document.createElement("option"); o.value = n; dl.appendChild(o);
      });
    })();

    btnAdd.addEventListener("click", () => { adicionarCard(null); notificar(); });

    // Acoes que ja existem para este fator.
    acoesDoFator(opts.fatorId).forEach((a) => adicionarCard(a));
    atualizarResumo();

    // Registro anterior a V 1.2: textos antigos viram acoes com um clique.
    const leg = opts.legado;
    if (leg && (leg.eliminacao || leg.organizacional) && !cards.length) {
      legadoEl.appendChild(el("div", "acoes-legado-titulo", "Texto do registro anterior à V 1.2"));
      [["Ação para Eliminação", leg.eliminacao, "Eliminacao"], ["Ação Organizacional", leg.organizacional, "Organizacional"]].forEach(([rot, txt, tipo]) => {
        if (!txt) return;
        const l = el("div", "acoes-legado-item");
        l.appendChild(el("div", "acoes-legado-txt", `${rot}: ${txt}`));
        if (podeEditar) {
          const b = el("button", "btn-cad-secundario", "Converter em ação"); b.type = "button";
          b.addEventListener("click", () => { adicionarCard(null, { "Tipo Acao": tipo, "Acao Recomendada": txt }); l.remove(); notificar(); });
          l.appendChild(b);
        }
        legadoEl.appendChild(l);
      });
    }

    function validar() {
      let primeiroErro = null;
      cards.forEach((c) => {
        if (c.removida || c.travada) return;
        const v = lerCard(c);
        let erro = null;
        if (!v.tipo) erro = "Escolha o tipo da ação.";
        else if (!v.descricao) erro = "Descreva a ação.";
        else if (!v.segmento) erro = "Informe o segmento corporal atingido.";
        else if (!v.atual) erro = "Informe o risco atual do segmento.";
        else if (niveisAbaixo(v.atual).length && !v.alvo) erro = "Informe para qual nível esta ação reduz o risco.";
        else if (v.alvo && !(idx(v.alvo) < idx(v.atual))) erro = "A ação precisa reduzir o risco para um nível menor que o atual.";
        else if (!v.responsavel) erro = "Informe o responsável pela ação.";
        else if (!EMAIL_OK.test(v.email)) erro = "Informe um e-mail válido do responsável (ele será avisado da atribuição).";
        else if (!v.prazo || (c.f.prazo.validationMessage)) erro = "Informe o prazo (data programada) em DD/MM/AAAA.";
        c.msg.hidden = !erro; c.msg.textContent = erro || "";
        c.raiz.classList.toggle("acao-card-com-erro", !!erro);
        if (erro && !primeiroErro) primeiroErro = { c, erro };
      });
      if (primeiroErro) {
        if (primeiroErro.c.raiz.scrollIntoView) primeiroErro.c.raiz.scrollIntoView({ block: "center", behavior: "smooth" });
        return primeiroErro.erro;
      }
      return null;
    }

    function ativas() { return cards.filter((c) => !c.removida); }
    function temAlteracoes() {
      return cards.some((c) => (c.removida && c.existente) || (!c.existente && !c.removida) || (c.existente && !c.travada && !c.removida && mudou(c)));
    }
    function dadosDoCard(c) {
      const v = lerCard(c);
      return {
        "Tipo Acao": v.tipo, "Acao Recomendada": v.descricao, "Categoria Acao": categoriaDoTipo(v.tipo), "Gestao Acao": v.gestao || "ElevaLife",
        "Responsavel Acao": v.responsavel, "E-mail Responsavel": v.email, "Dt Programada": v.prazo,
        "Segmento Corporal": v.segmento, "Risco Atual Segmento": v.atual, "Risco Apos Acao": v.alvo || null, Complexidade: v.complexidade || null,
      };
    }
    function mudou(c) {
      const novo = dadosDoCard(c);
      return Object.keys(novo).some((k) => String(novo[k] == null ? "" : novo[k]) !== String((c.existente[k] == null ? "" : c.existente[k])));
    }
    function proximoNr(cliente) {
      const nrs = ((BI.dados && BI.dados.planoAcao) || []).filter((a) => a.Cliente === cliente).map((a) => Number(a["Nr Acao"]) || 0);
      return (nrs.length ? Math.max.apply(null, nrs) : 0) + 1;
    }

    // Grava as acoes no Plano de Acao (chamar DEPOIS de salvar o fator).
    async function salvar(fatorId) {
      const ctx = opts.contexto();
      let nr = proximoNr(ctx.Cliente);
      const mapa = ((BI.dados && BI.dados.mapaRisco) || []).find((m) => Calc().DIMENSOES.every((d) => m[d] === ctx[d]));
      let gravadas = 0;
      for (const c of cards) {
        if (c.removida) {
          if (c.existente) { await BI.DB.excluir("planoAcao", c.existente._id); gravadas++; }
          continue;
        }
        if (c.travada) continue;
        if (c.existente && !mudou(c)) continue;
        const novo = dadosDoCard(c);
        let dados;
        if (c.existente) {
          dados = {};
          Object.keys(c.existente).forEach((k) => { if (k[0] !== "_" && k !== "id") dados[k] = c.existente[k]; });
          Object.assign(dados, novo, { "Fator Risco Id": fatorId, "Fator Risco Nome": opts.nomeFator() });
          await BI.DB.salvar("planoAcao", c.existente._id, dados);
          c.existente = Object.assign({}, c.existente, dados);
        } else {
          dados = Object.assign({}, ctx, novo, {
            "Nr Acao": nr++, "Fator Risco Id": fatorId, "Fator Risco Nome": opts.nomeFator(), "Status Execucao": "Nao iniciada",
            "Risco Global": mapa ? mapa["Risco Global"] : null,
          });
          const idNovo = await BI.DB.salvar("planoAcao", null, dados);
          // Se algo falhar adiante e a pessoa salvar de novo, esta acao ja existe (nao duplica).
          c.existente = Object.assign({ _id: idNovo }, dados);
        }
        gravadas++;
      }
      return gravadas;
    }

    return {
      el: raiz, validar, salvar, temAlteracoes,
      total: () => ativas().length,
      atualizarNivel() {
        cards.forEach((c) => {
          if (c.removida || c.travada || c.tocouAtual) return;
          c.f.atual.value = opts.nivelAtual() || "";
          repopularAlvo(c);
        });
        atualizarResumo();
      },
    };
  }

  // ---- Tela de Configuracoes (so Administrador) ------------------------------
  function montarTelaConfiguracoes(raiz, opcoes) {
    raiz.innerHTML = "";
    const cartao = el("div", "cartao col-12 bloco-cadastro");
    const cab = el("div", "cadastro-cabecalho");
    cab.appendChild(el("div", "cartao-titulo", "Configurações do sistema"));
    cartao.appendChild(cab);
    cartao.appendChild(el("p", "config-ajuda", "Nomes dos tipos de ação do Plano de Ação. Use o termo da área técnica: o nome novo vale para todos os clientes e para os registros já criados (o código interno de cada tipo não muda)."));
    const form = el("form", "config-form");
    const configurado = mapaRotulosConfigurados();
    const campos = {};
    TIPOS_PADRAO.forEach((t) => {
      const i = document.createElement("input"); i.type = "text"; i.maxLength = 40; i.value = configurado[t.codigo] || t.rotulo; i.placeholder = t.rotulo;
      campos[t.codigo] = i;
      form.appendChild(campo(`Nome do tipo “${t.rotulo}” (padrão)`, i));
    });
    const msg = el("div", "form-cadastro-erro"); msg.hidden = true;
    const barra = el("div", "form-cadastro-acoes");
    const bPadrao = el("button", "btn-cad-secundario", "Restaurar nomes padrão"); bPadrao.type = "button";
    const bSalvar = el("button", "btn-cad-primario", "Salvar"); bSalvar.type = "submit";
    barra.appendChild(bPadrao); barra.appendChild(bSalvar);
    form.appendChild(msg); form.appendChild(barra);
    cartao.appendChild(form);
    raiz.appendChild(cartao);

    bPadrao.addEventListener("click", () => { TIPOS_PADRAO.forEach((t) => { campos[t.codigo].value = t.rotulo; }); });
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const itens = TIPOS_PADRAO.map((t) => ({ codigo: t.codigo, rotulo: campos[t.codigo].value.trim() }));
      const vazio = itens.find((i) => !i.rotulo);
      const repetido = itens.find((i, n) => itens.findIndex((j) => j.rotulo.toLowerCase() === i.rotulo.toLowerCase()) !== n);
      if (vazio || repetido) { msg.hidden = false; msg.textContent = vazio ? "Nenhum nome pode ficar em branco." : "Os três nomes precisam ser diferentes entre si."; return; }
      bSalvar.disabled = true;
      try {
        await BI.DB.salvar("configuracao", "tiposAcao", { Nome: "Tipos de ação", Itens: itens }, true);
        msg.hidden = false; msg.style.color = "var(--verde, #1b7a3d)"; msg.textContent = "Configuração salva.";
        if (opcoes && opcoes.aoSalvar) opcoes.aoSalvar();
      } catch (e) {
        msg.hidden = false; msg.style.color = ""; msg.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e);
      } finally { bSalvar.disabled = false; }
    });
  }

  BI.Acoes = {
    TIPOS_PADRAO, COMPLEXIDADES, SUGESTOES, tipos, rotuloTipo, categoriaDoTipo, niveisAbaixo, acoesDoFator, resumoRisco,
    estaConcluida, criarEditor, montarTelaConfiguracoes, segmentosDisponiveis,
  };
})(window);
