#!/usr/bin/env python3
"""
Scrape Asian drug seizure data using Wikipedia API + web search.
Much more targeted approach.
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

def wiki_api_search(query, limit=10):
    """Search Wikipedia API for pages."""
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "format": "json",
        "srlimit": limit
    }
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data.get("query", {}).get("search", [])
    except Exception as e:
        print(f"  Wiki API error: {e}")
        return []

def scrape_wiki_page_text(title):
    """Get plain text of a Wikipedia page."""
    params = {
        "action": "query",
        "titles": title,
        "prop": "extracts",
        "explaintext": True,
        "format": "json"
    }
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            pages = data.get("query", {}).get("pages", {})
            for page_id, page_data in pages.items():
                if page_id != "-1":
                    return page_data.get("extract", "")
    except Exception as e:
        print(f"  Wiki page error for {title}: {e}")
    return ""

def extract_quantities(text, country=None):
    """Extract drug-related quantities from text."""
    seizures = []
    text_lower = text.lower()
    
    # Patterns for drug seizures
    # "X kg of heroin/heroine/meth seized"
    # "X tonnes of opium"
    patterns = [
        r'(\d+\.?\d*)\s*(kg|kilograms|kilogrammes)\s*(?:of\s+)?(?:heroin|methamphetamine|opium|cannabis|cocaine|amphetamine|ice|crystal meth)',
        r'(\d+\.?\d*)\s*(tonnes|metric tons|metric tonnes)\s*(?:of\s+)?(?:opium|heroin|cannabis)',
        r'seized\s+(\d+\.?\d*)\s*(kg|kilograms|kilogrammes)',
        r'(\d+\.?\d*)\s*(kg|kilograms)\s*(?:of\s+)?(?:heroin|meth|opium|drug)',
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, text_lower)
        for match in matches:
            qty = float(match.group(1))
            unit = match.group(2)
            
            # Skip very small quantities (probably not seizures)
            if qty < 0.1:
                continue
            
            # Convert to kg
            if unit in ["tonnes", "metric tons", "metric tonnes"]:
                qty *= 1000
            
            # Determine drug type
            drug_type = "heroin"
            snippet = text[max(0, match.start()-100):match.end()+100].lower()
            if "meth" in snippet or "amphetamine" in snippet or "ice" in snippet or "crystal" in snippet:
                drug_type = "methamphetamine"
            elif "opium" in snippet:
                drug_type = "opium"
            elif "cannabis" in snippet or "marijuana" in snippet or "weed" in snippet:
                drug_type = "cannabis"
            elif "cocaine" in snippet:
                drug_type = "cocaine"
            
            # Skip yields per hectare etc.
            if "per hectare" in snippet or "yield" in snippet or "hectare" in snippet:
                continue
            
            seizures.append({
                "quantityKg": qty,
                "drugType": drug_type,
                "snippet": snippet[:200]
            })
    
    return seizures

def extract_seizure_data(text, country):
    """Extract all seizure-like data from text."""
    results = []
    text_lower = text.lower()
    
    # Split into sentences
    sentences = re.split(r'[.!?\n]', text)
    
    for sent in sentences:
        sent_lower = sent.lower()
        if any(kw in sent_lower for kw in ["seizure", "seized", "kg", "kilogram", "tonne", "intercepted", "confiscated", "caught", "drug bust"]):
            # Try to extract quantity
            qty_patterns = [
                r'(\d+\.?\d*)\s*(kg|kilograms|kilogrammes)',
                r'(\d+\.?\d*)\s*(tonnes|metric tons)',
                r'(\d+\.?\d*)\s*(grammes|grams)\s*(?:of\s+)?(?:heroin|meth|opium|drug)',
            ]
            
            for pattern in qty_patterns:
                matches = re.finditer(pattern, sent_lower)
                for match in matches:
                    qty = float(match.group(1))
                    unit = match.group(2)
                    
                    if unit in ["grammes", "grams"]:
                        qty = qty / 1000  # convert to kg
                    elif unit in ["tonnes", "metric tons"]:
                        qty *= 1000
                    
                    if qty < 0.01:  # Skip very small
                        continue
                    
                    # Determine drug type
                    drug_type = "heroin"
                    if any(kw in sent_lower for kw in ["meth", "amphetamine", "ice", "crystal", "yaba", "shaabu"]):
                        drug_type = "methamphetamine"
                    elif "opium" in sent_lower:
                        drug_type = "opium"
                    elif "cannabis" in sent_lower or "marijuana" in sent_lower or "weed" in sent_lower or "ganja" in sent_lower:
                        drug_type = "cannabis"
                    elif "cocaine" in sent_lower:
                        drug_type = "cocaine"
                    
                    # Determine severity
                    severity = "medium"
                    if qty >= 100:
                        severity = "high"
                    if qty >= 1000:
                        severity = "critical"
                    
                    results.append({
                        "country": country,
                        "drugType": drug_type,
                        "quantityKg": qty,
                        "sentence": sent.strip()[:300],
                        "severity": severity
                    })
                    break  # Only take first match per sentence
    
    return results

def scrape_all():
    all_results = []
    
    # List of Wikipedia article titles to scrape
    wiki_articles = [
        # (title, country)
        ("Golden_Triangle_(Southeast_Asia)", "Myanmar/Laos/Thailand"),
        ("Golden_Crescent", "Afghanistan/Pakistan/Iran"),
        ("Opium_production_in_Afghanistan", "Afghanistan"),
        ("Heroin", "Various"),
        ("Methamphetamine", "Various"),
        ("Silk_Road", "Central Asia"),
        ("Drug_trafficking_in_Myanmar", "Myanmar"),
        ("Drug_trafficking_in_Thailand", "Thailand"),
        ("Drug_trafficking_in_Laos", "Laos"),
        ("Drug_trafficking_in_Pakistan", "Pakistan"),
        ("War_on_Drugs_in_the_Philippines", "Philippines"),
        ("Drug_trade_in_Indonesia", "Indonesia"),
        ("Cannabis_in_India", "India"),
        ("Cannabis_in_Afghanistan", "Afghanistan"),
        ("Cannabis_in_Pakistan", "Pakistan"),
        ("Illicit_drug_trade_in_Afghanistan", "Afghanistan"),
        ("Southeast_Asian_methamphetamine_lab_explosions", "Myanmar"),
        ("Mandalay", "Myanmar"),
    ]
    
    print("Scraping Wikipedia articles...")
    for title, country in wiki_articles:
        print(f"  Fetching: {title}...")
        try:
            text = scrape_wiki_page_text(title)
            if text:
                results = extract_seizure_data(text, country)
                if results:
                    print(f"    Found {len(results)} seizure entries")
                    all_results.extend(results)
                else:
                    print(f"    No seizure data found")
            random_delay(0.5, 1.5)
        except Exception as e:
            print(f"    Error: {e}")
    
    print(f"\nTotal Wikipedia entries: {len(all_results)}")
    return all_results

def search_and_scrape_news():
    """Use web search to find news about Asian drug seizures."""
    print("\nSearching for Asian drug seizure news...")
    
    queries = [
        "site:en.wikipedia.org drug seizure Myanmar kg",
        "site:en.wikipedia.org drug seizure Afghanistan kg heroin",
        "site:en.wikipedia.org meth seizure Southeast Asia kg",
        "site:en.wikipedia.org Thailand drug seizure kg methamphetamine",
        "site:en.wikipedia.org Pakistan drug seizure kg heroin",
        "site:en.wikipedia.org Philippines drug seizure kg shabu",
    ]
    
    results = []
    for query in queries:
        print(f"  Searching: {query[:50]}...")
        try:
            # Use Wikipedia API search
            search_term = query.replace("site:en.wikipedia.org ", "").replace(" kg", "")
            hits = wiki_api_search(search_term, limit=5)
            for hit in hits:
                print(f"    Found: {hit['title']}")
            results.extend(hits)
            random_delay(1, 2)
        except Exception as e:
            print(f"    Search error: {e}")
    
    return results

if __name__ == "__main__":
    print("=" * 60)
    print("Asian Drug Seizure Data Scraper v2")
    print("=" * 60)
    
    # First, scrape Wikipedia articles
    wiki_results = scrape_all()
    
    # Then search for more specific data
    search_results = search_and_scrape_news()
    
    print(f"\nTotal results: {len(wiki_results)}")
    
    # Save intermediate
    intermediate_data = {
        "wiki_results": wiki_results,
        "search_results": [{"title": r.get("title", ""), "snippet": r.get("snippet", "")[:200]} for r in search_results]
    }
    with open(INTERMEDIATE_FILE, "w") as f:
        json.dump(intermediate_data, f, indent=2)
    print(f"Saved intermediate to {INTERMEDIATE_FILE}")
