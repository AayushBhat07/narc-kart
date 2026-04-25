"""
Database for Narc Kart
India Drug Seizure Tracker - SQLite Storage

Schema:
- seizures: Main seizure records
- sources: News sources metadata
- images: Seizure-related images
- scrape_logs: Scraping operation logs
"""

import json
import logging
import sqlite3
from datetime import datetime, date
from pathlib import Path
from typing import Optional, Any, Generator
from contextlib import contextmanager

from .ai.extractor import SeizureData
from .geocoder import NominatimGeocoder, get_fallback_coordinates


logger = logging.getLogger(__name__)


class Database:
    """SQLite database for Narc Kart."""
    
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            db_path = Path.home() / ".narc-kart" / "narc-kart.db"
        
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        self._connection: Optional[sqlite3.Connection] = None
        self.geocoder = NominatimGeocoder()
        
        self._init_db()
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get or create database connection."""
        if self._connection is None:
            self._connection = sqlite3.connect(str(self.db_path))
            self._connection.row_factory = sqlite3.Row
        return self._connection
    
    @contextmanager
    def _cursor(self):
        """Context manager for database cursor."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
    
    def _init_db(self) -> None:
        """Initialize database schema."""
        with self._cursor() as cursor:
            # Sources table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sources (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    base_url TEXT,
                    agency_type TEXT,
                    priority INTEGER DEFAULT 1,
                    enabled INTEGER DEFAULT 1,
                    last_scraped TIMESTAMP,
                    articles_found INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Seizures table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS seizures (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    
                    -- Location
                    location_city TEXT,
                    location_state TEXT,
                    location_country TEXT DEFAULT 'India',
                    latitude REAL,
                    longitude REAL,
                    
                    -- Drug info
                    drug_type TEXT,
                    drug_type_confidence REAL DEFAULT 0,
                    quantity_kg REAL,
                    quantity_raw TEXT,
                    street_value_rs INTEGER,
                    
                    -- Temporal
                    seizure_date DATE,
                    article_date DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    -- Source
                    source_id INTEGER REFERENCES sources(id),
                    source_name TEXT,
                    source_url TEXT,
                    article_url TEXT UNIQUE,
                    article_title TEXT,
                    article_text TEXT,
                    
                    -- Agency & Case
                    agency TEXT,
                    case_number TEXT,
                    arrested_count INTEGER,
                    
                    -- Quality
                    extraction_confidence REAL DEFAULT 0,
                    extraction_method TEXT DEFAULT 'regex',
                    warnings TEXT,
                    
                    -- Status
                    is_active INTEGER DEFAULT 1,
                    is_verified INTEGER DEFAULT 0
                )
            """)
            
            # Images table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS images (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    seizure_id INTEGER REFERENCES seizures(id) ON DELETE CASCADE,
                    image_url TEXT NOT NULL,
                    image_type TEXT,  -- 'seizure', 'suspect', 'location'
                    local_path TEXT,
                    downloaded_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Scrape logs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS scrape_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id INTEGER REFERENCES sources(id),
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    articles_found INTEGER DEFAULT 0,
                    articles_processed INTEGER DEFAULT 0,
                    errors TEXT,
                    status TEXT DEFAULT 'started'  -- started, completed, failed
                )
            """)
            
            # Create indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_seizures_date ON seizures(seizure_date)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_seizures_state ON seizures(location_state)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_seizures_drug_type ON seizures(drug_type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_seizures_latlon ON seizures(latitude, longitude)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_seizures_agency ON seizures(agency)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_images_seizure ON images(seizure_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scrape_logs_source ON scrape_logs(source_id)")
            
            logger.info("Database initialized successfully")
    
    def insert_seizure(self, seizure: SeizureData) -> int:
        """
        Insert a seizure record from SeizureData.
        
        Returns the inserted row ID.
        """
        # Geocode location if not already set
        if seizure.latitude is None or seizure.longitude is None:
            if seizure.location_city or seizure.location_state:
                location = self.geocoder.geocode(
                    city=seizure.location_city,
                    state=seizure.location_state
                )
                if location:
                    seizure.latitude = location.latitude
                    seizure.longitude = location.longitude
                else:
                    # Try fallback
                    coords = get_fallback_coordinates(
                        seizure.location_city,
                        seizure.location_state
                    )
                    if coords:
                        seizure.latitude, seizure.longitude = coords
        
        # Get or create source
        source_id = self._get_or_create_source(seizure.source_name, seizure.source_url)
        
        with self._cursor() as cursor:
            cursor.execute("""
                INSERT INTO seizures (
                    location_city, location_state, location_country,
                    latitude, longitude,
                    drug_type, drug_type_confidence, quantity_kg, quantity_raw,
                    street_value_rs,
                    seizure_date, article_date,
                    source_id, source_name, source_url, article_url, article_title, article_text,
                    agency, case_number, arrested_count,
                    extraction_confidence, extraction_method, warnings,
                    is_active, is_verified
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
            """, (
                seizure.location_city,
                seizure.location_state,
                seizure.location_country,
                seizure.latitude,
                seizure.longitude,
                seizure.drug_type,
                seizure.drug_type_confidence,
                seizure.quantity_kg,
                seizure.quantity_raw,
                seizure.street_value_rs,
                seizure.seizure_date.date() if seizure.seizure_date else None,
                seizure.article_date.date() if seizure.article_date else None,
                source_id,
                seizure.source_name,
                seizure.source_url,
                seizure.article_url,
                seizure.article_title,
                seizure.article_text[:5000] if seizure.article_text else None,
                seizure.agency,
                seizure.case_number,
                seizure.arrested_count,
                seizure.extraction_confidence,
                seizure.extraction_method,
                json.dumps(seizure.warnings) if seizure.warnings else None
            ))
            
            return cursor.lastrowid
    
    def insert_image(
        self,
        seizure_id: int,
        image_url: str,
        image_type: str = "seizure"
    ) -> int:
        """Insert an image record."""
        with self._cursor() as cursor:
            cursor.execute("""
                INSERT INTO images (seizure_id, image_url, image_type)
                VALUES (?, ?, ?)
            """, (seizure_id, image_url, image_type))
            return cursor.lastrowid
    
    def _get_or_create_source(self, name: str, base_url: str = "") -> int:
        """Get or create a source record."""
        with self._cursor() as cursor:
            cursor.execute(
                "SELECT id FROM sources WHERE name = ?",
                (name,)
            )
            row = cursor.fetchone()
            
            if row:
                return row['id']
            
            cursor.execute("""
                INSERT INTO sources (name, base_url)
                VALUES (?, ?)
            """, (name, base_url))
            return cursor.lastrowid
    
    def get_seizures(
        self,
        limit: int = 100,
        offset: int = 0,
        state: Optional[str] = None,
        drug_type: Optional[str] = None,
        agency: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        min_quantity_kg: Optional[float] = None,
        is_active: bool = True
    ) -> list[dict]:
        """Query seizures with filters."""
        query = "SELECT * FROM seizures WHERE 1=1"
        params = []
        
        if state:
            query += " AND location_state = ?"
            params.append(state)
        
        if drug_type:
            query += " AND drug_type = ?"
            params.append(drug_type)
        
        if agency:
            query += " AND agency = ?"
            params.append(agency)
        
        if start_date:
            query += " AND seizure_date >= ?"
            params.append(start_date.isoformat())
        
        if end_date:
            query += " AND seizure_date <= ?"
            params.append(end_date.isoformat())
        
        if min_quantity_kg is not None:
            query += " AND quantity_kg >= ?"
            params.append(min_quantity_kg)
        
        if is_active:
            query += " AND is_active = 1"
        
        query += " ORDER BY seizure_date DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        with self._cursor() as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    
    def get_seizure_by_id(self, seizure_id: int) -> Optional[dict]:
        """Get a single seizure by ID."""
        with self._cursor() as cursor:
            cursor.execute("SELECT * FROM seizures WHERE id = ?", (seizure_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_seizure_images(self, seizure_id: int) -> list[dict]:
        """Get images for a seizure."""
        with self._cursor() as cursor:
            cursor.execute(
                "SELECT * FROM images WHERE seizure_id = ?",
                (seizure_id,)
            )
            return [dict(row) for row in cursor.fetchall()]
    
    def get_stats(self) -> dict:
        """Get aggregate statistics."""
        with self._cursor() as cursor:
            # Total seizures
            cursor.execute("SELECT COUNT(*) as total FROM seizures WHERE is_active = 1")
            total = cursor.fetchone()['total']
            
            # By drug type
            cursor.execute("""
                SELECT drug_type, COUNT(*) as count, SUM(quantity_kg) as total_kg
                FROM seizures WHERE is_active = 1 AND drug_type IS NOT NULL
                GROUP BY drug_type ORDER BY count DESC
            """)
            by_drug = [dict(row) for row in cursor.fetchall()]
            
            # By state
            cursor.execute("""
                SELECT location_state, COUNT(*) as count, SUM(quantity_kg) as total_kg
                FROM seizures WHERE is_active = 1 AND location_state IS NOT NULL
                GROUP BY location_state ORDER BY count DESC
            """)
            by_state = [dict(row) for row in cursor.fetchall()]
            
            # By agency
            cursor.execute("""
                SELECT agency, COUNT(*) as count
                FROM seizures WHERE is_active = 1 AND agency IS NOT NULL
                GROUP BY agency ORDER BY count DESC
            """)
            by_agency = [dict(row) for row in cursor.fetchall()]
            
            # Total quantity by drug
            cursor.execute("""
                SELECT 
                    SUM(quantity_kg) as total_kg,
                    AVG(quantity_kg) as avg_kg,
                    MAX(quantity_kg) as max_kg
                FROM seizures WHERE is_active = 1 AND quantity_kg IS NOT NULL
            """)
            quantity_stats = dict(cursor.fetchone())
            
            # Recent seizures
            cursor.execute("""
                SELECT COUNT(*) as recent
                FROM seizures
                WHERE is_active = 1 
                AND seizure_date >= date('now', '-7 days')
            """)
            recent = cursor.fetchone()['recent']
            
            return {
                "total_seizures": total,
                "recent_seizures_7d": recent,
                "by_drug_type": by_drug,
                "by_state": by_state,
                "by_agency": by_agency,
                "quantity_stats": quantity_stats,
            }
    
    def log_scrape(
        self,
        source_id: int,
        status: str = "started",
        articles_found: int = 0,
        articles_processed: int = 0,
        errors: Optional[str] = None
    ) -> int:
        """Log a scraping operation."""
        with self._cursor() as cursor:
            now = datetime.now()
            
            if status == "started":
                cursor.execute("""
                    INSERT INTO scrape_logs (source_id, started_at, status)
                    VALUES (?, ?, 'started')
                """, (source_id, now))
                return cursor.lastrowid
            else:
                cursor.execute("""
                    UPDATE scrape_logs 
                    SET completed_at = ?, articles_found = ?, 
                        articles_processed = ?, errors = ?, status = ?
                    WHERE source_id = ? AND status = 'started'
                """, (now, articles_found, articles_processed, errors, status, source_id))
                return source_id
    
    def delete_seizure(self, seizure_id: int) -> bool:
        """Soft delete a seizure (set is_active = 0)."""
        with self._cursor() as cursor:
            cursor.execute(
                "UPDATE seizures SET is_active = 0 WHERE id = ?",
                (seizure_id,)
            )
            return cursor.rowcount > 0
    
    def close(self) -> None:
        """Close database connection."""
        if self._connection:
            self._connection.close()
            self._connection = None
        self.geocoder.close()


def create_database(db_path: Optional[str] = None) -> Database:
    """Factory function to create database."""
    return Database(db_path=db_path)