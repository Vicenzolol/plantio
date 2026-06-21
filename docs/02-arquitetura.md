# 02 — Arquitetura

## Stack

| Camada | Tecnologia |
| --- | --- |
| Build / dev server | [Vite 6](https://vitejs.dev) |
| UI | [React 18](https://react.dev) + [Ionic React 8](https://ionicframework.com) (modo `ios`) |
| Linguagem | TypeScript 5 (strict) |
| Roteamento | `react-router` / `react-router-dom` v5 (via `@ionic/react-router`) |
| PWA | `vite-plugin-pwa` (Workbox) |
| Backend | Vercel Serverless Functions (`/api`, runtime `@vercel/node`) |
| Banco | [Neon](https://neon.tech) Postgres (serverless HTTP driver) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) + `drizzle-kit` (migrations) |
| Auth | JWT (`jose`) em cookie httpOnly + hashing `bcryptjs` |

## Estrutura de pastas

```
plantio/
├── api/                  # Vercel Serverless Functions (backend)
│   ├── _lib/auth.ts      # helpers de sessão JWT, hashing, cookies, requireUser
│   ├── auth/             # login, logout, me, register
│   ├── schedules/        # GET/POST de períodos de escala
│   ├── extras/           # GET/POST e DELETE [id] de horas extras
│   └── swaps/            # GET/POST e DELETE [id] de trocas de turno
├── db/
│   ├── schema.ts         # tabelas Drizzle + tipos inferidos
│   └── client.ts         # instancia o Neon + Drizzle a partir de DATABASE_URL
├── drizzle/              # migrations geradas (saída do drizzle-kit)
├── scripts/
│   ├── migrate.ts        # aplica migrations (npm run db:migrate)
│   ├── seed.ts           # cria usuário admin padrão (npm run db:seed)
│   └── gen-icons.mjs     # gera ícones PWA com sharp
├── src/                  # frontend
│   ├── main.tsx          # bootstrap React + Ionic (mode ios) + CSS
│   ├── App.tsx           # providers + roteamento baseado em sessão
│   ├── lib/
│   │   ├── api.ts        # cliente HTTP tipado para /api
│   │   ├── auth.tsx      # AuthProvider / useAuth (sessão)
│   │   ├── data.tsx      # DataProvider / useData (escala, extras, trocas)
│   │   ├── schedule.ts   # LÓGICA DE ESCALA (pura, testada)
│   │   ├── schedule.test.ts
│   │   └── types.ts      # tipos de domínio compartilhados no front
│   ├── pages/            # telas (Login, Register, Setup, Tabs, Dashboard, Hours, Calendar, Profile)
│   ├── components/       # modais e campos reutilizáveis
│   └── theme/            # variables.css + app.css
├── public/               # favicon, ícones PWA, apple-touch-icon
├── vite.config.ts        # config Vite + PWA + proxy /api -> :3000
├── vercel.json           # build + rewrites SPA (exceto /api)
└── drizzle.config.ts     # config do drizzle-kit
```

## Fluxo de dados (alto nível)

```
[Componente React]
      │  chama
      ▼
src/lib/api.ts  ── fetch('/api/...', credentials:'include') ──►  Função serverless (api/**)
      ▲                                                                │
      │ JSON tipado                                          requireUser(req,res) valida o cookie JWT
      │                                                                │
DataProvider / AuthProvider                                  db (Drizzle) ──► Neon Postgres
  (React Context, estado global)
```

- O **estado global** vive em dois contexts: `AuthProvider` (usuário/sessão) e `DataProvider`
  (períodos, extras, trocas). Ver [06 — Frontend](./06-frontend.md).
- **Cálculos** (quem trabalha quando, soma de horas) são feitos **no cliente** por funções puras de
  [src/lib/schedule.ts](../src/lib/schedule.ts) — o backend apenas persiste e devolve os dados crus.
- O backend é **stateless**: cada função lê a sessão do cookie, valida e fala com o banco. O driver
  Neon é HTTP (`neon-http`), que **não suporta transações** — operações multi-passo são sequenciais
  (ver a mudança de escala em [05 — API](./05-api.md)).

## Roteamento de requisições

- **Produção (Vercel):** `vercel.json` reescreve tudo que **não** começa com `/api/` para
  `/index.html` (SPA). As rotas `/api/**` são servidas pelas funções serverless.
- **Dev:** `vite` na porta `5173` faz proxy de `/api` para `http://localhost:3000` (onde roda
  `vercel dev`). Para subir tudo junto, use `vercel dev` — ver [08](./08-setup-desenvolvimento.md).

## Decisões de design relevantes

- **Datas como strings `YYYY-MM-DD` em UTC.** Toda a lógica de escala evita `Date` local para não
  sofrer com timezone/horário de verão. Detalhes em [04 — Lógica de escala](./04-logica-de-escala.md).
- **`numeric` do Postgres chega como string.** Campos como `shiftHours`/`hours` são `string` no
  front e convertidos com `Number(...)` na hora do cálculo (ver [03](./03-modelo-de-dados.md)).
- **Visual iOS forçado** (`setupIonicReact({ mode: 'ios' })`) mesmo no Android/web, pelo foco Apple.
</content>
