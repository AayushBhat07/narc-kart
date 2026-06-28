import { useEffect, useState } from 'react';

export interface RaveSeizure {
  id: string;
  country: string;
  location: { city: string; state: string; lat: number | null; lon: number | null };
  drugType: string;
  quantityKg: number;
  date: string;
  source: string;
  sourceUrl: string;
  headline: string;
  eventName: string;
  agency: string;
  severity: 'critical' | 'high' | 'low';
}

export interface RaveDataset {
  source: string;
  scraped_at: string;
  seizures: RaveSeizure[];
  events?: { name: string; count: number; totalKg: number }[];
  summary?: { totalSeizures: number; totalKg: number; byDrugType: Record<string, number> };
}

interface State {
  data: RaveDataset | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads /data_raves.json (the festival/rave/event drug seizure dataset).
 * Single fetch on mount, no revalidation.
 */
export function useRaveData(): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data_raves.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: RaveDataset) => {
        if (!cancelled) setState({ data: json, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
