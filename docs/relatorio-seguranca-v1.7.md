# Relatório de segurança — S.I.G.E V 1.7

Data: 05/10/2026 · Escopo: revisão de código (`api/` e `js/`), configuração do Static Web App e testes **seguros e não destrutivos** em produção (`https://sige-ergo.elevalife.com.br`), sem login.

## 1. Método e limites

- **Revisão de código:** autenticação e sessão (`shared/auth.js`, `functions/auth.js`), multi-tenant e perfis (`shared/tenant.js`, `functions/entidades.js`, `usuarios.js`), arquivos (`arquivos.js`, `blob.js`), API pública e chaves (`publicApi.js`, `apiKeys.js`, `apiKeysAdmin.js`), rotas públicas (`verificar.js`, `cnpj.js`, job de lembretes), renderização no front (uso de `innerHTML`), cabeçalhos e `staticwebapp.config.json`.
- **Testes em produção (sem login):** cabeçalhos de resposta, CORS e pré-voo, redirecionamento HTTP→HTTPS, acesso anônimo a todas as rotas de dados, arquivos estáticos expostos, mensagens do login (3 tentativas inválidas com e-mails de teste, sem repetição em massa), redefinição de senha com e-mail inexistente, token de convite inválido, sessão forjada (JWT `alg:none`).
- **Não foi feito (de propósito):** força bruta, negação de serviço, qualquer escrita ou exclusão de dados, testes autenticados com contas reais. Os fluxos corrigidos foram validados com testes automatizados contra um banco simulado.
- Achados de "crítica" e "alta" foram comprovados por leitura do código; o traversal de arquivos foi comprovado executando o SDK do Storage (a URL final colapsa os `..`).

## 2. Resumo

| # | Severidade | Achado | Situação em V 1.7 |
|---|-----------|--------|-------------------|
| 1 | Crítica | Consultor toma qualquer conta (inclusive Administrador) pelo convite | Corrigido |
| 2 | Alta | Usuário-cliente grava laudos, cadastro da empresa e bibliotecas globais; permite forjar a verificação pública do laudo | Corrigido |
| 3 | Alta | Login sem limite de tentativas | Corrigido (por conta) |
| 4 | Alta | pdf.js 3.11.174 vulnerável (CVE-2024-4367) lendo PDF enviado | Mitigado (flag); atualizar a biblioteca |
| 5 | Média | Path traversal em `/api/arquivos` | Corrigido |
| 6 | Média | API pública (chave com escrita) grava coleções globais | Corrigido |
| 7 | Média | Manuais internos (`/MANUAL.md`, `/docs/*.md`) públicos | Corrigido (404) |
| 8 | Média | Sem proteção contra clickjacking / sem CSP | Parcial (`frame-ancestors`); CSP completa recomendada |
| 9 | Média | Bibliotecas externas sem SRI; SheetJS 0.18.5 com CVEs de leitura de arquivo | Recomendação |
| 10 | Baixa | Upload aceita rótulo de tipo sem conferir o conteúdo | Corrigido |
| 11 | Baixa | "Esqueci minha senha" permite encher a caixa de e-mail de terceiros | Corrigido |
| 12 | Baixa | `GET /api/auth/login` devolve 500 (deveria ser 405) | Corrigido |
| 13 | Baixa | Consultor lista todos os usuários de todas as empresas | Decisão sua |
| 14 | Baixa | Sessão de 7 dias sem revogação | Recomendação |
| 15 | Baixa | `SETUP_SECRET` (bootstrap) permanece configurado | Ação operacional |
| 16 | Baixa | Política de senha só exige 8 caracteres; bcrypt custo 10 | Recomendação |
| 17 | Baixa | `/api/verificar` sem limite de consultas | Recomendação |

## 3. Detalhes

### 1. Tomada de conta pelo convite — Crítica (corrigido)

`POST /api/auth/convidar` e `POST /api/usuarios` aceitam Administrador **ou Consultor** e chamavam `criarOuConvidarUsuario`, que (a) aceitava qualquer `Papel` e qualquer `EmpresasVinculadas`; (b) para um e-mail já existente, trocava o papel, marcava a conta como "Convidado", gerava novo token e devolvia o link na resposta. Com esse link, `primeiro-acesso` define uma nova senha. Resultado: um Consultor podia (1) criar um Administrador com o próprio e-mail secundário, (2) vincular-se a empresas de outros clientes e (3) assumir a conta de um Administrador existente. O comentário em `usuarios.js` dizia que isso era impedido; só o `PUT` era.

**Correção:** convidar e-mail com conta ativa responde 409 e não altera nada; Consultor só convida `UsuarioCliente` e só para empresas às quais ele mesmo está vinculado; reenvio de convite por Consultor limitado a `UsuarioCliente`.

### 2. Gravação indevida por usuário-cliente — Alta (corrigido)

Qualquer papel com acesso à empresa podia criar, editar e excluir `laudo`, `cliente` e as coleções globais `ergonomista` (nome, registro e assinatura), `modeloLaudo` e `certificadoCalibracao` (esta última afeta todas as empresas). Como `/api/verificar` é público e consulta o campo `Codigo Verificacao` do laudo, um usuário-cliente podia criar um registro com código e hash arbitrários e fazer a página pública "confirmar" um documento falso, ou copiar o código de um laudo real.

**Correção:** `UsuarioCliente` só lê essas coleções (API interna, upload/exclusão de arquivos e chave de API de empresa). `Codigo Verificacao` passa a ser único (409).
**Decisão sua:** incluí `cliente` (cadastro da empresa) na lista. Se algum cliente precisa editar o próprio cadastro, basta tirar `"cliente"` de `COLECOES_SO_EQUIPE_GRAVA` (`entidades.js`) e de `UPLOAD_SO_EQUIPE` (`arquivos.js`). A matriz completa de permissões por perfil (por exemplo, quem pode excluir registros operacionais) continua aberta e precisa da sua definição.

### 3. Login sem limite de tentativas — Alta (corrigido)

Nenhum contador, atraso ou bloqueio: um atacante podia testar senhas sem limite contra e-mails conhecidos. O sistema guarda dados de saúde ocupacional (LGPD, dados sensíveis).

**Correção:** 5 erros seguidos bloqueiam a conta por 15 min (HTTP 429, mesmo com a senha correta durante o bloqueio); acerto zera o contador; e-mail inexistente gasta o mesmo tempo de um bcrypt real. **Limitação:** o bloqueio é por conta, não por IP (o plano gratuito não oferece WAF); alguém pode, em tese, manter uma conta bloqueada tentando repetidamente. O mais forte seria Azure Front Door/WAF ou MFA.

### 4. pdf.js vulnerável — Alta (mitigado)

`index.html` carrega pdf.js 3.11.174 (CDN) e `app.js` lê PDF de AET no navegador. A versão é afetada pela CVE-2024-4367 (execução de JavaScript por fonte maliciosa quando `isEvalSupported` está ativo). Um PDF de terceiros aberto por Consultor/Administrador poderia executar código na sessão dele.

**Correção:** `getDocument({ data, isEvalSupported: false })` (o uso é só extração de texto). **Recomendado:** subir pdf.js para 4.2.67 ou superior e fixar com SRI.

### 5. Path traversal em `/api/arquivos` — Média (corrigido)

A permissão olhava só o primeiro trecho da chave (`<EmpresaId>/...`), mas a URL do blob era montada com a chave inteira e o SDK colapsa `..`. Exemplo comprovado: `GLOBAL/laudo/../../EMPRESA-B/laudo/x` vira `/laudos-arquivos/EMPRESA-B/laudo/x`. Vale para download e exclusão. A exploração prática exige conhecer o nome completo do arquivo (UUID), por isso Média.

**Correção:** `chaveArquivoValida` (exatamente 3 partes, sem `.`/`..`, `\`, `%` ou caracteres de controle) em download, exclusão, upload (EmpresaId) e na limpeza automática de arquivos.

### 6. API pública grava coleções globais — Média (corrigido)

Uma chave de empresa com escrita podia gravar em `configuracao` (só Administrador na API interna), `ergonomista`, `modeloLaudo` e `certificadoCalibracao`, e em `laudo`. **Correção:** coleções globais viram somente leitura; chave de empresa não grava `laudo`. **Observação:** em produção `GET /api/public/v1/...` responde 404 vazio (a rota não chega à função), então hoje a exposição é teórica; vale confirmar se a API pública deve existir.

### 7. Documentação interna pública — Média (corrigido)

`/MANUAL.md`, `/docs/bi-ergonomia-manual.md` (319 KB), `/docs/login-email-senha.md` etc. eram servidos sem login. Não há segredos (apenas nomes de variáveis e o procedimento de bootstrap), mas descrevem arquitetura, rotas e pontos de configuração. **Correção:** `/MANUAL.md`, `/docs/*.md` e `/data/*.py` respondem 404. Os arquivos continuam no repositório.

### 8. Clickjacking e CSP — Média (parcial)

Não havia `X-Frame-Options` nem CSP. Já presentes (plataforma): HSTS (`max-age=10886400; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`. **Correção:** `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `Permissions-Policy` (câmera, microfone, geolocalização, pagamento desligados). **Recomendado:** CSP completa (`script-src` com cdnjs e nonces); exige remover os scripts inline de `index.html`, por isso fica para uma entrega própria.

### 9. Bibliotecas externas — Média (recomendação)

Chart.js, jsPDF, SheetJS, pdf.js e qrcode vêm de cdnjs sem `integrity`. Um comprometimento da CDN executaria código no S.I.G.E. SheetJS 0.18.5 (a última na cdnjs) tem CVE-2023-30533 (prototype pollution ao ler planilha) e CVE-2024-22363 (ReDoS); o sistema lê planilhas enviadas pelo usuário (AET e importações). **Recomendado:** hospedar as bibliotecas no próprio site (pasta `js/vendor`), com SRI, e usar SheetJS ≥ 0.20.2 (distribuição do site do fabricante).

### 10–12. Baixas corrigidas

- Upload conferia só o rótulo de tipo; agora confere os bytes iniciais de JPEG, PNG, PDF e XLSX, e o download envia `nosniff`.
- "Esqueci minha senha": 1 envio por minuto por conta.
- `/api/auth/*` com método diferente de POST devolve 405.

### 13–17. Baixas em aberto

- **13:** Consultor vê todos os usuários (e-mail, papel, empresas). Filtrar por empresas em comum é simples, mas muda a tela de Usuários; precisa da sua confirmação.
- **14:** o cookie de sessão dura 7 dias e continua válido após logout em outro aparelho ou troca de senha (a exclusão do usuário já bloqueia). Solução: guardar uma versão de sessão no usuário e no JWT.
- **15:** o endpoint de bootstrap só funciona para contas sem senha e com `SETUP_SECRET`; depois que todos os Administradores ativaram a conta, **remova a variável `SETUP_SECRET`** nas Configurações do Static Web App.
- **16:** exigir 12 caracteres (ou lista de senhas comuns) e bcrypt custo 12.
- **17:** o código de verificação tem 36^6 combinações; limite por IP exigiria WAF. Risco baixo (só retorna dados já impressos no laudo).

## 4. Pontos positivos verificados

- Todas as rotas de dados retornam 401 sem sessão (cliente, laudo, usuarios, apiKeys, arquivos, cnpj); `/api/jobs` exige chave e método POST.
- Cookie de sessão: `HttpOnly; Secure; SameSite=Lax`; JWT com segredo de 16+ caracteres; sessão forjada (`alg:none`) rejeitada.
- Senhas com bcrypt; tokens de convite/redefinição guardados só como SHA-256, comparação em tempo constante, expiração de 7 dias / 2 horas, uso único.
- Mensagens de login e "esqueci minha senha" não revelam se o e-mail existe.
- Sem CORS aberto (nenhum `Access-Control-Allow-*`); HTTP redireciona para HTTPS (301).
- Consultas ao Cosmos DB parametrizadas (sem injeção); filtro por `EmpresaId` aplicado no servidor em leitura, criação, edição e exclusão; `EmpresaId` do corpo é validado contra o escopo do usuário.
- Front monta o DOM com `textContent`; os poucos `innerHTML` recebem apenas números ou texto escapado; `verificar.html` escapa a resposta da API.
- `/api/cnpj` só consulta host fixo (BrasilAPI) e exige login (sem SSRF).
- Chaves de API: 256 bits, só o hash é guardado, limite de requisições por minuto.

## 5. Como validar após o deploy

1. `GET /MANUAL.md` e `/docs/CHANGELOG.md` → 404; `GET /` traz `X-Frame-Options: DENY`.
2. Como Consultor: convidar um e-mail de Administrador existente → 409; convidar com papel Administrador → 403.
3. Como UsuarioCliente: tentar salvar um laudo → 403 (leitura continua funcionando).
4. Login com senha errada 5 vezes → 429 por 15 minutos.
5. `GET /api/arquivos?chave=GLOBAL/laudo/../../X/laudo/y` → 404.
