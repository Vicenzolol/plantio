import {
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonNote,
  IonChip,
} from '@ionic/react';

export interface ScheduleValues {
  effectiveFrom: string; // YYYY-MM-DD
  workDays: number;
  restDays: number;
  shiftHours: number;
  shiftStartTime: string;
}

interface Preset {
  label: string;
  workDays: number;
  restDays: number;
  shiftHours: number;
}

const PRESETS: Preset[] = [
  { label: '12h • 1x2 (folga 2 dias)', workDays: 1, restDays: 2, shiftHours: 12 },
  { label: '12x36 • 1x1', workDays: 1, restDays: 1, shiftHours: 12 },
  { label: '24x72 • 1x3', workDays: 1, restDays: 3, shiftHours: 24 },
  { label: '6x1', workDays: 6, restDays: 1, shiftHours: 8 },
];

interface Props {
  value: ScheduleValues;
  onChange: (v: ScheduleValues) => void;
  /** Rótulo do campo de data (ex.: "Comecei a trabalhar em" ou "Nova escala a partir de"). */
  dateLabel: string;
}

export default function ScheduleFields({ value, onChange, dateLabel }: Props) {
  const set = (patch: Partial<ScheduleValues>) => onChange({ ...value, ...patch });

  const isActivePreset = (p: Preset) =>
    p.workDays === value.workDays &&
    p.restDays === value.restDays &&
    p.shiftHours === value.shiftHours;

  return (
    <>
      <p className="section-title">Modelos comuns</p>
      <div className="ion-padding-start ion-padding-end" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {PRESETS.map((p) => (
          <IonChip
            key={p.label}
            color={isActivePreset(p) ? 'primary' : 'medium'}
            outline={!isActivePreset(p)}
            onClick={() =>
              set({ workDays: p.workDays, restDays: p.restDays, shiftHours: p.shiftHours })
            }
          >
            {p.label}
          </IonChip>
        ))}
      </div>

      <p className="section-title">Detalhes da escala</p>
      <IonList inset>
        <IonItem>
          <IonInput
            label={dateLabel}
            labelPlacement="stacked"
            type="date"
            value={value.effectiveFrom}
            onIonInput={(e) => set({ effectiveFrom: e.detail.value ?? '' })}
          />
        </IonItem>
        <IonItem>
          <IonLabel>Dias de trabalho</IonLabel>
          <IonInput
            slot="end"
            type="number"
            inputmode="numeric"
            min={1}
            max={31}
            style={{ maxWidth: 80, textAlign: 'right' }}
            value={value.workDays}
            onIonInput={(e) => set({ workDays: Number(e.detail.value) || 1 })}
          />
        </IonItem>
        <IonItem>
          <IonLabel>Dias de folga</IonLabel>
          <IonInput
            slot="end"
            type="number"
            inputmode="numeric"
            min={0}
            max={31}
            style={{ maxWidth: 80, textAlign: 'right' }}
            value={value.restDays}
            onIonInput={(e) => set({ restDays: Number(e.detail.value) || 0 })}
          />
        </IonItem>
        <IonItem>
          <IonLabel>Horas por turno</IonLabel>
          <IonInput
            slot="end"
            type="number"
            inputmode="decimal"
            min={1}
            max={24}
            style={{ maxWidth: 80, textAlign: 'right' }}
            value={value.shiftHours}
            onIonInput={(e) => set({ shiftHours: Number(e.detail.value) || 0 })}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label="Início do turno (opcional)"
            labelPlacement="stacked"
            type="time"
            value={value.shiftStartTime}
            onIonInput={(e) => set({ shiftStartTime: e.detail.value ?? '' })}
          />
        </IonItem>
      </IonList>
      <IonNote className="ion-padding-start ion-padding-end" style={{ display: 'block' }}>
        Você trabalha {value.workDays} dia(s) de {value.shiftHours}h e folga {value.restDays} dia(s),
        em ciclo, a partir da data escolhida.
      </IonNote>
    </>
  );
}
