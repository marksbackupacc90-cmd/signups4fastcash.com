import React from 'react';
import { CheckCircle2, ExternalLink, Search } from 'lucide-react';

const STEPS = [
  {
    icon: Search,
    title: 'Compare',
    description: 'Scan the reward, requirements, and payout timing.',
  },
  {
    icon: ExternalLink,
    title: 'Apply direct',
    description: 'Use the official partner link when you are ready.',
  },
  {
    icon: CheckCircle2,
    title: 'Complete',
    description: 'Follow the terms and keep your confirmation email.',
  },
];

export const HowItWorks: React.FC = () => (
  <section aria-labelledby="how-it-works-title" className="how-it-works-strip rounded-xl border border-white/[0.08] bg-[#0e121a] px-4 py-3 sm:px-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <h2 id="how-it-works-title" className="shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-white">
        How it works
      </h2>
      <div className="grid flex-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {STEPS.map(({ icon: Icon, title, description }, index) => (
          <div key={title} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <p className="min-w-0 text-[11px] leading-relaxed text-zinc-400">
              <span className="font-semibold text-zinc-200">{index + 1}. {title}</span>
              <span className="block">{description}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
