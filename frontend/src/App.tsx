/* Hallmark · genre: tactical ops-center · macrostructure: war-room · design-system: DESIGN.md */
import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FilterPanel } from './components/FilterPanel';

import { IntelPanel } from './components/IntelPanel';
import { NetworkPanel } from './components/NetworkPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { TrendingPanel } from './components/TrendingPanel';
import { AgencyPanel } from './components/AgencyPanel';
import { ComparePanel } from './components/ComparePanel';
import { SeizurePopup } from './components/SeizurePopup';
import { OfflineBadge } from './components/OfflineBadge';
import { Clock } from './components/Clock';
import { RavePanel } from './components/RavePanel';
import { useApi } from './hooks/useApi';
import { useRaveData } from './hooks/useRaveData';
import { Seizure } from './types';
import './styles/global.css';
import styles from './App.module.css';

// three.js is heavy; keep it out of the first chunk.
const SeizureGlobe = lazy(() => import('./components/SeizureGlobe'));

type Tab = 'radar' | 'intel' | 'network' | 'terminal' | 'trending' | 'agency' | 'compare' | 'rave';

function getSeverityClass(kg: number) {
  if (kg > 100) return styles['sev--critical'];
  if (kg > 10) return styles['sev--high'];
  return styles['sev--low'];
}

function severityLabel(kg: number) {
  if (kg > 100) return 'CRIT';
  if (kg > 10) return 'HIGH';
  return 'LOW';
}

function formatKg(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}T` : `${Math.round(kg * 10) / 10}KG`;
}

function TickerItem({ seizure, onSelect }: { seizure: Seizure; onSelect: (s: Seizure) => void }) {
  const kg = seizure.quantityKg || 0;
  return (
    <button type="button" className={styles.tickerItem} onClick={() => onSelect(seizure)} tabIndex={-1}>
      <span className={`${styles.sev} ${getSeverityClass(kg)}`}>{severityLabel(kg)}</span>
      <span className={styles.loc}>{seizure.location.city.toUpperCase()}</span>
      <span className={styles.drug}>{seizure.drugType.toUpperCase()}</span>
      <span className={styles.sep}>·</span>
      <span>{formatKg(kg)}</span>
    </button>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('radar');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSeizure, setSelectedSeizure] = useState<Seizure | null>(null);

  const { seizures, stats, filters, applyFilters, resetFilters, isOffline, lastUpdate, error, loading } = useApi();
  const { data: raveData } = useRaveData();

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

  const isRave = activeTab === 'rave';
  const globeSeizures = isRave ? raveSeizures : seizures;

  // Drop the selection when it's no longer on the globe (filters / tab switch).
  useEffect(() => {
    if (selectedSeizure && !globeSeizures.some((s) => s.id === selectedSeizure.id)) {
      setSelectedSeizure(null);
    }
  }, [globeSeizures, selectedSeizure]);

  const closeCaseFile = useCallback(() => setSelectedSeizure(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedSeizure(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const closePanel = useCallback(() => setActiveTab('radar'), []);

  const panelProps = useMemo(
    () => ({ seizures, stats, onClose: closePanel }),
    [seizures, stats, closePanel]
  );

  // Latest seizures, doubled for the seamless marquee loop.
  const tickerItems = useMemo(() => {
    const latest = [...seizures].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    return [...latest, ...latest];
  }, [seizures]);

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
      data-mode={isRave ? 'rave' : undefined}
      data-panel-open={activeTab !== 'radar' ? '' : undefined}
    >

      {/* ── Loading ─────────────────────────────────── */}
      {loading && seizures.length === 0 && !error && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'var(--bg-primary)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '16px'
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px',
            letterSpacing: '0.2em', color: 'var(--accent)',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>
            LOADING INTELLIGENCE FEED...
          </div>
        </div>
      )}

      {/* ── Globe Layer ─────────────────────────────── */}
      <div className={styles.mapLayer}>
        <Suspense fallback={null}>
          <SeizureGlobe
            seizures={globeSeizures}
            selected={selectedSeizure}
            onSelect={setSelectedSeizure}
            mode={isRave ? 'rave' : 'main'}
          />
        </Suspense>
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
            {tickerItems.map((s, i) => (
              <TickerItem key={`${i}-${s.id}`} seizure={s} onSelect={setSelectedSeizure} />
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

      {/* ── Case File (selected seizure) ─────────────── */}
      <AnimatePresence>
        {selectedSeizure && (
          <motion.aside
            key="case-file"
            className={styles.caseFile}
            role="dialog"
            aria-label="Seizure case file"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22 }}
          >
            <SeizurePopup seizure={selectedSeizure} onClose={closeCaseFile} />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Offline Badge ────────────────────────────── */}
      {isOffline && <OfflineBadge lastUpdate={lastUpdate} />}
    </div>
  );
}

export default App;
