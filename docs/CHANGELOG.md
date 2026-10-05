# Histórico de versões — S.I.G.E

A partir de 04/10/2026 o S.I.G.E é versionado. A versão atual aparece no rodapé do sistema e em Ajuda › Versão (constante `BI.VERSAO` em `js/indicadores.js`).

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
