/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'address required' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const addr = address.toLowerCase();

    // Get total points from all seasons
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('leaderboard_entries')
      .select('points')
      .eq('address', addr);

    if (leaderboardError) {
      console.error('Error fetching leaderboard data:', leaderboardError);
      return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
    }

    // Get referral points
    const { data: referralData, error: referralError } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_address', addr);

    if (referralError) {
      console.error('Error fetching referral data:', referralError);
      return NextResponse.json({ error: 'Failed to fetch referral data' }, { status: 500 });
    }

    // Calculate total points
    const gamePoints = leaderboardData?.reduce((sum: number, entry: { points: number }) => 
      sum + (Number(entry.points) || 0), 0) || 0;
    
    const referralPoints = (referralData?.length || 0) * 2; // 2 points per referral
    const totalPoints = gamePoints + referralPoints;

    return NextResponse.json({
      address: addr,
      gamePoints,
      referralPoints,
      totalPoints,
      totalReferrals: referralData?.length || 0
    });

  } catch (error) {
    console.error('Get user points error:', error);
    return NextResponse.json({ error: 'Failed to fetch user points' }, { status: 500 });
  }
}
