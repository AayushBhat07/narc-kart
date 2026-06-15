#!/usr/bin/env python3
"""
Asian drug seizure data scraper.
Uses Wikipedia API + direct web fetching to build structured seizure records.
"""
import json, re, time, urllib.request, urllib.parse

def fetch(url, timeout=10):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'NarcKart/1.0 research'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"  fetch error {url}: {e}")
        return ""

def wikipedia_search(query, limit=10):
    """Search Wikipedia API."""
    params = urllib.parse.urlencode({
        'action': 'query', 'list': 'search', 'srsearch': query,
        'format': 'json', 'srlimit': limit,
        'srprop': 'snippet|sizelimit'
    })
    url = f"https://en.wikipedia.org/w/api.php?{params}"
    data = json.loads(fetch(url))
    return data.get('query', {}).get('search', [])

def wikipedia_page(title):
    """Get Wikipedia page extract."""
    params = urllib.parse.urlencode({
        'action': 'query', 'titles': title, 'prop': 'extracts',
        'exintro': True, 'explaintext': True, 'format': 'json'
    })
    url = f"https://en.wikipedia.org/w/api.php?{params}"
    data = json.loads(fetch(url))
    pages = data.get('query', {}).get('pages', {})
    for page in pages.values():
        return page.get('extract', ''), page.get('pageid')
    return '', None

# ─── City coordinates for lat/lon ───────────────────────────────────────────
CITY_COORDS = {
    'yangon': (16.87, 96.19), 'mandalay': (21.97, 96.08), 'taunggyi': (20.73, 97.04),
    'bangkok': (13.75, 100.52), 'chiang mai': (18.79, 98.99), 'chiang rai': (20.36, 99.83),
    'manila': (14.60, 120.98), 'cebu': (10.32, 123.90), 'davao': (7.07, 125.61),
    'jakarta': (-6.21, 106.85), 'surabaya': (-7.25, 112.75), 'medan': (3.60, 98.67),
    'kuala lumpur': (3.14, 101.69), 'kuching': (1.55, 110.36),
    'hanoi': (21.03, 105.85), 'ho chi minh': (10.82, 106.63), 'da nang': (16.05, 108.07),
    'phnom penh': (11.56, 104.92), 'siem reap': (13.36, 103.86),
    'dhaka': (23.81, 90.41), 'chittagong': (22.36, 91.83), 'sylhet': (24.90, 91.87),
    'kathmandu': (27.72, 85.31), 'colombo': (6.93, 79.86),
    'islamabad': (33.72, 73.04), 'karachi': (24.86, 67.01), 'peshawar': (34.00, 71.57),
    'kabul': (34.53, 69.17), 'herat': (34.34, 62.20),
    'tehran': (35.69, 51.39), 'zahedan': (29.50, 60.87),
    'kolkata': (22.57, 88.36), 'mumbai': (19.08, 72.88), 'delhi': (28.70, 77.10),
    'chennai': (13.08, 80.27), 'bangalore': (12.97, 77.59), 'hyderabad': (17.38, 78.48),
    'guangzhou': (23.13, 113.26), 'kunming': (25.04, 102.71), 'jinghong': (21.99, 100.73),
}

def get_coords(city):
    c = city.lower().strip()
    return CITY_COORDS.get(c, (None, None))

def severity(kg):
    if kg > 100: return 'critical'
    if kg > 10:  return 'high'
    return 'low'

def slugify(text):
    import hashlib
    h = hashlib.md5(text.encode()).hexdigest()[:6]
    return f"{text.lower().replace(' ','-')[:20]}-{h}"

# ─── Build records from Wikipedia searches ────────────────────────────────────
new_records = []
counter = 100

def add_record(country, city, state_region, drug_type, qty_kg, date, source, source_url, headline, mfg_origin, route, agency):
    global counter
    if not qty_kg or qty_kg <= 0: return
    lat, lon = get_coords(city)
    record = {
        "id": f"news-{counter:03d}",
        "country": country,
        "location": {"city": city, "state": state_region, "lat": lat, "lon": lon},
        "drugType": drug_type,
        "quantityKg": round(qty_kg, 2),
        "date": date,
        "source": source,
        "sourceUrl": source_url or "",
        "headline": headline or "",
        "manufacturingOrigin": mfg_origin or None,
        "smugglingRoute": route or None,
        "agency": agency or None,
        "severity": severity(qty_kg)
    }
    new_records.append(record)
    counter += 1

# ─── Search 1: Myanmar 2024-2025 ─────────────────────────────────────────────
print("Searching: Myanmar drug seizures 2024-2025...")
for res in wikipedia_search("Myanmar drug seizure 2024 methamphetamine", limit=15):
    title = res['title']
    snippet = re.sub('<[^<]+?>', '', res.get('snippet',''))
    extract, _ = wikipedia_page(title)
    full_text = (snippet + ' ' + extract)[:3000]

    # Try to find quantities
    kg_matches = re.findall(r'(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?|kg|kilograms?)', full_text, re.IGNORECASE)
    for m in kg_matches:
        qty = float(m)
        if qty < 1: qty *= 1000  # convert tonnes to kg
        if qty > 50000: qty /= 1000  # guard against absurdity

        date_match = re.search(r'(?:202[0-5])[-/](?:\d{1,2}[-/](?:\d{1,2}[-/](?:\d{2,4})?)?|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}', full_text, re.I)
        date_str = date_match.group() if date_match else "2024-01-01"

        add_record(
            country="Myanmar", city="Myanmar", state_region="Myanmar",
            drug_type="Methamphetamine", qty_kg=qty,
            date=date_str, source=f"Wikipedia: {title}", source_url="",
            headline=title, mfg_origin="Myanmar", route="Golden Triangle",
            agency="Myanmar authorities"
        )
    time.sleep(0.3)

# ─── Search 2: Thailand 2024-2025 ────────────────────────────────────────────
print("Searching: Thailand methamphetamine seizure 2024...")
for res in wikipedia_search("Thailand drug seizure 2024 methamphetamine", limit=10):
    title = res['title']
    snippet = re.sub('<[^<]+?>', '', res.get('snippet',''))
    extract, _ = wikipedia_page(title)
    full_text = (snippet + ' ' + extract)[:2000]

    kg_matches = re.findall(r'(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?|kg)', full_text, re.IGNORECASE)
    for m in kg_matches:
        qty = float(m)
        if qty < 1: qty *= 1000

        add_record(
            country="Thailand", city="Thailand", state_region="Thailand",
            drug_type="Methamphetamine", qty_kg=qty,
            date="2024-01-01", source=f"Wikipedia: {title}", source_url="",
            headline=title, mfg_origin="Myanmar", route="Golden Triangle",
            agency="Thai authorities"
        )
    time.sleep(0.3)

# ─── Search 3: Philippines shabu/meth 2022-2024 ──────────────────────────────
print("Searching: Philippines methamphetamine seizure 2022-2024...")
for res in wikipedia_search("Philippines methamphetamine seizure 2022 2023 2024", limit=10):
    title = res['title']
    snippet = re.sub('<[^<]+?>', '', res.get('snippet',''))
    extract, _ = wikipedia_page(title)
    full_text = (snippet + ' ' + extract)[:2000]

    kg_matches = re.findall(r'(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:tonnes?|tons?|kg|kilograms?)', full_text, re.IGNORECASE)
    for m in kg_matches:
        qty = float(m.replace(',',''))
        if qty < 1: qty *= 1000

        add_record(
            country="Philippines", city="Philippines", state_region="Philippines",
            drug_type="Methamphetamine", qty_kg=qty,
            date="2023-01-01", source=f"Wikipedia: {title}", source_url="",
            headline=title, mfg_origin="Myanmar/Philippines", route="Via sea routes",
            agency="PNP/NDEA"
        )
    time.sleep(0.3)

# ─── Search 4: Golden Triangle ────────────────────────────────────────────────
print("Searching: Golden Triangle drug 2024...")
for res in wikipedia_search("Golden Triangle methamphetamine heroin seizure 2023 2024", limit=10):
    title = res['title']
    snippet = re.sub('<[^<]+?>', '', res.get('snippet',''))
    extract, _ = wikipedia_page(title)
    full_text = (snippet + ' ' + extract)[:2000]

    # Heroin vs meth
    drug = "Heroin" if "heroin" in title.lower() else "Methamphetamine"
    kg_matches = re.findall(r'(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?|kg)', full_text, re.IGNORECASE)
    for m in kg_matches:
        qty = float(m)
        if qty < 1: qty *= 1000

        add_record(
            country="Myanmar", city="Myanmar", state_region="Myanmar",
            drug_type=drug, qty_kg=qty,
            date="2024-01-01", source=f"Wikipedia: {title}", source_url="",
            headline=title, mfg_origin="Myanmar", route="Golden Triangle",
            agency="Myanmar/regional authorities"
        )
    time.sleep(0.3)

# ─── Search 5: Indonesia BNN seizures ────────────────────────────────────────
print("Searching: Indonesia drug seizure 2023 2024...")
for res in wikipedia_search("Indonesia methamphetamine seizure 2023 2024 BNN", limit=8):
    title = res['title']
    snippet = re.sub('<[^<]+?>', '', res.get('snippet',''))
    extract, _ = wikipedia_page(title)
    full_text = (snippet + ' ' + extract)[:2000]

    kg_matches = re.findall(r'(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?|kg)', full_text, re.IGNORECASE)
    for m in kg_matches:
        qty = float(m)
        if qty < 1: qty *= 1000

        add_record(
            country="Indonesia", city="Indonesia", state_region="Indonesia",
            drug_type="Methamphetamine", qty_kg=qty,
            date="2024-01-01", source=f"Wikipedia: {title}", source_url="",
            headline=title, mfg_origin="Myanmar", route="Sea route from Myanmar",
            agency="BNN Indonesia"
        )
    time.sleep(0.3)

# ─── Search 6: Pakistan/Afghanistan heroin ────────────────────────────────────
print("Searching: Pakistan heroin seizure 2023 2024...")
for res in wikipedia_search("Pakistan heroin seizure 2023 2024 ANF", limit=8):
    title = res['title']
    snippet = re.sub('<[^<]+?>', '', res.get('snippet',''))
    extract, _ = wikipedia_page(title)
    full_text = (snippet + ' ' + extract)[:2000]

    kg_matches = re.findall(r'(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?|kg)', full_text, re.IGNORECASE)
    for m in kg_matches:
        qty = float(m)
        if qty < 1: qty *= 1000

        add_record(
            country="Pakistan", city="Pakistan", state_region="Pakistan",
            drug_type="Heroin", qty_kg=qty,
            date="2024-01-01", source=f"Wikipedia: {title}", source_url="",
            headline=title, mfg_origin="Afghanistan", route="Golden Crescent",
            agency="Anti-Narcotics Force Pakistan"
        )
    time.sleep(0.3)

# ─── Search 7: Malaysia meth ─────────────────────────────────────────────────
print("Searching: Malaysia methamphetamine seizure 2023 2024...")
for res in wikipedia_search("Malaysia methamphetamine seizure 2023 2024", limit=8):
    title = res['title']
    snippet = re.sub('<[^<]+?>', '', res.get('snippet',''))
    extract, _ = wikipedia_page(title)
    full_text = (snippet + ' ' + extract)[:2000]

    kg_matches = re.findall(r'(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?|kg)', full_text, re.IGNORECASE)
    for m in kg_matches:
        qty = float(m)
        if qty < 1: qty *= 1000

        add_record(
            country="Malaysia", city="Malaysia", state_region="Malaysia",
            drug_type="Methamphetamine", qty_kg=qty,
            date="2024-01-01", source=f"Wikipedia: {title}", source_url="",
            headline=title, mfg_origin="Myanmar", route="Via sea/land",
            agency="Royal Malaysia Police"
        )
    time.sleep(0.3)

# ─── Search 8: Bangladesh Yaba ───────────────────────────────────────────────
print("Searching: Bangladesh drug seizure 2023 2024...")
for res in wikipedia_search("Bangladesh yaba methamphetamine seizure 2023 2024", limit=8):
    title = res['title']
    snippet = re.sub('<[^<]+?>', '', res.get('snippet',''))
    extract, _ = wikipedia_page(title)
    full_text = (snippet + ' ' + extract)[:2000]

    # Yaba pills → estimate 0.06g per pill avg
    pill_matches = re.findall(r'(\d+(?:,\d+)*)\s*(?:million\s+)?yaba\s+pills?', full_text, re.I)
    for m in pill_matches:
        pills = float(m.replace(',',''))
        qty = round(pills * 0.06, 2)  # kg

        add_record(
            country="Bangladesh", city="Bangladesh", state_region="Bangladesh",
            drug_type="Methamphetamine", qty_kg=qty,
            date="2024-01-01", source=f"Wikipedia: {title}", source_url="",
            headline=title, mfg_origin="Myanmar", route="Myanmar-Bangladesh border",
            agency="Bangladesh authorities"
        )
    time.sleep(0.3)

print(f"\nNew records found: {len(new_records)}")

# ─── Deduplicate ─────────────────────────────────────────────────────────────
seen = set()
deduped = []
for r in new_records:
    key = (r['country'], r['location']['city'], r['drugType'], r['quantityKg'])
    if key not in seen:
        seen.add(key)
        deduped.append(r)

print(f"After dedup: {len(deduped)}")

# ─── Load existing + merge ────────────────────────────────────────────────────
with open('/Users/aayush07/Documents/GitHub/narc-kart/frontend/public/data_asian.json') as f:
    existing = json.load(f)

existing_ids = {s['id'] for s in existing['seizures']}
merged_seizures = existing['seizures'].copy()

for r in deduped:
    if r['id'] not in existing_ids:
        merged_seizures.append(r)
    else:
        # Renumber duplicate
        r['id'] = f"news-{counter:03d}"
        counter += 1
        merged_seizures.append(r)

print(f"Total seizures after merge: {len(merged_seizures)}")

# ─── Write updated file ───────────────────────────────────────────────────────
output = {
    "source": existing.get('source', '') + " | Updated via Wikipedia API + NarcKart scraper",
    "scraped_at": existing.get('scraped_at', ''),
    "seizures": merged_seizures,
    "routes": existing.get('routes', []),
    "manufacturing": existing.get('manufacturing', [])
}

with open('/Users/aayush07/Documents/GitHub/narc-kart/frontend/public/data_asian.json', 'w') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print("Written to data_asian.json")
print("\nSample new records:")
for r in deduped[:5]:
    print(f"  {r['id']}: {r['country']} | {r['drugType']} | {r['quantityKg']}kg | {r['severity']}")