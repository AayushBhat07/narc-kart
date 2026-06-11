import { useApi } from '../hooks/useApi';
import styles from './TrendingPanel.module.css';

function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'TODAY';
    if (diffDays === 1) return 'YESTERDAY';
    if (diffDays < 7) return `${diffDays}D AGO`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}W AGO`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function getSeverityClass(kg: number): string {
    if (kg > 100) return styles.critical;
    if (kg > 10) return styles.high;
    return styles.low;
}

export function TrendingPanel() {
    const { seizures, stats } = useApi();

    const sortedByQuantity = [...seizures].sort((a, b) => b.quantityKg - a.quantityKg).slice(0, 5);
    const sortedByDate = [...seizures].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.icon}>★</span>
                <span className={styles.title}>TRENDING</span>
            </div>

            <div className={styles.section}>
                <span className={styles.sectionTitle}>MAJOR SEIZURES</span>
                <div className={styles.list}>
                    {sortedByQuantity.map((s, i) => (
                        <div key={s.id} className={styles.row}>
                            <span className={styles.rank}>#{i + 1}</span>
                            <div className={styles.info}>
                                <span className={styles.location}>{s.location.city}, {s.location.state}</span>
                                <span className={styles.drug}>{s.drugType.toUpperCase()}</span>
                            </div>
                            <div className={styles.qty}>
                                <span className={`${styles.badge} ${getSeverityClass(s.quantityKg)}`}>
                                    {s.quantityKg >= 1000 ? `${(s.quantityKg / 1000).toFixed(1)}T` : `${s.quantityKg.toFixed(1)}KG`}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.section}>
                <span className={styles.sectionTitle}>RECENT ACTIVITY</span>
                <div className={styles.list}>
                    {sortedByDate.map((s) => (
                        <div key={`${s.id}-recent`} className={styles.row}>
                            <span className={styles.time}>{formatDate(s.date)}</span>
                            <div className={styles.info}>
                                <span className={styles.location}>{s.location.city}</span>
                                <span className={styles.drug}>{s.drugType.toUpperCase()}</span>
                            </div>
                            <span className={styles.qtySmall}>{s.quantityKg}KG</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>TOTAL VOLUME</span>
                    <span className={styles.statValue}>{((stats?.totalQuantityKg ?? 0) / 1000).toFixed(0)}T</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>AVG/SIZE</span>
                    <span className={styles.statValue}>{seizures.length > 0 ? ((stats?.totalQuantityKg ?? 0) / seizures.length).toFixed(1) : 0}KG</span>
                </div>
            </div>
        </div>
    );
}