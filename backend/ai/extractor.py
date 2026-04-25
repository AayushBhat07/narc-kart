"""
AI Data Extractor for Narc Kart
India Drug Seizure Tracker - Extract structured seizure data using LLM

Uses Ollama local LLM to extract:
- Location (city, state)
- Drug type
- Quantity in kg
- Date
- Agency
- Case number
- Images
"""

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any

from .ollama_client import OllamaClient, create_client


logger = logging.getLogger(__name__)


@dataclass
class SeizureData:
    """Structured seizure data extracted from article."""
    # Location
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_country: str = "India"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Drug info
    drug_type: Optional[str] = None
    drug_type_confidence: float = 0.0
    quantity_kg: Optional[float] = None
    quantity_raw: Optional[str] = None
    street_value_rs: Optional[int] = None  # Estimated street value
    
    # Temporal
    seizure_date: Optional[datetime] = None
    article_date: Optional[datetime] = None
    
    # Source
    source_name: str = ""
    source_url: str = ""
    article_url: str = ""
    article_title: str = ""
    
    # Agency & Case
    agency: Optional[str] = None
    case_number: Optional[str] = None
    arrested_count: Optional[int] = None
    
    # Media
    images: list[str] = field(default_factory=list)
    article_text: str = ""
    
    # Quality metrics
    extraction_confidence: float = 0.0
    extraction_method: str = "llm"  # "llm", "regex", "hybrid"
    warnings: list[str] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for database storage."""
        return {
            "location_city": self.location_city,
            "location_state": self.location_state,
            "location_country": self.location_country,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "drug_type": self.drug_type,
            "drug_type_confidence": self.drug_type_confidence,
            "quantity_kg": self.quantity_kg,
            "quantity_raw": self.quantity_raw,
            "street_value_rs": self.street_value_rs,
            "seizure_date": self.seizure_date.isoformat() if self.seizure_date else None,
            "article_date": self.article_date.isoformat() if self.article_date else None,
            "source_name": self.source_name,
            "source_url": self.source_url,
            "article_url": self.article_url,
            "article_title": self.article_title,
            "agency": self.agency,
            "case_number": self.case_number,
            "arrested_count": self.arrested_count,
            "images": json.dumps(self.images),
            "article_text": self.article_text[:5000] if self.article_text else "",
            "extraction_confidence": self.extraction_confidence,
            "extraction_method": self.extraction_method,
            "warnings": json.dumps(self.warnings),
        }


# System prompt for extraction
EXTRACTION_SYSTEM_PROMPT = """You are a specialized data extraction AI for India drug seizure news articles. Your task is to extract structured data from news text about drug seizure cases in India.

Extract the following information from the article:
1. LOCATION: City and State where the seizure occurred
2. DRUG TYPE: Type of drug (heroin, cocaine, methamphetamine, cannabis, methaqualone, morphine, MDMA, or other)
3. QUANTITY: Amount seized in kg (convert all units to kg)
4. DATE: Date of the seizure (not article publication date)
5. AGENCY: Which agency handled the case (NCB, DRI, State Police, Customs, etc.)
6. CASE NUMBER: Any case/FIR number mentioned
7. ARRESTED: Number of people arrested (if any)
8. IMAGES: Any URLs of images in the article

Respond with ONLY valid JSON in this exact format:
{
    "location_city": "Mumbai" or null,
    "location_state": "Maharashtra" or null,
    "drug_type": "heroin" or null,
    "quantity_kg": 45.5 or null,
    "quantity_raw": "45.5 kg" or null,
    "seizure_date": "2024-01-15" or null,
    "agency": "NCB" or null,
    "case_number": "CR-123/2024" or null,
    "arrested_count": 3 or null,
    "images": ["url1", "url2"] or [],
    "confidence": 0.8,
    "warnings": ["Could not determine exact quantity"] or []
}

Rules:
- If you cannot determine a field, use null
- Quantities in grams divide by 1000, in quintals multiply by 100
- States must be full names (Maharashtra, not MH)
- Drug types: heroin, cocaine, methamphetamine, cannabis, methaqualone, morphine, mdma, other
- Only include images that appear to be related to the drug seizure
- confidence is 0.0 to 1.0 based on how certain you are
- warnings should note any ambiguities or missing data"""


# Fallback regex extraction patterns
REGEX_PATTERNS = {
    "location": [
        r'in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s+(Maharashtra|Delhi|Karnataka|Tamil Nadu|Uttar Pradesh|West Bengal|Gujarat|Rajasthan|Punjab|Haryana|Madhya Pradesh|Kerala|Andhra Pradesh|Telangana)',  # noqa: E501
        r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,\s*(India)',
    ],
    "quantity_kg": [
        r'(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)',
        r'(\d+(?:\.\d+)?)\s*kilograms?',
    ],
    "drug_type": [
        r'(?:seized|recovered|confiscated)\s+(heroin|brown sugar|methamphetamine|cocaine|cannabis|ganja|charas|marijuana|poppy|morphine)',
    ],
    "date": [
        r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})',
    ]
}


class DataExtractor:
    """Extract structured seizure data from article text."""
    
    def __init__(self, ollama_client: Optional[OllamaClient] = None):
        self.ollama = ollama_client or create_client()
        self.regex_patterns = REGEX_PATTERNS
    
    def extract(self, article_text: str, article_url: str, source_name: str) -> SeizureData:
        """
        Extract seizure data from article text.
        
        Uses LLM extraction with regex fallback.
        """
        # Try LLM extraction first
        if self.ollama.is_available():
            try:
                return self._extract_with_llm(article_text, article_url, source_name)
            except Exception as e:
                logger.warning(f"LLM extraction failed, falling back to regex: {e}")
                return self._extract_with_regex(article_text, article_url, source_name)
        
        # Fallback to regex
        logger.info("Ollama not available, using regex extraction")
        return self._extract_with_regex(article_text, article_url, source_name)
    
    def _extract_with_llm(self, article_text: str, article_url: str, source_name: str) -> SeizureData:
        """Extract using Ollama LLM."""
        # Prepare text (truncate if too long)
        max_chars = 8000
        truncated_text = article_text[:max_chars] if len(article_text) > max_chars else article_text
        
        # Build prompt
        prompt = f"""Extract drug seizure data from this article:

{truncated_text}

Respond with ONLY valid JSON:"""
        
        # Get response
        response = self.ollama.generate(
            prompt=prompt,
            system=EXTRACTION_SYSTEM_PROMPT,
            temperature=0.1,
            json_mode=True
        )
        
        # Parse JSON
        try:
            # Extract JSON from response
            text = response.response.strip()
            
            # Handle markdown code blocks
            if text.startswith('```'):
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
            
            # Find JSON boundaries
            if text.startswith('{'):
                start, end = 0, len(text)
            else:
                start = text.find('{')
                end = text.rfind('}') + 1
            
            if start >= 0 and end > start:
                data = json.loads(text[start:end])
            else:
                raise ValueError("No JSON found in response")
            
            # Convert to SeizureData
            return self._json_to_seizure_data(data, article_url, source_name, article_text)
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse LLM response: {e}")
            raise
    
    def _json_to_seizure_data(
        self, data: dict, article_url: str, source_name: str, article_text: str
    ) -> SeizureData:
        """Convert parsed JSON to SeizureData object."""
        seizure = SeizureData(
            source_name=source_name,
            article_url=article_url,
            article_text=article_text[:5000],
            extraction_method="llm"
        )
        
        # Location
        seizure.location_city = data.get("location_city")
        seizure.location_state = data.get("location_state")
        
        # Drug type
        drug = data.get("drug_type")
        if drug:
            seizure.drug_type = drug.lower().strip()
        
        # Quantity
        seizure.quantity_kg = data.get("quantity_kg")
        seizure.quantity_raw = data.get("quantity_raw")
        
        # Date
        date_str = data.get("seizure_date")
        if date_str:
            try:
                seizure.seizure_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except ValueError:
                try:
                    seizure.seizure_date = datetime.strptime(date_str, "%Y-%m-%d")
                except ValueError:
                    pass
        
        # Agency & Case
        seizure.agency = data.get("agency")
        seizure.case_number = data.get("case_number")
        seizure.arrested_count = data.get("arrested_count")
        
        # Images
        seizure.images = data.get("images", [])
        
        # Confidence
        seizure.extraction_confidence = data.get("confidence", 0.5)
        
        # Warnings
        seizure.warnings = data.get("warnings", [])
        
        return seizure
    
    def _extract_with_regex(self, article_text: str, article_url: str, source_name: str) -> SeizureData:
        """Fallback extraction using regex patterns."""
        seizure = SeizureData(
            source_name=source_name,
            article_url=article_url,
            article_text=article_text[:5000],
            extraction_method="regex"
        )
        
        text = article_text
        
        # Extract location
        for pattern in self.regex_patterns["location"]:
            match = re.search(pattern, text)
            if match:
                groups = match.groups()
                if len(groups) >= 2:
                    seizure.location_city = groups[0].strip()
                    state = groups[1].strip()
                    seizure.location_state = state if len(state) > 2 else None
                break
        
        # Extract drug type
        drug_pattern = self.regex_patterns["drug_type"][0]
        match = re.search(drug_pattern, text, re.IGNORECASE)
        if match:
            seizure.drug_type = match.group(1).lower()
        
        # Extract quantity in kg
        for pattern in self.regex_patterns["quantity_kg"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    seizure.quantity_kg = float(match.group(1))
                    seizure.quantity_raw = match.group(0)
                except ValueError:
                    pass
                break
        
        # Extract date
        date_pattern = self.regex_patterns["date"][0]
        match = re.search(date_pattern, text)
        if match:
            try:
                day, month, year = match.groups()
                year = int(year)
                if year < 100:
                    year += 2000
                seizure.seizure_date = datetime(day=int(day), month=int(month), year=year)
            except (ValueError, IndexError):
                pass
        
        # Agency detection
        text_lower = text.lower()
        if any(k in text_lower for k in ['narcotics control bureau', 'ncb']):
            seizure.agency = "NCB"
        elif any(k in text_lower for k in ['dri', 'revenue intelligence']):
            seizure.agency = "DRI"
        elif 'customs' in text_lower:
            seizure.agency = "Customs"
        elif 'police' in text_lower:
            seizure.agency = "State Police"
        
        # Calculate confidence
        confidence = 0.0
        if seizure.location_state:
            confidence += 0.25
        if seizure.drug_type:
            confidence += 0.25
        if seizure.quantity_kg:
            confidence += 0.25
        if seizure.agency:
            confidence += 0.25
        
        seizure.extraction_confidence = confidence
        seizure.warnings = ["Regex extraction - LLM extraction unavailable"]
        
        return seizure


def extract_seizure_data(
    article_text: str,
    article_url: str,
    source_name: str,
    ollama_client: Optional[OllamaClient] = None
) -> SeizureData:
    """Convenience function to extract seizure data."""
    extractor = DataExtractor(ollama_client=ollama_client)
    return extractor.extract(article_text, article_url, source_name)