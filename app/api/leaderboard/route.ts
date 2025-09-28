import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  if (!supabase) return NextResponse.json({ top: [], season: null });

  try {
    // Get current week's leaderboard
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of current week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999);

    const season = {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0]
    };

    // Get weekly stats for current season
    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select(`
        address,
        alias,
        pfp_url,
        wins,
        draws,
        losses,
        points
      `)
      .eq('season', season.start)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching weekly leaderboard:', error);
      return NextResponse.json({ top: [], season });
    }

    const top = (data || []).map((r, i) => ({ 
      rank: i + 1, 
      address: r.address, 
      alias: r.alias ?? undefined, 
      pfpUrl: r.pfp_url ?? undefined, 
      wins: Number(r.wins), 
      draws: Number(r.draws), 
      losses: Number(r.losses), 
      points: Number(r.points),
      fid: r.fid
    }));

    return NextResponse.json({ top, season });

  } catch (error) {
    console.error('Weekly leaderboard error:', error);
    return NextResponse.json({ top: [], season: null });
  }
}