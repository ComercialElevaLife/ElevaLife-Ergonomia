# Histórico de versões — S.I.G.E

A partir de 04/10/2026 o S.I.G.E é versionado. A versão atual aparece no rodapé do sistema e em Ajuda › Versão (constante `BI.VERSAO` em `js/indicadores.js`).

## V 1.27 — 07/10/2026

SIGE e Riscos Psicossociais passam a ser um pacote único. (A V 1.26 não chegou a ser publicada; dela ficam a planilha do plano de ação mais enxuta e o prazo só quando informado. Os vínculos separados SIGE/Psicossocial foram substituídos pela lista única abaixo.)

- **Laudo psicossocial adaptado a qualquer matriz (`psicossocial.html`):**
  - Correção: o módulo guardava a matriz da empresa do momento em que foi aberto; ao trocar a matriz no Cadastro (ex.: 4x4 → 3x3) o laudo saía com a antiga. Agora a matriz é relida ao abrir a empresa, ao voltar para a aba e ao emitir o laudo.
  - A metodologia (item 4) gera automaticamente, para a matriz da empresa (3x3, 4x4, 5x5 ou Gerdau), a tabela de conversão da probabilidade, as faixas de Severidade Final por nível, a matriz com pontuações, a conduta por nível e os níveis da conclusão. Textos salvos no Editor não conseguem mais contradizer a matriz.
  - Formatação do PDF: tabelas com linhas alternadas, cabeçalho que não fica sozinho no fim da página, quebra de palavras longas, justificação sem espaços exagerados, plano de ação por GHE em 3 colunas (Fator · código, Recomendação, Indicador) e capítulo de resultados por unidade iniciando em página nova.

- **Cadastro único (`js/app.js`, `js/db.js`, `api/src/functions/entidades.js`):**
  - **Cliente:** novo campo **Serviços contratados** (Gestão de Risco, Gestão de Absenteísmo, Gestão de Restritos, Riscos Psicossociais), em caixas de marcar. A Matriz de Risco do cliente passa a valer também para os Riscos Psicossociais. Cliente antigo sem o campo = todos os serviços.
  - **Aviso de serviço não contratado:** a aba continua no menu; se nenhuma empresa do filtro (ou das empresas do usuário) tem o serviço, o conteúdo dá lugar ao aviso "não possui o serviço… procure o time de especialistas da ElevaLife" (`aplicarServicosContratados`). No módulo psicossocial, o aviso aparece ao escolher a empresa.
  - **Setor / GHE:** o cadastro de Setor ganhou o campo "É setor ou GHE?" (`Tipo Setor`).
  - **Colaboradores:** nova coleção `colaborador` (Cliente, Unidade, Setor/GHE, Matrícula, Nome, Cargo opcional), id = Cliente + Matrícula (nunca duplica), busca, exclusão individual e em lote, importação por Excel (até 12 mil linhas por arquivo). Container criado sob demanda.
  - Novo tipo de campo `checklist` (caixas de marcar com busca) e `?empresa=<id>` no GET da API genérica (só estreita o que o perfil já vê).
- **Riscos Psicossociais (`psicossocial.html`, `js/psicossocial-sige.js`, `api/src/functions/psicossocial.js`):**
  - A empresa do módulo é o Cliente do SIGE (`e_sige-<id do cliente>`). Unidades, setores/GHE, colaboradores e ergonomistas vêm do cadastro do SIGE; o módulo guarda só coleta, respostas, ISO 45003, taxa de frequência e análise. O questionário público localiza a matrícula na coleção `colaborador`.
  - Abas: **Diagnóstico organizacional** (checklist ISO 45003, taxa de frequência e evidência organizacional por setor/GHE, ações já realizadas, planilha de solicitação, cópia de segurança), **HSE-IT**, **Análise de risco**, **Plano de ação**, **Laudo** e **Editor de texto**. Saíram Cadastro de empresa, Colaboradores, Ergonomistas, Severidade e Probabilidade (as explicações foram para a Ajuda).
  - **Metodologia com as matrizes do SIGE** (3x3, 4x4, 5x5, 5x5 Gerdau; mesma grade do Inventário, `js/calc.js`): probabilidade (graduação HSE × ISO 45003, 1 a 5) e severidade final (SIF × 0,75 + EOaj × 0,25, de 0,75 a 4,00) convertidas proporcionalmente para a escala da matriz; nomes e cores dos níveis conforme a matriz.
  - **Análise de risco:** sem escolha de matriz e sem seleção de ações; resumo por empresa, unidade e setor/GHE com probabilidade, severidade e graduação de cada um dos 7 fatores; gráfico de quantidade de fatores por graduação com filtros (unidade, setor/GHE, fator); matriz com a contagem de fatores.
  - **Integração com o Registro:** 1 linha "Risco psicossocial" por setor/GHE no Mapa de Risco (Risco Global = graduação do setor/GHE), 1 linha por fator no Inventário de Riscos e 1 ação por linha no Plano de Ação, todas com `Origem = "Riscos Psicossociais"` e contando 1 nos indicadores. A sincronização roda ao abrir a empresa e a cada mudança (botão "Atualizar Registro agora" na Análise).
  - **Plano de ação:** a ação do módulo é a mesma do Registro › Plano de Ação (prazo, responsável, e-mail, status e evidências são de lá; regras de evidência do SIGE para concluir). O e-mail ao responsável usa o modelo do psicossocial (`notificarAcaoPsico` em `entidades.js`) e os lembretes diários do SIGE passam a valer. Seleção de ações no quadro "Ajustar ações recomendadas".
  - **Laudo:** ergonomista e responsável técnico do cadastro de Ergonomistas do SIGE; logotipo do cadastro do cliente; metodologia, tabelas de probabilidade, severidade e matriz conforme a matriz do cliente; marcador `{matriz}` no Editor de texto.
  - **Perfis:** Administrador vê tudo; Consultor (ergonomista) e Usuário Cliente só as empresas vinculadas ao usuário.
  - **Migração:** no painel do módulo, o Administrador migra cada empresa da versão anterior (`POST /api/psico/migrar`, em etapas): empresa → Cliente (novo ou existente), unidades, GHEs (setor do tipo GHE) e colaboradores → cadastro do SIGE; respostas, participação, ISO 45003 e análise → nova empresa; profissionais → Ergonomistas. O código da coleta e os QR codes continuam valendo. Nada é apagado.
- **Usuários:** volta a ser uma lista única de empresas vinculadas, agora em caixas de marcar com busca.
- **Perfil Usuário Cliente:** sem acesso ao Cadastro (o item some do menu). No Registro, só consulta e baixa cada aba em Excel: sem Novo registro, Importar, Editar, Excluir ou seleção em lote. A API recusa qualquer gravação desse perfil (`entidades.js`) e envio/exclusão de arquivos (`arquivos.js`). Nos Riscos Psicossociais o cliente continua respondendo o checklist ISO 45003.
- **Baixar Excel:** cada aba do Cadastro e do Registro ganhou o botão "⬇ Baixar Excel", com a busca e os filtros da tela.
- **Ajuda:** manual de Cadastro e de Riscos Psicossociais atualizados, novo tópico "probabilidade, severidade e graduação", novo fluxo "Riscos Psicossociais" e notas nos indicadores de Mapa de Risco, Inventário e Plano de Ação.
- **Plano de ação em Excel (da V 1.26):** sem as colunas Risco encontrado, Resultado esperado, Indicador de eficácia, Evidência organizacional e Origem; "Achado" no lugar de Risco encontrado; prazo em branco quando não foi informado.

## V 1.25 — 07/10/2026

- **Riscos Psicossociais · navegação por subabas, perfis de acesso, plano de ação com e-mail e laudo em PDF.**
  - **Menu lateral (`index.html`):** "Riscos Psicossociais" virou grupo expansível (como "Registro"), com as subabas publicadas pelo módulo conforme o perfil: Cadastro de empresa, Colaboradores, Checklist ISO 45003, HSE-IT, Severidade, Probabilidade, Análise de risco, Plano de ação, Laudo, Ergonomistas e Editor de texto. O módulo ocupa toda a largura da área principal (correção da tela "reduzida": `main` deixava de esticar com o iframe). Removido o recolhimento automático do menu da V 1.21.
  - **Perfis:**
    - Administrador: tudo.
    - Consultor (ergonomista): todas as abas de trabalho; não exclui empresa; Editor de texto só leitura ("solicite ao coordenador"); sem acesso à aba Ergonomistas. A API recusa (403) exclusão de empresa e gravação em `profissionais/*` e `config/*` para Consultor.
    - UsuarioCliente: só Checklist ISO 45003 (responder, editar e ver o resultado), HSE-IT (quantidade de respostas por empresa, unidade e GHE) e Plano de ação (ações, prazos e gráfico de status). Vê apenas as empresas cujo "Cliente vinculado no SIGE" está em `empresasVinculadas`. Rotas novas: `GET /api/psico/eu`, `GET /api/psico/cli-empresas`, `GET /api/psico/cli-dados?e=`, `PUT /api/psico/cli-iso?e=`.
  - **Cadastro de empresa:** dados, vínculo com o cliente do SIGE (sugestão automática pelo CNPJ), ações já realizadas, logo, planilha de solicitação, cópia de segurança e "Excluir empresa" (só Administrador).
  - **HSE-IT:** QR code/link por empresa, adesão e respostas por empresa, unidade e GHE, com gráficos (adesão por unidade, respostas por dia, distribuição das respostas).
  - **Severidade:** explicação do SIF, taxa de frequência por GHE e resultado da severidade final por fator (empresa, unidade e GHE). **Probabilidade:** resultado por fator (empresa, unidade e GHE).
  - **Análise de risco:** escolha da matriz (5×5 ou 4×4), matriz com a contagem de GHEs, gráfico por graduação, classificação por unidade/GHE e seleção das ações por GHE.
  - **Plano de ação:** só as ações selecionadas; prazo, responsável e e-mail começam em branco. Com os três preenchidos, o responsável recebe um e-mail (via Microsoft Graph, mesma configuração `GRAPH_*` do SIGE) com a ação, o prazo e a importância da conclusão; não reenvia se nada mudou (botão "Reenviar" disponível). Novo `POST /api/psico/notificar-acao`. Status: Não iniciada (laranja), Em andamento (amarelo), Atrasada (vermelho, prazo vencido) e Concluída (verde), com gráfico e filtros. Excel com Prazo, Responsável, E-mail e Status coloridos e aba "Resumo" por status.
  - **Laudo:** emitido em PDF (jsPDF + fontes Montserrat de `js/pdf-fonts.js`), escolhendo ergonomista e responsável técnico; sumário com páginas e links; removida a seção "Plano de ação consolidado"; removidos de "Resultados gerais da empresa" o parágrafo de graduação da empresa como um todo e o quadro de distribuição dos grupos ocupacionais por graduação; a graduação de cada GHE e a conclusão citam todos os fatores que atingiram a maior graduação (não só o primeiro), e a tabela da conclusão passou a "Fatores determinantes"; NR-01 e NR-17 sempre nas referências bibliográficas (último capítulo).
  - **Editor de texto:** todos os textos padrão do laudo, da capa ao encerramento e referências, editáveis pelo Administrador (`config/laudo`), com "Restaurar padrão" por campo.
  - **Ergonomistas:** cadastro de ergonomistas e responsáveis técnicos.
  - **Gráficos:** Chart.js no padrão do SIGE (rosca 62%, barras arredondadas, rótulos em %), com as cores de risco (trivial azul-claro, baixo verde, moderado amarelo, alto vermelho, altíssimo roxo).

## V 1.24 — 07/10/2026

- **Riscos Psicossociais · escala e confiabilidade (empresas com até ~10 mil colaboradores, sem perda de dados).**
  - **API (`api/src/functions/psicossocial.js`):**
    - `/api/psico/col` paginado (`{ docs, next }`, 2.000 por página; o cliente segue `next`).
    - Consulta de matrícula das telas públicas por índice em memória por empresa (TTL 90 s, invalidado quando a equipe grava um GHE; se não achar, confere de novo sem cache), em vez de ler todos os GHEs a cada colaborador.
    - **Envio do HSE-IT idempotente:** o navegador manda um token `t`. A participação guarda só `sha256("p:"+t)` e a resposta usa id `r`+`sha256("r:"+t)`, então o hash da participação não leva ao id da resposta e o anonimato se mantém. Reenviar o mesmo envio (rede caiu, confirmação perdida, falha entre as duas gravações) completa o que faltou sem duplicar. Se a resposta não puder ser gravada, a matrícula é liberada e volta 503 `retry`.
    - Novas tentativas com espera crescente em falhas transitórias (408/429/449/5xx).
    - Novo `DELETE /api/psico/empresa?e=<eid>`: exclusão em lotes de todos os documentos da empresa, até ~20 s por chamada; o cliente repete enquanto vier `{ restante: true }`.
  - **Adaptador (`js/psicossocial-sige.js`):**
    - Todas as chamadas repetem sozinhas em falhas transitórias (sem rede, 408, 425, 429, 5xx), até 6–7 tentativas.
    - Listagens paginadas e cache de leitura de 10 s.
    - Token do envio guardado no aparelho até a confirmação.
    - `ELEVA_DB.excluirEmpresa`.
    - Reenvio do ISO 45003 já gravado tratado como sucesso.
  - **Tela (`psicossocial.html`):**
    - As respostas do colaborador ficam guardadas no aparelho até o envio ser confirmado. Recarregar a página ou perder a conexão não perde nada: ao digitar a matrícula de novo, ele continua de onde parou.
    - Mensagem de "tentando de novo" durante o envio.
    - Cálculos reaproveitados a cada desenho de tela (respostas agrupadas por GHE).
    - Busca com espera.
    - Importação em paralelo (4 gravações), com limite por GHE (~20 mil colaboradores por registro). Se a importação for interrompida, os dados são recarregados do servidor, com orientação para reimportar; reimportar não duplica.
    - Exclusão de empresa pelo servidor.
    - Botão "Baixar cópia de segurança (JSON)" em Cadastro.
  - **Teste de carga (servidor simulado com 5% de falhas transitórias aleatórias):**
    - Cadastro de 10.000 colaboradores (80 GHEs) e 9.000 respostas concorrentes (60 simultâneas), mais 262 reenvios do mesmo envio e 84 tentativas de segunda resposta: 9.000 respostas = 9.000 participações, nenhuma perdida ou duplicada, segundas respostas barradas.
    - Abrir a empresa: 0,5 s. Trocar de aba: 0,1–0,7 s. Laudo (169 páginas): 2,3 s. Excel: 0,2 s.
    - Importar planilha de 10.000 linhas: leitura 0,25 s, gravação ~9 s. Reimportar não duplica.
- **Recomendação de infraestrutura (Azure):** ativar o backup contínuo (restauração a um ponto no tempo) da conta Cosmos DB `cosmos-bi-ergonomia` em Azure Portal › conta Cosmos › Backup e restauração.
- Service worker: cache `sige-v27`.

## V 1.23 — 07/10/2026

- **Riscos Psicossociais · laudo:**
  - **Sumário:** passa a sair já preenchido com os títulos numerados (capítulos e subitens), mesmo antes de o Word atualizar os campos ou em visualizadores que não atualizam (Word on-line); ao aceitar "atualizar campos", o Word completa os números de página. Estilos `toc 1`/`toc 2` no padrão ElevaLife. Unidades cujo nome já começa com "Unidade" não repetem o prefixo ("Unidade – Unidade Betim" → "Unidade Betim").
  - **Conclusão reescrita** com a nova metodologia: fontes da avaliação (HSE-IT, ISO 45003, SIF ajustada pelas evidências), fatores fortes e de atenção, graduação da empresa, quadro dos grupos ocupacionais (unidade, GHE, fator determinante, graduação), fatores mais frequentes com risco moderado ou acima, resumo do plano e, ao final, tabela com a quantidade de fatores por graduação (fatores × Trivial…Altíssimo, com total).
  - **Referências bibliográficas** como último capítulo (depois do encerramento e das assinaturas) e lista padrão ampliada com as portarias citadas no relatório modelo e na Biblioteca Mestre (Portaria SEPRT 6.730/2020, Portaria MTE 1.419/2024, Portaria MTP 423/2021).
- Service worker: cache `sige-v26`. Sem alteração na API.

## V 1.22 — 06/10/2026

- **Riscos Psicossociais · laudo mais natural:** a análise de cada fator (empresa e GHEs) foi reescrita em linguagem corrida — probabilidade (média do HSE-IT e gestão pelo ISO 45003) e severidade (gravidade do fator segundo a literatura, com o motivo resumido, ajustada pelas evidências de dano do grupo, sem a conta SF = …; a fórmula fica só na metodologia, item 4.4). A graduação do risco de cada fator passa a ser uma tabela de três colunas (probabilidade, severidade e graduação), colorida.
- **Matriz 4 × 4 = modelo ElevaLife:** graduação final linhas P1→P4: Trivial, Baixo, Baixo, Moderado / Baixo, Baixo, Moderado, Alto / Baixo, Moderado, Alto, Alto / Moderado, Alto, Alto, Altíssimo. Service worker: cache `sige-v25`.

## V 1.21 — 06/10/2026

- **Riscos Psicossociais · layout em notebooks:** o módulo roda num iframe e o layout dele depende da largura disponível; com o menu lateral aberto, em telas de notebook sobravam ~800 px e as telas empilhavam como no celular. Agora, ao abrir a aba, o menu lateral é recolhido automaticamente (sem alterar a preferência salva; volta ao sair da aba) e a área do módulo perde o limite de largura e o espaçamento extra (`body.psico-ativo`, script inline em `index.html`). No módulo, os pontos de quebra para uma coluna caíram (etapas: 800 px; painéis lado a lado: 820 px) e a fonte fica um pouco menor entre 641 e 1280 px. Service worker: cache `sige-v24`.

## V 1.20 — 06/10/2026

- **Riscos Psicossociais · Excel do plano de ação:** removida a aba "Resumo por GHE" (ficam "Plano de ação" e, quando houver, "Ações a manter"). Service worker: cache `sige-v23`.

## V 1.19 — 06/10/2026

- **Riscos Psicossociais · laudo:** o capítulo "Resultados gerais da empresa" passa a ter a mesma estrutura dos GHEs — resultado HSE-IT e gráfico, interpretação por fator (probabilidade, severidade e graduação), quadro-resumo e graduação da empresa — seguido da distribuição dos GHEs por graduação. Service worker: cache `sige-v22`.

## V 1.18 — 06/10/2026

- **Riscos Psicossociais · matriz 5 × 5 = modelo ElevaLife** (graduação final igual à matriz de criticidade × probabilidade da empresa, com a célula Trivial em probabilidade 1 × severidade 1). A SF 1 é lida na coluna 1 (colunas 1 e 2 equivalem à SF 1); SF 2, 3 e 4 → colunas 3, 4 e 5. Service worker: cache `sige-v21`.

## V 1.17 — 06/10/2026

- **Riscos Psicossociais · cores das graduações** (variáveis `--g0`…`--g4`, aplicadas a risco, graduação HSE, probabilidade, severidade, EO, distribuição de respostas e checklist ISO, na tela, no Word e no Excel): trivial/muito baixo azul claro `#8CCBEB`, baixo verde `#2E8B57`, moderado amarelo `#F2C230`, alto vermelho `#C62828`, muito alto/altíssimo/crítico roxo `#6A3D9A`. Texto escuro sobre azul claro e amarelo.
- **Laudo, por GHE:** interpretação por fator (probabilidade: média HSE-IT e graduação × resultado ISO 45003; severidade: SIF × evidência organizacional/fator atenuante com o cálculo da SF; graduação do risco), depois quadro-resumo com probabilidade, severidade e graduação de cada fator e, por fim, o plano de ação para os riscos identificados. As tabelas de graduação (empresa e GHE) mostram só probabilidade, severidade e graduação.
- **Excel do plano:** colunas "Probabilidade do fator" e "Severidade do fator" na aba Plano de ação; aba Resumo por GHE só com Unidade, GHE e a graduação de cada fator. Service worker: cache `sige-v20`. Sem alteração na API.

## V 1.16 — 06/10/2026

- **Riscos Psicossociais · Manual SIF HSE-IT ElevaLife.** SIF fixa por domínio (Demandas, Apoio da chefia e Relacionamentos 4; Controle, Apoio dos colegas, Cargo e Comunicação e mudanças 3), sem edição por empresa. Severidade Final SF = SIF × 0,75 + EOaj × 0,25 (EOaj = EO − 1), arredondada no inteiro mais próximo (0,50 sobe) — mesma tabela da V 1.15. A EO continua sugerida pela taxa de frequência (casos graves = 5) e pode ser ajustada por GHE (`eoMan`) com outros indicadores.
- **Matriz 5 × 5 de volta:** colunas 1 e 2 da severidade equivalem à SF 1 e usam os valores da coluna 2 da matriz original (critério conservador); SF 2, 3 e 4 → colunas 3, 4 e 5. Matriz 4 × 4 sem mudança.
- **Laudo:** item 4.4 reescrito com o manual (SIF, escala, justificativa por domínio, EO/EOaj, fórmula da SF, matriz SIF × EO e limitações); referências padrão = lista do manual + NR-7, Portaria MTE 765/2025, ISO 45001 e OIT/OMS 1984. Service worker: cache `sige-v19`. Sem alteração na API.

## V 1.15 — 06/10/2026

- **Riscos Psicossociais · nova metodologia de severidade.** Probabilidade continua HSE × ISO 45003, agora calculada por fator do HSE (graduação do fator × resultado do checklist). Severidade = SIF do fator (1 Baixa a 4 Crítica; padrão Demandas 4, Controle 3, Apoio da chefia 4, Apoio dos colegas 3, Relacionamentos 4, Cargo 3, Comunicação e mudanças 3; editável por empresa) × evidência organizacional (EO 1 a 5: TF < 2%, 2 a < 5%, 5 a 20%, > 20%, casos graves). Matrizes 5 × 4 (colunas 1 a 4 da 5 × 5 original) e 4 × 4. A graduação do GHE é a do fator de maior risco; a recomendação automática usa os fatores com risco moderado ou acima.
- **Tela:** sem a lista lateral de empresas (seletor no topo), etapas numeradas em ordem de preenchimento com status, layout de computador; a aba Taxa de frequência passa a ser "Severidade (SIF e TF)".
- **Laudo:** responsável técnico citado e assinado uma vez quando é o próprio ergonomista; razão social em caixa normal no texto; "Resultados gerais da empresa"; graduação moderada/alta no HSE e na probabilidade; ISO 45003 com gestão eficaz / intermediária / ineficaz; sem a coluna Prazo e sem a frase sobre o cruzamento no plano; lista das ações já realizadas; nova metodologia nos itens 4.3 a 4.5; capítulo de referências bibliográficas (editável em Cadastro, documento `config/laudo`).
- Aba Riscos Psicossociais: iframe mais alto. Service worker: cache `sige-v18`. Sem alteração na API.

## V 1.14 — 06/10/2026

- **Novo módulo Riscos Psicossociais (versão de testes)** em `psicossocial.html`, aberto pela aba Riscos Psicossociais (embutido) ou em tela cheia. Fluxo: cadastro da empresa pelo CNPJ (usa `/api/cnpj`) → planilha de solicitação ao cliente (unidades, colaboradores/GHEs, taxa de frequência, ações já realizadas) → coleta do HSE-IT por QR code ou código curto, com matrícula (resposta única; a matrícula não é gravada junto das respostas) → checklist ISO 45003 pelo gestor do contrato → análise de risco (probabilidade = HSE × ISO 45003; severidade = taxa de frequência do GHE; matriz 4x4 ou 5x5) → plano de ação com a Biblioteca Mestre (450 ações) → relatório Word.
- **API:** duas rotas novas no dispatcher (`ROTAS_ESPECIAIS`): `/api/psico/{doc|col|eu}` (equipe: sessão + papel Administrador/Consultor) e `/api/psicopub/{codigo|empresa|matricula|resposta|iso}` (pública, sem login, usada pelas telas do QR code). Dados no Cosmos, container `psicossocial` (criado sob demanda, partição `/EmpresaId`). Ver `api/src/functions/psicossocial.js`.
- `staticwebapp.config.json`: `/psicossocial.html` pode ser embutido no próprio SIGE (`X-Frame-Options: SAMEORIGIN`). Service worker: cache `sige-v17`.

## V 1.13 — 06/10/2026

- **Importação única do histórico do sistema anterior.** Importar o relatório de Inventário de Riscos agora distribui tudo de uma vez, com uma única prévia de validação: (1) cria os cadastros que faltam (Cliente › Unidade › Setor › Posto › Cargo › Atividade), (2) cria a **Avaliação Ergonômica (AEP) de cada posto/cargo** a que os fatores pertencem — só com os dados da planilha (jornada, pausas e rodízio ficam para preencher depois) e **reaproveitando as AEP que já existem** (chave: Cliente, Unidade, Setor, Posto, Cargo, Atividade) — e (3) grava os fatores no Inventário. A criação da AEP é uma caixa marcada na prévia (padrão: marcada).
- **Da tela de AEP:** ao selecionar uma planilha de Inventário de Riscos (Grupo, Fator, Criticidade/Probabilidade/Graduação) em Avaliação Ergonômica › Importar Excel, o sistema abre automaticamente a importação do histórico já com a planilha carregada (não é preciso escolher o arquivo de novo). Planilhas de AEP comuns seguem no fluxo de AEP.
- **Interpretação de valores:** "Temperatura" (sistema anterior) passa a ser reconhecido como "Ambiente de trabalho extremamente quente ou frio" (sinônimo); grafias parecidas continuam em revisão (nomes unificados, correspondência de valores, duplicadas).
- Motor (`js/importador.js`): novos recursos opcionais `derivados` (registros criados junto), `redirecionar` (planilha de outro tipo) e `abrir(def, ctx, inicial)` (arquivo já lido). Sem rota nova na API. Service worker: cache `sige-v16`.

## V 1.12 — 06/10/2026

- **Aviso na importação da Avaliação Ergonômica (AEP):** se a planilha tiver colunas de Inventário de Riscos (Grupo, Fator, Criticidade, Probabilidade, Graduação…), a prévia mostra um aviso para usar Registro › Inventário de Riscos (AEP) › Importar Excel. Motivo: o relatório do sistema anterior tem Empresa/Unidade/Setor/Posto/Cargo, e importado na AEP só a hierarquia entra (e avaliações vazias), enquanto os fatores de risco são ignorados. Novo recurso opcional `avisoPlanilha(cabecalhos)` no motor (`js/importador.js`); só a AEP o usa. O aviso não bloqueia a importação. Service worker: cache `sige-v15`.

## V 1.11 — 06/10/2026

- **Atividade e Data deixam de ser obrigatórias nas importações** do Inventário de Riscos (Atividade, Data de identificação) e da Avaliação Ergonômica/AEP (Atividade, Data da avaliação): o sistema anterior não as traz. Sem coluna ou com célula vazia, o campo fica em branco; os "valores padrão" da prévia passam a começar vazios (a V 1.10 sugeria "Atividade não informada – histórico" e a data de hoje) e continuam editáveis, caso o usuário queira preencher as linhas sem dado. Não cria mais cadastros de Atividade fictícios.
- Efeito na chave de duplicidade: sem Atividade e sem Data, duas linhas com o mesmo Posto + Cargo (AEP) caem na mesma chave — a segunda é marcada como repetida/atualiza a primeira. Formulários de cadastro manual seguem com os campos obrigatórios. Nenhuma rota da API alterada. Service worker: cache `sige-v14`.

## V 1.10 — 06/10/2026

- **Importação do Inventário de Riscos do sistema anterior** (Registro › Inventário de Riscos › "Importar Excel", coleção `fatorRisco`): lê o relatório exportado do sistema anterior (Empresa, Unidade, Setor, Cargo, Posto de trabalho, Grupo, Fator, Existe fator, Circunstância geradora, Consequência, Medida de controle, Criticidade, Probabilidade, Pontuação, Graduação, Propor ação, ação para eliminação, controles administrativos, Status, SLA, Observação, Válido até). Decisão de negócio: **a Graduação e a Pontuação do sistema anterior são gravadas exatamente como vieram** (o S.I.G.E. só calcula se a planilha não trouxer); as linhas em que a graduação difere da matriz do S.I.G.E. são marcadas (chip, filtro e aviso por linha). Textos de ação do legado vão para `Acao Eliminacao` / `Controles Administrativos` (convertíveis em ação do Plano de Ação), `Propor Acao` e `Matriz` (a do cliente; novo cliente nasce em "Matriz 4x4"). Observação recebe "Importado do sistema anterior em dd/mm/aaaa.".
- **Criar cadastros ausentes** (todas as importações com hierarquia): se Cliente › Unidade › Setor › Posto de Trabalho › Cargo › Atividade não existir, a prévia mostra o que falta e oferece "Criar automaticamente os cadastros que faltam" (opção desligada por padrão). Cria nível a nível, de cima para baixo, com os mesmos ids do cadastro manual (`idCadastroMestre`); só Administrador cria Cliente (regra já existente na API); falha em um nível bloqueia os dependentes e é informada no final, sem deixar registros sem cadastro.
- **Revisão de duplicadas:** linhas com a mesma chave (Cliente…Atividade + Grupo + Fator + Fonte geradora) dentro do arquivo ou já gravadas no S.I.G.E. — idênticas (padrão: pular) ou parecidas (padrão: importar; contra o sistema, pular), com decisão por linha, ações em bloco, filtro e coluna "difere em". Reimportar o mesmo arquivo não duplica.
- **Nomes parecidos:** dentro do mesmo cliente, nomes que são a mesma coisa escrita de formas diferentes (sem acento/pontuação/palavras de ligação/plural, ou um erro de digitação em uma palavra) são agrupados para o usuário escolher a grafia (padrão: a já cadastrada, senão a mais frequente) ou manter separados; números, algarismos romanos e siglas nunca são unificados.
- **Correspondência de valores:** Grupo/Fator (lista ISO/TS 20646) e a escala da matriz (Leve = Baixa, Alto = Alta…) com equivalente automático conferível; o que não tem equivalente ("Temperatura") o usuário mapeia na prévia ou rejeita as linhas.
- **Valores padrão editáveis** para o que a planilha não traz (Atividade padrão "Atividade não informada – histórico"; Data de identificação = hoje); `_x000A_` vira quebra de linha e "-", "N/A", "Não informado" viram vazio; **Relatório de revisão** (.xlsx) com duplicadas, grafias, correspondências, cadastros a criar e rejeitadas.
- Motor (`js/importador.js`): `analisar` passa a devolver `grafias`, `correspondencias`, `plano`/`pendente` e `padroesUsados`; novos recursos (`hierarquia`, `padroes`, `correspondencia`, `duplicidade`, `marcas`, `valoresVazios`) são opcionais — HHT, Restritos e AEP mantêm o comportamento anterior. Nenhuma rota nova na API; nenhuma regra de cálculo alterada. Service worker: cache `sige-v13`.

## V 1.9 — 06/10/2026

- **Editor de Texto cobre todo o Laudo** (Cadastro › Editor de Texto, coleção `modeloLaudo`): de 12 para 48 campos, em ordem do documento — capa (lema, título, subtítulo), títulos das seções (campo "Títulos": uma linha `chave | título`), apresentação, ElevaLife, responsabilidade, demanda, fundamentação, pilares, metodologia, etapas, PDCA, técnicas, ISO/TS 20646, guias de graduação (ADM, escalas), interfaces, gravidade/probabilidade/graduação, medidas, avaliações, recomendações, referências, conclusão e texto de validação. Campo vazio = texto padrão (`js/laudo-textos.js`); sem edição, o PDF permanece idêntico ao da V 1.8. Novos marcadores: `{nFatoresISO}`, `{nGruposISO}`, `{matriz}`, `{dataBase}`, `{nomes}`, `{emissao}`, `{codigo}`, `{revisao}`.
- **Laudo em PDF e Word (.docx):** "Gerar Laudo" produz os dois arquivos a partir do mesmo conteúdo. Novo `js/laudo-docx.js` (sem biblioteca externa): estilos Título 1/2/3, sumário como campo do Word, cabeçalho/rodapé com "Página X de Y", tabelas, imagens (logotipo, fotos, assinaturas) e QR Code nativos. `js/laudo.js` passa a ter `preparar()` (dados e texto compartilhados) e `BI.Laudo.gerarDocx`.
- Novo campo `Arquivo Word` no cadastro de Laudo e botão "⬇ Word" na lista. API de arquivos: coleção `laudo` aceita `.docx` (assinatura PK conferida). Hash SHA-256 e verificação continuam referindo-se ao PDF.
- Limites: cabeçalhos das colunas das tabelas e alguns rótulos estruturais seguem fixos no código. Laudos anteriores não têm Word. Service worker: cache `sige-v12`.

## V 1.8 — 05/10/2026

- **Importação do histórico de AEP** (Registro › Avaliação Ergonômica › "Importar Excel"), no mesmo motor da V 1.6 (`js/importador.js`): modelo para baixar, **apelidos de colunas** comuns de sistemas anteriores (Empresa, Filial, Área, Posto, Função, Data da AEP, Jornada…) reconhecidos automaticamente, mapeamento manual, prévia e confirmação. Chave natural: Cliente + Unidade + Setor + Posto + Cargo + Atividade + Data da avaliação (atualiza, não duplica).
- Jornada, Pausas e Rodízio ficam opcionais **só na importação** (no formulário continuam obrigatórios). Fotos não são importadas. Nenhuma rota nova na API; AET e gráficos inalterados.
- Pendente (aguarda planilha real do sistema legado): mapeamento exato das colunas e dos 5 níveis de risco legados para os 4 níveis do S.I.G.E.
- Service worker: cache `sige-v11`.

## V 1.7 — 05/10/2026

Revisão de segurança (pen test: código + testes seguros em produção). Relatório completo em `docs/relatorio-seguranca-v1.7.md`.

- **Convites (crítico):** `POST /api/auth/convidar` e `POST /api/usuarios` não reenviam/zeram convite de conta ativa (409); Consultor só convida `UsuarioCliente` e só para empresas às quais está vinculado; `reenviar-convite` de Consultor limitado a `UsuarioCliente`.
- **RBAC:** `UsuarioCliente` não grava `laudo`, `cliente`, `ergonomista`, `modeloLaudo` nem `certificadoCalibracao` (API interna, uploads e chave de API de empresa); API pública não grava coleções globais. `Codigo Verificacao` do laudo único (409).
- **Arquivos:** chave `<EmpresaId>/<colecao>/<arquivo>` validada (3 partes, sem `..`, `\`, `%`), bloqueando path traversal; assinatura (bytes iniciais) conferida para JPEG, PNG, PDF e XLSX; `X-Content-Type-Options: nosniff` no download.
- **Login:** 5 senhas erradas bloqueiam a conta por 15 min (HTTP 429); resposta com custo de tempo igual para e-mail inexistente; "Esqueci minha senha" com intervalo mínimo de 1 min por conta; `/api/auth/*` só aceita POST (405).
- **Front:** `pdfjsLib.getDocument(..., { isEvalSupported:false })` (CVE-2024-4367, pdf.js 3.11.174).
- **Config:** `/MANUAL.md`, `/docs/*.md` e `/data/*.py` respondem 404; cabeçalhos `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'` e `Permissions-Policy`.
- Service worker: cache `sige-v10`.

## V 1.6 — 05/10/2026

- **Importação por Excel** (novo `js/importador.js`, motor genérico reutilizável): botão "Importar Excel" em Registro › HHT / Dias Úteis e Registro › Restritos (Compatíveis). Fluxo: baixar modelo (abas Dados, Instruções, Exemplo e Referências) ou "Baixar dados atuais" → enviar a planilha → **prévia** (novo, atualiza, sem alteração, erro, com motivo por linha e mapeamento de colunas ajustável) → **confirmação** → gravação em lote com relatório. Linhas com erro nunca são gravadas; há download das linhas rejeitadas.
- Validações: obrigatórios, números (aceita vírgula decimal), datas dd/mm/aaaa e número de série do Excel, mês (mm/aaaa, mmm/aaaa), listas fechadas e hierarquia Cliente › Unidade › Setor › … contra o Cadastro (grafia padronizada). Limite de 2.000 linhas por arquivo.
- **Sem duplicidade:** HHT / Dias Úteis passa a aceitar um lançamento por Cliente + Unidade + Setor + mês (formulário e importação). Importação atualiza o existente; Restritos usa Cliente + Matrícula + Início da restrição.
- `BI.DB.salvarEmLote` (js/db.js): mesmas rotas e regras de empresa/permissão do cadastro manual; 4 requisições em paralelo e uma única recarga ao final. Nenhuma rota nova na API e nenhuma regra de cálculo alterada.
- Textos de Ajuda (Manual e Histórico) atualizados. Service worker: cache `sige-v9`.

## V 1.5 — 05/10/2026

- **Textos de Ajuda:** manual de uso reescrito em linguagem técnica e padronizada, com "Objetivo" e "Perfis" em cada seção; seções novas (Absenteísmo, HHT e Restritos; Usuários, perfis e configurações) e conteúdo atualizado conforme V 1.2–1.4 (ações por fator, evidência, Gerar Laudo em uma etapa, verificação).
- **Dicionário de indicadores** (botão "i" e Ajuda › Indicadores) e **fluxos BPMN** com redação técnica; histórico de versões revisado. Nenhuma regra de cálculo foi alterada.
- Renderização do manual: `js/ajuda.js` (campos opcionais `objetivo` e `perfis`); estilo `.ajuda-objetivo` em `css/style.css`. Service worker: cache `sige-v8`.

## V 1.4 — 05/10/2026

- **Laudo:** formulário enxuto (12 campos visíveis); `Texto`, `Emitido Por`, `Hash Documento`, `Registro Responsavel` e `Registro Executor` ficam ocultos e são gravados na geração. Revisão inicial "00", Tipo "Laudo" e Emitido em (hoje) por padrão; certificado de calibração só aparece com "Incluir = Sim".
- **Rodapé:** botão primário "Gerar Laudo" (gera, anexa e salva em um clique; exige Cliente e Responsável técnico) ao lado de "Salvar sem gerar" e "Cancelar".
- **Menus:** Ergonomistas, Certificado Calibração e Editor de Texto movidos para Cadastro; "Compatíveis" → "Restritos (Compatíveis)" no menu Registro. Sem mudança de dados.
- Service worker: cache `sige-v7`.

## V 1.3 — 05/10/2026

- **Laudo (AEP) oficial:** gerador novo (`js/laudo.js`), A4 retrato, capa com logotipo do cliente, sumário clicável (links internos + marcadores do PDF), cabeçalho/rodapé corridos com "Página X de Y" e código do documento. Seções: apresentação, a ElevaLife, responsabilidade técnica, demanda, dados da empresa, fundamentação (ergonomia, cinco pilares, NR-17, NR-01/GRO/PGR), métodos (cinco etapas, PDCA, técnicas, ISO/TS 20646, guias de graduação, interfaces), classificação do risco (gravidade, probabilidade, matriz do cliente, tipos de ação, risco residual), avaliações por posto (fotos numeradas, descrição, panorama, grupos, fatores com ações e risco previsto/realizado), plano de ação, risco residual por fator, referências e conclusão.
- **Texto editável:** `js/laudo-textos.js` guarda o texto padrão; a área técnica substitui cada trecho em Registro › Editor de Texto (campo vazio = padrão; botão "Preencher campos vazios com o texto padrão"). Marcadores: `{cliente}`, `{unidade}`, `{setores}`, `{nPostos}`, `{nFatores}`, `{nAcoes}`, `{resumoNiveis}`. Tabelas e quadros (pilares, etapas, PDCA, métodos, guias de graduação, interfaces) seguem fixos no código.
- **Ergonomistas (coleção global `ergonomista`):** nome, formação/certificações, registro profissional e imagem da assinatura (container `ergonomistas-assinaturas`, criado sob demanda). O Laudo ganha "Responsável técnico" e "Ergonomista executor".
- **Validação:** o Laudo grava `Codigo Verificacao` (ELV-AEP-AAAA-XXXXXX), `Hash Documento` (SHA-256 do PDF), `Revisao` e os registros profissionais. Última página: assinaturas (imagem), campo do cliente e QR Code. `GET /api/verificar/{codigo}` é público e devolve só tipo, cliente, emissão, revisão, ergonomistas e hash; a página `/verificar/{codigo}` confere o arquivo no navegador (o PDF não sai do aparelho). Só vale depois de salvar o registro do Laudo.
- QR Code: biblioteca `qrcode-generator` (cdnjs). Service worker: cache `sige-v6`.
- O gerador anterior (V 1.2) permanece em `app.js` apenas como reserva e será removido na próxima versão.

## V 1.2 — 05/10/2026

- **Ações por fator de risco:** o Inventário de Riscos troca "Ação para Eliminação"/"Ação Organizacional" (texto) e o risco "após a melhoria" digitado por uma **lista de ações**. Cada ação é um registro do Plano de Ação ligado ao fator (`Fator Risco Id`) com tipo, descrição, segmento corporal, "reduz o risco de [atual] para [menor nível]", complexidade (Baixa/Média/Alta), responsável (nome + e-mail), prazo e status (Não iniciada / Em andamento / Concluída). A ação precisa levar o segmento a um nível menor que o atual.
- **Risco residual calculado:** por segmento, previsto = menor alvo entre as ações; realizado = idem só com as concluídas; o fator fica no maior nível entre os segmentos. Sem ação, o residual não se aplica.
- **Configurações (Administrador):** novos nomes para os três tipos de ação (códigos internos fixos `Eliminacao`, `Engenharia`, `Organizacional`); coleção global `configuracao`.
- **Evidência obrigatória:** para concluir é preciso anexar foto (JPG/PNG) ou PDF (até 15 MB) — regra aplicada no servidor (`api/src/shared/planoAcaoRegras.js`). Só o Administrador pode concluir sem evidência, com justificativa (mín. 10 caracteres) e data-limite (até 180 dias); o servidor grava `_dispensa` (quem, quando, justificativa, prazo) e os lembretes diários cobram a evidência (3 dias antes, no dia, e a cada 7 dias de atraso) do responsável e do Administrador. Anexar a evidência regulariza a dispensa.
- **E-mail de atribuição** só na criação da ação ou quando o e-mail do responsável muda (acaba o reenvio a cada gravação / reenvio da fila offline).
- **Compatibilidade:** registros antigos intactos (campos e risco pós antigos ficam gravados); textos antigos viram ação com um clique; ações concluídas antes da V 1.2 seguem editáveis sem evidência.
- **Plano de Ação:** campos novos (fator vinculado, tipo, segmento, risco atual/alvo, complexidade, situação, evidências) e coluna "Evidência" (Anexada (n) / Pendente até dd/mm / Sem evidência). Ações podem ser criadas offline (fila).
- **Laudo:** a seção do Inventário lista as ações e o risco previsto/realizado.
- Correção: histórico não registra mais alteração falsa quando só muda o tipo do valor.

## V 1.1 — 05/10/2026

- **Ano/Mês só com data lançada:** as opções vêm das datas realmente registradas e o filtro só traz registros com a data preenchida. Campos novos: Data da avaliação (Mapa de Risco e Avaliação Ergonômica) e Data da identificação (Inventário de Riscos).
- **Datas em DD/MM/AAAA** em todas as telas, com máscara automática e calendário; o banco continua guardando AAAA-MM-DD (ordena e filtra certo). Excel exporta em DD/MM/AAAA.
- **Histórico de cada registro:** o servidor grava quem criou, quem editou por último e quando (`_criadoEm/_criadoPor/_editadoEm/_editadoPor/_historico`); o navegador não consegue forjar. Botão "Mais detalhes" em cada linha mostra o histórico campo a campo (valor atual, autor, data/hora e valor anterior). Registros anteriores à V 1.1 aparecem com "usuário não identificado".
- **Inventário de Riscos:** o checklist passa a mostrar Fonte Geradora, Consequência, Medidas de Controle Existentes, Ação para Eliminação, Ação Organizacional e a classificação após a melhoria (Criticidade/Probabilidade pós, graduação calculada pela matriz do cliente). O formulário do cadastro ganhou a mesma seção.
- **Menos campos abertos:** SLA em lista (24 horas a 90 dias); e-mail do responsável validado e preenchido a partir de ações anteriores; máscaras de CNPJ, CEP e telefone; sugestões em Queixa Principal, Restrição Médica, Atividade Compatível (recomendada) e Emitido por.
- Restritos: o filtro Ano/Mês agora considera o Início da Restrição.

## V 1.0 — 04/10/2026

Primeira versão numerada: fecha o pacote de melhorias de 04/10/2026.

- Coleta offline da Avaliação Ergonômica (AEP) com fotos, fila de envios, conflitos e sessão expirada.
- Exclusão de dados com ou sem internet; fotos e arquivos saem do Storage junto com o registro.
- Endereço oficial `sige-ergo.elevalife.com.br` (URL pública dos e-mails e do job de lembretes).
- Visual limpo: textos de apoio dos cards, introduções de página e notas de rodapé removidos; a explicação de cada indicador fica no botão "i" e em Ajuda.
- Dicionário de indicadores (Gestão de Risco, Absenteísmo, Restritos) — ver `docs/indicadores-gestao-de-risco.md`.
- Correção: graduação do Inventário de Riscos agora conta "Moderado", "Muito Baixo" e "Altíssimo".
- Correção: fatores marcados "Não" não entram mais nos indicadores do Inventário.
- Correção: card de Prazos do Inventário considera só fatores em aberto.
- Nova tela Riscos Psicossociais (em construção).
- Nova página Ajuda: manual de uso, 7 fluxos BPMN, indicadores e histórico de versões.
- Marco zero: base de dados e Storage zerados, mantido apenas o login do Administrador responsável.
