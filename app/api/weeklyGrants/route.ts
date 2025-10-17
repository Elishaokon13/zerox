/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { processUSDCGrantPayments, checkUSDCBalance, isGrantSystemReady, USDCGrantPayment } from '@/lib/grant-payment';

// Use the same week calculation as the leaderboard API (UTC-based)
function seasonStartISO(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const daysSinceMonday = (day + 6) % 7; // 0 Mon .. 6 Sun
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start.toISOString().slice(0, 10);
}

// Get weekly top 5 players and their calculated USDC distribution
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get('week') || seasonStartISO();

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Validate week format (YYYY-MM-DD)
    const weekDate = new Date(weekStart);
    if (isNaN(weekDate.getTime())) {
      return NextResponse.json({ error: 'Invalid week format. Use YYYY-MM-DD' }, { status: 400 });
    }

    // Get top 5 players from leaderboard (without lifetime tracking for now)
    const { data: topPlayers, error } = await supabase
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
      .eq('season', weekStart)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching leaderboard data:', error);
      return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
    }

    if (!topPlayers || topPlayers.length === 0) {
      return NextResponse.json({
        weekStart,
        eligiblePlayers: 0,
        totalPoints: 0,
        totalUsdc: 0,
        distribution: [],
        budget: 100.00,
        remaining: 100.00,
        message: 'No players found for this week'
      });
    }

    // Filter players with 100+ points and calculate distribution
    const eligiblePlayers = topPlayers.filter(player => player.points >= 100);
    const totalPoints = eligiblePlayers.reduce((sum, player) => sum + player.points, 0);
    const weeklyBudget = 100.00; // $100 USDC per week

    const distribution = eligiblePlayers.map((player, index) => {
      const percentage = totalPoints > 0 ? (player.points / totalPoints) * 100 : 0;
      const amountUsdc = totalPoints > 0 ? (player.points / totalPoints) * weeklyBudget : 0;
      
      return {
        address: player.address,
        alias: player.alias,
        pfp_url: player.pfp_url,
        weekly_points: player.points,
        rank: index + 1,
        percentage: Math.round(percentage * 100) / 100,
        amount_usdc: Math.round(amountUsdc * 100) / 100
      };
    });

    const totalUsdc = distribution.reduce((sum, player) => sum + player.amount_usdc, 0);

    return NextResponse.json({
      weekStart,
      eligiblePlayers: eligiblePlayers.length,
      totalPoints,
      totalUsdc,
      distribution,
      budget: weeklyBudget,
      remaining: Math.max(0, weeklyBudget - totalUsdc)
    });

  } catch (error) {
    console.error('Weekly grants GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Process weekly grants (create pending distributions)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { weekStart, dryRun = false } = body;

    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart required' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Check if grants already exist for this week (if table exists)
    let existingGrants: { id: number }[] = [];
    try {
      const { data } = await supabase
        .from('weekly_grants')
        .select('id')
        .eq('week_start', weekStart)
        .limit(1);
      existingGrants = data || [];
    } catch {
      // Table doesn't exist yet, continue with processing
      console.log('weekly_grants table not found, proceeding with grant calculation');
    }

    if (existingGrants && existingGrants.length > 0) {
      return NextResponse.json({ 
        error: 'Grants already exist for this week',
        existing: true 
      }, { status: 409 });
    }

    // Get top 5 players from leaderboard (without lifetime tracking for now)
    const { data: topPlayers, error: distError } = await supabase
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
      .eq('season', weekStart)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .limit(5);

    if (distError) {
      console.error('Error fetching leaderboard data:', distError);
      return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
    }

    if (!topPlayers || topPlayers.length === 0) {
      return NextResponse.json({ 
        message: 'No players found for this week',
        weekStart,
        distribution: []
      });
    }

    // Filter players with 100+ points and calculate distribution
    const eligiblePlayers = topPlayers.filter(player => player.points >= 100);
    
    if (eligiblePlayers.length === 0) {
      return NextResponse.json({ 
        message: 'No eligible players for this week (minimum 100 points required)',
        weekStart,
        distribution: []
      });
    }

    const totalPoints = eligiblePlayers.reduce((sum, player) => sum + player.points, 0);
    const weeklyBudget = 100.00; // $100 USDC per week

    const distribution = eligiblePlayers.map((player, index) => {
      const percentage = (player.points / totalPoints) * 100;
      const amountUsdc = (player.points / totalPoints) * weeklyBudget;
      
      return {
        address: player.address,
        alias: player.alias,
        pfp_url: player.pfp_url,
        weekly_points: player.points,
        rank: index + 1,
        percentage: Math.round(percentage * 100) / 100,
        amount_usdc: Math.round(amountUsdc * 100) / 100
      };
    });

    if (dryRun) {
      const totalUsdc = distribution.reduce((sum, player) => sum + player.amount_usdc, 0);
      return NextResponse.json({
        message: `Dry run successful for week ${weekStart}`,
        weekStart,
        distribution,
        eligiblePlayers: eligiblePlayers.length,
        totalUsdc: totalUsdc,
        dryRun: true
      });
    }

    // Create grant records in database (if table exists)
    const grantRecords = distribution.map((player) => ({
      week_start: weekStart,
      rank: player.rank,
      address: player.address,
      alias: player.alias,
      weekly_points: player.weekly_points,
      percentage: player.percentage,
      amount_usdc: player.amount_usdc,
      tx_status: 'pending'
    }));

    let insertedRecords: { id: number; address: string; amount_usdc: number }[] = [];
    try {
      const { data: insertedData, error: insertError } = await supabase
        .from('weekly_grants')
        .insert(grantRecords)
        .select('id, address, amount_usdc');

      if (insertError) {
        console.error('Error creating grant records:', insertError);
        return NextResponse.json({ error: 'Failed to create grant records' }, { status: 500 });
      }
      insertedRecords = insertedData || [];
    } catch {
      console.log('weekly_grants table not found, skipping database insert');
      // Continue without database insert for now
    }

    // Process USDC payments if system is ready and records were created
    let paymentResults: { id: number; txHash?: string; error?: string; status: 'success' | 'failed' }[] = [];
    if (isGrantSystemReady() && insertedRecords.length > 0) {
      try {
        // Check USDC balance before processing
        const balanceInfo = await checkUSDCBalance();
        const totalRequired = distribution.reduce((sum, player) => sum + player.amount_usdc, 0);
        
        if (balanceInfo.balance < BigInt(Math.floor(totalRequired * 1000000))) { // Convert to 6 decimals
          return NextResponse.json({ 
            error: `Insufficient USDC balance. Required: ${totalRequired} USDC, Available: ${balanceInfo.balanceUsdc} USDC` 
          }, { status: 400 });
        }

        // Prepare payments for processing
        const payments: USDCGrantPayment[] = insertedRecords.map((record) => ({
          id: record.id,
          recipient_address: record.address,
          amount_usdc: record.amount_usdc,
          week_start: weekStart
        }));

        // Process USDC payments
        const paymentResult = await processUSDCGrantPayments(payments);
        paymentResults = paymentResult.results;

        // Update database with transaction hashes
        if (paymentResult.success) {
          for (const result of paymentResults) {
            if (result.status === 'success' && result.txHash) {
              try {
                await supabase
                  .from('weekly_grants')
                  .update({ 
                    tx_hash: result.txHash,
                    tx_status: 'completed',
                    paid_at: new Date().toISOString()
                  })
                  .eq('id', result.id);
              } catch (updateError) {
                console.error(`Failed to update transaction hash for record ${result.id}:`, updateError);
              }
            } else if (result.status === 'failed') {
              try {
                await supabase
                  .from('weekly_grants')
                  .update({ 
                    tx_status: 'failed',
                    error_message: result.error || 'Payment failed'
                  })
                  .eq('id', result.id);
              } catch (updateError) {
                console.error(`Failed to update failed status for record ${result.id}:`, updateError);
              }
            }
          }
        }
      } catch (paymentError) {
        console.error('Error processing USDC payments:', paymentError);
        return NextResponse.json({ 
          error: `Payment processing failed: ${paymentError instanceof Error ? paymentError.message : 'Unknown error'}` 
        }, { status: 500 });
      }
    } else if (insertedRecords.length > 0) {
      console.log('Grant system not ready, payments not processed');
    }

    // Update lifetime tracking for each player (if table exists)
    try {
      for (const player of distribution) {
        // First, get current lifetime earnings
        const { data: currentLifetime, error: fetchError } = await supabase
          .from('player_lifetime_tracking')
          .select('lifetime_earned_usdc, is_capped, capped_at')
          .eq('address', player.address)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error(`Error fetching lifetime data for ${player.address}:`, fetchError);
          continue;
        }

        const currentEarnings = currentLifetime?.lifetime_earned_usdc || 0;
        const newTotalEarnings = currentEarnings + player.amount_usdc;
        const isNowCapped = newTotalEarnings >= 100.00;

        const { error: lifetimeError } = await supabase
          .from('player_lifetime_tracking')
          .upsert({
            address: player.address,
            alias: player.alias,
            lifetime_earned_usdc: newTotalEarnings,
            is_capped: isNowCapped,
            capped_at: isNowCapped && !currentLifetime?.is_capped ? new Date().toISOString() : currentLifetime?.capped_at || null
          }, {
            onConflict: 'address',
            ignoreDuplicates: false
          });

        if (lifetimeError) {
          console.error(`Error updating lifetime tracking for ${player.address}:`, lifetimeError);
        }
      }
    } catch {
      console.log('player_lifetime_tracking table not found, skipping lifetime tracking');
      // Continue without lifetime tracking for now
    }

    const totalUsdc = distribution.reduce((sum, player) => sum + player.amount_usdc, 0);
    const successfulPayments = paymentResults.filter(r => r.status === 'success').length;
    const failedPayments = paymentResults.filter(r => r.status === 'failed').length;
    
    return NextResponse.json({
      message: `Weekly grants processed for week ${weekStart}`,
      weekStart,
      distribution,
      eligiblePlayers: eligiblePlayers.length,
      totalUsdc: totalUsdc,
      recordsCreated: grantRecords.length,
      paymentsProcessed: paymentResults.length > 0,
      successfulPayments,
      failedPayments,
      paymentResults: paymentResults.length > 0 ? paymentResults : undefined
    });

  } catch (error) {
    console.error('Weekly grants POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}