"""
__init__.py for scraper module
"""

from .news_sources import NewsSource, ENABLED_SOURCES, ALL_SOURCES, get_source_by_name
from .scraper import Scraper, ScrapeConfig, ScrapResult, create_scraper
from .article_parser import ArticleParser, ParsedArticle, parse_article

__all__ = [
    'NewsSource', 'ENABLED_SOURCES', 'ALL_SOURCES', 'get_source_by_name',
    'Scraper', 'ScrapeConfig', 'ScrapResult', 'create_scraper',
    'ArticleParser', 'ParsedArticle', 'parse_article'
]