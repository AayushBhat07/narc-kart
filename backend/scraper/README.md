# India Drug Seizure Scraper

A comprehensive web scraper for gathering drug seizure data from multiple Indian news sources and government portals. Outputs structured JSON data for the Narc-Kart frontend.

## Features

- Scrapes 10+ sources including NCB, PIB, Times of India, Indian Express, regional newspapers, and police websites
- Covers Tier 1, 2, and 3 cities across India
- Concurrent scraping for speed (threaded)
- Rate limiting to be respectful to sources
- Deduplication based on date, city, drug type, and quantity
- City coordinate lookup for 500+ Indian cities

## Sources

### Priority 1 (Government)
- **NCB Press Releases** - ncb.gov.in
- **PIB** - pib.gov.in

### Priority 2 (Major News)
- **Times of India** - timesofindia.indiatimes.com
- **Indian Express** - indianexpress.com

### Priority 3 (Regional - Tier 2/3 Coverage)
- **Dainik Jagran** - jagran.com (UP, Bihar, Punjab, Haryana, Rajasthan, MP)
- **Amar Ujala** - amarujala.com (Punjab, HP, J&K, Haryana, UP)

### Priority 4 (Police Websites)
- **Punjab Police** - punjabpolice.gov.in
- **Haryana Police** - haryanapolice.gov.in
- **Bihar Police** - biharpolice.in
- **Rajasthan Police** - police.rajasthan.gov.in

## Setup

```bash
cd backend/scraper
pip install -r requirements.txt
```

## Running Locally

```bash
python run_scraper.py
```

The scraper will:
1. Fetch articles from all sources
2. Extract drug seizure data
3. Deduplicate results
4. Write to `frontend/public/data.json`

## Output Format

The scraper outputs `data.json` with this structure:

```json
{
  "seizures": [
    {
      "id": "sz-001",
      "caseNo": "NCB-MUM-2026-0101",
      "city": "Mumbai",
      "state": "Maharashtra",
      "lat": 19.076,
      "lon": 72.877,
      "drugType": "heroin",
      "quantityKg": 156.5,
      "date": "2026-04-20",
      "sourceName": "Narcotics Control Bureau",
      "sourceUrl": "https://www.ncb.gov.in",
      "agency": "Narcotics Control Bureau",
      "description": "...",
      "images": []
    }
  ],
  "stats": {
    "total_seizures": 100,
    "total_quantity_kg": 5000,
    "raids_this_week": 15,
    "by_state": {...},
    "by_drug_type": {...},
    "by_month": {...},
    "top_locations": [...]
  },
  "lastUpdated": "2026-05-21T11:00:00"
}
```

## GitHub Actions

The scraper is designed to run weekly via GitHub Actions. The workflow file is located at `.github/workflows/scrape.yml`.

## Testing Individual Sources

```bash
# Test NCB scraper only
python -c "from run_scraper import scrape_ncb; print(scrape_ncb())"

# Test PIB scraper only
python -c "from run_scraper import scrape_pib; print(scrape_pib())"

# Test with a specific city
python -c "
from run_scraper import load_cities, extract_location
cities = load_cities()
print(extract_location('Police seized 50kg heroin in Amritsar, Punjab', cities))
"
```

## Configuration

Key settings in `run_scraper.py`:

- `MAX_WORKERS = 5` - Concurrent threads
- `REQUEST_DELAY = 1.0` - Seconds between requests to same domain
- `RECENT_DAYS = 30` - Only scrape recent articles
- `OUTPUT_FILE` - Output path (default: `frontend/public/data.json`)

## Drug Type Mapping

The scraper normalizes these drug names:
- heroin, brown sugar, smack → `heroin`
- meth, methamphetamine, ice, crystal meth → `meth`
- ganja, cannabis, charas, marijuana, bhang → `cannabis`
- cocaine → `cocaine`
- MDMA, ecstasy → `mdma`
- morphine → `morphine`
- opium, poppy, poppy husk → `opium`
- LSD, acid → `lsd`
- ketamine → `ketamine`
- tramadol, benzodiazepines → respective categories

## Known Limitations

1. **Rate Blocking** - Some sources may block requests. The scraper logs warnings and continues.
2. **Incomplete Coverage** - Tier 3 cities with poor internet connectivity may have limited data.
3. **Date Extraction** - Not all articles have parseable dates; defaults to current date.
4. **Location Extraction** - Some smaller towns may not be in the city lookup table.
5. **Quantity Extraction** - Quantities may not always be extractable from text.

## Troubleshooting

### "Connection refused" errors
- Source may be blocking requests
- Try adjusting the User-Agent header
- Check if the source URL has changed

### Missing city coordinates
- Add the city to `cities.json`
- Follow the existing format: `{"name": "City", "state": "State", "lat": 0.0, "lon": 0.0}`

### Too many duplicates
- The deduplication is based on (date + city + drug_type + quantity)
- Increase the hash precision if needed

## License

MIT