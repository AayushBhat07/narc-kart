"""
Ollama Client for Narc Kart
India Drug Seizure Tracker - Local LLM Integration

Connects to local Ollama instance for AI-powered data extraction.
"""

import json
import logging
from typing import Optional, Any
from dataclasses import dataclass

import httpx


logger = logging.getLogger(__name__)


@dataclass
class OllamaResponse:
    """Response from Ollama API."""
    model: str
    response: str
    done: bool
    context: Optional[list[int]] = None
    total_duration: Optional[int] = None
    eval_count: Optional[int] = None
    eval_duration: Optional[int] = None


class OllamaClient:
    """Client for interacting with local Ollama instance."""
    
    DEFAULT_MODEL = "llama3.2:latest"
    DEFAULT_BASE_URL = "http://localhost:11434"
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 120
    ):
        self.base_url = (base_url or self.DEFAULT_BASE_URL).rstrip('/')
        self.model = model or self.DEFAULT_MODEL
        self.timeout = timeout
        self.client = httpx.Client(timeout=timeout)
    
    def _post(self, endpoint: str, data: dict) -> dict:
        """Make POST request to Ollama API."""
        url = f"{self.base_url}/{endpoint}"
        response = self.client.post(url, json=data)
        response.raise_for_status()
        return response.json()
    
    def _get(self, endpoint: str) -> dict:
        """Make GET request to Ollama API."""
        url = f"{self.base_url}/{endpoint}"
        response = self.client.get(url)
        response.raise_for_status()
        return response.json()
    
    def is_available(self) -> bool:
        """Check if Ollama is running and accessible."""
        try:
            response = self._get("api/tags")
            return response is not None
        except Exception as e:
            logger.warning(f"Ollama not available: {e}")
            return False
    
    def list_models(self) -> list[str]:
        """List available models."""
        try:
            tags = self._get("api/tags")
            return [m['name'] for m in tags.get('models', [])]
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []
    
    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.1,
        json_mode: bool = False,
        keep_alive: str = "5m"
    ) -> OllamaResponse:
        """
        Generate text response from model.
        
        Args:
            prompt: The user prompt
            system: Optional system prompt
            temperature: Sampling temperature (0-1)
            json_mode: Whether to request JSON formatted output
            keep_alive: How long to keep model loaded
        """
        data = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": 2048,
            },
            "keep_alive": keep_alive,
        }
        
        if system:
            data["system"] = system
        
        if json_mode:
            data["format"] = "json"
        
        try:
            result = self._post("api/generate", data)
            return OllamaResponse(
                model=result.get('model', self.model),
                response=result.get('response', ''),
                done=result.get('done', True),
                context=result.get('context'),
                total_duration=result.get('total_duration'),
                eval_count=result.get('eval_count'),
                eval_duration=result.get('eval_duration')
            )
        except httpx.HTTPError as e:
            logger.error(f"Ollama generation failed: {e}")
            raise
    
    def chat(
        self,
        messages: list[dict],
        temperature: float = 0.1,
        json_mode: bool = False,
        keep_alive: str = "5m"
    ) -> OllamaResponse:
        """
        Chat with the model using message history.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature
            json_mode: Whether to request JSON formatted output
            keep_alive: How long to keep model loaded
        """
        data = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
            },
            "keep_alive": keep_alive,
        }
        
        if json_mode:
            data["format"] = "json"
        
        try:
            result = self._post("api/chat", data)
            message = result.get('message', {})
            return OllamaResponse(
                model=result.get('model', self.model),
                response=message.get('content', ''),
                done=result.get('done', True),
            )
        except httpx.HTTPError as e:
            logger.error(f"Ollama chat failed: {e}")
            raise
    
    def extract_json(self, prompt: str, system: Optional[str] = None) -> dict:
        """
        Generate and parse JSON response.
        
        Returns parsed JSON dict or raises ValueError.
        """
        response = self.generate(prompt, system=system, json_mode=True)
        
        try:
            # Try to extract JSON from response
            text = response.response.strip()
            
            # Handle markdown code blocks
            if text.startswith('```'):
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
            
            # Try parsing as-is first
            if text.startswith('{'):
                return json.loads(text)
            
            # Try extracting JSON from text
            start = text.find('{')
            end = text.rfind('}') + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
            
            raise ValueError(f"No JSON found in response: {text[:200]}")
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON: {e}\nResponse: {response.response[:500]}")
    
    def health_check(self) -> dict:
        """Check Ollama health and model status."""
        status = {
            "available": False,
            "base_url": self.base_url,
            "model": self.model,
            "model_loaded": False,
            "models": [],
            "error": None
        }
        
        try:
            # Check if Ollama is running
            tags = self._get("api/tags")
            status["available"] = True
            status["models"] = [m['name'] for m in tags.get('models', [])]
            
            # Check if our model is available
            if self.model in status["models"]:
                status["model_loaded"] = True
                
        except Exception as e:
            status["error"] = str(e)
        
        return status


def create_client(
    base_url: Optional[str] = None,
    model: Optional[str] = None
) -> OllamaClient:
    """Factory function to create Ollama client."""
    return OllamaClient(base_url=base_url, model=model)


def get_default_client() -> OllamaClient:
    """Get default Ollama client."""
    return OllamaClient()