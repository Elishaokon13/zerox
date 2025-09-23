/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useComposeCast } from '@coinbase/onchainkit/minikit';
// Removed useUnifiedAuth - not implemented
import Image from 'next/image';
import PusherClient from 'pusher-js';
import GameBoard from './GameBoard';
import { GameResultCard } from './GameResultCard';
import { shareToFarcaster } from '@/lib/farcaster-share';
import { JoinRoomForm } from './JoinRoomForm';
// Removed useUnifiedScoreboard - not implemented

interface PartyModeProps {
  playerAddress: string;
  playerName?: string;
  playerPfp?: string;
}

export default function PartyMode({ playerAddress, playerName, playerPfp }: PartyModeProps) {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'result'>('lobby');
  const [opponent, setOpponent] = useState<{name?: string; pfp?: string; address?: string; symbol?: string} | null>(null);
  const [playerSymbol, setPlayerSymbol] = useState<'X' | 'O' | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [gameResult, setGameResult] = useState<'won' | 'lost' | 'draw' | null>(null);
  
  // Removed useUnifiedScoreboard - not implemented
  const recordResult = useCallback((result: string) => {
    console.log('Record result:', result); // Placeholder implementation
  }, []); // Placeholder
  const isRecording = false; // Placeholder
  const scoreboardAddress = playerAddress; // Use player address
  const scoreboardAuthenticated = !!playerAddress; // Use player address
  // Brand colors
  const BLACK = '#000000';
  const GREEN = '#00FF1A';
  const GRAY = '#f3f4f6';
  
  const [board, setBoard] = useState<Array<string | null>>(Array(9).fill(null));
  const { composeCast } = useComposeCast();
  // Removed useUnifiedAuth - not implemented
  const unifiedUser = null; // Placeholder

  // Initialize Pusher
  const pusher = useMemo(() => {
    return new PusherClient(
      process.env.NEXT_PUBLIC_PUSHER_KEY!,
      {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      }
    );
  }, []);

  // Generate a random 4-letter room code
  const generateRoomCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return code;
  };

  // Get player's symbol from the room
  const getPlayerSymbol = useCallback(async (roomCode: string) => {
    try {
      const res = await fetch(`/api/party?roomCode=${roomCode}&playerAddress=${playerAddress}`);
      if (res.ok) {
        const data = await res.json();
        return data.playerSymbol;
      }
    } catch (error) {
      console.error('Failed to get player symbol:', error);
    }
    return null;
  }, [playerAddress]);

  const createRoom = async () => {
    try {
      const code = generateRoomCode();
      const res = await fetch('/api/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: code,
          hostAddress: playerAddress,
          hostName: playerName,
          hostPfp: playerPfp
        })
      });

      if (!res.ok) throw new Error('Failed to create room');

      setRoomCode(code);
      setPlayerSymbol('X'); // Host is always X
      console.log('Room created, player symbol set to X');
      
      // Share room (only for Farcaster users)
      if (unifiedUser) { // Simplified check
        const appUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;
        const shareText = `🎮 Join my ZeroX game!\n\nRoom Code: ${code}\n\n👉 ${appUrl}/party?room=${code}`;
        
        try {
          await composeCast({
            text: shareText,
            embeds: [appUrl] as [string]
          });
        } catch (e) {
          console.error('Failed to share on Farcaster:', e);
        }
      } else {
        // For external users, just show a toast or copy link
        console.log('Room created! Share this link:', `${process.env.NEXT_PUBLIC_URL || window.location.origin}/party?room=${code}`);
      }
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const joinRoom = useCallback(async (code: string) => {
    try {
      const res = await fetch('/api/party', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: code.toUpperCase(),
          playerAddress,
          playerName,
          playerPfp
        })
      });

      if (!res.ok) throw new Error('Failed to join room');

      setRoomCode(code.toUpperCase());
      setPlayerSymbol('O'); // Joiner is always O
      console.log('Room joined, player symbol set to O');
    } catch (error) {
      console.error('Error joining room:', error);
    }
  }, [playerAddress, playerName, playerPfp]);

  // Handle URL parameters for joining a room
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam && !roomCode) {
      joinRoom(roomParam);
    }
  }, [joinRoom, roomCode]);

  // Subscribe to room events
  useEffect(() => {
    if (!roomCode) return;

    const channel = pusher.subscribe(`room-${roomCode}`);

    // Fetch player symbol when room is loaded (only if not already set)
    const fetchPlayerSymbol = async () => {
      if (!playerSymbol) {
        console.log('Fetching player symbol from API...');
        const symbol = await getPlayerSymbol(roomCode);
        console.log('Fetched symbol:', symbol);
        if (symbol) {
          setPlayerSymbol(symbol);
          console.log('Player symbol set to:', symbol);
        }
      } else {
        console.log('Player symbol already set to:', playerSymbol);
      }
    };
    fetchPlayerSymbol();

    channel.bind('player-joined', (data: {
      player: {
        name?: string;
        pfp?: string;
        symbol?: string;
      };
    }) => {
      setOpponent({
        name: data.player.name,
        pfp: data.player.pfp,
        symbol: data.player.symbol
      });
      setGameState('playing');
    });

    channel.bind('move-made', (data: {
      gameState: Array<string | null>;
      winner: string | null;
      isDraw: boolean;
    }) => {
      setBoard(data.gameState);
      if (data.winner || data.isDraw) {
        setGameState('result');
        
        // Determine game result
        if (data.isDraw) {
          setGameResult('draw');
          if (scoreboardAddress && scoreboardAuthenticated) {
            recordResult('draw');
            console.log('Party mode: Recorded draw onchain');
          }
        } else if (data.winner === playerAddress) {
          setGameResult('won');
          if (scoreboardAddress && scoreboardAuthenticated) {
            recordResult('win');
            console.log('Party mode: Recorded win onchain');
          }
        } else {
          setGameResult('lost');
          if (scoreboardAddress && scoreboardAuthenticated) {
            recordResult('loss');
            console.log('Party mode: Recorded loss onchain');
          }
        }
      }
    });

    return () => {
      pusher.unsubscribe(`room-${roomCode}`);
    };
  }, [roomCode, pusher, playerAddress, recordResult, scoreboardAddress, scoreboardAuthenticated, getPlayerSymbol, playerSymbol]);

  // Share functionality temporarily removed

         const [toastMessage, setToastMessage] = useState<string | null>(null);
     
     const showToast = (message: string) => {
       setToastMessage(message);
       setTimeout(() => setToastMessage(null), 3000);
     };

    return (
      <>
        {/* Toast Message */}
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-4 py-2 rounded-full text-sm animate-fade-in">
            {toastMessage}
          </div>
        )}
        
      
        <div className="w-full max-w-md mx-auto">
      {/* Header with room info */}
      {roomCode && (
        <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-white/90 border border-[#70FF5A]">
          <div className="flex items-center gap-2">
            <div className="text-sm text-black font-bold">Room: {roomCode}</div>
            {timer && <div className="text-sm">{timer}s</div>}
          </div>
          <div className="flex items-center gap-2">
            {opponent && (
              <>
                {opponent.pfp && (
                  <Image
                    src={opponent.pfp}
                    alt={opponent.name || 'Opponent'}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                )}
                <span className="text-sm">{opponent.name || 'Opponent'}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lobby */}
      {gameState === 'lobby' && !roomCode && (
        <div className="text-center">
          <h2 className="text-4xl text-black font-bold mb-4" style={{ fontFamily: 'var(--font-game)' }}>
            PARTY MODE
          </h2>
          <p className="text-lg text-black mb-8">Play together with your friends</p>
          
          {/* Player info */}
          <div className="mb-8">
            {playerPfp && (
              <div className="w-24 text-black h-24 mx-auto mb-4">
                <Image
                  src={playerPfp}
                  alt={playerName || 'Player'}
                  width={96}
                  height={96}
                  className="rounded-full"
                />
              </div>
            )}
            <div className="text-lg text-black font-medium">{playerName || playerAddress.slice(0, 6)}</div>
          </div>

          {/* Action buttons */}
          <div className="space-y-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full py-3 px-6 rounded-full bg-[#70FF5A] text-[#066c00] font-bold text-lg hover:bg-[#b6f569] transition-colors"
              style={{ fontFamily: 'var(--font-game)' }}
            >
              CREATE ROOM
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full py-3 px-6 rounded-full bg-white text-[#066c00] font-bold text-lg border-2 border-[#70FF5A] hover:bg-[#b6f569]/10 transition-colors"
              style={{ fontFamily: 'var(--font-game)' }}
            >
              JOIN ROOM
            </button>
          </div>
        </div>
      )}

      {/* Active Game/Waiting Room */}
      {roomCode && gameState !== 'result' && (
        <div className="min-h-[100svh] relative bg-white">
          {/* Background X and O */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-10 -top-3 text-[320px] font-bold leading-none text-black/5 select-none">X</div>
            <div className="absolute -right-8 bottom-10 text-[220px] font-bold leading-none text-black/5 select-none">O</div>
          </div>

          <div className="relative max-w-md mx-auto px-4 pt-2 pb-24 min-h-[100svh] flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold text-black">Play with Friends</div>
                {roomCode && (
                  <div className="flex items-center gap-1">
                    <div className="text-sm text-black/60">Room:</div>
                    <div className="text-sm font-mono font-bold text-black">{roomCode}</div>
                    <button
                      className="p-1.5 rounded-md hover:bg-black/5 transition-colors"
                      onClick={async () => {
                        await navigator.clipboard.writeText(roomCode);
                        showToast('Room code copied! 📋');
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <button 
                className="px-3 py-1.5 rounded-lg bg-[#70FF5A] text-black text-xs"
                onClick={() => {
                  const appUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;
                  composeCast({
                    text: `🎮 Join my ZeroX game!\n\nRoom Code: ${roomCode}\n\n👉 ${appUrl}/party?room=${roomCode}`,
                    embeds: [appUrl] as [string]
                  });
                }}
              >
                Invite
              </button>
            </div>

            {/* Background Shape */}
            <div 
              className="absolute top-0 right-0 w-3/4 h-full bg-black rounded-bl-[80px]" 
              style={{ zIndex: -1 }}
            />

            {/* Players Section */}
            <div className="grid grid-cols-2 mt-10 gap-4 mb-2">
              {/* Player (X) */}
              <div className="relative p-4 pt-10 rounded-2xl bg-white text-center">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                  <div className="relative w-14 h-14 rounded-full ring-2 ring-white shadow-md overflow-hidden">
                    <Image
                      src={playerPfp || '/default-avatar.png'}
                      alt={playerName || 'You'}
                      fill
                      className="object-cover"
                      sizes="56px"
                      unoptimized
                    />
                  </div>
                </div>
                <div className="text-xs text-black font-semibold">
                  @{playerName?.split('.')[0] || playerAddress.slice(0, 8)}
                </div>
                <button className={`mt-2 w-full h-12 text-white text-2xl font-bold rounded-lg font-ui ${
                  playerSymbol === 'X' ? 'bg-black' : 'bg-[#70FF5A] text-black'
                }`}>
                  {playerSymbol || '?'}
                </button>
                {/* Debug info */}
                <div className="text-xs text-gray-500 mt-1">
                  Debug: {playerSymbol || 'null'} | {roomCode ? 'Room: ' + roomCode : 'No room'}
                </div>
              </div>

              {/* Opponent (O) */}
              {opponent ? (
                <div className="relative p-4 pt-10 rounded-2xl bg-white text-center">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                    <div className="relative w-14 h-14 rounded-full ring-2 ring-white shadow-md overflow-hidden">
                      <Image
                        src={opponent.pfp || '/default-avatar.png'}
                        alt={opponent.name || 'Opponent'}
                        fill
                        className="object-cover"
                        sizes="56px"
                        unoptimized
                      />
                    </div>
                  </div>
                  <div className="text-xs text-black font-semibold">
                    @{opponent.name?.split('.')[0] || 'Opponent'}
                  </div>
                  <button className={`mt-2 w-full h-12 text-white text-2xl font-bold rounded-lg font-ui ${
                    opponent.symbol === 'X' ? 'bg-black' : 'bg-[#70FF5A] text-black'
                  }`}>
                    {opponent.symbol || '?'}
                  </button>
                </div>
              ) : (
                <div className="relative p-4 pt-10 rounded-2xl bg-white text-center opacity-50">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                    <div className="relative w-14 h-14 rounded-full ring-2 ring-white shadow-md overflow-hidden bg-gray-200 animate-pulse" />
                  </div>
                  <div className="text-xs text-black font-semibold">
                    Waiting...
                  </div>
                  <button className="mt-2 w-full h-12 bg-[#70FF5A] text-black text-2xl font-bold rounded-lg font-ui" disabled>
                    ?
                  </button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4 -mt-1">
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-black text-white text-[11px]">
                  <span>👑</span>
                  <span>Won · 0</span>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-black text-white text-[11px]">
                  <span>👑</span>
                  <span>Won · 0</span>
                </div>
              </div>
            </div>

            <div className="mb-2 text-center text-xs text-black/60">
              {opponent ? 'Your turn' : 'Share the invite to start'}
            </div>

            <div className="flex-1 flex items-center justify-center">
              {gameState === 'playing' ? (
                <GameBoard
                  board={board}
                  onCellClick={async (index: number) => {
                    try {
                      const res = await fetch('/api/party/move', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          roomCode,
                          playerAddress,
                          moveIndex: index
                        })
                      });
                      if (!res.ok) throw new Error('Failed to make move');
                    } catch (error) {
                      console.error('Error making move:', error);
                    }
                  }}
                  isPlayerTurn={true}
                  winningLine={null}
                  size={3}
                />
              ) : (
                <div className="text-center">
                  <div className="text-sm text-black/60 mb-4">Share the invite to start</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="aspect-square bg-black rounded-xl flex items-center justify-center">
                      <span className="text-4xl text-white font-bold">X</span>
                    </div>
                    <div className="aspect-square bg-[#70FF5A] rounded-xl flex items-center justify-center">
                      <span className="text-4xl text-white font-bold">O</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Result */}
      {gameState === 'result' && (
        <div className="flex flex-col gap-4 items-center w-full grow pb-8">
          <div className="flex flex-col w-full items-center">
            <h1 className="text-[39px] font-bold text-black text-center leading-[42px] w-full">
              YOU WON!
            </h1>
            <p className="text-sm font-normal text-black text-center mt-2">
              You completed the game!
            </p>
            <p className="text-xs font-normal text-gray-600 text-center mt-1">
              Share your victory or play again!
            </p>
          </div>

          <div className="w-full grow">
            <GameResultCard
              playerName={playerName}
              playerPfp={playerPfp}
              opponentName={opponent?.name}
              opponentPfp={opponent?.pfp}
              playerSymbol={playerSymbol || 'X'}
              result={gameResult || 'won'}
              roomCode={roomCode || ''}
            />
          </div>

          {/* Action Button */}
          <div className="w-full">
            <button
              className="w-full h-[51px] bg-white hover:bg-gray-50 border border-black rounded-[39px] flex items-center justify-center text-[30px] font-bold text-black transition-colors"
              style={{
                boxShadow: "0px 4px 0px 0px rgba(0, 0, 0, 1)",
                letterSpacing: "7.5%",
              }}
              onClick={() => setGameState('lobby')}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-4" style={{ color: '#00A71C' }}>
              Create Room
            </h3>
            <div className="mb-6">
              <div className="text-sm mb-2" style={{ color: '#00A71C' }}>Room Code:</div>
              <div className="bg-[#F1FFE8] p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-mono font-bold tracking-wider" style={{ color: '#00A71C' }}>
                    {generateRoomCode()}
                  </div>
                  <button
                    onClick={async () => {
                      const code = generateRoomCode();
                      await navigator.clipboard.writeText(code);
                      showToast('Room code copied! 📋');
                    }}
                    className="p-2 rounded-lg hover:bg-[#00A71C]/10 transition-colors"
                    style={{ color: '#00A71C' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const code = generateRoomCode();
                  createRoom();
                  setShowCreateModal(false);
                }}
                className="flex-1 py-3 rounded-full text-white font-medium"
                style={{ backgroundColor: '#00A71C' }}
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 rounded-full bg-white font-medium border"
                style={{ color: '#00A71C', borderColor: '#00A71C' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Form */}
      {showJoinModal && (
        <JoinRoomForm
          playerName={playerName}
          playerPfp={playerPfp}
          roomCode={joinRoomInput}
          setRoomCode={setJoinRoomInput}
          onJoinRoom={() => {
            if (joinRoomInput.trim() && joinRoomInput.length === 4) {
              joinRoom(joinRoomInput);
              setShowJoinModal(false);
              setJoinRoomInput('');
            }
          }}
          onBack={() => {
            setShowJoinModal(false);
            setJoinRoomInput('');
          }}
        />
      )}
    </div>
    </>
  );
}

