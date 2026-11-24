export const SEED_PREFIX = 'seed_s4fc_';

export const seedCampaigns = [
  {
    id: 'seed_s4fc_monopoly-go',
    title: 'Monopoly Go!',
    category: 'gaming',
    totalValue: 34.5,
    milestones: [
      { stepNumber: 1, level: 5, payoutAmount: 2, description: 'Reach level 5' },
      { stepNumber: 2, level: 10, payoutAmount: 7.5, description: 'Reach level 10' },
      { stepNumber: 3, level: 20, payoutAmount: 25, description: 'Reach level 20' },
    ],
  },
  {
    id: 'seed_s4fc_sofi-checking',
    title: 'SoFi Checking & Savings',
    category: 'fintech',
    totalValue: 4.9,
    milestones: [
      { stepNumber: 1, level: 1, payoutAmount: 4.9, description: 'Qualifying account verification' },
    ],
  },
  {
    id: 'seed_s4fc_kraken-trade',
    title: 'Kraken Crypto Trade',
    category: 'crypto',
    totalValue: 12,
    milestones: [
      { stepNumber: 1, level: 1, payoutAmount: 12, description: 'Qualifying trade verification' },
    ],
  },
];

export const seedProfiles = [
  ['Mia', 'TX', 18.5], ['Jay', 'CA', 42.25], ['Alex', 'NY', 9.75],
  ['Sam', 'FL', 26.4], ['Nora', 'WA', 74.1], ['Leo', 'IL', 12.3],
  ['Zoe', 'GA', 33.8], ['Eli', 'NC', 17.95], ['Ava', 'AZ', 51.2],
  ['Noah', 'PA', 8.6], ['Lily', 'OH', 64.35], ['Jack', 'NJ', 21.15],
  ['Emma', 'VA', 37.7], ['Ryan', 'TN', 14.45], ['Chloe', 'CO', 29.9],
];
