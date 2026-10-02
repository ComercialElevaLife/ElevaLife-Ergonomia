# Login por e-mail e senha (S.I.G.E)

Substituiu o "Entrar com Microsoft" (Azure AD Easy Auth) em 29/09/2026 —
pedido do Leo: *"não sei se o cliente usa Microsoft, é login e senha, tem
que ter... eu crio o usuário com o e-mail da pessoa e a empresa, ou o
administrador, ou o consultor, e a pessoa tem que receber um e-mail dizendo
que está sendo convidada, clique aqui para primeiro acesso"*.

## Como funciona

1. Administrador ou Consultor cadastra alguém na tela **Usuários**
   (e-mail + papel + empresas vinculadas). Isso cria/atualiza um documento
   no contêiner `usuarios` do Cosmos DB com `StatusConta: "Convidado"` e um
   token de convite (só o hash SHA-256 dele fica gravado).
2. A pessoa recebe um e-mail (via Microsoft Graph, enviado pela caixa
   compartilhada `sige@elevalife.com.br`) com um link de primeiro acesso.
   A resposta da API também devolve esse link na hora (`linkConvite`), pro
   Administrador poder copiar/colar na mão se o e-mail não chegar.
3. A pessoa clica no link, define uma senha (mínimo 8 caracteres) — isso
   grava `SenhaHash` (bcrypt) e muda `StatusConta` para `"Ativo"`.
4. Dali em diante, ela entra em `/index.html` com e-mail e senha. O login
   grava um cookie `sige_sessao` (JWT assinado, `HttpOnly; Secure;
   SameSite=Lax`, validade de 7 dias) — é esse cookie que
   `api/src/shared/tenant.js` lê em toda chamada `/api/*` pra saber quem
   está logado (não existe mais nenhuma dependência do Azure AD).
5. "Esqueci minha senha" (tela de login) funciona do mesmo jeito, só que
   com um token de validade mais curta (2 horas) e sempre respondendo a
   mesma mensagem genérica (nunca revela se o e-mail existe ou não).

## Variáveis de ambiente obrigatórias

Configurar em **Azure Portal → Static Web App (bi-ergonomia) → Configuração
→ Configurações do aplicativo** (Application settings) — são lidas pela API
(`api/src/functions/*.js` via `process.env`), nunca ficam no código/git:

| Nome | Para que serve | Como obter |
| --- | --- | --- |
| `SESSION_JWT_SECRET` | Assina/valida o cookie de sessão | Uma string aleatória longa (32+ caracteres) — gerar uma vez e nunca versionar no git. Trocar esse valor de-loga todo mundo de uma vez (útil se suspeitar de vazamento). |
| `GRAPH_TENANT_ID` | Autenticar no Microsoft Graph (client credentials) | Azure Portal → Microsoft Entra ID → Visão geral → "Id do locatário" |
| `GRAPH_CLIENT_ID` | Idem | Azure Portal → Microsoft Entra ID → Registros de aplicativo → (o app criado no passo abaixo) → "Id do aplicativo (cliente)" |
| `GRAPH_CLIENT_SECRET` | Idem | Gerado no mesmo registro de aplicativo, em "Certificados e segredos" |
| `GRAPH_CAIXA_ENVIO` | De qual caixa os e-mails saem | `sige@elevalife.com.br` (caixa compartilhada — grátis dentro do plano Microsoft 365 já existente, não precisa de licença própria) |
| `SETUP_SECRET` | Protege a rota de bootstrap (`POST /api/auth/bootstrap`) | Uma string aleatória longa, só o(s) Administrador(es) sabe(m). Não precisa ser a mesma coisa que `SESSION_JWT_SECRET`. |
| `URL_PUBLICA` | Domínio usado para montar o link de convite/redefinição de senha que vai no e-mail (e na resposta da API) | `https://witty-sea-0b1e5c110.6.azurestaticapps.net` (o mesmo domínio público do app — **sem** barra no final). Obrigatório: descobrimos em produção (02/10/2026) que nem `request.url` nem o cabeçalho `x-forwarded-host` trazem o domínio certo dentro da Function (Azure Static Web Apps faz proxy pro host interno da Function App) — sem essa variável o link do convite sai quebrado, apontando pro host interno. |

## Passo a passo (Microsoft 365 Admin Center + Azure Portal)

1. **Criar a caixa compartilhada** — Microsoft 365 Admin Center → Grupos →
   Caixas de correio compartilhadas → Adicionar uma caixa de correio
   compartilhada → nome `sige@elevalife.com.br`. Grátis (até 50 GB), não
   precisa de licença própria.
2. **Registrar o aplicativo** — Azure Portal → Microsoft Entra ID →
   Registros de aplicativo → Novo registro → nome "S.I.G.E - Envio de
   E-mail" → tipo de conta "Somente contas neste diretório organizacional"
   → Registrar.
3. **Permissão de envio** — no app registrado → APIs do Microsoft Graph →
   Permissões de API → Adicionar uma permissão → Microsoft Graph →
   Permissões de aplicativo → `Mail.Send` → Adicionar. Depois clicar em
   "Conceder consentimento do administrador" (precisa ser Administrador
   Global ou ter o papel certo no Entra ID).
4. **Restringir a só essa caixa** (recomendado pela própria Microsoft —
   sem isso o app pode mandar e-mail como QUALQUER caixa do tenant) — rodar
   no PowerShell do Exchange Online (`Connect-ExchangeOnline`):
   ```powershell
   New-ApplicationAccessPolicy -AppId "<GRAPH_CLIENT_ID>" `
     -PolicyScopeGroupId "sige@elevalife.com.br" `
     -AccessRight RestrictAccess `
     -Description "S.I.G.E so pode enviar como sige@elevalife.com.br"
   ```
5. **Gerar o segredo do app** — no app registrado → Certificados e
   segredos → Novo segredo do cliente → copiar o VALOR (só aparece uma
   vez) → vira `GRAPH_CLIENT_SECRET`.
6. **Configurar as 7 variáveis** acima em Static Web App → Configuração →
   Configurações do aplicativo → Salvar (isso reinicia a API sozinho).
7. **Bootstrap do primeiro Administrador** — como ninguém mais consegue
   entrar pelo Azure AD depois desse deploy, o(s) Administrador(es) que já
   tinham conta antes (documento em `usuarios` sem `SenhaHash`) precisam
   de um empurrão inicial:
   ```
   POST /api/auth/bootstrap
   { "Email": "leonardo@elevalife.com.br", "SegredoConfiguracao": "<SETUP_SECRET>" }
   ```
   A resposta traz `linkConvite` — abrir esse link no navegador e definir a
   senha. Depois disso é só usar a tela de Usuários normalmente para
   convidar todo mundo.

## Referência das ações (`POST /api/auth/{acao}`)

| Ação | Quem pode chamar | Corpo |
| --- | --- | --- |
| `login` | Público | `{ Email, Senha }` |
| `logout` | Sessão válida | (vazio) |
| `convidar` | Administrador/Consultor | `{ Email, Papel, EmpresasVinculadas }` (mesma coisa que `POST /api/usuarios`) |
| `reenviar-convite` | Administrador/Consultor | `{ Email }` — só funciona se `StatusConta !== "Ativo"` |
| `primeiro-acesso` | Quem tem o link do convite | `{ Email, Token, NovaSenha }` |
| `esqueci-senha` | Público | `{ Email }` — sempre responde OK |
| `redefinir-senha` | Quem tem o link de recuperação | `{ Email, Token, NovaSenha }` |
| `bootstrap` | Quem sabe o `SETUP_SECRET` | `{ Email, SegredoConfiguracao }` — só funciona em quem ainda não tem `SenhaHash` |
