import { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
} from '@ionic/react';
import { todayISO, startOfMonth, endOfMonth } from '../lib/schedule';
import { useData } from '../lib/data';
import { jobsActiveInRange } from '../lib/jobs';
import MonthCalendar from '../components/MonthCalendar';
import DayActions from '../components/DayActions';

const LEGEND = [
  { mod: 'has-swap', label: 'Troca (trabalho)' },
  { mod: 'is-cancelled', label: 'Cancelado' },
  { mod: 'is-rest', label: 'Folga' },
];

export default function Calendar() {
  const { jobs, periods } = useData();
  const today = todayISO();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Legenda só com os trabalhos que existem no mês exibido (um encerrado some dos meses seguintes).
  const monthJobs = jobsActiveInRange(startOfMonth(month), endOfMonth(month), jobs, periods);

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
            {/* Um item por trabalho, com a cor escolhida para ele. */}
            {monthJobs.map((j) => (
              <div key={j.id} className="cal-legend__item">
                <span className="cal-legend__dot" style={{ background: j.color }} />
                {j.name}
              </div>
            ))}
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
