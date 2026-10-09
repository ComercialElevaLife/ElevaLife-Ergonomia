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
        "O menu lateral segue a ordem: AEP, AET, Psicossocial, Gestão de Riscos, Gestão do Plano de Ação, Gestão de Absenteísmo, Gestão de Restritos, Cadastro Empresa, Cadastro Interno (com a sub-aba Usuários, para Administrador e Consultor) e Ajuda. AEP, AET, Psicossocial e os cadastros abrem sub-abas no próprio menu. A seta no rodapé do menu recolhe a barra lateral.",
        "A barra superior reúne o painel Filtros, o sino de avisos do Plano de Ação, Atualizar e as exportações em PDF e Excel.",
      ],
    },
    {
      titulo: "Leitura dos painéis (Risco, Plano de Ação, Absenteísmo e Restritos)",
      objetivo: "Interpretar os indicadores e aprofundar a análise até o registro de origem.",
      perfis: "Todos os perfis. O Usuário Cliente visualiza apenas as empresas vinculadas a ele.",
      passos: [
        "O painel Filtros é único para todas as abas: Ano, Mês, Cliente, Unidade, Setor / GHE, Posto, Cargo, Atividade e Origem (AEP, AET ou Psicossocial). O filtro Cliente mostra apenas os clientes vinculados ao usuário; com um único cliente filtrado, Riscos Psicossociais abre direto na página dele. A Origem vale para riscos, ações, avaliações e laudos; Absenteísmo e Restritos não têm origem e não são afetados por ela. O Absenteísmo e a Gestão de Restritos mantêm também os filtros próprios que já tinham. O contador no botão indica quantos filtros estão ativos; \"Limpar filtros\" restaura a visão completa.",
        "As páginas respondem primeiro ao filtro geral e depois aos filtros da própria aba. Gestão de Riscos e Gestão do Plano de Ação têm, no topo, o filtro de origem (Todas, AEP, AET ou Psicossocial), que vale para todos os gráficos e listas da aba.", "Gestão de Riscos é o cenário de todos os riscos (AEP, AET e Psicossocial): Risco Global dos Postos (rosca com o total de postos no centro; o risco de cada posto é a maior graduação entre os seus fatores), Risco dos Postos por Setor / GHE, Evolução mensal dos riscos (total em cima de cada mês; clicando num mês, aparece o que compõe cada parte: os fatores por graduação, os reduzidos de qual graduação para qual e os eliminados), Top 3 Setores críticos, Inventário de Riscos (rosca com o total de fatores e a tabela de todos os fatores, com busca) e as avaliações realizadas (cobertura da AEP, AEPs e AETs mês a mês). Os indicadores das ações e o status de tratativa do Inventário ficam na Gestão do Plano de Ação.",
        "Cores padrão em todo o sistema, nos laudos e nas planilhas. Graduação do risco: trivial/muito baixo azul-claro, baixo verde, moderado amarelo, alto vermelho, muito alto/altíssimo roxo. Situação das ações: não iniciada laranja, em andamento amarelo, atrasada vermelho, concluída verde (concluída com atraso em verde escuro).",
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
        "Em Cadastro Empresa, o menu segue a ordem Cliente, Unidade, Setor / GHE, Colaboradores, Cargo, Posto de Trabalho, Atividade, Absenteísmo, HHT / Taxa de frequência e Restritos. A hierarquia de dados continua Cliente › Unidade › Setor / GHE › Posto de Trabalho › Cargo › Atividade: cada nível aceita somente valores do nível anterior (listas em cascata), o que preserva a padronização da nomenclatura.",
        "No cadastro do Cliente, define-se a Matriz de Risco (3x3, 4x4, 5x5 ou 5x5 Gerdau), que determina a graduação do Inventário de Riscos, dos Riscos Psicossociais e das ações. Na Matriz 3x3 (modelo ElevaLife, Probabilidade × Severidade em Leve/Média/Alta), a pontuação 1–2 é Baixo, 3–4 é Moderado e 6–9 é Alto. A Matriz 5x5 Gerdau usa os nomes do cliente: probabilidade Muito Baixa a Muito Alta (pelo % do tempo amostral), severidade Brando, Moderado, Sério, Crítico e Muito Crítico, e graduações Irrelevante, Tolerável, Moderado, Alto e Intolerável; o laudo traz as definições da Gerdau. O logotipo do cliente compõe a identidade visual da tela quando somente esse cliente está filtrado e é utilizado na capa do laudo.",
        "Excluir uma empresa (Cadastro Empresa › Cliente, só Administrador) apaga a empresa e TODOS os dados dela: unidades, setores, colaboradores, cargos, postos, AEP, AET, Inventário de Riscos, Plano de Ação, laudos, absenteísmo, restritos, as fotos e arquivos e os dados dos Riscos Psicossociais; a empresa sai também dos usuários vinculados. O botão “🧹 Dados de empresas excluídas” lista o que sobrou de empresas excluídas antes da V 1.37 e permite apagar; até lá, esses dados já não aparecem nas telas.",
        "No cadastro da empresa, marcam-se os Serviços contratados, um por aba: AEP, AET, Psicossocial, Gestão de Riscos, Gestão do Plano de Ação, Gestão de Absenteísmo e Gestão de Restritos. A aba de um serviço não contratado continua no menu, mas mostra o aviso de que a empresa não possui o serviço e orienta a procurar o time de especialistas da ElevaLife. Empresas antigas sem nenhuma marcação continuam com todos os serviços; as que tinham \"Gestão de Riscos\" ficam também com AEP, AET e Plano de Ação.",
        "Em Setor / GHE, o campo \"É setor ou GHE?\" indica se o registro é um setor ou um grupo homogêneo de exposição (GHE). Os Riscos Psicossociais usam os dois da mesma forma.",
        "Em Colaboradores, cadastra-se cada pessoa com unidade, setor/GHE, matrícula e nome (há importação por planilha, até 12 mil linhas por arquivo). A matrícula é a chave: é ela que o colaborador digita para responder o questionário HSE-IT.",
        "Em Cadastro Interno ficam as configurações da ElevaLife, compartilhadas por todos os clientes: Ergonomistas (nome, e-mail, registro profissional e assinatura, usados nos laudos e para identificar quem cadastrou e atualizou cada AEP), Certificado Calibração (instrumento, validade obrigatória e o certificado em PDF ou imagem; 30 dias antes de vencer, os Administradores recebem um e-mail) e Usuários. Os Editores de Texto ficam na AEP e na AET. O Usuário Cliente não acessa o Cadastro Interno.",
        "Os lançamentos (AEP, Absenteísmo, HHT, Restritos) dependem dessa estrutura; recomenda-se concluí-la antes do início das avaliações.",
      ],
    },
    {
      titulo: "Tabelas de lançamento (regras gerais)",
      objetivo: "Explicar o funcionamento comum das telas de lançamento (cadastros, AEP, Plano de Ação e AET).",
      perfis: "Administrador e Consultor.",
      passos: [
        "Absenteísmo, HHT / Taxa de frequência e Restritos ficam no Cadastro Empresa. A AEP tem as sub-abas Avaliações (AEP), Laudos, Importar Excel e Editor de texto; a AET tem AETs, Laudos, Importar AET e Editor de texto. O Inventário de Riscos é consultado na Gestão de Riscos (os fatores da AEP são lançados pelo botão Inventário de Riscos de cada AEP) e as ações ficam na Gestão do Plano de Ação.",
        "Cada linha corresponde a um registro. O botão \"+ Novo registro\" cria um lançamento (no Plano de Ação ele não existe: as ações nascem na AEP e no Psicossocial); os botões Editar e Excluir atuam sobre a linha correspondente.",
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
        "Histórico de AEP de planilha Excel (inclusive do sistema anterior): em AEP › Importar Excel, opção Avaliações (AEP). Baixe o modelo ou envie a planilha existente, ligue as colunas aos campos (nomes comuns são reconhecidos automaticamente), confira a prévia e confirme. Cliente, Unidade, Setor, Posto e Cargo que ainda não existirem podem ser criados automaticamente (opção na prévia; só Administrador cria Cliente). A AEP é por posto e cargo (sem atividade). Jornada, Pausas e Rodízio são opcionais na importação; fotos não são importadas.",
      ],
    },
    {
      titulo: "Inventário de Riscos e risco do posto",
      objetivo: "Identificar e graduar os fatores de risco ergonômico por posto, conforme a ISO/TS 20646 e a matriz de risco do cliente.",
      perfis: "Ergonomistas e consultores.",
      passos: [
        "Em AEP › Avaliações (AEP), cada avaliação é identificada por posto e cargo e recebe um número por cliente (AEP-001, AEP-002…). A lista mostra o número, a data de cadastro e o ergonomista que cadastrou, a data da última atualização e o ergonomista que atualizou. Na linha: Inventário, Mais detalhes (dados da avaliação, inventário e histórico de atualizações), Editar e Excluir.",
        "O botão \"Inventário\" abre o checklist de fatores (ISO/TS 20646). Cada fator marcado exige Fonte geradora, Consequência (há uma lista padrão por fator para escolher, e o texto pode ser complementado), Medidas de controle existentes, Segmento acometido (inclui \"Não identificado\" e \"Psicossocial\"), Severidade e Probabilidade; a graduação vem da matriz do cliente. Nada é salvo com campo em branco. \"+ Repetir este fator\" cadastra o mesmo fator de novo (por exemplo, para outro segmento corporal), com todas as informações, e o contador mostra quantos cadastros o fator tem. Ao salvar, a AEP registra a data e o ergonomista da última atualização.",
        "Ações de cada fator: tipo (Eliminação, Engenharia / Adequação, Organizacional…), complexidade e a ação escrita; o risco atual do fator aparece automaticamente. Se a ação vai reduzir ou eliminar o risco, marque \"Esta ação vai reduzir ou eliminar o risco\" e escolha a graduação esperada (ou \"Elimina o risco\"); as graduações são as da matriz do cliente (ex.: na Gerdau, Irrelevante a Intolerável). O segmento acometido fica no fator, não na ação. Responsável, e-mail, prazo e status existem só no Plano de Ação.",
        "Recomendações do SIGE (V 1.37): em cada fator do checklist aparecem as ferramentas ergonômicas recomendadas para aprofundar a avaliação (na AET) e, no editor de ações, as recomendações padronizadas para o fator e o nível de risco (base: NR-17, NR-01, ISO 11228, ISO 11226, ISO/TS 20646, ISO 45003 e NHO da Fundacentro). Risco baixo traz as ações de manutenção e monitoramento; moderado acrescenta adequações de engenharia e organização; alto ou acima, a eliminação ou substituição da exigência. “+ Usar” inclui a ação; “+ Outra ação (digitar)” abre uma ação livre.",
        "Evolução do risco: ao concluir no Plano de Ação uma ação marcada como redutora, abre-se a janela de reavaliação, em que o ergonomista informa a nova Probabilidade e Severidade (a matriz calcula o novo risco) ou marca \"Risco eliminado\". O fator guarda todo o histórico (ex.: \"Iniciou Alto · Ação A-01 concluída em 10/11/2026: Moderado\"), visível na coluna Evolução do risco do Inventário. Alterar a graduação no checklist também entra no histórico. Risco eliminado deixa de contar no risco do posto, mas continua no histórico e no laudo.",
        "Avaliações antigas (com atividade, ou duas AEPs do mesmo posto e cargo): o Administrador vê o aviso \"Atualizar avaliações\" em AEP › Avaliações; o sistema junta as AEPs do mesmo posto e cargo em uma só, retira a atividade e numera as que não têm número.",
        "Risco do posto: é sempre a maior graduação entre os fatores do posto (por cargo). Um posto com um fator Baixo e outro Alto é um posto de risco Alto. É esse risco que aparece na Gestão de Riscos (Risco Global dos Postos, Top setores críticos e Risco por setor), somando AEP, AET e Psicossocial (por setor/GHE). O antigo Mapa de Risco (12 notas por posto) não é mais preenchido; os registros antigos ficam guardados.",
        "Histórico do sistema anterior: em AEP › Importar Excel, a opção Inventário de riscos do sistema anterior lê o relatório exportado do sistema anterior (uma linha por fator), com a mesma lógica do checklist (sem atividade; AEP por posto e cargo). Data de identificação é opcional. A mesma importação cria a AEP de cada posto/cargo (aproveitando as existentes). Marque \"Criar automaticamente os cadastros que faltam\" para gerar Cliente, Unidade, Setor, Posto e Cargo ausentes, confira os nomes parecidos, a correspondência de valores (ex.: Leve = Baixa) e as linhas duplicadas, e confirme. A Graduação do Risco é gravada exatamente como veio; as linhas em que ela difere da matriz do S.I.G.E. ficam marcadas na prévia. Reimportar o mesmo arquivo não duplica.",
        "Laudo do sistema anterior (migração completa): depois de importar a planilha, em AEP › Importar Excel › Laudo da AEP do sistema anterior (PDF), envie o laudo correspondente. O SIGE lê cada posto (seção 4.N), a data, a jornada, as características dos trabalhadores, as pausas, o histórico de acidentes, a descrição da atividade (com a máquina/linha/célula) e a descrição do setor, as fotos na resolução original e os fatores de risco (circunstância, consequência, medida de controle, criticidade, probabilidade, pontuação, graduação e as ações). Na conferência, cada posto aparece ligado à AEP da planilha (exata ou a mais parecida, que você pode trocar) ou como AEP nova. Opções: trocar campos já preenchidos, criar os fatores que faltam, levar as ações do laudo ao Plano de Ação e guardar o PDF antigo em AEP › Laudos. Rodar de novo não duplica fotos, fatores nem ações.",
      ],
    },
    {
      titulo: "Plano de Ação e avisos",
      objetivo: "Conduzir as ações corretivas e preventivas até a conclusão, com rastreabilidade e evidência.",
      perfis: "Administrador e Consultor lançam as ações; o responsável designado executa.",
      passos: [
        "O Plano de Ação é único e independente: recebe as ações propostas no Inventário de Riscos da AEP e as escolhidas na Análise de risco do Psicossocial e as da AET. A coluna Origem mostra de onde veio cada ação. No Plano não se cria ação nova: a descrição, o segmento e a redução do risco vêm da origem; aqui se definem Responsável, E-mail, Prazo, conclusão e evidência. Com responsável, e-mail e prazo preenchidos, o responsável recebe o e-mail automaticamente; nas ações da AET, o e-mail leva a(s) foto(s) da atividade no corpo da mensagem (e também nos lembretes do prazo).",
        "O link “✕ Excluir responsável e prazo”, abaixo do responsável, apaga de uma vez o prazo, o responsável e o e-mail da ação: ela volta para “Não iniciada” e o responsável deixa de receber os avisos.",
        "A Gestão do Plano de Ação vem logo depois da Gestão de Riscos. No topo, o filtro de origem (Todas, Ações AEP, Ações AET ou Psicossocial), que vale para os gráficos e para a lista. Depois, os indicadores das ações (status global, postos críticos, Inventário de Riscos por status, previstas, concluídas, por responsável e por setor) e a lista de todas as ações, com os filtros Unidade, Setor / GHE, Status e Buscar, o resumo por status (clique num status para filtrar) e as colunas Origem, Unidade / setor · posto, Ação, Prazo, Responsável, E-mail e Status.",
        "Na própria linha, informe o Prazo (previsão de conclusão), o Responsável e o E-mail. O e-mail só é liberado depois do prazo. Ao informar o e-mail, o responsável recebe o aviso da ação automaticamente (a linha mostra \"enviado em\" e o link reenviar) e passa a receber os lembretes do prazo. Apagando o e-mail, o responsável deixa de receber e-mails da ação; tirando o prazo, o e-mail também sai. O botão Concluir abre a ação para a conclusão com evidência (e a reavaliação do risco, quando for o caso).",
        "O status é automático: sem prazo, Não iniciada; com prazo, Em andamento; prazo vencido e não concluída, Atrasada. Concluída a execução, informa-se a data de conclusão e o status passa a Concluída (ou Concluída com atraso). A conclusão exige evidência (foto JPG/PNG ou PDF, até 15 MB). O Administrador pode registrar exceção mediante justificativa e prazo para entrega da evidência.",
        "Ação que reduz o risco (AEP e AET): ao concluir, abre-se a reavaliação do fator (nova Probabilidade e Severidade, ou Risco eliminado), que atualiza o Inventário, o risco do posto, o gráfico de evolução mensal e o próximo laudo. Ações do Psicossocial concluem só com a evidência (o risco psicossocial muda na reaplicação do projeto).",
        "Revisão do laudo: a coluna Revisão do laudo mostra em qual revisão a ação apareceu pela primeira vez (\"A emitir\" enquanto nenhum laudo a incluiu). Ao emitir um laudo da AEP ou do Psicossocial, as ações dele ainda sem revisão recebem a revisão do laudo; as ações antigas ficam como histórico.",
        "O sino, na barra superior, lista as ações com vencimento em até 30 dias e as atrasadas. O responsável também recebe lembretes por e-mail antes do prazo, no vencimento e durante o atraso.",
      ],
    },
    {
      titulo: "Absenteísmo, HHT / Taxa de frequência e Restritos (Cadastro Empresa)",
      objetivo: "Alimentar a Taxa de Frequência e o acompanhamento de restrições médicas e recolocações.",
      perfis: "Administrador e Consultor.",
      passos: [
        "Em Cadastro Empresa › Absenteísmo, cada afastamento é registrado com o Segmento corporal (geral, sem direito/esquerdo: Ombro, Joelho, Lombar…), Dt Afastamento e Qtd Dias; a Dt Retorno é calculada pelo sistema. Registros antigos com lado entram no segmento geral (Ombro Direito conta como Ombro).",
        "Em Cadastro Empresa › HHT / Taxa de frequência, informam-se, por setor e mês, a quantidade de colaboradores e de dias úteis. A Taxa de Frequência (geral e por setor, na Gestão de Absenteísmo) é calculada como (nº de afastamentos ÷ HHT) × 1.000.000, em que HHT = colaboradores × dias úteis × 8 h (NBR 14280). A taxa de frequência do Psicossocial continua digitada no próprio módulo.",
        "Em Cadastro Empresa › Restritos, cada restrição médica é cadastrada individualmente (+ Novo registro) ou por planilha (Importar Excel), com Segmento Corporal, Status Restrição (Ativa, Em Avaliação ou Encerrada) e indicação de Atividade Compatível.",
        "HHT / Dias Úteis e Restritos (Compatíveis) podem ser carregados por planilha: botão \"Importar Excel\" › baixar o modelo (.xlsx), preencher, enviar o arquivo e conferir a prévia. Nada é gravado até \"Confirmar importação\"; linhas com erro são ignoradas e podem ser baixadas para correção. Registros já existentes (mesmo Setor e mês, ou mesmo Cliente, Matrícula e início da restrição) são atualizados, não duplicados.",
        "O botão \"Baixar dados atuais\" gera a planilha com os registros vigentes, para edição em lote no Excel e reenvio. Cliente, Unidade e Setor precisam estar cadastrados (aba Cadastro); a aba \"Referências\" do modelo lista as combinações válidas.",
      ],
    },
    {
      titulo: "Laudos e Certificados de Calibração",
      objetivo: "Emitir o Laudo da AEP como documento com autoria identificada e verificação de autenticidade.",
      perfis: "Administrador e Consultor, com o ergonomista como responsável técnico.",
      passos: [
        "O texto do laudo da AEP (AEP › Editor de texto) e os Certificados de Calibração são bibliotecas compartilhadas entre todos os clientes. O Editor de Texto cobre todo o conteúdo do Laudo: capa, títulos das seções, parágrafos, listas, quadros, tabelas de apoio, escalas e conclusão. Cada campo mostra exatamente o texto que sai no laudo; o que foi alterado em relação ao padrão ElevaLife ganha a marca \"alterado\" e o botão \"Restaurar padrão\". Severidade, probabilidade e graduações têm uma versão para a Matriz 5x5 Gerdau, usada nos laudos dos clientes com essa matriz. Os cabeçalhos das colunas das tabelas e os dados do cliente seguem fixos.",
        "Antes da primeira emissão, cadastre os ergonomistas em Cadastro Interno › Ergonomistas, com registro profissional e imagem da assinatura.",
        "Em AEP › Laudos ficam os laudos da AEP já emitidos (data, abrangência, revisão, quem emitiu e código). \"📄 Emitir laudo\" abre a emissão: escolha o recorte em cascata — sem unidade sai o laudo da empresa toda; só a unidade, a unidade toda; unidade e setor, o setor todo; e assim por diante (cargo e posto) —, o responsável técnico e os certificados de calibração, e acione \"Gerar Laudo\". Os certificados marcados saem no próprio arquivo do laudo, no final (uma página por certificado; PDF de várias páginas sai página a página). Em uma única ação, o sistema monta o PDF e o Word (.docx) com as AEPs, o Inventário de Riscos e o Plano de Ação atuais, anexa os dois arquivos e registra o laudo no histórico. Cada posto traz o número da AEP e a data da última atualização; a metodologia segue a matriz do cliente.",
        "Padrão ElevaLife de laudo: o laudo da AEP e o laudo de Riscos Psicossociais saem com a mesma formatação, em PDF e em Word (.docx editável): capa com os dados do documento, sumário, cabeçalho com código e revisão, rodapé \"Página X de Y\", títulos numerados, assinaturas, ciência do cliente e validação por QR Code. O laudo psicossocial é emitido no módulo (Laudo › Emitir laudo) e também entra no histórico de laudos do cliente, com código de verificação conferível em /verificar.",
        "O Word é o documento editável: na lista de Laudos, o botão \"⬇ Word\" baixa o arquivo. O sumário é um campo do Word; ao abrir, se o Word perguntar sobre atualizar campos, confirme (ou clique com o botão direito no sumário › Atualizar campo) para obter os números de página. O PDF e o Word usam o mesmo texto do Editor de Texto. A impressão digital (SHA-256) e a verificação referem-se ao PDF. Laudos emitidos antes da V 1.9 não têm Word; gere novamente para obtê-lo.",
        "\"Salvar sem gerar\" registra o laudo sem montar o PDF, por exemplo, para anexar um documento emitido fora do sistema ou corrigir dados de um laudo existente.",
        "A autenticidade pode ser conferida em sige-ergo.elevalife.com.br/verificar, pelo código ou pelo QR Code, com comparação do arquivo por meio do hash SHA-256.",
      ],
    },
    {
      titulo: "AET (Análise Ergonômica do Trabalho)",
      objetivo: "Fazer a AET dentro do sistema, por posto de trabalho e cargo, atividade por atividade, com ferramentas ergonômicas, riscos no Inventário, ações no Plano de Ação e laudo próprio.",
      perfis: "Ergonomistas (Administrador e Consultor). Usuário Cliente apenas consulta.",
      passos: [
        "Na aba AET, clique em “+ Nova AET”. Em 1. Identificação escolha Cliente, Unidade, Setor / GHE, Posto e Cargo (mesmo cadastro do Cadastro Cliente), a data e o ergonomista. A matriz de risco usada é a cadastrada no cliente.",
        "Preencha setor, população e cargo; organização do trabalho; demandas cognitivas e psicossociais; posto de trabalho com a foto geral (até 2 fotos); ambiente com as medições; manifestações, ciclo de trabalho e cargas.",
        "Em 8. Atividades, adicione cada atividade do posto: nome, descrição detalhada e até 4 fotos. Em cada atividade, adicione os fatores de risco (lista ISO/TS 20646 por grupo ou “Outro”), consequência e segmento acometido.",
        "Em cada fator aplique uma ou mais ferramentas ergonômicas (Strain Index, RULA, REBA, HAL/ACGIH, QEC, Rodgers, PLIBEL, NIOSH, Checklist OCRA, OCRA tradicional, ROSA, KIM-LHC, KIM-PP, Liberty Mutual / Snook, ERGOS, NASA-TLX, ICE e Check NR-17). O resultado e o memorial de cálculo aparecem na hora. Ao escolher o fator, o SIGE mostra as ferramentas recomendadas para ele (★ = a mais indicada) — clique para aplicar — e, no “+ Aplicar ferramenta…”, as recomendadas vêm primeiro.",
        "Ferramenta que já considera o tempo de exposição define o risco. Ferramenta sem tempo de exposição dá a severidade, que é cruzada com a probabilidade (exposição na jornada) na matriz do cliente. Sem ferramenta, informe severidade e probabilidade. Com várias ferramentas, vale a maior graduação. PLIBEL, NASA-TLX e Check NR-17 não classificam: o ergonomista atribui o nível.",
        "Proponha as ações de cada fator (mesmo editor da AEP): em “Recomendações padronizadas para este fator” aparecem as ações indicadas para o fator e o nível de risco (eliminação, engenharia/adequação e organizacionais, com a complexidade); “+ Usar” inclui a ação e o texto pode ser ajustado. Para uma ação que não está na lista, use “+ Outra ação (digitar)”. As fotos grandes da atividade são reduzidas no envio (até 1920 px). Ao salvar, cada fator vai para o Inventário de Riscos e cada ação para o Plano de Ação, com a origem AET. Reabrir e mudar as entradas do fator recalcula o risco e registra no histórico (Reavaliação na AET).",
        "Use “Sugerir texto a partir das atividades” para o diagnóstico global do posto.",
        "Em cada ferramenta, as imagens de referência da planilha de ferramentas (posturas, posições, equipamentos) aparecem junto do campo correspondente; clique numa imagem para ampliar.",
        "AET › Laudos: escolha a empresa e o recorte em cascata (sem unidade = empresa toda; unidade; unidade e setor; cargo; posto), o executor, o responsável técnico e os certificados de calibração (saem no final do laudo). Saem o PDF e o Word com foto geral e fotos por atividade, o memorial de cálculo de cada ferramenta (dados preenchidos, cálculo e resultado), código de validação e QR Code; abaixo fica o histórico dos laudos da AET emitidos, com download do PDF e do Word.",
        "AET › Editor de texto: cada campo mostra exatamente o texto que sai no laudo da AET, com a marca \"alterado\" e \"Restaurar padrão\".",
        "AET › Importar AET: anexe uma AET em Word (.docx) ou PDF, no modelo ElevaLife ou de outras empresas. O SIGE lê empresa, setor, posto, cargo, organização do trabalho, demandas, ambiente e medições, ciclo, cargas, atividades com descrição, fatores de risco (consequência, metodologia, severidade, probabilidade e grau) e o diagnóstico; do Word vêm também as fotos. Na conferência você escolhe a empresa e confirma unidade, setor, posto e cargo (o que não existir é cadastrado); a AET abre no editor já preenchida para completar e salvar. Fatores sem ferramenta preenchida usam a severidade e a probabilidade do documento ou o grau de risco informado, até o ergonomista revisar.",
      ],
    },
    {
      titulo: "Usuários e perfis",
      objetivo: "Definir quem acessa o sistema, com qual escopo, e padronizar parâmetros comuns a todos os clientes.",
      perfis: "Administrador e Consultor (Cadastro Interno › Usuários).",
      passos: [
        "Administrador: visualiza todas as empresas e gerencia usuários. Consultor: visualiza as empresas vinculadas e pode convidar usuários. Usuário Cliente: consulta somente as empresas vinculadas, não acessa o Cadastro Cliente nem o Cadastro Interno e, na AEP, no Plano de Ação e na AET, apenas consulta e baixa em Excel.",
        "Para conceder acesso: Cadastro Interno › Usuários › Novo usuário, informando e-mail, perfil e empresas vinculadas. O convite é enviado por e-mail.",
      ],
    },
    {
      titulo: "Riscos Psicossociais",
      objetivo: "Avaliar os fatores de risco psicossociais (NR-01) com o HSE-IT e o checklist ISO 45003, integrar os riscos à Gestão de Riscos e as ações ao Plano de Ação e emitir o laudo.",
      perfis: "Administrador e Consultor (ergonomista) nas empresas vinculadas. O Usuário Cliente responde o ISO 45003, acompanha as respostas do HSE-IT e o plano de ação. As telas de resposta do QR code são públicas.",
      passos: [
        "Comece pelo Cadastro do SIGE: Cliente (com o serviço Riscos Psicossociais marcado e a Matriz de Risco), Unidade, Setor / GHE e Colaboradores. Não existe cadastro separado no módulo.",
        "Diagnóstico organizacional: envie o QR code do checklist ISO 45003 ao gestor do contrato (ou preencha pela ElevaLife) e informe a taxa de frequência de afastamentos de cada setor/GHE, e os casos graves (a taxa de frequência define a evidência organizacional). Ali também ficam as ações já realizadas pela empresa e a planilha de solicitação ao cliente.",
        "HSE-IT: divulgue o QR code da coleta (ou o código curto). Cada colaborador responde uma única vez com a matrícula; a matrícula não fica ligada às respostas. Depois de confirmar a matrícula, o colaborador lê o termo de consentimento (LGPD) e escolhe: aceitar e responder, ou não aceitar. Quem não aceita conta como participação (\"não aceitou o termo\"), sem nenhuma resposta; a adesão, os gráficos e o laudo mostram as duas quantidades. A aba mostra a adesão por unidade e setor/GHE e os resultados.",
        "Análise de risco: resumo por empresa, unidade e setor/GHE, com probabilidade, severidade e graduação de cada um dos 7 fatores, e gráfico com a quantidade de fatores por graduação (com filtros). A matriz é a do cadastro do cliente.",
        "Integração com o SIGE: cada fator classificado de cada setor/GHE entra no Inventário de Riscos com a origem Psicossocial (e, pela maior graduação, no risco do setor/GHE na Gestão de Riscos); cada ação escolhida na Análise de risco vai para o Plano de Ação com a origem Psicossocial.",
        "Ações: na Análise de risco ficam a escolha das ações por setor/GHE (recomendadas pelo sistema, ajustáveis) e as ações já realizadas para risco baixo. Responsável, prazo, e-mail e status são definidos no Plano de Ação do SIGE (botão \"Abrir no Plano de Ação do SIGE\"); a aba Plano de ação do módulo deixou de existir.",
        "Laudo: escolha o ergonomista e o responsável técnico (do cadastro de Ergonomistas do SIGE) e emita o PDF e o Word. O laudo traz a aplicação do projeto, o código e a revisão, e termina com assinaturas, ciência do cliente e QR Code de validação (conferível em /verificar). Os textos padrão ficam no Editor de texto (edição só pelo Administrador).",
        "Reaplicação do projeto: em HSE-IT › Aplicações do projeto, \"Reaplicar o projeto\" encerra a aplicação atual e abre a seguinte, com nova coleta do HSE-IT (todos podem responder de novo), novo ISO 45003, nova taxa de frequência e nova análise; cada aplicação gera o seu laudo (nova revisão, com comparativo com as aplicações anteriores). O cadastro continua o do SIGE e pode ser alterado (incluir ou excluir unidade, setor/GHE, colaborador). O Mapa de Risco e o Inventário passam a mostrar a aplicação mais recente assim que cada setor/GHE tiver resultado (a mudança de graduação entra no histórico do fator); as ações das aplicações anteriores ficam no Plano de Ação como histórico, com a revisão do laudo em que apareceram.",
        "Cópia de segurança (Diagnóstico organizacional, Administrador): \"Baixar respostas em Excel\" gera a planilha das respostas do HSE-IT de todas as aplicações, anônima (sem matrícula nem nome): aplicação, unidade, setor/GHE, data, situação e as 35 respostas (1 = Nunca a 5 = Sempre), com as abas Perguntas e escala e Resumo por setor-GHE. \"Cópia técnica (JSON)\" continua disponível para guardar todos os dados do módulo.",
      ],
    },
    {
      titulo: "Riscos Psicossociais: probabilidade, severidade e graduação",
      objetivo: "Explicar como cada fator do HSE-IT é graduado na matriz de risco do cliente.",
      perfis: "Todos os perfis.",
      passos: [
        "Graduação do fator no HSE-IT: média das respostas do setor/GHE em cada um dos 7 fatores (Demandas, Controle, Apoio da chefia, Apoio dos colegas, Relacionamentos, Cargo e Comunicação e mudanças), com os itens negativos invertidos. Média ≥ 4,61 = muito baixa; ≥ 4,00 = baixa; ≥ 3,00 = moderada; ≥ 2,00 = alta; abaixo = muito alta.",
        "Checklist ISO 45003: 33 itens (Sim = 1, Parcial = 0,5, Não = 0). De 24 a 33 pontos, gestão eficaz; de 17 a 23,5, gestão intermediária; abaixo de 17, gestão ineficaz.",
        "Probabilidade: a graduação do fator no HSE-IT é cruzada com o resultado do ISO 45003, resultando em uma probabilidade de 1 a 5 (ex.: graduação alta com gestão intermediária = 4). Esse valor é levado à escala da matriz do cliente por equivalência de nomes: na 5x5, direto (1 a 5); na 4x4, muito baixa e baixa = Leve, moderada = Média, alta = Alta e muito alta = Muito Alta; na 3x3, muito baixa e baixa = Leve, moderada = Média, alta e muito alta = Alta.",
        "Severidade Intrínseca do Fator (SIF): fixa por fator, definida pela literatura científica (Manual SIF ElevaLife): Demandas, Relacionamentos e Apoio da chefia = 4 (crítica); Controle, Apoio dos colegas, Cargo e Comunicação e mudanças = 3 (alta).",
        "Evidência organizacional (EO): definida pela taxa de frequência de afastamentos dos últimos 12 meses do setor/GHE (menor que 2% = 1; de 2% a menos de 5% = 2; de 5% a 20% = 3; acima de 20% = 4; casos graves registrados = 5), sem ajuste manual. O valor ajustado (EOaj) vai de 0 a 4.",
        "Severidade final: SF = SIF × 0,75 + EOaj × 0,25 (de 0,75 a 4,00), enquadrada no nível inteiro mais próximo, com 0,50 para cima (Tabela 6 do Manual SIF): 1 Baixa, 2 Moderada, 3 Alta, 4 Crítica. Na matriz do cliente: 4x4, direto (Leve, Média, Alta, Muito Alta); 5x5, Baixa = coluna 1, Moderada = 3, Alta = 4, Crítica = 5; 3x3, Baixa = Leve, Moderada = Média, Alta e Crítica = Alta.",
        "Graduação: a probabilidade e a severidade são cruzadas na matriz do cliente, a mesma do Inventário de Riscos (matrizes modelo ElevaLife 3x3, 4x4 e 5x5; pontuação = probabilidade × severidade, com a graduação de cada célula definida na matriz). A graduação do setor/GHE é a do fator de maior risco. Cores: muito baixo azul-claro, baixo verde, moderado amarelo, alto vermelho e muito alto/altíssimo roxo.",
        "Ações: setores/GHE com risco moderado ou acima recebem ações da Biblioteca Mestre de Intervenções Psicossociais, escolhidas pelos itens com mais respostas desfavoráveis (moderado: 5 ações; alto: 7; altíssimo/muito alto: 9), priorizando medidas coletivas e organizacionais. Nos de risco baixo, mantêm-se as ações já realizadas pela empresa.",
      ],
    },
  ];

  // ------------------------------------------------------------------
  // FLUXOS (BPMN). tipo: inicio | fim | tarefa | decisao
  // lane = indice da raia; col = coluna (esquerda -> direita).
  // ------------------------------------------------------------------
  const FLUXOS = [
    {
      titulo: "Riscos Psicossociais",
      resumo: "Do cadastro do cliente ao laudo, com os riscos levados à Gestão de Riscos e as ações ao Plano de Ação.",
      lanes: ["Equipe ElevaLife", "Cliente", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Cliente com o serviço Riscos Psicossociais" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Cadastra unidades, setores/GHE e colaboradores" },
        { id: "c", tipo: "tarefa", lane: 1, col: 2, texto: "Colaboradores respondem o HSE-IT (QR code)" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Gestor responde o checklist ISO 45003" },
        { id: "e", tipo: "tarefa", lane: 0, col: 2, texto: "Informa a taxa de frequência por setor/GHE" },
        { id: "f", tipo: "tarefa", lane: 2, col: 4, texto: "Gradua os 7 fatores na matriz do cliente" },
        { id: "g", tipo: "decisao", lane: 2, col: 5, texto: "Moderado ou acima?" },
        { id: "h", tipo: "tarefa", lane: 2, col: 6, texto: "Recomenda ações e leva ao Plano de Ação" },
        { id: "i", tipo: "tarefa", lane: 0, col: 6, texto: "Define prazo e responsável (e-mail)" },
        { id: "j", tipo: "fim", lane: 0, col: 7, texto: "Emite o laudo em PDF" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["b", "e"], ["d", "f"], ["e", "f"], ["f", "g"], ["g", "h", "Sim"], ["g", "j", "Não"], ["h", "i"], ["i", "j"]],
    },
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
        { id: "f", tipo: "tarefa", lane: 0, col: 5, texto: "Em Cadastro Cliente: Unidade, Setor/GHE, Colaboradores, Cargo, Posto e Atividade" },
        { id: "g", tipo: "fim", lane: 0, col: 6, texto: "Estrutura pronta" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"], ["f", "g"]],
    },
    {
      titulo: "Avaliação em campo (AEP) e risco do posto",
      resumo: "Da visita ao posto até o risco do posto calculado (maior graduação dos fatores), com ou sem internet.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Visita ao posto" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Abre a AEP do posto e cargo (aba AEP)" },
        { id: "c", tipo: "decisao", lane: 0, col: 2, texto: "Tem internet?" },
        { id: "d", tipo: "tarefa", lane: 0, col: 3, texto: "Preenche, fotografa e salva" },
        { id: "e", tipo: "tarefa", lane: 1, col: 3, texto: "Guarda na fila do aparelho" },
        { id: "f", tipo: "tarefa", lane: 1, col: 4, texto: "Envia sozinho quando a conexão volta" },
        { id: "g", tipo: "tarefa", lane: 0, col: 5, texto: "No Inventário, marca os fatores (todos os campos) e Probabilidade × Criticidade" },
        { id: "h", tipo: "tarefa", lane: 1, col: 6, texto: "Calcula a graduação pela matriz do cliente" },
        { id: "i", tipo: "tarefa", lane: 0, col: 7, texto: "Propõe as ações de cada fator" },
        { id: "j", tipo: "tarefa", lane: 1, col: 8, texto: "Risco do posto = maior graduação; ações vão ao Plano de Ação" },
        { id: "k", tipo: "fim", lane: 1, col: 9, texto: "Posto na Gestão de Riscos" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d", "Sim"], ["c", "e", "Não"], ["d", "g"], ["e", "f"], ["f", "g"],
        ["g", "h"], ["h", "i"], ["i", "j"], ["j", "k"]],
    },
    {
      titulo: "Do risco ao Plano de Ação",
      resumo: "Como a ação proposta na AEP ou no Psicossocial chega ao Plano de Ação único, ao aviso, à execução e ao indicador.",
      lanes: ["Ergonomista", "Responsável", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Ação proposta na AEP ou no Psicossocial" },
        { id: "b", tipo: "decisao", lane: 0, col: 1, texto: "Prazo definido?" },
        { id: "c", tipo: "fim", lane: 1, col: 2, texto: "Fica Não iniciada" },
        { id: "d", tipo: "tarefa", lane: 0, col: 2, texto: "No Plano de Ação: prazo, responsável e depois o e-mail" },
        { id: "e", tipo: "tarefa", lane: 2, col: 3, texto: "E-mail ao informar o e-mail e lembretes de prazo" },
        { id: "f", tipo: "tarefa", lane: 1, col: 4, texto: "Executa a ação" },
        { id: "g", tipo: "tarefa", lane: 1, col: 5, texto: "Informa a Dt Conclusão e anexa a evidência" },
        { id: "j", tipo: "decisao", lane: 0, col: 6, texto: "Ação marcada para reduzir o risco (AEP/AET)?" },
        { id: "k", tipo: "tarefa", lane: 0, col: 7, texto: "Reavalia: nova Probabilidade e Severidade ou Risco eliminado" },
        { id: "h", tipo: "tarefa", lane: 2, col: 8, texto: "Atualiza status, histórico do fator e indicadores" },
        { id: "i", tipo: "fim", lane: 2, col: 9, texto: "Evolução mensal em Gestão de Riscos" },
      ],
      fluxo: [["a", "b"], ["b", "c", "Não"], ["b", "d", "Sim"], ["d", "e"], ["e", "f"], ["f", "g"], ["g", "j"], ["j", "k", "Sim"], ["j", "h", "Não"], ["k", "h"], ["h", "i"]],
    },
    {
      titulo: "Emissão de Laudo",
      resumo: "Da avaliação concluída ao laudo emitido, com PDF anexado e código de verificação.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Avaliação concluída" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Em AEP › Laudos (ou AET › Laudos), aciona Emitir laudo" },
        { id: "c", tipo: "tarefa", lane: 0, col: 2, texto: "Escolhe o recorte (unidade › setor › cargo › posto), responsável e certificados; Gerar" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Monta PDF e Word com os certificados no final e registra no histórico (código, hash e QR Code)" },
        { id: "e", tipo: "tarefa", lane: 0, col: 4, texto: "Confere o documento emitido" },
        { id: "f", tipo: "fim", lane: 0, col: 5, texto: "Laudo emitido" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"]],
    },
    {
      titulo: "AET no sistema",
      resumo: "Da AET por posto e atividade até o Inventário, o Plano de Ação e o laudo.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "+ Nova AET (posto e cargo)" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Atividade: descrição, fotos e fatores" },
        { id: "c", tipo: "tarefa", lane: 0, col: 2, texto: "Ferramentas e ações recomendadas pelo fator (ou outra ação digitada)" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Gradua pela matriz do cliente" },
        { id: "e", tipo: "tarefa", lane: 1, col: 4, texto: "Inventário e Plano de Ação (origem AET)" },
        { id: "f", tipo: "fim", lane: 0, col: 4, texto: "Emite o laudo da AET" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"]],
    },
    {
      titulo: "Migração do sistema anterior (planilha + laudo)",
      resumo: "Da planilha e do laudo do sistema anterior às AEPs completas no SIGE, com fotos, fatores e ações.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Planilha e laudo (PDF) do sistema anterior" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "AEP › Importar Excel: importa a planilha" },
        { id: "c", tipo: "tarefa", lane: 0, col: 2, texto: "Envia o laudo PDF correspondente" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Lê postos, textos, fotos, fatores e ações" },
        { id: "e", tipo: "tarefa", lane: 0, col: 4, texto: "Confere a ligação de cada posto à AEP" },
        { id: "f", tipo: "fim", lane: 1, col: 5, texto: "AEPs completas, Inventário, Plano e laudo antigo guardado" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"]],
    },
    {
      titulo: "AET importada (Word ou PDF)",
      resumo: "Como uma AET feita fora do sistema vira uma AET do SIGE, com cadastro, riscos e ações.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "AET em Word ou PDF" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "AET › Importar AET: anexa o arquivo" },
        { id: "c", tipo: "tarefa", lane: 1, col: 2, texto: "Lê setor, posto, cargo, atividades, fatores e fotos" },
        { id: "d", tipo: "tarefa", lane: 0, col: 3, texto: "Confere empresa, unidade, setor, posto e cargo" },
        { id: "e", tipo: "tarefa", lane: 1, col: 4, texto: "Cadastra o que falta e abre a AET no editor" },
        { id: "f", tipo: "fim", lane: 0, col: 5, texto: "Completa e salva a AET" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"]],
    },
    {
      titulo: "Certificado de calibração",
      resumo: "Do cadastro do certificado ao aviso de vencimento e ao laudo.",
      lanes: ["Ergonomista", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Instrumento calibrado" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Cadastro Interno › Certificado: validade e arquivo (PDF ou imagem)" },
        { id: "c", tipo: "tarefa", lane: 0, col: 2, texto: "Marca o certificado ao emitir o laudo" },
        { id: "d", tipo: "tarefa", lane: 1, col: 3, texto: "Coloca as páginas do certificado no final do laudo" },
        { id: "e", tipo: "tarefa", lane: 1, col: 4, texto: "30 dias antes de vencer: e-mail aos Administradores" },
        { id: "f", tipo: "fim", lane: 0, col: 5, texto: "Renova e atualiza o certificado" },
      ],
      fluxo: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "f"]],
    },
    {
      titulo: "Absenteísmo e Taxa de Frequência",
      resumo: "Como os afastamentos e as horas trabalhadas resultam na Taxa de Frequência.",
      lanes: ["Consultor", "Sistema"],
      nos: [
        { id: "a", tipo: "inicio", lane: 0, col: 0, texto: "Afastamento de colaborador" },
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Cadastro Cliente › Absenteísmo (segmento, dias)" },
        { id: "c", tipo: "tarefa", lane: 0, col: 2, texto: "Cadastro Cliente › HHT do mês" },
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
        { id: "b", tipo: "tarefa", lane: 0, col: 1, texto: "Cadastro Cliente › Restritos (individual ou Excel)" },
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
      versao: "1.37", data: "09/10/2026",
      itens: [
        "Ferramenta ergonômica recomendada para cada fator de risco: na AET, botões com as ferramentas indicadas (★ a mais indicada) que aplicam a ferramenta com um clique, e a lista “+ Aplicar ferramenta…” com as recomendadas primeiro; no checklist da AEP, as ferramentas indicadas para a avaliação aprofundada.",
        "Recomendações padronizadas de ações por fator e nível de risco, na AEP e na AET (os 42 fatores da ISO/TS 20646 e o fator “Outro”), na ordem da hierarquia de controle, com tipo e complexidade; “+ Usar” inclui a ação e “+ Outra ação (digitar)” mantém a ação livre do ergonomista.",
        "Laudo da AET: o memorial de cálculo de cada ferramenta traz os dados preenchidos (cada campo e a resposta), o cálculo e o resultado.",
        "Ação da AET: o e-mail ao responsável (atribuição e lembretes) leva a(s) foto(s) da atividade; fotos grandes da AET são reduzidas no envio.",
        "Plano de Ação: “✕ Excluir responsável e prazo” em cada ação.",
        "Excluir uma empresa apaga todos os dados dela (cadastros, AEP, AET, Inventário, Plano de Ação, laudos, arquivos e Riscos Psicossociais); dados de empresas excluídas antes desta versão deixam de aparecer e podem ser apagados em Cadastro Empresa › Cliente › “Dados de empresas excluídas”.",
      ],
    },
    {
      versao: "1.36", data: "09/10/2026",
      itens: [
        "Riscos Psicossociais: cópia de segurança das respostas do HSE-IT em Excel (anônima: unidade, setor/GHE, data e as 35 respostas), em Diagnóstico organizacional.",
        "Migração do laudo da AEP do sistema anterior (PDF), em AEP › Importar Excel: completa as AEPs da planilha com fotos (resolução original), jornada, pausas, características, histórico, descrições da atividade e do setor; cria os fatores que faltam e leva as ações ao Plano de Ação; guarda o PDF antigo no histórico de laudos. Conferência posto a posto, com a AEP ligada (sugerida) e sem duplicar ao rodar de novo.",
      ],
    },
    {
      versao: "1.35", data: "08/10/2026",
      itens: [
        "Menu na ordem AEP, AET, Psicossocial, Gestão de Riscos, Gestão do Plano de Ação, Gestão de Absenteísmo, Gestão de Restritos, Cadastro Empresa, Cadastro Interno e Ajuda. Usuários virou sub-aba do Cadastro Interno; a aba Configurações saiu.",
        "Serviços contratados no cadastro da empresa com todas as abas (AEP, AET, Psicossocial, Gestão de Riscos, Plano de Ação, Absenteísmo e Restritos).",
        "AEP com sub-abas Avaliações, Laudos, Importar Excel e Editor de texto; o Inventário de Riscos passa a ser consultado na Gestão de Riscos. AET com sub-abas AETs, Laudos, Importar AET e Editor de texto (texto igual ao do laudo).",
        "Gestão de Riscos: filtro de origem no topo; Risco Global dos Postos e Inventário em rosca com o total no centro e texto explicativo; Evolução mensal abaixo do risco por setor, com o total de cada mês e, ao clicar, os fatores por graduação, os reduzidos (de/para) e os eliminados; tabela do Inventário. Saíram Inventário - Prazos e AET - Arquivos anexados.",
        "Gestão do Plano de Ação: filtro de origem no topo (vale para gráficos e lista) e lista com texto quebrando dentro das colunas.",
        "Laudos da AEP e da AET com recorte em cascata (empresa toda, unidade, setor, cargo, posto), histórico dos emitidos e os certificados de calibração no próprio arquivo (PDF ou imagem, página a página).",
        "Importar AET em Word ou PDF (modelos variados), com conferência, cadastro do que falta e abertura no editor da AET.",
        "Imagens de referência das ferramentas ergonômicas (planilha de ferramentas) junto de cada campo.",
        "Certificado de calibração com validade obrigatória e e-mail aos Administradores 30 dias antes de vencer.",
      ],
    },
    {
      versao: "1.34", data: "08/10/2026",
      itens: [
        "Módulo AET completo: AET por posto de trabalho e cargo, com organização, demandas cognitivas, posto (foto geral), ambiente e medições, ciclo e cargas, e atividades com descrição, fotos, fatores de risco (ISO/TS 20646 ou outro) e ações.",
        "18 ferramentas ergonômicas da planilha com as métricas e o memorial de cálculo; mais de uma ferramenta por fator. Com tempo de exposição a ferramenta define o risco; sem, a severidade é cruzada com a probabilidade (exposição) na matriz do cliente.",
        "Riscos da AET no Inventário de Riscos e ações no Plano de Ação com a origem AET; reabrir a AET recalcula o risco e registra no histórico.",
        "Laudo da AET (PDF e Word) no padrão dos laudos do sistema, com foto geral e fotos por atividade, abrangência pelo filtro (empresa, unidade, setor / GHE, cargo ou posto), certificados do Cadastro Interno, QR Code e textos no Editor de Texto.",
      ],
    },
    {
      versao: "1.33", data: "08/10/2026",
      itens: [
        "Gestão de Risco como cenário de todos os riscos (AEP, AET e Psicossocial), sem indicadores de ações; novos gráficos AEPs e AETs realizadas mês a mês. Saíram Top Setores - Riscos em Aberto e Laudos e Certificados por Tipo.",
        "Plano de Ação logo depois da Gestão de Risco, com os indicadores das ações e o Status do Inventário de Riscos, e a lista de todas as ações no formato do antigo plano do Psicossocial (filtros, resumo por status, prazo, responsável e e-mail na própria linha, coluna Origem).",
        "E-mail do responsável liberado só depois do prazo; ao informar o e-mail, o aviso sai automaticamente; sem e-mail, o responsável não recebe mais nada.",
        "Cadastro Interno: o Editor de Texto vem primeiro e abre direto no texto do laudo.",
      ],
    },
    {
      versao: "1.32", data: "08/10/2026",
      itens: [
        "Matriz 5x5 Gerdau com os nomes e as definições do cliente: probabilidade Muito Baixa a Muito Alta, severidade Brando a Muito Crítico e graduações Irrelevante, Tolerável, Moderado, Alto e Intolerável, no Inventário, nas ações, nos laudos da AEP e do Psicossocial e nos indicadores.",
        "Ações: \"Reduz o risco para\" com as graduações da matriz cadastrada no cliente.",
        "Editor de Texto: cada campo mostra exatamente o texto que sai no laudo, com a marca \"alterado\" e o botão \"Restaurar padrão\".",
        "Laudo da AEP: severidade sem citar doenças; \"severidade\" no lugar de \"gravidade\" nos textos da matriz.",
      ],
    },
    {
      versao: "1.31", data: "08/10/2026",
      itens: [
        "Segmentos \"Não identificado\" e \"Psicossocial\" em todas as escolhas de segmento (Inventário, Absenteísmo e Restritos) e nos gráficos (Psicossocial com o ícone de cérebro).",
        "Inventário: o segmento acometido passa a ser do fator (sai da ação); \"Gravidade\" passa a se chamar Severidade.",
        "Ações: tipo, ação escrita e marcação \"Esta ação vai reduzir ou eliminar o risco\" com a graduação esperada. Responsável, prazo e status só no Plano de Ação; concluir exige evidência.",
        "Reavaliação do risco ao concluir uma ação redutora (AEP e AET): nova Probabilidade e Severidade ou Risco eliminado, com histórico completo do fator (coluna Evolução do risco).",
        "Gestão de Risco: novo gráfico Evolução mensal dos riscos (fatores por graduação mês a mês, eliminados e reduzidos), clicável.",
        "Laudo da AEP: em cada fator, risco do fator, probabilidade, severidade e segmento acometido; ações com tipo e efeito no risco; riscos eliminados do posto; seção 10 Plano de ação e evolução dos riscos. O laudo mostra sempre o risco mais atual.",
        "Plano de Ação: coluna Revisão do laudo (as ações recebem a revisão do laudo em que apareceram).",
        "Riscos Psicossociais: reaplicação do projeto (cada aplicação com coleta, ISO 45003, taxa de frequência, análise e laudo próprios); Mapa de Risco e Inventário sempre da aplicação mais recente; ações anteriores ficam como histórico. Laudo com a aplicação, comparativo entre aplicações e QR Code de validação.",
      ],
    },
    {
      versao: "1.30", data: "08/10/2026",
      itens: [
        "Padrão único de laudo ElevaLife (js/laudo-padrao.js): AEP e Riscos Psicossociais com a mesma capa, sumário, cabeçalho com código e revisão, rodapé \"Página X de Y\", títulos, assinaturas, ciência do cliente e validação por QR Code.",
        "Laudo psicossocial também em Word (.docx) e registrado no histórico de laudos do cliente (AEP › Laudos), com código de verificação e impressão digital SHA-256 conferíveis em /verificar.",
        "Cores padronizadas em todo o sistema, nos laudos e nas planilhas: risco (muito baixo/trivial azul-claro, baixo verde, moderado amarelo, alto vermelho, muito alto/altíssimo roxo) e situação das ações (não iniciada laranja, em andamento amarelo, atrasada vermelho, concluída verde).",
        "Laudo da AEP: panorama e diagnóstico pelas graduações da matriz do cliente (ex.: Muito Baixo e Altíssimo na 5x5); tabela da matriz com as pontuações de cada graduação e a nota de que a graduação vem da célula da matriz; números do plano por situação nas cores padrão; na conclusão, quadro-resumo dos postos com os fatores determinantes e contagem de fatores por graduação em cada grupo da ISO/TS 20646 (melhorias trazidas do laudo psicossocial).",
        "Status da ação: com prazo definido e não vencido, a ação aparece como Em andamento também nos indicadores.",
      ],
    },
    {
      versao: "1.29", data: "08/10/2026",
      itens: [
        "Plano de Ação único e independente (menu próprio): recebe as ações da AEP e do Psicossocial (AET quando o módulo existir), com a coluna Origem. Aqui se definem responsável, e-mail, prazo, conclusão e evidência; status e e-mail automáticos. A aba Plano de ação do módulo Psicossocial saiu: a escolha das ações e as ações já realizadas ficam na Análise de risco.",
        "Gestão de Risco: o risco do posto passa a ser a maior graduação entre os seus fatores (AEP, Psicossocial e AET), no lugar do Mapa de Risco manual de 12 notas. Gráficos continuam clicáveis.",
        "Filtro único com a nova Origem (AEP, AET ou Psicossocial) e o rótulo Setor / GHE.",
        "Absenteísmo, HHT / Taxa de frequência e Restritos foram para o Cadastro Cliente; a aba Registro deixou de existir. Absenteísmo com segmento corporal geral (sem direito/esquerdo) e diagrama ajustado.",
        "AET com aba própria, preparada para o módulo em desenvolvimento.",
        "Laudo da AEP: risco do posto (maior graduação dos fatores) em cada posto e na metodologia.",
      ],
    },
    {
      versao: "1.28", data: "08/10/2026",
      itens: [
        "Filtro geral: o filtro Cliente mostra só os clientes vinculados ao usuário, e todas as abas respondem a ele, inclusive Riscos Psicossociais (com um cliente filtrado, abre a página dele).",
        "Menu reorganizado: Cadastro Cliente no topo (Cliente, Unidade, Setor / GHE, Colaboradores, Cargo, Posto de Trabalho, Atividade); nova aba Cadastro Interno (Certificado de calibração, Editor de texto, Ergonomistas); nova aba AEP (Avaliações, Inventário de Riscos e Laudos).",
        "AEP por posto e cargo, sem atividade, com número por cliente (AEP-001…), data e ergonomista do cadastro e da última atualização, histórico de atualizações e \"Mais detalhes\" reformulado. Avaliações antigas do mesmo posto e cargo são juntadas em uma só.",
        "Inventário: fator \"Ruído inadequado\"; lista padrão de consequências por fator; nada é salvo com campo em branco; repetir um fator com todas as informações, com contador de cadastros. Ações sem responsável/e-mail/prazo (ficam no Plano de Ação), risco atual automático e opção de ação organizacional / de controle quando não reduz a graduação.",
        "Laudo: emissão pelo cliente do filtro geral, com histórico de laudos emitidos e abrangência (empresa toda, unidade, setor, cargo ou posto); cada posto traz o número da AEP e a data da última atualização.",
      ],
    },
    {
      versao: "1.27", data: "07/10/2026",
      itens: [
        "SIGE e Riscos Psicossociais viram um pacote único: um só cadastro de empresa (com os serviços contratados e a matriz de risco), Setor / GHE, Colaboradores e Ergonomistas no Cadastro do SIGE.",
        "Abas de serviço não contratado continuam no menu, com o aviso para procurar o time de especialistas da ElevaLife.",
        "Riscos Psicossociais: Diagnóstico organizacional (ISO 45003 + taxa de frequência), Análise de risco com resumo por fator e gráfico com filtros, graduação pela matriz do cliente; riscos e ações levados ao Mapa de Risco, Inventário de Riscos e Plano de Ação do Registro (cada linha conta 1).",
        "Usuários: uma lista única de empresas vinculadas (ergonomista e cliente só acessam as suas). O cliente não acessa o Cadastro e, no Registro, só consulta e baixa em Excel. Botão Baixar Excel em cada aba do Cadastro e do Registro. Plano de ação em Excel mais enxuto e prazo em branco quando não informado.",
      ],
    },
    {
      versao: "1.25", data: "07/10/2026",
      itens: ["Riscos Psicossociais com subabas no menu lateral (Cadastro de empresa, Colaboradores, Checklist ISO 45003, HSE-IT, Severidade, Probabilidade, Análise de risco, Plano de ação, Laudo, Ergonomistas e Editor de texto), ocupando a tela inteira; acesso por perfil (Administrador, Ergonomista e Cliente); plano de ação com prazo, responsável e e-mail, aviso automático por e-mail ao responsável e gráfico de status; laudo emitido em PDF com textos editáveis no Editor de texto; gráficos no padrão do SIGE."],
    },
    {
      versao: "1.24", data: "07/10/2026",
      itens: ["Riscos Psicossociais preparado para empresas com até 10 mil colaboradores: listagens paginadas, envio do questionário à prova de queda de conexão (sem perder nem duplicar respostas), novas tentativas automáticas, importação mais rápida, exclusão de empresa em lotes no servidor e cópia de segurança dos dados em JSON."],
    },
    {
      versao: "1.23", data: "07/10/2026",
      itens: ["Riscos Psicossociais: sumário do laudo já preenchido com os títulos, conclusão detalhada pela nova metodologia (grupos ocupacionais e quantidade de fatores por graduação), referências bibliográficas ampliadas e movidas para o final do documento."],
    },
    {
      versao: "1.22", data: "06/10/2026",
      itens: ["Riscos Psicossociais: texto do laudo mais natural na análise de cada fator (sem a conta da severidade final) e graduação do risco de cada fator em tabela (probabilidade, severidade e graduação); matriz 4 × 4 igual ao modelo ElevaLife."],
    },
    {
      versao: "1.21", data: "06/10/2026",
      itens: ["Riscos Psicossociais: ao abrir a aba, o menu lateral do SIGE é recolhido e o módulo ocupa a largura toda da tela (layout de computador também em notebooks)."],
    },
    {
      versao: "1.20", data: "06/10/2026",
      itens: ["Riscos Psicossociais: a planilha do plano de ação deixa de ter a aba Resumo por GHE."],
    },
    {
      versao: "1.19", data: "06/10/2026",
      itens: ["Riscos Psicossociais: no laudo, o resultado geral da empresa segue o mesmo padrão dos GHEs (interpretação por fator, quadro-resumo e graduação)."],
    },
    {
      versao: "1.18", data: "06/10/2026",
      itens: ["Riscos Psicossociais: matriz 5 × 5 igual ao modelo ElevaLife (inclui a célula de risco trivial)."],
    },
    {
      versao: "1.17", data: "06/10/2026",
      itens: [
        "Riscos Psicossociais: novo padrão de cores das graduações (muito baixo/trivial azul claro, baixo verde, moderado amarelo, alto vermelho, muito alto roxo), laudo com interpretação de probabilidade, severidade e graduação por fator e quadro-resumo por GHE, e plano de ação em Excel com probabilidade e severidade do fator.",
      ],
    },
    {
      versao: "1.16", data: "06/10/2026",
      itens: [
        "Riscos Psicossociais: severidade conforme o Manual SIF ElevaLife (SIF fixa por domínio, Severidade Final = SIF × 0,75 + EOaj × 0,25, evidência organizacional ajustável por GHE), matriz de risco 5 × 5 e referências do manual no laudo.",
      ],
    },
    {
      versao: "1.15", data: "06/10/2026",
      itens: [
        "Riscos Psicossociais: nova metodologia de severidade (SIF de cada fator do HSE cruzada com a evidência organizacional obtida da taxa de frequência), classificação de risco por fator e por GHE, tela em formato de computador com as etapas em ordem de preenchimento, referências bibliográficas editáveis e ajustes de texto no laudo.",
      ],
    },
    {
      versao: "1.14", data: "06/10/2026",
      itens: [
        "Novo módulo Riscos Psicossociais (versão de testes): coleta do questionário HSE-IT por QR code com matrícula (resposta única e anônima), checklist ISO 45003 respondido pelo gestor do contrato, análise de risco (matriz 4x4 ou 5x5) com a taxa de frequência por GHE, plano de ação com a Biblioteca Mestre de 450 ações e relatório em Word gerado automaticamente.",
      ],
    },
    {
      versao: "1.13", data: "06/10/2026",
      itens: [
        "Importação única do histórico do sistema anterior: ao importar o relatório de Inventário de Riscos, o SIGE cria os cadastros que faltam, a Avaliação Ergonômica (AEP) de cada posto/cargo (reaproveitando as que já existem) e grava os fatores de risco, tudo conferido numa única prévia. Se a planilha de inventário for escolhida na tela de AEP, o sistema redireciona sozinho para essa importação.",
      ],
    },
    {
      versao: "1.12", data: "06/10/2026",
      itens: [
        "Importação da Avaliação Ergonômica (AEP): se a planilha for um Inventário de Riscos (traz Grupo, Fator, Criticidade, Probabilidade…), a prévia avisa para usar AEP › Inventário de Riscos (AEP) › Importar Excel, onde os fatores de risco são lidos.",
      ],
    },
    {
      versao: "1.11", data: "06/10/2026",
      itens: [
        "Importações do Inventário de Riscos e da AEP: Atividade e Data (da identificação / da avaliação) deixam de ser obrigatórias. Planilhas do sistema anterior que não trazem essas colunas entram com esses campos em branco; se quiser, informe um valor para as linhas sem dado na própria prévia.",
      ],
    },
    {
      versao: "1.10", data: "06/10/2026",
      itens: [
        "Importação do Inventário de Riscos do sistema anterior (AEP › Inventário de Riscos › Importar Excel): lê o relatório exportado, sem perder o histórico. A Graduação do Risco é mantida como veio do sistema anterior; as linhas em que difere da matriz do S.I.G.E. ficam marcadas na prévia. As ações do sistema anterior ficam no registro e podem ser convertidas em ação do Plano de Ação.",
        "Em todas as importações, quando Cliente, Unidade, Setor, Posto, Cargo ou Atividade não existem no Cadastro, a prévia oferece criá-los automaticamente (Cliente só pelo Administrador), com a lista do que será criado.",
        "Revisão antes de gravar: linhas duplicadas (idênticas ou parecidas, no arquivo ou já no sistema), nomes parecidos escritos de formas diferentes (ex.: \"Montador I, II, III\" e \"Montador I, II e III\") e correspondência de valores de lista (ex.: \"Leve\" = \"Baixa\"). Há ainda valores padrão editáveis para o que a planilha não traz (Atividade, Data) e o relatório de revisão em Excel.",
      ],
    },
    {
      versao: "1.9", data: "06/10/2026",
      itens: [
        "O Editor de Texto (Cadastro) passa a cobrir todo o Laudo: capa, títulos das seções, apresentação, fundamentação, metodologia, tabelas de apoio, escalas, interfaces, medidas, referências, conclusão e texto de validação. Campo vazio utiliza o texto padrão e o PDF sai igual ao anterior enquanto nada for alterado.",
        "\"Gerar Laudo\" passa a produzir o PDF e o documento em Word (.docx) editável, a partir do mesmo texto. Na lista de Laudos há o botão \"⬇ Word\". Os dois arquivos ficam anexados ao registro.",
        "Os cabeçalhos das colunas das tabelas e alguns rótulos estruturais seguem fixos no sistema.",
      ],
    },
    {
      versao: "1.8", data: "05/10/2026",
      itens: [
        "Importação do histórico de AEP por planilha Excel (AEP › Avaliações (AEP)): modelo para baixar, reconhecimento automático de colunas comuns, mapeamento manual, prévia com a situação de cada linha e confirmação antes de gravar.",
        "Avaliações com o mesmo posto, cargo, atividade e data são atualizadas, sem duplicar. Fotos não são importadas.",
      ],
    },
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
        "Metodologia ElevaLife incorporada ao laudo: apresentação, responsabilidade técnica, demanda, dados da empresa, fundamentação (ergonomia, NR-17, NR-01/GRO/PGR), etapas e PDCA, técnicas, ISO/TS 20646, guias de graduação, matriz de risco e referências. Os textos são editáveis em Cadastro Interno › Editor de Texto (campo vazio utiliza o texto padrão).",
        "Cada posto apresenta fotos, descrição da atividade, panorama, fatores com gravidade × probabilidade, ações por fator e risco previsto/realizado; o plano de ação e o risco residual encerram o documento.",
        "Nova tela Cadastro Interno › Ergonomistas (nome, formação, registro profissional e imagem da assinatura). O laudo utiliza o responsável técnico e o ergonomista executor selecionados.",
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
