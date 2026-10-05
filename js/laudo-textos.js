/* ==========================================================================
   S.I.G.E. - ElevaLife
   TEXTO PADRAO DO LAUDO (AEP) - V 1.3. Base: metodologia ElevaLife (5 pilares
   da gestao de ergonomia, 5 etapas da gestao do risco ergonomico, PDCA),
   NR-17, NR-01 (GRO/PGR), ISO/TS 20646 e referencias de mercado.

   Cada texto pode ser SUBSTITUIDO pela area tecnica na tela "Editor de Texto"
   (modelo de laudo, global): campo vazio = usa o texto padrao deste arquivo.
   Formato: paragrafos separados por linha em branco; **negrito** com duplo
   asterisco; nas listas, um item por linha. Marcadores aceitos: {cliente},
   {unidade}, {setores}, {nPostos}, {nFatores}, {nAcoes}, {resumoNiveis}.
   ========================================================================== */
(function (global) {
  "use strict";
  const BI = (global.BI = global.BI || {});

  const PADRAO = {
    "Apresentacao":
      "Este documento, intitulado **Avaliação Ergonômica Preliminar (AEP)**, foi elaborado pela ElevaLife em atendimento à demanda da **{cliente}** – {unidade}, que identificou a necessidade de conhecer as condições ergonômicas das atividades desenvolvidas em {setores}.\n\n" +
      "A AEP reúne a descrição das situações de trabalho observadas, a identificação dos fatores de risco ergonômico presentes em cada posto, a estimativa do risco conforme os critérios da NR-01, as medidas de controle recomendadas e o acompanhamento do plano de ação, incluindo o risco residual esperado e o já realizado após as ações concluídas. Os resultados alimentam o inventário de riscos do Programa de Gerenciamento de Riscos (PGR) da organização.",

    "Sobre ElevaLife":
      "Fundada em 2011, a ElevaLife é especializada em Ergonomia, Saúde Osteomuscular e Promoção da Saúde. Conta com mais de 100 profissionais próprios, os “ElevaLifers”, e atua em clientes de diferentes setores industriais em 13 estados brasileiros, com estrutura de coordenação técnica multirregional. Seu portfólio inclui avaliação e análise ergonômica do trabalho (AEP e AET), adequação às NR-01 e NR-17, gestão de restritos, de absenteísmo e de trabalhadores afastados e readaptados, fisioterapia corporativa e programas de qualidade de vida.\n\n" +
      "O relacionamento com o cliente segue oito etapas, do diagnóstico inicial à melhoria contínua, e os resultados são registrados e acompanhados no sistema S.I.G.E, o que torna os dados comparáveis entre postos, setores e unidades.",

    "Demanda":
      "Atender ao disposto na Norma Regulamentadora nº 17 (NR-17 – Ergonomia), com redação dada pela Portaria MTP nº 423, de 7 de outubro de 2021, e às diretrizes de gerenciamento de riscos da NR-01.\n" +
      "Identificar os fatores de risco ergonômico para a saúde dos trabalhadores dos postos avaliados, estimar o risco de cada um e fornecer informações para o planejamento das medidas de prevenção.\n" +
      "Propor medidas de controle por ordem de prioridade e acompanhar sua execução, de modo a melhorar o conforto, a segurança e a eficiência do trabalho e reduzir a possibilidade de adoecimento.",

    "Fundamentacao Ergonomia":
      "A palavra *ergonomia* vem do grego *ergon* (trabalho) e *nomos* (regras, leis). Segundo a Associação Internacional de Ergonomia (IEA), é a disciplina científica que trata da compreensão das interações entre os seres humanos e os demais elementos de um sistema, aplicando teoria, princípios, dados e métodos para otimizar o bem-estar humano e o desempenho global do sistema. A ISO 6385 organiza esses princípios para o projeto de sistemas de trabalho, e a prática se divide em três domínios: **físico** (postura, esforço, movimentos repetitivos, ambiente), **cognitivo** (carga mental, atenção, tomada de decisão) e **organizacional** (jornada, turnos, pausas, divisão das tarefas).\n\n" +
      "A NR-17 estabelece que a adaptação das condições de trabalho às características psicofisiológicas dos trabalhadores deve proporcionar conforto, segurança, saúde e desempenho eficiente. Para atender a esse objetivo de forma contínua, a ElevaLife organiza a gestão de ergonomia em **cinco pilares**, que conectam diagnóstico, gestão de restritos, capacitação, concepção de projetos e suporte técnico. O acompanhamento das soluções ocorre por follow-up periódico, indicadores de implantação, auditoria das ações e atualização dos documentos técnicos.",

    "Fundamentacao NR17":
      "A NR-17 determina que a organização avalie as situações de trabalho quanto aos fatores de risco ergonômico. A **Avaliação Ergonômica Preliminar**, incorporada ao texto da norma em sua revisão, em vigor desde 3 de janeiro de 2022, tem o objetivo de **identificar os perigos** (fatores de risco ergonômico) e **produzir informações para o planejamento das medidas de prevenção**.\n\n" +
      "Por que realizar a AEP: (i) cumpre a exigência legal de avaliação das situações de trabalho; (ii) fornece ao PGR um inventário de riscos ergonômicos estruturado e rastreável; (iii) prioriza os postos e fatores que exigem ação imediata; (iv) indica se há necessidade de aprofundar o estudo por meio de uma **Análise Ergonômica do Trabalho (AET)**, quando a complexidade ou a gravidade da situação assim recomendar. A AEP não substitui a AET nesses casos.\n\n" +
      "Como a AEP é feita: o ergonomista acompanha a atividade real no posto, ouve os trabalhadores, registra imagens e medidas, preenche a lista de fatores de risco da ISO/TS 20646, classifica o risco pela matriz de gravidade e probabilidade e registra as medidas de controle recomendadas. O percurso completo é descrito na seção 7.",

    "Fundamentacao GRO":
      "A NR-01 estabelece o Gerenciamento de Riscos Ocupacionais (GRO), materializado no Programa de Gerenciamento de Riscos (PGR). Seu ciclo compreende a identificação dos perigos, a avaliação dos riscos, a definição das medidas de prevenção, o plano de ação e o acompanhamento do controle. A AEP é a fonte dos perigos e riscos ergonômicos desse ciclo, e o **S.I.G.E** mantém a ligação entre cada fator de risco identificado, as ações propostas, as evidências de execução e o risco residual.",

    "Metodologia":
      "A AEP permite a identificação dos fatores de risco ergonômico presentes nas atividades e o dimensionamento do risco de cada um. A metodologia da ElevaLife integra gestão de riscos ergonômicos, análise da atividade real, biomecânica ocupacional, intervenção funcional e inteligência de dados, com o objetivo de transformar diagnósticos técnicos em decisões e ações práticas, sustentáveis e rastreáveis.",

    "Tecnicas":
      "Observação da atividade no posto, em condições reais de produção;\n" +
      "Identificação dos fatores de risco presentes na atividade conforme a ISO/TS 20646;\n" +
      "Medição do tempo de exposição e da frequência dos movimentos e esforços;\n" +
      "Registro de imagens (fotografia e vídeo), mediante autorização, respeitada a Lei Geral de Proteção de Dados;\n" +
      "Medição de espaços de trabalho, layout e mobiliário, e medição de iluminância com luxímetro;\n" +
      "Entrevistas com trabalhadores durante a execução das atividades;\n" +
      "Levantamento de dados de sinistralidade e dados epidemiológicos sobre doenças e acidentes ocupacionais.",

    "AEP AET":
      "A **AEP** é aplicada como triagem e estruturação do inventário de riscos. A **AET** é indicada quando há maior complexidade, histórico de adoecimento ou acidentes, queixas recorrentes ou necessidade de compreender em detalhe a atividade real. Nesses casos, são aplicadas metodologias específicas conforme a situação de trabalho:",

    "Recomendacoes":
      "O plano de ação consolida as medidas propostas em todos os postos. A execução é acompanhada no S.I.G.E, e uma ação só é considerada concluída com a evidência anexada.",

    "Conclusao":
      "Com base nas observações e análises realizadas nos {nPostos} postos avaliados, foram identificados {nFatores} fatores de risco ergonômico{resumoNiveis}. O plano de ação reúne {nAcoes} ações; a execução e o risco residual são acompanhados no S.I.G.E, com a anexação das evidências à medida que as ações forem concluídas.\n\n" +
      "Os postos devem ser reavaliados diante de mudanças no processo, no layout, nos equipamentos ou na composição das equipes, e nos prazos previstos no PGR da organização. Caso o acompanhamento ou o surgimento de queixas indique situação mais complexa, recomenda-se o aprofundamento por meio de Análise Ergonômica do Trabalho (AET).",

    "Referencias":
      "BRASIL, Ministério do Trabalho e Previdência. **NR-17 – Ergonomia**. Portaria MTP nº 423, de 7 de outubro de 2021, e atualizações.\n" +
      "BRASIL, Ministério do Trabalho. **NR-01 – Disposições Gerais e Gerenciamento de Riscos Ocupacionais**. Portaria SEPRT nº 6.730, de 9 de março de 2020, e atualizações.\n" +
      "ISO/TS 20646:2014. *Ergonomics guidelines for the optimization of musculoskeletal workload*. International Organization for Standardization.\n" +
      "ISO 12100:2010. *Safety of machinery – General principles for design – Risk assessment and risk reduction*.\n" +
      "ISO 6385:2016. *Ergonomics principles in the design of work systems*.\n" +
      "ISO 11226:2000. *Ergonomics – Evaluation of static working postures*; ISO 11228-1/-2/-3. *Ergonomics – Manual handling*.\n" +
      "BS 8800:2004. *Occupational health and safety management systems – Guide*. British Standards Institution (matriz de severidade e probabilidade).\n" +
      "ISO 45001:2018. *Occupational health and safety management systems – Requirements with guidance for use*.\n" +
      "INTERNATIONAL ERGONOMICS ASSOCIATION (IEA). *Definition and domains of ergonomics*, 2000.\n" +
      "GUÉRIN, F.; LAVILLE, A.; DANIELLOU, F.; DURAFFOURG, J.; KERGUELEN, A. *Compreender o trabalho para transformá-lo: a prática da ergonomia*. São Paulo: Blucher, 2001.\n" +
      "FUNDACENTRO. **NHO 11** – Avaliação dos níveis de iluminamento em ambientes internos de trabalho; ABNT NBR ISO/CIE 8995-1 – Iluminação de ambientes de trabalho.\n" +
      "BORG, G. *Borg’s Perceived Exertion and Pain Scales*. Human Kinetics, 1998.\n" +
      "WATERS, T. R. et al. Revised NIOSH equation for the design and evaluation of manual lifting tasks. *Ergonomics*, 1993; McATAMNEY, L.; CORLETT, E. N. RULA. *Applied Ergonomics*, 1993; HIGNETT, S.; McATAMNEY, L. REBA. *Applied Ergonomics*, 2000.\n" +
      "Manual de Goniometria (referências de amplitude de movimento) e Guia de referência ElevaLife para graduação de ADM, esforço, duração e frequência.",
  };

  // Lista de campos do Modelo de Laudo (rotulo exibido no Editor de Texto).
  const CAMPOS_EDITAVEIS = [
    ["Apresentacao", "1. Apresentação"],
    ["Sobre ElevaLife", "2. A ElevaLife"],
    ["Demanda", "4. Demanda do trabalho (um item por linha)"],
    ["Fundamentacao Ergonomia", "6.1 Ergonomia e os pilares da gestão ElevaLife"],
    ["Fundamentacao NR17", "6.2 A NR-17 e a Avaliação Ergonômica Preliminar"],
    ["Fundamentacao GRO", "6.3 Gestão do risco ergonômico no GRO/PGR (NR-01)"],
    ["Metodologia", "7. Métodos e metodologia utilizada (introdução)"],
    ["Tecnicas", "7.2 Técnicas e instrumentos (um item por linha)"],
    ["AEP AET", "7.2 AEP e AET (parágrafo antes da tabela de métodos)"],
    ["Recomendacoes", "10. Plano de ação e risco residual (introdução)"],
    ["Conclusao", "12. Conclusão"],
    ["Referencias", "11. Referências (uma por linha)"],
  ];

  BI.LaudoTextos = { PADRAO, CAMPOS_EDITAVEIS };
})(window);
