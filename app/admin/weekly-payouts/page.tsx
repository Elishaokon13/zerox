'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

interface WeeklyPayout {
  week_start: string;
  rank: number;
  address: string;
  alias?: string;
  amount_eth: number;
  tx_hash?: string;
  paid_at?: string;
}

interface WeeklyPayoutsData {
  weekStart: string;
  payouts: WeeklyPayout[];
}

export default function WeeklyPayoutsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [farcasterUsername, setFarcasterUsername] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentWeek, setCurrentWeek] = useState('');
  const [payoutsData, setPayoutsData] = useState<WeeklyPayoutsData | null>(null);
  const [ethPrice, setEthPrice] = useState<number>(3500);
  const { address } = useAccount();

  const fetchEthPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      if (data.ethereum?.usd) {
        setEthPrice(data.ethereum.usd);
      }
    } catch (error) {
      console.error('Failed to fetch ETH price:', error);
    }
  };

  const getCurrentWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
  };

  const getWeekStartFor = (d: Date) => {
    const dayOfWeek = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
  };

  const getLastWeekStart = () => {
    const now = new Date();
    // Go back 7 days, then compute that week's Monday
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    return getWeekStartFor(lastWeek);
  };

  const handleAuthenticate = async () => {
    if (!farcasterUsername.trim() || !address) {
      alert('Please enter your Farcaster username and ensure wallet is connected');
      return;
    }

    if (farcasterUsername.trim().toLowerCase() === 'defidevrel') {
      setIsAuthenticated(true);
      setCurrentWeek(getCurrentWeekStart());
      await fetchEthPrice();
      loadPayoutsData();
    } else {
      alert('Access denied. Only defidevrel can access this admin panel.');
      setFarcasterUsername('');
    }
  };

  const loadPayoutsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/weekly-payout?week=${currentWeek}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch payouts data');
      }
      
      setPayoutsData(data);
    } catch (err) {
      console.error('Failed to load payouts data:', err);
      setError('Failed to load weekly payouts data');
    } finally {
      setLoading(false);
    }
  }, [currentWeek]);

  const handleProcessPayouts = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch('/api/weekly-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: currentWeek })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process payouts');
      }
      
      setSuccess(`Successfully processed ${data.payouts?.length || 0} payouts for week ${currentWeek}`);
      await loadPayoutsData(); // Refresh data
    } catch (err) {
      console.error('Failed to process payouts:', err);
      setError(err instanceof Error ? err.message : 'Failed to process payouts');
    } finally {
      setLoading(false);
    }
  };

  const formatETH = (eth: number) => {
    if (eth === 0) return '0 ETH';
    return `${eth.toFixed(6)} ETH`;
  };

  const formatUSD = (eth: number) => {
    if (eth === 0) return '$0.00';
    const usdValue = eth * ethPrice;
    if (usdValue < 1) return `$${usdValue.toFixed(4)}`;
    if (usdValue < 100) return `$${usdValue.toFixed(2)}`;
    return `$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTrophyEmoji = (rank: number) => {
    return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
  };

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(async () => {
        await fetchEthPrice();
        loadPayoutsData();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, currentWeek, loadPayoutsData]);

  // Show authentication form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Weekly Payouts Admin</h1>
            
            {!address ? (
              <div className="text-center">
                <p className="text-red-600 mb-4">Please connect your wallet first</p>
                <p className="text-sm text-gray-600">You need to connect your Farcaster wallet to access the admin panel.</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Connected wallet: <span className="font-mono text-xs">{address}</span>
                </p>
                
                <div className="mb-4">
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    Farcaster Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={farcasterUsername}
                    onChange={(e) => setFarcasterUsername(e.target.value)}
                    className="w-full px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#70FF5A] focus:border-transparent"
                    placeholder="Enter your Farcaster username"
                    required
                  />
                </div>

                <button
                  onClick={handleAuthenticate}
                  className="w-full bg-[#70FF5A] text-white py-2 px-4 rounded-md hover:bg-[#5cef4a] transition-colors"
                >
                  Authenticate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Weekly Payouts Management</h1>
            <div className="text-sm text-gray-600 mt-1">
              ETH Price: <span className="font-semibold text-[#70FF5A]">${ethPrice.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Logged in as: <span className="font-semibold text-[#70FF5A]">@{farcasterUsername}</span>
            </div>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Current Week Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Selected Week: {currentWeek}</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeek(getLastWeekStart())}
                disabled={loading}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
                title="Select last week"
              >
                Last Week
              </button>
              <button
                onClick={() => setCurrentWeek(getCurrentWeekStart())}
                disabled={loading}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
                title="Select current week"
              >
                This Week
              </button>
              <input
                type="date"
                value={currentWeek}
                onChange={(e) => setCurrentWeek(e.target.value)}
                className="px-3 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#70FF5A] focus:border-transparent"
              />
            </div>
            <button
              onClick={handleProcessPayouts}
              disabled={loading}
              className="px-6 py-3 bg-[#70FF5A] text-white rounded-md hover:bg-[#5cef4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Process Weekly Payouts'}
            </button>
            <button
              onClick={loadPayoutsData}
              disabled={loading}
              className="px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Refresh Data
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <div className="mt-2 text-sm text-green-700">{success}</div>
              </div>
            </div>
          </div>
        )}

        {/* Payouts Data */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#70FF5A]"></div>
            <p className="mt-4 text-gray-600">Loading payouts data...</p>
          </div>
        ) : payoutsData ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Payouts for Week {payoutsData.weekStart}
            </h3>
            
            {payoutsData.payouts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No payouts recorded for this week yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payoutsData.payouts.map((payout) => (
                      <tr key={`${payout.week_start}-${payout.rank}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <span className="text-lg mr-2">{getTrophyEmoji(payout.rank)}</span>
                            {payout.rank}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payout.alias ? `@${payout.alias}` : formatAddress(payout.address)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-semibold text-[#70FF5A]">{formatETH(payout.amount_eth)}</div>
                            <div className="text-xs text-gray-500">{formatUSD(payout.amount_eth)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {payout.tx_hash ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payout.tx_hash ? (
                            <a
                              href={`https://basescan.org/tx/${payout.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#70FF5A] hover:underline"
                            >
                              View on Basescan
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No data available. Click &quot;Refresh Data&quot; to load payouts information.
          </div>
        )}
      </div>
    </div>
  );
}
