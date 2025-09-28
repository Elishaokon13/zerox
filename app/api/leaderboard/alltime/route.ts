import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  if (!supabase) return NextResponse.json({ top: [] });

  // Get all-time stats aggregated by address
  const { data, error } = await supabase
    .rpc('get_alltime_leaderboard')
    .limit(10);

  if (error) return NextResponse.json({ top: [] });

  const top = (data || []).map((r: { address: string; alias?: string | null; pfp_url?: string | null; wins: number; draws: number; losses: number; points: number; fid?: number; }, i: number) => ({ 
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

  return NextResponse.json({ top });
}