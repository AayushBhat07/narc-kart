import styles from './PlaceholderPanel.module.css';

interface Props {
  title: string;
  icon: string;
  description: string;
}

export function PlaceholderPanel({ title, icon, description }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.title}>{title}</span>
      </div>
      <div className={styles.content}>
        <div className={styles.box}>
          <span className={styles.label}>STATUS</span>
          <span className={styles.value}>DEVELOPMENT</span>
        </div>
        <div className={styles.box}>
          <span className={styles.label}>MODULE</span>
          <span className={styles.value}>INACTIVE</span>
        </div>
      </div>
      <div className={styles.description}>{description}</div>
      <div className={styles.grid}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className={styles.gridCell}>
            <span className={styles.cellLabel}>NODE_{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.cellStatus}>IDLE</span>
          </div>
        ))}
      </div>
    </div>
  );
}