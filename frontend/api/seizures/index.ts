import type { VercelRequest, VercelResponse } from '@vercel/node';

// Supabase admin SDK — uses SERVICE_ROLE key (server-side only)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const {
      time_period = 'all',
      drug_type,
      state,
      severity_min = '0',
      severity_max = '500',
      limit = '100',
    } = req.query;

    let query = supabase
      .from('seizures')
      .select('*')
      .order('date_iso', { ascending: false })
      .limit(Number(limit));

    // Filter by drug type
    if (drug_type) {
      query = query.eq('drug_type', drug_type);
    }

    // Filter by state
    if (state) {
      query = query.eq('state', state);
    }

    // Filter by severity (quantity kg)
    query = query
      .gte('quantity_kg', Number(severity_min))
      .lte('quantity_kg', Number(severity_max));

    // Filter by time period
    if (time_period !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (time_period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }
      query = query.gte('date_iso', startDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      seizures: data,
      total: data?.length ?? 0,
    });
  } catch (err: any) {
    console.error('[/api/seizures]', err.message);
    res.status(500).json({ error: 'Failed to fetch seizures' });
  }
}