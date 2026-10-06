import { IonList, IonItem, IonInput, IonIcon } from '@ionic/react';
import { checkmark } from 'ionicons/icons';
import { JOB_COLORS, readableTextColor } from '../lib/jobs';

export interface JobValues {
  name: string;
  color: string; // #rrggbb
}

interface Props {
  value: JobValues;
  onChange: (v: JobValues) => void;
}

/** Nome do trabalho + cor usada para pintar seus plantões na agenda. */
export default function JobFields({ value, onChange }: Props) {
  const set = (patch: Partial<JobValues>) => onChange({ ...value, ...patch });

  return (
    <>
      <p className="section-title">Trabalho</p>
      <IonList inset>
        <IonItem>
          <IonInput
            label="Nome do trabalho"
            labelPlacement="stacked"
            placeholder="Ex.: Hospital Santa Clara"
            maxlength={40}
            autocapitalize="sentences"
            value={value.name}
            onIonInput={(e) => set({ name: e.detail.value ?? '' })}
          />
        </IonItem>
      </IonList>

      <p className="section-title">Cor na agenda</p>
      <div className="color-swatches ion-padding-start ion-padding-end">
        {JOB_COLORS.map((c) => {
          const selected = c.value === value.color.toLowerCase();
          return (
            <button
              key={c.value}
              type="button"
              className={`color-swatch ${selected ? 'is-selected' : ''}`}
              style={{ background: c.value, color: readableTextColor(c.value) }}
              aria-label={c.label}
              aria-pressed={selected}
              onClick={() => set({ color: c.value })}
            >
              {selected && <IonIcon icon={checkmark} />}
            </button>
          );
        })}
      </div>
    </>
  );
}
