import { Offer } from './types';

export function getOfferSourceUrl(offer: Pick<Offer, 'sourceUrl' | 'officialMerchantUrl'>) {
  return offer.sourceUrl || offer.officialMerchantUrl;
}

export function getOfferRewardKind(offer: Pick<Offer, 'incentiveAmount'>): 'cash' | 'points' | 'other' {
  const reward = offer.incentiveAmount.toLowerCase();
  if (/\bpoints?\b/.test(reward)) return 'points';
  if (/\b(stock|share|shares|gift card|gc|sc|mystery box)\b/.test(reward)) return 'other';
  if (/\bcash(?:back)?\b|\bpaypal\b|\$\s*\d/.test(reward)) return 'cash';
  return 'other';
}

export function getIdVerificationDescription(isRequired: boolean) {
  return isRequired
    ? 'The provider may require identity verification; confirm its current rules.'
    : 'No ID requirement is listed here; the provider may still request identity checks.';
}
