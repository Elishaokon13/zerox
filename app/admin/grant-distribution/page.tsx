'use client';
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface GrantDistribution {
  currentWeek: string;
  totalGrantAmount: number;
  weeklyBudget: number;
  weeksRemaining: number;
  distribution: Array<{
    rank: number;
    address: string;
    alias?: string;
    points: number;
    percentage: number;
    weeklyAmount: number;
    totalAmount: number;
  }>;
  totalDistributed: number;
  remainingGrant: number;
}

interface GrantHistory {
  week_start: string;
  recipient_address: string;
  recipient_alias?: string;
  points: number;
  percentage: number;
  amount_usd: number;
  amount_eth: number;
  tx_hash?: string;
  tx_status: string;
  distributed_at: string;
}

interface GrantHistoryResponse {
  history: GrantHistory[];
  summary: {
    totalDistributed: number;
    totalRecords: number;
    completedRecords: number;
    remainingGrant: number;
  };
}

export default function GrantDistributionPage() {
  const [grantData, setGrantData] = useState<GrantDistribution | null>(null);
  const [grantHistory, setGrantHistory] = useState<GrantHistory[]>([]);
  const [grantSummary, setGrantSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [farcasterUsername, setFarcasterUsername] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const { address } = useAccount();

  // Authentication check
  useEffect(() => {
    const checkAuth = () => {
      if (farcasterUsername !== 'defidevrel') {
        alert('Access denied. Only defidevrel can access this admin panel.');
        setFarcasterUsername('');
      }
    };
    checkAuth();
  }, [farcasterUsername]);

  // Fetch ETH price
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        setEthPrice(data.ethereum.usd);
      } catch (error) {
        console.error('Failed to fetch ETH price:', error);
        setEthPrice(3000); // Fallback price
      }
    };
    fetchEthPrice();
  }, []);

  const loadGrantData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [grantRes, historyRes, statusRes] = await Promise.all([
        fetch('/api/admin/grant-distribution'),
        fetch('/api/admin/grant-history'),
        fetch('/api/admin/process-grants')
      ]);

      const [grantData, historyData, statusData] = await Promise.all([
        grantRes.json(),
        historyRes.json(),
        statusRes.json()
      ]);

      if (!grantRes.ok) {
        throw new Error(grantData.error || 'Failed to fetch grant data');
      }

      setGrantData(grantData);
      
      // Handle new history response structure
      if (historyRes.ok && historyData) {
        setGrantHistory(historyData.history || []);
        setGrantSummary(historyData.summary || null);
      } else {
        setGrantHistory([]);
        setGrantSummary(null);
      }
      
      setSystemStatus(statusRes.ok ? statusData : null);
    } catch (err) {
      console.error('Failed to load grant data:', err);
      setError('Failed to load grant distribution data');
    } finally {
      setLoading(false);
    }
  };

  const recordWeeklyDistribution = async () => {
    if (!grantData) return;

    try {
      const response = await fetch('/api/admin/grant-distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week: grantData.currentWeek,
          distributions: grantData.distribution.map(dist => ({
            ...dist,
            amountEth: dist.weeklyAmount / ethPrice
          }))
        })
      });

      if (response.ok) {
        alert('Weekly grant distribution recorded successfully!');
        loadGrantData();
      } else {
        const errorData = await response.json();
        alert(`Failed to record distribution: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error recording grant distribution:', error);
      alert('Error recording grant distribution');
    }
  };

  const processGrantPayments = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/admin/process-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Grant payments processed successfully! ${result.message}`);
        loadGrantData();
      } else {
        alert(`Failed to process payments: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error processing grant payments:', error);
      alert('Error processing grant payments');
    } finally {
      setProcessing(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
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

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  useEffect(() => {
    loadGrantData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#70FF5A] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading grant distribution data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="text-red-600 text-lg mb-4">❌ {error}</div>
            <button
              onClick={loadGrantData}
              className="px-4 py-2 bg-[#70FF5A] text-black rounded-md hover:bg-[#5FE04A] transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🎁 Grant Distribution Management</h1>
          <p className="text-gray-600">Manage weekly grant distributions to top 3 players</p>
        </div>

        {/* System Status */}
        {systemStatus && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${systemStatus.systemReady ? 'text-green-600' : 'text-red-600'}`}>
                  {systemStatus.systemReady ? '✅' : '❌'}
                </div>
                <div className="text-sm text-gray-600">System Ready</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {systemStatus.balance ? `${systemStatus.balance.balanceEth} ETH` : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Wallet Balance</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {systemStatus.pendingDistributions || 0}
                </div>
                <div className="text-sm text-gray-600">Pending Payments</div>
              </div>
            </div>
            
            {systemStatus.pendingDistributions > 0 && (
              <div className="mt-4 text-center">
                <button
                  onClick={processGrantPayments}
                  disabled={!systemStatus.systemReady || processing}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {processing ? 'Processing...' : `Process ${systemStatus.pendingDistributions} Pending Payments`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Current Week Distribution */}
        {grantData && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-md p-6 mb-8 border border-purple-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Week of {new Date(grantData.currentWeek).toLocaleDateString()}
              </h2>
              <div className="flex items-center space-x-4">
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  {grantData.weeksRemaining} weeks remaining
                </span>
                <button
                  onClick={recordWeeklyDistribution}
                  disabled={grantData.distribution.length === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Record This Week's Distribution
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">${grantData.totalGrantAmount}</div>
                <div className="text-sm text-gray-600">Total Grant</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">${grantData.weeklyBudget}</div>
                <div className="text-sm text-gray-600">Weekly Budget</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ${grantSummary ? grantSummary.totalDistributed.toFixed(2) : grantData.totalDistributed}
                </div>
                <div className="text-sm text-gray-600">Distributed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  ${grantSummary ? grantSummary.remainingGrant.toFixed(2) : grantData.remainingGrant}
                </div>
                <div className="text-sm text-gray-600">Remaining</div>
              </div>
            </div>

            {/* Current Week's Top 3 */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">This Week's Top 3 Players</h3>
              {grantData.distribution.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-lg mb-2">📊</div>
                  <div>No players found for this week yet</div>
                  <div className="text-sm mt-1">Players will appear here as they play games this week</div>
                </div>
              ) : (
                grantData.distribution.map((player) => (
                  <div key={player.address} className="flex items-center justify-between p-4 bg-white rounded-lg border border-purple-100">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg font-bold text-purple-600">
                        {player.rank}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {player.alias ? `@${player.alias}` : formatAddress(player.address)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatLargeNumber(player.points)} points ({player.percentage}%)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600 text-lg">${player.weeklyAmount}</div>
                      <div className="text-sm text-gray-500">
                        {formatETH(player.weeklyAmount / ethPrice)} • ${player.totalAmount} total
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Database Summary */}
        {grantSummary && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Database Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{grantSummary.totalRecords}</div>
                <div className="text-sm text-gray-600">Total Records</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{grantSummary.completedRecords}</div>
                <div className="text-sm text-gray-600">Completed Payments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">${grantSummary.totalDistributed.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Actually Distributed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">${grantSummary.remainingGrant.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Actually Remaining</div>
              </div>
            </div>
          </div>
        )}

        {/* Grant History */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribution History</h3>
          {grantHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">📋</div>
              <div>No distributions recorded yet</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Week</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {grantHistory.map((record, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.week_start).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.recipient_alias ? `@${record.recipient_alias}` : formatAddress(record.recipient_address)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatLargeNumber(record.points)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="font-semibold text-green-600">${record.amount_usd}</div>
                        <div className="text-xs text-gray-500">{formatETH(record.amount_eth)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          record.tx_status === 'completed' ? 'bg-green-100 text-green-800' :
                          record.tx_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.tx_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.tx_hash ? (
                          <a 
                            href={`https://basescan.org/tx/${record.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {record.tx_hash.slice(0, 8)}...
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getTimeAgo(record.distributed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
