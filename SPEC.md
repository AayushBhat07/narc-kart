# Narc Kart - Project Specification
## Version 1.0 | Matrix/Military Intelligence Style

---

## 🎨 Design System

### Color Palette
| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#000000` | Pure black background |
| `--bg-secondary` | `#0a0a0a` | Dark charcoal panels |
| `--bg-tertiary` | `#111111` | Card backgrounds |
| `--text-primary` | `#00FF00` | Terminal green - main text |
| `--text-secondary` | `#00CC00` | Darker green - secondary |
| `--text-muted` | `#008800` | Dimmed green - disabled |
| `--accent-red` | `#FF0040` | Critical alerts, major seizures |
| `--accent-orange` | `#FF6600` | Medium seizures |
| `--accent-yellow` | `#FFCC00` | Minor seizures |
| `--accent-cyan` | `#00FFFF` | Border/state markers |
| `--accent-blue` | `#0088FF` | Sea port markers |
| `--accent-magenta` | `#FF00FF` | International border |
| `--border-glow` | `#00FF0040` | Glowing green border (40% opacity) |

### Typography
- **Primary Font:** `"Share Tech Mono", "Courier New", monospace` (Google Fonts)
- **Headers:** Military stencil style (uppercase, letter-spacing: 0.15em)
- **Body:** 14px base, line-height 1.6
- **Data numbers:** Tabular/monospace for alignment

### Visual Effects
- **CRT Scanlines:** CSS pseudo-element overlay, repeating gradient
- **Radar Sweep:** CSS animation, 4s rotation
- **Blinking Cursor:** `_` character with opacity animation
- **Text Glow:** `text-shadow: 0 0 10px var(--text-primary)`
- **Border Glow:** `box-shadow: 0 0 20px var(--border-glow)`
- **"CLASSIFIED" Watermark:** Large, diagonal, 5% opacity across displays
- **Glitch Effect:** CSS animation with clip-path on hover for headers

---

## 🗺️ Map Specification

### India Boundary
- **GeoJSON Source:** Natural Earth India boundary or similar
- **Projection:** Leaflet CRS.Simple (for flat map) or Mercator
- **Style:** Transparent fill, solid green border (#00FF00)
- **Border Width:** 2px
- **Interactive States:** Highlight on hover (brighter green)

### Marker Types
| Type | Color | Size | Icon |
|---|---|---|---|
| Major Seizure (>100kg) | `#FF0040` (red) | 16px | Pulsing dot |
| Medium Seizure (10-100kg) | `#FF6600` (orange) | 12px | Static dot |
| Minor Seizure (<10kg) | `#FFCC00` (yellow) | 8px | Static dot |
| Border Checkpost | `#00FFFF` (cyan) | 10px | Square |
| Sea Port | `#0088FF` (blue) | 10px | Diamond |
| International Border | `#FF00FF` (magenta) | 10px | Triangle |

### Marker Animation
- Major seizures: Pulsing glow animation (1.5s infinite)
- On click: Popup with seizure details

### Popup Design
- Background: `#0a0a0a` with green border glow
- Header: "CASE FILE" in stencil font + red "CLASSIFIED" stamp
- Fields: Location, Drug Type, Quantity, Date, Source link
- Image: Drug photo if available (extracted from source)
- Timestamp: Bottom right
- Close button: `X` styled as terminal command

---

## 📱 Screen Layouts

### 1. Main Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ [HEADER] NARC KART V1.0    [CLASSIFIED] [⚙️] [👁️]     │
├──────────────┬──────────────────────────┬───────────────┤
│              │  [STAT BOXES]            │               │
│  [SIDEBAR]   │  Total | Active | Threat │ [LIVE FEED]   │
│              │                          │               │
│  OPS_CENTER  │  [INDIA MAP]             │  Intel Feed   │
│  - RADAR     │  with markers            │  scrolling    │
│  - INTEL     │                          │               │
│  - NETWORK   │  [RADAR SWEEP]           │  [CMD INPUT]  │
│  - TERMINAL  │                          │               │
├──────────────┴──────────────────────────┴───────────────┤
│ [FOOTER] Coordinates: 20.5937° N, 78.9625° E  | UTC   │
└─────────────────────────────────────────────────────────┘
```

### 2. Seizure Detail Modal
- Dark panel with green border glow
- "CASE FILE" header + file number
- Drug type label + icon
- Seizure image (if available)
- Quantity in kg with severity color
- Date + time
- Location with coordinates
- Source link
- "CLASSIFIED" stamp watermark

### 3. Filter Panel
- Position: Right sidebar or modal
- Fields: Time Period, Drug Type, State, Severity
- Styled as terminal inputs with green text
- Apply: `[EXECUTER]` button
- Reset: `[CLEAR]` button
- Active filter count badge

### 4. Loading Screen
- Full black screen
- Blinking cursor top-left
- "NARC KART INITIALIZING" centered
- ASCII code scrolling in background
- Progress bar with green fill
- Status messages appearing line by line
- "ESTABLISHING SECURE CONNECTION..."
- Version number bottom

### 5. Map Legend
- Position: Bottom-left or collapsible panel
- Color-coded icons with labels
- Severity scale visualization
- Scale bar

---

## 📊 Data Schema

```typescript
interface Seizure {
  id: string;
  location: {
    city: string;
    state: string;
    lat: number;
    lon: number;
  };
  drugType: "heroin" | "cocaine" | "meth" | "cannabis" | "methaqualone" | "other";
  quantityKg: number;
  date: string; // ISO 8601
  source: {
    name: string;
    url: string;
  };
  agency: string; // NCB, police dept, etc.
  images: string[]; // URLs from source articles
  caseNo?: string;
  description?: string;
}
```

---

## 🔄 Data Pipeline

### Sources (Priority Order)
1. **NCB Website** — Narcotics Control Bureau official
2. **PTI News** — Press Trust of India
3. **Police Twitter/X** — Various state police handles
4. **News APIs** — MediaStack, GNews (free tiers)

### Scraping Flow
```
News Source → HTTP Request → HTML Parser → AI Extraction (Ollama) → Structured Data
                                              ↓
                                    Geocoding (Nominatim)
                                              ↓
                                    Image Extraction
                                              ↓
                                    SQLite Storage
```

### AI Extraction (Ollama)
- Extract: location, drug type, quantity, date, source
- Prompt tailored for Indian drug seizure news format
- Confidence scoring

### Geocoding
- Nominatim (free, 1 req/sec)
- Cache results to avoid repeats
- India-focused search bias

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Map | Leaflet + React-Leaflet |
| Styling | CSS Modules / Styled Components |
| State | React Context + useReducer |
| Backend | Python FastAPI |
| Scraper | BeautifulSoup + Playwright |
| AI Extraction | Ollama (local) |
| Geocoding | Nominatim (OSM) |
| Database | SQLite |
| Hosting | Local or Railway |

---

## ✅ QA Requirements

### Design QA Agent 1: Visual Match
- Compare frontend output to Stitch-generated images
- Check: color palette, typography, layout proportions
- Verify: CRT scanlines, glow effects, watermark
- Report: Any deviations from design spec

### Design QA Agent 2: Functional Verification
- Verify map renders India boundary correctly
- Check marker visibility and clustering
- Validate popup interactions
- Test responsiveness (desktop/tablet)

### Code QA Agent: Technical Review
- Check React best practices
- Verify Leaflet integration
- Check CSS effects implementation
- Validate API endpoints
- Test error handling

---

## 📁 Project Structure

```
narc-kart/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── styles/
│   │   └── App.tsx
│   ├── public/
│   │   └── india-boundary.geojson
│   └── package.json
├── backend/
│   ├── scraper/
│   ├── api/
│   ├── ai/
│   └── database/
├── designs/
│   └── (Stitch-generated HTML/Images)
└── docs/
    └── SPEC.md
```
