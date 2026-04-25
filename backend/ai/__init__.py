"""
__init__.py for AI module
"""

from .ollama_client import OllamaClient, OllamaResponse, create_client, get_default_client
from .extractor import DataExtractor, SeizureData, extract_seizure_data

__all__ = [
    'OllamaClient', 'OllamaResponse', 'create_client', 'get_default_client',
    'DataExtractor', 'SeizureData', 'extract_seizure_data'
]