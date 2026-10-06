import { useEffect, useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonInput,
  IonTextarea,
  IonText,
} from '@ionic/react';
import { api } from '../lib/api';
import { useData } from '../lib/data';
import { jobsAvailableOn, suggestJobForDay } from '../lib/jobs';
import { todayISO } from '../lib/schedule';
import JobPicker from './JobPicker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  /** Trabalho pré-selecionado (sem ele, o que tem plantão no dia, ou o primeiro). */
  defaultJobId?: string;
}

export default function ExtraHoursModal({ isOpen, onClose, defaultDate, defaultJobId }: Props) {
  const { jobs, periods, swaps, reload } = useData();
  const [date, setDate] = useState(defaultDate ?? todayISO());
  const [jobId, setJobId] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Só trabalhos não encerrados antes da data. Se o escolhido sair da lista (mudou a data), vale
  // o primeiro disponível.
  const available = jobsAvailableOn(date || todayISO(), jobs, periods);
  const selectedJobId = available.some((j) => j.id === jobId) ? jobId : (available[0]?.id ?? '');

  const initialJobId = () =>
    defaultJobId ??
    suggestJobForDay(defaultDate ?? todayISO(), 'working', jobs, periods, swaps) ??
    '';

  // Sincroniza data/trabalho ao (re)abrir, respeitando os valores pré-selecionados.
  // `jobs`/`periods`/`swaps` ficam fora das deps: o reload após salvar não deve mexer no formulário.
  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate ?? todayISO());
      setJobId(initialJobId());
      setHours('');
      setDescription('');
      setError('');
    }
  }, [isOpen, defaultDate, defaultJobId]);

  const reset = () => {
    setDate(defaultDate ?? todayISO());
    setJobId(initialJobId());
    setHours('');
    setDescription('');
    setError('');
  };

  const save = async () => {
    setError('');
    const h = Number(hours);
    if (!date) return setError('Escolha a data.');
    if (!selectedJobId) return setError('Nenhum trabalho ativo nessa data.');
    if (!Number.isFinite(h) || h <= 0) return setError('Informe as horas trabalhadas.');
    setBusy(true);
    try {
      await api.createExtra({
        jobId: selectedJobId,
        date,
        hours: h,
        description: description || null,
      });
      await reload();
      reset();
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
          <IonTitle>Hora extra</IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={save} disabled={busy}>
              Salvar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <p className="ion-padding-start ion-padding-end ion-padding-top">
          Trabalhei horas extras neste dia:
        </p>
        <JobPicker jobs={available} value={selectedJobId} onChange={setJobId} />
        <IonList inset>
          <IonItem>
            <IonInput
              label="Dia"
              labelPlacement="stacked"
              type="date"
              value={date}
              onIonInput={(e) => setDate(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label="Quantas horas"
              labelPlacement="stacked"
              type="number"
              inputmode="decimal"
              placeholder="ex.: 3"
              value={hours}
              onIonInput={(e) => setHours(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonTextarea
              label="Observação (opcional)"
              labelPlacement="stacked"
              autoGrow
              value={description}
              onIonInput={(e) => setDescription(e.detail.value ?? '')}
            />
          </IonItem>
        </IonList>
        {error && (
          <IonText color="danger">
            <p className="ion-padding-start ion-padding-end">{error}</p>
          </IonText>
        )}
      </IonContent>
    </IonModal>
  );
}
