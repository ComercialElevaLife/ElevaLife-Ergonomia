/* ==========================================================================
   S.I.G.E. - ElevaLife
   PAGINA DE AJUDA (V 1.0): manual de uso por modulo, fluxos em BPMN
   (desenhados em SVG a partir de dados - ver FLUXOS) e o dicionario de
   indicadores (vem de js/indicadores.js). Nada aqui le/grava dados do
   cliente: e' conteudo estatico, igual para todos os usuarios.
   ========================================================================== */
(function (global) {
  "use strict";

  const BI = (global.BI = global.BI || {});

  // ------------------------------------------------------------------
  // MANUAL DE USO
  // ------------------------------------------------------------------
  const MANUAL = [
    {
      titulo: "Acesso e navegação",
      objetivo: "Orientar o primeiro acesso, a autenticação e a navegação entre os módulos.",
      perfis: "Todos os perfis.",
      passos: [
        "O acesso é concedido por um usuário com perfil Administrador ou Consultor, que cadastra o e-mail do novo usuário em Usuários. O convite é enviado por e-mail, com o link de primeiro acesso, no qual o usuário define a própria senha.",
        "Nos acessos seguintes, a autenticação é feita por e-mail e senha. A sessão tem validade de 7 dias. A opção Sair está no rodapé do menu lateral.",
        "O menu lateral organiza os módulos: Gestão de Risco, Gestão de Absenteísmo, Gestão de Restritos, Riscos Psicossociais, Registro, Cadastro, Usuários e Configurações (ambos restritos ao Administrador) e Ajuda. A seta no rodapé do menu recolhe ou expande a barra.",
        "A barra superior reúne o painel Filtros, o sino de avisos do Plano de Ação, Atualizar e as exportações em PDF e Excel.",
      ],
    },
    {
      titulo: "Leitura dos painéis (Risco, Absenteísmo e Restritos)",
      objetivo: "Interpretar os indicadores e aprofundar a análise até o registro de origem.",
      perfis: "Todos os perfis. O Usuário Cliente visualiza apenas as empresas vinculadas a ele.",
      passos: [
        "O painel Filtros permite segmentar a análise por Cliente, Unidade, Setor, Posto, Cargo, Atividade, Ano e Mês. O contador no botão indica quantos filtros estão ativos; \"Limpar filtros\" restaura a visão completa.",
        "Ao selecionar um número, uma barra ou uma fatia, o sistema lista os registros que compõem o valor (detalhamento).",
        "O botão \"i\", ao lado do título de cada card, descreve o que o indicador mede, a fonte do dado, a fórmula de cálculo e os filtros aplicáveis. O dicionário completo está em Ajuda › Indicadores.",
        "A exportação em PDF reproduz os cards da tela atual; a exportação em Excel entrega os dados de origem. Ambas respeitam os filtros ativos.",
      ],
    },
    {
      titulo: "Cadastro: estrutura organizacional e configurações",
      objetivo: "Estabelecer a estrutura organizacional do cliente e as configurações do laudo, pré-requisitos para qualquer lançamento.",
      perfis: "Administrador e Consultor. O Usuário Cliente apenas consulta.",
      passos: [
        "A estrutura é cadastrada na sequência Cliente › Unidade › Setor › Posto de Trabalho › Cargo › Atividade. Cada nível aceita somente valores do nível anterior (listas em cascata), o que preserva a padronização da nomenclatura.",
        "No cadastro do Cliente, define-se a Matriz de Risco (3x3, 4x4 ou 5x5), que determina a graduação do Inventário de Riscos. O logotipo do cliente compõe a identidade visual da tela quando somente esse cliente está filtrado e é utilizado na capa do laudo.",
        "Em Cadastro estão também as configurações do laudo: Ergonomistas (registro profissional e assinatura), Certificado Calibração e Editor de Texto.",
        "Os lançamentos em Registro dependem dessa estrutura; recomenda-se concluí-la antes do início das avaliações.",
      ],
    },
    {
      titulo: "Registro: lançamentos operacionais",
      objetivo: "Registrar os dados operacionais que alimentam os indicadores.",
      perfis: "Administrador e Consultor.",
      passos: [
        "Em Registro estão as tabelas operacionais: Mapa de Risco, Plano de Ação, Absenteísmo, HHT / Dias Úteis, Restritos (Compatíveis), Avaliação Ergonômica (AEP), Inventário de Riscos (AEP), Laudos e AET.",
        "Cada linha corresponde a um registro. O botão \"+ Novo registro\" cria um lançamento; os botões Editar e Excluir atuam sobre a linha correspondente.",
        "Campos calculados (Risco Global, Status da ação e Graduação do risco) são preenchidos pelo sistema e não admitem digitação.",
        "As datas seguem o formato DD/MM/AAAA (a barra é inserida automaticamente) ou podem ser escolhidas no calendário. Os filtros Ano e Mês consideram apenas os registros com a data correspondente preenchida.",
        "O botão \"Mais detalhes\" exibe a autoria (criação e última edição, com data e hora registradas pelo servidor) e, campo a campo, o valor atual e as alterações realizadas. A informação fica oculta até a seleção e vale para todos os usuários com acesso ao registro.",
        "A exclusão de um registro remove também as fotos e os arquivos vinculados a ele no armazenamento.",
      ],
    },
    {
      titulo: "Avaliação em campo (AEP), com ou sem conexão",
      objetivo: "Permitir a coleta da AEP em campo, inclusive em locais sem sinal de internet.",
      perfis: "Ergonomistas e consultores em atividade de campo.",
      passos: [
        "Em celular ou tablet, utilize a opção \"Adicionar à tela inicial\" para instalar o aplicativo. O primeiro acesso deve ocorrer com conexão, pois os dados do cliente são armazenados no aparelho.",
        "Sem conexão, a Avaliação Ergonômica permanece disponível: o preenchimento, o registro fotográfico e o salvamento são mantidos em fila local. A faixa \"sem internet · N a enviar\" indica o volume pendente.",
        "Com o retorno da conexão, o envio é automático (a cada 30 segundos). Ao selecionar a faixa, abre-se \"Envios pendentes\", com as opções Enviar agora, Descartar, Tentar de novo e, em caso de conflito de edição, Enviar minha versão.",
        "A exclusão também é permitida sem conexão: ela é enfileirada e executada no retorno do sinal, podendo ser cancelada antes disso.",
        "Recomenda-se não encerrar a sessão (Sair) com envios pendentes; o sistema solicita confirmação nessa situação.",
      ],
    },
    {
      titulo: "Inventário de Riscos e Mapa de Risco",
      objetivo: "Identificar e graduar os fatores de risco ergonômico por posto, conforme a ISO/TS 20646 e a matriz de risco do cliente.",
      perfis: "Ergonomistas e consultores.",
      passos: [
        "Em Registro › Avaliação Ergonômica (AEP), o botão \"Inventário de Riscos\", na linha do posto, abre o checklist de fatores (ISO/TS 20646). Para cada fator existente, informam-se Probabilidade e Gravidade; a graduação é obtida pela matriz do cliente.",
        "Cada fator marcado requer Fonte Geradora, Consequência e Medidas de Controle Existentes, além das ações de controle vinculadas (tipo, descrição, segmento corporal, redução prevista de risco, complexidade, responsável, prazo e status). O risco residual é calculado a partir dessas ações: o previsto considera todas; o realizado, apenas as concluídas.",
        "No Mapa de Risco, cada uma das 12 dimensões (regiões corporais, Psicossocial/Cognitivo e Ambiental) recebe nota de 1 a 4. O Risco Global do posto resulta da média dessas notas.",
      ],
    },
    {
      titulo: "Plano de Ação e avisos",
      objetivo: "Conduzir as ações corretivas e preventivas até a conclusão, com rastreabilidade e evidência.",
      perfis: "Administrador e Consultor lançam as ações; o responsável designado executa.",
      passos: [
        "As ações são lançadas em Registro › Plano de Ação, com Ação Recomendada, Responsável e Dt Programada, ou a partir do fator no Inventário de Riscos. Ao salvar, o responsável recebe e-mail de atribuição.",
        "Concluída a execução, informa-se a Dt Conclusão e o status passa a Concluída (ou Concluída com atraso). A conclusão exige evidência (foto JPG/PNG ou PDF, até 15 MB). O Administrador pode registrar exceção mediante justificativa e prazo para entrega da evidência.",
        "O sino, na barra superior, lista as ações com vencimento em até 30 dias e as atrasadas. O responsável também recebe lembretes por e-mail antes do prazo, no vencimento e durante o atraso.",
      ],
    },
    {
      titulo: "Absenteísmo, HHT e Restritos",
      objetivo: "Alimentar a Taxa de Frequência e o acompanhamento de restrições médicas e recolocações.",
      perfis: "Administrador e Consultor.",
      passos: [
        "Em Registro › Absenteísmo, cada afastamento é registrado com Região Corporal, Dt Afastamento e Qtd Dias; a Dt Retorno é calculada pelo sistema.",
        "Em Registro › HHT / Dias Úteis, informam-se, por setor e mês, a quantidade de colaboradores e de dias úteis. A Taxa de Frequência é calculada como (nº de afastamentos ÷ HHT) × 1.000.000, em que HHT = colaboradores × dias úteis × 8 h (NBR 14280).",
        "Em Registro › Restritos (Compatíveis), cada restrição médica é registrada com Segmento Corporal, Status Restrição (Ativa, Em Avaliação ou Encerrada) e indicação de Atividade Compatível.",
        "HHT / Dias Úteis e Restritos (Compatíveis) podem ser carregados por planilha: botão \"Importar Excel\" › baixar o modelo (.xlsx), preencher, enviar o arquivo e conferir a prévia. Nada é gravado até \"Confirmar importação\"; linhas com erro são ignoradas e podem ser baixadas para correção. Registros já existentes (mesmo Setor e mês, ou mesmo Cliente, Matrícula e início da restrição) são atualizados, não duplicados.",
        "O botão \"Baixar dados atuais\" gera a planilha com os registros vigentes, para edição em lote no Excel e reenvio. Cliente, Unidade e Setor precisam estar cadastrados (aba Cadastro); a aba \"Referências\" do modelo lista as combinações válidas.",
      ],
    },
    {
      titulo: "Laudos e Certificados de Calibração",
      objetivo: "Emitir o Laudo da AEP como documento com autoria identificada e verificação de autenticidade.",
      perfis: "Administrador e Consultor, com o ergonomista como responsável técnico.",
      passos: [
        "O Modelo de Laudo (Cadastro › Editor de Texto) e os Certificados de Calibração são bibliotecas compartilhadas entre todos os clientes. Campo vazio no Editor de Texto utiliza o texto padrão.",
        "Antes da primeira emissão, cadastre os ergonomistas em Cadastro › Ergonomistas, com registro profissional e imagem da assinatura.",
        "Em Registro › Laudos, \"+ Novo registro\": selecione o Cliente e o Responsável técnico (Setor, Posto e Ergonomista executor são opcionais) e acione \"Gerar Laudo\", no rodapé do formulário. Em uma única ação, o sistema monta o PDF com base na Avaliação Ergonômica, no Inventário de Riscos e no Plano de Ação, anexa o arquivo e registra o laudo com código de verificação e QR Code.",
        "\"Salvar sem gerar\" registra o laudo sem montar o PDF, por exemplo, para anexar um documento emitido fora do sistema ou corrigir dados de um laudo existente.",
        "A autenticidade pode ser conferida em sige-ergo.elevalife.com.br/verificar, pelo código ou pelo QR Code, com comparação do arquivo por meio do hash SHA-256.",
      ],
    },
    {
      titulo: "AET (Análise Ergonômica do Trabalho)",
      objetivo: "Centralizar os arquivos da AET elaborada fora do sistema e refleti-los nos indicadores.",
      perfis: "Ergonomistas.",
      passos: [
        "A AET é elaborada externamente (Excel/PDF) e anexada em Registro › AET.",
        "O sistema lê o conteúdo do arquivo e sugere a classificação (Mapa de Risco, Plano de Ação ou análise em texto); o ergonomista confirma ou corrige antes de salvar.",
      ],
    },
    {
      titulo: "Usuários, perfis e configurações",
      objetivo: "Definir quem acessa o sistema, com qual escopo, e padronizar parâmetros comuns a todos os clientes.",
      perfis: "Administrador e Consultor (Usuários); Administrador (Configurações).",
      passos: [
        "Administrador: visualiza todas as empresas, gerencia usuários e define as Configurações. Consultor: visualiza as empresas vinculadas e pode convidar usuários. Usuário Cliente: consulta somente as empresas vinculadas.",
        "Para conceder acesso: Usuários › Novo usuário, informando e-mail, perfil e empresas vinculadas. O convite é enviado por e-mail.",
        "Em Configurações, o Administrador ajusta os nomes dos tipos de ação do Plano de Ação (Eliminação, Engenharia / Adequação e Organizacional), válidos para todos os clientes.",
      ],
    },
    {
      titulo: "Riscos Psicossociais",
      objetivo: "Reservar o módulo de gestão dos riscos psicossociais.",
      perfis: "—",
      passos: [
        "Módulo em construção. A gestão dos riscos psicossociais (NR-01) será disponibilizada em versões futuras.",
      ],
    },
  ];

  // ------------------------------------------------------------------
  // FLUXOS (BPMN). tipo: inicio | fim | tarefa | decisao
  // lane = indice da raia; col = coluna (esquerda -> direita).
  // ------------------------------------------------------------------
  const FLUXOS = [
    {
      titulo: "Implantação de um cliente",
      resumo: "Do convite dos usuários à estrutura do cliente pronta para receber registros.",
      lanes: ["Admin / Consultor", "Usuário", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Novo cliente" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Cadastra os usuários e define o perfil" },
        { id: "c", tipo: "tarefa", lane: 2, col: 2, texto: "Envia o convite por e-mail" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Abre o link, define a senha e entra" },
        { id: "e", tipo: "tarefa", lane: 0, col: 4, texto: "Cadastra o Cliente (matriz de risco, logo)" },
        { id: "f", tipo: "tarefa", lane: 0, col: 5, texto: "Cadastra Unidade, Setor, Posto, Cargo e Atividade" },
        { id: "g", tipo: "fim", lane: 0, col: 6, texto: "Estrutura pronta" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"], ["f", "g"]],
    },
    {
      titulo: "Avaliação em campo (AEP) e Mapa de Risco",
      resumo: "Da visita ao posto até o Risco Global calculado, com ou sem internet.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Visita ao posto" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Abre a Avaliação Ergonômica do posto" },
        { id: "c", tipo: "decisao", lane: 0, col: 2, texto: "Tem internet?" },
        { id: "d", tipo: "tarefa", lane: 0, col: 3, texto: "Preenche, fotografa e salva" },
        { id: "e", tipo: "tarefa", lane: 1, col: 3, texto: "Guarda na fila do aparelho" },
        { id: "f", tipo: "tarefa", lane: 1, col: 4, texto: "Envia sozinho quando a conexão volta" },
        { id: "g", tipo: "tarefa", lane: 0, col: 5, texto: "Marca os fatores de risco e Probabilidade × Gravidade" },
        { id: "h", tipo: "tarefa", lane: 1, col: 6, texto: "Calcula a graduação pela matriz do cliente" },
        { id: "i", tipo: "tarefa", lane: 0, col: 7, texto: "Dá as 12 notas no Mapa de Risco" },
        { id: "j", tipo: "tarefa", lane: 1, col: 8, texto: "Calcula o Risco Global (média das notas)" },
        { id: "k", tipo: "fim", lane: 1, col: 9, texto: "Posto no Mapa de Risco" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d", "Sim"], ["c", "e", "Não"], ["d", "g"], ["e", "f"], ["f", "g"],
        ["g", "h"], ["h", "i"], ["i", "j"], ["j", "k"]],
    },
    {
      titulo: "Do risco ao Plano de Ação",
      resumo: "Como um posto crítico dá origem à ação, ao aviso, à execução e ao indicador.",
      lanes: ["Ergonomista", "Responsável", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Risco Global do posto" },
        { id: "b", tipo: "decisao", lane: 0, col: 1, texto: "Alto ou Muito Alto?" },
        { id: "c", tipo: "fim", lane: 1, col: 2, texto: "Monitoramento de rotina" },
        { id: "d", tipo: "tarefa", lane: 0, col: 2, texto: "Lança a ação (responsável e Dt Programada)" },
        { id: "e", tipo: "tarefa", lane: 2, col: 3, texto: "E-mail ao responsável e lembretes de prazo" },
        { id: "f", tipo: "tarefa", lane: 1, col: 4, texto: "Executa a ação" },
        { id: "g", tipo: "tarefa", lane: 1, col: 5, texto: "Informa a Dt Conclusão" },
        { id: "h", tipo: "tarefa", lane: 2, col: 6, texto: "Calcula o status e atualiza os indicadores" },
        { id: "i", tipo: "fim", lane: 2, col: 7, texto: "Acompanhar em Gestão de Risco" },
      ],
      fluxo: [["a", "b"], ["b", "c", "Não"], ["b", "d", "Sim"], ["d", "e"], ["e", "f"], ["f", "g"], ["g", "h"], ["h", "i"]],
    },
    {
      titulo: "Emissão de Laudo",
      resumo: "Da avaliação concluída ao laudo emitido, com PDF anexado e código de verificação.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Avaliação concluída" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Em Registro › Laudos, seleciona cliente e responsável técnico" },
        { id: "c", tipo: "tarefa", lane: 0, col: 2, texto: "Aciona Gerar Laudo" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Monta o PDF, anexa o arquivo e registra o laudo (código, hash e QR Code)" },
        { id: "e", tipo: "tarefa", lane: 0, col: 4, texto: "Confere o documento emitido" },
        { id: "f", tipo: "fim", lane: 0, col: 5, texto: "Laudo emitido" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"]],
    },
    {
      titulo: "AET anexada",
      resumo: "Como uma AET elaborada fora do sistema é anexada e passa a compor os indicadores.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "AET pronta (Excel/PDF)" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Anexa o arquivo em Registro › AET" },
        { id: "c", tipo: "tarefa", lane: 1, col: 2, texto: "Lê o conteúdo e sugere a classificação" },
        { id: "d", tipo: "tarefa", lane: 0, col: 3, texto: "Confirma ou corrige a classificação" },
        { id: "e", tipo: "tarefa", lane: 1, col: 4, texto: "Guarda o arquivo e atualiza o indicador AET" },
        { id: "f", tipo: "fim", lane: 1, col: 5, texto: "AET registrada" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"]],
    },
    {
      titulo: "Absenteísmo e Taxa de Frequência",
      resumo: "Como os afastamentos e as horas trabalhadas resultam na Taxa de Frequência.",
      lanes: ["Consultor", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Afastamento de colaborador" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Registra em Absenteísmo (região, dias)" },
        { id: "c", tipo: "tarefa", lane: 0, col: 2, texto: "Lança HHT / Dias Úteis do mês" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Calcula a Taxa de Frequência (NBR 14280)" },
        { id: "e", tipo: "fim", lane: 1, col: 4, texto: "Acompanhar em Gestão de Absenteísmo" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"]],
    },
    {
      titulo: "Restrição médica e recolocação",
      resumo: "Do retorno com restrição até a atividade compatível.",
      lanes: ["Consultor", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Retorno com restrição médica" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Registra em Restritos (Compatíveis), com o segmento corporal" },
        { id: "c", tipo: "decisao", lane: 0, col: 2, texto: "Há atividade compatível?" },
        { id: "d", tipo: "tarefa", lane: 0, col: 3, texto: "Atividade Compatível = Sim" },
        { id: "e", tipo: "tarefa", lane: 1, col: 3, texto: "Status Em Avaliação ou Ativa" },
        { id: "f", tipo: "fim", lane: 1, col: 4, texto: "Acompanhar em Gestão de Restritos" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d", "Sim"], ["c", "e", "Não"], ["d", "f"], ["e", "f"]],
    },
  ];

  const HISTORICO = [
    {
      versao: "1.7", data: "05/10/2026",
      itens: [
        "Revisão de segurança: convites passam a respeitar o perfil de quem convida (Consultor convida apenas UsuarioCliente, para as próprias empresas) e não alteram contas já ativas.",
        "Login com limite de tentativas (bloqueio temporário após 5 senhas incorretas) e intervalo mínimo entre pedidos de redefinição de senha.",
        "Laudo, Cadastro de Cliente, Ergonomistas, Modelo de laudo e Certificados passam a ser gravados apenas por Administrador ou Consultor; usuários-cliente continuam com acesso de leitura.",
        "Envio de arquivos com conferência do conteúdo e proteção reforçada de caminho; leitura de PDF (AET) endurecida; páginas de documentação interna deixam de ser públicas.",
      ],
    },
    {
      versao: "1.6", data: "05/10/2026",
      itens: [
        "Importação por Excel em HHT / Dias Úteis e Restritos (Compatíveis): modelo para baixar, leitura da planilha, prévia com situação de cada linha (novo, atualiza, sem alteração, erro) e confirmação antes de gravar.",
        "Registros existentes são atualizados em vez de duplicados; linhas com erro são rejeitadas, com relatório para download. \"Baixar dados atuais\" permite editar em lote no Excel.",
        "HHT / Dias Úteis passa a aceitar um único lançamento por Cliente, Unidade, Setor e mês, evitando soma em duplicidade na Taxa de Frequência.",
      ],
    },
    {
      versao: "1.5", data: "05/10/2026",
      itens: [
        "Revisão dos textos de Ajuda em linguagem técnica e padronizada: manual de uso com objetivo e perfis por seção, fluxos (BPMN) e dicionário de indicadores (botão \"i\" e Ajuda › Indicadores).",
        "Manual atualizado conforme as funcionalidades vigentes: ações por fator de risco, evidência na conclusão, emissão do laudo em uma etapa e verificação de autenticidade.",
        "Sem alteração de regras de cálculo, dados ou permissões.",
      ],
    },
    {
      versao: "1.4", data: "05/10/2026",
      itens: [
        "Tela de Laudo simplificada, de 17 para 12 campos visíveis. Código de verificação, hash, registros profissionais, emissor e texto são preenchidos automaticamente.",
        "Botão \"Gerar Laudo\" no rodapé do formulário: em uma única ação, gera o PDF, anexa o arquivo e registra o laudo. A opção \"Salvar sem gerar\" permanece disponível.",
        "Menus: Ergonomistas, Certificado Calibração e Editor de Texto passam de Registro para Cadastro (configurações). \"Compatíveis\" passa a \"Restritos (Compatíveis)\", em conformidade com o menu Gestão de Restritos.",
      ],
    },
    {
      versao: "1.3", data: "05/10/2026",
      itens: [
        "Laudo (AEP) redesenhado como documento oficial: formato A4 retrato, capa com o logotipo do cliente, sumário com links e marcadores, cabeçalho e rodapé com \"Página X de Y\" e código do documento.",
        "Metodologia ElevaLife incorporada ao laudo: apresentação, responsabilidade técnica, demanda, dados da empresa, fundamentação (ergonomia, NR-17, NR-01/GRO/PGR), etapas e PDCA, técnicas, ISO/TS 20646, guias de graduação, matriz de risco e referências. Os textos são editáveis em Cadastro › Editor de Texto (campo vazio utiliza o texto padrão).",
        "Cada posto apresenta fotos, descrição da atividade, panorama, fatores com gravidade × probabilidade, ações por fator e risco previsto/realizado; o plano de ação e o risco residual encerram o documento.",
        "Nova tela Cadastro › Ergonomistas (nome, formação, registro profissional e imagem da assinatura). O laudo utiliza o responsável técnico e o ergonomista executor selecionados.",
        "Última página com assinaturas, campo para o cliente e QR Code com código de verificação. A página pública sige-ergo.elevalife.com.br/verificar identifica a autoria e confere se o arquivo corresponde ao documento emitido. Para a verificação, o registro do Laudo deve ser salvo após a geração do PDF.",
      ],
    },
    {
      versao: "1.2", data: "05/10/2026",
      itens: [
        "Inventário de Riscos: cada fator passa a ter uma lista de ações, em substituição aos campos de texto \"Ação para Eliminação\" e \"Ação Organizacional\". Cada ação contém tipo, descrição (com sugestões), segmento corporal, redução prevista de risco, complexidade, responsável, prazo e status.",
        "Risco após a melhoria calculado: por segmento corporal, prevalece a ação que conduz ao menor nível; o fator assume o maior nível entre os segmentos. São apresentados o risco previsto (todas as ações) e o realizado (apenas as concluídas).",
        "Tipos de ação (Eliminação, Engenharia / Adequação e Organizacional) com nomes editáveis pelo Administrador em Configurações, válidos para todos os clientes.",
        "O responsável recebe e-mail ao ser designado, somente na criação da ação ou na troca do e-mail do responsável (sem reenvio a cada gravação).",
        "Evidência obrigatória (foto ou PDF) para a conclusão de uma ação, validada no servidor. O Administrador pode concluir sem evidência mediante justificativa e prazo; ele e o responsável recebem lembretes até a regularização.",
        "Registros anteriores permanecem inalterados; os textos antigos podem ser convertidos em ações com um clique, e as ações já concluídas continuam editáveis sem exigência de evidência.",
        "Correção: o histórico deixa de registrar alteração indevida quando apenas o tipo do valor muda (9 e \"9\").",
      ],
    },
    {
      versao: "1.1", data: "05/10/2026",
      itens: [
        "Filtros Ano e Mês passam a derivar das datas lançadas e a considerar apenas registros com data (Mapa de Risco, Avaliação, Inventário e Restritos ganharam campo de data).",
        "Datas em DD/MM/AAAA em todo o sistema, com calendário e máscara automática; exportações em Excel e histórico também seguem esse formato.",
        "Histórico de cada registro: autoria da criação e da edição, com data e hora registradas pelo servidor, disponível em \"Mais detalhes\" (campo a campo, com o valor anterior).",
        "Checklist do Inventário de Riscos: Fonte Geradora, Consequência, Medidas de Controle Existentes, Ação para Eliminação, Ação Organizacional e risco após a melhoria (graduação calculada).",
        "Redução de campos abertos: SLA em lista; e-mail do responsável validado e preenchido automaticamente; CNPJ, CEP e telefone com máscara; sugestões em Queixa Principal, Restrição Médica, Atividade Compatível e Emitido por.",
      ],
    },
    {
      versao: "1.0", data: "04/10/2026",
      itens: [
        "Primeira versão numerada do S.I.G.E, que consolida o pacote de melhorias de 04/10/2026.",
        "Coleta offline da Avaliação Ergonômica (AEP), com fotos, fila de envios e resolução de conflitos.",
        "Exclusão de dados com ou sem internet; fotos e arquivos são removidos junto com o registro.",
        "Endereço oficial sige-ergo.elevalife.com.br.",
        "Interface simplificada: os textos de apoio dos cards foram transferidos para o botão \"i\" e para esta Ajuda.",
        "Dicionário de indicadores de Gestão de Risco, Absenteísmo e Restritos (botão \"i\" e Ajuda › Indicadores).",
        "Correção: a graduação do Inventário de Riscos passa a considerar os níveis \"Moderado\", \"Muito Baixo\" e \"Altíssimo\" das matrizes.",
        "Correção: fatores marcados como \"Não\" no checklist deixam de compor os indicadores do Inventário.",
        "Correção: o card de Prazos do Inventário considera somente fatores em aberto.",
        "Nova tela Riscos Psicossociais (em construção).",
        "Nova página de Ajuda, com manual, fluxos BPMN, indicadores e histórico de versões.",
      ],
    },
  ];

  // ------------------------------------------------------------------
  // Desenho do BPMN em SVG
  // ------------------------------------------------------------------
  const NS = "http://www.w3.org/2000/svg";
  const LARG_RAIA = 120, LARG_COL = 150, ALT_RAIA = 112, MARGEM = 14;
  const TAREFA = { w: 128, h: 66 }, DECISAO = 50, EVENTO = 15;

  function el(nome, attrs, pai) {
    const e = document.createElementNS(NS, nome);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (pai) pai.appendChild(e);
    return e;
  }

  function quebrar(texto, max) {
    const palavras = String(texto).split(" ");
    const linhas = [];
    let atual = "";
    palavras.forEach((p) => {
      if ((atual + " " + p).trim().length > max && atual) { linhas.push(atual); atual = p; }
      else atual = (atual + " " + p).trim();
    });
    if (atual) linhas.push(atual);
    return linhas;
  }

  function escreverTexto(pai, linhas, cx, cy, classe) {
    const t = el("text", { x: cx, y: cy - ((linhas.length - 1) * 6.5), "text-anchor": "middle", class: classe }, pai);
    linhas.forEach((l, i) => {
      const ts = el("tspan", { x: cx, dy: i === 0 ? 4 : 13 }, t);
      ts.textContent = l;
    });
  }

  function desenharBPMN(fluxo) {
    const cols = Math.max.apply(null, fluxo.nos.map((n) => n.col)) + 1;
    const largura = LARG_RAIA + cols * LARG_COL + MARGEM;
    const altura = fluxo.lanes.length * ALT_RAIA;
    const svg = el("svg", { viewBox: `0 0 ${largura} ${altura}`, width: largura, height: altura, class: "bpmn-svg", role: "img", "aria-label": fluxo.titulo });

    const defs = el("defs", {}, svg);
    const marcador = el("marker", { id: "seta-" + fluxo.id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0L10 5L0 10z", class: "bpmn-seta" }, marcador);

    fluxo.lanes.forEach((nome, i) => {
      const y = i * ALT_RAIA;
      el("rect", { x: 0, y, width: largura, height: ALT_RAIA, class: "bpmn-raia" }, svg);
      el("rect", { x: 0, y, width: 28, height: ALT_RAIA, class: "bpmn-raia-rotulo" }, svg);
      const t = el("text", { x: 14, y: y + ALT_RAIA / 2, "text-anchor": "middle", class: "bpmn-raia-texto", transform: `rotate(-90 14 ${y + ALT_RAIA / 2})` }, svg);
      t.textContent = nome;
    });

    const porId = {};
    fluxo.nos.forEach((n) => {
      n.x = LARG_RAIA + n.col * LARG_COL + LARG_COL / 2;
      n.y = n.lane * ALT_RAIA + ALT_RAIA / 2;
      porId[n.id] = n;
      if (n.tipo === "tarefa") { n.mw = TAREFA.w / 2; n.mh = TAREFA.h / 2; }
      else if (n.tipo === "decisao") { n.mw = DECISAO / 2 + 6; n.mh = DECISAO / 2 + 6; }
      else { n.mw = EVENTO; n.mh = EVENTO; }
    });

    const gArestas = el("g", {}, svg);
    fluxo.fluxo.forEach(([de, para, rotulo]) => {
      const a = porId[de], b = porId[para];
      let pts, pos;
      if (b.col > a.col && a.tipo === "decisao" && a.lane !== b.lane) {
        // saida alternativa do losango: desce/sobe pela ponta e entra de lado
        const descendo = b.y > a.y;
        pts = [[a.x, a.y + (descendo ? a.mh : -a.mh)], [a.x, b.y], [b.x - b.mw, b.y]];
        pos = { x: a.x + 6, y: (pts[0][1] + b.y) / 2 + 4, ancora: "start" };
      } else if (b.col > a.col) {
        const x1 = a.x + a.mw, y1 = a.y, x2 = b.x - b.mw, y2 = b.y;
        if (y1 === y2) { pts = [[x1, y1], [x2, y2]]; pos = { x: x1 + 6, y: y1 - 6, ancora: "start" }; }
        else {
          const xm = x2 - 22;
          pts = [[x1, y1], [xm, y1], [xm, y2], [x2, y2]];
          pos = { x: xm - 5, y: (y1 + y2) / 2 + 4, ancora: "end" };
        }
      } else {
        const descendo = b.y > a.y;
        pts = [[a.x, a.y + (descendo ? a.mh : -a.mh)], [b.x, b.y + (descendo ? -b.mh : b.mh)]];
        pos = { x: a.x + 6, y: (pts[0][1] + pts[1][1]) / 2, ancora: "start" };
      }
      el("polyline", { points: pts.map((p) => p.join(",")).join(" "), class: "bpmn-aresta", "marker-end": `url(#seta-${fluxo.id})` }, gArestas);
      if (rotulo) {
        const t = el("text", { x: pos.x, y: pos.y, "text-anchor": pos.ancora, class: "bpmn-rotulo-aresta" }, gArestas);
        t.textContent = rotulo;
      }
    });

    fluxo.nos.forEach((n) => {
      const g = el("g", { class: "bpmn-no bpmn-" + n.tipo }, svg);
      if (n.tipo === "tarefa") {
        el("rect", { x: n.x - TAREFA.w / 2, y: n.y - TAREFA.h / 2, width: TAREFA.w, height: TAREFA.h, rx: 8 }, g);
        escreverTexto(g, quebrar(n.texto, 20), n.x, n.y, "bpmn-texto");
      } else if (n.tipo === "decisao") {
        const d = DECISAO / 2 + 6;
        el("polygon", { points: `${n.x},${n.y - d} ${n.x + d},${n.y} ${n.x},${n.y + d} ${n.x - d},${n.y}` }, g);
        const x = el("text", { x: n.x, y: n.y + 5, "text-anchor": "middle", class: "bpmn-texto bpmn-x" }, g);
        x.textContent = "?";
        escreverTexto(g, quebrar(n.texto, 18), n.x, n.y - d - 14 - (quebrar(n.texto, 18).length - 1) * 6.5 + 6, "bpmn-texto bpmn-legenda");
      } else {
        el("circle", { cx: n.x, cy: n.y, r: EVENTO }, g);
        escreverTexto(g, quebrar(n.texto, 18), n.x, n.y + EVENTO + 14, "bpmn-texto bpmn-legenda");
      }
    });

    return svg;
  }

  // ------------------------------------------------------------------
  // Montagem da pagina
  // ------------------------------------------------------------------
  function criar(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function painelManual() {
    const raiz = criar("div", "ajuda-painel");
    MANUAL.forEach((sec, i) => {
      const d = criar("details", "ajuda-secao");
      if (i === 0) d.open = true;
      d.appendChild(criar("summary", "", sec.titulo));
      if (sec.objetivo) {
        const meta = criar("p", "ajuda-objetivo");
        meta.appendChild(criar("strong", "", "Objetivo: "));
        meta.appendChild(document.createTextNode(sec.objetivo));
        if (sec.perfis && sec.perfis !== "—") {
          meta.appendChild(document.createElement("br"));
          meta.appendChild(criar("strong", "", "Perfis: "));
          meta.appendChild(document.createTextNode(sec.perfis));
        }
        d.appendChild(meta);
      }
      const ol = criar("ol", "ajuda-passos");
      sec.passos.forEach((p) => ol.appendChild(criar("li", "", p)));
      d.appendChild(ol);
      raiz.appendChild(d);
    });
    return raiz;
  }

  function painelFluxos() {
    const raiz = criar("div", "ajuda-painel");
    FLUXOS.forEach((f, i) => {
      f.id = "f" + i;
      const bloco = criar("section", "ajuda-fluxo cartao");
      bloco.appendChild(criar("div", "cartao-titulo", f.titulo));
      bloco.appendChild(criar("p", "ajuda-fluxo-resumo", f.resumo));
      const rolagem = criar("div", "bpmn-rolagem");
      rolagem.appendChild(desenharBPMN(f));
      bloco.appendChild(rolagem);
      raiz.appendChild(bloco);
    });
    return raiz;
  }

  function painelIndicadores() {
    const raiz = criar("div", "ajuda-painel");
    const lista = (BI.Indicadores && BI.Indicadores.LISTA) || [];
    const abas = (BI.Indicadores && BI.Indicadores.ABAS) || {};
    Object.keys(abas).forEach((aba) => {
      raiz.appendChild(criar("h3", "ajuda-h3", abas[aba]));
      let grupoAtual = null;
      lista.filter((i) => i.aba === aba).forEach((item) => {
        if (item.grupo !== grupoAtual) {
          grupoAtual = item.grupo;
          raiz.appendChild(criar("div", "ajuda-grupo", grupoAtual));
        }
        const d = criar("details", "ajuda-secao");
        d.appendChild(criar("summary", "", item.titulo));
        const corpo = criar("div", "ajuda-indicador");
        [["O que mostra", item.mostra], ["De onde vem", item.fonte], ["Como é calculado", item.calculo],
          ["Filtros que valem", item.filtros], ["Atenção", item.cuidado]].forEach(([r, t]) => {
          if (!t) return;
          const p = criar("p");
          p.appendChild(criar("strong", "", r + ": "));
          p.appendChild(document.createTextNode(t));
          corpo.appendChild(p);
        });
        d.appendChild(corpo);
        raiz.appendChild(d);
      });
    });
    return raiz;
  }

  function painelVersao() {
    const raiz = criar("div", "ajuda-painel");
    HISTORICO.forEach((h) => {
      const bloco = criar("section", "ajuda-fluxo cartao");
      bloco.appendChild(criar("div", "cartao-titulo", `V ${h.versao} · ${h.data}`));
      const ul = criar("ul", "ajuda-passos");
      h.itens.forEach((i) => ul.appendChild(criar("li", "", i)));
      bloco.appendChild(ul);
      raiz.appendChild(bloco);
    });
    return raiz;
  }

  const ABAS_AJUDA = [
    { chave: "manual", rotulo: "Como usar", montar: painelManual },
    { chave: "fluxos", rotulo: "Fluxos (BPMN)", montar: painelFluxos },
    { chave: "indicadores", rotulo: "Indicadores", montar: painelIndicadores },
    { chave: "versao", rotulo: "Versão", montar: painelVersao },
  ];

  function montar() {
    const secao = document.getElementById("aba-ajuda");
    if (!secao || secao.dataset.montada) return;
    secao.dataset.montada = "1";
    const barra = criar("nav", "subnav-cadastro ajuda-abas");
    const area = criar("div", "ajuda-area");
    const botoes = {};

    function mostrar(chave) {
      ABAS_AJUDA.forEach((a) => botoes[a.chave].classList.toggle("ativa", a.chave === chave));
      const aba = ABAS_AJUDA.find((a) => a.chave === chave);
      area.innerHTML = "";
      area.appendChild(aba.montar());
    }

    ABAS_AJUDA.forEach((a) => {
      const b = criar("button", "subnav-cadastro-item", a.rotulo);
      b.type = "button";
      b.addEventListener("click", () => mostrar(a.chave));
      botoes[a.chave] = b;
      barra.appendChild(b);
    });
    secao.appendChild(barra);
    secao.appendChild(area);
    mostrar("manual");
  }

  BI.Ajuda = { montar, MANUAL, FLUXOS, HISTORICO };
})(window);
