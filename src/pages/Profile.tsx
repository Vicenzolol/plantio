import { useState } from 'react';
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
  IonButton,
  IonIcon,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
} from '@ionic/react';
import { createOutline, logOutOutline, trashOutline } from 'ionicons/icons';
import { useAuth } from '../lib/auth';
import { useData } from '../lib/data';
import { api } from '../lib/api';
import { formatFullBR } from '../lib/schedule';
import ScheduleChangeModal from '../components/ScheduleChangeModal';

export default function Profile() {
  const { user, logout } = useAuth();
  const { periods, swaps, reload } = useData();
  const [showChange, setShowChange] = useState(false);

  const removeSwap = async (id: string) => {
    await api.deleteSwap(id);
    await reload();
  };

  const sortedSwaps = [...swaps].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Perfil</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <p className="section-title">Conta</p>
        <IonList inset>
          <IonItem>
            <IonLabel>
              <h2>{user?.name}</h2>
              <p>{user?.email}</p>
            </IonLabel>
          </IonItem>
        </IonList>

        <p className="section-title">Escala</p>
        <IonList inset>
          {periods.map((p) => (
            <IonItem key={p.id}>
              <IonLabel>
                <h3>
                  {p.workDays}x{p.restDays} • {Number(p.shiftHours)}h por turno
                </h3>
                <p>
                  Desde {formatFullBR(p.effectiveFrom)}
                  {p.effectiveUntil ? ` até ${formatFullBR(p.effectiveUntil)}` : ' (atual)'}
                </p>
              </IonLabel>
              {!p.effectiveUntil && <IonNote slot="end" color="success">vigente</IonNote>}
            </IonItem>
          ))}
        </IonList>
        <div className="ion-padding-start ion-padding-end">
          <IonButton expand="block" fill="outline" onClick={() => setShowChange(true)}>
            <IonIcon slot="start" icon={createOutline} />
            Mudar escala a partir de uma data
          </IonButton>
        </div>

        {sortedSwaps.length > 0 && (
          <>
            <p className="section-title">Trocas de turno</p>
            <IonList inset>
              {sortedSwaps.map((s) => (
                <IonItemSliding key={s.id}>
                  <IonItem>
                    <IonLabel>
                      <h3>{formatFullBR(s.date)}</h3>
                      <p>
                        {s.kind === 'extra_turno' ? 'Trabalhou (dia de folga)' : 'Folgou (dia de plantão)'}
                        {s.note ? ` • ${s.note}` : ''}
                      </p>
                    </IonLabel>
                  </IonItem>
                  <IonItemOptions side="end">
                    <IonItemOption color="danger" onClick={() => removeSwap(s.id)}>
                      <IonIcon slot="icon-only" icon={trashOutline} />
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              ))}
            </IonList>
          </>
        )}

        <div className="ion-padding" style={{ marginTop: 12 }}>
          <IonButton expand="block" color="danger" fill="clear" onClick={() => logout()}>
            <IonIcon slot="start" icon={logOutOutline} />
            Sair
          </IonButton>
        </div>

        <ScheduleChangeModal isOpen={showChange} onClose={() => setShowChange(false)} />
      </IonContent>
    </IonPage>
  );
}
