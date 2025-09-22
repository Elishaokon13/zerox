import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { supabase } from '@/lib/supabase';
import { getEconomics } from '@/lib/economics';

const CHAIN_ENV = process.env.NEXT_PUBLIC_CHAIN || 'base-sepolia';
const CHAIN = CHAIN_ENV === 'base' ? base : baseSepolia;

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || (CHAIN.id === base.id ? 'https://mainnet.base.org' : 'https://sepolia.base.org');
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;

// Weekly payout amounts (in ETH)
const WEEKLY_PAYOUTS = {
  1: 0.01,  // 1st place
  2: 0.005, // 2nd place  
  3: 0.002  // 3rd place
};

function getCurrentWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1); // Monday is 1
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    if (!RPC_URL || !TREASURY_PRIVATE_KEY) {
      return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { weekStart, force = false } = body;

    // Use provided week or current week
    const targetWeek = weekStart || getCurrentWeekStart();
    
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Get top 3 for the week
    const { data: topPlayers, error } = await supabase
      .from('leaderboard_entries')
      .select('address, alias, pfp_url, wins, draws, losses, points')
      .eq('season', targetWeek)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .limit(3);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    if (!topPlayers || topPlayers.length === 0) {
      return NextResponse.json({ error: 'No players found for this week' }, { status: 404 });
    }

    // Check if payouts already sent for this week
    const { data: existingPayouts } = await supabase
      .from('weekly_payouts')
      .select('id')
      .eq('week_start', targetWeek)
      .limit(1);

    if (existingPayouts && existingPayouts.length > 0 && !force) {
      return NextResponse.json({ error: 'Payouts already sent for this week' }, { status: 409 });
    }

    const account = privateKeyToAccount(`0x${TREASURY_PRIVATE_KEY.replace(/^0x/, '')}`);
    const wallet = createWalletClient({ account, chain: CHAIN, transport: http(RPC_URL) });

    const results = [];

    // Send payouts to top 3
    for (let i = 0; i < Math.min(3, topPlayers.length); i++) {
      const player = topPlayers[i];
      const rank = i + 1;
      const amountEth = WEEKLY_PAYOUTS[rank as keyof typeof WEEKLY_PAYOUTS];
      
      if (!amountEth || !isAddress(player.address)) {
        continue;
      }

      try {
        const valueWei = parseEther(amountEth.toString());
        const hash = await wallet.sendTransaction({ 
          to: player.address as `0x${string}`, 
          value: valueWei 
        });

        // Record the payout
        await supabase.from('weekly_payouts').upsert({
          week_start: targetWeek,
          rank,
          address: player.address.toLowerCase(),
          alias: player.alias,
          amount_eth: amountEth,
          tx_hash: hash,
          paid_at: new Date().toISOString()
        }, { onConflict: 'week_start,rank' });

        results.push({
          rank,
          address: player.address,
          alias: player.alias,
          amountEth,
          txHash: hash
        });
      } catch (error) {
        console.error(`Failed to pay rank ${rank}:`, error);
        results.push({
          rank,
          address: player.address,
          alias: player.alias,
          error: 'Payment failed'
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      weekStart: targetWeek,
      payouts: results 
    });

  } catch (error) {
    console.error('Weekly payout error:', error);
    return NextResponse.json({ error: 'Weekly payout failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get('week') || getCurrentWeekStart();

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Get payouts for the week
    const { data: payouts, error } = await supabase
      .from('weekly_payouts')
      .select('*')
      .eq('week_start', weekStart)
      .order('rank');

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
    }

    return NextResponse.json({ weekStart, payouts: payouts || [] });

  } catch (error) {
    console.error('Get weekly payouts error:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly payouts' }, { status: 500 });
  }
}

