export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

/** Emprego/trabalho: cada um tem sua escala, suas trocas e uma cor na agenda. */
export interface Job {
  id: string;
  userId: string;
  name: string;
  color: string; // #rrggbb
  createdAt: string;
}

export interface SchedulePeriod {
  id: string;
  userId: string;
  jobId: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveUntil: string | null; // YYYY-MM-DD ou null (vigente)
  workDays: number;
  restDays: number;
  shiftHours: string; // numeric vem como string do Postgres
  shiftStartTime: string | null;
  createdAt: string;
}

export interface ExtraHour {
  id: string;
  userId: string;
  jobId: string; // emprego em que as horas extras foram feitas
  date: string; // YYYY-MM-DD
  hours: string;
  description: string | null;
  createdAt: string;
}

export type SwapKind = 'folga' | 'extra_turno';

export interface ShiftSwap {
  id: string;
  userId: string;
  jobId: string; // a troca vale só para esse emprego
  date: string; // YYYY-MM-DD
  kind: SwapKind;
  hours: string | null;
  note: string | null;
  createdAt: string;
}
