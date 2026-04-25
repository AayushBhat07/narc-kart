"""
API routes package.
"""

from .seizures import router as seizures_router
from .stats import router as stats_router
from .map import router as map_router
from .refresh import router as refresh_router

__all__ = [
    "seizures_router",
    "stats_router",
    "map_router",
    "refresh_router",
]