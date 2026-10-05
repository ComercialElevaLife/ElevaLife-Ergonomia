# Dicionário de indicadores — S.I.G.E V 1.1

O que cada indicador dos dashboards puxa, de onde vem o dado e como é calculado. Este arquivo é gerado a partir de `js/indicadores.js` (a mesma fonte do botão "i" nos cards e de Ajuda › Indicadores) — para alterar um texto, altere lá.

Regra geral: os filtros Cliente, Unidade, Setor, Posto, Cargo e Atividade valem para todos os cards. **Ano/Mês filtra pela data lançada em cada registro** (Mapa de Risco: data da avaliação; Inventário: data da identificação; Avaliação: data da avaliação; Plano de Ação: prazo ou conclusão; Absenteísmo: data do afastamento; HHT: mês; Restritos: início da restrição; Laudos: emissão; AET: data da análise). Registro sem a data fica de fora quando Ano/Mês está selecionado.

## Gestão de Risco

### Mapa de Risco e Plano de Ação

#### Mapa de Risco Global

- **O que mostra:** Quantos postos de trabalho estão em cada nível de risco (Baixo, Moderado, Alto, Muito Alto).
- **De onde vem:** Registro › Mapa de Risco (1 linha = 1 posto/atividade avaliado).
- **Como é calculado:** O Risco Global de cada posto é a MÉDIA das 12 notas (1 a 4) digitadas no Mapa de Risco: Col. Cervical, Tronco, Ombros, Cotovelos, Punhos, Mãos/Dedos, Joelhos, Pernas, Tornozelos, Pés/Dedos, Psicossocial/Cognitivo e Ambiental. Média ≥ 2,70 = Muito Alto; ≥ 2,15 = Alto; ≥ 1,55 = Moderado; abaixo = Baixo. O card conta postos por nível; o % é a quantidade ÷ total de postos filtrados.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da avaliação do Mapa de Risco (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Método diferente do Inventário de Riscos (que usa a matriz de risco do cliente): os dois cards NÃO precisam bater, pois medem universos distintos (postos × fatores). Clique no número para listar os postos.

#### Top 3 Setores críticos

- **O que mostra:** Os 3 setores com mais postos em risco Alto ou Muito Alto.
- **De onde vem:** Registro › Mapa de Risco.
- **Como é calculado:** Por setor: postos críticos (Alto + Muito Alto) ÷ total de postos do setor. A barra mostra esse %; a ORDEM dos 3 setores é pela quantidade de postos críticos (desempate pelo %).
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da avaliação do Mapa de Risco (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Um setor com 1 posto 100% crítico pode aparecer abaixo de um setor com 5 de 10 críticos (50%): a ordem é por quantidade, a barra é em %.

#### Plano de Ação - Global

- **O que mostra:** Distribuição de todas as ações do Plano de Ação por status.
- **De onde vem:** Registro › Plano de Ação.
- **Como é calculado:** Status calculado na hora, com a data de hoje: sem Dt Programada e sem Dt Conclusão = Não iniciado; só com Dt Conclusão = Concluída; sem conclusão e programada antes de hoje = Atrasada; sem conclusão e programada para hoje = Em andamento; sem conclusão e programada no futuro = Não iniciado; com conclusão depois da programada = Concluída com atraso; senão Concluída. Com filtro de Ano/Mês, a ação entra se a Dt Programada OU a Dt Conclusão cair no período.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).
- **Atenção:** "Em andamento" só aparece no dia exato do prazo (regra atual): ação com prazo futuro é "Não iniciado" e, passado o prazo sem conclusão, "Atrasada".

#### Plano de Ação - Postos Críticos

- **O que mostra:** O mesmo status do card Global, só para ações de postos Alto ou Muito Alto.
- **De onde vem:** Registro › Plano de Ação (campo Risco Global gravado na própria ação).
- **Como é calculado:** Filtra as ações do Plano cujo Risco Global é Alto ou Muito Alto e calcula o status como no card Global.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).
- **Atenção:** O Risco Global é COPIADO do posto no momento em que a ação é lançada. Se o posto for reavaliado depois, a ação continua com o valor antigo.

#### Ações previstas no período

- **O que mostra:** Quantas ações estão programadas em cada mês.
- **De onde vem:** Registro › Plano de Ação (campo Dt Programada).
- **Como é calculado:** Conta as ações por mês da Dt Programada (concluídas ou não), com eixo contínuo do primeiro ao último mês (meses sem ação = 0). Ano/Mês filtra pela Dt Programada.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).
- **Atenção:** Ações sem Dt Programada não aparecem neste gráfico.

#### Ações concluídas no período

- **O que mostra:** Quantas ações foram concluídas em cada mês.
- **De onde vem:** Registro › Plano de Ação (campo Dt Conclusão).
- **Como é calculado:** Conta as ações que têm Dt Conclusão, por mês dessa data. Ano/Mês filtra pela Dt Conclusão.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).
- **Atenção:** Inclui concluídas no prazo e com atraso.

#### Plano de Ação por Responsável

- **O que mostra:** Carga e situação das ações de cada responsável.
- **De onde vem:** Registro › Plano de Ação (campo Responsável Ação).
- **Como é calculado:** Barras empilhadas por status (mesma regra do card Global), ordenadas pelo total de ações do responsável. Ação sem responsável aparece como "Sem responsavel".
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).
- **Atenção:** É a base dos avisos por e-mail: o responsável recebe lembretes das ações dele.

#### Status do Plano de Ação por Setor

- **O que mostra:** Situação das ações em cada setor.
- **De onde vem:** Registro › Plano de Ação.
- **Como é calculado:** Barras empilhadas por status (mesma regra do card Global), uma barra por setor.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês também filtra (ver Cálculo).

#### Mapa de Risco por Setor

- **O que mostra:** Quantidade de postos por nível de risco dentro de cada setor.
- **De onde vem:** Registro › Mapa de Risco.
- **Como é calculado:** Mesmo Risco Global do card "Mapa de Risco Global", aberto por setor.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da avaliação do Mapa de Risco (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** A soma de todas as barras é igual ao total de postos do card Mapa de Risco Global.

### AEP - Avaliação Ergonômica e Inventário de Riscos

#### Inventário de Riscos - Graduação do Risco

- **O que mostra:** Quantos fatores de risco (ISO TS-20646) existem em cada nível de graduação.
- **De onde vem:** Registro › Inventário de Riscos (AEP): 1 linha = 1 fator marcado "Existe fator de risco: Sim" em um posto.
- **Como é calculado:** A graduação vem da matriz de risco configurada no cliente (Probabilidade × Gravidade; 3x3, 4x4 ou 5x5). Para caber nos 4 níveis do painel: Muito Baixo e Baixo = Baixo; Moderado = Moderado; Alto = Alto; Altíssimo = Muito Alto. Fatores marcados "Não" não entram.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da identificação do fator (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Cliente com matriz 5x5 mostra aqui 4 níveis (agrupados). O nível exato de cada fator continua na tabela do Inventário.

#### Avaliação Ergonômica - Cobertura

- **O que mostra:** Quantos postos do Mapa de Risco já têm Avaliação Ergonômica (AEP).
- **De onde vem:** Registro › Avaliação Ergonômica (AEP) comparada com Registro › Mapa de Risco.
- **Como é calculado:** Avaliações registradas = total de avaliações filtradas. Postos cobertos = postos do Mapa de Risco (chave Cliente+Unidade+Setor+Posto+Cargo+Atividade) que têm pelo menos 1 avaliação. Cobertura = cobertos ÷ postos do Mapa de Risco.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da avaliação (Avaliação Ergonômica e Mapa de Risco) (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Avaliação de um posto que não está no Mapa de Risco entra em "registradas" mas não em "cobertos". Sem postos no Mapa, a cobertura mostra 0%.

#### Inventário de Riscos - Status

- **O que mostra:** Em que etapa de tratativa estão os fatores de risco (A validar, Em andamento, Concluído, Cancelado).
- **De onde vem:** Registro › Inventário de Riscos (AEP), campo Status.
- **Como é calculado:** Contagem de fatores (marcados "Sim") por status; % sobre o total de fatores filtrados.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da identificação do fator (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Todo fator novo nasce como "A validar".

#### Inventário de Riscos - Prazos

- **O que mostra:** Situação do prazo "Válido Até" dos fatores de risco ainda abertos.
- **De onde vem:** Registro › Inventário de Riscos (AEP), campo Válido Até.
- **Como é calculado:** Só fatores em aberto (A validar ou Em andamento). Vencido = Válido Até antes de hoje; Vencendo = vence em até 30 dias; Em dia = vence daqui a mais de 30 dias.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da identificação do fator (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Fatores sem Válido Até, Concluídos ou Cancelados não entram nestes 3 números.

#### Top Setores - Riscos em Aberto

- **O que mostra:** Os 5 setores com mais fatores de risco ainda em aberto.
- **De onde vem:** Registro › Inventário de Riscos (AEP).
- **Como é calculado:** Por setor: fatores com status A validar ou Em andamento ÷ total de fatores do setor. A barra mostra o %; a ordem é pela quantidade de fatores em aberto.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da identificação do fator (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Mesma lógica do Top 3 Setores críticos: ordem por quantidade, barra em %.

#### Laudos e Certificados - Por Tipo

- **O que mostra:** Quantos laudos e certificados de calibração foram emitidos.
- **De onde vem:** Registro › Laudos (campo Tipo).
- **Como é calculado:** Contagem de registros de Laudos por Tipo (Laudo ou Certificado de Calibração).
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data de emissão do laudo (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** Conta o registro emitido, não o número de páginas ou arquivos.

### AET - Análise Ergonômica do Trabalho

#### AET - Arquivos Anexados por Classificação

- **O que mostra:** Quantos arquivos de AET (Excel/PDF) foram anexados e de que tipo de conteúdo são.
- **De onde vem:** Registro › AET (campo Arquivos AET).
- **Como é calculado:** Conta ARQUIVOS (um registro pode ter vários). A classificação é a confirmada pelo ergonomista; se ele não confirmou, vale a automática, lida do conteúdo do arquivo. Classificações sem arquivos ficam ocultas.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo e Atividade. Ano/Mês filtra pela data da análise (registro sem essa data fica de fora quando Ano/Mês está selecionado).
- **Atenção:** É contagem de arquivos, não de postos nem de análises.

## Gestão de Absenteísmo

### Absenteísmo

#### Totais do período filtrado

- **O que mostra:** Colaboradores, dias perdidos e Taxa de Frequência do período.
- **De onde vem:** Registro › Absenteísmo e Registro › HHT / Dias Úteis.
- **Como é calculado:** Qtd Dias Perdidos = soma de "Qtd Dias" dos afastamentos. Taxa de Frequência = nº de afastamentos ÷ HHT × 1.000.000, com HHT = soma de (Colaboradores × Dias Úteis × 8 h) de cada linha de HHT / Dias Úteis (NBR 14280). Qtd Colaboradores = média da coluna Colaboradores das linhas de HHT / Dias Úteis do filtro.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês (afastamento pela Dt Afastamento; HHT pelo Ano/Mês Úteis).
- **Atenção:** Sem linhas de HHT / Dias Úteis lançadas, a Taxa de Frequência fica 0. A Qtd Colaboradores é a MÉDIA das linhas (setor × mês), não a soma dos setores.

#### Evolução da Taxa de Frequência

- **O que mostra:** A Taxa de Frequência mês a mês, com atestados e dias perdidos no balão.
- **De onde vem:** Registro › Absenteísmo e Registro › HHT / Dias Úteis.
- **Como é calculado:** Mesma fórmula do card Totais, calculada para cada mês (afastamentos do mês ÷ HHT do mês × 1.000.000).
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.
- **Atenção:** Mês com afastamento mas sem HHT lançado aparece com taxa 0.

#### Taxa de Frequência por Setor

- **O que mostra:** Casos de afastamento por milhão de horas trabalhadas, por setor.
- **De onde vem:** Registro › Absenteísmo e Registro › HHT / Dias Úteis.
- **Como é calculado:** Mesma fórmula do card Totais, por setor. Os setores listados são os que têm linha em HHT / Dias Úteis.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.
- **Atenção:** Setor com afastamentos mas sem HHT lançado não aparece.

#### Dias perdidos por região (frente)

- **O que mostra:** Dias perdidos por região do corpo, vista frontal.
- **De onde vem:** Registro › Absenteísmo (Região Corporal e Qtd Dias).
- **Como é calculado:** Soma de "Qtd Dias" por Região Corporal. A silhueta é vista de frente: o lado Direito da pessoa aparece à esquerda da imagem.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.

#### Dias perdidos por região (costas)

- **O que mostra:** Dias perdidos por região do corpo, vista posterior.
- **De onde vem:** Registro › Absenteísmo (Região Corporal e Qtd Dias).
- **Como é calculado:** Soma de "Qtd Dias" por Região Corporal. A silhueta é vista de costas: o lado Direito da pessoa aparece à direita da imagem.
- **Filtros que valem:** Cliente, Unidade, Setor, Posto, Cargo, Atividade e Ano/Mês.

## Gestão de Restritos

### Restritos

#### Gênero

- **O que mostra:** Gênero dos colaboradores em restrição ou acompanhamento.
- **De onde vem:** Registro › Compatíveis.
- **Como é calculado:** Contagem de registros por gênero.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página: Status Restrição e Turno de Trabalho.
- **Atenção:** Conta registros de restrição; um colaborador com duas restrições conta duas vezes.

#### Idade

- **O que mostra:** Distribuição por faixa etária.
- **De onde vem:** Registro › Compatíveis (campo Idade).
- **Como é calculado:** Contagem de registros nas faixas: até 24, 25-34, 35-44, 45-54 e 55+.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.
- **Atenção:** Idade vazia não entra em nenhuma faixa.

#### Em Atividade Compatível

- **O que mostra:** Quantos colaboradores já foram recolocados em atividade compatível.
- **De onde vem:** Registro › Compatíveis (campo Atividade Compatível).
- **Como é calculado:** Contagem de registros por valor de Atividade Compatível (Sim/Não).
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

#### Status por Setor

- **O que mostra:** Situação das restrições em cada setor.
- **De onde vem:** Registro › Compatíveis (Status Restrição: Ativa, Em Avaliação, Encerrada).
- **Como é calculado:** Barras empilhadas: contagem de registros por status, por setor.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

#### Restrição por Turno

- **O que mostra:** Situação das restrições em cada turno de trabalho.
- **De onde vem:** Registro › Compatíveis (Turno Trabalho).
- **Como é calculado:** Barras empilhadas: contagem de registros por status, por turno.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

#### Compatível por Setor

- **O que mostra:** Quantos colaboradores em atividade compatível existem em cada setor.
- **De onde vem:** Registro › Compatíveis.
- **Como é calculado:** Contagem de registros com Atividade Compatível = Sim, por setor.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

#### Restrições por região (frente)

- **O que mostra:** Quantidade de restrições por região do corpo, vista frontal.
- **De onde vem:** Registro › Compatíveis (Segmento Corporal).
- **Como é calculado:** Contagem de restrições por Segmento Corporal. Silhueta de frente: lado Direito da pessoa à esquerda da imagem.
- **Filtros que valem:** Filtros globais (Ano/Mês pela data de início da restrição) + filtros da página.

#### Restrições por região (costas)

- **O que mostra:** Quantidade de restrições por região do corpo, vista posterior.
- **De onde vem:** Registro › Compatíveis (Segmento Corporal).
- **Como é calculado:** Contagem de restrições por Segmento Corporal. Silhueta de costas: lado Direito da pessoa à direita da imagem.
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
6. Mapa de Risco (média das 12 notas) e Inventário (matriz do cliente) são métodos diferentes de graduar risco; os dois cards não precisam bater.
