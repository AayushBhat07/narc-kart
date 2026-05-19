# Narc Kart — UX/UI Innovation Roadmap
**Prepared by:** UX/UI Innovation Agent | **Date:** 2026-05-19
**Aesthetic:** KiranaTrack Dark SaaS (pure black, terminal green `#00FF00`, signal red `#E83D3D` accent)

---

## Research Synthesis

### What I Found
| Source | Insight |
|---|---|
| **NCB India** (narcoticsindia.nic.in) | Dated government green aesthetic — no data viz, no dashboards. Opportunity: Narc Kart is already far more impressive. |
| **DEA Data Portal** | Clean stat cards, threat-level classifications, public-facing metrics. Reference for INTEL panel structure. |
| **Dark Dashboard Best Practices 2024-25** | Layered depth (bg-secondary cards on bg-primary), subtle borders over shadows, cyan/green on black, restrained animations. |
| **Cyberpunk HUD** | Scan sweeps, corner-bracket frames, glitch micro-text, monochrome with neon pop — all achievable with CSS. |

### Current Strengths to Preserve
- Radar sweep animation on map ✅
- CRT scanlines ✅
- Terminal green glow aesthetic ✅
- Working command-line in TERMINAL panel ✅
- Circular node graph in NETWORK panel ✅
- Live feed sidebar ✅

### Critical Gap
**Accent color `#E83D3D` (signal red) is in SPEC.md but absent from `design-tokens.css`** — the code still uses `#00FF00` for everything. The red accent needs to be wired in for severity indicators and threat levels.

---

## Prioritized Roadmap (Top 5-7 Enhancements)

---

### 🚨 PRIORITY 1: Threat Level Indicator
**Difficulty:** EASY | **Impact:** HIGH

#### Description
A pulsing "THREAT LEVEL" badge in the Header that changes color based on recent seizure volume and weight.

#### Visual Detail
```
┌─────────────────────────────────────────────────────────┐
│ [NARC KART v1.0]        [⚠ ELEVATED ▲]  [Refresh] [⚙] │
└─────────────────────────────────────────────────────────┘
```
- **LOW** → Green (`#00FF00`) — normal operations
- **ELEVATED** → Amber (`#FFCC00`) — spike in activity
- **HIGH** → Red (`#E83D3D`) — major seizure detected, pulses
- **CRITICAL** → Deep red with glitch flicker animation

The indicator sits in the Header, left of the title or integrated into the `datetime` block. It updates on each data refresh. The ▲ shows a trend arrow (up/down/neutral vs. last week).

#### UX Value
Immediately communicates system status without the user having to interpret stats. First thing an operator sees = situational awareness in 1 second. For a portfolio piece, it reads as "this is a real monitoring system."

#### Implementation Hint
```tsx
// In AppContext or Header.tsx
const threatLevel = useMemo(() => {
  const weekly = stats?.raidsThisWeek ?? 0;
  if (weekly > 50 || (stats?.totalQuantityKg ?? 0) > 500) return 'CRITICAL';
  if (weekly > 20 || (stats?.totalQuantityKg ?? 0) > 200) return 'HIGH';
  if (weekly > 10) return 'ELEVATED';
  return 'LOW';
}, [stats]);
// Render with CSS animation class toggled by level
```

---

### 🔍 PRIORITY 2: Global Search Bar
**Difficulty:** MEDIUM | **Impact:** HIGH

#### Description
A full-width command bar in the Header that lets users search cities, drug types, states, or seizure IDs — filtering the map and all panels in real-time.

#### Visual Detail
```
┌──────────────────────────────────────────────────────────────────┐
│ [NARC KART v1.0]  [🔍 Search cities, drug types, states...    ]  │
│ [THREAT LEVEL]   [Refresh] [Filters] [⚙]  [19 May 2026 16:35] │
└──────────────────────────────────────────────────────────────────┘
```
- **Idle:** Dim placeholder text, monospace font
- **Focused:** Glowing green border (`box-shadow: 0 0 12px var(--border-glow)`)
- **Results dropdown:** Dark card overlay with matching seizure entries, click to zoom map
- **No results:** "NO INTEL FOUND" in muted green

Matches should highlight in `#E83D3D` red — the accent color — making found terms pop.

#### UX Value
Core navigation pattern for any intelligence tool. Lets operators jump directly to a location or drug without clicking through panels. A portfolio demo goes from "nice map" to "usable product" with search.

#### Implementation Hint
```tsx
// In Header.tsx — search state lifted to App
const [searchQuery, setSearchQuery] = useState('');

const filtered = seizures.filter(s =>
  s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
  s.drugType.toLowerCase().includes(searchQuery.toLowerCase()) ||
  s.state.toLowerCase().includes(searchQuery.toLowerCase())
);
// Pass filtered seizures down; if search active, show only matches on map
```

---

### 🗺️ PRIORITY 3: Map Intelligence Layer
**Difficulty:** MEDIUM | **Impact:** HIGH

#### Description
Three map enhancements: (a) tile style switcher, (b) marker clustering, (c) Indian state boundary overlay.

#### Visual Detail — Tile Switcher
A small floating pill selector in the map corner:
```
[ 🛰️ SATELLITE ] [ 🌑 DARK ] [ ⬛ GRID ]
```
Three tile options:
- **DARK** (current): CartoDB Dark — already great
- **SATELLITE**: Esri World Imagery — dramatic, feels surveillance-grade
- **GRID**: Stamen Toner or CartoDB Positron with grid lines — tactical feel

#### Visual Detail — Marker Clustering
Dense seizure areas cluster into a single badge showing count:
```
    [23]
    ●
```
Cluster color scales with seizure weight (green → amber → red). Click to zoom and expand.

#### Visual Detail — India State Overlay
Thin cyan (`#00FFFF`) borders on Indian state boundaries, visible on all tile styles. Subtle but reads "this is India-specific intelligence."

#### UX Value
Different tile styles serve different use cases: Satellite looks impressive in demos, Grid feels tactical for analysis. Clustering is essential when real data scales — a portfolio piece needs to handle density gracefully.

#### Implementation Hint
```tsx
// react-leaflet cluster via leaflet.markercluster
import MarkerClusterGroup from 'react-leaflet-cluster';

<TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
// For state boundaries: use @react-geojson/geojson or a static India.geojson
```

---

### ⌨️ PRIORITY 4: TERMINAL Panel Upgrade
**Difficulty:** EASY-MEDIUM | **Impact:** MEDIUM

#### Description
Expand the existing Terminal from 6 commands to 15+ with tab completion, colored output, and command categories.

#### Visual Detail
```
NARC@TERMINAL> help
AVAILABLE COMMANDS
──────────────────────────────────────────
[INTEL]   stats | seizures | top5 | drugmap
[NAV]     radar | intel | network | terminal
[SYS]     whoami | date | time | version | uptime
[EXPORT]  export csv | export json
[NET]     nodes | connections | hub
[UTIL]    clear | help | man <cmd>
──────────────────────────────────────────
NARC@TERMINAL> _
```
- `[INTEL]` category outputs in green (normal data)
- Errors in red (`#E83D3D`)
- Warnings in amber
- `man <command>` shows usage details
- Tab completion on first letter
- Blinking cursor with `▋` character

#### UX Value
The terminal is the most distinctive "power user" feature. It signals that this is a real intelligence tool, not a toy dashboard. Expanded commands make it genuinely useful while remaining a portfolio showpiece.

#### Implementation Hint
```tsx
// Extend the execute() switch with new commands
const COMMANDS = {
  'top5':    () => stats?.topLocations?.slice(0,5).map(...).join('\n'),
  'drugmap': () => Object.entries(stats?.byDrugType ?? {}).map(...).join('\n'),
  'nodes':   () => `${stats?.topLocations?.length ?? 0} active nodes`,
  'export csv': () => { /* trigger download */ return 'Generating CSV...'; },
  // tab completion
  'onKeyDown': (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const match = ALL_CMDS.find(c => c.startsWith(input));
      if (match) setInput(match);
    }
  }
};
```

---

### 📊 PRIORITY 5: INTEL Panel — Visualization Overhaul
**Difficulty:** MEDIUM | **Impact:** HIGH

#### Description
Replace static stat cards with interactive Recharts-style visualizations that update when filters change.

#### Visual Detail — Seizure Timeline (Bar Chart)
```
SEIZURE FREQUENCY — 30 DAYS
──────────────────────────────────────────────
▌  ▌        ▌  ▌     ▌▌  ▌              ▌▌
01  05  10  15  20  25  30  [hover: show date + count]
──────────────────────────────────────────────
```
Horizontal bar chart, last 30 days. Bars in `#00FF00`, spike events (major seizures) in `#E83D3D`.

#### Visual Detail — Drug Type Heatmap
A 2D grid: States (Y-axis) × Drug Types (X-axis), cell color intensity = seizure count.
```
         HEROIN  COCAINE  CANNABIS  METH  TRAMADOL
MAHARASHTRA  ████   ██       ██     ███     █
GUJARAT      ██     █        ██     ██     ████
DELHI        ███    ████     █       █      ██
```
Cells in green intensity, max value cell in red.

#### Visual Detail — State Pie/Radial Chart
A Donut chart (not pie — cleaner in dark mode) showing % share by state. Interactive: click a segment to filter map to that state.

#### UX Value
Data visualization is what takes a dashboard from "data display" to "intelligence platform." The DEA's own public data page uses charts — it's expected in this category. For Aayush's portfolio, these are the screenshots that impress.

#### Implementation Hint
```tsx
// Install recharts: npm install recharts
import { BarChart, RadialChart, HeatMap } from 'your-preferred-lib';
// OR use lightweight: npm install轻盈 versions
// BarChart for timeline, custom SVG donut for state share,
// CSS grid with inline style color-intensity for heatmap
```

---

### 📅 PRIORITY 6: Timeline View (New Tab)
**Difficulty:** MEDIUM | **Impact:** MEDIUM

#### Description
A horizontal scrollable timeline showing seizure events chronologically, with zoom levels (day/week/month) and severity-coded event markers.

#### Visual Detail
```
◀ [MAY 2026 ▼] ▶
──────────────────────────────────────────────────────────────────
●        ●         ●                    ●      ●  ●
01      05        10        15         20     25  30
[=======SEIZURE CLUSTER=======]
  ↑
  MUMBAI — 240KG HEROIN (CRITICAL)
  Hover tooltip: date, city, drug type, weight, agency

← Scroll for older data
```
- **Normal seizure:** Small green dot
- **Major (>100kg):** Red diamond `◆` with pulse animation
- **Critical (>500kg):** Red diamond with glitch flicker
- **Zoom levels:** Day / Week / Month — toggle in timeline header
- Active time window highlighted with subtle green overlay

#### UX Value
Intelligence analysts think temporally — "when did activity spike in Maharashtra?" A timeline answers that at a glance. It also makes the dataset feel alive and historical rather than a static snapshot. Excellent portfolio visual.

#### Implementation Hint
```tsx
// Group seizures by date
const byDate = seizures.reduce((acc, s) => {
  const key = dayjs(s.date).format('YYYY-MM-DD');
  (acc[key] ??= []).push(s);
  return acc;
}, {});

// Render as horizontal scroll container
// Each date slot = flex column; events = absolutely positioned dots
// Use CSS overflow-x: scroll with scroll-snap-type
```

---

### 📤 PRIORITY 7: Export — Download Report
**Difficulty:** EASY | **Impact:** MEDIUM

#### Description
A "DOWNLOAD REPORT" button in the Header or Footer that exports the current filtered dataset as CSV or PDF.

#### Visual Detail
```
┌──────────────────────────────────────────────────────────┐
│ [NARC KART v1.0]  [Search...]    [DOWNLOAD ▼] [⚙]      │
│                   [THREAT: ELEVATED]     19 May 2026     │
└──────────────────────────────────────────────────────────┘
                                    ↓
                                  [CSV]
                                  [PDF]
```
Dropdown with two options: `CSV` (data table) and `PDF` (styled report with Narc Kart branding, stats summary, and map screenshot).

#### UX Value
Real intelligence tools have audit trails and reporting. CSV export lets stakeholders use the data in their own tools. PDF makes it printable for briefings. For a portfolio piece, it demonstrates engineering completeness — the full product, not just the UI.

#### Implementation Hint
```tsx
// CSV: plain JS, no library needed
const csv = [
  ['Date', 'City', 'State', 'Drug Type', 'Quantity (KG)', 'Agency'],
  ...seizures.map(s => [s.date, s.city, s.state, s.drugType, s.quantityKg, s.agency])
].map(r => r.join(',')).join('\n');

// PDF: use jsPDF or @react-pdf/renderer
import jsPDF from 'jspdf';
const downloadPDF = () => {
  const doc = new jsPDF();
  doc.setFontSize(18); doc.text('Narc Kart Intelligence Report', 10, 20);
  // ... add stats, table, timestamp
  doc.save('narc-kart-report.pdf');
};
```

---

## Summary Table

| # | Enhancement | Difficulty | UX Impact | Notes |
|---|---|---|---|---|
| 1 | Threat Level Indicator | EASY | HIGH | One badge, high visual payoff |
| 2 | Global Search Bar | MEDIUM | HIGH | Core navigation pattern |
| 3 | Map: Clustering + Tile Switcher + State Bounds | MEDIUM | HIGH | Essential at scale |
| 4 | TERMINAL: Expand Commands | EASY-MEDIUM | MEDIUM | Already wired — just extend |
| 5 | INTEL: Recharts Visualizations | MEDIUM | HIGH | Bar + heatmap + donut |
| 6 | Timeline View | MEDIUM | MEDIUM | Horizontal scroll, new tab |
| 7 | Export: CSV + PDF | EASY | MEDIUM | Completes the product |

---

## Implementation Order Recommendation

```
Phase 1 (Quick wins — 1 session):
  → Threat Level Indicator (#1)
  → TERMINAL commands expansion (#4)
  → Export button (#7)

Phase 2 (Core features — 1-2 sessions):
  → Global Search (#2)
  → Map improvements (#3)

Phase 3 (Visualization — 1-2 sessions):
  → INTEL panel overhaul (#5)
  → Timeline view (#6)
```

---

## One Critical Fix First

Before building anything new: **replace the `--accent-red` usage gap.**

The SPEC says `#E83D3D` is the accent color, but `design-tokens.css` defines severity red as `#FF0040`. These should be unified:

```css
/* In design-tokens.css — replace the two RED definitions with one */
--accent-red: #E83D3D;        /* Signal red — ONE pop of color */
--status-critical: #E83D3D;   /* Use the same variable */
```

This ensures the entire design system uses the correct accent when the new components are built.