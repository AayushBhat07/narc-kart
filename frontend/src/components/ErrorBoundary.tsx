import { Component, ErrorInfo, ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  /** Short name shown in the fallback, e.g. "GLOBE" or "PANEL". */
  label?: string;
  /** Full-viewport fallback (app root) vs. one that fills its container. */
  fullscreen?: boolean;
  /** Fixed, centred above the globe: for boundaries around overlays/modals. */
  overlay?: boolean;
  /** When any of these change, a tripped boundary resets and retries. */
  resetKeys?: unknown[];
}

interface State {
  error: Error | null;
}

function keysChanged(a: unknown[] = [], b: unknown[] = []) {
  return a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && keysChanged(prev.resetKeys, this.props.resetKeys)) {
      this.setState({ error: null });
    }
  }

  private retry = () => this.setState({ error: null });

  private reload = () => window.location.reload();

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { label, fullscreen, overlay } = this.props;
    const variant = fullscreen ? styles.fullscreen : overlay ? styles.overlay : '';
    return (
      <div className={`${styles.fallback} ${variant}`} role="alert">
        <div className={styles.frame}>
          <span className={styles.tag}>ERR · {label ?? 'SYSTEM'}</span>
          <h2 className={styles.title}>SIGNAL LOST</h2>
          <p className={styles.message}>
            &gt; {label ? `${label} MODULE` : 'MODULE'} FAILED TO RENDER
            <span className={styles.cursor} aria-hidden="true">_</span>
          </p>
          <div className={styles.actions}>
            {!fullscreen && (
              <button type="button" className={styles.btn} onClick={this.retry}>
                RETRY
              </button>
            )}
            <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={this.reload}>
              RELOAD
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
