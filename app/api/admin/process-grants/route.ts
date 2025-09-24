import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkWalletBalance, processGrantPayments, updatePaymentStatus, isGrantSystemReady } from '@/lib/grant-payment';

export async function POST() {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  try {
    // Check if grant system is ready
    if (!isGrantSystemReady()) {
      return NextResponse.json({ 
        error: 'Grant system not ready. Please configure GRANT_FUNDING_WALLET and GRANT_FUNDING_PRIVATE_KEY environment variables.',
        ready: false
      }, { status: 400 });
    }

    // Check wallet balance
    const balanceInfo = await checkWalletBalance();
    if (!balanceInfo.sufficient) {
      return NextResponse.json({ 
        error: 'Insufficient funds in grant wallet',
        balance: balanceInfo.balanceEth
      }, { status: 400 });
    }

    // Get pending distributions
    const { data: pendingDistributions, error: fetchError } = await supabase
      .from('grant_distributions')
      .select('*')
      .eq('tx_status', 'pending')
      .order('week_start', { ascending: false });

    if (fetchError) {
      console.error('Error fetching pending distributions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch pending distributions' }, { status: 500 });
    }

    if (!pendingDistributions || pendingDistributions.length === 0) {
      return NextResponse.json({ 
        message: 'No pending distributions found',
        processed: 0
      });
    }

    // Prepare payments
    const payments = pendingDistributions.map(dist => ({
      id: dist.id,
      recipient_address: dist.recipient_address,
      amount_eth: dist.amount_eth.toString(),
      week_start: dist.week_start
    }));

    // Process payments
    const paymentResults = await processGrantPayments(payments);

    // Update database with results
    const updatePromises = paymentResults.results.map(async (result) => {
      const updateData: any = {
        tx_status: result.status === 'success' ? 'completed' : 'failed'
      };

      if (result.txHash) {
        updateData.tx_hash = result.txHash;
      }

      const { error: updateError } = await supabase
        .from('grant_distributions')
        .update(updateData)
        .eq('id', result.id);

      if (updateError) {
        console.error(`Failed to update payment ${result.id}:`, updateError);
      }
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: `Processed ${paymentResults.results.length} grant payments`,
      results: paymentResults.results,
      balance: balanceInfo.balanceEth
    });

  } catch (error) {
    console.error('Error processing grant payments:', error);
    return NextResponse.json({ 
      error: 'Failed to process grant payments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  try {
    // Check system status
    const systemReady = isGrantSystemReady();
    let balanceInfo = null;

    if (systemReady) {
      try {
        balanceInfo = await checkWalletBalance();
      } catch (error) {
        console.error('Error checking wallet balance:', error);
      }
    }

    // Get pending distributions count
    const { count: pendingCount } = await supabase
      .from('grant_distributions')
      .select('*', { count: 'exact', head: true })
      .eq('tx_status', 'pending');

    // Get completed distributions count
    const { count: completedCount } = await supabase
      .from('grant_distributions')
      .select('*', { count: 'exact', head: true })
      .eq('tx_status', 'completed');

    return NextResponse.json({
      systemReady,
      balance: balanceInfo,
      pendingDistributions: pendingCount || 0,
      completedDistributions: completedCount || 0,
      environment: {
        hasWallet: !!process.env.GRANT_FUNDING_WALLET,
        hasPrivateKey: !!process.env.GRANT_FUNDING_PRIVATE_KEY
      }
    });

  } catch (error) {
    console.error('Error checking grant system status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

