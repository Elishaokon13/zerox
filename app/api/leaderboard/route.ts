/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Inline types used directly in code below

function seasonStartISO(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const daysSinceMonday = (day + 6) % 7; // 0 Mon .. 6 Sun
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start.toISOString().slice(0, 10);
}

function seasonEndISO(): string {
  const start = new Date(seasonStartISO());
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return end.toISOString().slice(0, 10);
}

export async function GET() {
  const season = seasonStartISO();
  if (!supabase) return NextResponse.json({ season: { start: season, end: seasonEndISO() }, top: [], totals: { totalPayoutEth: 0, totalChargeEth: 0, totalUsers: 0 } });
  
  // Get leaderboard data with lifetime tracking info
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select(`
      address,
      alias,
      pfp_url,
      wins,
      draws,
      losses,
      points,
      player_lifetime_tracking!left(
        lifetime_earned_usdc,
        is_capped,
        capped_at
      )
    `)
    .eq('season', season)
    .order('points', { ascending: false })
    .order('wins', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(30);
  
  if (error) return NextResponse.json({ season: { start: season, end: seasonEndISO() }, top: [], totals: { totalPayoutEth: 0, totalChargeEth: 0, totalUsers: 0 } });
  const top = (data || []).map((r: { 
    address: string; 
    alias?: string | null; 
    pfp_url?: string | null; 
    wins: number; 
    draws: number; 
    losses: number; 
    points: number;
    player_lifetime_tracking?: {
      lifetime_earned_usdc: number;
      is_capped: boolean;
      capped_at?: string;
    }[] | null;
  }, i: number) => {
    const lifetimeData = r.player_lifetime_tracking?.[0]; // Get first (and only) record
    return {
      rank: i + 1, 
      address: r.address, 
      alias: r.alias ?? undefined, 
      pfpUrl: r.pfp_url ?? undefined, 
      wins: r.wins, 
      draws: r.draws, 
      losses: r.losses, 
      points: r.points,
      lifetimeEarnedUsdc: lifetimeData?.lifetime_earned_usdc || 0,
      isCapped: lifetimeData?.is_capped || false,
      cappedAt: lifetimeData?.capped_at || null,
      fid: undefined // FID will be undefined for now since we removed the join
    };
  });
  // Totals: sum payouts, charges, and total unique users this season
  let totalPayoutEth = 0;
  let totalChargeEth = 0;
  let totalUsers = 0;
  try {
    const [{ data: payoutRows }, { data: chargeRows }, { count: userCount }] = await Promise.all([
      supabase.from('payout_logs').select('total_amount'),
      supabase.from('charge_logs').select('total_amount'),
      supabase.from('leaderboard_entries').select('address', { count: 'exact', head: true }).eq('season', season)
    ]);
    totalPayoutEth = Array.isArray(payoutRows) ? payoutRows.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0) : 0;
    totalChargeEth = Array.isArray(chargeRows) ? chargeRows.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0) : 0;
    totalUsers = typeof userCount === 'number' ? userCount : 0;
  } catch {}
  return NextResponse.json({ season: { start: season, end: seasonEndISO() }, top, totals: { totalPayoutEth, totalChargeEth, totalUsers } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address: string | undefined = body?.address;
    const result: 'win' | 'loss' | 'draw' | undefined = body?.result;
    const alias: string | undefined = body?.alias;
    if (!address || !result) return NextResponse.json({ error: 'address and result required' }, { status: 400 });
    if (!supabase) return NextResponse.json({ ok: true });

    const addr = address.toLowerCase();
    const season = seasonStartISO();
    const delta = { win: { w: 1, d: 0, l: 0, p: 2 }, draw: { w: 0, d: 1, l: 0, p: 1 }, loss: { w: 0, d: 0, l: 1, p: 2 } }[result];

    // Upsert season row
    // Get the latest entry for this address in this season
    const { data: rows } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('season', season)
      .eq('address', addr)
      .order('updated_at', { ascending: false })
      .limit(1);
    const existing: any = rows && rows.length ? rows[0] : null;
    const next: any = existing ?? { address: addr, alias: alias ?? undefined, pfp_url: null, wins: 0, draws: 0, losses: 0, points: 0 };
    next.wins += delta.w; next.draws += delta.d; next.losses += delta.l; next.points += delta.p;
    if (alias && !next.alias) next.alias = alias;
    if (body?.pfpUrl && !next.pfp_url) next.pfp_url = body.pfpUrl as string;

    const upsertPayload = { season, address: addr, alias: next.alias ?? null, pfp_url: next.pfp_url ?? null, wins: next.wins, draws: next.draws, losses: next.losses, points: next.points };
    const { error } = await supabase
      .from('leaderboard_entries')
      .upsert(upsertPayload, { onConflict: 'season,address' });
    if (error) return NextResponse.json({ ok: false });
    return NextResponse.json({ ok: true, season, entry: next });
  } catch {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

