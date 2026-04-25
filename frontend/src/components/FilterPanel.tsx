import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilterState, DrugType } from '../types';
import styles from './FilterPanel.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  onReset: () => void;
}

const TIME_PERIODS = [
  { value: 'all', label: 'ALL TIME' },
  { value: '7d', label: 'LAST 7 DAYS' },
  { value: '30d', label: 'LAST 30 DAYS' },
  { value: '90d', label: 'LAST 90 DAYS' },
  { value: '1y', label: 'LAST YEAR' },
];

const DRUG_TYPES: { value: DrugType; label: string }[] = [
  { value: 'heroin', label: 'HEROIN' },
  { value: 'cocaine', label: 'COCAINE' },
  { value: 'meth', label: 'METH' },
  { value: 'cannabis', label: 'CANNABIS' },
  { value: 'methaqualone', label: 'METHOLONE' },
  { value: 'other', label: 'OTHER' },
];

const STATES = [
  'Maharashtra', 'Delhi', 'Punjab', 'Tamil Nadu', 'West Bengal',
  'Rajasthan', 'Goa', 'Telangana', 'Gujarat', 'Karnataka',
  'Kerala', 'Andhra Pradesh', 'Madhya Pradesh', 'Uttar Pradesh',
  'Bihar', 'Odisha', 'Assam', 'Jharkhand',
];

export function FilterPanel({ isOpen, onClose, filters, onApply, onReset }: Props) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  const handleTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalFilters({ ...localFilters, timePeriod: e.target.value as FilterState['timePeriod'] });
  };

  const handleDrugToggle = (drug: DrugType) => {
    const current = localFilters.drugTypes;
    const updated = current.includes(drug)
      ? current.filter((d) => d !== drug)
      : [...current, drug];
    setLocalFilters({ ...localFilters, drugTypes: updated });
  };

  const handleStateToggle = (state: string) => {
    const current = localFilters.states;
    const updated = current.includes(state)
      ? current.filter((s) => s !== state)
      : [...current, state];
    setLocalFilters({ ...localFilters, states: updated });
  };

  const handleSeverityChange = (e: React.ChangeEvent<HTMLInputElement>, bound: 'min' | 'max') => {
    const value = parseInt(e.target.value);
    setLocalFilters({
      ...localFilters,
      severityMin: bound === 'min' ? value : localFilters.severityMin,
      severityMax: bound === 'max' ? value : localFilters.severityMax,
    });
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleReset = () => {
    setLocalFilters({
      timePeriod: 'all',
      drugTypes: [] as DrugType[],
      states: [] as string[],
      severityMin: 0,
      severityMax: 500,
    });
    onReset();
  };

  const activeCount =
    (localFilters.timePeriod !== 'all' ? 1 : 0) +
    localFilters.drugTypes.length +
    localFilters.states.length +
    (localFilters.severityMin > 0 || localFilters.severityMax < 500 ? 1 : 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <div className={styles.panel}>
            <div className={styles.header}>
              <span className={styles.title}>FILTER OPS</span>
              {activeCount > 0 && (
                <span className={styles.badge}>{activeCount}</span>
              )}
              <button className={styles.closeBtn} onClick={onClose}>
                [X]
              </button>
            </div>

            <div className={styles.content}>
              <div className={styles.field}>
                <label className={styles.label}>TIME PERIOD</label>
                <select
                  value={localFilters.timePeriod}
                  onChange={handleTimeChange}
                  className={styles.select}
                >
                  {TIME_PERIODS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>DRUG TYPE</label>
                <div className={styles.chipGroup}>
                  {DRUG_TYPES.map((d) => (
                    <button
                      key={d.value}
                      className={`${styles.chip} ${
                        localFilters.drugTypes.includes(d.value) ? styles.active : ''
                      }`}
                      onClick={() => handleDrugToggle(d.value)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>STATE</label>
                <div className={styles.chipGroup}>
                  {STATES.map((s) => (
                    <button
                      key={s}
                      className={`${styles.chip} ${
                        localFilters.states.includes(s) ? styles.active : ''
                      }`}
                      onClick={() => handleStateToggle(s)}
                    >
                      {s.substring(0, 3).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>SEVERITY (KG)</label>
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderRow}>
                    <span>MIN: {localFilters.severityMin}KG</span>
                    <input
                      type="range"
                      min={0}
                      max={500}
                      step={5}
                      value={localFilters.severityMin}
                      onChange={(e) => handleSeverityChange(e, 'min')}
                      className={styles.slider}
                    />
                  </div>
                  <div className={styles.sliderRow}>
                    <span>MAX: {localFilters.severityMax}KG</span>
                    <input
                      type="range"
                      min={0}
                      max={500}
                      step={5}
                      value={localFilters.severityMax}
                      onChange={(e) => handleSeverityChange(e, 'max')}
                      className={styles.slider}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.footer}>
              <button className={styles.executeBtn} onClick={handleApply}>
                [EXECUTER]
              </button>
              <button className={styles.clearBtn} onClick={handleReset}>
                [CLEAR]
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
