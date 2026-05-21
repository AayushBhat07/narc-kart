# Drug Seizure Scraper - Technical Specification

## Overview

This scraper aggregates drug seizure data from multiple Indian sources including government portals, national newspapers, regional newspapers, and state police websites. It outputs structured JSON data for the Narc-Kart frontend dashboard.

## Architecture

### Source Priority System

Sources are organized by priority to ensure quality data while maximizing coverage:

```
Priority 1 (Government)
├── NCB Press Releases (ncb.gov.in)
│   └── Direct source for national drug enforcement news
└── PIB (pib.gov.in)
    └── Official press releases across all ministries

Priority 2 (Major News)
├── Times of India (timesofindia.indiatimes.com)
│   └── National coverage with location extraction
└── Indian Express (indianexpress.com)
    └── Section-based India news

Priority 3 (Regional - Tier 2/3)
├── Dainik Jagran (jagran.com)
│   └── Strong in UP, Bihar, Punjab, Haryana, Rajasthan, MP
└── Amar Ujala (amarujala.com)
    └── Coverage in Punjab, HP, J&K, Haryana, Uttarakhand

Priority 4 (Police Websites)
├── Punjab Police (punjabpolice.gov.in)
├── Haryana Police (haryanapolice.gov.in)
├── Bihar Police (biharpolice.in)
└── Rajasthan Police (police.rajasthan.gov.in)
```

### Scraping Strategy

1. **Concurrent Execution** - Uses `ThreadPoolExecutor` with 5 workers to scrape sources in parallel
2. **Rate Limiting** - 1 second delay between requests to the same domain
3. **Retry Logic** - Uses `tenacity` for exponential backoff retry (3 attempts)
4. **Graceful Degradation** - One source failing doesn't crash the scraper

### Data Flow

```
[Sources] → [HTML Fetch] → [Parse/Extract] → [Deduplicate] → [Stats Compute] → [JSON Output]
              ↓
         [BeautifulSoup]
         [html2text]
```

## Deduplication Logic

Seizures are deduplicated based on a composite key:

```python
key = (
    date,           # YYYY-MM-DD
    city.lower(),   # normalized city name
    drug_type,      # normalized drug category
    round(quantity, 2)  # rounded to 2 decimal places
)
```

**Rationale**: Same seizure reported by multiple sources will have identical date, location, drug type, and quantity.

**Note**: The scraper generates unique IDs using MD5 hash of (date + city + drug_type + quantity), so even if two sources report the same event with slightly different wording, they'll share the same ID.

## Date Normalization

Dates are parsed using multiple format attempts:

```python
formats = [
    '%Y-%m-%d',      # 2026-05-21
    '%d-%m-%Y',      # 21-05-2026
    '%d/%m/%Y',      # 21/05/2026
    '%Y/%m/%d',      # 2026/05/21
    '%b %d, %Y',     # May 21, 2026
    '%B %d, %Y',     # May 21, 2026
    '%d %b %Y',      # 21 May 2026
    '%d %B %Y',      # 21 May 2026
    '%d-%m-%y',      # 21-05-26
    '%d/%m/%y',      # 21/05/26
]
```

**Relative dates** like "3 days ago" are converted using:
```python
date = datetime.now() - timedelta(days=3)
```

**Fallback**: If no date can be parsed, defaults to current date.

## Drug Type Normalization

| Raw Text | Normalized |
|----------|-----------|
| heroin, brown sugar, smack | `heroin` |
| meth, methamphetamine, ice, crystal meth | `meth` |
| ganja, cannabis, charas, marijuana, bhang | `cannabis` |
| cocaine | `cocaine` |
| MDMA, ecstasy | `mdma` |
| morphine | `morphine` |
| opium, poppy, poppy husk | `opium` |
| LSD, acid | `lsd` |
| ketamine | `ketamine` |
| tramadol | `tramadol` |
| alprazolam, diazepam | `benzodiazepine` |

## Location Extraction

### Strategy

1. **State Detection** - Regex match for Indian state names in article text
2. **City Detection** - Hierarchical lookup:
   - Major cities first (Mumbai, Delhi, Bangalore, etc.)
   - Border towns second (Amritsar, Fazilka, Raxaul, etc.)
   - Then any match from cities.json
3. **Coordinate Assignment** - Match city name to cities.json for lat/lon

### cities.json Structure

```json
{
  "cities": [
    {"name": "Mumbai", "state": "Maharashtra", "lat": 19.076, "lon": 72.877},
    {"name": "Amritsar", "state": "Punjab", "lat": 31.634, "lon": 74.874},
    ...
  ]
}
```

**Coverage**:
- Tier 1 cities: All major metros
- Tier 2 cities: State capitals, major industrial cities
- Tier 3 cities: Border towns, district headquarters
- Border cities: Amritsar, Fazilka, Ferozpur (Punjab), Raxaul, Nautanwa (Bihar), Barmer, Jaisalmer (Rajasthan)

## Quantity Extraction

Pattern matching for drug quantities:

```
(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)
(\d+(?:\.\d+)?)\s*(?:g|grams?)
(\d+(?:\.\d+)?)\s*(?:mg|milligrams?)
(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?)
(\d+(?:\.\d+)?)\s*(?:quintals?)
```

Unit conversions:
- `tonnes` → `kg` (×1000)
- `quintals` → `kg` (×0.1)
- `grams` → `kg` (÷1000)
- `mg` → `kg` (÷1,000,000)

## Error Handling

### Per-Source Errors
- Logged but don't crash the scraper
- Each source runs in isolation via thread pool
- Example: `logger.error(f"NCB: Scraping failed: {e}")`

### Per-Request Errors
- Retry up to 3 times with exponential backoff
- Uses tenacity library for consistent retry logic
- `requests.RequestException` triggers retry

### Missing Data
- City not found → Skip article
- Drug type not found → Skip article
- Date not parseable → Use current date
- Quantity not extractable → `null` in output

## Statistics Computation

Computed from the seizures array:

```python
stats = {
    'total_seizures': len(seizures),
    'total_quantity_kg': sum(s.get('quantityKg', 0) or 0),
    'raids_this_week': count where date >= (now - 7 days),
    'by_state': {state: count, ...},
    'by_drug_type': {drug: count, ...},
    'by_month': {'2026-05': count, ...},
    'top_locations': [{location: "Mumbai, Maharashtra", count: 42}, ...]
}
```

## Known Limitations

### Coverage Gaps
1. **North-East States** - Limited news coverage and police website availability
2. **Small Towns** - Not all towns in cities.json
3. **South India** - Dainik Jagran/Amar Ujala don't cover south states well

### Technical Limitations
1. **JavaScript-rendered Pages** - Some sites may need browser automation (not implemented)
2. **Cloudflare/Bot Protection** - May block requests
3. **Inconsistent Reporting** - Different sources format seizure data differently

### Data Quality
1. **Quantity Accuracy** - Not all articles report exact quantities
2. **Date Accuracy** - Many articles use relative dates
3. **Location Precision** - Sometimes only state, not city

## Testing

### Test Individual Sources
```bash
python -c "from run_scraper import scrape_ncb; print(len(scrape_ncb()))"
python -c "from run_scraper import scrape_dainik_jagran; print(len(scrape_dainik_jagran()))"
```

### Test Functions
```bash
# Test date parsing
python -c "from run_scraper import normalize_date; print(normalize_date('21-05-2026'))"

# Test drug normalization
python -c "from run_scraper import normalize_drug; print(normalize_drug('seized 5kg of brown sugar'))"

# Test location extraction
python -c "
from run_scraper import load_cities, extract_location
cities = load_cities()
result = extract_location('Police arrested suspects in Amritsar with heroin', cities)
print(result)
"
```

## GitHub Actions Integration

The scraper runs weekly via `.github/workflows/scrape.yml`:

```yaml
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly Sunday midnight
  workflow_dispatch:  # Manual trigger
```

Output is written to `frontend/public/data.json` and committed if changed.