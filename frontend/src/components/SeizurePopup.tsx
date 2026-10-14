import DOMPurify from 'dompurify';
import { Seizure } from '../types';
import { safeUrl } from '../utils/safeUrl';
import { DrugIntelCard } from './DrugIntelCard';
import styles from './SeizurePopup.module.css';

interface Props {
  seizure: Seizure;
  onClose: () => void;
  /** Full (unfiltered) dataset, for the DRUG INTEL live stats. */
  seizures?: readonly Seizure[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatQuantity(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} T`;
  return `${kg.toFixed(1)} KG`;
}

function getSeverityClass(kg: number): string {
  if (kg > 100) return styles.critical;
  if (kg > 10) return styles.high;
  return styles.low;
}

export function SeizurePopup({ seizure, onClose, seizures }: Props) {
  // Re-check at render: the localStorage cache can hold records that never
  // went through fetchStaticData's filtering.
  const imageUrl = safeUrl(seizure.images[0]);
  const sourceUrl = safeUrl(seizure.source.url);
  return (
    <div className={styles.container}>
      <div className={styles.classified}>CLASSIFIED</div>
      <div className={styles.header}>
        <span className={styles.caseLabel}>CASE FILE</span>
        {seizure.caseNo && (
          <span className={styles.caseNo}>{seizure.caseNo}</span>
        )}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close case file">
          ✕
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.drugType}>
          <span className={`${styles.badge} ${getSeverityClass(seizure.quantityKg)}`}>
            {seizure.drugType.toUpperCase()}
          </span>
        </div>

        {imageUrl && (
          <div className={styles.imageContainer}>
            <img
              src={imageUrl}
              alt="Drug seizure"
              className={styles.image}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        <div className={styles.dataGrid}>
          <div className={styles.dataRow}>
            <span className={styles.label}>LOCATION</span>
            <span className={styles.value}>
              {seizure.location.city}, {seizure.location.state}
            </span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.label}>QUANTITY</span>
            <span className={`${styles.value} ${styles.quantity} ${getSeverityClass(seizure.quantityKg)}`}>
              {formatQuantity(seizure.quantityKg)}
            </span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.label}>DATE</span>
            <span className={styles.value}>{formatDate(seizure.date)}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.label}>AGENCY</span>
            <span className={styles.value}>{seizure.agency}</span>
          </div>
          <div className={styles.dataRow}>
            <span className={styles.label}>SOURCE</span>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                {seizure.source.name} ↗
              </a>
            ) : (
              <span className={styles.value}>{seizure.source.name}</span>
            )}
          </div>
        </div>

        {seizure.description && (
          <div className={styles.description}>
            <span className={styles.label}>INTEL</span>
            <p>{DOMPurify.sanitize(seizure.description)}</p>
          </div>
        )}

        <DrugIntelCard drugType={seizure.drugType} seizures={seizures} />
      </div>

      <div className={styles.footer}>
        <span className={styles.timestamp}>
          {new Date(seizure.date).toISOString()}
        </span>
      </div>
    </div>
  );
}
