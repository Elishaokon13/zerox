'use client';

import { useScoreboard } from '@/lib/useScoreboard';
import { motion } from 'framer-motion';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useState, useEffect } from 'react';

interface UserPoints {
  gamePoints: number;
  referralPoints: number;
  totalPoints: number;
  totalReferrals: number;
}

export function Scoreboard() {
  const { address } = useAccount();
  const { connect } = useConnect();
  const { score } = useScoreboard();
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [pointsLoading, setPointsLoading] = useState(false);

  const GREEN = '#70FF5A';
  const LIME_GREEN = '#b6f569';

  // Fetch user points when address changes
  useEffect(() => {
    const fetchUserPoints = async () => {
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
    };

    fetchUserPoints();
  }, [address]);

  if (!address) {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => connect({ connector: injected() })}
        className="mt-4 px-4 py-2 rounded-lg font-bold"
        style={{
          backgroundColor: LIME_GREEN,
          color: GREEN,
          border: `2px solid ${GREEN}`,
        }}
      >
        Connect Wallet to View Score
      </motion.button>
    );
  }

  if (!score) {
    return (
      <div className="mt-4 text-center" style={{ color: GREEN }}>
        No games recorded yet
      </div>
    );
  }

  return (
    <div className="mt-2 w-full max-w-md">
      {/* Score squares */}
      <div className="px-3 py-2 rounded-lg flex items-center justify-center gap-6 text-sm" style={{ backgroundColor: LIME_GREEN }}>
        <div className="flex items-center gap-2" style={{ color: GREEN }}>
          <span className="font-semibold">Wins</span>
          <span className="text-xl font-bold">{score.wins}</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: GREEN }}>
          <span className="font-semibold">Losses</span>
          <span className="text-xl font-bold">{score.losses}</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: GREEN }}>
          <span className="font-semibold">Draws</span>
          <span className="text-xl font-bold">{score.draws}</span>
        </div>
      </div>
      
      {/* Total points display */}
      <div className="mt-2 px-3 py-2 rounded-lg text-center" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
        {pointsLoading ? (
          <div className="text-sm" style={{ color: '#70FF5A' }}>
            Loading...
          </div>
        ) : userPoints ? (
          <div className="text-sm">
            <span className="font-semibold">Points: </span>
            <span className="text-lg font-bold" style={{ color: '#70FF5A' }}>
              {userPoints.totalPoints}
            </span>
          </div>
        ) : (
          <div className="text-sm" style={{ color: '#70FF5A' }}>
            Points: 0
          </div>
        )}
      </div>
    </div>
  );
}