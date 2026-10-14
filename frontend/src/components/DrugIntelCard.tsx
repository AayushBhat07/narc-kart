import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DrugType, Seizure } from '../types';
import { DRUG_INTEL, type IntelSource } from '../data/drugIntel';
import { computeDrugStats } from '../data/drugStats';
import styles from './DrugIntelCard.module.css';

function formatKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} T`;
  return `${kg.toFixed(kg < 10 ? 2 : 1)} KG`;
}

function sevClass(kg: number): string {
  if (kg > 100) return styles.critical;
  if (kg > 10) return styles.high;
  return styles.low;
}

/** Footnote marker that links straight to the cited source. */
function Cite({ sources, idx }: { sources: IntelSource[]; idx: number }) {
  const s = sources[idx];
  if (!s) return null;
  return (
    <a
      className={styles.cite}
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      title={s.label}
      aria-label={`Source ${idx + 1}: ${s.label}`}
    >
      [{idx + 1}]
    </a>
  );
}

interface CardProps {
  drugType: DrugType;
  /** Seizures to compute live stats from. Omit to hide the stats block. */
  seizures?: readonly Seizure[];
  /**
   * `section` — embedded block (case file, panels).
   * `dossier` — standalone card with its own classification header.
   */
  variant?: 'section' | 'dossier';
  onClose?: () => void;
  /** Id for the card heading, so a dialog can point aria-labelledby at it. */
  headingId?: string;
}

/**
 * Reusable drug intel card (issue #17). Static, cited enforcement facts from
 * `data/drugIntel.ts` plus live stats computed from the seizure dataset.
 */
export function DrugIntelCard({ drugType, seizures, variant = 'section', onClose, headingId }: CardProps) {
  const intel = DRUG_INTEL[drugType] ?? DRUG_INTEL.other;
  const stats = useMemo(
    () => (seizures ? computeDrugStats(seizures, drugType) : null),
    [seizures, drugType]
  );
  const { sources } = intel;

  return (
    <section
      className={`${styles.card} ${variant === 'dossier' ? styles.dossier : styles.section}`}
      aria-labelledby={headingId}
    >
      {variant === 'dossier' ? (
        <div className={styles.classBar}>
          <span>PUBLIC-SOURCE INTEL // NDPS</span>
          <span className={styles.fileNo}>FILE NK-INT-{drugType.toUpperCase()}</span>
          {onClose && (
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close drug intel card">
              ✕
            </button>
          )}
        </div>
      ) : (
        <div className={styles.sectionHead}>
          <span aria-hidden="true">▣</span> DRUG INTEL
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.name} id={headingId}>{intel.name}</h3>
          <span className={styles.drugClass}>{intel.drugClass}</span>
        </div>

        {stats && (
          <div className={styles.block}>
            <div className={styles.blockLabel}>LIVE // NARC KART DATASET</div>
            {stats.count === 0 ? (
              <div className={styles.empty}>NO SEIZURES RECORDED</div>
            ) : (
              <dl className={styles.kv}>
                <div className={styles.kvRow}>
                  <dt>SEIZURES</dt>
                  <dd>{stats.count}</dd>
                </div>
                <div className={styles.kvRow}>
                  <dt>TOTAL QTY</dt>
                  <dd>{formatKg(stats.totalKg)}</dd>
                </div>
                {stats.biggest && (
                  <div className={styles.kvRow}>
                    <dt>MAX BUST</dt>
                    <dd>
                      <span className={sevClass(stats.biggest.quantityKg || 0)}>
                        {formatKg(stats.biggest.quantityKg || 0)}
                      </span>
                      <span className={styles.sub}>
                        {' '}· {stats.biggest.location.city.toUpperCase()} · {stats.biggest.date}
                      </span>
                    </dd>
                  </div>
                )}
                {stats.topState && (
                  <div className={styles.kvRow}>
                    <dt>TOP STATE</dt>
                    <dd>
                      {stats.topState.state.toUpperCase()}
                      <span className={styles.sub}> · {stats.topState.count} CASES</span>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        )}

        <div className={styles.block}>
          <div className={styles.blockLabel}>KNOWN AS</div>
          {intel.streetNames.length === 0 ? (
            <div className={styles.empty}>NO COLLOQUIAL NAME ON FILE</div>
          ) : (
            <ul className={styles.list}>
              {intel.streetNames.map((n) => (
                <li key={n.text}>
                  {n.text} <Cite sources={sources} idx={n.src} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.block}>
          <div className={styles.blockLabel}>NDPS THRESHOLDS · S.O. 1055(E)</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">SUBSTANCE</th>
                <th scope="col">SMALL ≤</th>
                <th scope="col">COMM. ≥</th>
              </tr>
            </thead>
            <tbody>
              {intel.thresholds.map((t) => (
                <tr key={t.substance}>
                  <td>
                    {t.substance} <span className={styles.sub}>#{t.entry}</span>{' '}
                    <Cite sources={sources} idx={t.src} />
                    {t.alsoSrc !== undefined && <Cite sources={sources} idx={t.alsoSrc} />}
                    {t.note && <div className={styles.note}>{t.note}</div>}
                  </td>
                  <td className={styles.num}>{t.small}</td>
                  <td className={styles.num}>{t.commercial}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.block}>
          <div className={styles.blockLabel}>ORIGINS / ROUTES INTO INDIA</div>
          <ul className={styles.list}>
            {intel.routes.map((r) => (
              <li key={r.text}>
                {r.text} <Cite sources={sources} idx={r.src} />
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.block}>
          <div className={styles.blockLabel}>SOURCES</div>
          <ol className={styles.sources}>
            {sources.map((s, i) => (
              <li key={s.url}>
                <span className={styles.srcIdx}>[{i + 1}]</span>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className={styles.footer}>ENFORCEMENT / PUBLIC-INFORMATION USE ONLY · NOT LEGAL ADVICE</div>
    </section>
  );
}

interface ModalProps {
  drugType: DrugType | null;
  seizures?: readonly Seizure[];
  onClose: () => void;
}

/** Overlay wrapper for the dossier variant (same pattern as SeizureModal). */
export function DrugIntelModal({ drugType, seizures, onClose }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drugType) return;
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close only this card, not the case file / filter panel beneath it.
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [drugType, onClose]);

  return (
    <AnimatePresence>
      {drugType && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <div
            ref={dialogRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drug-intel-modal-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <DrugIntelCard
              drugType={drugType}
              seizures={seizures}
              variant="dossier"
              onClose={onClose}
              headingId="drug-intel-modal-title"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
