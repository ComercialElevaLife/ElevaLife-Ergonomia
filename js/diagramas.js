/* ==========================================================================
   BI Ergonomia - ElevaLife
   DIAGRAMAS CORPORAIS (frente/costas) - silhueta humana esquematica com
   caixas tracejadas conectadas por linha-guia a cada regiao, mostrando um
   valor (dias perdidos em Med Ocup, contagem de restricoes em Compativeis).
   Uma UNICA funcao parametrizada por lado (frente/costas) + mapa de valores
   - nunca uma funcao por regiao.

   Convencao anatomica (a pessoa olhando para o espectador na frente, de
   costas para o espectador atras): region "Direita/Direito" e o lado
   DIREITO da PESSOA.
   - Frente: pessoa de frente -> lado D da pessoa fica a ESQUERDA da imagem.
   - Costas: pessoa de costas -> lado D da pessoa fica a DIREITA da imagem.
   ========================================================================== */

(function (global) {
  "use strict";

  const CX = 200; // centro horizontal da silhueta no viewBox (400 de largura)

  // Pontos de fixacao no corpo (coordenadas do viewBox) + onde fica a caixa
  // de rotulo (coluna esquerda/direita ou centralizada, para as regioes de
  // linha media nas costas).
  const CONFIG_FRENTE = [
    { regiao: "Ombro Direito", corpo: [CX - 60, 85], caixa: "esq", y: 78 },
    { regiao: "Ombro Esquerdo", corpo: [CX + 60, 85], caixa: "dir", y: 78 },
    { regiao: "Cotovelo Direito", corpo: [CX - 85, 150], caixa: "esq", y: 143 },
    { regiao: "Cotovelo Esquerdo", corpo: [CX + 85, 150], caixa: "dir", y: 143 },
    { regiao: "Punho Direito", corpo: [CX - 95, 205], caixa: "esq", y: 200 },
    { regiao: "Punho Esquerdo", corpo: [CX + 95, 205], caixa: "dir", y: 200 },
    { regiao: "Mao Direita", corpo: [CX - 100, 258], caixa: "esq", y: 258 },
    { regiao: "Mao Esquerda", corpo: [CX + 100, 258], caixa: "dir", y: 258 },
    { regiao: "Pe Direito", corpo: [CX - 35, 400], caixa: "esq", y: 393 },
    { regiao: "Pe Esquerdo", corpo: [CX + 35, 400], caixa: "dir", y: 393 },
  ];

  const CONFIG_COSTAS = [
    { regiao: "Cervical", corpo: [CX, 68], caixa: "centro", y: 14 },
    { regiao: "Dorsal", corpo: [CX, 115], caixa: "centro", y: 44 },
    { regiao: "Lombar", corpo: [CX, 170], caixa: "centro", y: 74 },
    { regiao: "Quadril Direito", corpo: [CX + 25, 210], caixa: "dir", y: 204 },
    { regiao: "Quadril Esquerdo", corpo: [CX - 25, 210], caixa: "esq", y: 204 },
    { regiao: "Joelho Direito", corpo: [CX + 30, 300], caixa: "dir", y: 293 },
    { regiao: "Joelho Esquerdo", corpo: [CX - 30, 300], caixa: "esq", y: 293 },
    { regiao: "Tornozelo Direito", corpo: [CX + 35, 390], caixa: "dir", y: 383 },
    { regiao: "Tornozelo Esquerdo", corpo: [CX - 35, 390], caixa: "esq", y: 383 },
  ];

  const LARGURA_CAIXA = 96;
  const ALTURA_CAIXA = 30;
  const X_COLUNA_ESQ = 6;
  const X_COLUNA_DIR = 400 - 6 - LARGURA_CAIXA;
  const X_CENTRO = CX - LARGURA_CAIXA / 2;

  function silhueta() {
    // Mannequin esquematico: cabeca + tronco + 2 bracos + 2 pernas. Traco
    // em currentColor (acompanha o tema); preenchimento leve com a superficie
    // do cartao para as caixas de rotulo poderem ficar por cima sem "sujar".
    return `
      <circle cx="${CX}" cy="35" r="24" fill="none" stroke="currentColor" stroke-width="2.5" />
      <path d="M ${CX - 32} 66 Q ${CX} 55 ${CX + 32} 66 L ${CX + 34} 215 Q ${CX} 230 ${CX - 34} 215 Z"
            fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
      <line x1="${CX - 30}" y1="85" x2="${CX - 60}" y2="85" stroke="currentColor" stroke-width="7" stroke-linecap="round" />
      <line x1="${CX - 60}" y1="85" x2="${CX - 85}" y2="150" stroke="currentColor" stroke-width="6" stroke-linecap="round" />
      <line x1="${CX - 85}" y1="150" x2="${CX - 95}" y2="205" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
      <circle cx="${CX - 100}" cy="258" r="9" fill="none" stroke="currentColor" stroke-width="2.5" />
      <line x1="${CX + 30}" y1="85" x2="${CX + 60}" y2="85" stroke="currentColor" stroke-width="7" stroke-linecap="round" />
      <line x1="${CX + 60}" y1="85" x2="${CX + 85}" y2="150" stroke="currentColor" stroke-width="6" stroke-linecap="round" />
      <line x1="${CX + 85}" y1="150" x2="${CX + 95}" y2="205" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
      <circle cx="${CX + 100}" cy="258" r="9" fill="none" stroke="currentColor" stroke-width="2.5" />
      <line x1="${CX - 18}" y1="215" x2="${CX - 25}" y2="300" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
      <line x1="${CX - 25}" y1="300" x2="${CX - 35}" y2="390" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
      <ellipse cx="${CX - 35}" cy="401" rx="14" ry="7" fill="none" stroke="currentColor" stroke-width="2.5" />
      <line x1="${CX + 18}" y1="215" x2="${CX + 25}" y2="300" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
      <line x1="${CX + 25}" y1="300" x2="${CX + 35}" y2="390" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
      <ellipse cx="${CX + 35}" cy="401" rx="14" ry="7" fill="none" stroke="currentColor" stroke-width="2.5" />
    `;
  }

  function silhuetaCostas() {
    // Mesma forma geral; adiciona uma linha central de coluna, marcador
    // "sem rosto" (a pessoa esta de costas).
    return silhueta() + `<line x1="${CX}" y1="66" x2="${CX}" y2="210" stroke="currentColor" stroke-width="1" stroke-dasharray="2 4" opacity="0.5" />`;
  }

  function caixaRotulo(item, valor, formatarValor) {
    const [px, py] = item.corpo;
    let bx;
    if (item.caixa === "esq") bx = X_COLUNA_ESQ;
    else if (item.caixa === "dir") bx = X_COLUNA_DIR;
    else bx = X_CENTRO;
    const by = item.y;
    const cxCaixa = item.caixa === "esq" ? bx + LARGURA_CAIXA : (item.caixa === "dir" ? bx : bx + LARGURA_CAIXA / 2);
    const pontoLinhaX = item.caixa === "esq" ? bx + LARGURA_CAIXA : (item.caixa === "dir" ? bx : bx + LARGURA_CAIXA / 2);
    const pontoLinhaY = by + ALTURA_CAIXA / 2;
    const destacar = valor > 0;

    return `
      <line x1="${px}" y1="${py}" x2="${pontoLinhaX}" y2="${pontoLinhaY}"
            stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" opacity="0.6" />
      <circle cx="${px}" cy="${py}" r="3" fill="currentColor" opacity="0.7" />
      <rect x="${bx}" y="${by}" width="${LARGURA_CAIXA}" height="${ALTURA_CAIXA}" rx="5"
            fill="var(--card)" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3"
            opacity="${destacar ? 1 : 0.55}" />
      <text x="${bx + LARGURA_CAIXA / 2}" y="${by + 12}" text-anchor="middle"
            font-size="8.5" fill="currentColor" opacity="0.8">${item.regiao}</text>
      <text x="${bx + LARGURA_CAIXA / 2}" y="${by + 24}" text-anchor="middle"
            font-size="12" font-weight="700" fill="${destacar ? "var(--teal-escuro)" : "currentColor"}">${formatarValor(valor)}</text>
    `;
  }

  function construirSvg(config, ehCostas, valoresPorRegiao, formatarValor, tituloAria) {
    const corpo = ehCostas ? silhuetaCostas() : silhueta();
    const caixas = config.map((item) => caixaRotulo(item, valoresPorRegiao[item.regiao] || 0, formatarValor)).join("");
    return `
      <svg viewBox="0 0 400 460" role="img" aria-label="${tituloAria}" style="width:100%;height:auto;color:var(--texto-secundario)">
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
