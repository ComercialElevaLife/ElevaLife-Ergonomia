/* ==========================================================================
   S.I.G.E - ElevaLife · V 1.38
   Preparo das fotos antes do envio (AET, AEP, imagens de exemplo das acoes e
   evidencias do Plano de Acao) - pedido do Alexandre, 09/10/2026:
   "Durante a inclusao das imagens realizar a identificacao dos rostos e
   desfocar/cobrir para manter anonimo a identificacao das pessoas".

     BI.Fotos.preparar(arquivo)  -> File pronto (ou null se o usuario cancelar)
     BI.Fotos.prepararLista(arquivos) -> [File]

   1) reduz a foto (ate 1920 px no maior lado, JPEG 85%);
   2) detecta os rostos no proprio navegador (face-api / SSD MobileNet v1,
      arquivos em vendor/face-api - nada sai do aparelho);
   3) mostra a conferencia: os rostos encontrados aparecem marcados; o usuario
      remove marcacoes erradas (clique), marca rostos que nao foram achados
      (arrastar) e escolhe desfocar (mosaico) ou cobrir (tarja). Sem modelo
      (sem internet na primeira vez), a conferencia abre so com a marcacao manual;
   4) aplica o desfoque/tarja nos pixels da imagem enviada (o original nao e guardado).
   ========================================================================== */
(function (g) {
  "use strict";
  const BI = (g.BI = g.BI || {});
  const BASE = "vendor/face-api/";
  const LADO_MAX = 1920;
  let carregando = null; // Promise do modelo
  let automatico = false; // "aplicar automaticamente nas proximas" (vale na selecao atual)

  function carregarModelo() {
    if (carregando) return carregando;
    carregando = new Promise((ok, falha) => {
      const pronto = async () => {
        try {
          const fa = g.faceapi;
          let okB = false; for (const be of ["webgl", "wasm", "cpu"]) { try { if (await fa.tf.setBackend(be)) { okB = true; break; } } catch (e) { /* tenta o proximo */ } }
          if (!okB) throw new Error("sem backend de cálculo");
          await fa.tf.ready();
          await fa.nets.ssdMobilenetv1.loadFromUri(BASE);
          ok(fa);
        } catch (e) { carregando = null; falha(e); }
      };
      if (g.faceapi) { pronto(); return; }
      const s = document.createElement("script"); s.src = BASE + "face-api.js"; s.async = true;
      s.onload = pronto; s.onerror = () => { carregando = null; falha(new Error("não foi possível carregar o detector de rostos")); };
      document.head.appendChild(s);
    });
    return carregando;
  }

  async function imagemDe(arquivo) {
    const url = URL.createObjectURL(arquivo);
    try {
      const im = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error("imagem inválida")); i.src = url; });
      const k = Math.min(1, LADO_MAX / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement("canvas"); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
      const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
      return cv;
    } finally { URL.revokeObjectURL(url); }
  }

  async function detectar(cv) {
    const fa = await carregarModelo();
    const r = await fa.detectAllFaces(cv, new fa.SsdMobilenetv1Options({ minConfidence: 0.35, maxResults: 50 }));
    // amplia a caixa para cobrir a cabeca (cabelo, orelhas, queixo)
    return (r || []).map((d) => { const b = d.box; const mx = b.width * 0.25, my = b.height * 0.3; return { x: Math.max(0, b.x - mx), y: Math.max(0, b.y - my * 1.2), w: Math.min(cv.width, b.width + 2 * mx), h: Math.min(cv.height, b.height + my * 2), auto: true }; });
  }

  // Desfoque em mosaico (funciona em todos os navegadores, inclusive iPad) ou tarja solida.
  function aplicar(cv, caixas, modo) {
    const cx = cv.getContext("2d");
    caixas.forEach((c) => {
      const x = Math.max(0, Math.floor(c.x)), y = Math.max(0, Math.floor(c.y)), w = Math.min(cv.width - x, Math.ceil(c.w)), h = Math.min(cv.height - y, Math.ceil(c.h));
      if (w < 2 || h < 2) return;
      cx.save(); cx.beginPath(); cx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); cx.clip();
      if (modo === "tarja") { cx.fillStyle = "#2b2b2b"; cx.fillRect(x, y, w, h); }
      else {
        const bloco = Math.max(6, Math.round(Math.max(w, h) / 9));
        const pw = Math.max(1, Math.round(w / bloco)), ph = Math.max(1, Math.round(h / bloco));
        const t = document.createElement("canvas"); t.width = pw; t.height = ph; const tx = t.getContext("2d"); tx.imageSmoothingEnabled = true; tx.drawImage(cv, x, y, w, h, 0, 0, pw, ph);
        cx.imageSmoothingEnabled = false; cx.drawImage(t, 0, 0, pw, ph, x, y, w, h);
        if ("filter" in cx) { cx.filter = `blur(${Math.max(4, Math.round(bloco / 2))}px)`; cx.drawImage(cv, x, y, w, h, x, y, w, h); cx.filter = "none"; }
      }
      cx.restore();
    });
  }

  // Conferencia: devolve { caixas, modo } ou null (cancelado)
  function conferir(cv, caixas, nome, aviso, restantes) {
    return new Promise((resolver) => {
      const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
      const fundo = h("div", "aet-modal-fundo fotos-anon-fundo"); const cx0 = h("div", "aet-modal fotos-anon"); fundo.appendChild(cx0);
      cx0.appendChild(h("div", "aet-modal-titulo", "Anonimizar rostos – " + nome));
      cx0.appendChild(h("div", "aet-nota", (aviso ? aviso + " " : "") + "Os rostos encontrados estão marcados. Clique numa marcação para retirá-la; arraste sobre a foto para marcar um rosto que não foi encontrado. A foto é enviada já com os rostos desfocados ou cobertos."));
      let modo = "desfocar";
      const barraModo = h("div", "fotos-anon-modo");
      [["desfocar", "Desfocar"], ["tarja", "Cobrir com tarja"]].forEach(([v, t]) => { const l = h("label", "aet-radio"); const r = h("input"); r.type = "radio"; r.name = "anon-modo"; r.value = v; r.checked = v === modo; r.addEventListener("change", () => { modo = v; desenhar(); }); l.appendChild(r); l.appendChild(h("span", null, t)); barraModo.appendChild(l); });
      const cont = h("span", "fotos-anon-cont"); barraModo.appendChild(cont); cx0.appendChild(barraModo);
      const tela = h("canvas", "fotos-anon-tela"); tela.width = cv.width; tela.height = cv.height; cx0.appendChild(tela);
      const ctx = tela.getContext("2d");
      const lista = caixas.slice();
      function desenhar(arrasto) {
        ctx.drawImage(cv, 0, 0);
        const tmp = document.createElement("canvas"); tmp.width = cv.width; tmp.height = cv.height; tmp.getContext("2d").drawImage(cv, 0, 0); aplicar(tmp, lista, modo); ctx.drawImage(tmp, 0, 0);
        ctx.lineWidth = Math.max(3, cv.width / 300); lista.forEach((c) => { ctx.strokeStyle = c.auto ? "#00c853" : "#ffab00"; ctx.strokeRect(c.x, c.y, c.w, c.h); });
        if (arrasto) { ctx.strokeStyle = "#ffab00"; ctx.setLineDash([10, 6]); ctx.strokeRect(arrasto.x, arrasto.y, arrasto.w, arrasto.h); ctx.setLineDash([]); }
        cont.textContent = lista.length ? `${lista.length} rosto(s) marcado(s)` : "Nenhum rosto marcado";
      }
      const pos = (ev) => { const r = tela.getBoundingClientRect(); const p = ev.touches ? ev.touches[0] : ev; return { x: (p.clientX - r.left) * tela.width / r.width, y: (p.clientY - r.top) * tela.height / r.height }; };
      let ini = null, atual = null;
      const comeca = (ev) => { ev.preventDefault(); ini = pos(ev); atual = null; };
      const move = (ev) => { if (!ini) return; ev.preventDefault(); const p = pos(ev); atual = { x: Math.min(ini.x, p.x), y: Math.min(ini.y, p.y), w: Math.abs(p.x - ini.x), h: Math.abs(p.y - ini.y) }; desenhar(atual); };
      const fim = (ev) => {
        if (!ini) return; ev.preventDefault();
        if (atual && atual.w > 8 && atual.h > 8) lista.push(Object.assign({ auto: false }, atual));
        else { const i = lista.findIndex((c) => ini.x >= c.x && ini.x <= c.x + c.w && ini.y >= c.y && ini.y <= c.y + c.h); if (i >= 0) lista.splice(i, 1); }
        ini = null; atual = null; desenhar();
      };
      tela.addEventListener("mousedown", comeca); tela.addEventListener("mousemove", move); g.addEventListener("mouseup", fim);
      tela.addEventListener("touchstart", comeca, { passive: false }); tela.addEventListener("touchmove", move, { passive: false }); tela.addEventListener("touchend", fim);
      const barra = h("div", "reav-barra");
      const fechar = (r) => { g.removeEventListener("mouseup", fim); fundo.remove(); resolver(r); };
      const bC = h("button", "btn-cad-secundario", "Não enviar esta foto"); bC.type = "button"; bC.addEventListener("click", () => fechar(null));
      const bA = h("button", "btn-cad-secundario", `Confirmar esta e anonimizar as próximas (${restantes}) automaticamente`); bA.type = "button"; bA.hidden = !restantes; bA.addEventListener("click", () => { automatico = true; fechar({ caixas: lista, modo }); });
      const bO = h("button", "btn-cad-primario", "Confirmar e enviar"); bO.type = "button"; bO.addEventListener("click", () => fechar({ caixas: lista, modo }));
      barra.appendChild(bC); barra.appendChild(bA); barra.appendChild(bO); cx0.appendChild(barra);
      document.body.appendChild(fundo); desenhar();
    });
  }

  function paraArquivo(cv, nome) {
    return new Promise((ok) => cv.toBlob((b) => ok(new File([b], String(nome || "foto").replace(/\.(png|jpe?g)$/i, "") + ".jpg", { type: "image/jpeg" })), "image/jpeg", 0.85));
  }

  let modoAuto = "desfocar";
  async function preparar(arquivo, restantes) {
    if (!arquivo || !/^image\/(jpeg|png)$/.test(arquivo.type)) return arquivo;
    let cv; try { cv = await imagemDe(arquivo); } catch (e) { return arquivo; }
    let caixas = [], aviso = "";
    try { caixas = await detectar(cv); } catch (e) { aviso = "O detector automático de rostos não está disponível agora (" + (e && e.message ? e.message : e) + "): marque os rostos manualmente."; }
    let r;
    if (automatico && !aviso) r = { caixas, modo: modoAuto };
    else { r = await conferir(cv, caixas, arquivo.name, aviso, restantes || 0); if (r) modoAuto = r.modo; }
    if (!r) return null;
    aplicar(cv, r.caixas, r.modo);
    return paraArquivo(cv, arquivo.name);
  }
  async function prepararLista(arquivos) {
    automatico = false; const out = []; const l = Array.from(arquivos || []);
    for (let i = 0; i < l.length; i++) { const f = await preparar(l[i], l.length - 1 - i); if (f) out.push(f); }
    automatico = false; return out;
  }

  BI.Fotos = { preparar: (a) => prepararLista([a]).then((l) => l[0] || null), prepararLista, carregarModelo, _aplicar: aplicar, _detectar: detectar, _imagemDe: imagemDe };
})(window);
