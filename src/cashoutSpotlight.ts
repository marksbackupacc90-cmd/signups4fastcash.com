export interface CashoutSpotlightInfo {
  badge: string;
  payout: string;
  payoutLabel: string;
  verification: string;
  minimum: string;
  fee: string;
  steps: string[];
  caveat: string;
}

const cashoutSpotlights: Record<string, CashoutSpotlightInfo> = {
  'candidate-ero-app-referral': {
    badge: 'Cashout in Real Life',
    payout: 'Instant debit-card withdrawal',
    payoutLabel: 'Instant debit-card cashout',
    verification: 'No ID required',
    minimum: 'Check the current in-app minimum',
    fee: '',
    steps: [
      'Join with the referral and check that the 50% activity boost appears in your account.',
      'Complete eligible activities you choose. The boost applies to qualifying activity; it is not a guaranteed signup payment.',
      'Review the current cashout options and confirm the net amount shown in the app before withdrawing.',
    ],
    caveat: 'Cashout and ID details are owner-reported; check current Ero terms, eligible activity, and minimums in the app.',
  },
  'candidate-measure-protocol-msr-referral': {
    badge: 'Cashout in Real Life',
    payout: 'Instant PayPal withdrawal',
    payoutLabel: 'Free instant PayPal · $10 minimum',
    verification: 'No ID required',
    minimum: '$10 minimum balance',
    fee: 'No PayPal cashout fee reported',
    steps: [
      'Join with the referral and confirm the current reward terms in Measure Protocol.',
      'Review requested permissions before connecting any accounts or services supported by MSR. Available options may include Google, ChatGPT, Facebook, Instagram, YouTube, Netflix, and others; linking may share account or activity data.',
      'Complete the selfie check, reach the $10 minimum, and choose PayPal. The owner reports free, instant withdrawal.',
    ],
    caveat: 'Reward and cashout details are owner-reported and may vary. Check current eligibility, permissions, minimum balance, and redemption terms in the app.',
  },
};

export function getCashoutSpotlightInfo(offerId: string) {
  return cashoutSpotlights[offerId];
}
