export interface BlueprintStep {
  id: string;
  stepNumber: number;
  phaseId: 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4';
  phaseTitle: string;
  phaseTimeframe: string;
  company: string;
  offerId: string;
  defaultCode: string;
  defaultUrl: string;
  capitalRequired: string;
  capitalRequiredNumeric: number;
  isOutofPocket: boolean; // false if funded by previous earnings
  expectedPayout: string;
  conservativePayout: number;
  maxPotentialPayout: number;
  payoutTimeframe: string;
  payoutSpeedCategory: 'immediate' | 'within-24h' | '2-5-days' | '7-14-days' | '30-days';
  withdrawalMethod: string;
  summary: string;
  walkthrough: string[];
  honestTrap: string;
  proTip: string;
}

export interface BlueprintPhase {
  id: 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4';
  title: string;
  subtitle: string;
  timeframe: string;
  capitalOutlay: string;
  targetAccumulated: string;
  description: string;
}

export const BLUEPRINT_PHASES: BlueprintPhase[] = [
  {
    id: 'phase-1',
    title: 'Phase 1: Zero-Capital Seed Stage',
    subtitle: 'From $0.00 Out-of-Pocket to First $35 - $60 in Hand',
    timeframe: 'Hours 1 to 24 (Day 1)',
    capitalOutlay: '$0.00 (Zero Out-of-Pocket)',
    targetAccumulated: '$35 - $60 Cash',
    description: 'Requires absolutely $0 in your bank. You register with proven no-deposit promotions, verify your ID, and pull pure profit into PayPal, Crypto, or your bank.',
  },
  {
    id: 'phase-2',
    title: 'Phase 2: Micro-Reinvestment Brokerage Multipliers',
    subtitle: 'Rolling $1 to $5 from Phase 1 into $75 - $140',
    timeframe: 'Days 2 to 5',
    capitalOutlay: '$1.00 - $5.00 (Funded entirely from Phase 1 profits)',
    targetAccumulated: '$75 - $140 Total',
    description: 'Take a single dollar from your Phase 1 cashout and leverage regulated brokerages that give guaranteed fractional shares worth 10x to 50x your tiny deposit.',
  },
  {
    id: 'phase-3',
    title: 'Phase 3: Fintech & Shopping Rebate Snowball',
    subtitle: 'Expanding to $150 - $450 with Banking & Shopping Match',
    timeframe: 'Days 5 to 14',
    capitalOutlay: '$10.00 - $25.00 (Funded by Phase 1 & 2 cash)',
    targetAccumulated: '$150 - $450 Total',
    description: 'Open a high-yield checking account using $10 of your profits to trigger a $25+ instant bonus, plus add browser cashback for guaranteed 100%+ rebate returns on everyday necessities.',
  },
  {
    id: 'phase-4',
    title: 'Phase 4: Direct Deposit & Passive Compounding',
    subtitle: 'Unlocking the $650 - $1,250+ Boss Level',
    timeframe: 'Days 14 to 30+',
    capitalOutlay: '$0 Net Out-of-Pocket (Redirecting 1 existing paycheck/gig deposit)',
    targetAccumulated: '$650 - $1,250+ Grand Total',
    description: 'Route a single $200 payroll or gig payment (DoorDash, Uber, employer) to trigger instant $100 cash matches and stack 30 days of daily passive login reloads.',
  },
];

export const BLUEPRINT_STEPS: BlueprintStep[] = [
  // --- PHASE 1 ---
  {
    id: 'step-stake',
    stepNumber: 1,
    phaseId: 'phase-1',
    phaseTitle: 'Phase 1: Zero-Capital Seed Stage',
    phaseTimeframe: 'Day 1 (Instant to 2 Hours)',
    company: 'Stake.us',
    offerId: 'offer-stake-us',
    defaultCode: 'fastcash',
    defaultUrl: 'https://stake.us/?c=fastcash',
    capitalRequired: '$0.00 (Zero Deposit Required)',
    capitalRequiredNumeric: 0,
    isOutofPocket: false,
    expectedPayout: '$25.00 Free Cash + Daily $1.00',
    conservativePayout: 25,
    maxPotentialPayout: 55, // including first month of $1 daily
    payoutTimeframe: 'Instant on registration & Level 1 ID verification',
    payoutSpeedCategory: 'immediate',
    withdrawalMethod: 'Crypto (Litecoin, Bitcoin, USDT) or Digital Gift Cards',
    summary: 'The fastest pure-cash zero-deposit bonus available. Register with code fastcash to get 25 Free Stake Cash immediately credited.',
    walkthrough: [
      'Click Claim and sign up at Stake.us ensuring referral code fastcash is entered.',
      'Complete the instant Level 1 identity verification (takes ~60 seconds with ID/license).',
      'Receive 25 Stake Cash ($25.00 value) + 250k Gold Coins in your balance immediately.',
      'To make the $25 withdrawable, play through it 1x on 99% RTP games (see Pro Tip below for zero-risk technique).',
      'Redeem directly to your crypto wallet (Litecoin has negligible fees) or redeem for digital gift cards.'
    ],
    honestTrap: 'Do NOT try to gamble this on high-risk slots or you will lose the free money. Use the mathematical low-risk strategy below to preserve virtually 100% of the $25.',
    proTip: 'The 99% Wash Method: Set the Stake "Dice" game to 98% or 99% win chance with 10¢ or 25¢ bets on auto-roll. This satisfies the 1x sweepstakes rollover with statistical certainty, leaving you with ~$24.75 ready for instant crypto withdrawal in under 15 minutes.',
  },
  {
    id: 'step-freecash',
    stepNumber: 2,
    phaseId: 'phase-1',
    phaseTitle: 'Phase 1: Zero-Capital Seed Stage',
    phaseTimeframe: 'Day 1 (15 Minutes to 2 Hours)',
    company: 'Freecash',
    offerId: 'offer-freecash',
    defaultCode: 'wintercash',
    defaultUrl: 'https://freecash.com/r/wintercash',
    capitalRequired: '$0.00 (Zero Deposit Required)',
    capitalRequiredNumeric: 0,
    isOutofPocket: false,
    expectedPayout: '$5.00 - $30.00 Instant Cash',
    conservativePayout: 10,
    maxPotentialPayout: 250,
    payoutTimeframe: 'Instant (Under 5 minutes once $5 threshold is reached)',
    payoutSpeedCategory: 'immediate',
    withdrawalMethod: 'PayPal, Litecoin (0% fee), Bitcoin, or Visa Gift Card',
    summary: 'Open a free welcome bonus chest ($0.05 - $250) and knock out 1 quick 10-minute app install or survey to hit the $5 instant cashout.',
    walkthrough: [
      'Sign up on Freecash using referral code wintercash.',
      'Open your free welcome chest immediately to claim your initial cash credit.',
      'Navigate to "Featured Offers" and pick 1 fast app trial (e.g. install a mobile game and reach level 3, or test a fintech app).',
      'Once your balance reaches $5.00 (usually within 15–30 minutes), click Cashout.',
      'Select Litecoin (LTC) for instant 0% fee payout, or select PayPal / Visa Card.'
    ],
    honestTrap: 'Avoid long multi-week survey walls. Stick strictly to verified app installs and mobile game speedrun tiers that pay out within 10 to 30 minutes.',
    proTip: 'If cashing out to crypto, select Litecoin (LTC) directly to a Coinbase or CashApp LTC address. Payout arrives in under 3 minutes with zero fees deducted.',
  },
  {
    id: 'step-robinhood',
    stepNumber: 3,
    phaseId: 'phase-1',
    phaseTitle: 'Phase 1: Zero-Capital Seed Stage',
    phaseTimeframe: 'Day 1 to Day 2',
    company: 'Robinhood',
    offerId: 'offer-robinhood',
    defaultCode: 'ROBIN-FREE26',
    defaultUrl: 'https://join.robinhood.com/ROBIN-FREE26',
    capitalRequired: '$0.00 (Zero Deposit Required to unlock share)',
    capitalRequiredNumeric: 0,
    isOutofPocket: false,
    expectedPayout: '$5.00 - $200.00 Free Stock (Avg $10 - $15)',
    conservativePayout: 10,
    maxPotentialPayout: 200,
    payoutTimeframe: 'Instant share award upon approval (10 min to 24h)',
    payoutSpeedCategory: 'within-24h',
    withdrawalMethod: 'Bank ACH Transfer or Robinhood Cash Card',
    summary: 'Get 1 guaranteed free company stock just for completing standard investor approval and linking your bank via Plaid. Zero deposit is needed.',
    walkthrough: [
      'Click Claim and open a free Robinhood individual brokerage account.',
      'Pass the instant SSN identity verification.',
      'Link your checking account or debit card via Plaid (you do not need to deposit money).',
      'Claim your mystery gift box from the app home screen to reveal your free fractional share.',
      'Hold the share or sell it after 2 trading days into withdrawable cash.'
    ],
    honestTrap: 'Robinhood places a standard 30-day anti-fraud hold on the cash proceeds of promotional stock sales before allowing withdrawal to an outside bank. However, the asset value is locked in immediately and can be invested or held.',
    proTip: '98% of rewards are valued between $5 and $10 (e.g. Apple or Ford fractional). Sell the share on day 2 so your cash value is locked in safely regardless of stock market fluctuations.',
  },

  // --- PHASE 2 ---
  {
    id: 'step-webull',
    stepNumber: 4,
    phaseId: 'phase-2',
    phaseTitle: 'Phase 2: Micro-Reinvestment Brokerage Multipliers',
    phaseTimeframe: 'Days 2 to 5',
    company: 'Webull Securities',
    offerId: 'offer-webull-brokerage',
    defaultCode: 'WEBULL-BONUS',
    defaultUrl: 'https://a.webull.com/invite/WEBULL-BONUS',
    capitalRequired: '$1.00 (Funded from Stage 1 earnings)',
    capitalRequiredNumeric: 1,
    isOutofPocket: false,
    expectedPayout: '$34.00 - $200.00 Free Fractional Shares (Avg $36)',
    conservativePayout: 36,
    maxPotentialPayout: 3000,
    payoutTimeframe: '2-3 days for ACH deposit to clear, shares awarded immediately upon clearance',
    payoutSpeedCategory: '2-5-days',
    withdrawalMethod: 'Bank ACH Transfer (Zero Fee)',
    summary: 'The single highest ROI micro-deposit on the internet: depositing just $1.00 unlocks 3 to 12 guaranteed fractional stock shares.',
    walkthrough: [
      'Open a Webull Individual Brokerage Cash Account through our referral link.',
      'Transfer exactly $1.00 or $5.00 from the checking/PayPal account funded in Phase 1.',
      'Webull grants instant purchasing credit. While the $1 ACH transfer clears (2-3 business days), your promotional spin wheels are credited.',
      'Navigate to Menu > My Rewards > Claim Free Shares to claim all your free stocks.',
      'Once shares settle in your account, tap Sell, then withdraw the cash balance back to your bank.'
    ],
    honestTrap: 'You MUST remember to click "Claim" in the "My Rewards" tab within 30 days of depositing, or Webull will forfeit the reward. Do this as soon as your notification arrives.',
    proTip: 'Each claimed share is guaranteed a minimum value of $3.00, and with promotions giving between 6 and 12 draws, the statistical expected value is consistently $36.00 to $48.00 on a single $1 transfer.',
  },

  // --- PHASE 3 ---
  {
    id: 'step-sofi',
    stepNumber: 5,
    phaseId: 'phase-3',
    phaseTitle: 'Phase 3: Fintech & Shopping Rebate Snowball',
    phaseTimeframe: 'Days 5 to 7',
    company: 'SoFi Checking & Savings',
    offerId: 'offer-sofi-banking',
    defaultCode: '72836365',
    defaultUrl: 'https://www.sofi.com/invite/coach?gcp=72836365-7180-469f-bfe5-42d8c2578a99&isAliasGcp=false&siid=e2c1795c-e596-4927-a73f-cfe51c7ea3d7',
    capitalRequired: '$10.00 (Funded from accumulated Phase 1 & 2 profits)',
    capitalRequiredNumeric: 10,
    isOutofPocket: false,
    expectedPayout: '$25.00 Instant Cash Bonus (Up to $300 with Direct Deposit)',
    conservativePayout: 25,
    maxPotentialPayout: 325,
    payoutTimeframe: 'Within 24 to 48 hours of initial $10 funding',
    payoutSpeedCategory: 'within-24h',
    withdrawalMethod: 'Direct ACH, Debit Card, or P2P (Venmo/CashApp)',
    summary: 'Deposit $10 into a fee-free SoFi Checking & Savings account using your previous earnings. SoFi credits $25.00 cold cash directly to your balance in 1–2 days.',
    walkthrough: [
      'Click Claim and open a SoFi Checking & Savings account with referral code 72836365.',
      'Link your external bank via Plaid or debit card and transfer $10.00.',
      'Within 24 to 48 hours, a $25.00 cash bonus posts directly to your account.',
      'There is zero minimum hold time: you can immediately transfer your $10 + $25 ($35 total) back out, or keep it in SoFi earning 4.50% APY.'
    ],
    honestTrap: 'The huge $300 bonus tier requires a $5,000+ direct deposit. If you do not have that, don\'t worry! The base $25 bonus is 100% guaranteed with just a simple $10 deposit.',
    proTip: 'SoFi has zero monthly account fees and zero overdraft fees. Keep this account active because it has built-in 4.50% APY to store all the cash generated from signups4fastcash.com.',
  },
  {
    id: 'step-capital-one',
    stepNumber: 6,
    phaseId: 'phase-3',
    phaseTitle: 'Phase 3: Fintech & Shopping Rebate Snowball',
    phaseTimeframe: 'Days 7 to 14',
    company: 'Capital One Shopping',
    offerId: 'offer-capital-one-shopping',
    defaultCode: '090a1fc7',
    defaultUrl: 'https://capitaloneshopping.com/r/090a1fc7-f110-485e-a500-d6e27f6155a8',
    capitalRequired: '$10.00 (On everyday essentials you already buy)',
    capitalRequiredNumeric: 10,
    isOutofPocket: false,
    expectedPayout: '$30.00 - $100.00 Shopping Rebate Bonus',
    conservativePayout: 30,
    maxPotentialPayout: 100,
    payoutTimeframe: '7 to 14 days pending merchant return window',
    payoutSpeedCategory: '7-14-days',
    withdrawalMethod: 'Digital Gift Cards (Walmart, eBay, Macy\'s, Target)',
    summary: 'Install the free browser extension/app with code 090a1fc7 and complete any $10+ purchase on household necessities to earn $30 to $100 back in gift cards.',
    walkthrough: [
      'Install Capital One Shopping extension or mobile app via referral link.',
      'Create a free account (no Capital One credit card required).',
      'Make any qualifying online purchase of $10 or more (e.g. toilet paper, soap, or groceries at Walmart, eBay, Target).',
      'The referral rebate tracks in your rewards dashboard within 24-48 hours.',
      'Once the merchant return window closes (7-14 days), redeem your $30 - $100 reward for digital gift cards delivered instantly by email.'
    ],
    honestTrap: 'Do NOT buy random items you don\'t need. Buy consumable household goods (toothpaste, groceries, pet food) you were already budgeting for.',
    proTip: 'Gift cards from Capital One Shopping are delivered as digital bar codes within 60 seconds of redemption. You can immediately spend them at Walmart or eBay for groceries or merchandise.',
  },
  {
    id: 'step-rakuten',
    stepNumber: 7,
    phaseId: 'phase-3',
    phaseTitle: 'Phase 3: Fintech & Shopping Rebate Snowball',
    phaseTimeframe: 'Days 7 to 21',
    company: 'Rakuten',
    offerId: 'offer-rakuten-cashback',
    defaultCode: 'RAKUTEN30CASH',
    defaultUrl: 'https://www.rakuten.com/r/RAKUTEN30CASH',
    capitalRequired: '$30.00 (Everyday routine spending)',
    capitalRequiredNumeric: 30,
    isOutofPocket: false,
    expectedPayout: '$30.00 100% Cash Rebate Match',
    conservativePayout: 30,
    maxPotentialPayout: 40,
    payoutTimeframe: 'Tracked in hours, payable on next payment schedule via PayPal',
    payoutSpeedCategory: '30-days',
    withdrawalMethod: 'PayPal or Direct Check',
    summary: 'A literal 100% rebate on $30 worth of shopping. Buy $30 in goods at Walmart, eBay, or Target and get $30 sent straight to PayPal.',
    walkthrough: [
      'Sign up for Rakuten using our referral link.',
      'Click through Rakuten to any major store where you already need to buy supplies.',
      'Checkout with at least $30.01 in items before tax and shipping.',
      'The $30.00 bonus shows as pending in your Rakuten dashboard within 24 hours.',
      'Paid directly to your PayPal account or mailed as a check.'
    ],
    honestTrap: 'Ensure tax and shipping do not inflate the number; the subtotal itself must be $30.00 or higher.',
    proTip: 'Disable ad-blockers before clicking through to store websites to ensure your referral cookie registers properly.',
  },

  // --- PHASE 4 ---
  {
    id: 'step-chime',
    stepNumber: 8,
    phaseId: 'phase-4',
    phaseTitle: 'Phase 4: Direct Deposit & Passive Compounding',
    phaseTimeframe: 'Days 14 to 30 (First Pay Cycle)',
    company: 'Chime',
    offerId: 'offer-chime-banking',
    defaultCode: 'markwinters39',
    defaultUrl: 'https://www.chime.com/r/markwinters39/',
    capitalRequired: '$0 Net Out-of-Pocket ($200 payroll redirect)',
    capitalRequiredNumeric: 0,
    isOutofPocket: false,
    expectedPayout: '$100.00 Instant Cash Match',
    conservativePayout: 100,
    maxPotentialPayout: 100,
    payoutTimeframe: 'Within 10 minutes to 2 business days of $200 direct deposit landing',
    payoutSpeedCategory: '7-14-days',
    withdrawalMethod: 'Chime Visa Debit, 50k+ Fee-Free ATMs, or External Bank Transfer',
    summary: 'The holy grail $100 cash match: Switch $200 of your normal workplace paycheck or gig income (DoorDash, Uber, Amazon Flex) to Chime and get $100 cash deposited immediately.',
    walkthrough: [
      'Open a free Chime Checking account with referral code markwinters39.',
      'Log into your employer payroll portal (ADP, Gusto, Workday) or gig platform app.',
      'Set up a split direct deposit: designate just $200 to route to your Chime account, leaving the rest to your main bank.',
      'When your next payday hits and the $200 lands, Chime instantly deposits the $100 cash match.',
      'Withdraw the full $300 at any free ATM, spend it on the card, or transfer it back to your primary bank.'
    ],
    honestTrap: 'Transfers from PayPal, Cash App, Venmo, or peer accounts do NOT trigger the $100 bonus. It MUST be an official automated ACH payroll or gig platform direct deposit.',
    proTip: 'You do NOT need to switch your entire paycheck! Most payroll software allows you to add a "Partial Direct Deposit (Fixed Amount = $200.00)" so only $200 moves to Chime while your salary remains unchanged.',
  },
  {
    id: 'step-daily-reloads',
    stepNumber: 9,
    phaseId: 'phase-4',
    phaseTitle: 'Phase 4: Direct Deposit & Passive Compounding',
    phaseTimeframe: 'Ongoing (Daily Habit)',
    company: 'Daily Login Reload Engines (Stake.us & Freecash)',
    offerId: 'offer-stake-us',
    defaultCode: 'fastcash',
    defaultUrl: 'https://stake.us/?c=fastcash',
    capitalRequired: '$0.00 (Zero Investment)',
    capitalRequiredNumeric: 0,
    isOutofPocket: false,
    expectedPayout: '$30.00 - $45.00/Month Pure Passive',
    conservativePayout: 30,
    maxPotentialPayout: 60,
    payoutTimeframe: 'Claimable every 24 hours on timer',
    payoutSpeedCategory: 'immediate',
    withdrawalMethod: 'Crypto (LTC) or PayPal',
    summary: 'Both Stake.us and Freecash offer daily login rewards. Stake.us pays $1.00 free Stake Cash every 24 hours just for opening the website.',
    walkthrough: [
      'Set a recurring bookmark or alarm on your phone for 12:00 PM every day.',
      'Log into Stake.us and click your profile > Daily Reload to collect your $1.00.',
      'Over 30 days, this accumulates to $30.00 free cash with 10 seconds of effort per day.',
      'Log into Freecash and claim your daily streak reward on the earn page.'
    ],
    honestTrap: 'Don\'t play the $1.00 daily reload on risky games; stack it in your balance until you hit $40-$50, wash it on 99% dice, and cash out.',
    proTip: '30 days of daily logins = $30.00 guaranteed from Stake + ~$5.00 from Freecash = $35.00/month recurring zero-deposit passive income.',
  },
  {
    id: 'step-acebet',
    stepNumber: 10,
    phaseId: 'phase-4',
    phaseTitle: 'Phase 4: Direct Deposit & Passive Compounding',
    phaseTimeframe: 'Optional High-Roll Tier',
    company: 'AceBet',
    offerId: 'offer-acebet',
    defaultCode: 'casino',
    defaultUrl: 'https://acebet.cc/welcome/r/casino',
    capitalRequired: '$10.00 (Funded strictly from accumulated profits)',
    capitalRequiredNumeric: 10,
    isOutofPocket: false,
    expectedPayout: '100% Match Bonus ($10 - $100 Credits)',
    conservativePayout: 10,
    maxPotentialPayout: 100,
    payoutTimeframe: 'Instant upon qualifying deposit match',
    payoutSpeedCategory: 'immediate',
    withdrawalMethod: 'Direct Wallet Withdrawal',
    summary: 'Only attempt this after Phase 1, 2, and 3 are complete. Use $10 of house profits to claim the 100% match with promo code casino.',
    walkthrough: [
      'Register with promo code casino.',
      'Activate the 100% welcome match bonus.',
      'Play strictly with promotional balance adhering to platform terms.',
      'Withdraw once wagering conditions are satisfied.'
    ],
    honestTrap: 'Never risk your original seed capital. Only ever use surplus profit generated from Step 1 through 8.',
    proTip: 'Treat entertainment offers as bonus multipliers, never primary income.',
  }
];

export interface BlueprintMilestone {
  label: string;
  targetAmount: string;
  timeframe: string;
  keyAction: string;
}

export const BLUEPRINT_MILESTONES: BlueprintMilestone[] = [
  {
    label: 'Milestone 1: The Breakout',
    targetAmount: '$35 - $60',
    timeframe: 'Day 1 (Under 24 Hours)',
    keyAction: 'Complete Stake.us ($25) + Freecash ($10). Cash out to PayPal/Crypto. Net Out-of-Pocket: $0.00.',
  },
  {
    label: 'Milestone 2: The Brokerage Multiplier',
    targetAmount: '$75 - $140',
    timeframe: 'Days 2 - 5',
    keyAction: 'Deposit $1 into Webull to unlock $36+ free stocks + Robinhood $10 free share.',
  },
  {
    label: 'Milestone 3: The Fintech Expansion',
    targetAmount: '$150 - $450',
    timeframe: 'Days 5 - 14',
    keyAction: 'Open SoFi with $10 profit for $25 cash bonus + Capital One Shopping $30-$100 rebate.',
  },
  {
    label: 'Milestone 4: The Direct Deposit Boss Level',
    targetAmount: '$650 - $1,250+',
    timeframe: 'Days 14 - 30+',
    keyAction: 'Route $200 split payroll to Chime for instant $100 match + 30 days of Stake $1/day passive logins.',
  },
];
