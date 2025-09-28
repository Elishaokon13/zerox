// PARTY API ROUTE - COMMENTED OUT FOR NOW
// TODO: Re-enable when party mode is properly implemented

/*
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Pusher from 'pusher';

// Initialize Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true
});

// Create a new room
export async function POST(req: Request) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

    const { roomCode, hostAddress, hostName, hostPfp } = await req.json();

    // Validate input
    if (!roomCode || !hostAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create room in database
    const { data: room, error: roomError } = await supabase
      .from('party_rooms')
      .insert({
        room_code: roomCode,
        host_address: hostAddress,
        host_name: hostName,
        host_pfp: hostPfp,
        status: 'waiting',
        game_state: Array(9).fill(null), // 3x3 board
        current_turn: hostAddress
      })
      .select()
      .single();

    if (roomError) {
      console.error('Error creating room:', roomError);
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
    }

    // Add host as first player
    const { error: playerError } = await supabase
      .from('party_room_players')
      .insert({
        room_code: roomCode,
        player_address: hostAddress,
        player_name: hostName,
        player_pfp: hostPfp,
        player_symbol: 'X' // Host is always X
      });

    if (playerError) {
      console.error('Error adding host as player:', playerError);
      return NextResponse.json({ error: 'Failed to add host as player' }, { status: 500 });
    }

    // Trigger Pusher event for room creation
    await pusher.trigger(`room-${roomCode}`, 'room-created', {
      room,
      host: {
        address: hostAddress,
        name: hostName,
        pfp: hostPfp
      }
    });

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error in POST /api/party:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Join an existing room
export async function PUT(req: Request) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

    const { roomCode, playerAddress, playerName, playerPfp } = await req.json();

    // Validate input
    if (!roomCode || !playerAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if room exists and is waiting
    const { data: room, error: roomError } = await supabase
      .from('party_rooms')
      .select('*')
      .eq('room_code', roomCode)
      .eq('status', 'waiting')
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found or not available' }, { status: 404 });
    }

    // Check if room is full
    const { data: players, error: playersError } = await supabase
      .from('party_room_players')
      .select('*')
      .eq('room_code', roomCode);

    if (playersError) {
      return NextResponse.json({ error: 'Failed to check room capacity' }, { status: 500 });
    }

    if (players && players.length >= 2) {
      return NextResponse.json({ error: 'Room is full' }, { status: 400 });
    }

    // Add player to room
    const { error: joinError } = await supabase
      .from('party_room_players')
      .insert({
        room_code: roomCode,
        player_address: playerAddress,
        player_name: playerName,
        player_pfp: playerPfp,
        player_symbol: 'O' // Second player is always O
      });

    if (joinError) {
      console.error('Error adding player to room:', joinError);
      return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
    }

    // Update room status and player count
    const { error: updateError } = await supabase
      .from('party_rooms')
      .update({
        status: 'playing',
        player_count: 2
      })
      .eq('room_code', roomCode);

    if (updateError) {
      console.error('Error updating room status:', updateError);
      return NextResponse.json({ error: 'Failed to update room status' }, { status: 500 });
    }

    // Trigger Pusher event for player joined
    await pusher.trigger(`room-${roomCode}`, 'player-joined', {
      player: {
        address: playerAddress,
        name: playerName,
        pfp: playerPfp,
        symbol: 'O'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT /api/party:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get room status
export async function GET(req: Request) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const roomCode = searchParams.get('roomCode');

    if (!roomCode) {
      return NextResponse.json({ error: 'Missing room code' }, { status: 400 });
    }

    // Get room and players
    const { data: room, error: roomError } = await supabase
      .from('party_rooms')
      .select(`
        *,
        players:party_room_players(*)
      `)
      .eq('room_code', roomCode)
      .single();

    if (roomError) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error in GET /api/party:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
*/

// Temporary placeholder API responses
export async function POST(req: Request) {
  return Response.json({ error: 'Party mode is under development' }, { status: 503 });
}

export async function PUT(req: Request) {
  return Response.json({ error: 'Party mode is under development' }, { status: 503 });
}

export async function GET(req: Request) {
  return Response.json({ error: 'Party mode is under development' }, { status: 503 });
}
