import { useEffect, useState } from 'react';
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
import { addDays, getActivePeriod, jobEndDate, todayISO } from '../lib/schedule';
import type { Job } from '../lib/types';

interface Props {
  isOpen: boolean;
  /** Trabalho cuja escala será mudada. */
  job: Job | null;
  onClose: () => void;
}

export default function ScheduleChangeModal({ isOpen, job, onClose }: Props) {
  const { jobs, periods, reload } = useData();
  const [values, setValues] = useState<ScheduleValues>({
    effectiveFrom: todayISO(),
    workDays: 1,
    restDays: 2,
    shiftHours: 12,
    shiftStartTime: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Trabalho encerrado: o modal serve para retomá-lo com uma escala nova. Fixado ao abrir, para o
  // título não mudar quando o reload (após salvar) reabre o trabalho.
  const [ended, setEnded] = useState(false);

  // Ao abrir, parte da escala atual desse trabalho (ou da mais recente, se ainda não começou).
  // `periods` fica fora das deps de propósito: o reload após salvar não deve mexer no formulário.
  useEffect(() => {
    if (!isOpen || !job) return;
    const today = todayISO();
    const jobPeriods = periods.filter((p) => p.jobId === job.id);
    const current =
      getActivePeriod(today, jobPeriods) ??
      [...jobPeriods].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
    const end = jobEndDate(job.id, periods);
    setValues({
      // Retomando um trabalho que só termina no futuro: sugere o dia seguinte ao último dia.
      effectiveFrom: end && end >= today ? addDays(end, 1) : today,
      workDays: current?.workDays ?? 1,
      restDays: current?.restDays ?? 2,
      shiftHours: current ? Number(current.shiftHours) : 12,
      shiftStartTime: current?.shiftStartTime ?? '',
    });
    setEnded(end != null);
    setError('');
  }, [isOpen, job]);

  const save = async () => {
    setError('');
    if (!job) return;
    if (!values.effectiveFrom) return setError('Escolha a data da mudança.');
    setBusy(true);
    try {
      await api.createSchedule({
        jobId: job.id,
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
          <IonTitle>{ended ? 'Retomar trabalho' : 'Mudar escala'}</IonTitle>
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
            {job && (
              <>
                <strong>{job.name}</strong>
                {' — '}
              </>
            )}
            {ended
              ? 'Escolha a partir de quando você volta a trabalhar aqui e como é a escala. O histórico anterior continua como estava.'
              : 'O histórico anterior é preservado. A nova escala vale a partir da data escolhida — tudo antes dela continua como estava.'}
            {jobs.length > 1 && ' Os outros trabalhos não são afetados.'}
          </p>
        </IonText>

        <ScheduleFields
          value={values}
          onChange={setValues}
          dateLabel={ended ? 'Volto a trabalhar em' : 'Nova escala a partir de'}
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
