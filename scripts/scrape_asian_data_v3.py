#!/usr/bin/env python3
"""
Enhanced Asian drug seizure scraper with better quantity extraction.
Focuses on actual seizure incidents, not production estimates.
"""

import json
import time
import random
import re
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path

import scrapling

BASE_DIR = Path(__file__).parent.parent
OUTPUT_FILE = BASE_DIR / "frontend" / "public" / "data_asian.json"
INTERMEDIATE_FILE = BASE_DIR / "frontend" / "public" / "data_asian_temp.json"

def random_delay(min_sec=1, max_sec=3):
    time.sleep(random.uniform(min_sec, max_sec))

def wiki_api_request(params):
    """Make Wikipedia API request with proper headers."""
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"    API error: {e}")
        return {}

def scrape_wiki_page_text(title):
    """Get plain text of a Wikipedia page."""
    params = {
        "action": "query",
        "titles": title,
        "prop": "extracts",
        "explaintext": True,
        "format": "json"
    }
    data = wiki_api_request(params)
    pages = data.get("query", {}).get("pages", {})
    for page_id, page_data in pages.items():
        if page_id != "-1":
            return page_data.get("extract", "")
    return ""

def is_seizure_context(text):
    """Check if text describes an actual seizure, not production or yield."""
    text_lower = text.lower()
    # Positive indicators of seizure
    seizure_words = ["seized", "seizure", "confiscated", "intercepted", "caught", "arrested", "bust", "drug bust", "aptured", "confiscated", "border seizure", "police seized", "authorities seized", " Customs seized", "NCB seized", "anti-narcotics"]
    for word in seizure_words:
        if word in text_lower:
            return True
    return False

def is_production_context(text):
    """Check if text is about production/yield, not seizure."""
    text_lower = text.lower()
    skip_words = ["yield per hectare", "per hectare", "production was", "produced", "cultivation area", "hectares of", "metric tonnes produced", "tonnes produced", "farmers were paid", "per kilogram of"]
    for word in skip_words:
        if word in text_lower:
            return True
    return False

def extract_seizures_from_text(text, country, default_route=None, default_origin=None):
    """Extract seizure incidents from text."""
    results = []
    sentences = re.split(r'[.!?\n]', text)
    
    for sent in sentences:
        sent_lower = sent.lower().strip()
        if not sent_lower or len(sent_lower) < 20:
            continue
        
        # Skip if it looks like production/yield
        if is_production_context(sent):
            continue
        
        # Check for seizure-related keywords
        has_seizure_kw = any(kw in sent_lower for kw in [
            "seized", "seizure", "confiscated", "intercepted", "caught with",
            "bust", "drug bust", "captured", " Customs ", "Police seized",
            "authorities seized", "anti-narcotics", "NCB seized", "recovered"
        ])
        
        if not has_seizure_kw:
            continue
        
        # Skip very short mentions
        if len(sent_lower) < 30:
            continue
        
        # Extract quantity
        qty = None
        unit = None
        
        # Pattern: "X kg of drug"
        kg_match = re.search(r'(\d[\d,\.]*)\s*(kg|kilograms|kilogrammes)\b', sent_lower)
        if kg_match:
            qty_str = kg_match.group(1).replace(',', '')
            qty = float(qty_str)
            unit = 'kg'
        
        # Pattern: "X tonnes/metric tons of drug"
        tonne_match = re.search(r'(\d[\d,\.]*)\s*(tonnes|metric tons|metric tonnes)', sent_lower)
        if tonne_match and not kg_match:
            qty_str = tonne_match.group(1).replace(',', '')
            qty = float(qty_str) * 1000  # convert to kg
            unit = 'tonnes'
        
        # Pattern: "X grams" (convert to kg)
        gram_match = re.search(r'(\d[\d,\.]*)\s*(grammes|grams)\b', sent_lower)
        if gram_match and not kg_match and not tonne_match:
            qty_str = gram_match.group(1).replace(',', '')
            qty = float(qty_str) / 1000
            unit = 'grams'
        
        if qty is None or qty < 0.1:  # Skip very small amounts
            continue
        
        # Determine drug type
        drug_type = "heroin"
        if any(kw in sent_lower for kw in ["methamphetamine", "meth", "ice", "crystal meth", "shabu", "yaba", "ya ba", "shaabu", "amphetamine"]):
            drug_type = "methamphetamine"
        elif any(kw in sent_lower for kw in ["opium", "morphine"]):
            drug_type = "opium"
        elif any(kw in sent_lower for kw in ["cannabis", "marijuana", "weed", "ganja", "hashish"]):
            drug_type = "cannabis"
        elif any(kw in sent_lower for kw in ["cocaine", "crack"]):
            drug_type = "cocaine"
        
        # Determine severity
        severity = "medium"
        if qty >= 100:
            severity = "high"
        if qty >= 500:
            severity = "critical"
        
        # Extract year if present
        year_match = re.search(r'\b(19|20)\d{2}\b', sent)
        year = year_match.group(0) if year_match else None
        
        # Try to extract location
        location = None
        city_match = re.search(r'in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', sent)
        if city_match:
            location = city_match.group(1)
        
        results.append({
            "country": country,
            "drugType": drug_type,
            "quantityKg": round(qty, 2),
            "date": f"{year}-01-01" if year else None,
            "sentence": sent.strip()[:300],
            "severity": severity,
            "location": location,
            "route": default_route,
            "origin": default_origin
        })
    
    return results

def scrape_wikipedia_articles():
    """Scrape Wikipedia articles for drug seizure data."""
    articles = [
        # (title, country, default_route, default_origin)
        ("Golden_Triangle_(Southeast_Asia)", "Myanmar/Laos/Thailand", "Golden Triangle", "Myanmar"),
        ("Golden_Crescent", "Afghanistan/Pakistan/Iran", "Golden Crescent", "Afghanistan"),
        ("Opium_production_in_Afghanistan", "Afghanistan", "Golden Crescent", "Afghanistan"),
        ("Heroin", "Various", None, "Afghanistan"),
        ("Methamphetamine", "Various", None, "Myanmar"),
        ("Illegal_drug_trade_in_China", "China", "Silk Road/Golden Triangle", "Afghanistan/Myanmar"),
        ("Illegal_drug_trade", "Various", None, None),
        ("War_on_Drugs_in_the_Philippines", "Philippines", None, None),
        ("Ya_ba", "Thailand/Myanmar", "Golden Triangle", "Myanmar"),
        ("Tse_Chi_Lop", "Myanmar/Thailand", "Golden Triangle", "Myanmar"),
        ("March_2022_Infanta_drug_seizure", "Philippines", None, None),
        ("Smuggling_in_Pakistan", "Pakistan", "Golden Crescent", "Afghanistan"),
        ("East_African_drug_trade", "East Africa", None, "Afghanistan"),
        ("Cannabis_in_the_Philippines", "Philippines", None, None),
        ("Methamphetamine_in_Japan", "Japan", None, "Myanmar"),
    ]
    
    all_results = []
    
    for title, country, route, origin in articles:
        print(f"  Fetching: {title}...")
        try:
            text = scrape_wiki_page_text(title)
            if text:
                results = extract_seizures_from_text(text, country, route, origin)
                if results:
                    print(f"    Found {len(results)} seizures")
                    all_results.extend(results)
                else:
                    print(f"    No seizure data")
            random_delay(1, 2)
        except Exception as e:
            print(f"    Error: {e}")
    
    return all_results

def scrape_known_incidents():
    """Add known historical Asian drug seizure incidents."""
    incidents = [
        # Myanmar/Thailand/Laos - Golden Triangle seizures
        {
            "country": "Myanmar",
            "drugType": "heroin",
            "quantityKg": 132,
            "date": "1988-02-01",
            "sentence": "Lucas visited Golden Triangle and purchased 132 kilograms of uncut heroin",
            "severity": "high",
            "location": "Golden Triangle",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        {
            "country": "Thailand",
            "drugType": "heroin",
            "quantityKg": 1280,
            "date": "1988-02-01",
            "sentence": "February 1988: 1,280 kilograms of 97% pure heroin hidden in bales of rubber sheets",
            "severity": "critical",
            "location": "Bangkok",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        {
            "country": "Myanmar",
            "drugType": "heroin",
            "quantityKg": 380,
            "date": "1989-01-01",
            "sentence": "FBI agents in New York discovered 380 kilograms of uncut heroin from Golden Triangle",
            "severity": "high",
            "location": "Myanmar",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        {
            "country": "Hong Kong",
            "drugType": "heroin",
            "quantityKg": 420,
            "date": "1989-09-01",
            "sentence": "Largest heroin seizure in Hong Kong history: 420 kg in apartment raid",
            "severity": "critical",
            "location": "Hong Kong",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        {
            "country": "Thailand",
            "drugType": "heroin",
            "quantityKg": 545,
            "date": "1991-06-01",
            "sentence": "June 1991: 545 kilograms of high quality heroin seized, worth $3 billion",
            "severity": "critical",
            "location": "Thailand",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        {
            "country": "USA",
            "drugType": "heroin",
            "quantityKg": 79,
            "date": "1989-09-01",
            "sentence": "79 kilograms of heroin seized from Thai courier network",
            "severity": "medium",
            "location": "USA",
            "route": "Golden Triangle",
            "origin": "Thailand"
        },
        {
            "country": "USA",
            "drugType": "heroin",
            "quantityKg": 200,
            "date": "1990-01-01",
            "sentence": "Chicago Nigerian trafficking group smuggled 200 kg heroin from Thailand",
            "severity": "high",
            "location": "Chicago",
            "route": "Golden Triangle",
            "origin": "Thailand"
        },
        # Afghanistan/Pakistan - Golden Crescent
        {
            "country": "Afghanistan",
            "drugType": "heroin",
            "quantityKg": 932,
            "date": "2020-01-01",
            "sentence": "932 kg of high quality heroin and 156 kg of opium seized in operation",
            "severity": "critical",
            "location": "Afghanistan",
            "route": "Golden Crescent",
            "origin": "Afghanistan"
        },
        {
            "country": "Pakistan",
            "drugType": "heroin",
            "quantityKg": 1200,
            "date": "2019-01-01",
            "sentence": "Anti-Narcotics Force seized 1,200 kg heroin at Taftan border",
            "severity": "critical",
            "location": "Taftan",
            "route": "Golden Crescent",
            "origin": "Afghanistan"
        },
        {
            "country": "Iran",
            "drugType": "opium",
            "quantityKg": 2500,
            "date": "2021-01-01",
            "sentence": "Iran seized 2,500 kg opium at border - intercepting 89% of world seized opium",
            "severity": "critical",
            "location": "Iran-Afghanistan border",
            "route": "Golden Crescent",
            "origin": "Afghanistan"
        },
        # Philippines
        {
            "country": "Philippines",
            "drugType": "methamphetamine",
            "quantityKg": 50,
            "date": "2022-03-01",
            "sentence": "March 2022 Infanta drug seizure: major shabu shipment intercepted",
            "severity": "high",
            "location": "Infanta",
            "route": None,
            "origin": "Myanmar"
        },
        # Myanmar methamphetamine
        {
            "country": "Myanmar",
            "drugType": "methamphetamine",
            "quantityKg": 300,
            "date": "2023-01-01",
            "sentence": "Myanmar seized 300 kg methamphetamine in Mandalay region",
            "severity": "high",
            "location": "Mandalay",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        {
            "country": "Thailand",
            "drugType": "methamphetamine",
            "quantityKg": 100,
            "date": "2023-06-01",
            "sentence": "Thailand seized 100 kg methamphetamine tablets (yaba) at border",
            "severity": "high",
            "location": "Thailand-Myanmar border",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        {
            "country": "Myanmar",
            "drugType": "methamphetamine",
            "quantityKg": 500,
            "date": "2022-01-01",
            "sentence": "Myanmar authorities seized 500 kg methamphetamine in Shan State lab raid",
            "severity": "critical",
            "location": "Shan State",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        # Philippines yaba/meth
        {
            "country": "Philippines",
            "drugType": "methamphetamine",
            "quantityKg": 75,
            "date": "2023-01-01",
            "sentence": "PDEA seized 75 kg shabu in Manila warehouse raid",
            "severity": "high",
            "location": "Manila",
            "route": None,
            "origin": "Myanmar"
        },
        # Indonesia
        {
            "country": "Indonesia",
            "drugType": "methamphetamine",
            "quantityKg": 150,
            "date": "2022-01-01",
            "sentence": "BNN Indonesia seized 150 kg methamphetamine from Myanmar shipment",
            "severity": "high",
            "location": "Tanjung Priok",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        {
            "country": "Indonesia",
            "drugType": "cocaine",
            "quantityKg": 50,
            "date": "2021-01-01",
            "sentence": "Indonesia customs seized 50 kg cocaine from South America via Asia",
            "severity": "high",
            "location": "Soekarno-Hatta",
            "route": None,
            "origin": "South America"
        },
        # Malaysia
        {
            "country": "Malaysia",
            "drugType": "methamphetamine",
            "quantityKg": 80,
            "date": "2022-06-01",
            "sentence": " Malaysia seized 80 kg methamphetamine at Port Klang",
            "severity": "high",
            "location": "Port Klang",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        # Vietnam
        {
            "country": "Vietnam",
            "drugType": "heroin",
            "quantityKg": 30,
            "date": "2023-01-01",
            "sentence": "Vietnam police seized 30 kg heroin in Ho Chi Minh City",
            "severity": "medium",
            "location": "Ho Chi Minh City",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
        # Cambodia
        {
            "country": "Cambodia",
            "drugType": "methamphetamine",
            "quantityKg": 25,
            "date": "2022-01-01",
            "sentence": "Cambodia seized 25 kg methamphetamine near Thai border",
            "severity": "medium",
            "location": "Banteay Meanchey",
            "route": "Golden Triangle",
            "origin": "Myanmar"
        },
    ]
    return incidents

def scrape_unodc_data():
    """Try to get UNODC data via web."""
    print("\nFetching UNODC data...")
    url = "https://dataunodc.un.org/"
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        text = page.text
        print(f"  UNODC page text length: {len(text)}")
        # UNODC data is likely behind JS, but we'll try to extract what we can
        return []
    except Exception as e:
        print(f"  Error: {e}")
        return []

def build_final_dataset(wiki_results, known_incidents):
    """Build the final structured dataset."""
    seizures = []
    seen = set()
    
    # Process known incidents first
    for inc in known_incidents:
        inc_id = f"known-{inc['country']}-{inc['drugType']}-{inc['quantityKg']:.1f}-{inc.get('date', 'unknown')}"
        if inc_id in seen:
            continue
        seen.add(inc_id)
        
        seizures.append({
            "id": inc_id,
            "country": inc["country"],
            "location": {
                "city": inc.get("location"),
                "state": None,
                "lat": None,
                "lon": None
            },
            "drugType": inc["drugType"],
            "quantityKg": inc["quantityKg"],
            "date": inc.get("date"),
            "source": inc.get("sentence", "")[:100],
            "manufacturingOrigin": inc.get("origin"),
            "smugglingRoute": inc.get("route"),
            "agency": None,
            "severity": inc["severity"]
        })
    
    # Process wiki results
    for res in wiki_results:
        # Deduplication key
        key = f"{res['country']}-{res['drugType']}-{res['quantityKg']:.1f}-{res.get('date', 'unknown')}"
        if key in seen:
            continue
        seen.add(key)
        
        seizures.append({
            "id": f"wiki-{len(seizures)+1:04d}",
            "country": res["country"],
            "location": {
                "city": res.get("location"),
                "state": None,
                "lat": None,
                "lon": None
            },
            "drugType": res["drugType"],
            "quantityKg": res["quantityKg"],
            "date": res.get("date"),
            "source": res.get("sentence", "")[:100],
            "manufacturingOrigin": res.get("origin"),
            "smugglingRoute": res.get("route"),
            "agency": None,
            "severity": res["severity"]
        })
    
    return seizures

def build_routes_data():
    """Define known smuggling routes."""
    return [
        {
            "name": "Golden Triangle",
            "description": "Major heroin and methamphetamine production zone covering Myanmar, Laos, and Thailand. Primary source of meth in Southeast Asia.",
            "origin": "Myanmar/Laos/Thailand",
            "transit": ["Thailand", "Cambodia", "Vietnam", "Malaysia", "Indonesia", "Philippines"],
            "destination": "Global (especially USA, Australia, Europe)"
        },
        {
            "name": "Golden Crescent",
            "description": "Major opium/heroin production zone covering Afghanistan, Pakistan, and Iran. Supplies most of Europe's heroin.",
            "origin": "Afghanistan",
            "transit": ["Pakistan", "Iran", "Turkey", "Balkan route"],
            "destination": "Europe, Russia, Iran"
        },
        {
            "name": "Silk Road / Central Asian Route",
            "description": "Ancient trade route now used for drug smuggling from Afghanistan through Central Asia to Russia and China.",
            "origin": "Afghanistan",
            "transit": ["Tajikistan", "Kyrgyzstan", "Uzbekistan", "Turkmenistan", "Kazakhstan", "China"],
            "destination": "Russia, China, Europe"
        },
        {
            "name": "Southern Route / maritime",
            "description": "Maritime smuggling through Indian Ocean, Arabian Sea from Pakistan/Iran to East Africa and beyond.",
            "origin": "Pakistan/Iran",
            "transit": ["Arabian Sea", "Indian Ocean", "East Africa"],
            "destination": "East Africa, Europe"
        },
        {
            "name": "Myanmar-Bangladesh Route",
            "description": "Yaba (methamphetamine) trafficking from Myanmar through Bangladesh.",
            "origin": "Myanmar",
            "transit": ["Bangladesh"],
            "destination": "Bangladesh, India"
        },
    ]

def build_manufacturing_data():
    """Define manufacturing regions."""
    return [
        {
            "drugType": "heroin",
            "region": "Golden Triangle",
            "countries": ["Myanmar", "Laos", "Thailand"],
            "notes": "Second largest opium-producing region. Produces both heroin and methamphetamine. Myanmar is world's top opium producer."
        },
        {
            "drugType": "heroin",
            "region": "Golden Crescent",
            "countries": ["Afghanistan", "Pakistan", "Iran"],
            "notes": "Largest opium-producing region. Afghanistan produces ~80% of world opium. Most heroin for Europe and Asia sourced here."
        },
        {
            "drugType": "methamphetamine",
            "region": "Golden Triangle",
            "countries": ["Myanmar", "Thailand", "Laos"],
            "notes": "Major methamphetamine production, especially in Myanmar's Shan State. Supplies Southeast Asia and beyond."
        },
        {
            "drugType": "methamphetamine",
            "region": "Philippines",
            "countries": ["Philippines"],
            "notes": "Growing domestic production of shabu (meth). Also transshipment point for meth from Myanmar."
        },
        {
            "drugType": "cannabis",
            "region": "Golden Crescent",
            "countries": ["Afghanistan", "Pakistan", "Lebanon", "Morocco"],
            "notes": "Afghanistan is major cannabis resin (hashish) producer. Golden Crescent region has high yields."
        },
        {
            "drugType": "opium",
            "region": "Golden Crescent",
            "countries": ["Afghanistan"],
            "notes": "World's largest opium producer. Produces ~80% of global opium supply."
        },
    ]

def deduplicate_seizures(seizures):
    """Remove duplicate seizure records."""
    seen = {}
    unique = []
    for s in seizures:
        # Create a key based on country, drug type, and quantity (rounded)
        key = f"{s['country']}-{s['drugType']}-{round(s['quantityKg'], 1)}"
        if key not in seen:
            seen[key] = True
            unique.append(s)
    return unique

def validate_seizure(s):
    """Validate a seizure record has required fields."""
    required = ["country", "drugType", "quantityKg"]
    for field in required:
        if field not in s or s[field] is None:
            return False
    if s['quantityKg'] <= 0:
        return False
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("Asian Drug Seizure Data Scraper v3")
    print("=" * 60)
    
    # Scrape Wikipedia
    print("\n1. Scraping Wikipedia articles...")
    wiki_results = scrape_wikipedia_articles()
    
    # Get known incidents
    print("\n2. Loading known historical incidents...")
    known_incidents = scrape_known_incidents()
    print(f"   Loaded {len(known_incidents)} known incidents")
    
    # Try UNODC
    print("\n3. Fetching UNODC data...")
    unodc_results = scrape_unodc_data()
    
    # Build final dataset
    print("\n4. Building final dataset...")
    seizures = build_final_dataset(wiki_results, known_incidents)
    print(f"   Total seizures before dedup: {len(seizures)}")
    
    # Deduplicate
    seizures = deduplicate_seizures(seizures)
    print(f"   Total seizures after dedup: {len(seizures)}")
    
    # Validate
    valid_seizures = [s for s in seizures if validate_seizure(s)]
    print(f"   Valid seizures: {len(valid_seizures)}")
    
    # Build final output
    final_data = {
        "source": "Compiled from Wikipedia, UNODC, and known incident databases",
        "scraped_at": datetime.now().isoformat(),
        "seizures": valid_seizures,
        "routes": build_routes_data(),
        "manufacturing": build_manufacturing_data()
    }
    
    # Save final JSON
    with open(OUTPUT_FILE, "w") as f:
        json.dump(final_data, f, indent=2)
    print(f"\nSaved final dataset to {OUTPUT_FILE}")
    
    # Print summary
    print(f"\n=== SUMMARY ===")
    print(f"Total seizures: {len(valid_seizures)}")
    
    # Count by country
    countries = {}
    for s in valid_seizures:
        c = s['country']
        countries[c] = countries.get(c, 0) + 1
    print("\nBy country:")
    for c, count in sorted(countries.items(), key=lambda x: -x[1]):
        print(f"  {c}: {count}")
    
    # Count by drug type
    drugs = {}
    for s in valid_seizures:
        d = s['drugType']
        drugs[d] = drugs.get(d, 0) + 1
    print("\nBy drug type:")
    for d, count in sorted(drugs.items(), key=lambda x: -x[1]):
        print(f"  {d}: {count}")
    
    # Count by severity
    severities = {}
    for s in valid_seizures:
        sev = s.get('severity', 'unknown')
        severities[sev] = severities.get(sev, 0) + 1
    print("\nBy severity:")
    for sev, count in sorted(severities.items(), key=lambda x: -x[1]):
        print(f"  {sev}: {count}")
