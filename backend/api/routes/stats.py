"""
Statistics API route.
GET /api/stats - Aggregated stats for dashboard
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db, get_statistics
from ..models import StatsResponse

router = APIRouter(prefix="/api/stats", tags=["Statistics"])


@router.get("", response_model=StatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve aggregated statistics about drug seizures.

    Returns:
    - **total_seizures**: Total count of all recorded seizures
    - **total_quantity_kg**: Sum of all seized quantities in kilograms
    - **by_state**: Breakdown of seizure counts per Indian state
    - **by_drug_type**: Breakdown of seizure counts per drug type
    - **by_month**: Monthly seizure counts for the current year
    - **top_locations**: Top 10 locations by total seizure weight
    """
    stats = await get_statistics(db)
    return stats