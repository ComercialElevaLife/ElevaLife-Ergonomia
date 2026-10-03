/* ==========================================================================
   S.I.G.E. – ElevaLife
   Rótulos de exibição em português correto (acentuação), pedido do Léo em
   03/10/2026: "o sistema precisa acentuar e usar pontuações".

   Os NOMES DOS CAMPOS gravados no banco (ex.: "Acao Recomendada",
   "Dt Conclusao", "Status Restricao") e os VALORES fixos de alguns campos
   (ex.: "Nao", "Em Avaliacao") continuam sem acento de propósito: são
   chaves de dados, usadas em filtros, cálculos, API pública e registros já
   gravados. Mudar a chave quebraria tudo isso. Por isso a correção é só na
   EXIBIÇÃO: toda vez que uma chave aparece na tela (cabeçalho de tabela,
   rótulo de formulário, título de detalhe, planilha exportada, valor de
   lista), ela passa por BI.Rotulos.texto(), que acentua palavra por palavra
   a partir do dicionário abaixo.

   O dicionário só tem palavras sem ambiguidade (ex.: "esta"/"está" ficou de
   fora). Palavra que não está no dicionário passa sem alteração.
   ========================================================================== */

(function (raiz) {
  "use strict";

  const PALAVRAS = {
    lancamento: "lançamento", lancamentos: "lançamentos", voces: "vocês", esqueca: "esqueça", relacao: "relação", pagamento: "pagamento", conexao: "conexão", atualizacoes: "atualizações", ve: "vê", sao: "são", disponiveis: "disponíveis", indisponiveis: "indisponíveis", rodape: "rodapé", ultimas: "últimas", saida: "saída", proprios: "próprios", previa: "prévia",
    apresentacao: "apresentação",
    aquisicao: "aquisição",
    caracteristicas: "características",
    consequencia: "consequência",
    consequencias: "consequências",
    distribuicao: "distribuição",
    divisao: "divisão",
    doencas: "doenças",
    evolucao: "evolução",
    excluidos: "excluídos",
    expedicao: "expedição",
    funcionario: "funcionário",
    funcionarios: "funcionários",
    graduacao: "graduação",
    lesoes: "lesões",
    logistica: "logística",
    maos: "mãos",
    pes: "pés",
    pontuacao: "pontuação",
    revisao: "revisão",
    rodizio: "rodízio",
    acessorio: "acessório",
    acessorios: "acessórios",
    altissimo: "altíssimo",
    aproximacao: "aproximação",
    automatico: "automático",
    automatica: "automática",
    botao: "botão",
    botoes: "botões",
    cabecalho: "cabeçalho",
    cartao: "cartão",
    celula: "célula",
    clicavel: "clicável",
    etaria: "etária",
    ficticio: "fictício",
    ficticia: "fictícia",
    ficticios: "fictícios",
    ficticias: "fictícias",
    geracao: "geração",
    hierarquico: "hierárquico",
    hierarquica: "hierárquica",
    icone: "ícone",
    indisponivel: "indisponível",
    inicializacao: "inicialização",
    milhao: "milhão",
    movimentacao: "movimentação",
    opcoes: "opções",
    paginacao: "paginação",
    rotulos: "rótulos",
    rotulo: "rótulo",
    sugestao: "sugestão",
    sugestoes: "sugestões",
    titulos: "títulos",
    titulo: "título",
    duvida: "dúvida",
    duvidas: "dúvidas",
    publica: "pública",
    publico: "público",
    proprio: "próprio",
    propria: "própria",
    necessario: "necessário",
    necessaria: "necessária",
    obrigatorios: "obrigatórios",
    referencia: "referência",
    referencias: "referências",
    sequencia: "sequência",
    tambem: "também",
    agencia: "agência",
    excecao: "exceção",
    funcao: "função",
    funcoes: "funções",
    questao: "questão",
    questoes: "questões",
    opcao: "opção",
    parametro: "parâmetro",
    parametros: "parâmetros",
    metrica: "métrica",
    metricas: "métricas",
    grafica: "gráfica",
    valida: "válida",
    validos: "válidos",
    valido: "válido",
    invalidos: "inválidos",
    horario: "horário",
    horarios: "horários",
    diario: "diário",
    diaria: "diária",
    calendario: "calendário",
    vigencia: "vigência",
    alteracao: "alteração",
    alteracoes: "alterações",
    exclusao: "exclusão",
    inclusao: "inclusão",
    solicitacao: "solicitação",
    situacoes: "situações",
    prevencao: "prevenção",
    avaliacoes: "avaliações",
    medicao: "medição",
    medicoes: "medições",
    tecnicas: "técnicas",
    tecnicos: "técnicos",
    especificos: "específicos",
    organizacao: "organização",
    acao: "ação", acoes: "ações", avaliacao: "avaliação", avaliacoes: "avaliações",
    responsavel: "responsável", responsaveis: "responsáveis", conclusao: "conclusão", conclusoes: "conclusões",
    restricao: "restrição", restricoes: "restrições", medico: "médico", medica: "médica", medicas: "médicas", medicos: "médicos",
    genero: "gênero", usuario: "usuário", usuarios: "usuários", configuracao: "configuração", configuracoes: "configurações",
    nao: "não", voce: "você", obrigatorio: "obrigatório", obrigatoria: "obrigatória",
    invalido: "inválido", invalida: "inválida", invalidos: "inválidos", invalidas: "inválidas",
    inventario: "inventário", funcao: "função", gestao: "gestão", analise: "análise", analises: "análises",
    historico: "histórico", matricula: "matrícula", numero: "número", codigo: "código", cod: "cód",
    relatorio: "relatório", relatorios: "relatórios", calibracao: "calibração",
    ergonomico: "ergonômico", ergonomica: "ergonômica", ergonomicos: "ergonômicos", ergonomicas: "ergonômicas",
    atencao: "atenção", previsao: "previsão", area: "área", areas: "áreas",
    concluida: "concluída", concluidas: "concluídas", concluido: "concluído", concluidos: "concluídos",
    media: "média", medio: "médio", descricao: "descrição", observacao: "observação", observacoes: "observações",
    informacao: "informação", informacoes: "informações", endereco: "endereço", enderecos: "endereços",
    inscricao: "inscrição", razao: "razão", pagina: "página", paginas: "páginas", proxima: "próxima", proximo: "próximo",
    ultima: "última", ultimo: "último", tecnico: "técnico", tecnica: "técnica", introducao: "introdução",
    recomendacao: "recomendação", recomendacoes: "recomendações", periodo: "período", periodos: "períodos",
    frequencia: "frequência", ausencia: "ausência", saude: "saúde", regiao: "região", regioes: "regiões",
    posicao: "posição", organizacional: "organizacional", biomecanico: "biomecânico", biomecanica: "biomecânica",
    mobiliario: "mobiliário", iluminacao: "iluminação", ruido: "ruído", vibracao: "vibração", repeticao: "repetição",
    forca: "força", compativel: "compatível", compativeis: "compatíveis", incompativel: "incompatível",
    diagnostico: "diagnóstico", exportacao: "exportação", selecao: "seleção", emissao: "emissão", versao: "versão",
    disponivel: "disponível", possivel: "possível", mes: "mês", meses: "meses", grafico: "gráfico", graficos: "gráficos",
    indice: "índice", critico: "crítico", criticos: "críticos", 
    nivel: "nível", niveis: "níveis", estatistica: "estatística", 
    minimo: "mínimo", maximo: "máximo", tambem: "também", ate: "até", apos: "após", tres: "três", sera: "será",
    pos: "pós", uteis: "úteis", util: "útil", absenteismo: "absenteísmo", eliminacao: "eliminação",
    substituicao: "substituição", identificacao: "identificação", classificacao: "classificação",
    situacao: "situação", condicao: "condição", condicoes: "condições", exposicao: "exposição",
    manutencao: "manutenção", producao: "produção", operacao: "operação", operacoes: "operações",
    administracao: "administração", administrativo: "administrativo", programacao: "programação",
    execucao: "execução", inicio: "início", termino: "término", fisico: "físico", fisica: "física",
    psicossocial: "psicossocial", cognitivo: "cognitivo", ambiental: "ambiental", padrao: "padrão",
    responsabilidade: "responsabilidade", metodo: "método", metodos: "métodos", metodologia: "metodologia",
    ultimos: "últimos", ultimas: "últimas", rapido: "rápido", grafica: "gráfica", juridica: "jurídica",
    municipio: "município", logradouro: "logradouro", telefone: "telefone",
    cnae: "CNAE", cnpj: "CNPJ", aep: "AEP", aet: "AET", cid: "CID",
    unica: "única", unico: "único", especifico: "específico", especifica: "específica",
    tipico: "típico", logica: "lógica", ciencia: "ciência",
    agua: "água", maquina: "máquina", maquinas: "máquinas", veiculo: "veículo", veiculos: "veículos",
    excluido: "excluído", excluida: "excluída", invalidacao: "invalidação", atualizacao: "atualização",
    criacao: "criação", edicao: "edição", visualizacao: "visualização", notificacao: "notificação",
    notificacoes: "notificações", sincronizacao: "sincronização", importacao: "importação",
    integracao: "integração", permissao: "permissão", permissoes: "permissões", sessao: "sessão",
    colecao: "coleção", colecoes: "coleções", conteudo: "conteúdo", servico: "serviço", servicos: "serviços",
  };
  // Siglas que ficam em maiúsculas quando aparecem sozinhas como palavra.
  const SIGLAS = new Set(["cnae", "cnpj", "aep", "aet", "cid"]);

  function ajustarCaixa(original, traducao) {
    if (original === original.toUpperCase() && original.length > 1) return traducao.toUpperCase();
    if (original[0] === original[0].toUpperCase()) return traducao[0].toUpperCase() + traducao.slice(1);
    return traducao;
  }

  // Acentua palavra por palavra. Não mexe em números, e-mails, URLs nem em
  // palavras fora do dicionário. Siglas só são normalizadas se já vierem em
  // maiúsculas ou capitalizadas (evita mexer em "id" de código).
  function texto(valor) {
    if (valor === null || valor === undefined) return valor;
    const s = String(valor);
    if (!s || /@|:\/\//.test(s)) return s;
    return s.replace(/[A-Za-z]+/g, (palavra) => {
      const chave = palavra.toLowerCase();
      const traducao = PALAVRAS[chave];
      if (!traducao) return palavra;
      if (SIGLAS.has(chave)) return palavra[0] === palavra[0].toUpperCase() ? traducao : palavra;
      return ajustarCaixa(palavra, traducao);
    });
  }

  const api = { texto, PALAVRAS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (raiz) {
    raiz.BI = raiz.BI || {};
    raiz.BI.Rotulos = api;
  }
})(typeof window !== "undefined" ? window : null);
