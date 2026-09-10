import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';

export const SurveyRewardsPanel: React.FC = () => (
  <section className="rounded-xl border border-cyan-400/20 bg-[#0e121a] p-5 sm:p-7">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-lg bg-cyan-400/10 p-2 text-cyan-300">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-cyan-300">Surveys &amp; Rewards</p>
        <h2 className="mt-1 text-xl font-bold text-white">Earn only through approved survey partners</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          We are preparing a survey wall with CPX Research and other approved providers. It is not live yet,
          so we are not promising survey availability, earnings, or instant payouts.
        </p>
      </div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {[
        ['Clear requirements', 'See eligibility, estimated time, and provider terms before starting.'],
        ['Provider handles rewards', 'Payouts and survey decisions remain subject to the provider’s rules.'],
        ['No guaranteed income', 'Survey inventory, rates, reversals, and eligibility can change.'],
      ].map(([title, text]) => (
        <div key={title} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <h3 className="text-xs font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{text}</p>
        </div>
      ))}
    </div>
    <a
      href="#trust"
      className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
    >
      Review how offers work
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  </section>
);
