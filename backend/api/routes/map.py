"""
Map data API route.
GET /api/map-data - Markers and bounds for Leaflet map
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db, get_map_data
from ..models import MapDataResponse

router = APIRouter(prefix="/api/map-data", tags=["Map"])


@router.get("", response_model=MapDataResponse)
async def get_map_data_endpoint(
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve map marker data for rendering on the India map.

    Returns:
    - **markers**: List of seizure markers with lat/lon and severity
    - **bounds**: Geographic bounding box of all markers
    """
    data = await get_map_data(db)
    return data