'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';

interface InventoryItem {
  inventory_id: number;
  quantity: number;
  expires_at: string | null;
  id: number;
  item_type: string;
  item_name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points_value: number;
  usage_type: string;
}

interface InventoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUseItem: (item: InventoryItem) => void;
}

const RARITY_COLORS = {
  common: '#70FF5A',
  rare: '#4A90E2',
  epic: '#9B59B6',
  legendary: '#F39C12'
};

const RARITY_ICONS = {
  common: '🟢',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟠'
};

const USAGE_TYPE_LABELS = {
  immediate: 'Use Now',
  pre_game: 'Before Game',
  mid_game: 'During Game',
  post_game: 'After Game'
};

export function InventoryPanel({ isOpen, onClose, onUseItem }: InventoryPanelProps) {
  const { address } = useAccount();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load inventory when panel opens
  useEffect(() => {
    if (isOpen && address) {
      loadInventory();
    }
  }, [isOpen, address, loadInventory]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/inventory?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setInventory(data.items || []);
      } else {
        console.error('Failed to load inventory');
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const getItemIcon = (itemType: string) => {
    switch (itemType) {
      case 'points': return '💰';
      case 'try_again': return '🔄';
      case 'help': return '🤖';
      case 'undo_step': return '↩️';
      case 'extra_life': return '❤️';
      case 'streak_recovery': return '🔥';
      case 'double_points': return '⚡';
      default: return '🎁';
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getExpirationText = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never expires';
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffHours = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffHours <= 0) return 'Expired';
    if (diffHours < 24) return `Expires in ${diffHours}h`;
    const diffDays = Math.ceil(diffHours / 24);
    return `Expires in ${diffDays}d`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-4 sm:p-6 max-w-sm sm:max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-black">🎒 Inventory</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl"
          >
            ×
          </button>
        </div>

        {/* Inventory Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading inventory...</div>
            </div>
          ) : inventory.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <div className="text-4xl sm:text-6xl mb-4">📦</div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2">Empty Inventory</h3>
              <p className="text-gray-500 text-sm sm:text-base">Open lootboxes to get power-ups!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {inventory.map((item) => (
                <motion.div
                  key={item.inventory_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 sm:p-4 rounded-lg border-2 relative ${
                    isExpired(item.expires_at) 
                      ? 'border-gray-300 bg-gray-100 opacity-60' 
                      : 'border-gray-200 bg-white hover:shadow-md'
                  }`}
                  style={{
                    borderColor: isExpired(item.expires_at) 
                      ? '#d1d5db' 
                      : RARITY_COLORS[item.rarity]
                  }}
                >
                  {/* Rarity Badge */}
                  <div className="absolute top-2 right-2 text-lg">
                    {RARITY_ICONS[item.rarity]}
                  </div>

                  {/* Item Icon and Name */}
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="text-2xl sm:text-3xl">{getItemIcon(item.item_type)}</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-base sm:text-lg" style={{ color: RARITY_COLORS[item.rarity] }}>
                        {item.item_name}
                      </h3>
                      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: RARITY_COLORS[item.rarity] }}>
                        {item.rarity}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-700 text-xs sm:text-sm mb-2 sm:mb-3">{item.description}</p>

                  {/* Quantity and Expiration */}
                  <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                    <span>Qty: {item.quantity}</span>
                    <span className={isExpired(item.expires_at) ? 'text-red-500' : ''}>
                      {getExpirationText(item.expires_at)}
                    </span>
                  </div>

                  {/* Usage Type */}
                  <div className="text-xs font-medium text-gray-600 mb-3">
                    {USAGE_TYPE_LABELS[item.usage_type as keyof typeof USAGE_TYPE_LABELS]}
                  </div>

                  {/* Use Button */}
                  <button
                    onClick={() => onUseItem(item)}
                    disabled={isExpired(item.expires_at)}
                    className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                      isExpired(item.expires_at)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#70FF5A] text-black hover:bg-[#60E54A] hover:scale-105'
                    }`}
                  >
                    {isExpired(item.expires_at) ? 'Expired' : 'Use Item'}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
          Power-ups enhance your gameplay experience
        </div>
      </motion.div>
    </div>
  );
}
