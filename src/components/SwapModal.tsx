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
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonText,
  IonNote,
} from '@ionic/react';
import { api } from '../lib/api';
import { useData } from '../lib/data';
import { jobsAvailableOn, suggestJobForDay } from '../lib/jobs';
import { todayISO } from '../lib/schedule';
import type { SwapKind } from '../lib/types';
import JobPicker from './JobPicker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultKind?: SwapKind;
  /** Trabalho pré-selecionado (sem ele, o primeiro). */
  defaultJobId?: string;
}

export default function SwapModal({
  isOpen,
  onClose,
  defaultDate,
  defaultKind,
  defaultJobId,
}: Props) {
  const { jobs, periods, swaps, reload } = useData();
  const [date, setDate] = useState(defaultDate ?? todayISO());
  const [kind, setKind] = useState<SwapKind>(defaultKind ?? 'extra_turno');
  const [jobId, setJobId] = useState('');
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Trabalho efetivo: o escolhido, se estiver disponível na data; senão o primeiro disponível
  // (com um só trabalho o seletor nem aparece, e a troca vai para ele). Trabalhos encerrados antes
  // da data ficam de fora.
  const available = jobsAvailableOn(date || todayISO(), jobs, periods);
  const selectedJobId = available.some((j) => j.id === jobId) ? jobId : (available[0]?.id ?? '');

  const initialJobId = () => {
    const k = defaultKind ?? 'extra_turno';
    return (
      defaultJobId ??
      suggestJobForDay(
        defaultDate ?? todayISO(),
        k === 'folga' ? 'working' : 'resting',
        jobs,
        periods,
        swaps,
      ) ??
      ''
    );
  };

  // Sincroniza data/tipo/trabalho ao (re)abrir, respeitando os valores pré-selecionados.
  // `jobs`/`periods`/`swaps` ficam fora das deps: o reload após salvar não deve mexer no formulário.
  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate ?? todayISO());
      setKind(defaultKind ?? 'extra_turno');
      setJobId(initialJobId());
      setHours('');
      setNote('');
      setError('');
    }
  }, [isOpen, defaultDate, defaultKind, defaultJobId]);

  const reset = () => {
    setDate(defaultDate ?? todayISO());
    setKind(defaultKind ?? 'extra_turno');
    setJobId(initialJobId());
    setHours('');
    setNote('');
    setError('');
  };

  const save = async () => {
    setError('');
    if (!date) return setError('Escolha a data.');
    if (!selectedJobId) return setError('Nenhum trabalho ativo nessa data.');
    const h = hours ? Number(hours) : null;
    if (h != null && (!Number.isFinite(h) || h <= 0)) {
      return setError('Horas inválidas.');
    }
    setBusy(true);
    try {
      await api.createSwap({ jobId: selectedJobId, date, kind, hours: h, note: note || null });
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
          <IonTitle>Troca de turno</IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={save} disabled={busy}>
              Salvar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          <IonSegment value={kind} onIonChange={(e) => setKind(e.detail.value as SwapKind)}>
            <IonSegmentButton value="extra_turno">
              <IonLabel>Vou trabalhar</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="folga">
              <IonLabel>Vou folgar</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        <IonNote className="ion-padding-start ion-padding-end" style={{ display: 'block' }}>
          {kind === 'extra_turno'
            ? 'Marque um dia que normalmente seria folga mas você vai trabalhar.'
            : 'Marque um dia que seria de trabalho mas você não vai (passou o plantão).'}
        </IonNote>

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
          {kind === 'extra_turno' && (
            <IonItem>
              <IonInput
                label="Horas (opcional, padrão do turno)"
                labelPlacement="stacked"
                type="number"
                inputmode="decimal"
                placeholder="ex.: 12"
                value={hours}
                onIonInput={(e) => setHours(e.detail.value ?? '')}
              />
            </IonItem>
          )}
          <IonItem>
            <IonTextarea
              label="Observação (opcional)"
              labelPlacement="stacked"
              autoGrow
              value={note}
              onIonInput={(e) => setNote(e.detail.value ?? '')}
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
