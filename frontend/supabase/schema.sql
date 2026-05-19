-- ============================================================
-- NARC KART — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- SEIZURES TABLE
-- ============================================================
create table if not exists seizures (
  id uuid default uuid_generate_v4() primary key,
  city text not null,
  state text not null,
  lat numeric(9,6) not null,
  lon numeric(9,6) not null,
  drug_type text not null check (drug_type in ('heroin','cocaine','meth','cannabis','methaqualone','other')),
  quantity_kg numeric(12,3) not null,
  date_iso text not null,
  source_name text,
  source_url text,
  agency text default 'NCB',
  images text[] default '{}',
  case_no text,
  description text,
  created_at timestamptz default now(),
  raw_text text,
  is_verified boolean default false
);

-- Enable realtime
alter publication supabase_realtime add table seizures;

-- Indexes
create index if not exists seizures_geo_idx on seizures (lat, lon);
create index if not exists seizures_date_idx on seizures (date_iso desc);
create index if not exists seizures_state_idx on seizures (state);
create index if not exists seizures_drug_idx on seizures (drug_type);

-- RLS: public read (app has no auth)
alter table seizures enable row level security;
create policy "Public read" on seizures for select using (true);
create policy "Public insert" on seizures for insert with check (true);

-- ============================================================
-- FEED SOURCES TABLE (for scraper)
-- ============================================================
create table if not exists feed_sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  url text not null unique,
  type text not null check (type in ('ncb', 'rss', 'newsapi')),
  enabled boolean default true,
  last_fetched_at timestamptz,
  last_error text
);

-- ============================================================
-- RAW ARTICLES TABLE (pre-geocoding)
-- ============================================================
create table if not exists raw_articles (
  id uuid primary key default uuid_generate_v4(),
  source_url text unique,
  title text,
  content text,
  published_at timestamptz,
  ingested_at timestamptz default now(),
  status text default 'pending' check (status in ('pending','processed','failed'))
);

-- ============================================================
-- SEED DATA — migrate from static data.json
-- Only insert if table is empty
-- ============================================================
insert into seizures (city, state, lat, lon, drug_type, quantity_kg, date_iso, source_name, source_url, agency, description)
select * from (
  values
  ('Mumbai','Maharashtra',19.076,72.877,'heroin',156.5,'2026-04-20','Narcotics Control Bureau','https://www.ncb.gov.in','Narcotics Control Bureau','Major heroin seizure at JNPT port. 156.5 kg worth Rs 500 crore.'),
  ('Delhi','Delhi',28.704,77.102,'cocaine',23.0,'2026-04-18','Delhi Police','https://police.delhi.gov.in','Delhi Police','Cocaine seizure during routine check at Azadpur. 23 kg, Rs 115 crore.'),
  ('Amritsar','Punjab',31.634,74.878,'cannabis',450.0,'2026-04-15','Punjab Police','https://punjabpolice.gov.in','Punjab Police','Large cannabis cache found near Indo-Pak border at Attari. 450 kg.'),
  ('Chennai','Tamil Nadu',13.083,80.217,'meth',8.5,'2026-04-22','TN CID','https://www.tnpolice.gov.in','Tamil Nadu CID','Meth tablets seized from express parcel. 8.5 kg.'),
  ('Kolkata','West Bengal',22.573,88.363,'methaqualone',67.0,'2026-04-10','Bengal Police','https://westbengalpolice.gov.in','West Bengal Police','Methaqualone (Spasmo-Proxyvon) seized from Bangladesh border.'),
  ('Ahmedabad','Gujarat',23.022,72.571,'meth',31.0,'2026-04-17','DRI Gujarat','https://dri.gov.in','Directorate of Revenue Intelligence','Meth shipment from Kandla port. 31 kg concealed in machinery.'),
  ('Goa','Goa',15.299,74.086,'cocaine',12.0,'2026-04-19','Goa Police','https://goapolice.gov.in','Goa Police','Cocaine seized from foreign tourist at Dabolim airport.'),
  ('Bangalore','Karnataka',12.972,77.594,'heroin',5.2,'2026-04-21','NCB Bengaluru','https://www.ncb.gov.in','Narcotics Control Bureau','Heroin seized from air cargo. 5.2 kg hidden in electronic items.'),
  ('Hyderabad','Telangana',17.385,78.486,'meth',14.8,'2026-04-23','TS Police','https://www.tspolice.gov.in','Telangana Police','Meth lab busted in Medchal. 14.8 kg finished product + 200L precursor.'),
  ('Pune','Maharashtra',18.520,73.856,'cannabis',88.0,'2026-04-24','Maharashtra Police','https://mahapolice.gov.in','Maharashtra Police','Cannabis bound for Mumbai seized from Pune-Bengaluru highway.'),
  ('Surat','Gujarat',21.170,72.829,'meth',22.3,'2026-04-25','DRI Surat','https://dri.gov.in','Directorate of Revenue Intelligence','Meth from Dahej port. 22.3 kg in plastic granule bags.'),
  ('Jaipur','Rajasthan',26.912,75.788,'heroin',41.0,'2026-04-26','NCB Jaipur','https://www.ncb.gov.in','Narcotics Control Bureau','Heroin seized at Jaipur railway station. 41 kg in goods compartment.'),
  ('Lucknow','Uttar Pradesh',26.845,80.946,'methaqualone',156.0,'2026-04-27','UP STF','https://uppolice.gov.in','Uttar Pradesh STF','Spasmo-Proxyvon tablets from pharma companies. 156 kg.'),
  ('Mandalay','Myanmar',21.975,96.083,'heroin',220.0,'2026-03-15',' Assam Police','https://assampolice.gov.in','Assam Police','Border seizure along Indo-Myanmar border. 220 kg heroin.'),
  ('Nagpur','Maharashtra',21.146,79.082,'cannabis',330.0,'2026-04-28','Maharashtra Police','https://mahapolice.gov.in','Maharashtra Police','Cannabis forest near Nagpur. 330 kg destroyed in place.'),
  ('Indore','Madhya Pradesh',22.720,75.880,'meth',9.7,'2026-04-29','MP Police','https://mppolice.gov.in','Madhya Pradesh Police','Meth from Indore railway station. 9.7 kg in luggage.'),
  ('Chandigarh','Chandigarh',30.733,76.779,'cannabis',175.0,'2026-04-30','UT Police','https://chandigarhpolice.gov.in','Chandigarh Police','Cannabis from Himachal Pradesh bound for Delhi. 175 kg.'),
  ('Varanasi','Uttar Pradesh',25.318,82.992,'heroin',28.5,'2026-05-01','NCB Lucknow','https://www.ncb.gov.in','Narcotics Control Bureau','Heroin at Varanasi railway station. 28.5 kg in goods wagon.'),
  ('Patna','Bihar',25.594,85.138,'meth',18.2,'2026-05-02','Bihar Police','https://www.biharpolice.gov.in','Bihar Police','Meth from Raxaul border. 18.2 kg in fuel tanker.'),
  ('Kochi','Kerala',9.931,76.267,'cocaine',3.8,'2026-05-03','Kerala Police','https://www.keralapolice.gov.in','Kerala Police','Cocaine at Cochin airport from Dubai. 3.8 kg.')
) as t(city, state, lat, lon, drug_type, quantity_kg, date_iso, source_name, source_url, agency, description)
where not exists (select 1 from seizures limit 1);