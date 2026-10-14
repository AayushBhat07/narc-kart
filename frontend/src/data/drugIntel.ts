import type { DrugType } from '../types';

/*
 * Drug intel cards (issue #17).
 *
 * CONTENT GUARDRAIL — enforcement / public-information framing only.
 * No dosing, effects, prices, purity, or how/where to obtain anything.
 * Every factual line carries a `src` index into the card's `sources` list,
 * and every source is a public government / UN / press page.
 */

export interface IntelSource {
  label: string;
  url: string;
}

/** A factual line plus the index (into DrugIntel.sources) it is drawn from. */
export interface IntelLine {
  text: string;
  src: number;
}

export interface NdpsThreshold {
  /** Substance name as it appears in the NDPS notification table. */
  substance: string;
  /** Serial number in the S.O. 1055(E) table. */
  entry: string;
  small: string;
  commercial: string;
  src: number;
  /** Optional corroborating source index (Dept. of Revenue table). */
  alsoSrc?: number;
  /** Caveat shown under the row (e.g. how a value was verified). */
  note?: string;
}

export interface DrugIntel {
  name: string;
  drugClass: string;
  streetNames: IntelLine[];
  thresholds: NdpsThreshold[];
  routes: IntelLine[];
  sources: IntelSource[];
}

// ── Shared sources ─────────────────────────────────────────────
const SO_1055: IntelSource = {
  label: 'NDPS S.O. 1055(E), 19 Oct 2001 — Table of small & commercial quantities (NCB)',
  url: 'https://narcoticsindia.nic.in/legislation/ndps-amendment-2001.pdf',
};
const DOR_QTY: IntelSource = {
  label: 'Dept. of Revenue, MoF — Punishment & offences: small/commercial quantities',
  url: 'https://dor.gov.in/punishment-offences',
};
const PIB_BSF_2023: IntelSource = {
  label: 'PIB / MHA, 9 Aug 2023 — Drugs seized by BSF (Rajya Sabha reply)',
  url: 'https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=1947137',
};

/** Indices of the two notification sources, which every card lists first. */
const S_SO = 0;
const S_DOR = 1;

export const DRUG_INTEL: Record<DrugType, DrugIntel> = {
  heroin: {
    name: 'HEROIN',
    drugClass: 'OPIOID · NARCOTIC DRUG (NDPS)',
    streetNames: [
      { text: 'Chitta (Punjab / Himachal usage)', src: 2 },
      { text: 'Brown sugar', src: 3 },
    ],
    thresholds: [
      { substance: 'Heroin (diacetylmorphine)', entry: '56', small: '5 g', commercial: '250 g', src: S_SO, alsoSrc: S_DOR },
    ],
    routes: [
      { text: 'Golden Crescent (Iran, Afghanistan, Pakistan) named by MHA as a source region', src: 4 },
      { text: 'Sea cargo: 3,004 kg from Kandahar via Bandar Abbas, Iran, seized at Mundra Port (Sep 2021)', src: 5 },
      { text: 'Land border: Punjab records the largest BSF heroin seizures on the Pakistan border', src: 6 },
      { text: 'Land cargo: heroin concealed in "Afghan brooms" intercepted at ICP Attari, Amritsar (May 2023)', src: 7 },
    ],
    sources: [
      SO_1055,
      DOR_QTY,
      { label: 'The Tribune, 15 Apr 2022 — "Chitta reaching HP via Punjab"', url: 'https://www.tribuneindia.com/news/himachal/chitta-reaching-hp-via-punjab-more-lethal-386393' },
      { label: 'Deccan Chronicle, Sep 2026 — brown sugar smuggling arrests', url: 'https://www.deccanchronicle.com/world/2-indians-nabbed-in-nepal-for-smuggling-brown-sugar-1986373' },
      { label: 'PIB / MHA, 21 Dec 2022 — HM reply in Lok Sabha on the drug problem', url: 'https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=1885539' },
      { label: 'PIB / MoF, 22 Sep 2021 — DRI seizes 3,004 kg heroin at Mundra', url: 'https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1757062' },
      PIB_BSF_2023,
      { label: 'PIB / MoF, 12 May 2023 — DRI seizes heroin at ICP Attari', url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1923685' },
    ],
  },

  cocaine: {
    name: 'COCAINE',
    drugClass: 'STIMULANT · NARCOTIC DRUG (NDPS)',
    streetNames: [],
    thresholds: [
      { substance: 'Cocaine', entry: '27', small: '2 g', commercial: '100 g', src: S_SO, alsoSrc: S_DOR },
    ],
    routes: [
      { text: 'Coca is cultivated in Colombia, Peru and Bolivia (Andean region)', src: 2 },
      { text: 'Air courier: Brazilian national arriving from São Paulo intercepted at Ahmedabad (Jun 2023)', src: 3 },
      { text: 'Air courier: passenger from Nairobi intercepted at Mumbai airport (Mar 2024)', src: 4 },
      { text: 'Air courier: passenger arriving from Dubai intercepted at IGI Airport, Delhi (Apr 2025)', src: 5 },
    ],
    sources: [
      SO_1055,
      DOR_QTY,
      { label: 'UNODC — The Globalization of Crime (TOCTA 2010), ch. 4 Cocaine', url: 'https://www.unodc.org/documents/data-and-analysis/tocta/4.Cocaine.pdf' },
      { label: 'PIB / MoF, 21 Jun 2023 — cocaine seized at Ahmedabad airport', url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1934157' },
      { label: 'PIB / MoF, 25 Mar 2024 — DRI cocaine seizure at Mumbai airport', url: 'https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2016312' },
      { label: 'PIB / MoF, 15 Apr 2025 — DRI intercepts 7.56 kg cocaine at IGI Airport', url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2121865' },
    ],
  },

  meth: {
    name: 'METHAMPHETAMINE',
    drugClass: 'STIMULANT (ATS) · PSYCHOTROPIC SUBSTANCE (NDPS)',
    streetNames: [
      { text: 'Yaba (tablet form)', src: 2 },
    ],
    thresholds: [
      { substance: 'Metamfetamine', entry: '156', small: '2 g', commercial: '50 g', src: S_SO, alsoSrc: S_DOR },
    ],
    routes: [
      { text: 'UNODC: methamphetamine trafficked from Myanmar into northeast India with rising frequency', src: 3 },
      { text: 'Indo-Myanmar border in Mizoram, onward through Cachar, Assam (Jan 2025)', src: 4 },
      { text: 'Moreh, Manipur cited by NCB as source of tablet consignments (Mar 2025)', src: 2 },
    ],
    sources: [
      SO_1055,
      DOR_QTY,
      { label: 'PIB / MHA, 16 Mar 2025 — NCB seizes methamphetamine tablets, Imphal & Guwahati zones', url: 'https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2111585' },
      { label: 'UNODC, Jun 2023 — Synthetic drugs in East & Southeast Asia report launch', url: 'https://www.unodc.org/unodc/en/frontpage/2023/June/synthetic-drug-supply-remains-at-extreme-levels-and-diversifies-in-east-and-southeast-asia--according-to-new-unodc-report.html' },
      { label: 'PIB / MoF, 22 Jan 2025 — DRI seizes 32 kg methamphetamine tablets in NE region', url: 'https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2095227' },
    ],
  },

  mdma: {
    name: 'MDMA',
    drugClass: 'STIMULANT (ATS) · PSYCHOTROPIC SUBSTANCE (NDPS)',
    streetNames: [
      { text: 'Ecstasy (listed alongside MDMA in the NDPS table)', src: S_SO },
    ],
    thresholds: [
      {
        substance: 'MDMA (ecstasy)', entry: '134', small: '0.5 g', commercial: '10 g', src: S_SO, alsoSrc: S_DOR,
              },
    ],
    routes: [
      { text: 'International postal parcels from Germany and the Netherlands interdicted at Foreign Post Office, Chennai (Jul 2020)', src: 2 },
    ],
    sources: [
      SO_1055,
      DOR_QTY,
      { label: 'PIB / MoF, 25 Jul 2020 — Chennai Air Customs seize ecstasy pills & MDMA from Germany/Netherlands', url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1641271' },
    ],
  },

  cannabis: {
    name: 'CANNABIS',
    drugClass: 'CANNABINOID · NARCOTIC DRUG (NDPS)',
    streetNames: [
      { text: 'Ganja (flowering tops)', src: S_SO },
      { text: 'Charas / hashish (resin)', src: S_SO },
    ],
    thresholds: [
      { substance: 'Ganja', entry: '55', small: '1 kg', commercial: '20 kg', src: S_SO, alsoSrc: S_DOR },
      {
        substance: 'Charas / hashish (cannabis resin)', entry: '23', small: '100 g', commercial: '1 kg', src: S_SO, alsoSrc: S_DOR,
        note: 'Small qty not legible in the DoR table; corroborated by secondary legal summaries.',
      },
    ],
    routes: [
      { text: 'Ganja moved interstate from Koraput (Odisha) and Visakhapatnam (Andhra Pradesh)', src: 2 },
      { text: 'Ganja dominates BSF seizures on the Bangladesh border (Tripura, West Bengal)', src: 3 },
      { text: 'Hilly terrain of Himachal Pradesh and Jammu & Kashmir named as major cultivating regions', src: 4 },
    ],
    sources: [
      SO_1055,
      DOR_QTY,
      { label: 'PIB / MHA, 2 Mar 2025 — NCB convictions in drug trafficking cases', url: 'https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2107483' },
      PIB_BSF_2023,
      { label: 'PIB / MHA, 12 Apr 2021 — NCB Chennai seizes 3 kg charas', url: 'https://pib.gov.in/PressReleasePage.aspx?PRID=1711213' },
    ],
  },

  opium: {
    name: 'OPIUM',
    drugClass: 'OPIOID · NARCOTIC DRUG (NDPS)',
    streetNames: [
      { text: 'Afeem (opium)', src: 2 },
      { text: 'Doda / doda post (poppy straw)', src: 2 },
    ],
    thresholds: [
      {
        substance: 'Opium', entry: '91', small: '25 g', commercial: '2.5 kg', src: S_SO,
        note: 'Scanned gazette row is OCR-ambiguous; values cross-checked against secondary legal summaries.',
      },
    ],
    routes: [
      { text: 'Illicit poppy destroyed under Op PRAHAAR: Arunachal Pradesh (8,501 ha) and Manipur (1,825 ha)', src: 3 },
      { text: 'Poppy straw interdicted in Chittorgarh (Rajasthan) and Mandsaur (Madhya Pradesh), Jan 2024', src: 3 },
      { text: 'Opium recorded in BSF seizures on the Rajasthan sector of the Pakistan border', src: 4 },
    ],
    sources: [
      SO_1055,
      DOR_QTY,
      { label: 'RajRAS — Opium-doda addiction in Rajasthan (terminology)', url: 'https://rajras.in/opium-doda-addiction-rajasthan-social-issue/' },
      { label: 'PIB / MoF, 10 Jan 2024 — CBN seizes 6,000+ kg poppy straw; Op PRAHAAR', url: 'https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1994925' },
      PIB_BSF_2023,
    ],
  },

  methaqualone: {
    name: 'METHAQUALONE',
    drugClass: 'SEDATIVE-HYPNOTIC · PSYCHOTROPIC SUBSTANCE (NDPS)',
    streetNames: [
      { text: 'Mandrax (tablets)', src: 2 },
    ],
    thresholds: [
      { substance: 'Methaqualone', entry: '158', small: '20 g', commercial: '500 g', src: S_SO, alsoSrc: S_DOR },
    ],
    routes: [
      { text: 'Domestic clandestine production: ~23.5 t of Mandrax tablets seized at Udaipur, Rajasthan (Oct 2016)', src: 2 },
      { text: 'Precursor (anthranilic acid) imported from Indonesia via Kandla Port, misdeclared', src: 2 },
    ],
    sources: [
      SO_1055,
      DOR_QTY,
      { label: 'PIB / MoF, 2 Nov 2016 — DRI seizes ~23.5 MT Mandrax tablets', url: 'https://www.pib.gov.in/newsite/PrintRelease.aspx?relid=153190' },
    ],
  },

  other: {
    name: 'UNCLASSIFIED NARCOTICS',
    drugClass: 'MIXED / UNSPECIFIED · NDPS SCHEDULE',
    streetNames: [],
    thresholds: [
      {
        substance: 'Varies by substance', entry: '1–239', small: 'per table', commercial: 'per table', src: S_SO,
        note: 'Look up the specific substance in the notification; e.g. ketamine was added in 2011 by S.O. 1430(E) [4].',
      },
    ],
    routes: [
      { text: 'MHA: drugs enter via drones, border smuggling, tunnels, sea ports and airports', src: 2 },
    ],
    sources: [
      SO_1055,
      DOR_QTY,
      { label: 'PIB / MHA, 21 Dec 2022 — HM reply in Lok Sabha on the drug problem', url: 'https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=1885539' },
      { label: 'MoF S.O. 1430(E), 21 Jun 2011 — amendment to the quantities table (Meghalaya Police copy)', url: 'https://megpolice.gov.in/sites/default/files/GOI_Notification_NDPS_Rules_0.pdf' },
    ],
  },
};
