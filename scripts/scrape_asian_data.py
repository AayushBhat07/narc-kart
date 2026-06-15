#!/usr/bin/env python3
"""
Scrape Asian drug seizure data from Wikipedia and other public sources.
"""

import json
import time
import random
import re
from datetime import datetime
from pathlib import Path
import sys

import scrapling

BASE_DIR = Path(__file__).parent.parent
OUTPUT_FILE = BASE_DIR / "frontend" / "public" / "data_asian.json"
INTERMEDIATE_FILE = BASE_DIR / "frontend" / "public" / "data_asian_temp.json"

def random_delay(min_sec=2, max_sec=5):
    time.sleep(random.uniform(min_sec, max_sec))

def extract_quantity(text):
    """Extract quantity in kg from text."""
    qty_match = re.search(r'(\d+\.?\d*)\s*(kg|kilograms|tonnes|metric tons)', text.lower())
    if qty_match:
        qty = float(qty_match.group(1))
        unit = qty_match.group(2)
        if unit in ["tonnes", "metric tons"]:
            qty *= 1000
        return qty
    return None

def extract_year(text):
    """Extract 4-digit year from text."""
    year_match = re.search(r'\b(19|20)\d{2}\b', text)
    if year_match:
        return year_match.group(0)
    return None

# ─── Scrape Wikipedia: Golden Triangle ────────────────────────────────────────
def scrape_golden_triangle():
    """Scrape Wikipedia for Golden Triangle drug trafficking info."""
    url = "https://en.wikipedia.org/wiki/Golden_Triangle_(Southeast_Asia)"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)  # Already parsed
        
        seizures = []
        
        # Look for paragraphs with seizure/seizure data
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if "seizure" in text.lower() or "seized" in text.lower() or "kg" in text.lower():
                qty = extract_quantity(text)
                if qty and qty > 0:
                    drug_type = "heroin" if "heroin" in text.lower() else "methamphetamine"
                    if "meth" in text.lower() or "amphetamine" in text.lower():
                        drug_type = "methamphetamine"
                    
                    year = extract_year(text)
                    date = f"{year}-01-01" if year else None
                    
                    seizures.append({
                        "id": f"wiki-golden-triangle-{len(seizures)+1:03d}",
                        "country": "Myanmar/Laos/Thailand",
                        "location": {"city": "Golden Triangle", "state": None, "lat": 20.35, "lon": 100.48},
                        "drugType": drug_type,
                        "quantityKg": qty,
                        "date": date,
                        "source": url,
                        "manufacturingOrigin": "Myanmar",
                        "smugglingRoute": "Golden Triangle",
                        "agency": None,
                        "severity": "high"
                    })
        
        print(f"  Found {len(seizures)} entries from Golden Triangle")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Golden Crescent ────────────────────────────────────────
def scrape_golden_crescent():
    """Scrape Wikipedia for Golden Crescent (Afghanistan/Pakistan/Iran) drug info."""
    url = "https://en.wikipedia.org/wiki/Golden_Crescent"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if "heroin" in text.lower() or "opium" in text.lower() or "seizure" in text.lower():
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-golden-crescent-{len(seizures)+1:03d}",
                        "country": "Afghanistan/Pakistan/Iran",
                        "location": {"city": "Golden Crescent", "state": None, "lat": 34.0, "lon": 66.0},
                        "drugType": "heroin",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Afghanistan",
                        "smugglingRoute": "Golden Crescent",
                        "agency": None,
                        "severity": "critical"
                    })
        
        print(f"  Found {len(seizures)} entries from Golden Crescent")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Methamphetamine in Asia ─────────────────────────────────
def scrape_meth_asia():
    """Scrape Wikipedia for methamphetamine production/trafficking in Asia."""
    url = "https://en.wikipedia.org/wiki/Methamphetamine"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if "asia" in text.lower() and ("seizure" in text.lower() or "production" in text.lower() or "kg" in text.lower()):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-meth-asia-{len(seizures)+1:03d}",
                        "country": "Myanmar/Philippines/Thailand",
                        "location": {"city": None, "state": None, "lat": None, "lon": None},
                        "drugType": "methamphetamine",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Myanmar",
                        "smugglingRoute": None,
                        "agency": None,
                        "severity": "high"
                    })
        
        print(f"  Found {len(seizures)} entries from methamphetamine page")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Silk Road / drug routes ─────────────────────────────────
def scrape_silk_road():
    """Scrape Wikipedia for Silk Road drug trafficking."""
    url = "https://en.wikipedia.org/wiki/Silk_Road"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if "drug" in text.lower() and ("seizure" in text.lower() or "kg" in text.lower() or "heroin" in text.lower()):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-silk-road-{len(seizures)+1:03d}",
                        "country": "Afghanistan/China/Central Asia",
                        "location": {"city": "Silk Road", "state": None, "lat": 40.0, "lon": 70.0},
                        "drugType": "heroin",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Afghanistan",
                        "smugglingRoute": "Silk Road",
                        "agency": None,
                        "severity": "critical"
                    })
        
        print(f"  Found {len(seizures)} entries from Silk Road")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Heroin page ─────────────────────────────────────────────
def scrape_heroin_wiki():
    """Scrape Wikipedia for heroin production/trafficking in Asia."""
    url = "https://en.wikipedia.org/wiki/Heroin"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if "afghanistan" in text.lower() and ("production" in text.lower() or "seizure" in text.lower()):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-heroin-{len(seizures)+1:03d}",
                        "country": "Afghanistan",
                        "location": {"city": "Afghanistan", "state": None, "lat": 33.93, "lon": 67.71},
                        "drugType": "heroin",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Afghanistan",
                        "smugglingRoute": "Golden Crescent",
                        "agency": None,
                        "severity": "critical"
                    })
        
        print(f"  Found {len(seizures)} entries from heroin page")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Philippines drug trade ──────────────────────────────────
def scrape_philippines_drugs():
    """Scrape Wikipedia for Philippines drug war data."""
    url = "https://en.wikipedia.org/wiki/Drug_trade_in_the_Philippines"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if "seizure" in text.lower() or "seized" in text.lower() or "kg" in text.lower():
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-philippines-{len(seizures)+1:03d}",
                        "country": "Philippines",
                        "location": {"city": None, "state": None, "lat": 12.88, "lon": 121.77},
                        "drugType": "methamphetamine",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": None,
                        "smugglingRoute": None,
                        "agency": "Philippine Drug Enforcement Agency",
                        "severity": "high"
                    })
        
        print(f"  Found {len(seizures)} entries from Philippines")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Drug trafficking in Myanmar ─────────────────────────────
def scrape_myanmar_drugs():
    """Scrape Wikipedia for drug trafficking in Myanmar."""
    url = "https://en.wikipedia.org/wiki/Drug_trafficking_in_Myanmar"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if any(kw in text.lower() for kw in ["seizure", "kg", "heroin", "meth", "amphetamine", "seized"]):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    drug_type = "heroin" if "heroin" in text.lower() else "methamphetamine"
                    if "meth" in text.lower() or "amphetamine" in text.lower():
                        drug_type = "methamphetamine"
                    
                    seizures.append({
                        "id": f"wiki-myanmar-{len(seizures)+1:03d}",
                        "country": "Myanmar",
                        "location": {"city": None, "state": None, "lat": 21.91, "lon": 96.08},
                        "drugType": drug_type,
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Myanmar",
                        "smugglingRoute": "Golden Triangle",
                        "agency": None,
                        "severity": "high"
                    })
        
        print(f"  Found {len(seizures)} entries from Myanmar")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Drug trafficking in Thailand ────────────────────────────
def scrape_thailand_drugs():
    """Scrape Wikipedia for drug trafficking in Thailand."""
    url = "https://en.wikipedia.org/wiki/Drug_trafficking_in_Thailand"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if any(kw in text.lower() for kw in ["seizure", "kg", "heroin", "meth", "amphetamine", "seized"]):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-thailand-{len(seizures)+1:03d}",
                        "country": "Thailand",
                        "location": {"city": None, "state": None, "lat": 15.87, "lon": 100.99},
                        "drugType": "methamphetamine",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Myanmar",
                        "smugglingRoute": "Golden Triangle",
                        "agency": None,
                        "severity": "high"
                    })
        
        print(f"  Found {len(seizures)} entries from Thailand")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Drug trafficking in Laos ────────────────────────────────
def scrape_laos_drugs():
    """Scrape Wikipedia for drug trafficking in Laos."""
    url = "https://en.wikipedia.org/wiki/Drug_trafficking_in_Laos"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if any(kw in text.lower() for kw in ["seizure", "kg", "heroin", "meth", "amphetamine", "seized"]):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-laos-{len(seizures)+1:03d}",
                        "country": "Laos",
                        "location": {"city": None, "state": None, "lat": 19.86, "lon": 102.49},
                        "drugType": "methamphetamine",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Myanmar",
                        "smugglingRoute": "Golden Triangle",
                        "agency": None,
                        "severity": "high"
                    })
        
        print(f"  Found {len(seizures)} entries from Laos")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Drug trafficking in Pakistan ────────────────────────────
def scrape_pakistan_drugs():
    """Scrape Wikipedia for drug trafficking in Pakistan."""
    url = "https://en.wikipedia.org/wiki/Drug_trafficking_in_Pakistan"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if any(kw in text.lower() for kw in ["seizure", "kg", "heroin", "meth", "hashish", "seized"]):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    drug_type = "heroin" if "heroin" in text.lower() else "methamphetamine"
                    if "hashish" in text.lower():
                        drug_type = "cannabis"
                    
                    seizures.append({
                        "id": f"wiki-pakistan-{len(seizures)+1:03d}",
                        "country": "Pakistan",
                        "location": {"city": None, "state": None, "lat": 30.37, "lon": 69.34},
                        "drugType": drug_type,
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Afghanistan",
                        "smugglingRoute": "Golden Crescent",
                        "agency": "Anti-Narcotics Force Pakistan",
                        "severity": "high"
                    })
        
        print(f"  Found {len(seizures)} entries from Pakistan")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Drug trafficking in Afghanistan ──────────────────────────
def scrape_afghanistan_drugs():
    """Scrape Wikipedia for drug trafficking in Afghanistan."""
    url = "https://en.wikipedia.org/wiki/Drug_trade_in_Afghanistan"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if any(kw in text.lower() for kw in ["seizure", "kg", "heroin", "opium", "meth", "seized"]):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-afghanistan-{len(seizures)+1:03d}",
                        "country": "Afghanistan",
                        "location": {"city": None, "state": None, "lat": 33.93, "lon": 67.71},
                        "drugType": "heroin",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Afghanistan",
                        "smugglingRoute": "Golden Crescent",
                        "agency": None,
                        "severity": "critical"
                    })
        
        print(f"  Found {len(seizures)} entries from Afghanistan")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Cannabis in Cambodia/SE Asia ────────────────────────────
def scrape_cambodia_drugs():
    """Scrape Wikipedia for drug trafficking in Cambodia."""
    url = "https://en.wikipedia.org/wiki/Drug_trade_in_Cambodia"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if any(kw in text.lower() for kw in ["seizure", "kg", "heroin", "meth", "amphetamine", "seized", "cannabis"]):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-cambodia-{len(seizures)+1:03d}",
                        "country": "Cambodia",
                        "location": {"city": None, "state": None, "lat": 12.57, "lon": 104.99},
                        "drugType": "methamphetamine",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Myanmar",
                        "smugglingRoute": "Golden Triangle",
                        "agency": None,
                        "severity": "medium"
                    })
        
        print(f"  Found {len(seizures)} entries from Cambodia")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Vietnam drug trade ──────────────────────────────────────
def scrape_vietnam_drugs():
    """Scrape Wikipedia for drug trafficking in Vietnam."""
    url = "https://en.wikipedia.org/wiki/Drug_trade_in_Vietnam"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if any(kw in text.lower() for kw in ["seizure", "kg", "heroin", "meth", "seized"]):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-vietnam-{len(seizures)+1:03d}",
                        "country": "Vietnam",
                        "location": {"city": None, "state": None, "lat": 14.05, "lon": 108.27},
                        "drugType": "heroin",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Myanmar",
                        "smugglingRoute": "Golden Triangle",
                        "agency": None,
                        "severity": "high"
                    })
        
        print(f"  Found {len(seizures)} entries from Vietnam")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Drug trafficking in Bangladesh ───────────────────────────
def scrape_bangladesh_drugs():
    """Scrape Wikipedia for drug trafficking in Bangladesh."""
    url = "https://en.wikipedia.org/wiki/Drug_trade_in_Bangladesh"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if any(kw in text.lower() for kw in ["seizure", "kg", "heroin", "meth", "seized", "yaba"]):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    drug_type = "heroin" if "heroin" in text.lower() else "methamphetamine"
                    if "yaba" in text.lower():
                        drug_type = "methamphetamine"
                    
                    seizures.append({
                        "id": f"wiki-bangladesh-{len(seizures)+1:03d}",
                        "country": "Bangladesh",
                        "location": {"city": None, "state": None, "lat": 23.68, "lon": 90.35},
                        "drugType": drug_type,
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Myanmar",
                        "smugglingRoute": "Myanmar-Bangladesh",
                        "agency": None,
                        "severity": "medium"
                    })
        
        print(f"  Found {len(seizures)} entries from Bangladesh")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Drug trafficking in Indonesia ───────────────────────────
def scrape_indonesia_drugs():
    """Scrape Wikipedia for drug trafficking in Indonesia."""
    url = "https://en.wikipedia.org/wiki/Drug_trade_in_Indonesia"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if any(kw in text.lower() for kw in ["seizure", "kg", "heroin", "meth", "cocaine", "seized"]):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-indonesia-{len(seizures)+1:03d}",
                        "country": "Indonesia",
                        "location": {"city": None, "state": None, "lat": -0.79, "lon": 113.92},
                        "drugType": "methamphetamine",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": None,
                        "smugglingRoute": None,
                        "agency": None,
                        "severity": "high"
                    })
        
        print(f"  Found {len(seizures)} entries from Indonesia")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape Wikipedia: Drug trafficking in Malaysia ────────────────────────────
def scrape_malaysia_drugs():
    """Scrape Wikipedia for drug trafficking in Malaysia."""
    url = "https://en.wikipedia.org/wiki/Drug_trade_in_Malaysia"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if any(kw in text.lower() for kw in ["seizure", "kg", "heroin", "meth", "seized"]):
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"wiki-malaysia-{len(seizures)+1:03d}",
                        "country": "Malaysia",
                        "location": {"city": None, "state": None, "lat": 4.21, "lon": 101.97},
                        "drugType": "methamphetamine",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": "Myanmar",
                        "smugglingRoute": "Golden Triangle",
                        "agency": None,
                        "severity": "high"
                    })
        
        print(f"  Found {len(seizures)} entries from Malaysia")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Scrape UNODC data ─────────────────────────────────────────────────────────
def scrape_unodc():
    """Try to access UNODC World Drug Report data."""
    url = "https://www.unodc.org/unodc/en/data-and-analysis/wdr.html"
    print(f"Scraping: {url}")
    
    try:
        fetcher = scrapling.Fetcher()
        page = fetcher.get(url)
        
        seizures = []
        # Try to find seizure data
        paragraphs = page.css("p")
        for p in paragraphs:
            text = p.text
            if "seizure" in text.lower() and "kg" in text.lower():
                qty = extract_quantity(text)
                if qty and qty > 0:
                    seizures.append({
                        "id": f"unodc-{len(seizures)+1:03d}",
                        "country": "Asia (multiple)",
                        "location": {"city": None, "state": None, "lat": None, "lon": None},
                        "drugType": "heroin",
                        "quantityKg": qty,
                        "date": None,
                        "source": url,
                        "manufacturingOrigin": None,
                        "smugglingRoute": None,
                        "agency": "UNODC",
                        "severity": "medium"
                    })
        
        print(f"  Found {len(seizures)} entries from UNODC")
        return seizures
    except Exception as e:
        print(f"  Error: {e}")
        return []

# ─── Main scrape function ──────────────────────────────────────────────────────
def scrape_all():
    all_seizures = []
    
    scrapers = [
        scrape_golden_triangle,
        scrape_golden_crescent,
        scrape_meth_asia,
        scrape_silk_road,
        scrape_heroin_wiki,
        scrape_philippines_drugs,
        scrape_myanmar_drugs,
        scrape_thailand_drugs,
        scrape_laos_drugs,
        scrape_pakistan_drugs,
        scrape_afghanistan_drugs,
        scrape_cambodia_drugs,
        scrape_vietnam_drugs,
        scrape_bangladesh_drugs,
        scrape_indonesia_drugs,
        scrape_malaysia_drugs,
        scrape_unodc,
    ]
    
    for scraper_fn in scrapers:
        try:
            seizures = scraper_fn()
            all_seizures.extend(seizures)
            random_delay(1, 3)
        except Exception as e:
            print(f"  Scraper error in {scraper_fn.__name__}: {e}")
    
    return all_seizures

if __name__ == "__main__":
    print("=" * 60)
    print("Asian Drug Seizure Data Scraper")
    print("=" * 60)
    
    seizures = scrape_all()
    
    print(f"\nTotal entries scraped: {len(seizures)}")
    
    # Save intermediate
    with open(INTERMEDIATE_FILE, "w") as f:
        json.dump(seizures, f, indent=2)
    print(f"Saved intermediate to {INTERMEDIATE_FILE}")
