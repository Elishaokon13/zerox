import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  try {
    // Get current week start
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);
    const currentWeek = monday.toISOString().slice(0, 10);

    // Get top 3 players from all-time leaderboard
    const { data: allTimeData, error: allTimeError } = await supabase
      .rpc('get_alltime_leaderboard')
      .limit(3);

    if (allTimeError) {
      console.error('Error fetching all-time data:', allTimeError);
      return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
    }

    if (!allTimeData || allTimeData.length === 0) {
      return NextResponse.json({ 
        currentWeek,
        totalGrantAmount: 1200,
        weeklyBudget: 80,
        weeksRemaining: 15,
        distribution: [],
        totalDistributed: 0,
        remainingGrant: 1200
      });
    }

    // Calculate total points for top 3
    const totalPoints = allTimeData.reduce((sum: number, player: any) => sum + (Number(player.points) || 0), 0);

    // Calculate distribution percentages and amounts
    const distribution = allTimeData.map((player: any, index: number) => {
      const points = Number(player.points) || 0;
      const percentage = totalPoints > 0 ? (points / totalPoints) * 100 : 0;
      const weeklyAmount = totalPoints > 0 ? (points / totalPoints) * 80 : 0; // $80 weekly budget
      
      return {
        rank: index + 1,
        address: player.address,
        alias: player.alias,
        points: points,
        percentage: Math.round(percentage * 100) / 100,
        weeklyAmount: Math.round(weeklyAmount * 100) / 100,
        totalAmount: Math.round(weeklyAmount * 15 * 100) / 100 // 15 weeks total
      };
    });

    // Calculate totals
    const totalDistributed = distribution.reduce((sum: number, player: any) => sum + player.totalAmount, 0);
    const remainingGrant = 1200 - totalDistributed;

    return NextResponse.json({
      currentWeek,
      totalGrantAmount: 1200,
      weeklyBudget: 80,
      weeksRemaining: 15,
      distribution,
      totalDistributed: Math.round(totalDistributed * 100) / 100,
      remainingGrant: Math.round(remainingGrant * 100) / 100
    });

  } catch (error) {
    console.error('Error in grant distribution API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  try {
    const { week, distributions } = await request.json();

    if (!week || !distributions || !Array.isArray(distributions)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Record grant distributions for the week
    const grantRecords = distributions.map((dist: any) => ({
      week_start: week,
      recipient_address: dist.address,
      recipient_alias: dist.alias,
      points: dist.points,
      percentage: dist.percentage,
      amount_usd: dist.weeklyAmount,
      amount_eth: dist.amountEth || 0,
      distributed_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('grant_distributions')
      .insert(grantRecords);

    if (insertError) {
      console.error('Error inserting grant distributions:', insertError);
      return NextResponse.json({ error: 'Failed to record grant distributions' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Grant distributions recorded for week ${week}`,
      records: grantRecords.length
    });

  } catch (error) {
    console.error('Error in grant distribution POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
