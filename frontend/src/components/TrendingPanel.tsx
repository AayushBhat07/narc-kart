/* Hallmark · genre: tactical · panel: trending */
import { ApiStats, Seizure } from '../types';
import styles from './TrendingPanel.module.css';

interface Props {
  seizures: Seizure[];
  stats: ApiStats | null;
  onClose: () => void;
}

function getSeverity(kg: number) {
  if (kg > 100) return 'critical';
  if (kg > 10) return 'high';
  return 'low';
}

function getSeverityClass(kg: number) {
  if (kg > 100) return styles['sev--critical'];
  if (kg > 10) return styles['sev--high'];
  return styles['sev--low'];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return '—'; }
}

export function TrendingPanel({ seizures, onClose }: Props) {
  // By volume — top 10
  const byVolume = [...seizures]
    .sort((a, b) => (b.quantityKg || 0) - (a.quantityKg || 0))
    .slice(0, 10);

  // By date — most recent 10
  const byDate = [...seizures]
    .filter(s => s.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  const avgKg = seizures.length
    ? (seizures.reduce((s, sz) => s + (sz.quantityKg || 0), 0) / seizures.length).toFixed(1)
    : '0';

  return (
    <div className={styles.panel} role="region" aria-label="Trending panel">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>TRENDING ANALYSIS</h2>
        <button className={styles.panelClose} onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      <div className={styles.panelBody}>

        {/* Top volume seizures */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>HIGHEST VOLUME</div>
          <div className={styles.rankList} role="list" aria-label="Highest volume seizures">
            {byVolume.map((sz, idx) => (
              <div key={sz.id || idx} className={styles.rankItem} role="listitem">
                <span className={`${styles.rankNum} ${idx === 0 ? styles['rankNum--1'] : idx === 1 ? styles['rankNum--2'] : idx === 2 ? styles['rankNum--3'] : ''}`}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className={styles.rankContent}>
                  <span className={styles.rankLoc}>{sz.location?.city}, {sz.location?.state}</span>
                  <div className={styles.rankMeta}>
                    <span className={styles.rankDrug}>{sz.drugType}</span>
                    <span className={styles.rankDate}>{formatDate(sz.date)}</span>
                  </div>
                </div>
                <span className={`${styles.rankSeverity} ${getSeverityClass(sz.quantityKg || 0)}`}>
                  {getSeverity(sz.quantityKg || 0).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent seizures */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>MOST RECENT</div>
          <div className={styles.rankList} role="list" aria-label="Most recent seizures">
            {byDate.map((sz, idx) => (
              <div key={sz.id || idx} className={styles.rankItem} role="listitem">
                <span className={`${styles.rankNum} ${idx === 0 ? styles['rankNum--1'] : idx === 1 ? styles['rankNum--2'] : idx === 2 ? styles['rankNum--3'] : ''}`}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className={styles.rankContent}>
                  <span className={styles.rankLoc}>{sz.location?.city}, {sz.location?.state}</span>
                  <div className={styles.rankMeta}>
                    <span className={styles.rankDrug}>{sz.drugType}</span>
                    <span className={styles.rankDate}>{formatDate(sz.date)}</span>
                  </div>
                </div>
                <span className={`${styles.rankSeverity} ${getSeverityClass(sz.quantityKg || 0)}`}>
                  {sz.quantityKg?.toFixed(1)}KG
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stats */}
        <div className={styles.bottomStats}>
          <div className={styles.bottomStat}>
            <span className={styles.bottomStatValue}>{avgKg}KG</span>
            <span className={styles.bottomStatLabel}>AVG VOLUME</span>
          </div>
          <div className={styles.bottomStat}>
            <span className={styles.bottomStatValue}>{byVolume[0]?.quantityKg?.toFixed(0) || 0}KG</span>
            <span className={styles.bottomStatLabel}>PEAK SZ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
