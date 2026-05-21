import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cron-triggered scraper endpoint
// Vercel cron hits this every 6 hours
// Alternatively can be triggered manually via POST

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Simple in-memory geocoder (no external API needed)
const INDIAN_CITIES: Record<string, [number, number]> = {
  mumbai: [19.076, 72.877],
  delhi: [28.704, 77.102],
  chennai: [13.083, 80.217],
  kolkata: [22.573, 88.363],
  bangalore: [12.972, 77.594],
  hyderabad: [17.385, 78.486],
  pune: [18.52, 73.856],
  ahmedabad: [23.022, 72.571],
  jaipur: [26.912, 75.788],
  lucknow: [26.845, 80.946],
  goa: [15.299, 74.086],
  chandigarh: [30.733, 76.779],
  patna: [25.594, 85.138],
  kochi: [9.931, 76.267],
  surat: [21.17, 72.829],
  nagpur: [21.146, 79.082],
  indore: [22.72, 75.88],
  varanasi: [25.318, 82.992],
};

function roughGeocode(city: string): [number, number] {
  const normalized = city.toLowerCase().trim();
  if (INDIAN_CITIES[normalized]) return INDIAN_CITIES[normalized];
  // Fallback: return center of India
  return [20.5937, 78.9625];
}

// Parse quantity from text like "156.5 kg", "2.5 tonnes"
function parseQuantity(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|kilograms?|tonnes?|quintals?)/i);
  if (!match) return 0;
  let qty = parseFloat(match[1]);
  if (/tonne/i.test(match[2])) qty *= 1000;
  if (/quintal/i.test(match[2])) qty *= 100;
  return qty;
}

interface ScraperResult {
  city: string;
  state: string;
  drug_type: string;
  quantity_kg: number;
  date_iso: string;
  source_name: string;
  source_url: string;
  agency: string;
  description: string;
}

async function scrapeNCB(): Promise<ScraperResult[]> {
  // NCB website structure changes frequently
  // This is a simplified scraper — real implementation would use Playwright
  // For now, we'll return empty and rely on RSS/API sources
  console.log('[scrape] NCB scraper stub — returning empty (needs Playwright for JS-rendered pages)');
  return [];
}

async function scrapeRSSFeeds(): Promise<ScraperResult[]> {
  // Google News RSS for drug seizure news
  const rssFeeds = [
    'https://news.google.com/rss/search?q=drug+seizure+India+NCB&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=narcotics+seizure+India&hl=en-IN&gl=IN&ceid=IN:en',
  ];

  const results: ScraperResult[] = [];

  for (const feedUrl of rssFeeds) {
    try {
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=10`);
      if (!res.ok) continue;
      const data = await res.json() as any;
      if (data.status !== 'ok') continue;

      for (const item of data.items ?? []) {
        const title = item.title ?? '';
        const content = (item.content ?? item.description ?? '');

        // Extract drug type
        let drugType = 'other';
        if (/heroin|i.e\. heroin/i.test(content)) drugType = 'heroin';
        else if (/cocaine/i.test(content)) drugType = 'cocaine';
        else if (/meth|ice|crystal/i.test(content)) drugType = 'meth';
        else if (/cannabis|ganja|weed|charas|hashish/i.test(content)) drugType = 'cannabis';
        else if (/tramadol|spasmo|methaqualone/i.test(content)) drugType = 'methaqualone';

        // Skip if no drug mentioned
        if (drugType === 'other') continue;

        // Extract city (simple pattern matching)
        const cityMatch = title.match(/in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)[,\s]/);
        const city = cityMatch ? cityMatch[1] : 'Unknown';
        const [lat, lon] = roughGeocode(city);

        // Extract quantity
        const quantityKg = parseQuantity(content) || parseQuantity(title);

        // Extract date
        const dateStr = item.pubDate
          ? new Date(item.pubDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        results.push({
          city,
          state: 'India',
          drug_type: drugType,
          quantity_kg: quantityKg || 1,
          date_iso: dateStr,
          source_name: item.author ?? 'News Source',
          source_url: item.link ?? '',
          agency: 'NCB',
          description: title,
        });
      }
    } catch (err) {
      console.warn(`[scrape] RSS feed failed: ${feedUrl}`, err);
    }
  }

  return results;
}

async function main() {
  console.log('[scrape] Starting scrape job at', new Date().toISOString());

  // Scrape from multiple sources in parallel
  const [ncbResults, rssResults] = await Promise.allSettled([
    scrapeNCB(),
    scrapeRSSFeeds(),
  ]);

  const newSeizures = [
    ...(ncbResults.status === 'fulfilled' ? ncbResults.value : []),
    ...(rssResults.status === 'fulfilled' ? rssResults.value : []),
  ];

  console.log(`[scrape] Found ${newSeizures.length} potential seizures`);

  // Deduplicate by source_url (don't re-ingest same article)
  for (const seizure of newSeizures) {
    if (!seizure.source_url) continue;

    const { data: existing } = await supabase
      .from('seizures')
      .select('id')
      .eq('source_url', seizure.source_url)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[scrape] Duplicate skip: ${seizure.source_url}`);
      continue;
    }

    const { error } = await supabase.from('seizures').insert(seizure);
    if (error) {
      console.warn(`[scrape] Insert failed:`, error.message);
    } else {
      console.log(`[scrape] Inserted: ${seizure.city} — ${seizure.drug_type} ${seizure.quantity_kg}kg`);
    }
  }

  return newSeizures.length;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Optional: verify cron secret to prevent unauthorized triggers
  const cronSecret = req.headers['authorization'];
  if (process.env.CRON_SECRET && cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const count = await main();
    res.status(200).json({
      success: true,
      seizures_scraped: count,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[scrape] Job failed:', err);
    res.status(500).json({ error: err.message ?? 'Scrape job failed' });
  }
}