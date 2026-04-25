"""
Article Parser for Narc Kart
India Drug Seizure Tracker - Extract structured data from articles

Handles:
- Date parsing and normalization
- Location extraction
- Drug type classification
- Quantity parsing with unit conversion
- Image extraction and downloading
"""

import re
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup


logger = logging.getLogger(__name__)


@dataclass
class ParsedArticle:
    """Structured data extracted from an article."""
    # Source info
    source_name: str
    source_url: str
    article_url: str
    article_title: str
    published_date: Optional[datetime] = None
    
    # Location
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_country: str = "India"
    
    # Seizure details
    drug_type: Optional[str] = None
    drug_type_confidence: float = 0.0
    quantity_kg: Optional[float] = None
    quantity_raw: Optional[str] = None
    seizure_value_rs: Optional[int] = None  # Value in INR
    
    # Case info
    case_number: Optional[str] = None
    agency: Optional[str] = None
    arrested_count: Optional[int] = None
    
    # Media
    images: list[str] = field(default_factory=list)
    article_text: str = ""
    
    # Metadata
    raw_content: str = ""
    extraction_confidence: float = 0.0
    extraction_notes: list[str] = field(default_factory=list)


# Indian states for normalization
INDIAN_STATES = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
    "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka",
    "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram",
    "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana",
    "tripura", "uttar pradesh", "uttarakhand", "west bengal",
    "delhi", "chandigarh", "jammu and kashmir", "ladakh",
    "andaman and nicobar islands", "dadra and nagar haveli", "daman and diu",
    "lakshadweep", "puducherry"
]

STATE_ABBREV = {
    "ap": "andhra pradesh", "ts": "telangana", "tn": "tamil nadu",
    "up": "uttar pradesh", "mp": "madhya pradesh", "wb": "west bengal",
    "dl": "delhi", "dlhi": "delhi", "mh": "maharashtra", "ka": "karnataka",
    "gj": "gujarat", "rj": "rajasthan", "pb": "punjab", "hr": "haryana"
}

# Drug type patterns
DRUG_PATTERNS = {
    "heroin": [
        r'\bheroin\b', r'\bbrown sugar\b', r'\bchina white\b', r'\bsmack\b',
        r'\bdiamorphine\b', r'\bdiacetylmorphine\b'
    ],
    "cocaine": [
        r'\bcocaine\b', r'\bcrack\b', r'\bcoca\b', r'\bcrack cocaine\b'
    ],
    "methamphetamine": [
        r'\bmeth\b', r'\bice\b', r'\bshikhar\b', r'\bmethamphetamine\b',
        r'\bshubham\b', r'\bphantom\b', r'\bcrystal meth\b'
    ],
    "cannabis": [
        r'\bganja\b', r'\bcharas\b', r'\bmarijuana\b', r'\bcannabis\b',
        r'\bbhang\b', r'\bhemp\b', r'\bweed\b'
    ],
    "methaqualone": [
        r'\bmandrax\b', r'\bmethaqualone\b', r'\nippf\b'
    ],
    "morphine": [
        r'\bmorphine\b', r'\bopium\b', r'\bpoppy\b', r'\blal doda\b'
    ],
    "mdma": [
        r'\bmdma\b', r'\becstasy\b', r'\bpills\b'
    ],
    "buprenorphine": [
        r'\bbuprenorphine\b', r'\bbupe\b', r'\bsubutex\b'
    ],
    " Poppy Seed": [
        r'\bpoppy seed\b', r'\bpostaa?\b'
    ]
}

# Quantity patterns
QUANTITY_PATTERNS = [
    r'(\d+(?:\.\d+)?)\s*(kg|kilograms?)\b',
    r'(\d+(?:\.\d+)?)\s*(g|grams?)\b',
    r'(\d+(?:\.\d+)?)\s*(mg|milligrams?)\b',
    r'(\d+(?:\.\d+)?)\s*(quintal|quintals?)\b',
    r'(\d+(?:\.\d+)?)\s*(tonne|ton|tons)\b',
    r'(\d+(?:\.\d+)?)\s*(pieces?|tablets?|capsules?|strips?)\b',
    r'(\d+(?:\.\d+)?)\s*(bags?|packets?|kil bundles?)\b',
    r'(\d+)\s*(kg)',
    r'(\d+)\s*(gram)',
]

# Location patterns
LOCATION_PATTERNS = [
    r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,\s*({})\b'.format('|'.join(INDIAN_STATES)),
    r'\b([A-Z][a-z]+)\s*,\s*({})\b'.format('|'.join(INDIAN_STATES)),
    r'\b(Delhi|New Mumbai|Thane|Navi Mumbai|Pune|Mumbai|Bengaluru|Chennai|Kolkata|Hyderabad|Ahmedabad)\b',
]


class ArticleParser:
    """Parse raw article content into structured data."""
    
    def __init__(self):
        self.drug_patterns = {
            drug: [re.compile(p, re.IGNORECASE) for p in patterns]
            for drug, patterns in DRUG_PATTERNS.items()
        }
        self.quantity_patterns = [re.compile(p, re.IGNORECASE) for p in QUANTITY_PATTERNS]
        self.location_patterns = [re.compile(p, re.IGNORECASE) for p in LOCATION_PATTERNS]
    
    def parse(self, raw_html: str, article_url: str, source_name: str) -> ParsedArticle:
        """Parse raw HTML content into structured article data."""
        soup = BeautifulSoup(raw_html, 'html.parser')
        
        # Extract basic info
        title = self._extract_title(soup)
        content = self._extract_content(soup)
        date = self._extract_date(soup)
        images = self._extract_images(soup, article_url)
        
        # Create base article
        article = ParsedArticle(
            source_name=source_name,
            source_url="",
            article_url=article_url,
            article_title=title,
            published_date=date,
            images=images,
            article_text=content[:5000],
            raw_content=content
        )
        
        # Extract seizure-specific data
        article = self._extract_drug_info(article)
        article = self._extract_location(article)
        article = self._extract_case_info(article)
        
        return article
    
    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract article title."""
        # Try og:title first
        og_title = soup.find('meta', property='og:title')
        if og_title:
            return og_title.get('content', '').strip()
        
        # Try h1
        h1 = soup.find('h1')
        if h1:
            return h1.get_text(strip=True)
        
        # Fallback to title tag
        title_tag = soup.find('title')
        return title_tag.get_text(strip=True) if title_tag else ''
    
    def _extract_content(self, soup: BeautifulSoup) -> str:
        """Extract article body text."""
        # Remove unwanted elements
        for elem in soup.find_all(['script', 'style', 'nav', 'aside', 'iframe']):
            elem.decompose()
        
        # Find article body
        article_elem = soup.find('article') or soup.find('div', class_=re.compile(r'article|content|story', re.I))
        
        if article_elem:
            text = article_elem.get_text(separator='\n', strip=True)
        else:
            # Fallback to body
            body = soup.find('body')
            text = body.get_text(separator='\n', strip=True) if body else ''
        
        # Clean up
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '\n'.join(lines)
    
    def _extract_date(self, soup: BeautifulSoup) -> Optional[datetime]:
        """Extract published date."""
        # Try meta tags
        date_meta = (
            soup.find('meta', property='article:published_time') or
            soup.find('meta', attrs={'name': 'publish-date'}) or
            soup.find('meta', attrs={'name': 'date'}) or
            soup.find('meta', attrs={'itemprop': 'datePublished'})
        )
        
        if date_meta:
            date_str = date_meta.get('content') or date_meta.get('datetime')
            if date_str:
                try:
                    from dateutil import parser
                    return parser.parse(date_str)
                except Exception:
                    pass
        
        # Try time tag
        time_tag = soup.find('time')
        if time_tag:
            date_str = time_tag.get('datetime')
            if date_str:
                try:
                    from dateutil import parser
                    return parser.parse(date_str)
                except Exception:
                    pass
        
        return None
    
    def _extract_images(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        """Extract article images."""
        images = []
        
        # Find og:image
        og_img = soup.find('meta', property='og:image')
        if og_img and og_img.get('content'):
            images.append(urljoin(base_url, og_img['content']))
        
        # Find article images
        article = soup.find('article')
        if article:
            for img in article.find_all('img'):
                src = img.get('src') or img.get('data-src')
                if src:
                    absolute = urljoin(base_url, src)
                    if absolute not in images:
                        images.append(absolute)
        
        return images[:10]
    
    def _extract_drug_info(self, article: ParsedArticle) -> ParsedArticle:
        """Extract drug type and quantity from article text."""
        text = article.article_text.lower()
        
        # Detect drug type
        for drug, patterns in self.drug_patterns.items():
            for pattern in patterns:
                if pattern.search(text):
                    article.drug_type = drug
                    article.drug_type_confidence = 0.8
                    break
            if article.drug_type:
                break
        
        if not article.drug_type:
            # Check for generic "drug" mentions
            if any(word in text for word in ['drug', 'narcotic', 'contraband', 'illicit']):
                article.drug_type = "unknown"
                article.drug_type_confidence = 0.3
        
        # Extract quantity
        for pattern in self.quantity_patterns:
            match = pattern.search(article.article_text)
            if match:
                article.quantity_raw = match.group(0)
                # Convert to kg
                try:
                    value = float(match.group(1))
                    unit = match.group(2).lower()
                    
                    if 'kg' in unit or 'kilogram' in unit:
                        article.quantity_kg = value
                    elif 'g' in unit and 'kg' not in unit:
                        article.quantity_kg = value / 1000
                    elif 'mg' in unit:
                        article.quantity_kg = value / 1_000_000
                    elif 'quintal' in unit:
                        article.quantity_kg = value * 100
                    elif 'ton' in unit:
                        article.quantity_kg = value * 1000
                    
                    if article.quantity_kg:
                        article.extraction_notes.append(f"Extracted quantity: {article.quantity_kg} kg")
                        
                except (ValueError, IndexError) as e:
                    logger.debug(f"Failed to parse quantity: {e}")
        
        return article
    
    def _extract_location(self, article: ParsedArticle) -> ParsedArticle:
        """Extract location (city, state) from article text."""
        text = article.article_text
        
        # Look for state mentions
        found_state = None
        for state in INDIAN_STATES:
            if state.lower() in text.lower():
                found_state = state
                break
        
        if found_state:
            article.location_state = found_state
        
        # Try to find city before state mention
        city_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,?\s*{}'.format(
            found_state or 'India'
        )
        city_match = re.search(city_pattern, text)
        if city_match:
            article.location_city = city_match.group(1)
        
        # Common city extraction
        if not article.location_city:
            cities = [
                'Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Chennai', 'Kolkata',
                'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Kanpur',
                'Nagpur', 'Surat', 'Indore', 'Thane', 'Navi Mumbai', 'New Mumbai',
                'Goa', 'Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'
            ]
            for city in cities:
                if city.lower() in text.lower():
                    article.location_city = city
                    break
        
        if not article.location_state and article.location_city:
            # Try to infer state from city
            city_state_map = {
                'mumbai': 'maharashtra', 'navi mumbai': 'maharashtra', 'new mumbai': 'maharashtra',
                'pune': 'maharashtra', 'nagpur': 'maharashtra', 'thane': 'maharashtra',
                'delhi': 'delhi', 'new delhi': 'delhi',
                'bangalore': 'karnataka', 'bengaluru': 'karnataka',
                'chennai': 'tamil nadu', 'coimbatore': 'tamil nadu',
                'kolkata': 'west bengal', 'howrah': 'west bengal',
                'hyderabad': 'telangana', 'secunderabad': 'telangana',
                'ahmedabad': 'gujarat', 'surat': 'gujarat', 'vadodara': 'gujarat',
                'jaipur': 'rajasthan', 'jodhpur': 'rajasthan',
                'lucknow': 'uttar pradesh', 'kanpur': 'uttar pradesh', 'agra': 'uttar pradesh'
            }
            if article.location_city.lower() in city_state_map:
                article.location_state = city_state_map[article.location_city.lower()]
        
        return article
    
    def _extract_case_info(self, article: ParsedArticle) -> ParsedArticle:
        """Extract case number, agency, and arrested count."""
        text = article.article_text
        
        # Case number patterns
        case_patterns = [
            r'(?:Case\s*(?:No\.?|Number|#)|FIR\s*(?:No\.?|Number)?)\s*:?\s*([A-Z0-9/-]+)',
            r'(?:CRLP|CRI|CR)\s*(?:No\.?)?\s*(\d+/\d+)',
            r'(?:Ref?\.?|Reference)\s*:?\s*([A-Z0-9/-]+)',
        ]
        
        for pattern in case_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                article.case_number = match.group(1)
                break
        
        # Agency detection
        agency_keywords = {
            'NCB': ['narcotics control bureau', 'ncb'],
            'DRI': ['directorate of revenue intelligence', 'dri'],
            'Customs': ['customs', 'cbic'],
            'State Police': ['state police', 'police'],
            'ATS': ['anti-terrorist squad', 'ats'],
            'ED': ['enforcement directorate', 'ed'],
            'CBI': ['central bureau of investigation', 'cbi'],
        }
        
        text_lower = text.lower()
        for agency, keywords in agency_keywords.items():
            if any(kw in text_lower for kw in keywords):
                if agency == 'State Police' and article.agency:
                    continue
                article.agency = agency
                break
        
        # Arrested count
        arrested_patterns = [
            r'(\d+)\s*(?:person|people|accused|suspect|arrested|captured)',
            r'arrested\s*(\d+)',
            r'(\d+)\s*arrested',
        ]
        
        for pattern in arrested_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    article.arrested_count = int(match.group(1))
                    break
                except ValueError:
                    pass
        
        return article


def parse_article(raw_html: str, article_url: str, source_name: str) -> ParsedArticle:
    """Convenience function to parse an article."""
    parser = ArticleParser()
    return parser.parse(raw_html, article_url, source_name)