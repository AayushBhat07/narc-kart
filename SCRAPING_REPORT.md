# Asian Drug Seizure Data Scraping Report

**Date:** 2026-06-15  
**Project:** Narc Kart - Asian Dataset Expansion  
**Output:** `frontend/public/data_asian.json`

---

## Executive Summary

Successfully compiled a structured dataset of **35 Asian drug seizure incidents** from multiple public sources, covering Myanmar, Thailand, Philippines, Afghanistan, Pakistan, Indonesia, Malaysia, Vietnam, Cambodia, China, Bangladesh, Iran, and the USA (connected to Asian trafficking routes).

---

## Sources Scraped

### 1. Wikipedia (via Wikipedia API)
- `Golden_Triangle_(Southeast_Asia)` - Found seizure mentions
- `Heroin` - Found historical seizure data
- `Methamphetamine` - Found production/seizure mentions
- `Tse_Chi_Lop` - Related to Asian drug trafficking

### 2. Xinhua News Agency
- Myanmar navy seizure reports (2023-2024)
- Over 100kg drug seizures in southern Myanmar
- Myanmar-Thailand border incidents

### 3. Regional News Sources
- **ThaiResidents.com** - Thailand 499kg crystal meth seizure (2023)
- **Bangkok Post** - 50 million meth pills seized
- **Thaiger** - Multiple Chiang Mai, Chiang Rai seizures
- **Eleven Media (Myanmar)** - Multiple maritime seizures
- **Myanmar International TV** - 1.5 tonnes Ice seizure

### 4. Philippine News
- **Wikipedia** - March 2022 Infanta seizure (1,585 kg - largest in Philippine history)
- **Inquirer** - 1.4 tonnes shabu in Batangas
- **VnExpress** - 1.8 tonnes meth record bust
- **GMA News** - Manila Port P2.2B shabu seizure

### 5. UNODC Data
- Referenced for Afghanistan opium production trends
- Golden Crescent route data
- Iran's 89% of world opium seizures

### 6. Known Historical Incidents (from Wikipedia)
- 1988-1991: Multiple large heroin seizures (380-1,280 kg) linked to Golden Triangle
- Hong Kong 420 kg seizure (1989)
- Chicago-Nigerian trafficking group case (1990)

---

## Data Summary

### Seizures by Country
| Country | Count |
|---------|-------|
| Myanmar | 8 |
| Thailand | 5 |
| USA | 5 |
| Philippines | 4 |
| Afghanistan | 2 |
| Indonesia | 2 |
| Malaysia | 2 |
| Pakistan | 1 |
| Iran | 1 |
| Vietnam | 1 |
| Cambodia | 1 |
| China | 1 |
| Hong Kong | 1 |
| Bangladesh | 1 |

### Seizures by Drug Type
| Drug | Count | Total Qty (kg) |
|------|-------|----------------|
| Methamphetamine | 22 | ~22,964 |
| Heroin | 10 | ~5,198 |
| Narcotics (mixed) | 1 | 3,000 |
| Opium | 1 | 2,500 |
| Cocaine | 1 | 50 |

### Seizures by Severity
| Severity | Count |
|----------|-------|
| Critical | 18 |
| High | 14 |
| Medium | 3 |

---

## Routes Documented

1. **Golden Triangle** - Myanmar/Laos/Thailand → SE Asia, Australia, USA
2. **Golden Crescent** - Afghanistan → Pakistan/Iran → Europe
3. **Silk Road/Central Asian** - Afghanistan → Central Asia → Russia/China
4. **Southern Maritime** - Pakistan/Iran → East Africa → Europe
5. **Myanmar-Bangladesh** - Myanmar → Bangladesh → India
6. **Myanmar-Maritime** - Myanmar → Malaysia/Indonesia

---

## Manufacturing Regions Documented

| Drug | Region | Countries |
|------|--------|-----------|
| Heroin | Golden Triangle | Myanmar, Laos, Thailand |
| Heroin | Golden Crescent | Afghanistan, Pakistan, Iran |
| Methamphetamine | Golden Triangle (Shan State) | Myanmar, Thailand, Laos |
| Methamphetamine | Philippines | Philippines |
| Cannabis | Golden Crescent | Afghanistan, Pakistan, Lebanon, Morocco |
| Opium | Golden Crescent | Afghanistan |

---

## Data Quality Assessment

### Strengths
- Geographic coverage across major Asian trafficking regions
- Multiple source types (news, government, Wikipedia)
- Recent data (2022-2024) for major seizures
- Historical context (1988-1991) for route establishment
- Clear severity classifications

### Limitations
- **Wikipedia scraping**: API rate limits caused some articles to fail (429 errors). Not all potential articles were scraped.
- **UNODC data**: UNODC website largely JavaScript-rendered; direct scraping yielded limited structured data.
- **Quantity estimates**: Some pill-based seizures (e.g., "50 million meth pills") required estimation using average pill weights (~65mg per yaba tablet).
- **Date precision**: Some entries have year-only dates (YYYY-01-01) rather than exact dates.
- **Coordinate data**: Many entries lack precise lat/lon; only major cities have coordinates.
- **Agency data**: Not consistently available across all records.

### Data Gaps
The following areas need additional manual research:

1. **Indonesia** - Limited recent seizure data beyond 2022
2. **Malaysia** - Need more granular seizure data beyond the 2024 1.5 ton maritime case
3. **China-Myanmar border** - Specific seizure incidents at Yunnan border
4. **Laos** - Very limited specific seizure data despite being in Golden Triangle
5. **Nepal** - No data despite being on trafficking routes
6. **Sri Lanka** - No data despite strategic location
7. **Japan/South Korea** - Transshipment points with limited data
8. **Australia** - Destination country with limited Asian-source attribution

---

## Methodology

1. **Wikipedia API** used for initial text extraction (with User-Agent header to avoid 403/429)
2. **Scrapling** library tested but encountered API changes (v0.4.9)
3. **Web search** used to identify news sources and specific incidents
4. **Web fetch** used for specific article details (e.g., Infanta seizure)
5. **Manual compilation** of historical incidents from Wikipedia extracts
6. **Deduplication** based on country + drug type + quantity + date

---

## Files Generated

- `frontend/public/data_asian.json` - Final structured dataset (35 seizures, 6 routes, 6 manufacturing regions)
- `frontend/public/data_asian_temp.json` - Intermediate scraped data

---

## Recommendations for Future Work

1. **India NCB website** (`ncb.gov.in`) - Direct scraping of Indian seizure reports
2. **EMCDDA** - European Monitoring Centre has Asian drug data relevant to European markets
3. **News API** - Use news APIs (NewsAPI, Bing News) for more systematic news scraping
4. **Custom scraper** for UNODC data portal (requires JavaScript handling)
5. **Wikipedia periodic scraping** - Implement rate-limiting and caching for Wikipedia API
6. **Cross-reference** with existing India dataset to avoid gaps/overlaps at borders
