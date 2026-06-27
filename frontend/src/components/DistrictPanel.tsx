/* Hallmark · genre: tactical · panel: district detail */
import { motion, AnimatePresence } from 'framer-motion';
import { DistrictAggregate, Seizure } from '../types';
import { formatInr, estimateSeizureCost } from '../lib/drugPrices';
import styles from './DistrictPanel.module.css';

interface Props {
  aggregate: DistrictAggregate | null;
  onClose: () => void;
  /** Number of records the aggregator couldn't geocode to a district.
   *  Pass through from the top-level `unmatchedCount` in
   *  data-by-district.json so the footer copy is honest. */
  unmatchedCount?: number;
  /** Which dataset this aggregate was built from. Drives the footer
   *  source-line copy — the main (radar) view reports from NCB/UNODC,
   *  the festival/rave view from event/festival reports. Now that
   *  BOTH modes populate `aggregate.seizures`, the binary check the
   *  panel used to make ("has seizures?") is no longer a reliable
   *  signal — we need the caller to tell us explicitly. */
  mode?: 'main' | 'rave';
}

type SeverityClass = 'critical' | 'high' | 'low' | 'none';

function tierFor(kg: number | undefined): SeverityClass {
  if (typeof kg !== 'number' || kg <= 0) return 'none';
  if (kg > 10_000) return 'critical';
  if (kg > 100)     return 'high';
  return 'low';
}

function formatKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

/** Map a drug-type key to its bar fill modifier. Falls back to a
 *  neutral accent if the key isn't one of the canonical types. */
function drugBarClass(drugKey: string): string {
  const k = drugKey.toLowerCase();
  if (k.includes('meth') || k.includes('mdma') || k.includes('amphetamine')) {
    return styles['drugBarFill--meth'] ?? '';
  }
  if (k.includes('cannabis') || k.includes('ganja') || k.includes('marijuana') || k.includes('hash')) {
    return styles['drugBarFill--cannabis'] ?? '';
  }
  if (k.includes('coca')) return styles['drugBarFill--cocaine'] ?? '';
  if (k.includes('heroin') || k.includes('opiate')) {
    return styles['drugBarFill--heroin'] ?? '';
  }
  if (k.includes('opium') || k.includes('poppy')) {
    return styles['drugBarFill--opium'] ?? '';
  }
  return '';
}

function statCellValueClass(tier: SeverityClass): string {
  switch (tier) {
    case 'critical': return `${styles.statCellValue} ${styles['statCellValue--critical'] ?? ''}`;
    case 'high':     return `${styles.statCellValue} ${styles['statCellValue--high'] ?? ''}`;
    case 'low':      return `${styles.statCellValue} ${styles['statCellValue--low'] ?? ''}`;
    default:         return styles.statCellValue;
  }
}

/* Format a date string (ISO) for the seizure list. Returns '—' if
 *  the date can't be parsed rather than throwing — the panel must
 *  never crash on a malformed record. */
function formatSeizureDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso; // fall back to raw string
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

/* Rave-mode aggregates carry the event name on `caseNo` (the App.tsx
 *  rave mapper stashes it there so the Seizure type stays canonical).
 *  Main-mode aggregates have empty caseNo — fall back to the description
 *  or drugType so we always render *something* useful. */
function seizureTitle(s: Seizure): string {
  return (s.caseNo && s.caseNo.trim()) || (s.description && s.description.trim()) || s.drugType.toUpperCase();
}

/* Truncate a long string with an ellipsis. Used for headlines /
 *  descriptions in the per-row meta line. */
function truncate(s: string | undefined, max: number): string {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function DistrictPanel({ aggregate, onClose, unmatchedCount = 0, mode = 'main' }: Props) {
  // We always render the slot so framer-motion can animate the
  // empty ↔ filled transition. Inner content switches between
  // placeholder (no district) and full detail view.
  const isOpen = aggregate !== null;
  const tier = tierFor(aggregate?.totalKg);

  const distinctDrugs = aggregate
    ? Object.keys(aggregate.drugs).filter((k) => aggregate.drugs[k] > 0).length
    : 0;

  const drugEntries = aggregate
    ? Object.entries(aggregate.drugs)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    : [];
  const maxDrug = drugEntries[0]?.[1] ?? 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="district-panel"
          className={styles.panelSlot}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          role="region"
          aria-label="District intelligence panel"
        >
          <div className={styles.panel}>
            {aggregate ? (
              <>
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>
                    <span className={styles.panelTitleAccent}>
                      {aggregate.district.toUpperCase()}
                    </span>
                    {' · '}
                    {aggregate.state.toUpperCase()}
                  </h2>
                  <button
                    className={styles.panelClose}
                    onClick={onClose}
                    aria-label="Close district panel"
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.panelBody}>
                  {/* Key stats */}
                  <div className={styles.statRow}>
                    <div className={styles.statCell}>
                      <span className={statCellValueClass(tier)}>
                        {formatCount(aggregate.count)}
                      </span>
                      <span className={styles.statCellLabel}>Seizures</span>
                    </div>
                    <div className={styles.statCell}>
                      <span className={statCellValueClass(tier)}>
                        {formatKg(aggregate.totalKg)}
                      </span>
                      <span className={styles.statCellLabel}>Volume</span>
                    </div>
                    <div className={styles.statCell}>
                      <span className={statCellValueClass(tier)}>
                        {formatInr(aggregate.estimatedCost)}
                      </span>
                      <span className={styles.statCellLabel}>Est. Value</span>
                    </div>
                    <div className={styles.statCell}>
                      <span className={styles.statCellValue}>
                        {distinctDrugs}
                      </span>
                      <span className={styles.statCellLabel}>Drug Types</span>
                    </div>
                  </div>

                  {/* Drug breakdown */}
                  {drugEntries.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>
                        Drug Breakdown ({drugEntries.length})
                      </div>
                      <div className={styles.drugBars}>
                        {drugEntries.map(([drug, n]) => {
                          const pct = Math.round((n / maxDrug) * 100);
                          const fillClass = drugBarClass(drug);
                          return (
                            <div key={drug} className={styles.drugRow}>
                              <div className={styles.drugLabel}>
                                <span className={styles.drugName}>{drug}</span>
                                <span className={styles.drugPct}>
                                  {formatCount(n)} · {pct}%
                                </span>
                              </div>
                              <div className={styles.drugBarTrack}>
                                <div
                                  className={`${styles.drugBarFill} ${fillClass}`}
                                  style={{ width: `${pct}%` }}
                                  role="meter"
                                  aria-valuenow={pct}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-label={`${drug}: ${pct}%`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Per-seizure list. Rave-mode aggregates carry the
                      actual list (`aggregate.seizures` is populated at
                      runtime by App.tsx); main-mode aggregates don't,
                      so we render this section only when there is data. */}
                  {aggregate.seizures && aggregate.seizures.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>
                        Seizures ({aggregate.seizures.length})
                      </div>
                      <ul className={styles.seizureList}>
                        {aggregate.seizures
                          .slice()
                          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
                          .map((sz) => (
                            <li key={sz.id} className={styles.seizureRow}>
                              <div className={styles.seizureRowTop}>
                                <span className={styles.seizureRowDate}>
                                  {formatSeizureDate(sz.date)}
                                </span>
                                <span className={styles.seizureRowKg}>
                                  {formatKg(sz.quantityKg ?? 0)}
                                </span>
                                <span className={styles.seizureRowCost}>
                                  {formatInr(estimateSeizureCost(sz.drugType, sz.quantityKg ?? 0))}
                                </span>
                              </div>
                              <div className={styles.seizureRowTitle}>
                                {truncate(seizureTitle(sz), 64)}
                              </div>
                              <div className={styles.seizureRowMeta}>
                                <span className={styles.seizureRowDrug}>
                                  {sz.drugType.toUpperCase()}
                                </span>
                                {sz.agency && (
                                  <>
                                    <span className={styles.seizureRowSep}>·</span>
                                    <span className={styles.seizureRowAgency}>
                                      {sz.agency}
                                    </span>
                                  </>
                                )}
                                {sz.location?.city && (
                                  <>
                                    <span className={styles.seizureRowSep}>·</span>
                                    <span className={styles.seizureRowLoc}>
                                      {sz.location.city}
                                    </span>
                                  </>
                                )}
                              </div>
                              {sz.source?.url && (
                                <a
                                  className={styles.seizureRowSource}
                                  href={sz.source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {sz.source.name || 'Source Link'} ↗
                                </a>
                              )}
                              {sz.description && (
                                <div className={styles.seizureRowDesc}>
                                  {truncate(sz.description, 90)}
                                </div>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* Aggregate source footer */}
                  <div className={styles.footer}>
                    Aggregated from{' '}
                    <span className={styles.footerNum}>{aggregate.count}</span>{' '}
                    {mode === 'rave' ? 'festival/event incidents' : 'NCB/UNODC reports'} across{' '}
                    <span className={styles.footerNum}>{aggregate.district}</span>{' '}
                    district.{' '}
                    {unmatchedCount > 0 && (
                      <>
                        <span className={styles.footerNum}>{unmatchedCount}</span>{' '}
                        records could not be geocoded.
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Empty placeholder — defensive: App should usually
                 only render DistrictPanel when a district is
                 selected, but the brief asks for a placeholder
                 if it ever receives null. */
              <div className={styles.placeholder}>
                No district selected — click a region on the map.
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
