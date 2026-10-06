import { useEffect, useRef, useState } from 'react';
import { IonActionSheet } from '@ionic/react';
import { addCircleOutline, swapHorizontalOutline, closeCircleOutline } from 'ionicons/icons';
import { formatBR } from '../lib/schedule';
import { useData } from '../lib/data';
import { suggestJobForDay } from '../lib/jobs';
import ExtraHoursModal from './ExtraHoursModal';
import SwapModal from './SwapModal';
import type { SwapKind } from '../lib/types';

interface Props {
  /** Dia selecionado (ISO YYYY-MM-DD) ou `null` quando nada está selecionado. */
  date: string | null;
  onClose: () => void;
}

type Mode = 'sheet' | 'extra' | 'swap';

/**
 * Fluxo "tocou num dia → escolher ação → abrir modal", reutilizado pela Dashboard
 * e pela Agenda. Reaproveita ExtraHoursModal e SwapModal com a data pré-preenchida.
 */
export default function DayActions({ date, onClose }: Props) {
  const { jobs, periods, swaps } = useData();
  const [mode, setMode] = useState<Mode>('sheet');
  const [swapKind, setSwapKind] = useState<SwapKind>('extra_turno');
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  // Sinaliza que uma ação foi escolhida, para o dismiss do action sheet não
  // limpar a seleção (evita stale closure ao ler `mode`).
  const choosing = useRef(false);

  // Sempre que um novo dia é selecionado, começa pelo action sheet.
  useEffect(() => {
    if (date) {
      setMode('sheet');
      choosing.current = false;
    }
  }, [date]);

  const close = () => {
    setMode('sheet');
    onClose();
  };

  /**
   * Trabalho sugerido: para cancelar plantão ou lançar hora extra, o primeiro que trabalha no dia;
   * para "vou trabalhar", o primeiro que está de folga.
   */
  const suggest = (prefer: 'working' | 'resting') =>
    date ? suggestJobForDay(date, prefer, jobs, periods, swaps) : undefined;

  const chooseExtra = () => {
    choosing.current = true;
    setJobId(suggest('working'));
    setMode('extra');
  };

  const chooseSwap = (kind: SwapKind) => {
    choosing.current = true;
    setSwapKind(kind);
    setJobId(suggest(kind === 'folga' ? 'working' : 'resting'));
    setMode('swap');
  };

  return (
    <>
      <IonActionSheet
        isOpen={date != null && mode === 'sheet'}
        header={date ? formatBR(date) : undefined}
        onDidDismiss={() => {
          // Só fecha de vez se nenhuma ação foi escolhida (i.e. cancelou).
          if (!choosing.current) onClose();
        }}
        buttons={[
          {
            text: 'Marcar hora extra',
            icon: addCircleOutline,
            handler: chooseExtra,
          },
          {
            text: 'Troca de turno (vou trabalhar)',
            icon: swapHorizontalOutline,
            handler: () => chooseSwap('extra_turno'),
          },
          {
            text: 'Cancelar dia de trabalho',
            icon: closeCircleOutline,
            handler: () => chooseSwap('folga'),
          },
          { text: 'Fechar', role: 'cancel' },
        ]}
      />

      <ExtraHoursModal
        isOpen={date != null && mode === 'extra'}
        defaultDate={date ?? undefined}
        defaultJobId={jobId}
        onClose={close}
      />
      <SwapModal
        isOpen={date != null && mode === 'swap'}
        defaultDate={date ?? undefined}
        defaultKind={swapKind}
        defaultJobId={jobId}
        onClose={close}
      />
    </>
  );
}
