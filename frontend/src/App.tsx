/* Hallmark · genre: tactical ops-center · macrostructure: war-room · design-system: DESIGN.md */
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Sidebar } from './components/Sidebar';
import { IndiaMap } from './components/IndiaMap';
import { FilterPanel } from './components/FilterPanel';
import { SeizureModal } from './components/SeizureModal';
import { LoadingScreen } from './components/LoadingScreen';
import { StatBoxes } from './components/StatBoxes';
import { IntelPanel } from './components/IntelPanel';
import { NetworkPanel } from './components/NetworkPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { TrendingPanel } from './components/TrendingPanel';
import { AgencyPanel } from './components/AgencyPanel';
import { ComparePanel } from './components/ComparePanel';
import { OfflineBadge } from './components/OfflineBadge';
import { useApi } from './hooks/useApi';
import { Seizure } from './types';
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import styles from './App.module.css';

type Tab = 'radar' | 'intel' | 'network' | 'terminal' | 'trending' | 'agency' | 'compare';

const TICKER_ITEMS = [
  { sev: 'CRIT', city: 'MUMBAI', drug: 'HEROIN', kg: '340KG' },
  { sev: 'HIGH', city: 'DELHI', drug: 'METH', kg: '89KG' },
  { sev: 'LOW', city: 'PUNE', drug: 'CANNABIS', kg: '12KG' },
  { sev: 'CRIT', city: 'SRINAGAR', drug: 'HEROIN', kg: '210KG' },
  { sev: 'HIGH', city: 'AHMEDABAD', drug: 'METH', kg: '45KG' },
  { sev: 'LOW', city: 'KOLKATA', drug: 'COCaine', kg: '8KG' },
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

function TickerItem({ item }: { item: typeof TICKER_ITEMS[0] }) {
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

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('radar');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSeizure, setSelectedSeizure] = useState<Seizure | null>(null);
  const [clock, setClock] = useState('');

  const { seizures, stats, filters, applyFilters, resetFilters, isOffline, lastUpdate } = useApi();

  useEffect(() => {
    const update = () => {
      setClock(new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: 'Asia/Kolkata',
      }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const handleSeizureClick = (seizure: Seizure) => {
    setSelectedSeizure(seizure);
  };

  const panelComponent = () => {
    const panelProps = { seizures, stats, onClose: () => setActiveTab('radar') };
    switch (activeTab) {
      case 'intel':    return <IntelPanel {...panelProps} />;
      case 'network':  return <NetworkPanel {...panelProps} />;
      case 'trending': return <TrendingPanel {...panelProps} />;
      case 'agency':   return <AgencyPanel {...panelProps} />;
      case 'compare':  return <ComparePanel {...panelProps} />;
      case 'terminal': return <TerminalPanel seizures={seizures} />;
      default:         return null;
    }
  };

  const totalSeizures = seizures.length;
  const totalKg = seizures.reduce((s, sz) => s + (sz.quantityKg || 0), 0);
  const topState = stats?.byState
    ? Object.entries(stats.byState).sort((a, b) => b[1] - a[1])[0]?.[0]
    : '—';

  return (
    <div className={styles.shell}>

      {/* ── Loading ─────────────────────────────────── */}
      {seizures.length === 0 && <LoadingScreen />}

      {/* ── Map Layer ───────────────────────────────── */}
      <div className={styles.mapLayer}>
        <IndiaMap
          seizures={seizures}
          onSeizureClick={handleSeizureClick}
        />
      </div>

      {/* ── Classified Watermark ─────────────────────── */}
      <div className={styles.classifiedWatermark} aria-hidden="true">
        <div className={styles.classifiedStamp}>CLASSIFIED</div>
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
          <time className={styles.hudClock} dateTime={new Date().toISOString()}>
            {clock} IST
          </time>
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
            {panelComponent()}
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
            {/* Duplicate for seamless loop */}
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
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

      {/* ── Offline Badge ────────────────────────────── */}
      {isOffline && <OfflineBadge lastUpdate={lastUpdate} />}
    </div>
  );
}

export default App;
