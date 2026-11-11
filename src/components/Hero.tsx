import React from 'react';
import { ArrowRight, BellRing, Check, Download, Sparkles } from 'lucide-react';
import { DEFAULT_SITE_SETTINGS, SiteSettings } from '../types';

interface HeroProps {
  siteSettings?: SiteSettings;
  totalOffersCount: number;
  onOpenFinder?: () => void;
  onOpenNewsletter?: () => void;
  onInstallApp?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  siteSettings,
  totalOffersCount,
  onOpenFinder,
  onOpenNewsletter,
  onInstallApp,
}) => {
  const settings = siteSettings || DEFAULT_SITE_SETTINGS;

  return (
    <section className="relative overflow-hidden pb-5 pt-5 sm:pb-6 sm:pt-7">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="retro-window relative isolate overflow-hidden rounded-[1.75rem] border-white/[0.1] bg-[#0d1724] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_0%,rgba(45,212,238,0.2),transparent_38%),radial-gradient(ellipse_at_0%_100%,rgba(99,102,241,0.12),transparent_42%)]" />
          <div className="p-5 sm:p-7 lg:p-9">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-center">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-100">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {settings.heroBadge || 'Offers, with the fine print up front'}
                </span>
                <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {settings.mainHeadline}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                  {settings.subHeadline}
                </p>
                <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-zinc-400 sm:text-sm">
                  S4FC shares offer details, but the company running each offer decides who qualifies and whether it pays. Always check its current terms.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full bg-[#2dd4ee] px-5 py-3 text-sm font-bold text-[#06131a] shadow-[0_10px_28px_rgba(45,212,238,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[#67e8f9]"
                  >
                    Browse offers
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {onOpenFinder && (
                    <button
                      type="button"
                      onClick={onOpenFinder}
                      className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-zinc-200 transition-all hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
                    >
                      <Sparkles className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                      Find offers that fit
                    </button>
                  )}
                  {onInstallApp && (
                    <button
                      type="button"
                      onClick={onInstallApp}
                      className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full border border-cyan-300/20 px-4 py-3 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-300/[0.06]"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Add to home screen
                    </button>
                  )}
                </div>
              </div>

              <aside className="rounded-2xl border border-white/[0.1] bg-[#07111b]/80 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)] backdrop-blur-sm sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">The important details</p>
                <h2 className="mt-2 text-xl font-bold text-white">Compare with your eyes open.</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">See the key terms before you leave for a provider’s site.</p>
                <ul className="mt-5 space-y-3">
                  {['Potential reward', 'What you need to do', 'Payout timing and catches'].map((item) => (
                    <li key={item} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-sm font-semibold text-zinc-200">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-300/10 text-emerald-200">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-zinc-500">Provider eligibility and payment decisions are always theirs to make.</p>
              </aside>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/[0.08] pt-5 text-xs font-mono text-zinc-400">
              <span><strong className="text-white">{totalOffersCount}</strong> available offers</span>
              <span><strong className="text-emerald-300">Key terms</strong> before you click</span>
              <span><strong className="text-white">$0</strong> payment handling by S4FC</span>
            </div>

            {onOpenNewsletter && (
              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                    <BellRing className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Get new offers by email</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-300">Choose alerts as soon as offers are added, a daily email, or a weekly roundup. Confirm your email; unsubscribe anytime.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenNewsletter}
                  className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-bold text-[#06131a] transition-colors hover:bg-cyan-200"
                >
                  Subscribe to alerts
                  <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
