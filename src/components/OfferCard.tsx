import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Offer } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface OfferCardProps {
  offer: Offer;
  onMoreInfo: (offer: Offer) => void;
}

const CARD_COPY_BY_OFFER_ID: Record<string, { reward?: string; detail?: string }> = {
  'offer-sofi-banking': { reward: '$10 signup bonus', detail: 'No deposit required' },
  'offer-myprize-referral': { reward: '$1 free daily', detail: 'No deposit required' },
  'offer-stake': { reward: '$25 sign up reward', detail: '$1 every 24 hours · No deposit required' },
  'offer-verb': { reward: 'Quick $13 + more over time' },
  'offer-spinquest': { reward: '$1 every 24 hours' },
  'offer-earnx-referral': { reward: '$2 signup bonus', detail: 'Guide to first $20' },
  'offer-inter-loop-points': { reward: 'Easy $25', detail: 'No deposit required' },
  'candidate-measure-protocol-msr-referral': { reward: 'Instant $10 cashout', detail: '+ more over time' },
  'candidate-ero-app-referral': { reward: 'Easy app-linking', detail: 'Instant money app' },
  'offer-kalshi': { reward: 'Mystery box up to $2K', detail: '+ at least $40' },
  'offer-coinbase': { reward: 'Easy $20', detail: 'After trading $15 in crypto' },
  'offer-shuffle-us': { detail: 'No deposit required' },
};

export const OfferCard: React.FC<OfferCardProps> = ({ offer, onMoreInfo }) => {
  const cardCopy = CARD_COPY_BY_OFFER_ID[offer.id];
  const reward = cardCopy?.reward || offer.incentiveAmount;
  const accessibleDescription = cardCopy
    ? `${reward}${cardCopy.detail ? `, ${cardCopy.detail}` : ''}.`
    : `Potential total reward: ${offer.incentiveAmount}.`;

  return (
  <button
    type="button"
    id={`offer-card-${offer.id}`}
    aria-label={`View ${offer.company} offer details. ${accessibleDescription}`}
    onClick={() => onMoreInfo(offer)}
    className="offer-card retro-window group relative flex aspect-[0.66] h-auto w-full min-w-0 flex-col overflow-hidden rounded-[1.1rem] border border-white/[0.12] bg-[#141923] text-left shadow-[0_14px_36px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:shadow-[0_20px_48px_rgba(0,0,0,0.38),0_0_26px_rgba(45,212,238,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
  >
    <div className="relative flex min-h-0 flex-[1.35] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_28%,rgba(45,212,238,0.26),transparent_48%),linear-gradient(145deg,#293b50,#111a28_76%)]">
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,.45)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10 bg-white/[0.04]" />
      <CompanyLogo
        companyName={offer.company}
        slug={offer.companySlug}
        logoUrl={offer.logoUrl}
        size="md"
        className="relative z-10 rounded-2xl border border-white/20 bg-white p-2 shadow-[0_12px_28px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-[1.04]"
      />
    </div>
    <div className="flex min-h-[4.6rem] flex-[0.75] flex-col justify-center bg-[#141923] px-2.5 py-2.5 sm:px-3">
      <p className="truncate text-[13px] font-black leading-snug text-white sm:text-sm" title={offer.company}>
        {offer.company}
      </p>
      <p
        className="mt-1 line-clamp-2 break-words text-[12px] font-bold leading-snug text-white sm:text-sm"
        title={reward}
      >
        {reward}
      </p>
      {cardCopy?.detail && (
        <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-400 sm:text-[9px]">
          {cardCopy.detail}
        </p>
      )}
    </div>
    <ChevronRight className="absolute right-2 top-2 h-5 w-5 rounded-full bg-black/40 p-0.5 text-white/80 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
  </button>
  );
};
