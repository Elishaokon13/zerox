'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { sdk } from '@farcaster/miniapp-sdk';
import { shareToFarcaster, GameShareData } from '@/lib/farcaster-share';
import GameBoard from './components/game/GameBoard';
import BottomNav from './components/BottomNav';
import GameStatus from './components/game/GameStatus';
import { WalletCheck } from './components/WalletCheck';
import { playMove, playAIMove, playWin, playLoss, playDraw, resumeAudio, playWarning } from '@/lib/sound';
import { hapticTap, hapticWin, hapticLoss } from '@/lib/haptics';
import { useAccount, useSendTransaction, useSendCalls } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { useMiniKit, useIsInMiniApp, useViewProfile, useComposeCast } from '@coinbase/onchainkit/minikit';
import { useScoreboard } from '@/lib/useScoreboard';
import { LootboxModal } from './components/lootbox/LootboxModal';
import { InventoryPanel } from './components/lootbox/InventoryPanel';



export default function Home() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);
  const [boardSize, setBoardSize] = useState<3 | 4 | 5>(3);
  const [board, setBoard] = useState<Array<string | null>>(Array(3 * 3).fill(null));
  const [playerSymbol, setPlayerSymbol] = useState<'X' | 'O' | null>('X');
  const [difficulty] = useState<'easy' | 'hard' | null>('easy');
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing');
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [outcomeHandled, setOutcomeHandled] = useState(false);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [misere] = useState(false);
  const [nextStarter, setNextStarter] = useState<'player' | 'ai'>('player');
  const computeTurnLimit = useCallback(() => 15, []);
  // series state removed
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  // Power-ups state (removed quick actions; keep minimal hints/block support for board UI)
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [blockedCellIndex, setBlockedCellIndex] = useState<number | null>(null);
  const [selectingBlock, setSelectingBlock] = useState(false);
  const [doubleActive, setDoubleActive] = useState(false);
  const [doublePendingSecond, setDoublePendingSecond] = useState(false);
  // Play page only (tabs split into routes)

  const startNewGameRound = useCallback(() => {
    const n = boardSize;
    setBoard(Array(n * n).fill(null));
    setWinningLine(null);
    setGameStatus('playing');
    setIsPlayerTurn(nextStarter === 'player');
    setSecondsLeft(computeTurnLimit());
    setOutcomeHandled(false);
    setResultRecorded(false);
    setSessionId(null);
    // reset power-ups
    setHintIndex(null);
    setBlockedCellIndex(null);
    setSelectingBlock(false);
    setDoubleActive(false);
    setDoublePendingSecond(false);
    // alternate who starts next round
    setNextStarter((s) => (s === 'player' ? 'ai' : 'player'));
  }, [boardSize, computeTurnLimit, nextStarter]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resultRecorded, setResultRecorded] = useState(false);

  // Transaction completion modal
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionResult, setTransactionResult] = useState<{
    gameStatus: 'won' | 'lost' | 'draw';
    payout?: string;
    transactionHash?: string;
  } | null>(null);

  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { sendCalls } = useSendCalls();
  const { context, isFrameReady, setFrameReady } = useMiniKit();
  const { isInMiniApp } = useIsInMiniApp();
  const viewProfile = useViewProfile();
  const { composeCast } = useComposeCast();
  const { recordResult: recordOnchain, isRecording, score: onchainScore } = useScoreboard();
  // Removed useUnifiedAuth - not implemented
  // Simple toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); }, []);
  // Config text from /api/config
  const [configText, setConfigText] = useState<string>('');
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/config');
        const j = await r.json();
        if (j && typeof j.payoutEthStr === 'string' && typeof j.chargeEthStr === 'string') {
          setConfigText(`Win to receive ~${j.payoutEthStr} ETH. Lose and you pay ~${j.chargeEthStr}.`);
        } else {
          const p = process.env.NEXT_PUBLIC_PAYOUT_AMOUNT_ETH || process.env.PAYOUT_AMOUNT_ETH || '0.00002';
          setConfigText(`Win to receive ~${p} ETH. Lose and you pay ~${p}.`);
        }
      } catch {
        const p = process.env.NEXT_PUBLIC_PAYOUT_AMOUNT_ETH || process.env.PAYOUT_AMOUNT_ETH || '0.00002';
        setConfigText(`Win to receive ~${p} ETH. Lose and you pay ~${p}.`);
      }
    };
    load();
  }, []);


  useEffect(() => {
    if (!isFrameReady) setFrameReady();
  }, [isFrameReady, setFrameReady]);

  // PVP feature removed - no more match_id handling

  // PVP feature removed - no more match link recovery from cast text

  // Prompt to add Mini App after ~5s if not already added
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isInMiniApp && context?.client && context.client.added === false) {
      timer = setTimeout(() => setShowAddPrompt(true), 5000);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [isInMiniApp, context]);

  // Share functionality temporarily removed

  // handleShareChallenge removed (unused)

  // Post results to leaderboard
  useEffect(() => {
    const post = async () => {
      if (!address) return;
      if (!(gameStatus === 'won' || gameStatus === 'lost' || gameStatus === 'draw')) return;
      try {
        const alias = context?.user?.username;
        const pfpUrl = context?.user?.pfpUrl;
        await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, result: gameStatus === 'won' ? 'win' : gameStatus === 'lost' ? 'loss' : 'draw', alias, pfpUrl })
        });
      } catch {}
    };
    post();
  }, [address, gameStatus, context]);



  const [referralStats, setReferralStats] = useState({ totalReferrals: 0, totalPoints: 0 });
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [farcasterUsername, setFarcasterUsername] = useState<string>('');
  const [farcasterPfpUrl, setFarcasterPfpUrl] = useState<string>('');
  
  // User points state
  const [userPoints, setUserPoints] = useState<{ gamePoints: number; referralPoints: number; totalPoints: number; totalReferrals: number } | null>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
  
  // Lootbox state
  const [showLootboxModal, setShowLootboxModal] = useState(false);
  const [showInventoryPanel, setShowInventoryPanel] = useState(false);
  const [activePowerUps, setActivePowerUps] = useState<{
    doublePoints?: boolean;
    tryAgain?: boolean;
    aiHelp?: boolean;
    undoStep?: boolean;
    extraLife?: boolean;
    streakRecovery?: boolean;
  }>({});

  // Load referral stats
  const loadReferralStats = useCallback(async () => {
    const userAddress = address;
    if (!userAddress) return;
    try {
      const response = await fetch(`/api/referral?address=${userAddress}`);
      const data = await response.json();
      if (response.ok) {
        setReferralStats({
          totalReferrals: data.totalReferrals,
          totalPoints: data.totalPoints
        });
      }
    } catch (error) {
      console.error('Failed to load referral stats:', error);
    }
  }, [address]);

  // Generate referral link
  const getReferralLink = useCallback(() => {
    const userAddress = address;
    console.log('getReferralLink called:', { address, userAddress });
    if (!userAddress) return '';
    const baseUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;
    const link = `${baseUrl}?ref=${userAddress}`;
    console.log('Generated referral link:', link);
    return link;
  }, [address]);

  // Copy referral link to clipboard
  const copyReferralLink = useCallback(async () => {
    const link = getReferralLink();
    const userAddress = address;
    console.log('copyReferralLink called:', { link, address, userAddress });
    if (!link) {
      showToast('No referral link available - address not found');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      showToast('Referral link copied!');
    } catch (error) {
      console.error('Failed to copy link:', error);
      showToast('Failed to copy link');
    }
  }, [getReferralLink, showToast, address]);

  // Share referral via cast
  const shareReferralCast = useCallback(async () => {
    const link = getReferralLink();
    if (!link) {
      showToast('No referral link available - address not found');
      return;
    }
    
    try {
      await composeCast({
        text: `🎮 Join me in ZeroX TicTacToe! Play games, earn points, and compete for weekly ETH rewards! 🏆\n\nPlay now: ${link}`,
        embeds: [window.location.origin]
      });
      showToast('Cast composed! Share your referral with the community! 🚀');
    } catch (error) {
      console.error('Failed to compose cast:', error);
      showToast('Failed to compose cast');
    }
  }, [getReferralLink, showToast, composeCast]);

  // Load referral stats when address changes
  useEffect(() => {
    loadReferralStats();
  }, [loadReferralStats]);

  // Load user points when address changes
  const fetchUserPoints = useCallback(async () => {
    if (!address) {
      setUserPoints(null);
      return;
    }

    setPointsLoading(true);
    try {
      const response = await fetch(`/api/user-points?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setUserPoints(data);
      } else {
        console.error('Failed to fetch user points');
      }
    } catch (error) {
      console.error('Error fetching user points:', error);
    } finally {
      setPointsLoading(false);
    }
  }, [address]);

  // Handle power-up usage
  const handlePowerUpUsage = useCallback(async (item: any) => {
    if (!address) return;

    try {
      const response = await fetch('/api/power-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          inventory_id: item.inventory_id,
          power_up_type: item.item_type,
          game_session_id: sessionId
        })
      });

      if (response.ok) {
        const result = await response.json();
        showToast(result.message || 'Power-up activated!');
        
        // Handle specific power-up effects
        if (item.item_type === 'points') {
          // Refresh points display
          fetchUserPoints();
        } else if (item.item_type === 'double_points') {
          // Set double points multiplier for next game
          setActivePowerUps(prev => ({ ...prev, doublePoints: true }));
        } else if (item.item_type === 'try_again') {
          // Enable try again for current move
          setActivePowerUps(prev => ({ ...prev, tryAgain: true }));
        } else if (item.item_type === 'help') {
          // Enable AI help for current move
          setActivePowerUps(prev => ({ ...prev, aiHelp: true }));
        } else if (item.item_type === 'undo_step') {
          // Enable undo for last move
          setActivePowerUps(prev => ({ ...prev, undoStep: true }));
        } else if (item.item_type === 'extra_life') {
          // Enable extra life for current game
          setActivePowerUps(prev => ({ ...prev, extraLife: true }));
        } else if (item.item_type === 'streak_recovery') {
          // Enable streak recovery
          setActivePowerUps(prev => ({ ...prev, streakRecovery: true }));
        }
      } else {
        const error = await response.json();
        showToast(error.error || 'Failed to use power-up');
      }
    } catch (error) {
      console.error('Failed to use power-up:', error);
      showToast('Failed to use power-up');
    }
  }, [address, sessionId, showToast, fetchUserPoints]);

  useEffect(() => {
    fetchUserPoints();
  }, [fetchUserPoints]);

  // Handle referral links on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refAddress = urlParams.get('ref');
    const userAddress = address;
    
    if (refAddress && userAddress && refAddress.toLowerCase() !== userAddress.toLowerCase()) {
      // Process referral
      fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrerAddress: refAddress,
          referredAddress: userAddress
        })
      }).then(response => {
        if (response.ok) {
          showToast('Welcome! You were referred by a friend!');
          loadReferralStats(); // Refresh stats
          fetchUserPoints(); // Refresh points display
        }
      }).catch(error => {
        console.error('Referral processing failed:', error);
      });
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('ref');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [address, loadReferralStats, showToast, fetchUserPoints]);


  // Read challenge params from URL to prefill
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const symbolParam = url.searchParams.get('symbol');
      if ((symbolParam === 'X' || symbolParam === 'O') && !playerSymbol) setPlayerSymbol(symbolParam);
    } catch {}
  }, [playerSymbol]);

  const checkWinner = useCallback((squares: Array<string | null>): string | null => {
    const n = boardSize;
    const inRow = n === 3 ? 3 : 4; // 4-in-a-row for 4x4/5x5
    const dirs = [
      [1, 0], // right
      [0, 1], // down
      [1, 1], // diag down-right
      [1, -1] // diag up-right
    ];
    const index = (x: number, y: number) => y * n + x;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const start = squares[index(x, y)];
        if (!start) continue;
        for (const [dx, dy] of dirs) {
          const cells: number[] = [index(x, y)];
          let k = 1;
          while (k < inRow) {
            const nx = x + dx * k;
            const ny = y + dy * k;
            if (nx < 0 || ny < 0 || nx >= n || ny >= n) break;
            const ii = index(nx, ny);
            if (squares[ii] !== start) break;
            cells.push(ii);
            k++;
          }
          if (cells.length === inRow) {
            setWinningLine(cells);
            return start;
          }
        }
      }
    }
    return null;
  }, [boardSize]);

  const getAvailableMoves = useCallback((squares: Array<string | null>): number[] => {
    return squares.reduce<number[]>((moves, cell, index) => 
      cell === null ? [...moves, index] : moves, []);
  }, []);

  const getAIMove = useCallback((squares: Array<string | null>): number => {
    let availableMoves = getAvailableMoves(squares);
    if (blockedCellIndex !== null) {
      availableMoves = availableMoves.filter((i) => i !== blockedCellIndex);
    }
    if (availableMoves.length === 0) return -1;
    // Randomized AI move for simplicity
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
  }, [getAvailableMoves, blockedCellIndex]);

  // getBestPlayerMove no longer used (quick actions removed)

  // Removed useUnifiedScoreboard - not implemented
  const recordResult = useCallback((result: 'win' | 'loss' | 'draw') => {
    if (address && !isRecording) {
      recordOnchain(result);
    }
  }, [address, isRecording, recordOnchain]);
  const score = onchainScore || { wins: 0, draws: 0, losses: 0 };
  
  // Debug logging for onchain scores
  useEffect(() => {
    if (address && onchainScore) {
      console.log('Onchain scoreboard data:', onchainScore);
    }
  }, [address, onchainScore]);
  const scoreboardAddress = address; // Use regular address
  const scoreboardAuthenticated = !!address; // Use regular auth

  const handleCellClick = async (index: number) => {
    if (gameStatus !== 'playing') return;

    // If selecting a block target before ending turn
    if (selectingBlock && isPlayerTurn && !board[index] && blockedCellIndex === null) {
      setBlockedCellIndex(index);
      setSelectingBlock(false);
      playWarning();
      return;
    }

    if (!isPlayerTurn || board[index]) return;

    // Ensure audio is unlocked on user gesture
    resumeAudio();
    hapticTap();

    // Ensure a game session exists
    if (!sessionId && address) {
      try {
        const res = await fetch('/api/gamesession', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) });
        const data = await res.json();
        if (data?.id) setSessionId(data.id as string);
      } catch {}
    }

    // Double move logic
    if (doubleActive && !doublePendingSecond) {
      const newBoard = [...board];
      newBoard[index] = playerSymbol;
      setBoard(newBoard);
      playMove();
      // If this immediately ends the game, finish now
      const winner = checkWinner(newBoard);
      if (winner) {
        const isWin = winner === playerSymbol;
        setGameStatus(isWin ? 'won' : 'lost');
        // recordResult will be called in useEffect - don't call here
        if (sessionId) {
          try { await fetch('/api/gamesession', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sessionId, result: isWin ? 'win' : 'loss', settled: isWin }) }); } catch {}
        }
        setDoubleActive(false);
        setDoublePendingSecond(false);
        return;
      }
      if (getAvailableMoves(newBoard).length === 0) {
        setGameStatus('draw');
        // recordResult will be called in useEffect - don't call here
        if (sessionId) {
          try { await fetch('/api/gamesession', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sessionId, result: 'draw', settled: true }) }); } catch {}
        }
        setDoubleActive(false);
        setDoublePendingSecond(false);
        return;
      }
      // Stay on player's turn for second move
      setDoublePendingSecond(true);
      return;
    }

    if (doubleActive && doublePendingSecond) {
      if (board[index]) return;
      const temp = [...board];
      temp[index] = playerSymbol;
      // Cannot win on 2nd move
      if (checkWinner(temp) === playerSymbol) {
        playWarning();
        return;
      }
      setBoard(temp);
      setIsPlayerTurn(false);
      setDoubleActive(false);
      setDoublePendingSecond(false);
      playMove();

      const winner2 = checkWinner(temp);
      if (winner2) {
        const isWin = winner2 === playerSymbol;
        setGameStatus(isWin ? 'won' : 'lost');
        // recordResult will be called in useEffect - don't call here
        if (sessionId) {
          try { await fetch('/api/gamesession', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sessionId, result: isWin ? 'win' : 'loss', settled: isWin }) }); } catch {}
        }
        return;
      }
      if (getAvailableMoves(temp).length === 0) {
        setGameStatus('draw');
        // recordResult will be called in useEffect - don't call here
        if (sessionId) {
          try { await fetch('/api/gamesession', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sessionId, result: 'draw', settled: true }) }); } catch {}
        }
        return;
      }
      return;
    }

    // Normal single-move flow
    const newBoard = [...board];
    newBoard[index] = playerSymbol;
    setBoard(newBoard);
    setIsPlayerTurn(false);

    // Player move sound
    playMove();

    const winner = checkWinner(newBoard);
    if (winner) {
      const isWin = winner === playerSymbol;
      setGameStatus(isWin ? 'won' : 'lost');
      // Update session on immediate result
      if (sessionId) {
        try {
          await fetch('/api/gamesession', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sessionId, result: isWin ? 'win' : 'loss', settled: isWin }) });
        } catch {}
      }
      return;
    }
    if (getAvailableMoves(newBoard).length === 0) {
      setGameStatus('draw');
      if (sessionId) {
        try { await fetch('/api/gamesession', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sessionId, result: 'draw', settled: true }) }); } catch {}
      }
      return;
    }
  };

  useEffect(() => {
    if (!isPlayerTurn && gameStatus === 'playing') {
      const timer = setTimeout(async () => {
        const aiMove = getAIMove(board);
        if (aiMove !== -1) {
          const newBoard = [...board];
          newBoard[aiMove] = playerSymbol === 'X' ? 'O' : 'X';
          setBoard(newBoard);
          // Clear one-turn block after AI moves
          if (blockedCellIndex !== null) setBlockedCellIndex(null);

          // AI move sound
          playAIMove();

          const winner = checkWinner(newBoard);
          if (winner) {
            const didPlayerWin = winner === playerSymbol;
            setGameStatus(didPlayerWin ? 'won' : 'lost');
            // recordResult will be called in useEffect - don't call here
            if (sessionId) {
              (async () => { try { await fetch('/api/gamesession', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sessionId, result: didPlayerWin ? 'win' : 'loss', settled: didPlayerWin }) }); } catch {} })();
            }
          } else if (getAvailableMoves(newBoard).length === 0) {
            setGameStatus('draw');
            // recordResult will be called in useEffect - don't call here
            if (sessionId) {
              (async () => { try { await fetch('/api/gamesession', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sessionId, result: 'draw', settled: true }) }); } catch {} })();
            }
          }
        }
        setIsPlayerTurn(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [board, isPlayerTurn, playerSymbol, getAIMove, gameStatus, checkWinner, getAvailableMoves, sessionId, blockedCellIndex]);

  // Outcome sounds and onchain recording
  useEffect(() => {
    // Record result immediately when game ends
    if ((gameStatus === 'won' || gameStatus === 'lost' || gameStatus === 'draw') && !resultRecorded) {
      const result = gameStatus === 'won' ? 'win' : gameStatus === 'lost' ? 'loss' : 'draw';
      
      console.log('Game ended, attempting onchain recording:', {
        result,
        scoreboardAddress,
        scoreboardAuthenticated,
        address,
        authType: 'wallet'
      });
      
      // Record result onchain first
      try { 
        if (scoreboardAddress && scoreboardAuthenticated) {
          recordResult(result);
          setResultRecorded(true);
          console.log('Onchain recording initiated for:', scoreboardAddress);
        } else {
          console.warn('Cannot record onchain - no address or not authenticated:', {
            scoreboardAddress,
            scoreboardAuthenticated
          });
        }
        
        // Update points system (works for all users)
        const userAddress = address;
        if (userAddress) {
          // Update leaderboard with points
          fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              address: userAddress, 
              result,
              alias: context?.user?.username,
              pfpUrl: context?.user?.pfpUrl
            })
          }).then(r => {
            if (r.ok) {
              const pointsText = result === 'win' ? '+2 points' : result === 'loss' ? '+2 points' : '+1 point';
              showToast(pointsText);
              // Refresh user points after successful update
              fetchUserPoints();
            }
          }).catch(() => {});
        }
      } catch (error) {
        console.error('Failed to record result:', error);
      }
    }
  }, [gameStatus, resultRecorded, address, recordResult, context, showToast, scoreboardAddress, scoreboardAuthenticated, fetchUserPoints]);

  // Game status effects (sounds, haptics, auto-restart)
  useEffect(() => {
    if (gameStatus === 'won') {
      playWin();
      hapticWin();
      try { showToast('You won!'); } catch {}
      // Auto-start a new round shortly after a win
      const id = setTimeout(() => {
        startNewGameRound();
      }, 1200);
      return () => clearTimeout(id);
    } else if (gameStatus === 'lost') {
      playLoss();
      hapticLoss();
      try { showToast('You lost'); } catch {}
      // Auto-start a new round shortly after a loss
      const id = setTimeout(() => {
        startNewGameRound();
      }, 1200);
      return () => clearTimeout(id);
    } else if (gameStatus === 'draw') {
      playDraw();
      try { showToast("It's a draw"); } catch {}
      // Auto-start a new round shortly after a draw
      const id = setTimeout(() => {
        startNewGameRound();
      }, 1200);
      return () => clearTimeout(id);
    }
  }, [gameStatus, startNewGameRound, showToast]);

  // Handle transaction completion and show modal
  useEffect(() => {
    // Simulate transaction completion after a delay
    if (resultRecorded && (gameStatus === 'won' || gameStatus === 'lost' || gameStatus === 'draw')) {
      const timer = setTimeout(() => {
        const payout = gameStatus === 'won' ? '0.00002' : undefined;
        const transactionHash = '0x1234...5678'; // You can get this from the actual transaction
        
        setTransactionResult({
          gameStatus,
          payout,
          transactionHash
        });
        setShowTransactionModal(true);
      }, 2000); // Show modal after 2 seconds to simulate transaction completion
      
      return () => clearTimeout(timer);
    }
  }, [resultRecorded, gameStatus]);

  // Series removed

  // Update progress XP/streak/achievements
  useEffect(() => {
    const run = async () => {
      if (!address) return;
      if (gameStatus === 'won' || gameStatus === 'lost' || gameStatus === 'draw') {
        try {
          const res = await fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, result: gameStatus === 'won' ? 'win' : gameStatus === 'lost' ? 'loss' : 'draw' })
          });
          const data = await res.json();
          if (data?.xp != null) {
            setXp(Number(data.xp));
            setLevel(Number(data.level));
            setStreak(Number(data.streak));
          }
          // If daily eligible and this was a win on hard with today's seed, try bonus claim
          if (gameStatus === 'won') {
            const url = new URL(window.location.href);
            const seed = url.searchParams.get('seed') ?? undefined;
            const symbolParam = url.searchParams.get('symbol');
            const diffParam = url.searchParams.get('difficulty');
            const symbol = symbolParam === 'X' || symbolParam === 'O' ? symbolParam : undefined;
            const difficultySel = diffParam === 'easy' || diffParam === 'hard' ? diffParam : undefined;
            if (seed && symbol === 'X' && difficultySel === 'hard') {
              try {
                await fetch('/api/daily', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ address, completed: true, seed, symbol, difficulty: difficultySel, result: 'win' })
                });
              } catch {}
            }
          }
        } catch {}
      } else if (address) {
        try {
          const res = await fetch(`/api/progress?address=${address}`);
          const data = await res.json();
          if (data?.xp != null) {
            setXp(Number(data.xp));
            setLevel(Number(data.level));
            setStreak(Number(data.streak));
          }
        } catch {}
      }
    };
    run();
  }, [address, gameStatus]);

  // daily seed fetch removed (unused)

  // Points system handling on game end (both onchain and database)
  useEffect(() => {
    const handleGameResult = async (playerAddress: string, result: 'win' | 'loss' | 'draw') => {
      try {
        // Also record in database for leaderboard
        const res = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            address: playerAddress, 
            result,
            alias: farcasterUsername || undefined,
            pfpUrl: farcasterPfpUrl || undefined
          }),
        });
        
        if (res.ok) {
          const points = result === 'win' ? 2 : result === 'loss' ? 2 : 1;
          try { showToast(`+${points} points! (Recorded onchain)`); } catch {}
        } else {
          try { showToast('Failed to record result in database'); } catch {}
        }
      } catch {
        try { showToast('Failed to record result'); } catch {}
      }
    };

    if ((gameStatus === 'won' || gameStatus === 'lost' || gameStatus === 'draw') && !outcomeHandled && address) {
      setOutcomeHandled(true);
      handleGameResult(address, gameStatus as 'win' | 'loss' | 'draw');
    }
  }, [gameStatus, address, outcomeHandled, farcasterUsername, farcasterPfpUrl, showToast]);

  // handleReset no longer used after series removal

  // Start a new round automatically after game ends, preserving symbol and difficulty
  // startNextRound removed

  // Turn timer logic
  useEffect(() => {
    if (gameStatus !== 'playing') {
      setSecondsLeft(null);
      return;
    }
    // Initialize when player's turn starts
    if (isPlayerTurn) {
      setSecondsLeft((prev) => (typeof prev === 'number' ? prev : computeTurnLimit()));
    }
  }, [gameStatus, isPlayerTurn, computeTurnLimit]);

  useEffect(() => {
    if (gameStatus !== 'playing' || !isPlayerTurn || typeof secondsLeft !== 'number') return;
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => {
      const next = secondsLeft - 1;
      setSecondsLeft(next);
      if (next === 3 || next === 1) {
        playWarning();
      }
      if (next <= 0) {
        // Auto-skip: AI moves if player times out
        setIsPlayerTurn(false);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, gameStatus, isPlayerTurn]);



  // Handle incoming challenges from Farcaster
  useEffect(() => {
    if (!context?.location) return;
    const loc = context.location as unknown;
    type CastObj = { hash: string; text: string; author: { username?: string; fid: number } };
    type CastEmbedLoc = { type: 'cast_embed'; cast: CastObj };
    if (loc && typeof (loc as CastEmbedLoc).type === 'string' && (loc as CastEmbedLoc).type === 'cast_embed') {
      const cast = (loc as CastEmbedLoc).cast;
      if (cast.text.includes('🎮') || cast.text.toLowerCase().includes('challenge')) {
        showToast(`${cast.author.username || cast.author.fid} challenged you!`);
        setPlayerSymbol('X');
      }
    }
  }, [context?.location, showToast]);

  // Share game results after transaction is recorded
  // TODO: Re-enable auto-cast feature once sharing is perfected
  /*useEffect(() => {
    if (gameStatus === 'won' && address && resultRecorded) {
      // Get user info from context
      const username = context?.user?.username;
      const pfpUrl = context?.user?.pfpUrl;
      
      // Prepare share data
      if (!playerSymbol || (playerSymbol !== 'X' && playerSymbol !== 'O')) return; // Safety check
      
      const shareData: GameShareData = {
        playerName: username,
        playerPfp: pfpUrl,
        opponentName: 'AI',
        opponentPfp: '/default-avatar.png',
        playerSymbol, // TypeScript now knows this is 'X' | 'O'
        result: 'won',
        roomCode: difficulty || 'AI',
        timestamp: Date.now()
      };

      // Share using the shared function
      shareToFarcaster(shareData)
        .then(() => {
          showToast('Game result shared! 🚀');
        })
        .catch((e: Error) => {
          if (e.message.includes('Copied to clipboard')) {
            showToast('Copied to clipboard! 📋');
          } else {
            console.error('Failed to share:', e);
          }
        });
    }
  }, [gameStatus, address, difficulty, playerSymbol, context, showToast, resultRecorded]);*/

  // Handle direct challenges to other players
  const handleChallenge = useCallback(async (username?: string) => {
    const appUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;
    
    // If username provided, send direct challenge
    if (username) {
      // Clean up username - remove @ if present and trim
      const cleanUsername = username.trim().replace(/^@/, '');
      
      // Create challenge text with @username
      const challengeText = `🎮 Hey @${cleanUsername}, I challenge you to ZeroX!\n\n💎 Winner gets ${process.env.NEXT_PUBLIC_PAYOUT_AMOUNT_ETH || '0.00002'} ETH\n🎯 Accept here: ${appUrl}`;
      
      try {
        const result = await sdk.actions.composeCast({
          text: challengeText,
          embeds: [appUrl] as [string],
          close: false
        });
        
        if (result?.cast) {
          showToast('Challenge sent! 🎮');
        }
      } catch (e) {
        console.error('Failed to send challenge:', e);
        showToast('Failed to send challenge 😔');
      }
    } else {
      // Open challenge to everyone
      const challengeText = `🎮 Who wants to play ZeroX?\n\n💎 Winner gets ${process.env.NEXT_PUBLIC_PAYOUT_AMOUNT_ETH || '0.00002'} ETH\n🎯 Accept here: ${appUrl}`;
      
      try {
        const result = await sdk.actions.composeCast({
          text: challengeText,
          embeds: [appUrl] as [string],
          close: false
        });
        
        if (result?.cast) {
          showToast('Challenge posted! 🎮');
        }
      } catch (e) {
        console.error('Failed to post challenge:', e);
        showToast('Failed to post challenge 😔');
      }
    }
  }, [showToast]);

  // remove auto-advance; handled via rematch modal

  // Account for bottom nav height + safe area
  const bottomInset = (context?.client?.safeAreaInsets?.bottom ?? 0);
  const bottomNavHeight = 64 + bottomInset;

  return (
    <>
    <main className="min-h-screen p-4 flex flex-col items-center" style={{ paddingBottom: bottomNavHeight }}>
      <WalletCheck>
        {toast && (
          <div
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg border"
            style={{
              backgroundColor: gameStatus === 'won' ? '#70FF5A' : gameStatus === 'lost' ? '#000000' : '#ffffff',
              color: gameStatus === 'lost' ? '#ffffff' : '#000000',
              borderColor: '#e5e7eb',
            }}
          >
            {toast}
          </div>
        )}
        {/* Results summary pill row (top-right) - only show when board is visible */}
        {playerSymbol && (
          <div className="w-full max-w-md mb-2 flex justify-end">
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 rounded-md text-[10px] bg-[#70FF5A] text-black font-semibold">W {score?.wins ?? 0}</div>
                <div className="px-2 py-1 rounded-md text-[10px] bg-white text-black border border-[#e5e7eb] font-semibold">D {score?.draws ?? 0}</div>
                <div className="px-2 py-1 rounded-md text-[10px] bg-black text-white font-semibold">L {score?.losses ?? 0}</div>
              </div>
              {/* Points display */}
              <div className="px-3 py-1 rounded-md text-[10px] bg-black text-white text-center">
                {pointsLoading ? (
                  <span style={{ color: '#70FF5A' }}>Loading...</span>
                ) : userPoints ? (
                  <span>Points: <span style={{ color: '#70FF5A', fontWeight: 'bold' }}>{userPoints.totalPoints}</span></span>
                ) : (
                  <span style={{ color: '#70FF5A' }}>Points: 0</span>
                )}
              </div>
            </div>
          </div>
        )}

        <h1 className="text-4xl font-bold mb-3" style={{ color: '#000000' }}>
          ZeroX
        </h1>
        

        
        {showAddPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white p-6 rounded-xl shadow-xl w-80 text-center">
              <div className="text-lg font-bold mb-2 text-[#70FF5A]">Add this Mini App?</div>
              <div className="text-sm mb-4 text-black">
                Quickly access ZeroX from your apps screen.
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  className="px-4 py-2 rounded-lg bg-[#70FF5A] text-black font-bold hover:bg-[#60E54A] transition-colors"
                  onClick={async () => {
                    try { await sdk.actions.addMiniApp(); } catch {}
                    setShowAddPrompt(false);
                  }}
                >
                  Add Mini App
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-white text-[#70FF5A] font-bold border border-[#70FF5A] hover:bg-[#70FF5A]/5 transition-colors"
                  onClick={() => setShowAddPrompt(false)}
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}
        
      {/* Play page content */}
      <div className="w-full flex flex-col items-center" style={{ minHeight: `calc(100vh - ${bottomNavHeight}px - 80px)` }}>
      {playerSymbol && (
        <>
          <div className="mb-3 flex items-center justify-center gap-3 flex-wrap" style={{ color: '#000000' }}>
            <div className="w-full text-center text-sm opacity-80">
              {configText}
            </div>
            <div className="w-full flex justify-center gap-2 flex-wrap">
              <button
                className="px-4 py-1.5 rounded-full text-sm border bg-white text-[#000000] border-[#70FF5A]"
                onClick={() => setShowSettings((v) => !v)}
              >
                {showSettings ? 'Close Settings' : 'Settings'}
              </button>
              <button
                className="px-4 py-1.5 rounded-full text-sm border bg-white text-[#000000] border-[#70FF5A]"
                onClick={() => setShowReferralModal(true)}
              >
                Referrals ({referralStats.totalReferrals})
              </button>
              <button
                className="px-4 py-1.5 rounded-full text-sm border bg-gradient-to-r from-yellow-400 to-orange-500 text-black border-yellow-400 font-bold"
                onClick={() => setShowLootboxModal(true)}
              >
                🎁 Lootbox
              </button>
              <button
                className="px-4 py-1.5 rounded-full text-sm border bg-purple-500 text-white border-purple-500"
                onClick={() => setShowInventoryPanel(true)}
              >
                🎒 Inventory
              </button>
            </div>
            {showSettings && (
              <div className="w-full max-w-md mx-auto p-3 rounded-xl bg-white/90 border border-[#70FF5A]/30 text-[#066c00]">
                <div className="text-xs font-semibold mb-2" style={{ color: '#066c00' }}>Variants</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs opacity-80">Size</span>
                  {([3,4,5] as const).map((n) => (
                    <button
                      key={n}
                      className={`px-3 py-1 rounded-full text-sm border ${boardSize===n?'bg-[#70FF5A] text-white border-[#70FF5A]':'bg-white text-[#70FF5A] border-[#70FF5A]'}`}
                      onClick={() => {
                        setBoardSize(n as 3|4|5);
                        setBoard(Array((n as 3|4|5) * (n as 3|4|5)).fill(null));
                        setWinningLine(null);
                        setGameStatus('playing');
                      }}
                    >
                      {n}x{n}
                    </button>
                  ))}
                </div>
                {/* <div className="flex items-center gap-2 mb-2">
                  <button
                    className={`px-3 py-1 rounded-full text-sm border ${misere?'bg-[#70FF5A] text-white border-[#70FF5A]':'bg-white text-[#70FF5A] border-[#70FF5A]'}`}
                    onClick={() => { const next = !misere; setMisere(next); setGameStatus('playing'); setWinningLine(null); setBoard((b)=>b.map(()=>null)); }}
                  >
                    Misère
                  </button>
                </div> */}

                
              </div>
            )}
          </div>
          <GameStatus status={gameStatus} isPlayerTurn={isPlayerTurn} secondsLeft={secondsLeft ?? null} />
          {/* Compact level/XP/streak summary above the board */}
          <div className="m-2 w-full max-w-md px-3 py-2 rounded-lg flex items-center justify-between text-xs" style={{ backgroundColor: '#b6f569', color: '#066c00' }}>
            <span>Level {level}</span>
            <span>XP {xp}</span>
            <span>Streak {streak}🔥</span>
          </div>
          <GameBoard
            board={board}
            onCellClick={handleCellClick}
            isPlayerTurn={isPlayerTurn}
            winningLine={winningLine}
            size={boardSize}
            hintIndex={hintIndex}
            disabledCells={!isPlayerTurn && blockedCellIndex !== null ? [blockedCellIndex] : []}
          />

          {/* Transaction Completion Modal */}
          {showTransactionModal && transactionResult && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center">
                <div className="text-4xl mb-4">
                  {transactionResult.gameStatus === 'won' ? '🎉' : 
                   transactionResult.gameStatus === 'lost' ? '😔' : '🎮'}
                </div>
                
                <h2 className="text-2xl font-bold mb-2">
                  {transactionResult.gameStatus === 'won' ? 'You Won!' : 
                   transactionResult.gameStatus === 'lost' ? 'You Lost' : "It's a Draw!"}
                </h2>
                
                {transactionResult.gameStatus === 'won' && transactionResult.payout && (
                  <div className="mb-4 p-3 bg-green-100 rounded-lg">
                    <p className="text-green-800 font-semibold">
                      You have received a payout of {transactionResult.payout} ETH
                    </p>
                  </div>
                )}
                
                {transactionResult.transactionHash && (
                  <div className="mb-4 p-2 bg-gray-100 rounded text-xs text-gray-600">
                    <p>Transaction: {transactionResult.transactionHash.slice(0, 6)}...{transactionResult.transactionHash.slice(-4)}</p>
                  </div>
                )}
                
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      setShowTransactionModal(false);
                      setTransactionResult(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Social actions */}
          {(gameStatus === 'won' || gameStatus === 'lost' || gameStatus === 'draw') && (
            <div className="mt-4 flex flex-col sm:flex-row gap-3 items-center">
              <button
                className="px-4 py-2 rounded-lg bg-[#70FF5A] text-[#066c00] font-bold hover:bg-[#b6f569] transition-colors"
                onClick={() => handleChallenge()}
              >
                Challenge Anyone
              </button>
            </div>
          )}
          
          {/* Direct Challenge UI */}
          {/* <div className="mt-4 w-full max-w-md p-4 rounded-xl bg-gradient-to-r from-[#066c00] to-[#0a8500] border-2 border-[#70FF5A]">
            <div className="text-lg font-bold mb-2 text-center text-[#70FF5A]">🎮 Challenge Friends</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="@username"
                className="flex-1 px-3 py-2 rounded-lg border-2 border-[#70FF5A] bg-white/90 text-[#066c00] font-medium placeholder:text-[#066c00]/60 focus:outline-none focus:border-[#b6f569] focus:bg-white"
                onChange={(e) => {
                  const username = e.target.value.trim().replace('@', '');
                  if (username) {
                    showToast(`Challenge @${username}?`);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const username = e.currentTarget.value.trim().replace('@', '');
                    if (username) {
                      handleChallenge(username);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <button
                className="px-4 py-2 rounded-lg bg-[#70FF5A] text-[#066c00] font-bold whitespace-nowrap hover:bg-[#b6f569] transition-colors"
                onClick={() => {
                  const input = document.querySelector('input[placeholder="@username"]') as HTMLInputElement;
                  const username = input?.value.trim().replace('@', '');
                  if (username) {
                    handleChallenge(username);
                    input.value = '';
                  }
                }}
              >
                Send Challenge
              </button>
            </div>
            <div className="text-xs text-center mt-2 text-[#b6f569] font-medium">
              Type a username and press Enter or click Send Challenge
            </div>
          </div> */}
          {/* Attribution for cast embed entry */}
          {(() => {
            const loc = context?.location as unknown;
            type CastAuthor = { fid: number; username?: string; pfpUrl?: unknown };
            type CastObj = { author: CastAuthor; hash: string };
            type CastEmbedLoc = { type: 'cast_embed'; cast: CastObj };
            const isCastEmbed = !!(loc && typeof (loc as CastEmbedLoc).type === 'string' && (loc as CastEmbedLoc).type === 'cast_embed' && (loc as CastEmbedLoc).cast);
            if (!isInMiniApp || !isCastEmbed) return null;
            const cast = (loc as CastEmbedLoc).cast;
            const author = cast.author;
            const pfp = typeof author.pfpUrl === 'string' ? author.pfpUrl : undefined;
            return (
              <div className="mt-4 p-3 rounded-lg bg-[#b6f569]/30 text-[#70FF5A] text-sm flex items-center gap-3">
                {pfp ? (
                  <Image src={pfp} alt={author.username || 'pfp'} width={24} height={24} className="rounded-full" />
                ) : null}
                <span>Shared by @{author.username || author.fid}</span>
                <div className="ml-auto flex gap-2">
                  <button
                    className="px-3 py-1 rounded bg-[#70FF5A] text-white"
                    onClick={async () => {
                      try {
                        const result = await sdk.actions.composeCast({ 
                          text: `Thanks @${author.username || author.fid} for sharing! 🙏`, 
                          parent: { type: 'cast', hash: cast.hash },
                          close: false
                        });
                        if (result?.cast) {
                          showToast('Thanks sent! 🙏');
                        }
                      } catch (e) {
                        console.error('Failed to send thanks:', e);
                      }
                    }}
                  >
                    Thank them
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-[#70FF5A]/10 text-[#70FF5A] border border-[#70FF5A]"
                    onClick={() => {
                      try { viewProfile(author.fid); } catch {}
                    }}
                  >
                    View profile
                  </button>
                </div>
              </div>
            );
          })()}
          {/* Rematch series removed */}
          <div className="mt-4" />
        </>
      )}
      </div>
      </WalletCheck>
    </main>
    <BottomNav />
    
    {/* Referral Modal */}
    {showReferralModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-black">Referral Program</h2>
            <button
              onClick={() => setShowReferralModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Debug info */}
            {/* Debug info removed */}
            <div className="text-center">
              <div className="text-2xl font-bold text-[#70FF5A]">{referralStats.totalReferrals}</div>
              <div className="text-sm text-gray-600">Total Referrals</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-[#70FF5A]">{referralStats.totalPoints}</div>
              <div className="text-sm text-gray-600">Points Earned</div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Your Referral Link:</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={getReferralLink()}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
                <button
                  onClick={copyReferralLink}
                  className="px-4 py-2 bg-[#70FF5A] text-black rounded-lg text-sm font-medium hover:bg-[#5FE04A]"
                >
                  Copy
                </button>
                <button
                  onClick={shareReferralCast}
                  className="px-4 py-2 bg-[#1DA1F2] text-white rounded-lg text-sm font-medium hover:bg-[#1A91DA]"
                >
                  Share
                </button>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 text-center">
              Earn 2 points for each friend you refer! Share your link and start earning.
            </div>
          </div>
        </div>
      </div>
    )}
    
    {/* Lootbox Modal */}
    <LootboxModal
      isOpen={showLootboxModal}
      onClose={() => setShowLootboxModal(false)}
      onItemReceived={(item) => {
        showToast(`You received: ${item.name}!`);
        // Refresh inventory if it's open
        if (showInventoryPanel) {
          // Trigger inventory refresh
        }
      }}
    />
    
    {/* Inventory Panel */}
    <InventoryPanel
      isOpen={showInventoryPanel}
      onClose={() => setShowInventoryPanel(false)}
      onUseItem={(item) => {
        // Handle power-up usage
        handlePowerUpUsage(item);
      }}
    />
    </>
  );
}
 
