import { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonText,
} from '@ionic/react';
import ScheduleFields, { type ScheduleValues } from '../components/ScheduleFields';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useData } from '../lib/data';
import { todayISO } from '../lib/schedule';

export default function Setup() {
  const { logout, refresh } = useAuth();
  const { reload } = useData();
  const [values, setValues] = useState<ScheduleValues>({
    effectiveFrom: todayISO(),
    workDays: 1,
    restDays: 2,
    shiftHours: 12,
    shiftStartTime: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError('');
    if (!values.effectiveFrom) {
      setError('Escolha a data em que começou (ou começa) a trabalhar.');
      return;
    }
    setBusy(true);
    try {
      await api.createSchedule({
        effectiveFrom: values.effectiveFrom,
        workDays: values.workDays,
        restDays: values.restDays,
        shiftHours: values.shiftHours,
        shiftStartTime: values.shiftStartTime || null,
      });
      await reload();
      await refresh(); // atualiza hasSchedule -> Router leva ao dashboard
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Sua escala</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => logout()}>Sair</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          <h2 style={{ marginTop: 0 }}>Bem-vindo(a)! 👋</h2>
          <IonText color="medium">
            <p>
              Para começar, informe quando você começou a trabalhar e como é sua escala.
              Vamos calcular automaticamente todas as suas próximas datas de plantão.
            </p>
          </IonText>
        </div>

        <ScheduleFields
          value={values}
          onChange={setValues}
          dateLabel="Comecei a trabalhar em"
        />

        {error && (
          <IonText color="danger">
            <p className="ion-padding-start ion-padding-end">{error}</p>
          </IonText>
        )}

        <div className="ion-padding">
          <IonButton expand="block" onClick={save} disabled={busy}>
            {busy ? 'Salvando...' : 'Definir escala'}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}
