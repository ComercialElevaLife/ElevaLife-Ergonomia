# Histórico de versões — S.I.G.E

A partir de 04/10/2026 o S.I.G.E é versionado. A versão atual aparece no rodapé do sistema e em Ajuda › Versão (constante `BI.VERSAO` em `js/indicadores.js`).

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
