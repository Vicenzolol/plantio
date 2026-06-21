# Plantio

App mobile-first (foco iOS) para gerenciar escalas de plantão: calcula automaticamente as
datas futuras de trabalho a partir de uma data de início e de uma escala (ex.: trabalha 1 dia
de 12h, folga 2), registra horas extras e trocas de turno, mostra horas trabalhadas na
semana/mês/ano e permite mudar a escala a partir de uma data preservando o histórico.

**Stack:** Vite + React + TypeScript + Ionic React (PWA instalável) · Vercel Serverless
Functions (`/api`) · Neon Postgres + Drizzle ORM · auth por JWT em cookie httpOnly.

## Pré-requisitos

- Node 18+ e npm
- Uma conta no [Neon](https://neon.tech) com um banco/branch de **desenvolvimento**
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`) para rodar API + front juntos

## Configuração local

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie o `.env` a partir do exemplo e preencha:
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL`: connection string da branch **dev** do Neon
   - `JWT_SECRET`: um valor longo e aleatório
3. Crie as tabelas no banco:
   ```bash
   npm run db:generate   # gera as migrations a partir de db/schema.ts
   npm run db:migrate    # aplica no banco apontado por DATABASE_URL
   # (alternativa rápida em dev: npm run db:push)
   ```
4. Semeie o usuário admin padrão:
   ```bash
   npm run db:seed
   ```
   Credenciais iniciais — **troque depois**:
   - `admin@plantio.app` / `admin123`

## Rodando

- **Full-stack (recomendado)** — sobe o front e as functions `/api` juntos:
  ```bash
  vercel dev
  ```
- **Só front** (`npm run dev`): as chamadas `/api` são encaminhadas para `http://localhost:3000`,
  então é preciso ter o `vercel dev` rodando em paralelo. Para a maioria dos casos use só `vercel dev`.

## Testes e build

```bash
npm test     # testes da lógica de escala (src/lib/schedule.ts)
npm run build
```

## Deploy na Vercel

1. Importe o repositório na Vercel (framework detectado: Vite).
2. Configure as variáveis de ambiente de **produção** no painel:
   - `DATABASE_URL` → branch/banco de **produção** do Neon
   - `JWT_SECRET`
3. Faça o deploy. Depois, com a `DATABASE_URL` de produção no ambiente, rode as migrations e o
   seed apontando para produção (localmente, exportando a URL de prod, ou via job):
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

## Como a escala funciona

Cada escala é um **período com vigência** (`schedule_periods`): tem uma data de início
(`effective_from`, que também ancora o ciclo) e um fim opcional. O ciclo repete
`workDays` dias de trabalho seguidos de `restDays` de folga. Ao **mudar de escala**, o período
aberto anterior é encerrado no dia anterior à nova data — o passado fica intacto e o futuro
passa a usar a nova escala. Trocas de turno (`folga` / `extra_turno`) ajustam dias específicos.

Toda a lógica de datas é pura e testada em [src/lib/schedule.ts](src/lib/schedule.ts).
