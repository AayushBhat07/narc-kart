import { motion, AnimatePresence } from 'framer-motion';
import { Seizure } from '../types';
import { SeizurePopup } from './SeizurePopup';
import styles from './SeizureModal.module.css';

interface Props {
  seizure: Seizure | null;
  onClose: () => void;
}

export function SeizureModal({ seizure, onClose }: Props) {
  return (
    <AnimatePresence>
      {seizure && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <button className={styles.closeBtn} onClick={onClose}>
              ✕
            </button>
            <SeizurePopup seizure={seizure} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}