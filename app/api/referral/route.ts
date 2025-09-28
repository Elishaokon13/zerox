import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referrerAddress, referredAddress } = body;

    if (!referrerAddress || !referredAddress) {
      return NextResponse.json({ error: 'referrerAddress and referredAddress required' }, { status: 400 });
    }

    if (referrerAddress.toLowerCase() === referredAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Check if referral already exists
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_address', referrerAddress.toLowerCase())
      .eq('referred_address', referredAddress.toLowerCase())
      .limit(1);

    if (existingReferral && existingReferral.length > 0) {
      return NextResponse.json({ error: 'Referral already exists' }, { status: 409 });
    }

    // Create referral record
    const { error: referralError } = await supabase
      .from('referrals')
      .insert({
        referrer_address: referrerAddress.toLowerCase(),
        referred_address: referredAddress.toLowerCase(),
        points_awarded: 2
      });

    if (referralError) {
      return NextResponse.json({ error: 'Failed to create referral' }, { status: 500 });
    }

    // Award points to referrer
    const season = new Date().toISOString().slice(0, 10); // Use current date as season for now
    const { data: existingEntry } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('season', season)
      .eq('address', referrerAddress.toLowerCase())
      .limit(1);

    if (existingEntry && existingEntry.length > 0) {
      // Update existing entry
      const { error: updateError } = await supabase
        .from('leaderboard_entries')
        .update({ 
          points: existingEntry[0].points + 2,
          updated_at: new Date().toISOString()
        })
        .eq('season', season)
        .eq('address', referrerAddress.toLowerCase());

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update referrer points' }, { status: 500 });
      }
    } else {
      // Create new entry
      const { error: insertError } = await supabase
        .from('leaderboard_entries')
        .insert({
          season,
          address: referrerAddress.toLowerCase(),
          wins: 0,
          draws: 0,
          losses: 0,
          points: 2
        });

      if (insertError) {
        return NextResponse.json({ error: 'Failed to create referrer entry' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Referral created successfully',
      pointsAwarded: 2
    });

  } catch (error) {
    console.error('Referral error:', error);
    return NextResponse.json({ error: 'Referral failed' }, { status: 500 });
  }
}

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

    // Get referral stats for the address
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_address', address.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
    }

    const totalReferrals = referrals?.length || 0;
    const totalPoints = totalReferrals * 2;

    // Generate referral code and link
    const referralCode = address.toLowerCase().slice(2, 8).toUpperCase(); // First 6 chars of address
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    const referralLink = `${baseUrl}/play?ref=${referralCode}`;

    return NextResponse.json({
      address: address.toLowerCase(),
      totalReferrals,
      totalPoints,
      referralCode,
      referralLink,
      referrals: referrals || []
    });

  } catch (error) {
    console.error('Get referrals error:', error);
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
  }
}
