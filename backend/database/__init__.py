"""
Database layer for Narc Kart.
Handles SQLite connection, models, and queries.
"""

from .connection import engine, get_db, DATABASE_PATH, init_db, close_db
from .models import Base, Seizure, ScrapeMetadata
from .queries import (
    get_all_seizures,
    get_seizure_by_id,
    get_seizures_filtered,
    get_statistics,
    get_map_data,
    upsert_seizure,
    get_last_scrape_timestamp,
    create_scrape_run,
    complete_scrape_run,
)

__all__ = [
    "engine",
    "get_db",
    "DATABASE_PATH",
    "init_db",
    "close_db",
    "Base",
    "Seizure",
    "ScrapeMetadata",
    "get_all_seizures",
    "get_seizure_by_id",
    "get_seizures_filtered",
    "get_statistics",
    "get_map_data",
    "upsert_seizure",
    "get_last_scrape_timestamp",
    "create_scrape_run",
    "complete_scrape_run",
]