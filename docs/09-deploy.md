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

## Notas de ambiente

- `NODE_ENV === 'production'` faz o cookie de sessão receber a flag `Secure` (ver
  [07 — Autenticação](./07-autenticacao.md)).
- Use bancos/branches **separados** para dev e produção no Neon — nunca aponte o dev para o banco
  de produção.
- O driver `neon-http` (HTTP, serverless) é ideal para funções da Vercel, mas **não suporta
  transações** — tenha isso em mente ao alterar a API (ver [05 — API](./05-api.md)).

## Checklist pós-deploy

- [ ] Variáveis `DATABASE_URL` e `JWT_SECRET` configuradas em produção
- [ ] Migrations aplicadas no banco de produção
- [ ] Usuário admin semeado e **senha trocada**
- [ ] Login funcionando (cookie `Secure` sendo setado sob HTTPS)
- [ ] PWA instalável (manifest + ícones servidos a partir de `dist/`)
</content>
