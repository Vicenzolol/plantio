import type { AuthUser, SchedulePeriod, ExtraHour, ShiftSwap } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message =
      (data as { error?: string })?.error ?? `Erro ${res.status}. Tente novamente.`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  // auth
  me: () => request<{ user: AuthUser | null; hasSchedule?: boolean }>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  // schedules
  getSchedules: () => request<{ periods: SchedulePeriod[] }>('/api/schedules'),
  createSchedule: (body: {
    effectiveFrom: string;
    workDays: number;
    restDays: number;
    shiftHours: number;
    shiftStartTime?: string | null;
  }) =>
    request<{ period: SchedulePeriod }>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // extras
  getExtras: () => request<{ extras: ExtraHour[] }>('/api/extras'),
  createExtra: (body: { date: string; hours: number; description?: string | null }) =>
    request<{ extra: ExtraHour }>('/api/extras', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteExtra: (id: string) =>
    request<{ ok: true }>(`/api/extras/${id}`, { method: 'DELETE' }),

  // swaps
  getSwaps: () => request<{ swaps: ShiftSwap[] }>('/api/swaps'),
  createSwap: (body: {
    date: string;
    kind: 'folga' | 'extra_turno';
    hours?: number | null;
    note?: string | null;
  }) =>
    request<{ swap: ShiftSwap }>('/api/swaps', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteSwap: (id: string) =>
    request<{ ok: true }>(`/api/swaps/${id}`, { method: 'DELETE' }),
};
