import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, LoaderCircle, Users, WalletCards } from 'lucide-react';

interface ReferralSummary {
  referralCode: string;
  referralUrl: string;
  referredAccounts: number;
  pendingBonusCents: number;
  completedCashCents: number;
  referralProgress: ReferralProgressEntry[];
}

interface ReferralProgressEntry {
  label: string;
  status: 'pending' | 'completed' | 'void';
  bonusCents: number;
  verifiedNetRevenueCents: number;
  trackedSiteClicks: number;
  createdAt: string;
  offers: {
    offerId: string;
    company: string;
    title: string;
    status: 'active' | 'completed' | 'issue';
    reportedCompletedAt: string | null;
  }[];
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export const ReferralDashboard: React.FC = () => {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savingCode, setSavingCode] = useState(false);
  const [codeMessage, setCodeMessage] = useState('');

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
        typeof data.completedCashCents !== 'number' ||
        !Array.isArray(data.referralProgress)
      ) {
        throw new Error('Referral details were returned in an unexpected format.');
      }
      setSummary(data);
      setCustomCode(data.referralCode);
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

  const saveCustomCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCode(true);
    setError('');
    setCodeMessage('');
    try {
      const response = await fetch('/api/referrals/me/code', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ referralCode: customCode }),
      });
      const data = await response.json() as { referralCode?: string; referralUrl?: string; previousLinksRemainValid?: boolean; error?: string };
      if (!response.ok || !data.referralCode || !data.referralUrl) {
        throw new Error(data.error || 'Could not customize your referral link.');
      }
      const updatedCode = data.referralCode;
      const updatedUrl = data.referralUrl;
      setSummary((current) => current
        ? { ...current, referralCode: updatedCode, referralUrl: updatedUrl }
        : current);
      setCustomCode(updatedCode);
      setCopied(false);
      setCodeMessage(data.previousLinksRemainValid
        ? 'Your new link is ready. Links you shared before will keep working.'
        : 'Your referral link was updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not customize your referral link.');
    } finally {
      setSavingCode(false);
    }
  };

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
            Share your personal link. A $5 reward remains conditional until the referred signup uses offers opened from this site and generates at least $10 in net commission we actually receive and verify. Member-reported completion alone does not qualify.
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
                Conditional Rewards
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">{formatMoney(summary.pendingBonusCents)}</p>
              <p className="mt-1 text-[11px] text-zinc-400">Not payable until the $10 verified net commission threshold is met</p>
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

          <section className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4" aria-labelledby="referral-progress-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 id="referral-progress-title" className="text-sm font-bold text-white">Referred member progress</h4>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                  Private account details are hidden. Site clicks are tracked when a referred member is signed in; offer completions are self-reported, not proof of earnings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadReferralSummary()}
                disabled={loading}
                className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-50"
              >
                {loading ? 'Refreshing…' : 'Refresh progress'}
              </button>
            </div>
            {summary.referralProgress.length === 0 ? (
              <p className="mt-4 rounded-lg border border-white/[0.06] bg-[#090d18]/60 p-3 text-xs text-zinc-400">
                No one has signed up through your referral link yet.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {summary.referralProgress.map((member) => (
                  <article key={member.label} className="rounded-lg border border-white/[0.07] bg-[#090d18]/60 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-white">{member.label}</p>
                        <p className="mt-1 text-[10px] text-zinc-500">
                          Joined {new Date(member.createdAt).toLocaleDateString()} · {member.trackedSiteClicks} tracked site {member.trackedSiteClicks === 1 ? 'click' : 'clicks'}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        member.status === 'completed'
                          ? 'bg-emerald-300/10 text-emerald-200'
                          : member.status === 'void'
                            ? 'bg-zinc-300/10 text-zinc-400'
                            : 'bg-amber-300/10 text-amber-200'
                      }`}>
                        {member.status === 'pending' ? 'Conditional' : member.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-zinc-300">
                      <span>Potential reward: {formatMoney(member.bonusCents)}</span>
                      <span>
                        Verified net received: {formatMoney(member.verifiedNetRevenueCents)} / {formatMoney(1000)}
                      </span>
                    </div>
                    {member.offers.length === 0 ? (
                      <p className="mt-2 text-[11px] text-zinc-500">No offer activity reported yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 border-t border-white/[0.06] pt-2">
                        {member.offers.map((offer) => (
                          <li key={offer.offerId} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px]">
                            <span className="text-zinc-200">{offer.company} <span className="text-zinc-500">· {offer.title}</span></span>
                            <span className={offer.reportedCompletedAt ? 'text-emerald-200' : offer.status === 'issue' ? 'text-rose-200' : 'text-zinc-400'}>
                              {offer.reportedCompletedAt ? 'Member-reported complete' : offer.status === 'issue' ? 'Issue reported' : 'In progress'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {member.status === 'pending' && member.verifiedNetRevenueCents < 1000 && (
                      <p className="mt-2 text-[10px] leading-relaxed text-amber-100/80">
                        The $5 reward is not payable unless at least $10 in commission from this signup is actually received and verified by the site owner.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <form onSubmit={saveCustomCode} className="mb-4">
              <label htmlFor="custom-referral-code" className="text-xs font-semibold text-zinc-300">Customize your referral code</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="custom-referral-code"
                  value={customCode}
                  onChange={(event) => setCustomCode(event.target.value.toUpperCase())}
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,22}[A-Za-z0-9]"
                  autoCapitalize="characters"
                  autoComplete="off"
                  required
                  aria-describedby="custom-referral-code-hint"
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300"
                />
                <button
                  type="submit"
                  disabled={savingCode || customCode === summary.referralCode}
                  className="min-h-11 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingCode ? 'Saving…' : 'Save code'}
                </button>
              </div>
              <p id="custom-referral-code-hint" className="mt-1 text-[11px] text-zinc-500">
                3–24 letters, numbers, hyphens, or underscores. Previously shared links remain valid.
              </p>
              {codeMessage && <p role="status" className="mt-2 text-xs text-emerald-300">{codeMessage}</p>}
            </form>
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
