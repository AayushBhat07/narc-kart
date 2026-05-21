#!/usr/bin/env python3
"""
Test Sources - Quick HTTP health check for all configured news sources.
No rate limiting, just quick status checks. Prints a table.
"""

import sys
import requests
from pathlib import Path

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
}

SOURCE_URLS = [
    ("NCB Official", "https://www.ncb.gov.in"),
    ("PTI", "https://www.ptinews.com"),
    ("DRI", "https://dri.nic.in"),
    ("CBIC Customs", "https://www.cbic.gov.in"),
    ("Indian Express", "https://indianexpress.com"),
    ("Times of India", "https://timesofindia.indiatimes.com"),
    ("Hindustan Times", "https://www.hindustantimes.com"),
    ("The Hindu", "https://www.thehindu.com"),
    ("Maharashtra Police", "https://mahapolice.gov.in"),
    ("Delhi Police", "https://delhipolice.gov.in"),
]


def check_source(name: str, url: str) -> tuple[str, int | str, str]:
    """Check HTTP status of a source URL."""
    try:
        r = requests.head(url, headers=HEADERS, timeout=10, allow_redirects=True)
        status = r.status_code
        if status == 200:
            note = "OK"
        elif status == 403:
            note = "Blocked"
        elif status == 404:
            note = "Not found"
        elif status == 503:
            note = "Service unavailable"
        else:
            note = f"HTTP {status}"
        return name, status, note
    except requests.exceptions.Timeout:
        return name, "TIMEOUT", "Request timed out"
    except requests.exceptions.ConnectionError as e:
        return name, "CONN_ERR", f"Connection error"
    except Exception as e:
        return name, "ERROR", str(e)[:50]


def main():
    print("\n=== Source Health Check ===\n")
    print(f"{'Source':<25} {'Status':<10} Notes")
    print("-" * 60)
    
    for name, url in SOURCE_URLS:
        src_name, status, note = check_source(name, url)
        status_str = str(status)
        print(f"{src_name:<25} {status_str:<10} {note}")
    
    print("\n")


if __name__ == "__main__":
    main()