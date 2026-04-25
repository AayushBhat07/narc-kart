import styles from './Sidebar.module.css';

type Tab = 'radar' | 'intel' | 'network' | 'terminal';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onFilterToggle: () => void;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'radar', label: 'RADAR', icon: '◎' },
  { id: 'intel', label: 'INTEL', icon: '◉' },
  { id: 'network', label: 'NETWORK', icon: '⬡' },
  { id: 'terminal', label: 'TERMINAL', icon: '▣' },
];

export function Sidebar({ activeTab, onTabChange, onFilterToggle }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>NK</span>
        <span className={styles.logoText}>OPS CENTER</span>
      </div>

      <nav className={styles.nav}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className={styles.icon}>{tab.icon}</span>
            <span className={styles.label}>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={onFilterToggle}>
          <span>⌦</span> FILTERS
        </button>
        <button className={styles.actionBtn}>
          <span>↺</span> REFRESH
        </button>
      </div>

      <div className={styles.footer}>
        <div className={styles.statusItem}>
          <span className={styles.statusDot} />
          <span>SYSTEMS ONLINE</span>
        </div>
        <div className={styles.version}>v1.0.0</div>
      </div>
    </div>
  );
}
