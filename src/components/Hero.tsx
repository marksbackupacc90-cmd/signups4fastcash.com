import React from 'react';
import { ArrowRight, BellRing, Download, Sparkles } from 'lucide-react';
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
        <div className="retro-window overflow-hidden rounded-[1.75rem] border-white/[0.1] bg-[radial-gradient(circle_at_80%_0%,rgba(45,212,238,0.14),transparent_32%),#0d1724] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="bg-white/[0.025] p-5 sm:p-7 lg:p-9">
        
        {/* Main Headline */}
        <div className="flex flex-col gap-5">
          <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
            {settings.mainHeadline}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl">
            {settings.subHeadline}
          </p>
          <p className="mt-3 text-[13px] sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
            S4FC lists offer requirements, but the company running each offer decides who qualifies and whether it pays. Check its current terms before signing up.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#2dd4ee] px-5 py-3 text-xs font-bold text-[#06131a] shadow-[0_10px_28px_rgba(45,212,238,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#67e8f9]"
            >
              Browse offers
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {onOpenFinder && (
              <button
                type="button"
                onClick={onOpenFinder}
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-xs font-semibold text-zinc-200 transition-all hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                Find offers that fit
              </button>
            )}
            {onInstallApp && (
              <button
                type="button"
                onClick={onInstallApp}
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-cyan-300/20 px-4 py-3 text-xs font-medium text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-300/[0.06]"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Add to home screen
              </button>
            )}
          </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/[0.08] pt-5 text-xs font-mono text-zinc-400">
          <span><strong className="text-white">{totalOffersCount}</strong> listed offers</span>
          <span><strong className="text-emerald-400">Terms shown</strong> before you click</span>
          <span><strong className="text-white">$0</strong> payment handling</span>
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
