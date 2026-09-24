import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { Offer } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface OfferCardProps {
  offer: Offer;
  onClaimClick: (offerId: string) => void;
  onMoreInfo: (offer: Offer) => void;
}

export const OfferCard: React.FC<OfferCardProps> = ({ offer, onClaimClick, onMoreInfo }) => {
  const verificationDate = offer.verifiedAt ? Date.parse(offer.verifiedAt) : NaN;
  const isRecentlyVerified = Number.isFinite(verificationDate) && verificationDate >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  const claimUrl = offer.referralUrl || offer.officialMerchantUrl;

  const handleClaim = () => {
    onClaimClick(offer.id);
    const openedWindow = window.open(claimUrl, '_blank', 'noopener,noreferrer');
    if (!openedWindow) window.location.assign(claimUrl);
  };

  return (
    <div
      id={`offer-card-${offer.id}`}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${offer.title} from ${offer.company}`}
      onClick={() => onMoreInfo(offer)}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => {
        if (event.target === event.currentTarget || !(event.target instanceof HTMLElement && event.target.closest('button'))) {
          onMoreInfo(offer);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onMoreInfo(offer);
        }
      }}
      className="offer-card retro-window group relative flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-[1.35rem] border border-white/[0.1] bg-[#171a22]/95 shadow-[0_18px_50px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/30 hover:shadow-[0_24px_60px_rgba(0,0,0,0.32),0_0_30px_rgba(45,212,238,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
    >
      <div className="relative flex h-32 shrink-0 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_20%_100%,rgba(45,212,238,0.2),transparent_42%),linear-gradient(145deg,#263747,#0d141f_78%)] sm:h-36">
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute inset-x-8 top-4 h-20 rounded-full bg-cyan-200/10 blur-3xl" />
        <div className="relative z-10 flex h-full w-full items-center justify-center transition-transform duration-300 group-hover:scale-[1.04]">
          <CompanyLogo companyName={offer.company} slug={offer.companySlug} logoUrl={offer.logoUrl} size="lg" className="rounded-[1.6rem] bg-white/[0.08] p-2 shadow-[0_18px_35px_rgba(0,0,0,0.35)] ring-1 ring-white/15 backdrop-blur-md" />
        </div>
      </div>
      <div className="flex flex-1 flex-col bg-[linear-gradient(180deg,#1b1e27_0%,#171a22_100%)] p-3 sm:p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 text-left">
            <h2 className="truncate text-[0.95rem] font-black leading-tight tracking-[-0.01em] text-white transition-colors group-hover:text-[#2dd4ee]">{offer.title}</h2>
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-zinc-400">{offer.honestTruth.summary}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-mono text-zinc-400">
          <span className="text-amber-300">★ <span className="text-zinc-200">{offer.honestTruth.trustScore / 20}</span></span>
          <span>{offer.difficulty}</span>
          <span className={`inline-flex items-center gap-1 ${isRecentlyVerified ? 'text-emerald-300' : 'text-amber-200'}`}><ShieldCheck className="h-3 w-3" /> {isRecentlyVerified ? 'Terms checked' : 'Review terms'}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-2.5 text-[9px] text-zinc-500">
          <span className="truncate">{offer.company}</span>
          <span className="shrink-0">{offer.payoutSpeed}</span>
        </div>
        <button type="button" onPointerUp={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); handleClaim(); }} id={`claim-offer-btn-${offer.id}`} aria-label={`Claim the ${offer.company} offer`} className="focus-ring group/btn mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#2dd4ee]/60 bg-[#2dd4ee] px-3 py-2.5 text-xs font-semibold text-[#06131a] shadow-[0_0_16px_rgba(45,212,238,0.18)] transition-all hover:bg-[#67e8f9] active:scale-[0.99]">
          <span>Claim offer</span><ExternalLink className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
        </button>
        <div className="mt-2 text-center text-[9px] text-zinc-500"><span className="text-emerald-400">Direct partner link</span> • payout by {offer.company}</div>
      </div>
    </div>
  );
};
