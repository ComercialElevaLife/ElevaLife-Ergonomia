/* ==========================================================================
   S.I.G.E. - ElevaLife
   HISTORICO (V 1.1): botao "Mais detalhes" em cada registro. Mostra, escondido
   ate o clique: quem criou e quando, quem editou por ultimo e quando, e -
   campo a campo - o valor atual, quem/quando informou e a ultima alteracao
   (com o valor anterior). Tudo vem de _criadoEm/_criadoPor/_editadoEm/
   _editadoPor/_historico, gravados SO pelo servidor (api/src/shared/auditoria.js);
   o navegador nunca consegue forjar autor ou data.
   ========================================================================== */
(function (global) {
  "use strict";

  const BI = (global.BI = global.BI || {});
  let overlay = null;
  let dialogo = null;

  const T = (s) => (BI.Rotulos && BI.Rotulos.texto ? BI.Rotulos.texto(s) : s);
  const dh = (iso) => (BI.Datas ? BI.Datas.dataHoraBR(iso) : String(iso || ""));

  function formatarValor(def, v) {
    if (v == null || v === "") return "—";
    if (Array.isArray(v)) return v.length ? v.map((x) => formatarValor(def, x)).join(", ") : "—";
    if (typeof v === "object") return "(anexo)";
    const t = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(t) || (def && def.tipo === "mes" && /^\d{4}-\d{2}$/.test(t))) return BI.Datas.isoParaBR(t);
    if (def && def.tipo === "select") return T(t);
    return T(t);
  }

  function fechar() {
    if (overlay) overlay.hidden = true;
    if (dialogo) dialogo.hidden = true;
    document.body.classList.remove("hist-aberto");
  }

  function garantirDialogo() {
    if (dialogo) return;
    overlay = document.createElement("div");
    overlay.className = "hist-overlay";
    overlay.hidden = true;
    overlay.addEventListener("click", fechar);

    dialogo = document.createElement("div");
    dialogo.className = "hist-dialogo";
    dialogo.setAttribute("role", "dialog");
    dialogo.setAttribute("aria-modal", "true");
    dialogo.setAttribute("aria-label", "Mais detalhes do registro");
    dialogo.hidden = true;

    document.body.appendChild(overlay);
    document.body.appendChild(dialogo);
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && dialogo && !dialogo.hidden) fechar(); });
  }

  function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }

  // Ultima alteracao de cada campo, a partir da linha do tempo.
  function ultimaAlteracaoPorCampo(historico) {
    const mapa = {};
    (historico || []).forEach((h) => {
      (h.alteracoes || []).forEach((a) => { mapa[a.campo] = { em: h.em, por: h.por, de: a.de, para: a.para }; });
    });
    return mapa;
  }

  function quem(por) { return por || "usuário não identificado (registro anterior ao histórico)"; }

  function abrir(cfg, linha) {
    garantirDialogo();
    dialogo.innerHTML = "";

    const cab = el("div", "hist-cab");
    cab.appendChild(el("div", "hist-titulo", "Mais detalhes"));
    const btnFechar = el("button", "hist-fechar", "×");
    btnFechar.type = "button";
    btnFechar.setAttribute("aria-label", "Fechar");
    btnFechar.addEventListener("click", fechar);
    cab.appendChild(btnFechar);
    dialogo.appendChild(cab);

    const corpo = el("div", "hist-corpo");
    dialogo.appendChild(corpo);

    if (linha._pendente && !linha._criadoEm) {
      corpo.appendChild(el("p", "hist-aviso", "Este registro ainda não foi sincronizado com o servidor. Assim que a conexão voltar e ele for enviado, o histórico (quem e quando) passa a aparecer aqui."));
      overlay.hidden = false; dialogo.hidden = false; document.body.classList.add("hist-aberto");
      btnFechar.focus();
      return;
    }

    const resumo = el("div", "hist-resumo");
    const criado = el("div", "hist-resumo-item");
    criado.appendChild(el("span", "hist-rot", "Criado"));
    criado.appendChild(el("span", "hist-val", linha._criadoEm ? `${dh(linha._criadoEm)} · ${quem(linha._criadoPor)}` : "sem informação"));
    resumo.appendChild(criado);
    const editado = el("div", "hist-resumo-item");
    editado.appendChild(el("span", "hist-rot", "Última edição"));
    editado.appendChild(el("span", "hist-val", linha._editadoEm && linha._editadoEm !== linha._criadoEm ? `${dh(linha._editadoEm)} · ${quem(linha._editadoPor)}` : "ainda não foi editado"));
    resumo.appendChild(editado);
    corpo.appendChild(resumo);

    const historico = Array.isArray(linha._historico) ? linha._historico : [];
    const ultimas = ultimaAlteracaoPorCampo(historico);

    // ---- campo a campo
    corpo.appendChild(el("div", "hist-secao", "Campo a campo"));
    const lista = el("div", "hist-campos");
    (cfg.campos || []).forEach((def) => {
      if (def.tipo === "arquivo" || def.tipo === "calculado" && !(def.campo in linha)) return;
      const bloco = el("div", "hist-campo");
      bloco.appendChild(el("div", "hist-campo-nome", T(def.rotulo || def.campo)));
      bloco.appendChild(el("div", "hist-campo-valor", formatarValor(def, linha[def.campo])));
      const meta = el("div", "hist-campo-meta");
      const alt = ultimas[def.campo];
      if (alt) {
        meta.textContent = `Alterado em ${dh(alt.em)} por ${quem(alt.por)} · antes: ${formatarValor(def, alt.de)}`;
      } else if (linha._criadoEm) {
        meta.textContent = `Informado em ${dh(linha._criadoEm)} por ${quem(linha._criadoPor)}`;
      }
      bloco.appendChild(meta);
      lista.appendChild(bloco);
    });
    corpo.appendChild(lista);

    // ---- linha do tempo
    corpo.appendChild(el("div", "hist-secao", "Linha do tempo"));
    const tempo = el("div", "hist-tempo");
    if (!historico.length) {
      tempo.appendChild(el("p", "hist-aviso", "Sem histórico registrado para este registro (criado antes do controle de histórico)."));
    }
    historico.slice().reverse().forEach((h) => {
      const item = el("div", "hist-tempo-item");
      item.appendChild(el("div", "hist-tempo-cab", `${dh(h.em)} · ${h.acao === "criou" ? "Criado" : "Editado"} por ${quem(h.por)}`));
      (h.alteracoes || []).forEach((a) => {
        const def = (cfg.campos || []).find((c) => c.campo === a.campo);
        item.appendChild(el("div", "hist-tempo-alt", `${T(def ? (def.rotulo || def.campo) : a.campo)}: ${formatarValor(def, a.de)} → ${formatarValor(def, a.para)}`));
      });
      tempo.appendChild(item);
    });
    corpo.appendChild(tempo);

    overlay.hidden = false;
    dialogo.hidden = false;
    document.body.classList.add("hist-aberto");
    btnFechar.focus();
  }

  BI.Historico = { abrir, fechar };
})(window);
