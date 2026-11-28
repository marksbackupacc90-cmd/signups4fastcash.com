import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, LoaderCircle, WalletCards } from 'lucide-react';

interface PayoutRequest {
  id: string;
  points: number;
  status: 'pending' | 'processing' | 'paid' | 'rejected';
  createdAt: string;
}

interface WalletData {
  points: number;
  dollars: number;
  pointsPerDollar: number;
  minimumPayoutPoints: number;
  payoutRequests: PayoutRequest[];
}

interface WalletDashboardProps {
  signedIn: boolean;
  paypalEmail?: string | null;
  onSignIn: () => void;
}

const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export const WalletDashboard: React.FC<WalletDashboardProps> = ({ signedIn, paypalEmail, onSignIn }) => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [email, setEmail] = useState(paypalEmail || '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadWallet = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/rewards/wallet', { credentials: 'include', cache: 'no-store', signal });
      const data = await response.json() as WalletData & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not load your wallet.');
      if (!Number.isInteger(data.points) || !Array.isArray(data.payoutRequests)) throw new Error('Wallet data was returned in an unexpected format.');
      setWallet(data);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : 'Could not load your wallet.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    setEmail(paypalEmail || '');
    if (!signedIn) {
      setWallet(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void loadWallet(controller.signal);
    return () => controller.abort();
  }, [signedIn, paypalEmail]);

  const requestCashout = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/rewards/cashout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paypalEmail: email }),
      });
      const data = await response.json() as { error?: string; points?: number; status?: string };
      if (!response.ok) throw new Error(data.error || 'Could not submit your payout request.');
      setMessage(`Your request for ${data.points ?? wallet?.points ?? 0} points was submitted for manual review.`);
      await loadWallet();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your payout request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8" aria-labelledby="wallet-title">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-200/10 text-emerald-100">
          <WalletCards className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Your rewards</p>
          <h1 id="wallet-title" className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Points wallet</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">Track credited points and request a PayPal payout when you reach the minimum.</p>
        </div>
      </div>

      {!signedIn ? (
        <div className="mt-7 rounded-2xl border border-white/10 bg-[#0e121a] p-6 text-center">
          <p className="text-sm text-zinc-300">Sign in to see your personal points balance and payout history.</p>
          <button type="button" onClick={onSignIn} className="mt-4 min-h-11 rounded-xl bg-cyan-300 px-5 text-sm font-bold text-[#071016] hover:bg-cyan-200">Sign in</button>
        </div>
      ) : loading ? (
        <div role="status" className="mt-7 flex items-center gap-2 text-sm text-zinc-300"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your wallet…</div>
      ) : wallet ? (
        <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-3xl border border-emerald-200/15 bg-[radial-gradient(ellipse_at_top_right,_rgba(52,211,153,0.13),_transparent_50%),#0e121a] p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Available points</p>
            <p className="mt-2 text-4xl font-black tracking-tight text-white">{wallet.points.toLocaleString()} <span className="text-lg font-bold text-zinc-400">pts</span></p>
            <p className="mt-2 text-sm text-emerald-100">Equivalent to {money(wallet.dollars)}</p>
            <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/20 p-4 text-xs leading-relaxed text-zinc-300">
              {wallet.pointsPerDollar} points = $1.00. PayPal requests start at {wallet.minimumPayoutPoints.toLocaleString()} points ({money(wallet.minimumPayoutPoints / wallet.pointsPerDollar)}).
            </div>
            <form onSubmit={requestCashout} className="mt-5 space-y-3">
              <label htmlFor="wallet-paypal-email" className="block text-xs font-semibold text-zinc-200">PayPal email</label>
              <input id="wallet-paypal-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#080c13] px-3 text-sm text-white outline-none focus:border-cyan-200/50" placeholder="you@example.com" />
              <button type="submit" disabled={submitting || wallet.points < wallet.minimumPayoutPoints || wallet.payoutRequests.some((request) => request.status === 'pending' || request.status === 'processing')} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-black text-[#071016] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />}
                {submitting ? 'Submitting…' : 'Request PayPal payout'}
              </button>
            </form>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Requests are reviewed manually. This form does not send money automatically; eligible balance is reserved while a request is pending.</p>
            {message && <p role="status" className="mt-3 text-sm text-emerald-200">{message}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0e121a] p-6">
            <h2 className="text-sm font-bold text-white">Payout activity</h2>
            {wallet.payoutRequests.length ? (
              <ul className="mt-4 space-y-3">
                {wallet.payoutRequests.map((request) => (
                  <li key={request.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{money(request.points / wallet.pointsPerDollar)}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">{new Date(request.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${request.status === 'paid' ? 'bg-emerald-300/10 text-emerald-200' : request.status === 'rejected' ? 'bg-rose-300/10 text-rose-200' : 'bg-amber-300/10 text-amber-100'}`}>{request.status}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 rounded-xl border border-white/[0.06] bg-black/10 p-4 text-xs text-zinc-400">No payout requests yet.</p>}
          </div>
        </div>
      ) : (
        <div role="alert" className="mt-7 rounded-2xl border border-rose-200/15 bg-rose-300/5 p-5 text-sm text-rose-100">{error || 'Your wallet could not be loaded.'}</div>
      )}
    </section>
  );
};
