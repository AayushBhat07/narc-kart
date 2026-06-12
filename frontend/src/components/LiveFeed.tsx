import { Seizure } from '../types';
import styles from './LiveFeed.module.css';

interface Props {
  seizures: Seizure[];
}

function getSeverityClass(kg: number): string {
  if (kg > 100) return styles.critical;
  if (kg > 10) return styles.high;
  return styles.low;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LiveFeed({ seizures }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>LIVE FEED</span>
        <span className={styles.indicator}>●</span>
      </div>
      <div className={styles.feed}>
        {seizures.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>⊗</span>
            <span className={styles.emptyText}>NO SEIZURES RECORDED</span>
          </div>
        ) : (
          seizures.slice(0, 10).map((seizure, idx) => (
            <div key={`${seizure.id}-${idx}`} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={`${styles.severity} ${getSeverityClass(seizure.quantityKg)}`}>
                  {seizure.quantityKg > 100 ? 'MAJOR' : seizure.quantityKg > 10 ? 'MED' : 'MIN'}
                </span>
                <span className={styles.time}>{formatTime(seizure.date)}</span>
              </div>
              <div className={styles.location}>
                {seizure.location.city}, {seizure.location.state}
              </div>
              <div className={styles.details}>
                {seizure.drugType.toUpperCase()} • {seizure.quantityKg}KG
              </div>
              <div className={styles.agency}>{seizure.agency}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}