/* ==========================================================================
   BI Ergonomia - ElevaLife
   DIAGRAMAS CORPORAIS (frente/costas) - silhueta humana anatomica (nao mais
   um boneco-palito): corpo preenchido com curvas suaves (spline Catmull-Rom
   convertida em bezier) + gradiente sutil para dar volume, caixa tracejada
   conectada por linha-guia a cada regiao, mostrando um valor (dias perdidos
   em Med Ocup, contagem de restricoes em Compativeis).
   Uma UNICA funcao parametrizada por lado (frente/costas) + mapa de valores
   - nunca uma funcao por regiao. Referencia visual: diagramas corporais
   padrao de avaliacao ergonomica/ocupacional (ex.: Questionario Nordico,
   pesquisas de desconforto corporal) - silhueta unica, vista frontal e
   posterior, com marcacao de regiao por segmento.

   Convencao anatomica (a pessoa olhando para o espectador na frente, de
   costas para o espectador atras): regiao "Direita/Direito" e o lado
   DIREITO da PESSOA.
   - Frente: pessoa de frente -> lado D da pessoa fica a ESQUERDA da imagem.
   - Costas: pessoa de costas -> lado D da pessoa fica a DIREITA da imagem.
   ========================================================================== */

(function (global) {
  "use strict";

  const W = 460;   // largura total do viewBox (corpo + 2 colunas de rotulo)
  const H = 500;   // altura total do viewBox
  const CX = 230;  // centro horizontal da silhueta

  // ------------------------------------------------------------------
  // Geometria do corpo: pontos de referencia (landmarks) ao longo do
  // contorno, convertidos em curva suave por Catmull-Rom -> Bezier cubica.
  // Editar aqui move o desenho inteiro sem precisar recalcular tangentes
  // de curva a mao.
  // ------------------------------------------------------------------
  function catmullRom2bezier(pontos, fechado) {
    const p = pontos;
    const n = p.length;
    const obterPonto = (i) => (fechado ? p[((i % n) + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
    let d = `M ${p[0][0]},${p[0][1]} `;
    const nSegmentos = fechado ? n : n - 1;
    for (let i = 0; i < nSegmentos; i++) {
      const p0 = obterPonto(i - 1), p1 = obterPonto(i), p2 = obterPonto(i + 1), p3 = obterPonto(i + 2);
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]} `;
    }
    if (fechado) d += "Z";
    return d;
  }

  // Cabeca
  const CABECA = { cx: CX, cy: 46, r: 30 };

  // Tronco + pernas: um unico contorno fechado, "M" na virilha (as duas
  // pernas se separam a partir de um ponto central), sem os bracos - o
  // padrao de qualquer diagrama corporal de avaliacao ergonomica.
  const CONTORNO_CORPO = [
    [CX - 19, 76],   // base do pescoco (esq.)
    [CX - 60, 100],  // ombro externo (esq.)
    [CX - 54, 140],  // peito (esq.)
    [CX - 36, 197],  // cintura (esq.)
    [CX - 48, 232],  // quadril externo (esq.)
    [CX - 56, 280],  // coxa externa (esq.)
    [CX - 60, 350],  // joelho externo (esq.)
    [CX - 62, 402],  // panturrilha externa (esq.)
    [CX - 64, 448],  // tornozelo externo (esq.)
    [CX - 72, 456],  // peito do pe (esq.)
    [CX - 88, 466],  // ponta do pe (esq.)
    [CX - 74, 474],  // sola do pe (esq.)
    [CX - 50, 462],  // pe interno (esq.)
    [CX - 46, 448],  // tornozelo interno (esq.)
    [CX - 42, 402],  // panturrilha interna (esq.)
    [CX - 38, 350],  // joelho interno (esq.)
    [CX - 28, 280],  // coxa interna (esq.)
    [CX, 250],       // virilha (centro)
    [CX + 28, 280],  // coxa interna (dir.)
    [CX + 38, 350],  // joelho interno (dir.)
    [CX + 42, 402],  // panturrilha interna (dir.)
    [CX + 46, 448],  // tornozelo interno (dir.)
    [CX + 50, 462],  // pe interno (dir.)
    [CX + 74, 474],  // sola do pe (dir.)
    [CX + 88, 466],  // ponta do pe (dir.)
    [CX + 72, 456],  // peito do pe (dir.)
    [CX + 64, 448],  // tornozelo externo (dir.)
    [CX + 62, 402],  // panturrilha externa (dir.)
    [CX + 60, 350],  // joelho externo (dir.)
    [CX + 56, 280],  // coxa externa (dir.)
    [CX + 48, 232],  // quadril externo (dir.)
    [CX + 36, 197],  // cintura (dir.)
    [CX + 54, 140],  // peito (dir.)
    [CX + 60, 100],  // ombro externo (dir.)
    [CX + 19, 76],   // base do pescoco (dir.)
  ];

  // Braco: forma fechada (desce pela borda externa, contorna a mao, sobe
  // pela borda interna) - pendurado ao lado do corpo, sem cruzar para a
  // virilha (erro comum de silhuetas "de palito").
  function pontosBraco(lado) {
    const s = lado; // -1 = imagem-esquerda, +1 = imagem-direita
    return [
      [CX + s * 88, 104],
      [CX + s * 100, 150],
      [CX + s * 97, 200],
      [CX + s * 90, 245],
      [CX + s * 84, 278],
      [CX + s * 80, 296],
      [CX + s * 92, 305],
      [CX + s * 101, 292],
      [CX + s * 97, 275],
      [CX + s * 103, 243],
      [CX + s * 110, 199],
      [CX + s * 113, 152],
      [CX + s * 97, 106],
    ];
  }

  // ------------------------------------------------------------------
  // Pontos de fixacao (rotulo) por regiao - onde a linha-guia tracejada
  // encosta na silhueta - e coluna onde a caixa de rotulo fica.
  // ------------------------------------------------------------------
  // Regioes do braco reaproveitam os proprios pontos de pontosBraco(), para
  // o "encosto" da linha-guia cair sempre exatamente sobre o braco - nunca
  // sobre o tronco.
  const CONFIG_FRENTE = [
    { regiao: "Ombro Direito", corpo: [CX - 88, 104], caixa: "esq", y: 78 },
    { regiao: "Ombro Esquerdo", corpo: [CX + 88, 104], caixa: "dir", y: 78 },
    { regiao: "Cotovelo Direito", corpo: [CX - 97, 200], caixa: "esq", y: 175 },
    { regiao: "Cotovelo Esquerdo", corpo: [CX + 97, 200], caixa: "dir", y: 175 },
    { regiao: "Punho Direito", corpo: [CX - 84, 278], caixa: "esq", y: 255 },
    { regiao: "Punho Esquerdo", corpo: [CX + 84, 278], caixa: "dir", y: 255 },
    { regiao: "Mao Direita", corpo: [CX - 86, 300], caixa: "esq", y: 320 },
    { regiao: "Mao Esquerda", corpo: [CX + 86, 300], caixa: "dir", y: 320 },
    { regiao: "Pe Direito", corpo: [CX - 74, 470], caixa: "esq", y: 445 },
    { regiao: "Pe Esquerdo", corpo: [CX + 74, 470], caixa: "dir", y: 445 },
  ];

  const CONFIG_COSTAS = [
    { regiao: "Cervical", corpo: [CX, 88], caixa: "esq", y: 16 },
    { regiao: "Dorsal", corpo: [CX, 140], caixa: "dir", y: 16 },
    { regiao: "Lombar", corpo: [CX, 195], caixa: "esq", y: 64 },
    { regiao: "Quadril Direito", corpo: [CX + 48, 232], caixa: "dir", y: 210 },
    { regiao: "Quadril Esquerdo", corpo: [CX - 48, 232], caixa: "esq", y: 210 },
    { regiao: "Joelho Direito", corpo: [CX + 60, 350], caixa: "dir", y: 330 },
    { regiao: "Joelho Esquerdo", corpo: [CX - 60, 350], caixa: "esq", y: 330 },
    { regiao: "Tornozelo Direito", corpo: [CX + 64, 448], caixa: "dir", y: 420 },
    { regiao: "Tornozelo Esquerdo", corpo: [CX - 64, 448], caixa: "esq", y: 420 },
  ];

  const LARGURA_CAIXA = 96;
  const ALTURA_CAIXA = 32;
  const X_COLUNA_ESQ = 6;
  const X_COLUNA_DIR = W - 6 - LARGURA_CAIXA;
  const X_CENTRO = CX - LARGURA_CAIXA / 2;

  // ------------------------------------------------------------------
  // Desenho da silhueta - preenchimento com gradiente sutil (currentColor
  // em duas opacidades, luz->sombra) + contorno solido + sombra suave para
  // dar sensacao de volume sem depender de imagem externa ou motor 3D
  // (uma pagina publicada so pode usar SVG nativo self-contained).
  // ------------------------------------------------------------------
  function defsComuns(id) {
    return `
      <linearGradient id="grad-corpo-${id}" x1="0.15" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stop-color="currentColor" stop-opacity="0.13" />
        <stop offset="100%" stop-color="currentColor" stop-opacity="0.30" />
      </linearGradient>
      <filter id="sombra-${id}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="currentColor" flood-opacity="0.16" />
      </filter>
    `;
  }

  function silhuetaBase(id, ehCostas) {
    const dCorpo = catmullRom2bezier(CONTORNO_CORPO, true);
    const dBracoEsq = catmullRom2bezier(pontosBraco(-1), true);
    const dBracoDir = catmullRom2bezier(pontosBraco(1), true);
    const preenchimento = `url(#grad-corpo-${id})`;
    const linhaColuna = ehCostas
      ? `<path d="M ${CX},80 C ${CX + 5},140 ${CX - 5},190 ${CX},232" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 5" opacity="0.5" />`
      : "";
    return `
      <g filter="url(#sombra-${id})">
        <path d="${dCorpo}" fill="${preenchimento}" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" />
        <path d="${dBracoEsq}" fill="${preenchimento}" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" />
        <path d="${dBracoDir}" fill="${preenchimento}" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" />
        <circle cx="${CABECA.cx}" cy="${CABECA.cy}" r="${CABECA.r}" fill="${preenchimento}" stroke="currentColor" stroke-width="2.2" />
      </g>
      ${linhaColuna}
    `;
  }

  function caixaRotulo(item, valor, formatarValor) {
    const [px, py] = item.corpo;
    let bx;
    if (item.caixa === "esq") bx = X_COLUNA_ESQ;
    else if (item.caixa === "dir") bx = X_COLUNA_DIR;
    else bx = X_CENTRO;
    const by = item.y;
    const pontoLinhaX = item.caixa === "dir" ? bx : bx + LARGURA_CAIXA;
    const pontoLinhaY = by + ALTURA_CAIXA / 2;
    const destacar = valor > 0;

    return `
      <line x1="${px}" y1="${py}" x2="${pontoLinhaX}" y2="${pontoLinhaY}"
            stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" opacity="0.6" />
      <circle cx="${px}" cy="${py}" r="3.5" fill="currentColor" opacity="0.75" />
      <rect x="${bx}" y="${by}" width="${LARGURA_CAIXA}" height="${ALTURA_CAIXA}" rx="6"
            fill="var(--card)" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3"
            opacity="${destacar ? 1 : 0.55}" />
      <text x="${bx + LARGURA_CAIXA / 2}" y="${by + 13}" text-anchor="middle"
            font-size="8.5" fill="currentColor" opacity="0.8">${item.regiao}</text>
      <text x="${bx + LARGURA_CAIXA / 2}" y="${by + 26}" text-anchor="middle"
            font-size="12.5" font-weight="700" fill="${destacar ? "var(--teal-escuro)" : "currentColor"}">${formatarValor(valor)}</text>
    `;
  }

  function construirSvg(config, ehCostas, valoresPorRegiao, formatarValor, tituloAria) {
    const id = ehCostas ? "costas" : "frente";
    const corpo = silhuetaBase(id, ehCostas);
    const caixas = config.map((item) => caixaRotulo(item, valoresPorRegiao[item.regiao] || 0, formatarValor)).join("");
    return `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tituloAria}" style="width:100%;height:auto;color:var(--texto-secundario)">
        <defs>${defsComuns(id)}</defs>
        ${corpo}
        ${caixas}
      </svg>
    `;
  }

  function renderizar(containerId, tipo, valoresPorRegiao, opts) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const config = tipo === "frente" ? CONFIG_FRENTE : CONFIG_COSTAS;
    const formatarValor = (opts && opts.formatarValor) || ((v) => String(v));
    const titulo = (opts && opts.titulo) || (tipo === "frente" ? "Diagrama corporal - vista frontal" : "Diagrama corporal - vista posterior");
    el.innerHTML = construirSvg(config, tipo === "costas", valoresPorRegiao, formatarValor, titulo);
  }

  global.BI = global.BI || {};
  global.BI.Diagramas = {
    CONFIG_FRENTE,
    CONFIG_COSTAS,
    renderizar,
  };
})(window);
