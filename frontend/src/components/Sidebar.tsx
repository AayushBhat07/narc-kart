import styles from './Sidebar.module.css';

type Tab = 'radar' | 'intel' | 'network' | 'terminal' | 'trending' | 'agency' | 'compare';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onFilterToggle: () => void;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'radar',    label: 'RADAR',    icon: '◎' },
  { id: 'intel',    label: 'INTEL',    icon: '◉' },
  { id: 'network',  label: 'NETWORK',  icon: '⬡' },
  { id: 'trending', label: 'TRENDING', icon: '★' },
  { id: 'agency',   label: 'AGENCY',   icon: '◎' },
  { id: 'compare',  label: 'COMPARE',  icon: '⊞' },
  { id: 'terminal', label: 'TERMINAL', icon: '▣' },
];

export function Sidebar({ activeTab, onTabChange, onFilterToggle }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <span className={styles.logoMark}>NK</span>
        <span className={styles.logoSub}>OPS CENTER</span>
      </div>

      <nav className={styles.nav} role="navigation" aria-label="Main navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">{tab.icon}</span>
            <span className={styles.navLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={onFilterToggle}>
          <span className={styles.actionIcon} aria-hidden="true">⚙</span>
          <span>FILTERS</span>
        </button>
      </div>

      <div className={styles.footer}>
        <div className={styles.statusRow}>
          <span className={styles.statusDot} />
          <span className={styles.statusLabel}>ONLINE</span>
        </div>
        <div className={styles.versionTag}>v2.0</div>
      </div>
    </div>
  );
}
