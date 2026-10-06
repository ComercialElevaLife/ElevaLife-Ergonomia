# Histórico de versões — S.I.G.E

A partir de 04/10/2026 o S.I.G.E é versionado. A versão atual aparece no rodapé do sistema e em Ajuda › Versão (constante `BI.VERSAO` em `js/indicadores.js`).

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
