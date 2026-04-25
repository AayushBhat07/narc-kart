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
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className={styles.closeBtn} onClick={onClose}>
              [X] CLOSE
            </button>
            <SeizurePopup seizure={seizure} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
