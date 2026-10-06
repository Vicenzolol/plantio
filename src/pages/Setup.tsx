import { useRef, useState } from 'react';
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
import JobFields, { type JobValues } from '../components/JobFields';
import ScheduleFields, { type ScheduleValues } from '../components/ScheduleFields';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useData } from '../lib/data';
import { DEFAULT_JOB_COLOR } from '../lib/jobs';
import { todayISO } from '../lib/schedule';

export default function Setup() {
  const { logout, refresh } = useAuth();
  const { reload } = useData();
  const [job, setJob] = useState<JobValues>({ name: '', color: DEFAULT_JOB_COLOR });
  const [values, setValues] = useState<ScheduleValues>({
    effectiveFrom: todayISO(),
    workDays: 1,
    restDays: 2,
    shiftHours: 12,
    shiftStartTime: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Se o trabalho já foi criado e só o recarregamento falhou, tentar de novo não o duplica.
  const created = useRef(false);

  const save = async () => {
    setError('');
    const name = job.name.trim();
    if (!name) {
      setError('Dê um nome ao seu trabalho (ex.: o nome do hospital).');
      return;
    }
    if (!values.effectiveFrom) {
      setError('Escolha a data em que começou (ou começa) a trabalhar.');
      return;
    }
    setBusy(true);
    try {
      if (!created.current) {
        await api.createJob({
          name,
          color: job.color,
          schedule: {
            effectiveFrom: values.effectiveFrom,
            workDays: values.workDays,
            restDays: values.restDays,
            shiftHours: values.shiftHours,
            shiftStartTime: values.shiftStartTime || null,
          },
        });
        created.current = true;
      }
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
              Para começar, dê um nome ao seu trabalho, escolha uma cor e informe quando você
              começou e como é sua escala. Vamos calcular automaticamente todas as suas próximas
              datas de plantão. Se tiver outro emprego, dá para cadastrá-lo depois no Perfil.
            </p>
          </IonText>
        </div>

        <JobFields value={job} onChange={setJob} />

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
