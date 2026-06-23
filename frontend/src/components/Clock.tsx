import { useEffect, useState } from 'react';
import styles from '../App.module.css';

/**
 * Isolated clock — owns its own 1Hz tick so the surrounding tree
 * (App, IndiaMap, 2,800+ SeizureAreas) does NOT re-render every second.
 */
export function Clock() {
  const [time, setTime] = useState(() => nowIst());

  useEffect(() => {
    const id = setInterval(() => setTime(nowIst()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <time className={styles.hudClock} dateTime={new Date().toISOString()}>
      {time} IST
    </time>
  );
}

function nowIst(): string {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}
