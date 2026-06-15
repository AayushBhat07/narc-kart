/* Hallmark · genre: tactical · panel: intel */
import { ApiStats, Seizure } from '../types';
import styles from './IntelPanel.module.css';

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

export function IntelPanel({ seizures, stats, onClose }: Props) {
  const total = seizures.length;
  const totalKg = seizures.reduce((s, sz) => s + (sz.quantityKg || 0), 0);
  const criticalCount = seizures.filter(s => (s.quantityKg || 0) > 100).length;
  const states = stats?.byState ? Object.keys(stats.byState).length : 0;

  // Drug type breakdown
  const drugMap: Record<string, number> = {};
  seizures.forEach(s => {
    const t = (s.drugType || 'Unknown').toUpperCase();
    drugMap[t] = (drugMap[t] || 0) + (s.quantityKg || 0);
  });
  const drugEntries = Object.entries(drugMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxDrug = drugEntries[0]?.[1] || 1;

  // Top locations
  const locMap: Record<string, number> = {};
  seizures.forEach(s => {
    const loc = s.location?.state || 'Unknown';
    locMap[loc] = (locMap[loc] || 0) + 1;
  });
  const locEntries = Object.entries(locMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className={styles.panel} role="region" aria-label="Intelligence panel">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>INTEL BRIEFING</h2>
        <button className={styles.panelClose} onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      <div className={styles.panelBody}>

        {/* Key Stats */}
        <div className={styles.statRow}>
          <div className={styles.statCell}>
            <span className={styles.statCellValue}>{total.toLocaleString()}</span>
            <span className={styles.statCellLabel}>Seizures</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statCellValue}>
              {totalKg >= 1000 ? `${(totalKg/1000).toFixed(1)}T` : `${Math.round(totalKg)}K`}
            </span>
            <span className={styles.statCellLabel}>Volume</span>
          </div>
          <div className={styles.statCell}>
            <span className={`${styles.statCellValue} ${styles['statCellValue--accent']}`}>{criticalCount}</span>
            <span className={styles.statCellLabel}>Critical</span>
          </div>
        </div>

        {/* Drug Type Breakdown */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>BY DRUG TYPE</div>
          <div className={styles.drugBars}>
            {drugEntries.map(([drug, qty]) => {
              const pct = Math.round((qty / maxDrug) * 100);
              const cls = drug.includes('METH') ? styles['drugBarFill--meth']
                : drug.includes('CANNABIS') || drug.includes('Ganja') ? styles['drugBarFill--cannabis']
                : drug.includes('COCA') ? styles['drugBarFill--cocaine']
                : '';
              return (
                <div key={drug} className={styles.drugRow}>
                  <div className={styles.drugLabel}>
                    <span className={styles.drugName}>{drug}</span>
                    <span className={styles.drugPct}>{pct}%</span>
                  </div>
                  <div className={styles.drugBarTrack}>
                    <div
                      className={`${styles.drugBarFill} ${cls}`}
                      style={{ width: `${pct}%` }}
                      role="meter"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${drug}: ${pct}%`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top States */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>TOP STATES ({states} TOTAL)</div>
          <div className={styles.locList}>
            {locEntries.map(([loc, count], idx) => (
              <div key={loc} className={styles.locRow}>
                <span className={styles.locName}>{idx + 1}. {loc}</span>
                <span className={`${styles.locCount} ${idx === 0 ? styles['locCount--top'] : ''}`}>
                  {count} REC
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
