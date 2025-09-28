'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import Confetti from 'react-confetti';

interface LootboxItem {
  id: number;
  type: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points_value: number;
  usage_type: string;
}

interface LootboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemReceived: (item: LootboxItem) => void;
  showToast: (message: string) => void;
  isAutoPopup?: boolean;
  onAutoClose?: () => void;
}

const RARITY_COLORS = {
  common: '#70FF5A',
  rare: '#4A90E2', 
  epic: '#9B59B6',
  legendary: '#F39C12'
};

const RARITY_GLOW = {
  common: 'shadow-green-500/50',
  rare: 'shadow-blue-500/50',
  epic: 'shadow-purple-500/50', 
  legendary: 'shadow-orange-500/50'
};

export function LootboxModal({ isOpen, onClose, onItemReceived, showToast, isAutoPopup = false, onAutoClose }: LootboxModalProps) {
  const { address } = useAccount();
  const [isOpening, setIsOpening] = useState(false);
  const [receivedItem, setReceivedItem] = useState<LootboxItem | null>(null);
  const [dailyStatus, setDailyStatus] = useState({ earned: 0, limit: 3, remaining: 3, can_open: true });
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // Track window size for confetti
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    updateWindowSize();
    window.addEventListener('resize', updateWindowSize);
    return () => window.removeEventListener('resize', updateWindowSize);
  }, []);

  // Load daily lootbox status
  useEffect(() => {
    if (isOpen && address) {
      fetchLootboxStatus();
    }
  }, [isOpen, address]);

  // Auto-open lootbox if it's an auto popup
  useEffect(() => {
    if (isOpen && isAutoPopup && address && dailyStatus.can_open) {
      // Small delay to show the modal first
      const timer = setTimeout(() => {
        openLootbox();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isAutoPopup, address, dailyStatus.can_open]);

  const fetchLootboxStatus = async () => {
    try {
      const response = await fetch(`/api/lootbox?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setDailyStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch lootbox status:', error);
    }
  };

  const openLootbox = async () => {
    if (!address || !dailyStatus.can_open) return;

    setIsOpening(true);
    setReceivedItem(null);

    try {
      const response = await fetch('/api/lootbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });

      if (response.ok) {
        const data = await response.json();
        setReceivedItem(data.item);
        onItemReceived(data.item);
        
        // Trigger confetti celebration
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        
        // Update daily status
        setDailyStatus(prev => ({
          ...prev,
          earned: data.daily_earned,
          remaining: data.daily_limit - data.daily_earned,
          can_open: data.daily_earned < data.daily_limit
        }));
      } else {
        const error = await response.json();
        showToast(error.error || 'Failed to open lootbox');
      }
    } catch (error) {
      console.error('Failed to open lootbox:', error);
      showToast('Failed to open lootbox');
    } finally {
      setIsOpening(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        {/* Confetti */}
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={200}
            gravity={0.3}
            initialVelocityY={20}
            colors={['#70FF5A', '#4A90E2', '#9B59B6', '#F39C12', '#E74C3C', '#F1C40F']}
          />
        )}
        
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-white rounded-2xl p-6 max-w-md w-full text-center relative overflow-hidden"
        >
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-black mb-2">🎁 Daily Lootbox</h2>
            <p className="text-gray-600 text-sm">
              {dailyStatus.remaining > 0 
                ? `${dailyStatus.remaining} lootbox${dailyStatus.remaining > 1 ? 'es' : ''} remaining today`
                : 'No lootboxes remaining today'
              }
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-[#70FF5A] h-2 rounded-full transition-all duration-300"
                style={{ width: `${(dailyStatus.earned / dailyStatus.limit) * 100}%` }}
              />
            </div>
          </div>

          {/* Lootbox Opening Animation */}
          <div className="mb-6">
            {isOpening ? (
              <motion.div
                initial={{ scale: 1 }}
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-40 h-40 mx-auto relative"
              >
                <i>
              </motion.div>
            ) : receivedItem ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className={`w-32 h-32 mx-auto rounded-2xl flex items-center justify-center text-6xl shadow-2xl ${RARITY_GLOW[receivedItem.rarity]}`}
                style={{ 
                  backgroundColor: RARITY_COLORS[receivedItem.rarity],
                  boxShadow: `0 0 30px ${RARITY_COLORS[receivedItem.rarity]}50`
                }}
              >
                {receivedItem.type === 'points' && '💰'}
                {receivedItem.type === 'try_again' && '🔄'}
                {receivedItem.type === 'help' && '🤖'}
                {receivedItem.type === 'undo_step' && '↩️'}
                {receivedItem.type === 'extra_life' && '❤️'}
                {receivedItem.type === 'streak_recovery' && '🔥'}
                {receivedItem.type === 'double_points' && '⚡'}
              </motion.div>
            ) : (
              <motion.div 
                className="w-40 h-40 mx-auto relative cursor-pointer hover:scale-105 transition-transform"
                onClick={openLootbox}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl shadow-2xl" 
                     style={{ 
                       boxShadow: '0 0 30px rgba(239, 68, 68, 0.6), 0 0 60px rgba(239, 68, 68, 0.3)',
                       background: 'radial-gradient(circle, #ef4444 0%, #dc2626 50%, #b91c1c 100%)'
                     }}>
                </div>
                <div className="absolute inset-2 bg-black rounded-xl flex items-center justify-center">
                  <span className="text-4xl font-bold text-red-400">LOOTBOX</span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="grid grid-cols-3 gap-1 w-20 h-20">
                    <div className="bg-red-500 rounded text-xs flex items-center justify-center text-white font-bold">H</div>
                    <div className="bg-red-500 rounded text-xs flex items-center justify-center text-white font-bold">E</div>
                    <div className="bg-red-500 rounded text-xs flex items-center justify-center text-white font-bold"></div>
                    <div className="bg-red-500 rounded text-xs flex items-center justify-center text-white font-bold">L</div>
                    <div className="bg-red-500 rounded text-xs flex items-center justify-center text-white font-bold">P</div>
                    <div className="bg-red-500 rounded text-xs flex items-center justify-center text-white font-bold">X</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Item Details */}
          {receivedItem && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-lg"
              style={{ 
                backgroundColor: `${RARITY_COLORS[receivedItem.rarity]}20`,
                border: `2px solid ${RARITY_COLORS[receivedItem.rarity]}`
              }}
            >
              <h3 className="text-xl font-bold mb-2" style={{ color: RARITY_COLORS[receivedItem.rarity] }}>
                {receivedItem.name}
              </h3>
              <p className="text-gray-700 text-sm mb-2">{receivedItem.description}</p>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: RARITY_COLORS[receivedItem.rarity] }}>
                {receivedItem.rarity}
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
            {!receivedItem && !isOpening && (
              <button
                onClick={openLootbox}
                disabled={!dailyStatus.can_open}
                className={`px-6 py-3 rounded-lg font-bold transition-all ${
                  dailyStatus.can_open
                    ? 'bg-[#70FF5A] text-black hover:bg-[#60E54A] hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {dailyStatus.can_open ? 'Open Lootbox' : 'No Lootboxes Left'}
              </button>
            )}
            
            {(receivedItem || !dailyStatus.can_open) && (
              <button
                onClick={isAutoPopup ? onAutoClose : onClose}
                className="px-6 py-3 rounded-lg font-bold bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
              >
                {isAutoPopup ? 'Claim & Continue' : 'Close'}
              </button>
            )}
          </div>

          {/* Daily Progress */}
          <div className="mt-4 text-xs text-gray-500">
            {dailyStatus.earned}/{dailyStatus.limit} lootboxes opened today
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
