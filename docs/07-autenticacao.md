# 07 — Autenticação

Toda a lógica de auth do backend está em [api/_lib/auth.ts](../api/_lib/auth.ts). No front, o
estado de sessão é gerenciado por [src/lib/auth.tsx](../src/lib/auth.tsx) (ver
[06 — Frontend](./06-frontend.md)).

## Modelo

- **Sessão = JWT** assinado com `HS256` (lib [`jose`](https://github.com/panva/jose)), guardado num
  **cookie httpOnly** chamado `plantio_session`.
- **Senhas** são hasheadas com `bcryptjs` (custo 10). O texto puro nunca é persistido.
- O segredo de assinatura vem de `process.env.JWT_SECRET` (obrigatório).

## Conteúdo do token

`signSession` cria um JWT com:

- `sub` — id do usuário
- `email`, `name` — claims customizados
- `iat` (issued at) e expiração de **30 dias** (`SESSION_DAYS`)

`readSession` verifica o token do cookie e devolve `{ sub, email, name }`, ou `null` se ausente/
inválido/expirado.

## Cookie

`setSessionCookie` grava:

```
plantio_session=<jwt>; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000; [Secure]
```

- `HttpOnly` — inacessível via JavaScript (mitiga XSS).
- `SameSite=Lax` — proteção CSRF razoável para o fluxo do app.
- `Secure` — adicionado apenas quando `NODE_ENV === 'production'` (em dev roda em HTTP local).
- `Max-Age` = 30 dias.

`clearSessionCookie` zera o cookie (`Max-Age=0`) no logout.

## Funções utilitárias

| Função | Uso |
| --- | --- |
| `hashPassword(pw)` / `verifyPassword(pw, hash)` | bcrypt |
| `signSession(payload)` / `readSession(req)` | emitir / ler o JWT |
| `setSessionCookie(res, token)` / `clearSessionCookie(res)` | gerenciar o cookie |
| `requireUser(req, res)` | **guard**: devolve a sessão ou responde 401 e retorna `null` |

### Padrão `requireUser` nas rotas protegidas

```ts
const session = await requireUser(req, res);
if (!session) return;          // 401 já foi enviado
const userId = session.sub;    // sempre filtra queries por este id
```

Usado em `schedules`, `extras`, `swaps` (index e `[id]`). A rota `/api/auth/me` usa `readSession`
diretamente (não bloqueia: devolve `user: null` se não logado).

## Fluxo no frontend

1. No mount, `AuthProvider` chama `api.me()` para hidratar a sessão a partir do cookie.
2. `login`/`register` chamam a API; o cookie é setado pelo backend (o front só guarda o `user`).
3. `me` devolve também `hasSchedule`, que o roteamento usa para mandar usuários novos ao `/setup`.
4. `logout` chama `/api/auth/logout` e limpa o estado local.

O cliente HTTP sempre usa `credentials: 'include'` para enviar/receber o cookie
(ver [src/lib/api.ts](../src/lib/api.ts)).

## Segurança — notas

- **`JWT_SECRET`** deve ser longo e aleatório; trocar invalida todas as sessões. Configurado no
  `.env` em dev e nas env vars da Vercel em produção (ver [09 — Deploy](./09-deploy.md)).
- Não há rota de refresh/rotação de token: a sessão simplesmente expira em 30 dias.
- O **usuário admin do seed** (`admin@plantio.app` / `admin123`) tem senha padrão fraca —
  troque após o primeiro uso.
</content>
