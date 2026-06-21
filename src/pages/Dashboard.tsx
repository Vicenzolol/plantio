import { useMemo, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { addCircleOutline, swapHorizontalOutline, calendarNumberOutline } from 'ionicons/icons';
import type { RefresherEventDetail } from '@ionic/react';
import { useAuth } from '../lib/auth';
import { useData } from '../lib/data';
import {
  todayISO,
  startOfWeek,
  addDays,
  startOfMonth,
  endOfMonth,
  sumHours,
  getUpcomingWorkDates,
  formatBR,
  isWorkDay,
} from '../lib/schedule';
import ExtraHoursModal from '../components/ExtraHoursModal';
import SwapModal from '../components/SwapModal';

function fmtH(n: number): string {
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { periods, extras, swaps, reload } = useData();
  const [showExtra, setShowExtra] = useState(false);
  const [showSwap, setShowSwap] = useState(false);

  const today = todayISO();

  const weekHours = useMemo(() => {
    const start = startOfWeek(today);
    return sumHours(start, addDays(start, 6), periods, swaps, extras).total;
  }, [today, periods, swaps, extras]);

  const monthHours = useMemo(
    () => sumHours(startOfMonth(today), endOfMonth(today), periods, swaps, extras).total,
    [today, periods, swaps, extras],
  );

  const upcoming = useMemo(
    () => getUpcomingWorkDates(today, 5, periods, swaps),
    [today, periods, swaps],
  );

  const worksToday = isWorkDay(today, periods, swaps);

  const onRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await reload();
    e.detail.complete();
  };

  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Olá, {firstName}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={onRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="ion-padding">
          <IonCard
            color={worksToday ? 'primary' : 'light'}
            style={{ borderRadius: 18, marginTop: 0 }}
          >
            <IonCardContent>
              <div style={{ fontSize: 13, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Hoje • {formatBR(today)}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                {worksToday ? 'Dia de plantão 🏥' : 'Dia de folga 😌'}
              </div>
            </IonCardContent>
          </IonCard>

          <div className="stat-grid">
            <IonCard className="stat-card">
              <IonCardContent>
                <div className="stat-value">{fmtH(weekHours)}</div>
                <div className="stat-label">Esta semana</div>
              </IonCardContent>
            </IonCard>
            <IonCard className="stat-card">
              <IonCardContent>
                <div className="stat-value">{fmtH(monthHours)}</div>
                <div className="stat-label">Este mês</div>
              </IonCardContent>
            </IonCard>
          </div>

          <p className="section-title">Ações rápidas</p>
          <div className="quick-actions">
            <IonButton fill="outline" onClick={() => setShowExtra(true)}>
              <IonIcon slot="start" icon={addCircleOutline} />
              Hora extra
            </IonButton>
            <IonButton fill="outline" onClick={() => setShowSwap(true)}>
              <IonIcon slot="start" icon={swapHorizontalOutline} />
              Troca de turno
            </IonButton>
          </div>

          <p className="section-title">Próximos plantões</p>
          {upcoming.length === 0 ? (
            <div className="empty-state">
              <IonIcon icon={calendarNumberOutline} />
              <p>Nenhum plantão futuro encontrado.</p>
            </div>
          ) : (
            <IonList inset>
              {upcoming.map((d) => (
                <IonItem key={d}>
                  <IonIcon icon={calendarNumberOutline} slot="start" color="primary" />
                  <IonLabel>{formatBR(d)}</IonLabel>
                  <IonNote slot="end">{d === today ? 'hoje' : ''}</IonNote>
                </IonItem>
              ))}
            </IonList>
          )}
        </div>

        <ExtraHoursModal isOpen={showExtra} onClose={() => setShowExtra(false)} />
        <SwapModal isOpen={showSwap} onClose={() => setShowSwap(false)} />
      </IonContent>
    </IonPage>
  );
}
