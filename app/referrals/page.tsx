'use client';

import { useAccount } from 'wagmi';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { WalletCheck } from '../components/WalletCheck';
import BottomNav from '../components/BottomNav';
import { useState, useEffect } from 'react';

interface ReferralStats {
  totalReferrals: number;
  totalEarnings: number;
  referralCode: string;
  referralLink: string;
}

export default function ReferralsPage() {
  const { address } = useAccount();
  const { context } = useMiniKit();
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Account for bottom nav height + safe area
  const bottomInset = (context?.client?.safeAreaInsets?.bottom ?? 0);
  const bottomNavHeight = 64 + bottomInset;

  const fetchReferralStats = async () => {
    if (!address) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/referral?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setReferralStats(data);
      } else {
        console.error('Failed to fetch referral stats');
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralStats();
  }, [address]);

  const copyReferralLink = async () => {
    if (referralStats?.referralLink) {
      try {
        await navigator.clipboard.writeText(referralStats.referralLink);
        // You could add a toast notification here
        alert('Referral link copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy referral link:', error);
      }
    }
  };

  return (
    <>
      <main className="min-h-screen p-4 flex flex-col items-center" style={{ paddingBottom: bottomNavHeight }}>
        <WalletCheck>
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold text-center mb-6" style={{ color: '#70FF5A' }}>
              Referrals
            </h1>

            {loading ? (
              <div className="text-center py-8">
                <div className="text-sm" style={{ color: '#70FF5A' }}>
                  Loading referral stats...
                </div>
              </div>
            ) : referralStats ? (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#b6f569', color: '#000' }}>
                    <div className="text-2xl font-bold">{referralStats.totalReferrals}</div>
                    <div className="text-sm font-semibold">Total Referrals</div>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#b6f569', color: '#000' }}>
                    <div className="text-2xl font-bold">{referralStats.totalEarnings}</div>
                    <div className="text-sm font-semibold">Points Earned</div>
                  </div>
                </div>

                {/* Referral Code */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#000', color: '#fff' }}>
                  <div className="text-sm font-semibold mb-2" style={{ color: '#70FF5A' }}>
                    Your Referral Code
                  </div>
                  <div className="text-lg font-mono bg-gray-800 p-2 rounded text-center">
                    {referralStats.referralCode}
                  </div>
                </div>

                {/* Referral Link */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#000', color: '#fff' }}>
                  <div className="text-sm font-semibold mb-2" style={{ color: '#70FF5A' }}>
                    Your Referral Link
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referralStats.referralLink}
                      readOnly
                      className="flex-1 p-2 rounded text-sm bg-gray-800 text-white"
                    />
                    <button
                      onClick={copyReferralLink}
                      className="px-4 py-2 rounded text-sm font-semibold"
                      style={{ backgroundColor: '#70FF5A', color: '#000' }}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* How it works */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#000', color: '#fff' }}>
                  <div className="text-sm font-semibold mb-3" style={{ color: '#70FF5A' }}>
                    How Referrals Work
                  </div>
                  <div className="text-xs space-y-2">
                    <div>• Share your referral link with friends</div>
                    <div>• When they sign up and play, you both get +2 points</div>
                    <div>• Track your earnings and referral count here</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-sm" style={{ color: '#70FF5A' }}>
                  No referral data available
                </div>
              </div>
            )}
          </div>
        </WalletCheck>
      </main>
      <BottomNav />
    </>
  );
}
