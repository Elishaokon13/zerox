import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

type Progress = {
  xp: number;
  level: number;
  streak: number; // daily play streak
  lastPlayed: string | null; // YYYY-MM-DD
  winStreak: number; // consecutive wins
  achievements: string[];
};

function today(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function calcLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

async function readProgress(address: string): Promise<Progress> {
  if (!redis) {
    // Fallback: return basic progress without persistence
    return { xp: 0, level: 1, streak: 0, lastPlayed: null, winStreak: 0, achievements: [] };
  }
  const key = `progress:${address.toLowerCase()}`;
  const data = await redis.get<Progress>(key);
  if (!data) return { xp: 0, level: 1, streak: 0, lastPlayed: null, winStreak: 0, achievements: [] };
  return data;
}

async function writeProgress(address: string, data: Progress): Promise<void> {
  if (!redis) return;
  const key = `progress:${address.toLowerCase()}`;
  await redis.set(key, data);
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });
  const progress = await readProgress(address);
  return NextResponse.json(progress);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address: string | undefined = body?.address;
    const result: 'win' | 'loss' | 'draw' | undefined = body?.result;
    const xpBonus: number = Number(body?.xpBonus || 0);
    if (!address || !result) return NextResponse.json({ error: 'address and result required' }, { status: 400 });

    const p = await readProgress(address);
    const todayStr = today();

    // Daily streak: increment when playing on a new day following the previous
    if (p.lastPlayed !== todayStr) {
      if (p.lastPlayed) {
        const prev = new Date(p.lastPlayed);
        const t = new Date(todayStr);
        const diff = Math.round((t.getTime() - prev.getTime()) / 86400000);
        p.streak = diff === 1 ? p.streak + 1 : 1;
      } else {
        p.streak = 1;
      }
      p.lastPlayed = todayStr;
    }

    // XP awards
    if (result === 'win') p.xp += 10; else if (result === 'draw') p.xp += 3; else p.xp += 1;
    if (Number.isFinite(xpBonus) && xpBonus > 0) p.xp += xpBonus;
    p.level = calcLevel(p.xp);

    // Win streak and achievements
    if (result === 'win') {
      p.winStreak += 1;
      if (!p.achievements.includes('first_win')) p.achievements.push('first_win');
      if (p.winStreak >= 3 && !p.achievements.includes('three_in_a_row')) p.achievements.push('three_in_a_row');
    } else {
      p.winStreak = 0;
    }

    await writeProgress(address, p);
    return NextResponse.json(p);
  } catch {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}


