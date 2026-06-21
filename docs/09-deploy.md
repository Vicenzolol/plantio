# 09 — Deploy

O app é publicado na **Vercel** (front estático + funções serverless `/api`) com banco no **Neon**.

## Configuração na Vercel

A build é definida em [vercel.json](../vercel.json):

```json
{
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
