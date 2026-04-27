"""
Security Fix: SQL Injection Prevention in Database Queries
Fix for: CWE-89 SQL Injection - unsanitized string interpolation in LIKE queries
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, and_, Text
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Seizure, ScrapeMetadata


def _sanitize_for_ilike(value: str) -> str:
    """Escape special LIKE characters to prevent SQL injection."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def get_all_seizures(
    db: AsyncSession,
    limit: int = 100,
    offset: int = 0
) -> tuple[List[dict], int]:
    """Get all seizures with pagination."""
    count_query = select(func.count()).select_from(Seizure)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(Seizure)
        .order_by(Seizure.date.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    seizures = result.scalars().all()

    seizures_list = [_seizure_to_dict(s) for s in seizures]
    return seizures_list, total


async def get_seizure_by_id(db: AsyncSession, seizure_id: str) -> Optional[dict]:
    """Get a single seizure by its ID."""
    query = select(Seizure).where(Seizure.id == seizure_id)
    result = await db.execute(query)
    seizure = result.scalar_one_or_none()

    if seizure is None:
        return None

    return _seizure_to_dict(seizure)


async def get_seizures_filtered(
    db: AsyncSession,
    state: Optional[str] = None,
    drug_type: Optional[str] = None,
    min_date: Optional[datetime] = None,
    max_date: Optional[datetime] = None,
    min_quantity: Optional[float] = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[List[dict], int, dict]:
    """Get seizures with filters applied. Uses parameterized queries."""
    conditions = []

    if state:
        safe_state = _sanitize_for_ilike(state)
        # Use parameterized query with escaped pattern
        conditions.append(Seizure.state.ilike(f"%{safe_state}%", escape="\\"))
    if drug_type:
        safe_drug = _sanitize_for_ilike(drug_type)
        conditions.append(Seizure.drug_type.ilike(f"%{safe_drug}%", escape="\\"))
    if min_date:
        conditions.append(Seizure.date >= min_date)
    if max_date:
        conditions.append(Seizure.date <= max_date)
    if min_quantity is not None:
        conditions.append(Seizure.quantity_kg >= min_quantity)

    # Count total
    count_query = select(func.count()).select_from(Seizure)
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get filtered seizures
    query = select(Seizure)
    if conditions:
        query = query.where(and_(*conditions))
    query = query.order_by(Seizure.date.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    seizures = result.scalars().all()

    seizures_list = [_seizure_to_dict(s) for s in seizures]

    filters_applied = {}
    if state:
        filters_applied["state"] = state
    if drug_type:
        filters_applied["drug_type"] = drug_type
    if min_date:
        filters_applied["min_date"] = min_date.isoformat()
    if max_date:
        filters_applied["max_date"] = max_date.isoformat()
    if min_quantity is not None:
        filters_applied["min_quantity"] = min_quantity

    return seizures_list, total, filters_applied


async def get_statistics(db: AsyncSession) -> dict:
    """Get aggregated statistics for the dashboard."""
    from datetime import timedelta

    total_query = select(func.count()).select_from(Seizure)
    total_result = await db.execute(total_query)
    total_seizures = total_result.scalar() or 0

    quantity_query = select(func.sum(Seizure.quantity_kg)).select_from(Seizure)
    quantity_result = await db.execute(quantity_query)
    total_quantity_kg = quantity_result.scalar() or 0.0

    # raids_this_week: count seizures in last 7 days
    one_week_ago = datetime.now() - timedelta(days=7)
    week_query = select(func.count()).select_from(Seizure).where(Seizure.date >= one_week_ago)
    week_result = await db.execute(week_query)
    raids_this_week = week_result.scalar() or 0

    state_query = (
        select(Seizure.state, func.count().label("count"))
        .group_by(Seizure.state)
        .order_by(func.count().desc())
    )
    state_result = await db.execute(state_query)
    by_state = {row[0]: row[1] for row in state_result.all() if row[0]}

    drug_query = (
        select(Seizure.drug_type, func.count().label("count"))
        .group_by(Seizure.drug_type)
        .order_by(func.count().desc())
    )
    drug_result = await db.execute(drug_query)
    by_drug_type = {row[0]: row[1] for row in drug_result.all() if row[0]}

    # By month (last 12 months)
    one_year_ago = datetime.now() - timedelta(days=365)
    month_query = (
        select(
            func.strftime("%Y-%m", Seizure.date).label("month"),
            func.count().label("count")
        )
        .where(Seizure.date >= one_year_ago)
        .group_by("month")
        .order_by("month")
    )
    month_result = await db.execute(month_query)
    by_month = {row[0]: row[1] for row in month_result.all() if row[0]}

    # Top locations
    location_query = (
        select(
            Seizure.state,
            Seizure.city,
            func.count().label("count"),
            func.sum(Seizure.quantity_kg).label("total_kg")
        )
        .group_by(Seizure.state, Seizure.city)
        .order_by(func.sum(Seizure.quantity_kg).desc())
        .limit(10)
    )
    location_result = await db.execute(location_query)
    top_locations = [
        {
            "state": row[0],
            "city": row[1],
            "seizure_count": row[2],
            "total_kg": float(row[3] or 0)
        }
        for row in location_result.all()
    ]

    return {
        "total_seizures": total_seizures,
        "total_quantity_kg": round(total_quantity_kg, 2),
        "raids_this_week": raids_this_week,
        "by_state": by_state,
        "by_drug_type": by_drug_type,
        "by_month": by_month,
        "top_locations": top_locations,
    }


async def get_map_data(db: AsyncSession) -> dict:
    """Get map markers data with bounds."""
    query = select(Seizure).where(
        and_(Seizure.lat.isnot(None), Seizure.lon.isnot(None))
    )
    result = await db.execute(query)
    seizures = result.scalars().all()

    markers = []
    lats = []
    lons = []

    for s in seizures:
        if s.quantity_kg >= 100:
            severity = "major"
        elif s.quantity_kg >= 10:
            severity = "medium"
        else:
            severity = "minor"

        marker = {
            "id": s.id,
            "lat": s.lat,
            "lon": s.lon,
            "severity": severity,
            "drug_type": s.drug_type,
            "city": s.city,
            "state": s.state,
            "quantity_kg": s.quantity_kg,
            "date": s.date.isoformat() if s.date else None,
        }
        markers.append(marker)
        lats.append(s.lat)
        lons.append(s.lon)

    bounds = {}
    if lats and lons:
        bounds = {
            "min_lat": min(lats),
            "max_lat": max(lats),
            "min_lon": min(lons),
            "max_lon": max(lons),
        }

    return {"markers": markers, "bounds": bounds}


async def upsert_seizure(db: AsyncSession, seizure_data: dict) -> dict:
    """Insert or update a seizure record."""
    seizure_id = seizure_data.get("id")

    query = select(Seizure).where(Seizure.id == seizure_id)
    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    if existing:
        for key, value in seizure_data.items():
            if hasattr(existing, key) and key != "id":
                setattr(existing, key, value)
        seizure = existing
    else:
        seizure = Seizure(**seizure_data)
        db.add(seizure)

    await db.commit()
    await db.refresh(seizure)

    return _seizure_to_dict(seizure)


async def get_last_scrape_timestamp(db: AsyncSession) -> Optional[dict]:
    """Get the most recent scrape metadata entry."""
    query = (
        select(ScrapeMetadata)
        .order_by(ScrapeMetadata.started_at.desc())
        .limit(1)
    )
    result = await db.execute(query)
    metadata = result.scalar_one_or_none()

    if metadata is None:
        return None

    return metadata.to_dict()


async def create_scrape_run(db: AsyncSession) -> int:
    """Create a new scrape run record."""
    run = ScrapeMetadata(status="running")
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run.id


async def complete_scrape_run(
    db: AsyncSession,
    run_id: int,
    new_seizures: int,
    error: Optional[str] = None
):
    """Mark a scrape run as completed or failed."""
    query = select(ScrapeMetadata).where(ScrapeMetadata.id == run_id)
    result = await db.execute(query)
    run = result.scalar_one_or_none()

    if run:
        run.status = "failed" if error else "completed"
        run.completed_at = datetime.now()
        run.new_seizures = new_seizures
        run.error_message = error
        await db.commit()


def _seizure_to_dict(seizure: Seizure) -> dict:
    """Convert a Seizure model to a JSON-serializable dict."""
    return seizure.to_dict()