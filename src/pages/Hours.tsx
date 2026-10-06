import { useMemo, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardContent,
  IonList,
  IonItem,
  IonNote,
  IonIcon,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
} from '@ionic/react';
import { trashOutline } from 'ionicons/icons';
import { useData } from '../lib/data';
import { api } from '../lib/api';
import {
  todayISO,
  startOfWeek,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  sumHours,
  formatFullBR,
} from '../lib/schedule';
import { jobsActiveInRange } from '../lib/jobs';

type Period = 'week' | 'month' | 'year';

function fmtH(n: number): string {
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`;
}

export default function Hours() {
  const { jobs, periods, extras, swaps, reload } = useData();
  const [range, setRange] = useState<Period>('week');
  const today = todayISO();

  const { start, end } = useMemo(() => {
    if (range === 'week') {
      const s = startOfWeek(today);
      return { start: s, end: addDays(s, 6) };
    }
    if (range === 'month') {
      return { start: startOfMonth(today), end: endOfMonth(today) };
    }
    return { start: startOfYear(today), end: endOfYear(today) };
  }, [range, today]);

  const summary = useMemo(
    () => sumHours(start, end, periods, swaps, extras),
    [start, end, periods, swaps, extras],
  );

  const extrasInRange = useMemo(
    () =>
      extras
        .filter((e) => e.date >= start && e.date <= end)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [extras, start, end],
  );

  const removeExtra = async (id: string) => {
    await api.deleteExtra(id);
    await reload();
  };

  const label = range === 'week' ? 'esta semana' : range === 'month' ? 'este mês' : 'este ano';
  // Trabalhos que importam neste período: ativos nele ou com horas lançadas (um trabalho encerrado
  // antes do período não aparece com 0h).
  const rangeJobs = useMemo(() => {
    const active = new Set(jobsActiveInRange(start, end, jobs, periods).map((j) => j.id));
    return jobs.filter((j) => active.has(j.id) || summary.byJob[j.id]);
  }, [start, end, jobs, periods, summary]);
  const multipleJobs = rangeJobs.length > 1;
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Horas trabalhadas</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          <IonSegment value={range} onIonChange={(e) => setRange(e.detail.value as Period)}>
            <IonSegmentButton value="week">
              <IonLabel>Semana</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="month">
              <IonLabel>Mês</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="year">
              <IonLabel>Ano</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          <IonCard style={{ borderRadius: 18 }}>
            <IonCardContent className="ion-text-center">
              <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>
                {fmtH(summary.total)}
              </div>
              <IonNote>total {label}</IonNote>
            </IonCardContent>
          </IonCard>

          <div className="stat-grid">
            <IonCard className="stat-card">
              <IonCardContent>
                <div className="stat-value">{fmtH(summary.scheduled)}</div>
                <div className="stat-label">Plantões ({summary.workDays}d)</div>
              </IonCardContent>
            </IonCard>
            <IonCard className="stat-card">
              <IonCardContent>
                <div className="stat-value">{fmtH(summary.extra)}</div>
                <div className="stat-label">Horas extras</div>
              </IonCardContent>
            </IonCard>
          </div>

          <p className="section-title">
            {multipleJobs ? 'Plantões por trabalho' : 'Horas extras lançadas'}
          </p>
        </div>

        {multipleJobs && (
          <>
            <IonList inset>
              {rangeJobs.map((j) => {
                const h = summary.byJob[j.id];
                const count = h?.workDays ?? 0;
                const extra = h?.extra ?? 0;
                return (
                  <IonItem key={j.id}>
                    <span slot="start" className="job-dot" style={{ background: j.color }} />
                    <IonLabel>
                      <h3>{j.name}</h3>
                      <p>
                        {count} {count === 1 ? 'plantão' : 'plantões'}
                        {extra > 0 && ` · +${fmtH(extra)} extra`}
                      </p>
                    </IonLabel>
                    <IonNote slot="end">{fmtH((h?.scheduled ?? 0) + extra)}</IonNote>
                  </IonItem>
                );
              })}
            </IonList>
            <div className="ion-padding-start ion-padding-end ion-padding-bottom">
              <p className="section-title">Horas extras lançadas</p>
            </div>
          </>
        )}

        {extrasInRange.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma hora extra neste período.</p>
          </div>
        ) : (
          <IonList inset>
            {extrasInRange.map((e) => {
              // Com mais de um trabalho cadastrado, mostra de qual é cada hora extra.
              const job = jobs.length > 1 ? jobById.get(e.jobId) : undefined;
              return (
                <IonItemSliding key={e.id}>
                  <IonItem>
                    {job && (
                      <span slot="start" className="job-dot" style={{ background: job.color }} />
                    )}
                    <IonLabel>
                      <h3>
                        {formatFullBR(e.date)}
                        {job ? ` • ${job.name}` : ''}
                      </h3>
                      {e.description && <p>{e.description}</p>}
                    </IonLabel>
                    <IonNote slot="end" color="primary">
                      +{fmtH(Number(e.hours))}
                    </IonNote>
                  </IonItem>
                  <IonItemOptions side="end">
                    <IonItemOption color="danger" onClick={() => removeExtra(e.id)}>
                      <IonIcon slot="icon-only" icon={trashOutline} />
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              );
            })}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}
