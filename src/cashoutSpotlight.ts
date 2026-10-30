export interface CashoutSpotlightInfo {
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
    payout: 'Debit-card withdrawal',
    payoutLabel: 'Debit-card cashout',
    verification: 'No ID needed',
    minimum: 'Check the current in-app minimum',
    fee: '',
    steps: [
      'Join with the referral and check that the 50% activity boost appears in your account.',
      'Complete eligible activities you choose. The boost applies to qualifying activity; it is not a guaranteed signup payment.',
      'Review the current cashout options and confirm the net amount shown in the app before withdrawing.',
    ],
    caveat: 'No ID is needed for this offer. Cashout options, eligible activity, and minimums can change; check Ero’s current terms in the app.',
  },
  'candidate-measure-protocol-msr-referral': {
    payout: 'PayPal withdrawal',
    payoutLabel: 'PayPal cashout · check minimum',
    verification: 'Check current in-app requirements',
    minimum: 'Check current in-app minimum',
    fee: 'Check current PayPal cashout fees in the app',
    steps: [
      'Join with the referral and confirm the current reward terms in Measure Protocol.',
      'Review requested permissions before connecting any accounts or services supported by MSR. Available options may include Google, ChatGPT, Facebook, Instagram, YouTube, Netflix, and others; linking may share account or activity data.',
      'Complete any required account checks, reach the current minimum, and review PayPal withdrawal details in the app.',
    ],
    caveat: 'Reward and cashout terms can vary. Check current eligibility, permissions, minimum balance, and redemption terms in the app.',
  },
};

export function getCashoutSpotlightInfo(offerId: string) {
  return cashoutSpotlights[offerId];
}
