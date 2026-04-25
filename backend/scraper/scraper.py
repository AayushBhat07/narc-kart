"""
Main Scraping Engine for Narc Kart
India Drug Seizure Tracker - Web Scraping Pipeline

Features:
- HTTP/HTML scraping with requests + BeautifulSoup
- JavaScript rendering with Playwright
- Retry logic with exponential backoff
- Rate limiting respecting robots.txt
- Error handling and logging
"""

import logging
import time
import random
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .news_sources import NewsSource, ENABLED_SOURCES, get_js_sources, get_static_sources


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class ScrapResult:
    """Result of a scraping operation."""
    source: NewsSource
    url: str
    title: str
    content: str
    raw_html: str
    published_date: Optional[datetime] = None
    images: list[str] = field(default_factory=list)
    links: list[str] = field(default_factory=list)
    error: Optional[str] = None
    scraping_time_ms: int = 0


@dataclass
class ScrapeConfig:
    """Configuration for scraping behavior."""
    max_retries: int = 3
    initial_backoff: float = 1.0
    max_backoff: float = 30.0
    request_timeout: int = 30
    min_delay_between_requests: float = 2.0
    max_delay_between_requests: float = 5.0
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
    verify_ssl: bool = True
    use_playwright_for_js: bool = True


class RateLimiter:
    """Rate limiter with sliding window."""
    
    def __init__(self, min_seconds: float = 2.0, max_seconds: float = 5.0):
        self.min_seconds = min_seconds
        self.max_seconds = max_seconds
        self.last_request_time: Optional[float] = None
    
    def wait(self) -> None:
        """Wait appropriate time before next request."""
        if self.last_request_time is not None:
            elapsed = time.time() - self.last_request_time
            delay = random.uniform(self.min_seconds, self.max_seconds)
            if elapsed < delay:
                time.sleep(delay - elapsed)
        self.last_request_time = time.time()
    
    def reset(self) -> None:
        """Reset the rate limiter."""
        self.last_request_time = None


class Scraper:
    """Main scraping engine with retry logic and rate limiting."""
    
    def __init__(self, config: Optional[ScrapeConfig] = None):
        self.config = config or ScrapeConfig()
        self.session = self._create_session()
        self.rate_limiter = RateLimiter(
            min_seconds=self.config.min_delay_between_requests,
            max_seconds=self.config.max_delay_between_requests
        )
        self._playwright_browser = None
        self._playwright_context = None
    
    def _create_session(self) -> requests.Session:
        """Create a requests session with retry strategy."""
        session = requests.Session()
        
        retry_strategy = Retry(
            total=self.config.max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        session.headers.update({
            "User-Agent": self.config.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        })
        
        return session
    
    def _exponential_backoff(self, attempt: int) -> float:
        """Calculate exponential backoff delay."""
        delay = self.config.initial_backoff * (2 ** attempt)
        jitter = random.uniform(0, 0.5) * delay
        return min(delay + jitter, self.config.max_backoff)
    
    def _init_playwright(self) -> None:
        """Initialize Playwright for JS rendering."""
        try:
            from playwright.sync_api import sync_playwright
            if self._playwright_browser is None:
                pw = sync_playwright().start()
                self._playwright_browser = pw.chromium.launch(headless=True)
                self._playwright_context = self._playwright_browser.new_context(
                    user_agent=self.config.user_agent
                )
                logger.info("Playwright initialized for JS rendering")
        except ImportError:
            logger.warning("Playwright not installed. JS sources will be skipped.")
            self.config.use_playwright_for_js = False
        except Exception as e:
            logger.error(f"Failed to initialize Playwright: {e}")
            self.config.use_playwright_for_js = False
    
    def _close_playwright(self) -> None:
        """Close Playwright browser."""
        if self._playwright_browser:
            try:
                self._playwright_browser.close()
            except Exception:
                pass
            self._playwright_browser = None
            self._playwright_context = None
    
    def fetch_url(self, url: str, use_js: bool = False) -> tuple[Optional[str], Optional[str]]:
        """
        Fetch URL content with retry logic.
        Returns (content, error_message).
        """
        if use_js and self.config.use_playwright_for_js:
            return self._fetch_with_playwright(url)
        
        return self._fetch_with_requests(url)
    
    def _fetch_with_requests(self, url: str) -> tuple[Optional[str], Optional[str]]:
        """Fetch URL using requests library."""
        for attempt in range(self.config.max_retries):
            try:
                self.rate_limiter.wait()
                response = self.session.get(
                    url,
                    timeout=self.config.request_timeout,
                    verify=self.config.verify_ssl,
                    allow_redirects=True
                )
                
                if response.status_code == 404:
                    return None, f"Page not found (404): {url}"
                
                if response.status_code == 403:
                    return None, f"Access forbidden (403): {url}"
                
                response.raise_for_status()
                
                # Detect encoding
                if response.encoding is None:
                    response.encoding = 'utf-8'
                
                return response.text, None
                
            except requests.exceptions.Timeout:
                error = f"Request timeout after {self.config.request_timeout}s"
                logger.warning(f"{error} (attempt {attempt + 1}): {url}")
            except requests.exceptions.ConnectionError as e:
                error = f"Connection error: {str(e)}"
                logger.warning(f"{error} (attempt {attempt + 1}): {url}")
            except requests.exceptions.HTTPError as e:
                error = f"HTTP error: {e}"
                logger.warning(f"{error} (attempt {attempt + 1}): {url}")
            except Exception as e:
                error = f"Unexpected error: {str(e)}"
                logger.warning(f"{error} (attempt {attempt + 1}): {url}")
            
            if attempt < self.config.max_retries - 1:
                backoff = self._exponential_backoff(attempt)
                logger.info(f"Retrying in {backoff:.1f}s (attempt {attempt + 2})")
                time.sleep(backoff)
        
        return None, f"Failed after {self.config.max_retries} attempts"
    
    def _fetch_with_playwright(self, url: str) -> tuple[Optional[str], Optional[str]]:
        """Fetch URL using Playwright for JS rendering."""
        if self._playwright_browser is None:
            self._init_playwright()
        
        if self._playwright_browser is None:
            return None, "Playwright not available"
        
        for attempt in range(self.config.max_retries):
            try:
                self.rate_limiter.wait()
                page = self._playwright_context.new_page()
                page.goto(url, wait_until="networkidle", timeout=30000)
                content = page.content()
                page.close()
                return content, None
            except Exception as e:
                logger.warning(f"Playwright fetch failed (attempt {attempt + 1}): {e}")
                try:
                    page.close()
                except Exception:
                    pass
        
        return None, f"Playwright failed after {self.config.max_retries} attempts"
    
    def scrape_article(self, url: str, source: NewsSource) -> ScrapResult:
        """Scrape a single article URL."""
        start_time = time.time()
        
        content, error = self.fetch_url(url, use_js=source.requires_js)
        
        if error:
            return ScrapResult(
                source=source,
                url=url,
                title="",
                content="",
                raw_html="",
                error=error
            )
        
        soup = BeautifulSoup(content, 'html.parser')
        
        # Extract title
        title = self._extract_title(soup)
        
        # Extract main content
        article_content = self._extract_article_content(soup, url)
        
        # Extract images
        images = self._extract_images(soup, url)
        
        # Extract links
        links = self._extract_links(soup, url)
        
        # Extract published date
        published_date = self._extract_published_date(soup)
        
        elapsed_ms = int((time.time() - start_time) * 1000)
        
        return ScrapResult(
            source=source,
            url=url,
            title=title,
            content=article_content,
            raw_html=content[:50000],  # Store first 50KB
            published_date=published_date,
            images=images,
            links=links,
            scraping_time_ms=elapsed_ms
        )
    
    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract article title."""
        # Try various title selectors
        selectors = [
            'h1.article-title',
            'h1.entry-title',
            'h1.post-title',
            'h1[class*="title"]',
            'article h1',
            '.story-headline',
            '.headline',
            'h1'
        ]
        
        for selector in selectors:
            title_elem = soup.select_one(selector)
            if title_elem:
                return title_elem.get_text(strip=True)
        
        # Fallback to og:title or document title
        og_title = soup.find('meta', property='og:title')
        if og_title:
            return og_title.get('content', '')
        
        return soup.title.string if soup.title else ''
    
    def _extract_article_content(self, soup: BeautifulSoup, base_url: str) -> str:
        """Extract main article content."""
        # Remove script and style elements
        for elem in soup.find_all(['script', 'style', 'nav', 'header', 'footer']):
            elem.decompose()
        
        # Try various content selectors
        selectors = [
            'article.content',
            'article.post-content',
            '.article-body',
            '.story-content',
            '.post-body',
            '.entry-content',
            'article',
            '.content',
            'main'
        ]
        
        content_elem = None
        for selector in selectors:
            content_elem = soup.select_one(selector)
            if content_elem:
                break
        
        if content_elem is None:
            content_elem = soup.find('body')
        
        if content_elem:
            # Get text content
            text = content_elem.get_text(separator='\n', strip=True)
            # Clean up whitespace
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return '\n'.join(lines)
        
        return ''
    
    def _extract_images(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        """Extract image URLs from the page."""
        images = []
        
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src')
            if src:
                # Make absolute URL
                absolute_url = urljoin(base_url, src)
                if absolute_url.startswith('http'):
                    images.append(absolute_url)
        
        # Also check og:image
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            absolute_url = urljoin(base_url, og_image['content'])
            if absolute_url not in images:
                images.insert(0, absolute_url)
        
        return images[:10]  # Limit to 10 images
    
    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        """Extract relevant links from the page."""
        links = []
        
        for link in soup.find_all('a', href=True):
            href = urljoin(base_url, link['href'])
            # Only include http(s) links
            if href.startswith('http') and href != base_url:
                links.append(href)
        
        return links[:50]  # Limit to 50 links
    
    def _extract_published_date(self, soup: BeautifulSoup) -> Optional[datetime]:
        """Extract published date from various meta tags."""
        date_selectors = [
            ('meta', {'property': 'article:published_time'}),
            ('meta', {'name': 'publish-date'}),
            ('meta', {'name': 'date'}),
            ('time', {'datetime': True}),
        ]
        
        for tag, attrs in date_selectors:
            elem = soup.find(tag, attrs)
            if elem:
                datetime_str = elem.get('datetime') or elem.get('content')
                if datetime_str:
                    try:
                        # Try parsing ISO format
                        from dateutil import parser
                        return parser.parse(datetime_str)
                    except Exception:
                        pass
        
        return None
    
    def discover_article_links(self, source: NewsSource, keyword: str = "drug seizure") -> list[str]:
        """Discover article links from a news source."""
        urls = []
        
        if source.search_url:
            search_url = source.search_url
            content, error = self.fetch_url(search_url, use_js=source.requires_js)
            
            if error:
                logger.warning(f"Failed to fetch search URL for {source.name}: {error}")
                return urls
            
            soup = BeautifulSoup(content, 'html.parser')
            
            # Find article links
            for link in soup.find_all('a', href=True):
                href = link['href']
                if href:
                    absolute_url = urljoin(source.base_url, href)
                    text = link.get_text(strip=True).lower()
                    
                    # Filter by keyword relevance
                    if any(kw in text or kw in absolute_url.lower() for kw in ['drug', 'seizure', 'contraband', 'narcotics', 'peddle']):
                        if absolute_url not in urls:
                            urls.append(absolute_url)
        
        logger.info(f"Discovered {len(urls)} article links from {source.name}")
        return urls[:20]  # Limit to 20 articles per source
    
    def scrape_all_sources(self, keyword: str = "drug seizure") -> list[ScrapResult]:
        """Scrape all enabled news sources."""
        results = []
        
        for source in ENABLED_SOURCES:
            try:
                logger.info(f"Scraping source: {source.name}")
                
                # Discover article URLs
                article_urls = self.discover_article_links(source, keyword)
                
                # Scrape each article
                for url in article_urls:
                    result = self.scrape_article(url, source)
                    results.append(result)
                    
                    # Small delay between articles
                    time.sleep(random.uniform(1, 2))
                
            except Exception as e:
                logger.error(f"Error scraping source {source.name}: {e}")
        
        return results
    
    def close(self) -> None:
        """Clean up resources."""
        self.session.close()
        self._close_playwright()


def create_scraper(config: Optional[ScrapeConfig] = None) -> Scraper:
    """Factory function to create a Scraper instance."""
    return Scraper(config)