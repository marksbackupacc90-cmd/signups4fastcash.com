import React from 'react';
import { CircleHelp, ShieldCheck } from 'lucide-react';

export const TrustAndFaq: React.FC = () => {
  return (
    <section id="trust" className="border-t border-white/[0.08] pt-8 space-y-6">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          Transparent by design
        </div>
        <h2 className="mt-2 text-xl sm:text-2xl font-extrabold text-white">
          How signup bonuses work
        </h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          We organize publicly available referral and promotional offers so you can compare the reward, requirements, timing, and fine print before visiting the official merchant. We do not hold your money or complete applications for you.
        </p>
        <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
          ClearPerks is an independent comparison site, not a bank, lender, broker, merchant, or government service. Some links may earn us a referral commission at no extra cost to you. For corrections or outdated terms, contact the site operator through the email in the footer.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-[#0e121a] border border-white/[0.08]">
          <h3 className="text-sm font-bold text-white">1. Compare the terms</h3>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">Check eligibility, deposits, purchases, identity checks, and payout timing before you click through.</p>
        </div>
        <div className="p-4 rounded-lg bg-[#0e121a] border border-white/[0.08]">
          <h3 className="text-sm font-bold text-white">2. Apply directly</h3>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">Applications and payments happen on the official merchant website, never through us.</p>
        </div>
        <div className="p-4 rounded-lg bg-[#0e121a] border border-white/[0.08]">
          <h3 className="text-sm font-bold text-white">3. Confirm the payout</h3>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">Meet the merchant's requirements and keep your confirmation emails until the reward arrives.</p>
        </div>
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
          <summary className="cursor-pointer text-sm text-zinc-200">How does ClearPerks make money?</summary>
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