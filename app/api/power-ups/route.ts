/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, inventory_id, game_session_id, power_up_type } = body;

    if (!address || !inventory_id || !power_up_type) {
      return NextResponse.json({ 
        error: 'address, inventory_id, and power_up_type required' 
      }, { status: 400 });
    }

    if (!supabase || !supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const addr = address.toLowerCase();

    // Get the inventory item details (use admin client to bypass RLS)
    const { data: inventoryItem, error: inventoryError } = await supabaseAdmin
      .from('user_inventory')
      .select(`
        id,
        quantity,
        expires_at,
        lootbox_items (
          id,
          item_type,
          item_name,
          description,
          rarity,
          points_value,
          usage_type
        )
      `)
      .eq('id', inventory_id)
      .eq('address', addr)
      .single();

    if (inventoryError || !inventoryItem) {
      return NextResponse.json({ error: 'Item not found in inventory' }, { status: 404 });
    }

    // Check if item is expired
    if (inventoryItem.expires_at && new Date(inventoryItem.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Item has expired' }, { status: 400 });
    }

    // Check if user has the item
    if (inventoryItem.quantity <= 0) {
      return NextResponse.json({ error: 'No quantity remaining' }, { status: 400 });
    }

    const item = inventoryItem.lootbox_items;

    if (!item) {
      return NextResponse.json({ error: 'Item details not found' }, { status: 404 });
    }

    // Validate power-up type matches item type
    if (item.item_type !== power_up_type) {
      return NextResponse.json({ 
        error: 'Power-up type does not match item type' 
      }, { status: 400 });
    }

    // Process the power-up based on type
    let result: any = { success: true, power_up_type: power_up_type };

    switch (power_up_type) {
      case 'points':
        // Add points directly to user's total
        result.points_added = item.points_value;
        result.message = `Added ${item.points_value} points!`;
        break;

      case 'try_again':
        result.message = 'Try Again power-up activated!';
        result.can_retry = true;
        break;

      case 'help':
        result.message = 'Help power-up activated! AI will suggest the best move.';
        result.ai_suggestion = true;
        break;

      case 'undo_step':
        result.message = 'Undo Step power-up activated! You can reverse your last move.';
        result.can_undo = true;
        break;

      case 'extra_life':
        result.message = 'Extra Life power-up activated! You can continue after a loss.';
        result.extra_life = true;
        break;

      case 'streak_recovery':
        result.message = 'Streak Recovery power-up activated! Your streak will be restored.';
        result.streak_recovery = true;
        break;

      case 'double_points':
        result.message = '2X Power Up activated! Your next game will earn double points.';
        result.double_points = true;
        break;

      default:
        return NextResponse.json({ error: 'Unknown power-up type' }, { status: 400 });
    }

    // Record power-up usage
    const { error: usageError } = await supabase
      .from('power_up_usage')
      .insert({
        address: addr,
        item_id: item.id,
        game_session_id: game_session_id || null,
        result: JSON.stringify(result)
      });

    if (usageError) {
      console.error('Failed to record power-up usage:', usageError);
    }

    // Consume one quantity of the item
    const { error: consumeError } = await supabaseAdmin
      .from('user_inventory')
      .update({ quantity: inventoryItem.quantity - 1 })
      .eq('id', inventory_id)
      .eq('address', addr);

    if (consumeError) {
      console.error('Failed to consume item:', consumeError);
    }

    // If it's a points power-up, add points to user's total
    if (power_up_type === 'points') {
      // Add points to leaderboard
      try {
        await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/leaderboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            address: addr, 
            result: 'bonus_points',
            points: item.points_value
          })
        });
      } catch (error) {
        console.error('Failed to add bonus points:', error);
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Use power-up error:', error);
    return NextResponse.json({ error: 'Failed to use power-up' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'address required' }, { status: 400 });
    }

    if (!supabase || !supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const addr = address.toLowerCase();

    // Get user's power-up usage history
    const { data: usageHistory, error } = await supabase
      .from('power_up_usage')
      .select(`
        id,
        used_at,
        result,
        lootbox_items (
          item_name,
          item_type,
          rarity
        )
      `)
      .eq('address', addr)
      .order('used_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching power-up usage:', error);
      return NextResponse.json({ error: 'Failed to fetch usage history' }, { status: 500 });
    }

    return NextResponse.json({
      address: addr,
      usage_history: usageHistory || [],
      total_uses: usageHistory?.length || 0
    });

  } catch (error) {
    console.error('Get power-up usage error:', error);
    return NextResponse.json({ error: 'Failed to get power-up usage' }, { status: 500 });
  }
}
