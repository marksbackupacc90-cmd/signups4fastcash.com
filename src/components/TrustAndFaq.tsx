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
          Transparent by design
        </div>
        <h2 className="mt-2 text-xl sm:text-2xl font-extrabold text-white">
          {settings.trustHeading || 'Compare signup bonuses with confidence'}
        </h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          {settings.trustParagraph || 'We organize publicly available referral and promotional offers so you can compare signup bonuses, no-deposit rewards, cashback offers, requirements, timing, and fine print before visiting the official merchant. We do not hold your money, complete applications for you, or guarantee payment.'}
        </p>
        <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
          {settings.trustSubtext || 'Signups4FastCash.com is an independent comparison site, not a bank, lender, broker, merchant, or government service. Some links may earn us a referral commission at no extra cost to you. Offer terms, payout timing, and eligibility can change. Please review the current official terms before signing up.'}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <CircleHelp className="w-4 h-4 text-cyan-400" />
          Frequently asked questions
        </div>
        <details className="group rounded-lg border border-white/[0.08] bg-[#0e121a] px-4 py-3">
          <summary className="cursor-pointer text-sm text-zinc-200">Do you guarantee that every offer will pay?</summary>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">No. The merchant controls eligibility and payout. We show the requirements we can verify, but you should read the official terms before applying.</p>
        </details>
        <details className="group rounded-lg border border-white/[0.08] bg-[#0e121a] px-4 py-3">
          <summary className="cursor-pointer text-sm text-zinc-200">How does Signups4FastCash.com make money?</summary>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">Some links are referral or affiliate links. If you use one, the merchant may compensate us at no additional cost to you. This does not change the requirements set by the merchant.</p>
        </details>
        <details className="group rounded-lg border border-white/[0.08] bg-[#0e121a] px-4 py-3">
          <summary className="cursor-pointer text-sm text-zinc-200">Is this financial advice?</summary>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">No. This is promotional information, not financial, tax, legal, or investment advice. Consider your circumstances and the official terms before participating.</p>
        </details>
      </div>
    </section>
  );
};