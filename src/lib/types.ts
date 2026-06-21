export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface SchedulePeriod {
  id: string;
  userId: string;
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
  date: string; // YYYY-MM-DD
  hours: string;
  description: string | null;
  createdAt: string;
}

export type SwapKind = 'folga' | 'extra_turno';

export interface ShiftSwap {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  kind: SwapKind;
  hours: string | null;
  note: string | null;
  createdAt: string;
}
