import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, LoaderCircle, Users, WalletCards } from 'lucide-react';

interface ReferralSummary {
  referralCode: string;
  referralUrl: string;
  referredAccounts: number;
  pendingBonusCents: number;
  completedCashCents: number;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export const ReferralDashboard: React.FC = () => {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadReferralSummary = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/referrals/me', {
        cache: 'no-store',
        credentials: 'include',
        signal,
      });
      const data = await response.json() as ReferralSummary & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not load referral details.');
      if (
        typeof data.referralUrl !== 'string' ||
        typeof data.pendingBonusCents !== 'number' ||
        typeof data.completedCashCents !== 'number'
      ) {
        throw new Error('Referral details were returned in an unexpected format.');
      }
      setSummary(data);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : 'Could not load referral details.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadReferralSummary(controller.signal);
    return () => controller.abort();
  }, []);

  const copyReferralLink = async () => {
    if (!summary) return;
    setCopied(false);
    setError('');
    try {
      await navigator.clipboard.writeText(summary.referralUrl);
      setCopied(true);
    } catch {
      setError('Could not copy the link. Select and copy it manually.');
    }
  };

  return (
    <section aria-labelledby="referral-dashboard-title" className="mt-7 border-t border-white/10 pt-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <Users className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-cyan-300">Share and earn</p>
          <h3 id="referral-dashboard-title" className="mt-1 text-xl font-bold text-white">Your referral dashboard</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Share your personal link. Referral rewards remain pending until reviewed; eligible completed rewards appear as cash below.
          </p>
        </div>
      </div>

      {loading ? (
        <div role="status" className="mt-5 flex items-center gap-2 text-sm text-zinc-400">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading referral details…
        </div>
      ) : error && !summary ? (
        <div className="mt-5 rounded-xl border border-rose-300/20 bg-rose-400/5 p-4">
          <p role="alert" className="text-sm text-rose-200">{error}</p>
          <button
            type="button"
            onClick={() => void loadReferralSummary()}
            className="mt-3 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/5"
          >
            Try again
          </button>
        </div>
      ) : summary ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.09] to-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <WalletCards className="h-4 w-4 text-amber-200" aria-hidden="true" />
                Pending Earnings
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">{formatMoney(summary.pendingBonusCents)}</p>
              <p className="mt-1 text-[11px] text-zinc-400">Awaiting review and approval</p>
            </article>
            <article className="rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-300/[0.09] to-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100">
                <Check className="h-4 w-4 text-emerald-200" aria-hidden="true" />
                Completed Cash
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">{formatMoney(summary.completedCashCents)}</p>
              <p className="mt-1 text-[11px] text-zinc-400">Approved referral rewards</p>
            </article>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <label htmlFor="personal-referral-link" className="text-xs font-semibold text-zinc-300">Your custom referral link</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#090d18] px-3 py-2.5">
                <Link2 className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                <input
                  id="personal-referral-link"
                  readOnly
                  value={summary.referralUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 bg-transparent text-xs text-zinc-200 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => void copyReferralLink()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-[#06131a] transition-colors hover:bg-cyan-200"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
              <span>Referral code: <span className="font-mono text-zinc-300">{summary.referralCode}</span></span>
              <span>{summary.referredAccounts} referred {summary.referredAccounts === 1 ? 'account' : 'accounts'}</span>
            </div>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
          {copied && <p role="status" className="mt-2 text-xs text-emerald-300">Referral link copied to clipboard.</p>}
        </>
      ) : null}
    </section>
  );
};
