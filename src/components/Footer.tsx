import React from 'react';
import { ShieldCheck, Zap, Lock, BarChart3, Bell } from 'lucide-react';

interface FooterProps {
  onOpenNewsletter: () => void;
  onOpenExportModal: () => void;
  onSelectAdmin: () => void;
  onSelectAnalytics?: () => void;
  onTogglePush?: () => void;
  pushEnabled?: boolean;
  onOpenLegal?: (section: 'privacy' | 'terms' | 'affiliate') => void;
  isAdminUnlocked?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenNewsletter,
  onOpenExportModal,
  onSelectAdmin,
  onSelectAnalytics,
  onTogglePush,
  pushEnabled = false,
    onOpenLegal,
  isAdminUnlocked = false,
}) => {
  return (
    <footer className="border-t border-white/[0.08] bg-[#07090d] text-zinc-400 text-xs py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Top row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Col 1: Brand & Promise */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#10141d] border border-white/10 flex items-center justify-center text-[#00f2fe] font-mono font-bold text-xs">
                $
              </div>
              <span className="font-mono font-bold text-white text-base">
                signups<span className="text-[#00f2fe]">4</span>fastcash<span className="text-zinc-500 font-normal text-xs">.com</span>
              </span>
            </div>
            
            <p className="text-zinc-400 text-xs leading-relaxed max-w-md">
              A transparent referral bonus comparison site. We summarize publicly available promotions, show the requirements and fine print, and send you to the official merchant to apply.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Non-Custodial: $0 User Fees
              </span>
              <span className="inline-flex items-center gap-1 text-[#00f2fe] bg-[#00f2fe]/10 px-2 py-0.5 rounded border border-[#00f2fe]/20">
                <Zap className="w-3.5 h-3.5" />
                Edge SSG Performance
              </span>
            </div>
          </div>

          {/* Col 2: Navigation & Quick Links */}
          <div className="space-y-2">
            <div className="font-mono font-semibold text-white uppercase text-xs tracking-wider">
              Quick Navigation
            </div>
            <ul className="space-y-1.5 text-zinc-400 font-sans">
              <li>
                <a href="#offers" className="hover:text-white transition-colors">
                  All Available Offers
                </a>
              </li>
              <li>
                <button onClick={onOpenNewsletter} className="hover:text-white transition-colors text-left">
                  Email Drop Alerts
                </button>
              </li>
              {onSelectAnalytics && (
                <li>
                  <button onClick={onSelectAnalytics} className="hover:text-white transition-colors text-left flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    Conversion Dashboard
                  </button>
                </li>
              )}
              {onTogglePush && (
                <li>
                  <button onClick={onTogglePush} className="hover:text-white transition-colors text-left flex items-center gap-1">
                    <Bell className="w-3 h-3" />
                    {pushEnabled ? 'Push Alerts On' : 'Enable Push Alerts'}
                  </button>
                </li>
              )}
              <li>
                <button onClick={onOpenExportModal} className="hover:text-white transition-colors text-left flex items-center gap-1">
                  <span>SSG Build Feed</span>
                  <Zap className="w-3 h-3 text-[#00f2fe]" />
                </button>
              </li>
              {isAdminUnlocked && (
                <li>
                  <button onClick={onSelectAdmin} className="hover:text-amber-300 transition-colors text-left flex items-center gap-1 text-zinc-500">
                    <Lock className="w-3 h-3" />
                    <span>Admin Panel</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Col 3: Legal & Disclosure */}
          <div className="space-y-2">
            <div className="font-mono font-semibold text-white uppercase text-xs tracking-wider">
              Legal &amp; Disclosure
            </div>
            {onOpenLegal && (
              <div className="space-y-1.5 text-zinc-300">
                <button onClick={() => onOpenLegal('privacy')} className="block hover:text-white transition-colors text-left">Privacy Policy</button>
                <button onClick={() => onOpenLegal('terms')} className="block hover:text-white transition-colors text-left">Terms &amp; Disclaimer</button>
                <button onClick={() => onOpenLegal('affiliate')} className="block hover:text-white transition-colors text-left">Affiliate Disclosure</button>
              </div>
            )}
            <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
              <strong>Affiliate Disclosure:</strong> Some links may compensate us at no additional cost to you. Offers are controlled by their merchants; eligibility, terms, taxes, fees, and payout timing can change. We do not provide financial, tax, legal, or investment advice.
            </p>
          </div>

        </div>

        {/* Bottom copyright & disclaimer */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} signups4fastcash.com — All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by CashBot Autonomous Engine</span>
            <span>•</span>
            <a href="#trust" className="text-emerald-400 hover:text-emerald-300">How offers work</a>
          </div>
        </div>

      </div>
    </footer>
  );
};
