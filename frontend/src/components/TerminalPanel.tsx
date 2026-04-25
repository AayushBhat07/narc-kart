import { useState, useRef, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import styles from './TerminalPanel.module.css';

export function TerminalPanel() {
  const { stats } = useApi();
  const [lines, setLines] = useState<Array<{ type: 'input' | 'output' | 'error'; text: string }>>([
    { type: 'output', text: 'NARC TERMINAL v1.0 — Type "help" for commands' },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const execute = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;

    setCmdHistory(h => [cmd, ...h].slice(0, 20));
    setHistoryIdx(-1);

    if (cmd === 'clear') {
      setLines([{ type: 'output', text: 'Terminal cleared' }]);
      return;
    }

    if (cmd === 'help') {
      setLines(l => [...l, { type: 'input', text: raw }, { type: 'output', text: 'Available commands: help, stats, seizures, clear, whoami, date' }]);
      return;
    }

    if (cmd === 'whoami') {
      setLines(l => [...l, { type: 'input', text: raw }, { type: 'output', text: 'narc.operator' }]);
      return;
    }

    if (cmd === 'date') {
      setLines(l => [...l, { type: 'input', text: raw }, { type: 'output', text: new Date().toISOString() }]);
      return;
    }

    if (cmd === 'stats') {
      const out = `TOTAL SEIZURES  : ${stats?.totalSeizures ?? 0}\nRAID THIS WEEK   : ${stats?.raidsThisWeek ?? 0}\nTOTAL QUANTITY  : ${stats?.totalQuantityKg?.toFixed(1) ?? 0} KG`;
      setLines(l => [...l, { type: 'input', text: raw }, { type: 'output', text: out }]);
      return;
    }

    if (cmd === 'seizures') {
      const out = stats?.topLocations?.slice(0, 5).map((l, i) => `${i + 1}. ${l.city}, ${l.state} — ${l.totalKg.toFixed(1)}KG`).join('\n') || 'No data';
      setLines(l => [...l, { type: 'input', text: raw }, { type: 'output', text: out }]);
      return;
    }

    setLines(l => [...l, { type: 'input', text: raw }, { type: 'error', text: `Unknown command: ${cmd}` }]);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      execute(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(next);
      setInput(cmdHistory[next] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setInput(next === -1 ? '' : cmdHistory[next] || '');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.icon}>▣</span>
        <span className={styles.title}>TERMINAL</span>
      </div>

      <div className={styles.output}>
        {lines.map((line, i) => (
          <div key={i} className={`${styles.line} ${styles[line.type]}`}>
            {line.type === 'input' && <span className={styles.prompt}>›</span>}
            <span className={line.type === 'input' ? styles.cmdText : styles.outText}>{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <span className={styles.prompt}>NARC@TERMINAL&gt;</span>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="enter command..."
          autoFocus
        />
      </div>
    </div>
  );
}