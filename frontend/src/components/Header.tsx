import styles from './Header.module.css';

interface Props {
  onRefresh: () => void;
  onFilterToggle: () => void;
}

export function Header({ onRefresh, onFilterToggle }: Props) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>
          <span className={styles.accent}>NARC</span> KART
        </h1>
        <span className={styles.liveBadge}>LIVE</span>
        <span className={styles.version}>v2.0</span>
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn} onClick={onRefresh} title="Refresh">
          ↻
        </button>
        <button className={styles.iconBtn} onClick={onFilterToggle} title="Filters">
          ⚙
        </button>
        <div className={styles.datetime}>
          <span>{dateStr}</span>
          <span>{timeStr} IST</span>
        </div>
      </div>
    </header>
  );
}