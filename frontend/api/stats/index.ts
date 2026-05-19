import type { VercelRequest, VercelResponse } from '@vercel/node';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    // Get total seizures count
    const { count: totalSeizures } = await supabase
      .from('seizures')
      .select('*', { count: 'exact', head: true });

    // Get total quantity
    const { data: allSeizures } = await supabase
      .from('seizures')
      .select('quantity_kg');

    const totalQuantityKg = allSeizures?.reduce((sum, s) => sum + Number(s.quantity_kg), 0) ?? 0;

    // Raids this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { count: raidsThisWeek } = await supabase
      .from('seizures')
      .select('*', { count: 'exact', head: true })
      .gte('date_iso', weekAgo);

    // By state
    const { data: byStateData } = await supabase
      .from('seizures')
      .select('state, quantity_kg');

    const byState: Record<string, number> = {};
    byStateData?.forEach(s => {
      byState[s.state] = (byState[s.state] ?? 0) + Number(s.quantity_kg);
    });

    // By drug type
    const { data: byDrugData } = await supabase
      .from('seizures')
      .select('drug_type, quantity_kg');

    const byDrugType: Record<string, number> = {};
    byDrugData?.forEach(s => {
      byDrugType[s.drug_type] = (byDrugType[s.drug_type] ?? 0) + Number(s.quantity_kg);
    });

    // By month (last 12 months)
    const { data: byMonthData } = await supabase
      .from('seizures')
      .select('date_iso, quantity_kg');

    const byMonth: Record<string, number> = {};
    byMonthData?.forEach(s => {
      const month = s.date_iso.substring(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] ?? 0) + Number(s.quantity_kg);
    });

    // Top locations
    const { data: topLocData } = await supabase
      .from('seizures')
      .select('city, state, quantity_kg');

    const locMap: Record<string, { city: string; state: string; count: number; kg: number }> = {};
    topLocData?.forEach(s => {
      const key = `${s.city},${s.state}`;
      if (!locMap[key]) locMap[key] = { city: s.city, state: s.state, count: 0, kg: 0 };
      locMap[key].count++;
      locMap[key].kg += Number(s.quantity_kg);
    });

    const topLocations = Object.values(locMap)
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 10)
      .map(l => ({ city: l.city, state: l.state, seizureCount: l.count, totalKg: l.kg }));

    res.status(200).json({
      total_seizures: totalSeizures ?? 0,
      total_quantity_kg: Math.round(totalQuantityKg * 100) / 100,
      raids_this_week: raidsThisWeek ?? 0,
      by_state: byState,
      by_drug_type: byDrugType,
      by_month: byMonth,
      top_locations: topLocations,
    });
  } catch (err: any) {
    console.error('[/api/stats]', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}