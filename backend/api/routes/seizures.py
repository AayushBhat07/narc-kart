"""
Seizures API routes.
GET /api/seizures - List seizures with filters
GET /api/seizures/{id} - Get single seizure by ID
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db, get_seizures_filtered, get_seizure_by_id
from ..models import SeizureListResponse, SeizureResponse

router = APIRouter(prefix="/api/seizures", tags=["Seizures"])


@router.get("", response_model=SeizureListResponse)
async def list_seizures(
    state: Optional[str] = Query(None, description="Filter by state name (partial match)"),
    drug_type: Optional[str] = Query(None, description="Filter by drug type (partial match)"),
    min_date: Optional[datetime] = Query(None, description="Filter seizures from this date"),
    max_date: Optional[datetime] = Query(None, description="Filter seizures until this date"),
    min_quantity: Optional[float] = Query(None, ge=0, description="Minimum quantity in kg"),
    limit: int = Query(100, ge=1, le=1000, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve seizures with optional filtering.

    - **state**: Filter by Indian state name (case-insensitive partial match)
    - **drug_type**: Filter by drug type (e.g., heroin, cocaine, meth)
    - **min_date**: Include seizures from this date (ISO format)
    - **max_date**: Include seizures until this date (ISO format)
    - **min_quantity**: Minimum seizure quantity in kilograms
    - **limit**: Max results per page (1-1000, default 100)
    - **offset**: Skip first N results for pagination
    """
    seizures, total, filters_applied = await get_seizures_filtered(
        db=db,
        state=state,
        drug_type=drug_type,
        min_date=min_date,
        max_date=max_date,
        min_quantity=min_quantity,
        limit=limit,
        offset=offset,
    )

    return SeizureListResponse(
        total=total,
        seizures=seizures,
        filters_applied=filters_applied,
        limit=limit,
        offset=offset,
    )


@router.get("/{seizure_id}", response_model=SeizureResponse)
async def get_seizure(
    seizure_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve a single seizure by its unique ID.

    Returns 404 if no seizure with the given ID exists.
    """
    seizure = await get_seizure_by_id(db, seizure_id)

    if seizure is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "SEIZURE_NOT_FOUND",
                "message": f"No seizure found with ID: {seizure_id}",
                "seizure_id": seizure_id,
            }
        )

    return seizure