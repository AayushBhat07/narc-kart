# Narc Kart Backend

India Drug Seizure Tracker - Backend API for scraping, extracting, and serving drug seizure data.

## Architecture

```
backend/
├── scraper/          # Web scraping module
│   ├── news_sources.py    # News source definitions
│   ├── scraper.py        # Main scraping engine
│   └── article_parser.py # Article content extraction
├── ai/               # AI/ML pipeline
│   ├── ollama_client.py  # Ollama LLM client
│   └── extractor.py      # Data extraction prompts
├── geocoder.py       # Location geocoding (Nominatim)
├── database.py       # SQLite database layer
├── main.py           # FastAPI application
└── requirements.txt  # Python dependencies
```

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt

# Optional: Install Playwright for JS rendering
playwright install chromium
```

### 2. Configure Ollama (Optional but Recommended)

For AI-powered data extraction, install and run Ollama:

```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model (llama3.2 recommended)
ollama pull llama3.2:latest

# Start Ollama server (runs on port 11434)
ollama serve
```

### 3. Run the API

```bash
# Start the FastAPI server
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Health Check
```
GET /api/health
```

### Get Seizures (with filters)
```
GET /api/seizures?limit=50&offset=0&state=Maharashtra&drug_type=heroin&agency=NCB
```

Query Parameters:
- `limit`: Results per page (1-500, default: 50)
- `offset`: Pagination offset
- `state`: Filter by Indian state
- `drug_type`: Filter by drug (heroin, cocaine, methamphetamine, cannabis, methaqualone, morphine, mdma, other)
- `agency`: Filter by agency (NCB, DRI, State Police, Customs)
- `start_date`: Filter from date (YYYY-MM-DD)
- `end_date`: Filter to date (YYYY-MM-DD)
- `min_quantity`: Minimum quantity in kg

### Get Seizure Details
```
GET /api/seizures/{id}
```

### Get Statistics
```
GET /api/stats
```

Returns aggregate stats: total seizures, by drug type, by state, by agency.

### Trigger Scraping Refresh
```
POST /api/refresh
```

Scrapes all configured news sources, extracts seizure data, and stores in database.

### Get News Sources
```
GET /api/sources
```

## Configuration

Environment variables:
- `NARC_KART_DB`: Path to SQLite database (default: ~/.narc-kart/narc-kart.db)
- `NARC_KART_PORT`: API port (default: 8000)
- `NARC_KART_HOST`: API host (default: 0.0.0.0)

## News Sources

The scraper monitors these sources:
- NCB Official Website
- Press Trust of India (PTI)
- DRI (Directorate of Revenue Intelligence)
- CBIC Customs
- Times of India
- Indian Express
- Hindustan Times
- The Hindu
- State Police portals (Maharashtra, Delhi)

## Geocoding

Uses Nominatim (OpenStreetMap) for location-to-coordinates conversion:
- Rate limited to 1 request/second
- Results cached locally (~/.narc-kart/cache/)
- Fallback coordinates for major Indian cities/states

## Database Schema

### seizures
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| location_city | TEXT | City name |
| location_state | TEXT | Indian state |
| latitude | REAL | GPS latitude |
| longitude | REAL | GPS longitude |
| drug_type | TEXT | heroin, cocaine, etc. |
| quantity_kg | REAL | Quantity in kg |
| seizure_date | DATE | Date of seizure |
| agency | TEXT | NCB, DRI, etc. |
| case_number | TEXT | Case/FIR number |
| article_url | TEXT | Source article URL |
| extraction_confidence | REAL | AI confidence score |

### sources
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | Source name |
| base_url | TEXT | Source URL |
| agency_type | TEXT | Agency category |
| last_scraped | TIMESTAMP | Last scrape time |

### images
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| seizure_id | INTEGER | FK to seizures |
| image_url | TEXT | Image URL |
| image_type | TEXT | seizure, suspect, etc. |

## Running Tests

```bash
pytest backend/tests/ -v
```

## License

MIT