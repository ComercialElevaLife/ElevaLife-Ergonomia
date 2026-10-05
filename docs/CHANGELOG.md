# Histórico de versões — S.I.G.E

A partir de 04/10/2026 o S.I.G.E é versionado. A versão atual aparece no rodapé do sistema e em Ajuda › Versão (constante `BI.VERSAO` em `js/indicadores.js`).

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
