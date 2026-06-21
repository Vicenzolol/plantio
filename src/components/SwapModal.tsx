import { useState } from 'react';
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
import { todayISO } from '../lib/schedule';
import type { SwapKind } from '../lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SwapModal({ isOpen, onClose }: Props) {
  const { reload } = useData();
  const [date, setDate] = useState(todayISO());
  const [kind, setKind] = useState<SwapKind>('extra_turno');
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setDate(todayISO());
    setKind('extra_turno');
    setHours('');
    setNote('');
    setError('');
  };

  const save = async () => {
    setError('');
    if (!date) return setError('Escolha a data.');
    const h = hours ? Number(hours) : null;
    if (h != null && (!Number.isFinite(h) || h <= 0)) {
      return setError('Horas inválidas.');
    }
    setBusy(true);
    try {
      await api.createSwap({ date, kind, hours: h, note: note || null });
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
