# 01 — Visão geral

## O que é

**Plantio** é um app mobile-first (PWA instalável, com visual forçado para iOS) que ajuda
trabalhadores em regime de plantão/escala a **prever suas datas de trabalho** e **somar as horas**
trabalhadas em diferentes períodos.

A partir de uma data de início e de um padrão de escala (ex.: trabalha 1 dia de 12h, folga 2 dias),
o app calcula automaticamente todas as datas futuras de plantão, sem precisar marcar dia a dia.

## Funcionalidades

- **Escala por ciclo** — define-se `workDays` dias de trabalho seguidos de `restDays` de folga,
  com uma quantidade de horas por turno. O app projeta o ciclo para o futuro a partir da data âncora.
- **Mudança de escala preservando o histórico** — ao trocar de escala numa data, o período antigo
  é encerrado no dia anterior; o passado continua calculado com a escala antiga e o futuro com a nova.
- **Trocas de turno** — marcar um dia de folga como trabalhado (`extra_turno`) ou um dia de trabalho
  como folgado (`folga`), ajustando dias específicos sem mexer no ciclo.
- **Horas extras avulsas** — lançar horas extras em qualquer dia, com descrição opcional.
- **Resumo de horas** — total trabalhado por **semana**, **mês** e **ano**, separando horas de
  plantão (escala) das horas extras.
- **Agenda de próximos plantões** — lista os próximos 15/30/60 dias de trabalho, agrupados por mês.
- **PWA** — instalável na tela inicial, com suporte offline aos assets via service worker.

## Telas principais

| Tela | Rota | Função |
| --- | --- | --- |
| Login / Cadastro | `/login`, `/register` | Autenticação |
| Setup | `/setup` | Primeiro acesso: definir a primeira escala |
| Início (Dashboard) | `/tabs/dashboard` | Status de hoje, horas da semana/mês, ações rápidas, próximos plantões |
| Horas | `/tabs/hours` | Resumo de horas por semana/mês/ano e lista de extras |
| Agenda | `/tabs/calendar` | Próximos plantões agrupados por mês |
| Perfil | `/tabs/profile` | Conta, escalas vigentes/passadas, trocas, mudar escala, sair |

Detalhes do fluxo de navegação em [06 — Frontend](./06-frontend.md).

## Conceitos-chave

- **Período de escala (`schedule_periods`)** — uma escala com vigência. `effectiveFrom` é tanto o
  início da vigência quanto a **âncora do ciclo** (offset 0 = dia de trabalho). `effectiveUntil`
  nulo significa que a escala ainda está aberta/vigente.
- **Troca (`shift_swaps`)** — ajuste pontual de um único dia (`folga` ou `extra_turno`).
- **Hora extra (`extra_hours`)** — horas avulsas somadas ao total, independentes da escala.

A formalização desses conceitos está em [03 — Modelo de dados](./03-modelo-de-dados.md) e
[04 — Lógica de escala](./04-logica-de-escala.md).
</content>
