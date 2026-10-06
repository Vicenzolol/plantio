import { useEffect, useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonText,
  IonList,
  IonItem,
  IonInput,
  IonNote,
  useIonAlert,
} from '@ionic/react';
import { exitOutline, trashOutline } from 'ionicons/icons';
import JobFields, { type JobValues } from './JobFields';
import ScheduleFields, { type ScheduleValues } from './ScheduleFields';
import { api } from '../lib/api';
import { useData } from '../lib/data';
import { suggestJobColor } from '../lib/jobs';
import { formatFullBR, jobLifetime, todayISO } from '../lib/schedule';
import type { Job } from '../lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Trabalho a editar (nome/cor). Sem ele, o modal cadastra um trabalho novo com sua escala. */
  job?: Job | null;
}

function defaultSchedule(): ScheduleValues {
  return { effectiveFrom: todayISO(), workDays: 1, restDays: 2, shiftHours: 12, shiftStartTime: '' };
}

export default function JobModal({ isOpen, onClose, job }: Props) {
  const { jobs, periods, swaps, reload } = useData();
  const [presentAlert] = useIonAlert();
  const [values, setValues] = useState<JobValues>({ name: '', color: suggestJobColor([]) });
  const [schedule, setSchedule] = useState<ScheduleValues>(defaultSchedule);
  const [endDate, setEndDate] = useState(todayISO());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Início/fim do trabalho editado (fim só existe se já foi encerrado).
  const life = job ? jobLifetime(job.id, periods) : null;

  // Preenche ao abrir. `jobs`/`periods` ficam fora das deps de propósito: o reload após salvar não
  // deve resetar o formulário enquanto o modal fecha.
  useEffect(() => {
    if (!isOpen) return;
    setValues(job ? { name: job.name, color: job.color } : { name: '', color: suggestJobColor(jobs) });
    setSchedule(defaultSchedule());
    // Último dia sugerido: hoje (ou o início, se o trabalho ainda nem começou).
    const today = todayISO();
    setEndDate(life && life.start > today ? life.start : today);
    setError('');
  }, [isOpen, job]);

  const save = async () => {
    setError('');
    const name = values.name.trim();
    if (!name) return setError('Dê um nome ao trabalho.');
    if (!job && !schedule.effectiveFrom) return setError('Escolha quando começou neste trabalho.');
    setBusy(true);
    try {
      if (job) {
        await api.updateJob(job.id, { name, color: values.color });
      } else {
        await api.createJob({
          name,
          color: values.color,
          schedule: {
            effectiveFrom: schedule.effectiveFrom,
            workDays: schedule.workDays,
            restDays: schedule.restDays,
            shiftHours: schedule.shiftHours,
            shiftStartTime: schedule.shiftStartTime || null,
          },
        });
      }
      await reload();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!job) return;
    setError('');
    setBusy(true);
    try {
      await api.deleteJob(job.id);
      await reload();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = () => {
    if (!job) return;
    void presentAlert({
      header: `Excluir "${job.name}"?`,
      message:
        'A escala, as horas (de plantão e extras) e as trocas deste trabalho serão apagadas. ' +
        'Isso não pode ser desfeito. Se você só saiu do emprego, use "Encerrar trabalho" para ' +
        'manter o histórico.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Excluir', role: 'destructive', handler: () => void remove() },
      ],
    });
  };

  const end = async () => {
    if (!job) return;
    setError('');
    setBusy(true);
    try {
      await api.endJob(job.id, endDate);
      await reload();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao encerrar.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnd = () => {
    if (!job || !life) return;
    setError('');
    if (!endDate) return setError('Escolha o último dia neste trabalho.');
    if (endDate < life.start) {
      return setError(`A data é anterior ao início deste trabalho (${formatFullBR(life.start)}).`);
    }
    // Trocas desse trabalho depois do último dia deixam de fazer sentido e são removidas.
    const swapsAfter = swaps.filter((s) => s.jobId === job.id && s.date > endDate).length;
    const swapsNote =
      swapsAfter === 0
        ? ''
        : swapsAfter === 1
          ? ' 1 troca marcada depois dessa data será removida.'
          : ` ${swapsAfter} trocas marcadas depois dessa data serão removidas.`;
    void presentAlert({
      header: `Encerrar "${job.name}"?`,
      message:
        `Último dia: ${formatFullBR(endDate)}. Os plantões até essa data continuam no histórico ` +
        `e nas horas; depois dela, este trabalho sai da agenda.${swapsNote}`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Encerrar', role: 'confirm', handler: () => void end() },
      ],
    });
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>Cancelar</IonButton>
          </IonButtons>
          <IonTitle>{job ? 'Editar trabalho' : 'Novo trabalho'}</IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={save} disabled={busy}>
              Salvar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {!job && (
          <IonText color="medium">
            <p className="ion-padding-start ion-padding-end">
              Cadastre outro emprego com a escala dele. Os plantões de cada trabalho aparecem na
              agenda com a cor escolhida, e as horas são somadas.
            </p>
          </IonText>
        )}

        <JobFields value={values} onChange={setValues} />

        {!job && (
          <ScheduleFields
            value={schedule}
            onChange={setSchedule}
            dateLabel="Comecei neste trabalho em"
          />
        )}

        {error && (
          <IonText color="danger">
            <p className="ion-padding-start ion-padding-end">{error}</p>
          </IonText>
        )}

        {job && life && !life.end && (
          <>
            <p className="section-title">Saí deste trabalho</p>
            <IonList inset>
              <IonItem>
                <IonInput
                  label="Último dia neste trabalho"
                  labelPlacement="stacked"
                  type="date"
                  value={endDate}
                  onIonInput={(e) => setEndDate(e.detail.value ?? '')}
                />
              </IonItem>
            </IonList>
            <IonNote className="ion-padding-start ion-padding-end" style={{ display: 'block' }}>
              O histórico até essa data continua contando nas horas. Depois dela, o trabalho sai da
              agenda.
            </IonNote>
            <div className="ion-padding-start ion-padding-end" style={{ marginTop: 12 }}>
              <IonButton expand="block" fill="outline" onClick={confirmEnd} disabled={busy}>
                <IonIcon slot="start" icon={exitOutline} />
                Encerrar trabalho
              </IonButton>
            </div>
          </>
        )}

        {job && life?.end && (
          <IonNote className="ion-padding" style={{ display: 'block' }}>
            Encerrado em {formatFullBR(life.end)}. Para voltar a trabalhar aqui, use “Retomar com
            nova escala” no Perfil.
          </IonNote>
        )}

        {job && jobs.length > 1 && (
          <div className="ion-padding" style={{ marginTop: 12 }}>
            <IonButton
              expand="block"
              color="danger"
              fill="clear"
              onClick={confirmRemove}
              disabled={busy}
            >
              <IonIcon slot="start" icon={trashOutline} />
              Excluir trabalho
            </IonButton>
          </div>
        )}
        <div style={{ height: 24 }} />
      </IonContent>
    </IonModal>
  );
}
