#!/usr/bin/env python3
"""
Weekly data updater for Narc Kart.

Pulls recent Indian drug-seizure headlines from Google News RSS, keeps only
the ones that name a drug, a quantity and a known Indian city, and MERGES
them into frontend/public/data.json. Existing records are never dropped.

Standard library only, so the GitHub Action needs no pip install.

    python scripts/update_data.py            # update data.json in place
    python scripts/update_data.py --dry-run  # print what would be added
"""

import argparse
import email.utils
import hashlib
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "frontend" / "public" / "data.json"
CITIES_FILE = Path(__file__).resolve().parent / "data" / "cities.json"

QUERIES = [
    "drugs seized kg India",
    "heroin seized kg",
    "ganja seized kg",
    "cocaine seized kg India",
    "mephedrone seized kg",
    "methamphetamine seized kg India",
    "charas seized kg",
    "NCB seizure kg",
    "opium poppy husk seized kg",
]
RSS_URL = "https://news.google.com/rss/search?q={q}+when:14d&hl=en-IN&gl=IN&ceid=IN:en"
USER_AGENT = "Mozilla/5.0 (compatible; NarcKartBot/1.0; +https://github.com/AayushBhat07/narc-kart)"

# Order matters: more specific phrases first.
DRUG_PATTERNS = [
    (r"\bbrown sugar\b|\bsmack\b|\bheroin\b", "heroin"),
    (r"\bcocaine\b", "cocaine"),
    (r"\bmephedrone\b|\bmd drugs?\b|\bmethamphetamine\b|\bmeth\b|\byaba\b|\bice\b", "meth"),
    (r"\bmdma\b|\becstasy\b", "mdma"),
    (r"\bganja\b|\bcannabis\b|\bmarijuana\b|\bcharas\b|\bhashish\b|\bhash oil\b|\bbhang\b", "cannabis"),
    (r"\bopium\b|\bpoppy husk\b|\bpoppy straw\b|\bdoda post\b|\bafeem\b", "opium"),
    (r"\bcodeine\b|\btramadol\b|\balprazolam\b|\bnarcotic tablets?\b|\bdrugs?\b", "other"),
]

# Headlines that mention a raid but aren't drug seizures.
EXCLUDE = re.compile(
    r"corruption|disproportionate|assets|gold|liquor|cash seized|hawala|"
    r"illegal arms|sand mining|red sanders|ivory|wildlife|gutka|tobacco|"
    r"\bcricket\b|\belection\b|\bed raid",
    re.I,
)

QTY = re.compile(
    r"(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:-\s*)?"
    r"(kgs?|kilograms?|kilos?|tonnes?|tons?|quintals?|grams?|gms?|g)\b",
    re.I,
)

INDIA_BBOX = (6.0, 37.5, 68.0, 97.5)  # lat_min, lat_max, lon_min, lon_max
VALID_DRUGS = {"heroin", "cocaine", "meth", "mdma", "cannabis", "opium", "other"}


def load_cities():
    cities = json.loads(CITIES_FILE.read_text(encoding="utf-8"))["cities"]
    seen, out = set(), []
    # Longest names first so "Navi Mumbai" wins over "Mumbai".
    for c in sorted(cities, key=lambda c: -len(c["name"])):
        key = c["name"].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append((re.compile(rf"\b{re.escape(key)}\b", re.I), c))
    return out


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:  # TLS verified by default
        return resp.read()


def parse_quantity(text: str):
    best = None
    for num, unit in QTY.findall(text):
        qty = float(num.replace(",", ""))
        u = unit.lower()
        if u.startswith(("tonne", "ton")):
            qty *= 1000
        elif u.startswith("quintal"):
            qty *= 100
        elif u.startswith(("g", "gram")) and not u.startswith("k"):
            qty /= 1000
        if qty > 0 and (best is None or qty > best):
            best = qty
    return round(best, 3) if best else None


def parse_drug(text: str):
    for pattern, drug in DRUG_PATTERNS:
        if re.search(pattern, text, re.I):
            return drug
    return None


def parse_city(text: str, cities):
    for rx, c in cities:
        if rx.search(text):
            return c
    return None


def clean_title(title: str) -> str:
    # Google News titles end with " - Publisher".
    return re.sub(r"\s+-\s+[^-]+$", "", html.unescape(title)).strip()


def item_to_record(item, cities):
    raw_title = item.findtext("title") or ""
    title = clean_title(raw_title)
    if not title or EXCLUDE.search(title):
        return None

    drug = parse_drug(title)
    qty = parse_quantity(title)
    city = parse_city(title, cities)
    if not (drug and qty and city):
        return None

    pub = item.findtext("pubDate")
    try:
        date = email.utils.parsedate_to_datetime(pub).date().isoformat()
    except Exception:
        date = datetime.now(timezone.utc).date().isoformat()

    source_el = item.find("source")
    source_name = (source_el.text if source_el is not None else "") or "News report"

    record = {
        "city": city["name"],
        "state": city["state"],
        "lat": city["lat"],
        "lon": city["lon"],
        "drugType": drug,
        "quantityKg": qty,
        "date": date,
        "sourceName": source_name.strip(),
        "sourceUrl": item.findtext("link") or "",
        "agency": "NCB" if re.search(r"\bNCB\b|narcotics control bureau", title, re.I) else source_name.strip(),
        "description": title[:300],
        "images": [],
    }
    key = f"{record['date']}|{record['city']}|{record['drugType']}|{record['quantityKg']}"
    record["id"] = "sz-" + hashlib.md5(key.encode()).hexdigest()[:8]
    record["caseNo"] = f"NK-{date[:4]}-{record['id'][3:9].upper()}"
    return record


def is_valid(r) -> bool:
    lat_min, lat_max, lon_min, lon_max = INDIA_BBOX
    try:
        return (
            r["drugType"] in VALID_DRUGS
            and isinstance(r["quantityKg"], (int, float)) and r["quantityKg"] > 0
            and lat_min <= float(r["lat"]) <= lat_max
            and lon_min <= float(r["lon"]) <= lon_max
            and re.fullmatch(r"\d{4}-\d{2}-\d{2}", r["date"]) is not None
            and len(r.get("description") or "") <= 600
        )
    except (KeyError, TypeError, ValueError):
        return False


def is_duplicate(r, existing) -> bool:
    """Same city + drug + quantity within 4 days is the same seizure reported twice."""
    d = datetime.fromisoformat(r["date"])
    for e in existing:
        if e["id"] == r["id"]:
            return True
        if (
            e["city"] == r["city"]
            and e["drugType"] == r["drugType"]
            and abs((e.get("quantityKg") or 0) - r["quantityKg"]) < 0.01
            and abs((datetime.fromisoformat(e["date"]) - d).days) <= 4
        ):
            return True
    return False


def compute_stats(seizures):
    by_state, by_drug, by_month, by_loc = {}, {}, {}, {}
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
    for s in seizures:
        by_state[s["state"]] = by_state.get(s["state"], 0) + 1
        by_drug[s["drugType"]] = by_drug.get(s["drugType"], 0) + 1
        by_month[s["date"][:7]] = by_month.get(s["date"][:7], 0) + 1
        loc = by_loc.setdefault((s["city"], s["state"]), {"count": 0, "kg": 0.0})
        loc["count"] += 1
        loc["kg"] += s.get("quantityKg") or 0
    top = sorted(by_loc.items(), key=lambda kv: (-kv[1]["count"], -kv[1]["kg"]))[:10]
    return {
        "total_seizures": len(seizures),
        "total_quantity_kg": round(sum(s.get("quantityKg") or 0 for s in seizures), 2),
        "raids_this_week": sum(1 for s in seizures if s["date"] >= week_ago),
        "by_state": dict(sorted(by_state.items(), key=lambda kv: -kv[1])),
        "by_drug_type": dict(sorted(by_drug.items(), key=lambda kv: -kv[1])),
        "by_month": dict(sorted(by_month.items())),
        "top_locations": [
            {"location": f"{c}, {st}", "city": c, "state": st, "count": v["count"], "kg": round(v["kg"], 2)}
            for (c, st), v in top
        ],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    existing = data["seizures"]
    before = len(existing)
    cities = load_cities()

    added, failures = [], 0
    for q in QUERIES:
        url = RSS_URL.format(q=urllib.parse.quote_plus(q))
        try:
            root = ET.fromstring(fetch(url))
        except Exception as e:  # one bad feed shouldn't sink the run
            failures += 1
            print(f"[warn] {q!r}: {e}", file=sys.stderr)
            continue
        for item in root.iter("item"):
            r = item_to_record(item, cities)
            if r and is_valid(r) and not is_duplicate(r, existing + added):
                added.append(r)

    if failures == len(QUERIES):
        sys.exit("All feeds failed; leaving data.json untouched.")

    for r in added:
        print(f"+ {r['date']} {r['city']:<15} {r['drugType']:<9} {r['quantityKg']:>9} kg  {r['description'][:70]}")
    print(f"{len(added)} new, {before} existing")

    merged = sorted(existing + added, key=lambda s: s["date"], reverse=True)
    assert len(merged) >= before, "refusing to shrink the dataset"

    if args.dry_run or not added:
        return

    data["seizures"] = merged
    data["stats"] = compute_stats(merged)
    data["lastUpdated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    DATA_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
