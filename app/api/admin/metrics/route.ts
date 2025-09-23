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

    // Get all-time leaderboard data for top players
    const { data: allTimeData, error: allTimeError } = await supabase
      .rpc('get_alltime_leaderboard')
      .limit(100);

    if (allTimeError) {
      console.error('Error fetching all-time data:', allTimeError);
      return NextResponse.json({ error: 'Failed to fetch all-time data' }, { status: 500 });
    }

    // Get total unique players count from leaderboard_entries
    const { data: uniquePlayers, error: totalPlayersError } = await supabase
      .from('leaderboard_entries')
      .select('address')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        // Get unique addresses
        const uniqueAddresses = new Set(data?.map(entry => entry.address) || []);
        return { data: Array.from(uniqueAddresses), error: null };
      });

    if (totalPlayersError) {
      console.error('Error fetching total players count:', totalPlayersError);
    }

    // Get current week leaderboard data
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('season', currentWeek);

    if (weeklyError) {
      console.error('Error fetching weekly data:', weeklyError);
      return NextResponse.json({ error: 'Failed to fetch weekly data' }, { status: 500 });
    }

    // Get payout logs for total payouts
    const { data: payoutLogs, error: payoutError } = await supabase
      .from('payout_logs')
      .select('total_amount');

    if (payoutError) {
      console.error('Error fetching payout logs:', payoutError);
    }

    // Get charge logs for total charges
    const { data: chargeLogs, error: chargeError } = await supabase
      .from('charge_logs')
      .select('total_amount');

    if (chargeError) {
      console.error('Error fetching charge logs:', chargeError);
    }

    // Get weekly payouts for current week
    const { data: weeklyPayouts, error: weeklyPayoutError } = await supabase
      .from('weekly_payouts')
      .select('amount_eth')
      .eq('week_start', currentWeek);

    if (weeklyPayoutError) {
      console.error('Error fetching weekly payouts:', weeklyPayoutError);
    }

    // Calculate metrics
    const totalPoints = allTimeData?.reduce((sum: number, player: any) => sum + (Number(player.points) || 0), 0) || 0;
    const totalPlayers = uniquePlayers?.length || 0; // Use actual unique players count
    const weeklyActiveUsers = weeklyData?.length || 0;
    
    const totalPayouts = payoutLogs?.reduce((sum: number, log: any) => sum + (Number(log.total_amount) || 0), 0) || 0;
    const totalCharges = chargeLogs?.reduce((sum: number, log: any) => sum + (Number(log.total_amount) || 0), 0) || 0;
    const currentWeekPayouts = weeklyPayouts?.reduce((sum: number, payout: any) => sum + (Number(payout.amount_eth) || 0), 0) || 0;

    // Get recent game sessions for activity feed
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('game_sessions')
      .select('address, result, created_at, settled')
      .order('created_at', { ascending: false })
      .limit(10);

    if (sessionsError) {
      console.error('Error fetching recent sessions:', sessionsError);
    }

    // Format recent activity
    const recentActivity = recentSessions?.map((session: any) => ({
      type: session.result === 'win' ? 'payout' : session.result === 'loss' ? 'charge' : 'game',
      amount: session.result === 'win' ? 0.00002 : session.result === 'loss' ? 0.00002 : undefined,
      address: session.address,
      timestamp: session.created_at,
      description: `Game ${session.result} - ${session.settled ? 'Settled' : 'Pending'}`
    })) || [];

    return NextResponse.json({
      totalPoints,
      totalPlayers,
      totalPayouts,
      totalCharges,
      weeklyActiveUsers,
      allTimeActiveUsers: totalPlayers,
      currentWeekPayouts,
      recentActivity
    });

  } catch (error) {
    console.error('Error in metrics API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
