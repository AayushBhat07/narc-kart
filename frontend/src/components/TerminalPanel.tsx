import { useState, useRef, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import styles from './TerminalPanel.module.css';

export function TerminalPanel() {
    const { seizures, stats } = useApi();
    const [lines, setLines] = useState<Array<{ type: 'input' | 'output' | 'error'; text: string }>>([
        { type: 'output', text: 'NARC TERMINAL v2.0 — Type "help" for commands' },
    ]);
    const [input, setInput] = useState('');
    const [cmdHistory, setCmdHistory] = useState<string[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [lines]);

    const addLine = (type: 'input' | 'output' | 'error', text: string, cmd?: string) => {
        const newLines = [...lines];
        if (cmd) newLines.push({ type: 'input', text: cmd });
        newLines.push({ type, text });
        setLines(newLines.slice(-100));
    };

    const exportData = () => {
        const data = JSON.stringify({ seizures, stats, exportedAt: new Date().toISOString() }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `narc-kart-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return 'Data exported to JSON file';
    };

    const searchSeizures = (query: string) => {
        const q = query.toLowerCase();
        const results = seizures.filter(s =>
            s.location.city.toLowerCase().includes(q) ||
            s.location.state.toLowerCase().includes(q) ||
            s.drugType.toLowerCase().includes(q) ||
            s.agency.toLowerCase().includes(q) ||
            (s.description?.toLowerCase().includes(q) ?? false)
        );
        if (results.length === 0) return 'No results found';
        return results.slice(0, 5).map((s, i) =>
            `${i + 1}. [${s.drugType.toUpperCase()}] ${s.location.city}, ${s.location.state} — ${s.quantityKg}KG`
        ).join('\n') + `\n\nFound ${results.length} total matches`;
    };

    const filterByDrug = (drug: string) => {
        const d = drug.toLowerCase();
        const results = seizures.filter(s => s.drugType.toLowerCase() === d);
        if (results.length === 0) return `No seizures for drug: ${drug}`;
        const total = results.reduce((sum, s) => sum + s.quantityKg, 0);
        return `${results.length} seizures of ${drug.toUpperCase()}\nTotal: ${total.toFixed(1)}KG`;
    };

    const filterByState = (state: string) => {
        const s = state.toLowerCase();
        const results = seizures.filter(se => se.location.state.toLowerCase() === s);
        if (results.length === 0) return `No seizures in state: ${state}`;
        const total = results.reduce((sum, se) => sum + se.quantityKg, 0);
        return `${results.length} seizures in ${results[0].location.state}\nTotal: ${total.toFixed(1)}KG`;
    };

    const showTop = (n = 5) => {
        const sorted = [...seizures].sort((a, b) => b.quantityKg - a.quantityKg).slice(0, n);
        return sorted.map((s, i) =>
            `${i + 1}. ${s.quantityKg >= 1000 ? (s.quantityKg / 1000).toFixed(1) + 'T' : s.quantityKg + 'KG'} — ${s.location.city}, ${s.location.state} [${s.drugType.toUpperCase()}]`
        ).join('\n');
    };

    const showStates = () => {
        if (!stats?.byState) return 'No state data';
        return Object.entries(stats.byState)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 10)
            .map(([state, count]) => `${state}: ${count}`)
            .join('\n');
    };

    const execute = (raw: string) => {
        const cmd = raw.trim().toLowerCase();
        if (!cmd) return;

        setCmdHistory(h => [raw, ...h].slice(0, 50));
        setHistoryIdx(-1);

        if (cmd === 'clear') {
            setLines([{ type: 'output', text: 'Terminal cleared' }]);
            return;
        }

        if (cmd === 'help') {
            addLine('output', `Available commands:
  help          Show this help
  stats         Show overall statistics
  seizures      Top 5 seizure locations
  top           Top 5 seizures by quantity
  states        Top 10 states by count
  search <q>    Search seizures (city, drug, agency)
  filter <drug>  Filter by drug type
  state <name>  Filter by state
  export        Export data as JSON
  whoami        Show current user
  date          Show current date/time
  clear         Clear terminal`, raw);
            return;
        }

        if (cmd === 'whoami') {
            addLine('output', 'narc.operator', raw);
            return;
        }

        if (cmd === 'date') {
            addLine('output', new Date().toISOString(), raw);
            return;
        }

        if (cmd === 'stats') {
            const out = `TOTAL SEIZURES  : ${stats?.totalSeizures ?? 0}
RAID THIS WEEK   : ${stats?.raidsThisWeek ?? 0}
TOTAL QUANTITY   : ${((stats?.totalQuantityKg ?? 0) / 1000).toFixed(1)} T
STATES ACTIVE    : ${stats?.byState ? Object.keys(stats.byState).length : 0}
DRUG TYPES       : ${stats?.byDrugType ? Object.keys(stats.byDrugType).length : 0}`;
            addLine('output', out, raw);
            return;
        }

        if (cmd === 'seizures') {
            const out = stats?.topLocations?.slice(0, 5).map((l, i) =>
                `${i + 1}. ${l.city}, ${l.state} — ${l.totalKg >= 1000 ? (l.totalKg / 1000).toFixed(1) + 'T' : l.totalKg.toFixed(0) + 'KG'}`
            ).join('\n') || 'No data';
            addLine('output', out, raw);
            return;
        }

        if (cmd === 'top') {
            addLine('output', showTop(5), raw);
            return;
        }

        if (cmd === 'states') {
            addLine('output', showStates(), raw);
            return;
        }

        if (cmd.startsWith('search ')) {
            const query = raw.substring(7).trim();
            if (!query) {
                addLine('error', 'Usage: search <query>', raw);
                return;
            }
            addLine('output', searchSeizures(query), raw);
            return;
        }

        if (cmd.startsWith('filter ')) {
            const drug = raw.substring(7).trim();
            if (!drug) {
                addLine('error', 'Usage: filter <drug_type>', raw);
                return;
            }
            addLine('output', filterByDrug(drug), raw);
            return;
        }

        if (cmd.startsWith('state ')) {
            const state = raw.substring(6).trim();
            if (!state) {
                addLine('error', 'Usage: state <state_name>', raw);
                return;
            }
            addLine('output', filterByState(state), raw);
            return;
        }

        if (cmd === 'export') {
            addLine('output', exportData(), raw);
            return;
        }

        addLine('error', `Unknown command: ${cmd.split(' ')[0]}. Type "help" for available commands.`, raw);
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