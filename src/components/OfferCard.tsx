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
    className="offer-card retro-window group flex h-full w-full min-w-0 items-center gap-4 overflow-hidden rounded-[1.35rem] border border-white/[0.1] bg-[#171a22]/95 p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/30 hover:shadow-[0_24px_60px_rgba(0,0,0,0.32),0_0_30px_rgba(45,212,238,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 sm:p-5"
  >
    <CompanyLogo
      companyName={offer.company}
      slug={offer.companySlug}
      logoUrl={offer.logoUrl}
      size="sm"
      className="shrink-0 rounded-2xl bg-white/[0.08] p-2 shadow-lg"
    />
    <div className="min-w-0 flex-1">
      <h2 className="truncate text-base font-black leading-tight text-white transition-colors group-hover:text-[#2dd4ee]">
        {offer.company}
      </h2>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300">Potential reward</p>
      <p className="mt-0.5 line-clamp-2 break-words text-sm font-bold leading-snug text-cyan-100 sm:text-base">
        {offer.incentiveAmount}
      </p>
    </div>
    <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-100" aria-hidden="true" />
  </button>
);
