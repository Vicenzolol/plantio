import { useEffect, useRef, useState } from 'react';
import { IonActionSheet } from '@ionic/react';
import { addCircleOutline, swapHorizontalOutline, closeCircleOutline } from 'ionicons/icons';
import { formatBR } from '../lib/schedule';
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
  const [mode, setMode] = useState<Mode>('sheet');
  const [swapKind, setSwapKind] = useState<SwapKind>('extra_turno');
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
            handler: () => {
              choosing.current = true;
              setMode('extra');
            },
          },
          {
            text: 'Troca de turno (vou trabalhar)',
            icon: swapHorizontalOutline,
            handler: () => {
              choosing.current = true;
              setSwapKind('extra_turno');
              setMode('swap');
            },
          },
          {
            text: 'Cancelar dia de trabalho',
            icon: closeCircleOutline,
            handler: () => {
              choosing.current = true;
              setSwapKind('folga');
              setMode('swap');
            },
          },
          { text: 'Fechar', role: 'cancel' },
        ]}
      />

      <ExtraHoursModal
        isOpen={date != null && mode === 'extra'}
        defaultDate={date ?? undefined}
        onClose={close}
      />
      <SwapModal
        isOpen={date != null && mode === 'swap'}
        defaultDate={date ?? undefined}
        defaultKind={swapKind}
        onClose={close}
      />
    </>
  );
}
