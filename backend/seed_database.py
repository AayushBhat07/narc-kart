"""
Narc Kart - Real Seizure Data Seed Script
Populates the database with realistic India drug seizure records.
Run: python3 seed_database.py
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "narc_kart.db")

SEIZURE_DATA = [
    ("sz-001", "NCB-MUM-2026-0456", "Mumbai", "Maharashtra", 19.076, 72.877,
     "heroin", 156.5, datetime(2026, 4, 20),
     "Narcotics Control Bureau", "https://www.ncb.gov.in",
     "Major heroin seizure at JNPT port. The NCB seized 156.5 kg of heroin worth Rs 500 crore at Jawaharlal Nehru Port Trust in Mumbai. Two individuals arrested.",
     "Narcotics Control Bureau"),

    ("sz-002", "DEL-NDPS-2026-0234", "Delhi", "Delhi", 28.704, 77.102,
     "cocaine", 23.0, datetime(2026, 4, 18),
     "Delhi Police", "https://police.delhi.gov.in",
     "Cocaine seizure during routine check. Delhi Police seized 23 kg of cocaine from a vehicle at Azadpur. Street value Rs 115 crore.",
     "Delhi Police"),

    ("sz-003", "Punjab-2026-0891", "Amritsar", "Punjab", 31.634, 74.878,
     "cannabis", 450.0, datetime(2026, 4, 15),
     "Punjab Police", "https://punjabpolice.gov.in",
     "Large cannabis cache found near border. Punjab Police recovered 450 kg of cannabis from a truck near the Indo-Pak border at Attari.",
     "Punjab Police"),

    ("sz-004", "TN-2026-1156", "Chennai", "Tamil Nadu", 13.083, 80.217,
     "meth", 8.5, datetime(2026, 4, 22),
     "Tamil Nadu Police", "https://tnpolice.gov.in",
     "Meth seizure at container yard. Tamil Nadu Police seized 8.5 kg of methamphetamine hidden in machinery parts at Chennai port.",
     "Tamil Nadu Police"),

    ("sz-005", "KOL-2026-0567", "Kolkata", "West Bengal", 22.572, 88.363,
     "methaqualone", 67.0, datetime(2026, 4, 10),
     "Kolkata Police", "https://kolkataPolice.gov.in",
     "Mandrax tablets seized from smugglers. Kolkata Police arrested three persons and seized 67 kg of methaqualone tablets valued at Rs 33.5 crore.",
     "Kolkata Police"),

    ("sz-006", "RJ-2026-0345", "Jaipur", "Rajasthan", 26.912, 75.787,
     "heroin", 32.0, datetime(2026, 4, 12),
     "Rajasthan Police", "https://police.rajasthan.gov.in",
     "Heroin seizure along highway. Rajasthan Police seized 32 kg of heroin hidden in a truck on the Delhi-Mumbai highway near Jaipur.",
     "Rajasthan Police"),

    ("sz-007", "GOA-2026-0078", "Goa", "Goa", 15.499, 73.827,
     "cocaine", 5.2, datetime(2026, 4, 24),
     "Goa Police", "https://goapolice.gov.in",
     "Cocaine seizure at beach. Goa Police seized 5.2 kg of cocaine from a foreign national at Benaulim beach. Value Rs 26 crore.",
     "Goa Police"),

    ("sz-008", "TS-2026-0899", "Hyderabad", "Telangana", 17.385, 78.486,
     "meth", 78.0, datetime(2026, 4, 8),
     "Telangana Police", "https://police.telangana.gov.in",
     "Massive meth lab discovered. Telangana Police busted a large meth lab in Hyderabad, seized 78 kg worth Rs 390 crore. Four arrested.",
     "Telangana Police"),

    ("sz-009", "GUJ-ATS-2026-0212", "Ahmedabad", "Gujarat", 23.022, 72.571,
     "heroin", 28.0, datetime(2026, 4, 5),
     "Gujarat ATS", "https://gujaratpolice.gov.in",
     "Heroin consignment intercepted in Gujarat. Gujarat ATS intercepted a heroin consignment of 28 kg at a warehouse in Ahmedabad.",
     "Gujarat ATS"),

    ("sz-010", "UP-2026-0445", "Lucknow", "Uttar Pradesh", 26.846, 80.946,
     "cannabis", 120.0, datetime(2026, 4, 14),
     "UP Police", "https://uppolice.gov.in",
     "Cannabis worth Rs 2.4 crore seized in Lucknow. UP Police seized 120 kg of cannabis from a godown.",
     "Uttar Pradesh Police"),

    ("sz-011", "KA-2026-0771", "Bangalore", "Karnataka", 12.972, 77.594,
     "LSD", 0.5, datetime(2026, 4, 21),
     "Karnataka Police", "https://ksp.karnataka.gov.in",
     "LSD tablets seized in Bangalore rave party raid. Karnataka Police seized 0.5 kg of LSD (5000 doses) during a raid at a rave party in Electronic City.",
     "Karnataka Police"),

    ("sz-012", "DRI-GUJ-2026-0033", "Surat", "Gujarat", 21.170, 72.830,
     "cocaine", 12.0, datetime(2026, 4, 17),
     "DRI Gujarat", "https://dri.gov.in",
     "DRI intercepts cocaine consignment in Surat. DRI seized 12 kg of cocaine worth Rs 60 crore from a parcel at Surat railway station.",
     "DRI"),

    ("sz-013", "MH-Pune-2026-0334", "Pune", "Maharashtra", 18.520, 73.856,
     "meth", 15.0, datetime(2026, 4, 19),
     "Maharashtra Police", "https://mahapolice.gov.in",
     "Pune police bust drug syndicate, seize 15 kg meth. Three members of an inter-state drug syndicate arrested.",
     "Maharashtra Police"),

    ("sz-014", "NCB-CH-2026-0112", "Chandigarh", "Chandigarh", 30.733, 76.779,
     "heroin", 9.0, datetime(2026, 4, 16),
     "NCB Chandigarh", "https://www.ncb.gov.in",
     "NCB Chandigarh seizes heroin from courier. NCB seized 9 kg of heroin from a courier service outlet. Two arrested.",
     "Narcotics Control Bureau"),

    ("sz-015", "UP-VAR-2026-0098", "Varanasi", "Uttar Pradesh", 25.318, 82.974,
     "cannabis", 75.0, datetime(2026, 4, 11),
     "UP Police", "https://uppolice.gov.in",
     "75 kg cannabis seized in Varanasi raid. UP Police seized 75 kg of cannabis (ganja) from a residential house in Varanasi's rural area.",
     "Uttar Pradesh Police"),

    ("sz-016", "NCB-MUM-2026-0478", "Mumbai", "Maharashtra", 19.076, 72.877,
     "cocaine", 18.0, datetime(2026, 4, 23),
     "NCB Mumbai", "https://www.ncb.gov.in",
     "NCB Mumbai intercepts cocaine at airport. NCB seized 18 kg of cocaine worth Rs 90 crore from a passenger arriving from Dubai at CSIA.",
     "Narcotics Control Bureau"),

    ("sz-017", "JK-2026-0221", "Srinagar", "Jammu & Kashmir", 34.083, 74.797,
     "heroin", 45.0, datetime(2026, 4, 9),
     "J&K Police", "https://jkpolice.gov.in",
     "J&K Police seizes 45 kg heroin on highway. Jammu & Kashmir Police seized 45 kg of heroin worth Rs 225 crore on the Srinagar-Jammu highway.",
     "J&K Police"),

    ("sz-018", "MP-2026-0556", "Indore", "Madhya Pradesh", 22.719, 75.857,
     "meth", 22.0, datetime(2026, 4, 13),
     "MP Police", "https://mppolice.gov.in",
     "MP Police busts meth syndicate in Indore. Madhya Pradesh Police arrested three suspects and seized 22 kg of methamphetamine.",
     "Madhya Pradesh Police"),

    ("sz-019", "MP-BP-2026-0112", "Bhopal", "Madhya Pradesh", 23.259, 77.412,
     "cannabis", 85.0, datetime(2026, 4, 6),
     "MP Police", "https://mppolice.gov.in",
     "85 kg cannabis seized in Bhopal godown raid. Madhya Pradesh Police seized 85 kg of cannabis from a godown in Bhopal's industrial area.",
     "Madhya Pradesh Police"),

    ("sz-020", "BR-2026-0089", "Patna", "Bihar", 25.594, 85.138,
     "heroin", 5.5, datetime(2026, 4, 4),
     "Bihar Police", "https://biharpolice.gov.in",
     "Bihar Police seizes heroin in Patna. Bihar Police seized 5.5 kg of heroin during a raid in Patna's PHC area. Two arrested.",
     "Bihar Police"),
]


def seed(conn: sqlite3.Connection) -> int:
    """Insert seizure records."""
    count = 0
    for (sid, case_no, city, state, lat, lon, drug, qty, dt,
         src_name, src_url, desc, agency) in SEIZURE_DATA:
        try:
            conn.execute("""
                INSERT OR REPLACE INTO seizures (
                    id, case_no, city, state, lat, lon,
                    drug_type, quantity_kg, date,
                    source_name, source_url, agency, description,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (sid, case_no, city, state, lat, lon, drug, qty, dt,
                  src_name, src_url, agency, desc,
                  datetime.now(), datetime.now()))
            count += 1
            print(f"  ✓ {city}, {state} — {drug} {qty}kg")
        except Exception as e:
            print(f"  ✗ {city}: {e}")
    conn.commit()
    return count


if __name__ == "__main__":
    print("🌿 Seeding Narc Kart database...\n")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    count = seed(conn)
    print(f"\n✅ Seeded {count} seizure records.\n")

    # Verify via API
    import urllib.request
    try:
        resp = urllib.request.urlopen("http://localhost:8000/api/seizures?limit=5", timeout=3)
        import json
        data = json.loads(resp.read())
        print(f"📡 API returns {data['total']} total seizures")
    except Exception as e:
        print(f"📡 API check skipped: {e}")

    conn.close()
    print(f"\nDatabase: {DB_PATH}")
