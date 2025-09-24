'use client';
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface DashboardMetrics {
  totalPoints: number;
  totalPlayers: number;
  totalPayouts: number;
  totalCharges: number;
  weeklyActiveUsers: number;
  allTimeActiveUsers: number;
  currentWeekPayouts: number;
  topPlayers: Array<{
    rank: number;
    address: string;
    alias?: string;
    points: number;
    wins: number;
    draws: number;
    losses: number;
  }>;
  recentActivity: Array<{
    type: 'payout' | 'charge' | 'game';
    amount?: number;
    address: string;
    timestamp: string;
    description: string;
  }>;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [farcasterUsername, setFarcasterUsername] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ethPrice, setEthPrice] = useState<number>(3500); // Default fallback price
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
      // Keep the default fallback price
    }
  };

  const handleAuthenticate = async () => {
    if (!farcasterUsername.trim() || !address) {
      alert('Please enter your Farcaster username and ensure wallet is connected');
      return;
    }

    // Check if the username matches the admin username
    if (farcasterUsername.trim().toLowerCase() === 'defidevrel') {
      setIsAuthenticated(true);
      await fetchEthPrice(); // Fetch current ETH price
      loadMetrics();
    } else {
      alert('Access denied. Only defidevrel can access this admin panel.');
      setFarcasterUsername('');
    }
  };

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the dedicated metrics API for accurate data
      const metricsRes = await fetch('/api/admin/metrics');
      const metricsData = await metricsRes.json();

      if (!metricsRes.ok) {
        throw new Error(metricsData.error || 'Failed to fetch metrics');
      }

      // Get top players for the leaderboard table
      const allTimeRes = await fetch('/api/leaderboard/alltime');
      const allTimeData = await allTimeRes.json();
      
      const topPlayers = allTimeData.top?.slice(0, 3).map((player: any, index: number) => ({
        rank: index + 1,
        address: player.address,
        alias: player.alias,
        points: player.points || 0,
        wins: player.wins || 0,
        draws: player.draws || 0,
        losses: player.losses || 0
      })) || [];

      setMetrics({
        totalPoints: metricsData.totalPoints,
        totalPlayers: metricsData.totalPlayers,
        totalPayouts: metricsData.totalPayouts,
        totalCharges: metricsData.totalCharges,
        weeklyActiveUsers: metricsData.weeklyActiveUsers,
        allTimeActiveUsers: metricsData.allTimeActiveUsers,
        currentWeekPayouts: metricsData.currentWeekPayouts,
        topPlayers,
        recentActivity: metricsData.recentActivity
      });
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setError('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatETH = (eth: number) => {
    if (eth === 0) return '0 ETH';
    return `${eth.toFixed(6)} ETH`;
  };

  const formatUSD = (eth: number) => {
    if (eth === 0) return '$0.00';
    // Using current ETH price from API
    const usdValue = eth * ethPrice;
    if (usdValue < 1) return `$${usdValue.toFixed(4)}`;
    if (usdValue < 100) return `$${usdValue.toFixed(2)}`;
    return `$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return formatNumber(num);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Auto-refresh metrics every 30 seconds
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(async () => {
        await fetchEthPrice(); // Refresh ETH price
        loadMetrics();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Show authentication form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
            
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#70FF5A]"></div>
            <p className="mt-4 text-gray-600">Loading dashboard metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadMetrics}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
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

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Points</p>
                <p className="text-2xl font-bold text-gray-900">{formatLargeNumber(metrics?.totalPoints || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Players</p>
                <p className="text-2xl font-bold text-gray-900">{formatLargeNumber(metrics?.totalPlayers || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Paid Out</p>
                <p className="text-2xl font-bold text-gray-900">{formatUSD(metrics?.totalPayouts || 0)}</p>
                <p className="text-xs text-gray-500">{formatETH(metrics?.totalPayouts || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Charged</p>
                <p className="text-2xl font-bold text-gray-900">{formatUSD(metrics?.totalCharges || 0)}</p>
                <p className="text-xs text-gray-500">{formatETH(metrics?.totalCharges || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Activity</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Active Users This Week</span>
                <span className="font-semibold text-[#70FF5A]">{formatLargeNumber(metrics?.weeklyActiveUsers || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Week Payouts</span>
                <div className="text-right">
                  <div className="font-semibold text-[#70FF5A]">{formatUSD(metrics?.currentWeekPayouts || 0)}</div>
                  <div className="text-xs text-gray-500">{formatETH(metrics?.currentWeekPayouts || 0)}</div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Points per Player</span>
                <span className="font-semibold text-[#70FF5A]">
                  {metrics?.totalPlayers ? Math.round((metrics?.totalPoints || 0) / metrics.totalPlayers) : 0}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Net Revenue</span>
                <div className="text-right">
                  <div className={`font-semibold ${(metrics?.totalCharges || 0) - (metrics?.totalPayouts || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatUSD((metrics?.totalCharges || 0) - (metrics?.totalPayouts || 0))}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatETH((metrics?.totalCharges || 0) - (metrics?.totalPayouts || 0))}
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Volume</span>
                <div className="text-right">
                  <div className="font-semibold text-[#70FF5A]">
                    {formatUSD((metrics?.totalPayouts || 0) + (metrics?.totalCharges || 0))}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatETH((metrics?.totalPayouts || 0) + (metrics?.totalCharges || 0))}
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Payout per Player</span>
                <div className="text-right">
                  <div className="font-semibold text-[#70FF5A]">
                    {metrics?.totalPlayers ? formatUSD((metrics?.totalPayouts || 0) / metrics.totalPlayers) : '$0.00'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {metrics?.totalPlayers ? formatETH((metrics?.totalPayouts || 0) / metrics.totalPlayers) : '0 ETH'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <a
                href="/admin/grant-distribution"
                className="block w-full px-4 py-2 bg-[#70FF5A] text-black text-center rounded-md hover:bg-[#5FE04A] transition-colors"
              >
                Manage Grant Distribution
              </a>
              <a
                href="/admin/weekly-payouts"
                className="block w-full px-4 py-2 bg-purple-500 text-white text-center rounded-md hover:bg-purple-600 transition-colors"
              >
                Weekly Payouts
              </a>
              <a
                href="/admin/notify"
                className="block w-full px-4 py-2 bg-blue-500 text-white text-center rounded-md hover:bg-blue-600 transition-colors"
              >
                Send Notifications
              </a>
              <button
                onClick={loadMetrics}
                className="block w-full px-4 py-2 bg-gray-500 text-white text-center rounded-md hover:bg-gray-600 transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>


        {/* Top Players Table */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 3 Players (All Time)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wins</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Draws</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Losses</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics?.topPlayers?.map((player) => (
                  <tr key={player.address}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : player.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {player.alias ? `@${player.alias}` : formatAddress(player.address)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[#70FF5A]">
                      {formatLargeNumber(player.points)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{player.wins}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{player.draws}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{player.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {metrics?.recentActivity?.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'payout' ? 'bg-green-500' : 
                    activity.type === 'charge' ? 'bg-red-500' : 'bg-blue-500'
                  }`}></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">{formatAddress(activity.address)}</p>
                  </div>
                </div>
                <div className="text-right">
                  {activity.amount && (
                    <p className="text-sm font-semibold text-gray-900">{formatETH(activity.amount)}</p>
                  )}
                  <p className="text-xs text-gray-500">{getTimeAgo(activity.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
