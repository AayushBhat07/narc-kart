# NARC KART — HALLMARK DESIGN SYSTEM
## Version 3.0 | OPS CENTER REDESIGN

---

## 1. GENRE & ATMOSPHERE

**Genre:** Tactical Intelligence Operations Center
**Mood:** Cold, precise, compartmentalized — like a real NCB command terminal.
**Reference:** Military SIGINT dashboards, air-traffic control displays, Bloomberg Terminal dark mode.

This is NOT a "dashboard." It is an **operations interface** — built for analysts, not consumers. Every element earns its place by communicating information, not decorating it.

---

## 2. MACROSTRUCTURE

### Page Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER — Status bar (full-width tactical strip)            │
├──────────┬──────────────────────────────┬─────────────────┤
│          │                              │                  │
│ SIDEBAR  │   MAIN VIEWPORT              │  LIVE FEED      │
│ (nav)    │   (map or panel content)     │  (280px fixed)  │
│ 160px    │   flex-1                     │                  │
│          │                              │                  │
├──────────┴──────────────────────────────┴─────────────────┤
│  FOOTER — Coordinate/status strip (32px)                   │
└─────────────────────────────────────────────────────────────┘
```

### View States (within MAIN VIEWPORT)
- **RADAR:** Full-bleed Leaflet map (India). No chrome. Map fills the entire viewport.
- **INTEL:** 2×2 stat grid + two section blocks (drug bars + state list + top locations).
- **NETWORK:** SVG bar chart (top 5 states) + expandable state/city table.
- **TRENDING:** Two ranked lists (major seizures / recent activity) + bottom stat row.
- **AGENCY:** Scrollable agency rows with inline bar indicators + summary cards.
- **COMPARE:** Horizontal bar chart (states) + drug type grid + monthly sparkline.
- **TERMINAL:** Full-height terminal with input row pinned at bottom.

### Macrostructure Rhythm
- Header + Footer = fixed scaffolding (never scrolls)
- Sidebar = fixed nav (never scrolls, 160px)
- Live Feed = fixed right column (280px, scrolls internally)
- Main Viewport = the only thing that changes; breathes with content

---

## 3. THEME — OKLCH PALETTE

### Color Foundations

```css
/* Backgrounds — tonal depth, NO color, just value */
--bg-primary:   #000000;   /* Base — the void */
--bg-secondary: #0D0D0D;  /* Panels, cards */
--bg-tertiary:  #141414;   /* Elevated surfaces, table headers */
--bg-overlay:   #1A1A1A;  /* Modals, overlays */

/* Text — strict grayscale */
--text-primary:   #FFFFFF;
--text-secondary: #A8A8A8;
--text-muted:     #5A5A5A;
--text-inverse:   #000000;  /* For light-on-dark elements */

/* Borders — structural lines */
--border-subtle: #1E1E1E;   /* Hairline separators */
--border-medium: #2E2E2E;   /* Card edges, input borders */
--border-strong: #444444;   /* Focus states, hover borders */

/* Accent — Signal Red (≤5% of screen) */
--accent:           #E83D3D;  /* The ONLY color with personality */
--accent-dim:       rgba(232, 61, 61, 0.12);
--accent-mid:       rgba(232, 61, 61, 0.25);
--accent-glow:      rgba(232, 61, 61, 0.08);

/* Severity Scale — ONLY these three, NO others */
--severity-critical: #E83D3D;  /* >100KG — matches accent */
--severity-high:      #FF8C42;  /* 10–100KG — warm orange */
--severity-low:       #F5D547;  /* <10KG — amber/yellow */

/* Functional */
--success:   #22C55E;
--warning:   #FF8C42;
--error:     #E83D3D;
--info:      #3B82F6;
```

### OKLCH Anchor Notes
- Signal Red `#E83D3D` anchors the entire system. OKLCH equivalent: `oklch(54.8% 0.22 27)` — warm red with slight orange cast.
- All severity colors are perceptually distinct in both light AND dark contexts.
- NO purple, NO blue gradients, NO teal. The only chromatic color is Signal Red.

---

## 4. TYPOGRAPHY

### Font Stack
```css
--font-mono: 'Share Tech Mono', 'Courier New', monospace;
```

**RULE:** Mono is the ONLY font. There is no Inter, no system-ui, no sans-serif fallback for UI text.

### Type Scale

| Token         | Size | Weight | Usage                          |
|---------------|------|--------|--------------------------------|
| `--text-xs`   | 9px  | 400    | Labels, timestamps, status dots |
| `--text-sm`   | 11px | 400    | Secondary data, badges          |
| `--text-base` | 13px | 400    | Body, terminal output          |
| `--text-md`   | 15px | 500    | Panel titles, section headers   |
| `--text-lg`   | 18px | 700    | App title (NARC KART)           |
| `--text-xl`   | 22px | 700    | Stat box values                 |
| `--text-2xl`  | 28px | 700    | Hero stat (total seizures)      |
| `--text-3xl`  | 36px | 700    | Loading screen, watermark      |

### Letter Spacing
- ALL CAPS labels: `0.15em` minimum
- Mixed case body: `0.02em`
- Terminal input: `0.05em`

---

## 5. SPACING SYSTEM

4-point base grid. All spacing uses multiples of 4.

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Layout Spacing
- Panel padding: `--space-4` (16px)
- Card padding: `--space-3` (12px)
- Gap between cards: `--space-2` (8px)
- Section gap: `--space-4` (16px)
- Header height: 48px
- Footer height: 32px
- Sidebar width: 160px
- Live Feed width: 280px

---

## 6. RADIUS SYSTEM

```css
--radius-xs: 2px;   /* Tiny elements, badge corners */
--radius-sm: 4px;   /* Buttons, chips, inputs */
--radius:   6px;   /* Cards, panels */
--radius-md: 8px;  /* Modals, larger containers */
```

**RULE:** No fully-rounded pills. No circles except for status dots. Edges are sharp enough to feel tactical.

---

## 7. BORDERS

```css
/* Structural borders are always present — NO border: none except on overlays */
border: 1px solid var(--border-subtle);   /* Default card/panel */
border: 1px solid var(--border-medium);   /* Elevated card */
border: 1px solid var(--border-strong);   /* Focus state */
```

**RULE:** NO border-radius on full-width structural elements (header, footer, sidebar). Only on contained elements (cards, buttons, inputs).

---

## 8. MOTION PHILOSOPHY

**Principle:** Motion serves function, never decoration. Elements arrive and depart — they don't bounce or play.

### Timing
- Micro-interactions (hover, focus): `150ms ease`
- Panel transitions (modal open/close): `200ms ease-out`
- Data updates (bar fill): `400ms cubic-bezier(0.22, 1, 0.36, 1)`
- Loading states: `linear` (no ease — mechanical feel)

### Animation Rules
- NO bounce, NO spring, NO elastic
- NO scale transforms on hover (use border-color / color changes)
- Fade transitions preferred over slide for overlays
- Terminal cursor: `step-end` blink (not smooth opacity)
- Progress bars: linear fill (mechanical, not playful)

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. MICROINTERACTIONS — 8-STATE SYSTEM

Every interactive component has 8 documented states:

### Button States
| State     | Background | Border        | Color        | Cursor  |
|-----------|------------|---------------|--------------|---------|
| Default   | transparent| border-subtle | text-secondary| pointer |
| Hover     | accent-dim | border-strong | text-primary | pointer |
| Focus     | transparent| accent        | text-primary | pointer |
| Active    | accent-mid | accent        | text-primary | pointer |
| Disabled  | transparent| border-subtle | text-muted   | not-allowed|
| Loading   | accent-dim | accent        | text-muted   | wait    |
| Error     | error-dim  | error         | error        | pointer |
| Success   | success-dim| success       | success      | pointer |

### Input States
| State     | Border            | Background   | Notes            |
|-----------|-------------------|--------------|------------------|
| Default   | border-medium     | bg-primary   |                  |
| Hover     | border-strong     | bg-primary   |                  |
| Focus     | accent            | bg-primary   | No outline ring  |
| Filled    | border-medium     | bg-primary   |                  |
| Disabled  | border-subtle     | bg-secondary | opacity 0.5      |
| Error     | error             | bg-primary   |                  |
| Loading   | border-medium     | bg-primary   | spinner overlay   |
| Success   | success           | bg-primary   | checkmark icon    |

### Card States
| State     | Border            | Background   | Notes            |
|-----------|-------------------|--------------|------------------|
| Default   | border-subtle     | bg-secondary |                  |
| Hover     | border-medium     | bg-secondary | slight bg shift   |
| Active    | accent (left 2px) | accent-dim  |                  |
| Selected  | accent            | accent-dim  | persistent       |
| Disabled  | border-subtle     | bg-tertiary  | opacity 0.5      |
| Loading   | border-subtle     | bg-secondary | skeleton pulse   |
| Error     | error             | error-dim   |                  |
| Empty     | border-subtle     | bg-secondary | empty state art  |

---

## 10. COMPONENT VOICE

### Naming Conventions
- Container: `.container` (root element of every component)
- Section: `.section` (grouped content block)
- Row: `.row` (horizontal layout item)
- Item: `.item` (list item)
- Badge: `.badge` (status indicator pill)
- Label: `.label` (field label, always caps + tracked)
- Value: `.value` (data value, mono)
- Empty: `.empty` (empty state message)

### Icon System
- Use Unicode geometric characters for visual accents: `◎ ◉ ⬡ ★ ▣ ⊞ ⊗`
- Size: 12px–16px, color matches context (accent for active, muted for inactive)
- Icons are decorative (aria-hidden), never the sole indicator

### Divider Language
- Section dividers: `1px solid var(--border-subtle)` — thin, structural
- Row separators: same as section dividers
- NO decorative dividers, NO gradient lines, NO ornamental rules

### Card Treatment
- Border: `1px solid var(--border-subtle)`
- Background: `var(--bg-secondary)`
- Padding: `--space-3` (12px) internal
- NO shadow except Leaflet popup (`box-shadow: 0 4px 20px rgba(0,0,0,0.6)`)
- Active card: `border-left: 2px solid var(--accent)` (left edge accent strip)

---

## 11. CTA VOICE

### Button Labels — Tactical Tone
- **PRIMARY:** `[EXECUTE]` — for confirm actions (filters, apply)
- **SECONDARY:** `[CLEAR]` — for reset/cancel
- **TERTIARY:** `FILTERS` / `REFRESH` — icon + text, no brackets

### Panel Titles
- Always ALL CAPS, tracked (`0.15em`), `--text-md` size
- Prefixed with a single icon character
- Example: `◉ INTEL` / `★ TRENDING`

### Empty States
- ALL CAPS, tracked, muted color
- Example: `NO SEIZURES RECORDED` / `NO DATA AVAILABLE`
- Optional: subtle icon (⊗) at 40% opacity

---

## 12. CLASSIFIED AESTHETIC

### Watermark
```css
.classifiedWatermark {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 8vw;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.03);
  pointer-events: none;
  z-index: 0;
  white-space: nowrap;
  letter-spacing: 0.2em;
  font-family: var(--font-mono);
}
```

### Dot-Grid Background
```css
.app::before {
  content: '';
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background-image: radial-gradient(circle, #1A1A1A 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  z-index: 0;
}
```

---

## 13. MAP STYLING

### Tile Layer
- Provider: CARTO Dark Matter (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`)
- No custom raster tiles

### India Boundary
- GeoJSON overlay from `/india-boundary.geojson`
- Style: `color: #00FFFF`, `weight: 1.5`, `fillOpacity: 0`, `opacity: 0.6`

### Markers
- SVG circles, size based on quantity
- >100KG: radius 12, pulsing ring animation
- 10–100KG: radius 8, static
- <10KG: radius 5, static
- Color: severity color

### Popup
- Leaflet default popup with dark theme (styled in global.css)
- This is the ONE exception to the "no shadow" rule

---

## 14. DESIGN TOKENS — COMPLETE REFERENCE

```css
/* === BACKGROUNDS === */
--bg-primary:   #000000;
--bg-secondary: #0D0D0D;
--bg-tertiary:  #141414;
--bg-overlay:   #1A1A1A;

/* === TEXT === */
--text-primary:   #FFFFFF;
--text-secondary: #A8A8A8;
--text-muted:     #5A5A5A;
--text-inverse:   #000000;

/* === BORDERS === */
--border-subtle: #1E1E1E;
--border-medium: #2E2E2E;
--border-strong: #444444;

/* === ACCENT === */
--accent:      #E83D3D;
--accent-dim:  rgba(232, 61, 61, 0.12);
--accent-mid:  rgba(232, 61, 61, 0.25);
--accent-glow: rgba(232, 61, 61, 0.08);

/* === SEVERITY === */
--severity-critical: #E83D3D;
--severity-high:    #FF8C42;
--severity-low:     #F5D547;

/* === FUNCTIONAL === */
--success: #22C55E;
--error:   #E83D3D;
--warning: #FF8C42;
--info:    #3B82F6;

/* === TYPOGRAPHY === */
--font-mono: 'Share Tech Mono', 'Courier New', monospace;
--text-xs:   9px;
--text-sm:   11px;
--text-base: 13px;
--text-md:   15px;
--text-lg:   18px;
--text-xl:   22px;
--text-2xl:  28px;
--text-3xl:  36px;

/* === SPACING === */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

/* === RADIUS === */
--radius-xs: 2px;
--radius-sm: 4px;
--radius:   6px;
--radius-md: 8px;

/* === LAYOUT === */
--header-h:  48px;
--footer-h:  32px;
--sidebar-w: 160px;
--feed-w:    280px;
```

---

## 15. MOBILE BEHAVIOR

### Breakpoints
- `≥1024px`: Full 3-column layout
- `768px–1023px`: Sidebar collapses to icon-only (48px). Feed narrows to 200px.
- `<768px`: Sidebar becomes top tab bar. Feed moves below main content (200px height). Map/panel takes remaining height.

### Mobile Rules
- NO horizontal scroll at any width
- All panels scroll vertically
- Touch targets minimum 44px
- No hover states on touch (use active/pressed)

---

## 16. ANTI-PATTERNS (REMOVED)

These patterns from the previous version are BANNED in the redesign:

1. **NO gradient fills** on bars or backgrounds (flat color only)
2. **NO centered-everything** (left-align data, right-align values)
3. **NO centered headers** (headers are always left-aligned)
4. **NO italic text** anywhere (mono font doesn't support italic well)
5. **NO purple/blue accent colors** (only Signal Red)
6. **NO rounded pill badges** (radius-xs at most)
7. **NO card shadows** except Leaflet popup
8. **NO full-width gradient hero sections**
9. **NO emoji in UI** (use Unicode geometric chars or text labels)
10. **NO AI-nav patterns** (no smart suggestions, no auto-complete in terminal for now)

---

## 17. FILE ORGANIZATION

```
frontend/src/
├── styles/
│   ├── design-system.css   ← All tokens, no selectors
│   └── global.css          ← Reset, scrollbar, Leaflet overrides
├── components/
│   ├── [Component].tsx
│   └── [Component].module.css
├── hooks/useApi.ts
└── types/index.ts
```

DESIGN.md lives at repo root (`/DESIGN.md`). It is the **LOCKED source of truth** for all design decisions.
