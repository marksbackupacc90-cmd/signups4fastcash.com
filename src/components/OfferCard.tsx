import React from 'react';
import { ArrowRight, Check, Clock3, ExternalLink, GitCompareArrows, ShieldCheck } from 'lucide-react';
import { Offer } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface OfferCardProps {
  offer: Offer;
  onClaimClick: (offerId: string) => void;
  onMoreInfo: (offer: Offer) => void;
  isCompared: boolean;
  onToggleCompare: (offerId: string) => void;
}

const CATEGORY_LABELS: Record<Offer['category'], string> = {
  fintech: 'Banking & fintech',
  brokerage: 'Stocks & investing',
  cashback: 'Cashback',
  apps: 'Apps & rewards',
  crypto: 'Crypto',
};

const isNoDeposit = (depositRequired: string) => /\$0|no deposit|zero deposit/i.test(depositRequired);

const reviewLabel = (verifiedAt?: string) => {
  const date = verifiedAt ? new Date(verifiedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Check current terms';
  const recent = Date.now() - date.getTime() <= 30 * 24 * 60 * 60 * 1000;
  return recent
    ? `Reviewed ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : 'Review current terms';
};

export const OfferCard: React.FC<OfferCardProps> = ({ offer, onClaimClick, onMoreInfo, isCompared, onToggleCompare }) => {
  const review = reviewLabel(offer.verifiedAt);
  const recentlyReviewed = review.startsWith('Reviewed ');

  const handleClaim = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClaimClick(offer.id);
    const claimUrl = offer.referralUrl || offer.officialMerchantUrl;
    const openedWindow = window.open(claimUrl, '_blank', 'noopener,noreferrer');
    if (!openedWindow) window.location.assign(claimUrl);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onMoreInfo(offer);
    }
  };

  return (
    <article
      className="offer-card group"
      role="group"
      tabIndex={0}
      aria-label={`${offer.company}: ${offer.incentiveAmount}. ${offer.depositRequired}.`}
      onClick={() => onMoreInfo(offer)}
      onKeyDown={handleCardKeyDown}
    >
      <div className="offer-card-inner">
        <div className="offer-card-header">
          <div className="offer-brand">
            <CompanyLogo companyName={offer.company} slug={offer.companySlug} logoUrl={offer.logoUrl} size="sm" />
            <div className="min-w-0">
              <p className="offer-company">{offer.company}</p>
              <p className="offer-category">{CATEGORY_LABELS[offer.category]}</p>
            </div>
          </div>
          {isNoDeposit(offer.depositRequired) && <span className="offer-badge">No deposit</span>}
        </div>

        <div className="mt-4">
          <p className="offer-reward-label">Advertised reward</p>
          <p className="offer-reward">{offer.incentiveAmount}</p>
          <h3 className="offer-title">{offer.title}</h3>
          <p className="offer-summary">{offer.honestTruth.summary}</p>
        </div>

        <div className="offer-requirement">
          <span className="offer-requirement-label">What you need to do</span>
          <span className="offer-requirement-value">{offer.depositRequired}</span>
        </div>

        <div className="offer-metadata">
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {offer.difficulty}</span>
          <span>{offer.payoutSpeed}</span>
        </div>

        <p className="offer-reviewed" data-current={recentlyReviewed} title={offer.verifiedAt ? `Last reviewed ${new Date(offer.verifiedAt).toLocaleDateString()}` : undefined}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {review}
        </p>

        <div className="offer-card-actions">
          <button
            type="button"
            className="offer-details-button"
            aria-label={`View details for ${offer.title}`}
            onClick={(event) => { event.stopPropagation(); onMoreInfo(offer); }}
          >
            View details <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="offer-claim-button"
            id={`claim-offer-btn-${offer.id}`}
            aria-label={`Visit the ${offer.company} offer`}
            onClick={handleClaim}
          >
            Visit offer <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className={`offer-compare-toggle ${isCompared ? 'is-selected' : ''}`}
          aria-pressed={isCompared}
          onClick={(event) => { event.stopPropagation(); onToggleCompare(offer.id); }}
        >
          {isCompared ? <Check className="h-3.5 w-3.5" /> : <GitCompareArrows className="h-3.5 w-3.5" />}
          {isCompared ? 'Added to compare' : 'Add to compare'}
        </button>
      </div>
    </article>
  );
};
