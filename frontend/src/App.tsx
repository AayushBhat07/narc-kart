/* Hallmark · genre: tactical ops-center · macrostructure: war-room · design-system: DESIGN.md */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { IndiaMap } from './components/IndiaMap';
import { FilterPanel } from './components/FilterPanel';
import { SeizureModal } from './components/SeizureModal';
import { LoadingScreen } from './components/LoadingScreen';
import { IntelPanel } from './components/IntelPanel';
import { NetworkPanel } from './components/NetworkPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { TrendingPanel } from './components/TrendingPanel';
import { AgencyPanel } from './components/AgencyPanel';
import { ComparePanel } from './components/ComparePanel';
import { DistrictPanel } from './components/DistrictPanel';
import { OfflineBadge } from './components/OfflineBadge';
import { Clock } from './components/Clock';
import { RavePanel } from './components/RavePanel';
import { useApi } from './hooks/useApi';
import { useRaveData } from './hooks/useRaveData';
import { Seizure, DistrictAggregate, DistrictFeature, DistrictFeatureCollection } from './types';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import styles from './App.module.css';

type Tab = 'radar' | 'intel' | 'network' | 'terminal' | 'trending' | 'agency' | 'compare' | 'rave';

const TICKER_ITEMS = [
  { sev: 'CRIT', city: 'MUMBAI', drug: 'HEROIN', kg: '340KG' },
  { sev: 'HIGH', city: 'DELHI', drug: 'METH', kg: '89KG' },
  { sev: 'LOW', city: 'PUNE', drug: 'CANNABIS', kg: '12KG' },
  { sev: 'CRIT', city: 'SRINAGAR', drug: 'HEROIN', kg: '210KG' },
  { sev: 'HIGH', city: 'AHMEDABAD', drug: 'METH', kg: '45KG' },
  { sev: 'LOW', city: 'KOLKATA', drug: 'COCAINE', kg: '8KG' },
  { sev: 'HIGH', city: 'CHENNAI', drug: 'METH', kg: '67KG' },
  { sev: 'CRIT', city: 'JAMMU', drug: 'HEROIN', kg: '180KG' },
  { sev: 'LOW', city: 'GOA', drug: 'CANNABIS', kg: '22KG' },
  { sev: 'HIGH', city: 'PATNA', drug: 'METH', kg: '34KG' },
];

function getSeverityClass(kg: number) {
  if (kg > 100) return styles['sev--critical'];
  if (kg > 10) return styles['sev--high'];
  return styles['sev--low'];
}

function TickerItem({ item }: { item: typeof TICKER_ITEMS[number] }) {
  const kg = parseFloat(item.kg.replace(/[^0-9.]/g, ''));
  return (
    <span className={styles.tickerItem}>
      <span className={`${styles.sev} ${getSeverityClass(kg)}`}>{item.sev}</span>
      <span className={styles.loc}>{item.city}</span>
      <span className={styles.drug}>{item.drug}</span>
      <span className={styles.sep}>·</span>
      <span>{item.kg}</span>
    </span>
  );
}

// Doubled once at module load (not per render) for the seamless marquee loop.
const TICKER_ITEMS_DOUBLED: typeof TICKER_ITEMS = [...TICKER_ITEMS, ...TICKER_ITEMS];

/** City-name → GADM district-name alias map.
 *  Used by the rave aggregation's hint-key fast path so we don't have
 *  to fall back to a full point-in-polygon scan for cities whose
 *  colloquial name differs from the official 2011 GADM spelling
 *  (e.g. Bengaluru → Bangalore Urban, Gurugram → Gurgaon). Keys are
 *  lower-cased + trimmed before lookup. */
const CITY_ALIASES: Record<string, string> = {
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

function canonicalDistrictName(city: string): string {
  return (CITY_ALIASES[city.trim().toLowerCase()] ?? city.trim().toLowerCase());
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('rave');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSeizure, setSelectedSeizure] = useState<Seizure | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictAggregate | null>(null);

  const { seizures, stats, filters, applyFilters, resetFilters, isOffline, lastUpdate } = useApi();
  const { data: raveData } = useRaveData();

  // District choropleth data — loaded once, keyed by `${NAME_2}|${NAME_1}`.
  // We also keep the top-level unmatchedCount so the DistrictPanel footer
  // can be honest about how many source records didn't geocode.
  const [byDistrict, setByDistrict] = useState<Record<string, DistrictAggregate> | null>(null);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch('/data-by-district.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: { byDistrict: Record<string, DistrictAggregate>; unmatchedCount?: number }) => {
        if (cancelled) return;
        setByDistrict(json.byDistrict);
        setUnmatchedCount(json.unmatchedCount ?? 0);
      })
      .catch((err) => console.error('[App] District data load failed:', err));
    return () => { cancelled = true; };
  }, []);

  // Rave district choropleth — built at runtime from /india-districts.geojson
  // + the projected raveSeizures list. Each seizure's (lat, lon) is matched
  // against the polygon set via point-in-polygon; we then aggregate by
  // `${NAME_2}|${NAME_1}` (same key shape as the main byDistrict). Seizures
  // that don't fall inside any district are logged once and dropped so the
  // aggregates stay honest about coverage.
  const [raveDistrictIndex, setRaveDistrictIndex] = useState<Record<string, DistrictFeature[]> | null>(null);
  const [byDistrictRave, setByDistrictRave] = useState<Record<string, DistrictAggregate> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/india-districts.geojson')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DistrictFeatureCollection>;
      })
      .then((json) => {
        if (cancelled) return;
        // Build a (NAME_2, NAME_1) → Feature[] index once. If multiple
        // polygons share a key (rare in GADM but possible for districts
        // split across islands) they're treated as one district.
        const polysByKey: Record<string, DistrictFeature[]> = {};
        for (const f of json.features) {
          const props = f.properties ?? ({} as DistrictFeature['properties']);
          const key = `${props.NAME_2 ?? ''}|${props.NAME_1 ?? ''}`;
          (polysByKey[key] ||= []).push(f);
        }
        setRaveDistrictIndex(polysByKey);
        setByDistrictRave({}); // mark loaded (empty until seizures arrive)
      })
      .catch((err) => console.error('[App] Rave district GeoJSON load failed:', err));
    return () => { cancelled = true; };
  }, []);

  // Project the rave dataset into the standard Seizure shape so we can render
  // them on the same map. Rave seizures may have a slightly different field
  // set; this adapter normalises them.
  const raveSeizures: Seizure[] = useMemo(() => {
    if (!raveData?.seizures) return [];
    return raveData.seizures
      .filter((r) => {
        const lat = r.location?.lat;
        const lon = r.location?.lon;
        return typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon);
      })
      .map((r) => ({
        id: r.id,
        location: {
          city: r.location?.city ?? '',
          state: r.location?.state ?? '',
          lat: r.location.lat as number,
          lon: r.location.lon as number,
        },
        drugType: 'other' as const,
        quantityKg: r.quantityKg,
        date: r.date,
        source: { name: r.source ?? '', url: r.sourceUrl ?? '' },
        agency: r.agency ?? '',
        images: [],
        caseNo: r.eventName ?? '',   // stash event name so modal could use it
        description: r.headline ?? '',
      }));
  }, [raveData]);

  // Aggregate the projected rave seizures by district whenever either
  // the polygon index or the seizure list changes. Each seizure hits
  // the index; we tally count + totalKg + per-drug breakdown by the
  // same `${NAME_2}|${NAME_1}` key the main view uses, so panel
  // consumers don't need a separate code path.
  useEffect(() => {
    if (!raveDistrictIndex) return; // polygons still loading
    if (raveSeizures.length === 0) {
      setByDistrictRave({});
      return;
    }
    const polysByKey = raveDistrictIndex;
    const aggregates: Record<string, DistrictAggregate> = {};
    let unmatched = 0;
    for (const sz of raveSeizures) {
      const lat = sz.location.lat;
      const lon = sz.location.lon;
      const pt = turfPoint([lon, lat]); // GeoJSON is [lon, lat]
      let matchedKey: string | null = null;
      let matchedProps: DistrictFeature['properties'] | null = null;
      // First pass: try the district key implied by the city/state hint.
      // City-name → district-name aliases (Bengaluru→Bangalore Urban,
      // Mumbai→Greater Bombay, Gurugram→Gurgaon, ...) let us hit the
      // hint cache for colloquial spellings without a full scan.
      // Falls back to scanning every polygon if no alias matches —
      // point-in-polygon is then authoritative.
      const canonicalCity = canonicalDistrictName(sz.location.city);
      const hintKey = `${canonicalCity}|${sz.location.state}`;
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
        unmatched++;
        continue;
      }
      let agg = aggregates[matchedKey];
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
        aggregates[matchedKey] = agg;
      }
      agg.count += 1;
      agg.totalKg += sz.quantityKg ?? 0;
      const drug = sz.drugType ?? 'other';
      agg.drugs[drug] = (agg.drugs[drug] ?? 0) + (sz.quantityKg ?? 0);
      // Keep the actual list of seizures so DistrictPanel can render
      // date/drug/kg/event/agency for every incident in this district.
      agg.seizures!.push(sz);
    }
    if (unmatched > 0) {
      console.warn(`[App] ${unmatched} rave seizures did not fall inside any district polygon`);
    }
    setByDistrictRave(aggregates);
  }, [raveSeizures, raveDistrictIndex]);

  // Stable callbacks + props so memoized children (panels, markers) skip work
  // when their inputs haven't actually changed.
  const handleSeizureClick = useCallback((seizure: Seizure) => {
    setSelectedSeizure(seizure);
  }, []);

  const handleDistrictClick = useCallback(
    (aggregate: DistrictAggregate | null, _feature: DistrictFeature) => {
      // Null aggregate = user clicked an unmatched (no-data) district.
      // We just dismiss any open panel; nothing to show.
      setSelectedDistrict(aggregate);
    },
    []
  );

  const closeDistrictPanel = useCallback(() => setSelectedDistrict(null), []);

  const closePanel = useCallback(() => setActiveTab('radar'), []);

  const panelProps = useMemo(
    () => ({ seizures, stats, onClose: closePanel }),
    [seizures, stats, closePanel]
  );

  const tickerItems = useMemo(() => TICKER_ITEMS_DOUBLED, []);

  const panelComponent = useMemo(() => {
    switch (activeTab) {
      case 'intel':    return <IntelPanel {...panelProps} />;
      case 'network':  return <NetworkPanel {...panelProps} />;
      case 'trending': return <TrendingPanel {...panelProps} />;
      case 'agency':   return <AgencyPanel {...panelProps} />;
      case 'compare':  return <ComparePanel {...panelProps} />;
      case 'terminal': return <TerminalPanel seizures={seizures} />;
      case 'rave':     return <RavePanel onClose={closePanel} />;
      default:         return null;
    }
  }, [activeTab, panelProps, seizures, closePanel]);

  const totalSeizures = seizures.length;
  const totalKg = seizures.reduce((s, sz) => s + (sz.quantityKg || 0), 0);
  const topState = stats?.byState
    ? Object.entries(stats.byState).sort((a, b) => b[1] - a[1])[0]?.[0]
    : '—';

  return (
    <div
      className={styles.shell}
      data-mode={activeTab === 'rave' ? 'rave' : undefined}
    >

      {/* ── Loading ─────────────────────────────────── */}
      {seizures.length === 0 && <LoadingScreen />}

      {/* ── Map Layer ───────────────────────────────── */}
      <div className={styles.mapLayer}>
        <IndiaMap
          seizures={seizures}
          raveSeizures={raveSeizures}
          onSeizureSelect={handleSeizureClick}
          byDistrict={byDistrict}
          byDistrictRave={byDistrictRave}
          onDistrictClick={handleDistrictClick}
        />
      </div>

      {/* ── Classified Watermark / Kaleidoscope badge ───── */}
      <div className={styles.classifiedWatermark} aria-hidden="true">
        <div className={styles.classifiedStamp}>CLASSIFIED</div>
      </div>
      <div className={styles.raveBadge} aria-hidden="true">
        <div className={styles.raveBadgeRing} />
        <div className={styles.raveBadgeRing} />
        <div className={styles.raveBadgeCore} />
      </div>

      {/* ── Top HUD Bar ──────────────────────────────── */}
      <header className={styles.hudTop} role="banner">
        <div className={styles.hudLogo}>
          <div className={styles.hudLogoMark} aria-hidden="true">NK</div>
          <div className={styles.hudLogoText}>
            <span className={styles.hudLogoName}>NARC KART</span>
            <span className={styles.hudLogoSub}>OPS CENTER</span>
          </div>
        </div>

        <div className={styles.hudStats} aria-label="Key statistics">
          <div className={styles.hudStat}>
            <span className={styles.hudStatValue}>{totalSeizures.toLocaleString()}</span>
            <span className={styles.hudStatLabel}>SEIZURES</span>
          </div>
          <div className={styles.hudStat}>
            <span className={styles.hudStatValue}>
              {totalKg >= 1000 ? `${(totalKg / 1000).toFixed(1)}T` : `${Math.round(totalKg)}KG`}
            </span>
            <span className={styles.hudStatLabel}>VOLUME</span>
          </div>
          <div className={`${styles.hudStat} ${styles['hudStat--accent']}`}>
            <span className={styles.hudStatValue}>{topState}</span>
            <span className={styles.hudStatLabel}>TOP STATE</span>
          </div>
        </div>

        <div className={styles.hudRight}>
          <Clock />
          <div className={styles.hudStatus} role="status" aria-label="System status">
            <div className={styles.hudStatusDot} aria-hidden="true" />
            <span className={styles.hudStatusText}>ONLINE</span>
          </div>
        </div>
      </header>

      {/* ── Left Icon Rail ───────────────────────────── */}
      <nav className={styles.iconRail} role="navigation" aria-label="Main navigation">
        {([
          { id: 'radar',    icon: '◉', label: 'RADAR' },
          { id: 'intel',    icon: '◈', label: 'INTEL' },
          { id: 'network',  icon: '⬡', label: 'NETWORK' },
          { id: 'trending', icon: '▲', label: 'TRENDING' },
          { id: 'agency',   icon: '◎', label: 'AGENCY' },
          { id: 'compare',  icon: '⊞', label: 'COMPARE' },
          { id: 'rave',     icon: '✺', label: 'FESTIVAL' },
          { id: 'terminal', icon: '▣', label: 'TERMINAL' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            className={`${styles.railBtn} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id as Tab)}
            aria-pressed={activeTab === tab.id}
            aria-label={tab.label}
          >
            {tab.icon}
            <span className={styles.railTooltip}>{tab.label}</span>
          </button>
        ))}

        {/* Filter button at bottom of rail */}
        <div style={{ flex: 1 }} />
        <button
          className={`${styles.railBtn} ${showFilters ? styles.active : ''}`}
          onClick={() => setShowFilters(f => !f)}
          aria-pressed={showFilters}
          aria-label="Filters"
          style={{ fontSize: 14 }}
        >
          ⚙
          <span className={styles.railTooltip}>FILTERS</span>
        </button>
      </nav>

      {/* ── Main Viewport ────────────────────────────── */}
      <main className={styles.mainViewport} role="main">
        {activeTab !== 'radar' && (
          <aside className={styles.viewportPanel} role="complementary" aria-label="Panel">
            {panelComponent}
          </aside>
        )}
      </main>

      {/* ── Bottom Ticker ───────────────────────────── */}
      <div className={styles.ticker} role="marquee" aria-label="Live seizure feed" aria-live="off">
        <div className={styles.tickerLabel}>
          <div className={styles.tickerLabelDot} aria-hidden="true" />
          <span className={styles.tickerLabelText}>LIVE</span>
        </div>
        <div className={styles.tickerTrack} aria-hidden="true">
          <div className={styles.tickerScroll}>
            {tickerItems.map((item, i) => (
              <TickerItem key={`${i}-${item.city}`} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter Panel ─────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <FilterPanel
            isOpen={showFilters}
            filters={filters}
            onApply={applyFilters}
            onReset={resetFilters}
            onClose={() => setShowFilters(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Seizure Modal ────────────────────────────── */}
      {selectedSeizure && (
        <SeizureModal
          seizure={selectedSeizure}
          onClose={() => setSelectedSeizure(null)}
        />
      )}

      {/* ── District Panel (slide-in detail view) ────────── */}
      <DistrictPanel
        aggregate={selectedDistrict}
        onClose={closeDistrictPanel}
        unmatchedCount={unmatchedCount}
      />

      {/* ── Offline Badge ────────────────────────────── */}
      {isOffline && <OfflineBadge lastUpdate={lastUpdate} />}
    </div>
  );
}

export default App;
