import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, SlidersHorizontal, X } from 'lucide-react';
import { Offer } from '../types';

interface OfferFinderProps {
  offers: Offer[];
  onViewOffer: (offer: Offer) => void;
  onClose: () => void;
}

type Budget = 'zero' | 'under25' | 'any';
type Verification = 'none' | 'any';

export const OfferFinder: React.FC<OfferFinderProps> = ({ offers, onViewOffer, onClose }) => {
  const [budget, setBudget] = useState<Budget>('zero');
  const [category, setCategory] = useState('all');
  const [verification, setVerification] = useState<Verification>('any');
  const [completed, setCompleted] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('signups4fastcash_completed_offers') || '[]') as string[];
    } catch {
      return [];
    }
  });

  const categories = Array.from(new Set(offers.map((offer) => offer.category)));
  const matches = useMemo(() => offers
    .filter((offer) => !completed.includes(offer.id))
    .filter((offer) => category === 'all' || offer.category === category)
    .filter((offer) => verification === 'any' || !offer.honestTruth.idVerificationRequired)
    .filter((offer) => {
      if (budget === 'any') return true;
      const noDeposit = /\$0|no deposit|zero deposit/i.test(offer.depositRequired);
      if (budget === 'zero') return noDeposit;
      const amount = offer.depositRequired.match(/\$(\d+(?:\.\d+)?)/)?.[1];
      return noDeposit || (amount ? Number(amount) <= 25 : false);
    })
    .sort((a, b) => b.incentiveValue - a.incentiveValue)
    .slice(0, 5), [budget, category, completed, offers, verification]);

  const toggleCompleted = (id: string) => {
    const next = completed.includes(id) ? completed.filter((item) => item !== id) : [...completed, id];
    setCompleted(next);
    localStorage.setItem('signups4fastcash_completed_offers', JSON.stringify(next));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="offer-finder-title" className="mx-auto max-w-2xl rounded-2xl border border-cyan-300/25 bg-[#0c1017] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-cyan-300">Personalized offer finder</p>
            <h2 id="offer-finder-title" className="mt-1 text-2xl font-bold text-white">Find offers that fit you</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">Answer a few questions. Your answers stay in this browser and are not used to make financial decisions.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close offer finder"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-semibold text-zinc-300">Budget available
            <select value={budget} onChange={(event) => setBudget(event.target.value as Budget)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#141824] px-3 py-2 text-xs text-white">
              <option value="zero">$0 required first</option>
              <option value="under25">Up to $25</option>
              <option value="any">Any requirement</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-zinc-300">Interested in
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#141824] px-3 py-2 text-xs text-white">
              <option value="all">Any category</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-zinc-300">ID verification
            <select value={verification} onChange={(event) => setVerification(event.target.value as Verification)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#141824] px-3 py-2 text-xs text-white">
              <option value="any">Okay if required</option>
              <option value="none">Prefer no ID requirement</option>
            </select>
          </label>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold text-white">Already completed?</p>
          <p className="mt-1 text-[11px] text-zinc-500">Select offers you have already used. They will be removed from future matches on this browser.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {offers.map((offer) => (
              <button key={offer.id} onClick={() => toggleCompleted(offer.id)} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5">
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${completed.includes(offer.id) ? 'border-emerald-300 bg-emerald-300 text-black' : 'border-zinc-600'}`}>
                  {completed.includes(offer.id) && <Check className="h-3 w-3" />}
                </span>
                {offer.company}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><SlidersHorizontal className="h-4 w-4 text-cyan-300" /> Best matches ({matches.length})</div>
          <div className="mt-3 space-y-2">
            {matches.length === 0 ? <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">No matches yet. Try allowing a larger budget, another category, or ID verification.</p> : matches.map((offer) => (
              <button key={offer.id} onClick={() => onViewOffer(offer)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#141824] p-3 text-left hover:border-cyan-300/40">
                <span><strong className="block text-sm text-white">{offer.company}</strong><span className="text-[11px] text-zinc-400">{offer.title}</span></span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-200">View <ArrowRight className="h-3.5 w-3.5" /></span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-5 text-[10px] leading-relaxed text-zinc-600">Matches are informational, not financial advice. Merchant approval, eligibility, terms, and payouts are controlled by each provider.</p>
      </section>
    </div>
  );
};
