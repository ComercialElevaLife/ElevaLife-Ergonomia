/* ==========================================================================
   S.I.G.E. - ElevaLife
   V 2.50 (Alexandre - solicitação 2) + ajustes: aba BENCHMARK.

   Mostra os números da empresa comparados com a base (todas as empresas e
   unidades), de forma ANÔNIMA: nunca aparece nome nem número cru de outra
   empresa — só a posição numa régua ("melhor que X% dos clientes"), a média e a
   mediana da base, com N mínimo.

   - Régua geral no topo (posição geral frente aos demais).
   - Indicadores agrupados (Cobertura, Riscos por nível, Plano de ação,
     Absenteísmo, Restritos), com mini-réguas. Inclui níveis de risco separados
     (muito alto, alto, moderado, baixo, trivial) e números brutos.
   - Detalhe por UNIDADE: dá para ver a régua e os indicadores de uma unidade
     específica (comparada com a base de unidades), além da pontuação de cada uma.
   - Equipe (Administrador/Consultor) vê RANKING identificado (no escopo do papel)
     e pode alternar para a "visão do cliente" (anônima).
   - Cores: o marcador fica VERDE (acima da base), AMARELO (na média) ou VERMELHO
     (abaixo), conforme a posição — a mesma cor do veredito.
   ========================================================================== */

(function (global) {
  "use strict";
  const BI = global.BI = global.BI || {};
  const estado = { dados: null, foco: null, focoUnidade: null, focoTotal: false, anonimo: false, carregando: false };

  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function ehEquipe() { const i = BI.DB && BI.DB.estado && BI.DB.estado.identidade; return !!(i && (i.papel === "Administrador" || i.papel === "Consultor")); }

  function fmtValor(v, unidade) {
    if (v == null || Number.isNaN(v)) return "—";
    if (unidade === "%") return Math.round(v) + "%";
    if (unidade === "/100") return v.toFixed(1);
    if (unidade === "dias") return v.toFixed(1);
    if (unidade === "num2") return v.toFixed(1);
    if (unidade === "num") return String(Math.round(v));
    return String(v);
  }
  function verdito(p) {
    if (p == null) return { txt: "sem base", cls: "neutro" };
    if (p >= 66) return { txt: "acima da média", cls: "bom" };
    if (p >= 33) return { txt: "na média", cls: "medio" };
    return { txt: "abaixo da média", cls: "ruim" };
  }

  // Régua 0..100 (percentil já ajustado por direção: maior = melhor). O marcador
  // ganha a cor do veredito (verde/amarelo/vermelho) — antes era sempre vinho.
  function regua(percentil, opcoes) {
    opcoes = opcoes || {};
    const wrap = el("div", "bench-track" + (opcoes.grande ? " grande" : "") + (opcoes.mini ? " mini" : ""));
    ["ruim", "medio", "bom"].forEach((z) => wrap.appendChild(el("div", "bench-zona z-" + z)));
    const med = el("div", "bench-mediana"); med.style.left = "50%"; med.title = "Mediana da base"; wrap.appendChild(med);
    if (percentil != null) {
      const vd = verdito(percentil);
      const m = el("div", "bench-marker " + vd.cls); m.style.left = Math.max(0, Math.min(100, percentil)) + "%";
      m.title = "Melhor que " + percentil + "% da base";
      wrap.appendChild(m);
    } else {
      wrap.appendChild(el("div", "bench-sembase", "base insuficiente"));
    }
    return wrap;
  }

  function cardIndicador(ind, ent, base) {
    const v = ent.valores[ind.chave];
    const p = ent.percentis[ind.chave];
    const b = (base.indicadores && base.indicadores[ind.chave]) || {};
    const vd = verdito(p);
    const card = el("div", "bench-ind");
    const topo = el("div", "bench-ind-topo");
    topo.appendChild(el("span", "bench-ind-rot", ind.rotulo + (ind.bruto ? " ⟐" : "")));
    topo.appendChild(el("span", "bench-ind-val " + vd.cls, fmtValor(v, ind.unidade)));
    card.appendChild(topo);
    if (!b.suficiente) {
      card.appendChild(el("div", "bench-ind-nobase", "Base insuficiente para comparar (menos de " + estado.dados.minN + " na base com este dado)."));
      card.appendChild(regua(null));
      return card;
    }
    card.appendChild(regua(p));
    const rod = el("div", "bench-ind-rodape");
    rod.appendChild(el("span", "bench-tag " + vd.cls, p != null ? ("melhor que " + p + "% da base · " + vd.txt) : vd.txt));
    rod.appendChild(el("span", "bench-ind-base", "média da base: " + fmtValor(b.media, ind.unidade) + " · mediana: " + fmtValor(b.mediana, ind.unidade)));
    card.appendChild(rod);
    return card;
  }

  // Card do cenário TOTAL (sem régua/percentil — ele É a base): valor somado + referência.
  function cardTotal(ind, totalVals, base) {
    const v = totalVals[ind.chave];
    const b = (base.indicadores && base.indicadores[ind.chave]) || {};
    const card = el("div", "bench-ind");
    const topo = el("div", "bench-ind-topo");
    topo.appendChild(el("span", "bench-ind-rot", ind.rotulo + (ind.bruto ? " ⟐" : "")));
    topo.appendChild(el("span", "bench-ind-val", fmtValor(v, ind.unidade)));
    card.appendChild(topo);
    const rod = el("div", "bench-ind-rodape");
    rod.appendChild(el("span", "bench-ind-base", ind.bruto ? "soma de todas as empresas" : ("média por empresa: " + fmtValor(b.media, ind.unidade) + " · mediana: " + fmtValor(b.mediana, ind.unidade))));
    card.appendChild(rod);
    return card;
  }

  // Ranking identificado (equipe, fora do modo anônimo). focoId destaca a linha (ou null).
  function secaoRanking(d, focoId) {
    if (!(ehEquipe() && !estado.anonimo && d.empresas.length > 1)) return null;
    const secR = el("div", "bench-sec");
    secR.appendChild(el("h3", "bench-sec-tit", "Ranking (empresas sob seu acesso)"));
    const scroll = el("div", "tabela-scroll");
    const tab = el("table", "tabela-dados bench-rank");
    const colsRank = d.indicadores.filter((i) => !i.noScore);
    const thead = el("thead"); const trh = el("tr");
    ["#", "Empresa", "Posição geral"].concat(colsRank.map((i) => i.rotulo)).forEach((c) => trh.appendChild(el("th", null, c)));
    thead.appendChild(trh); tab.appendChild(thead);
    const tb = el("tbody");
    d.empresas.forEach((e, i) => {
      const tr = el("tr"); if (focoId && e.empresaId === focoId) tr.className = "bench-rank-foco";
      tr.appendChild(el("td", null, String(i + 1)));
      tr.appendChild(el("td", "bench-rank-nome", e.nome));
      tr.appendChild(el("td", null, e.scoreGeral != null ? e.scoreGeral + "%" : "—"));
      colsRank.forEach((ind) => tr.appendChild(el("td", null, fmtValor(e.valores[ind.chave], ind.unidade))));
      tr.addEventListener("click", () => { estado.foco = e.empresaId; estado.focoTotal = false; estado.focoUnidade = null; const host = document.getElementById("benchmark-conteudo"); desenhar(host); window.scrollTo({ top: 0, behavior: "smooth" }); });
      tb.appendChild(tr);
    });
    tab.appendChild(tb); scroll.appendChild(tab); secR.appendChild(scroll);
    secR.appendChild(el("p", "bench-rank-nota", "Clique numa empresa para ver a régua dela. O ranking mostra todas as empresas da base (o cliente vê apenas a versão anônima, sem nomes)."));
    return secR;
  }

  // Entidade em foco (empresa inteira ou uma unidade) + a base correspondente.
  function alvoAtual() {
    const d = estado.dados;
    if (estado.focoUnidade) {
      const u = (d.unidades || []).find((x) => (x.empresaId + "::" + x.unidade) === estado.focoUnidade);
      if (u) return { ent: u, base: d.baseUnidades, rotulo: u.nome + " · " + (u.unidade || "—"), tipo: "unidade" };
    }
    const e = d.empresas.find((x) => x.empresaId === estado.foco) || d.empresas[0];
    return { ent: e, base: d.base, rotulo: e ? e.nome : "", tipo: "empresa" };
  }

  function desenhar(host) {
    const d = estado.dados;
    host.innerHTML = "";
    const wrap = el("div", "bench-wrap");

    const cab = el("div", "bench-cab");
    cab.appendChild(el("h2", "bench-titulo", "Benchmark — comparação com a base"));
    cab.appendChild(el("p", "bench-sub", "Os números da sua empresa comparados, de forma anônima, com todas as empresas e unidades da base. Nenhum nome ou número de outro cliente é exibido — só a sua posição relativa. ⟐ = número bruto (total), para comparar volume."));
    wrap.appendChild(cab);

    const foco = d.empresas.find((e) => e.empresaId === estado.foco) || d.empresas[0];
    if (!foco) { wrap.appendChild(el("div", "bench-vazio", "Ainda não há dados suficientes da sua empresa para o benchmark.")); host.appendChild(wrap); return; }

    // Barra: empresa (equipe) + detalhe por unidade + alternância visão do cliente.
    const barra = el("div", "bench-barra");
    const temTotal = ehEquipe() && d.total && d.empresas.length > 1;
    if (d.empresas.length > 1 || temTotal) {
      const lab = el("label", "bench-sel-lab", "Empresa: ");
      const sel = el("select", "bench-sel");
      // V 2.50 (Alexandre): cenário TOTAL da ElevaLife (todas as empresas somadas) — só para a equipe.
      if (temTotal) { const o = el("option", null, "★ Total ElevaLife (todas as empresas)"); o.value = "__total"; if (estado.focoTotal) o.selected = true; sel.appendChild(o); }
      d.empresas.forEach((e) => { const o = el("option", null, e.nome); o.value = e.empresaId; if (!estado.focoTotal && e.empresaId === estado.foco) o.selected = true; sel.appendChild(o); });
      sel.addEventListener("change", () => { if (sel.value === "__total") { estado.focoTotal = true; } else { estado.focoTotal = false; estado.foco = sel.value; } estado.focoUnidade = null; desenhar(host); });
      lab.appendChild(sel); barra.appendChild(lab);
    }
    const unisDaEmpresa = (d.unidades || []).filter((u) => u.empresaId === foco.empresaId);
    if (!estado.focoTotal && unisDaEmpresa.length) {
      const labU = el("label", "bench-sel-lab", "Detalhe: ");
      const selU = el("select", "bench-sel");
      const o0 = el("option", null, "Empresa inteira"); o0.value = ""; if (!estado.focoUnidade) o0.selected = true; selU.appendChild(o0);
      unisDaEmpresa.forEach((u) => { const k = u.empresaId + "::" + u.unidade; const o = el("option", null, "Unidade: " + (u.unidade || "—")); o.value = k; if (estado.focoUnidade === k) o.selected = true; selU.appendChild(o); });
      selU.addEventListener("change", () => { estado.focoUnidade = selU.value || null; desenhar(host); });
      labU.appendChild(selU); barra.appendChild(labU);
    }
    if (ehEquipe()) {
      const btn = el("button", "bench-toggle" + (estado.anonimo ? " ativo" : ""), estado.anonimo ? "👁 Ver ranking (identificado)" : "🙈 Ver como cliente (anônimo)");
      btn.type = "button";
      btn.addEventListener("click", () => { estado.anonimo = !estado.anonimo; desenhar(host); });
      barra.appendChild(btn);
    }
    if (barra.children.length) wrap.appendChild(barra);

    // ---- Cenário TOTAL da ElevaLife (todas as empresas somadas).
    if (estado.focoTotal && d.total) {
      const cabT = el("div", "bench-regua-geral");
      cabT.appendChild(el("div", "bench-geral-tit", "Cenário total ElevaLife"));
      cabT.appendChild(el("div", "bench-geral-nota", "Agregado de " + d.total.nEmpresas + " empresa(s) e " + d.total.nUnidades + " unidade(s), somando todas as empresas. Não inclui a Empresa Demonstrativa nem empresas excluídas. (“média por empresa” = média da base.)"));
      wrap.appendChild(cabT);
      const gruposT = [];
      d.indicadores.forEach((ind) => { if (gruposT.indexOf(ind.grupo) === -1) gruposT.push(ind.grupo); });
      gruposT.forEach((g) => {
        const sec = el("div", "bench-sec");
        sec.appendChild(el("h3", "bench-sec-tit", g));
        const grade = el("div", "bench-grade");
        d.indicadores.filter((ind) => ind.grupo === g).forEach((ind) => grade.appendChild(cardTotal(ind, d.total.valores, d.base)));
        sec.appendChild(grade);
        wrap.appendChild(sec);
      });
      const rT = secaoRanking(d, null);
      if (rT) wrap.appendChild(rT);
      host.appendChild(wrap);
      return;
    }

    const alvo = alvoAtual();
    const ent = alvo.ent;

    // Régua GERAL.
    const geral = el("div", "bench-regua-geral");
    const gcab = el("div", "bench-geral-cab");
    const nomeFoco = (estado.anonimo || !ehEquipe()) ? (alvo.tipo === "unidade" ? "a unidade " + (ent.unidade || "") : "a sua empresa") : alvo.rotulo;
    gcab.appendChild(el("span", "bench-geral-tit", "Posição geral · " + nomeFoco));
    const vdG = verdito(ent.scoreGeral);
    gcab.appendChild(el("span", "bench-geral-badge " + vdG.cls, ent.scoreGeral != null ? ("melhor que " + ent.scoreGeral + "% da base · " + vdG.txt) : "sem base suficiente"));
    geral.appendChild(gcab);
    geral.appendChild(regua(ent.scoreGeral, { grande: true }));
    geral.appendChild(el("div", "bench-geral-leg", "← abaixo da base    ·    mediana    ·    acima da base →"));
    if (alvo.tipo === "unidade") geral.appendChild(el("div", "bench-geral-nota", "Comparando esta UNIDADE com a base de todas as unidades."));
    wrap.appendChild(geral);

    // Indicadores agrupados.
    const ordemGrupos = [];
    d.indicadores.forEach((ind) => { if (ordemGrupos.indexOf(ind.grupo) === -1) ordemGrupos.push(ind.grupo); });
    ordemGrupos.forEach((g) => {
      const sec = el("div", "bench-sec");
      sec.appendChild(el("h3", "bench-sec-tit", g));
      const grade = el("div", "bench-grade");
      d.indicadores.filter((ind) => ind.grupo === g).forEach((ind) => grade.appendChild(cardIndicador(ind, ent, alvo.base)));
      sec.appendChild(grade);
      wrap.appendChild(sec);
    });

    // Comparativo entre as unidades do próprio cliente (pontuação de cada + clicar para detalhar).
    if (unisDaEmpresa.length) {
      const secUni = el("div", "bench-sec");
      secUni.appendChild(el("h3", "bench-sec-tit", "Unidades da sua empresa — posição de cada uma (clique para ver o detalhe)"));
      unisDaEmpresa.slice().sort((a, b) => (b.scoreGeral || -1) - (a.scoreGeral || -1)).forEach((u) => {
        const k = u.empresaId + "::" + u.unidade;
        const linha = el("div", "bench-uni-linha" + (estado.focoUnidade === k ? " ativa" : ""));
        linha.appendChild(el("span", "bench-uni-nome", u.unidade || "—"));
        const tk = regua(u.scoreGeral, { mini: true });
        linha.appendChild(tk);
        linha.appendChild(el("span", "bench-uni-score", u.scoreGeral != null ? (u.scoreGeral + "%") : "—"));
        linha.addEventListener("click", () => { estado.focoUnidade = k; desenhar(host); window.scrollTo({ top: 0, behavior: "smooth" }); });
        secUni.appendChild(linha);
      });
      wrap.appendChild(secUni);
    }

    // Ranking identificado (equipe, fora do modo anônimo).
    const secR = secaoRanking(d, foco.empresaId);
    if (secR) wrap.appendChild(secR);

    host.appendChild(wrap);
  }

  async function render() {
    const host = document.getElementById("benchmark-conteudo");
    if (!host) return;
    if (estado.carregando) return;
    estado.carregando = true;
    host.innerHTML = "<div class='bench-carregando'>Carregando benchmark…</div>";
    try {
      const resp = await fetch("/api/benchmark", { credentials: "same-origin" });
      if (!resp.ok) throw new Error("status " + resp.status);
      estado.dados = await resp.json();
    } catch (e) {
      estado.carregando = false;
      const online = BI.DB && BI.DB.estado && BI.DB.estado.modoApi;
      host.innerHTML = "";
      host.appendChild(el("div", "bench-vazio", online ? "Não foi possível carregar o benchmark agora. Tente novamente em instantes." : "O benchmark só está disponível na versão publicada (produção)."));
      return;
    }
    estado.carregando = false;
    const d = estado.dados;
    if (!d || !Array.isArray(d.empresas) || !d.empresas.length) {
      host.innerHTML = "";
      host.appendChild(el("div", "bench-vazio", "Ainda não há dados suficientes para o benchmark."));
      return;
    }
    if (!estado.foco || !d.empresas.some((e) => e.empresaId === estado.foco)) {
      const fcli = (BI.filtros && BI.filtros.Cliente) || [];
      const porNome = fcli.length === 1 ? d.empresas.find((e) => e.nome === fcli[0]) : null;
      estado.foco = (porNome && porNome.empresaId) || d.empresas[0].empresaId;
      estado.focoUnidade = null;
    }
    desenhar(host);
  }

  BI.Benchmark = { render };
})(window);
