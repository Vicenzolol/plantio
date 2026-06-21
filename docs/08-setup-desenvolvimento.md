# 08 — Setup de desenvolvimento

## Pré-requisitos

- **Node 18+** e npm
- Conta no [Neon](https://neon.tech) com um banco/branch de **desenvolvimento**
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`) para rodar API + front juntos

## Passo a passo

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env
# Edite o .env:
#   DATABASE_URL  -> connection string da branch DEV do Neon
#   JWT_SECRET    -> valor longo e aleatório

# 3. Banco
npm run db:generate   # gera migrations a partir de db/schema.ts
npm run db:migrate    # aplica no banco do DATABASE_URL
# (atalho de dev, sem gerar arquivo: npm run db:push)

# 4. Usuário admin padrão (troque a senha depois)
npm run db:seed       # admin@plantio.app / admin123
```

### Gerar JWT_SECRET (PowerShell)

```powershell
[Convert]::ToBase64String((1..48 | %{ Get-Random -Max 256 }))
```

## Rodando

| Comando | O que faz |
| --- | --- |
| `vercel dev` | **Recomendado.** Sobe o front e as funções `/api` juntos |
| `npm run dev` | Só o front (Vite, porta 5173). As chamadas `/api` são encaminhadas para `http://localhost:3000`, então requer `vercel dev` **ou** `npm run dev:api` rodando em paralelo |
| `npm run dev:vercel` | Alias para `vercel dev` |
| `npm run dev:api` | Sobe só a API em `http://localhost:3000` via Express ([server/dev.ts](../server/dev.ts)), sem precisar da Vercel CLI. Útil com `npm run dev` em outro terminal |

Para a maioria dos casos, use apenas **`vercel dev`**. O proxy `/api` → `:3000` está em
[vite.config.ts](../vite.config.ts).

> [server/dev.ts](../server/dev.ts) monta os mesmos handlers de `api/**` num servidor Express, então
> é uma alternativa ao `vercel dev` para quem não tem (ou não quer usar) a Vercel CLI. Ele **não**
> reproduz exatamente o ambiente de produção — em especial o formato de módulo das funções (ver
> [09 — Deploy](./09-deploy.md#formato-de-módulo-das-funções-esm-vs-commonjs-️)).

## Testes e build

```bash
npm test          # testes da lógica de escala (vitest, run único)
npm run test:watch
npm run build     # tsc --noEmit + vite build (saída em dist/)
npm run preview   # serve o build localmente
```

Os testes cobrem [src/lib/schedule.ts](../src/lib/schedule.ts) — ver
[04 — Lógica de escala](./04-logica-de-escala.md).

## Scripts disponíveis (`package.json`)

| Script | Ação |
| --- | --- |
| `dev` | Vite dev server |
| `dev:api` | API local via Express ([server/dev.ts](../server/dev.ts)), porta 3000 |
| `dev:vercel` | `vercel dev` (front + API) |
| `build` | type-check + build de produção |
| `preview` | serve o build |
| `test` / `test:watch` | Vitest |
| `db:generate` | gera migrations (drizzle-kit) |
| `db:push` | empurra schema direto (dev) |
| `db:migrate` | aplica migrations ([scripts/migrate.ts](../scripts/migrate.ts)) |
| `db:seed` | cria usuário admin ([scripts/seed.ts](../scripts/seed.ts)) |

> Há também [scripts/gen-icons.mjs](../scripts/gen-icons.mjs) (gera os ícones PWA com `sharp`),
> executado manualmente quando necessário.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | Connection string do Neon (use a branch **dev** localmente) |
| `JWT_SECRET` | sim | Segredo para assinar os JWT de sessão |

Ver [.env.example](../.env.example) e [07 — Autenticação](./07-autenticacao.md).
</content>
