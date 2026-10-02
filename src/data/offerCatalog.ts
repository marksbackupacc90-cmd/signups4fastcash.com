import { PUBLIC_OFFERS } from './initialOffers';
import { BANK_OFFER_CANDIDATES } from './bankOfferCandidates';
import { REFERRAL_OFFER_CANDIDATES } from './referralOfferCandidates';

export const SITE_OFFER_CATALOG = [...PUBLIC_OFFERS, ...BANK_OFFER_CANDIDATES, ...REFERRAL_OFFER_CANDIDATES];
