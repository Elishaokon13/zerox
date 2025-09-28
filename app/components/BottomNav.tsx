'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMiniKit } from '@coinbase/onchainkit/minikit';

export function BottomNav() {
  const pathname = usePathname();
  const { context } = useMiniKit();
  const bottomInset = context?.client?.safeAreaInsets?.bottom ?? 0;
  // PARTY MODE - COMMENTED OUT FOR NOW
  // TODO: Re-enable when party mode is properly implemented
  const currentTab: 'daily' | 'play' | 'leaderboard' = pathname?.startsWith('/daily')
    ? 'daily'
    : pathname?.startsWith('/leaderboard')
      ? 'leaderboard'
      : 'play';

  return (
    <div className="fixed left-0 right-0 bottom-0 z-40 bg-black border-t border-[#e5e7eb]" style={{ paddingBottom: bottomInset }}>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-stretch justify-around">
          <Link href="/daily" className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-t-lg ${currentTab === 'daily' ? 'text-[#066c00] bg-[#b6f569]/30' : 'text-[#70FF5A]/70'}`}>
            <div className="flex flex-col items-center gap-0.5 relative">
              {currentTab === 'daily' && <span className="absolute -top-2 h-1 w-8 rounded-full bg-[#70FF5A]" />}
              <span aria-hidden>🗓️</span>
              <span>Daily</span>
            </div>
          </Link>

          <Link href="/play" className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-t-lg ${currentTab === 'play' ? 'text-[#066c00] bg-[#b6f569]/30' : 'text-[#70FF5A]/70'}`}>
            <div className="flex flex-col items-center gap-0.5 relative">
              {currentTab === 'play' && <span className="absolute -top-2 h-1 w-8 rounded-full bg-[#70FF5A]" />}
              <span aria-hidden>🎮</span>
              <span>Play</span>
            </div>
          </Link>

          <Link href="/party" className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-t-lg ${currentTab === 'party' ? 'text-[#066c00] bg-[#b6f569]/30' : 'text-[#70FF5A]/70'}`}>
            <div className="flex flex-col items-center gap-0.5 relative">
              {currentTab === 'party' && <span className="absolute -top-2 h-1 w-8 rounded-full bg-[#70FF5A]" />}
              <span aria-hidden>👥</span>
              <span>Party</span>
            </div>
          </Link>

          <Link href="/leaderboard" className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-t-lg ${currentTab === 'leaderboard' ? 'text-[#066c00] bg-[#b6f569]/30' : 'text-[#70FF5A]/70'}`}>
            <div className="flex flex-col items-center gap-0.5 relative">
              {currentTab === 'leaderboard' && <span className="absolute -top-2 h-1 w-8 rounded-full bg-[#70FF5A]" />}
              <span aria-hidden>🏆</span>
              <span>Leaderboard</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default BottomNav;


