# Dicionário de indicadores — S.I.G.E V 1.5

O que cada indicador dos dashboards puxa, de onde vem o dado e como é calculado. Este arquivo é gerado a partir de `js/indicadores.js` (a mesma fonte do botão "i" nos cards e de Ajuda › Indicadores) — para alterar um texto, altere lá.

Regra geral: os filtros Cliente, Unidade, Setor, Posto, Cargo e Atividade valem para todos os cards. **Ano/Mês filtra pela data lançada em cada registro** (Mapa de Risco: data da avaliação; Inventário: data da identificação; Avaliação: data da avaliação; Plano de Ação: prazo ou conclusão; Absenteísmo: data do afastamento; HHT: mês; Restritos: início da restrição; Laudos: emissão; AET: data da análise). Registro sem a data fica de fora quando Ano/Mês está selecionado.

## Gestão de Risco

### Mapa de Risco e Plano de Ação

#### Mapa de Risco Global

- **O que mostra:** Distribuição dos postos de trabalho por nível de risco global (Baixo, Moderado, Alto e Muito Alto).
- **De onde vem:** Registro › Mapa de Risco (1 linha = 1 posto/atividade avaliado).
- **Como é calculado:** O Risco Global de cada posto corresponde à média das 12 notas (1 a 4) atribuídas no Mapa de Risco: Col. Cervical, Tronco, Ombros, Cotovelos, Punhos, Mãos/Dedos, Joelhos, Pernas, Tornozelos, Pés/Dedos, Psicossocial/Cognitivo e Ambiental. Média ≥ 2,70 = Muito Alto; ≥ 2,15 = Alto; ≥ 1,55 = Moderado; abaixo = Baixo. O card contabiliza os postos por nível; o percentual é a quantidade dividida pelo total de postos filtrados.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da avaliação do Mapa de Risco (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** A metodologia difere da do Inventário de Riscos, que utiliza a matriz de risco do cliente. Os dois indicadores não devem ser comparados diretamente, pois medem universos distintos (postos e fatores). Ao selecionar o número, o sistema lista os postos.

#### Top 3 Setores críticos

- **O que mostra:** Os três setores com maior número de postos em risco Alto ou Muito Alto.
- **De onde vem:** Registro › Mapa de Risco.
- **Como é calculado:** Por setor: postos críticos (Alto e Muito Alto) ÷ total de postos do setor. A barra apresenta esse percentual; a ordenação dos três setores considera a quantidade de postos críticos, com desempate pelo percentual.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da avaliação do Mapa de Risco (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Um setor com 1 posto (100% crítico) pode aparecer abaixo de um setor com 5 postos críticos em 10 (50%), pois a ordenação é por quantidade e a barra, em percentual.

#### Plano de Ação - Global

- **O que mostra:** Distribuição de todas as ações do Plano de Ação por status.
- **De onde vem:** Registro › Plano de Ação.
- **Como é calculado:** O status é calculado no momento da consulta, com a data atual: sem Dt Programada e sem Dt Conclusão = Não iniciado; apenas com Dt Conclusão = Concluída; sem conclusão e programada antes de hoje = Atrasada; sem conclusão e programada para hoje = Em andamento; sem conclusão e programada no futuro = Não iniciado; com conclusão depois da programada = Concluída com atraso; senão Concluída. Com filtro de Ano/Mês, a ação é considerada se a Dt Programada ou a Dt Conclusão estiver no período.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).
- **Atenção:** Pela regra vigente, o status "Em andamento" ocorre apenas na data exata do prazo: ação com prazo futuro permanece "Não iniciado" e, vencido o prazo sem conclusão, passa a "Atrasada".

#### Plano de Ação - Postos Críticos

- **O que mostra:** Status das ações, conforme o card Global, restrito aos postos de risco Alto ou Muito Alto.
- **De onde vem:** Registro › Plano de Ação (campo Risco Global gravado na própria ação).
- **Como é calculado:** Seleciona as ações cujo Risco Global é Alto ou Muito Alto e calcula o status pela mesma regra do card Global.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).
- **Atenção:** O Risco Global é copiado do posto no momento do lançamento da ação. Se o posto for reavaliado posteriormente, a ação mantém o valor original.

#### Ações previstas no período

- **O que mostra:** Quantidade de ações programadas por mês.
- **De onde vem:** Registro › Plano de Ação (campo Dt Programada).
- **Como é calculado:** Contabiliza as ações por mês da Dt Programada (concluídas ou não), em eixo contínuo do primeiro ao último mês (meses sem ação = 0). O filtro Ano/Mês considera a Dt Programada.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).
- **Atenção:** Ações sem Dt Programada não são exibidas neste gráfico.

#### Ações concluídas no período

- **O que mostra:** Quantidade de ações concluídas por mês.
- **De onde vem:** Registro › Plano de Ação (campo Dt Conclusão).
- **Como é calculado:** Contabiliza as ações com Dt Conclusão, por mês dessa data. O filtro Ano/Mês considera a Dt Conclusão.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).
- **Atenção:** Inclui as ações concluídas no prazo e com atraso.

#### Plano de Ação por Responsável

- **O que mostra:** Volume e situação das ações por responsável.
- **De onde vem:** Registro › Plano de Ação (campo Responsável Ação).
- **Como é calculado:** Barras empilhadas por status (mesma regra do card Global), ordenadas pelo total de ações do responsável. Ações sem responsável são agrupadas em "Sem responsavel".
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).
- **Atenção:** Corresponde à base dos avisos por e-mail: cada responsável recebe lembretes das ações sob sua responsabilidade.

#### Status do Plano de Ação por Setor

- **O que mostra:** Situação das ações por setor.
- **De onde vem:** Registro › Plano de Ação.
- **Como é calculado:** Barras empilhadas por status (mesma regra do card Global), uma barra por setor.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).

#### Mapa de Risco por Setor

- **O que mostra:** Quantidade de postos por nível de risco, detalhada por setor.
- **De onde vem:** Registro › Mapa de Risco.
- **Como é calculado:** Mesmo Risco Global do card "Mapa de Risco Global", desdobrado por setor.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da avaliação do Mapa de Risco (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** A soma das barras equivale ao total de postos do card Mapa de Risco Global.

### AEP - Avaliação Ergonômica e Inventário de Riscos

#### Inventário de Riscos - Graduação do Risco

- **O que mostra:** Distribuição dos fatores de risco (ISO/TS 20646) por nível de graduação.
- **De onde vem:** Registro › Inventário de Riscos (AEP): 1 linha = 1 fator marcado "Existe fator de risco: Sim" em um posto.
- **Como é calculado:** A graduação decorre da matriz de risco configurada no cliente (Probabilidade × Gravidade; 3x3, 4x4 ou 5x5). Para adequação aos quatro níveis do painel: Muito Baixo e Baixo = Baixo; Moderado = Moderado; Alto = Alto; Altíssimo = Muito Alto. Fatores marcados "Não" não entram.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da identificação do fator (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Em clientes com matriz 5x5, os níveis são agrupados em quatro neste painel. O nível exato de cada fator permanece na tabela do Inventário.

#### Avaliação Ergonômica - Cobertura

- **O que mostra:** Proporção de postos do Mapa de Risco que já possuem Avaliação Ergonômica (AEP).
- **De onde vem:** Registro › Avaliação Ergonômica (AEP) comparada com Registro › Mapa de Risco.
- **Como é calculado:** Avaliações registradas: total de avaliações filtradas. Postos cobertos: postos do Mapa de Risco (chave Cliente + Unidade + Setor + Posto + Cargo + Atividade) com ao menos uma avaliação. Cobertura: postos cobertos ÷ postos do Mapa de Risco.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da avaliação (Avaliação Ergonômica e Mapa de Risco) (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** A avaliação de um posto ausente do Mapa de Risco compõe "registradas", mas não "cobertos". Sem postos no Mapa de Risco, a cobertura é exibida como 0%.

#### Inventário de Riscos - Status

- **O que mostra:** Etapa de tratativa dos fatores de risco (A validar, Em andamento, Concluído e Cancelado).
- **De onde vem:** Registro › Inventário de Riscos (AEP), campo Status.
- **Como é calculado:** Contagem de fatores marcados como existentes ("Sim") por status; percentual sobre o total de fatores filtrados.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da identificação do fator (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Todo fator novo é criado com o status "A validar".

#### Inventário de Riscos - Prazos

- **O que mostra:** Situação do prazo de validade ("Válido Até") dos fatores de risco em aberto.
- **De onde vem:** Registro › Inventário de Riscos (AEP), campo Válido Até.
- **Como é calculado:** Consideram-se apenas fatores em aberto (A validar ou Em andamento). Vencido: Válido Até anterior à data atual; Vencendo: vencimento em até 30 dias; Em dia: vencimento em mais de 30 dias.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da identificação do fator (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Fatores sem Válido Até, Concluídos ou Cancelados não compõem estes três valores.

#### Top Setores - Riscos em Aberto

- **O que mostra:** Os cinco setores com maior número de fatores de risco em aberto.
- **De onde vem:** Registro › Inventário de Riscos (AEP).
- **Como é calculado:** Por setor: fatores com status A validar ou Em andamento ÷ total de fatores do setor. A barra apresenta o percentual; a ordenação considera a quantidade de fatores em aberto.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da identificação do fator (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Mesma lógica do Top 3 Setores críticos: ordenação por quantidade e barra em percentual.

#### Laudos e Certificados - Por Tipo

- **O que mostra:** Quantidade de laudos e certificados de calibração emitidos.
- **De onde vem:** Registro › Laudos (campo Tipo).
- **Como é calculado:** Contagem de registros de Laudos por Tipo (Laudo ou Certificado de Calibração).
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data de emissão do laudo (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Contabiliza o registro emitido, e não o número de páginas ou de arquivos.

### AET - Análise Ergonômica do Trabalho

#### AET - Arquivos Anexados por Classificação

- **O que mostra:** Quantidade de arquivos de AET (Excel/PDF) anexados, por tipo de conteúdo.
- **De onde vem:** Registro › AET (campo Arquivos AET).
- **Como é calculado:** Contabiliza arquivos (um registro pode conter vários). Prevalece a classificação confirmada pelo ergonomista; na ausência de confirmação, utiliza-se a classificação automática, obtida da leitura do arquivo. Classificações sem arquivos não são exibidas.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da análise (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** O valor corresponde a arquivos, e não a postos ou a análises.

## Gestão de Absenteísmo

### Absenteísmo

#### Totais do período filtrado

- **O que mostra:** Número de colaboradores, dias perdidos e Taxa de Frequência do período.
- **De onde vem:** Registro › Absenteísmo e Registro › HHT / Dias Úteis.
- **Como é calculado:** Qtd Dias Perdidos: soma de "Qtd Dias" dos afastamentos. Taxa de Frequência: nº de afastamentos ÷ HHT × 1.000.000, sendo HHT a soma de (Colaboradores × Dias Úteis × 8 h) de cada linha de HHT / Dias Úteis (NBR 14280). Qtd Colaboradores: média da coluna Colaboradores das linhas de HHT / Dias Úteis do filtro.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês (afastamento pela Dt Afastamento; HHT pelo Ano/Mês Úteis).
- **Atenção:** Sem linhas de HHT / Dias Úteis lançadas, a Taxa de Frequência é 0. A Qtd Colaboradores é a média das linhas (setor × mês), e não a soma dos setores.

#### Evolução da Taxa de Frequência

- **O que mostra:** Evolução mensal da Taxa de Frequência; atestados e dias perdidos são exibidos no detalhe do gráfico (ao passar o cursor).
- **De onde vem:** Registro › Absenteísmo e Registro › HHT / Dias Úteis.
- **Como é calculado:** Mesma fórmula do card Totais, calculada para cada mês (afastamentos do mês ÷ HHT do mês × 1.000.000).
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.
- **Atenção:** Mês com afastamento e sem HHT lançado é exibido com taxa 0.

#### Taxa de Frequência por Setor

- **O que mostra:** Casos de afastamento por milhão de horas trabalhadas, por setor.
- **De onde vem:** Registro › Absenteísmo e Registro › HHT / Dias Úteis.
- **Como é calculado:** Mesma fórmula do card Totais, por setor. Os setores listados são os que têm linha em HHT / Dias Úteis.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.
- **Atenção:** Setor com afastamentos e sem HHT lançado não é exibido.

#### Dias perdidos por região (frente)

- **O que mostra:** Dias perdidos por região do corpo, vista frontal.
- **De onde vem:** Registro › Absenteísmo (Região Corporal e Qtd Dias).
- **Como é calculado:** Soma de "Qtd Dias" por Região Corporal. Na vista frontal, o lado direito da pessoa corresponde ao lado esquerdo da imagem.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.

#### Dias perdidos por região (costas)

- **O que mostra:** Dias perdidos por região do corpo, vista posterior.
- **De onde vem:** Registro › Absenteísmo (Região Corporal e Qtd Dias).
- **Como é calculado:** Soma de "Qtd Dias" por Região Corporal. Na vista posterior, o lado direito da pessoa corresponde ao lado direito da imagem.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.

## Gestão de Restritos

### Restritos

#### Gênero

- **O que mostra:** Distribuição por gênero dos colaboradores com restrição médica registrada.
- **De onde vem:** Registro › Restritos (Compatíveis).
- **Como é calculado:** Contagem de registros por gênero.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página: Status Restrição e Turno de Trabalho.
- **Atenção:** Contabiliza registros de restrição: um colaborador com duas restrições é contado duas vezes.

#### Idade

- **O que mostra:** Distribuição por faixa etária.
- **De onde vem:** Registro › Restritos (Compatíveis) (campo Idade).
- **Como é calculado:** Contagem de registros nas faixas: até 24, 25-34, 35-44, 45-54 e 55+.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.
- **Atenção:** Registros sem idade não são alocados em nenhuma faixa.

#### Em Atividade Compatível

- **O que mostra:** Quantidade de colaboradores recolocados em atividade compatível, em comparação com os não recolocados.
- **De onde vem:** Registro › Restritos (Compatíveis) (campo Atividade Compatível).
- **Como é calculado:** Contagem de registros por valor de Atividade Compatível (Sim/Não).
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

#### Status por Setor

- **O que mostra:** Situação das restrições por setor.
- **De onde vem:** Registro › Restritos (Compatíveis) (Status Restrição: Ativa, Em Avaliação, Encerrada).
- **Como é calculado:** Barras empilhadas: contagem de registros por status, por setor.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

#### Restrição por Turno

- **O que mostra:** Situação das restrições por turno de trabalho.
- **De onde vem:** Registro › Restritos (Compatíveis) (Turno Trabalho).
- **Como é calculado:** Barras empilhadas: contagem de registros por status, por turno.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

#### Compatível por Setor

- **O que mostra:** Quantidade de colaboradores em atividade compatível, por setor.
- **De onde vem:** Registro › Restritos (Compatíveis).
- **Como é calculado:** Contagem de registros com Atividade Compatível = Sim, por setor.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

#### Restrições por região (frente)

- **O que mostra:** Quantidade de restrições por região do corpo, vista frontal.
- **De onde vem:** Registro › Restritos (Compatíveis) (Segmento Corporal).
- **Como é calculado:** Contagem de restrições por Segmento Corporal. Na vista frontal, o lado direito da pessoa corresponde ao lado esquerdo da imagem.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

#### Restrições por região (costas)

- **O que mostra:** Quantidade de restrições por região do corpo, vista posterior.
- **De onde vem:** Registro › Restritos (Compatíveis) (Segmento Corporal).
- **Como é calculado:** Contagem de restrições por Segmento Corporal. Na vista posterior, o lado direito da pessoa corresponde ao lado direito da imagem.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

## Pontos de atenção encontrados na calibração (V 1.0)

Corrigidos nesta versão:

1. A graduação do Inventário de Riscos ignorava os níveis "Moderado", "Muito Baixo" e "Altíssimo" que as matrizes 3x3/4x4/5x5 gravam. Agora são agrupados nos 4 níveis do painel.
2. Fatores marcados "Não" no checklist entravam nas contagens e nos percentuais do Inventário. Agora ficam de fora.
3. O card de Prazos do Inventário contava fatores já Concluídos ou Cancelados como "vencidos". Agora considera só os em aberto.

Decisões de regra que ficam para validar com a diretoria/equipe (não foram alteradas):

1. "Em andamento" no Plano de Ação só existe no dia exato do prazo.
2. O Risco Global do Plano de Ação é uma cópia do posto no momento do lançamento da ação.
3. (Resolvido na V 1.1) O Ano/Mês agora filtra todos os cards pela data lançada em cada registro; registros antigos sem data só aparecem com Ano/Mês em "Todos".
4. A Qtd Colaboradores de Absenteísmo é a média das linhas de HHT / Dias Úteis, não a soma dos setores.
5. Taxa de Frequência conta cada registro de afastamento como um caso.
6. Mapa de Risco (média das 12 notas) e Inventário (matriz do cliente) são métodos diferentes de graduar risco; os dois indicadores não são diretamente comparáveis.
