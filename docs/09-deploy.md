# 09 — Deploy

O app é publicado na **Vercel** (front estático + funções serverless `/api`) com banco no **Neon**.

## Configuração na Vercel

A build é definida em [vercel.json](../vercel.json):

```json
{
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- **Build:** `npm run build` (type-check + Vite) → saída em `dist/`.
- **Rewrites:** tudo que **não** começa com `/api/` cai no `index.html` (SPA). As rotas `/api/**`
  são servidas pelas funções em `api/**`.

## Formato de módulo das funções (ESM vs CommonJS) ⚠️

O [tsconfig.json](../tsconfig.json) da raiz usa `"module": "ESNext"` (necessário para o front com
Vite). Sem um override, o `@vercel/node` compila as funções `api/**` emitindo **ESM**
(`export default …`), mas como o `package.json` **não** define `"type": "module"`, o Node em
produção carrega os `.js` como **CommonJS** e falha no carregamento:

```text
SyntaxError: Unexpected token 'export'   →  FUNCTION_INVOCATION_FAILED (HTTP 500)
```

O sintoma é traiçoeiro: **localmente funciona** (o `vercel dev`/`tsx` transpila on-the-fly de forma
tolerante), mas **todas** as rotas `/api/**` retornam 500 em produção — inclusive `/api/auth/login`.

**Solução:** [api/tsconfig.json](../api/tsconfig.json) estende o tsconfig da raiz e força emit
**CommonJS** apenas para o diretório `api/`, sem afetar o build do front:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "noEmit": false
  }
}
```

CommonJS também é o que mantém os **imports relativos sem extensão** (`from '../../db/client'`) e os
`await import(...)` funcionando — em ESM estrito eles exigiriam a extensão `.js`. Não defina
`"type": "module"` no `package.json` da raiz para "consertar" isso: o front e os imports passariam a
exigir mudanças em cascata.

## Passo a passo

1. **Importe o repositório** na Vercel (o framework Vite é detectado automaticamente).
2. **Configure as variáveis de ambiente de produção** no painel da Vercel:
   - `DATABASE_URL` → branch/banco de **produção** do Neon
   - `JWT_SECRET` → segredo longo e aleatório (idealmente diferente do de dev)
3. **Faça o deploy.**
4. **Rode migrations e seed contra produção.** Com a `DATABASE_URL` de produção no ambiente
   (localmente exportando a URL, ou via job):
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

## Limite de funções serverless ⚠️

No plano **Hobby** a Vercel aceita no máximo **12 funções por deploy**, e cada arquivo em `api/`
(exceto `api/_lib/`) vira uma função. O projeto está **exatamente em 12**. Um endpoint novo em arquivo
próprio faria o deploy falhar — por isso `/api/jobs` usa um arquivo só com `?id=` para PATCH/DELETE.
Se precisar de mais rotas, junte com uma existente ou remova os endpoints temporários
`api/debug.ts` e `api/debug-db.ts`.

## Como as migrations chegam à produção

**A Vercel não roda migrations.** O build dela é só `npm run build` (type-check + Vite); ela não
encosta no banco. Mudanças de estrutura no banco são aplicadas **à mão**, de uma máquina com a
`DATABASE_URL` de produção, com:

```bash
npm run db:migrate
```

O comando ([scripts/migrate.ts](../scripts/migrate.ts)) lê os arquivos de `drizzle/`, consulta a
tabela `drizzle.__drizzle_migrations` (o registro do que já foi aplicado naquele banco) e aplica
**só as pendentes**, registrando-as no fim. Rodar de novo não faz nada — é seguro repetir.

## Deploy da migration de múltiplos empregos (`0001_add_jobs`)

A migration cria a tabela `jobs` e a coluna `job_id` em escalas, trocas e horas extras. Ela **não
apaga nem altera nenhum dado**: cada usuário que já tem registros ganha um "Trabalho principal" azul
e tudo o que ele tinha é ligado a esse trabalho — a agenda e as horas ficam exatamente iguais. Ela
roda num bloco único e atômico: se algo falhar, nada muda.

O código novo lê/grava `jobs` e `job_id`; o código antigo grava **sem** `job_id`. Então banco e
código precisam subir juntos, nesta ordem:

1. **(Recomendado) Backup:** no painel do Neon, crie um branch a partir do branch de produção (é uma
   cópia instantânea; se precisar voltar, dá para restaurar a partir dele).
2. **Ensaie no dev:** com uma cópia dos dados de produção no branch de dev, rode
   `npx tsx --env-file=.env.dev scripts/migrate.ts` e confira o app contra o dev
   (ver [08 — Setup](./08-setup-desenvolvimento.md#banco-de-desenvolvimento-branch-dev-no-neon)).
3. **Aplique a migration:** com a `DATABASE_URL` de produção no `.env`, rode `npm run db:migrate`.
   Deve imprimir "Migrations aplicadas com sucesso."
4. **Faça o deploy logo em seguida** (push para o branch que a Vercel publica, ou `vercel --prod`).

Entre os passos 3 e 4, o app antigo ainda lê tudo normalmente, mas **criar escala, troca ou hora
extra** falha (o `job_id` passa a ser obrigatório) — por isso o deploy deve vir em seguida. Na
ordem inversa (deploy antes da migration), **todas** as rotas de escala/troca/emprego quebram até a
migration rodar — por isso migration primeiro.

Clientes com o PWA antigo em cache continuam funcionando depois do deploy: sem `jobId`,
`POST /api/schedules`, `POST /api/swaps` e `POST /api/extras` usam o emprego mais antigo do usuário.

## Notas de ambiente

- `NODE_ENV === 'production'` faz o cookie de sessão receber a flag `Secure` (ver
  [07 — Autenticação](./07-autenticacao.md)).
- Use bancos/branches **separados** para dev e produção no Neon — nunca aponte o dev para o banco
  de produção.
- O driver `neon-http` (HTTP, serverless) é ideal para funções da Vercel, mas **não suporta
  transações** — tenha isso em mente ao alterar a API (ver [05 — API](./05-api.md)).

## Checklist pós-deploy

- [ ] Variáveis `DATABASE_URL` e `JWT_SECRET` configuradas em produção
- [ ] Migrations aplicadas no banco de produção (antes do deploy, se houver migration nova)
- [ ] No máximo 12 arquivos de função em `api/` (fora de `_lib/`)
- [ ] Usuário admin semeado e **senha trocada**
- [ ] Login funcionando (cookie `Secure` sendo setado sob HTTPS)
- [ ] PWA instalável (manifest + ícones servidos a partir de `dist/`)
</content>
