import React, { useEffect, useState } from 'react';
import { Gift, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react';

interface DailySpinStatus {
  claimed: boolean;
  rewardPoints: number | null;
  balancePoints: number;
  nextSpinAt: string;
}

interface DailySpinPageProps {
  signedIn: boolean;
  onSignIn: () => void;
}

const rewards = [
  { points: 1, chance: '50%' },
  { points: 2, chance: '30%' },
  { points: 5, chance: '15%' },
  { points: 10, chance: '4%' },
  { points: 25, chance: '1%' },
];

export const DailySpinPage: React.FC<DailySpinPageProps> = ({ signedIn, onSignIn }) => {
  const [status, setStatus] = useState<DailySpinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadStatus = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/rewards/daily-spin', { credentials: 'include', cache: 'no-store', signal });
      const data = await response.json() as DailySpinStatus & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not load your daily spin.');
      setStatus(data);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : 'Could not load your daily spin.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      setStatus(null);
      return;
    }
    const controller = new AbortController();
    void loadStatus(controller.signal);
    return () => controller.abort();
  }, [signedIn]);

  const spin = async () => {
    setSpinning(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/rewards/daily-spin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json() as DailySpinStatus & { error?: string; alreadyClaimed?: boolean };
      if (!response.ok) throw new Error(data.error || 'Could not complete your spin.');
      setStatus(data);
      setMessage(data.alreadyClaimed
        ? `Today's spin was already claimed${data.rewardPoints ? `: ${data.rewardPoints} points` : ''}.`
        : `You won ${data.rewardPoints} points!`);
    } catch (spinError) {
      setError(spinError instanceof Error ? spinError.message : 'Could not complete your spin.');
    } finally {
      setSpinning(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8" aria-labelledby="daily-spin-title">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top_right,_rgba(34,211,238,0.12),_transparent_48%),#0e121a]">
        <div className="p-6 sm:p-9">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-amber-100">
              <Gift className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">A little bonus, once a day</p>
              <h1 id="daily-spin-title" className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Daily spin</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">Try your luck for points. One spin per UTC calendar day; points are credited to your wallet immediately.</p>
            </div>
          </div>

          {!signedIn ? (
            <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
              <LockKeyhole className="mx-auto h-6 w-6 text-zinc-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-white">Sign in to claim your daily spin</p>
              <button type="button" onClick={onSignIn} className="mt-4 min-h-11 rounded-xl bg-cyan-300 px-5 text-sm font-bold text-[#071016] hover:bg-cyan-200">Sign in</button>
            </div>
          ) : (
            <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-cyan-200/15 bg-[#070b12]/70 p-6 text-center">
                <span className={`flex h-20 w-20 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10 text-cyan-100 ${spinning ? 'animate-spin' : ''}`}>
                  {spinning ? <LoaderCircle className="h-9 w-9" aria-hidden="true" /> : <Sparkles className="h-9 w-9" aria-hidden="true" />}
                </span>
                {loading ? (
                  <p role="status" className="mt-4 text-sm text-zinc-300">Checking today’s spin…</p>
                ) : status?.claimed ? (
                  <>
                    <p className="mt-4 text-lg font-bold text-white">You’ve spun for today</p>
                    <p className="mt-1 text-sm text-zinc-300">Today’s reward: <strong className="text-amber-100">{status.rewardPoints ?? 0} points</strong></p>
                    <p className="mt-2 text-xs text-zinc-500">Come back after {new Date(status.nextSpinAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })}.</p>
                  </>
                ) : (
                  <>
                    <p className="mt-4 text-lg font-bold text-white">Ready when you are</p>
                    <p className="mt-1 text-sm text-zinc-400">Your wallet balance: {status?.balancePoints ?? 0} points</p>
                    <button type="button" onClick={() => void spin()} disabled={spinning || loading} className="mt-4 min-h-11 rounded-xl bg-cyan-300 px-6 text-sm font-black text-[#071016] transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">
                      {spinning ? 'Spinning…' : 'Spin for points'}
                    </button>
                  </>
                )}
                {message && <p role="status" className="mt-3 text-sm font-semibold text-emerald-200">{message}</p>}
                {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/15 p-5">
                <h2 className="text-sm font-bold text-white">Possible rewards</h2>
                <p className="mt-1 text-xs text-zinc-400">Published odds for every spin.</p>
                <ul className="mt-4 space-y-2">
                  {rewards.map(({ points, chance }) => (
                    <li key={points} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
                      <span className="text-sm font-bold text-amber-100">{points} {points === 1 ? 'point' : 'points'}</span>
                      <span className="text-xs text-zinc-300">{chance} chance</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">The server selects and records the result. A network retry cannot claim a second spin or change the saved result.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
