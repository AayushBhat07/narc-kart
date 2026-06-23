/* Hallmark · genre: tactical · panel: agency */
import { ApiStats, Seizure } from '../types';
import styles from './NetworkPanel.module.css';

interface Props {
  seizures: Seizure[];
  stats: ApiStats | null;
  onClose: () => void;
}

export function AgencyPanel({ seizures, onClose }: Props) {
  const agencyMap: Record<string, { count: number; kg: number; states: Set<string> }> = {};
  seizures.forEach(s => {
    const agency = s.agency || 'NCB / Unknown';
    if (!agencyMap[agency]) agencyMap[agency] = { count: 0, kg: 0, states: new Set() };
    agencyMap[agency].count += 1;
    agencyMap[agency].kg += s.quantityKg || 0;
    if (s.location?.state) agencyMap[agency].states.add(s.location.state);
  });

  const entries = Object.entries(agencyMap)
    .map(([name, d]) => ({ name, count: d.count, kg: d.kg, states: d.states.size }))
    .sort((a, b) => b.kg - a.kg);

  const maxKg = entries[0]?.kg || 1;
  const totalAgencies = entries.length;

  return (
    <div className={styles.panel} role="region" aria-label="Agency panel">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>AGENCY ROSTER</h2>
        <button className={styles.panelClose} onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={`${styles.summaryCardValue} ${styles['summaryCardValue--accent']}`}>{totalAgencies}</span>
            <span className={styles.summaryCardLabel}>Agencies</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardValue}>{entries[0]?.name.split(' ')[0] || '—'}</span>
            <span className={styles.summaryCardLabel}>Top By KG</span>
          </div>
        </div>

        <div className={styles.chartSection}>
          <div className={styles.sectionTitle}>BY SEIZURE VOLUME (KG)</div>
          {entries.slice(0, 15).map(({ name, count, kg, states }, idx) => (
            <div key={name} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {name}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {count} REC · {kg >= 1000 ? `${(kg/1000).toFixed(1)}T` : `${Math.round(kg)}KG`} · {states} ST
                </span>
              </div>
              <div style={{ width: '100%', height: '3px', background: 'var(--border-dim)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '2px',
                  background: idx === 0 ? 'var(--accent)' : idx < 3 ? 'var(--sev-high)' : 'var(--border-mid)',
                  width: `${Math.round((kg / maxKg) * 100)}%`,
                  transition: 'width 380ms cubic-bezier(0.16,1,0.3,1)',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
