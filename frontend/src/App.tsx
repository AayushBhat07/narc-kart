import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Sidebar } from './components/Sidebar';
import { IndiaMap } from './components/IndiaMap';
import { LiveFeed } from './components/LiveFeed';
import { FilterPanel } from './components/FilterPanel';
import { SeizureModal } from './components/SeizureModal';
import { LoadingScreen } from './components/LoadingScreen';
import { StatBoxes } from './components/StatBoxes';
import { IntelPanel } from './components/IntelPanel';
import { NetworkPanel } from './components/NetworkPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { OfflineBadge } from './components/OfflineBadge';
import { useApi } from './hooks/useApi';
import { Seizure } from './types';
import 'leaflet/dist/leaflet.css';
import './styles/global.css';
import styles from './App.module.css';

type SidebarTab = 'radar' | 'intel' | 'network' | 'terminal';

export function App() {
  const { seizures, stats, filters, applyFilters, resetFilters, refresh, isOffline, lastUpdate } = useApi();
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('radar');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedSeizure, setSelectedSeizure] = useState<Seizure | null>(null);
  const [isLoadingApp, setIsLoadingApp] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoadingApp(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleSeizureSelect = (seizure: Seizure) => {
    setSelectedSeizure(seizure);
  };

  if (isLoadingApp) {
    return <LoadingScreen />;
  }

  return (
    <div className={styles.app}>
      <div className={styles.classifiedWatermark}>CLASSIFIED</div>

      <Header onRefresh={refresh} onFilterToggle={() => setFilterOpen(true)} />

      {isOffline && <OfflineBadge lastUpdate={lastUpdate} />}

      <div className={styles.main}>
        <Sidebar
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          onFilterToggle={() => setFilterOpen(true)}
        />

        <div className={styles.center}>
          <StatBoxes stats={stats} recentCount={seizures.length} />

          {sidebarTab === 'radar' && (
            <div className={styles.mapContainer}>
              <IndiaMap seizures={seizures} onSeizureSelect={handleSeizureSelect} />
            </div>
          )}
          {sidebarTab === 'intel' && <IntelPanel />}
          {sidebarTab === 'network' && <NetworkPanel />}
          {sidebarTab === 'terminal' && <TerminalPanel />}

          <div className={styles.cmdInput}>
            <span className={styles.cmdPrompt}>NARC@{sidebarTab.toUpperCase()}&gt;</span>
            <span className={styles.cursor}>_</span>
            <input
              type="text"
              placeholder="Enter command..."
              className={styles.cmdField}
            />
          </div>
        </div>

        <div className={styles.rightPanel}>
          <LiveFeed seizures={seizures} />
        </div>
      </div>

      <Footer />

      <FilterPanel
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      <SeizureModal
        seizure={selectedSeizure}
        onClose={() => setSelectedSeizure(null)}
      />
    </div>
  );
}