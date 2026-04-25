"""
News Sources Configuration for Narc Kart
India Drug Seizure Tracker - News Source Definitions
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class NewsSource:
    """Represents a news source for drug seizure data."""
    name: str
    base_url: str
    rss_url: Optional[str] = None
    search_url: Optional[str] = None
    requires_js: bool = False
    rate_limit_seconds: float = 3.0
    priority: int = 1
    agency_type: Optional[str] = None  # "NCB", "State Police", "Customs", etc.
    enabled: bool = True

    def __repr__(self) -> str:
        return f"<NewsSource: {self.name} ({self.base_url})>"


# Official Sources
NCB_WEBSITE = NewsSource(
    name="NCB Official Website",
    base_url="https://www.ncb.gov.in",
    search_url="https://www.ncb.gov.in/media/press-releases",
    requires_js=False,
    rate_limit_seconds=5.0,
    priority=1,
    agency_type="NCB"
)

NCB_ZONE_OFFICES = NewsSource(
    name="NCB Zone Press Releases",
    base_url="https://www.ncb.gov.in/ncb-departments/zones",
    requires_js=True,
    rate_limit_seconds=5.0,
    priority=2,
    agency_type="NCB"
)

# News Agencies
PTI_WEBSITE = NewsSource(
    name="Press Trust of India",
    base_url="https://www.ptinews.com",
    search_url="https://www.ptinews.com/search/news?query=drug+seizure+india",
    requires_js=False,
    rate_limit_seconds=2.0,
    priority=1,
    agency_type="News Agency"
)

# Major Indian News Portals with Drug Seizure Coverage
TIMES_OF_INDIA = NewsSource(
    name="Times of India",
    base_url="https://timesofindia.indiatimes.com",
    search_url="https://timesofindia.indiatimes.com/topic/drug-seizure/news",
    requires_js=True,
    rate_limit_seconds=3.0,
    priority=2,
    agency_type="News Agency"
)

INDIAN_EXPRESS = NewsSource(
    name="The Indian Express",
    base_url="https://indianexpress.com",
    search_url="https://indianexpress.com/section/india/",
    requires_js=True,
    rate_limit_seconds=3.0,
    priority=2,
    agency_type="News Agency"
)

HINDUSTAN_TIMES = NewsSource(
    name="Hindustan Times",
    base_url="https://www.hindustantimes.com",
    search_url="https://www.hindustantimes.com/search?query=drug%20seizure",
    requires_js=True,
    rate_limit_seconds=3.0,
    priority=2,
    agency_type="News Agency"
)

THE_HINDU = NewsSource(
    name="The Hindu",
    base_url="https://www.thehindu.com",
    search_url="https://www.thehindu.com/search/?q=drug+seizure&order=DESC&sort=publishdate",
    requires_js=True,
    rate_limit_seconds=3.0,
    priority=2,
    agency_type="News Agency"
)

# State Police News Portals
MAHARASHTRA_POLICE = NewsSource(
    name="Maharashtra Police",
    base_url="https://mahapolice.gov.in",
    search_url="https://mahapolice.gov.in/press-releases",
    requires_js=False,
    rate_limit_seconds=5.0,
    priority=3,
    agency_type="State Police"
)

DELHI_POLICE = NewsSource(
    name="Delhi Police",
    base_url="https://delhipolice.gov.in",
    search_url="https://delhipolice.gov.in/press-releases",
    requires_js=False,
    rate_limit_seconds=5.0,
    priority=3,
    agency_type="State Police"
)

# DRI (Directorate of Revenue Intelligence)
DRI_WEBSITE = NewsSource(
    name="DRI Official",
    base_url="https://dri.nic.in",
    search_url="https://dri.nic.in/press-release",
    requires_js=False,
    rate_limit_seconds=5.0,
    priority=2,
    agency_type="DRI"
)

# Customs and Excise
CUSTOMS_GST = NewsSource(
    name="CBIC - Customs",
    base_url="https://www.cbic.gov.in",
    search_url="https://www.cbic.gov.in/communication/press-releases",
    requires_js=False,
    rate_limit_seconds=5.0,
    priority=2,
    agency_type="Customs"
)

# RSS Feed Sources (for faster polling)
RSS_FEEDS = [
    NewsSource(
        name="NDTV India RSS",
        base_url="https://ndtv.in",
        rss_url="https://feeds.feedburner.com/ndtvnews-india",
        requires_js=False,
        rate_limit_seconds=3.0,
        priority=1,
        agency_type="News Agency"
    ),
    NewsSource(
        name="Zee News RSS",
        base_url="https://www.zeenews.com",
        rss_url="https://www.zeenews.com/rss/india.xml",
        requires_js=False,
        rate_limit_seconds=3.0,
        priority=2,
        agency_type="News Agency"
    ),
]

# All sources list
ALL_SOURCES = [
    NCB_WEBSITE,
    PTI_WEBSITE,
    DRI_WEBSITE,
    CUSTOMS_GST,
    INDIAN_EXPRESS,
    TIMES_OF_INDIA,
    HINDUSTAN_TIMES,
    THE_HINDU,
    MAHARASHTRA_POLICE,
    DELHI_POLICE,
]

ENABLED_SOURCES = [s for s in ALL_SOURCES if s.enabled]


def get_source_by_name(name: str) -> Optional[NewsSource]:
    """Get a source by its name."""
    for source in ALL_SOURCES:
        if source.name.lower() == name.lower():
            return source
    return None


def get_sources_by_agency(agency: str) -> list[NewsSource]:
    """Get all sources for a specific agency type."""
    return [s for s in ALL_SOURCES if s.agency_type == agency]


def get_js_sources() -> list[NewsSource]:
    """Get sources that require JavaScript rendering."""
    return [s for s in ALL_SOURCES if s.requires_js]


def get_static_sources() -> list[NewsSource]:
    """Get sources that don't require JavaScript."""
    return [s for s in ALL_SOURCES if not s.requires_js]