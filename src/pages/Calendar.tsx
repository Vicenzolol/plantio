import { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
} from '@ionic/react';
import { todayISO, startOfMonth } from '../lib/schedule';
import MonthCalendar from '../components/MonthCalendar';
import DayActions from '../components/DayActions';

const LEGEND = [
  { mod: 'is-work', label: 'Trabalho' },
  { mod: 'is-extra-turno', label: 'Troca (trabalho)' },
  { mod: 'is-cancelled', label: 'Cancelado' },
  { mod: 'is-rest', label: 'Folga' },
];

export default function Calendar() {
  const today = todayISO();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Agenda</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            onToday={() => setMonth(startOfMonth(today))}
            onSelectDay={setSelectedDate}
          />

          <div className="cal-legend">
            {LEGEND.map(({ mod, label }) => (
              <div key={mod} className="cal-legend__item">
                <span className={`cal-legend__dot ${mod}`} />
                {label}
              </div>
            ))}
            <div className="cal-legend__item">
              <span className="cal-legend__dot is-extra-mark" />
              Hora extra
            </div>
          </div>
        </div>

        <DayActions date={selectedDate} onClose={() => setSelectedDate(null)} />
      </IonContent>
    </IonPage>
  );
}
