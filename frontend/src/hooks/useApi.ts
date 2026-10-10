import { useState, useEffect, useCallback, useMemo } from 'react';
import { Seizure, FilterState, ApiStats } from '../types';

// The site is fully static: everything comes from /data.json, which a
// weekly GitHub Action refreshes. Filters are applied client-side.

const CACHE_KEY = 'narc_kart_cache';
const CACHE_TTL = 60 * 60 * 1000;
const SEVERITY_MAX_UNBOUNDED = 500;

async function fetchStaticData(): Promise<{ seizures: Seizure[]; stats: ApiStats; lastUpdated: string | null }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const seizures: Seizure[] = data.seizures.map((s: any) => ({
    id: s.id,
    location: { city: s.city, state: s.state, lat: s.lat, lon: s.lon },
    drugType: s.drugType,
    quantityKg: s.quantityKg,
    date: s.date,
    source: { name: s.sourceName || '', url: s.sourceUrl || '' },
    agency: s.agency || '',
    images: s.images || [],
    caseNo: s.caseNo,
    description: s.description,
  }));
  const stats: ApiStats = {
    totalSeizures: data.stats.total_seizures,
    totalQuantityKg: data.stats.total_quantity_kg,
    raidsThisWeek: data.stats.raids_this_week,
    byState: data.stats.by_state,
    byDrugType: data.stats.by_drug_type,
    byMonth: data.stats.by_month,
    topLocations: data.stats.top_locations.map((l: any) => ({
      state: l.state,
      city: l.city,
      seizureCount: l.seizureCount ?? l.count ?? 0,
      totalKg: l.totalKg ?? l.kg ?? 0,
    })),
  };
  return { seizures, stats, lastUpdated: data.lastUpdated ?? null };
}

function readCache(): { seizures: Seizure[]; stats: ApiStats | null; lastUpdate: string | null; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(seizures: Seizure[], stats: ApiStats | null, lastUpdate: string | null) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ seizures, stats, lastUpdate, fetchedAt: Date.now() }));
  } catch {}
}

function applyFilterState(seizures: Seizure[], f: FilterState): Seizure[] {
  let minDate: string | null = null;
  if (f.timePeriod !== 'all') {
    const days = f.timePeriod === '1y' ? 365 : parseInt(f.timePeriod, 10);
    minDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  }
  return seizures.filter((s) => {
    if (minDate && s.date < minDate) return false;
    if (f.drugTypes.length && !f.drugTypes.includes(s.drugType)) return false;
    if (f.states.length && !f.states.includes(s.location.state)) return false;
    const kg = s.quantityKg || 0;
    if (kg < f.severityMin) return false;
    if (f.severityMax < SEVERITY_MAX_UNBOUNDED && kg > f.severityMax) return false;
    return true;
  });
}

const defaultFilters: FilterState = {
  timePeriod: 'all',
  drugTypes: [],
  states: [],
  severityMin: 0,
  severityMax: SEVERITY_MAX_UNBOUNDED,
};

export function useApi() {
  const [allSeizures, setAllSeizures] = useState<Seizure[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async (isMounted: () => boolean = () => true) => {
    setLoading(true);
    setError(null);
    try {
      const { seizures, stats, lastUpdated } = await fetchStaticData();
      if (!isMounted()) return;
      setAllSeizures(seizures);
      setStats(stats);
      setLastUpdate(lastUpdated);
      setIsOffline(false);
      writeCache(seizures, stats, lastUpdated);
    } catch {
      if (!isMounted()) return;
      const cached = readCache();
      if (cached) {
        setAllSeizures(cached.seizures);
        setStats(cached.stats);
        setLastUpdate(cached.lastUpdate);
        setIsOffline(true);
      } else {
        setError('Failed to load data');
      }
    } finally {
      if (isMounted()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Show cached data instantly on repeat visits, then refresh.
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setAllSeizures(cached.seizures);
      setStats(cached.stats);
      setLastUpdate(cached.lastUpdate);
    }
    let mounted = true;
    load(() => mounted);
    return () => { mounted = false; };
  }, [load]);

  const seizures = useMemo(() => applyFilterState(allSeizures, filters), [allSeizures, filters]);

  const applyFilters = useCallback((next: FilterState) => setFilters(next), []);
  const resetFilters = useCallback(() => setFilters(defaultFilters), []);
  const refresh = useCallback(() => { load(); }, [load]);

  return {
    seizures,
    stats,
    filters,
    loading,
    error,
    lastUpdate,
    isOffline,
    applyFilters,
    resetFilters,
    refresh,
  };
}
