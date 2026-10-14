import type { DrugType, Seizure } from '../types';

export interface DrugStats {
  count: number;
  totalKg: number;
  /** Largest single seizure by quantity, or null when there are none. */
  biggest: Seizure | null;
  /** State with the most seizures (ties broken by total kg, then name). */
  topState: { state: string; count: number; totalKg: number } | null;
}

/** Pure: live stats for one drug type over the given seizures. */
export function computeDrugStats(seizures: readonly Seizure[], drugType: DrugType): DrugStats {
  let count = 0;
  let totalKg = 0;
  let biggest: Seizure | null = null;
  const byState = new Map<string, { count: number; totalKg: number }>();

  for (const s of seizures) {
    if (s.drugType !== drugType) continue;
    const kg = s.quantityKg || 0;
    count += 1;
    totalKg += kg;
    if (!biggest || kg > (biggest.quantityKg || 0)) biggest = s;
    const state = s.location.state || 'UNKNOWN';
    const agg = byState.get(state) ?? { count: 0, totalKg: 0 };
    agg.count += 1;
    agg.totalKg += kg;
    byState.set(state, agg);
  }

  let topState: DrugStats['topState'] = null;
  for (const [state, agg] of byState) {
    if (
      !topState ||
      agg.count > topState.count ||
      (agg.count === topState.count && agg.totalKg > topState.totalKg) ||
      (agg.count === topState.count && agg.totalKg === topState.totalKg && state < topState.state)
    ) {
      topState = { state, ...agg };
    }
  }

  return { count, totalKg, biggest, topState };
}
