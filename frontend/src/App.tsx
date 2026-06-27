/* Hallmark · genre: tactical ops-center · macrostructure: war-room · design-system: DESIGN.md */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { IndiaMap } from './components/IndiaMap';
import { FilterPanel } from './components/FilterPanel';
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
import {
  aggregateSeizuresByDistrict,
  type DistrictPolygonIndex,
} from './lib/districtAggregates';
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

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('radar');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictAggregate | null>(null);

  const { seizures, stats, filters, applyFilters, resetFilters, isOffline, lastUpdate } = useApi();
  const { data: raveData } = useRaveData();

  // District choropleth data — built reactively from the live
  // `seizures` array (NCB/UNODC) and the GADM polygon index. Both
  // the main (radar) and rave views share the same polygon index
  // and the same hint-key / full-scan aggregation logic, so the
  // actual work lives in `lib/districtAggregates.ts` and we just
  // project the two seizure streams onto it.
  //
  // We keep the top-level unmatchedCount so the DistrictPanel footer
  // can be honest about how many source records didn't geocode.
  const [districtIndex, setDistrictIndex] = useState<DistrictPolygonIndex | null>(null);
  const [byDistrict, setByDistrict] = useState<Record<string, DistrictAggregate> | null>(null);
  const [byDistrictRave, setByDistrictRave] = useState<Record<string, DistrictAggregate> | null>(null);
  const [unmatchedCount, setUnmatchedCount] = useState(0);

  // Load the GADM district polygons once and build the
  // (NAME_2, NAME_1) → Feature[] index. The 4.5MB GeoJSON is cached
  // by the browser after the first fetch, so this only really hits
  // the network on first load. While this is loading, `byDistrict`
  // and `byDistrictRave` stay null and the DistrictLayer renders an
  // empty choropleth rather than throwing on a missing key.
  useEffect(() => {
    let cancelled = false;
    fetch('/india-districts.geojson')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DistrictFeatureCollection>;
      })
      .then((json) => {
        if (cancelled) return;
        // Build the (NAME_2, NAME_1) → Feature[] index once. If
        // multiple polygons share a key (rare in GADM but possible
        // for districts split across islands) they're treated as
        // one district.
        const polysByKey: DistrictPolygonIndex = {};
        for (const f of json.features) {
          const props = f.properties ?? ({} as DistrictFeature['properties']);
          const key = `${props.NAME_2 ?? ''}|${props.NAME_1 ?? ''}`;
          (polysByKey[key] ||= []).push(f);
        }
        setDistrictIndex(polysByKey);
      })
      .catch((err) => console.error('[App] District GeoJSON load failed:', err));
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

  // Main (radar) choropleth — rebuilt reactively from the live
  // `seizures` array whenever the polygon index is ready or the
  // dataset changes. The seizures list is small (a few hundred
  // records), so recomputing on every change is cheap. Gated on
  // BOTH inputs being ready: if the polygons haven't loaded yet, or
  // `seizures` is empty, we set `byDistrict = {}` so the DistrictLayer
  // renders an empty choropleth rather than throwing on a null prop.
  useEffect(() => {
    if (!districtIndex) {
      console.log('[App] aggregation skipped: districtIndex not ready');
      setByDistrict(null);
      return;
    }
    if (seizures.length === 0) {
      console.log('[App] aggregation skipped: seizures empty');
      setByDistrict({});
      setUnmatchedCount(0);
      return;
    }
    console.log('[App] Running aggregation:', seizures.length, 'seizures,', Object.keys(districtIndex).length, 'districts');
    const { byDistrict: aggregates, unmatchedCount: unmatched } =
      aggregateSeizuresByDistrict(seizures, districtIndex);
    console.log('[App] Aggregation result:', Object.keys(aggregates).length, 'districts matched,', unmatched, 'unmatched');
    if (unmatched > 0) {
      console.warn(`[App] ${unmatched} main seizures did not fall inside any district polygon`);
    }
    setByDistrict(aggregates);
    setUnmatchedCount(unmatched);
  }, [seizures, districtIndex]);

  // Rave (festival) choropleth — same shared helper, different input
  // stream. The aggregate key shape is identical to the main view,
  // so DistrictPanel can render the per-seizure list for either
  // source without a separate code path.
  useEffect(() => {
    if (!districtIndex) {
      setByDistrictRave(null);
      return;
    }
    if (raveSeizures.length === 0) {
      setByDistrictRave({});
      return;
    }
    const { byDistrict: aggregates, unmatchedCount: unmatched } =
      aggregateSeizuresByDistrict(raveSeizures, districtIndex);
    if (unmatched > 0) {
      console.warn(`[App] ${unmatched} rave seizures did not fall inside any district polygon`);
    }
    setByDistrictRave(aggregates);
  }, [raveSeizures, districtIndex]);

  // Track which mode the open district came from so DistrictPanel can
  // pick the right footer copy ("NCB/UNODC reports" for the main radar
  // view, "festival/event incidents" for the festival/rave view).
  // Active tab determines the mode — the user is looking at one
  // choropleth at a time, and the same district can have different
  // aggregates in the two views.
  const districtPanelMode: 'main' | 'rave' = activeTab === 'rave' ? 'rave' : 'main';

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

      {/* ── District Panel (slide-in detail view) ────────── */}
      <DistrictPanel
        aggregate={selectedDistrict}
        onClose={closeDistrictPanel}
        unmatchedCount={unmatchedCount}
        mode={districtPanelMode}
      />

      {/* ── Offline Badge ────────────────────────────── */}
      {isOffline && <OfflineBadge lastUpdate={lastUpdate} />}
    </div>
  );
}

export default App;
