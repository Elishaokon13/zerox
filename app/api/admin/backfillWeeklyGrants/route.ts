import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Generate all Monday dates between start and end
    const start = new Date(startDate);
    const end = new Date(endDate);
    const weeks = [];

    // Find the first Monday on or after start date
    const firstMonday = new Date(start);
    const dayOfWeek = firstMonday.getDay();
    const daysToAdd = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // Sunday = 0, Monday = 1
    firstMonday.setDate(firstMonday.getDate() + daysToAdd);

    // Generate all Mondays in the range
    const currentMonday = new Date(firstMonday);
    while (currentMonday <= end) {
      weeks.push(currentMonday.toISOString().slice(0, 10));
      currentMonday.setDate(currentMonday.getDate() + 7); // Next Monday
    }

    const results = [];
    let processedWeeks = 0;

    for (const weekStart of weeks) {
      try {
        // Check if grants already exist for this week
        const { data: existingGrants } = await supabase
          .from('weekly_grants')
          .select('id')
          .eq('week_start', weekStart)
          .limit(1);

        if (existingGrants && existingGrants.length > 0) {
          results.push({
            week: weekStart,
            status: 'skipped',
            reason: 'Already processed'
          });
          continue;
        }

        // Get weekly distribution calculation
        const { data: distribution, error: distError } = await supabase
          .rpc('calculate_weekly_grant_distribution', { week_start_date: weekStart });

        if (distError) {
          console.error(`Error calculating distribution for ${weekStart}:`, distError);
          results.push({
            week: weekStart,
            status: 'error',
            reason: 'Failed to calculate distribution'
          });
          continue;
        }

        if (!distribution || distribution.length === 0) {
          results.push({
            week: weekStart,
            status: 'skipped',
            reason: 'No eligible players (minimum 100 points required)'
          });
          continue;
        }

        // Create pending grant distributions
        const grantRecords = distribution.map((player: {
          rank: number;
          address: string;
          alias?: string;
          weekly_points: number;
          percentage: number;
          amount_usdc: number;
        }) => ({
          week_start: weekStart,
          rank: Number(player.rank),
          address: player.address,
          alias: player.alias,
          weekly_points: Number(player.weekly_points),
          percentage: Number(player.percentage),
          amount_usdc: Number(player.amount_usdc),
          tx_status: 'pending'
        }));

        const { error: insertError } = await supabase
          .from('weekly_grants')
          .insert(grantRecords);

        if (insertError) {
          console.error(`Error inserting grants for ${weekStart}:`, insertError);
          results.push({
            week: weekStart,
            status: 'error',
            reason: 'Failed to insert grant records'
          });
          continue;
        }

        results.push({
          week: weekStart,
          status: 'success',
          eligiblePlayers: distribution.length,
          totalUsdc: distribution.reduce((sum: number, player: { amount_usdc: number }) => sum + Number(player.amount_usdc), 0)
        });

        processedWeeks++;

      } catch (error) {
        console.error(`Error processing week ${weekStart}:`, error);
        results.push({
          week: weekStart,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfill completed for ${weeks.length} weeks`,
      processedWeeks,
      totalWeeks: weeks.length,
      results
    });

  } catch (error) {
    console.error('Backfill weekly grants error:', error);
    return NextResponse.json({ 
      error: 'Failed to backfill weekly grants',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
