import { useMemo } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { useData } from '../lib/data';
import { todayISO, getMonthMatrix, getDayStatus, monthLabel, addMonths } from '../lib/schedule';
import { dayModifier } from './AgendaStrip';

interface Props {
  /** Qualquer dia do mês exibido (ISO YYYY-MM-DD). */
  month: string;
  onMonthChange: (iso: string) => void;
  onToday: () => void;
  onSelectDay: (iso: string) => void;
}

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Calendário mensal em grade (vista mês estilo Google), colorido por tipo de dia. */
export default function MonthCalendar({ month, onMonthChange, onToday, onSelectDay }: Props) {
  const { periods, swaps, extras } = useData();
  const today = todayISO();
  const monthKey = month.slice(0, 7);

  const weeks = useMemo(() => getMonthMatrix(month), [month]);

  const goPrev = () => onMonthChange(addMonths(month, -1));
  const goNext = () => onMonthChange(addMonths(month, 1));

  return (
    <div className="cal-wrapper">
      <div className="cal-nav">
        <IonButton fill="clear" onClick={goPrev} aria-label="Mês anterior">
          <IonIcon slot="icon-only" icon={chevronBackOutline} />
        </IonButton>
        <span className="cal-nav__label">{monthLabel(month)}</span>
        <IonButton fill="clear" onClick={goNext} aria-label="Próximo mês">
          <IonIcon slot="icon-only" icon={chevronForwardOutline} />
        </IonButton>
      </div>

      <div className="cal-today-row">
        <IonButton size="small" fill="outline" onClick={onToday}>
          Hoje
        </IonButton>
      </div>

      <div className="cal-weekdays">
        {WEEKDAY_INITIALS.map((w, i) => (
          <div key={i} className="cal-weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {weeks.map((week) =>
          week.map((iso) => {
            const status = getDayStatus(iso, periods, swaps, extras);
            const outside = iso.slice(0, 7) !== monthKey;
            return (
              <button
                key={iso}
                type="button"
                className={`cal-day ${dayModifier(status)} ${outside ? 'is-outside' : ''} ${
                  iso === today ? 'is-today' : ''
                }`}
                onClick={() => onSelectDay(iso)}
              >
                <span className="cal-day__num">{Number(iso.slice(8, 10))}</span>
                {status.hasExtra && <span className="cal-day__extra" />}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
