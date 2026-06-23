/* Rave Intel Panel — drug seizures at/near music events, fests, parties
   Reuses the same panel chrome + mono font as other panels; the rave
   accent palette comes from [data-mode="rave"] tokens. */
import { useMemo } from 'react';
import { useRaveData, RaveSeizure } from '../hooks/useRaveData';
import styles from './RavePanel.module.css';

interface Props {
  onClose: () => void;
}

function sev(kg: number): 'critical' | 'high' | 'low' {
  if (kg > 100) return 'critical';
  if (kg > 10) return 'high';
  return 'low';
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return '—';
  }
}

function eventShortName(name: string): string {
  return name
    .replace(/(\d{4})/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 22) || '—';
}

export function RavePanel({ onClose }: Props) {
  const { data, loading, error } = useRaveData();

  const seizures = data?.seizures ?? [];
  const summary = data?.summary;
  const drugBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    seizures.forEach((s) => {
      const t = (s.drugType || 'Unknown').toUpperCase();
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [seizures]);

  const hitCities = useMemo(() => {
    const map: Record<string, { count: number; kg: number }> = {};
    seizures.forEach((s) => {
      const key = (s.location?.city || 'UNKNOWN').toUpperCase();
      if (!map[key]) map[key] = { count: 0, kg: 0 };
      map[key].count += 1;
      map[key].kg += s.quantityKg || 0;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 12);
  }, [seizures]);

  return (
    <div className={styles.panel} role="region" aria-label="Festival intel panel">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>FESTIVAL INTEL</h2>
        <button className={styles.panelClose} onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      {loading && <div className={styles.empty}>LOADING INTEL…</div>}
      {error && <div className={styles.empty}>DATA UNAVAILABLE · {error}</div>}

      {!loading && !error && (
        <>
          {/* Stats strip */}
          <div className={styles.stats}>
            <div className={styles.statBlock}>
              <div className={styles.statValue}>{seizures.length.toLocaleString()}</div>
              <div className={styles.statLabel}>SEIZURES</div>
            </div>
            <div className={styles.statBlock}>
              <div className={styles.statValue}>
                {summary
                  ? summary.totalKg >= 1000
                    ? `${(summary.totalKg / 1000).toFixed(1)}T`
                    : `${Math.round(summary.totalKg)}KG`
                  : '—'}
              </div>
              <div className={styles.statLabel}>VOLUME</div>
            </div>
            <div className={styles.statBlock}>
              <div className={styles.statValue}>{drugBreakdown.length}</div>
              <div className={styles.statLabel}>DRUG TYPES</div>
            </div>
          </div>

          {/* Drug-type breakdown chips */}
          {drugBreakdown.length > 0 && (
            <div className={styles.breakdown}>
              <div className={styles.sectionLabel}>DRUG PROFILE</div>
              <div className={styles.chips}>
                {drugBreakdown.map(([drug, count]) => (
                  <div key={drug} className={styles.chip}>
                    <span className={styles.chipCount}>{count}</span>
                    <span className={styles.chipName}>{drug}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hit-cities horizontal carousel */}
          {hitCities.length > 0 && (
            <div className={styles.carouselWrap}>
              <div className={styles.sectionLabel}>HIT CITIES</div>
              <div className={styles.carousel}>
                {hitCities.map(([city, info]) => (
                  <div key={city} className={styles.cityChip}>
                    <span className={styles.cityName}>{city}</span>
                    <span className={styles.cityCount}>{info.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event list */}
          <div className={styles.eventList}>
            <div className={styles.sectionLabel}>INCIDENTS</div>
            {seizures.length === 0 ? (
              <div className={styles.empty}>NO INCIDENTS ON RECORD</div>
            ) : (
              <ul className={styles.eventScroll}>
                {seizures
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((s) => (
                    <RaveRow key={s.id} seizure={s} />
                  ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RaveRow({ seizure }: { seizure: RaveSeizure }) {
  const s = sev(seizure.quantityKg);
  return (
    <li className={styles.row}>
      <div className={styles.rowTop}>
        <div className={styles.eventName}>{eventShortName(seizure.eventName || '—')}</div>
        <div className={`${styles.sev} ${styles[`sev--${s}`]}`}>{s.toUpperCase()}</div>
      </div>
      <div className={styles.rowMeta}>
        <span className={styles.metaLoc}>
          {seizure.location.city}
          {seizure.location.state ? `, ${seizure.location.state}` : ''}
        </span>
        <span className={styles.metaSep}>·</span>
        <span className={styles.metaDate}>{fmtDate(seizure.date)}</span>
        <span className={styles.metaSep}>·</span>
        <span className={styles.metaDrug}>{seizure.drugType}</span>
        <span className={styles.metaKg}>{seizure.quantityKg}KG</span>
      </div>
      <a
        className={styles.sourceLink}
        href={seizure.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        title={seizure.headline}
      >
        {seizure.source || 'SOURCE'} ↗
      </a>
    </li>
  );
}
