import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Offer } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface OfferCardProps {
  offer: Offer;
  onMoreInfo: (offer: Offer) => void;
}

export const OfferCard: React.FC<OfferCardProps> = ({ offer, onMoreInfo }) => (
  <button
    type="button"
    id={`offer-card-${offer.id}`}
    aria-label={`View ${offer.company} offer details. Potential reward: ${offer.incentiveAmount}.`}
    onClick={() => onMoreInfo(offer)}
    className="offer-card retro-window group relative flex aspect-[0.66] h-auto w-full min-w-0 flex-col overflow-hidden rounded-[1.1rem] border border-white/[0.12] bg-[#141923] text-left shadow-[0_14px_36px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:shadow-[0_20px_48px_rgba(0,0,0,0.38),0_0_26px_rgba(45,212,238,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
  >
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_28%,rgba(45,212,238,0.26),transparent_48%),linear-gradient(145deg,#293b50,#111a28_76%)]">
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,.45)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10 bg-white/[0.04]" />
      <CompanyLogo
        companyName={offer.company}
        slug={offer.companySlug}
        logoUrl={offer.logoUrl}
        size="lg"
        className="relative z-10 rounded-2xl border border-white/20 bg-white p-2 shadow-[0_12px_28px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-[1.04]"
      />
      <span className="absolute bottom-2.5 left-2.5 rounded-md border border-white/15 bg-black/55 px-2 py-1 text-[10px] font-bold leading-none text-white backdrop-blur-sm">
        {offer.company}
      </span>
    </div>
    <div className="min-h-[4.3rem] bg-[#141923] px-2.5 py-2.5 sm:px-3">
      <p className="line-clamp-2 break-words text-[13px] font-black leading-snug text-white sm:text-sm">
        {offer.incentiveAmount}
      </p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Potential reward</p>
    </div>
    <ChevronRight className="absolute right-2 top-2 h-5 w-5 rounded-full bg-black/40 p-0.5 text-white/80 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
  </button>
);
