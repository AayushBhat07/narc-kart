/* Hallmark · genre: tactical · panel: network */
import { ApiStats, Seizure } from '../types';
import styles from './NetworkPanel.module.css';

interface Props {
  seizures: Seizure[];
  stats: ApiStats | null;
  onClose: () => void;
}

export function NetworkPanel({ seizures, onClose }: Props) {
  // Agency rollup
  const agencyMap: Record<string, number> = {};
  seizures.forEach(s => {
    const agency = s.agency || 'Unknown';
    agencyMap[agency] = (agencyMap[agency] || 0) + 1;
  });
  const agencyEntries = Object.entries(agencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const maxAgency = agencyEntries[0]?.[1] || 1;

  // State rollup
  const stateMap: Record<string, number> = {};
  seizures.forEach(s => {
    const state = s.location?.state || 'Unknown';
    stateMap[state] = (stateMap[state] || 0) + 1;
  });
  const stateEntries = Object.entries(stateMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxState = stateEntries[0]?.[1] || 1;

  const uniqueAgencies = agencyEntries.length;
  // Computed for future use; suppress unused-var until rendered.
  const topAgency = agencyEntries[0]?.[0] || '—';
  void topAgency;

  return (
    <div className={styles.panel} role="region" aria-label="Network panel">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>NETWORK MAP</h2>
        <button className={styles.panelClose} onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      <div className={styles.panelBody}>

        {/* Summary */}
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={`${styles.summaryCardValue} ${styles['summaryCardValue--accent']}`}>{uniqueAgencies}</span>
            <span className={styles.summaryCardLabel}>Agencies</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardValue}>{stateEntries.length}</span>
            <span className={styles.summaryCardLabel}>States</span>
          </div>
        </div>

        {/* State breakdown */}
        <div className={styles.chartSection}>
          <div className={styles.sectionTitle}>BY STATE</div>
          {stateEntries.map(([state, count], idx) => (
            <div key={state} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
              <span style={{
                fontSize: '9px', fontWeight: '700', color: idx === 0 ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', width: '18px', textAlign: 'right', flexShrink: 0,
              }}>
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span style={{
                flex: 1, fontSize: '11px', color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {state}
              </span>
              <div style={{ width: '60px', height: '2px', background: 'var(--border-dim)', borderRadius: '1px', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{
                  height: '100%', borderRadius: '1px',
                  background: idx === 0 ? 'var(--accent)' : idx === 1 ? 'var(--sev-high)' : 'var(--border-mid)',
                  width: `${Math.round((count / maxState) * 100)}%`,
                  transition: 'width 380ms cubic-bezier(0.16,1,0.3,1)',
                }} />
              </div>
              <span style={{
                fontSize: '10px', fontVariantNumeric: 'tabular-nums', color: idx === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', width: '24px', textAlign: 'right', flexShrink: 0,
              }}>
                {count}
              </span>
            </div>
          ))}
        </div>

        {/* Agency breakdown */}
        <div className={styles.chartSection}>
          <div className={styles.sectionTitle}>TOP AGENCIES</div>
          <div className={styles.agencyTable} role="list" aria-label="Agency rankings">
            {agencyEntries.slice(0, 10).map(([agency, count], idx) => (
              <div key={agency} className={styles.agencyRow} role="listitem">
                <span className={`${styles.agencyRank} ${idx === 0 ? styles['agencyRank--top'] : ''}`}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className={styles.agencyName}>{agency}</span>
                <div className={styles.agencyBar}>
                  <div className={styles.agencyBarFill} style={{ width: `${Math.round((count / maxAgency) * 100)}%` }} />
                </div>
                <span className={`${styles.agencyCount} ${idx === 0 ? styles['agencyCount--top'] : ''}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
