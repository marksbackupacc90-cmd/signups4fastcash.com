import React from 'react';
import { Clock3, ExternalLink, Gift, ShieldAlert } from 'lucide-react';
import { Offer } from '../types';

interface DailyBonus {
  name: string;
  bonus: string;
  timing: string;
  url: string;
  referral: boolean;
  note: string;
}

const BASE_DAILY_BONUSES: DailyBonus[] = [
  {
    name: 'Stake.us',
    bonus: '1 SC',
    timing: 'Every 24 hours',
    url: 'https://stake.us/?c=fastcash',
    referral: true,
    note: 'Eligibility, verification, and redemption rules apply.',
  },
  {
    name: 'Modo.us',
    bonus: '0.30 SC',
    timing: 'Daily at 3:00 AM Eastern',
    url: 'https://modo.us',
    referral: false,
    note: 'Official site link until a personal referral URL is added.',
  },
  {
    name: 'Shuffle.us',
    bonus: '0.40 SC',
    timing: 'Daily at 1:00 AM Eastern',
    url: 'https://shuffle.us?r=Dz1S2aFLk9',
    referral: true,
    note: 'Confirm the current promotion and eligibility before joining.',
  },
  {
    name: 'SpinQuest',
    bonus: 'Daily bonus',
    timing: 'Every 24 hours',
    url: 'https://spinquest.com',
    referral: false,
    note: 'Official site link until a personal referral URL is added.',
  },
  {
    name: 'Crown Coins',
    bonus: 'Daily bonus',
    timing: 'Daily at 6:00 AM Eastern',
    url: 'https://crowncoinscasino.com',
    referral: false,
    note: 'Official site link until a personal referral URL is added.',
  },
  {
    name: 'CoinsBackCasino',
    bonus: 'Daily bonus',
    timing: 'Every 24 hours',
    url: 'https://coinsbackcasino.com',
    referral: false,
    note: 'Official site link until a personal referral URL is added.',
  },
  {
    name: 'MyPrize.us',
    bonus: 'Daily bonus varies',
    timing: 'Daily at 8:00 PM Eastern',
    url: 'https://myprize.us/invite/winterfrizzle',
    referral: true,
    note: 'Review the current promotion, eligibility, and redemption rules.',
  },
  {
    name: 'AceBet',
    bonus: 'Daily bonus varies',
    timing: 'Daily; timing and value vary',
    url: 'https://acebet.cc/welcome/r/casino',
    referral: true,
    note: 'Confirm the current promotion and location eligibility before joining.',
  },
];

interface DailyCasinoBonusesProps {
  offers: Offer[];
}

export const DailyCasinoBonuses: React.FC<DailyCasinoBonusesProps> = ({ offers }) => {
  const dailyBonuses = BASE_DAILY_BONUSES.map((bonus) => {
    const matchingOffer = offers.find((offer) => offer.company.toLowerCase().replace(/[^a-z]/g, '').includes(bonus.name.toLowerCase().replace(/[^a-z]/g, '')));
    if (!matchingOffer) return bonus;
    return {
      ...bonus,
      url: matchingOffer.referralUrl || matchingOffer.officialMerchantUrl,
      referral: Boolean(matchingOffer.referralUrl),
      note: matchingOffer.referralUrl
        ? 'Referral link attached. Review the current promotion and eligibility before joining.'
        : bonus.note,
    };
  });

  return (
  <section
    aria-labelledby="daily-casino-bonuses-title"
    className="overflow-hidden rounded-2xl border border-amber-300/20 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_36%),#17130d] p-5 shadow-[0_18px_50px_rgba(20,12,2,0.25)] sm:p-7"
  >
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-amber-200">
          <Gift className="h-3.5 w-3.5" aria-hidden="true" />
          Daily bonus checklist
        </div>
        <h2 id="daily-casino-bonuses-title" className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          Check eligible daily social-casino bonuses
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          These are daily bonus reminders, not guaranteed cash. Create an account only if you are eligible,
          review the current sweepstakes rules, and check each site on its own schedule.
        </p>
      </div>
      <div className="max-w-xs rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-relaxed text-amber-100">
        <ShieldAlert className="mb-1 h-4 w-4 text-amber-300" aria-hidden="true" />
        No purchase or deposit is implied. Availability, age/state restrictions, verification, playthrough,
        redemption, and expiration rules are controlled by each operator.
      </div>
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {dailyBonuses.map((bonus) => (
        <article key={bonus.name} className="flex min-h-44 flex-col rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-bold text-white">{bonus.name}</h3>
            <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[10px] font-semibold text-amber-200">
              {bonus.referral ? 'Referral link' : 'Official link'}
            </span>
          </div>
          <div className="mt-4 text-xl font-black text-emerald-300">{bonus.bonus}</div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-300">
            <Clock3 className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
            {bonus.timing}
          </div>
          <p className="mt-3 flex-1 text-[11px] leading-relaxed text-zinc-500">{bonus.note}</p>
          <a
            href={bonus.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-[#171208] transition-colors hover:bg-amber-200"
          >
            {bonus.referral ? 'Open referral link' : 'Open official site'}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </article>
      ))}
    </div>

    <p className="mt-5 border-t border-white/[0.08] pt-3 text-[11px] leading-relaxed text-zinc-500">
      Affiliate disclosure: Cards marked &quot;Referral link&quot; use a referral URL associated with this site.
      Cards marked &quot;Official link&quot; go to the operator&apos;s public website and do not attribute a referral.
      Referral compensation, if any, is at no extra cost to you. Daily bonus values and schedules are based on
      the current checklist and should be verified on each operator&apos;s website.
    </p>
  </section>
  );
};
