#!/usr/bin/env python3
"""
India Drug Seizure Scraper
Scrapes drug seizure data from multiple Indian news sources and government portals.
Outputs to frontend/public/data.json
"""

import json
import logging
import re
import hashlib
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import requests
from bs4 import BeautifulSoup
import html2text
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
OUTPUT_DIR = Path(__file__).parent.parent.parent / "frontend" / "public"
OUTPUT_FILE = OUTPUT_DIR / "data.json"
CITIES_FILE = Path(__file__).parent / "cities.json"
MAX_WORKERS = 5
REQUEST_DELAY = 1.0  # seconds between requests to same domain
RECENT_DAYS = 30  # only scrape articles from last N days

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

# Drug name mappings
DRUG_MAPPINGS = {
    'heroin': 'heroin',
    'brown sugar': 'heroin',
    'brownsugar': 'heroin',
    ' smack': 'heroin',
    'smack': 'heroin',
    'meth': 'meth',
    'methamphetamine': 'meth',
    'ice': 'meth',
    'crystal meth': 'meth',
    'cocaine': 'cocaine',
    'coca': 'cocaine',
    'ganja': 'cannabis',
    'cannabis': 'cannabis',
    'charas': 'cannabis',
    'marijuana': 'cannabis',
    'marihuana': 'cannabis',
    'bhang': 'cannabis',
    'mdma': 'mdma',
    'ecstasy': 'mdma',
    'morphine': 'morphine',
    'opium': 'opium',
    'poppy': 'opium',
    ' poppy husk': 'opium',
    'poppy husk': 'opium',
    'morphine': 'morphine',
    'tramadol': 'tramadol',
    'alprazolam': 'benzodiazepine',
    'diazepam': 'benzodiazepine',
    'ketamine': 'ketamine',
    'LSD': 'lsd',
    'lsd': 'lsd',
    'acid': 'lsd',
}

# Keywords to search for
SEIZURE_KEYWORDS = [
    'drug seizure', 'seizure of drugs', 'drugs seized', 'narcotics seizure',
    'arrested with drugs', 'contraband seized', 'illicit drugs', 'smuggling of drugs',
    'NCB', 'Narcotics Control Bureau', 'police raid', 'raid'
]

# States to check for regional papers
REGIONAL_STATES = ['UP', 'Bihar', 'Jharkhand', 'Punjab', 'Haryana', 'Rajasthan', 'MP', 'Maharashtra', 'Gujarat', 'West Bengal', 'Assam', 'J&K', 'HP']


def load_cities() -> Dict[str, Dict]:
    """Load city coordinates from JSON file."""
    try:
        with open(CITIES_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Create lookup by name and by district
        cities = {}
        for city in data.get('cities', []):
            name = city['name'].strip().lower()
            cities[name] = city
        logger.info(f"Loaded {len(cities)} cities")
        return cities
    except Exception as e:
        logger.error(f"Failed to load cities: {e}")
        return {}


def normalize_drug(text: str) -> Optional[str]:
    """Normalize drug name from text."""
    text_lower = text.lower()
    for pattern, normalized in DRUG_MAPPINGS.items():
        if pattern in text_lower:
            return normalized
    return None


def normalize_date(date_str: str) -> Optional[str]:
    """Parse and normalize date to YYYY-MM-DD format."""
    if not date_str:
        return None

    date_str = date_str.strip()

    # Try various date formats
    formats = [
        '%Y-%m-%d',
        '%d-%m-%Y',
        '%d/%m/%Y',
        '%Y/%m/%d',
        '%b %d, %Y',
        '%B %d, %Y',
        '%d %b %Y',
        '%d %B %Y',
        '%d-%m-%y',
        '%d/%m/%y',
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue

    # Try to extract from "X days ago" format
    day_match = re.search(r'(\d+)\s*(?:day|days)\s*ago', date_str, re.I)
    if day_match:
        days = int(day_match.group(1))
        dt = datetime.now() - timedelta(days=days)
        return dt.strftime('%Y-%m-%d')

    return None


def extract_location(text: str, cities_lookup: Dict[str, Dict]) -> Tuple[Optional[str], Optional[str], Optional[float], Optional[float]]:
    """Extract city and state from text using regex and heuristic matching."""
    text_lower = text.lower()

    # Try to find Indian states in text
    state_patterns = {
        'maharashtra': 'Maharashtra',
        'delhi': 'Delhi',
        'new delhi': 'Delhi',
        'karnataka': 'Karnataka',
        'tamil nadu': 'Tamil Nadu',
        'kerala': 'Kerala',
        'gujarat': 'Gujarat',
        'rajasthan': 'Rajasthan',
        'punjab': 'Punjab',
        'haryana': 'Haryana',
        'uttar pradesh': 'Uttar Pradesh',
        'madhya pradesh': 'Madhya Pradesh',
        'bihar': 'Bihar',
        'jharkhand': 'Jharkhand',
        'west bengal': 'West Bengal',
        'assam': 'Assam',
        'odisha': 'Odisha',
        'chhattisgarh': 'Chhattisgarh',
        'telangana': 'Telangana',
        'andhra pradesh': 'Andhra Pradesh',
        'goa': 'Goa',
        'himachal pradesh': 'Himachal Pradesh',
        'jammu and kashmir': 'Jammu and Kashmir',
        'ladakh': 'Ladakh',
        'chandigarh': 'Chandigarh',
        'uttarakhand': 'Uttarakhand',
        'sikkim': 'Sikkim',
        'nagaland': 'Nagaland',
        'manipur': 'Manipur',
        'mizoram': 'Mizoram',
        'tripura': 'Tripura',
        'meghalaya': 'Meghalaya',
        'arunachal pradesh': 'Arunachal Pradesh',
    }

    found_state = None
    for pattern, state_name in state_patterns.items():
        if pattern in text_lower:
            found_state = state_name
            break

    # Try to find cities
    found_city = None
    found_coords = None

    # First, try to find major cities
    major_cities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'kolkata',
                   'pune', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore',
                   'patna', 'bhopal', 'visakhapatnam', 'vadodara', 'ghaziabad', 'ludhiana']

    for city_name in major_cities:
        if city_name in text_lower:
            if city_name in cities_lookup:
                found_city = cities_lookup[city_name]['name']
                found_coords = (cities_lookup[city_name]['lat'], cities_lookup[city_name]['lon'])
                if not found_state:
                    found_state = cities_lookup[city_name]['state']
                break

    # If no city found yet, try border towns and smaller cities
    if not found_city:
        # Check for border cities specifically
        border_cities = ['amritsar', 'fazilka', 'ferozpur', 'jalandhar', 'tarn taran',
                        'muktsar', 'pathankot', 'ludhiana', 'moga', 'nawanshahr',
                        'hoshiarpur', 'kapurthala', 'bhilwara', 'bikaner', 'jodhpur',
                        'kota', 'udaipur', 'ajmer', 'barmer', 'jaisalmer', 'sriganganagar',
                        'fatehpur', 'sikandra', 'bhopal', 'indore', 'ujjain', 'gwalior',
                        'raipur', 'bhilai', 'bilaspur', 'dhamtari', 'raigarh',
                        'kutch', 'bhuj', 'jamnagar', 'dwarka', 'porbandar', 'junagadh',
                        'anand', 'valsad', 'navsari', 'bharuch', 'surat',
                        'varanasi', 'lucknow', 'gorakhpur', 'agra', 'meerut', 'bareilly',
                        'mirzapur', 'sultanpur', 'azamgarh', 'jaunpur', 'prayagraj',
                        'siliguri', 'darjeeling', 'malda', 'kharagpur', 'asansol',
                        'srinagar', 'jammu', 'leh', 'kupwara', 'baramulla', 'pulwama',
                        'anantnag', 'udhampur', 'kathua', 'patiala', 'chandigarh',
                        'rohtak', 'hisar', 'karnal', 'panipat', 'ambala', 'sirsa',
                        'bhiwani', 'rewari', 'gurgaon', 'faridabad', 'sonipat',
                        'patna', 'gaya', 'bhagalpur', 'muzaffarpur', 'darbhanga',
                        'bihar sharif', 'arrah', 'begusarai', 'katihar', 'munger',
                        'motihari', 'betiah', 'raxaul', 'nautanwa', 'sonauli',
                        'ranchi', 'jamshedpur', 'dhanbad', 'bokaro', 'hazaribagh',
                        'dehradun', 'haridwar', 'rishikesh', 'haldwani', 'nainital',
                        'kolkata', 'howrah', 'asansol', 'durgapur', 'siliguri']

        for city_name in border_cities:
            if city_name in text_lower:
                if city_name in cities_lookup:
                    found_city = cities_lookup[city_name]['name']
                    found_coords = (cities_lookup[city_name]['lat'], cities_lookup[city_name]['lon'])
                    if not found_state:
                        found_state = cities_lookup[city_name]['state']
                    break

    # If still no city, try any match in our cities list
    if not found_city:
        for city_name, city_data in cities_lookup.items():
            if city_name in text_lower:
                found_city = city_data['name']
                found_coords = (city_data['lat'], city_data['lon'])
                if not found_state:
                    found_state = city_data['state']
                break

    return found_city, found_state, found_coords[0] if found_coords else None, found_coords[1] if found_coords else None


def extract_quantity(text: str) -> Optional[float]:
    """Extract drug quantity in kg from text."""
    text = text.lower()

    # Patterns for quantity
    patterns = [
        r'(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)',
        r'(\d+(?:\.\d+)?)\s*(?:g|grams?)',
        r'(\d+(?:\.\d+)?)\s*(?:mg|milligrams?)',
        r'(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?)',
        r'(\d+(?:\.\d+)?)\s*(?:quintals?)',
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            value = float(match.group(1))
            unit = re.search(r'(kg|grams?|mg|tonnes?|tons?|quintals?)', text[match.end():match.end()+10])
            if unit:
                unit = unit.group(1).lower()
                if unit.startswith('ton'):
                    value *= 1000  # convert to kg
                elif unit.startswith('quintal'):
                    value *= 0.1  # convert to kg
                elif unit.startswith('g') and not unit.startswith('kg'):
                    value /= 1000  # convert to kg
                elif unit.startswith('mg'):
                    value /= 1_000_000  # convert to kg
            return value

    return None


def generate_id(data: Dict) -> str:
    """Generate unique ID based on case details."""
    key_data = f"{data.get('date', '')}_{data.get('city', '')}_{data.get('drugType', '')}_{data.get('quantityKg', 0)}"
    hash_val = hashlib.md5(key_data.encode()).hexdigest()[:8]
    return f"sz-{hash_val}"


def make_request(url: str, timeout: int = 30, params: Optional[Dict] = None) -> Optional[requests.Response]:
    """Make HTTP request with retry logic."""
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((requests.RequestException,))
    )
    def _request():
        return requests.get(url, headers=HEADERS, timeout=timeout, params=params, verify=False)

    try:
        return _request()
    except Exception as e:
        logger.warning(f"Request failed for {url}: {e}")
        return None


def scrape_ncb() -> List[Dict]:
    """Scrape NCB press releases."""
    logger.info("Scraping NCB press releases...")
    seizures = []

    try:
        # NCB press releases page
        url = "https://www.ncb.gov.in/press-releases"
        resp = make_request(url)
        if not resp:
            logger.warning("NCB: Could not fetch page")
            return seizures

        soup = BeautifulSoup(resp.text, 'lxml')
        h2t = html2text.html2text

        # Find press release links
        articles = soup.find_all('a', href=re.compile(r'press-release|pressreleases'))
        logger.info(f"NCB: Found {len(articles)} article links")

        for article in articles[:50]:  # Limit to 50
            try:
                link = article.get('href', '')
                if not link.startswith('http'):
                    link = f"https://www.ncb.gov.in{link}"

                article_resp = make_request(link)
                if not article_resp:
                    continue

                article_soup = BeautifulSoup(article_resp.text, 'lxml')
                article_text = article_soup.get_text()

                # Check if it's about drugs
                if not any(kw in article_text.lower() for kw in SEIZURE_KEYWORDS):
                    continue

                # Extract details
                drug = normalize_drug(article_text)
                if not drug:
                    continue

                city, state, lat, lon = extract_location(article_text, CITIES_LOOKUP)
                if not city:
                    continue

                # Try to extract date
                date_match = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', article_text)
                date = normalize_date(date_match.group(1)) if date_match else datetime.now().strftime('%Y-%m-%d')

                # Try to extract quantity
                quantity = extract_quantity(article_text)

                seizure = {
                    'id': '',
                    'caseNo': f"NCB-{city[:3].upper()}-{datetime.now().strftime('%Y')}-{(len(seizures)+100):04d}",
                    'city': city,
                    'state': state,
                    'lat': lat,
                    'lon': lon,
                    'drugType': drug,
                    'quantityKg': quantity,
                    'date': date,
                    'sourceName': 'Narcotics Control Bureau',
                    'sourceUrl': link,
                    'agency': 'Narcotics Control Bureau',
                    'description': article_text[:500],
                    'images': []
                }
                seizure['id'] = generate_id(seizure)
                seizures.append(seizure)

            except Exception as e:
                logger.debug(f"NCB: Error processing article: {e}")
                continue

    except Exception as e:
        logger.error(f"NCB: Scraping failed: {e}")

    logger.info(f"NCB: Found {len(seizures)} seizures")
    return seizures


def scrape_pib() -> List[Dict]:
    """Scrape PIB (Press Information Bureau) for drug-related news."""
    logger.info("Scraping PIB...")
    seizures = []

    try:
        # PIB search for narcotics/drug seizure
        url = "https://pib.gov.in/SearchResult.aspx"
        params = {
            'searchtext': 'drug seizure',
            'category': 'all'
        }
        resp = make_request(url, params=params)
        if not resp:
            logger.warning("PIB: Could not fetch page")
            return seizures

        soup = BeautifulSoup(resp.text, 'lxml')
        articles = soup.find_all('a', href=re.compile(r'Features|NewsReleases'))

        for article in articles[:30]:
            try:
                link = article.get('href', '')
                if not link.startswith('http'):
                    link = f"https://pib.gov.in{link}"

                article_resp = make_request(link)
                if not article_resp:
                    continue

                article_soup = BeautifulSoup(article_resp.text, 'lxml')
                article_text = article_soup.get_text()

                if not any(kw in article_text.lower() for kw in SEIZURE_KEYWORDS):
                    continue

                drug = normalize_drug(article_text)
                if not drug:
                    continue

                city, state, lat, lon = extract_location(article_text, CITIES_LOOKUP)
                if not city:
                    continue

                date_match = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', article_text)
                date = normalize_date(date_match.group(1)) if date_match else datetime.now().strftime('%Y-%m-%d')

                quantity = extract_quantity(article_text)

                seizure = {
                    'id': '',
                    'caseNo': f"PIB-{city[:3].upper()}-{datetime.now().strftime('%Y')}-{(len(seizures)+100):04d}",
                    'city': city,
                    'state': state,
                    'lat': lat,
                    'lon': lon,
                    'drugType': drug,
                    'quantityKg': quantity,
                    'date': date,
                    'sourceName': 'Press Information Bureau',
                    'sourceUrl': link,
                    'agency': 'PIB',
                    'description': article_text[:500],
                    'images': []
                }
                seizure['id'] = generate_id(seizure)
                seizures.append(seizure)

            except Exception as e:
                logger.debug(f"PIB: Error processing article: {e}")
                continue

    except Exception as e:
        logger.error(f"PIB: Scraping failed: {e}")

    logger.info(f"PIB: Found {len(seizures)} seizures")
    return seizures


def scrape_times_of_india() -> List[Dict]:
    """Scrape Times of India for drug seizure news."""
    logger.info("Scraping Times of India...")
    seizures = []

    try:
        search_url = "https://timesofindia.indiatimes.com/search.cms"
        params = {
            'q': 'drug seizure India',
            'type': 'news'
        }
        resp = make_request(search_url, params=params)
        if not resp:
            logger.warning("TOI: Could not fetch search page")
            return seizures

        soup = BeautifulSoup(resp.text, 'lxml')
        articles = soup.find_all('a', href=re.compile(r'/india/'))

        for article in articles[:30]:
            try:
                link = article.get('href', '')
                if not link.startswith('http'):
                    link = f"https://timesofindia.indiatimes.com{link}"

                article_resp = make_request(link)
                if not article_resp:
                    continue

                article_soup = BeautifulSoup(article_resp.text, 'lxml')
                article_text = article_soup.get_text()

                if not any(kw in article_text.lower() for kw in SEIZURE_KEYWORDS):
                    continue

                drug = normalize_drug(article_text)
                if not drug:
                    continue

                city, state, lat, lon = extract_location(article_text, CITIES_LOOKUP)
                if not city:
                    continue

                date_match = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', article_text)
                date = normalize_date(date_match.group(1)) if date_match else datetime.now().strftime('%Y-%m-%d')

                quantity = extract_quantity(article_text)

                seizure = {
                    'id': '',
                    'caseNo': f"TOI-{city[:3].upper()}-{datetime.now().strftime('%Y')}-{(len(seizures)+100):04d}",
                    'city': city,
                    'state': state,
                    'lat': lat,
                    'lon': lon,
                    'drugType': drug,
                    'quantityKg': quantity,
                    'date': date,
                    'sourceName': 'Times of India',
                    'sourceUrl': link,
                    'agency': 'Local Police / TOI',
                    'description': article_text[:500],
                    'images': []
                }
                seizure['id'] = generate_id(seizure)
                seizures.append(seizure)

            except Exception as e:
                logger.debug(f"TOI: Error processing article: {e}")
                continue

    except Exception as e:
        logger.error(f"TOI: Scraping failed: {e}")

    logger.info(f"TOI: Found {len(seizures)} seizures")
    return seizures


def scrape_indian_express() -> List[Dict]:
    """Scrape Indian Express for drug seizure news."""
    logger.info("Scraping Indian Express...")
    seizures = []

    try:
        url = "https://indianexpress.com/section/india/"
        resp = make_request(url)
        if not resp:
            logger.warning("IE: Could not fetch page")
            return seizures

        soup = BeautifulSoup(resp.text, 'lxml')
        articles = soup.find_all('a', href=re.compile(r'/article/'))

        for article in articles[:30]:
            try:
                link = article.get('href', '')
                if not link.startswith('http'):
                    link = f"https://indianexpress.com{link}"

                article_resp = make_request(link)
                if not article_resp:
                    continue

                article_soup = BeautifulSoup(article_resp.text, 'lxml')
                article_text = article_soup.get_text()

                if not any(kw in article_text.lower() for kw in SEIZURE_KEYWORDS):
                    continue

                drug = normalize_drug(article_text)
                if not drug:
                    continue

                city, state, lat, lon = extract_location(article_text, CITIES_LOOKUP)
                if not city:
                    continue

                date_match = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', article_text)
                date = normalize_date(date_match.group(1)) if date_match else datetime.now().strftime('%Y-%m-%d')

                quantity = extract_quantity(article_text)

                seizure = {
                    'id': '',
                    'caseNo': f"IE-{city[:3].upper()}-{datetime.now().strftime('%Y')}-{(len(seizures)+100):04d}",
                    'city': city,
                    'state': state,
                    'lat': lat,
                    'lon': lon,
                    'drugType': drug,
                    'quantityKg': quantity,
                    'date': date,
                    'sourceName': 'Indian Express',
                    'sourceUrl': link,
                    'agency': 'Local Police / Indian Express',
                    'description': article_text[:500],
                    'images': []
                }
                seizure['id'] = generate_id(seizure)
                seizures.append(seizure)

            except Exception as e:
                logger.debug(f"IE: Error processing article: {e}")
                continue

    except Exception as e:
        logger.error(f"IE: Scraping failed: {e}")

    logger.info(f"IE: Found {len(seizures)} seizures")
    return seizures


def scrape_dainik_jagran() -> List[Dict]:
    """Scrape Dainik Jagran for regional drug seizure news."""
    logger.info("Scraping Dainik Jagran...")
    seizures = []

    try:
        # States to check
        state_urls = {
            'UP': 'https://www.jagran.com/uttar-pradesh',
            'Bihar': 'https://www.jagran.com/bihar',
            'Punjab': 'https://www.jagran.com/punjab',
            'Haryana': 'https://www.jagran.com/haryana',
            'Rajasthan': 'https://www.jagran.com/rajasthan',
            'MP': 'https://www.jagran.com/madhya-pradesh',
        }

        for state, base_url in state_urls.items():
            try:
                resp = make_request(base_url)
                if not resp:
                    continue

                soup = BeautifulSoup(resp.text, 'lxml')
                articles = soup.find_all('a', href=re.compile(r'/article|\.html'))

                for article in articles[:15]:
                    try:
                        link = article.get('href', '')
                        if not link.startswith('http'):
                            link = f"https://www.jagran.com{link}"

                        article_resp = make_request(link)
                        if not article_resp:
                            continue

                        article_soup = BeautifulSoup(article_resp.text, 'lxml')
                        article_text = article_soup.get_text()

                        if not any(kw in article_text.lower() for kw in SEIZURE_KEYWORDS):
                            continue

                        drug = normalize_drug(article_text)
                        if not drug:
                            continue

                        city, extracted_state, lat, lon = extract_location(article_text, CITIES_LOOKUP)
                        if not city:
                            continue

                        date_match = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', article_text)
                        date = normalize_date(date_match.group(1)) if date_match else datetime.now().strftime('%Y-%m-%d')

                        quantity = extract_quantity(article_text)

                        seizure = {
                            'id': '',
                            'caseNo': f"DJ-{city[:3].upper()}-{datetime.now().strftime('%Y')}-{(len(seizures)+100):04d}",
                            'city': city,
                            'state': extracted_state or state,
                            'lat': lat,
                            'lon': lon,
                            'drugType': drug,
                            'quantityKg': quantity,
                            'date': date,
                            'sourceName': 'Dainik Jagran',
                            'sourceUrl': link,
                            'agency': 'Local Police / Dainik Jagran',
                            'description': article_text[:500],
                            'images': []
                        }
                        seizure['id'] = generate_id(seizure)
                        seizures.append(seizure)

                    except Exception as e:
                        logger.debug(f"DJ ({state}): Error processing article: {e}")
                        continue

                    import time
                    time.sleep(REQUEST_DELAY)

            except Exception as e:
                logger.warning(f"DJ: Error processing state {state}: {e}")
                continue

    except Exception as e:
        logger.error(f"DJ: Scraping failed: {e}")

    logger.info(f"DJ: Found {len(seizures)} seizures")
    return seizures


def scrape_amar_ujala() -> List[Dict]:
    """Scrape Amar Ujala for regional drug seizure news."""
    logger.info("Scraping Amar Ujala...")
    seizures = []

    try:
        state_urls = {
            'UP': 'https://www.amarujala.com/uttar-pradesh',
            'Punjab': 'https://www.amarujala.com/punjab',
            'Haryana': 'https://www.amarujala.com/haryana',
            'HP': 'https://www.amarujala.com/himachal-pradesh',
            'J&K': 'https://www.amarujala.com/jammu-and-kashmir',
            'UK': 'https://www.amarujala.com/uttarakhand',
        }

        for state, base_url in state_urls.items():
            try:
                resp = make_request(base_url)
                if not resp:
                    continue

                soup = BeautifulSoup(resp.text, 'lxml')
                articles = soup.find_all('a', href=re.compile(r'/news|\.html'))

                for article in articles[:15]:
                    try:
                        link = article.get('href', '')
                        if not link.startswith('http'):
                            link = f"https://www.amarujala.com{link}"

                        article_resp = make_request(link)
                        if not article_resp:
                            continue

                        article_soup = BeautifulSoup(article_resp.text, 'lxml')
                        article_text = article_soup.get_text()

                        if not any(kw in article_text.lower() for kw in SEIZURE_KEYWORDS):
                            continue

                        drug = normalize_drug(article_text)
                        if not drug:
                            continue

                        city, extracted_state, lat, lon = extract_location(article_text, CITIES_LOOKUP)
                        if not city:
                            continue

                        date_match = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', article_text)
                        date = normalize_date(date_match.group(1)) if date_match else datetime.now().strftime('%Y-%m-%d')

                        quantity = extract_quantity(article_text)

                        seizure = {
                            'id': '',
                            'caseNo': f"AU-{city[:3].upper()}-{datetime.now().strftime('%Y')}-{(len(seizures)+100):04d}",
                            'city': city,
                            'state': extracted_state or state,
                            'lat': lat,
                            'lon': lon,
                            'drugType': drug,
                            'quantityKg': quantity,
                            'date': date,
                            'sourceName': 'Amar Ujala',
                            'sourceUrl': link,
                            'agency': 'Local Police / Amar Ujala',
                            'description': article_text[:500],
                            'images': []
                        }
                        seizure['id'] = generate_id(seizure)
                        seizures.append(seizure)

                    except Exception as e:
                        logger.debug(f"AU ({state}): Error processing article: {e}")
                        continue

                    import time
                    time.sleep(REQUEST_DELAY)

            except Exception as e:
                logger.warning(f"AU: Error processing state {state}: {e}")
                continue

    except Exception as e:
        logger.error(f"AU: Scraping failed: {e}")

    logger.info(f"AU: Found {len(seizures)} seizures")
    return seizures


def scrape_punjab_police() -> List[Dict]:
    """Scrape Punjab Police website."""
    logger.info("Scraping Punjab Police...")
    seizures = []

    try:
        url = "https://punjabpolice.gov.in"
        resp = make_request(url)
        if not resp:
            logger.warning("PP: Could not fetch page")
            return seizures

        soup = BeautifulSoup(resp.text, 'lxml')
        articles = soup.find_all('a', href=re.compile(r'news|seizure|arrest'))

        for article in articles[:20]:
            try:
                link = article.get('href', '')
                if not link.startswith('http'):
                    link = f"https://punjabpolice.gov.in{link}"

                article_resp = make_request(link)
                if not article_resp:
                    continue

                article_soup = BeautifulSoup(article_resp.text, 'lxml')
                article_text = article_soup.get_text()

                if not any(kw in article_text.lower() for kw in SEIZURE_KEYWORDS):
                    continue

                drug = normalize_drug(article_text)
                if not drug:
                    continue

                city, state, lat, lon = extract_location(article_text, CITIES_LOOKUP)
                if not city:
                    # Default to Punjab if no specific city found
                    city = "Punjab"
                    state = "Punjab"

                date_match = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', article_text)
                date = normalize_date(date_match.group(1)) if date_match else datetime.now().strftime('%Y-%m-%d')

                quantity = extract_quantity(article_text)

                seizure = {
                    'id': '',
                    'caseNo': f"PP-{city[:3].upper()}-{datetime.now().strftime('%Y')}-{(len(seizures)+100):04d}",
                    'city': city,
                    'state': state,
                    'lat': lat,
                    'lon': lon,
                    'drugType': drug,
                    'quantityKg': quantity,
                    'date': date,
                    'sourceName': 'Punjab Police',
                    'sourceUrl': link,
                    'agency': 'Punjab Police',
                    'description': article_text[:500],
                    'images': []
                }
                seizure['id'] = generate_id(seizure)
                seizures.append(seizure)

            except Exception as e:
                logger.debug(f"PP: Error processing article: {e}")
                continue

    except Exception as e:
        logger.error(f"PP: Scraping failed: {e}")

    logger.info(f"PP: Found {len(seizures)} seizures")
    return seizures


def scrape_haryana_police() -> List[Dict]:
    """Scrape Haryana Police website."""
    logger.info("Scraping Haryana Police...")
    seizures = []

    try:
        url = "https://www.haryanapolice.gov.in"
        resp = make_request(url)
        if not resp:
            logger.warning("HP: Could not fetch page")
            return seizures

        soup = BeautifulSoup(resp.text, 'lxml')
        articles = soup.find_all('a', href=re.compile(r'news|seizure|arrest'))

        for article in articles[:20]:
            try:
                link = article.get('href', '')
                if not link.startswith('http'):
                    link = f"https://www.haryanapolice.gov.in{link}"

                article_resp = make_request(link)
                if not article_resp:
                    continue

                article_soup = BeautifulSoup(article_resp.text, 'lxml')
                article_text = article_soup.get_text()

                if not any(kw in article_text.lower() for kw in SEIZURE_KEYWORDS):
                    continue

                drug = normalize_drug(article_text)
                if not drug:
                    continue

                city, state, lat, lon = extract_location(article_text, CITIES_LOOKUP)
                if not city:
                    city = "Haryana"
                    state = "Haryana"

                date_match = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', article_text)
                date = normalize_date(date_match.group(1)) if date_match else datetime.now().strftime('%Y-%m-%d')

                quantity = extract_quantity(article_text)

                seizure = {
                    'id': '',
                    'caseNo': f"HRP-{city[:3].upper()}-{datetime.now().strftime('%Y')}-{(len(seizures)+100):04d}",
                    'city': city,
                    'state': state,
                    'lat': lat,
                    'lon': lon,
                    'drugType': drug,
                    'quantityKg': quantity,
                    'date': date,
                    'sourceName': 'Haryana Police',
                    'sourceUrl': link,
                    'agency': 'Haryana Police',
                    'description': article_text[:500],
                    'images': []
                }
                seizure['id'] = generate_id(seizure)
                seizures.append(seizure)

            except Exception as e:
                logger.debug(f"HRP: Error processing article: {e}")
                continue

    except Exception as e:
        logger.error(f"HRP: Scraping failed: {e}")

    logger.info(f"HRP: Found {len(seizures)} seizures")
    return seizures


def scrape_bihar_police() -> List[Dict]:
    """Scrape Bihar Police website."""
    logger.info("Scraping Bihar Police...")
    seizures = []

    try:
        url = "https://www.biharpolice.in"
        resp = make_request(url)
        if not resp:
            logger.warning("BP: Could not fetch page")
            return seizures

        soup = BeautifulSoup(resp.text, 'lxml')
        articles = soup.find_all('a', href=re.compile(r'news|seizure|arrest'))

        for article in articles[:20]:
            try:
                link = article.get('href', '')
                if not link.startswith('http'):
                    link = f"https://www.biharpolice.in{link}"

                article_resp = make_request(link)
                if not article_resp:
                    continue

                article_soup = BeautifulSoup(article_resp.text, 'lxml')
                article_text = article_soup.get_text()

                if not any(kw in article_text.lower() for kw in SEIZURE_KEYWORDS):
                    continue

                drug = normalize_drug(article_text)
                if not drug:
                    continue

                city, state, lat, lon = extract_location(article_text, CITIES_LOOKUP)
                if not city:
                    city = "Bihar"
                    state = "Bihar"

                date_match = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', article_text)
                date = normalize_date(date_match.group(1)) if date_match else datetime.now().strftime('%Y-%m-%d')

                quantity = extract_quantity(article_text)

                seizure = {
                    'id': '',
                    'caseNo': f"BP-{city[:3].upper()}-{datetime.now().strftime('%Y')}-{(len(seizures)+100):04d}",
                    'city': city,
                    'state': state,
                    'lat': lat,
                    'lon': lon,
                    'drugType': drug,
                    'quantityKg': quantity,
                    'date': date,
                    'sourceName': 'Bihar Police',
                    'sourceUrl': link,
                    'agency': 'Bihar Police',
                    'description': article_text[:500],
                    'images': []
                }
                seizure['id'] = generate_id(seizure)
                seizures.append(seizure)

            except Exception as e:
                logger.debug(f"BP: Error processing article: {e}")
                continue

    except Exception as e:
        logger.error(f"BP: Scraping failed: {e}")

    logger.info(f"BP: Found {len(seizures)} seizures")
    return seizures


def scrape_rajasthan_police() -> List[Dict]:
    """Scrape Rajasthan Police website."""
    logger.info("Scraping Rajasthan Police...")
    seizures = []

    try:
        url = "https://police.rajasthan.gov.in"
        resp = make_request(url)
        if not resp:
            logger.warning("RP: Could not fetch page")
            return seizures

        soup = BeautifulSoup(resp.text, 'lxml')
        articles = soup.find_all('a', href=re.compile(r'news|seizure|arrest'))

        for article in articles[:20]:
            try:
                link = article.get('href', '')
                if not link.startswith('http'):
                    link = f"https://police.rajasthan.gov.in{link}"

                article_resp = make_request(link)
                if not article_resp:
                    continue

                article_soup = BeautifulSoup(article_resp.text, 'lxml')
                article_text = article_soup.get_text()

                if not any(kw in article_text.lower() for kw in SEIZURE_KEYWORDS):
                    continue

                drug = normalize_drug(article_text)
                if not drug:
                    continue

                city, state, lat, lon = extract_location(article_text, CITIES_LOOKUP)
                if not city:
                    city = "Rajasthan"
                    state = "Rajasthan"

                date_match = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', article_text)
                date = normalize_date(date_match.group(1)) if date_match else datetime.now().strftime('%Y-%m-%d')

                quantity = extract_quantity(article_text)

                seizure = {
                    'id': '',
                    'caseNo': f"RP-{city[:3].upper()}-{datetime.now().strftime('%Y')}-{(len(seizures)+100):04d}",
                    'city': city,
                    'state': state,
                    'lat': lat,
                    'lon': lon,
                    'drugType': drug,
                    'quantityKg': quantity,
                    'date': date,
                    'sourceName': 'Rajasthan Police',
                    'sourceUrl': link,
                    'agency': 'Rajasthan Police',
                    'description': article_text[:500],
                    'images': []
                }
                seizure['id'] = generate_id(seizure)
                seizures.append(seizure)

            except Exception as e:
                logger.debug(f"RP: Error processing article: {e}")
                continue

    except Exception as e:
        logger.error(f"RP: Scraping failed: {e}")

    logger.info(f"RP: Found {len(seizures)} seizures")
    return seizures


def deduplicate_seizures(seizures: List[Dict]) -> List[Dict]:
    """Remove duplicate seizures based on date, city, drug type, and quantity."""
    seen = set()
    unique = []

    for seizure in seizures:
        key = (
            seizure.get('date', ''),
            seizure.get('city', '').lower(),
            seizure.get('drugType', ''),
            seizure.get('quantityKg', 0)
        )

        # Use hash for quantity if it's a float
        if key[3] is not None:
            key = (key[0], key[1], key[2], round(key[3], 2))

        if key not in seen:
            seen.add(key)
            unique.append(seizure)

    return unique


def compute_stats(seizures: List[Dict]) -> Dict:
    """Compute statistics from seizures list."""
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

    total = len(seizures)
    total_qty = sum(s.get('quantityKg', 0) or 0 for s in seizures)

    # Count by state
    by_state = {}
    for s in seizures:
        state = s.get('state', 'Unknown')
        by_state[state] = by_state.get(state, 0) + 1

    # Count by drug type
    by_drug = {}
    for s in seizures:
        drug = s.get('drugType', 'Unknown')
        by_drug[drug] = by_drug.get(drug, 0) + 1

    # Count by month
    by_month = {}
    for s in seizures:
        date = s.get('date', '')
        if date:
            month = date[:7]  # YYYY-MM
            by_month[month] = by_month.get(month, 0) + 1

    # Raids this week
    week_ago = datetime.now() - timedelta(days=7)
    raids_week = 0
    for s in seizures:
        date_str = s.get('date', '')
        if date_str:
            try:
                date = datetime.strptime(date_str, '%Y-%m-%d')
                if date >= week_ago:
                    raids_week += 1
            except:
                pass

    # Top locations
    location_counts = {}
    for s in seizures:
        loc = f"{s.get('city', '')}, {s.get('state', '')}"
        location_counts[loc] = location_counts.get(loc, 0) + 1

    top_locs = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        'total_seizures': total,
        'total_quantity_kg': round(total_qty, 2),
        'raids_this_week': raids_week,
        'by_state': by_state,
        'by_drug_type': by_drug,
        'by_month': by_month,
        'top_locations': [{'location': loc, 'count': count} for loc, count in top_locs]
    }


def run_scraper():
    """Main scraper function."""
    logger.info("=" * 50)
    logger.info("Starting India Drug Seizure Scraper")
    logger.info("=" * 50)

    global CITIES_LOOKUP
    CITIES_LOOKUP = load_cities()

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Scrape all sources in parallel
    scrapers = [
        ('NCB', scrape_ncb),
        ('PIB', scrape_pib),
        ('TOI', scrape_times_of_india),
        ('IE', scrape_indian_express),
        ('DJ', scrape_dainik_jagran),
        ('AU', scrape_amar_ujala),
        ('PP', scrape_punjab_police),
        ('HP', scrape_haryana_police),
        ('BP', scrape_bihar_police),
        ('RP', scrape_rajasthan_police),
    ]

    all_seizures = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_source = {
            executor.submit(scraper_func): source_name
            for source_name, scraper_func in scrapers
        }

        for future in as_completed(future_to_source):
            source_name = future_to_source[future]
            try:
                seizures = future.result()
                all_seizures.extend(seizures)
                logger.info(f"{source_name}: collected {len(seizures)} seizures")
            except Exception as e:
                logger.error(f"{source_name}: failed with {e}")

    # Deduplicate
    logger.info(f"Total before deduplication: {len(all_seizures)}")
    all_seizures = deduplicate_seizures(all_seizures)
    logger.info(f"Total after deduplication: {len(all_seizures)}")

    # Compute stats
    stats = compute_stats(all_seizures)

    # Build output
    output = {
        'seizures': all_seizures,
        'stats': stats,
        'lastUpdated': datetime.now().isoformat()
    }

    # Write to file
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        logger.info(f"Successfully wrote {len(all_seizures)} seizures to {OUTPUT_FILE}")
    except Exception as e:
        logger.error(f"Failed to write output file: {e}")
        raise

    logger.info("=" * 50)
    logger.info("Scraper completed successfully")
    logger.info(f"Total seizures: {stats['total_seizures']}")
    logger.info(f"Total quantity: {stats['total_quantity_kg']} kg")
    logger.info(f"Raids this week: {stats['raids_this_week']}")
    logger.info("=" * 50)

    return output


if __name__ == '__main__':
    run_scraper()