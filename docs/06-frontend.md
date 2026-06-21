# 06 — Frontend

App React + Ionic, montado em [src/main.tsx](../src/main.tsx) e estruturado em
[src/App.tsx](../src/App.tsx).

## Bootstrap (`main.tsx`)

- Importa os CSS obrigatórios do Ionic, utilitários, paleta dark automática e o tema próprio
  (`theme/variables.css`, `theme/app.css`).
- `setupIonicReact({ mode: 'ios' })` — força o visual iOS em todas as plataformas.
- Renderiza `<App />` dentro de `React.StrictMode`.

## Árvore de providers e roteamento (`App.tsx`)

```
<IonApp>
  <AuthProvider>          // sessão (useAuth)
    <DataProvider>        // dados de domínio (useData)
      <IonReactRouter>
        <IonRouterOutlet>
          <Routes/>       // decide o que renderizar conforme a sessão
```

O componente `Routes` é **roteamento guiado por estado de sessão**:

| Estado | O que é renderizado |
| --- | --- |
| `loading` | spinner central |
| sem `user` | `/login`, `/register` (qualquer outra rota → redireciona a `/login`) |
| `user` mas **sem** escala (`!hasSchedule`) | `/setup` (primeiro acesso; outras rotas → `/setup`) |
| `user` com escala | `/tabs/**` (raiz → `/tabs/dashboard`) |

Isso significa que **não há guardas de rota espalhados** — a árvore inteira muda conforme o estado.

## Contexts (estado global)

### `AuthProvider` / `useAuth` — [src/lib/auth.tsx](../src/lib/auth.tsx)

Expõe `{ user, hasSchedule, loading, login, register, logout, refresh }`.

- No mount, chama `api.me()` (`refresh`) para hidratar a sessão a partir do cookie.
- `login`/`register` chamam a API e atualizam o estado; `login` também faz `refresh` (para obter
  `hasSchedule`).
- `logout` limpa estado e cookie.

### `DataProvider` / `useData` — [src/lib/data.tsx](../src/lib/data.tsx)

Expõe `{ periods, extras, swaps, loading, reload }`.

- Quando há usuário, `reload()` busca `getSchedules`, `getExtras`, `getSwaps` **em paralelo**
  (`Promise.all`) e popula o estado. Sem usuário, zera tudo.
- Recarrega automaticamente quando o `user` muda.
- Os componentes chamam `reload()` após mutações (criar/excluir extra, troca, escala) para
  refletir os dados novos.

## Páginas — [src/pages/](../src/pages/)

| Arquivo | Rota | Resumo |
| --- | --- | --- |
| `Login.tsx` | `/login` | Form de email/senha; usa `useAuth().login` |
| `Register.tsx` | `/register` | Form nome/email/senha (senha ≥ 6); usa `register` |
| `Setup.tsx` | `/setup` | Primeiro acesso: define a 1ª escala via `ScheduleFields` + `createSchedule`; chama `refresh` para liberar o dashboard |
| `Tabs.tsx` | `/tabs` | Tab bar (Início, Horas, Agenda, Perfil) com `IonTabs` |
| `Dashboard.tsx` | `/tabs/dashboard` | Status de hoje, horas semana/mês, ações rápidas (modais), faixa dos próximos 14 dias |
| `Hours.tsx` | `/tabs/hours` | Segmento semana/mês/ano; `sumHours`; lista de extras com swipe-to-delete |
| `Calendar.tsx` | `/tabs/calendar` | Calendário mensal em grade, navegável por mês, com ações por dia |
| `Profile.tsx` | `/tabs/profile` | Conta, escalas (vigente/passadas), trocas (swipe-to-delete), botão "mudar escala", sair |

Todos os cálculos de datas/horas vêm de [src/lib/schedule.ts](../src/lib/schedule.ts), memoizados
com `useMemo` a partir de `periods`/`swaps`/`extras` do `useData`. Ver
[04 — Lógica de escala](./04-logica-de-escala.md).

## Componentes — [src/components/](../src/components/)

| Componente | Uso |
| --- | --- |
| `ScheduleFields.tsx` | Campos da escala (data, work/rest days, horas, início do turno) + **presets** comuns (12h 1x2, 12x36, 24x72, 6x1). Reutilizado por `Setup` e `ScheduleChangeModal` |
| `ExtraHoursModal.tsx` | Modal para lançar hora extra (`createExtra`). Aceita `defaultDate` para abrir com data pré-selecionada |
| `SwapModal.tsx` | Modal para registrar troca (`extra_turno` / `folga`, `createSwap`). Aceita `defaultDate` e `defaultKind` |
| `ScheduleChangeModal.tsx` | Modal de "mudar escala" — cria novo período preservando o histórico |
| `AgendaStrip.tsx` | Faixa horizontal rolável dos próximos N dias, colorida por tipo. Usada na Dashboard. Exporta `dayModifier(status)` (helper de classe CSS) |
| `MonthCalendar.tsx` | Calendário mensal em grade (7 colunas, domingo primeiro), com navegação entre meses e botão "Hoje". Usado na Agenda |
| `DayActions.tsx` | Orquestra o fluxo "toca num dia → action sheet → modal". Reutilizado por Dashboard e Agenda. Abre `ExtraHoursModal` ou `SwapModal` com data pré-preenchida |

## Padrões de UI

- **Formulários:** estado local (`useState`), flag `busy` para desabilitar o botão durante o
  request, e `error` exibido em `IonText color="danger"`.
- **Listas com exclusão:** `IonItemSliding` + `IonItemOptions` (swipe → lixeira) em Horas e Perfil.
- **Pull-to-refresh:** `IonRefresher` no Dashboard chama `reload()`.
- **Formatação de horas:** helper local `fmtH(n)` (inteiro → `"12h"`, fracionário → `"12.5h"`),
  repetido em Dashboard/Hours/Calendar.
- **Ações por dia:** `DayActions` usa `IonActionSheet` com o cabeçalho do dia formatado, seguido
  de abertura do modal correspondente com `defaultDate` pré-preenchido.
- **Cores dos dias:** determinadas por `dayModifier(DayStatus)` em `AgendaStrip.tsx` e aplicadas
  como classes CSS (`.is-work`, `.is-extra-turno`, `.is-cancelled`, `.is-rest`, `.is-today`).
  Pontinho âmbar (`.agenda-chip__extra` / `.cal-day__extra`) marca horas extras avulsas.

## Tema

- [src/theme/variables.css](../src/theme/variables.css) — variáveis do Ionic (cores, etc.).
- [src/theme/app.css](../src/theme/app.css) — classes utilitárias do app (`stat-grid`, `stat-card`,
  `section-title`, `empty-state`, `auth-wrapper`, `center-spinner`, `work-day-badge`...) e as
  classes da agenda: `.agenda-strip`, `.agenda-chip`, `.cal-wrapper`, `.cal-grid`, `.cal-day`,
  `.cal-legend` (+ modificadores `is-work`, `is-extra-turno`, `is-cancelled`, `is-rest`,
  `is-today`, `is-outside`).

## PWA

Configurada em [vite.config.ts](../vite.config.ts) via `vite-plugin-pwa`:
`registerType: 'autoUpdate'`, manifest pt-BR ("Plantio — Gestão de Plantão"), ícones em
`public/icons/`, e Workbox com `navigateFallbackDenylist: [/^\/api/]` (não intercepta a API).
</content>
