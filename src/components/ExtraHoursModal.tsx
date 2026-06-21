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
  IonText,
} from '@ionic/react';
import { api } from '../lib/api';
import { useData } from '../lib/data';
import { todayISO } from '../lib/schedule';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExtraHoursModal({ isOpen, onClose }: Props) {
  const { reload } = useData();
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setDate(todayISO());
    setHours('');
    setDescription('');
    setError('');
  };

  const save = async () => {
    setError('');
    const h = Number(hours);
    if (!date) return setError('Escolha a data.');
    if (!Number.isFinite(h) || h <= 0) return setError('Informe as horas trabalhadas.');
    setBusy(true);
    try {
      await api.createExtra({ date, hours: h, description: description || null });
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
