import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    // Fetch recent grants history
    const { data: history, error: historyError } = await supabase
      .from('weekly_grants')
      .select('*')
      .order('week_start', { ascending: false })
      .order('rank', { ascending: true })
      .limit(200);

    if (historyError) {
      console.error('Error fetching grants history:', historyError);
      return NextResponse.json({ error: 'Failed to fetch grants history' }, { status: 500 });
    }

    const safeHistory = (history || []).map((row) => ({
      week_start: row.week_start,
      rank: Number(row.rank),
      address: row.address,
      alias: row.alias || null,
      weekly_points: Number(row.weekly_points) || 0,
      percentage: Number(row.percentage) || 0,
      amount_usdc: Number(row.amount_usdc) || 0,
      tx_hash: row.tx_hash || null,
      tx_status: row.tx_status || 'pending',
      distributed_at: row.distributed_at || null,
    }));

    return NextResponse.json({
      history: safeHistory,
      total: safeHistory.length
    });

  } catch (error) {
    console.error('Weekly grants history API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
