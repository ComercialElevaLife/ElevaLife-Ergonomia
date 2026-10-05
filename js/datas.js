/* ==========================================================================
   S.I.G.E. - ElevaLife
   DATAS (V 1.1): tudo que o usuario ve ou digita como data fica em
   DD/MM/AAAA (mes: MM/AAAA), com calendario. Internamente o sistema continua
   guardando AAAA-MM-DD (e AAAA-MM), que ordena e filtra certo - so a tela
   converte. O campo de data e' um texto com mascara + botao de calendario;
   para o resto do codigo ele se comporta como um <input type="date">: o
   .value le/grava o formato interno.
   ========================================================================== */
(function (global) {
  "use strict";

  const BI = (global.BI = global.BI || {});

  const pad = (n) => String(n).padStart(2, "0");

  function isoParaBR(iso) {
    if (!iso) return "";
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(iso));
    if (!m) return String(iso);
    return m[3] ? `${m[3]}/${m[2]}/${m[1]}` : `${m[2]}/${m[1]}`;
  }

  // "DD/MM/AAAA" -> "AAAA-MM-DD" ("" se incompleta/invalida).
  function brParaISO(texto) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto || "").trim());
    if (!m) return "";
    const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3]);
    if (a < 1900 || a > 2100 || mes < 1 || mes > 12 || d < 1) return "";
    const ultimo = new Date(a, mes, 0).getDate();
    if (d > ultimo) return "";
    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  function brMesParaISO(texto) {
    const m = /^(\d{2})\/(\d{4})$/.exec(String(texto || "").trim());
    if (!m) return "";
    const mes = Number(m[1]), a = Number(m[2]);
    if (a < 1900 || a > 2100 || mes < 1 || mes > 12) return "";
    return `${m[2]}-${m[1]}`;
  }

  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // "2026-10-05T14:03:00.000Z" -> "05/10/2026 11:03" (fuso do navegador).
  function dataHoraBR(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Mascara enquanto digita: so numeros, barras nos lugares certos.
  function mascarar(texto, tipo) {
    const n = String(texto || "").replace(/\D/g, "").slice(0, tipo === "mes" ? 6 : 8);
    if (tipo === "mes") return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
    if (n.length > 4) return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
    if (n.length > 2) return `${n.slice(0, 2)}/${n.slice(2)}`;
    return n;
  }

  // Cria o campo. Devolve o <input> de texto (e' ele que vai em form._campos);
  // `.elementoDOM` e' o conteudo completo (texto + botao) para por na tela.
  function criarCampo(tipo, valorInicial) {
    const ehMes = tipo === "mes";
    const nativoGet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").get;
    const nativoSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;

    const wrap = document.createElement("div");
    wrap.className = "campo-data";

    const txt = document.createElement("input");
    txt.type = "text";
    txt.inputMode = "numeric";
    txt.autocomplete = "off";
    txt.placeholder = ehMes ? "MM/AAAA" : "DD/MM/AAAA";
    txt.maxLength = ehMes ? 7 : 10;
    txt.className = "campo-data-texto";

    const seletor = document.createElement("input");
    seletor.type = ehMes ? "month" : "date";
    seletor.className = "campo-data-nativo";
    seletor.tabIndex = -1;
    seletor.setAttribute("aria-hidden", "true");

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "campo-data-calendario";
    botao.title = "Abrir calendário";
    botao.setAttribute("aria-label", "Abrir calendário");
    botao.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/></svg>';

    function paraISO(textoBR) { return ehMes ? brMesParaISO(textoBR) : brParaISO(textoBR); }

    function validar() {
      const bruto = nativoGet.call(txt);
      if (!bruto) { txt.setCustomValidity(""); return; }
      txt.setCustomValidity(paraISO(bruto) ? "" : (ehMes ? "Use MM/AAAA (ex.: 10/2026)." : "Use uma data válida no formato DD/MM/AAAA."));
    }

    // Para o resto do sistema, .value e' sempre o formato interno (ISO).
    Object.defineProperty(txt, "value", {
      configurable: true,
      get() { return paraISO(nativoGet.call(txt)); },
      set(v) { nativoSet.call(txt, isoParaBR(v)); seletor.value = v && /^\d{4}-\d{2}/.test(v) ? v : ""; validar(); },
    });

    txt.addEventListener("input", () => {
      const antes = nativoGet.call(txt);
      const depois = mascarar(antes, tipo);
      if (antes !== depois) nativoSet.call(txt, depois);
      validar();
      const iso = paraISO(depois);
      if (iso) seletor.value = iso;
    });

    seletor.addEventListener("change", () => {
      if (!seletor.value) return;
      txt.value = seletor.value;
      txt.dispatchEvent(new Event("input", { bubbles: true }));
      txt.dispatchEvent(new Event("change", { bubbles: true }));
    });

    botao.addEventListener("click", () => {
      if (txt.disabled) return;
      try {
        if (typeof seletor.showPicker === "function") seletor.showPicker(); else seletor.click();
      } catch (e) { seletor.click(); }
    });

    wrap.appendChild(txt);
    wrap.appendChild(botao);
    wrap.appendChild(seletor);
    txt.elementoDOM = wrap;
    txt.value = valorInicial || "";
    return txt;
  }

  BI.Datas = { isoParaBR, brParaISO, hojeISO, dataHoraBR, criarCampo, mascarar };
})(window);
