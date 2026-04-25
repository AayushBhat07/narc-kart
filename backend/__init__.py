"""
Narc Kart Backend Package
India Drug Seizure Tracker - Backend Module
"""

from .scraper import Scraper, ScrapeConfig, create_scraper
from .ai import OllamaClient, DataExtractor, SeizureData
from .geocoder import NominatimGeocoder, create_geocoder

__version__ = "1.0.0"
__all__ = [
    'Scraper', 'ScrapeConfig', 'create_scraper',
    'OllamaClient', 'DataExtractor', 'SeizureData',
    'NominatimGeocoder', 'create_geocoder',
]