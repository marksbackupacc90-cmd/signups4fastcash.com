import React from 'react';
import { ArrowRight, BadgeCheck, CircleDollarSign, Clock3, ShieldCheck } from 'lucide-react';
import type { Offer } from '../types';
import { getCashoutSpotlightInfo } from '../cashoutSpotlight';
import { CompanyLogo } from './CompanyLogo';

interface CashoutSpotlightProps {
  offers: Offer[];
  onViewOffer: (offer: Offer) => void;
}

export const CashoutSpotlight: React.FC<CashoutSpotlightProps> = ({ offers, onViewOffer }) => {
  const spotlightOffers = offers.filter((offer) => getCashoutSpotlightInfo(offer.id));
  const interOffer = offers.find((offer) => offer.id === 'offer-inter-loop-points');
  if (spotlightOffers.length !== 2 && !interOffer) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-violet-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.13),transparent_55%),#0d111a] p-4 shadow-[0_20px_55px_rgba(0,0,0,0.2)] sm:p-6"
      aria-labelledby="cashout-spotlight-title"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/20 bg-violet-300/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-violet-100">
            <CircleDollarSign className="h-3.5 w-3.5" /> The Daily Duo
          </div>
          <h2 id="cashout-spotlight-title" className="mt-2 text-xl font-black text-white sm:text-2xl">
            Featured offers and cashout spotlights
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-300">
            Compare the featured Inter referral reward with the Daily Duo cashout options. Check each offer’s terms before signing up.
          </p>
        </div>
        <span className="text-xs text-zinc-300">Details below are site-owner reported; confirm current terms in each app.</span>
      </div>

      {spotlightOffers.length === 2 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {spotlightOffers.map((offer) => {
          const spotlight = getCashoutSpotlightInfo(offer.id);
          if (!spotlight) return null;
          const isEro = offer.id === 'candidate-ero-app-referral';
          const accent = isEro
            ? 'border-cyan-300/20 from-cyan-300/[0.07]'
            : 'border-fuchsia-300/20 from-fuchsia-300/[0.07]';
          return (
            <article key={offer.id} className={`rounded-xl border bg-gradient-to-br ${accent} to-[#111722] p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <CompanyLogo
                    companyName={offer.company}
                    slug={offer.companySlug}
                    logoUrl={offer.logoUrl}
                    size="sm"
                    loading="eager"
                    className="rounded-xl border border-white/10 bg-white p-1 shadow-lg"
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-bold uppercase tracking-widest ${isEro ? 'text-cyan-200' : 'text-fuchsia-200'}`}>
                      {spotlight.badge}
                    </p>
                    <h3 className="mt-1 text-lg font-black text-white">{offer.company}</h3>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1.5 text-[13px] font-bold text-white">
                    <Clock3 className="h-3.5 w-3.5 text-emerald-300" /> {spotlight.payout}
                  </div>
                  {spotlight.fee && <div className="mt-1 text-xs text-zinc-200">{spotlight.fee}</div>}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-start gap-2 rounded-lg bg-black/20 p-2.5 text-xs leading-relaxed text-zinc-100">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-200" />
                  <span>{spotlight.verification}</span>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-black/20 p-2.5 text-xs leading-relaxed text-zinc-100">
                  <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" />
                  <span>{spotlight.minimum}</span>
                </div>
              </div>

              <details className="group mt-3 rounded-lg border border-white/[0.08] bg-black/15">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-zinc-200 marker:hidden">
                  See the quick walkthrough
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-400 transition-transform group-open:rotate-90" />
                </summary>
                <ol className="space-y-2 border-t border-white/[0.07] px-3 py-3">
                  {spotlight.steps.map((step, index) => (
                    <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-zinc-200">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-white">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="border-t border-white/[0.07] px-3 py-2.5 text-xs leading-relaxed text-amber-100">{spotlight.caveat}</p>
              </details>

              <button
                type="button"
                onClick={() => onViewOffer(offer)}
                className={`mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                  isEro ? 'bg-cyan-200 text-[#07131b] hover:bg-cyan-100' : 'bg-fuchsia-200 text-[#170817] hover:bg-fuchsia-100'
                }`}
              >
                Review {offer.company} offer details <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </article>
          );
          })}
        </div>
      )}

      {interOffer && (
        <article className="mt-4 overflow-hidden rounded-xl border border-orange-300/35 bg-[radial-gradient(circle_at_0%_0%,rgba(251,146,60,0.16),transparent_48%),linear-gradient(120deg,#1c1714,#111722_75%)] p-4 shadow-[0_12px_38px_rgba(0,0,0,0.24)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <CompanyLogo
                companyName={interOffer.company}
                slug={interOffer.companySlug}
                logoUrl={interOffer.logoUrl}
                size="sm"
                loading="eager"
                className="rounded-xl border border-white/10 bg-white p-1 shadow-lg"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-100">Featured referral reward</p>
                <h3 className="mt-1 text-lg font-black text-white">Inter</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-300">Reported for both the eligible new member and referrer; enter code <strong className="font-mono text-orange-100">OVTHOJDC</strong> during signup.</p>
              </div>
            </div>
            <div className="shrink-0 rounded-xl border border-orange-200/25 bg-black/25 px-5 py-3 text-center sm:text-right">
              <p className="text-3xl font-black leading-none text-orange-100">$25</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-orange-100">reported value in Loop points</p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.08] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-amber-100">
              10,000 Loop points—not cash. The $25 value and arrival within 7 days are reported, not independently verified; redemption terms apply. $0 deposit; ID and selfie required.
            </p>
            <button
              type="button"
              onClick={() => onViewOffer(interOffer)}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-orange-200 px-4 py-2 text-xs font-bold text-[#21130a] transition-colors hover:bg-orange-100"
            >
              Review Inter offer details <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </article>
      )}
    </section>
  );
};
