import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;
  
  if (!supabase) return NextResponse.json({ top: [], pagination: { page, limit, hasMore: false } });

  // Get all-time stats aggregated by address
  const { data, error } = await supabase
    .rpc('get_alltime_leaderboard')
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ top: [], pagination: { page, limit, hasMore: false } });

  const top = (data || []).map((r: { address: string; alias?: string | null; pfp_url?: string | null; wins: number; draws: number; losses: number; points: number; fid?: number; }, i: number) => ({ 
    rank: offset + i + 1, 
    address: r.address, 
    alias: r.alias ?? undefined, 
    pfpUrl: r.pfp_url ?? undefined, 
    wins: Number(r.wins), 
    draws: Number(r.draws), 
    losses: Number(r.losses), 
    points: Number(r.points),
    fid: r.fid
  }));

  // Check if there are more entries
  const hasMore = data && data.length === limit;

  return NextResponse.json({ 
    top, 
    pagination: { page, limit, hasMore }
  });
}