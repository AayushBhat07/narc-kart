export type DrugType = 'heroin' | 'cocaine' | 'meth' | 'cannabis' | 'methaqualone' | 'other';

export interface SeizureLocation {
  city: string;
  state: string;
  lat: number;
  lon: number;
}

export interface SeizureSource {
  name: string;
  url: string;
}

export interface Seizure {
  id: string;
  location: SeizureLocation;
  drugType: DrugType;
  quantityKg: number;
  date: string;
  source: SeizureSource;
  agency: string;
  images: string[];
  caseNo?: string;
  description?: string;
}

export interface FilterState {
  timePeriod: 'all' | '7d' | '30d' | '90d' | '1y';
  drugTypes: DrugType[];
  states: string[];
  severityMin: number;
  severityMax: number;
}

export interface ApiStats {
  totalSeizures: number;
  totalQuantityKg: number;
  raidsThisWeek: number;
  byState: Record<string, number>;
  byDrugType: Record<string, number>;
  byMonth: Record<string, number>;
  topLocations: Array<{ state: string; city: string; seizureCount: number; totalKg: number }>;
}

/* ══════════════════════════════════════════════════════════════
   District choropleth types
   Shape mirrors /data-by-district.json (pre-aggregated per district).
   Key convention: `${NAME_2}|${NAME_1}` matches the GADM district
   feature properties in /india-districts.geojson.
   ══════════════════════════════════════════════════════════════ */

export type DistrictTier = 'critical' | 'high' | 'low';

export interface DistrictAggregate {
  district: string;
  state: string;
  stateKey: string;
  count: number;
  totalKg: number;
  drugs: Record<string, number>;
  /** Per-seizure records that fell inside this district.
   *  Optional because the main (radar) view's pre-aggregated
   *  /data-by-district.json doesn't include the raw list — only
   *  totals. Rave-mode aggregates built at runtime in App.tsx do
   *  populate this so DistrictPanel can render the actual list
   *  of seizures (date, drug, kg, event, agency). */
  seizures?: Seizure[];
}

/* Minimal DistrictFeature — subset of the GADM Feature shape we touch.
   Avoids depending on the full @types/geojson surface for the props we
   actually read. The `Feature` supertype keeps it compatible with
   react-leaflet's GeoJSON `data` prop. */
import type { Feature, MultiPolygon } from 'geojson';

export interface DistrictProperties {
  NAME_1: string;
  NAME_2: string;
  ENGTYPE_2?: string;
  [k: string]: unknown;
}

export type DistrictFeature = Feature<MultiPolygon, DistrictProperties>;
export type DistrictFeatureCollection = {
  type: 'FeatureCollection';
  features: DistrictFeature[];
};