import type { CSSProperties } from 'react';
import { IonChip, IonIcon, IonLabel } from '@ionic/react';
import { checkmarkCircle } from 'ionicons/icons';
import { readableTextColor } from '../lib/jobs';
import type { Job } from '../lib/types';

interface Props {
  jobs: Job[];
  value: string;
  onChange: (jobId: string) => void;
}

/** Escolha do trabalho (chips com a cor de cada um). Não aparece quando só há um trabalho. */
export default function JobPicker({ jobs, value, onChange }: Props) {
  if (jobs.length <= 1) return null;

  return (
    <>
      <p className="section-title">Trabalho</p>
      <div
        className="ion-padding-start ion-padding-end"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
      >
        {jobs.map((j) => {
          const selected = j.id === value;
          const text = readableTextColor(j.color);
          const style = selected
            ? ({ '--background': j.color, '--color': text } as CSSProperties)
            : undefined;
          return (
            <IonChip key={j.id} outline={!selected} style={style} onClick={() => onChange(j.id)}>
              {selected ? (
                <IonIcon icon={checkmarkCircle} style={{ color: text }} />
              ) : (
                <span className="job-dot" style={{ background: j.color, marginInlineEnd: 6 }} />
              )}
              <IonLabel>{j.name}</IonLabel>
            </IonChip>
          );
        })}
      </div>
    </>
  );
}
