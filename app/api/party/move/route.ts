// PARTY MOVE API ROUTE - COMMENTED OUT FOR NOW
// TODO: Re-enable when party mode is properly implemented

/*
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Pusher from 'pusher';

interface Player {
  player_address: string;
  player_symbol: 'X' | 'O';
}

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true
});

export async function POST(req: Request) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    
    const { roomCode, playerAddress, moveIndex } = await req.json();

    // Validate input
    if (!roomCode || !playerAddress || typeof moveIndex !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get current room state
    const { data: room, error: roomError } = await supabase
      .from('party_rooms')
      .select(`
        *,
        players:party_room_players(*)
      `)
      .eq('room_code', roomCode)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Validate it's player's turn
    if (room.current_turn !== playerAddress) {
      return NextResponse.json({ error: 'Not your turn' }, { status: 400 });
    }

    // Get player's symbol
    const player = room.players.find((p: Player) => p.player_address === playerAddress);
    if (!player) {
      return NextResponse.json({ error: 'Player not found in room' }, { status: 400 });
    }

    // Update game state
    const gameState = room.game_state || Array(9).fill(null);
    if (gameState[moveIndex] !== null) {
      return NextResponse.json({ error: 'Invalid move' }, { status: 400 });
    }
    gameState[moveIndex] = player.player_symbol;

    // Find next player
    const nextPlayer = room.players.find((p: Player) => p.player_address !== playerAddress);

    // Check for winner
    const winner = checkWinner(gameState);
    const isDraw = !winner && gameState.every((cell: string | null) => cell !== null);

    // Update room state
    const { error: updateError } = await supabase
      .from('party_rooms')
      .update({
        game_state: gameState,
        current_turn: winner || isDraw ? null : nextPlayer?.player_address,
        status: winner || isDraw ? 'completed' : 'playing',
        winner_address: winner ? playerAddress : null,
        last_move_at: new Date().toISOString()
      })
      .eq('room_code', roomCode);

    if (updateError) {
      console.error('Error updating game state:', updateError);
      return NextResponse.json({ error: 'Failed to update game state' }, { status: 500 });
    }

    // Trigger Pusher event for move made
    await pusher.trigger(`room-${roomCode}`, 'move-made', {
      player: {
        address: playerAddress,
        symbol: player.player_symbol
      },
      moveIndex,
      gameState,
      winner: winner ? playerAddress : null,
      isDraw
    });

    return NextResponse.json({
      success: true,
      gameState,
      winner: winner ? playerAddress : null,
      isDraw
    });
  } catch (error) {
    console.error('Error in POST /api/party/move:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to check for winner
function checkWinner(squares: Array<string | null>): boolean {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return true;
    }
  }

  return false;
}
*/

// Temporary placeholder API response
export async function POST(req: Request) {
  return NextResponse.json({ error: 'Party mode is under development' }, { status: 503 });
}
