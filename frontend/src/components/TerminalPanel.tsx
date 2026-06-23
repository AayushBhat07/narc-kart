/* Hallmark · genre: tactical · panel: terminal */
import { useState, useRef, useEffect } from 'react';
import { Seizure } from '../types';
import styles from './TerminalPanel.module.css';

interface Props {
  seizures: Seizure[];
}

type LineType = 'system' | 'input' | 'output' | 'error' | 'success' | 'accent';

interface Line {
  type: LineType;
  text: string;
}

const HELP_TEXT = `
NARC KART TERMINAL v2.0
Available commands:
  help           Show this help
  stats          Display summary statistics
  top <n>        Show top N seizures by volume (default 5)
  find <drug>    Find seizures by drug type
  states         List all states with seizure counts
  agencies       List top agencies by volume
  recent <n>     Show N most recent seizures (default 5)
  clear          Clear terminal output
  about          About NARC KART
`.trim();

function formatKg(kg: number) { return `${kg.toFixed(1)}KG`; }
function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); }
  catch { return d; }
}

function getSeverity(kg: number) {
  if (kg > 100) return 'CRIT';
  if (kg > 10)  return 'HIGH';
  return 'LOW';
}

function buildStats(seizures: Seizure[]) {
  const total = seizures.length;
  const totalKg = seizures.reduce((s, sz) => s + (sz.quantityKg || 0), 0);
  const byType: Record<string, number> = {};
  seizures.forEach(s => { byType[s.drugType] = (byType[s.drugType] || 0) + 1; });
  const topDrug = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  return { total, totalKg, topDrug: topDrug ? `${topDrug[0]} (${topDrug[1]})` : '—' };
}

export function TerminalPanel({ seizures }: Props) {
  const [lines, setLines] = useState<Line[]>([
    { type: 'system', text: 'NARC KART TERMINAL v2.0 — Type "help" for commands' },
    { type: 'accent', text: '──────────────────────────────────────────────────' },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const addLine = (type: LineType, text: string) =>
    setLines(l => [...l, { type, text }]);

  const runCommand = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    const args = raw.trim().split(/\s+/).slice(1);
    addLine('input', `> ${raw}`);

    if (cmd === 'help') {
      HELP_TEXT.split('\n').forEach(l => addLine('output', l));
    } else if (cmd === 'stats') {
      const { total, totalKg, topDrug } = buildStats(seizures);
      addLine('output', `TOTAL SEIZURES   : ${total}`);
      addLine('output', `TOTAL VOLUME     : ${totalKg >= 1000 ? `${(totalKg/1000).toFixed(2)}T` : `${totalKg.toFixed(1)}KG`}`);
      addLine('output', `TOP DRUG TYPE    : ${topDrug}`);
    } else if (cmd === 'clear') {
      setLines([{ type: 'system', text: 'Terminal cleared.' }]);
    } else if (cmd === 'about') {
      addLine('output', 'NARC KART — Indian Drug Seizure Intelligence Dashboard');
      addLine('output', 'Data: Public NCB/News records | Built with React + Leaflet');
    } else if (cmd.startsWith('top')) {
      const n = Math.min(parseInt(args[0] || '5'), 20);
      const sorted = [...seizures].sort((a, b) => (b.quantityKg || 0) - (a.quantityKg || 0)).slice(0, n);
      addLine('output', `TOP ${n} SEIZURES BY VOLUME`);
      sorted.forEach((sz, i) => {
        const sev = getSeverity(sz.quantityKg || 0);
        addLine('output', `[${String(i+1).padStart(2,'0')}] ${sev} ${sz.location?.city}, ${sz.location?.state} — ${sz.drugType} ${formatKg(sz.quantityKg || 0)}`);
      });
    } else if (cmd.startsWith('find')) {
      const drug = args.join(' ').toUpperCase();
      if (!drug) { addLine('error', 'Usage: find <drug-type>'); return; }
      const results = seizures.filter(s => s.drugType.toUpperCase().includes(drug));
      addLine('output', `${results.length} RESULTS FOR "${drug}"`);
      results.slice(0, 10).forEach(sz => {
        addLine('output', `  ${sz.location?.city}, ${sz.location?.state} — ${formatKg(sz.quantityKg || 0)} [${formatDate(sz.date)}]`);
      });
    } else if (cmd === 'states') {
      const m: Record<string, number> = {};
      seizures.forEach(s => { const st = s.location?.state || '?'; m[st] = (m[st] || 0) + 1; });
      Object.entries(m).sort((a, b) => b[1] - a[1]).forEach(([st, cnt]) => {
        addLine('output', `  ${st.padEnd(20)} ${String(cnt).padStart(4)} REC`);
      });
    } else if (cmd === 'agencies') {
      const m: Record<string, number> = {};
      seizures.forEach(s => { const a = s.agency || '?'; m[a] = (m[a] || 0) + 1; });
      Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([a, cnt]) => {
        addLine('output', `  ${a.substring(0, 30).padEnd(30)} ${String(cnt).padStart(4)} REC`);
      });
    } else if (cmd.startsWith('recent')) {
      const n = Math.min(parseInt(args[0] || '5'), 20);
      const sorted = [...seizures].filter(s => s.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, n);
      addLine('output', `${n} MOST RECENT SEIZURES`);
      sorted.forEach((sz, i) => {
        addLine('output', `[${String(i+1).padStart(2,'0')}] ${sz.location?.city}, ${sz.location?.state} — ${sz.drugType} ${formatKg(sz.quantityKg || 0)} [${formatDate(sz.date)}]`);
      });
    } else if (cmd === '') {
      // just prompt
    } else {
      addLine('error', `Command not found: ${cmd}. Type "help" for available commands.`);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = input.trim();
      if (val) {
        setCmdHistory(h => [val, ...h].slice(0, 30));
        setHistoryIdx(-1);
        runCommand(val);
      }
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(next);
      if (cmdHistory[next]) setInput(cmdHistory[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setInput(next === -1 ? '' : cmdHistory[next] || '');
    }
  };

  return (
    <div className={styles.panel} role="region" aria-label="Terminal">
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>TERMINAL</span>
        <button className={styles.panelClose} onClick={() => {
          // parent handles close via onClose prop
        }} aria-label="Close terminal">✕</button>
      </div>

      <div className={styles.terminal} role="log" aria-live="polite" aria-label="Terminal output">
        {lines.map((line, i) => (
          <div key={i} className={`${styles.outputLine} ${styles[`outputLine--${line.type}`]}`}>
            {line.type === 'input' && <span className={styles.prompt} aria-hidden="true">{'>'}</span>}
            <span className={styles.outputText}>{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <label htmlFor="terminal-input" className={styles.inputPromptLabel} aria-hidden="true">NK{'>'}</label>
        <input
          id="terminal-input"
          ref={inputRef}
          className={styles.inputField}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="type a command…"
          aria-label="Terminal input"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
