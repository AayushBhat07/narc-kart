"""
Main FastAPI Application for Narc Kart
India Drug Seizure Tracker - Backend API

Endpoints:
- GET /api/seizures - List seizures with filters
- GET /api/seizures/{id} - Get seizure details
- GET /api/stats - Aggregate statistics
- POST /api/refresh - Trigger scraping refresh
- GET /api/health - Health check
"""

import logging
import os
import time
from datetime import datetime, date, timedelta
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .scraper import Scraper, ScrapeConfig, create_scraper, ENABLED_SOURCES
from .scraper.article_parser import ArticleParser, parse_article
from .ai import extract_seizure_data, create_client
from .geocoder import create_geocoder, NominatimGeocoder
from .database import Database, create_database


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Pydantic models
class SeizureResponse(BaseModel):
    id: int
    location_city: Optional[str]
    location_state: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    drug_type: Optional[str]
    quantity_kg: Optional[float]
    seizure_date: Optional[str]
    source_name: Optional[str]
    article_url: Optional[str]
    agency: Optional[str]
    case_number: Optional[str]
    arrested_count: Optional[int]
    extraction_confidence: float


class SeizureDetailResponse(SeizureResponse):
    article_title: Optional[str]
    article_text: Optional[str]
    images: list[str]
    warnings: list[str]


class StatsResponse(BaseModel):
    total_seizures: int
    recent_seizures_7d: int
    by_drug_type: list[dict]
    by_state: list[dict]
    by_agency: list[dict]
    quantity_stats: dict


class RefreshResponse(BaseModel):
    status: str
    message: str
    seizures_added: int
    duration_ms: int


# Global instances
db: Optional[Database] = None
scraper: Optional[Scraper] = None
parser: Optional[ArticleParser] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    global db, scraper, parser
    
    logger.info("Starting Narc Kart API...")
    
    # Initialize database
    db_path = os.environ.get("NARC_KART_DB", None)
    db = create_database(db_path)
    logger.info(f"Database initialized: {db.db_path}")
    
    # Initialize scraper
    config = ScrapeConfig()
    scraper = create_scraper(config)
    logger.info("Scraper initialized")
    
    # Initialize parser
    parser = ArticleParser()
    logger.info("Parser initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Narc Kart API...")
    if scraper:
        scraper.close()
    if db:
        db.close()
    logger.info("Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Narc Kart API",
    description="India Drug Seizure Tracker - Backend API",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    ollama_client = create_client()
    ollama_status = ollama_client.is_available()
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "database": db is not None,
            "scraper": scraper is not None,
            "ollama": ollama_status,
        }
    }


@app.get("/api/seizures", response_model=list[SeizureResponse])
async def get_seizures(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    state: Optional[str] = None,
    drug_type: Optional[str] = None,
    agency: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    min_quantity: Optional[float] = None
):
    """
    Get seizures with optional filters.
    
    - **limit**: Maximum number of results (1-500)
    - **offset**: Pagination offset
    - **state**: Filter by Indian state
    - **drug_type**: Filter by drug type (heroin, cocaine, methamphetamine, cannabis, etc.)
    - **agency**: Filter by agency (NCB, DRI, State Police, Customs)
    - **start_date**: Filter seizures from this date
    - **end_date**: Filter seizures until this date
    - **min_quantity**: Minimum quantity in kg
    """
    if db is None:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    seizures = db.get_seizures(
        limit=limit,
        offset=offset,
        state=state,
        drug_type=drug_type,
        agency=agency,
        start_date=start_date,
        end_date=end_date,
        min_quantity_kg=min_quantity
    )
    
    return [
        SeizureResponse(
            id=s['id'],
            location_city=s['location_city'],
            location_state=s['location_state'],
            latitude=s['latitude'],
            longitude=s['longitude'],
            drug_type=s['drug_type'],
            quantity_kg=s['quantity_kg'],
            seizure_date=s['seizure_date'].isoformat() if s['seizure_date'] else None,
            source_name=s['source_name'],
            article_url=s['article_url'],
            agency=s['agency'],
            case_number=s['case_number'],
            arrested_count=s['arrested_count'],
            extraction_confidence=s['extraction_confidence']
        )
        for s in seizures
    ]


@app.get("/api/seizures/{seizure_id}", response_model=SeizureDetailResponse)
async def get_seizure(seizure_id: int):
    """Get detailed information about a specific seizure."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    seizure = db.get_seizure_by_id(seizure_id)
    if not seizure:
        raise HTTPException(status_code=404, detail="Seizure not found")
    
    # Get images
    images = db.get_seizure_images(seizure_id)
    
    # Parse warnings
    warnings = []
    if seizure.get('warnings'):
        try:
            import json
            warnings = json.loads(seizure['warnings'])
        except Exception:
            warnings = []
    
    return SeizureDetailResponse(
        id=seizure['id'],
        location_city=seizure['location_city'],
        location_state=seizure['location_state'],
        latitude=seizure['latitude'],
        longitude=seizure['longitude'],
        drug_type=seizure['drug_type'],
        quantity_kg=seizure['quantity_kg'],
        seizure_date=seizure['seizure_date'].isoformat() if seizure['seizure_date'] else None,
        source_name=seizure['source_name'],
        article_url=seizure['article_url'],
        agency=seizure['agency'],
        case_number=seizure['case_number'],
        arrested_count=seizure['arrested_count'],
        extraction_confidence=seizure['extraction_confidence'],
        article_title=seizure['article_title'],
        article_text=seizure['article_text'],
        images=[img['image_url'] for img in images],
        warnings=warnings
    )


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats():
    """Get aggregate statistics about seizures."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not initialized")
    
    stats = db.get_stats()
    
    return StatsResponse(
        total_seizures=stats['total_seizures'],
        recent_seizures_7d=stats['recent_seizures_7d'],
        by_drug_type=stats['by_drug_type'],
        by_state=stats['by_state'],
        by_agency=stats['by_agency'],
        quantity_stats=stats['quantity_stats']
    )


@app.post("/api/refresh", response_model=RefreshResponse)
async def refresh_data():
    """
    Trigger a scraping refresh to fetch new seizure data.
    
    This endpoint:
    1. Scrapes all configured news sources
    2. Extracts seizure data using AI
    3. Stores results in the database
    """
    if db is None or scraper is None or parser is None:
        raise HTTPException(status_code=503, detail="Services not initialized")
    
    start_time = time.time()
    seizures_added = 0
    
    try:
        logger.info("Starting scraping refresh...")
        
        # Scrape all sources
        results = scraper.scrape_all_sources(keyword="drug seizure")
        
        logger.info(f"Scraped {len(results)} articles")
        
        # Process each result
        for result in results:
            if result.error:
                logger.warning(f"Scraping error for {result.url}: {result.error}")
                continue
            
            try:
                # Parse article
                parsed = parser.parse(result.raw_html, result.url, result.source.name)
                
                if not parsed.article_text:
                    continue
                
                # Extract seizure data using AI
                seizure_data = extract_seizure_data(
                    article_text=parsed.article_text,
                    article_url=result.url,
                    source_name=result.source.name
                )
                
                # Set additional fields
                seizure_data.source_url = result.source.base_url
                seizure_data.article_title = result.title
                seizure_data.article_text = parsed.article_text
                seizure_data.images = parsed.images
                
                # Store in database
                seizure_id = db.insert_seizure(seizure_data)
                
                # Store images
                for img_url in parsed.images[:5]:
                    db.insert_image(seizure_id, img_url)
                
                seizures_added += 1
                
            except Exception as e:
                logger.error(f"Error processing article {result.url}: {e}")
                continue
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        logger.info(f"Refresh complete: {seizures_added} seizures added in {duration_ms}ms")
        
        return RefreshResponse(
            status="success",
            message=f"Scraped {len(results)} articles, added {seizures_added} seizures",
            seizures_added=seizures_added,
            duration_ms=duration_ms
        )
        
    except Exception as e:
        logger.error(f"Refresh failed: {e}")
        duration_ms = int((time.time() - start_time) * 1000)
        
        return RefreshResponse(
            status="error",
            message=str(e),
            seizures_added=seizures_added,
            duration_ms=duration_ms
        )


@app.get("/api/sources")
async def get_sources():
    """Get list of configured news sources."""
    return [
        {
            "name": s.name,
            "base_url": s.base_url,
            "agency_type": s.agency_type,
            "priority": s.priority,
            "enabled": s.enabled,
            "requires_js": s.requires_js,
        }
        for s in ENABLED_SOURCES
    ]


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Narc Kart API",
        "version": "1.0.0",
        "description": "India Drug Seizure Tracker Backend",
        "docs": "/docs"
    }


# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


def create_app() -> FastAPI:
    """Factory function to create FastAPI app."""
    return app


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("NARC_KART_PORT", 8000))
    host = os.environ.get("NARC_KART_HOST", "0.0.0.0")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True
    )