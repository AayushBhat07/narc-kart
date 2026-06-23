#!/usr/bin/env python3
"""
NARC KART — Asian Drug Seizure Scraper (Scrapling v0.4.9)
Uses Fetcher (HTTP) with adaptive CSS parsing.
Target: Wikipedia, UNODC, INTERPOL, regional news.
"""
import json, re, time, sys, random, hashlib
from datetime import datetime

from scrapling import Fetcher

# ── Fetcher init ─────────────────────────────────────────────────
fetcher = Fetcher()

# ── Helpers ──────────────────────────────────────────────────────
CITY_COORDS = {
    'yangon': (16.87, 96.19), 'mandalay': (21.97, 96.08), 'taunggyi': (20.73, 97.04),
    'bangkok': (13.75, 100.52), 'chiang mai': (18.79, 98.99), 'chiang rai': (20.36, 99.83),
    'mae sot': (16.71, 98.57),
    'manila': (14.60, 120.98), 'cebu': (10.32, 123.90), 'davao': (7.07, 125.61),
    'infanta': (14.75, 121.70),
    'jakarta': (-6.21, 106.85), 'surabaya': (-7.25, 112.75), 'medan': (3.60, 98.67),
    'denpasar': (-8.65, 115.22),
    'kuala lumpur': (3.14, 101.69), 'kuching': (1.55, 110.36),
    'hanoi': (21.03, 105.85), 'ho chi minh city': (10.82, 106.63), 'da nang': (16.05, 108.07),
    'phnom penh': (11.56, 104.92), 'siem reap': (13.36, 103.86),
    'dhaka': (23.81, 90.41), 'chittagong': (22.36, 91.83),
    'kathmandu': (27.72, 85.31), 'colombo': (6.93, 79.86),
    'islamabad': (33.72, 73.04), 'karachi': (24.86, 67.01), 'peshawar': (34.00, 71.57),
    'kabul': (34.53, 69.17), 'herat': (34.34, 62.20), 'kandahar': (31.61, 65.71),
    'tehran': (35.69, 51.39), 'zahedan': (29.50, 60.87),
    'kolkata': (22.57, 88.36), 'mumbai': (19.08, 72.88), 'delhi': (28.70, 77.10),
    'chennai': (13.08, 80.27), 'guangzhou': (23.13, 113.26), 'kunming': (25.04, 102.71),
}

def get_coords(city):
    c = city.lower().strip()
    return CITY_COORDS.get(c, (None, None))

def sev(kg):
    if not kg or kg <= 0: return 'low'
    if kg > 100: return 'critical'
    if kg > 10:  return 'high'
    return 'low'

def norm_drug(t):
    t = str(t).upper()
    if any(x in t for x in ['METH', 'AMP', 'ICE', 'SHABU', 'YABA', 'YA BA', 'CRYSTAL']):
        return 'Methamphetamine'
    if any(x in t for x in ['HEROIN', 'DIACETYLMORPHINE', 'BROWN SUGAR']):
        return 'Heroin'
    if any(x in t for x in ['CANNABIS', 'MARIJUANA', 'GANJA', 'HASHISH', 'WEED']):
        return 'Cannabis'
    if 'COCAINE' in t: return 'Cocaine'
    if any(x in t for x in ['OPIUM', 'MORPHINE']): return 'Opium'
    if 'METHADONE' in t or 'METHOLONE' in t: return 'Methadone'
    return t

def mkid(prefix, text):
    h = hashlib.md5(str(text).encode()).hexdigest()[:8]
    return f"{prefix}-{h}"

def parse_quantity(text):
    if not text: return None
    text = str(text)
    # Yaba pills
    m = re.search(r'([\d,.]+(?:\.\d+)?)\s*(?:million\s+)?(?:yaba\s+)?pills?', text, re.I)
    if m:
        pills = float(m.group(1).replace(',', ''))
        if 'million' in text.lower(): pills *= 1_000_000
        return round(pills * 0.00006, 2)
    # Tonnes
    for m in re.findall(r'([\d,.]+(?:\.\d+)?)\s*tonnes?', text, re.I):
        q = float(m.replace(',', '')) * 1000
        if 0.1 < q < 500_000: return q
    # kg
    for m in re.findall(r'([\d,.]+(?:\.\d+)?)\s*(?:kg|kilograms?)', text, re.I):
        q = float(m.replace(',', ''))
        if 0.1 < q < 500_000: return q
    # tons (short ton)
    for m in re.findall(r'([\d,.]+(?:\.\d+)?)\s*tons?', text, re.I):
        q = float(m.replace(',', '')) * 907
        if 0.1 < q < 500_000: return q
    return None

def parse_date(text):
    if not text: return None
    text = str(text)[:600]
    m = re.search(r'(202[0-5])-(0[1-9]|1[0-2])-(0[1-2]\d|3[01])', text)
    if m: return m.group()
    m = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(202[0-5])', text, re.I)
    if m:
        mon = {'jan':'01','feb':'02','mar':'03','apr':'04','may':'05','jun':'06','jul':'07','aug':'08','sep':'09','oct':'10','nov':'11','dec':'12'}
        k = m.group(1).lower()[:3]
        return f"{m.group(2)}-{mon.get(k,'01')}-01"
    m = re.search(r'\b(202[0-5])\b', text)
    if m: return f"{m.group(1)}-01-01"
    return None

def normalize(country, city, drug, qty, date, source, source_url, headline, mfg, route, agency):
    if not qty or qty <= 0: return None
    drug = norm_drug(drug)
    lat, lon = get_coords(city)
    return {
        "id": mkid('scraped', f"{country}{city}{drug}{qty}"),
        "country": country,
        "location": {"city": city, "state": city, "lat": lat, "lon": lon},
        "drugType": drug,
        "quantityKg": round(qty, 2),
        "date": date or '2024-01-01',
        "source": str(source)[:200],
        "sourceUrl": source_url or '',
        "headline": str(headline)[:300],
        "manufacturingOrigin": mfg,
        "smugglingRoute": route,
        "agency": agency,
        "severity": sev(qty)
    }

# ── Core fetch + extract ─────────────────────────────────────────
def fetch_page(url, timeout=25):
    """Fetch URL with scrapling Fetcher, return (Selector, text)."""
    try:
        resp = fetcher.get(url, timeout=timeout)
        time.sleep(random.uniform(1.5, 3.0))
        # Get clean text from body
        texts = resp.css('body ::text').getall()
        full_text = ' '.join(t.strip() for t in texts if t.strip())
        if len(full_text) < 50:
            full_text = resp.text or ''
        title = resp.css('h1::text').get('') or resp.css('title::text').get('') or url
        return resp, full_text, title
    except Exception as e:
        print(f"  [ERROR fetch] {e}")
        return None, '', ''

def extract_from_text(text, country, city_hint, drug_hint, mfg_hint, route_hint, agency_hint, source, source_url):
    """Extract seizure records from raw text using regex patterns."""
    records = []
    if not text or len(text) < 50: return records

    # Pattern: NUMBER + UNIT + "seized/recovered/confiscated/captured"
    pattern = re.compile(
        r'(\d[\d,.]+(?:\.\d+)?)\s*(?:tonnes?|tons?|kg|kilograms?|million\s+(?:yaba\s+)?pills?)'
        r'\s+(?:of\s+)?'
        r'(?:the\s+)?'
        r'(\w+(?:\s+\w+){0,3}?)'
        r'\s+(?:seized|recovered|confiscated|captured|bust|found|discovered|nabbed)',
        re.I
    )

    for m in pattern.finditer(text):
        qty_raw = m.group(1)
        drug_raw = m.group(2) if m.lastindex >= 2 else drug_hint
        qty = parse_quantity(qty_raw)
        if not qty or qty < 0.1: continue

        date = parse_date(text)
        drug = norm_drug(drug_raw) if drug_raw else drug_hint

        rec = normalize(
            country=country, city=city_hint, drug=drug,
            qty=qty, date=date,
            source=source, source_url=source_url,
            headline='', mfg=mfg_hint, route=route_hint, agency=agency_hint
        )
        if rec:
            records.append(rec)

    # Also extract standalone quantities with drug type nearby
    qty_mentions = re.findall(
        r'(\d[\d,.]+(?:\.\d+)?)\s*(?:tonnes?|tons?|kg|kilograms?)',
        text, re.I
    )
    for q_raw in qty_mentions:
        qty = parse_quantity(q_raw)
        if not qty or qty < 0.5: continue
        # Skip tiny amounts — probably unrelated
        date = parse_date(text)
        rec = normalize(
            country=country, city=city_hint, drug=drug_hint,
            qty=qty, date=date,
            source=source, source_url=source_url,
            headline='', mfg=mfg_hint, route=route_hint, agency=agency_hint
        )
        if rec and rec not in records:
            records.append(rec)

    return records

# ── Target URLs ──────────────────────────────────────────────────
WIKIPEDIA_TARGETS = [
    ("https://en.wikipedia.org/wiki/March_2022_Infanta_drug_seizure", "Philippines", "Infanta", "Methamphetamine", "Myanmar", "Via sea routes", "PNP/Philippine Navy"),
    ("https://en.wikipedia.org/wiki/Ya_ba", "Myanmar/Thailand", "Myanmar", "Methamphetamine", "Myanmar", "Golden Triangle", "Myanmar/Thai authorities"),
    ("https://en.wikipedia.org/wiki/Golden_Triangle_(Southeast_Asia)", "Myanmar/Laos/Thailand", "Myanmar", "Methamphetamine", "Myanmar", "Golden Triangle", "Regional authorities"),
    ("https://en.wikipedia.org/wiki/Opium_production_in_Myanmar", "Myanmar", "Myanmar", "Heroin", "Myanmar", "Golden Triangle", "Myanmar authorities"),
    ("https://en.wikipedia.org/wiki/Opium_production_in_Afghanistan", "Afghanistan", "Afghanistan", "Heroin", "Afghanistan", "Golden Crescent", "Afghan authorities"),
    ("https://en.wikipedia.org/wiki/Illegal_drug_trade_in_China", "China", "China", "Methamphetamine", "Myanmar", "Silk Road", "Chinese authorities"),
    ("https://en.wikipedia.org/wiki/Philippine_drug_war", "Philippines", "Philippines", "Methamphetamine", "Myanmar", "Via sea routes", "PNP"),
    ("https://en.wikipedia.org/wiki/Crime_in_Thailand", "Thailand", "Thailand", "Methamphetamine", "Myanmar", "Golden Triangle", "Thai authorities"),
    ("https://en.wikipedia.org/wiki/Drug_trafficking_in_Myanmar", "Myanmar", "Myanmar", "Methamphetamine", "Myanmar", "Golden Triangle", "Myanmar authorities"),
    ("https://en.wikipedia.org/wiki/Drug_policy_of_China", "China", "China", "Methamphetamine", "Myanmar", "Silk Road", "Chinese authorities"),
    ("https://en.wikipedia.org/wiki/Frank_Lucas", "Myanmar/Afghanistan", "Afghanistan", "Heroin", "Afghanistan", "Golden Crescent", "US/Afghan authorities"),
    ("https://en.wikipedia.org/wiki/Khun_Sa", "Myanmar", "Myanmar", "Heroin", "Myanmar", "Golden Triangle", "Myanmar authorities"),
    ("https://en.wikipedia.org/wiki/Illegal_drug_trade", "Multiple", "Asia", "Methamphetamine", "Myanmar", "Various", "Regional authorities"),
]

# ── Scraper phases ───────────────────────────────────────────────
def run_wikipedia_scrapes():
    print("\n[PHASE 1] Wikipedia article scrapes (Scrapling Fetcher)")
    all_records = []
    for url, country, city, drug, mfg, route, agency in WIKIPEDIA_TARGETS:
        print(f"\n[URL] {url}")
        page, text, title = fetch_page(url)
        if not page:
            print("  FAILED")
            continue
        print(f"  Title: {title[:60]}")
        print(f"  Text: {len(text)} chars")

        recs = extract_from_text(text, country, city, drug, mfg, route, agency, f"Wikipedia: {title[:80]}", url)
        print(f"  Records extracted: {len(recs)}")
        for r in recs:
            print(f"  + {r['id']}: {r['country']} | {r['drugType']} | {r['quantityKg']}kg | {r['severity']}")
        all_records.extend(recs)
        time.sleep(random.uniform(1.5, 3.0))
    return all_records

def run_wikipedia_lists():
    print("\n[PHASE 2] Wikipedia list + category pages (Scrapling adaptive)")
    all_records = []
    list_pages = [
        ("https://en.wikipedia.org/wiki/Category:Drug_seizures", "Asia"),
        ("https://en.wikipedia.org/w/index.php?title=Category:Drug_seizures&action=edit", "Asia"),
    ]
    for url, region in list_pages:
        print(f"\n[LIST] {url}")
        page, text, title = fetch_page(url)
        if not page: continue
        print(f"  Text: {len(text)} chars")

        # Extract all quantity mentions from the page
        recs = extract_from_text(text, "Asia", "Asia", "Methamphetamine", "Myanmar", "Various", "Regional authorities",
                                  f"Wikipedia list: {title}", url)
        for r in recs:
            print(f"  + {r['id']}: {r['country']} | {r['drugType']} | {r['quantityKg']}kg")
        all_records.extend(recs)
        time.sleep(2)
    return all_records

def run_interpol():
    print("\n[PHASE 3] INTERPOL news (Scrapling adaptive)")
    all_records = []
    interpol_searches = [
        "https://www.interpol.int/News-and-Events?search=drug%20seizure%20Asia",
        "https://www.interpol.int/News-and-Events?search=Asia%20drug%20operation",
    ]
    for url in interpol_searches:
        print(f"\n[INTERPOL] {url}")
        page, text, title = fetch_page(url)
        if not page: continue

        # Find article links
        links = page.css('a::attr(href)').getall()
        article_links = list(dict.fromkeys([
            l for l in links
            if '/News-and-Events/' in l and l != '/News-and-Events' and not l.startswith('#')
        ]))[:12]

        print(f"  Articles found: {len(article_links)}")

        for link in article_links:
            full_url = f"https://www.interpol.int{link}" if link.startswith('/') else link
            art_page, art_text, art_title = fetch_page(full_url)
            if not art_page: continue

            qty = parse_quantity(art_text)
            if qty and qty > 0.1:
                date = parse_date(art_text)
                country_m = re.search(r'(Myanmar|Thailand|Philippines|Indonesia|Vietnam|Cambodia|Laos|Bangladesh|Pakistan|Afghanistan|India|China|Japan|Malaysia|Singapore)', art_text, re.I)
                country = country_m.group(1) if country_m else 'Asia'
                city_m = re.search(r'(Bangkok|Manila|Jakarta|Hanoi|Yangon|Dhaka|Kabul|Karachi|Kolkata|Kuala Lumpur|Singapore|Ho Chi Minh)', art_text, re.I)
                city = city_m.group(1) if city_m else country
                lat, lon = get_coords(city.lower())

                rec = {
                    "id": mkid('interpol', full_url),
                    "country": country,
                    "location": {"city": city, "state": country, "lat": lat, "lon": lon},
                    "drugType": norm_drug(art_text),
                    "quantityKg": round(qty, 2),
                    "date": date or datetime.now().strftime('%Y-%m-%d'),
                    "source": f"INTERPOL: {art_title[:100]}",
                    "sourceUrl": full_url,
                    "headline": art_title[:200],
                    "manufacturingOrigin": None,
                    "smugglingRoute": None,
                    "agency": "INTERPOL",
                    "severity": sev(qty)
                }
                all_records.append(rec)
                print(f"  + INTERPOL: {country} | {rec['drugType']} | {qty}kg | {sev(qty)}")
            time.sleep(random.uniform(1, 2))

    return all_records

def run_unodc():
    print("\n[PHASE 4] UNODC data (Scrapling adaptive)")
    all_records = []
    unodc_urls = [
        "https://dataunodc.un.org/ drug-seizures",
        "https://dataunodc.un.org/ statistics/explore/drug-seizures",
    ]
    for url in unodc_urls:
        url_clean = url.strip()
        print(f"\n[UNODC] {url_clean}")
        page, text, title = fetch_page(url_clean)
        if not page: continue
        print(f"  Text: {len(text)} chars")

        # Try table extraction
        tables = page.css('table')
        print(f"  Tables: {len(tables)}")

        for ti, table in enumerate(tables):
            rows = table.css('tr')
            print(f"  Table {ti}: {len(rows)} rows")
            for row in rows[1:]:  # skip header
                cells = row.css('td::text').getall()
                if len(cells) >= 3:
                    cell_text = ' '.join(c.strip() for c in cells if c.strip())
                    qty = parse_quantity(cell_text)
                    if qty and qty > 0.1:
                        date = parse_date(cell_text)
                        rec = {
                            "id": mkid('unodc', f"{url_clean}{ti}{cells[0]}"),
                            "country": cells[0].strip() if cells else 'Unknown',
                            "location": {"city": cells[1].strip() if len(cells) > 1 else '', "state": '', "lat": None, "lon": None},
                            "drugType": norm_drug(cells[2].strip() if len(cells) > 2 else 'Unknown'),
                            "quantityKg": round(qty, 2),
                            "date": date or '2024-01-01',
                            "source": "UNODC Data Portal",
                            "sourceUrl": url_clean,
                            "headline": '',
                            "manufacturingOrigin": None,
                            "smugglingRoute": None,
                            "agency": cells[3].strip() if len(cells) > 3 else None,
                            "severity": sev(qty)
                        }
                        all_records.append(rec)
                        print(f"  + UNODC: {rec['country']} | {rec['drugType']} | {qty}kg")
        time.sleep(2)
    return all_records

# ── Validation ───────────────────────────────────────────────────
def validate_record(r):
    """Return (valid: bool, reason: str)."""
    if not r: return False, "None record"
    if not r.get('country'): return False, "No country"
    if not r.get('drugType'): return False, "No drug type"
    qty = r.get('quantityKg')
    if not qty or qty <= 0: return False, f"Invalid qty {qty}"
    if qty > 500_000: return False, f"Qty {qty}kg exceeds cap"
    date = r.get('date', '')
    if date and not re.match(r'^\d{4}-\d{2}-\d{2}$', date): return False, f"Bad date {date}"
    return True, "ok"

# ── Main ─────────────────────────────────────────────────────────
print("=" * 60)
print("NARC KART — Asian Drug Seizure Scraper (Scrapling)")
print(f"Started: {datetime.now().isoformat()}")
print("=" * 60)

all_new = []
all_new.extend(run_wikipedia_scrapes())
all_new.extend(run_wikipedia_lists())
all_new.extend(run_interpol())
all_new.extend(run_unodc())

print(f"\n[DEDUP] Raw: {len(all_new)}")
seen = {}
deduped = []
skipped = 0
for r in all_new:
    key = (r['country'], r['location']['city'], r['drugType'], round(r['quantityKg'], 1))
    if key not in seen:
        valid, reason = validate_record(r)
        if valid:
            seen[key] = r
            deduped.append(r)
        else:
            skipped += 1
    time.sleep(0.1)

print(f"Valid unique records: {len(deduped)} (skipped {skipped} invalid)")

# ── Merge with existing ──────────────────────────────────────────
with open('/Users/aayush07/Documents/GitHub/narc-kart/frontend/public/data_asian.json') as f:
    existing = json.load(f)

existing_keys = {
    (s['country'], s['location']['city'], s['drugType'], round(s.get('quantityKg', 0), 1))
    for s in existing['seizures']
}

merged = existing['seizures'].copy()
added = 0
for r in deduped:
    key = (r['country'], r['location']['city'], r['drugType'], round(r['quantityKg'], 1))
    if key not in existing_keys:
        merged.append(r)
        added += 1

print(f"New records merged: {added}")
print(f"Total records: {len(merged)}")

# ── Stats ────────────────────────────────────────────────────────
countries = set(s['country'] for s in merged)
drugs = {}
for s in merged:
    t = s.get('drugType', 'Unknown')
    drugs[t] = drugs.get(t, 0) + 1
crit = sum(1 for s in merged if s['severity'] == 'critical')
high = sum(1 for s in merged if s['severity'] == 'high')
low  = sum(1 for s in merged if s['severity'] == 'low')
total_kg = sum(s.get('quantityKg', 0) for s in merged)
print(f"\nDataset stats:")
print(f"  Total: {len(merged)} | Countries: {len(countries)}")
print(f"  Drugs: {sorted(drugs.items(), key=lambda x: -x[1])[:6]}")
print(f"  Severity: crit={crit} high={high} low={low}")
print(f"  Volume: {total_kg/1000:.1f}T")

# ── Write ────────────────────────────────────────────────────────
output = {
    "source": "Compiled via Scrapling (Fetcher) from UNODC, Wikipedia, INTERPOL | " + datetime.now().strftime('%Y-%m-%d'),
    "scraped_at": datetime.now().isoformat(),
    "seizures": merged,
    "routes": existing.get('routes', []),
    "manufacturing": existing.get('manufacturing', [])
}

with open('/Users/aayush07/Documents/GitHub/narc-kart/frontend/public/data_asian.json', 'w') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\nWritten! {datetime.now().isoformat()}")