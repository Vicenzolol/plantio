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
import { addOutline, createOutline, logOutOutline, trashOutline } from 'ionicons/icons';
import { useAuth } from '../lib/auth';
import { useData } from '../lib/data';
import { api } from '../lib/api';
import { formatFullBR, jobEndDate, todayISO } from '../lib/schedule';
import type { Job } from '../lib/types';
import ScheduleChangeModal from '../components/ScheduleChangeModal';
import JobModal from '../components/JobModal';

export default function Profile() {
  const { user, logout } = useAuth();
  const { jobs, periods, swaps, reload } = useData();
  // O trabalho do modal continua guardado enquanto ele fecha (só o `show*` volta a false),
  // para o conteúdo não sumir durante a animação.
  const [changeJob, setChangeJob] = useState<Job | null>(null);
  const [showChange, setShowChange] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);

  const openChange = (job: Job) => {
    setChangeJob(job);
    setShowChange(true);
  };
  const openEditJob = (job: Job) => {
    setEditJob(job);
    setShowJobModal(true);
  };
  const openNewJob = () => {
    setEditJob(null);
    setShowJobModal(true);
  };

  const removeSwap = async (id: string) => {
    await api.deleteSwap(id);
    await reload();
  };

  const multipleJobs = jobs.length > 1;
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const today = todayISO();
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

        <p className="section-title">{multipleJobs ? 'Trabalhos e escalas' : 'Trabalho e escala'}</p>
        {jobs.map((job) => {
          // Último dia do trabalho, se ele foi encerrado.
          const end = jobEndDate(job.id, periods);
          return (
            <IonList inset key={job.id}>
              <IonItem button detail onClick={() => openEditJob(job)}>
                <span slot="start" className="job-dot" style={{ background: job.color }} />
                <IonLabel>
                  <h2 style={{ fontWeight: 700 }}>{job.name}</h2>
                  {end && (
                    <p>
                      {end < today ? 'Encerrado' : 'Encerra'} em {formatFullBR(end)}
                    </p>
                  )}
                </IonLabel>
                <IonNote slot="end">Editar</IonNote>
              </IonItem>
              {periods
                .filter((p) => p.jobId === job.id)
                .map((p) => (
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
              <IonItem button detail={false} onClick={() => openChange(job)}>
                <IonIcon slot="start" icon={createOutline} color="primary" />
                <IonLabel color="primary">
                  {end ? 'Retomar com nova escala' : 'Mudar escala a partir de uma data'}
                </IonLabel>
              </IonItem>
            </IonList>
          );
        })}
        <div className="ion-padding-start ion-padding-end">
          <IonButton expand="block" fill="outline" onClick={openNewJob}>
            <IonIcon slot="start" icon={addOutline} />
            Adicionar outro trabalho
          </IonButton>
        </div>

        {sortedSwaps.length > 0 && (
          <>
            <p className="section-title">Trocas de turno</p>
            <IonList inset>
              {sortedSwaps.map((s) => {
                const job = jobById.get(s.jobId);
                return (
                  <IonItemSliding key={s.id}>
                    <IonItem>
                      {multipleJobs && job && (
                        <span slot="start" className="job-dot" style={{ background: job.color }} />
                      )}
                      <IonLabel>
                        <h3>
                          {formatFullBR(s.date)}
                          {multipleJobs && job ? ` • ${job.name}` : ''}
                        </h3>
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
                );
              })}
            </IonList>
          </>
        )}

        <div className="ion-padding" style={{ marginTop: 12 }}>
          <IonButton expand="block" color="danger" fill="clear" onClick={() => logout()}>
            <IonIcon slot="start" icon={logOutOutline} />
            Sair
          </IonButton>
        </div>

        <ScheduleChangeModal
          isOpen={showChange}
          job={changeJob}
          onClose={() => setShowChange(false)}
        />
        <JobModal
          isOpen={showJobModal}
          job={editJob}
          onClose={() => setShowJobModal(false)}
        />
      </IonContent>
    </IonPage>
  );
}
