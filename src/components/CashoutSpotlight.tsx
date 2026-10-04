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
  if (spotlightOffers.length !== 2) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-violet-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.13),transparent_55%),#0d111a] p-4 shadow-[0_20px_55px_rgba(0,0,0,0.2)] sm:p-6"
      aria-labelledby="cashout-spotlight-title"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/20 bg-violet-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-100">
            <CircleDollarSign className="h-3.5 w-3.5" /> Cashout in Real Life
          </div>
          <h2 id="cashout-spotlight-title" className="mt-2 text-xl font-black text-white sm:text-2xl">
            Same selfie-first setup. Different ways to cash out.
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">
            A quick, side-by-side walkthrough of what to check before you start and before you withdraw.
          </p>
        </div>
        <span className="text-[10px] text-zinc-500">Details below are site-owner reported; confirm current terms in each app.</span>
      </div>

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
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${isEro ? 'text-cyan-200' : 'text-fuchsia-200'}`}>
                      {spotlight.badge}
                    </p>
                    <h3 className="mt-1 text-lg font-black text-white">{offer.company}</h3>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-white">
                    <Clock3 className="h-3.5 w-3.5 text-emerald-300" /> {spotlight.payout}
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-300">{spotlight.fee}</div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-start gap-2 rounded-lg bg-black/20 p-2.5 text-[11px] leading-relaxed text-zinc-200">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-200" />
                  <span>{spotlight.verification}</span>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-black/20 p-2.5 text-[11px] leading-relaxed text-zinc-200">
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
                    <li key={step} className="flex gap-2.5 text-[11px] leading-relaxed text-zinc-300">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold text-white">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="border-t border-white/[0.07] px-3 py-2.5 text-[10px] leading-relaxed text-amber-100/80">{spotlight.caveat}</p>
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
    </section>
  );
};
