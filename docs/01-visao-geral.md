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
- **Mais de um trabalho** — quem tem dois (ou mais) empregos cadastra cada um com **nome**, **cor** e
  **escala própria**. Na agenda, os plantões de cada trabalho aparecem na cor escolhida (antes era
  sempre azul); se os dois caem no mesmo dia, o dia fica dividido nas duas cores. As horas somam.
- **Encerrar um trabalho** — ao sair de um emprego, informa-se o último dia: o histórico até ali
  continua nas horas e na agenda, e depois dele o trabalho some. Dá para retomá-lo depois com uma
  nova escala. Excluir (que apaga tudo daquele trabalho) continua disponível.
- **Mudança de escala preservando o histórico** — ao trocar a escala de um trabalho numa data, o
  período antigo daquele trabalho é encerrado no dia anterior; o passado continua calculado com a
  escala antiga e o futuro com a nova. Os outros trabalhos não mudam.
- **Trocas de turno** — marcar um dia de folga como trabalhado (`extra_turno`) ou um dia de trabalho
  como folgado (`folga`) num trabalho específico, ajustando dias sem mexer no ciclo.
- **Horas extras avulsas** — lançar horas extras em qualquer dia, num trabalho, com descrição
  opcional.
- **Resumo de horas** — total trabalhado por **semana**, **mês** e **ano**, separando horas de
  plantão (escala) das horas extras e, com mais de um trabalho, detalhando por trabalho.
- **Agenda** — calendário mensal colorido pelos trabalhos de cada dia, com ações ao tocar num dia.
- **PWA** — instalável na tela inicial, com suporte offline aos assets via service worker.

## Telas principais

| Tela | Rota | Função |
| --- | --- | --- |
| Login / Cadastro | `/login`, `/register` | Autenticação |
| Setup | `/setup` | Primeiro acesso: nome e cor do trabalho + primeira escala |
| Início (Dashboard) | `/tabs/dashboard` | Status de hoje (com o trabalho do dia), horas da semana/mês, ações rápidas, próximos plantões |
| Horas | `/tabs/hours` | Resumo de horas por semana/mês/ano (e por trabalho) e lista de extras |
| Agenda | `/tabs/calendar` | Calendário mensal colorido por trabalho, com legenda |
| Perfil | `/tabs/profile` | Conta, trabalhos (editar nome/cor, excluir, mudar escala), adicionar outro trabalho, trocas, sair |

Detalhes do fluxo de navegação em [06 — Frontend](./06-frontend.md).

## Conceitos-chave

- **Trabalho / emprego (`jobs`)** — nome + cor. Cada trabalho tem sua própria escala, suas trocas e
  suas horas extras. Todo usuário tem pelo menos um. Um trabalho **encerrado** é o que não tem mais
  escala aberta (o último dia é o fim da última escala).
- **Período de escala (`schedule_periods`)** — uma escala de um trabalho, com vigência.
  `effectiveFrom` é tanto o início da vigência quanto a **âncora do ciclo** (offset 0 = dia de
  trabalho). `effectiveUntil` nulo significa que a escala ainda está aberta/vigente.
- **Troca (`shift_swaps`)** — ajuste pontual de um único dia (`folga` ou `extra_turno`) num trabalho.
- **Hora extra (`extra_hours`)** — horas avulsas de um trabalho, somadas ao total, independentes da
  escala.

A formalização desses conceitos está em [03 — Modelo de dados](./03-modelo-de-dados.md) e
[04 — Lógica de escala](./04-logica-de-escala.md).
</content>
