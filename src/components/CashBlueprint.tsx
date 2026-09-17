import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';

const DEBBIE_REFERRAL_URL = 'https://www.joindebbie.com/referral?name=Mark&ref_id=2FMKVWHWZ';

const steps = [
  {
    number: '01',
    title: 'Start with SoFi',
    description: 'Open the SoFi offer first, then review the current Credit Score Monitoring and account-opening terms shown by SoFi.',
    action: 'Open SoFi offer',
    target: 'offer-sofi-banking',
    external: false,
  },
  {
    number: '02',
    title: 'Review the next option',
    description: 'If you decide to continue, review SoFi’s current funding and direct-deposit terms at your own pace. Nothing here requires a deposit or payroll change.',
    action: 'Review the option',
    target: 'offer-sofi-banking',
    external: false,
  },
  {
    number: '03',
    title: 'Check optional SoFi extras',
    description: 'Before opening investing or crypto products, confirm the current requirements, risks, and whether the reward is worth the activity for you.',
    action: 'View SoFi offer',
    target: 'offer-sofi-banking',
    external: false,
  },
  {
    number: '04',
    title: 'Add Debbie as the rewards layer',
    description: 'If Debbie looks useful to you, review the referral page first. Account linking is optional and should only happen when you are comfortable with the app’s privacy and reward terms.',
    action: 'Explore Debbie',
    target: DEBBIE_REFERRAL_URL,
    external: true,
  },
];

export const CashBlueprint: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleStepClick = (target: string, external: boolean) => {
    if (external) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,238,0.12),transparent_34%),#0d1724] p-5 shadow-[0_18px_50px_rgba(2,10,18,0.28)] sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Featured money path
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            New to SoFi or Debbie? Don&apos;t miss this.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            The SoFi + Debbie cash blueprint is simply a way to explore separate opportunities at your own pace. You can still earn from options that do not require a bank link or deposit, and you can skip any step that is not right for you.
          </p>
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            className="focus-ring mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-300/20 hover:text-white"
          >
            {isExpanded ? 'Hide blueprint' : 'See the 4-step blueprint'}
            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
        <div className="max-w-xs rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-relaxed text-amber-100">
          <ShieldCheck className="mb-1 h-4 w-4 text-amber-300" aria-hidden="true" />
          Take your time. You do not have to link a bank or make a deposit to earn from every option—review each offer’s requirements and choose only what works for you.
        </div>
      </div>

      {isExpanded && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {steps.map((step) => (
            <article key={step.number} className="flex min-h-44 flex-col rounded-xl border border-white/10 bg-white/[0.035] p-4 transition-colors hover:border-cyan-300/30 hover:bg-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-xs font-bold tracking-[0.16em] text-cyan-300">{step.number}</span>
                {step.external && <ExternalLink className="h-4 w-4 text-zinc-500" aria-hidden="true" />}
              </div>
              <h3 className="mt-3 text-base font-bold text-white">{step.title}</h3>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-400">{step.description}</p>
              <button
                type="button"
                onClick={() => handleStepClick(step.target, step.external)}
                className="focus-ring mt-4 inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-cyan-200 transition-colors hover:text-white"
              >
                {step.action}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
