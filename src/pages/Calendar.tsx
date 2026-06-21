import { useMemo, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonIcon,
  IonItemDivider,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react';
import { medkitOutline, swapHorizontalOutline } from 'ionicons/icons';
import { useData } from '../lib/data';
import {
  todayISO,
  getUpcomingWorkDates,
  shiftHoursForDay,
  formatBR,
  diffDays,
} from '../lib/schedule';

function fmtH(n: number): string {
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`;
}

function monthYearLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${months[m - 1]} de ${y}`;
}

export default function Calendar() {
  const { periods, swaps } = useData();
  const [count, setCount] = useState(15);
  const today = todayISO();

  const upcoming = useMemo(
    () => getUpcomingWorkDates(today, count, periods, swaps),
    [today, count, periods, swaps],
  );

  // Agrupa por mês para facilitar a leitura.
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const d of upcoming) {
      const key = d.slice(0, 7);
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [upcoming]);

  const swapDates = useMemo(() => new Set(swaps.map((s) => s.date)), [swaps]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Próximos plantões</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          <IonSegment value={String(count)} onIonChange={(e) => setCount(Number(e.detail.value))}>
            <IonSegmentButton value="15">
              <IonLabel>15</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="30">
              <IonLabel>30</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="60">
              <IonLabel>60</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        {upcoming.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum plantão futuro encontrado.</p>
          </div>
        ) : (
          <IonList>
            {groups.map(([key, dates]) => (
              <div key={key}>
                <IonItemDivider sticky>
                  <IonLabel>{monthYearLabel(key + '-01')}</IonLabel>
                </IonItemDivider>
                {dates.map((d) => {
                  const days = diffDays(d, today);
                  const isSwap = swapDates.has(d);
                  return (
                    <IonItem key={d}>
                      <IonIcon
                        slot="start"
                        icon={isSwap ? swapHorizontalOutline : medkitOutline}
                        color={isSwap ? 'warning' : 'primary'}
                      />
                      <IonLabel>
                        <h3 style={{ textTransform: 'capitalize' }}>{formatBR(d)}</h3>
                        <p>
                          {days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`}
                          {isSwap ? ' • troca' : ''}
                        </p>
                      </IonLabel>
                      <IonNote slot="end" className="work-day-badge">
                        {fmtH(shiftHoursForDay(d, periods, swaps))}
                      </IonNote>
                    </IonItem>
                  );
                })}
              </div>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}
