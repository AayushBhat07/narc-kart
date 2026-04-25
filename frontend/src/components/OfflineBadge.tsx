import styles from './OfflineBadge.module.css';

interface Props {
  lastUpdate: string | null;
}

export function OfflineBadge({ lastUpdate }: Props) {
  const time = lastUpdate
    ? new Date(lastUpdate).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZoneName: 'short',
      })
    : 'unknown';

  return (
    <div className={styles.badge}>
      <span className={styles.dot} />
      <span className={styles.text}>OFFLINE</span>
      <span className={styles.time}>Cached: {time}</span>
    </div>
  );
}