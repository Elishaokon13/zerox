'use client';
import React, { useEffect } from 'react';
import Image from 'next/image';
import BottomNav from '../components/BottomNav';
import { useViewProfile } from '@coinbase/onchainkit/minikit';

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
type TabType = 'weekly' | 'alltime';

function LeaderboardTab() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [season, setSeason] = React.useState<{ start: string; end: string } | null>(null);
  const [rows, setRows] = React.useState<Array<TopRow>>([]);
  const [countdown, setCountdown] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<TabType>('weekly');
  const viewProfile = useViewProfile();
  // No longer need ETH price for points-based system

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const endpoint = activeTab === 'weekly' ? '/api/leaderboard' : '/api/leaderboard/alltime';
        const res = await fetch(endpoint);
        const data = await res.json();
        setSeason(activeTab === 'weekly' ? (data?.season ?? null) : null);
        const rowsFromApi = (Array.isArray(data?.top) ? data.top : []) as Array<TopRow>;
        setRows(rowsFromApi);
      } catch {
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeTab]);

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

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <h1 className="text-4xl font-black text-center mb-8 text-black tracking-wider">LEADERBOARD</h1>
      
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
      </div>

      {loading ? (
        <div className="space-y-4">
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
                      className="rounded-full object-cover border-2 border-transparent hover:border-[#70FF5A] transition-colors"
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