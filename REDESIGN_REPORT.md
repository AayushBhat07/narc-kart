# NARC KART — HALLMARK REDESIGN REPORT

## What Changed (Structural Overhaul)

### Before: Standard 3-Column SaaS Dashboard
- Fixed sidebar (160px) + center map/panel + fixed LiveFeed (280px)
- Classic SaaS layout — sidebar nav with text labels
- Cards, tables, static panels
- LiveFeed as a separate fixed column

### After: War Room Macrostructure
**Full-bleed map as the base layer, everything else floats on top as HUD elements.**

---

## Layout Architecture

```
┌────────────────────────────────────────────────────────────┐
│  TOP HUD BAR — logo | stats strip | clock | online status  │  52px
├────┬───────────────────────────────────────────────────────┤
│    │                                                        │
│ IC │           MAP (full-bleed, z-index 0)                │
│ O  │                                                        │
│ N  │   [panel slides in from right — 380px drawer]         │  flex-1
│    │                                                        │
│ R  │                                                        │
│ A  │                                                        │
│ I  │                                                        │
│ L  │                                                        │
├────┴───────────────────────────────────────────────────────┤
│  BOTTOM TICKER — scrolling live seizure feed               │  40px
└────────────────────────────────────────────────────────────┘
```

**Macrostucture chosen:** War Room / SIGINT Ops Center
**Hallmark genre:** Tactical Intelligence Operations

---

## Key Design Decisions

### Top HUD Bar
- Glassmorphic strip (backdrop-filter blur)
- Logo mark (NK badge) + wordmark
- Live stats: seizure count, total volume, top state
- Real-time clock (IST)
- Animated pulse dot + ONLINE status

### Icon Rail (Left Nav)
- 56px wide, icon-only (no text labels)
- 7 tactical symbols: ◉ ◈ ⬡ ▲ ◎ ⊞ ▣
- Tooltip on hover
- Active state: red accent + left border indicator
- Filter button at bottom of rail

### Bottom Ticker
- Scrolling marquee of live seizures
- Severity dot + location + drug type + quantity
- Pause on hover
- Seamless loop animation

### Panel Drawer (380px)
- Slides in from right when panel is active
- Glassmorphic background (backdrop-filter)
- Consistent panel header with close button
- Scrollable content area

---

## New Token System

All colors via CSS custom properties (no inline values):

```
--bg-void, --bg-surface, --bg-raised, --bg-overlay, --bg-glass
--text-primary, --text-secondary, --text-muted
--border-ghost, --border-dim, --border-mid, --border-bright
--accent (Signal Red #E83D3D), accent-dim, accent-mid, accent-bright
--sev-critical, --sev-high, --sev-low
--online, --offline, --map-cyan
```

**Font:** Share Tech Mono (locked, mono-only rule)
**Motion:** cubic-bezier(0.16, 1, 0.3, 1) — exponential ease-out
**No shadows** except Leaflet popup (the one exception per design rules)

---

## Components Redesigned

| Component | Change |
|-----------|--------|
| App.tsx | New war room shell, HUD bar, icon rail, ticker |
| App.module.css | Full rewrite |
| design-system.css | New OKLCH token system |
| global.css | Minimal — token aliasing only |
| IntelPanel | Stat grid + drug bars + state list |
| TrendingPanel | Ranked list with severity badges |
| NetworkPanel | State bars + agency table |
| AgencyPanel | Agency volume bars |
| ComparePanel | Horizontal state bars + drug grid |
| TerminalPanel | Full CLI with commands, history, autocomplete |
| FilterPanel | Slide-in with framer-motion |
| SeizureModal | Fade + scale overlay |
| OfflineBadge | Repositioned to bottom-left |
| Sidebar | Replaced by icon rail (in App.tsx) |
| Header | Replaced by HUD bar (in App.tsx) |
| Footer | Replaced by ticker (in App.tsx) |
| LiveFeed | Replaced by ticker (in App.tsx) |

---

## Anti-Pattern Fixes Applied

- ✅ No gradient backgrounds
- ✅ No centered-everything layout
- ✅ Mono font only (Share Tech Mono)
- ✅ No italic headers
- ✅ No shadows on panel surfaces
- ✅ No 3-column feature grid
- ✅ No AI nav (wordmark left + links + CTA)
- ✅ Token discipline (all via CSS custom props)
- ✅ No decorative borders (structural lines only)
- ✅ Reduced-motion respected

---

## Known Issues / Notes

- TerminalPanel close button needs parent wiring (onClose prop)
- Data: 35 Asian seizure records in `frontend/public/data_asian.json`
- Scraper scripts in `scripts/` (temporary, can be cleaned up)
- Swap file `.App.tsx.swp` should be deleted
