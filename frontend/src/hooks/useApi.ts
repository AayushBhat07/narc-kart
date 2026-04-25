import { useState, useEffect, useCallback, useRef } from 'react';
import { Seizure, FilterState, ApiStats } from '../types';

const CACHE_KEY = 'narc_kart_cache';
const CACHE_TTL = 60 * 60 * 1000;

function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const base = import.meta.env.VITE_API_BASE;
    if (base) return base;
    // If no env, use local JSON (static mode)
  }
  return '';
}

function isStaticMode(): boolean {
  const base = getApiBase();
  return !base || base === '/api';
}

async function fetchStaticData(): Promise<{ seizures: Seizure[]; stats: ApiStats }> {
  const res = await fetch('/data.json');
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
      state: l.state, city: l.city, seizureCount: l.count, totalKg: l.kg,
    })),
  };
  return { seizures, stats };
}

function readCache(): { seizures: Seizure[]; stats: ApiStats | null; lastUpdate: string | null; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (Date.now() - cache.fetchedAt > CACHE_TTL) return null;
    return cache;
  } catch {
    return null;
  }
}

function writeCache(seizures: Seizure[], stats: ApiStats | null, lastUpdate: string | null) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ seizures, stats, lastUpdate, fetchedAt: Date.now() }));
  } catch {}
}

const defaultFilters: FilterState = {
  timePeriod: 'all',
  drugTypes: [],
  states: [],
  severityMin: 0,
  severityMax: 500,
};

export function useApi() {
  const [seizures, setSeizures] = useState<Seizure[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const mountedRef = useRef(true);

  const fetchStatic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { seizures, stats } = await fetchStaticData();
      if (!mountedRef.current) return;
      setSeizures(seizures);
      setStats(stats);
      const now = new Date().toISOString();
      setLastUpdate(now);
      writeCache(seizures, stats, now);
      const cached = readCache();
      if (cached) setIsOffline(true);
    } catch (err) {
      if (mountedRef.current) {
        const cached = readCache();
        if (cached) {
          setSeizures(cached.seizures);
          setStats(cached.stats);
          setLastUpdate(cached.lastUpdate);
          setIsOffline(true);
        } else {
          setError('Failed to load data');
        }
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const fetchFromApi = useCallback(async (filterOverrides?: Partial<FilterState>) => {
    setLoading(true);
    setError(null);
    setIsOffline(false);
    try {
      const params = new URLSearchParams();
      const activeFilters = { ...filters, ...filterOverrides };
      if (activeFilters.timePeriod !== 'all') params.append('time_period', activeFilters.timePeriod);
      if (activeFilters.drugTypes.length > 0) activeFilters.drugTypes.forEach(dt => params.append('drug_type', dt));
      if (activeFilters.states.length > 0) activeFilters.states.forEach(s => params.append('state', s));
      params.append('severity_min', String(activeFilters.severityMin));
      params.append('severity_max', String(activeFilters.severityMax));

      const res = await fetch(`${getApiBase()}/seizures?${params}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current) return;
      const seizuresList = (data.seizures || []).map((s: any) => ({
        id: s.id,
        location: { city: s.city, state: s.state, lat: s.lat, lon: s.lon },
        drugType: s.drug_type,
        quantityKg: s.quantity_kg,
        date: s.date,
        source: { name: s.source_name || '', url: s.source_url || '' },
        agency: s.agency || '',
        images: s.images ? JSON.parse(s.images) : [],
        caseNo: s.case_no,
        description: s.description,
      }));
      setSeizures(seizuresList);
      const now = new Date().toISOString();
      setLastUpdate(now);
      writeCache(seizuresList, null, now);
    } catch {
      if (mountedRef.current) {
        const cached = readCache();
        if (cached) {
          setSeizures(cached.seizures);
          setLastUpdate(cached.lastUpdate);
          setIsOffline(true);
        } else {
          setError('Failed to fetch seizures');
        }
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/stats`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current) return;
      const statsData: ApiStats = {
        totalSeizures: data.total_seizures || 0,
        totalQuantityKg: data.total_quantity_kg || 0,
        raidsThisWeek: data.raids_this_week ?? 0,
        byState: data.by_state || {},
        byDrugType: data.by_drug_type || {},
        byMonth: data.by_month || {},
        topLocations: (data.top_locations || []).map((l: any) => ({
          state: l.state, city: l.city, seizureCount: l.seizure_count, totalKg: l.total_kg,
        })),
      };
      setStats(statsData);
      const cached = readCache();
      writeCache(cached?.seizures || seizures, statsData, new Date().toISOString());
    } catch {
      if (mountedRef.current) {
        const cached = readCache();
        if (cached?.stats) {
          setStats(cached.stats);
          setIsOffline(true);
        }
      }
    }
  }, [seizures]);

  const fetchSeizures = isStaticMode() ? fetchStatic : fetchFromApi;

  const applyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    if (!isStaticMode()) fetchFromApi(newFilters);
  }, [fetchFromApi]);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    if (!isStaticMode()) fetchSeizures(defaultFilters);
  }, [fetchSeizures]);

  const refresh = useCallback(() => {
    fetchSeizures();
    if (!isStaticMode()) fetchStats();
  }, [fetchSeizures, fetchStats]);

  // Load cache immediately
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setSeizures(cached.seizures);
      setStats(cached.stats);
      setLastUpdate(cached.lastUpdate);
      if (Date.now() - cached.fetchedAt > CACHE_TTL) setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchSeizures();
    if (!isStaticMode()) fetchStats();
    return () => { mountedRef.current = false; };
  }, []);

  return {
    seizures,
    stats,
    filters,
    loading,
    error,
    lastUpdate,
    isOffline,
    fetchSeizures,
    fetchStats,
    applyFilters,
    resetFilters,
    refresh,
  };
}