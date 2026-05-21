import styles from './Footer.module.css';

interface Props {
  coords?: { lat: number; lon: number };
}

export function Footer({ coords = { lat: 20.5937, lon: 78.9629 } }: Props) {
  const utcString = new Date().toISOString().slice(0, 19) + ' UTC';

  return (
    <footer className={styles.footer}>
      <div className={styles.left}>
        <span className={styles.label}>COORD:</span>
        <span className={styles.value}>
          {coords.lat.toFixed(4)}° N, {coords.lon.toFixed(4)}° E
        </span>
      </div>
      <div className={styles.center}>
        <span className={styles.label}>STATUS:</span>
        <span className={styles.online}>● ONLINE</span>
      </div>
      <div className={styles.right}>
        <span className={styles.label}>UTC:</span>
        <span className={styles.value}>{utcString}</span>
      </div>
    </footer>
  );
}