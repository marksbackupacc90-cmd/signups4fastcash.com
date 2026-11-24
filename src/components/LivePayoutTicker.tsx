import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface LiveOfferCredit {
  id: string;
  username: string;
  offerwall: string;
  offer: string;
  payoutAmount: number;
  creditedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLiveOfferCredit(value: unknown): value is LiveOfferCredit {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.username === 'string'
    && typeof value.offerwall === 'string'
    && typeof value.offer === 'string'
    && typeof value.payoutAmount === 'number'
    && Number.isFinite(value.payoutAmount)
    && typeof value.creditedAt === 'string';
}

export const LivePayoutTicker: React.FC = () => {
  const [offers, setOffers] = useState<LiveOfferCredit[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const controller = new AbortController();

    const loadOffers = async () => {
      try {
        const response = await fetch('/api/live-offers', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Live payouts are temporarily unavailable.');
        const payload: unknown = await response.json();
        const nextOffers = isRecord(payload) && Array.isArray(payload.offers)
          ? payload.offers.filter(isLiveOfferCredit)
          : null;
        if (!nextOffers) throw new Error('The live payout feed returned an invalid response.');
        if (active) {
          setOffers(nextOffers);
          setError('');
        }
      } catch (loadError) {
        if (active && !(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setError(loadError instanceof Error ? loadError.message : 'Live payouts are temporarily unavailable.');
        }
      } finally {
        if (active) timer = window.setTimeout(() => void loadOffers(), 30_000);
      }
    };

    void loadOffers();
    return () => {
      active = false;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const copies = offers.length > 0 ? [0, 1] : [];

  return (
    <section className="border-b border-cyan-200/10 bg-slate-950/45 backdrop-blur-xl" aria-label="Recent offer payouts">
      <div className="mx-auto flex min-h-11 max-w-[1600px] items-center gap-3 overflow-hidden px-4 sm:px-6 lg:px-8">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-100">
          <Sparkles className="h-3 w-3 text-cyan-300" aria-hidden="true" />
          Live payouts
        </span>
        {error ? (
          <p className="truncate text-xs text-slate-400" role="status">{error}</p>
        ) : offers.length === 0 ? (
          <p className="truncate text-xs text-slate-400" role="status">No recent offer completions yet.</p>
        ) : (
          <div className="live-payout-window min-w-0 flex-1 overflow-hidden" role="region" aria-label="Recently credited offers">
            <div className="live-payout-track flex w-max items-center">
              {copies.map((copy) => (
                <ul key={copy} className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={copy === 1}>
                  {offers.map((offer) => (
                    <li key={`${copy}-${offer.id}`} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
                      <span className="font-semibold text-slate-200">{offer.username}</span>
                      <span className="text-slate-500">earned</span>
                      <span className="font-bold tabular-nums text-emerald-300">
                        {offer.payoutAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </span>
                      <span className="text-slate-500">on</span>
                      <span className="font-medium text-cyan-200">{offer.offerwall}</span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
