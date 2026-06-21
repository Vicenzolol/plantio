# Documentação do Plantio

Documentação técnica do **Plantio** — app mobile-first (PWA, foco iOS) para gerenciar
escalas de plantão, horas trabalhadas e trocas de turno.

## Índice

| Doc | Conteúdo |
| --- | --- |
| [01 — Visão geral](./01-visao-geral.md) | O que é o app, funcionalidades e personas |
| [02 — Arquitetura](./02-arquitetura.md) | Stack, estrutura de pastas e fluxo de dados |
| [03 — Modelo de dados](./03-modelo-de-dados.md) | Tabelas do Postgres, enums e relacionamentos |
| [04 — Lógica de escala](./04-logica-de-escala.md) | Como o ciclo, vigências e trocas são calculados |
| [05 — API](./05-api.md) | Referência dos endpoints serverless (`/api`) |
| [06 — Frontend](./06-frontend.md) | Páginas, componentes, contexts e roteamento |
| [07 — Autenticação](./07-autenticacao.md) | JWT em cookie httpOnly e proteção de rotas |
| [08 — Setup de desenvolvimento](./08-setup-desenvolvimento.md) | Como rodar localmente |
| [09 — Deploy](./09-deploy.md) | Publicação na Vercel e migrations em produção |

## Resumo rápido

- **Stack:** Vite + React + TypeScript + Ionic React (PWA) · Vercel Serverless Functions (`/api`) ·
  Neon Postgres + Drizzle ORM · auth por JWT em cookie httpOnly.
- **Coração do domínio:** [src/lib/schedule.ts](../src/lib/schedule.ts) — toda a lógica de datas é
  pura, baseada em UTC e coberta por testes ([04 — Lógica de escala](./04-logica-de-escala.md)).
- **Entrada local:** `vercel dev` (sobe front + funções juntos). Ver [08](./08-setup-desenvolvimento.md).
</content>
</invoke>
