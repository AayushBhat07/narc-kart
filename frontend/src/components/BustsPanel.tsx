/* Hallmark · genre: tactical · panel: busts (most wanted leaderboard) */
import { useMemo, useState } from 'react';
import { ApiStats, Seizure } from '../types';
import styles from './BustsPanel.module.css';

interface Props {
  seizures: Seizure[];
  stats: ApiStats | null;
  onClose: () => void;
  onSelect: (seizure: Seizure) => void;
}

const LIMIT = 10;

function sevClass(kg: number) {
  if (kg > 100) return styles['sev--critical'];
  if (kg > 10) return styles['sev--high'];
  return styles['sev--low'];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase();
}

/** Largest first; ties go to the most recent date. */
function compareBusts(a: Seizure, b: Seizure) {
  return (b.quantityKg || 0) - (a.quantityKg || 0) || (b.date || '').localeCompare(a.date || '');
}

export function BustsPanel({ seizures, onClose, onSelect }: Props) {
  const [drug, setDrug] = useState<string>('all');

  const drugTypes = useMemo(
    () => Array.from(new Set(seizures.map((s) => s.drugType))).sort() as string[],
    [seizures]
  );

  // If the time filter removed the selected drug, fall back to ALL.
  const activeDrug = drugTypes.includes(drug) ? drug : 'all';

  const busts = useMemo(
    () =>
      seizures
        .filter((s) => activeDrug === 'all' || s.drugType === activeDrug)
        .sort(compareBusts)
        .slice(0, LIMIT),
    [seizures, activeDrug]
  );

  return (
    <div className={styles.panel} role="region" aria-label="Biggest busts panel">
      <div className={styles.panelHeader}>
        <div className={styles.titleBlock}>
          <h2 className={styles.panelTitle}>MOST WANTED</h2>
          <span className={styles.panelSub}>BIGGEST BUSTS // TOP {LIMIT} BY VOLUME</span>
        </div>
        <button className={styles.panelClose} onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      <div className={styles.chips} role="group" aria-label="Filter by drug type">
        {['all', ...drugTypes].map((d) => (
          <button
            key={d}
            type="button"
            className={`${styles.chip} ${activeDrug === d ? styles.chipActive : ''}`}
            aria-pressed={activeDrug === d}
            onClick={() => setDrug(d)}
          >
            {d.toUpperCase()}
          </button>
        ))}
      </div>

      <div className={styles.panelBody}>
        <div className={styles.colHead} aria-hidden="true">
          <span>RK</span>
          <span className={styles.colQty}>QTY</span>
          <span>SUBJECT</span>
        </div>

        {busts.length === 0 ? (
          <div className={styles.empty} role="status">NO RECORDS FOR THIS FILTER</div>
        ) : (
          <ol className={styles.list} aria-label="Biggest busts, largest first">
            {busts.map((sz, idx) => {
              const kg = sz.quantityKg || 0;
              const loc = [sz.location?.city, sz.location?.state].filter(Boolean).join(', ');
              return (
                <li key={sz.id || idx}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => onSelect(sz)}
                    aria-label={`Rank ${idx + 1}: ${kg.toFixed(1)} kilograms of ${sz.drugType}, ${loc}, ${formatDate(sz.date)}, ${sz.agency || 'unknown agency'}. Open case file`}
                  >
                    <span className={`${styles.rank} ${idx === 0 ? styles.rankTop : ''}`}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className={`${styles.qty} ${sevClass(kg)}`}>{kg.toFixed(1)} KG</span>
                    <span className={styles.detail}>
                      <span className={styles.lineMain}>
                        <span className={styles.drugName}>{sz.drugType.toUpperCase()}</span>
                        <span className={styles.loc}>{loc.toUpperCase() || '—'}</span>
                      </span>
                      <span className={styles.lineMeta}>
                        <span className={styles.date}>{formatDate(sz.date)}</span>
                        <span className={styles.sep} aria-hidden="true">·</span>
                        <span className={styles.agency}>{(sz.agency || 'UNKNOWN AGENCY').toUpperCase()}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
