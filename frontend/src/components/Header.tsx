import { useState, useEffect } from 'react';
import styles from './Header.module.css';

interface Props {
  onRefresh: () => void;
  onFilterToggle: () => void;
}

export function Header({ onRefresh, onFilterToggle }: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const dateStr = time.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timeStr = time.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>NK</span>
          <span className={styles.logoText}>OPS CENTER</span>
        </div>
        <div className={styles.liveIndicator}>
          <span className={styles.liveDot} />
          <span className={styles.liveLabel}>LIVE</span>
        </div>
      </div>

      <div className={styles.right}>
        <button
          className={styles.iconBtn}
          onClick={onRefresh}
          title="Refresh data"
          aria-label="Refresh data"
        >
          ↻
        </button>
        <button
          className={styles.iconBtn}
          onClick={onFilterToggle}
          title="Open filters"
          aria-label="Open filters"
        >
          ⚙
        </button>
        <div className={styles.clock}>
          <span className={styles.clockDate}>{dateStr}</span>
          <span className={styles.clockTime}>{timeStr} IST</span>
        </div>
      </div>
    </header>
  );
}
