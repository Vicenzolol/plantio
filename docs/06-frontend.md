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

Expõe `{ jobs, periods, extras, swaps, loading, reload }`.

- Quando há usuário, `reload()` busca `getJobs`, `getSchedules`, `getExtras`, `getSwaps` **em
  paralelo** (`Promise.all`) e popula o estado. Sem usuário, zera tudo.
- `jobs` vem ordenado por criação (o primeiro é o emprego "principal"); essa ordem é usada em
  legendas, listas e na ordem das faixas de cor.
- Recarrega automaticamente quando o `user` muda.
- Os componentes chamam `reload()` após mutações (criar/editar/excluir emprego, extra, troca,
  escala) para refletir os dados novos.

## Páginas — [src/pages/](../src/pages/)

| Arquivo | Rota | Resumo |
| --- | --- | --- |
| `Login.tsx` | `/login` | Form de email/senha; usa `useAuth().login` |
| `Register.tsx` | `/register` | Form nome/email/senha (senha ≥ 6); usa `register` |
| `Setup.tsx` | `/setup` | Primeiro acesso: nome + cor do trabalho (`JobFields`) e 1ª escala (`ScheduleFields`) via `createJob`; chama `refresh` para liberar o dashboard |
| `Tabs.tsx` | `/tabs` | Tab bar (Início, Horas, Agenda, Perfil) com `IonTabs` |
| `Dashboard.tsx` | `/tabs/dashboard` | Card de hoje na cor do trabalho do dia (faixas se forem dois) com nome e horas de cada plantão, horas semana/mês, ações rápidas (modais), faixa dos próximos 14 dias |
| `Hours.tsx` | `/tabs/hours` | Segmento semana/mês/ano; `sumHours`; com 2+ trabalhos no período, lista "Plantões por trabalho" (`byJob`: plantões + extras); lista de extras (com o trabalho de cada uma, se houver 2+) com swipe-to-delete |
| `Calendar.tsx` | `/tabs/calendar` | Calendário mensal em grade, navegável por mês, com ações por dia; legenda com um item por trabalho existente no mês exibido (cor + nome) |
| `Profile.tsx` | `/tabs/profile` | Conta; um bloco por trabalho (cor, nome → editar, "Encerrado em …" se for o caso, escalas vigente/passadas, "mudar escala" — ou "Retomar com nova escala" se encerrado); "Adicionar outro trabalho"; trocas (com o trabalho, se houver 2+) com swipe-to-delete; sair |

Todos os cálculos de datas/horas vêm de [src/lib/schedule.ts](../src/lib/schedule.ts), memoizados
com `useMemo` a partir de `periods`/`swaps`/`extras` do `useData`; as cores, de
[src/lib/jobs.ts](../src/lib/jobs.ts). Ver [04 — Lógica de escala](./04-logica-de-escala.md).

### Vários trabalhos na UI

- Com **um** trabalho, a interface fica igual à de antes (sem seletor de trabalho, sem detalhamento
  por trabalho); só ganha o nome do trabalho no card de hoje e no Perfil.
- O segundo trabalho é cadastrado em **Perfil → Adicionar outro trabalho** (`JobModal`), já com a
  escala dele. Criar um trabalho não mexe na escala dos outros.
- **Editar** (toque no nome do trabalho no Perfil) muda nome/cor. No mesmo modal:
  - **Encerrar trabalho** ("Saí deste trabalho"): escolhe o último dia; pede confirmação, avisando
    quantas trocas depois dessa data serão removidas. O histórico até o último dia continua nas horas
    e na agenda; depois dele o trabalho some da agenda, dos seletores e da legenda dos meses
    seguintes. No Perfil aparece "Encerrado em …" e o botão vira **Retomar com nova escala**
    (`ScheduleChangeModal` com título "Retomar trabalho", sugerindo o dia seguinte ao fim se ele
    ainda não passou).
  - **Excluir trabalho**: pede confirmação e apaga escala, trocas e horas extras daquele trabalho
    (sugere encerrar para manter o histórico); não aparece quando só há um.
- Trocas de turno e horas extras pedem o trabalho (`JobPicker`) quando há 2+ disponíveis na data
  (`jobsAvailableOn` — encerrados antes da data ficam de fora; se a data mudar e o escolhido sair da
  lista, vale o primeiro disponível). O trabalho já vem sugerido (`suggestJobForDay`): para cancelar
  plantão ou lançar hora extra, o primeiro que trabalha no dia; para "vou trabalhar", o primeiro de
  folga.

## Componentes — [src/components/](../src/components/)

| Componente | Uso |
| --- | --- |
| `ScheduleFields.tsx` | Campos da escala (data, work/rest days, horas, início do turno) + **presets** comuns (12h 1x2, 12x36, 24x72, 6x1). Reutilizado por `Setup`, `JobModal` e `ScheduleChangeModal` |
| `JobFields.tsx` | Nome do trabalho + paleta de cores (`JOB_COLORS`). Reutilizado por `Setup` e `JobModal` |
| `JobModal.tsx` | Sem `job`: cadastra um trabalho novo com sua escala (`createJob`), sugerindo uma cor ainda não usada. Com `job`: edita nome/cor (`updateJob`), seção "Saí deste trabalho" para **encerrar** (`endJob`, só em trabalho ativo) e "Excluir trabalho" (`deleteJob`; escondido se for o único). Confirmações com `useIonAlert` |
| `JobPicker.tsx` | Chips para escolher o trabalho (cor de cada um). Não renderiza nada com um só trabalho. Usado no `SwapModal` e no `ExtraHoursModal` |
| `ExtraHoursModal.tsx` | Modal para lançar hora extra (`createExtra` com `jobId`). Aceita `defaultDate` e `defaultJobId`; oferece só os trabalhos disponíveis na data |
| `SwapModal.tsx` | Modal para registrar troca (`extra_turno` / `folga`, `createSwap` com `jobId`). Aceita `defaultDate`, `defaultKind` e `defaultJobId`; oferece só os trabalhos disponíveis na data |
| `ScheduleChangeModal.tsx` | Modal de "mudar escala" de **um** trabalho (`job`) — cria novo período preservando o histórico; abre pré-preenchido com a escala atual daquele trabalho. Para trabalho encerrado vira "Retomar trabalho" |
| `AgendaStrip.tsx` | Faixa horizontal rolável dos próximos N dias, pintada pelos trabalhos de cada dia. Usada na Dashboard |
| `MonthCalendar.tsx` | Calendário mensal em grade (7 colunas, domingo primeiro), com navegação entre meses e botão "Hoje". Usado na Agenda |
| `DayActions.tsx` | Orquestra o fluxo "toca num dia → action sheet → modal". Reutilizado por Dashboard e Agenda. Abre `ExtraHoursModal` ou `SwapModal` com data e trabalho sugerido (`suggestJobForDay`) pré-preenchidos |

## Padrões de UI

- **Formulários:** estado local (`useState`), flag `busy` para desabilitar o botão durante o
  request, e `error` exibido em `IonText color="danger"`.
- **Listas com exclusão:** `IonItemSliding` + `IonItemOptions` (swipe → lixeira) em Horas e Perfil.
- **Pull-to-refresh:** `IonRefresher` no Dashboard chama `reload()`.
- **Formatação de horas:** helper local `fmtH(n)` (inteiro → `"12h"`, fracionário → `"12.5h"`),
  repetido em Dashboard/Hours/Calendar.
- **Ações por dia:** `DayActions` usa `IonActionSheet` com o cabeçalho do dia formatado, seguido
  de abertura do modal correspondente com `defaultDate` pré-preenchido.
- **Cores dos dias:** `dayVisual(DayStatus, jobs)` em [src/lib/jobs.ts](../src/lib/jobs.ts) decide
  a aparência; `dayClassNames` gera as classes (`.is-work`, `.is-multi`, `.has-swap`,
  `.is-cancelled`, `.is-rest`) e `dayStyle` o estilo inline com a cor do trabalho (as cores são
  dinâmicas, por isso não ficam no CSS). Dois trabalhos no mesmo dia → faixas diagonais. Plantão por
  troca → contorno tracejado na cor do texto. `.is-today` dá o anel de hoje. Pontinho âmbar com anel
  claro (`.agenda-chip__extra` / `.cal-day__extra`) marca horas extras avulsas.
- **Card de hoje:** usa as CSS vars `--background`/`--color` do `IonCard` com o mesmo `dayVisual`.

## Tema

- [src/theme/variables.css](../src/theme/variables.css) — variáveis do Ionic (cores, etc.).
- [src/theme/app.css](../src/theme/app.css) — classes utilitárias do app (`stat-grid`, `stat-card`,
  `section-title`, `empty-state`, `auth-wrapper`, `center-spinner`, `work-day-badge`...), as
  classes da agenda: `.agenda-strip`, `.agenda-chip`, `.cal-wrapper`, `.cal-grid`, `.cal-day`,
  `.cal-legend` (+ modificadores `is-work`, `is-multi`, `has-swap`, `is-cancelled`, `is-rest`,
  `is-today`, `is-outside`) e as de trabalho: `.job-dot` (bolinha de cor em listas),
  `.color-swatches` / `.color-swatch` (paleta).

## PWA

Configurada em [vite.config.ts](../vite.config.ts) via `vite-plugin-pwa`:
`registerType: 'autoUpdate'`, manifest pt-BR ("Plantio — Gestão de Plantão"), ícones em
`public/icons/`, e Workbox com `navigateFallbackDenylist: [/^\/api/]` (não intercepta a API).
</content>
