import { useApi } from '../hooks/useApi';
import styles from './IntelPanel.module.css';

export function IntelPanel() {
  const { stats } = useApi();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.icon}>◉</span>
        <span className={styles.title}>INTEL</span>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>TOTAL SEIZURES</span>
          <span className={styles.cardValue}>{stats?.totalSeizures ?? '—'}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>THIS WEEK</span>
          <span className={styles.cardValue}>{stats?.raidsThisWeek ?? '—'}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>TOTAL KG</span>
          <span className={styles.cardValue}>{stats?.totalQuantityKg?.toFixed(0) ?? '—'}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>STATES</span>
          <span className={styles.cardValue}>{stats?.byState ? Object.keys(stats.byState).length : '—'}</span>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>BY DRUG TYPE</span>
        <div className={styles.bars}>
          {stats?.byDrugType ? (
            Object.entries(stats.byDrugType).map(([drug, count]) => {
              const max = Math.max(...Object.values(stats.byDrugType));
              const pct = (count / max) * 100;
              return (
                <div key={drug} className={styles.barRow}>
                  <span className={styles.barLabel}>{drug.toUpperCase()}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.barCount}>{count as number}</span>
                </div>
              );
            })
          ) : (
            <span className={styles.empty}>NO DATA</span>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>BY STATE</span>
        <div className={styles.list}>
          {stats?.byState ? (
            Object.entries(stats.byState)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 8)
              .map(([state, count]) => (
                <div key={state} className={styles.listRow}>
                  <span className={styles.listLabel}>{state}</span>
                  <span className={styles.listValue}>{count as number}</span>
                </div>
              ))
          ) : (
            <span className={styles.empty}>NO DATA</span>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>TOP LOCATIONS</span>
        <div className={styles.list}>
          {stats?.topLocations && stats.topLocations.length > 0 ? (
            stats.topLocations.slice(0, 5).map((loc, i) => (
              <div key={i} className={styles.listRow}>
                <span className={styles.listLabel}>{loc.city}, {loc.state}</span>
                <span className={styles.listValue}>{loc.totalKg.toFixed(1)} KG</span>
              </div>
            ))
          ) : (
            <span className={styles.empty}>NO DATA</span>
          )}
        </div>
      </div>
    </div>
  );
}