import React from 'react';
import { CircleHelp, ShieldCheck } from 'lucide-react';
import { DEFAULT_SITE_SETTINGS, SiteSettings } from '../types';

interface TrustAndFaqProps {
  siteSettings?: SiteSettings;
}

export const TrustAndFaq: React.FC<TrustAndFaqProps> = ({ siteSettings }) => {
  const settings = siteSettings || DEFAULT_SITE_SETTINGS;

  return (
    <section id="trust" className="mx-auto max-w-7xl space-y-6 border-t border-white/[0.08] px-4 pb-8 pt-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          How S4FC handles offers
        </div>
        <h2 className="mt-2 text-xl sm:text-2xl font-extrabold text-white">
          {settings.trustHeading || 'Check the details before you sign up'}
        </h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          {settings.trustParagraph || 'S4FC lists referral and promo offers, notes the requirements and payout details available, and links to the company running each offer. The company decides who qualifies and whether a reward is paid. S4FC does not handle applications or money.'}
        </p>
        <p className="mt-3 text-[13px] text-zinc-300 leading-relaxed">
          {settings.trustSubtext || 'Some links may earn S4FC a referral commission at no extra cost to you. Offers can change or end, so read the company’s current terms before signing up.'}
        </p>
        <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4">
          <h3 className="text-sm font-bold text-emerald-100">A note about the numbers</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-200">
            Click totals are tracked link clicks, not a count of unique people. Offer details can change, so the company’s current terms are the final word.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <CircleHelp className="w-4 h-4 text-cyan-400" />
          Frequently asked questions
        </div>
        <details className="group rounded-lg border border-white/[0.08] bg-[#0e121a] px-4 py-3">
          <summary className="cursor-pointer text-sm text-zinc-200">Do you guarantee that every offer will pay?</summary>
          <p className="mt-2 text-[13px] text-zinc-300 leading-relaxed">No. The company running the offer decides who qualifies and whether it pays. Read its current terms before applying.</p>
        </details>
        <details className="group rounded-lg border border-white/[0.08] bg-[#0e121a] px-4 py-3">
          <summary className="cursor-pointer text-sm text-zinc-200">How does Signups4FastCash.com make money?</summary>
          <p className="mt-2 text-[13px] text-zinc-300 leading-relaxed">Some links are referral or affiliate links. If you use one, the company may pay S4FC a commission at no extra cost to you. It does not change the offer terms.</p>
        </details>
        <details className="group rounded-lg border border-white/[0.08] bg-[#0e121a] px-4 py-3">
          <summary className="cursor-pointer text-sm text-zinc-200">Is this financial advice?</summary>
          <p className="mt-2 text-[13px] text-zinc-300 leading-relaxed">No. This is promotional information, not financial, tax, legal, or investment advice. Consider your circumstances and the official terms before participating.</p>
        </details>
      </div>
    </section>
  );
};