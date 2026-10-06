import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { Job, SchedulePeriod, ExtraHour, ShiftSwap } from './types';

interface DataState {
  jobs: Job[];
  periods: SchedulePeriod[];
  extras: ExtraHour[];
  swaps: ShiftSwap[];
  loading: boolean;
  reload: () => Promise<void>;
}

const DataContext = createContext<DataState | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [extras, setExtras] = useState<ExtraHour[]>([]);
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setJobs([]);
      setPeriods([]);
      setExtras([]);
      setSwaps([]);
      return;
    }
    setLoading(true);
    try {
      const [j, p, e, s] = await Promise.all([
        api.getJobs(),
        api.getSchedules(),
        api.getExtras(),
        api.getSwaps(),
      ]);
      setJobs(j.jobs);
      setPeriods(p.periods);
      setExtras(e.extras);
      setSwaps(s.swaps);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <DataContext.Provider value={{ jobs, periods, extras, swaps, loading, reload }}>
      {children}
    </DataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData deve ser usado dentro de <DataProvider>.');
  return ctx;
}
