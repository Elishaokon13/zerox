/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { useMiniKit, useIsInMiniApp } from '@coinbase/onchainkit/minikit';
import { useAccount, useConnect } from 'wagmi';

export function Navbar() {
  const [fcUser, setFcUser] = useState<{
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  } | null>(null);

  // Keep wallet connection in background
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  
  useEffect(() => {
    // Auto-connect wallet if not connected
    if (!isConnected && connectors[0]) {
      connect({ connector: connectors[0] });
    }
  }, [isConnected, connect, connectors]);

  const { context, isFrameReady, setFrameReady } = useMiniKit();
  const { isInMiniApp } = useIsInMiniApp();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [isFrameReady, setFrameReady]);

  useEffect(() => {
    if (!isInMiniApp || !context?.user) return;

    const user: any = context.user as any;
    const pickUrl = (val: unknown): string | undefined => {
      if (typeof val === 'string') return val;
      if (val && typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        const keys = ['url', 'src', 'srcUrl', 'original', 'default', 'small', 'medium', 'large'];
        for (const k of keys) {
          const v = obj[k];
          if (typeof v === 'string') return v;
        }
      }
      return undefined;
    };

    const maybePfp = user.pfpUrl ?? user.pfp ?? user.profile?.pfp ?? user.profile?.picture;
    const pfpUrl = pickUrl(maybePfp);
    const username = user.username ?? user.profile?.username;
    const displayName = user.displayName ?? user.profile?.displayName ?? user.profile?.name;

    setFcUser({
      fid: user.fid,
      username,
      displayName,
      pfpUrl,
    });
  }, [isInMiniApp, context]);

  return (
    <nav className="sticky top-0 z-40 w-full bg-[#000000]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          {/* Left: Logo & Title */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="ZeroX" width={24} height={24} className="rounded" />
            <span className="text-base font-medium text-white">ZeroX</span>
          </Link>

          {/* Right: Profile */}
          {fcUser && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">
                {fcUser.username ? `@${fcUser.username}` : fcUser.displayName}
              </span>
              {typeof fcUser.pfpUrl === 'string' && (
                <Image
                  src={fcUser.pfpUrl}
                  alt={fcUser.username || 'profile'}
                  width={40}
                  height={40}
                  className="rounded-md w-10 h-10 object-cover"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}