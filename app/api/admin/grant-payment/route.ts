import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Grant funding wallet address (to be set when grant is received)
const GRANT_FUNDING_WALLET = process.env.GRANT_FUNDING_WALLET || '0x0000000000000000000000000000000000000000';

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  try {
    const { week, distributions } = await request.json();

    if (!week || !distributions || !Array.isArray(distributions)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Check if grant funding wallet is set
    if (GRANT_FUNDING_WALLET === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json({ 
        error: 'Grant funding wallet not configured. Please set GRANT_FUNDING_WALLET environment variable.' 
      }, { status: 400 });
    }

    // Check if distributions for this week already exist
    const { data: existingDistributions } = await supabase
      .from('grant_distributions')
      .select('id')
      .eq('week_start', week);

    if (existingDistributions && existingDistributions.length > 0) {
      return NextResponse.json({ 
        error: 'Distributions for this week already exist',
        existing: true
      }, { status: 409 });
    }

    // Record grant distributions with pending status
    const grantRecords = distributions.map((dist: { address: string; alias?: string; points: number; percentage: number; weeklyAmount: number }) => ({
      week_start: week,
      recipient_address: dist.address,
      recipient_alias: dist.alias,
      points: dist.points,
      percentage: dist.percentage,
      amount_usd: dist.weeklyAmount,
      amount_eth: dist.weeklyAmount || 0,
      tx_status: 'pending'
    }));

    const { error: insertError } = await supabase
      .from('grant_distributions')
      .insert(grantRecords);

    if (insertError) {
      console.error('Error inserting grant distributions:', insertError);
      return NextResponse.json({ error: 'Failed to record grant distributions' }, { status: 500 });
    }

    // TODO: Implement actual ETH transfers here
    // This would involve:
    // 1. Checking wallet balance
    // 2. Creating transactions for each recipient
    // 3. Updating tx_hash and tx_status when confirmed

    return NextResponse.json({ 
      success: true, 
      message: `Grant distributions recorded for week ${week}`,
      records: grantRecords.length,
      note: 'ETH transfers will be implemented when grant funding is available'
    });

  } catch (error) {
    console.error('Error in grant payment API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  try {
    // Get pending distributions that need to be paid
    const { data: pendingDistributions, error } = await supabase
      .from('grant_distributions')
      .select('*')
      .eq('tx_status', 'pending')
      .order('week_start', { ascending: false });

    if (error) {
      console.error('Error fetching pending distributions:', error);
      return NextResponse.json({ error: 'Failed to fetch pending distributions' }, { status: 500 });
    }

    return NextResponse.json({
      pending: pendingDistributions || [],
      fundingWallet: GRANT_FUNDING_WALLET,
      isConfigured: GRANT_FUNDING_WALLET !== '0x0000000000000000000000000000000000000000'
    });

  } catch (error) {
    console.error('Error in grant payment GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

