/* ==========================================================================
   S.I.G.E. - ElevaLife
   V 2.50 (Alexandre - solicitação 2): aba BENCHMARK.

   Mostra a dashboard da empresa comparada com a base (todas as empresas e
   unidades), de forma ANÔNIMA: nunca aparece nome nem número cru de outra
   empresa — só a posição da empresa numa régua ("melhor que X% dos clientes")
   e a média/mediana da base, com N mínimo.

   - Régua geral no topo: posição geral do cliente frente aos demais.
   - Mini-réguas por indicador (todos os indicadores da dashboard).
   - Comparativo entre as unidades do próprio cliente.
   - Equipe (Administrador/Consultor) vê também um RANKING identificado (no
     escopo do papel) e pode alternar para "visão do cliente" (anônima).

   Os dados vêm de GET /api/benchmark (ver api/src/functions/benchmark.js), que
   calcula tudo no servidor e já aplica o escopo do papel.
   ========================================================================== */

(function (global) {
  "use strict";
  const BI = global.BI = global.BI || {};
  const estado = { dados: null, foco: null, anonimo: false, carregando: false };

  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function ehEquipe() { const i = BI.DB && BI.DB.estado && BI.DB.estado.identidade; return !!(i && (i.papel === "Administrador" || i.papel === "Consultor")); }

  function fmtValor(v, unidade) {
    if (v == null || Number.isNaN(v)) return "—";
    if (unidade === "%") return Math.round(v) + "%";
    if (unidade === "/100") return v.toFixed(1);
    if (unidade === "dias") return v.toFixed(1);
    return String(v);
  }
  function verdito(p) {
    if (p == null) return { txt: "sem base", cls: "neutro" };
    if (p >= 66) return { txt: "acima da média", cls: "bom" };
    if (p >= 33) return { txt: "na média", cls: "medio" };
    return { txt: "abaixo da média", cls: "ruim" };
  }

  // Régua 0..100 (percentil já ajustado por direção: maior = melhor).
  function regua(percentil, opcoes) {
    opcoes = opcoes || {};
    const wrap = el("div", "bench-track" + (opcoes.grande ? " grande" : ""));
    ["ruim", "medio", "bom"].forEach((z) => wrap.appendChild(el("div", "bench-zona z-" + z)));
    // marcador da mediana da base (referência = 50% por construção do percentil)
    const med = el("div", "bench-mediana"); med.style.left = "50%"; med.title = "Mediana da base"; wrap.appendChild(med);
    if (percentil != null) {
      const m = el("div", "bench-marker"); m.style.left = Math.max(0, Math.min(100, percentil)) + "%";
      m.title = "Melhor que " + percentil + "% dos clientes";
      wrap.appendChild(m);
    } else {
      wrap.appendChild(el("div", "bench-sembase", "base insuficiente"));
    }
    return wrap;
  }

  function cardIndicador(ind, foco, base) {
    const v = foco.valores[ind.chave];
    const p = foco.percentis[ind.chave];
    const b = base.indicadores[ind.chave] || {};
    const card = el("div", "bench-ind");
    const topo = el("div", "bench-ind-topo");
    topo.appendChild(el("span", "bench-ind-rot", ind.rotulo));
    topo.appendChild(el("span", "bench-ind-val", fmtValor(v, ind.unidade)));
    card.appendChild(topo);
    if (!b.suficiente) {
      card.appendChild(el("div", "bench-ind-nobase", "Base insuficiente para comparar (menos de " + (estado.dados.minN) + " clientes com este dado)."));
      card.appendChild(regua(null));
      return card;
    }
    card.appendChild(regua(p));
    const rod = el("div", "bench-ind-rodape");
    const vd = verdito(p);
    const tag = el("span", "bench-tag " + vd.cls, p != null ? ("melhor que " + p + "% dos clientes · " + vd.txt) : vd.txt);
    rod.appendChild(tag);
    rod.appendChild(el("span", "bench-ind-base", "média da base: " + fmtValor(b.media, ind.unidade) + " · mediana: " + fmtValor(b.mediana, ind.unidade)));
    card.appendChild(rod);
    return card;
  }

  function desenhar(host) {
    const d = estado.dados;
    host.innerHTML = "";
    const wrap = el("div", "bench-wrap");

    const cab = el("div", "bench-cab");
    cab.appendChild(el("h2", "bench-titulo", "Benchmark — comparação com a base"));
    cab.appendChild(el("p", "bench-sub", "Os números da sua empresa comparados, de forma anônima, com todas as empresas e unidades da base. Nenhum nome ou número de outro cliente é exibido — só a sua posição relativa."));
    wrap.appendChild(cab);

    // Seletor de empresa-foco (equipe) + alternância visão do cliente.
    const barra = el("div", "bench-barra");
    if (d.empresas.length > 1) {
      const lab = el("label", "bench-sel-lab", "Empresa: ");
      const sel = el("select", "bench-sel");
      d.empresas.forEach((e) => { const o = el("option", null, e.nome); o.value = e.empresaId; if (e.empresaId === estado.foco) o.selected = true; sel.appendChild(o); });
      sel.addEventListener("change", () => { estado.foco = sel.value; desenhar(host); });
      lab.appendChild(sel); barra.appendChild(lab);
    }
    if (ehEquipe()) {
      const btn = el("button", "bench-toggle" + (estado.anonimo ? " ativo" : ""), estado.anonimo ? "👁 Ver ranking (identificado)" : "🙈 Ver como cliente (anônimo)");
      btn.type = "button";
      btn.addEventListener("click", () => { estado.anonimo = !estado.anonimo; desenhar(host); });
      barra.appendChild(btn);
    }
    if (barra.children.length) wrap.appendChild(barra);

    const foco = d.empresas.find((e) => e.empresaId === estado.foco) || d.empresas[0];
    if (!foco) {
      wrap.appendChild(el("div", "bench-vazio", "Ainda não há dados suficientes da sua empresa para o benchmark."));
      host.appendChild(wrap); return;
    }

    // Régua GERAL (posição no início da dash).
    const geral = el("div", "bench-regua-geral");
    const gcab = el("div", "bench-geral-cab");
    gcab.appendChild(el("span", "bench-geral-tit", estado.anonimo || !ehEquipe() ? "Posição geral da sua empresa" : "Posição geral · " + foco.nome));
    const vdG = verdito(foco.scoreGeral);
    gcab.appendChild(el("span", "bench-geral-badge " + vdG.cls, foco.scoreGeral != null ? ("melhor que " + foco.scoreGeral + "% da base · " + vdG.txt) : "sem base suficiente"));
    geral.appendChild(gcab);
    geral.appendChild(regua(foco.scoreGeral, { grande: true }));
    geral.appendChild(el("div", "bench-geral-leg", "← pior que a base    ·    mediana    ·    melhor que a base →"));
    wrap.appendChild(geral);

    // Mini-réguas por indicador.
    const grade = el("div", "bench-grade");
    d.indicadores.forEach((ind) => grade.appendChild(cardIndicador(ind, foco, d.base)));
    wrap.appendChild(grade);

    // Comparativo entre as unidades do próprio cliente.
    const unis = (d.unidades || []).filter((u) => u.empresaId === foco.empresaId);
    if (unis.length) {
      const secUni = el("div", "bench-sec");
      secUni.appendChild(el("h3", "bench-sec-tit", "Unidades da sua empresa — posição de cada uma na base"));
      unis.forEach((u) => {
        const linha = el("div", "bench-uni-linha");
        linha.appendChild(el("span", "bench-uni-nome", u.unidade || "—"));
        const tk = regua(u.scoreGeral);
        tk.classList.add("mini");
        linha.appendChild(tk);
        linha.appendChild(el("span", "bench-uni-score", u.scoreGeral != null ? (u.scoreGeral + "%") : "—"));
        secUni.appendChild(linha);
      });
      wrap.appendChild(secUni);
    }

    // Ranking identificado (só equipe e fora do modo anônimo).
    if (ehEquipe() && !estado.anonimo && d.empresas.length > 1) {
      const secR = el("div", "bench-sec");
      secR.appendChild(el("h3", "bench-sec-tit", "Ranking (empresas sob seu acesso)"));
      const scroll = el("div", "tabela-scroll");
      const tab = el("table", "tabela-dados bench-rank");
      const thead = el("thead"); const trh = el("tr");
      ["#", "Empresa", "Posição geral"].concat(d.indicadores.map((i) => i.rotulo)).forEach((c) => trh.appendChild(el("th", null, c)));
      thead.appendChild(trh); tab.appendChild(thead);
      const tb = el("tbody");
      d.empresas.forEach((e, i) => {
        const tr = el("tr"); if (e.empresaId === foco.empresaId) tr.className = "bench-rank-foco";
        tr.appendChild(el("td", null, String(i + 1)));
        const tdNome = el("td", "bench-rank-nome", e.nome); tr.appendChild(tdNome);
        tr.appendChild(el("td", null, e.scoreGeral != null ? e.scoreGeral + "%" : "—"));
        d.indicadores.forEach((ind) => tr.appendChild(el("td", null, fmtValor(e.valores[ind.chave], ind.unidade))));
        tr.addEventListener("click", () => { estado.foco = e.empresaId; desenhar(host); });
        tb.appendChild(tr);
      });
      tab.appendChild(tb); scroll.appendChild(tab); secR.appendChild(scroll);
      secR.appendChild(el("p", "bench-rank-nota", "Clique numa empresa para ver a régua dela. Este ranking respeita o seu acesso (o cliente não o vê)."));
      wrap.appendChild(secR);
    }

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
    // Foco inicial: cliente do filtro global, senão a primeira empresa do escopo.
    if (!estado.foco || !d.empresas.some((e) => e.empresaId === estado.foco)) {
      const fcli = (BI.filtros && BI.filtros.Cliente) || [];
      const porNome = fcli.length === 1 ? d.empresas.find((e) => e.nome === fcli[0]) : null;
      estado.foco = (porNome && porNome.empresaId) || d.empresas[0].empresaId;
    }
    desenhar(host);
  }

  BI.Benchmark = { render };
})(window);
