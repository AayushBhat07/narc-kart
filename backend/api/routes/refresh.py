"""
Refresh API route.
POST /api/refresh - Trigger manual scraper run
"""

import asyncio
import random
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db, create_scrape_run, complete_scrape_run
from ..models import RefreshResponse

router = APIRouter(prefix="/api/refresh", tags=["Scraper"])


async def run_scraper_task(scrape_id: int):
    """
    Background task to run the scraper.
    In production this would import and run the actual scraper module.
    """
    from database.connection import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            # Try to import the scraper
            try:
                from scraper import run as run_scraper
                new_count = await run_scraper(db)
            except (ImportError, AttributeError):
                # Scraper not implemented yet - simulate
                await asyncio.sleep(1)
                new_count = random.randint(0, 5)

            await complete_scrape_run(db, scrape_id, new_count)
        except Exception as e:
            await complete_scrape_run(db, scrape_id, 0, error=str(e))


@router.post("", response_model=RefreshResponse)
async def trigger_refresh(
    db: AsyncSession = Depends(get_db),
):
    """
    Manually trigger a scrape run to update the database.

    The scraper runs in the background. This endpoint returns immediately
    with a scrape_id that can be used to track progress via the scraper's
    metadata table.

    Returns:
    - **status**: "started" if scrape was initiated
    - **message**: Human-readable status message
    - **new_seizures**: Current count (0 until async job completes)
    - **scrape_id**: ID of the scrape run for tracking
    """
    # Create a scrape run record
    scrape_id = await create_scrape_run(db)

    # Fire and forget the scraper task, but track it to log exceptions
    task = asyncio.create_task(run_scraper_task(scrape_id))
    task.add_done_callback(
        lambda t: print(f"Scrape task {scrape_id} completed: {t.result()}") if not t.exception() else print(f"Scrape task {scrape_id} failed: {t.exception()}")
    )

    return RefreshResponse(
        status="started",
        message="Scrape operation initiated. Check /api/seizures for new data.",
        new_seizures=0,
        scrape_id=scrape_id,
    )