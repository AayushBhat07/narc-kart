"""
SQLAlchemy models for Narc Kart database.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Float, DateTime, Text, Integer, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


class Seizure(Base):
    """
    Seizure record - represents a single drug seizure incident.
    """
    __tablename__ = "seizures"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    case_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Location
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=True)
    lon: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Drug details
    drug_type: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Metadata
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source_name: Mapped[str] = mapped_column(String(200), nullable=True)
    source_url: Mapped[str] = mapped_column(String(500), nullable=True)
    agency: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    images: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self) -> dict:
        """Convert model to dictionary."""
        return {
            "id": self.id,
            "case_no": self.case_no,
            "city": self.city,
            "state": self.state,
            "lat": self.lat,
            "lon": self.lon,
            "drug_type": self.drug_type,
            "quantity_kg": self.quantity_kg,
            "date": self.date.isoformat() if self.date else None,
            "source_name": self.source_name,
            "source_url": self.source_url,
            "agency": self.agency,
            "description": self.description,
            "images": self.images,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ScrapeMetadata(Base):
    """
    Tracks scraping run metadata.
    """
    __tablename__ = "scrape_metadata"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    new_seizures: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50), default="running")  # running, completed, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def to_dict(self) -> dict:
        """Convert model to dictionary."""
        return {
            "id": self.id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "new_seizures": self.new_seizures,
            "status": self.status,
            "error_message": self.error_message,
        }