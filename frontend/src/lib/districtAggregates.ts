/* ══════════════════════════════════════════════════════════════
   District aggregation helpers — shared by main (radar) and rave
   (festival) modes in App.tsx.

   The choropleth in both views is built from the same GADM
   district polygon set (`/india-districts.geojson`) and aggregates
   seizures by the same `${NAME_2}|${NAME_1}` key, so the
   point-in-polygon projection only needs to live in one place.
   ══════════════════════════════════════════════════════════════ */

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';
import type {
  DistrictAggregate,
  DistrictFeature,
  Seizure,
} from '../types';

/** City-name → GADM district-name alias map.
 *  Used by the hint-key fast path so we don't have to fall back to a
 *  full point-in-polygon scan for cities whose colloquial name differs
 *  from the official 2011 GADM spelling (e.g. Bengaluru → Bangalore
 *  Urban, Gurugram → Gurgaon). Keys are lower-cased + trimmed before
 *  lookup. */
export const CITY_ALIASES: Record<string, string> = {
  'bengaluru': 'bangalore urban',
  'bangalore': 'bangalore urban',
  'bombay': 'greater bombay',
  'mumbai': 'greater bombay',
  'gurugram': 'gurgaon',
  'gurgaon': 'gurgaon',
  'mangaluru': 'dakshin kannad',
  'mangalore': 'dakshin kannad',
  'raigarh': 'raigarh',          // Maharashtra Raigarh is also the spelling
  'raigad': 'raigarh',
  'pondicherry': 'puducherry',
  'trivandrum': 'thiruvananthapuram',
  'cochin': 'kochi',
  'calcutta': 'kolkata',
  'madras': 'chennai',
  'baroda': 'vadodara',
  'nasik': 'nashik',
  'poona': 'pune',
  'sholapur': 'solapur',
  'gwalior': 'gwalior',
};

/** Resolve a city hint to its canonical GADM district name. Falls back
 *  to a lower-cased + trimmed version of the input if no alias is
 *  registered — point-in-polygon is still authoritative in that case. */
export function canonicalDistrictName(city: string): string {
  return CITY_ALIASES[city.trim().toLowerCase()] ?? city.trim().toLowerCase();
}

/** (NAME_2, NAME_1) → Feature[] — the polygon index built once from
 *  /india-districts.geojson. Multiple polygons can share a key
 *  (rare in GADM but possible for districts split across islands);
 *  they are treated as one district for aggregation purposes. */
export type DistrictPolygonIndex = Record<string, DistrictFeature[]>;

export interface AggregateResult {
  byDistrict: Record<string, DistrictAggregate>;
  /** Records that didn't fall inside any district polygon (no lat/lon
   *  or sat outside the country silhouette). Surfaced via the
   *  DistrictPanel footer so coverage stays honest. */
  unmatchedCount: number;
}

/** Project a list of Seizure records onto a district polygon index
 *  and aggregate by `${NAME_2}|${NAME_1}`.
 *
 *  Matching is two-pass:
 *    1. Try the district key implied by the city/state hint (with
 *       alias normalisation) — covers colloquial names like
 *       "Mumbai" → "Greater Bombay|Maharashtra" without a scan.
 *    2. If the hint misses, fall back to a full scan of every
 *       polygon in the index. Point-in-polygon is then authoritative.
 *
 *  Each aggregate carries the actual Seizure records that landed in
 *  it, so DistrictPanel can render the per-incident list
 *  (date / drug / kg / event / agency / city) for both the main
 *  and rave views. */
export function aggregateSeizuresByDistrict(
  seizures: Seizure[],
  polysByKey: DistrictPolygonIndex,
): AggregateResult {
  const byDistrict: Record<string, DistrictAggregate> = {};
  let unmatchedCount = 0;

  for (const sz of seizures) {
    const lat = sz.location?.lat;
    const lon = sz.location?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      unmatchedCount++;
      continue;
    }
    // GeoJSON is [lon, lat] — turf follows the spec, so we do too.
    const pt = turfPoint([lon, lat]);

    let matchedKey: string | null = null;
    let matchedProps: DistrictFeature['properties'] | null = null;

    const canonicalCity = canonicalDistrictName(sz.location.city ?? '');
    const hintKey = `${canonicalCity}|${(sz.location.state ?? '').trim()}`;
    const hintCandidates = polysByKey[hintKey];
    const candidateSets: DistrictFeature[][] = hintCandidates
      ? [hintCandidates]
      : Object.values(polysByKey);

    for (const candidates of candidateSets) {
      for (const f of candidates) {
        if (booleanPointInPolygon(pt, f)) {
          const props = f.properties ?? ({} as DistrictFeature['properties']);
          matchedKey = `${props.NAME_2 ?? ''}|${props.NAME_1 ?? ''}`;
          matchedProps = props;
          break;
        }
      }
      if (matchedKey) break;
    }

    if (!matchedKey || !matchedProps) {
      unmatchedCount++;
      continue;
    }

    let agg = byDistrict[matchedKey];
    if (!agg) {
      agg = {
        district: matchedProps.NAME_2 ?? '',
        state: matchedProps.NAME_1 ?? '',
        stateKey: matchedProps.NAME_1 ?? '',
        count: 0,
        totalKg: 0,
        drugs: {},
        seizures: [],
      };
      byDistrict[matchedKey] = agg;
    }
    agg.count += 1;
    agg.totalKg += sz.quantityKg ?? 0;
    const drug = sz.drugType ?? 'other';
    agg.drugs[drug] = (agg.drugs[drug] ?? 0) + (sz.quantityKg ?? 0);
    // Keep the actual list so DistrictPanel can render per-incident detail.
    agg.seizures!.push(sz);
  }

  return { byDistrict, unmatchedCount };
}
