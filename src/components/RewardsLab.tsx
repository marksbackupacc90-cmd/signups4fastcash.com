import React, { useMemo, useState } from 'react';
import { BellRing, Calculator, CheckCircle2, Clock3, History, ShieldCheck, Sparkles } from 'lucide-react';
import { Offer } from '../types';

interface RewardsLabProps {
  offers: Offer[];
  onOpenFinder: () => void;
  onOpenNewsletter: () => void;
}

function numericDeposit(offer: Offer) {
  const match = offer.depositRequired.match(/\$(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

export const RewardsLab: React.FC<RewardsLabProps> = ({ offers, onOpenFinder, onOpenNewsletter }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hours, setHours] = useState(2);
  const offerOfDay = useMemo(() => {
    if (!offers.length) return null;
    const dayIndex = Math.floor(Date.now() / 86400000) % offers.length;
    return [...offers].sort((a, b) => b.incentiveValue - a.incentiveValue)[dayIndex];
  }, [offers]);

  const selectedOffers = offers.filter((offer) => selectedIds.includes(offer.id));
  const estimatedRewards = selectedOffers.reduce((sum, offer) => sum + offer.incentiveValue, 0);
  const estimatedCosts = selectedOffers.reduce((sum, offer) => sum + numericDeposit(offer), 0);
  const netEstimate = Math.max(0, estimatedRewards - estimatedCosts);
  const confidenceAverage = selectedOffers.length
    ? Math.round(selectedOffers.reduce((sum, offer) => sum + offer.honestTruth.trustScore, 0) / selectedOffers.length)
    : 0;

  const toggleCompare = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 3 ? [...current, id] : current);
  };

  return (
    <section className="retro-window overflow-hidden" aria-labelledby="rewards-lab-title">
      <div className="border-b border-white/10 bg-[#0d1724] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300">Rewards Lab</p>
            <h2 id="rewards-lab-title" className="mt-1 text-xl font-bold text-white">Make a smarter signup plan</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">Compare up to three offers, estimate realistic upside after required spending, and see why each offer earned its confidence score.</p>
          </div>
          <button type="button" onClick={onOpenFinder} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300/30 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-300/10">
            <Sparkles className="h-3.5 w-3.5" /> Personalize my matches
          </button>
        </div>
      </div>

      <div className="grid gap-4 bg-[#08111b] p-4 sm:p-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white"><Calculator className="h-4 w-4 text-cyan-300" /> Quick comparison</div>
            <span className="text-[11px] text-zinc-500">{selectedOffers.length}/3 selected</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {offers.slice(0, 8).map((offer) => {
              const selected = selectedIds.includes(offer.id);
              return (
                <button key={offer.id} type="button" onClick={() => toggleCompare(offer.id)} className={`rounded-xl border p-3 text-left transition-colors ${selected ? 'border-cyan-300/60 bg-cyan-300/10' : 'border-white/10 bg-[#101a28] hover:border-cyan-300/30'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <strong className="block truncate text-xs text-white">{offer.company}</strong>
                      <span className="mt-1 block truncate text-[11px] text-zinc-400">{offer.incentiveAmount} · {offer.depositRequired}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${offer.honestTruth.trustScore >= 85 ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>{offer.honestTruth.trustScore}/100</span>
                  </div>
                  <span className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500"><Clock3 className="h-3 w-3" /> {offer.payoutSpeed}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-[#101a28] p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="rewards-hours" className="text-xs font-semibold text-zinc-200">Time you want to spend</label>
              <span className="text-xs font-bold text-cyan-200">{hours} hour{hours === 1 ? '' : 's'}</span>
            </div>
            <input id="rewards-hours" type="range" min="1" max="10" value={hours} onChange={(event) => setHours(Number(event.target.value))} className="mt-3 w-full accent-cyan-300" />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div><div className="text-lg font-bold text-white">${estimatedRewards.toLocaleString()}</div><div className="text-[10px] text-zinc-500">listed rewards</div></div>
              <div><div className="text-lg font-bold text-amber-200">${estimatedCosts.toLocaleString()}</div><div className="text-[10px] text-zinc-500">required spend</div></div>
              <div><div className="text-lg font-bold text-emerald-200">${netEstimate.toLocaleString()}</div><div className="text-[10px] text-zinc-500">rough upside</div></div>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">This is a planning estimate, not a guaranteed payout. Approval, taxes, eligibility, holding periods, and merchant terms can change the result.</p>
          </div>
        </div>

        <div className="space-y-3">
          {offerOfDay && (
            <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-4">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-amber-200"><Sparkles className="h-3.5 w-3.5" /> Offer spotlight</div>
              <h3 className="mt-2 text-base font-bold text-white">{offerOfDay.company}: {offerOfDay.incentiveAmount}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">{offerOfDay.honestTruth.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-200">{offerOfDay.honestTruth.trustScore}/100 confidence</span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-zinc-300">{offerOfDay.payoutSpeed}</span>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-white/10 bg-[#101a28] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Trust snapshot</div>
            <div className="mt-3 space-y-2 text-xs text-zinc-300">
              <div className="flex items-center justify-between"><span>Average selected confidence</span><strong className="text-emerald-200">{confidenceAverage || '—'}{confidenceAverage ? '/100' : ''}</strong></div>
              <div className="flex items-center justify-between"><span>Offers with terms shown</span><strong className="text-cyan-200">{offers.length}/{offers.length}</strong></div>
              <div className="flex items-center justify-between"><span>Official links used</span><strong className="text-cyan-200">{offers.length}/{offers.length}</strong></div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#101a28] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white"><History className="h-4 w-4 text-violet-300" /> Transparent updates</div>
            <div className="mt-3 space-y-2">
              {offers.slice(0, 3).map((offer) => <div key={offer.id} className="flex items-center justify-between gap-3 text-[11px]"><span className="truncate text-zinc-300">{offer.company} reviewed</span><span className="shrink-0 text-zinc-500">{offer.updatedAt ? new Date(offer.updatedAt).toLocaleDateString() : 'Current'}</span></div>)}
            </div>
          </div>
          <button type="button" onClick={onOpenNewsletter} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 py-2.5 text-xs font-bold text-[#06131a] hover:bg-cyan-200"><BellRing className="h-3.5 w-3.5" /> Get reward change alerts</button>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> Self-reported progress stays on your device in My Offers.</div>
        </div>
      </div>
    </section>
  );
};
