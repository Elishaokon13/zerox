/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Lootbox item rarity weights for random distribution
const RARITY_WEIGHTS = {
  common: 60,    // 60% chance
  rare: 25,      // 25% chance  
  epic: 12,      // 12% chance
  legendary: 3   // 3% chance
};

// Get random lootbox item based on rarity weights
function getRandomLootboxItem(items: any[]) {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      const rarityItems = items.filter(item => item.rarity === rarity);
      if (rarityItems.length > 0) {
        return rarityItems[Math.floor(Math.random() * rarityItems.length)];
      }
    }
  }
  
  // Fallback to common item
  const commonItems = items.filter(item => item.rarity === 'common');
  return commonItems[0] || items[0];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = body?.address;

    if (!address) {
      return NextResponse.json({ error: 'address required' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const addr = address.toLowerCase();

    // Check if user has already opened a lootbox today
    const today = new Date().toISOString().split('T')[0];
    const { data: todayTracking } = await supabase
      .from('daily_lootbox_tracking')
      .select('lootboxes_earned')
      .eq('address', addr)
      .eq('date', today)
      .single();

    const maxDailyLootboxes = 3; // Allow 3 lootboxes per day during campaign
    if (todayTracking && todayTracking.lootboxes_earned >= maxDailyLootboxes) {
      return NextResponse.json({ 
        error: 'Daily lootbox limit reached',
        limit: maxDailyLootboxes,
        earned: todayTracking.lootboxes_earned
      }, { status: 429 });
    }

    // Get all available lootbox items (bypass RLS for public data)
    const { data: items, error: itemsError } = await supabase
      .from('lootbox_items')
      .select('*')
      .limit(100);

    if (itemsError) {
      console.error('Error fetching lootbox items:', itemsError);
      return NextResponse.json({ error: 'Database error: ' + itemsError.message }, { status: 500 });
    }
    
    if (!items || items.length === 0) {
      console.error('No lootbox items found in database');
      return NextResponse.json({ error: 'No lootbox items available' }, { status: 500 });
    }

    // Get random item
    const selectedItem = getRandomLootboxItem(items);

    // Add item to user inventory
    const { error: inventoryError } = await supabase
      .from('user_inventory')
      .upsert({
        address: addr,
        item_id: selectedItem.id,
        quantity: 1,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      }, {
        onConflict: 'address,item_id'
      });

    if (inventoryError) {
      return NextResponse.json({ error: 'Failed to add item to inventory' }, { status: 500 });
    }

    // Record lootbox opening
    const { error: openingError } = await supabase
      .from('lootbox_openings')
      .insert({
        address: addr,
        item_id: selectedItem.id,
        campaign_week: true
      });

    if (openingError) {
      console.error('Failed to record lootbox opening:', openingError);
    }

    // Update daily tracking
    const { error: trackingError } = await supabase
      .from('daily_lootbox_tracking')
      .upsert({
        address: addr,
        date: today,
        lootboxes_earned: (todayTracking?.lootboxes_earned || 0) + 1
      }, {
        onConflict: 'address,date'
      });

    if (trackingError) {
      console.error('Failed to update daily tracking:', trackingError);
    }

    return NextResponse.json({
      success: true,
      item: {
        id: selectedItem.id,
        type: selectedItem.item_type,
        name: selectedItem.item_name,
        description: selectedItem.description,
        rarity: selectedItem.rarity,
        points_value: selectedItem.points_value,
        usage_type: selectedItem.usage_type
      },
      daily_earned: (todayTracking?.lootboxes_earned || 0) + 1,
      daily_limit: maxDailyLootboxes
    });

  } catch (error) {
    console.error('Lootbox opening error:', error);
    return NextResponse.json({ error: 'Failed to open lootbox' }, { status: 500 });
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

    const addr = address.toLowerCase();

    // Get user's daily lootbox status
    const today = new Date().toISOString().split('T')[0];
    const { data: todayTracking } = await supabase
      .from('daily_lootbox_tracking')
      .select('lootboxes_earned')
      .eq('address', addr)
      .eq('date', today)
      .single();

    const maxDailyLootboxes = 3;
    const earned = todayTracking?.lootboxes_earned || 0;
    const remaining = Math.max(0, maxDailyLootboxes - earned);

    return NextResponse.json({
      daily_earned: earned,
      daily_limit: maxDailyLootboxes,
      remaining: remaining,
      can_open: remaining > 0
    });

  } catch (error) {
    console.error('Get lootbox status error:', error);
    return NextResponse.json({ error: 'Failed to get lootbox status' }, { status: 500 });
  }
}
