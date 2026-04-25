import styles from './Header.module.css';

interface Props {
  onRefresh: () => void;
  onFilterToggle: () => void;
}

export function Header({ onRefresh, onFilterToggle }: Props) {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateString = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.title}>NARC KART</span>
        <span className={styles.version}>v1.0</span>
        <span className={styles.classified}>CLASSIFIED</span>
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn} onClick={onRefresh} title="Refresh">
          ↺
        </button>
        <button className={styles.iconBtn} onClick={onFilterToggle} title="Filters">
          ⌦
        </button>
        <button className={styles.iconBtn} title="Settings">
          ⚙
        </button>
        <div className={styles.datetime}>
          <span>{dateString}</span>
          <span>{timeString}</span>
        </div>
      </div>
    </header>
  );
}
