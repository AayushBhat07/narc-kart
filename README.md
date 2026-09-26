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

> **Current state:** Fully static frontend deployed at [dist-e73wjyxqx-aayushbhat07s-projects.vercel.app](https://dist-e73wjyxqx-aayushbhat07s-projects.vercel.app). No backend, no tunnels, no CORS headaches.

---

## 🗺️ Features

| Tab | What it does |
|-----|-------------|
| **RADAR** 🗺️ | Interactive Leaflet map with seizure markers across India |
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
Frontend
├── React 19 + TypeScript
├── Vite 6 (build tool)
├── Leaflet + React-Leaflet (maps)
├── CSS Modules (styling)
└── Vercel (hosting)

Backend (archived/static mode)
├── FastAPI + Uvicorn
├── SQLite database
└── Python scraper + Ollama AI
```

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

### Vercel environment variables

The current production path is static mode. If `VITE_API_BASE` is not set, the frontend reads `frontend/public/data.json` and does not require backend, database, or Supabase variables.

Only configure live API variables when you intentionally enable the API routes:

| Variable | Scope | Required when | Notes |
|----------|-------|---------------|-------|
| `VITE_API_BASE` | Frontend build | Using a live API instead of static JSON | Use `/api` for same-project Vercel API routes or a full backend URL. |
| `SUPABASE_URL` | Vercel serverless API | Using `frontend/api/*` routes | Server-side only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel serverless API | Using `frontend/api/*` routes | Server-side secret; never expose in client code. |
| `CRON_SECRET` | Vercel serverless API | Protecting `/api/scrape` | Optional bearer token for scrape triggers. |

Templates:

- Root Vercel template: `.env.vercel.example`
- Frontend local template: `frontend/.env.example`
- Archived backend template: `backend/.env.example`

The root `vercel.json` already builds from `frontend/` and outputs `frontend/dist/`.

---

## 🧪 Project Structure

```
narc-kart/
├── frontend/
│   ├── public/
│   │   └── data.json        ← all seizure data lives here (static mode)
│   └── src/
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── Sidebar.tsx
│       │   ├── IndiaMap.tsx
│       │   ├── SeizureModal.tsx
│       │   ├── IntelPanel.tsx
│       │   └── LiveFeed.tsx
│       ├── hooks/
│       │   └── useApi.ts   ← static/API mode toggle
│       ├── types/
│       └── App.tsx
├── backend/                ← FastAPI backend (static mode not needed)
│   ├── api/
│   ├── database.py
│   └── scraper/
└── SPEC.md                 ← full project spec
```

---

## 📦 Adding New Data

Edit `frontend/public/data.json` to add or modify seizure records:

```json
{
  "seizures": [
    {
      "id": "sz-021",
      "city": "Pune",
      "state": "Maharashtra",
      "lat": 18.520,
      "lon": 73.856,
      "drugType": "heroin",
      "quantityKg": 42.0,
      "date": "2026-04-26",
      "sourceName": "Maharashtra Police",
      "sourceUrl": "https://mahapolice.gov.in",
      "agency": "Maharashtra Police",
      "description": "Seizure description here.",
      "images": []
    }
  ],
  "stats": { ... }
}
```

Then rebuild + redeploy. That's it. No database, no backend.

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
