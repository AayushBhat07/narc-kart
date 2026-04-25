"""
Pydantic models for Narc Kart API.
Request/Response schemas for FastAPI.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ─── Seizure Schemas ────────────────────────────────────────

class SeizureBase(BaseModel):
    """Base seizure fields."""
    id: str
    case_no: Optional[str] = None
    city: str
    state: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    drug_type: str
    quantity_kg: float
    date: datetime
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    agency: Optional[str] = None
    description: Optional[str] = None
    images: Optional[str] = None  # JSON string


class SeizureResponse(SeizureBase):
    """Full seizure response with all fields."""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SeizureListResponse(BaseModel):
    """Paginated list of seizures."""
    total: int = Field(description="Total number of seizures matching filters")
    seizures: List[SeizureResponse] = Field(default_factory=list)
    filters_applied: Dict[str, Any] = Field(default_factory=dict)
    limit: int
    offset: int


# ─── Stats Schemas ─────────────────────────────────────────

class StatsResponse(BaseModel):
    """Aggregated statistics response."""
    total_seizures: int = Field(description="Total number of seizures in database")
    total_quantity_kg: float = Field(description="Sum of all seized quantities in kg")
    raids_this_week: int = Field(description="Number of raids/seizures in the past 7 days")
    by_state: Dict[str, int] = Field(default_factory=dict, description="Seizure count per state")
    by_drug_type: Dict[str, int] = Field(default_factory=dict, description="Seizure count per drug type")
    by_month: Dict[str, int] = Field(default_factory=dict, description="Seizure count per month (YYYY-MM)")
    top_locations: List[Dict[str, Any]] = Field(default_factory=list)


# ─── Map Data Schemas ───────────────────────────────────────

class MapMarker(BaseModel):
    """Single map marker."""
    id: str
    lat: float
    lon: float
    severity: str = Field(description="minor | medium | major")
    drug_type: str
    city: str
    state: str
    quantity_kg: float
    date: Optional[str] = None


class MapBounds(BaseModel):
    """Geographic bounds of all markers."""
    min_lat: Optional[float] = None
    max_lat: Optional[float] = None
    min_lon: Optional[float] = None
    max_lon: Optional[float] = None


class MapDataResponse(BaseModel):
    """Map markers and bounds response."""
    markers: List[MapMarker] = Field(default_factory=list)
    bounds: MapBounds = Field(default_factory=dict)


# ─── Refresh Schemas ────────────────────────────────────────

class RefreshResponse(BaseModel):
    """Response for manual scrape trigger."""
    status: str = Field(description="Status of the scrape operation")
    message: str = Field(description="Human-readable status message")
    new_seizures: int = Field(default=0, description="Number of new seizures added")
    scrape_id: Optional[int] = None


# ─── Health Schemas ─────────────────────────────────────────

class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    version: str
    database: str = "connected"
    timestamp: datetime