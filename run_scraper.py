#!/usr/bin/env python3
"""
Narc Kart — Drug Seizure Data Scraper
Entry point: python run_scraper.py

Scrapes drug seizure news from multiple Indian sources and outputs
frontend/public/data.json for Vercel deployment.
"""

import json
import logging
import os
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

# Ensure absolute imports work when run from project root
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from backend.scraper.scraper import Scraper
from backend.scraper.article_parser import ArticleParser
from backend.scraper.news_sources import ENABLED_SOURCES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("run_scraper")


# ─── City Lat/Lon Lookup ─────────────────────────────────────────────────────
# Covers major + tier-2-3 Indian cities, esp. border towns
CITY_COORDS = {
    # Maharashtra
    "mumbai": (19.076, 72.877),
    "navi mumbai": (19.033, 73.050),
    "pune": (18.520, 73.856),
    "nagpur": (21.145, 79.088),
    "thane": (19.218, 72.978),
    "solapur": (17.659, 75.906),
    "nashik": (19.997, 73.790),
    "aurangabad": (19.876, 75.346),
    "kolhapur": (16.695, 74.243),
    # Delhi
    "delhi": (28.704, 77.102),
    "new delhi": (28.613, 77.209),
    # Karnataka
    "bangalore": (12.971, 77.594),
    "bengaluru": (12.971, 77.594),
    "mysore": (12.295, 76.639),
    "mangalore": (12.914, 74.856),
    "hubli": (15.364, 75.124),
    "belgaum": (16.830, 74.497),
    # Tamil Nadu
    "chennai": (13.082, 80.218),
    "coimbatore": (11.016, 77.019),
    "madurai": (9.925, 78.119),
    "tiruchirappalli": (10.790, 78.708),
    "tirupur": (11.108, 77.154),
    # Gujarat
    "ahmedabad": (23.021, 72.579),
    "surat": (21.170, 72.829),
    "vadodara": (22.307, 73.191),
    "rajkot": (22.303, 70.780),
    "bhavnagar": (21.764, 72.152),
    "jamnagar": (22.470, 70.069),
    "kutch": (23.733, 69.859),
    "bhuj": (23.241, 69.669),
    "dwarka": (22.244, 68.968),
    # Rajasthan
    "jaipur": (26.912, 75.787),
    "jodhpur": (26.280, 73.017),
    "udaipur": (24.585, 73.712),
    "kotak": (25.174, 75.838),
    "bikaner": (28.022, 73.318),
    "ajmer": (26.449, 74.640),
    "barmer": (25.741, 71.393),
    "jaisalmer": (26.912, 70.916),
    "bharatpur": (27.215, 77.517),
    "alwar": (27.552, 76.623),
    # Punjab & Border Towns
    "amritsar": (31.634, 74.872),
    "fazilka": (30.417, 74.087),
    "ferozepur": (30.928, 74.614),
    "ludhiana": (30.550, 75.752),
    "jalandhar": (31.326, 75.576),
    "patiala": (30.326, 76.400),
    "tarn taran": (31.444, 74.956),
    "muktsar": (30.470, 74.511),
    "pathankot": (32.274, 75.672),
    "moga": (30.821, 75.170),
    "nawanshahr": (31.124, 76.131),
    "hoshiarpur": (31.532, 75.914),
    "kapurthala": (31.382, 75.381),
    "bathinda": (30.211, 74.944),
    "mansa": (30.096, 75.398),
    "sangrur": (30.246, 75.837),
    "batala": (31.815, 75.198),
    "absul": (31.950, 75.030),
    # Bihar & Nepal Border
    "patna": (25.593, 85.137),
    "gaya": (24.750, 85.000),
    "muzaffarpur": (26.120, 85.393),
    "darbhanga": (26.154, 85.891),
    "bhagalpur": (25.244, 87.024),
    "raxaul": (26.975, 84.833),
    "nautanwa": (27.426, 83.421),
    "sonauli": (27.167, 83.783),
    "rupaidiah": (28.750, 80.083),
    "bettiah": (26.501, 84.683),
    "motihari": (26.659, 84.919),
    "araria": (26.135, 87.459),
    "kishanganj": (26.101, 87.912),
    "purnia": (25.472, 87.476),
    "siwan": (26.220, 84.361),
    "chapra": (25.776, 84.746),
    # UP Border / Indo-Nepal
    "gorakhpur": (26.766, 83.370),
    "varanasi": (25.318, 82.974),
    "lucknow": (26.838, 80.934),
    "agra": (27.176, 78.014),
    "kanpur": (26.449, 80.331),
    "prayagraj": (25.435, 81.880),
    "mirzapur": (25.144, 82.569),
    "bhadohi": (25.394, 82.559),
    "siddharthnagar": (27.229, 83.011),
    "sultanpur": (26.255, 82.073),
    "ambedkar nagar": (26.393, 82.732),
    # West Bengal & Borders
    "siliguri": (26.727, 88.395),
    "darjeeling": (27.036, 88.263),
    "malda": (25.011, 88.137),
    "kolkata": (22.572, 88.363),
    "howrah": (22.596, 88.310),
    "murshidabad": (24.177, 88.108),
    "dinajpur": (25.528, 88.797),
    # J&K & Border
    "srinagar": (33.778, 77.503),
    "jammu": (32.726, 74.857),
    "leh": (34.136, 77.588),
    "kupwara": (34.301, 74.255),
    "baramulla": (34.213, 74.344),
    "pulwama": (33.995, 75.116),
    "udit": (33.583, 75.333),
    "poonch": (33.760, 74.765),
    "kathua": (32.360, 75.526),
    "udhampur": (32.915, 75.140),
    "anantnag": (33.728, 75.150),
    "doda": (33.136, 75.587),
    "reasi": (33.085, 74.849),
    # Himachal Pradesh
    "shimla": (31.105, 77.112),
    "dharamshala": (32.219, 76.255),
    "kullu": (31.959, 77.108),
    "manali": (32.544, 77.189),
    "mandi": (31.708, 76.931),
    "solan": (30.961, 77.115),
    # Haryana
    "gurgaon": (28.428, 77.002),
    "faridabad": (28.408, 77.317),
    "hisar": (29.169, 75.700),
    "karnal": (29.685, 76.998),
    "panipat": (29.391, 76.977),
    "ambala": (30.378, 76.775),
    "rohtak": (28.895, 76.589),
    "jind": (29.314, 76.314),
    "sirsa": (29.535, 75.027),
    "rewari": (28.190, 76.218),
    "mahendragarh": (28.267, 76.083),
    "bhiwani": (28.837, 76.137),
    "sonipat": (28.984, 77.081),
    # Uttarakhand
    "dehradun": (30.316, 78.033),
    "haridwar": (29.945, 78.164),
    "rishikesh": (30.067, 78.296),
    "nainital": (29.392, 79.454),
    "almora": (29.625, 79.650),
    " Haldwani": (29.220, 79.528),
    "rudrapur": (29.033, 79.500),
    "kashipur": (29.205, 78.963),
    # Andhra Pradesh
    "hyderabad": (17.385, 78.486),
    "visakhapatnam": (17.686, 83.218),
    "vijayawada": (16.506, 80.630),
    "guntur": (16.306, 80.436),
    "nellore": (14.442, 79.986),
    "kurnool": (15.828, 78.037),
    "kadapa": (14.478, 78.986),
    "tirupati": (13.628, 77.598),
    "anantapur": (14.682, 77.598),
    # Telangana
    "secunderabad": (17.439, 78.493),
    "warangal": (17.978, 79.594),
    "nizamabad": (18.672, 78.094),
    "karimnagar": (18.438, 79.128),
    "khammam": (17.247, 80.146),
    # Kerala
    "thiruvananthapuram": (8.487, 76.941),
    "kochi": (9.939, 76.269),
    "kozhikode": (11.258, 75.780),
    "thrissur": (10.527, 76.215),
    "malappuram": (11.051, 76.070),
    "kannur": (11.875, 75.370),
    "palakkad": (10.786, 76.655),
    "kollam": (8.893, 76.614),
    "ernakulam": (9.984, 76.283),
    # Odisha
    "bhubaneswar": (20.296, 85.824),
    "cuttack": (20.462, 85.883),
    "rourkela": (22.229, 84.876),
    "berhampur": (19.315, 84.711),
    "sambalpur": (21.462, 83.991),
    # Jharkhand
    "ranchi": (23.344, 85.309),
    "jamshedpur": (22.800, 86.186),
    "dhanbad": (23.795, 86.430),
    "bokaro": (23.669, 86.151),
    "hazaribagh": (23.992, 85.446),
    "deoghar": (24.485, 86.700),
    # Chhattisgarh
    "raipur": (21.251, 81.629),
    "bilaspur": (22.080, 82.159),
    "durg": (21.189, 81.284),
    "rajnandgaon": (21.102, 81.032),
    "kawardha": (21.666, 81.731),
    # Madhya Pradesh
    "bhopal": (23.258, 77.412),
    "indore": (22.719, 75.857),
    "jabalpur": (23.178, 79.987),
    "gwalior": (26.215, 78.193),
    "ujjain": (23.182, 75.776),
    "sagar": (23.849, 78.743),
    "rewa": (24.533, 81.296),
    "satna": (24.603, 80.830),
    "ratlam": (23.327, 75.038),
    "dhar": (22.595, 75.301),
    "khargone": (21.682, 75.622),
    "khandwa": (21.823, 76.354),
    "burhanpur": (21.324, 76.230),
    # Goa
    "panjim": (15.491, 73.818),
    "margao": (15.274, 73.955),
    "vasco": (15.390, 73.812),
    "mapusa": (15.599, 73.760),
    # Andaman
    "port blair": (11.623, 92.726),
    # Default for unknown (India center)
    "_default": (22.885, 79.170),
}


def get_coords(city: str) -> tuple[float, float]:
    """Get lat/lon for a city name. Returns default if unknown."""
    return CITY_COORDS.get(city.lower(), CITY_COORDS["_default"])


# ─── DRUG TYPE NORMALIZER ──────────────────────────────────────────────────────
DRUG_MAP = {
    "heroin": "heroin",
    "brown sugar": "heroin",
    "brownsugar": "heroin",
    "speed ball": "heroin",
    "cocaine": "cocaine",
    "crack": "cocaine",
    "meth": "meth",
    "methamphetamine": "meth",
    "ice": "meth",
    "巫": "meth",
    "yaaba": "meth",
    "mdma": "mdma",
    "ecstasy": "mdma",
    "cannabis": "cannabis",
    "ganja": "cannabis",
    "charas": "cannabis",
    "hashish": "cannabis",
    "bhang": "cannabis",
    "marijuana": "cannabis",
    "weed": "cannabis",
    "marijuana": "cannabis",
    "morphine": "morphine",
    "opium": "opium",
    "poppy": "opium",
    " poppy husk": "opium",
    " codeine": "codeine",
    "tramadol": "tramadol",
    " Alprazolam": "benzodiazepine",
    "xanax": "benzodiazepine",
    "diazepam": "benzodiazepine",
    "steroids": "steroids",
    "injection": "steroids",
}


def normalize_drug(raw: str) -> str:
    if not raw:
        return "unknown"
    raw = raw.lower().strip()
    return DRUG_MAP.get(raw, "unknown")


# ─── TRANSFORM ParsedArticle → frontend seizure format ─────────────────────────
def transform_to_seizure(article, source_name: str, source_url: str) -> dict:
    """Convert a ParsedArticle into the frontend's Seizure format."""
    city = article.location_city or ""
    state = article.location_state or ""
    lat, lon = get_coords(city)

    drug = normalize_drug(article.drug_type or "")

    # Format date
    date_str = ""
    if article.published_date:
        date_str = article.published_date.strftime("%Y-%m-%d")

    return {
        "id": f"sz-{uuid.uuid4().hex[:8]}",
        "caseNo": article.case_number or f"auto-{uuid.uuid4().hex[:6]}",
        "city": city,
        "state": state,
        "lat": lat,
        "lon": lon,
        "drugType": drug,
        "quantityKg": article.quantity_kg or 0.0,
        "date": date_str,
        "sourceName": source_name,
        "sourceUrl": source_url,
        "agency": article.agency or source_name,
        "description": article.article_text[:500] if article.article_text else "",
        "images": article.images[:3] if article.images else [],
    }


# ─── STATS GENERATOR ───────────────────────────────────────────────────────────
def generate_stats(seizures: list) -> dict:
    """Compute stats from seizures list."""
    now = datetime.now()
    week_ago = now - timedelta(days=7)

    total = len(seizures)
    total_kg = sum(s.get("quantityKg", 0) or 0 for s in seizures)

    # raids this week
    week_count = 0
    by_state = {}
    by_drug = {}
    by_month = {}

    for s in seizures:
        state = s.get("state", "Unknown")
        drug = s.get("drugType", "unknown")
        by_state[state] = by_state.get(state, 0) + 1
        by_drug[drug] = by_drug.get(drug, 0) + 1

        date_str = s.get("date", "")
        if date_str:
            try:
                d = datetime.strptime(date_str, "%Y-%m-%d")
                month_key = d.strftime("%Y-%m")
                by_month[month_key] = by_month.get(month_key, 0) + 1
                if d >= week_ago:
                    week_count += 1
            except ValueError:
                pass

    # top locations
    top_locations = sorted(by_state.items(), key=lambda x: x[1], reverse=True)[:10]
    top_locations = [
        {"city": "", "state": st, "count": c, "kg": sum(
            se.get("quantityKg", 0) or 0 for se in seizures if se.get("state") == st
        )}
        for st, c in top_locations
    ]

    return {
        "total_seizures": total,
        "total_quantity_kg": round(total_kg, 2),
        "raids_this_week": week_count,
        "by_state": by_state,
        "by_drug_type": by_drug,
        "by_month": by_month,
        "top_locations": top_locations,
    }


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    log.info("Starting Narc Kart scraper run")
    project_root = Path(__file__).parent
    output_path = project_root / "frontend" / "public" / "data.json"

    log.info("Output: %s", output_path)

    # Run scraper
    scraper = Scraper()
    parser = ArticleParser()

    results = scraper.scrape_all_sources(keyword="drug seizure")
    log.info("Scraped %d articles from %d sources", len(results), len(ENABLED_SOURCES))

    seizures = []
    for result in results:
        if result.error:
            log.debug("Skipping %s (%s): %s", result.url, result.source.name, result.error)
            continue

        article = parser.parse(result.raw_html, result.url, result.source.name)

        # Skip if no drug type or no date
        if not article.drug_type or not article.published_date:
            log.debug("Skipping %s — no drug type or date", result.url)
            continue

        # Skip if too old (>1 year)
        if (datetime.now() - article.published_date).days > 365:
            log.debug("Skipping %s — too old (%s)", result.url, article.published_date)
            continue

        seizure = transform_to_seizure(article, result.source.name, result.url)
        seizures.append(seizure)

    log.info("Parsed %d valid seizures", len(seizures))

    # Deduplicate (same date + city + drug + ~quantity)
    seen = set()
    unique = []
    for s in seizures:
        key = f"{s['date']}|{s['city'].lower()}|{s['drugType']}|{round(s['quantityKg'], 1)}"
        if key not in seen:
            seen.add(key)
            unique.append(s)

    unique.sort(key=lambda x: x.get("date", ""), reverse=True)
    log.info("After dedup: %d seizures", len(unique))

    # Stats
    stats = generate_stats(unique)

    # Build output
    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    output = {
        "meta": {
            "generated_at": now,
            "source": "narc-kart weekly scraper",
            "total_records": len(unique),
        },
        "seizures": unique,
        "stats": stats,
    }

    # Write
    (output_path.parent).mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    size_kb = os.path.getsize(output_path) / 1024
    log.info("Written %s (%.1f KB, %d seizures)", output_path, size_kb, len(unique))

    if unique:
        top_state = max(stats["by_state"], key=stats["by_state"].get)
        log.info("Stats — Total: %d | This week: %d | Top state: %s (%d)",
                 stats["total_seizures"], stats["raids_this_week"], top_state, stats["by_state"][top_state])

    scraper.close()


if __name__ == "__main__":
    main()