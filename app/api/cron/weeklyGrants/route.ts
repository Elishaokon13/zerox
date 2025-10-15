import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkUSDCBalance, processUSDCGrantPayments, isGrantSystemReady, getUSDCConfig } from '@/lib/grant-payment';

// Process weekly grants automatically (called by cron)
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Check if grant system is ready
    if (!isGrantSystemReady()) {
      return NextResponse.json({ 
        error: 'Grant system not ready. Please configure GRANT_FUNDING_WALLET and GRANT_FUNDING_PRIVATE_KEY environment variables.',
        ready: false
      }, { status: 400 });
    }

    // Check if grants are paused
    const pauseGrants = process.env.PAUSE_GRANTS === 'true';
    if (pauseGrants) {
      return NextResponse.json({ 
        message: 'Grants are currently paused',
        paused: true
      });
    }

    // Get the most recent completed week (previous Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - dayOfWeek + 1 - 7); // Previous Monday
    lastMonday.setHours(0, 0, 0, 0);
    const weekStart = lastMonday.toISOString().slice(0, 10);

    // Check if grants already processed for this week
    const { data: existingGrants } = await supabase
      .from('weekly_grants')
      .select('id')
      .eq('week_start', weekStart)
      .limit(1);

    if (existingGrants && existingGrants.length > 0) {
      return NextResponse.json({ 
        message: `Grants already processed for week ${weekStart}`,
        weekStart,
        alreadyProcessed: true
      });
    }

    // Get weekly distribution calculation
    const { data: distribution, error: distError } = await supabase
      .rpc('calculate_weekly_grant_distribution', { week_start_date: weekStart });

    if (distError) {
      console.error('Error calculating distribution:', distError);
      return NextResponse.json({ error: 'Failed to calculate distribution' }, { status: 500 });
    }

    if (!distribution || distribution.length === 0) {
      return NextResponse.json({ 
        message: `No eligible players for week ${weekStart} (minimum 100 points required)`,
        weekStart,
        eligiblePlayers: 0
      });
    }

    // Check USDC balance
    const balanceInfo = await checkUSDCBalance();
    const totalRequired = distribution.reduce((sum: number, player: { amount_usdc: number }) => sum + Number(player.amount_usdc), 0);
    
    if (!balanceInfo.sufficient) {
      return NextResponse.json({ 
        error: 'Insufficient USDC balance in grant wallet',
        balance: balanceInfo.balanceUsdc,
        required: totalRequired
      }, { status: 400 });
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
      console.error('Error inserting grant distributions:', insertError);
      return NextResponse.json({ error: 'Failed to create grant distributions' }, { status: 500 });
    }

    // Process USDC payments
    const payments = grantRecords.map((record: {
      rank: number;
      address: string;
      amount_usdc: number;
      week_start: string;
    }) => ({
      id: record.rank, // Using rank as ID for now
      recipient_address: record.address,
      amount_usdc: record.amount_usdc,
      week_start: record.week_start
    }));

    const paymentResults = await processUSDCGrantPayments(payments);

    // Update database with transaction results
    const updatePromises = paymentResults.results.map(async (result) => {
      if (!supabase) {
        console.error('Database not configured');
        return;
      }

      const updateData: { tx_status: string; tx_hash?: string; distributed_at?: string } = {
        tx_status: result.status === 'success' ? 'completed' : 'failed'
      };

      if (result.txHash) {
        updateData.tx_hash = result.txHash;
        updateData.distributed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('weekly_grants')
        .update(updateData)
        .eq('week_start', weekStart)
        .eq('rank', result.id);

      if (updateError) {
        console.error(`Failed to update grant ${result.id}:`, updateError);
      }
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: `Processed ${grantRecords.length} weekly grants for week ${weekStart}`,
      weekStart,
      eligiblePlayers: distribution.length,
      totalUsdc: totalRequired,
      balance: balanceInfo.balanceUsdc,
      results: paymentResults.results
    });

  } catch (error) {
    console.error('Weekly grants cron error:', error);
    return NextResponse.json({ 
      error: 'Failed to process weekly grants',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Get system status and configuration
export async function GET() {
  try {
    const systemReady = isGrantSystemReady();
    const pauseGrants = process.env.PAUSE_GRANTS === 'true';
    const usdcConfig = getUSDCConfig();
    
    let balanceInfo = null;
    if (systemReady) {
      try {
        const balance = await checkUSDCBalance();
        // Convert BigInt to string for JSON serialization
        balanceInfo = {
          balance: balance.balance.toString(),
          balanceUsdc: balance.balanceUsdc,
          sufficient: balance.sufficient
        };
      } catch (error) {
        console.error('Error checking USDC balance:', error);
      }
    }

    // Get pending grants count
    let pendingCount = 0;
    if (supabase) {
      const { count } = await supabase
        .from('weekly_grants')
        .select('*', { count: 'exact', head: true })
        .eq('tx_status', 'pending');
      pendingCount = count || 0;
    }

    return NextResponse.json({
      systemReady,
      paused: pauseGrants,
      usdcConfig,
      balance: balanceInfo,
      pendingGrants: pendingCount,
      environment: {
        hasWallet: !!process.env.GRANT_FUNDING_WALLET,
        hasPrivateKey: !!process.env.GRANT_FUNDING_PRIVATE_KEY,
        hasCronSecret: !!process.env.CRON_SECRET
      }
    });

  } catch (error) {
    console.error('Weekly grants status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
