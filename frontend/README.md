# NARC KART - India Drug Seizure Tracker

A real-time intelligence dashboard for tracking drug seizure operations across India. Features a Matrix/Military Intelligence aesthetic with CRT effects, live feeds, and interactive mapping.

## Tech Stack

- **Frontend:** React 19 + Vite + TypeScript
- **Map:** Leaflet + React-Leaflet (CRS.Simple flat projection)
- **Styling:** CSS Modules + Framer Motion
- **Backend:** FastAPI (to be connected at `/api`)

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

> **Note:** The frontend will show mock seizure data until the FastAPI backend is connected at `http://localhost:8000`. See [Backend Setup](#backend-setup) below.

### 3. Build for Production

```bash
npm run build
npm run preview
```

## Features

- **India Map** with CRS.Simple flat projection
- **Color-coded seizure markers** (red >100kg, orange 10-100kg, yellow <10kg)
- **Pulsing animation** for major seizures (>100kg)
- **Live feed** with scrolling intel alerts
- **Filter panel** with time period, drug type, state, and severity filters
- **CRT scanlines** and glow effects
- **"CLASSIFIED" watermark** overlay
- **Terminal-style UI** with Share Tech Mono font

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header.tsx          # Top navigation bar
│   │   ├── Footer.tsx          # Status bar with coordinates
│   │   ├── Sidebar.tsx         # Operations center nav
│   │   ├── IndiaMap.tsx        # Leaflet map with India boundary
│   │   ├── SeizureMarker.tsx   # Animated seizure markers
│   │   ├── SeizurePopup.tsx    # Case file popup
│   │   ├── SeizureModal.tsx    # Full case file modal
│   │   ├── LiveFeed.tsx        # Scrolling intel feed
│   │   ├── FilterPanel.tsx     # Filter controls
│   │   ├── StatBoxes.tsx       # Dashboard stats
│   │   └── LoadingScreen.tsx   # Boot animation
│   ├── hooks/
│   │   └── useApi.ts           # API + mock data hook
│   ├── context/
│   │   └── AppContext.tsx      # Global state
│   ├── styles/
│   │   └── global.css          # Global styles + CRT effects
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── App.tsx                 # Main layout
│   └── main.tsx                # Entry point
├── public/
│   ├── india-boundary.geojson   # India border data
│   └── favicon.svg
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## API Integration

The frontend expects these endpoints from the FastAPI backend:

| Endpoint | Method | Description |
|---|---|---|
| `/api/seizures` | GET | List seizures (filter via query params) |
| `/api/stats` | GET | Dashboard statistics |

### Query Parameters for `/api/seizures`

- `time_period`: `all`, `7d`, `30d`, `90d`, `1y`
- `drug_type`: One or more of `heroin`, `cocaine`, `meth`, `cannabis`, `methaqualone`, `other`
- `state`: State name
- `severity_min`, `severity_max`: Weight in kg

### Response Shape

```json
{
  "seizures": [
    {
      "id": "string",
      "location": { "city": "string", "state": "string", "lat": 0, "lon": 0 },
      "drugType": "heroin",
      "quantityKg": 150,
      "date": "2026-04-20T10:30:00Z",
      "source": { "name": "NCB", "url": "https://..." },
      "agency": "Narcotics Control Bureau",
      "images": [],
      "caseNo": "NCB-MUM-2026-0456",
      "description": "string"
    }
  ]
}
```

## Design System

| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#000000` | Background |
| `--text-primary` | `#00FF00` | Terminal green |
| `--accent-red` | `#FF0040` | Critical alerts |
| `--accent-orange` | `#FF6600` | Medium seizures |
| `--accent-yellow` | `#FFCC00` | Minor seizures |
| `--font-mono` | Share Tech Mono | Primary font |

## Browser Support

- Chrome/Edge (recommended)
- Firefox (with minor styling differences)
- Safari (CSS custom properties supported)

## License

CLASSIFIED - NCB SYSTEMS
