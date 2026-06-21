import { useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonText,
} from '@ionic/react';
import ScheduleFields, { type ScheduleValues } from './ScheduleFields';
import { api } from '../lib/api';
import { useData } from '../lib/data';
import { todayISO } from '../lib/schedule';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScheduleChangeModal({ isOpen, onClose }: Props) {
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
    if (!values.effectiveFrom) return setError('Escolha a data da mudança.');
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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>Cancelar</IonButton>
          </IonButtons>
          <IonTitle>Mudar escala</IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={save} disabled={busy}>
              Salvar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonText color="medium">
          <p className="ion-padding">
            O histórico anterior é preservado. A nova escala vale a partir da data escolhida —
            tudo antes dela continua como estava.
          </p>
        </IonText>

        <ScheduleFields
          value={values}
          onChange={setValues}
          dateLabel="Nova escala a partir de"
        />

        {error && (
          <IonText color="danger">
            <p className="ion-padding-start ion-padding-end">{error}</p>
          </IonText>
        )}
        <div style={{ height: 24 }} />
      </IonContent>
    </IonModal>
  );
}
