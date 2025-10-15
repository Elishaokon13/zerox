/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

interface WeeklyGrant {
  week_start: string;
  rank: number;
  address: string;
  alias?: string;
  weekly_points: number;
  percentage: number;
  amount_usdc: number;
  tx_hash?: string;
  tx_status: string;
  distributed_at?: string;
}

interface WeeklyGrantsData {
  weekStart: string;
  eligiblePlayers: number;
  totalPoints: number;
  totalUsdc: number;
  distribution: Array<{
    address: string;
    alias?: string;
    weekly_points: number;
    rank: number;
    percentage: number;
    amount_usdc: number;
    lifetimeEarnedUsdc?: number;
    isCapped?: boolean;
  }>;
  budget: number;
  remaining: number;
}

interface SystemStatus {
  systemReady: boolean;
  paused: boolean;
  balance: {
    balanceUsdc: string;
    sufficient: boolean;
  } | null;
  pendingGrants: number;
}

export default function WeeklyGrantsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [farcasterUsername, setFarcasterUsername] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentWeek, setCurrentWeek] = useState('');
  const [grantsData, setGrantsData] = useState<WeeklyGrantsData | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [processing, setProcessing] = useState(false);
  const { address } = useAccount();

  const getCurrentWeekStart = () => {
    const d = new Date();
    const day = d.getUTCDay();
    const daysSinceMonday = (day + 6) % 7;
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - daysSinceMonday);
    return start.toISOString().slice(0, 10);
  };

  const getLastWeekStart = () => {
    const d = new Date();
    const day = d.getUTCDay();
    const daysSinceMonday = (day + 6) % 7;
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - daysSinceMonday - 7);
    return start.toISOString().slice(0, 10);
  };

  const loadGrantsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/weeklyGrants?week=${currentWeek}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch grants data');
      }
      
      setGrantsData(data);
    } catch (err) {
      console.error('Failed to load grants data:', err);
      setError('Failed to load weekly grants data');
    } finally {
      setLoading(false);
    }
  }, [currentWeek]);

  const loadSystemStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cron/weeklyGrants');
      const data = await res.json();
      
      if (res.ok) {
        setSystemStatus(data);
      }
    } catch (err) {
      console.error('Failed to load system status:', err);
    }
  }, []);

  const handleProcessGrants = async (dryRun = false) => {
    setProcessing(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch('/api/weeklyGrants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: currentWeek, dryRun })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process grants');
      }
      
      if (dryRun) {
        setSuccess(`Dry run completed: ${data.eligiblePlayers} eligible players, $${data.totalUsdc} total USDC`);
      } else {
        setSuccess(`Successfully processed ${data.eligiblePlayers} grants for week ${currentWeek}`);
        await loadGrantsData();
      }
    } catch (err) {
      console.error('Failed to process grants:', err);
      setError(err instanceof Error ? err.message : 'Failed to process grants');
    } finally {
      setProcessing(false);
    }
  };

  const handleAuthenticate = async () => {
    if (!farcasterUsername.trim() || !address) {
      alert('Please enter your Farcaster username and ensure wallet is connected');
      return;
    }

    if (farcasterUsername.trim().toLowerCase() === 'defidevrel') {
      setIsAuthenticated(true);
      setCurrentWeek(getCurrentWeekStart());
      loadGrantsData();
      loadSystemStatus();
    } else {
      alert('Access denied. Only defidevrel can access this admin panel.');
      setFarcasterUsername('');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadGrantsData();
      loadSystemStatus();
    }
  }, [isAuthenticated, currentWeek, loadGrantsData, loadSystemStatus]);

  // Show authentication form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#70FF5A] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎁</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Weekly Grants Admin</h1>
            <p className="text-gray-600">Manage USDC distributions to top players</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Farcaster Username
              </label>
              <input
                type="text"
                value={farcasterUsername}
                onChange={(e) => setFarcasterUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#70FF5A] focus:border-transparent text-black"
              />
            </div>
            
            <button
              onClick={handleAuthenticate}
              disabled={!farcasterUsername.trim() || !address}
              className="w-full bg-[#70FF5A] text-black py-3 px-4 rounded-lg font-medium hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!address ? 'Connect Wallet First' : 'Access Admin Panel'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Weekly Grants</h1>
              <p className="text-gray-600">Manage USDC distributions to top players</p>
            </div>
            
            {/* System Status */}
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${systemStatus?.systemReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium text-gray-700">
                {systemStatus?.systemReady ? 'System Ready' : 'System Not Ready'}
              </span>
              {systemStatus?.balance && (
                <span className="text-sm text-gray-600">
                  {systemStatus.balance.balanceUsdc} USDC
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Week Selection */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Week</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentWeek(getLastWeekStart())}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Last Week
              </button>
              <button
                onClick={() => setCurrentWeek(getCurrentWeekStart())}
                disabled={loading}
                className="px-4 py-2 bg-[#70FF5A] text-black rounded-md hover:bg-green-400 transition-colors disabled:opacity-50"
              >
                This Week
              </button>
            </div>
            <input
              type="date"
              value={currentWeek}
              onChange={(e) => setCurrentWeek(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#70FF5A] focus:border-transparent"
            />
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-red-500 mr-2">❌</span>
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-green-500 mr-2">✅</span>
              <span className="text-green-700">{success}</span>
            </div>
          </div>
        )}

        {/* Grants Data */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#70FF5A] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading grants data...</p>
          </div>
        ) : grantsData ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-2xl font-bold text-gray-900">{grantsData.eligiblePlayers}</div>
                <div className="text-sm text-gray-600">Eligible Players</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-2xl font-bold text-gray-900">${grantsData.totalUsdc}</div>
                <div className="text-sm text-gray-600">To Distribute</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-2xl font-bold text-gray-900">{grantsData.totalPoints}</div>
                <div className="text-sm text-gray-600">Total Points</div>
              </div>
            </div>

            {/* Distribution List */}
            {grantsData.distribution.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribution</h3>
                <div className="space-y-3">
                  {grantsData.distribution.map((player, index) => (
                    <div key={player.address} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#70FF5A] rounded-full flex items-center justify-center text-black font-bold text-sm">
                          {player.rank}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {player.alias || `${player.address.slice(0, 6)}...${player.address.slice(-4)}`}
                            </span>
                            {player.isCapped && (
                              <span className="text-yellow-500 text-lg" title="Capped at $100 lifetime earnings">👑</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {player.weekly_points} points
                            {player.lifetimeEarnedUsdc && player.lifetimeEarnedUsdc > 0 && (
                              <span className="ml-2 text-blue-600">
                                (${player.lifetimeEarnedUsdc.toFixed(2)} lifetime)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {player.isCapped ? 'CAPPED' : `$${player.amount_usdc}`}
                        </div>
                        <div className="text-sm text-gray-600">
                          {player.isCapped ? '$100.00' : `${player.percentage}%`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Eligible Players</h3>
                <p className="text-gray-600">No players have 100+ points for this week</p>
              </div>
            )}

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => handleProcessGrants(true)}
                  disabled={processing || grantsData.eligiblePlayers === 0}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-md font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Dry Run'}
                </button>
                <button
                  onClick={() => handleProcessGrants(false)}
                  disabled={processing || grantsData.eligiblePlayers === 0}
                  className="flex-1 bg-[#70FF5A] text-black py-3 px-6 rounded-md font-medium hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Process Grants'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-6xl mb-4">🎁</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">Select a week to view grants data</p>
          </div>
        )}
      </div>
    </div>
  );
}