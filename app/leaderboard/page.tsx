'use client';
import React, { useEffect } from 'react';
import Image from 'next/image';
import BottomNav from '../components/BottomNav';
import { useViewProfile } from '@coinbase/onchainkit/minikit';
import { useScoreboard } from '@/lib/useScoreboard';
import { useAccount } from 'wagmi';

export default function LeaderboardPage() {
  return (
    <>
      <div className="min-h-screen pt-10 pb-24">
        <LeaderboardTab />
      </div>
      <BottomNav />
    </>
  );
}

type TopRow = { rank: number; address: string; alias?: string; pfpUrl?: string; wins: number; draws: number; losses: number; points: number; fid?: number };
type TabType = 'weekly' | 'alltime' | 'onchain';

function LeaderboardTab() {
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [season, setSeason] = React.useState<{ start: string; end: string } | null>(null);
  const [rows, setRows] = React.useState<Array<TopRow>>([]);
  const [countdown, setCountdown] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<TabType>('weekly');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const viewProfile = useViewProfile();
  const { address } = useAccount();
  const { score: onchainScore, isRecording } = useScoreboard();
  // No longer need ETH price for points-based system

  useEffect(() => {
    const load = async () => {
      console.log('Loading leaderboard for tab:', activeTab);
      setLoading(true);
      setCurrentPage(1);
      setHasMore(true);
      try {
        const endpoint = activeTab === 'weekly' ? '/api/leaderboard' : '/api/leaderboard/alltime';
        console.log('Fetching from:', endpoint);
        const res = await fetch(`${endpoint}?page=1&limit=20`);
        console.log('Response status:', res.status);
        const data = await res.json();
        console.log('Response data:', data);
        setSeason(activeTab === 'weekly' ? (data?.season ?? null) : null);
        const rowsFromApi = (Array.isArray(data?.top) ? data.top : []) as Array<TopRow>;
        console.log('Rows from API:', rowsFromApi.length, rowsFromApi);
        setRows(rowsFromApi);
        setHasMore(data?.pagination?.hasMore ?? false);
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeTab]);

  const loadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const endpoint = activeTab === 'weekly' ? '/api/leaderboard' : '/api/leaderboard/alltime';
      const res = await fetch(`${endpoint}?page=${nextPage}&limit=20`);
      const data = await res.json();
      const newRows = (Array.isArray(data?.top) ? data.top : []) as Array<TopRow>;
      setRows(prev => [...prev, ...newRows]);
      setCurrentPage(nextPage);
      setHasMore(data?.pagination?.hasMore ?? false);
    } catch {
      setError('Failed to load more entries');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, currentPage, activeTab]);

  useEffect(() => {
    if (!season?.end) return;
    const end = new Date(`${season.end}T00:00:00.000Z`).getTime();
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, end - now);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${d}d ${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [season]);

  // Infinite scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 1000) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <h1 className="text-4xl font-black text-center mb-8 text-black tracking-wider">LEADERBOARD</h1>
      
      {/* Debug info */}
      <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
        <div>Loading: {loading ? 'true' : 'false'}</div>
        <div>Error: {error || 'none'}</div>
        <div>Rows: {rows.length}</div>
        <div>Active Tab: {activeTab}</div>
      </div>
      
      <div className="flex justify-center gap-8 mb-6">
        <button 
          className={`text-lg font-bold pb-1 border-b-2 transition-colors ${
            activeTab === 'weekly' 
              ? 'text-black border-black' 
              : 'text-[#9CA3AF] border-transparent'
          }`}
          onClick={() => setActiveTab('weekly')}
        >
          WEEKLY
        </button>
        <button 
          className={`text-lg font-bold pb-1 border-b-2 transition-colors ${
            activeTab === 'alltime' 
              ? 'text-black border-black' 
              : 'text-[#9CA3AF] border-transparent'
          }`}
          onClick={() => setActiveTab('alltime')}
        >
          ALL TIME
        </button>
        {/* <button 
          className={`text-lg font-bold pb-1 border-b-2 transition-colors ${
            activeTab === 'onchain' 
              ? 'text-black border-black' 
              : 'text-[#9CA3AF] border-transparent'
          }`}
          onClick={() => setActiveTab('onchain')}
        >
          ONCHAIN
        </button> */}
      </div>

      {activeTab === 'onchain' ? (
       
        <div className="space-y-3">
          {isRecording ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#70FF5A]"></div>
              <div className="text-sm text-[#9CA3AF] mt-4">Recording game result...</div>
            </div>
          ) : onchainScore ? (
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-[#F3F4F6]">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 flex items-center justify-center text-[#70FF5A] font-medium">
                  🏆
                </div>
                <div>
                  <div className="font-medium text-lg text-black">Your Onchain Stats</div>
                  <div className="text-sm text-[#70FF5A] font-semibold">
                    {onchainScore.wins + onchainScore.losses + onchainScore.draws} games
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-black">
                  {onchainScore.wins}W {onchainScore.draws}D {onchainScore.losses}L
                </div>
                <div className="text-sm text-[#9CA3AF]">
                  Onchain
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-sm text-[#9CA3AF] mb-2">
                {address ? 'No onchain games recorded yet' : 'Connect your wallet to view onchain scores'}
              </div>
              {address && (
                <div className="text-xs text-[#9CA3AF] mb-4">
                  Play games to record your results onchain
                </div>
              )}
              {address && (
                <div className="text-xs text-[#9CA3AF]">
                  Contract: 0x6303d8208FA29C20607BDD7DA3e5dD8f68E5146C
                </div>
              )}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="space-y-4">
          <div className="text-center text-sm text-gray-500">Loading leaderboard...</div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-[#F3F4F6] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-black text-center">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-[#9CA3AF] text-center">No entries yet.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const fallback = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(r.alias || r.address)}`;
            const src = r.pfpUrl && typeof r.pfpUrl === 'string' ? r.pfpUrl : fallback;
            
            // Trophy colors for top 3
            const trophyEmoji = r.rank === 1 ? '🥇' : 
                              r.rank === 2 ? '🥈' :
                              r.rank === 3 ? '🥉' : null;
            
            // Calculate points (no longer showing earnings)
            const totalGames = r.wins + r.draws + r.losses;
            
            const handleProfileClick = () => {
              if (r.alias) {
                try {
                  // Use FID if available, otherwise fall back to external link
                  if (r.fid) {
                    viewProfile(r.fid);
                  } else {
                    // Fallback to warpcast.com for alias
                    window.open(`https://warpcast.com/${r.alias}`, '_blank');
                  }
                } catch (error) {
                  console.error('Failed to open profile in app:', error);
                  // Fallback to warpcast.com
                  window.open(`https://warpcast.com/${r.alias}`, '_blank');
                }
              }
            };

            return (
              <div key={r.rank} 
                className="flex items-center justify-between p-4 bg-white rounded-2xl border border-[#F3F4F6] hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  {trophyEmoji ? (
                    <div className="w-8 h-8 flex items-center justify-center text-xl">
                      {trophyEmoji}
                    </div>
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center text-[#9CA3AF] font-medium">
                      {r.rank}
                    </div>
                  )}
                  <div 
                    className="cursor-pointer hover:scale-105 transition-transform"
                    onClick={handleProfileClick}
                    title={r.alias ? `View @${r.alias}'s profile` : 'View profile'}
                  >
                    <Image 
                      src={src} 
                      alt={r.alias || 'pfp'} 
                      width={40} 
                      height={40} 
                      className="rounded-md w-10 h-10 object-cover border-2 border-transparent hover:border-[#70FF5A] transition-colors"
                    />
                  </div>
                  <div>
                    <div className="font-medium text-lg text-black">
                      {r.alias ? `@${r.alias}` : `${r.address.slice(0,6)}…${r.address.slice(-4)}`}
                    </div>
                    <div className="text-sm text-[#70FF5A] font-semibold">
                      {totalGames} games
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-black">
                    {r.points} pts
                  </div>
                  {/* <div className="text-sm text-[#9CA3AF]">
                    {r.wins}W {r.draws}D {r.losses}L
                  </div> */}
                </div>
              </div>
            );
          })}
          
          {/* Load More Button */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-3 rounded-lg bg-[#70FF5A] text-black font-semibold hover:bg-[#60E54A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
          
          {/* Loading More Indicator */}
          {loadingMore && (
            <div className="mt-4 text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#70FF5A]"></div>
              <div className="text-sm text-[#9CA3AF] mt-2">Loading more entries...</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'weekly' && season && (
        <div className="mt-6 text-center text-sm text-[#9CA3AF]">
          Season ends in <span className="font-bold text-black">{countdown}</span>
        </div>
      )}
    </div>
  );
}