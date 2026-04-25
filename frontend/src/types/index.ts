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