import { useMemo } from 'react';
import { useData } from '../lib/data';
import { addDays, todayISO, formatBR, getDayStatus, type DayStatus } from '../lib/schedule';

interface Props {
  /** Primeiro dia da faixa (ISO YYYY-MM-DD). */
  from: string;
  /** Quantidade de dias exibidos. */
  days?: number;
  onSelectDay: (iso: string) => void;
}

/** Modificador de cor do dia a partir do seu status. */
export function dayModifier(s: DayStatus): string {
  if (s.swap?.kind === 'extra_turno') return 'is-extra-turno';
  if (s.swap?.kind === 'folga') return 'is-cancelled';
  return s.isWork ? 'is-work' : 'is-rest';
}

/** Faixa horizontal rolável dos próximos dias, estilo tira de agenda. */
export default function AgendaStrip({ from, days = 14, onSelectDay }: Props) {
  const { periods, swaps, extras } = useData();
  const today = todayISO();

  const items = useMemo(() => {
    const list: { iso: string; status: DayStatus }[] = [];
    for (let i = 0; i < days; i++) {
      const iso = addDays(from, i);
      list.push({ iso, status: getDayStatus(iso, periods, swaps, extras) });
    }
    return list;
  }, [from, days, periods, swaps, extras]);

  return (
    <div className="agenda-strip">
      {items.map(({ iso, status }) => {
        const weekday = formatBR(iso).split(',')[0];
        const dayNum = Number(iso.slice(8, 10));
        return (
          <button
            key={iso}
            type="button"
            className={`agenda-chip ${dayModifier(status)} ${iso === today ? 'is-today' : ''}`}
            onClick={() => onSelectDay(iso)}
          >
            <span className="agenda-chip__wd">{weekday}</span>
            <span className="agenda-chip__day">{dayNum}</span>
            {status.hasExtra && <span className="agenda-chip__extra" />}
          </button>
        );
      })}
    </div>
  );
}
