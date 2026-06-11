import { useApi } from '../hooks/useApi';
import styles from './AgencyPanel.module.css';

export function AgencyPanel() {
    const { seizures } = useApi();

    const agencyMap: Record<string, { count: number; qty: number; seizures: string[] }> = {};

    for (const s of seizures) {
        const agency = s.agency || 'Unknown';
        if (!agencyMap[agency]) {
            agencyMap[agency] = { count: 0, qty: 0, seizures: [] };
        }
        agencyMap[agency].count++;
        agencyMap[agency].qty += s.quantityKg || 0;
        if (agencyMap[agency].seizures.length < 3) {
            agencyMap[agency].seizures.push(s.location.city);
        }
    }

    const agencies = Object.entries(agencyMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.qty - a.qty);

    const totalQty = agencies.reduce((sum, a) => sum + a.qty, 0);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.icon}>◎</span>
                <span className={styles.title}>AGENCY STATS</span>
            </div>

            <div className={styles.section}>
                <span className={styles.sectionTitle}>BY AGENCY ({agencies.length})</span>
                <div className={styles.agencyList}>
                    {agencies.slice(0, 10).map((agency) => {
                        const pct = (agency.qty / totalQty) * 100;
                        return (
                            <div key={agency.name} className={styles.agencyRow}>
                                <div className={styles.agencyInfo}>
                                    <span className={styles.agencyName}>{agency.name}</span>
                                    <span className={styles.agencyCities}>
                                        {agency.seizures.join(', ')}
                                    </span>
                                </div>
                                <div className={styles.agencyStats}>
                                    <span className={styles.agencyCount}>{agency.count}x</span>
                                    <span className={styles.agencyQty}>
                                        {agency.qty >= 1000 ? `${(agency.qty / 1000).toFixed(1)}T` : `${agency.qty.toFixed(0)}KG`}
                                    </span>
                                </div>
                                <div className={styles.barTrack}>
                                    <div className={styles.barFill} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={styles.summary}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>TOTAL AGENCIES</span>
                    <span className={styles.summaryValue}>{agencies.length}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>TOP AGENCY</span>
                    <span className={styles.summaryValue}>{agencies[0]?.name || 'N/A'}</span>
                </div>
            </div>
        </div>
    );
}