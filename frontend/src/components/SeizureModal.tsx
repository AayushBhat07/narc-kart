import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { Seizure } from '../types';
import { SeizurePopup } from './SeizurePopup';
import styles from './SeizureModal.module.css';

interface Props {
  seizure: Seizure | null;
  onClose: () => void;
}

export function SeizureModal({ seizure, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && seizure) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [seizure, onClose]);

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
            <SeizurePopup seizure={seizure} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}