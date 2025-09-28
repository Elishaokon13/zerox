// PARTY ROUTE - COMMENTED OUT FOR NOW
// TODO: Re-enable when party mode is properly implemented

/*
'use client';

import { useAccount } from 'wagmi';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import PartyMode from '../components/game/PartyMode';
import { WalletCheck } from '../components/WalletCheck';
import BottomNav from '../components/BottomNav';

export default function PartyPage() {
  const { address } = useAccount();
  const { context } = useMiniKit();

  // Get player info from context
  const playerName = context?.user && typeof context.user.username === 'string' ? context.user.username : undefined;
  let playerPfp: string | undefined;
  const u = context?.user as unknown as { pfpUrl?: unknown; pfp?: unknown; profile?: { pfp?: unknown; picture?: unknown } } | undefined;
  const maybePfp = u?.pfpUrl ?? u?.pfp ?? u?.profile?.pfp ?? u?.profile?.picture;
  if (typeof maybePfp === 'string') playerPfp = maybePfp;
  else if (maybePfp && typeof maybePfp === 'object') {
    const cand = (['url','src','original','default','small','medium','large'] as const)
      .map((k) => (maybePfp as Record<string, unknown>)[k])
      .find((v) => typeof v === 'string');
    if (typeof cand === 'string') playerPfp = cand;
  }

  // Account for bottom nav height + safe area
  const bottomInset = (context?.client?.safeAreaInsets?.bottom ?? 0);
  const bottomNavHeight = 64 + bottomInset;

  return (
    <>
      <main className="min-h-screen p-4 flex flex-col items-center" style={{ paddingBottom: bottomNavHeight }}>
        <WalletCheck>
          <PartyMode
            playerAddress={address || ''}
            playerName={playerName}
            playerPfp={playerPfp}
          />
        </WalletCheck>
      </main>
      <BottomNav />
    </>
  );
}
*/

// Temporary placeholder component
export default function PartyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-700 mb-4">Party Mode</h1>
        <p className="text-gray-500">Coming soon! This feature is under development.</p>
      </div>
    </div>
  );
}
