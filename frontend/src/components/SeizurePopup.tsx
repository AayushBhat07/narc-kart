import DOMPurify from 'dompurify';
import { Seizure } from '../types';
import styles from './SeizurePopup.module.css';

interface Props {
  seizure: Seizure;
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

export function SeizurePopup({ seizure }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.classified}>CLASSIFIED</div>
      <div className={styles.header}>
        <span className={styles.caseLabel}>CASE FILE</span>
        {seizure.caseNo && (
          <span className={styles.caseNo}>{seizure.caseNo}</span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.drugType}>
          <span className={`${styles.badge} ${getSeverityClass(seizure.quantityKg)}`}>
            {seizure.drugType.toUpperCase()}
          </span>
        </div>

        {seizure.images.length > 0 && (
          <div className={styles.imageContainer}>
            <img
              src={seizure.images[0]}
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
            <a
              href={seizure.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              {seizure.source.name} ↗
            </a>
          </div>
        </div>

        {seizure.description && (
          <div className={styles.description}>
            <span className={styles.label}>INTEL</span>
            <p>{DOMPurify.sanitize(seizure.description)}</p>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.timestamp}>
          {new Date(seizure.date).toISOString()}
        </span>
      </div>
    </div>
  );
}
