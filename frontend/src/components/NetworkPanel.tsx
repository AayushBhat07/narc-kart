import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import styles from './NetworkPanel.module.css';

interface LocationEntry {
  location: string;
  count: number;
}

interface CityEntry {
  city: string;
  state: string;
  count: number;
}

interface StateEntry {
  name: string;
  abbr: string;
  total: number;
  cities: CityEntry[];
}

const STATE_ABBR: Record<string, string> = {
  'Delhi': 'DL',
  'Maharashtra': 'MH',
  'Punjab': 'PB',
  'Gujarat': 'GJ',
  'Uttar Pradesh': 'UP',
  'Rajasthan': 'RJ',
  'Tamil Nadu': 'TN',
  'Karnataka': 'KA',
  'Kerala': 'KL',
  'West Bengal': 'WB',
  'Andhra Pradesh': 'AP',
  'Telangana': 'TS',
  'Madhya Pradesh': 'MP',
  'Bihar': 'BR',
  'Odisha': 'OD',
  'Haryana': 'HR',
  'Jharkhand': 'JH',
  'Chhattisgarh': 'CT',
  'Jammu & Kashmir': 'JK',
  'Uttarakhand': 'UK',
  'Assam': 'AS',
  'Himachal Pradesh': 'HP',
  'Goa': 'GA',
  'Manipur': 'MN',
  'Meghalaya': 'ML',
  'Nagaland': 'NL',
  'Tripura': 'TR',
  'Mizoram': 'MZ',
  'Arunachal Pradesh': 'AR',
  'Sikkim': 'SK',
  'Puducherry': 'PY',
  'Chandigarh': 'CH',
  'Andaman & Nicobar Islands': 'AN',
  'Ladakh': 'LA',
  'Lakshadweep': 'LD',
  'Dadra & Nagar Haveli': 'DN',
  'Daman & Diu': 'DD',
};

const SEVERITY_COLORS: Record<'critical' | 'high' | 'low', string> = {
  critical: '#E83D3D',
  high: '#FF8C42',
  low: '#FFCC00',
};

function getSeverity(count: number): 'critical' | 'high' | 'low' {
  if (count > 200) return 'critical';
  if (count > 100) return 'high';
  return 'low';
}

export function NetworkPanel() {
  const { stats } = useApi();
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());

  const topLocations: LocationEntry[] = (stats?.topLocations || []) as unknown as LocationEntry[];
  const byState: Record<string, number> = stats?.byState || {};

  const filteredLocations = topLocations.filter(
    (loc) => !String(loc.location).startsWith('India (aggregate')
  );

  const citiesByState: Record<string, CityEntry[]> = {};
  filteredLocations.forEach((loc) => {
    const parts = String(loc.location).split(', ');
    const city = parts[0] || '';
    const state = parts.slice(1).join(', ') || '';
    if (!city || !state) return;
    if (!citiesByState[state]) citiesByState[state] = [];
    citiesByState[state].push({ city, state, count: loc.count });
  });

  const stateEntries: StateEntry[] = Object.entries(byState)
    .filter(([name]) => String(name) !== 'India')
    .map(([name, total]) => ({
      name,
      abbr: STATE_ABBR[name] || name.substring(0, 2).toUpperCase(),
      total,
      cities: (citiesByState[name] || []).sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxCount = stateEntries[0]?.total || 1;

  function toggleState(name: string) {
    setExpandedStates((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  const BAR_CHART_H = 120;
  const BAR_W = 32;
  const BAR_GAP = 16;
  const LABEL_H = 32;
  const svgW = stateEntries.length * (BAR_W + BAR_GAP) + BAR_GAP + 40;
  const plotW = stateEntries.length * (BAR_W + BAR_GAP) + BAR_GAP;
  const chartX = 40;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.icon}>⬡</span>
        <span className={styles.title}>NETWORK</span>
      </div>

      <div className={styles.statusRow}>
        <span className={styles.statusDot} />
        <span className={styles.statusText}>TERRITORIAL INTEL</span>
        <span className={styles.nodeCount}>{stateEntries.length} STATES</span>
      </div>

      <div className={styles.graphArea}>
        <div className={styles.graphLabel}>TOP 10 STATES BY SEIZURE COUNT</div>
        <div className={styles.chartWrapper}>
          {stateEntries.length === 0 ? (
            <span className={styles.empty}>NO DATA AVAILABLE</span>
          ) : (
            <svg
              viewBox={`0 0 ${svgW} ${BAR_CHART_H + LABEL_H}`}
              className={styles.chartSvg}
              aria-label="Bar chart of top 10 states by seizure count"
            >
              {/* Y-axis gridlines */}
              {[0.25, 0.5, 0.75, 1].map((frac) => {
                const y = BAR_CHART_H - frac * BAR_CHART_H;
                const val = Math.round(frac * maxCount);
                return (
                  <g key={frac}>
                    <line
                      x1={chartX}
                      y1={y}
                      x2={chartX + plotW}
                      y2={y}
                      stroke="#262626"
                      strokeWidth="1"
                      strokeDasharray={frac === 1 ? 'none' : '3 3'}
                    />
                    <text
                      x={chartX - 4}
                      y={y + 4}
                      textAnchor="end"
                      fill="#626262"
                      fontSize="9"
                      fontFamily="'Share Tech Mono', 'Courier New', monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Bars */}
              {stateEntries.map((state, i) => {
                const barH = (state.total / maxCount) * (BAR_CHART_H - 24);
                const x = chartX + i * (BAR_W + BAR_GAP) + BAR_GAP;
                const y = BAR_CHART_H - barH;
                const severity = getSeverity(state.total);
                const color = SEVERITY_COLORS[severity];
                return (
                  <g key={state.name}>
                    <rect
                      x={x}
                      y={y}
                      width={BAR_W}
                      height={barH}
                      fill={color}
                      opacity="0.9"
                      rx="3"
                    />
                    <text
                      x={x + BAR_W / 2}
                      y={BAR_CHART_H + 14}
                      textAnchor="middle"
                      fill="#8E8E8E"
                      fontSize="9"
                      fontFamily="'Share Tech Mono', 'Courier New', monospace"
                    >
                      {state.abbr}
                    </text>
                    <text
                      x={x + BAR_W / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="9"
                      fontFamily="'Share Tech Mono', 'Courier New', monospace"
                    >
                      {state.total}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        <div className={styles.graphLegend}>
          <span className={styles.legendDot} style={{ borderColor: '#E83D3D' }} />
          <span className={styles.legendText}>{">200"}</span>
          <span className={styles.legendDot} style={{ borderColor: '#FF8C42' }} />
          <span className={styles.legendText}>{">100"}</span>
          <span className={styles.legendDot} style={{ borderColor: '#FFCC00' }} />
          <span className={styles.legendText}>{"<100"}</span>
        </div>
      </div>

      <div className={styles.tableArea}>
        <div className={styles.tableHeader}>
          <span>STATE</span>
          <span>SEIZURES</span>
          <span>DISTRIBUTION</span>
        </div>
        <div className={styles.tableBody}>
          {stateEntries.length === 0 ? (
            <div className={styles.tableEmpty}>NO DATA AVAILABLE</div>
          ) : (
            stateEntries.map((state) => {
              const isExpanded = expandedStates.has(state.name);
              const severity = getSeverity(state.total);
              const barPct = Math.max(4, (state.total / maxCount) * 100);
              return (
                <div key={state.name} className={styles.stateGroup}>
                  <button
                    className={`${styles.stateRow} ${isExpanded ? styles['stateRow--expanded'] : ''}`}
                    onClick={() => toggleState(state.name)}
                    aria-expanded={isExpanded}
                  >
                    <span className={styles.stateName}>{state.name}</span>
                    <span className={styles.stateCount}>{state.total}</span>
                    <div className={styles.barTrack}>
                      <div
                        className={`${styles.barFill} ${styles[`barFill--${severity}`]}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className={`${styles.chevron} ${isExpanded ? styles['chevron--open'] : ''}`}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </button>

                  <div
                    className={`${styles.cityList} ${isExpanded ? styles['cityList--open'] : ''}`}
                    style={isExpanded ? {} : { maxHeight: 0 }}
                    aria-hidden={!isExpanded}
                  >
                    {isExpanded && (
                      <div className={styles.cityListInner}>
                        {state.cities.length === 0 ? (
                          <div className={styles.cityEmpty}>No city data</div>
                        ) : (
                          state.cities.map((city) => (
                            <div key={city.city} className={styles.cityRow}>
                              <span className={styles.cityName}>{city.city}</span>
                              <span className={styles.cityCount}>{city.count}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
