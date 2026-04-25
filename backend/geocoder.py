"""
Geocoder for Narc Kart
India Drug Seizure Tracker - Location to Coordinates

Uses Nominatim (OpenStreetMap) for geocoding with:
- Rate limiting (1 req/sec)
- Caching to avoid repeated calls
- India-focused search bias
"""

import json
import logging
import time
import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Tuple
from urllib.parse import quote_plus

import httpx


logger = logging.getLogger(__name__)


@dataclass
class GeoLocation:
    """Represents a geocoded location."""
    latitude: float
    longitude: float
    display_name: str
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    confidence: float = 0.0


class NominatimGeocoder:
    """Geocoder using Nominatim (OpenStreetMap) API."""
    
    BASE_URL = "https://nominatim.openstreetmap.org"
    USER_AGENT = "NarcKart/1.0 (India Drug Seizure Tracker)"
    RATE_LIMIT_SECONDS = 1.0
    
    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = Path(cache_dir or os.path.expanduser("~/.narc-kart/cache"))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_file = self.cache_dir / "geocode_cache.json"
        self.cache: dict[str, dict] = self._load_cache()
        self.last_request_time: Optional[float] = None
        self.client = httpx.Client(timeout=10.0)
    
    def _load_cache(self) -> dict:
        """Load geocoding cache from file."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Failed to load cache: {e}")
        return {}
    
    def _save_cache(self) -> None:
        """Save geocoding cache to file."""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump(self.cache, f, indent=2)
        except IOError as e:
            logger.warning(f"Failed to save cache: {e}")
    
    def _get_cache_key(self, city: Optional[str], state: Optional[str]) -> str:
        """Generate cache key for location."""
        return f"{city or ''}:{state or ''}".lower().strip()
    
    def _rate_limit(self) -> None:
        """Enforce rate limiting."""
        if self.last_request_time is not None:
            elapsed = time.time() - self.last_request_time
            if elapsed < self.RATE_LIMIT_SECONDS:
                time.sleep(self.RATE_LIMIT_SECONDS - elapsed)
        self.last_request_time = time.time()
    
    def geocode(
        self,
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: str = "India"
    ) -> Optional[GeoLocation]:
        """
        Geocode a location to coordinates.
        
        Args:
            city: City name
            state: State name
            country: Country name (default: India)
        
        Returns:
            GeoLocation if found, None otherwise
        """
        # Check cache first
        cache_key = self._get_cache_key(city, state)
        if cache_key in self.cache:
            logger.debug(f"Cache hit: {cache_key}")
            cached = self.cache[cache_key]
            return GeoLocation(
                latitude=cached['latitude'],
                longitude=cached['longitude'],
                display_name=cached.get('display_name', ''),
                city=cached.get('city'),
                state=cached.get('state'),
                country=cached.get('country', country),
                confidence=cached.get('confidence', 0.8)
            )
        
        # Build search query
        query_parts = []
        if city:
            query_parts.append(city)
        if state:
            query_parts.append(state)
        query_parts.append(country)
        
        query = ", ".join(query_parts)
        
        # Make API request
        self._rate_limit()
        
        try:
            params = {
                "q": query,
                "format": "json",
                "limit": "1",
                "addressdetails": "1",
            }
            
            headers = {
                "User-Agent": self.USER_AGENT
            }
            
            response = self.client.get(
                f"{self.BASE_URL}/search",
                params=params,
                headers=headers
            )
            response.raise_for_status()
            
            data = response.json()
            
            if not data:
                logger.warning(f"No results for: {query}")
                # Cache negative result
                self.cache[cache_key] = {"latitude": 0, "longitude": 0, "not_found": True}
                self._save_cache()
                return None
            
            result = data[0]
            
            # Extract location data
            lat = float(result['lat'])
            lon = float(result['lon'])
            display_name = result.get('display_name', '')
            
            # Extract address components
            addr = result.get('address', {})
            
            extracted_city = (
                addr.get('city') or
                addr.get('town') or
                addr.get('village') or
                addr.get('municipality') or
                city
            )
            
            extracted_state = (
                addr.get('state') or
                state
            )
            
            extracted_country = addr.get('country', country)
            
            # Calculate confidence based on match quality
            confidence = 0.5
            if city and city.lower() in display_name.lower():
                confidence += 0.2
            if state and state.lower() in display_name.lower():
                confidence += 0.2
            if 'India' in display_name:
                confidence += 0.1
            
            location = GeoLocation(
                latitude=lat,
                longitude=lon,
                display_name=display_name,
                city=extracted_city,
                state=extracted_state,
                country=extracted_country,
                confidence=min(confidence, 1.0)
            )
            
            # Cache result
            self.cache[cache_key] = {
                "latitude": lat,
                "longitude": lon,
                "display_name": display_name,
                "city": extracted_city,
                "state": extracted_state,
                "country": extracted_country,
                "confidence": confidence
            }
            self._save_cache()
            
            logger.info(f"Geocoded: {city}, {state} -> ({lat}, {lon})")
            return location
            
        except httpx.HTTPError as e:
            logger.error(f"Geocoding HTTP error: {e}")
            return None
        except (ValueError, KeyError) as e:
            logger.error(f"Geocoding parse error: {e}")
            return None
    
    def geocode_india(self, city: str, state: str) -> Optional[GeoLocation]:
        """Convenience method for India geocoding."""
        return self.geocode(city=city, state=state, country="India")
    
    def reverse_geocode(self, lat: float, lon: float) -> Optional[GeoLocation]:
        """
        Reverse geocode coordinates to location name.
        
        Args:
            lat: Latitude
            lon: Longitude
        
        Returns:
            GeoLocation if found, None otherwise
        """
        cache_key = f"reverse:{lat:.4f},{lon:.4f}"
        
        if cache_key in self.cache:
            cached = self.cache[cache_key]
            if cached.get("not_found"):
                return None
            return GeoLocation(
                latitude=cached['latitude'],
                longitude=cached['longitude'],
                display_name=cached.get('display_name', ''),
                city=cached.get('city'),
                state=cached.get('state'),
                country=cached.get('country', 'India'),
                confidence=cached.get('confidence', 0.7)
            )
        
        self._rate_limit()
        
        try:
            params = {
                "lat": lat,
                "lon": lon,
                "format": "json",
                "addressdetails": "1",
            }
            
            headers = {"User-Agent": self.USER_AGENT}
            
            response = self.client.get(
                f"{self.BASE_URL}/reverse",
                params=params,
                headers=headers
            )
            response.raise_for_status()
            
            data = response.json()
            
            if not data or 'error' in data:
                self.cache[cache_key] = {"latitude": lat, "longitude": lon, "not_found": True}
                self._save_cache()
                return None
            
            addr = data.get('address', {})
            
            location = GeoLocation(
                latitude=lat,
                longitude=lon,
                display_name=data.get('display_name', ''),
                city=addr.get('city') or addr.get('town') or addr.get('village'),
                state=addr.get('state'),
                country=addr.get('country', 'India'),
                confidence=0.7
            )
            
            self.cache[cache_key] = {
                "latitude": lat,
                "longitude": lon,
                "display_name": location.display_name,
                "city": location.city,
                "state": location.state,
                "country": location.country,
                "confidence": location.confidence
            }
            self._save_cache()
            
            return location
            
        except Exception as e:
            logger.error(f"Reverse geocoding error: {e}")
            return None
    
    def clear_cache(self) -> None:
        """Clear the geocoding cache."""
        self.cache = {}
        if self.cache_file.exists():
            self.cache_file.unlink()
        logger.info("Geocoding cache cleared")
    
    def close(self) -> None:
        """Close HTTP client."""
        self.client.close()


def create_geocoder(cache_dir: Optional[str] = None) -> NominatimGeocoder:
    """Factory function to create geocoder."""
    return NominatimGeocoder(cache_dir=cache_dir)


# Indian cities/states coordinates fallback (for common locations)
FALLBACK_COORDINATES: dict[str, Tuple[float, float]] = {
    # Major Cities
    "mumbai,maharashtra": (19.0760, 72.8777),
    "navi mumbai,maharashtra": (19.0330, 73.0297),
    "new mumbai,maharashtra": (19.0330, 73.0297),
    "delhi,delhi": (28.6139, 77.2090),
    "new delhi,delhi": (28.6139, 77.2090),
    "bangalore,karnataka": (12.9716, 77.5946),
    "bengaluru,karnataka": (12.9716, 77.5946),
    "chennai,tamil nadu": (13.0827, 80.2707),
    "kolkata,west bengal": (22.5726, 88.3639),
    "hyderabad,telangana": (17.3850, 78.4867),
    "pune,maharashtra": (18.5204, 73.8567),
    "ahmedabad,gujarat": (23.0225, 72.5714),
    "jaipur,rajasthan": (26.9124, 75.7873),
    
    # States (centroid)
    "maharashtra": (19.6019, 75.5529),
    "delhi": (28.6139, 77.2090),
    "karnataka": (15.3173, 75.7139),
    "tamil nadu": (11.1271, 78.6569),
    "west bengal": (22.9868, 87.8550),
    "telangana": (18.1124, 79.0193),
    "gujarat": (22.2587, 71.1924),
    "rajasthan": (27.0238, 74.2179),
    "uttar pradesh": (26.8467, 80.9462),
    "madhya pradesh": (22.9734, 78.6569),
    "punjab": (31.1471, 75.3412),
    "haryana": (29.0588, 76.0856),
    "kerala": (10.8505, 76.2711),
    "andhra pradesh": (15.9129, 79.7400),
    "bihar": (25.0961, 85.3131),
    "odisha": (20.9517, 85.0985),
    "chhattisgarh": (21.2787, 81.8661),
    "jharkhand": (23.6102, 85.2799),
    "uttarakhand": (30.0668, 79.0193),
    "himachal pradesh": (31.1048, 77.1734),
    "sikkim": (27.5330, 88.5122),
    "assam": (26.2006, 92.9376),
    "meghalaya": (25.4670, 91.3662),
    "manipur": (24.6637, 93.9063),
    "nagaland": (26.1584, 94.5624),
    "tripura": (23.9408, 91.9882),
    "mizoram": (23.1645, 92.9376),
    "arunachal pradesh": (28.2180, 94.7278),
    "goa": (15.2993, 74.1240),
    "chandigarh": (30.7333, 76.7794),
}


def get_fallback_coordinates(city: Optional[str], state: Optional[str]) -> Optional[Tuple[float, float]]:
    """Get fallback coordinates for common Indian locations."""
    if not city and not state:
        return None
    
    # Build lookup keys
    keys = []
    if city and state:
        keys.append(f"{city.lower()},{state.lower()}")
    if state:
        keys.append(state.lower())
    if city:
        keys.append(city.lower())
    
    for key in keys:
        if key in FALLBACK_COORDINATES:
            return FALLBACK_COORDINATES[key]
    
    return None