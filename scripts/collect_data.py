#!/usr/bin/env python3
"""
India Drug Seizure Data Collector for NARC KART
===============================================
Collects drug seizure data from:
- GDELT GKG bulk files (historical, 2013-present)
- RSS feeds (The Hindu, Hindustan Times)

Outputs to frontend/public/data.json with proper schema.
Run standalone: python scripts/collect_data.py
"""

import json
import logging
import re
import hashlib
import time
import zipfile
import io
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import requests
try:
    import feedparser
    FEEDPARSER_AVAILABLE = True
except ImportError:
    FEEDPARSER_AVAILABLE = False

import warnings
warnings.filterwarnings('ignore', category=requests.packages.urllib3.exceptions.InsecureRequestWarning)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
OUTPUT_FILE = ROOT_DIR / "frontend" / "public" / "data.json"
CITIES_FILE = ROOT_DIR / "backend" / "scraper" / "cities.json"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

GDELT_BASE_URL = "https://data.gdeltproject.org/gdeltv3/gkgCSV"

DRUG_KEYWORDS = [
    'drug', 'narcotic', 'heroin', 'cocaine', 'meth', 'cannabis', 'marijuana',
    'ganja', 'opium', 'mdma', 'ecstasy', 'ketamine', 'LSD', 'methamphetamine',
    'smack', 'brown sugar', 'tramadol', 'alprazolam'
]

SEIZURE_KEYWORDS = [
    'seizure', 'seized', 'raid', 'arrested', 'smuggling', 'contraband',
    'peddler', 'NCB', 'Narcotics Control Bureau', 'police'
]

CITIES_LOOKUP: Dict[str, Dict] = {}
STATE_MAPPINGS: Dict[str, str] = {}

INDIAN_STATES = {
    'andaman and nicobar': 'Andaman and Nicobar', 'andaman & nicobar': 'Andaman and Nicobar',
    'andhra pradesh': 'Andhra Pradesh', 'arunachal pradesh': 'Arunachal Pradesh',
    'assam': 'Assam', 'bihar': 'Bihar', 'chandigarh': 'Chandigarh',
    'chhattisgarh': 'Chhattisgarh', 'dadra and nagar haveli': 'Dadra and Nagar Haveli',
    'daman and diu': 'Daman and Diu', 'delhi': 'Delhi', 'new delhi': 'Delhi',
    'goa': 'Goa', 'gujarat': 'Gujarat', 'haryana': 'Haryana',
    'himachal pradesh': 'Himachal Pradesh', 'jammu and kashmir': 'Jammu and Kashmir',
    'jharkhand': 'Jharkhand', 'karnataka': 'Karnataka', 'kerala': 'Kerala',
    'ladakh': 'Ladakh', 'lakshadweep': 'Lakshadweep', 'madhya pradesh': 'Madhya Pradesh',
    'maharashtra': 'Maharashtra', 'manipur': 'Manipur', 'meghalaya': 'Meghalaya',
    'mizoram': 'Mizoram', 'nagaland': 'Nagaland', 'odisha': 'Odisha', 'orissa': 'Odisha',
    'puducherry': 'Puducherry', 'punjab': 'Punjab', 'rajasthan': 'Rajasthan',
    'sikkim': 'Sikkim', 'tamil nadu': 'Tamil Nadu', 'telangana': 'Telangana',
    'tripura': 'Tripura', 'uttar pradesh': 'Uttar Pradesh', 'uttarakhand': 'Uttarakhand',
    'west bengal': 'West Bengal',
}


def load_cities() -> None:
    global CITIES_LOOKUP, STATE_MAPPINGS
    try:
        with open(CITIES_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for city in data.get('cities', []):
            name = city['name'].strip().lower()
            CITIES_LOOKUP[name] = city
        for state in INDIAN_STATES.values():
            STATE_MAPPINGS[state.lower()] = state
        logger.info(f"Loaded {len(CITIES_LOOKUP)} cities")
    except Exception as e:
        logger.error(f"Failed to load cities: {e}")


def normalize_state(state_str: str) -> Optional[str]:
    if not state_str:
        return None
    state_lower = state_str.strip().lower()
    return STATE_MAPPINGS.get(state_lower)


def parse_gdelt_location(location_str: str) -> Tuple[Optional[str], Optional[str], Optional[float], Optional[float]]:
    if not location_str or location_str == '#':
        return None, None, None, None

    parts = location_str.split(';')
    for part in parts:
        part = part.strip()
        if '#IN#' not in part:
            continue

        segments = part.split('#')
        if len(segments) < 6:
            continue

        country = segments[1].strip() if len(segments) > 1 else ''
        if country != 'IN':
            continue

        admin1 = segments[2].strip() if len(segments) > 2 else ''
        admin2 = segments[3].strip() if len(segments) > 3 else ''
        city_name = segments[4].strip() if len(segments) > 4 else ''
        lat_str = segments[5].strip() if len(segments) > 5 else ''
        lon_str = segments[6].strip() if len(segments) > 6 else ''

        lat = float(lat_str) if lat_str and lat_str != '' else None
        lon = float(lon_str) if lon_str and lon_str != '' else None

        state = normalize_state(admin1)

        matched_city = None
        matched_coords = None

        if city_name:
            city_lower = city_name.lower()
            if city_lower in CITIES_LOOKUP:
                matched_city = CITIES_LOOKUP[city_lower]['name']
                matched_coords = (CITIES_LOOKUP[city_lower]['lat'], CITIES_LOOKUP[city_lower]['lon'])

        if not matched_city and admin2:
            admin2_lower = admin2.lower()
            for city_key, city_data in CITIES_LOOKUP.items():
                if admin2_lower in city_key or city_key in admin2_lower:
                    matched_city = city_data['name']
                    matched_coords = (city_data['lat'], city_data['lon'])
                    if not state:
                        state = city_data['state']
                    break

        if matched_city:
            return matched_city, state, matched_coords[0], matched_coords[1]
        elif state:
            return None, state, lat, lon

    return None, None, None, None


def extract_location_from_text(text: str) -> Tuple[Optional[str], Optional[str], Optional[float], Optional[float]]:
    text_lower = text.lower()

    for state_pattern, state_name in INDIAN_STATES.items():
        if state_pattern in text_lower:
            state = state_name
            for city_name, city_data in CITIES_LOOKUP.items():
                if city_name in text_lower:
                    return city_data['name'], state, city_data['lat'], city_data['lon']
            return None, state, None, None

    major_cities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'kolkata',
                   'pune', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore',
                   'patna', 'bhopal', 'visakhapatnam', 'vadodara', 'ghaziabad', 'ludhiana',
                   'surat', 'kochi', 'goa', 'amritsar', 'jammu', 'srinagar', 'chandigarh',
                   'guwahati', 'bhubaneswar', 'ranchi', 'dehradun', 'shimla', 'cochin']

    for city_name in major_cities:
        if city_name in text_lower and city_name in CITIES_LOOKUP:
            city_data = CITIES_LOOKUP[city_name]
            return city_data['name'], city_data['state'], city_data['lat'], city_data['lon']

    for city_name, city_data in CITIES_LOOKUP.items():
        if len(city_name) > 4 and city_name in text_lower:
            return city_data['name'], city_data['state'], city_data['lat'], city_data['lon']

    return None, None, None, None


def is_drug_seizure_article(title: str, snippet: str, themes: str) -> bool:
    text = (title + ' ' + snippet).lower()
    themes_lower = themes.lower() if themes else ''

    has_drug_theme = any(kw in themes_lower for kw in ['drug', 'narcotic', 'WB_2456', 'DRUG_TRADE'])
    has_seizure_keyword = any(kw in text for kw in SEIZURE_KEYWORDS)
    has_drug_keyword = any(kw in text for kw in DRUG_KEYWORDS)

    if has_drug_theme and has_seizure_keyword:
        return True
    if has_seizure_keyword and has_drug_keyword:
        return True
    return False


def parse_gkg_line(line: str) -> Optional[Dict]:
    parts = line.split('\t')
    if len(parts) < 10:
        return None

    try:
        date = parts[1].strip()
        if len(date) >= 8:
            date = f"{date[:4]}-{date[4:6]}-{date[6:8]}"

        themes = parts[5].strip() if len(parts) > 5 else ''
        locations = parts[8].strip() if len(parts) > 8 else ''
        source_url = parts[11].strip() if len(parts) > 11 else ''

        if not source_url or not themes:
            return None

        title = parts[3].strip() if len(parts) > 3 else ''
        snippet = parts[4].strip() if len(parts) > 4 else ''

        if not is_drug_seizure_article(title, snippet, themes):
            return None

        city, state, lat, lon = parse_gdelt_location(locations)

        if not city and not state:
            city, state, lat, lon = extract_location_from_text(title + ' ' + snippet)

        if not city and not state:
            return None

        if lat is None or lon is None:
            if city and city.lower() in CITIES_LOOKUP:
                lat = CITIES_LOOKUP[city.lower()]['lat']
                lon = CITIES_LOOKUP[city.lower()]['lon']
            elif state:
                for c_name, c_data in CITIES_LOOKUP.items():
                    if c_data['state'].lower() == state.lower():
                        lat = c_data['lat']
                        lon = c_data['lon']
                        break

        drug_type = 'unknown'
        text_lower = (title + ' ' + snippet).lower()
        drug_mappings = {
            'heroin': ['heroin', 'smack', 'brown sugar', 'brownsugar'],
            'cocaine': ['cocaine', 'coca'],
            'meth': ['meth', 'methamphetamine', 'ice', 'crystal meth'],
            'cannabis': ['cannabis', 'ganja', 'charas', 'marijuana', 'bhang'],
            'mdma': ['mdma', 'ecstasy'],
            'opium': ['opium', 'poppy'],
            'ketamine': ['ketamine'],
            'LSD': ['lsd', 'acid'],
        }
        for drug, keywords in drug_mappings.items():
            if any(kw in text_lower for kw in keywords):
                drug_type = drug
                break

        return {
            'date': date,
            'title': title,
            'sourceUrl': source_url,
            'city': city,
            'state': state,
            'lat': lat,
            'lon': lon,
            'drugType': drug_type,
        }
    except Exception as e:
        return None


def download_and_parse_gdelt_day(date_str: str) -> List[Dict]:
    url = f"{GDELT_BASE_URL}/{date_str}.gkg.csv.zip"
    seizures = []

    try:
        resp = requests.get(url, headers=HEADERS, timeout=120, verify=True)
        if resp.status_code != 200:
            logger.debug(f"GDELT {date_str}: HTTP {resp.status_code}")
            return seizures
    except requests.exceptions.SSLError:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=120, verify=False)
            if resp.status_code != 200:
                logger.debug(f"GDELT {date_str}: HTTP {resp.status_code} (SSL fallback)")
                return seizures
        except Exception:
            return seizures
    except Exception:
        return seizures

        with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
            for filename in z.namelist():
                if filename.endswith('.gkg.csv'):
                    with z.open(filename) as f:
                        for line in f:
                            try:
                                line_str = line.decode('utf-8', errors='ignore').strip()
                                if line_str:
                                    record = parse_gkg_line(line_str)
                                    if record:
                                        seizures.append(record)
                            except Exception:
                                continue
                    break

    except Exception as e:
        logger.debug(f"GDELT {date_str}: {e}")

    return seizures


def poll_rss_feeds() -> List[Dict]:
    seizures = []
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        logger.warning("BeautifulSoup not available, skipping web scraping")
        return seizures

    rss_feeds = [
        ('Indian Express', 'https://indianexpress.com/section/india/feed/'),
        ('Times of India', 'https://timesofindia.indiatimes.com/rssfeeds/-2128833598.cms'),
    ]

    for source_name, feed_url in rss_feeds:
        try:
            resp = requests.get(feed_url, headers=HEADERS, timeout=30, verify=False)
            if resp.status_code != 200:
                logger.debug(f"{source_name} RSS: HTTP {resp.status_code}")
                continue

            soup = BeautifulSoup(resp.text, 'lxml')
            items = soup.find_all('item')[:100]

            for item in items:
                try:
                    title = item.find('title')
                    title = title.get_text(strip=True) if title else ''

                    link_elem = item.find('link')
                    link = ''
                    if link_elem:
                        link = link_elem.get_text(strip=True) if link_elem.name == 'link' else link_elem.get('href', '')
                    if not link:
                        link_tag = item.find_next('a')
                        if link_tag:
                            link = link_tag.get('href', '')

                    if not link:
                        continue

                    description = item.find('description')
                    desc_text = description.get_text(strip=True) if description else ''

                    text = (title + ' ' + desc_text).lower()

                    if not any(kw in text for kw in DRUG_KEYWORDS):
                        continue
                    if not any(kw in text for kw in SEIZURE_KEYWORDS):
                        continue

                    city, state, lat, lon = extract_location_from_text(title + ' ' + desc_text)

                    if not city and not state:
                        continue

                    if lat is None or lon is None:
                        if city and city.lower() in CITIES_LOOKUP:
                            lat = CITIES_LOOKUP[city.lower()]['lat']
                            lon = CITIES_LOOKUP[city.lower()]['lon']
                        elif state:
                            for c_name, c_data in CITIES_LOOKUP.items():
                                if c_data['state'].lower() == state.lower():
                                    lat = c_data['lat']
                                    lon = c_data['lon']
                                    break

                    pub_date = item.find('pubDate')
                    date = ''
                    if pub_date:
                        try:
                            from email.utils import parsedate_to_datetime
                            dt = parsedate_to_datetime(pub_date.get_text(strip=True))
                            date = dt.strftime('%Y-%m-%d')
                        except Exception:
                            pass

                    drug_type = 'unknown'
                    drug_mappings = {
                        'heroin': ['heroin', 'smack', 'brown sugar'],
                        'cocaine': ['cocaine'],
                        'meth': ['meth', 'methamphetamine', 'ice'],
                        'cannabis': ['cannabis', 'ganja', 'marijuana'],
                        'mdma': ['mdma', 'ecstasy'],
                        'opium': ['opium', 'poppy'],
                    }
                    for drug, keywords in drug_mappings.items():
                        if any(kw in text for kw in keywords):
                            drug_type = drug
                            break

                    seizures.append({
                        'date': date,
                        'title': title[:200],
                        'sourceUrl': link,
                        'city': city,
                        'state': state,
                        'lat': lat,
                        'lon': lon,
                        'drugType': drug_type,
                    })

                    time.sleep(0.2)

                except Exception as e:
                    continue

            time.sleep(1)

        except Exception as e:
            logger.debug(f"{source_name} RSS: {e}")

    return seizures

    feeds = [
        ('The Hindu', 'https://www.thehindu.com/search/?q=drug+seizure&order=DESC&sort=publishdate'),
        ('Hindustan Times', 'https://www.hindustantimes.com/search?query=drug%20seizure'),
    ]

    for source_name, feed_url in feeds:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:50]:
                title = entry.get('title', '')
                link = entry.get('link', '')
                summary = ''
                if hasattr(entry, 'summary'):
                    summary = entry.summary or ''
                elif hasattr(entry, 'description'):
                    summary = entry.description or ''

                text = (title + ' ' + summary).lower()
                if not any(kw in text for kw in DRUG_KEYWORDS):
                    continue
                if not any(kw in text for kw in SEIZURE_KEYWORDS):
                    continue

                city, state, lat, lon = extract_location_from_text(title + ' ' + summary)

                if not city and not state:
                    continue

                if lat is None or lon is None:
                    if city and city.lower() in CITIES_LOOKUP:
                        lat = CITIES_LOOKUP[city.lower()]['lat']
                        lon = CITIES_LOOKUP[city.lower()]['lon']
                    elif state:
                        for c_name, c_data in CITIES_LOOKUP.items():
                            if c_data['state'].lower() == state.lower():
                                lat = c_data['lat']
                                lon = c_data['lon']
                                break

                date = ''
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    try:
                        dt = datetime(*entry.published_parsed[:6])
                        date = dt.strftime('%Y-%m-%d')
                    except Exception:
                        pass

                drug_type = 'unknown'
                drug_mappings = {
                    'heroin': ['heroin', 'smack', 'brown sugar'],
                    'cocaine': ['cocaine'],
                    'meth': ['meth', 'methamphetamine', 'ice'],
                    'cannabis': ['cannabis', 'ganja', 'marijuana'],
                    'mdma': ['mdma', 'ecstasy'],
                    'opium': ['opium', 'poppy'],
                }
                for drug, keywords in drug_mappings.items():
                    if any(kw in text for kw in keywords):
                        drug_type = drug
                        break

                seizures.append({
                    'date': date,
                    'title': title,
                    'sourceUrl': link,
                    'city': city,
                    'state': state,
                    'lat': lat,
                    'lon': lon,
                    'drugType': drug_type,
                })

                time.sleep(0.5)

        except Exception as e:
            logger.warning(f"RSS {source_name}: {e}")

    return seizures


def generate_id(data: Dict) -> str:
    key_data = f"{data.get('date', '')}_{data.get('city', '')}_{data.get('drugType', '')}_{data.get('sourceUrl', '')}"
    return hashlib.md5(key_data.encode()).hexdigest()[:12]


def deduplicate_seizures(seizures: List[Dict]) -> List[Dict]:
    seen_urls = set()
    unique = []
    for s in seizures:
        url = s.get('sourceUrl', '')
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique.append(s)
    return unique


def compute_stats(seizures: List[Dict]) -> Dict:
    if not seizures:
        return {
            'total_seizures': 0,
            'total_quantity_kg': 0,
            'raids_this_week': 0,
            'by_state': {},
            'by_drug_type': {},
            'by_month': {},
            'top_locations': []
        }

    by_state = {}
    by_drug = {}
    by_month = {}
    location_counts = {}

    for s in seizures:
        state = s.get('state') or 'Unknown'
        by_state[state] = by_state.get(state, 0) + 1

        drug = s.get('drugType', 'unknown')
        by_drug[drug] = by_drug.get(drug, 0) + 1

        date = s.get('date', '')
        if date and len(date) >= 7:
            month = date[:7]
            by_month[month] = by_month.get(month, 0) + 1

        loc = f"{s.get('city', '')}, {state}"
        if loc != ', ':
            location_counts[loc] = location_counts.get(loc, 0) + 1

    week_ago = datetime.now() - timedelta(days=7)
    raids_week = 0
    for s in seizures:
        date_str = s.get('date', '')
        if date_str:
            try:
                dt = datetime.strptime(date_str, '%Y-%m-%d')
                if dt >= week_ago:
                    raids_week += 1
            except Exception:
                pass

    top_locs = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        'total_seizures': len(seizures),
        'total_quantity_kg': 0,
        'raids_this_week': raids_week,
        'by_state': by_state,
        'by_drug_type': by_drug,
        'by_month': by_month,
        'top_locations': [{'location': loc, 'count': count} for loc, count in top_locs]
    }


def run_collector(days_back: int = 365 * 2):
    logger.info("=" * 60)
    logger.info("India Drug Seizure Data Collector for NARC KART")
    logger.info("=" * 60)

    load_cities()

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing_data = []
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                existing_data = json.load(f).get('seizures', [])
            logger.info(f"Loaded {len(existing_data)} existing records")
        except Exception as e:
            logger.warning(f"Could not load existing data: {e}")

    existing_urls = set(s.get('sourceUrl', '') for s in existing_data if s.get('sourceUrl'))

    all_seizures = list(existing_data)

    logger.info(f"Processing GDELT bulk files (going back {days_back} days)...")
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_back)

    current_date = start_date
    gdelt_count = 0
    processed_days = 0

    while current_date <= end_date:
        date_str = current_date.strftime('%Y%m%d')
        records = download_and_parse_gdelt_day(date_str)

        for record in records:
            if record.get('sourceUrl') and record['sourceUrl'] not in existing_urls:
                record['id'] = generate_id(record)
                record['quantityKg'] = None
                record['agency'] = 'GDELT'
                record['images'] = []
                record['caseNo'] = f"GD-{date_str[:4]}-{gdelt_count:05d}"
                record['description'] = record.get('title', '')[:500]
                record['sourceName'] = 'GDELT'

                seizures_all = [s.get('sourceUrl', '') for s in all_seizures]
                if record['sourceUrl'] not in seizures_all:
                    all_seizures.append(record)
                    existing_urls.add(record['sourceUrl'])
                    gdelt_count += 1

        processed_days += 1
        if processed_days % 100 == 0:
            logger.info(f"Processed {processed_days} days, found {gdelt_count} new GDELT records")

        current_date += timedelta(days=1)

        if processed_days % 500 == 0:
            time.sleep(2)

    logger.info(f"GDELT: Added {gdelt_count} new records from {processed_days} days")

    logger.info("Polling RSS feeds...")
    rss_records = poll_rss_feeds()
    rss_count = 0

    for record in rss_records:
        if record.get('sourceUrl') and record['sourceUrl'] not in existing_urls:
            record['id'] = generate_id(record)
            record['quantityKg'] = None
            record['agency'] = 'RSS Feed'
            record['images'] = []
            record['caseNo'] = f"RS-{datetime.now().strftime('%Y%m%d')}-{rss_count:04d}"
            record['description'] = record.get('title', '')[:500]
            record['sourceName'] = record.get('sourceName', 'RSS')

            seizures_all = [s.get('sourceUrl', '') for s in all_seizures]
            if record['sourceUrl'] not in seizures_all:
                all_seizures.append(record)
                existing_urls.add(record['sourceUrl'])
                rss_count += 1

    logger.info(f"RSS: Added {rss_count} new records")

    all_seizures = deduplicate_seizures(all_seizures)

    logger.info(f"Total seizures after deduplication: {len(all_seizures)}")

    stats = compute_stats(all_seizures)

    output = {
        'seizures': all_seizures,
        'stats': stats,
        'lastUpdated': datetime.now().isoformat()
    }

    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        logger.info(f"Successfully wrote {len(all_seizures)} seizures to {OUTPUT_FILE}")
    except Exception as e:
        logger.error(f"Failed to write output file: {e}")
        raise

    logger.info("=" * 60)
    logger.info("Collection completed successfully")
    logger.info(f"Total seizures: {stats['total_seizures']}")
    logger.info(f"GDELT records: {gdelt_count}")
    logger.info(f"RSS records: {rss_count}")
    logger.info(f"Raids this week: {stats['raids_this_week']}")
    logger.info("=" * 60)

    return output


if __name__ == '__main__':
    import sys
    days = 365 * 2
    if len(sys.argv) > 1:
        try:
            days = int(sys.argv[1])
        except ValueError:
            pass
    run_collector(days_back=days)