import { ApiStats } from '../types';
import styles from './StatBoxes.module.css';

interface Props {
  stats: ApiStats | null;
  recentCount: number;
}

export function StatBoxes({ stats, recentCount }: Props) {
  const total = stats?.totalSeizures ?? recentCount ?? 0;
  const thisWeek = stats?.raidsThisWeek ?? '—';
  const totalKg = stats?.totalQuantityKg ?? 0;
  const states = stats?.byState ? Object.keys(stats.byState).length : '—';

  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <span className={styles.value}>{total}</span>
        <span className={styles.label}>TOTAL<br />SEIZURES</span>
      </div>

      <div className={`${styles.box} ${styles['box--secondary']}`}>
        <span className={styles.value}>{thisWeek}</span>
        <span className={styles.label}>RAID THIS<br />WEEK</span>
      </div>

      <div className={`${styles.box} ${styles['box--tertiary']}`}>
        <span className={styles.value}>
          {totalKg >= 1000 ? `${(totalKg / 1000).toFixed(0)}T` : `${totalKg.toFixed(0)}KG`}
        </span>
        <span className={styles.label}>TOTAL<br />VOLUME</span>
      </div>

      <div className={`${styles.box} ${styles['box--secondary']}`}>
        <span className={styles.value}>{states}</span>
        <span className={styles.label}>ACTIVE<br />STATES</span>
      </div>
    </div>
  );
}
