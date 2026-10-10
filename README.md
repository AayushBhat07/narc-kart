# 🚀 NARC KART

> India's Drug Seizure Tracker — a cyberpunk-styled intelligence dashboard.

![NARC KART v1.0](https://img.shields.io/badge/version-1.0.0--CLASSIFIED-E83D3D?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel)

---

## 🎯 What is this?

NARC KART started as a fun weekend hack — a way to visualise publicly available drug seizure data across India on a slick, tactical-looking map interface. Think of it as a "mission control for vibes" 🚀

The project went through a few phases:
- 🔧 **Full-stack** — FastAPI + SQLite + React
- 🌐 **Cloudflare tunnels** — backend hosted on a local tunnel (pain)
- 📦 **Static mode** — everything baked into one JSON file, zero backend needed, just works on Vercel
- 🌍 **Globe** — black hairline globe, data refreshed weekly by a GitHub Action

> **Current state:** Fully static frontend deployed at [dist-e73wjyxqx-aayushbhat07s-projects.vercel.app](https://dist-e73wjyxqx-aayushbhat07s-projects.vercel.app). No backend, no tunnels, no CORS headaches.

---

## 🗺️ Features

| Tab | What it does |
|-----|-------------|
| **RADAR** 🌍 | Draggable 3D wireframe globe; click a seizure and the camera hops there |
| **INTEL** 📊 | Stats breakdown by state, drug type, monthly trends |
| **NETWORK** 🔗 | Node-graph showing agency connections (WIP) |
| **TERMINAL** 💻 | Command-line style interface for power users |

### Core Stats
- **20 seizure records** baked in from real-looking NCB/Delhi Police data
- Breakdown by state, drug type, monthly volume
- Top locations ranked by seizure weight (kg)
- Severity-coded markers (MIN / MED / MAJOR)

---

## 🛠️ Tech Stack

```
Frontend (the whole product)
├── React 19 + TypeScript
├── Vite 6 (build tool)
├── globe.gl + three.js (3D wireframe globe)
├── world-atlas + topojson-client (country / state borders)
├── CSS Modules (styling)
└── Vercel Hobby (free static hosting)

Data
└── scripts/update_data.py — weekly GitHub Action, merges new seizures into data.json
```

No backend, no database, nothing to pay for.

---

## 🚀 Getting Started

### Run locally

```bash
# Clone the repo
git clone https://github.com/AayushBhat07/narc-kart.git
cd narc-kart/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

> Opens at `http://localhost:5173`

### Build for production

```bash
cd frontend
npm run build
```

Static output lands in `frontend/dist/` — deploy straight to Vercel, Netlify, or any static host.

---

## 🧪 Project Structure

```
narc-kart/
├── frontend/
│   ├── public/
│   │   ├── data.json                ← all seizure data (static)
│   │   └── india-districts.topojson ← Indian state/district borders for the globe
│   └── src/
│       ├── components/SeizureGlobe.tsx ← the 3D globe + fly-to transitions
│       ├── hooks/useApi.ts             ← loads data.json, client-side filters
│       └── App.tsx
├── scripts/
│   ├── update_data.py               ← weekly updater (stdlib only)
│   └── data/cities.json             ← city → state + coordinates lookup
└── .github/workflows/
    ├── scrape-weekly.yml            ← Sundays 18:00 IST: update data.json
    └── ci.yml                       ← build + data.json validation
```

---

## 📦 Data updates

Every Sunday a GitHub Action runs `scripts/update_data.py`. It reads Google News RSS for
Indian drug-seizure headlines, keeps only the ones that name a drug, a quantity and a
known city, and **merges** them into `frontend/public/data.json` (it never deletes
records). If anything changed it commits, and Vercel's GitHub integration redeploys.

```bash
python scripts/update_data.py --dry-run   # see what would be added
python scripts/update_data.py             # update data.json locally
```

---

## 🎨 Design Philosophy

Dark cyberpunk aesthetic — not because it makes sense, but because it looks cool 💀

- Background: `#1A1A1A`
- Primary text: `#EFEFE2`
- Accent: `#E83D3D`
- Font: **Share Tech Mono** (Google Fonts)

---

## 👤 Author

**Aayush Bhat** — [LinkedIn](https://linkedin.com/in/aayush-bhat07/) · [GitHub](https://github.com/AayushBhat07)

Built as a weekend project. No servers were harmed in the making of this dashboard.

---

## 📜 License

MIT — do whatever, just don't use it for anything serious. This is real data about real crimes and should be treated accordingly.
