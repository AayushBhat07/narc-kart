import { ApiStats } from '../types';
import styles from './StatBoxes.module.css';

interface Props {
  stats: ApiStats | null;
  recentCount: number;
}

export function StatBoxes({ stats, recentCount }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <span className={styles.value}>{stats?.totalSeizures ?? recentCount ?? 0}</span>
        <span className={styles.label}>TOTAL SEIZURES</span>
      </div>
      <div className={styles.box}>
        <span className={styles.value}>{stats?.raidsThisWeek ?? '—'}</span>
        <span className={styles.label}>RAID THIS WEEK</span>
      </div>
    </div>
  );
}