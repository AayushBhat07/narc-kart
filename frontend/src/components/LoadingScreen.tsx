import styles from './LoadingScreen.module.css';

export function LoadingScreen() {
  return (
    <div className={styles.container}>
      <div className={styles.scanlines} />
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.blink}>_</span>
          <span className={styles.title}>NARC KART INITIALIZING</span>
        </div>
        <div className={styles.ascii}>
          <pre>{`
  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
  ██║ ╚████║███████╗██╔╝ ╚██╗╚██████╔╝███████║
  ╚═╝  ╚═══╝╚══════╝╚═╝   ╚═╝ ╚═════╝ ╚══════╝
          `}</pre>
        </div>
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} />
          </div>
          <div className={styles.progressText}>LOADING DATABASE...</div>
        </div>
        <div className={styles.statusMessages}>
          <p>ESTABLISHING SECURE CONNECTION...</p>
          <p>LOADING GEOGRAPHIC DATA...</p>
          <p>INITIALIZING CLASSIFICATION ENGINE...</p>
          <p>COMPILING INTELLIGENCE FEEDS...</p>
        </div>
        <div className={styles.footer}>
          <span>v1.0.0 | CLASSIFIED | NCB SYSTEMS</span>
        </div>
      </div>
    </div>
  );
}
