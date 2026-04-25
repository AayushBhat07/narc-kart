import { useApi } from '../hooks/useApi';
import styles from './NetworkPanel.module.css';

export function NetworkPanel() {
  const { stats } = useApi();

  // Build a simple adjacency from top locations
  const nodes = stats?.topLocations?.map((loc, i) => ({
    id: i,
    label: loc.city,
    state: loc.state,
    weight: loc.totalKg,
  })) || [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.icon}>⬡</span>
        <span className={styles.title}>NETWORK</span>
      </div>

      <div className={styles.statusRow}>
        <span className={styles.statusDot} />
        <span className={styles.statusText}>SYSTEMS ONLINE</span>
        <span className={styles.nodeCount}>{nodes.length} NODES</span>
      </div>

      <div className={styles.mapArea}>
        <div className={styles.graphContainer}>
          {nodes.length > 0 ? (
            nodes.map((node, i) => {
              const size = Math.max(40, Math.min(80, node.weight / 5));
              const angle = (i / nodes.length) * 2 * Math.PI;
              const radius = 100;
              const cx = 160 + radius * Math.cos(angle);
              const cy = 160 + radius * Math.sin(angle);
              return (
                <div
                  key={node.id}
                  className={styles.node}
                  style={{
                    width: size,
                    height: size,
                    left: cx - size / 2,
                    top: cy - size / 2,
                    borderColor: node.weight > 100 ? 'var(--accent-red)' : 'var(--border-color)',
                  }}
                  title={`${node.label}, ${node.state} — ${node.weight.toFixed(0)} KG`}
                >
                  <span className={styles.nodeLabel}>{node.label.substring(0, 3)}</span>
                </div>
              );
            })
          ) : (
            <span className={styles.empty}>NO NODES</span>
          )}
          {nodes.length > 1 && nodes.map((_node, i) => {
            const angleA = (i / nodes.length) * 2 * Math.PI;
            const angleB = ((i + 1) % nodes.length) / nodes.length * 2 * Math.PI;
            const r = 100;
            const x1 = 160 + r * Math.cos(angleA);
            const y1 = 160 + r * Math.sin(angleA);
            const x2 = 160 + r * Math.cos(angleB);
            const y2 = 160 + r * Math.sin(angleB);
            return (
              <svg key={i} className={styles.edgeSvg}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border-color)" strokeWidth="1" />
              </svg>
            );
          })}
        </div>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendTitle}>CONNECTIONS</span>
        <div className={styles.legendRow}>
          <span className={styles.legendDot} style={{ borderColor: 'var(--accent-red)' }} />
          <span>Major Hub ({'>'}100KG)</span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.legendDot} />
          <span>Standard Node</span>
        </div>
      </div>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>CITY</span>
          <span>STATE</span>
          <span>KG</span>
        </div>
        {nodes.slice(0, 6).map((node) => (
          <div key={node.id} className={styles.tableRow}>
            <span>{node.label}</span>
            <span>{node.state}</span>
            <span>{node.weight.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}