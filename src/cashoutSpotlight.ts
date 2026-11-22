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
    verification: 'Kraken may require ID',
    minimum: 'Check the current in-app minimum',
    fee: 'Reddit report mentions a $2 Ero debit-card fee; confirm the current fee in-app',
    steps: [
      'The reported path starts with eligible Ero app connections; review each permission and confirm any credit in Ero.',
      'Check Ero’s current cashout minimum, fee, and delivery estimate before withdrawing.',
      'The reported Kraken step may require a $10 deposit for a $40 reward; confirm Kraken’s current eligibility and payout terms before funding.',
    ],
    caveat: 'The amounts, fee, and instant-cashout claim come from a Reddit report and are not verified here. Ero and Kraken terms, eligibility, and timing can change; Kraken may require identity verification and a deposit carries financial risk.',
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
