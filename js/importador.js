/* ==========================================================================
   S.I.G.E. - ElevaLife
   Importador de planilhas Excel (V 1.6).

   Motor GENERICO de importacao: recebe a definicao de um cadastro (os mesmos
   "campos" de CADASTROS_CONFIG em js/app.js) e conduz o usuario por 3 etapas:

     1) Modelo     - baixar o modelo .xlsx (cabecalhos + instrucoes + exemplos)
                     ou os dados atuais, para editar no Excel e reenviar;
     2) Previa     - ler a planilha, validar linha a linha (obrigatorios,
                     numeros, datas, listas, hierarquia Cliente > Unidade >
                     Setor...) e mostrar o que sera criado, atualizado,
                     ignorado ou rejeitado, SEM gravar nada;
     3) Confirmar  - so apos o clique em "Confirmar importacao" as linhas
                     validas sao gravadas (em lote). Linhas com erro nunca
                     sao gravadas; o relatorio de erros pode ser baixado.

   Nada aqui altera regras de calculo. A gravacao passa por BI.DB.salvarEmLote
   (mesmas rotas e mesmas regras de empresa/permissao do cadastro manual).
   Depende da biblioteca XLSX (SheetJS), ja carregada pelo index.html.
   ========================================================================== */

(function (global) {
  "use strict";

  const BI = (global.BI = global.BI || {});

  const MAX_LINHAS = 2000;        // limite por arquivo (protege o navegador e a API)
  const MAX_LINHAS_PREVIA = 300;  // linhas desenhadas na tabela de previa
  const TIPOS_IGNORADOS = ["personalizado", "calculado", "arquivo", "foto", "fotos", "imagem", "assinatura"];

  // ---------------------------------------------------------------- utilitarios
  function norm(s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }

  const MESES = {
    jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, abr: 4, abril: 4, mai: 5, maio: 5,
    jun: 6, junho: 6, jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10,
    nov: 11, novembro: 11, dez: 12, dezembro: 12,
  };

  function pad2(n) { return String(n).padStart(2, "0"); }

  function dataValida(a, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31 || a < 1900 || a > 2100) return false;
    const t = new Date(Date.UTC(a, m - 1, d));
    return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }

  // Numero de serie do Excel (dias desde 30/12/1899) -> { a, m, d }
  function serialParaPartes(n) {
    const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
    return { a: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  function converterData(v) {
    if (v == null || v === "") return { vazio: true };
    if (typeof v === "number" && v > 20000 && v < 80000) {
      const p = serialParaPartes(v);
      return { valor: `${p.a}-${pad2(p.m)}-${pad2(p.d)}` };
    }
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
    if (m && dataValida(+m[1], +m[2], +m[3])) return { valor: `${m[1]}-${pad2(m[2])}-${pad2(m[3])}` };
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(s);
    if (m) {
      const ano = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      if (dataValida(ano, +m[2], +m[1])) return { valor: `${ano}-${pad2(m[2])}-${pad2(m[1])}` };
    }
    return { erro: `data inválida “${s}” (use dd/mm/aaaa)` };
  }

  function converterMes(v) {
    if (v == null || v === "") return { vazio: true };
    if (typeof v === "number" && v > 20000 && v < 80000) {
      const p = serialParaPartes(v);
      return { valor: `${p.a}-${pad2(p.m)}` };
    }
    const s = String(v).trim();
    let m = /^(\d{4})[\/.\-](\d{1,2})(?:[\/.\-]\d{1,2})?$/.exec(s);
    if (m && +m[2] >= 1 && +m[2] <= 12) return { valor: `${m[1]}-${pad2(m[2])}` };
    m = /^(\d{1,2})[\/.\-](\d{4})$/.exec(s);
    if (m && +m[1] >= 1 && +m[1] <= 12) return { valor: `${m[2]}-${pad2(m[1])}` };
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s);
    if (m && dataValida(+m[3], +m[2], +m[1])) return { valor: `${m[3]}-${pad2(m[2])}` };
    m = /^([A-Za-zçÇ]+)[\s\/.\-]+(\d{2}|\d{4})$/.exec(s);
    if (m) {
      const mes = MESES[norm(m[1])];
      const ano = m[2].length === 2 ? 2000 + +m[2] : +m[2];
      if (mes) return { valor: `${ano}-${pad2(mes)}` };
    }
    return { erro: `mês inválido “${s}” (use mm/aaaa)` };
  }

  function converterNumero(v, def) {
    if (v == null || v === "") return { vazio: true };
    let n;
    if (typeof v === "number") n = v;
    else {
      let s = String(v).trim().replace(/\s/g, "");
      if (s.indexOf(",") !== -1) s = s.replace(/\./g, "").replace(",", ".");
      else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
      n = Number(s);
    }
    if (!isFinite(n)) return { erro: `número inválido “${v}”` };
    if (def.min != null && n < def.min) return { erro: `valor ${n} abaixo do mínimo (${def.min})` };
    if (def.max != null && n > def.max) return { erro: `valor ${n} acima do máximo (${def.max})` };
    return { valor: n };
  }

  function listaDeOpcoes(def) {
    const o = typeof def.opcoes === "function" ? def.opcoes() : def.opcoes;
    return Array.isArray(o) ? o.map((x) => (x && typeof x === "object" ? (x.valor != null ? x.valor : x.value) : x)) : [];
  }

  function converterSelect(v, def) {
    if (v == null || String(v).trim() === "") return { vazio: true };
    const opcoes = listaDeOpcoes(def);
    if (!opcoes.length) return { valor: String(v).trim() };
    const alvo = norm(v);
    const achada = opcoes.find((o) => norm(o) === alvo);
    if (achada != null) return { valor: achada };
    const amostra = opcoes.slice(0, 6).join(", ") + (opcoes.length > 6 ? "…" : "");
    return { erro: `“${String(v).trim()}” não é uma opção válida (${amostra})` };
  }

  function converterCampo(def, bruto) {
    const vazioBruto = bruto == null || String(bruto).trim() === "";
    if (def.tipo === "numero") return converterNumero(bruto, def);
    if (def.tipo === "data") return converterData(bruto);
    if (def.tipo === "mes") return converterMes(bruto);
    if (def.tipo === "select") return converterSelect(bruto, def);
    if (def.tipo === "multiselect") {
      if (vazioBruto) return { vazio: true };
      const partes = String(bruto).split(/[;|]/).map((p) => p.trim()).filter(Boolean);
      const opcoes = listaDeOpcoes(def);
      const saida = [];
      for (const p of partes) {
        const ach = opcoes.length ? opcoes.find((o) => norm(o) === norm(p)) : p;
        if (ach == null) return { erro: `“${p}” não é uma opção válida` };
        saida.push(ach);
      }
      return { valor: saida };
    }
    if (vazioBruto) return { vazio: true };
    return { valor: String(bruto).trim() };
  }

  // ------------------------------------------------------------ leitura do arquivo
  function lerArquivo(arquivo) {
    return new Promise((resolve, reject) => {
      if (typeof global.XLSX === "undefined") {
        reject(new Error("A biblioteca de leitura de Excel não carregou (script externo bloqueado ou indisponível)."));
        return;
      }
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      leitor.onload = () => {
        try {
          const wb = global.XLSX.read(leitor.result, { type: "array", cellDates: false });
          resolve(wb);
        } catch (e) {
          reject(new Error("O arquivo não parece ser uma planilha Excel (.xlsx) válida."));
        }
      };
      leitor.readAsArrayBuffer(arquivo);
    });
  }

  const ABAS_AUXILIARES = ["instrucoes", "exemplo", "exemplos", "referencias", "valores validos", "setores cadastrados", "listas", "leia me"];

  function escolherAba(wb, nomePreferida) {
    const nomes = wb.SheetNames || [];
    const pref = nomes.find((n) => norm(n) === norm(nomePreferida));
    if (pref) return pref;
    return nomes.find((n) => ABAS_AUXILIARES.indexOf(norm(n)) === -1) || nomes[0];
  }

  // Aba -> matriz de linhas (valores brutos). Primeira linha nao vazia = cabecalho.
  function abaParaMatriz(wb, nomeAba) {
    const ws = wb.Sheets[nomeAba];
    if (!ws) return { cabecalhos: [], linhas: [] };
    const m = global.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    const iniciar = m.findIndex((l) => l.some((c) => c != null && String(c).trim() !== ""));
    if (iniciar === -1) return { cabecalhos: [], linhas: [] };
    const cabecalhos = m[iniciar].map((c) => (c == null ? "" : String(c).trim()));
    const linhas = [];
    for (let i = iniciar + 1; i < m.length; i++) {
      if (m[i].every((c) => c == null || String(c).trim() === "")) continue;
      linhas.push({ numero: i + 1, celulas: m[i] }); // numero = linha real na planilha (1-based)
    }
    return { cabecalhos, linhas };
  }

  // ------------------------------------------------------------------ mapeamento
  function camposImportaveis(def) {
    return def.campos.filter((c) => c.importar !== false && TIPOS_IGNORADOS.indexOf(c.tipo) === -1);
  }

  function rotulosChave(def) {
    return (def.chaveNatural || []).map((k) => {
      const c = def.campos.find((x) => x.campo === k);
      return c ? rotuloDe(def, c) : k;
    });
  }

  function rotuloDe(def, c) {
    return def.rotulo ? def.rotulo(c) : (c.rotulo || c.campo);
  }

  // Mapeamento automatico: campo -> indice da coluna na planilha (ou -1).
  function mapeamentoAutomatico(def, cabecalhos) {
    const mapa = {};
    const usados = new Set();
    const normCab = cabecalhos.map(norm);
    camposImportaveis(def).forEach((c) => {
      const candidatos = [rotuloDe(def, c), c.rotulo, c.campo].concat(c.apelidos || []).map(norm).filter(Boolean);
      let idx = -1;
      for (const cand of candidatos) {
        idx = normCab.findIndex((n, i) => n === cand && !usados.has(i));
        if (idx !== -1) break;
      }
      mapa[c.campo] = idx;
      if (idx !== -1) usados.add(idx);
    });
    return mapa;
  }

  // ------------------------------------------------------------------- analise
  // Devolve { itens, resumo }. Cada item: { numero, valores, erros[], avisos[],
  // acao: "novo"|"atualiza"|"igual"|"erro", existenteId, mudancas[] }.
  function analisar(def, ctx, tabela, mapa, opcoes) {
    const campos = camposImportaveis(def);
    const itens = [];
    const chavesVistas = new Map();
    const existentes = (ctx.existentes && ctx.existentes()) || [];
    const indiceExistentes = new Map();
    const chaveNatural = def.chaveNatural || [];
    function chaveDe(valores) {
      return chaveNatural.map((k) => norm(valores[k] == null ? "" : valores[k])).join("|");
    }
    if (chaveNatural.length) existentes.forEach((l) => { const k = chaveDe(l); if (!indiceExistentes.has(k)) indiceExistentes.set(k, l); });

    tabela.linhas.slice(0, MAX_LINHAS).forEach((linha) => {
      const valores = {};
      const erros = [];
      const avisos = [];
      campos.forEach((c) => {
        const idx = mapa[c.campo];
        if (idx == null || idx < 0) return;
        const r = converterCampo(c, linha.celulas[idx]);
        if (r.erro) erros.push(`${rotuloDe(def, c)}: ${r.erro}`);
        else if (r.vazio) valores[c.campo] = null;
        else valores[c.campo] = r.valor;
      });

      // Hierarquia (Cliente > Unidade > Setor > ...): cada nivel precisa existir
      // dentro do nivel anterior; o texto e padronizado para a grafia cadastrada.
      if (ctx.opcoesCascata) {
        const atuais = {};
        campos.filter((c) => c.tipo === "cascata").forEach((c) => {
          const v = valores[c.campo];
          if (v == null) return;
          const lista = ctx.opcoesCascata(c.campo, Object.assign({}, atuais)) || [];
          const ach = lista.find((o) => norm(o) === norm(v));
          if (ach == null) {
            const nivelAnterior = Object.keys(atuais).pop();
            const ondeEstaria = nivelAnterior ? ` em ${nivelAnterior} “${atuais[nivelAnterior]}”` : "";
            erros.push(`${rotuloDe(def, c)}: “${v}” não está cadastrado${ondeEstaria}`);
          } else {
            valores[c.campo] = ach;
            atuais[c.campo] = ach;
          }
        });
      }

      campos.forEach((c) => {
        if (!c.obrigatorio) return;
        const idx = mapa[c.campo];
        if (idx == null || idx < 0) return; // coluna ausente: avisado no resumo geral
        const v = valores[c.campo];
        const vazio = v == null || v === "" || (Array.isArray(v) && !v.length);
        const jaTemErro = erros.some((e) => e.indexOf(rotuloDe(def, c) + ":") === 0);
        if (vazio && !jaTemErro) erros.push(`${rotuloDe(def, c)}: obrigatório e vazio`);
      });

      if (def.validarLinha && !erros.length) {
        const extra = def.validarLinha(valores, ctx) || {};
        (extra.erros || []).forEach((e) => erros.push(e));
        (extra.avisos || []).forEach((a) => avisos.push(a));
        if (extra.valores) Object.assign(valores, extra.valores);
      }

      const item = { numero: linha.numero, celulas: linha.celulas, valores, erros, avisos, acao: "novo", existenteId: null, mudancas: [] };

      if (!erros.length && chaveNatural.length) {
        const k = chaveDe(valores);
        if (chavesVistas.has(k)) {
          item.erros.push(`Linha repetida: mesma combinação (${rotulosChave(def).join(" + ")}) da linha ${chavesVistas.get(k)}`);
        } else {
          chavesVistas.set(k, linha.numero);
          const ex = indiceExistentes.get(k);
          if (ex) {
            item.existenteId = ex._id;
            campos.forEach((c) => {
              if (!(c.campo in valores) || (mapa[c.campo] == null || mapa[c.campo] < 0)) return;
              const antes = ex[c.campo] == null ? "" : String(ex[c.campo]);
              const depois = valores[c.campo] == null ? "" : String(valores[c.campo]);
              if (antes !== depois) item.mudancas.push({ campo: rotuloDe(def, c), antes, depois });
            });
            item.acao = item.mudancas.length ? "atualiza" : "igual";
          }
        }
      }
      if (item.erros.length) item.acao = "erro";
      else if (item.acao === "atualiza" && opcoes && opcoes.atualizar === false) item.acao = "ignorada";
      itens.push(item);
    });

    const resumo = { total: itens.length, novo: 0, atualiza: 0, igual: 0, erro: 0, ignorada: 0, excedeu: tabela.linhas.length > MAX_LINHAS };
    itens.forEach((i) => { resumo[i.acao] = (resumo[i.acao] || 0) + 1; });
    return { itens, resumo };
  }

  // -------------------------------------------------------------------- modelos
  function baixarArquivoXlsx(wb, nome) {
    global.XLSX.writeFile(wb, nome);
  }

  function aoa(linhas) { return global.XLSX.utils.aoa_to_sheet(linhas); }

  function largurasColunas(ws, linhas) {
    const w = [];
    linhas.forEach((l) => l.forEach((c, i) => {
      const t = c == null ? 0 : String(c).length;
      w[i] = Math.max(w[i] || 10, Math.min(60, t + 2));
    }));
    ws["!cols"] = w.map((x) => ({ wch: x }));
  }

  function descricaoTipo(c) {
    switch (c.tipo) {
      case "numero": return "Número" + (c.min != null ? `, mínimo ${c.min}` : "") + (c.max != null ? `, máximo ${c.max}` : "");
      case "data": return "Data no formato dd/mm/aaaa";
      case "mes": return "Mês/ano no formato mm/aaaa (ex.: 05/2026)";
      case "select": return "Escolher uma das opções listadas";
      case "multiselect": return "Uma ou mais opções, separadas por ponto e vírgula";
      case "cascata": return "Nome já cadastrado (ver aba “Referências”)";
      default: return "Texto";
    }
  }

  function baixarModelo(def, ctx) {
    const campos = camposImportaveis(def);
    const cab = campos.map((c) => rotuloDe(def, c));
    const wb = global.XLSX.utils.book_new();

    const abaDados = aoa([cab]);
    largurasColunas(abaDados, [cab]);
    global.XLSX.utils.book_append_sheet(wb, abaDados, "Dados");

    const instr = [
      [`Modelo de importação – ${def.titulo}`],
      [""],
      ["Como usar"],
      ["1. Preencha a aba “Dados”, uma linha por registro, mantendo os cabeçalhos da primeira linha."],
      ["2. Não altere o nome das colunas. Colunas sem dados podem ficar vazias, exceto as obrigatórias."],
      ["3. No sistema, abra a tela correspondente, clique em “Importar Excel” e escolha este arquivo."],
      ["4. O sistema mostra uma PRÉVIA com o que será criado, atualizado ou rejeitado. Nada é gravado até você clicar em “Confirmar importação”."],
      [def.chaveNatural && def.chaveNatural.length
        ? `5. Registros que já existem (mesma combinação de ${rotulosChave(def).join(" + ")}) são atualizados em vez de duplicados.`
        : "5. Cada linha válida cria um novo registro."],
      [""],
      ["Colunas"],
      ["Coluna", "Obrigatória", "Formato esperado", "Opções válidas"],
    ];
    campos.forEach((c) => {
      const ops = c.tipo === "select" || c.tipo === "multiselect" ? listaDeOpcoes(c) : [];
      instr.push([rotuloDe(def, c), c.obrigatorio ? "Sim" : "Não", descricaoTipo(c), ops.join("; ")]);
    });
    const abaInstr = aoa(instr);
    abaInstr["!cols"] = [{ wch: 34 }, { wch: 12 }, { wch: 52 }, { wch: 70 }];
    global.XLSX.utils.book_append_sheet(wb, abaInstr, "Instruções");

    // Exemplo (aba separada: nao e importada)
    const exemplos = (ctx.exemplos && ctx.exemplos()) || [];
    if (exemplos.length) {
      const linhas = [cab].concat(exemplos.map((ex) => campos.map((c) => (ex[c.campo] == null ? "" : ex[c.campo]))));
      const abaEx = aoa(linhas);
      largurasColunas(abaEx, linhas);
      global.XLSX.utils.book_append_sheet(wb, abaEx, "Exemplo");
    }

    // Referencias: combinacoes da hierarquia ja cadastradas (so as que o usuario enxerga)
    const refs = (ctx.referencias && ctx.referencias()) || [];
    refs.forEach((ref) => {
      const linhas = [ref.colunas].concat(ref.linhas);
      const aba = aoa(linhas);
      largurasColunas(aba, linhas);
      global.XLSX.utils.book_append_sheet(wb, aba, ref.nome.slice(0, 31));
    });

    baixarArquivoXlsx(wb, `modelo-importacao-${def.arquivo || "dados"}.xlsx`);
  }

  function formatarParaPlanilha(c, v) {
    if (v == null) return "";
    if (c.tipo === "data" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
    if (c.tipo === "mes" && /^\d{4}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
    if (Array.isArray(v)) return v.join("; ");
    return v;
  }

  function baixarDadosAtuais(def, ctx) {
    const campos = camposImportaveis(def);
    const cab = campos.map((c) => rotuloDe(def, c));
    const dados = ((ctx.existentes && ctx.existentes()) || []).map((l) => campos.map((c) => formatarParaPlanilha(c, l[c.campo])));
    const linhas = [cab].concat(dados);
    const wb = global.XLSX.utils.book_new();
    const aba = aoa(linhas);
    largurasColunas(aba, linhas);
    global.XLSX.utils.book_append_sheet(wb, aba, "Dados");
    const hoje = new Date().toISOString().slice(0, 10);
    baixarArquivoXlsx(wb, `${def.arquivo || "dados"}-atuais-${hoje}.xlsx`);
  }

  function baixarRelatorioErros(def, tabela, analise) {
    const linhas = [tabela.cabecalhos.concat(["Linha na planilha", "Motivo da rejeição"])];
    analise.itens.filter((i) => i.acao === "erro").forEach((i) => {
      const base = tabela.cabecalhos.map((_, idx) => (i.celulas[idx] == null ? "" : i.celulas[idx]));
      linhas.push(base.concat([i.numero, i.erros.join(" | ")]));
    });
    const wb = global.XLSX.utils.book_new();
    const aba = aoa(linhas);
    largurasColunas(aba, linhas);
    global.XLSX.utils.book_append_sheet(wb, aba, "Rejeitadas");
    baixarArquivoXlsx(wb, `rejeitadas-${def.arquivo || "dados"}.xlsx`);
  }

  // ------------------------------------------------------------------------- UI
  function abrir(def, ctx) {
    if (document.getElementById("imp-overlay")) return;
    const estado = { wb: null, nomeArquivo: "", aba: "", tabela: null, mapa: {}, analise: null, atualizar: true, gravando: false };

    const overlay = el("div", "imp-overlay");
    overlay.id = "imp-overlay";
    const modal = el("div", "imp-modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Importar Excel – " + def.titulo);
    const cab = el("div", "imp-cabecalho");
    cab.appendChild(el("div", "imp-titulo", "Importar Excel – " + def.titulo));
    const btnX = el("button", "imp-fechar", "×");
    btnX.type = "button";
    btnX.setAttribute("aria-label", "Fechar");
    cab.appendChild(btnX);
    const corpo = el("div", "imp-corpo");
    const rodape = el("div", "imp-rodape");
    modal.appendChild(cab);
    modal.appendChild(corpo);
    modal.appendChild(rodape);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function fechar() {
      if (estado.gravando) return;
      document.removeEventListener("keydown", aoTeclar);
      overlay.remove();
    }
    function aoTeclar(ev) { if (ev.key === "Escape") fechar(); }
    document.addEventListener("keydown", aoTeclar);
    btnX.addEventListener("click", fechar);
    overlay.addEventListener("mousedown", (ev) => { if (ev.target === overlay) fechar(); });

    function botao(texto, classe, aoClicar) {
      const b = el("button", classe, texto);
      b.type = "button";
      b.addEventListener("click", aoClicar);
      return b;
    }

    // ---------- Etapa 1: inicio
    function telaInicio(mensagemErro) {
      corpo.innerHTML = "";
      rodape.innerHTML = "";
      corpo.appendChild(el("p", "imp-texto", def.descricao || "Envie uma planilha Excel (.xlsx) para criar ou atualizar vários registros de uma vez. Antes de gravar, o sistema mostra uma prévia para você conferir e confirmar."));
      const passos = el("ol", "imp-passos");
      ["Baixe o modelo e preencha uma linha por registro (ou baixe os dados atuais para editar no Excel).",
        "Selecione o arquivo preenchido: o sistema valida cada linha e mostra a prévia.",
        "Confira e clique em “Confirmar importação”. Linhas com erro não são gravadas."].forEach((t) => passos.appendChild(el("li", null, t)));
      corpo.appendChild(passos);
      const acoes = el("div", "imp-acoes");
      acoes.appendChild(botao("⬇ Baixar modelo (.xlsx)", "btn-cad-secundario", () => {
        try { baixarModelo(def, ctx); } catch (e) { telaInicio(e.message); }
      }));
      acoes.appendChild(botao("⬇ Baixar dados atuais (.xlsx)", "btn-cad-secundario", () => {
        try { baixarDadosAtuais(def, ctx); } catch (e) { telaInicio(e.message); }
      }));
      corpo.appendChild(acoes);

      const zona = el("label", "imp-zona");
      zona.appendChild(el("span", "imp-zona-titulo", "Selecionar planilha preenchida"));
      zona.appendChild(el("span", "imp-zona-sub", "Arquivos .xlsx, .xls ou .csv · até " + MAX_LINHAS + " linhas"));
      const entrada = document.createElement("input");
      entrada.type = "file";
      entrada.accept = ".xlsx,.xls,.csv";
      entrada.className = "imp-arquivo";
      entrada.addEventListener("change", () => { if (entrada.files && entrada.files[0]) carregar(entrada.files[0]); });
      zona.appendChild(entrada);
      ["dragover", "dragenter"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add("sobre"); }));
      ["dragleave", "drop"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove("sobre"); }));
      zona.addEventListener("drop", (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) carregar(f); });
      corpo.appendChild(zona);

      if (mensagemErro) corpo.appendChild(el("div", "imp-erro", mensagemErro));
      rodape.appendChild(botao("Fechar", "btn-cad-secundario", fechar));
    }

    async function carregar(arquivo) {
      try {
        estado.wb = await lerArquivo(arquivo);
        estado.nomeArquivo = arquivo.name;
        estado.aba = escolherAba(estado.wb, def.nomePlanilha || "Dados");
        prepararAba();
      } catch (e) {
        telaInicio(e.message);
      }
    }

    function prepararAba() {
      estado.tabela = abaParaMatriz(estado.wb, estado.aba);
      if (!estado.tabela.cabecalhos.length) { telaInicio("A planilha está vazia. Preencha a aba “Dados” a partir do modelo."); return; }
      estado.mapa = mapeamentoAutomatico(def, estado.tabela.cabecalhos);
      reanalisar();
    }

    function reanalisar() {
      estado.analise = analisar(def, ctx, estado.tabela, estado.mapa, { atualizar: estado.atualizar });
      telaPrevia();
    }

    function faltantesObrigatorias() {
      return camposImportaveis(def).filter((c) => c.obrigatorio && (estado.mapa[c.campo] == null || estado.mapa[c.campo] < 0));
    }

    // ---------- Etapa 2: previa
    function telaPrevia() {
      corpo.innerHTML = "";
      rodape.innerHTML = "";
      const a = estado.analise;
      const r = a.resumo;
      const faltam = faltantesObrigatorias();

      const topo = el("div", "imp-arquivo-info");
      topo.appendChild(el("strong", null, estado.nomeArquivo));
      if ((estado.wb.SheetNames || []).length > 1) {
        const sel = document.createElement("select");
        sel.className = "imp-sel-aba";
        sel.setAttribute("aria-label", "Aba da planilha");
        estado.wb.SheetNames.forEach((n) => { const o = document.createElement("option"); o.value = n; o.textContent = "Aba: " + n; if (n === estado.aba) o.selected = true; sel.appendChild(o); });
        sel.addEventListener("change", () => { estado.aba = sel.value; prepararAba(); });
        topo.appendChild(sel);
      }
      corpo.appendChild(topo);

      const chips = el("div", "imp-chips");
      function chip(rotulo, valor, classe) {
        const c = el("div", "imp-chip " + classe);
        c.appendChild(el("span", "imp-chip-valor", String(valor)));
        c.appendChild(el("span", "imp-chip-rotulo", rotulo));
        chips.appendChild(c);
      }
      chip("linhas lidas", r.total, "neutro");
      chip("novos", r.novo, "ok");
      chip("atualizações", r.atualiza, "info");
      chip("sem alteração", r.igual, "neutro");
      chip("com erro", r.erro, r.erro ? "erro" : "neutro");
      corpo.appendChild(chips);

      if (r.excedeu) corpo.appendChild(el("div", "imp-erro", `A planilha tem mais de ${MAX_LINHAS} linhas; somente as primeiras ${MAX_LINHAS} foram lidas. Divida o arquivo em partes.`));
      if (faltam.length) {
        corpo.appendChild(el("div", "imp-erro", "Colunas obrigatórias não encontradas na planilha: " + faltam.map((c) => rotuloDe(def, c)).join(", ") + ". Ajuste o mapeamento de colunas abaixo ou use o modelo."));
      }

      // Mapeamento de colunas (recolhido por padrao quando tudo foi reconhecido)
      const det = document.createElement("details");
      det.className = "imp-mapeamento";
      if (faltam.length) det.open = true;
      det.appendChild(el("summary", null, "Ajustar colunas (mapeamento)"));
      const grade = el("div", "imp-mapa-grade");
      camposImportaveis(def).forEach((c) => {
        grade.appendChild(el("label", "imp-mapa-rotulo", rotuloDe(def, c) + (c.obrigatorio ? " *" : "")));
        const sel = document.createElement("select");
        const o0 = document.createElement("option"); o0.value = "-1"; o0.textContent = "— não importar —"; sel.appendChild(o0);
        estado.tabela.cabecalhos.forEach((h, i) => {
          if (!h) return;
          const o = document.createElement("option"); o.value = String(i); o.textContent = h; sel.appendChild(o);
        });
        sel.value = String(estado.mapa[c.campo] != null ? estado.mapa[c.campo] : -1);
        sel.addEventListener("change", () => { estado.mapa[c.campo] = Number(sel.value); reanalisar(); });
        grade.appendChild(sel);
      });
      det.appendChild(grade);
      corpo.appendChild(det);

      const opcoes = el("label", "imp-opcao");
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = estado.atualizar;
      chk.addEventListener("change", () => { estado.atualizar = chk.checked; reanalisar(); });
      opcoes.appendChild(chk);
      opcoes.appendChild(document.createTextNode(" Atualizar registros que já existem (mesma " + (rotulosChave(def).join(" + ") || "chave") + ")"));
      if ((def.chaveNatural || []).length) corpo.appendChild(opcoes);

      // Tabela de previa
      const scroll = el("div", "imp-tabela-scroll");
      const tabela = el("table", "imp-tabela");
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      ["Linha", "Situação", "Detalhe"].concat((def.colunasPrevia || camposImportaveis(def).map((c) => c.campo)).map((k) => {
        const c = def.campos.find((x) => x.campo === k);
        return c ? rotuloDe(def, c) : k;
      })).forEach((t) => trh.appendChild(el("th", null, t)));
      thead.appendChild(trh);
      tabela.appendChild(thead);
      const tbody = document.createElement("tbody");
      const colunasPrevia = def.colunasPrevia || camposImportaveis(def).map((c) => c.campo);
      const ROT_ACAO = { novo: "Novo", atualiza: "Atualiza", igual: "Sem alteração", erro: "Erro", ignorada: "Ignorada" };
      a.itens.slice(0, MAX_LINHAS_PREVIA).forEach((i) => {
        const tr = document.createElement("tr");
        tr.className = "imp-linha-" + i.acao;
        tr.appendChild(el("td", null, String(i.numero)));
        const tdS = document.createElement("td");
        tdS.appendChild(el("span", "imp-badge imp-badge-" + i.acao, ROT_ACAO[i.acao]));
        tr.appendChild(tdS);
        let detalhe = "";
        if (i.erros.length) detalhe = i.erros.join("; ");
        else if (i.acao === "atualiza") detalhe = i.mudancas.map((m) => `${m.campo}: ${m.antes || "vazio"} → ${m.depois || "vazio"}`).join("; ");
        else if (i.avisos.length) detalhe = i.avisos.join("; ");
        tr.appendChild(el("td", "imp-detalhe", detalhe));
        colunasPrevia.forEach((k) => {
          const c = def.campos.find((x) => x.campo === k);
          const v = i.valores[k];
          tr.appendChild(el("td", null, v == null ? "" : String(formatarParaPlanilha(c || {}, v))));
        });
        tbody.appendChild(tr);
      });
      tabela.appendChild(tbody);
      scroll.appendChild(tabela);
      corpo.appendChild(scroll);
      if (a.itens.length > MAX_LINHAS_PREVIA) corpo.appendChild(el("div", "imp-nota", `Mostrando as primeiras ${MAX_LINHAS_PREVIA} de ${a.itens.length} linhas. A importação considera todas.`));

      const aGravar = r.novo + r.atualiza;
      rodape.appendChild(botao("Trocar arquivo", "btn-cad-secundario", () => telaInicio()));
      if (r.erro) rodape.appendChild(botao("⬇ Baixar linhas rejeitadas", "btn-cad-secundario", () => baixarRelatorioErros(def, estado.tabela, a)));
      rodape.appendChild(el("span", "imp-espaco"));
      rodape.appendChild(botao("Cancelar", "btn-cad-secundario", fechar));
      const btnConfirmar = botao(aGravar ? `Confirmar importação (${aGravar} ${aGravar === 1 ? "registro" : "registros"})` : "Nada a importar", "btn-cad-primario", () => gravar());
      btnConfirmar.disabled = !aGravar || faltam.length > 0;
      rodape.appendChild(btnConfirmar);
      if (r.erro && aGravar) rodape.appendChild(el("div", "imp-aviso-rodape", `${r.erro} ${r.erro === 1 ? "linha com erro será ignorada" : "linhas com erro serão ignoradas"}.`));
    }

    // ---------- Etapa 3: gravar
    async function gravar() {
      const itens = estado.analise.itens.filter((i) => i.acao === "novo" || i.acao === "atualiza");
      if (!itens.length) return;
      if (!BI.DB || !BI.DB.estado.disponivel) { corpo.appendChild(el("div", "imp-erro", "Banco de dados indisponível nesta visualização. Não é possível importar agora.")); return; }
      estado.gravando = true;
      corpo.innerHTML = "";
      rodape.innerHTML = "";
      const prog = el("div", "imp-progresso");
      const barra = el("div", "imp-barra");
      const enchimento = el("div", "imp-barra-cheia");
      barra.appendChild(enchimento);
      const texto = el("div", "imp-texto", `Gravando 0 de ${itens.length}…`);
      prog.appendChild(texto);
      prog.appendChild(barra);
      corpo.appendChild(prog);

      const lote = itens.map((i) => {
        if (i.acao === "atualiza") {
          const ex = (ctx.existentes() || []).find((l) => l._id === i.existenteId) || {};
          const dados = Object.assign({}, ex, i.valores);
          delete dados._id;
          return { id: i.existenteId, dados, criar: false, ref: i };
        }
        const id = ctx.gerarId ? ctx.gerarId(i.valores) : null;
        return { id, dados: Object.assign({}, i.valores), criar: true, ref: i };
      });

      let resultado;
      try {
        resultado = await BI.DB.salvarEmLote(def.colecao, lote, (feitos) => {
          texto.textContent = `Gravando ${feitos} de ${itens.length}…`;
          enchimento.style.width = Math.round((feitos / itens.length) * 100) + "%";
        });
      } catch (e) {
        estado.gravando = false;
        telaFinal({ criados: 0, atualizados: 0, falhas: [{ numero: "-", erro: e && e.message ? e.message : String(e) }] });
        return;
      }
      estado.gravando = false;
      const falhas = resultado.falhas.map((f) => ({ numero: lote[f.indice].ref.numero, erro: f.erro }));
      const falhouIdx = new Set(resultado.falhas.map((f) => f.indice));
      let criados = 0, atualizados = 0;
      lote.forEach((l, idx) => { if (falhouIdx.has(idx)) return; if (l.criar) criados++; else atualizados++; });
      telaFinal({ criados, atualizados, falhas });
    }

    function telaFinal(res) {
      corpo.innerHTML = "";
      rodape.innerHTML = "";
      const ok = res.criados + res.atualizados;
      const titulo = el("div", "imp-final-titulo " + (res.falhas.length ? (ok ? "parcial" : "erro") : "ok"),
        res.falhas.length ? (ok ? "Importação concluída com pendências" : "A importação não foi concluída") : "Importação concluída");
      corpo.appendChild(titulo);
      const chips = el("div", "imp-chips");
      [["criados", res.criados, "ok"], ["atualizados", res.atualizados, "info"], ["falhas ao gravar", res.falhas.length, res.falhas.length ? "erro" : "neutro"]].forEach(([rot, val, cls]) => {
        const c = el("div", "imp-chip " + cls);
        c.appendChild(el("span", "imp-chip-valor", String(val)));
        c.appendChild(el("span", "imp-chip-rotulo", rot));
        chips.appendChild(c);
      });
      corpo.appendChild(chips);
      if (res.falhas.length) {
        const ul = el("ul", "imp-lista-falhas");
        res.falhas.slice(0, 30).forEach((f) => ul.appendChild(el("li", null, `Linha ${f.numero}: ${f.erro}`)));
        corpo.appendChild(ul);
      }
      const rej = estado.analise ? estado.analise.resumo.erro : 0;
      if (rej) corpo.appendChild(el("div", "imp-nota", `${rej} ${rej === 1 ? "linha foi rejeitada" : "linhas foram rejeitadas"} na validação e não ${rej === 1 ? "foi gravada" : "foram gravadas"}.`));
      rodape.appendChild(el("span", "imp-espaco"));
      if (ctx.aoConcluir) { try { ctx.aoConcluir(res); } catch (e) { /* atualizacao de tela nunca derruba o resultado */ } }
      rodape.appendChild(botao("Fechar", "btn-cad-primario", fechar));
    }

    telaInicio();
  }

  BI.Importador = { abrir, analisar, converterData, converterMes, converterNumero, norm, mapeamentoAutomatico, MAX_LINHAS };
})(window);
