'use client';

import { useAccount } from 'wagmi';
// import { useMiniKit } from '@coinbase/onchainkit/minikit'; // Not used in this component
import { WalletCheck } from '../components/WalletCheck';
import BottomNav from '../components/BottomNav';
import { useState, useEffect, useCallback } from 'react';

interface ReferralStats {
  totalReferrals: number;
  totalPoints: number;
  referralCode: string;
  referralLink: string;
}

export default function ReferralsPage() {
  const { address } = useAccount();
  // const { context } = useMiniKit(); // Not used in this component
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Account for bottom nav height + safe area (not used in this component)
  // const bottomInset = (context?.client?.safeAreaInsets?.bottom ?? 0);
  // const bottomNavHeight = 64 + bottomInset;

  const fetchReferralStats = useCallback(async () => {
    if (!address) {
      console.log('No address available for referrals');
      return;
    }

    console.log('Fetching referral stats for address:', address);
    setLoading(true);
    try {
      const response = await fetch(`/api/referral?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Referral stats data:', data);
        setReferralStats(data);
      } else {
        console.error('Failed to fetch referral stats');
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchReferralStats();
  }, [address, fetchReferralStats]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const copyReferralLink = async () => {
    if (referralStats?.referralLink) {
      try {
        await navigator.clipboard.writeText(referralStats.referralLink);
        showToast('Referral link copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy referral link:', error);
        showToast('Failed to copy referral link');
      }
    }
  };

  return (
    <>
      <div className="min-h-screen" style={{ backgroundColor: '#ffffff' }}>
        {toast && (
          <div
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg border"
            style={{
              backgroundColor: '#70FF5A',
              color: '#000',
              borderColor: '#e5e7eb',
            }}
          >
            {toast}
          </div>
        )}
        <div className="w-full max-w-md mx-auto pt-10">
          <WalletCheck>
            <div className="px-4">
              <h1 className="text-4xl font-black text-center mb-8 text-black tracking-wider">REFERRALS</h1>

              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-2xl bg-[#F3F4F6] animate-pulse" />
                  ))}
                </div>
              ) : referralStats ? (
                <div>
                  {/* Debug info */}
                  <div className="text-xs text-gray-500 mb-2">
                    Debug: {JSON.stringify(referralStats, null, 2)}
                  </div>
                <div className="space-y-4">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-2xl border border-[#F3F4F6] text-center">
                      <div className="text-2xl font-black text-black">{referralStats.totalReferrals}</div>
                      <div className="text-sm text-[#9CA3AF] font-semibold">Total Referrals</div>
                    </div>
                    <div className="p-4 bg-white rounded-2xl border border-[#F3F4F6] text-center">
                      <div className="text-2xl font-black text-black">{referralStats.totalPoints}</div>
                      <div className="text-sm text-[#9CA3AF] font-semibold">Points Earned</div>
                    </div>
                  </div>

                  {/* Referral Code */}
                  <div className="p-4 bg-white rounded-2xl border border-[#F3F4F6]">
                    <div className="text-sm font-semibold mb-3 text-black">
                      Your Referral Code
                    </div>
                    <div className="text-lg font-mono bg-[#F3F4F6] p-3 rounded-lg text-center text-black">
                      {referralStats.referralCode}
                    </div>
                  </div>

                  {/* Referral Link */}
                  <div className="p-4 bg-white rounded-2xl border border-[#F3F4F6]">
                    <div className="text-sm font-semibold mb-3 text-black">
                      Your Referral Link
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={referralStats.referralLink}
                        readOnly
                        className="flex-1 p-3 rounded-lg text-sm bg-[#F3F4F6] text-black border-0"
                      />
                      <button
                        onClick={copyReferralLink}
                        className="px-4 py-3 rounded-lg text-sm font-semibold bg-[#70FF5A] text-black hover:bg-[#5cef4a] transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* How it works */}
                  <div className="p-4 bg-white rounded-2xl border border-[#F3F4F6]">
                    <div className="text-sm font-semibold mb-3 text-black">
                      How Referrals Work
                    </div>
                    <div className="text-sm text-[#4b4b4f] space-y-2">
                      <div>• Share your referral link with friends</div>
                      <div>• When they sign up and play, you both get +2 points</div>
                      <div>• Track your earnings and referral count here</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-sm text-[#9CA3AF]">
                    {address ? 'No referral data available' : 'Connect your wallet to view referrals'}
                  </div>
                </div>
              )}
            </div>
          </WalletCheck>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
