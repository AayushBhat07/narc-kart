import { useApi } from '../hooks/useApi';
import styles from './ComparePanel.module.css';

export function ComparePanel() {
    const { stats } = useApi();

    const stateData = stats?.byState || {};
    const drugData = stats?.byDrugType || {};

    const states = Object.entries(stateData)
        .map(([name, count]) => ({ name, count: count as number }))
        .sort((a, b) => b.count - a.count);

    const maxCount = Math.max(...states.map(s => s.count), 1);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.icon}>⊞</span>
                <span className={styles.title}>COMPARE</span>
            </div>

            <div className={styles.section}>
                <span className={styles.sectionTitle}>STATES</span>
                <div className={styles.bars}>
                    {states.slice(0, 8).map((state) => {
                        const pct = (state.count / maxCount) * 100;
                        return (
                            <div key={state.name} className={styles.barRow}>
                                <span className={styles.barLabel}>{state.name.substring(0, 12)}</span>
                                <div className={styles.barTrack}>
                                    <div className={styles.barFill} style={{ width: `${pct}%` }} />
                                </div>
                                <span className={styles.barCount}>{state.count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={styles.section}>
                <span className={styles.sectionTitle}>DRUG TYPES</span>
                <div className={styles.drugGrid}>
                    {Object.entries(drugData).map(([drug, count]) => (
                        <div key={drug} className={styles.drugCard}>
                            <span className={styles.drugName}>{drug.toUpperCase()}</span>
                            <span className={styles.drugCount}>{count as number}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.timeline}>
                <span className={styles.sectionTitle}>MONTHLY TREND</span>
                <div className={styles.timelineBar}>
                    {Object.entries(stats?.byMonth || {})
                        .sort(([a], [b]) => a.localeCompare(b))
                        .slice(-6)
                        .map(([month, count]) => (
                            <div key={month} className={styles.monthCol}>
                                <div
                                    className={styles.monthBar}
                                    style={{ height: `${((count as number) / maxCount) * 100}%` }}
                                />
                                <span className={styles.monthLabel}>{month.split('-')[1]}</span>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}