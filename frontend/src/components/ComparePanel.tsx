/* Hallmark · genre: tactical · panel: compare */
import { ApiStats, Seizure } from '../types';
import styles from './NetworkPanel.module.css';

interface Props {
  seizures: Seizure[];
  stats: ApiStats | null;
  onClose: () => void;
}

export function ComparePanel({ seizures, stats, onClose }: Props) {
  // State comparison
  const stateMap: Record<string, number> = {};
  seizures.forEach(s => { const st = s.location?.state || 'Unknown'; stateMap[st] = (stateMap[st] || 0) + (s.quantityKg || 0); });
  const stateEntries = Object.entries(stateMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxKg = stateEntries[0]?.[1] || 1;

  // Drug type grid
  const drugMap: Record<string, number> = {};
  seizures.forEach(s => { const t = s.drugType || 'Unknown'; drugMap[t] = (drugMap[t] || 0) + 1; });
  const drugEntries = Object.entries(drugMap).sort((a, b) => b[1] - a[1]);
  const maxDrug = drugEntries[0]?.[1] || 1;

  return (
    <div className={styles.panel} role="region" aria-label="Compare panel">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>COMPARATIVE VIEW</h2>
        <button className={styles.panelClose} onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      <div className={styles.panelBody}>

        <div className={styles.chartSection}>
          <div className={styles.sectionTitle}>STATES BY VOLUME (KG)</div>
          {stateEntries.map(([state, kg], idx) => (
            <div key={state} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: idx === 0 ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {state}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {kg >= 1000 ? `${(kg/1000).toFixed(1)}T` : `${Math.round(kg)}KG`}
                </span>
              </div>
              <div style={{ width: '100%', height: '3px', background: 'var(--border-dim)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '2px',
                  background: idx === 0 ? 'var(--accent)' : 'var(--border-mid)',
                  width: `${Math.round((kg / maxKg) * 100)}%`,
                  transition: 'width 380ms cubic-bezier(0.16,1,0.3,1)',
                }} />
              </div>
            </div>
          ))}
        </div>

        <div className={styles.chartSection}>
          <div className={styles.sectionTitle}>DRUG TYPES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            {drugEntries.slice(0, 6).map(([drug, count]) => (
              <div key={drug} style={{
                background: 'var(--bg-void)', border: '1px solid var(--border-ghost)',
                borderRadius: 'var(--r-sm)', padding: '8px',
                display: 'flex', flexDirection: 'column', gap: '4px',
              }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {drug}
                </span>
                <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {count}
                </span>
                <div style={{ width: '100%', height: '2px', background: 'var(--border-dim)', borderRadius: '1px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '1px', background: 'var(--accent)', width: `${Math.round((count / maxDrug) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
