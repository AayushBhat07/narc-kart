/**
 * Indian market wholesale seizure valuation rates.
 * Based on approximate NCB/enforcement agency valuation benchmarks —
 * not street-level prices. Rates are per kilogram of pure substance.
 * Adjust as needed; the table is the single source of truth for
 * all cost calculations in the dashboard.
 */

export interface DrugPrice {
  rateInrPerKg: number;
  label: string;
}

export const DRUG_PRICES: Record<string, DrugPrice> = {
  meth:              { rateInrPerKg: 80_00_000, label: 'Methamphetamine' },
  methamphetamine:    { rateInrPerKg: 80_00_000, label: 'Methamphetamine' },
  mdma:              { rateInrPerKg: 50_00_000, label: 'MDMA / Ecstasy' },
  ecstasy:           { rateInrPerKg: 50_00_000, label: 'MDMA / Ecstasy' },
  cocaine:           { rateInrPerKg: 120_00_000, label: 'Cocaine' },
  crack:             { rateInrPerKg: 100_00_000, label: 'Crack Cocaine' },
  heroin:            { rateInrPerKg: 60_00_000, label: 'Heroin' },
  opium:             { rateInrPerKg: 15_00_000, label: 'Opium' },
  morphine:          { rateInrPerKg: 20_00_000, label: 'Morphine' },
  cannabis:          { rateInrPerKg: 5_00_000, label: 'Cannabis / Ganja' },
  ganja:             { rateInrPerKg: 5_00_000, label: 'Cannabis / Ganja' },
  marijuana:         { rateInrPerKg: 5_00_000, label: 'Cannabis / Marijuana' },
  hashish:           { rateInrPerKg: 10_00_000, label: 'Hashish / Charas' },
  charas:            { rateInrPerKg: 10_00_000, label: 'Hashish / Charas' },
  lsd:               { rateInrPerKg: 5_00_000, label: 'LSD' }, // per kg of liquid / sheet equivalent
  amphetamine:       { rateInrPerKg: 40_00_000, label: 'Amphetamine' },
  mephedrone:        { rateInrPerKg: 25_00_000, label: 'Mephedrone' },
  methamphetamine_cannabis: { rateInrPerKg: 42_50_000, label: 'Meth + Cannabis' },
  mdma_cannabis:     { rateInrPerKg: 27_50_000, label: 'MDMA + Cannabis' },
  mdma_cocaine:      { rateInrPerKg: 85_00_000, label: 'MDMA + Cocaine' },
  cocaine_cannabis:  { rateInrPerKg: 62_50_000, label: 'Cocaine + Cannabis' },
  heroin_cocaine:   { rateInrPerKg: 90_00_000, label: 'Heroin + Cocaine' },
  multiple:          { rateInrPerKg: 40_00_000, label: 'Multiple Substances' },
  snake_venom:       { rateInrPerKg: 1_00_000, label: 'Snake Venom' },
  pharmaceutical:    { rateInrPerKg: 1_00_000, label: 'Pharmaceutical Drugs' },
  other:             { rateInrPerKg: 5_00_000, label: 'Other' },
};

const DEFAULT_RATE = DRUG_PRICES['other'].rateInrPerKg;

/**
 * Look up the INR/kg rate for a drug type string.
 * Falls back to 'other' if the key isn't in the table.
 */
export function getPricePerKg(drugType: string): number {
  const key = drugType.toLowerCase().trim();
  return DRUG_PRICES[key]?.rateInrPerKg ?? DEFAULT_RATE;
}

export function getPriceLabel(drugType: string): string {
  const key = drugType.toLowerCase().trim();
  return DRUG_PRICES[key]?.label ?? 'Other';
}

/**
 * Format a value in rupees to Indian-style lakhs/crores.
 * e.g. 80_00_000 → "₹80.0L"  |  1200_00_000 → "₹12.0Cr"
 */
export function formatInr(valueInr: number): string {
  if (valueInr >= 1_00_00_000) {
    return `₹${(valueInr / 1_00_00_000).toFixed(1)}Cr`;
  }
  if (valueInr >= 1_00_000) {
    return `₹${(valueInr / 1_00_000).toFixed(1)}L`;
  }
  if (valueInr >= 1_000) {
    return `₹${(valueInr / 1_000).toFixed(0)}K`;
  }
  return `₹${Math.round(valueInr)}`;
}

/**
 * Estimate the INR value of a single seizure.
 */
export function estimateSeizureCost(drugType: string, quantityKg: number): number {
  return getPricePerKg(drugType) * quantityKg;
}
