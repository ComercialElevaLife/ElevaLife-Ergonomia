/* ==========================================================================
   S.I.G.E. - ElevaLife
   Importador de planilhas Excel (V 1.6; V 1.10: cadastros ausentes, duplicadas, grafias).

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

   V 1.10: a previa tambem (a) cria automaticamente os cadastros que faltam na
   hierarquia Cliente > ... > Atividade (opcao do usuario), (b) sugere revisao de
   linhas duplicadas e de nomes parecidos, (c) pede valores padrao para o que a
   planilha nao traz e (d) deixa o usuario conferir a correspondencia de valores
   de lista (ex.: "Leve" = "Baixa").

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

  // ------------------------------------------------------- V 1.10: limpeza e parecidos
  // Texto vindo de relatorios de outros sistemas: "_x000A_" (quebra de linha escapada),
  // espacos estranhos e marcadores de "sem valor" ("-", "Nao informado") viram vazio.
  function limparBruto(v, def) {
    if (typeof v !== "string") return v;
    const s = v.replace(/_x000D_/gi, "").replace(/_x000A_/gi, "\n").replace(/\u00a0/g, " ").trim();
    const lista = def.valoresVazios;
    if (lista && lista.length) {
      const baixo = s.toLowerCase();
      const n = norm(s);
      if (lista.some((x) => { const xl = String(x).toLowerCase(); return xl === baixo || (norm(x) !== "" && norm(x) === n); })) return null;
    }
    return s;
  }

  const PALAVRAS_LIGACAO = ["a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "em", "para", "com", "que", "na", "no", "nas", "nos", "um", "uma"];

  // Forma "simplificada" para comparar nomes: sem acento/pontuacao, sem palavras de
  // ligacao (de, e, que...) e sem plural. "Montador I, II e III" == "Montador I, II, III".
  function chaveSimples(s) {
    return norm(s).split(" ")
      .filter((p) => p && PALAVRAS_LIGACAO.indexOf(p) === -1)
      .map((p) => (p.length > 3 ? p.replace(/(es|s)$/, "") : p))
      .join(" ");
  }

  function distancia(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let ant = new Array(n + 1);
    for (let j = 0; j <= n; j++) ant[j] = j;
    for (let i = 1; i <= m; i++) {
      const atual = [i];
      for (let j = 1; j <= n; j++) {
        atual[j] = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      ant = atual;
    }
    return ant[n];
  }

  function tokenDistintivo(t) { return /\d/.test(t) || /^[ivx]+$/.test(t) || t.length <= 1; }

  // Dois nomes "parecidos" (provavel mesma coisa escrita de formas diferentes)?
  // Numeros e numerais romanos distinguem itens ("Linha 1" x "Linha 2", "Montador I" x "II").
  function similares(a, b) {
    const na = norm(a), nb = norm(b);
    if (na === nb) return true;
    const sa = chaveSimples(a), sb = chaveSimples(b);
    if (sa === sb) return true;
    // Palavras diferentes (siglas, numeros, algarismos romanos) distinguem itens; so um erro de
    // digitacao ou flexao em UMA palavra comprida ("maquina" x "maqunia") conta como parecido.
    const ta = sa.split(" "), tb = sb.split(" ");
    const soA = ta.filter((t) => tb.indexOf(t) === -1);
    const soB = tb.filter((t) => ta.indexOf(t) === -1);
    if (soA.length !== 1 || soB.length !== 1) return false;
    const x = soA[0], y = soB[0];
    if (tokenDistintivo(x) || tokenDistintivo(y) || Math.min(x.length, y.length) < 5) return false;
    return distancia(x, y) <= (Math.max(x.length, y.length) >= 9 ? 2 : 1);
  }

  function jaccard(a, b) {
    const ta = new Set(chaveSimples(a).split(" ").filter(Boolean));
    const tb = new Set(chaveSimples(b).split(" ").filter(Boolean));
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    ta.forEach((t) => { if (tb.has(t)) inter++; });
    return inter / (ta.size + tb.size - inter);
  }

  function textoMaisFrequente(mapaContagem) {
    let melhor = null, n = -1;
    mapaContagem.forEach((qtd, texto) => { if (qtd > n) { n = qtd; melhor = texto; } });
    return melhor;
  }

  // ------------------------------------------------------------------- analise
  // Revisao de grafias da hierarquia (V 1.10): dentro do MESMO pai, nomes parecidos
  // ("Operador de Maquina" x "Operador de Máquinas") sao agrupados; o usuario escolhe
  // qual grafia vale (padrao: a ja cadastrada no sistema, senao a mais frequente na planilha).
  // Percorre os niveis de cima para baixo, de modo que a escolha de um nivel vale para os filhos.
  function resolverGrafias(cascCampos, lidas, ctx, escolhas) {
    const grupos = [];
    const canon = lidas.map(() => []);
    cascCampos.forEach((c, nivelIdx) => {
      const baldes = new Map();
      lidas.forEach((l, i) => {
        const v = l.valores[c.campo];
        if (v == null || canon[i].length !== nivelIdx) return;
        // Nomes parecidos sao comparados entre TODOS os lugares do mesmo Cliente (um cargo escrito
        // de dois jeitos em postos diferentes quebra filtros e graficos); o Cliente em si, entre todos.
        const chavePai = nivelIdx === 0 ? "" : norm(canon[i][0]);
        let b = baldes.get(chavePai);
        if (!b) {
          const atuais = {};
          if (nivelIdx > 0) atuais[cascCampos[0].campo] = canon[i][0];
          b = { atuais, pai: nivelIdx > 0 ? [canon[i][0]] : [], itens: new Map() };
          baldes.set(chavePai, b);
        }
        const n = norm(v);
        let it = b.itens.get(n);
        if (!it) { it = { norma: n, textos: new Map(), existente: false, texto: null }; b.itens.set(n, it); }
        it.textos.set(v, (it.textos.get(v) || 0) + 1);
      });

      baldes.forEach((b, chavePai) => {
        const itens = Array.from(b.itens.values());
        const existentes = (ctx.opcoesCascata && ctx.opcoesCascata(c.campo, Object.assign({}, b.atuais))) || [];
        b.mapaExist = new Map(existentes.map((t) => [norm(t), t]));
        const todos = itens.map((it) => { it.texto = textoMaisFrequente(it.textos); return it; });
        existentes.forEach((t) => {
          const achado = todos.find((it) => it.norma === norm(t));
          if (achado) { achado.existente = true; achado.texto = t; }
          else todos.push({ norma: norm(t), textos: new Map(), existente: true, texto: t, soSistema: true });
        });
        // agrupamento por parecenca (uniao simples)
        const pai = todos.map((_, i) => i);
        const raiz = (i) => { while (pai[i] !== i) { pai[i] = pai[pai[i]]; i = pai[i]; } return i; };
        for (let i = 0; i < todos.length; i++) {
          for (let j = i + 1; j < todos.length; j++) {
            if (todos[i].soSistema && todos[j].soSistema) continue;
            if (similares(todos[i].texto, todos[j].texto)) pai[raiz(i)] = raiz(j);
          }
        }
        const clusters = new Map();
        todos.forEach((it, i) => { const r = raiz(i); if (!clusters.has(r)) clusters.set(r, []); clusters.get(r).push(it); });
        const substituicoes = new Map(); // norma -> texto final
        clusters.forEach((membros) => {
          if (membros.length < 2 || !membros.some((m) => !m.soSistema)) return;
          const chave = c.campo + "|" + chavePai + "|" + membros.map((m) => m.norma).sort().join("~");
          const comExistente = membros.find((m) => m.existente);
          const maisFreq = membros.filter((m) => !m.soSistema).sort((x, y) => {
            const nx = Array.from(x.textos.values()).reduce((s, q) => s + q, 0);
            const ny = Array.from(y.textos.values()).reduce((s, q) => s + q, 0);
            return ny - nx;
          })[0];
          const padrao = (comExistente || maisFreq).texto;
          let escolha = escolhas[chave];
          const textosValidos = membros.map((m) => m.texto);
          if (escolha !== "__separados__" && textosValidos.indexOf(escolha) === -1) escolha = padrao;
          grupos.push({
            chave, nivel: c.campo, pai: b.pai.join(" › "), escolha, padrao,
            variantes: membros.map((m) => ({
              texto: m.texto, existente: m.existente,
              linhas: Array.from(m.textos.values()).reduce((s, q) => s + q, 0),
            })),
          });
          if (escolha !== "__separados__") membros.forEach((m) => { if (m.norma !== norm(escolha)) substituicoes.set(m.norma, escolha); });
        });

        lidas.forEach((l, i) => {
          const v = l.valores[c.campo];
          if (v == null || canon[i].length !== nivelIdx || (nivelIdx === 0 ? "" : norm(canon[i][0])) !== chavePai) return;
          const n = norm(v);
          if (substituicoes.has(n)) {
            l.valores[c.campo] = substituicoes.get(n);
            if (l.marcas.indexOf("grafia") === -1) l.marcas.push("grafia");
          }
        });
      });

      lidas.forEach((l, i) => {
        let v = l.valores[c.campo];
        if (v == null || canon[i].length !== nivelIdx) return;
        // grafia do cadastro existente tem prioridade (mesmo texto, so caixa/pontuacao diferentes)
        const b = baldes.get(nivelIdx === 0 ? "" : norm(canon[i][0]));
        const doCadastro = b && b.mapaExist.get(norm(v));
        if (doCadastro) { v = doCadastro; l.valores[c.campo] = v; }
        canon[i].push(v);
      });
    });
    return grupos;
  }

  // Valores de lista que nao batem exatamente (ex.: "Leve" x "Baixa", fator com redacao
  // diferente): resolve por sinonimo, equivalencia automatica ou escolha manual do usuario.
  function resolverCorrespondencia(def, ctx, campo, bruto, valores, escolhas, registro) {
    const C = def.correspondencia;
    const o = C.opcoesDe(campo, valores, ctx) || {};
    const opcoes = o.opcoes || [];
    const texto = String(bruto).trim();
    if (!opcoes.length) return { valor: texto };
    const nb = norm(texto);
    const exata = opcoes.find((x) => norm(x) === nb);
    if (exata != null) return { valor: exata };
    const chave = campo + "|" + (o.contexto || "") + "|" + nb;
    let reg = registro.get(chave);
    if (!reg) {
      reg = { chave, campo, bruto: texto, contexto: o.contexto || "", opcoes, linhas: 0, escolhido: "", origem: "nenhuma" };
      const manual = escolhas[chave];
      if (manual !== undefined) {
        reg.escolhido = manual && opcoes.indexOf(manual) !== -1 ? manual : "";
        reg.origem = reg.escolhido ? "manual" : "rejeitar";
      } else {
        const sin = C.sinonimos && C.sinonimos[campo] && C.sinonimos[campo][nb];
        if (sin && opcoes.indexOf(sin) !== -1) { reg.escolhido = sin; reg.origem = "sinonimo"; }
        else {
          const cs = chaveSimples(texto);
          const igual = opcoes.find((x) => chaveSimples(x) === cs);
          if (igual != null) { reg.escolhido = igual; reg.origem = "equivalente"; }
          else {
            let melhor = null, nota = 0;
            opcoes.forEach((x) => { const j = jaccard(texto, x); if (j > nota) { nota = j; melhor = x; } });
            if (melhor != null && nota >= 0.75) { reg.escolhido = melhor; reg.origem = "sugerida"; }
          }
        }
      }
      registro.set(chave, reg);
    }
    reg.linhas++;
    if (reg.escolhido) return { valor: reg.escolhido };
    return { erro: `“${texto}” não corresponde a nenhuma opção válida — defina o equivalente em “Correspondência de valores”` };
  }

  function assinaturaDe(valores, campos) {
    return campos.map((k) => {
      const v = valores[k];
      return v == null ? "" : norm(Array.isArray(v) ? v.join(";") : String(v));
    }).join("¦");
  }

  // Devolve { itens, resumo, grafias, correspondencias, plano, padroesUsados }.
  // Cada item: { numero, valores, erros[], avisos[], marcas[], acao: "novo"|"atualiza"|"igual"|"erro"|"ignorada"|"pulada",
  // existenteId, mudancas[], criar[], dup, decisao }.
  //   opcoes: { atualizar, criarAusentes, padroes, grafias, correspondencias, decisoes }
  function analisar(def, ctx, tabela, mapa, opcoes) {
    opcoes = opcoes || {};
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

    const H = ctx.hierarquia || null;
    const permitirCriar = !!(H && opcoes.criarAusentes);
    const cascCampos = ctx.opcoesCascata ? campos.filter((c) => c.tipo === "cascata") : [];
    const padroesCfg = def.padroes || [];
    const padroesUsados = {};
    const D = def.duplicidade || null;
    const registroCorr = new Map();
    const novos = new Map();

    // ---- passo 1: ler e converter cada linha (sem olhar o cadastro ainda)
    const lidas = tabela.linhas.slice(0, MAX_LINHAS).map((linha) => {
      const valores = {};
      const erros = [];
      const l = { linha, valores, erros, avisos: [], marcas: [], padroesDe: [] };
      campos.forEach((c) => {
        const idx = mapa[c.campo];
        if (idx == null || idx < 0) return;
        const r = converterCampo(c, limparBruto(linha.celulas[idx], def));
        if (r.erro) erros.push(`${rotuloDe(def, c)}: ${r.erro}`);
        else if (r.vazio) valores[c.campo] = null;
        else valores[c.campo] = r.valor;
      });
      // valores padrao para o que a planilha nao traz (ex.: sistema anterior sem "Atividade" ou data)
      padroesCfg.forEach((p) => {
        if (valores[p.campo] != null && valores[p.campo] !== "") return;
        const bruto = opcoes.padroes ? opcoes.padroes[p.campo] : null;
        if (bruto == null || String(bruto).trim() === "") return;
        const c = campos.find((x) => x.campo === p.campo);
        if (!c) return;
        const r = converterCampo(c, bruto);
        if (r.valor != null) {
          valores[p.campo] = r.valor;
          l.padroesDe.push(p.campo);
          padroesUsados[p.campo] = (padroesUsados[p.campo] || 0) + 1;
          // um padrao preenche tambem o erro "obrigatorio e vazio" que ele resolve
        }
      });
      return l;
    });

    // ---- passo 2: grafias parecidas na hierarquia
    const grafias = cascCampos.length ? resolverGrafias(cascCampos, lidas, ctx, opcoes.grafias || {}) : [];

    // ---- passo 3: validar cada linha, resolver a hierarquia (criando o que falta) e duplicidades
    const vistosDup = new Map();
    const indiceDupExistentes = new Map();
    const camposDup = D ? D.campos : [];
    const camposAssin = D ? campos.map((c) => c.campo).filter((k) => (D.ignorarNaAssinatura || []).indexOf(k) === -1 && camposDup.indexOf(k) === -1) : [];
    if (D) existentes.forEach((l) => { const k = assinaturaDe(l, camposDup); if (!indiceDupExistentes.has(k)) indiceDupExistentes.set(k, []); indiceDupExistentes.get(k).push(l); });

    lidas.forEach((lida) => {
      const { linha, valores, erros, avisos, marcas } = lida;
      const errosCriacao = [];
      const criar = [];

      // Hierarquia (Cliente > Unidade > Setor > ...): cada nivel precisa existir dentro do
      // anterior (o texto e padronizado para a grafia cadastrada). O que nao existir pode
      // ser criado automaticamente, se o usuario marcar essa opcao.
      if (cascCampos.length) {
        const atuais = {};
        const norms = [];
        let semPai = false; // um nivel acima nao existe: os de baixo tambem nao existem
        let parou = false;
        cascCampos.forEach((c) => {
          if (parou) return;
          const v = valores[c.campo];
          if (v == null) return;
          const lista = semPai ? [] : (ctx.opcoesCascata(c.campo, Object.assign({}, atuais)) || []);
          const ach = lista.find((o) => norm(o) === norm(v));
          if (ach != null) {
            valores[c.campo] = ach;
            atuais[c.campo] = ach;
            norms.push(norm(ach));
            return;
          }
          const nivelAnterior = Object.keys(atuais).pop();
          const ondeEstaria = nivelAnterior ? ` em ${nivelAnterior} “${atuais[nivelAnterior]}”` : "";
          if (!H) {
            erros.push(`${rotuloDe(def, c)}: “${v}” não está cadastrado${ondeEstaria}`);
            parou = true;
            return;
          }
          if (H.podeCriar && !H.podeCriar(c.campo)) {
            erros.push(`${rotuloDe(def, c)}: “${v}” não está cadastrado${ondeEstaria}. Só um Administrador pode criar este cadastro`);
            parou = true;
            return;
          }
          semPai = true;
          const chaveNo = c.campo + ":" + norms.concat([norm(v)]).join("|");
          let no = novos.get(chaveNo);
          if (!no) {
            no = { chave: chaveNo, nivel: c.campo, texto: v, dados: Object.assign({}, atuais, { [c.campo]: v }), pais: criar.slice(), linhas: [] };
            novos.set(chaveNo, no);
          }
          no.linhas.push(linha.numero);
          valores[c.campo] = no.texto;
          atuais[c.campo] = no.texto;
          norms.push(norm(no.texto));
          criar.push(chaveNo);
          errosCriacao.push(`${rotuloDe(def, c)}: “${no.texto}” não está cadastrado${ondeEstaria}`);
        });
      }

      // Valores de lista (Grupo, Fator, escala da matriz...) com correspondencia revisavel.
      if (def.correspondencia && !erros.length) {
        campos.forEach((c) => {
          if (def.correspondencia.campos.indexOf(c.campo) === -1) return;
          const v = valores[c.campo];
          if (v == null || v === "") return;
          const jaTemErro = erros.some((e) => e.indexOf(rotuloDe(def, c) + ":") === 0);
          if (jaTemErro) return;
          const r = resolverCorrespondencia(def, ctx, c.campo, v, valores, opcoes.correspondencias || {}, registroCorr);
          if (r.erro) erros.push(`${rotuloDe(def, c)}: ${r.erro}`);
          else valores[c.campo] = r.valor;
        });
      }

      campos.forEach((c) => {
        if (!c.obrigatorio) return;
        const idx = mapa[c.campo];
        const semColuna = idx == null || idx < 0;
        if (semColuna && lida.padroesDe.indexOf(c.campo) === -1) return; // coluna ausente: avisado no resumo geral
        const v = valores[c.campo];
        const vazio = v == null || v === "" || (Array.isArray(v) && !v.length);
        const jaTemErro = erros.some((e) => e.indexOf(rotuloDe(def, c) + ":") === 0);
        if (vazio && !jaTemErro) erros.push(`${rotuloDe(def, c)}: obrigatório e vazio`);
      });

      const base = Object.assign({}, valores);
      if (def.validarLinha && !erros.length) {
        const extra = def.validarLinha(valores, ctx) || {};
        (extra.erros || []).forEach((e) => erros.push(e));
        (extra.avisos || []).forEach((a) => avisos.push(a));
        (extra.marcas || []).forEach((m) => { if (marcas.indexOf(m) === -1) marcas.push(m); });
        if (extra.valores) Object.assign(valores, extra.valores);
      }

      // Falta cadastro e o usuario ainda nao autorizou a criacao: a linha fica pendente.
      let soCriacao = false;
      if (errosCriacao.length && !permitirCriar) {
        soCriacao = !erros.length;
        errosCriacao.forEach((e) => erros.push(e));
      }

      const item = {
        numero: linha.numero, celulas: linha.celulas, valores, erros, avisos, marcas, acao: "novo", existenteId: null,
        mudancas: [], criar, soCriacao, dup: null, decisao: null, padroesDe: lida.padroesDe,
      };

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

      // Duplicidade (so quando o cadastro declara "duplicidade"): mesma chave dentro do
      // arquivo ou ja gravada no sistema. Identicas = "exata" (padrao: pular); mesma chave
      // mas conteudo diferente = "provavel" (padrao: importar, o usuario revisa).
      if (D && !item.erros.length && !chaveNatural.length) {
        const k = assinaturaDe(valores, camposDup);
        const sig = assinaturaDe(base, camposAssin);
        const anterior = vistosDup.get(k);
        const noSistema = indiceDupExistentes.get(k) || [];
        const igualNoSistema = noSistema.find((e) => assinaturaDe(e, camposAssin) === sig);
        if (!anterior) vistosDup.set(k, { numero: linha.numero, sig, base });
        let outro = null;
        // 1) identica a algo que ja esta no SIGE; 2) repete uma linha anterior do arquivo;
        // 3) mesma chave de um registro do SIGE, mas com conteudo diferente.
        if (igualNoSistema) outro = { onde: "sistema", ref: igualNoSistema._id, sig, valores: igualNoSistema };
        else if (anterior) outro = { onde: "arquivo", ref: anterior.numero, sig: anterior.sig, valores: anterior.base };
        else if (noSistema.length) outro = { onde: "sistema", ref: noSistema[0]._id, sig: assinaturaDe(noSistema[0], camposAssin), valores: noSistema[0] };
        if (outro) {
          const exata = outro.sig === sig;
          const difere = exata ? [] : camposAssin.filter((kk) => assinaturaDe(outro.valores, [kk]) !== assinaturaDe(base, [kk]))
            .map((kk) => { const cc = campos.find((x) => x.campo === kk); return cc ? rotuloDe(def, cc) : kk; });
          item.dup = { onde: outro.onde, ref: outro.ref, exata, difere };
          const escolhida = opcoes.decisoes && opcoes.decisoes[linha.numero];
          item.decisao = escolhida || (exata || outro.onde === "sistema" ? "pular" : "importar");
        }
      }

      if (item.erros.length) item.acao = "erro";
      else if (item.dup && item.decisao === "pular") item.acao = "pulada";
      else if (item.acao === "atualiza" && opcoes.atualizar === false) item.acao = "ignorada";
      itens.push(item);
    });

    // ---- plano de criacao de cadastros (so o que as linhas gravaveis realmente usam)
    function planoDe(filtro) {
      const usados = new Set();
      itens.filter(filtro).forEach((i) => i.criar.forEach((k) => usados.add(k)));
      const niveis = {};
      let total = 0;
      novos.forEach((no) => {
        if (!usados.has(no.chave)) return;
        (niveis[no.nivel] = niveis[no.nivel] || []).push(no);
        total++;
      });
      return { niveis, total };
    }
    const plano = planoDe((i) => !i.erros.length && (i.acao === "novo" || i.acao === "atualiza"));
    const pendente = planoDe((i) => i.soCriacao || (!i.erros.length && i.criar.length));

    const resumo = { total: itens.length, novo: 0, atualiza: 0, igual: 0, erro: 0, ignorada: 0, pulada: 0, duplicadas: 0, aguardaCadastro: 0, marcas: {}, excedeu: tabela.linhas.length > MAX_LINHAS };
    itens.forEach((i) => {
      resumo[i.acao] = (resumo[i.acao] || 0) + 1;
      if (i.dup) resumo.duplicadas++;
      if (i.soCriacao) resumo.aguardaCadastro++;
      i.marcas.forEach((m) => { resumo.marcas[m] = (resumo.marcas[m] || 0) + 1; });
    });
    const correspondencias = Array.from(registroCorr.values()).filter((r) => r.origem !== "sinonimo")
      .sort((a, b) => (a.escolhido ? 1 : 0) - (b.escolhido ? 1 : 0) || a.campo.localeCompare(b.campo) || a.bruto.localeCompare(b.bruto));
    return { itens, resumo, grafias, correspondencias, plano, pendente, padroesUsados };
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

  // -------------------------------------------------------- relatorio de revisao
  const MARCAS_PADRAO = { grafia: { chip: "nomes unificados", rotulo: "Nome unificado (grafia parecida)" } };
  const NIVEL_PLURAL = { Cliente: "clientes", Unidade: "unidades", Setor: "setores", "Posto Trabalho": "postos de trabalho", Cargo: "cargos", Atividade: "atividades" };
  const NIVEL_SINGULAR = { Cliente: "cliente", Unidade: "unidade", Setor: "setor", "Posto Trabalho": "posto de trabalho", Cargo: "cargo", Atividade: "atividade" };

  function ordemNiveis(ctx) {
    return (ctx.hierarquia && ctx.hierarquia.niveis) || ["Cliente", "Unidade", "Setor", "Posto Trabalho", "Cargo", "Atividade"];
  }

  function textoPlano(plano, ctx) {
    const partes = [];
    ordemNiveis(ctx).forEach((n) => {
      const q = (plano.niveis[n] || []).length;
      if (q) partes.push(`${q} ${q === 1 ? NIVEL_SINGULAR[n] || n : NIVEL_PLURAL[n] || n}`);
    });
    return partes.join(", ");
  }

  function descricaoDup(i) {
    if (!i.dup) return "";
    const onde = i.dup.onde === "sistema" ? "já existe no SIGE" : `mesma chave da linha ${i.dup.ref}`;
    if (i.dup.exata) return i.dup.onde === "sistema" ? "Idêntica a um registro que já existe no SIGE" : `Idêntica à linha ${i.dup.ref}`;
    return `Parecida: ${onde}, mas difere em ${i.dup.difere.join(", ") || "outros campos"}`;
  }

  function baixarRelatorioRevisao(def, ctx, estado) {
    const a = estado.analise;
    const wb = global.XLSX.utils.book_new();
    function aba(nome, linhas) {
      const w = aoa(linhas);
      largurasColunas(w, linhas);
      global.XLSX.utils.book_append_sheet(wb, w, nome);
    }
    const r = a.resumo;
    aba("Resumo", [
      [`Relatório de revisão da importação – ${def.titulo}`],
      ["Arquivo", estado.nomeArquivo],
      ["Linhas lidas", r.total], ["Novos", r.novo], ["Atualizações", r.atualiza], ["Sem alteração", r.igual],
      ["Duplicadas", r.duplicadas], ["Puladas", r.pulada], ["Com erro", r.erro],
    ]);
    const dups = a.itens.filter((i) => i.dup);
    if (dups.length) aba("Duplicadas", [["Linha", "Tipo", "Onde", "Referência", "Decisão", "Difere em"]].concat(dups.map((i) => [
      i.numero, i.dup.exata ? "Idêntica" : "Parecida", i.dup.onde === "sistema" ? "Já no SIGE" : "Neste arquivo",
      i.dup.onde === "sistema" ? String(i.dup.ref) : `linha ${i.dup.ref}`, i.decisao === "pular" ? "Pular" : "Importar", i.dup.difere.join("; "),
    ])));
    if (a.grafias.length) aba("Grafias", [["Nível", "Dentro de", "Grafia adotada", "Variantes"]].concat(a.grafias.map((g) => [
      g.nivel, g.pai, g.escolha === "__separados__" ? "(mantidas separadas)" : g.escolha, g.variantes.map((v) => `${v.texto} (${v.linhas} linhas${v.existente ? ", já cadastrado" : ""})`).join(" | "),
    ])));
    if (a.correspondencias.length) aba("Correspondências", [["Campo", "Valor na planilha", "Equivalente no SIGE", "Linhas", "Origem"]].concat(a.correspondencias.map((c) => [
      c.campo, c.bruto, c.escolhido || "(rejeitar linhas)", c.linhas, c.origem,
    ])));
    const plano = estado.criarAusentes ? a.plano : a.pendente;
    if (plano.total) {
      const linhas = [["Nível", "Nome", "Dentro de", "Linhas da planilha"]];
      ordemNiveis(ctx).forEach((n) => (plano.niveis[n] || []).forEach((no) => {
        const pai = Object.keys(no.dados).filter((k) => k !== n).map((k) => no.dados[k]).join(" › ");
        linhas.push([n, no.texto, pai, no.linhas.slice(0, 20).join(", ") + (no.linhas.length > 20 ? "…" : "")]);
      }));
      aba(estado.criarAusentes ? "Cadastros a criar" : "Cadastros que faltam", linhas);
    }
    const rej = a.itens.filter((i) => i.acao === "erro");
    if (rej.length) aba("Rejeitadas", [["Linha", "Motivo"]].concat(rej.map((i) => [i.numero, i.erros.join(" | ")])));
    baixarArquivoXlsx(wb, `revisao-${def.arquivo || "dados"}.xlsx`);
  }

  // ------------------------------------------------------------------------- UI
  function abrir(def, ctx) {
    if (document.getElementById("imp-overlay")) return;
    const H = ctx.hierarquia || null;
    const MARCAS = Object.assign({}, MARCAS_PADRAO, def.marcas || {});
    const padroesIniciais = () => {
      const p = {};
      (def.padroes || []).forEach((x) => { p[x.campo] = typeof x.sugestao === "function" ? x.sugestao() : (x.sugestao || ""); });
      return p;
    };
    const estado = {
      wb: null, nomeArquivo: "", aba: "", tabela: null, mapa: {}, analise: null, atualizar: true, gravando: false,
      criarAusentes: false, padroes: padroesIniciais(), correspondencias: {}, grafias: {}, decisoes: {}, filtro: "todas", abertos: {},
    };

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

    function painel(chave, titulo, abertoPadrao, classe) {
      const det = document.createElement("details");
      det.className = "imp-painel " + (classe || "");
      det.open = estado.abertos[chave] != null ? estado.abertos[chave] : abertoPadrao;
      det.appendChild(el("summary", null, titulo));
      det.addEventListener("toggle", () => { estado.abertos[chave] = det.open; });
      return det;
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
        estado.criarAusentes = false;
        estado.correspondencias = {};
        estado.grafias = {};
        estado.decisoes = {};
        estado.filtro = "todas";
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
      estado.analise = analisar(def, ctx, estado.tabela, estado.mapa, {
        atualizar: estado.atualizar, criarAusentes: estado.criarAusentes, padroes: estado.padroes,
        grafias: estado.grafias, correspondencias: estado.correspondencias, decisoes: estado.decisoes,
      });
      telaPrevia();
    }

    function temPadrao(c) {
      return (def.padroes || []).some((p) => p.campo === c.campo) && String(estado.padroes[c.campo] || "").trim() !== "";
    }

    function faltantesObrigatorias() {
      return camposImportaveis(def).filter((c) => c.obrigatorio && (estado.mapa[c.campo] == null || estado.mapa[c.campo] < 0) && !temPadrao(c));
    }

    function rotuloCampo(k) {
      const c = def.campos.find((x) => x.campo === k);
      return c ? rotuloDe(def, c) : k;
    }

    // ---------- blocos da previa (V 1.10)
    function blocoPadroes() {
      const bloco = el("div", "imp-bloco");
      bloco.appendChild(el("div", "imp-bloco-titulo", "Valores padrão para o que a planilha não informa"));
      bloco.appendChild(el("div", "imp-bloco-nota", "Usados somente quando a coluna não existe na planilha ou a célula está vazia. Você pode editar."));
      const grade = el("div", "imp-grade-padroes");
      def.padroes.forEach((p) => {
        const campo = def.campos.find((x) => x.campo === p.campo);
        const id = "imp-padrao-" + p.campo.replace(/[^a-z0-9]/gi, "");
        grade.appendChild(Object.assign(el("label", "imp-mapa-rotulo", p.rotulo || rotuloCampo(p.campo)), { htmlFor: id }));
        const inp = document.createElement("input");
        inp.id = id;
        inp.className = "imp-entrada";
        inp.type = campo && campo.tipo === "data" ? "date" : "text";
        inp.value = estado.padroes[p.campo] || "";
        inp.addEventListener("change", () => { estado.padroes[p.campo] = inp.value; reanalisar(); });
        grade.appendChild(inp);
        const usados = estado.analise.padroesUsados[p.campo] || 0;
        grade.appendChild(el("div", "imp-padrao-uso", usados ? `usado em ${usados} ${usados === 1 ? "linha" : "linhas"}` : "não necessário"));
      });
      bloco.appendChild(grade);
      return bloco;
    }

    function listaNos(plano) {
      const t = el("table", "imp-tabela imp-tabela-simples");
      const th = document.createElement("thead");
      const trh = document.createElement("tr");
      ["Nível", "Nome", "Dentro de", "Linhas"].forEach((x) => trh.appendChild(el("th", null, x)));
      th.appendChild(trh);
      t.appendChild(th);
      const tb = document.createElement("tbody");
      let n = 0;
      ordemNiveis(ctx).forEach((nivel) => (plano.niveis[nivel] || []).forEach((no) => {
        if (n++ >= 400) return;
        const tr = document.createElement("tr");
        tr.appendChild(el("td", null, nivel));
        tr.appendChild(el("td", null, no.texto));
        tr.appendChild(el("td", null, Object.keys(no.dados).filter((k) => k !== nivel).map((k) => no.dados[k]).join(" › ")));
        tr.appendChild(el("td", null, String(no.linhas.length)));
        tb.appendChild(tr);
      }));
      t.appendChild(tb);
      const caixa = el("div", "imp-tabela-scroll imp-tabela-curta");
      caixa.appendChild(t);
      return caixa;
    }

    function blocoCadastros() {
      const a = estado.analise;
      if (!H) return null;
      if (estado.criarAusentes) {
        if (!a.plano.total) return null;
        const bloco = el("div", "imp-bloco imp-bloco-ok");
        bloco.appendChild(el("div", "imp-bloco-titulo", "Cadastros que serão criados automaticamente"));
        bloco.appendChild(el("div", "imp-bloco-nota", textoPlano(a.plano, ctx) + ". Serão criados antes dos registros, na ordem da hierarquia, e já ficam disponíveis no Cadastro."));
        const det = painel("nos", "Ver a lista do que será criado", false);
        det.appendChild(listaNos(a.plano));
        bloco.appendChild(det);
        bloco.appendChild(botao("Não criar (rejeitar linhas sem cadastro)", "btn-cad-secundario", () => { estado.criarAusentes = false; reanalisar(); }));
        return bloco;
      }
      if (!a.pendente.total) return null;
      const bloco = el("div", "imp-bloco imp-bloco-aviso");
      bloco.appendChild(el("div", "imp-bloco-titulo", `${a.resumo.aguardaCadastro} ${a.resumo.aguardaCadastro === 1 ? "linha aponta" : "linhas apontam"} para cadastros que ainda não existem`));
      bloco.appendChild(el("div", "imp-bloco-nota", "Faltam: " + textoPlano(a.pendente, ctx) + ". Você pode criá-los automaticamente a partir da planilha, na hierarquia Cliente > Unidade > Setor > Posto de Trabalho > Cargo > Atividade."));
      const det = painel("nos", "Ver a lista do que seria criado", false);
      det.appendChild(listaNos(a.pendente));
      bloco.appendChild(det);
      bloco.appendChild(botao("Criar automaticamente os cadastros que faltam", "btn-cad-primario", () => { estado.criarAusentes = true; reanalisar(); }));
      return bloco;
    }

    const ROT_ORIGEM = { equivalente: "equivalente automático", sugerida: "sugestão do sistema", nenhuma: "sem equivalente", manual: "escolhido por você", rejeitar: "linhas rejeitadas" };

    function blocoCorrespondencias() {
      const lista = estado.analise.correspondencias;
      if (!lista.length) return null;
      const pend = lista.filter((c) => !c.escolhido).length;
      const det = painel("corr", `Correspondência de valores (${lista.length} ${lista.length === 1 ? "valor difere" : "valores diferem"} da lista do SIGE${pend ? `, ${pend} sem equivalente` : ""})`, pend > 0, pend ? "imp-painel-aviso" : "");
      det.appendChild(el("div", "imp-bloco-nota", "Estes textos da planilha não são iguais aos do SIGE. Confira o equivalente sugerido ou escolha outro. Linhas sem equivalente são rejeitadas."));
      const t = el("table", "imp-tabela imp-tabela-simples");
      const th = document.createElement("thead");
      const trh = document.createElement("tr");
      ["Campo", "Na planilha", "Linhas", "Equivalente no SIGE"].forEach((x) => trh.appendChild(el("th", null, x)));
      th.appendChild(trh);
      t.appendChild(th);
      const tb = document.createElement("tbody");
      lista.forEach((c) => {
        const tr = document.createElement("tr");
        tr.appendChild(el("td", null, rotuloCampo(c.campo)));
        tr.appendChild(el("td", null, c.bruto));
        tr.appendChild(el("td", null, String(c.linhas)));
        const td = document.createElement("td");
        const sel = document.createElement("select");
        sel.className = "imp-sel-corr";
        sel.setAttribute("aria-label", "Equivalente de " + c.bruto);
        const o0 = document.createElement("option"); o0.value = ""; o0.textContent = "— rejeitar estas linhas —"; sel.appendChild(o0);
        c.opcoes.forEach((o) => { const op = document.createElement("option"); op.value = o; op.textContent = o; sel.appendChild(op); });
        sel.value = c.escolhido || "";
        sel.addEventListener("change", () => { estado.correspondencias[c.chave] = sel.value; reanalisar(); });
        td.appendChild(sel);
        td.appendChild(el("span", "imp-origem imp-origem-" + c.origem, ROT_ORIGEM[c.origem] || c.origem));
        tr.appendChild(td);
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      const caixa = el("div", "imp-tabela-scroll imp-tabela-curta");
      caixa.appendChild(t);
      det.appendChild(caixa);
      return det;
    }

    function blocoGrafias() {
      const g = estado.analise.grafias;
      if (!g.length) return null;
      const det = painel("graf", `Revisão de nomes parecidos (${g.length} ${g.length === 1 ? "grupo" : "grupos"})`, true, "imp-painel-aviso");
      det.appendChild(el("div", "imp-bloco-nota", "Estes nomes parecem ser a mesma coisa escrita de formas diferentes. Escolha qual vale (as linhas passam a usar essa grafia) ou mantenha separados. Números e algarismos romanos nunca são unificados."));
      g.forEach((grupo, gi) => {
        const caixa = el("div", "imp-grupo-grafia");
        caixa.appendChild(el("div", "imp-grupo-titulo", `${NIVEL_SINGULAR[grupo.nivel] ? NIVEL_SINGULAR[grupo.nivel][0].toUpperCase() + NIVEL_SINGULAR[grupo.nivel].slice(1) : grupo.nivel}${grupo.pai ? " em " + grupo.pai : ""}`));
        const nome = "imp-graf-" + gi;
        grupo.variantes.forEach((v) => {
          const rot = el("label", "imp-opcao-graf");
          const r = document.createElement("input");
          r.type = "radio"; r.name = nome; r.checked = grupo.escolha === v.texto;
          r.addEventListener("change", () => { estado.grafias[grupo.chave] = v.texto; reanalisar(); });
          rot.appendChild(r);
          rot.appendChild(document.createTextNode(` ${v.texto}`));
          rot.appendChild(el("span", "imp-origem", (v.existente ? "já cadastrado · " : "") + (v.linhas ? `${v.linhas} ${v.linhas === 1 ? "linha" : "linhas"}` : "")));
          caixa.appendChild(rot);
        });
        const rot = el("label", "imp-opcao-graf");
        const r = document.createElement("input");
        r.type = "radio"; r.name = nome; r.checked = grupo.escolha === "__separados__";
        r.addEventListener("change", () => { estado.grafias[grupo.chave] = "__separados__"; reanalisar(); });
        rot.appendChild(r);
        rot.appendChild(document.createTextNode(" Manter separados"));
        caixa.appendChild(rot);
        det.appendChild(caixa);
      });
      return det;
    }

    // ---------- Etapa 2: previa
    function telaPrevia() {
      const rolagem = corpo.scrollTop;
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
      if (def.duplicidade) {
        chip("duplicadas", r.duplicadas, r.duplicadas ? "alerta" : "neutro");
        chip("puladas", r.pulada, "neutro");
      }
      Object.keys(MARCAS).forEach((m) => { if (r.marcas[m]) chip(MARCAS[m].chip || MARCAS[m].rotulo || m, r.marcas[m], "alerta"); });
      if (H && estado.criarAusentes && a.plano.total) chip("cadastros a criar", a.plano.total, "info");
      chip("com erro", r.erro, r.erro ? "erro" : "neutro");
      corpo.appendChild(chips);

      if (def.avisoPlanilha && estado.tabela) {
        let msgAviso = null;
        try { msgAviso = def.avisoPlanilha(estado.tabela.cabecalhos.map(norm)); } catch (e) { msgAviso = null; }
        if (msgAviso) corpo.appendChild(el("div", "imp-aviso-planilha", msgAviso));
      }
      if (r.excedeu) corpo.appendChild(el("div", "imp-erro", `A planilha tem mais de ${MAX_LINHAS} linhas; somente as primeiras ${MAX_LINHAS} foram lidas. Divida o arquivo em partes.`));
      if (faltam.length) {
        corpo.appendChild(el("div", "imp-erro", "Colunas obrigatórias não encontradas na planilha: " + faltam.map((c) => rotuloDe(def, c)).join(", ") + ". Ajuste o mapeamento de colunas abaixo ou use o modelo."));
      }

      if ((def.padroes || []).length) corpo.appendChild(blocoPadroes());
      const bCad = blocoCadastros();
      if (bCad) corpo.appendChild(bCad);
      const bGraf = blocoGrafias();
      if (bGraf) corpo.appendChild(bGraf);
      const bCorr = blocoCorrespondencias();
      if (bCorr) corpo.appendChild(bCorr);

      // Mapeamento de colunas (recolhido por padrao quando tudo foi reconhecido)
      const det = painel("mapa", "Ajustar colunas (mapeamento)", faltam.length > 0);
      if (faltam.length) det.open = true;
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
      det.classList.add("imp-mapeamento");
      corpo.appendChild(det);

      const opcoes = el("label", "imp-opcao");
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = estado.atualizar;
      chk.addEventListener("change", () => { estado.atualizar = chk.checked; reanalisar(); });
      opcoes.appendChild(chk);
      opcoes.appendChild(document.createTextNode(" Atualizar registros que já existem (mesma " + (rotulosChave(def).join(" + ") || "chave") + ")"));
      if ((def.chaveNatural || []).length) corpo.appendChild(opcoes);

      // Filtro e acoes em bloco sobre duplicadas
      const barra = el("div", "imp-barra-filtro");
      const selF = document.createElement("select");
      selF.className = "imp-filtro";
      selF.setAttribute("aria-label", "Filtrar linhas da prévia");
      const filtros = [["todas", "Mostrar: todas as linhas"], ["erros", "Somente com erro"], ["avisos", "Somente com aviso"]];
      if (def.duplicidade) filtros.push(["duplicadas", "Somente duplicadas"]);
      if (H) filtros.push(["criar", "Somente as que criam cadastros"]);
      Object.keys(MARCAS).forEach((m) => { if (r.marcas[m]) filtros.push(["marca:" + m, "Somente: " + (MARCAS[m].rotulo || m)]); });
      filtros.forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; if (v === estado.filtro) o.selected = true; selF.appendChild(o); });
      selF.addEventListener("change", () => { estado.filtro = selF.value; telaPrevia(); });
      barra.appendChild(selF);
      if (def.duplicidade && r.duplicadas) {
        barra.appendChild(botao("Pular todas as duplicadas", "btn-cad-secundario", () => { a.itens.forEach((i) => { if (i.dup) estado.decisoes[i.numero] = "pular"; }); reanalisar(); }));
        barra.appendChild(botao("Importar todas as duplicadas", "btn-cad-secundario", () => { a.itens.forEach((i) => { if (i.dup) estado.decisoes[i.numero] = "importar"; }); reanalisar(); }));
        barra.appendChild(botao("Restaurar sugestão", "btn-cad-secundario", () => { estado.decisoes = {}; reanalisar(); }));
      }
      corpo.appendChild(barra);

      function passaFiltro(i) {
        const f = estado.filtro;
        if (f === "erros") return i.acao === "erro";
        if (f === "avisos") return i.avisos.length > 0 || i.marcas.length > 0;
        if (f === "duplicadas") return !!i.dup;
        if (f === "criar") return i.criar.length > 0;
        if (f.indexOf("marca:") === 0) return i.marcas.indexOf(f.slice(6)) !== -1;
        return true;
      }
      const visiveis = a.itens.filter(passaFiltro);

      // Tabela de previa
      const colunasPrevia = def.colunasPrevia || camposImportaveis(def).map((c) => c.campo);
      const temDup = !!(def.duplicidade && r.duplicadas);
      const scroll = el("div", "imp-tabela-scroll");
      const tabela = el("table", "imp-tabela");
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      ["Linha", "Situação", "Detalhe"].concat(temDup ? ["Importar?"] : [], colunasPrevia.map((k) => rotuloCampo(k))).forEach((t) => trh.appendChild(el("th", null, t)));
      thead.appendChild(trh);
      tabela.appendChild(thead);
      const tbody = document.createElement("tbody");
      const ROT_ACAO = { novo: "Novo", atualiza: "Atualiza", igual: "Sem alteração", erro: "Erro", ignorada: "Ignorada", pulada: "Pulada" };
      visiveis.slice(0, MAX_LINHAS_PREVIA).forEach((i) => {
        const tr = document.createElement("tr");
        tr.className = "imp-linha-" + i.acao;
        tr.appendChild(el("td", null, String(i.numero)));
        const tdS = document.createElement("td");
        tdS.appendChild(el("span", "imp-badge imp-badge-" + i.acao, ROT_ACAO[i.acao]));
        if (i.dup) tdS.appendChild(el("span", "imp-badge imp-badge-dup", i.dup.exata ? "Idêntica" : "Parecida"));
        if (i.criar.length && !i.erros.length) tdS.appendChild(el("span", "imp-badge imp-badge-info", "Cria cadastro"));
        tr.appendChild(tdS);
        const partes = [];
        if (i.erros.length) partes.push(i.erros.join("; "));
        else {
          if (i.acao === "atualiza") partes.push(i.mudancas.map((m) => `${m.campo}: ${m.antes || "vazio"} → ${m.depois || "vazio"}`).join("; "));
          if (i.dup) partes.push(descricaoDup(i));
          i.avisos.forEach((x) => partes.push(x));
          
        }
        tr.appendChild(el("td", "imp-detalhe", partes.join(" · ")));
        if (temDup) {
          const tdI = document.createElement("td");
          if (i.dup && !i.erros.length) {
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = i.decisao === "importar";
            cb.setAttribute("aria-label", "Importar a linha " + i.numero);
            cb.addEventListener("change", () => { estado.decisoes[i.numero] = cb.checked ? "importar" : "pular"; reanalisar(); });
            tdI.appendChild(cb);
          }
          tr.appendChild(tdI);
        }
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
      if (visiveis.length > MAX_LINHAS_PREVIA) corpo.appendChild(el("div", "imp-nota", `Mostrando as primeiras ${MAX_LINHAS_PREVIA} de ${visiveis.length} linhas${estado.filtro === "todas" ? "" : " do filtro"}. A importação considera todas.`));
      if (!visiveis.length) corpo.appendChild(el("div", "imp-nota", "Nenhuma linha neste filtro."));

      const aGravar = r.novo + r.atualiza;
      const novosNos = estado.criarAusentes ? a.plano.total : 0;
      rodape.appendChild(botao("Trocar arquivo", "btn-cad-secundario", () => telaInicio()));
      if (r.erro) rodape.appendChild(botao("⬇ Baixar linhas rejeitadas", "btn-cad-secundario", () => baixarRelatorioErros(def, estado.tabela, a)));
      if (r.duplicadas || a.grafias.length || a.correspondencias.length || a.pendente.total) {
        rodape.appendChild(botao("⬇ Relatório de revisão", "btn-cad-secundario", () => { try { baixarRelatorioRevisao(def, ctx, estado); } catch (e) { corpo.appendChild(el("div", "imp-erro", e.message)); } }));
      }
      rodape.appendChild(el("span", "imp-espaco"));
      rodape.appendChild(botao("Cancelar", "btn-cad-secundario", fechar));
      const rotuloConfirmar = aGravar
        ? `Confirmar importação (${aGravar} ${aGravar === 1 ? "registro" : "registros"}${novosNos ? ` + ${novosNos} ${novosNos === 1 ? "cadastro novo" : "cadastros novos"}` : ""})`
        : "Nada a importar";
      const btnConfirmar = botao(rotuloConfirmar, "btn-cad-primario", () => gravar());
      btnConfirmar.disabled = !aGravar || faltam.length > 0;
      rodape.appendChild(btnConfirmar);
      const notas = [];
      if (r.erro && aGravar) notas.push(`${r.erro} ${r.erro === 1 ? "linha com erro será ignorada" : "linhas com erro serão ignoradas"}`);
      if (r.pulada) notas.push(`${r.pulada} ${r.pulada === 1 ? "duplicada será pulada" : "duplicadas serão puladas"}`);
      if (notas.length) rodape.appendChild(el("div", "imp-aviso-rodape", notas.join(" · ") + "."));
      corpo.scrollTop = rolagem;
    }

    // ---------- Etapa 3: gravar
    async function gravar() {
      const a = estado.analise;
      const itens = a.itens.filter((i) => i.acao === "novo" || i.acao === "atualiza");
      if (!itens.length) return;
      if (!BI.DB || !BI.DB.estado.disponivel) { corpo.appendChild(el("div", "imp-erro", "Banco de dados indisponível nesta visualização. Não é possível importar agora.")); return; }
      estado.gravando = true;
      corpo.innerHTML = "";
      rodape.innerHTML = "";
      const prog = el("div", "imp-progresso");
      const barra = el("div", "imp-barra");
      const enchimento = el("div", "imp-barra-cheia");
      barra.appendChild(enchimento);
      const texto = el("div", "imp-texto", "Preparando…");
      prog.appendChild(texto);
      prog.appendChild(barra);
      corpo.appendChild(prog);

      const falhasCadastro = [];
      const falhouNos = new Set();
      let cadastrosCriados = 0;

      // 1) cadastros da hierarquia que nao existiam (nivel a nivel, de cima para baixo)
      if (H && estado.criarAusentes && a.plano.total) {
        let feitosNos = 0;
        for (const nivel of ordemNiveis(ctx)) {
          const nos = (a.plano.niveis[nivel] || []).filter((no) => !no.pais.some((p) => falhouNos.has(p)));
          let derivados = 0;
          (a.plano.niveis[nivel] || []).forEach((no) => {
            if (no.pais.some((p) => falhouNos.has(p))) { falhouNos.add(no.chave); derivados++; }
          });
          if (derivados) falhasCadastro.push({ numero: "-", erro: `Não criados porque um cadastro acima falhou: ${derivados} ${derivados === 1 ? NIVEL_SINGULAR[nivel] || nivel : NIVEL_PLURAL[nivel] || nivel}` });
          if (!nos.length) continue;
          const lote = nos.map((no) => {
            const dados = H.dadosNovo ? H.dadosNovo(nivel, no.dados) : Object.assign({}, no.dados);
            return { id: H.id ? H.id(nivel, dados) : null, dados, criar: true, ref: no };
          });
          let res;
          try {
            res = await BI.DB.salvarEmLote(H.colecao(nivel), lote, (f) => {
              texto.textContent = `Criando cadastros… ${feitosNos + f} de ${a.plano.total}`;
              enchimento.style.width = Math.round(((feitosNos + f) / (a.plano.total + itens.length)) * 100) + "%";
            });
          } catch (e) {
            res = { falhas: lote.map((_, indice) => ({ indice, erro: e && e.message ? e.message : String(e) })) };
          }
          const falhouIdx = new Set(res.falhas.map((f) => f.indice));
          res.falhas.forEach((f) => { const no = lote[f.indice].ref; falhouNos.add(no.chave); falhasCadastro.push({ numero: no.linhas[0], erro: `${nivel} “${no.texto}”: ${f.erro}` }); });
          cadastrosCriados += lote.length - falhouIdx.size;
          feitosNos += lote.length;
        }
      }

      // 2) registros (linhas cujo cadastro nao foi criado ficam de fora)
      let bloqueadas = 0;
      const gravaveis = itens.filter((i) => {
        if (i.criar.some((k) => falhouNos.has(k))) { bloqueadas++; return false; }
        return true;
      });
      if (bloqueadas) falhasCadastro.push({ numero: "-", erro: `${bloqueadas} ${bloqueadas === 1 ? "registro não foi gravado" : "registros não foram gravados"} porque o cadastro necessário não pôde ser criado` });

      const lote = gravaveis.map((i) => {
        if (i.acao === "atualiza") {
          const ex = (ctx.existentes() || []).find((l) => l._id === i.existenteId) || {};
          const dados = Object.assign({}, ex, i.valores);
          delete dados._id;
          return { id: i.existenteId, dados, criar: false, ref: i };
        }
        const id = ctx.gerarId ? ctx.gerarId(i.valores) : null;
        return { id, dados: Object.assign({}, i.valores), criar: true, ref: i };
      });

      let resultado = { falhas: [] };
      if (lote.length) {
        const baseFeitos = cadastrosCriados + falhasCadastro.length;
        try {
          resultado = await BI.DB.salvarEmLote(def.colecao, lote, (feitos) => {
            texto.textContent = `Gravando ${feitos} de ${lote.length}…`;
            enchimento.style.width = Math.round(((baseFeitos + feitos) / (a.plano.total * (estado.criarAusentes ? 1 : 0) + itens.length)) * 100) + "%";
          });
        } catch (e) {
          estado.gravando = false;
          telaFinal({ criados: 0, atualizados: 0, cadastros: cadastrosCriados, falhas: falhasCadastro.concat([{ numero: "-", erro: e && e.message ? e.message : String(e) }]), naoGravados: bloqueadas });
          return;
        }
      }
      estado.gravando = false;
      const falhas = resultado.falhas.map((f) => ({ numero: lote[f.indice].ref.numero, erro: f.erro }));
      const falhouIdx = new Set(resultado.falhas.map((f) => f.indice));
      let criados = 0, atualizados = 0;
      lote.forEach((l, idx) => { if (falhouIdx.has(idx)) return; if (l.criar) criados++; else atualizados++; });
      telaFinal({ criados, atualizados, cadastros: cadastrosCriados, falhas: falhasCadastro.concat(falhas), naoGravados: bloqueadas });
    }

    function telaFinal(res) {
      corpo.innerHTML = "";
      rodape.innerHTML = "";
      const ok = res.criados + res.atualizados;
      const titulo = el("div", "imp-final-titulo " + (res.falhas.length ? (ok ? "parcial" : "erro") : "ok"),
        res.falhas.length ? (ok ? "Importação concluída com pendências" : "A importação não foi concluída") : "Importação concluída");
      corpo.appendChild(titulo);
      const chips = el("div", "imp-chips");
      const lista = [["criados", res.criados, "ok"], ["atualizados", res.atualizados, "info"]];
      if (res.cadastros) lista.push(["cadastros criados", res.cadastros, "info"]);
      if (res.naoGravados) lista.push(["registros não gravados", res.naoGravados, "erro"]);
      lista.push(["falhas ao gravar", res.falhas.length, res.falhas.length ? "erro" : "neutro"]);
      lista.forEach(([rot, val, cls]) => {
        const c = el("div", "imp-chip " + cls);
        c.appendChild(el("span", "imp-chip-valor", String(val)));
        c.appendChild(el("span", "imp-chip-rotulo", rot));
        chips.appendChild(c);
      });
      corpo.appendChild(chips);
      if (res.falhas.length) {
        const ul = el("ul", "imp-lista-falhas");
        res.falhas.slice(0, 30).forEach((f) => ul.appendChild(el("li", null, f.numero === "-" ? f.erro : `Linha ${f.numero}: ${f.erro}`)));
        corpo.appendChild(ul);
      }
      const rej = estado.analise ? estado.analise.resumo.erro : 0;
      if (rej) corpo.appendChild(el("div", "imp-nota", `${rej} ${rej === 1 ? "linha foi rejeitada" : "linhas foram rejeitadas"} na validação e não ${rej === 1 ? "foi gravada" : "foram gravadas"}.`));
      const pul = estado.analise ? estado.analise.resumo.pulada : 0;
      if (pul) corpo.appendChild(el("div", "imp-nota", `${pul} ${pul === 1 ? "duplicada foi pulada" : "duplicadas foram puladas"} por decisão da revisão.`));
      rodape.appendChild(el("span", "imp-espaco"));
      if (ctx.aoConcluir) { try { ctx.aoConcluir(res); } catch (e) { /* atualizacao de tela nunca derruba o resultado */ } }
      rodape.appendChild(botao("Fechar", "btn-cad-primario", fechar));
    }

    telaInicio();
  }

  BI.Importador = { abrir, analisar, converterData, converterMes, converterNumero, norm, mapeamentoAutomatico, similares, chaveSimples, MAX_LINHAS };
})(window);
