import { Offer } from './types';

type OfferReviewFields = Pick<Offer, 'verificationStatus' | 'verifiedAt' | 'verificationExpiresAt'>;

export function getOfferReviewBadge(offer: OfferReviewFields) {
  if (offer.verificationStatus === 'unverified') {
    return { label: 'Unverified', className: 'text-amber-200' };
  }
  if (offer.verificationStatus === 'terms-vary') {
    return { label: 'Terms vary', className: 'text-amber-200' };
  }
  if (offer.verificationStatus !== 'reviewed') {
    return { label: 'Check terms', className: 'text-amber-200' };
  }

  const expiry = offer.verificationExpiresAt ? Date.parse(offer.verificationExpiresAt) : NaN;
  if (Number.isFinite(expiry) && expiry < Date.now()) {
    return { label: 'Review due', className: 'text-amber-200' };
  }
  return { label: 'Listing reviewed', className: 'text-emerald-300' };
}

export function getOfferReviewDescription(offer: OfferReviewFields) {
  const checkedAt = offer.verifiedAt ? Date.parse(offer.verifiedAt) : NaN;
  const reviewedDate = Number.isFinite(checkedAt)
    ? new Date(checkedAt).toLocaleDateString()
    : null;

  if (offer.verificationStatus === 'unverified') {
    return 'These offer details have not been independently verified. Treat the reward and steps as reported, not guaranteed.';
  }
  if (offer.verificationStatus === 'terms-vary') {
    return 'This offer can vary by user or active promotion. Confirm the exact reward, requirements, and payout terms with the provider before proceeding.';
  }
  if (offer.verificationStatus === 'reviewed') {
    const lastReviewed = reviewedDate ? ` Last reviewed ${reviewedDate}.` : '';
    const expiry = offer.verificationExpiresAt ? Date.parse(offer.verificationExpiresAt) : NaN;
    const reviewDue = Number.isFinite(expiry) && expiry < Date.now();
    return `${reviewDue ? 'This listing is due for a new review.' : 'This listing was reviewed against available offer information.'}${lastReviewed} Terms and eligibility can change; confirm them with the provider before proceeding.`;
  }
  return 'The current offer details have not been confirmed here. Check the provider’s terms before spending money, sharing data, or signing up.';
}

export function getIdVerificationDescription(isRequired: boolean) {
  return isRequired
    ? 'The provider may require identity verification; confirm its current rules.'
    : 'No ID requirement is listed here; the provider may still request identity checks.';
}
