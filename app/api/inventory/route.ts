/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Get user's inventory with item details
    const { data: inventory, error } = await supabase
      .from('user_inventory')
      .select(`
        id,
        quantity,
        expires_at,
        created_at,
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
      .eq('address', addr)
      .gt('quantity', 0)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inventory:', error);
      return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }

    // Filter out expired items and format response
    const now = new Date();
    const validItems = inventory?.filter(item => {
      if (!item.expires_at) return true; // No expiration
      return new Date(item.expires_at) > now;
    }).map(item => ({
      inventory_id: item.id,
      quantity: item.quantity,
      expires_at: item.expires_at,
      ...item.lootbox_items
    })) || [];

    return NextResponse.json({
      address: addr,
      items: validItems,
      total_items: validItems.length
    });

  } catch (error) {
    console.error('Get inventory error:', error);
    return NextResponse.json({ error: 'Failed to get inventory' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, inventory_id, quantity = 1 } = body;

    if (!address || !inventory_id) {
      return NextResponse.json({ error: 'address and inventory_id required' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const addr = address.toLowerCase();

    // Get current quantity
    const { data: currentItem } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('id', inventory_id)
      .eq('address', addr)
      .single();

    if (!currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const newQuantity = currentItem.quantity - quantity;

    if (newQuantity <= 0) {
      // Delete the item completely
      const { error: deleteError } = await supabase
        .from('user_inventory')
        .delete()
        .eq('id', inventory_id)
        .eq('address', addr);

      if (deleteError) {
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
      }
    } else {
      // Update quantity
      const { error: updateError } = await supabase
        .from('user_inventory')
        .update({ quantity: newQuantity })
        .eq('id', inventory_id)
        .eq('address', addr);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update item quantity' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      remaining_quantity: Math.max(0, newQuantity)
    });

  } catch (error) {
    console.error('Delete inventory item error:', error);
    return NextResponse.json({ error: 'Failed to delete inventory item' }, { status: 500 });
  }
}
