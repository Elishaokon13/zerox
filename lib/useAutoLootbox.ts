'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

const LOOTBOX_INTERVAL = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const STORAGE_KEY = 'lastLootboxTime';

export function useAutoLootbox() {
  const { address } = useAccount();
  const [shouldShowAutoLootbox, setShouldShowAutoLootbox] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkLootboxEligibility = useCallback(() => {
    if (!address) {
      setIsChecking(false);
      return;
    }

    try {
      const lastTime = localStorage.getItem(`${STORAGE_KEY}_${address}`);
      const now = Date.now();
      
      if (!lastTime) {
        // First time user, show lootbox immediately
        setShouldShowAutoLootbox(true);
        setIsChecking(false);
        return;
      }

      const timeSinceLastLootbox = now - parseInt(lastTime);
      
      if (timeSinceLastLootbox >= LOOTBOX_INTERVAL) {
        setShouldShowAutoLootbox(true);
      }
      
      setIsChecking(false);
    } catch (error) {
      console.error('Error checking lootbox eligibility:', error);
      setIsChecking(false);
    }
  }, [address]);

  const markLootboxOpened = useCallback(() => {
    if (!address) return;
    
    try {
      localStorage.setItem(`${STORAGE_KEY}_${address}`, Date.now().toString());
      setShouldShowAutoLootbox(false);
    } catch (error) {
      console.error('Error marking lootbox as opened:', error);
    }
  }, [address]);

  const dismissAutoLootbox = useCallback(() => {
    setShouldShowAutoLootbox(false);
  }, []);

  // Check on mount and when address changes
  useEffect(() => {
    checkLootboxEligibility();
  }, [checkLootboxEligibility]);

  // Check every 5 minutes for auto lootbox eligibility
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(() => {
      checkLootboxEligibility();
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(interval);
  }, [address, checkLootboxEligibility]);

  return {
    shouldShowAutoLootbox,
    isChecking,
    markLootboxOpened,
    dismissAutoLootbox,
    checkLootboxEligibility
  };
}
